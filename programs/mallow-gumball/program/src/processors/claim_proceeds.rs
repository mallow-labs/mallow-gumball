use super::{claim_position, park_payout, payment_currency};
use crate::{
    get_bit_byte_info, get_config_count, state::GumballMachine, GumballError, SellerHistory,
};
use anchor_lang::prelude::*;
use utils::{
    assert_keys_equal, can_receive_lamports, expects_token_program_slot, get_bps_of,
    is_native_mint, resolve_currency_token_program, transfer, transfer_from_pda,
    transfer_sol_from_pda, RoyaltyInfo,
};

pub fn claim_proceeds<'a, 'b>(
    gumball_machine: &mut Box<Account<'a, GumballMachine>>,
    index: u32,
    seller_history: &mut Box<Account<'a, SellerHistory>>,
    fee_payer: &AccountInfo<'a>,
    authority_pda: &mut AccountInfo<'a>,
    authority_pda_payment_account: Option<&AccountInfo<'a>>,
    authority: &mut AccountInfo<'a>,
    authority_payment_account: Option<&AccountInfo<'a>>,
    seller: &mut AccountInfo<'a>,
    seller_payment_account: Option<&AccountInfo<'a>>,
    fee_account: Option<&mut AccountInfo<'a>>,
    fee_payment_account: Option<&AccountInfo<'a>>,
    payment_mint: Option<&AccountInfo<'a>>,
    royalty_info: &RoyaltyInfo,
    remaining_accounts: &'b [AccountInfo<'a>],
    associated_token_program: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    auth_seeds: &[&[u8]],
) -> Result<u64> {
    let currency_mint = payment_currency(gumball_machine.settings.payment_mint, payment_mint)?;

    // Token-2022 precedes creator pairs; native and classic calls consume no slot.
    let (currency_token_program, creator_accounts) = if expects_token_program_slot(currency_mint) {
        (
            resolve_currency_token_program(
                currency_mint,
                remaining_accounts.first(),
                token_program,
            )?,
            &remaining_accounts[1..],
        )
    } else {
        (
            resolve_currency_token_program(currency_mint, None, token_program)?,
            remaining_accounts,
        )
    };

    let account_info = gumball_machine.to_account_info();
    let mut account_data = account_info.data.borrow_mut();
    let config_count = get_config_count(&account_data)? as u64;

    // bit-mask
    let bit_mask_start = gumball_machine.get_settled_items_bit_mask_position()?;
    let (byte_position, bit, mask) = get_bit_byte_info(bit_mask_start, index as usize)?;
    let current_value = account_data[byte_position];
    let is_settled = current_value & mask == mask;
    require!(!is_settled, GumballError::ItemAlreadySettled);

    if gumball_machine.version < 6 {
        account_data[byte_position] |= mask;
    }

    let disable_primary_split_position = gumball_machine.get_disable_primary_split_position()?;
    let disable_royalties_position = gumball_machine.get_disable_royalties_position()?;
    let (disable_primary_split, disable_royalties) = if gumball_machine.version >= 3 {
        // Read the boolean value from the data at the calculated position
        (
            account_data[disable_primary_split_position] == 1,
            account_data[disable_royalties_position] == 1,
        )
    } else {
        // For versions < 3, these settings don't exist, so default to false
        (false, false)
    };

    msg!(
        "Item processed: byte position={}, mask={}, current value={}, new value={}, bit position={}, disable primary split={}, disable royalties={}",
        byte_position - bit_mask_start,
        mask,
        current_value,
        account_data[byte_position],
        bit,
        disable_primary_split,
        disable_royalties
    );

    let (total_proceeds, previous_proceeds, finalized, marketplace_fee_bps) =
        if gumball_machine.version >= 6 {
            let (amount, previous, finalized) =
                record_item_proceeds(gumball_machine, &mut account_data, index, config_count)?;
            (
                amount,
                previous,
                finalized,
                gumball_machine
                    .marketplace_fee_config
                    .map_or(0, |f| f.fee_bps),
            )
        } else if gumball_machine.version >= 5 {
            let mut total_proceeds_settled =
                gumball_machine.get_total_proceeds_settled(&account_data)?;

            let (total_proceeds, marketplace_fee_bps) = get_total_proceeds(
                gumball_machine,
                total_proceeds_settled,
                config_count,
                gumball_machine.get_refund_reserve(&account_data)?,
            )?;

            total_proceeds_settled = total_proceeds_settled
                .checked_add(total_proceeds)
                .ok_or(GumballError::NumericalOverflowError)?;
            // Update the total proceeds settled
            let total_proceeds_settled_position =
                gumball_machine.get_total_proceeds_settled_position()?;
            account_data[total_proceeds_settled_position..total_proceeds_settled_position + 8]
                .copy_from_slice(&total_proceeds_settled.to_le_bytes());

            (total_proceeds, 0, true, marketplace_fee_bps)
        } else {
            let (amount, fee) = get_total_proceeds(gumball_machine, 0, config_count, 0)?;
            (amount, 0, true, fee)
        };

    drop(account_data);

    transfer_proceeds(
        gumball_machine,
        total_proceeds,
        previous_proceeds,
        if finalized && seller_history.item_count == 1 {
            seller_history.to_account_info().lamports()
        } else {
            0
        },
        None,
        marketplace_fee_bps,
        authority_pda,
        authority,
        authority_pda_payment_account,
        authority_payment_account,
        seller,
        seller_payment_account,
        fee_account,
        fee_payment_account,
        currency_mint,
        fee_payer,
        associated_token_program,
        currency_token_program,
        system_program,
        auth_seeds,
        royalty_info,
        disable_primary_split,
        disable_royalties,
        creator_accounts,
    )?;

    if finalized {
        seller_history.item_count -= 1;
        if seller_history.item_count == 0 {
            seller_history.close(seller.to_account_info())?;
        }
        if gumball_machine.version < 6 {
            gumball_machine.items_settled += 1;
        }
    }

    Ok(total_proceeds)
}

