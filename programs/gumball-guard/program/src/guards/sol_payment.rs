use super::*;

use anchor_spl::token::spl_token::native_mint;
use mallow_gumball::{constants::AUTHORITY_SEED, GumballMachine};
use mallow_jellybean_sdk::accounts::JellybeanMachine;
use solana_program::{program::invoke, system_instruction};
use utils::{assert_keys_equal, transfer_sol};

use crate::{
    errors::GumballGuardError,
    events::PaymentEvent,
    state::GuardType,
    try_from,
    utils::{assert_derivation, get_bps_of, pay_fee_accounts},
};

/// Guard that charges an amount in SOL (lamports) for the mint.
///
/// List of accounts required:
///
///   0. `[writable]` Account to receive the funds.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SolPayment {
    pub lamports: u64,
}

impl Guard for SolPayment {
    fn size() -> usize {
        8 // lamports
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::SolPayment)
    }
}

impl Condition for SolPayment {
    fn validate<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        if ctx.accounts.payer.lamports() < self.lamports {
            msg!(
                "Require {} lamports, accounts has {} lamports",
                self.lamports,
                ctx.accounts.payer.lamports(),
            );
            return err!(GumballGuardError::NotEnoughSOL);
        }

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
            amount: self.lamports,
            mint: native_mint::id(),
        });

        Ok(())
    }
}

impl SolPayment {
    fn validate_gumball<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let index = ctx.account_cursor;
        // validates that we received all required accounts
        let gumball_machine_authority_pda = try_get_account_info(ctx.accounts.remaining, index)?;
        let gumball_machine = try_from!(Account::<GumballMachine>, ctx.accounts.machine)?;

        require!(
            gumball_machine.settings.payment_mint
                == anchor_spl::token::spl_token::native_mint::id(),
            GumballGuardError::InvalidPaymentMint
        );

        let seeds = [
            AUTHORITY_SEED.as_bytes(),
            gumball_machine.to_account_info().key.as_ref(),
        ];
        assert_derivation(&mallow_gumball::ID, gumball_machine_authority_pda, &seeds)?;

        ctx.account_cursor += 1;

        if let Some(fee_config) = gumball_machine.marketplace_fee_config {
            if gumball_machine.version > 0 {
                ctx.account_cursor += 1;

                let fee_destination = try_get_account_info(ctx.accounts.remaining, index + 1)?;
                assert_keys_equal(
                    fee_destination.key(),
                    fee_config.fee_account,
                    "Invalid fee destination",
                )?;
            }
        }

        ctx.indices.insert("lamports_destination", index);

        Ok(())
    }

    fn pre_actions_gumball<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let lamports_destination_index = ctx.indices["lamports_destination"];
        let destination = try_get_account_info(ctx.accounts.remaining, lamports_destination_index)?;
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

        let marketplace_fee = get_bps_of(self.lamports, marketplace_fee_bps)?;
        msg!("Marketplace fee: {}", marketplace_fee);

        if marketplace_fee > 0 {
            let fee_destination =
                try_get_account_info(ctx.accounts.remaining, lamports_destination_index + 1)?;

            invoke(
                &system_instruction::transfer(
                    &ctx.accounts.payer.key(),
                    &fee_destination.key(),
                    marketplace_fee,
                ),
                &[
                    ctx.accounts.payer.to_account_info(),
                    fee_destination.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }

        let price_less_fees = self
            .lamports
            .checked_sub(marketplace_fee)
            .ok_or(GumballGuardError::NumericalOverflowError)?;

        invoke(
            &system_instruction::transfer(
                &ctx.accounts.payer.key(),
                &destination.key(),
                price_less_fees,
            ),
            &[
                ctx.accounts.payer.to_account_info(),
                destination.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        cpi_increment_total_revenue(ctx, self.lamports)?;

        Ok(())
    }

    fn validate_jellybean<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        ctx.indices.insert("fee_accounts", ctx.account_cursor);

        let jellybean_machine = try_from!(Account::<JellybeanMachine>, ctx.accounts.machine)?;
        for fee_account in &jellybean_machine.fee_accounts {
            let fee_destination = try_get_account_info(ctx.accounts.remaining, ctx.account_cursor)?;
            assert_keys_equal(
                fee_destination.key(),
                fee_account.address,
                "Invalid fee account address",
            )?;

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

        let fee_accounts_start = ctx.indices["fee_accounts"];
        let fee_accounts_end = ctx.indices["fee_accounts_end"];
        let remaining_accounts = &ctx.accounts.remaining[fee_accounts_start..fee_accounts_end];

        let amount_transferred = pay_fee_accounts(
            &mut ctx.accounts.payer,
            None,
            None,
            &jellybean_machine.fee_accounts,
            remaining_accounts,
            None,
            &ctx.accounts.system_program,
            self.lamports,
        )?;

        let remaining_lamports = self
            .lamports
            .checked_sub(amount_transferred)
            .ok_or(GumballGuardError::NumericalOverflowError)?;

        // Any remaining dust goes to first fee account
        transfer_sol(
            &mut ctx.accounts.payer,
            &ctx.accounts.remaining[fee_accounts_start],
            &ctx.accounts.system_program,
            None,
            remaining_lamports,
        )?;

        Ok(())
    }
}
