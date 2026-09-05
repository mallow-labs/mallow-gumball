use crate::error::Error;
use crate::token22::is_token_program;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::{
    get_associated_token_address, get_associated_token_address_with_program_id,
};
use anchor_spl::token::spl_token::state::Account as SplAccount;
use anchor_spl::token_2022::spl_token_2022::{
    extension::StateWithExtensions, state::Account as SplTokenAccount,
};
use mpl_token_metadata::accounts::Metadata;
use solana_program::program_pack::{IsInitialized, Pack};
use solana_program::{account_info::AccountInfo, pubkey::Pubkey};

pub fn is_native_mint(key: Pubkey) -> bool {
    return key == anchor_spl::token::spl_token::native_mint::ID;
}

pub fn assert_keys_equal(key1: Pubkey, key2: Pubkey, error_message: &str) -> Result<()> {
    if key1 != key2 {
        msg!("{}: actual: {} expected: {}", error_message, key1, key2);
        return err!(Error::PublicKeyMismatch);
    }

    Ok(())
}

/// Classic-SPL-only ATA check, kept for the asset (prize) side.
///
/// Do **not** call this on a payment account: `get_associated_token_address`
/// silently returns the *classic* address for a Token-2022 mint. Use
/// [`assert_is_ata_for_program`] there.
pub fn assert_is_ata(ata: &AccountInfo, wallet: &Pubkey, mint: &Pubkey) -> Result<SplAccount> {
    assert_owned_by(ata, &anchor_spl::token::spl_token::ID)?;
    let ata_account: SplAccount = assert_initialized(ata)?;
    assert_keys_equal(ata_account.owner, *wallet, "Invalid ATA owner")?;
    assert_keys_equal(ata_account.mint, *mint, "Invalid ATA mint")?;
    assert_keys_equal(
        get_associated_token_address(wallet, mint),
        *ata.key,
        "Invalid ATA address",
    )?;
    Ok(ata_account)
}

/// Program-aware ATA check that works for both token programs.
///
/// The derivation **must** use `get_associated_token_address_with_program_id`;
/// the two-argument form hardcodes the classic program id and returns the wrong
/// address for a Token-2022 mint. The unpack goes through `StateWithExtensions`
/// so a Token-2022 account carrying extensions still parses.
pub fn assert_is_ata_for_program(
    ata: &AccountInfo,
    wallet: &Pubkey,
    mint: &Pubkey,
    token_program_id: &Pubkey,
) -> Result<SplTokenAccount> {
    if !is_token_program(token_program_id) {
        msg!("Invalid token program: {}", token_program_id);
        return err!(Error::InvalidTokenProgram);
    }
    assert_owned_by(ata, token_program_id)?;

    let data = ata.try_borrow_data()?;
    let state = StateWithExtensions::<SplTokenAccount>::unpack(&data)?;
    let ata_account = state.base;
    if !ata_account.is_initialized() {
        return err!(Error::UninitializedAccount);
    }

    assert_keys_equal(ata_account.owner, *wallet, "Invalid ATA owner")?;
    assert_keys_equal(ata_account.mint, *mint, "Invalid ATA mint")?;
    assert_keys_equal(
        get_associated_token_address_with_program_id(wallet, mint, token_program_id),
        *ata.key,
        "Invalid ATA address",
    )?;
    Ok(ata_account)
}

pub fn assert_owned_by(account: &AccountInfo, owner: &Pubkey) -> Result<()> {
    if account.owner != owner {
        err!(Error::InvalidOwner)
    } else {
        Ok(())
    }
}

pub fn assert_initialized<T: Pack + IsInitialized>(account_info: &AccountInfo) -> Result<T> {
    let account: T = T::unpack_unchecked(&account_info.data.borrow())?;
    if !account.is_initialized() {
        err!(Error::UninitializedAccount)
    } else {
        Ok(account)
    }
}

pub fn assert_is_metadata_account(metadata_account: Pubkey, mint: Pubkey) -> Result<()> {
    let (expected_metadata_account, _bump) = Metadata::find_pda(&mint);

    assert_keys_equal(
        metadata_account,
        expected_metadata_account,
        "Invalid metadata account",
    )?;

    Ok(())
}

/// Returns true if a `leaf` can be proved to be a part of a Merkle tree
/// defined by `root`. For this, a `proof` must be provided, containing
/// sibling hashes on the branch from the leaf to the root of the tree. Each
/// pair of leaves and each pair of pre-images are assumed to be sorted.
pub fn verify_proof(proof: &[[u8; 32]], root: &[u8; 32], leaf: &[u8; 32]) -> bool {
    let mut computed_hash = *leaf;
    for proof_element in proof.iter() {
        if computed_hash <= *proof_element {
            // hash (current computed hash + current element of the proof)
            computed_hash =
                solana_program::keccak::hashv(&[&computed_hash, proof_element]).to_bytes()
        } else {
            // hash (current element of the proof + current computed hash)
            computed_hash =
                solana_program::keccak::hashv(&[proof_element, &computed_hash]).to_bytes();
        }
    }
    // check if the computed hash (root) is equal to the provided root
    computed_hash == *root
}