/// Pay only the increase in this item's cumulative entitlement. Pending draw
/// payments remain reserved; claimed/refunded draws monotonically raise each
/// remaining item's entitlement. Keep the history and settlement bit open for
/// top-ups until all draws resolve, including zero-price draws.
pub fn record_item_proceeds(
    machine: &mut GumballMachine,
    data: &mut [u8],
    index: u32,
    config_count: u64,
) -> Result<(u64, u64, bool)> {
    let (byte, _, mask) = get_bit_byte_info(
        machine.get_settled_items_bit_mask_position()?,
        index as usize,
    )?;
    require!(data[byte] & mask == 0, GumballError::ItemAlreadySettled);
    let paid_position = machine.get_item_proceeds_position(index)?;
    let previous = GumballMachine::read_amount(data, paid_position)?;
    let total_paid = machine.get_total_proceeds_settled(data)?;
    let resolved = machine
        .total_revenue
        .checked_sub(machine.get_refund_reserve(data)?)
        .ok_or(GumballError::NumericalOverflowError)?;
    let unfinalized = machine.get_unfinalized_proceeds(data)?;
    let count = config_count
        .checked_sub(machine.items_settled)
        .ok_or(GumballError::NumericalOverflowError)?;
    let finalized = machine.get_outstanding_draws(data)? == 0
        && (machine.state == crate::GumballState::SaleEnded
            || machine.items_redeemed >= config_count);
    let target = resolved
        .checked_sub(total_paid)
        .ok_or(GumballError::NumericalOverflowError)?
        .checked_add(unfinalized)
        .ok_or(GumballError::NumericalOverflowError)?
        .checked_div(count)
        .ok_or(GumballError::NumericalOverflowError)?;
    let amount = target
        .checked_sub(previous)
        .ok_or(GumballError::NumericalOverflowError)?;
    data[paid_position..paid_position + 8].copy_from_slice(&target.to_le_bytes());
    let position = machine.get_total_proceeds_settled_position()?;
    data[position..position + 8].copy_from_slice(
        &total_paid
            .checked_add(amount)
            .ok_or(GumballError::NumericalOverflowError)?
            .to_le_bytes(),
    );
    let unfinalized_position = machine.get_unfinalized_proceeds_position()?;
    let unfinalized = if finalized {
        unfinalized.checked_sub(previous)
    } else {
        unfinalized.checked_add(amount)
    }
    .ok_or(GumballError::NumericalOverflowError)?;
    data[unfinalized_position..unfinalized_position + 8]
        .copy_from_slice(&unfinalized.to_le_bytes());
    if finalized {
        data[byte] |= mask;
        machine.items_settled += 1;
    }
    Ok((amount, previous, finalized))
}

pub fn get_total_proceeds<'a>(
    gumball_machine: &Box<Account<'a, GumballMachine>>,
    total_proceeds_settled: u64,
    config_count: u64,
    _refund_reserve: u64,
) -> Result<(u64, u16)> {
    let marketplace_fee_bps = if let Some(fee_config) = gumball_machine.marketplace_fee_config {
        fee_config.fee_bps
    } else {
        0
    };

    // Versions 1–5 take fees on draw
    let fees_taken =
        if gumball_machine.version > 0 && gumball_machine.version < 6 && marketplace_fee_bps > 0 {
            get_bps_of(gumball_machine.total_revenue, marketplace_fee_bps)?
        } else {
            0
        };

    // Version 5+ can have re-added items so total proceeds settled and items settled should be removed
    let count = if gumball_machine.version >= 5 {
        config_count - gumball_machine.items_settled
    } else {
        config_count
    };

    // Proceeds are calculated as total revenue divided by total number of items in the gumball machine
    // (This also accounts for items that have been settled)
    let total_proceeds = gumball_machine
        .total_revenue
        .checked_sub(fees_taken)
        .ok_or(GumballError::NumericalOverflowError)?
        .checked_sub(total_proceeds_settled)
        .ok_or(GumballError::NumericalOverflowError)?
        .checked_div(count)
        .ok_or(GumballError::NumericalOverflowError)?;

    Ok((total_proceeds, marketplace_fee_bps))
}

