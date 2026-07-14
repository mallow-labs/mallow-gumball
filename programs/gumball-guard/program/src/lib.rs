#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

use instructions::*;

pub mod errors;
pub mod events;
pub mod guards;
pub mod instructions;
pub mod processors;
pub mod state;
pub mod utils;

declare_id!("GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF");

#[program]
pub mod gumball_guard {
    use super::*;

    /// Create a new gumball guard account.
    pub fn initialize(ctx: Context<Initialize>, data: Vec<u8>) -> Result<()> {
        instructions::initialize(ctx, data)
    }

    /// Draw a prize from a gumball machine wrapped in the gumball guard.
    pub fn draw<'c: 'info, 'info>(
        ctx: Context<'info, Draw<'info>>,
        mint_args: Vec<u8>,
        label: Option<String>,
    ) -> Result<()> {
        instructions::draw(ctx, mint_args, label)
    }

    /// Draw a prize from a gumball machine wrapped in the gumball guard.
    pub fn draw_jellybean<'c: 'info, 'info>(
        ctx: Context<'info, DrawJellybean<'info>>,
        mint_args: Vec<u8>,
        label: Option<String>,
    ) -> Result<()> {
        instructions::draw_jellybean(ctx, mint_args, label)
    }

    /// Route the transaction to a guard instruction.
    pub fn route<'c: 'info, 'info>(
        ctx: Context<'info, Route<'info>>,
        args: RouteArgs,
        label: Option<String>,
    ) -> Result<()> {
        instructions::route(ctx, args, label)
    }

    /// Set a new authority of the gumball guard.
    pub fn set_authority(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
        instructions::set_authority(ctx, new_authority)
    }

    /// Remove a gumball guard from a gumball machine, setting the authority to the
    /// gumball guard authority.
    pub fn unwrap(ctx: Context<Unwrap>) -> Result<()> {
        instructions::unwrap(ctx)
    }

    /// Update the gumball guard configuration.
    pub fn update(ctx: Context<Update>, data: Vec<u8>) -> Result<()> {
        instructions::update(ctx, data)
    }

    /// Withdraw the rent SOL from the gumball guard account.
    pub fn withdraw<'info>(ctx: Context<'info, Withdraw<'info>>) -> Result<()> {
        instructions::withdraw(ctx)
    }

    /// Add a gumball guard to a gumball machine. After the guard is added, mint
    /// is only allowed through the gumball guard.
    pub fn wrap(ctx: Context<Wrap>) -> Result<()> {
        instructions::wrap(ctx)
    }

    /// Close a MintCounter PDA and send its rent to the account_fee_authority in GlobalConfig.
    /// Only the account_fee_authority recorded in GlobalConfig may call this instruction.
    /// The associated gumball guard must have already been closed (deleted).
    pub fn close_mint_limit(ctx: Context<CloseMintLimit>) -> Result<()> {
        instructions::close_mint_limit(ctx)
    }

    /// Close an AllowListProof PDA and send its rent to the account_fee_authority in GlobalConfig.
    /// Only the account_fee_authority recorded in GlobalConfig may call this instruction.
    /// The associated gumball guard must have already been closed (deleted).
    pub fn close_allowlist_proof(ctx: Context<CloseAllowlistProof>) -> Result<()> {
        instructions::close_allowlist_proof(ctx)
    }

    /// Create the GlobalConfig PDA. Can only be called once.
    pub fn create_global_config(
        ctx: Context<CreateGlobalConfig>,
        config_authority: Pubkey,
        account_fee_authority: Pubkey,
    ) -> Result<()> {
        instructions::create_global_config(ctx, config_authority, account_fee_authority)
    }

    /// Update the GlobalConfig account. Only the current config_authority may call this.
    pub fn update_global_config(
        ctx: Context<UpdateGlobalConfig>,
        new_config_authority: Option<Pubkey>,
        new_account_fee_authority: Option<Pubkey>,
    ) -> Result<()> {
        instructions::update_global_config(ctx, new_config_authority, new_account_fee_authority)
    }
}
