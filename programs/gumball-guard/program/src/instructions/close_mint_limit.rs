use crate::{
    errors::GumballGuardError,
    state::{GlobalConfig, GLOBAL_CONFIG_SEED},
    utils::close_pda_account,
};
use anchor_lang::prelude::*;
use utils::assert_owned_by;

/// Close a MintCounter PDA and send its rent to the account_fee_authority stored in GlobalConfig.
///
/// Only the account_fee_authority recorded in the on-chain GlobalConfig may call this.
/// The associated gumball guard must have already been closed (deleted).
#[derive(Accounts)]
pub struct CloseMintLimit<'info> {
    /// The protocol authority — must match global_config.account_fee_authority and receives rent.
    #[account(
        mut,
        constraint = authority.key() == global_config.account_fee_authority
            @ GumballGuardError::MissingRequiredSignature
    )]
    pub authority: Signer<'info>,
    /// The GlobalConfig PDA — used to validate the authority.
    #[account(
        seeds = [GLOBAL_CONFIG_SEED],
        bump,
    )]
    pub global_config: Account<'info, GlobalConfig>,
    /// The gumball guard that this counter was created under. Must be closed (empty).
    /// CHECK: verified to be empty in the handler
    pub gumball_guard: UncheckedAccount<'info>,
    /// The MintCounter PDA to close.
    /// CHECK: verified to be owned by this program and non-empty in the handler
    #[account(mut)]
    pub mint_counter: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn close_mint_limit(ctx: Context<CloseMintLimit>) -> Result<()> {
    let gumball_guard = &ctx.accounts.gumball_guard.to_account_info();
    let mint_counter = &ctx.accounts.mint_counter.to_account_info();

    // 1. Guard must be closed (account empty)
    require!(
        gumball_guard.data_is_empty(),
        GumballGuardError::InvalidMachineState
    );

    // 2. Verify counter account exists and is owned by this program
    require!(
        !mint_counter.data_is_empty(),
        GumballGuardError::Uninitialized
    );
    assert_owned_by(mint_counter, &crate::ID)?;

    // 3. Close the account: transfer lamports to authority, zero data
    close_pda_account(mint_counter, &ctx.accounts.authority.to_account_info())?;

    Ok(())
}