pub fn incremental_proceeds_fees(
    previous: u64,
    amount: u64,
    marketplace_bps: u16,
    curator_bps: u16,
) -> Result<(u64, u64)> {
    let current = previous
        .checked_add(amount)
        .ok_or(GumballError::NumericalOverflowError)?;
    let previous_marketplace = get_bps_of(previous, marketplace_bps)?;
    let current_marketplace = get_bps_of(current, marketplace_bps)?;
    let marketplace = current_marketplace
        .checked_sub(previous_marketplace)
        .ok_or(GumballError::NumericalOverflowError)?;
    let curator = get_bps_of(
        current
            .checked_sub(current_marketplace)
            .ok_or(GumballError::NumericalOverflowError)?,
        curator_bps,
    )?
    .checked_sub(get_bps_of(
        previous
            .checked_sub(previous_marketplace)
            .ok_or(GumballError::NumericalOverflowError)?,
        curator_bps,
    )?)
    .ok_or(GumballError::NumericalOverflowError)?;
    Ok((marketplace, curator))
}

/// `token_program` here is the **payment** program, already resolved from the
/// §D5 slot by `claim_proceeds`, and `remaining_accounts` is the creator
/// sub-slice with that slot removed.
pub fn transfer_proceeds<'a, 'b>(
    gumball_machine: &Box<Account<'a, GumballMachine>>,
    total_proceeds: u64,
    previous_proceeds: u64,
    seller_rent_refund: u64,
    fee_amounts: Option<(u64, u64)>,
    marketplace_fee_bps: u16,
    authority_pda: &mut AccountInfo<'a>,
    authority: &mut AccountInfo<'a>,
    authority_pda_payment_account: Option<&AccountInfo<'a>>,
    authority_payment_account: Option<&AccountInfo<'a>>,
    seller: &mut AccountInfo<'a>,
    seller_payment_account: Option<&AccountInfo<'a>>,
    fee_account: Option<&mut AccountInfo<'a>>,
    fee_payment_account: Option<&AccountInfo<'a>>,
    payment_mint: Option<&AccountInfo<'a>>,
    fee_payer: &AccountInfo<'a>,
    associated_token_program: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    auth_seeds: &[&[u8]],
    royalty_info: &RoyaltyInfo,
    disable_primary_split: bool,
    disable_royalties: bool,
    remaining_accounts: &'b [AccountInfo<'a>],
) -> Result<()> {
    let payment_mint = payment_currency(gumball_machine.settings.payment_mint, payment_mint)?;
    let payout_accounts = [
        authority.clone(),
        seller.clone(),
        fee_account
            .as_ref()
            .map(|account| account.to_account_info())
            .unwrap_or_else(|| fee_payer.clone()),
    ];
    let mut folded_claims = Vec::new();
    if total_proceeds > 0 {
        msg!("Total proceeds: {}", total_proceeds);
        let cumulative = previous_proceeds
            .checked_add(total_proceeds)
            .ok_or(GumballError::NumericalOverflowError)?;
        let previous_marketplace_fee = if gumball_machine.version >= 6 {
            get_bps_of(previous_proceeds, marketplace_fee_bps)?
        } else {
            0
        };

        // Versions 1–5 take fees on draw, so no fee on claim
        let marketplace_fee = if let Some((marketplace, _)) = fee_amounts {
            marketplace
        } else if gumball_machine.version > 0 && gumball_machine.version < 6 {
            0
        } else {
            get_bps_of(cumulative, marketplace_fee_bps)?
                .checked_sub(previous_marketplace_fee)
                .ok_or(GumballError::NumericalOverflowError)?
        };

        if marketplace_fee > 0 {
            let configured_fee = gumball_machine
                .marketplace_fee_config
                .ok_or(GumballError::InvalidAuthority)?;
            require!(
                fee_account
                    .as_ref()
                    .is_some_and(|a| a.key() == configured_fee.fee_account),
                GumballError::InvalidAuthority
            );
            msg!("Marketplace fee: {}", marketplace_fee);
            if let Some(claim) = transfer_or_park(
                gumball_machine,
                authority_pda,
                fee_account.unwrap(),
                authority_pda_payment_account,
                fee_payment_account,
                payment_mint,
                Some(fee_payer),
                Some(associated_token_program),
                Some(token_program),
                system_program,
                &auth_seeds,
                None,
                marketplace_fee,
                0,
                &payout_accounts,
                remaining_accounts,
            )? {
                folded_claims.push(claim);
            }
        }

        let curator_base = if gumball_machine.version >= 6 {
            total_proceeds
                .checked_sub(marketplace_fee)
                .ok_or(GumballError::NumericalOverflowError)?
        } else {
            total_proceeds
        };
        let previous_curator_base = previous_proceeds
            .checked_sub(previous_marketplace_fee)
            .ok_or(GumballError::NumericalOverflowError)?;
        let previous_curator_fee = get_bps_of(
            previous_curator_base,
            gumball_machine.settings.curator_fee_bps,
        )?;
        let curator_fee = get_bps_of(
            previous_curator_base
                .checked_add(curator_base)
                .ok_or(GumballError::NumericalOverflowError)?,
            gumball_machine.settings.curator_fee_bps,
        )?
        .checked_sub(previous_curator_fee)
        .ok_or(GumballError::NumericalOverflowError)?;

        let curator_fee = fee_amounts.map_or(curator_fee, |(_, curator)| curator);

        let price_less_fees = total_proceeds
            .checked_sub(marketplace_fee)
            .ok_or(GumballError::NumericalOverflowError)?
            .checked_sub(curator_fee)
            .ok_or(GumballError::NumericalOverflowError)?;
        msg!("Price less fees: {}", price_less_fees);

        let previous_net = previous_curator_base
            .checked_sub(previous_curator_fee)
            .ok_or(GumballError::NumericalOverflowError)?;
        let previous_royalty = if royalty_info.is_primary_sale && !disable_primary_split {
            previous_net
        } else {
            get_bps_of(previous_net, royalty_info.seller_fee_basis_points)?
        };
        let total_royalty = if royalty_info.is_primary_sale && !disable_primary_split {
            price_less_fees
        } else {
            if royalty_info.seller_fee_basis_points == 0 {
                0
            } else {
                get_bps_of(
                    previous_net
                        .checked_add(price_less_fees)
                        .ok_or(GumballError::NumericalOverflowError)?,
                    royalty_info.seller_fee_basis_points,
                )?
                .checked_sub(previous_royalty)
                .ok_or(GumballError::NumericalOverflowError)?
            }
        };

        let royalties_paid = if total_royalty > 0 && !disable_royalties {
            msg!("Total royalty: {}", total_royalty);
            pay_creator_royalties(
                authority_pda,
                payment_mint,
                authority_pda_payment_account,
                Some(fee_payer),
                royalty_info,
                remaining_accounts,
                associated_token_program,
                token_program,
                system_program,
                Some(&auth_seeds),
                total_royalty,
                previous_royalty,
                price_less_fees,
                seller,
                seller_rent_refund,
            )?
        } else {
            0
        };

        let mut seller_proceeds = price_less_fees
            .checked_sub(royalties_paid)
            .ok_or(GumballError::NumericalOverflowError)?;

        let combine_curator = payment_mint.is_none() && authority.key == seller.key;
        if curator_fee > 0 && !combine_curator {
            msg!("Curator fee: {}", curator_fee);
            if let Some(claim) = transfer_or_park(
                gumball_machine,
                authority_pda,
                authority,
                authority_pda_payment_account,
                authority_payment_account,
                payment_mint,
                Some(fee_payer),
                Some(associated_token_program),
                Some(token_program),
                system_program,
                &auth_seeds,
                None,
                curator_fee,
                0,
                &payout_accounts,
                remaining_accounts,
            )? {
                folded_claims.push(claim);
            }
        }

        if combine_curator {
            seller_proceeds = seller_proceeds
                .checked_add(curator_fee)
                .ok_or(GumballError::NumericalOverflowError)?;
        }
        msg!("Seller proceeds: {}", seller_proceeds);
        if seller_proceeds > 0 {
            if let Some(claim) = transfer_or_park(
                gumball_machine,
                authority_pda,
                seller,
                authority_pda_payment_account,
                seller_payment_account,
                payment_mint,
                Some(fee_payer),
                Some(associated_token_program),
                Some(token_program),
                system_program,
                &auth_seeds,
                None,
                seller_proceeds,
                seller_rent_refund,
                &payout_accounts,
                remaining_accounts,
            )? {
                folded_claims.push(claim);
            }
        }
    }

    // Token CPIs must finish before direct rent credits debit the escrow.
    // Re-find each entry: finishing an earlier one shifts subsequent positions.
    for (recipient, rent_payer) in folded_claims {
        finish_folded_claim(gumball_machine, authority_pda, &recipient, &rent_payer)?;
    }
    Ok(())
}

