use crate::{
    assert_marketplace_authority, constants::ADD_ITEM_REQUEST_SEED, AddItemRequest, GumballError,
    GumballMachine, ADD_REQUESTS_MIGRATED_POSITION,
};
use anchor_lang::prelude::*;

/// The marketplace scans all live requests before attesting completion. Batches
/// backfill legacy markers; economics remain locked until the final batch.
#[derive(Accounts)]
pub struct MigrateAddItemRequests<'info> {
    #[account(mut)]
    gumball_machine: Box<Account<'info, GumballMachine>>,
    authority: Signer<'info>,
    /// CHECK: Canonical guard GlobalConfig and marketplace authority checked below.
    global_config: UncheckedAccount<'info>,
    #[account(mut)]
    payer: Signer<'info>,
    system_program: Program<'info, System>,
}

pub fn migrate_add_item_requests<'info>(
    ctx: Context<'info, MigrateAddItemRequests<'info>>,
    complete: bool,
) -> Result<()> {
    assert_marketplace_authority(
        &ctx.accounts.authority.to_account_info(),
        &ctx.accounts.global_config.to_account_info(),
    )?;
    let machine = ctx.accounts.gumball_machine.to_account_info();
    require!(
        !crate::add_requests_migrated(&machine.try_borrow_data()?),
        GumballError::InvalidSettingUpdate
    );
    let rent = Rent::get()?;
    for info in ctx.remaining_accounts {
        require!(info.is_writable, GumballError::InvalidGumballMachine);
        let request = Account::<AddItemRequest>::try_from(info)?;
        require_keys_eq!(
            request.gumball_machine,
            machine.key(),
            GumballError::InvalidGumballMachine
        );
        require_keys_eq!(
            info.key(),
            Pubkey::find_program_address(
                &[ADD_ITEM_REQUEST_SEED.as_bytes(), request.asset.as_ref()],
                &crate::ID
            )
            .0,
            GumballError::InvalidMint
        );
        if AddItemRequest::is_tracked(info)? || AddItemRequest::is_rejected(info)? {
            continue;
        }
        crate::extend_add_item_request(
            info,
            &ctx.accounts.payer.to_account_info(),
            &ctx.accounts.system_program.to_account_info(),
            &rent,
        )?;
        crate::track_add_item_request(info, &machine)?;
    }
    if complete {
        machine.try_borrow_mut_data()?[ADD_REQUESTS_MIGRATED_POSITION] = 1;
    }
    Ok(())
}
