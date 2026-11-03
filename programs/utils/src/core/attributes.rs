use crate::assert_keys_equal;
use anchor_lang::prelude::*;
use mpl_core::types::UpdateAuthority;
use mpl_core::{Asset, Collection};

pub fn is_primary_sale<'info>(seller: Pubkey, update_authority: Option<Pubkey>) -> Result<bool> {
    if update_authority.is_none() {
        return Ok(false);
    }

    // Considered a primary sale if seller is the update authority (most likely creator)
    Ok(seller == update_authority.unwrap())
}

/// The asset's update authority and, when the asset is in a collection, that
/// collection. `collection_info` comes from the caller, so it only counts as the
/// collection the asset itself names: an asset in a collection must be given that
/// collection, and any other asset ignores the account.
pub fn get_update_authority<'a, 'info>(
    asset_info: &AccountInfo<'info>,
    collection_info: Option<&'a AccountInfo<'info>>,
) -> Result<(Option<Pubkey>, Option<&'a AccountInfo<'info>>)> {
    // Considered a primary sale if owner is the update authority (most likely creator)
    let asset = Box::<Asset>::try_from(asset_info)?;
    match asset.base.update_authority {
        UpdateAuthority::Address(address) => Ok((Some(address), None)),
        UpdateAuthority::Collection(collection_key) => {
            let collection_info =
                collection_info.ok_or(error!(crate::error::Error::CollectionNotSet))?;
            assert_keys_equal(
                collection_info.key(),
                collection_key,
                "Invalid collection key",
            )?;
            let collection = Box::<Collection>::try_from(collection_info)?;
            Ok((
                Some(collection.base.update_authority),
                Some(collection_info),
            ))
        }
        UpdateAuthority::None => Ok((None, None)),
    }
}
