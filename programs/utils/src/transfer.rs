//! Payment movement for both token programs (TOKEN22_PLAN §D4, §D5).
//!
//! A Token-2022 payment mint needs its program account passed in. Rather than
//! add a named account to a shipped instruction, the program branches on
//! `payment_mint.owner` — which the runtime sets and no caller controls — and
//! reads **one extra remaining account** only when that owner is Token-2022.
//! For the settle family the slot is at index **0**, before the creator pairs;
//! for `close_gumball_machine` it is at index **4**, after the existing
//! `mint, to_token_account, ata_program, system_program` block.
//!
//! Transfers always use `transfer_checked` (§D4), with decimals read from the
//! unpacked mint. §D6 binds the mint to the program being invoked.

use std::collections::HashMap;

use crate::token22::{assert_mint_matches_token_program, unpack_currency_mint_decimals};
use crate::{assert_is_ata_for_program, error::Error, is_native_mint};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::{create, Create};
use anchor_spl::token_2022::{transfer_checked, TransferChecked};
use mpl_token_metadata::accounts::Metadata;
use mpl_token_metadata::instructions::TransferV1CpiBuilder;
use mpl_token_metadata::types::{Payload, PayloadType, ProgrammableConfig, TokenStandard};
use solana_program::account_info::AccountInfo;
use solana_program::program::{invoke, invoke_signed};

/// Transfers SOL or SPL tokens from a program owned account to another account.
pub fn transfer<'a>(
    from: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    from_currency_account: Option<&AccountInfo<'a>>,
    to_currency_account: Option<&AccountInfo<'a>>,
    currency_mint: Option<&AccountInfo<'a>>,
    fee_payer: Option<&AccountInfo<'a>>,
    associated_token_program: Option<&AccountInfo<'a>>,
    token_program: Option<&AccountInfo<'a>>,
    system_program: &AccountInfo<'a>,
    signer_seeds: Option<&[&[u8]]>,
    fee_payer_seeds: Option<&[&[u8]]>,
    amount: u64,
) -> Result<()> {
    if currency_mint.is_none() {
        transfer_sol(from, to, system_program, signer_seeds, amount)?;
    } else {
        transfer_spl(
            from,
            to,
            from_currency_account.unwrap(),
            to_currency_account.unwrap(),
            currency_mint.unwrap(),
            if fee_payer.is_some() {
                fee_payer.unwrap()
            } else {
                from
            },
            associated_token_program.unwrap(),
            token_program.unwrap(),
            system_program,
            None,
            signer_seeds,
            fee_payer_seeds,
            amount,
        )?;
    }

    Ok(())
}

/// Transfers SOL or SPL tokens from a program owned account to another account.
pub fn transfer_from_pda<'a>(
    from: &mut AccountInfo<'a>,
    to: &mut AccountInfo<'a>,
    from_currency_account: Option<&AccountInfo<'a>>,
    to_currency_account: Option<&AccountInfo<'a>>,
    currency_mint: Option<&AccountInfo<'a>>,
    fee_payer: Option<&AccountInfo<'a>>,
    associated_token_program: Option<&AccountInfo<'a>>,
    token_program: Option<&AccountInfo<'a>>,
    system_program: &AccountInfo<'a>,
    signer_seeds: &[&[u8]],
    fee_payer_seeds: Option<&[&[u8]]>,
    amount: u64,
) -> Result<()> {
    if currency_mint.is_none()
        || currency_mint.unwrap().key() == Pubkey::default()
        || is_native_mint(currency_mint.unwrap().key())
    {
        transfer_sol_from_pda(from, to, amount)?;
    } else {
        transfer_spl(
            from,
            to,
            from_currency_account.unwrap(),
            to_currency_account.unwrap(),
            currency_mint.unwrap(),
            if fee_payer.is_some() {
                fee_payer.unwrap()
            } else {
                from
            },
            associated_token_program.unwrap(),
            token_program.unwrap(),
            system_program,
            None,
            Some(signer_seeds),
            fee_payer_seeds,
            amount,
        )?;
    }

    Ok(())
}

