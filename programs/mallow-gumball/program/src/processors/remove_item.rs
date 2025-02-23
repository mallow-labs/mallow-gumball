use crate::{
    constants::{CONFIG_LINE_SIZE, GUMBALL_MACHINE_SIZE},
    get_config_count, GumballError, GumballMachine,
};
use anchor_lang::prelude::*;

pub fn remove_item(
    gumball_machine: &mut Account<GumballMachine>,
    authority: Pubkey,
    mint: Pubkey,
    expected_seller: Pubkey,
    index: u32,
    amount: u64,
) -> Result<()> {
    let account_info = gumball_machine.to_account_info();
    // mutable reference to the account data (config lines are written in the
    // 'hidden' section of the data array)
    let mut data = account_info.data.borrow_mut();

    // holds the total number of config lines
    let mut count = get_config_count(&data)?;

    if index >= count as u32 {
        return err!(GumballError::IndexGreaterThanLength);
    }

    let last_index = count - 1;
    let config_line_size = gumball_machine.get_config_line_size();
    let config_line_position = GUMBALL_MACHINE_SIZE + 4 + (index as usize) * config_line_size;
    let last_config_line_position = GUMBALL_MACHINE_SIZE + 4 + (last_index) * config_line_size;

    let seller =
        Pubkey::try_from(&data[config_line_position + 32..config_line_position + 64]).unwrap();
    // Only the gumball machine authority or the seller can remove a config line
    require!(
        authority == gumball_machine.authority || seller == authority,
        GumballError::InvalidAuthority
    );
    require!(expected_seller == seller, GumballError::InvalidSeller);

    let item_mint =
        Pubkey::try_from(&data[config_line_position..config_line_position + 32]).unwrap();
    require!(mint == item_mint, GumballError::InvalidMint);

    if gumball_machine.version >= 2 {
        // Make sure the amount is correct
        let item_amount = u64::from_le_bytes(
            data[config_line_position + CONFIG_LINE_SIZE
                ..config_line_position + CONFIG_LINE_SIZE + 8]
                .try_into()
                .unwrap(),
        );
        require!(item_amount == amount, GumballError::InvalidAmount);
    }

    // if it's the last line we'll just zero out the config slice
    if index == count as u32 - 1 {
        data[config_line_position..config_line_position + config_line_size]
            .iter_mut()
            .for_each(|x| *x = 0);
    } else {
        // if it's not the last line we'll move the last line to the current position
        let last_config_slice: Vec<u8> =
            data[last_config_line_position..last_config_line_position + config_line_size].to_vec();
        data[config_line_position..config_line_position + config_line_size]
            .copy_from_slice(&last_config_slice);
        // zero out the last line
        data[last_config_line_position..last_config_line_position + config_line_size]
            .iter_mut()
            .for_each(|x| *x = 0);
    }

    // (unordered) indices for the mint
    let indices_start = gumball_machine.get_mint_indices_position()?;

    // remove the last index from the mint indices vec
    let index_position = indices_start + last_index * 4;
    data[index_position..index_position + 4].copy_from_slice(&u32::MIN.to_le_bytes());

    count = count
        .checked_sub(1)
        .ok_or(GumballError::NumericalOverflowError)?;

    msg!("Item removed: position={}, new count={})", index, count,);

    // updates the config lines count
    data[GUMBALL_MACHINE_SIZE..GUMBALL_MACHINE_SIZE + 4]
        .copy_from_slice(&(count as u32).to_le_bytes());

    Ok(())
}

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

    // Process each removal in reverse order to handle last line movements correctly
    for &index in indices.iter() {
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

        // Find the last non-removed config line
        let mut last_valid_index = count - 1;
        while sorted_indices.binary_search(&(last_valid_index)).is_ok()
            && last_valid_index > index as u32
        {
            last_valid_index -= 1;
        }

        // Ensure last_valid_index conversion to usize is safe
        let last_valid_usize = last_valid_index as usize;
        require!(
            last_valid_usize <= usize::MAX / config_line_size, // Prevent multiplication overflow
            GumballError::NumericalOverflowError
        );

        let last_config_line_position =
            GUMBALL_MACHINE_SIZE + 4 + last_valid_usize * config_line_size;

        // Move data only if we're not removing the last valid line
        if index as u32 != last_valid_index {
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
