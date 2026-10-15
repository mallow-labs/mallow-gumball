use crate::{constants::ADD_ITEM_REQUEST_SEED, AddItemRequest, GumballError, GumballMachine};
use anchor_lang::prelude::*;

/// Reject approval without requiring asset proofs or a successful transfer.
/// The seller retains custody recovery through the existing cancellation paths.
#[derive(Accounts)]
pub struct RejectAddItemRequest<'info> {
    #[account(mut, has_one = authority @ GumballError::InvalidAuthority)]
    gumball_machine: Box<Account<'info, GumballMachine>>,
    #[account(
        mut,
        seeds = [ADD_ITEM_REQUEST_SEED.as_bytes(), add_item_request.asset.as_ref()],
        bump,
        has_one = gumball_machine @ GumballError::InvalidGumballMachine,
    )]
    add_item_request: Box<Account<'info, AddItemRequest>>,
    #[account(mut)]
    authority: Signer<'info>,
    system_program: Program<'info, System>,
}

pub fn reject_add_item_request(ctx: Context<RejectAddItemRequest>) -> Result<()> {
    let request = ctx.accounts.add_item_request.to_account_info();
    require!(
        !AddItemRequest::is_rejected(&request)?,
        GumballError::InvalidState
    );
    crate::resolve_add_item_request(&request, &ctx.accounts.gumball_machine.to_account_info())?;
    crate::extend_add_item_request(
        &request,
        &ctx.accounts.authority.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        &Rent::get()?,
    )?;
    request.try_borrow_mut_data()?[AddItemRequest::SPACE + 1] = 2;
    Ok(())
}
