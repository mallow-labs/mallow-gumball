use crate::{
    constants::{ADD_ITEM_REQUEST_SEED, AUTHORITY_SEED},
    state::GumballMachine,
    AddItemRequest, ConfigLineV2Input, GumballError,
};
use anchor_lang::prelude::*;

/// Approve adding a core asset to a gumball machine.
#[derive(Accounts)]
pub struct ApproveAddItem<'info> {
    /// Gumball Machine account.
    #[account(
        mut,
        has_one = authority @ GumballError::InvalidAuthority,
        constraint = gumball_machine.can_edit_items() @ GumballError::InvalidState,
    )]
    gumball_machine: Box<Account<'info, GumballMachine>>,

    /// Add item request account.
    #[account(
        mut,
        close = seller,
        seeds = [
            ADD_ITEM_REQUEST_SEED.as_bytes(),
            asset.key().as_ref()
        ],
        bump,
        has_one = gumball_machine @ GumballError::InvalidGumballMachine,
        has_one = seller @ GumballError::InvalidSeller,
        has_one = asset @ GumballError::InvalidMint,
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

    /// CHECK: Safe due to add_item_request constraint
    asset: UncheckedAccount<'info>,

    system_program: Program<'info, System>,
}

pub fn approve_add_item(ctx: Context<ApproveAddItem>) -> Result<()> {
    let gumball_machine = &mut ctx.accounts.gumball_machine;

    require!(gumball_machine.is_collab(), GumballError::InvalidState);
    let add_item_request = &ctx.accounts.add_item_request;
    require!(
        !AddItemRequest::is_rejected(&add_item_request.to_account_info())?,
        GumballError::InvalidState
    );

    require!(
        !crate::add_requests_migrated(&gumball_machine.to_account_info().try_borrow_data()?)
            || AddItemRequest::is_tracked(&add_item_request.to_account_info())?,
        GumballError::InvalidState
    );

    if add_item_request.token_standard == crate::TokenStandard::Compressed
        && AddItemRequest::is_cnft_v2(&add_item_request.to_account_info())?
    {
        let machine_info = gumball_machine.to_account_info();
        gumball_machine.enable_cnft_refunds(
            &machine_info,
            &ctx.accounts.authority.to_account_info(),
            &ctx.accounts.system_program.to_account_info(),
        )?;
    }

    crate::resolve_add_item_request(
        &add_item_request.to_account_info(),
        &gumball_machine.to_account_info(),
    )?;

    crate::processors::add_item(
        gumball_machine,
        ConfigLineV2Input {
            mint: add_item_request.asset,
            seller: add_item_request.seller,
            amount: 1,
        },
        add_item_request.token_standard,
        1,
        None,
    )?;

    Ok(())
}