pub fn transfer_sol_from_pda(
    src: &mut AccountInfo,
    dst: &mut AccountInfo,
    amount: u64,
) -> Result<()> {
    **src.try_borrow_mut_lamports()? = src
        .lamports()
        .checked_sub(amount)
        .ok_or(Error::OverflowError)?;
    **dst.try_borrow_mut_lamports()? = dst
        .lamports()
        .checked_add(amount)
        .ok_or(Error::OverflowError)?;
    Ok(())
}

pub fn transfer_sol<'a>(
    from: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    signer_seeds: Option<&[&[u8]]>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }

    let transfer_ix = &system_instruction::transfer(from.key, to.key, amount);

    let transfer_accounts = &[from.clone(), to.clone(), system_program.clone()];

    if signer_seeds.is_some() {
        invoke_signed(transfer_ix, transfer_accounts, &[signer_seeds.unwrap()])?;
    } else {
        invoke(transfer_ix, transfer_accounts)?;
    }

    Ok(())
}

pub fn transfer_spl<'a>(
    from: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    from_token_account: &AccountInfo<'a>,
    to_token_account: &AccountInfo<'a>,
    mint: &AccountInfo<'a>,
    fee_payer: &AccountInfo<'a>,
    ata_program: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    from_authority: Option<&AccountInfo<'a>>,
    signer_seeds: Option<&[&[u8]]>,
    fee_payer_seeds: Option<&[&[u8]]>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }

    // §D6 anti-spoof: the mint must be owned by the program we are about to CPI
    // into, so a Token-2022 mint can never be moved by the classic program (or
    // the reverse).
    assert_mint_matches_token_program(mint, token_program)?;
    // Decimals from the unpacked mint, never a stored constant; the unpack must
    // not hardcode a size because a Token-2022 mint with extensions is larger
    // than the classic 82 bytes.
    let decimals = unpack_currency_mint_decimals(mint)?;

    ensure_ata(
        to_token_account,
        to,
        mint,
        fee_payer,
        ata_program,
        token_program,
        system_program,
        fee_payer_seeds,
    )?;

    let transfer_cpi = CpiContext::new(
        *token_program.key,
        TransferChecked {
            from: from_token_account.to_account_info(),
            mint: mint.to_account_info(),
            to: to_token_account.to_account_info(),
            authority: if from_authority.is_some() {
                from_authority.unwrap().to_account_info()
            } else {
                from.to_account_info()
            },
        },
    );

    if signer_seeds.is_none() {
        transfer_checked(transfer_cpi, amount, decimals)?;
    } else {
        transfer_checked(
            transfer_cpi.with_signer(&[signer_seeds.unwrap()]),
            amount,
            decimals,
        )?;
    }

    Ok(())
}

pub fn ensure_ata<'b>(
    to_token_account: &AccountInfo<'b>,
    to: &AccountInfo<'b>,
    mint: &AccountInfo<'b>,
    fee_payer: &AccountInfo<'b>,
    ata_program: &AccountInfo<'b>,
    token_program: &AccountInfo<'b>,
    system_program: &AccountInfo<'b>,
    fee_payer_seeds: Option<&[&[u8]]>,
) -> Result<()> {
    if to_token_account.data_is_empty() {
        make_ata(
            to_token_account.to_account_info(),
            to.to_account_info(),
            mint.to_account_info(),
            fee_payer.to_account_info(),
            ata_program.to_account_info(),
            token_program.to_account_info(),
            system_program.to_account_info(),
            fee_payer_seeds,
        )?;
    } else {
        // Program-aware derivation: the two-argument `get_associated_token_address`
        // silently returns the classic address for a Token-2022 mint.
        assert_is_ata_for_program(to_token_account, to.key, &mint.key(), token_program.key)?;
    }

    Ok(())
}

