use crate::GumballError;
use anchor_lang::prelude::*;
use utils::is_native_mint;

/// Validate the supplied mint against machine state and normalize SOL to None.
pub fn payment_currency<'a, 'info>(
    configured_mint: Pubkey,
    supplied_mint: Option<&'a AccountInfo<'info>>,
) -> Result<Option<&'a AccountInfo<'info>>> {
    if is_native_mint(configured_mint) {
        require!(
            supplied_mint.is_none_or(|mint| is_native_mint(mint.key())),
            GumballError::InvalidPaymentMint
        );
        Ok(None)
    } else {
        require!(
            supplied_mint.is_some_and(|mint| mint.key() == configured_mint),
            GumballError::InvalidPaymentMint
        );
        Ok(supplied_mint)
    }
}
