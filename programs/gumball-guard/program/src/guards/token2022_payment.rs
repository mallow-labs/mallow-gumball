use anchor_spl::associated_token::get_associated_token_address_with_program_id;
use mallow_gumball::GumballMachine;
use mallow_jellybean_client::accounts::JellybeanMachine;
use spl_token_2022::{
    extension::StateWithExtensions,
    state::{Account as SplToken2022Account, Mint},
};
use utils::{assert_keys_equal, assert_mint_extensions_allowed, assert_owned_by};

use super::*;

use crate::{
    errors::GumballGuardError,
    events::PaymentEvent,
    state::GuardType,
    try_from,
    utils::{
        assert_is_token_2022_account, get_bps_of, get_mint_decimals, pay_fee_accounts,
        token_transfer_checked, TokenTransferCheckedParams,
    },
};

/// Guard that charges an amount in a specified spl-token-2022 as payment for the draw.
///
/// # Gumball layout
///
/// ```text
/// 0. [writable] Token account holding the required amount.
/// 1. [writable] Address of the ATA to receive the tokens.
/// 2. [        ] Mint account.
/// 3. [        ] SPL Token-2022 program account.
/// 4. [writable] Marketplace fee ATA (only with a fee config on a v1+ machine).
/// ```
///
/// # Jellybean layout
///
/// ```text
/// 0.    [writable] Payer's Token-2022 token account.
/// 1.    [        ] Mint account.
/// 2.    [        ] SPL Token-2022 program account.
/// 3..N  [writable] One ATA per `JellybeanMachine.fee_accounts` entry.
/// ```
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Token2022Payment {
    pub amount: u64,
    pub mint: Pubkey,
    pub destination_ata: Pubkey,
}

impl Guard for Token2022Payment {
    fn size() -> usize {
        8    // amount
        + 32 // token mint
        + 32 // destination ata
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::Token2022Payment)
    }
}

impl Condition for Token2022Payment {
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

impl Token2022Payment {
    /// §D2 enforcement point 3.
    ///
    /// Neither gumball nor jellybean machine creation takes a mint *account* —
    /// `settings.payment_mint` is stored as a bare pubkey — so the extension
    /// allowlist has nowhere to run at creation time. The guard is the first
    /// place the mint account is available, so the screen goes here.
    ///
    /// This is what keeps settle accounting honest: a transfer-fee mint would
    /// otherwise pass the identity check, `transfer_checked` would skim the fee,
    /// and `increment_total_revenue` would record the gross.
    fn validate_payment_mint(&self, mint_info: &AccountInfo) -> Result<()> {
        assert_keys_equal(mint_info.key(), self.mint, "Invalid mint account")?;
        assert_owned_by(mint_info, &spl_token_2022::ID)?;
        assert_mint_extensions_allowed(mint_info)?;
        Ok(())
    }

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

        // required accounts
        let token_account_index = ctx.account_cursor;
        let token_account_info = try_get_account_info(ctx.accounts.remaining, token_account_index)?;
        let destination_ata =
            try_get_account_info(ctx.accounts.remaining, token_account_index + 1)?;
        let mint_info = try_get_account_info(ctx.accounts.remaining, token_account_index + 2)?;
        let spl_token_2022_program =
            try_get_account_info(ctx.accounts.remaining, token_account_index + 3)?;
        // Four accounts are read, so four are consumed. The previous `+= 3` (and
        // `+= 1` more in the fee branch, for five accounts) left the cursor one
        // short: latent while `token2022_payment` was the last `GuardSet` field
        // and nothing ran after it, but wrong the moment anything does.
        ctx.account_cursor += 4;

        if let Some(fee_config) = gumball_machine.marketplace_fee_config {
            if gumball_machine.version > 0 {
                ctx.account_cursor += 1;

                let fee_ata =
                    try_get_account_info(ctx.accounts.remaining, token_account_index + 4)?;
                let expected_ata = get_associated_token_address_with_program_id(
                    &fee_config.fee_account,
                    &self.mint,
                    &spl_token_2022_program.key,
                );

                assert_keys_equal(
                    fee_ata.key(),
                    expected_ata,
                    "Fee ATA does not match expected ATA",
                )?;
            }
        }

        // destination
        assert_keys_equal(
            destination_ata.key(),
            self.destination_ata,
            "Destination ATA does not match expected ATA",
        )?;
        let data = destination_ata.data.borrow();
        let ata_account = StateWithExtensions::<SplToken2022Account>::unpack(&data)?;
        assert_keys_equal(
            ata_account.base.mint,
            self.mint,
            "ATA mint does not match expected mint",
        )?;
        drop(data);

        // token
        let token_account =
            assert_is_token_2022_account(token_account_info, ctx.accounts.payer.key(), self.mint)?;

        if token_account.amount < self.amount {
            return err!(GumballGuardError::NotEnoughTokens);
        }

        // mint — identity, ownership and the §D2 extension allowlist
        self.validate_payment_mint(mint_info)?;

        // program
        assert_keys_equal(
            spl_token_2022_program.key(),
            spl_token_2022::ID,
            "Invalid token program",
        )?;

        ctx.indices
            .insert("token2022_payment_index", token_account_index);

