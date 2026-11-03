use crate::{
    constants::{CONFIG_LINE_SIZE, GUMBALL_MACHINE_SIZE},
    get_bit_byte_info, get_config_count, GumballError, GumballMachine,
};
use anchor_lang::prelude::*;

fn assert_removable_item(machine: &GumballMachine, data: &[u8], index: u32) -> Result<()> {
    let position = GUMBALL_MACHINE_SIZE + 4 + index as usize * machine.get_config_line_size();
    require!(
        data[position + 64..position + 96] == Pubkey::default().to_bytes(),
        GumballError::InvalidState
    );
    for start in [
        machine.get_claimed_items_bit_mask_position(),
        machine.get_settled_items_bit_mask_position()?,
    ] {
        let (byte, _, mask) = get_bit_byte_info(start, index as usize)?;
        require!(data[byte] & mask == 0, GumballError::InvalidState);
    }
    if machine.version >= 6 {
        require!(
            machine.get_draw_payment(data, index)? == 0,
            GumballError::InvalidState
        );
    }
    Ok(())
}

/// DEPRECATED: Use remove_multiple_items_span instead
pub fn remove_multiple_items(
    gumball_machine: &mut Account<GumballMachine>,
    authority: Pubkey,
    mint: Pubkey,
    expected_seller: Pubkey,
    indices: &[u8],
    amount: u64,
) -> Result<()> {
    require!(!indices.is_empty(), GumballError::InvalidInputLength);

    let account_info = gumball_machine.to_account_info();
    let mut data = account_info.data.borrow_mut();
    let mut count = get_config_count(&data)? as u32;
    let config_line_size = gumball_machine.get_config_line_size();

    // Validate all indices are within bounds and unique
    let mut sorted_indices: Vec<u32> = indices.iter().map(|&x| x as u32).collect();
    sorted_indices.sort_unstable();
    for i in 1..sorted_indices.len() {
        require!(
            sorted_indices[i] != sorted_indices[i - 1],
            GumballError::DuplicateIndex
        );
    }
    require!(
        sorted_indices.last().unwrap() < &(count),
        GumballError::IndexGreaterThanLength
    );

    for &index in &sorted_indices {
        assert_removable_item(gumball_machine, &data, index)?;
    }

    // Swap-remove from the highest index down. Every larger index is already gone,
    // so line count - 1 is either this line or one that is being kept, and the lines
    // still to be removed have not moved.
    for &index in sorted_indices.iter().rev() {
        // Ensure index conversion to usize is safe
        let index_usize = index as usize;
        require!(
            index_usize <= usize::MAX / config_line_size, // Prevent multiplication overflow
            GumballError::NumericalOverflowError
        );

        let config_line_position = GUMBALL_MACHINE_SIZE + 4 + index_usize * config_line_size;

        // Verify seller and authority
        let seller =
            Pubkey::try_from(&data[config_line_position + 32..config_line_position + 64]).unwrap();
        require!(
            authority == gumball_machine.authority || seller == authority,
            GumballError::InvalidAuthority
        );
        require!(expected_seller == seller, GumballError::InvalidSeller);

        // Verify mint
        let item_mint =
            Pubkey::try_from(&data[config_line_position..config_line_position + 32]).unwrap();
        require!(mint == item_mint, GumballError::InvalidMint);

        // Verify amount for version 2+
        if gumball_machine.version >= 2 {
            let item_amount = u64::from_le_bytes(
                data[config_line_position + CONFIG_LINE_SIZE
                    ..config_line_position + CONFIG_LINE_SIZE + 8]
                    .try_into()
                    .unwrap(),
            );
            require!(amount == item_amount, GumballError::InvalidAmount);
        }

        let last_valid_index = count - 1;

        // Ensure last_valid_index conversion to usize is safe
        let last_valid_usize = last_valid_index as usize;
        require!(
            last_valid_usize <= usize::MAX / config_line_size, // Prevent multiplication overflow
            GumballError::NumericalOverflowError
        );

        let last_config_line_position =
            GUMBALL_MACHINE_SIZE + 4 + last_valid_usize * config_line_size;

        // Move data only if we're not removing the last valid line
        if index != last_valid_index {
            let last_config_slice: Vec<u8> = data
                [last_config_line_position..last_config_line_position + config_line_size]
                .to_vec();
            data[config_line_position..config_line_position + config_line_size]
                .copy_from_slice(&last_config_slice);
        }

        // Zero out the last line
        data[last_config_line_position..last_config_line_position + config_line_size]
            .iter_mut()
            .for_each(|x| *x = 0);

        // Update mint indices
        let indices_start = gumball_machine.get_mint_indices_position()?;
        let index_position = indices_start + (last_valid_index as usize) * 4;
        data[index_position..index_position + 4].copy_from_slice(&u32::MIN.to_le_bytes());

        count = count
            .checked_sub(1)
            .ok_or(GumballError::NumericalOverflowError)?;
    }

    msg!("Items removed: new count={}", count);

    // Update final count
    data[GUMBALL_MACHINE_SIZE..GUMBALL_MACHINE_SIZE + 4]
        .copy_from_slice(&(count as u32).to_le_bytes());

    Ok(())
}

