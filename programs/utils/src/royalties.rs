use anchor_lang::prelude::*;
use mpl_token_metadata::{accounts::Metadata, types::Creator};

use crate::assert_is_metadata_account;

// No `AnchorSerialize`/`AnchorDeserialize`: `RoyaltyInfo` is an in-memory helper
// (never serialized into an account or instruction). Deriving them would force
// Anchor's `idl-build` to require `IdlBuild` on the embedded `mpl_token_metadata`
// `Creator`, which it doesn't implement — breaking `anchor build`.
#[derive(Default)]
pub struct RoyaltyInfo {
    /// True if this is the first time the asset is being sold
    pub is_primary_sale: bool,
    /// Royalty basis points that goes to creators in secondary sales (0-10000)
    pub seller_fee_basis_points: u16,
    /// Array of creators, optional
    pub creators: Option<Vec<Creator>>,
}

pub fn get_verified_royalty_info<'a>(
    metadata_account: &AccountInfo<'a>,
    mint: &AccountInfo<'a>,
) -> Result<RoyaltyInfo> {
    assert_is_metadata_account(metadata_account.key(), mint.key())?;

    let metadata = Metadata::try_from(metadata_account)?;
    let is_primary_sale = !metadata.primary_sale_happened;
    let seller_fee_basis_points = metadata.seller_fee_basis_points;
    let creators = metadata.creators.clone();

    Ok(RoyaltyInfo {
        is_primary_sale,
        seller_fee_basis_points,
        creators: if creators.is_some() {
            creators
                .unwrap()
                .iter()
                .map(|c| {
                    Some(Creator {
                        address: c.address,
                        verified: c.verified,
                        share: c.share,
                    })
                })
                .collect()
        } else {
            None
        },
    })
}
