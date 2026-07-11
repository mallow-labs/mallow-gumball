use anchor_lang::prelude::*;
use mallow_gumball::{GumballMachine, GumballState};
use mallow_jellybean_sdk::{accounts::JellybeanMachine, types::FeeAccount, types::JellybeanState};
use solana_program::{program::invoke_signed, program_memory::sol_memcmp, pubkey::PUBKEY_BYTES};
use utils::{assert_initialized, assert_keys_equal, assert_owned_by, transfer_sol};

use crate::{errors::GumballGuardError, try_from};

// Empty value used for string padding.
const NULL_STRING: &str = "\0";

/// TokenBurnParams
pub struct TokenBurnParams<'a: 'b, 'b> {
    /// mint
    /// CHECK: account checked in CPI
    pub mint: AccountInfo<'a>,
    /// source
    /// CHECK: account checked in CPI
    pub source: AccountInfo<'a>,
    /// amount
    pub amount: u64,
    /// authority
    /// CHECK: account checked in CPI
    pub authority: AccountInfo<'a>,
    /// authority_signer_seeds
    pub authority_signer_seeds: Option<&'b [&'b [u8]]>,
    /// token_program
    /// CHECK: account checked in CPI
    pub token_program: AccountInfo<'a>,
}

///TokenTransferParams
pub struct TokenTransferParams<'a: 'b, 'b> {
    /// source
    /// CHECK: account checked in CPI
    pub source: AccountInfo<'a>,
    /// destination
    /// CHECK: account checked in CPI
    pub destination: AccountInfo<'a>,
    /// amount
    pub amount: u64,
    /// authority
    /// CHECK: account checked in CPI
    pub authority: AccountInfo<'a>,
    /// authority_signer_seeds
    pub authority_signer_seeds: &'b [&'b [u8]],
    /// token_program
    /// CHECK: account checked in CPI
    pub token_program: AccountInfo<'a>,
}

pub fn cmp_pubkeys(a: &Pubkey, b: &Pubkey) -> bool {
    sol_memcmp(a.as_ref(), b.as_ref(), PUBKEY_BYTES) == 0
}

pub fn assert_is_token_account(
    ta: &AccountInfo,
    wallet: Pubkey,
    mint: Pubkey,
) -> core::result::Result<anchor_spl::token::spl_token::state::Account, ProgramError> {
    assert_owned_by(ta, &anchor_spl::token::ID)?;
    let token_account: anchor_spl::token::spl_token::state::Account = assert_initialized(ta)?;
    assert_keys_equal(token_account.owner, wallet, "Invalid token account owner")?;
    assert_keys_equal(token_account.mint, mint, "Invalid token account mint")?;
    Ok(token_account)
}

pub fn assert_derivation(program_id: &Pubkey, account: &AccountInfo, path: &[&[u8]]) -> Result<u8> {
    let (key, bump) = Pubkey::find_program_address(&path, program_id);
    if key != *account.key {
        return err!(GumballGuardError::InvalidPDA);
    }
    Ok(bump)
}

/// Return a padded string up to the specified length. If the specified
/// string `value` is longer than the allowed `length`, return an error.
pub fn fixed_length_string(value: String, length: usize) -> Result<String> {
    if length < value.len() {
        // the value is larger than the allowed length
        return err!(GumballGuardError::ExceededLength);
    }

    let padding = NULL_STRING.repeat(length - value.len());
    Ok(value + &padding)
}

pub fn spl_token_burn(params: TokenBurnParams) -> Result<()> {
    let TokenBurnParams {
        mint,
        source,
        authority,
        token_program,
        amount,
        authority_signer_seeds,
    } = params;
    let mut seeds: Vec<&[&[u8]]> = vec![];
    if let Some(seed) = authority_signer_seeds {
        seeds.push(seed);
    }
    let result = invoke_signed(
        &anchor_spl::token::spl_token::instruction::burn(
            token_program.key,
            source.key,
            mint.key,
            authority.key,
            &[],
            amount,
        )?,
        &[source, mint, authority, token_program],
        seeds.as_slice(),
    );
    result.map_err(|_| GumballGuardError::TokenBurnFailed.into())
}

pub fn spl_token_transfer(params: TokenTransferParams<'_, '_>) -> Result<()> {
    let TokenTransferParams {
        source,
        destination,
        authority,
        token_program,
        amount,
        authority_signer_seeds,
    } = params;

    let mut signer_seeds = vec![];
    if !authority_signer_seeds.is_empty() {
        signer_seeds.push(authority_signer_seeds)
    }

    let result = invoke_signed(
        &anchor_spl::token::spl_token::instruction::transfer(
            token_program.key,
            source.key,
            destination.key,
            authority.key,
            &[],
            amount,
        )?,
        &[source, destination, authority, token_program],
        &signer_seeds,
    );

    result.map_err(|_| GumballGuardError::TokenTransferFailed.into())
}

