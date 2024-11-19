use crate::{
    constants::{ADD_ITEM_REQUEST_SEED, AUTHORITY_SEED}, 
    state::GumballMachine, AddItemRequest, ConfigLineInput, GumballError, TokenStandard
};
use anchor_lang::prelude::*;

/// Approve adding a core asset to a gumball machine.
#[derive(Accounts)]
pub struct ApproveAddItem<'info> {
    /// Gumball Machine account.
    #[account(
        mut,
        constraint = gumball_machine.can_edit_items() @ GumballError::InvalidState,
    )]
    gumball_machine: Box<Account<'info, GumballMachine>>,

    /// Add item request account.
    #[account(
        mut,
        close = seller,
        seeds = [
            ADD_ITEM_REQUEST_SEED.as_bytes(), 
            add_item_request.asset.key().as_ref()
        ],
        bump,
        has_one = gumball_machine @ GumballError::InvalidGumballMachine,
        has_one = seller @ GumballError::InvalidSeller,
    )]
    add_item_request: Box<Account<'info, AddItemRequest>>,

    /// CHECK: Safe due to seeds constraint
    #[account(
        mut,
        seeds = [
            AUTHORITY_SEED.as_bytes(), 
            gumball_machine.key().as_ref()
        ],
        bump
    )]
    authority_pda: UncheckedAccount<'info>,

    /// Authority of the gumball machine.
    #[account(mut)]
    authority: Signer<'info>,

    /// CHECK: Safe due to add_item_request constraint
    #[account(mut)]
    seller: UncheckedAccount<'info>,

    system_program: Program<'info, System>,
}

pub fn approve_add_item(
    ctx: Context<ApproveAddItem>,
) -> Result<()> {
    let gumball_machine = &mut ctx.accounts.gumball_machine;

    let add_item_request = &ctx.accounts.add_item_request;

    crate::processors::add_item(
        gumball_machine,
        ConfigLineInput {
            mint: add_item_request.asset,
            seller: add_item_request.seller
        },
        TokenStandard::Core,
    )?;

    Ok(())
}