/// Pays creator fees to the creators in the metadata and returns total paid
pub fn pay_creator_royalties<'a, 'b>(
    payer: &mut AccountInfo<'a>,
    payment_mint: Option<&AccountInfo<'a>>,
    payer_token_account: Option<&AccountInfo<'a>>,
    fee_payer: Option<&AccountInfo<'a>>,
    verified_royalty_info: &RoyaltyInfo,
    remaining_accounts: &'b [AccountInfo<'a>],
    ata_program: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    auth_seeds: Option<&[&[u8]]>,
    total_royalty: u64,
    previous_royalty: u64,
    available_proceeds: u64,
    seller: &AccountInfo<'a>,
    seller_rent_refund: u64,
) -> Result<u64> {
    if total_royalty == 0 {
        return Ok(0);
    }

    if verified_royalty_info.creators.is_none() {
        return Ok(0);
    }

    let creators = verified_royalty_info.creators.as_ref().unwrap();
    if creators.is_empty() {
        return Ok(0);
    }

    let mut total_paid: u64 = 0;
    let is_native = payment_mint.is_none() || is_native_mint(payment_mint.unwrap().key());
    let remaining_accounts_clone = &mut remaining_accounts.iter();
    let rent = if is_native { Some(Rent::get()?) } else { None };
    let wallet_minimum = rent.as_ref().map_or(0, |rent| rent.minimum_balance(0));
    // Only this item's seller entitlement can fund rent. A skipped creator's
    // share stays with the seller and cannot subsidize another creator.
    let mut top_up_budget = available_proceeds;
    if is_native {
        let mut royalty_remaining = total_royalty;
        for (index, creator) in creators.iter().enumerate() {
            let info = remaining_accounts
                .get(index)
                .ok_or(ProgramError::NotEnoughAccountKeys)?;
            assert_keys_equal(creator.address, info.key(), "Invalid creator key")?;
            let creator_fee = bounded_creator_fee(
                creator.share,
                total_royalty,
                previous_royalty,
                &mut royalty_remaining,
            )?;
            if info.key() != seller.key() {
                top_up_budget = top_up_budget
                    .checked_sub(creator_fee)
                    .ok_or(GumballError::NumericalOverflowError)?;
            }
        }
        // Finalization returns history rent in this instruction; partial payouts
        // must leave enough seller proceeds to make the wallet rent-exempt.
        let seller_balance = seller.lamports().saturating_add(seller_rent_refund);
        let seller_minimum = if seller.data_len() == 0 {
            wallet_minimum
        } else {
            rent.as_ref().unwrap().minimum_balance(seller.data_len())
        };
        let seller_shortfall = seller_minimum.saturating_sub(seller_balance);
        top_up_budget = top_up_budget.saturating_sub(seller_shortfall);
    }
    let mut royalty_remaining = total_royalty;

    for creator in creators {
        let creator_fee = bounded_creator_fee(
            creator.share,
            total_royalty,
            previous_royalty,
            &mut royalty_remaining,
        )?;

        let current_creator_info = next_account_info(remaining_accounts_clone)?;
        if !is_native {
            assert_keys_equal(
                creator.address,
                current_creator_info.key(),
                "Invalid creator key",
            )?;
        }

        let creator_token_account = if is_native {
            None
        } else {
            Some(next_account_info(remaining_accounts_clone)?)
        };

        if creator_fee == 0 || (is_native && current_creator_info.key() == seller.key()) {
            continue;
        }
        if !is_native {
            let mint = payment_mint.unwrap();
            let destination = creator_token_account.unwrap();
            if !utils::can_receive_token(
                destination,
                current_creator_info.key,
                mint.key,
                token_program.key,
                true,
            )? {
                utils::assert_keys_equal(
                    destination.key(),
                    anchor_spl::associated_token::get_associated_token_address_with_program_id(
                        current_creator_info.key,
                        mint.key,
                        token_program.key,
                    ),
                    "Invalid creator ATA address",
                )?;
                continue;
            }
            require!(destination.is_writable, GumballError::InvalidSettingUpdate);
        }
        let mut amount = creator_fee;
        if let Some(rent) = &rent {
            // Runtime-reserved accounts cannot receive payouts even if the
            // client requests write access. Ordinary read-only creators must
            // fail rather than allowing a settler to divert payable royalties.
            if !can_receive_lamports(current_creator_info) {
                continue;
            }
            require!(
                current_creator_info.is_writable,
                GumballError::InvalidSettingUpdate
            );
            let post_balance = current_creator_info
                .lamports()
                .checked_add(creator_fee)
                .ok_or(GumballError::NumericalOverflowError)?;
            let minimum = if current_creator_info.data_len() == 0 {
                wallet_minimum
            } else {
                rent.minimum_balance(current_creator_info.data_len())
            };
            let shortfall = minimum.saturating_sub(post_balance);
            if shortfall > top_up_budget {
                continue;
            }
            top_up_budget -= shortfall;
            amount = amount
                .checked_add(shortfall)
                .ok_or(GumballError::NumericalOverflowError)?;
        }

        if is_native && auth_seeds.is_some() {
            transfer_sol_from_pda(payer, &mut current_creator_info.clone(), amount)?;
        } else if auth_seeds.is_some() {
            transfer_from_pda(
                payer,
                &mut current_creator_info.to_account_info(),
                payer_token_account,
                creator_token_account,
                payment_mint,
                fee_payer,
                Some(ata_program),
                Some(token_program),
                system_program,
                auth_seeds.unwrap(),
                None,
                amount,
            )?;
        } else {
            transfer(
                payer,
                current_creator_info,
                payer_token_account,
                creator_token_account,
                payment_mint,
                fee_payer,
                Some(ata_program),
                Some(token_program),
                system_program,
                None,
                None,
                amount,
            )?;
        }

        total_paid = total_paid
            .checked_add(amount)
            .ok_or(GumballError::NumericalOverflowError)?;
    }

    Ok(total_paid)
}

