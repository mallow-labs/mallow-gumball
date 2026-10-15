use anchor_lang::prelude::*;
use utils::{can_receive_lamports, RESERVED_LAMPORT_RECIPIENT_KEYS};

fn recipient(key: &Pubkey, owner: &Pubkey, executable: bool, writable: bool) -> bool {
    let mut lamports = 0;
    let mut data = [];
    can_receive_lamports(&AccountInfo::new(
        key,
        false,
        writable,
        &mut lamports,
        &mut data,
        owner,
        executable,
    ))
}

#[test]
fn all_reserved_keys_fail_even_without_an_account() {
    for key in RESERVED_LAMPORT_RECIPIENT_KEYS {
        assert!(!recipient(
            key,
            &anchor_lang::system_program::ID,
            false,
            true
        ));
    }
}

#[test]
fn executables_cannot_receive() {
    assert!(!recipient(
        &Pubkey::new_unique(),
        &Pubkey::new_unique(),
        true,
        true
    ));
}

#[test]
fn sysvar_and_native_loader_owned_accounts_cannot_receive() {
    for owner in [
        solana_program::sysvar::ID,
        solana_program::pubkey!("NativeLoader1111111111111111111111111111111"),
    ] {
        assert!(!recipient(&Pubkey::new_unique(), &owner, false, true));
    }
}

#[test]
fn program_owned_accounts_can_receive_direct_credits() {
    assert!(recipient(
        &Pubkey::new_unique(),
        &Pubkey::new_unique(),
        false,
        true
    ));
}

#[test]
fn caller_writability_does_not_determine_eligibility() {
    let key = Pubkey::new_unique();
    let owner = anchor_lang::system_program::ID;
    assert!(recipient(&key, &owner, false, true));
    assert!(recipient(&key, &owner, false, false));
}

#[test]
fn reserved_keys_match_agave_sdk() {
    use std::collections::BTreeSet;
    let mut expected: BTreeSet<[u8; 32]> =
        agave_reserved_account_keys::ReservedAccountKeys::all_keys_iter()
            .map(|key| key.to_bytes())
            .collect();
    expected
        .insert(solana_program::pubkey!("1nc1nerator11111111111111111111111111111111").to_bytes());
    let actual: BTreeSet<_> = RESERVED_LAMPORT_RECIPIENT_KEYS
        .iter()
        .map(|key| key.to_bytes())
        .collect();
    assert_eq!(
        actual, expected,
        "Update reserved lamport keys when the Agave SDK set changes"
    );
}