pub fn get_bps_of(amount: u64, bps: u16) -> Result<u64> {
    if bps == 0 || amount == 0 {
        return Ok(0);
    }

    let bps = bps as u128;
    let amount = amount as u128;
    let result = amount
        .checked_mul(bps)
        .ok_or(GumballGuardError::NumericalOverflowError)?
        .checked_div(10000)
        .ok_or(GumballGuardError::NumericalOverflowError)? as u64;
    Ok(result)
}

/// Pays creator fees to the creators in the metadata and returns total paid
pub fn pay_fee_accounts<'a>(
    payer: &mut AccountInfo<'a>,
    payer_token_account: Option<&AccountInfo<'a>>,
    payment_mint: Option<Pubkey>,
    fee_accounts: &Vec<FeeAccount>,
    remaining_accounts: &[AccountInfo<'a>],
    token_program: Option<&AccountInfo<'a>>,
    system_program: &AccountInfo<'a>,
    amount: u64,
) -> Result<u64> {
    let is_native = payment_mint.is_none();

    let mut total_paid = 0;
    // One remaining account is provided per fee account (validated positionally by
    // the caller), so the cursor must advance for every entry — including zero-bps
    // ones — to stay aligned with `fee_accounts`.
    for (index, fee_account) in fee_accounts.iter().enumerate() {
        if fee_account.basis_points == 0 {
            continue;
        }

        let fee_amount = (fee_account.basis_points as u128)
            .checked_mul(amount as u128)
            .ok_or(GumballGuardError::NumericalOverflowError)?
            .checked_div(10000)
            .ok_or(GumballGuardError::NumericalOverflowError)? as u64;

        let current_fee_account = &remaining_accounts[index];

        if is_native {
            assert_keys_equal(
                fee_account.address,
                current_fee_account.key(),
                "Invalid fee account",
            )?;

            transfer_sol(
                payer,
                &mut current_fee_account.to_account_info(),
                system_program,
                None,
                fee_amount,
            )?;
        } else {
            assert_is_token_account(
                current_fee_account,
                fee_account.address,
                payment_mint.unwrap(),
            )?;

            spl_token_transfer(TokenTransferParams {
                source: payer_token_account.unwrap().to_account_info(),
                destination: current_fee_account.to_account_info(),
                authority: payer.to_account_info(),
                authority_signer_seeds: &[],
                amount: fee_amount,
                token_program: token_program.unwrap().to_account_info(),
            })?;
        }

        total_paid += fee_amount;
    }

    Ok(total_paid)
}

/// Validates that a machine account is either closed (empty) or in `SaleEnded` state.
/// Works for both GumballMachine and JellybeanMachine accounts.
pub fn require_machine_sale_ended_or_closed(machine_info: &AccountInfo) -> Result<()> {
    if !machine_info.data_is_empty() {
        if let Ok(machine) = try_from!(Account::<GumballMachine>, machine_info) {
            require!(
                machine.state == GumballState::SaleEnded,
                GumballGuardError::InvalidMachineState
            );
        } else if let Ok(machine) = try_from!(Account::<JellybeanMachine>, machine_info) {
            require!(
                machine.state == JellybeanState::SaleEnded,
                GumballGuardError::InvalidMachineState
            );
        } else {
            return err!(GumballGuardError::InvalidMachine);
        }
    }
    Ok(())
}

/// Closes a PDA account by transferring all lamports to the recipient and zeroing the data.
pub fn close_pda_account<'info>(
    account: &AccountInfo<'info>,
    recipient: &AccountInfo<'info>,
) -> Result<()> {
    let lamports = account.lamports();
    **account.try_borrow_mut_lamports()? = 0;
    **recipient.try_borrow_mut_lamports()? = recipient
        .lamports()
        .checked_add(lamports)
        .ok_or(GumballGuardError::NumericalOverflowError)?;

    let mut data = account.try_borrow_mut_data()?;
    for byte in data.iter_mut() {
        *byte = 0;
    }

    Ok(())
}

#[macro_export]
macro_rules! try_from {
    ($ty: ty, $acc: expr) => {
        <$ty>::try_from(unsafe { std::mem::transmute::<_, &AccountInfo<'_>>($acc.as_ref()) })
    };
}
