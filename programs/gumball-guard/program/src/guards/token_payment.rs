use mallow_gumball::{constants::AUTHORITY_SEED, GumballMachine};
use mallow_jellybean_sdk::accounts::JellybeanMachine;

use super::*;

use crate::{
    errors::GumballGuardError,
    events::PaymentEvent,
    state::GuardType,
    try_from,
    utils::{
        assert_is_token_account, get_bps_of, pay_fee_accounts, spl_token_transfer,
        TokenTransferParams,
    },
};

/// Guard that charges an amount in a specified spl-token as payment for the mint.
///
/// List of accounts required:
///
///   0. `[writable]` Token account holding the required amount.
///   1. `[writable]` Address of the ATA to receive the tokens.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TokenPayment {
    pub amount: u64,
    pub mint: Pubkey,
}

impl Guard for TokenPayment {
    fn size() -> usize {
        8    // amount
        + 32 // token mint
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::TokenPayment)
    }
}

impl Condition for TokenPayment {
    fn validate<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        match ctx.machine_type {
            MachineType::Gumball => self.validate_gumball(ctx, _guard_set, _mint_args)?,
            MachineType::Jellybean => self.validate_jellybean(ctx, _guard_set, _mint_args)?,
        }

        Ok(())
    }

    fn pre_actions<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        match ctx.machine_type {
            MachineType::Gumball => self.pre_actions_gumball(ctx, _guard_set, _mint_args)?,
            MachineType::Jellybean => self.pre_actions_jellybean(ctx, _guard_set, _mint_args)?,
        }

        emit!(PaymentEvent {
            amount: self.amount,
            mint: self.mint,
        });

        Ok(())
    }
}

impl TokenPayment {
    fn validate_gumball<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let gumball_machine = try_from!(Account::<GumballMachine>, ctx.accounts.machine)?;

        require!(
            gumball_machine.settings.payment_mint == self.mint,
            GumballGuardError::InvalidPaymentMint
        );

        // token
        let token_account_index = ctx.account_cursor;
        let token_account_info = try_get_account_info(ctx.accounts.remaining, token_account_index)?;
        let destination_ata =
            try_get_account_info(ctx.accounts.remaining, token_account_index + 1)?;
        ctx.account_cursor += 2;

        if let Some(fee_config) = gumball_machine.marketplace_fee_config {
            if gumball_machine.version > 0 {
                ctx.account_cursor += 1;

                let fee_ata =
                    try_get_account_info(ctx.accounts.remaining, token_account_index + 2)?;
                assert_is_token_account(fee_ata, fee_config.fee_account, self.mint)?;
            }
        }

        let seeds = [
            AUTHORITY_SEED.as_bytes(),
            gumball_machine.to_account_info().key.as_ref(),
        ];
        let (authority_pda, _) = Pubkey::find_program_address(&seeds, &mallow_gumball::ID);
        assert_is_token_account(destination_ata, authority_pda, self.mint)?;

        let token_account =
            assert_is_token_account(token_account_info, ctx.accounts.payer.key(), self.mint)?;

        if token_account.amount < self.amount {
            return err!(GumballGuardError::NotEnoughTokens);
        }

        ctx.indices
            .insert("token_payment_index", token_account_index);

        Ok(())
    }

    fn pre_actions_gumball<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let index = ctx.indices["token_payment_index"];
        // the accounts have already been validated
        let token_account_info = try_get_account_info(ctx.accounts.remaining, index)?;
        let destination_ata = try_get_account_info(ctx.accounts.remaining, index + 1)?;
        let gumball_machine = try_from!(Account::<GumballMachine>, ctx.accounts.machine)?;

        let marketplace_fee_bps = if let Some(fee_confg) = gumball_machine.marketplace_fee_config {
            // Version 0 takes fee on claim, so no fee on draw
            if gumball_machine.version == 0 {
                0
            } else {
                fee_confg.fee_bps
            }
        } else {
            0
        };

        let marketplace_fee = get_bps_of(self.amount, marketplace_fee_bps)?;
        msg!("Marketplace fee: {}", marketplace_fee);

        if marketplace_fee > 0 {
            let fee_destination_ata = try_get_account_info(ctx.accounts.remaining, index + 2)?;

            spl_token_transfer(TokenTransferParams {
                source: token_account_info.to_account_info(),
                destination: fee_destination_ata.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
                authority_signer_seeds: &[],
                token_program: ctx.accounts.spl_token_program.to_account_info(),
                amount: marketplace_fee,
            })?;
        }

        let price_less_fees = self
            .amount
            .checked_sub(marketplace_fee)
            .ok_or(GumballGuardError::NumericalOverflowError)?;

        spl_token_transfer(TokenTransferParams {
            source: token_account_info.to_account_info(),
            destination: destination_ata.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
            authority_signer_seeds: &[],
            token_program: ctx.accounts.spl_token_program.to_account_info(),
            amount: price_less_fees,
        })?;

        cpi_increment_total_revenue(ctx, self.amount)?;

        Ok(())
    }

    fn validate_jellybean<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        ctx.indices
            .insert("source_token_account", ctx.account_cursor);

        let source_token_account_info =
            try_get_account_info(ctx.accounts.remaining, ctx.account_cursor)?;
        let token_account = assert_is_token_account(
            source_token_account_info,
            ctx.accounts.payer.key(),
            self.mint,
        )?;

        if token_account.amount < self.amount {
            return err!(GumballGuardError::NotEnoughTokens);
        }

        ctx.account_cursor += 1;

        ctx.indices.insert("fee_accounts", ctx.account_cursor);

        let jellybean_machine = try_from!(Account::<JellybeanMachine>, ctx.accounts.machine)?;
        for fee_account in &jellybean_machine.fee_accounts {
            let fee_account_ata = try_get_account_info(ctx.accounts.remaining, ctx.account_cursor)?;
            assert_is_token_account(fee_account_ata, fee_account.address, self.mint)?;

            ctx.account_cursor += 1;
        }

        ctx.indices.insert("fee_accounts_end", ctx.account_cursor);

        Ok(())
    }

    fn pre_actions_jellybean<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let jellybean_machine = try_from!(Account::<JellybeanMachine>, ctx.accounts.machine)?;

        let source_token_account_index = ctx.indices["source_token_account"];
        let source_token_account_info =
            try_get_account_info(ctx.accounts.remaining, source_token_account_index)?;

        let fee_accounts_start = ctx.indices["fee_accounts"];
        let fee_accounts_end = ctx.indices["fee_accounts_end"];
        let remaining_accounts = &ctx.accounts.remaining[fee_accounts_start..fee_accounts_end];

        let amount_transferred = pay_fee_accounts(
            &mut ctx.accounts.payer,
            Some(&source_token_account_info),
            Some(self.mint),
            &jellybean_machine.fee_accounts,
            remaining_accounts,
            Some(&ctx.accounts.spl_token_program),
            &ctx.accounts.system_program,
            self.amount,
        )?;

        let remaining_tokens = self
            .amount
            .checked_sub(amount_transferred)
            .ok_or(GumballGuardError::NumericalOverflowError)?;

        // Any remaining dust goes to first fee account
        spl_token_transfer(TokenTransferParams {
            source: source_token_account_info.to_account_info(),
            destination: remaining_accounts[0].to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
            authority_signer_seeds: &[],
            token_program: ctx.accounts.spl_token_program.to_account_info(),
            amount: remaining_tokens,
        })?;

        Ok(())
    }
}
