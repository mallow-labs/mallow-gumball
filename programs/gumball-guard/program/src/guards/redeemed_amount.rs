use mallow_gumball::GumballMachine;
use mallow_jellybean_sdk::accounts::JellybeanMachine;

use crate::{state::GuardType, try_from};

use super::*;

/// Guard that stop the mint once the specified amount of items
/// redeenmed is reached.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct RedeemedAmount {
    pub maximum: u64,
}

impl Guard for RedeemedAmount {
    fn size() -> usize {
        8 // maximum
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::RedeemedAmount)
    }
}

impl Condition for RedeemedAmount {
    fn validate<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let items_redeemed = match ctx.machine_type {
            MachineType::Gumball => {
                let gumball_machine = try_from!(Account::<GumballMachine>, ctx.accounts.machine)?;
                gumball_machine.items_redeemed
            }
            MachineType::Jellybean => {
                let jellybean_machine =
                    try_from!(Account::<JellybeanMachine>, ctx.accounts.machine)?;
                jellybean_machine.supply_redeemed
            }
        };

        if items_redeemed >= self.maximum {
            return err!(GumballGuardError::MaximumRedeemedAmount);
        }

        Ok(())
    }
}
