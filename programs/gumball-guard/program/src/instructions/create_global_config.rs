use anchor_lang::prelude::*;

use crate::state::{GlobalConfig, GLOBAL_CONFIG_SEED};

/// Create the GlobalConfig PDA.
///
/// This can only be called once — the `init` constraint will reject subsequent calls
/// because the account already exists.
#[derive(Accounts)]
pub struct CreateGlobalConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = GlobalConfig::SIZE,
        seeds = [GLOBAL_CONFIG_SEED],
        bump,
    )]
    pub global_config: Account<'info, GlobalConfig>,

    pub system_program: Program<'info, System>,
}

pub fn create_global_config(
    ctx: Context<CreateGlobalConfig>,
    config_authority: Pubkey,
    account_fee_authority: Pubkey,
) -> Result<()> {
    let global_config = &mut ctx.accounts.global_config;
    global_config.config_authority = config_authority;
    global_config.account_fee_authority = account_fee_authority;
    Ok(())
}
