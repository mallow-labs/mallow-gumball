use crate::GumballError;
use anchor_lang::prelude::*;

// Escrow-owned entries: recipient, currency, amount, rent payer, rent deposit.
// The legacy escrow PDA is empty; no machine or instruction layout is changed.
pub const PAYOUT_CLAIM_SIZE: usize = 112;

pub fn claim_position(data: &[u8], recipient: &Pubkey, mint: &Pubkey) -> Result<Option<usize>> {
    require!(
        data.len() % PAYOUT_CLAIM_SIZE == 0,
        GumballError::InvalidVersion
    );
    Ok(data
        .chunks_exact(PAYOUT_CLAIM_SIZE)
        .position(|entry| &entry[..32] == recipient.as_ref() && &entry[32..64] == mint.as_ref())
        .map(|index| index * PAYOUT_CLAIM_SIZE))
}

pub fn park_payout<'info>(
    escrow: &AccountInfo<'info>,
    recipient: Pubkey,
    mint: Pubkey,
    amount: u64,
    payer: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    payout_accounts: &[AccountInfo<'info>],
    creator_accounts: &[AccountInfo<'info>],
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    require_keys_eq!(*escrow.owner, crate::ID, GumballError::InvalidAuthority);
    let position = claim_position(&escrow.try_borrow_data()?, &recipient, &mint)?;
    if let Some(position) = position {
        let mut data = escrow.try_borrow_mut_data()?;
        let previous = u64::from_le_bytes(data[position + 64..position + 72].try_into().unwrap());
        let current = previous
            .checked_add(amount)
            .ok_or(GumballError::NumericalOverflowError)?;
        data[position + 64..position + 72].copy_from_slice(&current.to_le_bytes());
    } else {
        let position = escrow.data_len();
        let size = position
            .checked_add(PAYOUT_CLAIM_SIZE)
            .ok_or(GumballError::NumericalOverflowError)?;
        let rent = Rent::get()?;
        let deposit = rent
            .minimum_balance(size)
            .checked_sub(rent.minimum_balance(position))
            .ok_or(GumballError::NumericalOverflowError)?;
        // Always charge the action's payer, never sale proceeds or draw reserves.
        let mut instruction = anchor_lang::solana_program::system_instruction::transfer(
            payer.key, escrow.key, deposit,
        );
        let mut accounts = vec![payer.clone(), escrow.clone(), system_program.clone()];
        // Flush all direct native credits before the rent CPI. Omitting a paid
        // creator from the CPI's accounts would leave the caller unbalanced.
        for account in payout_accounts.iter().chain(creator_accounts) {
            if !accounts.iter().any(|existing| existing.key == account.key) {
                instruction
                    .accounts
                    .push(anchor_lang::solana_program::instruction::AccountMeta {
                        pubkey: account.key(),
                        is_signer: account.is_signer,
                        is_writable: account.is_writable,
                    });
                accounts.push(account.clone());
            }
        }
        solana_program::program::invoke(&instruction, &accounts)?;
        escrow.resize(size)?;
        let mut data = escrow.try_borrow_mut_data()?;
        data[position..position + 32].copy_from_slice(recipient.as_ref());
        data[position + 32..position + 64].copy_from_slice(mint.as_ref());
        data[position + 64..position + 72].copy_from_slice(&amount.to_le_bytes());
        data[position + 72..position + 104].copy_from_slice(payer.key.as_ref());
        data[position + 104..position + 112].copy_from_slice(&deposit.to_le_bytes());
    }
    Ok(())
}

/// Token debt that must stay in the canonical vault after machine close.
pub fn parked_amount(data: &[u8], mint: &Pubkey) -> Result<u64> {
    require!(
        data.len() % PAYOUT_CLAIM_SIZE == 0,
        GumballError::InvalidVersion
    );
    data.chunks_exact(PAYOUT_CLAIM_SIZE)
        .filter(|entry| &entry[32..64] == mint.as_ref())
        .try_fold(0u64, |total, entry| {
            total
                .checked_add(u64::from_le_bytes(entry[64..72].try_into().unwrap()))
                .ok_or(GumballError::NumericalOverflowError.into())
        })
}