pub fn make_ata<'a>(
    ata: AccountInfo<'a>,
    wallet: AccountInfo<'a>,
    mint: AccountInfo<'a>,
    fee_payer: AccountInfo<'a>,
    ata_program: AccountInfo<'a>,
    token_program: AccountInfo<'a>,
    system_program: AccountInfo<'a>,
    fee_payer_seeds: Option<&[&[u8]]>,
) -> Result<()> {
    let accounts = Create {
        payer: fee_payer.to_account_info(),
        associated_token: ata.to_account_info(),
        authority: wallet.to_account_info(),
        mint: mint.to_account_info(),
        system_program: system_program.to_account_info(),
        token_program: token_program.to_account_info(),
    };

    if fee_payer_seeds.is_some() {
        let seeds = &[fee_payer_seeds.unwrap()];
        create(CpiContext::new_with_signer(
            *ata_program.key,
            accounts,
            seeds,
        ))?;
    } else {
        create(CpiContext::new(*ata_program.key, accounts))?;
    }

    Ok(())
}

pub fn transfer_nft<'a>(
    from: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    from_token_account: &AccountInfo<'a>,
    to_token_account: &AccountInfo<'a>,
    mint: &AccountInfo<'a>,
    edition: &AccountInfo<'a>,
    metadata: &Metadata,
    metadata_info: &AccountInfo<'a>,
    fee_payer: &AccountInfo<'a>,
    ata_program: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    token_metadata_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    authority: &AccountInfo<'a>,
    authority_seeds: Option<&[&[u8]]>,
    fee_payer_seeds: Option<&[&[u8]]>,
    from_token_record: Option<&UncheckedAccount<'a>>,
    to_token_record: Option<&UncheckedAccount<'a>>,
    rules: Option<&UncheckedAccount<'a>>,
    auth_rules_program: Option<&UncheckedAccount<'a>>,
    sysvar_instructions: Option<&UncheckedAccount<'a>>,
) -> Result<()> {
    ensure_ata(
        to_token_account,
        to,
        mint,
        fee_payer,
        ata_program,
        token_program,
        system_program,
        fee_payer_seeds,
    )?;

    if let Some(sysvar_instructions) = sysvar_instructions {
        let mut builder = TransferV1CpiBuilder::new(token_metadata_program);
        builder
            .authority(authority)
            .token_owner(from)
            .token(from_token_account)
            .destination_token(to_token_account)
            .destination_owner(to)
            .mint(mint)
            .metadata(metadata_info)
            .edition(Some(edition))
            .payer(fee_payer)
            .system_program(system_program)
            .spl_token_program(token_program)
            .spl_ata_program(ata_program)
            .sysvar_instructions(sysvar_instructions);

        if let Some(standard) = &metadata.token_standard {
            if *standard == TokenStandard::ProgrammableNonFungible
                || *standard == TokenStandard::ProgrammableNonFungibleEdition
            {
                builder.token_record(from_token_record.map(|acc| acc.as_ref()));
                builder.destination_token_record(to_token_record.map(|acc| acc.as_ref()));
            }
        }

        if let Some(config) = &metadata.programmable_config {
            match *config {
                ProgrammableConfig::V1 { rule_set } => {
                    if let Some(_rule_set) = rule_set {
                        builder.authorization_rules_program(
                            auth_rules_program.map(|acc| acc.as_ref()),
                        );
                        builder.authorization_rules(rules.map(|acc| acc.as_ref()));
                    }
                }
            }
        }

        if let Some(seeds) = authority_seeds {
            builder.invoke_signed(&[seeds])?;
        } else {
            builder.invoke()?;
        }
    } else {
        transfer_spl(
            from,
            to,
            from_token_account,
            to_token_account,
            mint,
            fee_payer,
            ata_program,
            token_program,
            system_program,
            Some(authority),
            authority_seeds,
            None,
            1,
        )?;
    }

    Ok(())
}

pub fn get_auth_payload(delegate: &AccountInfo) -> Payload {
    let mut map = HashMap::new();
    map.insert(
        "Destination".to_owned(),
        PayloadType::Pubkey(delegate.key()),
    );
    map.insert("Source".to_owned(), PayloadType::Pubkey(delegate.key()));
    map.insert("Authority".to_owned(), PayloadType::Pubkey(delegate.key()));

    Payload { map }
}
