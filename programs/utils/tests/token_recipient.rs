use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::state::{Account as TokenAccount, AccountState};
use solana_program::{program_option::COption, program_pack::Pack};
use utils::can_receive_token;

fn bytes(recipient: Pubkey, mint: Pubkey, state: AccountState) -> Vec<u8> {
    let mut data = vec![0; TokenAccount::LEN];
    TokenAccount::pack(
        TokenAccount {
            mint,
            owner: recipient,
            amount: 0,
            delegate: COption::None,
            state,
            is_native: COption::None,
            delegated_amount: 0,
            close_authority: COption::None,
        },
        &mut data,
    )
    .unwrap();
    data
}
fn check(
    data: &mut [u8],
    owner: &Pubkey,
    recipient: &Pubkey,
    mint: &Pubkey,
    writable: bool,
    create: bool,
) -> bool {
    let key = Pubkey::new_unique();
    let mut lamports = 0;
    let account = AccountInfo::new(&key, false, writable, &mut lamports, data, owner, false);
    can_receive_token(
        &account,
        recipient,
        mint,
        &anchor_spl::token_2022::ID,
        create,
    )
    .unwrap()
}
#[test]
fn healthy_initialized_accounts_are_receivable_independently_of_writability() {
    let recipient = Pubkey::new_unique();
    let mint = Pubkey::new_unique();
    let mut data = bytes(recipient, mint, AccountState::Initialized);
    for writable in [true, false] {
        assert!(check(
            &mut data,
            &anchor_spl::token_2022::ID,
            &recipient,
            &mint,
            writable,
            false
        ));
    }
}
#[test]
fn wrong_owner_mint_program_frozen_and_uninitialized_are_unreceivable() {
    let recipient = Pubkey::new_unique();
    let mint = Pubkey::new_unique();
    let other = Pubkey::new_unique();
    for (token_owner, token_mint, state, program) in [
        (
            other,
            mint,
            AccountState::Initialized,
            anchor_spl::token_2022::ID,
        ),
        (
            recipient,
            other,
            AccountState::Initialized,
            anchor_spl::token_2022::ID,
        ),
        (
            recipient,
            mint,
            AccountState::Frozen,
            anchor_spl::token_2022::ID,
        ),
        (
            recipient,
            mint,
            AccountState::Uninitialized,
            anchor_spl::token_2022::ID,
        ),
        (
            recipient,
            mint,
            AccountState::Initialized,
            anchor_spl::token::ID,
        ),
    ] {
        assert!(!check(
            &mut bytes(token_owner, token_mint, state),
            &program,
            &recipient,
            &mint,
            true,
            false
        ));
    }
}
#[test]
fn enabled_memo_transfer_is_unreceivable_but_disabled_memos_work() {
    let recipient = Pubkey::new_unique();
    let mint = Pubkey::new_unique();
    let mut data = bytes(recipient, mint, AccountState::Initialized);
    data.extend_from_slice(&[2, 8, 0, 1, 0, 1]);
    assert!(!check(
        &mut data,
        &anchor_spl::token_2022::ID,
        &recipient,
        &mint,
        true,
        false
    ));
    *data.last_mut().unwrap() = 0;
    assert!(check(
        &mut data,
        &anchor_spl::token_2022::ID,
        &recipient,
        &mint,
        true,
        false
    ));
}
#[test]
fn empty_accounts_require_explicit_creation_and_system_ownership() {
    let recipient = Pubkey::new_unique();
    let mint = Pubkey::new_unique();
    assert!(!check(
        &mut [],
        &anchor_lang::system_program::ID,
        &recipient,
        &mint,
        true,
        false
    ));
    assert!(check(
        &mut [],
        &anchor_lang::system_program::ID,
        &recipient,
        &mint,
        true,
        true
    ));
    assert!(!check(
        &mut [],
        &anchor_spl::token_2022::ID,
        &recipient,
        &mint,
        true,
        true
    ));
}
#[test]
fn malformed_data_and_unknown_extensions_fail_closed() {
    let recipient = Pubkey::new_unique();
    let mint = Pubkey::new_unique();
    assert!(!check(
        &mut [0; 100],
        &anchor_spl::token_2022::ID,
        &recipient,
        &mint,
        true,
        false
    ));
    let mut data = bytes(recipient, mint, AccountState::Initialized);
    data.extend_from_slice(&[2, 255, 255, 1, 0, 0]);
    assert!(!check(
        &mut data,
        &anchor_spl::token_2022::ID,
        &recipient,
        &mint,
        true,
        false
    ));
}
