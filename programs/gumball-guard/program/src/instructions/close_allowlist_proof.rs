use crate::{
    errors::GumballGuardError,
    guards::AllowListProof,
    state::{GlobalConfig, GLOBAL_CONFIG_SEED},
    utils::close_pda_account,
};
use anchor_lang::prelude::*;
use utils::{assert_keys_equal, assert_owned_by};

/// Close an AllowListProof PDA and send its rent to the account_fee_authority stored in GlobalConfig.
///
/// Only the account_fee_authority recorded in the on-chain GlobalConfig may call this.
/// The associated gumball guard must have already been closed (deleted).
#[derive(Accounts)]
pub struct CloseAllowlistProof<'info> {
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
    /// The gumball guard that this proof was created under. Must be closed (empty).
    /// CHECK: verified to be empty in the handler
    pub gumball_guard: UncheckedAccount<'info>,
    /// The AllowListProof PDA to close.
    /// CHECK: re-derived from gumball_guard and the arguments in the handler
    #[account(mut)]
    pub allow_list_proof: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn close_allowlist_proof(
    ctx: Context<CloseAllowlistProof>,
    merkle_root: [u8; 32],
    user: Pubkey,
    machine: Pubkey,
) -> Result<()> {
    let gumball_guard = &ctx.accounts.gumball_guard.to_account_info();
    let allow_list_proof = &ctx.accounts.allow_list_proof.to_account_info();

    // 1. Guard must be closed (account empty)
    require!(
        gumball_guard.data_is_empty(),
        GumballGuardError::InvalidMachineState
    );

    // 2. The proof's seeds name its guard, so only a proof created under that
    // closed guard can match
    let (proof_pda, _) = Pubkey::find_program_address(
        &[
            AllowListProof::PREFIX_SEED,
            &merkle_root[..],
            user.as_ref(),
            gumball_guard.key.as_ref(),
            machine.as_ref(),
        ],
        &crate::ID,
    );
    assert_keys_equal(allow_list_proof.key(), proof_pda, "Invalid proof PDA")?;

    // 3. Verify proof account exists and is owned by this program
    require!(
        !allow_list_proof.data_is_empty(),
        GumballGuardError::Uninitialized
    );
    assert_owned_by(allow_list_proof, &crate::ID)?;

    // 4. Close the account: transfer lamports to authority, zero data
    close_pda_account(allow_list_proof, &ctx.accounts.authority.to_account_info())?;

    Ok(())
}