        Ok(())
    }

    fn pre_actions_gumball<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let gumball_machine = try_from!(Account::<GumballMachine>, ctx.accounts.machine)?;

        let index = ctx.indices["token2022_payment_index"];
        // the accounts have already been validated
        let token_account_info = try_get_account_info(ctx.accounts.remaining, index)?;
        let destination_ata = try_get_account_info(ctx.accounts.remaining, index + 1)?;
        let mint_info = try_get_account_info(ctx.accounts.remaining, index + 2)?;
        let spl_token_2022_program = try_get_account_info(ctx.accounts.remaining, index + 3)?;

        let decimals = {
            let data = mint_info.data.borrow();
            StateWithExtensions::<Mint>::unpack(&data)?.base.decimals
        };

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
            let fee_destination_ata = try_get_account_info(ctx.accounts.remaining, index + 4)?;

            token_transfer_checked(TokenTransferCheckedParams {
                source: token_account_info.to_account_info(),
                mint: mint_info.to_account_info(),
                destination: fee_destination_ata.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
                authority_signer_seeds: &[],
                amount: marketplace_fee,
                decimals,
                token_program: spl_token_2022_program.to_account_info(),
            })?;
        }

        let price_less_fees = self
            .amount
            .checked_sub(marketplace_fee)
            .ok_or(GumballGuardError::NumericalOverflowError)?;

        token_transfer_checked(TokenTransferCheckedParams {
            source: token_account_info.to_account_info(),
            mint: mint_info.to_account_info(),
            destination: destination_ata.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
            authority_signer_seeds: &[],
            amount: price_less_fees,
            decimals,
            token_program: spl_token_2022_program.to_account_info(),
        })?;

        // `self.amount` is the gross, and it equals what the destinations
        // received: the §D2 allowlist rejects `TransferFeeConfig`, so no fee is
        // ever skimmed in flight. That is what makes this revenue figure — and
        // every settle payout derived from it — correct.
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
        let mint_info = try_get_account_info(ctx.accounts.remaining, ctx.account_cursor + 1)?;
        let spl_token_2022_program =
            try_get_account_info(ctx.accounts.remaining, ctx.account_cursor + 2)?;

        // `draw_jellybean` keeps `spl_token_program: Program<'info, Token>` as its
        // named account, so the Token-2022 program rides in the remaining
        // accounts exactly as it does on the Gumball branch.
        assert_keys_equal(
            spl_token_2022_program.key(),
            spl_token_2022::ID,
            "Invalid token program",
        )?;
        self.validate_payment_mint(mint_info)?;

        let token_account = assert_is_token_2022_account(
            source_token_account_info,
            ctx.accounts.payer.key(),
            self.mint,
        )?;

        if token_account.amount < self.amount {
            return err!(GumballGuardError::NotEnoughTokens);
        }

        ctx.indices.insert("payment_mint", ctx.account_cursor + 1);
        ctx.indices.insert("token_program", ctx.account_cursor + 2);
        ctx.account_cursor += 3;

        ctx.indices.insert("fee_accounts", ctx.account_cursor);

        let jellybean_machine = try_from!(Account::<JellybeanMachine>, ctx.accounts.machine)?;
        for fee_account in &jellybean_machine.fee_accounts {
            let fee_account_ata = try_get_account_info(ctx.accounts.remaining, ctx.account_cursor)?;
            assert_is_token_2022_account(fee_account_ata, fee_account.address, self.mint)?;

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

        let source_token_account_info =
            try_get_account_info(ctx.accounts.remaining, ctx.indices["source_token_account"])?;
        let mint_info = try_get_account_info(ctx.accounts.remaining, ctx.indices["payment_mint"])?;
        let spl_token_2022_program =
            try_get_account_info(ctx.accounts.remaining, ctx.indices["token_program"])?;

        let fee_accounts_start = ctx.indices["fee_accounts"];
        let fee_accounts_end = ctx.indices["fee_accounts_end"];
        let fee_account_atas = &ctx.accounts.remaining[fee_accounts_start..fee_accounts_end];

        let amount_transferred = pay_fee_accounts(
            &mut ctx.accounts.payer,
            Some(&source_token_account_info),
            Some(self.mint),
            Some(mint_info),
            &jellybean_machine.fee_accounts,
            fee_account_atas,
            Some(spl_token_2022_program),
            &ctx.accounts.system_program,
            self.amount,
        )?;

        let remaining_tokens = self
            .amount
            .checked_sub(amount_transferred)
            .ok_or(GumballGuardError::NumericalOverflowError)?;

        // Any remaining dust goes to the first fee account. A machine with no fee
        // accounts has no destination, so nothing is transferred.
        if !fee_account_atas.is_empty() && remaining_tokens > 0 {
            let decimals = get_mint_decimals(mint_info)?;

            token_transfer_checked(TokenTransferCheckedParams {
                source: source_token_account_info.to_account_info(),
                mint: mint_info.to_account_info(),
                destination: fee_account_atas[0].to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
                authority_signer_seeds: &[],
                amount: remaining_tokens,
                decimals,
                token_program: spl_token_2022_program.to_account_info(),
            })?;
        }

        Ok(())
    }
}
