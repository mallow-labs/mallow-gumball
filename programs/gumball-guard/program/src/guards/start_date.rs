use mallow_gumball::{GumballMachine, GumballState};
use mallow_jellybean_sdk::{
    accounts::JellybeanMachine, instructions::StartSaleCpiBuilder, types::JellybeanState,
};

use crate::{state::GuardType, try_from};

use super::*;

/// Guard that sets a specific start date for the mint.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct StartDate {
    pub date: i64,
}

impl Guard for StartDate {
    fn size() -> usize {
        8 // date
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::StartDate)
    }
}

impl Condition for StartDate {
    fn validate<'info>(
        &self,
        _ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let clock = Clock::get()?;

        if clock.unix_timestamp < self.date {
            return err!(GumballGuardError::MintNotLive);
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
            MachineType::Gumball => {
                let gumball_machine = try_from!(Account::<GumballMachine>, ctx.accounts.machine)?;
                if gumball_machine.state != GumballState::SaleLive
                    && gumball_machine.state != GumballState::SaleEnded
                {
                    cpi_start_sale(ctx)?;
                }
            }
            MachineType::Jellybean => {
                let gumball_guard = ctx.accounts.gumball_guard;
                // PDA signer for the transaction
                let seeds = [SEED, &gumball_guard.base.to_bytes(), &[gumball_guard.bump]];

                let jellybean_machine =
                    try_from!(Account::<JellybeanMachine>, ctx.accounts.machine)?;
                if jellybean_machine.state != JellybeanState::SaleLive
                    && jellybean_machine.state != JellybeanState::SaleEnded
                {
                    StartSaleCpiBuilder::new(&ctx.accounts._machine_program)
                        .jellybean_machine(&ctx.accounts.machine)
                        .authority(&gumball_guard.to_account_info())
                        .invoke_signed(&[&seeds])?;
                }
            }
        }

        Ok(())
    }
}
