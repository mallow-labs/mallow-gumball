use anchor_lang::prelude::*;
use mpl_token_metadata::instructions::{ThawDelegatedAccountCpi, ThawDelegatedAccountCpiAccounts};
use solana_program::program::invoke_signed;
use utils::transfer_spl;

use crate::{processors::claim_item, GumballMachine};

pub fn claim_nft<'a, 'b>(
    gumball_machine: &mut Box<Account<'a, GumballMachine>>,
    index: u32,
    authority_pda: &AccountInfo<'a>,
    payer: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    to_token_account: &AccountInfo<'a>,
    from: &AccountInfo<'a>,
    from_token_account: &AccountInfo<'a>,
    authority_pda_token_account: &AccountInfo<'a>,
    mint: &AccountInfo<'a>,
    edition: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    associated_token_program: &AccountInfo<'a>,
    token_metadata_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    rent: &AccountInfo<'a>,
    auth_seeds: &[&[u8]],
) -> Result<()> {
    claim_item(gumball_machine, index)?;

    ThawDelegatedAccountCpi::new(
        token_metadata_program,
        ThawDelegatedAccountCpiAccounts {
            delegate: authority_pda,
            token_account: from_token_account,
            edition,
            mint,
            token_program,
        },
    )
    .invoke_signed(&[&auth_seeds])?;

    // Transfer to authority pda first so we can update primary sale flag
    transfer_spl(
        from,
        authority_pda,
        from_token_account,
        authority_pda_token_account,
        mint,
        payer,
        associated_token_program,
        token_program,
        system_program,
        rent,
        Some(authority_pda),
        Some(&auth_seeds),
        None,
        1,
    )?;

    // Transfer
    transfer_spl(
        authority_pda,
        to,
        authority_pda_token_account,
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
        1,
    )?;

    // Close the tmp account back to payer
    invoke_signed(
        &spl_token::instruction::close_account(
            token_program.key,
            authority_pda_token_account.key,
            payer.key,
            authority_pda.key,
            &[],
        )?,
        &[
            token_program.to_account_info(),
            authority_pda_token_account.to_account_info(),
            payer.to_account_info(),
            authority_pda.to_account_info(),
            system_program.to_account_info(),
        ],
        &[&auth_seeds],
    )?;

    Ok(())
}