pub fn remove_multiple_items_span(
    gumball_machine: &mut Account<GumballMachine>,
    authority: Pubkey,
    mint: Pubkey,
    expected_seller: Pubkey,
    amount: u64,
    start_index: u32,
    end_index: u32,
) -> Result<()> {
    require!(start_index <= end_index, GumballError::InvalidInputLength);

    let account_info = gumball_machine.to_account_info();
    let mut data = account_info.data.borrow_mut();
    let mut count = get_config_count(&data)? as u32;
    let config_line_size = gumball_machine.get_config_line_size();

    // Validate indices are within bounds
    require!(end_index < count, GumballError::IndexGreaterThanLength);

    // Calculate how many items we're removing
    let items_to_remove = end_index - start_index + 1;
    require!(
        items_to_remove <= count,
        GumballError::NumericalOverflowError
    );

    // First, verify all items in the span
    for index in start_index..=end_index {
        assert_removable_item(gumball_machine, &data, index)?;
        let index_usize = index as usize;
        require!(
            index_usize <= usize::MAX / config_line_size, // Prevent multiplication overflow
            GumballError::NumericalOverflowError
        );

        let config_line_position = GUMBALL_MACHINE_SIZE + 4 + index_usize * config_line_size;

        // Verify seller and authority
        let seller =
            Pubkey::try_from(&data[config_line_position + 32..config_line_position + 64]).unwrap();
        require!(
            authority == gumball_machine.authority || seller == authority,
            GumballError::InvalidAuthority
        );
        require!(expected_seller == seller, GumballError::InvalidSeller);

        // Verify mint
        let item_mint =
            Pubkey::try_from(&data[config_line_position..config_line_position + 32]).unwrap();
        require!(mint == item_mint, GumballError::InvalidMint);

        // Verify amount for version 2+
        if gumball_machine.version >= 2 {
            let item_amount = u64::from_le_bytes(
                data[config_line_position + CONFIG_LINE_SIZE
                    ..config_line_position + CONFIG_LINE_SIZE + 8]
                    .try_into()
                    .unwrap(),
            );
            require!(amount == item_amount, GumballError::InvalidAmount);
        }
    }

    // After verification, perform the actual removal
    if end_index < count - 1 {
        // Only move data if we're not removing the last items in the list
        let items_after_removal = count
            .checked_sub(end_index + 1)
            .ok_or(GumballError::NumericalOverflowError)?;

        if items_after_removal > 0 {
            let source_start =
                GUMBALL_MACHINE_SIZE + 4 + ((end_index + 1) as usize) * config_line_size;
            let dest_start = GUMBALL_MACHINE_SIZE + 4 + (start_index as usize) * config_line_size;
            let copy_size = items_after_removal as usize * config_line_size;

            data.copy_within(source_start..source_start + copy_size, dest_start);
        }
    }

    // Zero out the vacated space at the end
    let zero_start =
        GUMBALL_MACHINE_SIZE + 4 + ((count - items_to_remove) as usize) * config_line_size;
    let zero_size = items_to_remove as usize * config_line_size;
    data[zero_start..zero_start + zero_size]
        .iter_mut()
        .for_each(|x| *x = 0);

    // Zero out the mint indices at the end
    let indices_start = gumball_machine.get_mint_indices_position()?;
    let zero_start = indices_start + ((count - items_to_remove) as usize) * 4;
    let zero_size = items_to_remove as usize * 4;
    data[zero_start..zero_start + zero_size]
        .iter_mut()
        .for_each(|x| *x = 0);

    // Update the count
    count = count
        .checked_sub(items_to_remove)
        .ok_or(GumballError::NumericalOverflowError)?;

    msg!(
        "Items removed: span from {} to {}, new count={}",
        start_index,
        end_index,
        count
    );

    // Update final count
    data[GUMBALL_MACHINE_SIZE..GUMBALL_MACHINE_SIZE + 4]
        .copy_from_slice(&(count as u32).to_le_bytes());

    drop(data);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GumballSettings, GumballState, TokenStandard};

    const AMOUNT: u64 = 10;

    fn key(byte: u8) -> Pubkey {
        Pubkey::new_from_array([byte; 32])
    }

    /// Run `remove_multiple_items` as `remover` on a v`version` machine holding
    /// `lines` of (mint, seller), and return the live lines and the removal result.
    fn remove_lines(
        version: u8,
        lines: &[(u8, u8)],
        remover: u8,
        mint: u8,
        indices: &[u8],
    ) -> (Vec<(u8, u8)>, Vec<u8>, Result<()>) {
        let capacity = lines.len() as u64;
        let machine = GumballMachine {
            version,
            authority: key(250),
            mint_authority: key(250),
            marketplace_fee_config: None,
            items_redeemed: 0,
            items_settled: 0,
            total_revenue: 0,
            state: GumballState::None,
            settings: GumballSettings {
                uri: String::new(),
                item_capacity: capacity,
                items_per_seller: 0,
                sellers_merkle_root: None,
                curator_fee_bps: 0,
                hide_sold_items: false,
                payment_mint: Pubkey::default(),
            },
        };
        let line_size = machine.get_config_line_size();
        let mut data = vec![0; GumballMachine::get_size(capacity, version)];
        machine.try_serialize(&mut data.as_mut_slice()).unwrap();
        data[GUMBALL_MACHINE_SIZE..GUMBALL_MACHINE_SIZE + 4]
            .copy_from_slice(&(lines.len() as u32).to_le_bytes());
        let table = GUMBALL_MACHINE_SIZE + 4;
        for (i, (line_mint, line_seller)) in lines.iter().enumerate() {
            let at = table + i * line_size;
            data[at..at + 32].copy_from_slice(key(*line_mint).as_ref());
            data[at + 32..at + 64].copy_from_slice(key(*line_seller).as_ref());
            data[at + 96] = TokenStandard::Fungible as u8;
            data[at + CONFIG_LINE_SIZE..at + CONFIG_LINE_SIZE + 8]
                .copy_from_slice(&AMOUNT.to_le_bytes());
        }

        let account_key = key(251);
        let owner = crate::ID;
        let mut lamports = 1;
        let info = AccountInfo::new(
            &account_key,
            false,
            true,
            &mut lamports,
            &mut data,
            &owner,
            false,
        );
        let mut account = Account::<GumballMachine>::try_from(&info).unwrap();
        let result = remove_multiple_items(
            &mut account,
            key(remover),
            key(mint),
            key(remover),
            indices,
            AMOUNT,
        );

        let data = info.data.borrow();
        let count = get_config_count(&data).unwrap();
        let read = |i: usize| {
            let at = table + i * line_size;
            (data[at], data[at + 32])
        };
        let live = (0..count).map(read).collect();
        let dead = (count..lines.len())
            .flat_map(|i| data[table + i * line_size..table + (i + 1) * line_size].to_vec())
            .collect();
        (live, dead, result)
    }

    fn permutations(items: &[u8]) -> Vec<Vec<u8>> {
        if items.is_empty() {
            return vec![vec![]];
        }
        let mut all = vec![];
        for (i, item) in items.iter().enumerate() {
            let mut rest = items.to_vec();
            rest.remove(i);
            for mut tail in permutations(&rest) {
                tail.insert(0, *item);
                all.push(tail);
            }
        }
        all
    }

    #[test]
    fn removing_lines_in_any_order_keeps_every_other_line_live_exactly_once() {
        const REMOVER: u8 = 1;
        const SIZE: usize = 5;
        for version in [2, 6] {
            for remover_lines in 1u8..1 << SIZE {
                // Every other line belongs to another seller, under its own mint.
                let lines: Vec<(u8, u8)> = (0..SIZE as u8)
                    .map(|i| {
                        if remover_lines & (1 << i) != 0 {
                            (REMOVER, REMOVER)
                        } else {
                            (100 + i, 2)
                        }
                    })
                    .collect();
                for removed in 1u8..1 << SIZE {
                    if removed & !remover_lines != 0 {
                        continue;
                    }
                    let indices: Vec<u8> = (0..SIZE as u8)
                        .filter(|i| removed & (1 << i) != 0)
                        .collect();
                    let mut expected: Vec<(u8, u8)> = (0..SIZE as u8)
                        .filter(|i| removed & (1 << i) == 0)
                        .map(|i| lines[i as usize])
                        .collect();
                    expected.sort_unstable();
                    for order in permutations(&indices) {
                        let (mut live, dead, result) =
                            remove_lines(version, &lines, REMOVER, REMOVER, &order);
                        assert!(result.is_ok(), "{lines:?} removing {order:?}: {result:?}");
                        live.sort_unstable();
                        assert_eq!(live, expected, "{lines:?} removing {order:?}");
                        assert!(
                            dead.iter().all(|byte| *byte == 0),
                            "{lines:?} removing {order:?} left data past the count"
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn removing_lines_still_refuses_another_sellers_line_in_any_order() {
        let lines = [(1, 1), (1, 1), (100, 2)];
        for order in [[0u8, 2], [2, 0], [1, 2], [2, 1]] {
            let (_, _, result) = remove_lines(6, &lines, 1, 1, &order);
            assert!(result.is_err(), "removing {order:?} succeeded");
        }
    }

    #[test]
    fn removal_preserves_processed_items_on_every_version_and_standard() {
        for version in 0..=6 {
            let machine = GumballMachine {
                version,
                authority: Pubkey::default(),
                mint_authority: Pubkey::default(),
                marketplace_fee_config: None,
                items_redeemed: 0,
                items_settled: 0,
                total_revenue: 0,
                state: GumballState::None,
                settings: GumballSettings {
                    uri: String::new(),
                    item_capacity: 1,
                    items_per_seller: 1,
                    sellers_merkle_root: None,
                    curator_fee_bps: 0,
                    hide_sold_items: false,
                    payment_mint: Pubkey::default(),
                },
            };
            for standard in [
                TokenStandard::NonFungible,
                TokenStandard::ProgrammableNonFungible,
                TokenStandard::Core,
                TokenStandard::Fungible,
                TokenStandard::Compressed,
            ] {
                let mut data = vec![0; GumballMachine::get_size(1, version)];
                data[GUMBALL_MACHINE_SIZE + 4 + 96] = standard as u8;
                assert!(assert_removable_item(&machine, &data, 0).is_ok());
                let mut buyer = data.clone();
                buyer[GUMBALL_MACHINE_SIZE + 4 + 64] = 1;
                assert!(assert_removable_item(&machine, &buyer, 0).is_err());
                for start in [
                    machine.get_claimed_items_bit_mask_position(),
                    machine.get_settled_items_bit_mask_position().unwrap(),
                ] {
                    let mut processed = data.clone();
                    let (byte, _, mask) = get_bit_byte_info(start, 0).unwrap();
                    processed[byte] |= mask;
                    assert!(assert_removable_item(&machine, &processed, 0).is_err());
                }
                if version >= 6 {
                    data[machine.get_draw_payment_position(0).unwrap()] = 1;
                    assert!(assert_removable_item(&machine, &data, 0).is_err());
                }
            }
        }
    }
}
