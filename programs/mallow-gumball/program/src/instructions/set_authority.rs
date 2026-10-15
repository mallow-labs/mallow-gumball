use crate::{GumballError, GumballMachine};
use anchor_lang::prelude::*;

/// Sets a new gumball machine authority after the recipient accepts ownership.
#[derive(Accounts)]
pub struct SetAuthority<'info> {
    #[account(mut, has_one = authority)]
    gumball_machine: Account<'info, GumballMachine>,
    authority: Signer<'info>,
    /// New authorities must co-sign; appended for legacy idempotent calls.
    new_authority_signer: Option<Signer<'info>>,
}

pub fn set_authority(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
    require!(
        new_authority.is_on_curve() && !utils::is_reserved_lamport_recipient(&new_authority),
        GumballError::InvalidAuthority
    );
    if new_authority != ctx.accounts.gumball_machine.authority {
        let signer = ctx
            .accounts
            .new_authority_signer
            .as_ref()
            .ok_or(GumballError::InvalidAuthority)?;
        require_keys_eq!(signer.key(), new_authority, GumballError::InvalidAuthority);
        require!(
            utils::can_receive_lamports(&signer.to_account_info()),
            GumballError::InvalidAuthority
        );
    }
    ctx.accounts.gumball_machine.authority = new_authority;
    Ok(())
}
