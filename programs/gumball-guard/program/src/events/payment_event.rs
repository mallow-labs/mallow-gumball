use anchor_lang::prelude::*;
use solana_program::pubkey::Pubkey;

#[event]
pub struct PaymentEvent {
    pub amount: u64,
    pub mint: Pubkey,
}