/// Cumulative floors can release several creators' rounding lamports together.
/// Cap their combined increase to this settlement's royalty budget; any rounding
/// residue stays with the seller.
fn bounded_creator_fee(share: u8, royalty: u64, previous: u64, remaining: &mut u64) -> Result<u64> {
    let fee = incremental_creator_fee(share, royalty, previous)?.min(*remaining);
    *remaining -= fee;
    Ok(fee)
}

fn incremental_creator_fee(share: u8, royalty: u64, previous: u64) -> Result<u64> {
    if share == 100 {
        return Ok(royalty);
    }
    if share == 0 {
        return Ok(0);
    }
    if previous == 0 {
        return u64::try_from(share as u128 * royalty as u128 / 100)
            .map_err(|_| GumballError::NumericalOverflowError.into());
    }
    let current = share as u128 * (royalty as u128 + previous as u128) / 100;
    let prior = share as u128 * previous as u128 / 100;
    u64::try_from(current - prior).map_err(|_| GumballError::NumericalOverflowError.into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GumballSettings, GumballState};

    #[test]
    fn creator_fees_preserve_cumulative_rounding_and_full_share() {
        assert_eq!(incremental_creator_fee(50, 99, 101).unwrap(), 50);
        assert_eq!(incremental_creator_fee(75, 2, 2).unwrap(), 2);
        assert_eq!(
            incremental_creator_fee(100, u64::MAX, u64::MAX).unwrap(),
            u64::MAX
        );
        assert_eq!(incremental_creator_fee(0, u64::MAX, u64::MAX).unwrap(), 0);
        assert_eq!(incremental_creator_fee(50, 3, 0).unwrap(), 1);
    }

    #[test]
    fn odd_cumulative_creator_increments_never_exceed_the_current_budget() {
        for previous in [1, 3, 500_000_001] {
            let mut remaining = 500_000_001;
            let first = bounded_creator_fee(50, 500_000_001, previous, &mut remaining).unwrap();
            let last = bounded_creator_fee(50, 500_000_001, previous, &mut remaining).unwrap();
            assert_eq!(first + last, 500_000_001);
            assert_eq!(remaining, 0);
        }
    }

    fn machine() -> GumballMachine {
        GumballMachine {
            version: 6,
            authority: Pubkey::default(),
            mint_authority: Pubkey::default(),
            marketplace_fee_config: None,
            items_redeemed: 2,
            items_settled: 0,
            total_revenue: 200,
            state: GumballState::SaleEnded,
            settings: GumballSettings {
                uri: String::new(),
                item_capacity: 3,
                items_per_seller: 3,
                sellers_merkle_root: Some([0; 32]),
                curator_fee_bps: 0,
                hide_sold_items: false,
                payment_mint: Pubkey::default(),
            },
        }
    }

    fn put(data: &mut [u8], position: usize, amount: u64) {
        data[position..position + 8].copy_from_slice(&amount.to_le_bytes());
    }

    #[test]
    fn pending_draws_allow_partial_payouts_and_refunds_top_up_without_order_bias() {
        for early in [0, 1] {
            let mut machine = machine();
            let mut data = vec![0; GumballMachine::get_size(3, 6)];
            put(
                &mut data,
                machine.get_refund_reserve_position().unwrap(),
                100,
            );
            put(
                &mut data,
                machine.get_outstanding_draws_position().unwrap(),
                1,
            );
            assert_eq!(
                record_item_proceeds(&mut machine, &mut data, early, 3).unwrap(),
                (33, 0, false)
            );
            assert_eq!(
                record_item_proceeds(&mut machine, &mut data, early, 3).unwrap(),
                (0, 33, false)
            );
            assert_eq!(machine.items_settled, 0);
            // Refund index 2: revenue and reserve decrease together, while the
            // denominator excludes its forfeited share.
            machine.total_revenue -= 100;
            machine.items_settled = 1;
            put(&mut data, machine.get_items_refunded_position().unwrap(), 1);
            put(&mut data, machine.get_refund_reserve_position().unwrap(), 0);
            put(
                &mut data,
                machine.get_outstanding_draws_position().unwrap(),
                0,
            );
            for index in [1 - early, early] {
                let previous = if index == early { 33 } else { 0 };
                assert_eq!(
                    record_item_proceeds(&mut machine, &mut data, index, 3).unwrap(),
                    (50 - previous, previous, true)
                );
                assert_eq!(
                    GumballMachine::read_amount(
                        &data,
                        machine.get_item_proceeds_position(index).unwrap()
                    )
                    .unwrap(),
                    50
                );
            }
            assert_eq!(machine.items_settled, 3);
            assert_eq!(machine.get_total_proceeds_settled(&data).unwrap(), 100);
        }
    }

    #[test]
    fn readded_slots_cannot_pay_historical_proceeds_again_or_spend_a_reserve() {
        let mut machine = machine();
        machine.total_revenue = 100;
        let mut data = vec![0; GumballMachine::get_size(3, 6)];
        assert_eq!(
            record_item_proceeds(&mut machine, &mut data, 0, 3).unwrap(),
            (33, 0, true)
        );
        // Re-add a fully settled slot, preserving historical total paid.
        let (byte, _, mask) =
            get_bit_byte_info(machine.get_settled_items_bit_mask_position().unwrap(), 0).unwrap();
        data[byte] &= !mask;
        put(&mut data, machine.get_item_proceeds_position(0).unwrap(), 0);
        machine.items_settled -= 1;
        machine.total_revenue += 100;
        put(
            &mut data,
            machine.get_refund_reserve_position().unwrap(),
            100,
        );
        put(
            &mut data,
            machine.get_outstanding_draws_position().unwrap(),
            1,
        );
        assert_eq!(
            record_item_proceeds(&mut machine, &mut data, 0, 3).unwrap(),
            (22, 0, false)
        );
        assert_eq!(
            record_item_proceeds(&mut machine, &mut data, 0, 3).unwrap(),
            (0, 22, false)
        );
        assert_eq!(machine.get_total_proceeds_settled(&data).unwrap(), 55);
        assert!(
            machine.total_revenue - machine.get_total_proceeds_settled(&data).unwrap()
                >= machine.get_refund_reserve(&data).unwrap()
        );
        // Refund the pending draw; the two remaining slots top up exactly.
        machine.total_revenue -= 100;
        machine.items_settled += 1;
        put(&mut data, machine.get_refund_reserve_position().unwrap(), 0);
        put(
            &mut data,
            machine.get_outstanding_draws_position().unwrap(),
            0,
        );
        assert_eq!(
            record_item_proceeds(&mut machine, &mut data, 0, 3).unwrap(),
            (11, 22, true)
        );
        assert_eq!(
            record_item_proceeds(&mut machine, &mut data, 1, 3).unwrap(),
            (34, 0, true)
        );
        assert_eq!(machine.get_total_proceeds_settled(&data).unwrap(), 100);
        assert_eq!(machine.get_unfinalized_proceeds(&data).unwrap(), 0);
    }

    #[test]
    fn batch_fee_topups_are_sums_of_each_items_cumulative_rounding() {
        let mut marketplace = 0;
        let mut curator = 0;
        for previous in [3, 5] {
            let first = incremental_proceeds_fees(0, previous, 3333, 3333).unwrap();
            let topup = incremental_proceeds_fees(previous, 10 - previous, 3333, 3333).unwrap();
            marketplace += first.0 + topup.0;
            curator += first.1 + topup.1;
        }
        assert_eq!((marketplace, curator), (6, 4));
        assert_eq!(
            incremental_proceeds_fees(10, 0, 3333, 3333).unwrap(),
            (0, 0)
        );
    }

    #[test]
    fn zero_price_draws_still_hold_finalization_and_dust_is_paid_once() {
        let mut machine = machine();
        machine.total_revenue = 101;
        let mut data = vec![0; GumballMachine::get_size(3, 6)];
        put(
            &mut data,
            machine.get_outstanding_draws_position().unwrap(),
            1,
        );
        assert_eq!(
            record_item_proceeds(&mut machine, &mut data, 0, 3).unwrap(),
            (33, 0, false)
        );
        put(
            &mut data,
            machine.get_outstanding_draws_position().unwrap(),
            0,
        );
        assert_eq!(
            record_item_proceeds(&mut machine, &mut data, 0, 3).unwrap(),
            (0, 33, true)
        );
        assert_eq!(
            record_item_proceeds(&mut machine, &mut data, 1, 3).unwrap(),
            (34, 0, true)
        );
        assert_eq!(
            record_item_proceeds(&mut machine, &mut data, 2, 3).unwrap(),
            (34, 0, true)
        );
        assert_eq!(machine.get_total_proceeds_settled(&data).unwrap(), 101);
        assert!(record_item_proceeds(&mut machine, &mut data, 2, 3).is_err());
    }
}

