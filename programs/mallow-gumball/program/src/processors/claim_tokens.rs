use crate::{processors::claim_item, GumballMachine};
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;
use solana_program::program::invoke_signed;
use utils::transfer_spl;

pub fn claim_tokens<'a, 'b>(
    gumball_machine: &mut Box<Account<'a, GumballMachine>>,
    index: u32,
    authority: &AccountInfo<'a>,
    authority_pda: &AccountInfo<'a>,
    payer: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    to_token_account: &AccountInfo<'a>,
    authority_pda_token_account: &mut Box<Account<'a, TokenAccount>>,
    mint: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    associated_token_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    rent: &AccountInfo<'a>,
    auth_seeds: &[&[u8]],
) -> Result<u64> {
    let amount = claim_item(gumball_machine, index)?;

    transfer_spl(
        authority_pda,
        to,
        &authority_pda_token_account.to_account_info(),
        to_token_account,
        mint,
        payer,
        associated_token_program,
        token_program,
        system_program,
        rent,
        Some(authority_pda),
        Some(&auth_seeds),
        None,
        amount,
    )?;

    authority_pda_token_account.reload()?;
    // Close the token account back to authority if token account is empty
    if authority_pda_token_account.amount == 0 {
        invoke_signed(
            &spl_token::instruction::close_account(
                token_program.key,
                authority_pda_token_account.to_account_info().key,
                authority.key,
                authority_pda.key,
                &[],
            )?,
            &[
                token_program.to_account_info(),
                authority_pda_token_account.to_account_info(),
                authority.to_account_info(),
                authority_pda.to_account_info(),
                system_program.to_account_info(),
            ],
            &[&auth_seeds],
        )?;
    }

    Ok(amount)
}
