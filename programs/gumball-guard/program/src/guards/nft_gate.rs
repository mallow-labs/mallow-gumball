use mpl_core::{types::UpdateAuthority, Asset};
use mpl_token_metadata::accounts::Metadata;
use utils::{assert_keys_equal, assert_owned_by};

use super::*;
use crate::{errors::GumballGuardError, state::GuardType, utils::assert_is_token_account};

/// Guard that restricts the transaction to holders of a specified collection.
///
/// List of accounts required:
///
///   0. `[]` Token account of the NFT.
///   1. `[]` Metadata account of the NFT.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct NftGate {
    pub required_collection: Pubkey,
}

impl Guard for NftGate {
    fn size() -> usize {
        32 // required_collection
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::NftGate)
    }
}

impl Condition for NftGate {
    fn validate<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let index = ctx.account_cursor;
        // validates that we received all required accounts
        let nft_account = try_get_account_info(ctx.accounts.remaining, index)?;
        let nft_metadata = try_get_account_info(ctx.accounts.remaining, index + 1)?;
        ctx.account_cursor += 2;

        Self::verify_collection(
            nft_account,
            nft_metadata,
            &self.required_collection,
            ctx.accounts.buyer.key,
        )
    }
}

impl NftGate {
    pub fn verify_collection(
        nft_account: &AccountInfo,
        nft_metadata: &AccountInfo,
        collection: &Pubkey,
        owner: &Pubkey,
    ) -> Result<()> {
        // If nft_metadata key is the same as asset, it's a core asset we're trying to verify
        if nft_metadata.key() == nft_account.key() {
            // Parsing an asset checks only its bytes, not who wrote them.
            assert_owned_by(nft_account, &mpl_core::ID)?;
            let asset = Box::<Asset>::try_from(nft_account)?;
            require!(
                asset.base.update_authority == UpdateAuthority::Collection(*collection),
                GumballGuardError::InvalidNftCollection
            );
            require!(asset.base.owner == *owner, GumballGuardError::MissingNft);
        } else {
            let metadata: Metadata = Metadata::try_from(nft_metadata)?;
            // validates the metadata information
            assert_keys_equal(
                nft_metadata.owner.key(),
                mpl_token_metadata::ID,
                "Invalid metadata owner",
            )?;

            match metadata.collection {
                Some(c) if c.verified && c.key == *collection => Ok(()),
                _ => Err(GumballGuardError::InvalidNftCollection),
            }?;

            let account = assert_is_token_account(nft_account, owner.key(), metadata.mint)?;

            if account.amount < 1 {
                return err!(GumballGuardError::MissingNft);
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// An AssetV1 layout: key, owner, update authority (Collection), name, uri, seq.
    fn asset_bytes(owner: &Pubkey, collection: &Pubkey) -> Vec<u8> {
        let mut data = vec![1];
        data.extend_from_slice(owner.as_ref());
        data.push(2);
        data.extend_from_slice(collection.as_ref());
        data.extend_from_slice(&[0; 4]);
        data.extend_from_slice(&[0; 4]);
        data.push(0);
        data
    }

    fn verify(account_owner: &Pubkey, buyer: &Pubkey, collection: &Pubkey) -> Result<()> {
        let key = Pubkey::new_from_array([7; 32]);
        let mut lamports = 1;
        let mut data = asset_bytes(
            &Pubkey::new_from_array([8; 32]),
            &Pubkey::new_from_array([9; 32]),
        );
        let info = AccountInfo::new(
            &key,
            false,
            false,
            &mut lamports,
            &mut data,
            account_owner,
            false,
        );
        NftGate::verify_collection(&info, &info, collection, buyer)
    }

    #[test]
    fn a_core_asset_must_be_owned_by_mpl_core() {
        let buyer = Pubkey::new_from_array([8; 32]);
        let collection = Pubkey::new_from_array([9; 32]);
        assert!(verify(&mpl_core::ID, &buyer, &collection).is_ok());

        for forger in [
            crate::ID,
            Pubkey::default(),
            Pubkey::new_from_array([3; 32]),
        ] {
            assert_eq!(
                verify(&forger, &buyer, &collection).unwrap_err(),
                error!(utils::Error::InvalidOwner)
            );
        }
    }

    #[test]
    fn a_core_asset_must_match_the_buyer_and_collection() {
        let buyer = Pubkey::new_from_array([8; 32]);
        let collection = Pubkey::new_from_array([9; 32]);
        let other = Pubkey::new_from_array([4; 32]);
        assert_eq!(
            verify(&mpl_core::ID, &other, &collection).unwrap_err(),
            error!(GumballGuardError::MissingNft)
        );
        assert_eq!(
            verify(&mpl_core::ID, &buyer, &other).unwrap_err(),
            error!(GumballGuardError::InvalidNftCollection)
        );
    }
}
