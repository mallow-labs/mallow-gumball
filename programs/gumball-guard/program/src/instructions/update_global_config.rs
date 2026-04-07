use anchor_lang::prelude::*;

use crate::{
    errors::GumballGuardError,
    state::{GlobalConfig, GLOBAL_CONFIG_SEED},
};

/// Update the GlobalConfig account.
///
/// Only the current `config_authority` stored in GlobalConfig may call this.
#[derive(Accounts)]
pub struct UpdateGlobalConfig<'info> {
    /// The current config authority — must match global_config.config_authority.
    #[account(
        constraint = authority.key() == global_config.config_authority
            @ GumballGuardError::MissingRequiredSignature
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [GLOBAL_CONFIG_SEED],
        bump,
    )]
    pub global_config: Account<'info, GlobalConfig>,
}

pub fn update_global_config(
    ctx: Context<UpdateGlobalConfig>,
    new_config_authority: Option<Pubkey>,
    new_account_fee_authority: Option<Pubkey>,
) -> Result<()> {
    let global_config = &mut ctx.accounts.global_config;

    if let Some(authority) = new_config_authority {
        global_config.config_authority = authority;
    }
    if let Some(authority) = new_account_fee_authority {
        global_config.account_fee_authority = authority;
    }

    Ok(())
}
