use crate::{constants::AUTHORITY_SEED, processors::PAYOUT_CLAIM_SIZE, GumballError};
use anchor_lang::prelude::*;
use utils::{can_receive_lamports, transfer_sol_from_pda};

/// Recover a fully paid ledger entry's rent without the recipient's signature.
#[derive(Accounts)]
pub struct RecoverPayoutRent<'info> {
    /// CHECK: only the key is used for escrow seeds; recovery survives machine close.
    pub gumball_machine: UncheckedAccount<'info>,
    /// CHECK: escrow ledger bound to the machine.
    #[account(mut, owner = crate::ID, seeds = [AUTHORITY_SEED.as_bytes(), gumball_machine.key().as_ref()], bump)]
    pub authority_pda: UncheckedAccount<'info>,
    #[account(mut)]
    pub rent_payer: Signer<'info>,
}

pub fn recover_payout_rent(ctx: Context<RecoverPayoutRent>, recipient: Pubkey) -> Result<()> {
    let escrow = ctx.accounts.authority_pda.to_account_info();
    let rent_payer = ctx.accounts.rent_payer.to_account_info();
    let data = escrow.try_borrow_data()?;
    let (position, _) = entry_position(&data, &recipient, |_, entry| {
        entry[72..104] == rent_payer.key().to_bytes()
    })?;
    require!(
        data[position + 64..position + 72] == [0; 8],
        GumballError::NotAllSettled
    );
    require!(
        data[position + 72..position + 104] == rent_payer.key().to_bytes(),
        GumballError::InvalidAuthority
    );
    let deposit = u64::from_le_bytes(data[position + 104..position + 112].try_into().unwrap());
    drop(data);
    require!(
        can_receive_lamports(&rent_payer),
        GumballError::InvalidAuthority
    );
    require!(
        rent_payer.lamports().saturating_add(deposit)
            >= Rent::get()?.minimum_balance(rent_payer.data_len()),
        GumballError::InsufficientFunds
    );
    return_claim_rent(&escrow, &rent_payer, position, deposit)
}

pub fn return_claim_rent(
    escrow: &AccountInfo,
    rent_payer: &AccountInfo,
    position: usize,
    deposit: u64,
) -> Result<()> {
    let size = escrow.data_len();
    escrow
        .try_borrow_mut_data()?
        .copy_within(position + PAYOUT_CLAIM_SIZE..size, position);
    escrow.resize(size - PAYOUT_CLAIM_SIZE)?;
    if deposit > 0 {
        transfer_sol_from_pda(&mut escrow.clone(), &mut rent_payer.clone(), deposit)?;
    }
    Ok(())
}

/// Find the authenticated currency without depending on the closed machine.
pub fn entry_position(
    data: &[u8],
    recipient: &Pubkey,
    matches: impl Fn(&Pubkey, &[u8]) -> bool,
) -> Result<(usize, Pubkey)> {
    require!(
        data.len() % PAYOUT_CLAIM_SIZE == 0,
        GumballError::InvalidVersion
    );
    data.chunks_exact(PAYOUT_CLAIM_SIZE)
        .enumerate()
        .find_map(|(index, entry)| {
            let mint = Pubkey::new_from_array(entry[32..64].try_into().unwrap());
            (entry[..32] == recipient.to_bytes() && matches(&mint, entry))
                .then_some((index * PAYOUT_CLAIM_SIZE, mint))
        })
        .ok_or(GumballError::InsufficientFunds.into())
}

pub fn can_return_deposit(account: &AccountInfo, deposit: u64) -> Result<bool> {
    Ok(account.is_writable
        && can_receive_lamports(account)
        && account.lamports().saturating_add(deposit)
            >= Rent::get()?.minimum_balance(account.data_len()))
}

/// A fully paid entry always terminates. Prefer its payer, then its recipient.
/// If neither can receive SOL, the released deposit remains escrow surplus.
pub fn finish_claim(
    escrow: &AccountInfo,
    rent_payer: &AccountInfo,
    recipient: &AccountInfo,
    position: usize,
    deposit: u64,
) -> Result<()> {
    if can_return_deposit(rent_payer, deposit)? {
        return_claim_rent(escrow, rent_payer, position, deposit)
    } else if can_return_deposit(recipient, deposit)? {
        return_claim_rent(escrow, recipient, position, deposit)
    } else {
        return_claim_rent(escrow, recipient, position, 0)
    }
}
