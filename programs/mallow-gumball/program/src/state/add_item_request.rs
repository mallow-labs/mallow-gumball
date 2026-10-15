use anchor_lang::prelude::*;

use crate::TokenStandard;

/// Add item request state.
#[account]
#[derive(Debug)]
pub struct AddItemRequest {
    /// Gumball machine address.
    pub gumball_machine: Pubkey,
    /// Seller address.
    pub seller: Pubkey,
    /// Asset address.
    pub asset: Pubkey,
    /// Token standard.
    pub token_standard: TokenStandard,
}

impl AddItemRequest {
    // Additional padding for future proofing
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 1;

    // V2 requests append a marker without changing legacy serialized fields.
    pub const CNFT_V2_SPACE: usize = Self::SPACE + 1;

    // Version marker followed by a live-request accounting marker.
    pub const TRACKED_SPACE: usize = Self::SPACE + 2;

    pub fn is_tracked(account: &AccountInfo) -> Result<bool> {
        Ok(account.try_borrow_data()?.get(Self::SPACE + 1) == Some(&1))
    }

    pub fn is_rejected(account: &AccountInfo) -> Result<bool> {
        Ok(account.try_borrow_data()?.get(Self::SPACE + 1) == Some(&2))
    }

    pub fn is_cnft_v2(account: &AccountInfo) -> Result<bool> {
        Ok(account.try_borrow_data()?.get(Self::SPACE) == Some(&2))
    }

    pub fn init(
        &mut self,
        gumball_machine: Pubkey,
        seller: Pubkey,
        asset: Pubkey,
        token_standard: TokenStandard,
    ) -> Result<()> {
        self.gumball_machine = gumball_machine;
        self.seller = seller;
        self.asset = asset;
        self.token_standard = token_standard;
        Ok(())
    }
}