/// Unusable recipients never block an item's settlement. Entitlements remain
/// separate from buy-back credit and the draw/proceeds ledger.
pub fn transfer_or_park<'info>(
    machine: &GumballMachine,
    escrow: &mut AccountInfo<'info>,
    recipient: &mut AccountInfo<'info>,
    source_token: Option<&AccountInfo<'info>>,
    destination_token: Option<&AccountInfo<'info>>,
    mint: Option<&AccountInfo<'info>>,
    payer: Option<&AccountInfo<'info>>,
    ata_program: Option<&AccountInfo<'info>>,
    token_program: Option<&AccountInfo<'info>>,
    system_program: &AccountInfo<'info>,
    seeds: &[&[u8]],
    payer_seeds: Option<&[&[u8]]>,
    amount: u64,
    rent_refund: u64,
    payout_accounts: &[AccountInfo<'info>],
    creator_accounts: &[AccountInfo<'info>],
) -> Result<Option<(AccountInfo<'info>, AccountInfo<'info>)>> {
    let position = claim_position(
        &escrow.try_borrow_data()?,
        recipient.key,
        &machine.settings.payment_mint,
    )?;
    let parked = if let Some(position) = position {
        let data = escrow.try_borrow_data()?;
        u64::from_le_bytes(data[position + 64..position + 72].try_into().unwrap())
    } else {
        0
    };
    let combined = amount
        .checked_add(parked)
        .ok_or(GumballError::NumericalOverflowError)?;
    let payable = if let Some(mint) = mint {
        let destination = destination_token.ok_or(GumballError::MissingTokenAccount)?;
        let token_program = token_program.unwrap();
        let payable = utils::can_receive_token(
            destination,
            recipient.key,
            mint.key,
            token_program.key,
            true,
        )?;
        if !payable {
            utils::assert_keys_equal(
                destination.key(),
                anchor_spl::associated_token::get_associated_token_address_with_program_id(
                    recipient.key,
                    mint.key,
                    token_program.key,
                ),
                "Invalid payout ATA address",
            )?;
        }
        if payable {
            require!(destination.is_writable, GumballError::InvalidSettingUpdate);
        }
        payable
    } else {
        let eligible = can_receive_lamports(recipient);
        if eligible {
            require!(recipient.is_writable, GumballError::InvalidSettingUpdate);
        }
        eligible
            && recipient
                .lamports()
                .saturating_add(combined)
                .saturating_add(rent_refund)
                >= Rent::get()?.minimum_balance(recipient.data_len())
    };
    if payable {
        transfer_from_pda(
            escrow,
            recipient,
            source_token,
            destination_token,
            mint,
            payer,
            ata_program,
            token_program,
            system_program,
            seeds,
            payer_seeds,
            combined,
        )?;
        if let Some(position) = position {
            let data = escrow.try_borrow_data()?;
            let payer_key =
                Pubkey::new_from_array(data[position + 72..position + 104].try_into().unwrap());
            let deposit =
                u64::from_le_bytes(data[position + 104..position + 112].try_into().unwrap());
            drop(data);
            escrow.try_borrow_mut_data()?[position + 64..position + 72].fill(0);
            // Reuse supplied accounts; an absent payer can recover the zero-debt
            // deposit later, independently of the recipient or machine close.
            if let Some(rent_payer) = payer
                .into_iter()
                .chain(payout_accounts)
                .chain(creator_accounts)
                .find(|account| account.key == &payer_key && account.is_writable)
            {
                if mint.is_some() {
                    return Ok(Some((recipient.clone(), rent_payer.clone())));
                }
                crate::instructions::recover_payout_rent::finish_claim(
                    escrow, rent_payer, recipient, position, deposit,
                )?;
            }
        }
        Ok(None)
    } else {
        park_payout(
            escrow,
            recipient.key(),
            machine.settings.payment_mint,
            amount,
            payer.ok_or(GumballError::InvalidAuthority)?,
            system_program,
            payout_accounts,
            creator_accounts,
        )?;
        Ok(None)
    }
}

/// Finish a folded token claim after the caller's last currency CPI.
pub fn finish_folded_claim(
    machine: &GumballMachine,
    escrow: &AccountInfo,
    recipient: &AccountInfo,
    rent_payer: &AccountInfo,
) -> Result<()> {
    let data = escrow.try_borrow_data()?;
    let Some(position) = claim_position(&data, recipient.key, &machine.settings.payment_mint)?
    else {
        return Ok(());
    };
    require!(
        data[position + 64..position + 72] == [0; 8],
        GumballError::NotAllSettled
    );
    let deposit = u64::from_le_bytes(data[position + 104..position + 112].try_into().unwrap());
    drop(data);
    crate::instructions::recover_payout_rent::finish_claim(
        escrow, rent_payer, recipient, position, deposit,
    )
}
