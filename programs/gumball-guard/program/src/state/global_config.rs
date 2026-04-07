use anchor_lang::prelude::*;

pub const GLOBAL_CONFIG_SEED: &[u8] = b"global_config";

#[account]
pub struct GlobalConfig {
    /// The authority that can update this config via `update_global_config`.
    pub config_authority: Pubkey,
    /// The authority that can close guard PDAs and receives their rent.
    pub account_fee_authority: Pubkey,
}

impl GlobalConfig {
    pub const SIZE: usize = 8 + 32 + 32; // discriminator + 2 Pubkeys
}
