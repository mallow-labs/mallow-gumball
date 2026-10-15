use crate::{
    constants::{CONFIG_LINE_SIZE, GUMBALL_MACHINE_SIZE},
    get_bit_byte_info, GumballError, GumballMachine,
};
use anchor_lang::prelude::*;

pub fn is_item_claimed(gumball_machine: &Box<Account<GumballMachine>>, index: u32) -> Result<bool> {
    let account_info = gumball_machine.to_account_info();
    let data = account_info.data.borrow();

    // bit-mask
    let bit_mask_start = gumball_machine.get_claimed_items_bit_mask_position();
    let (byte_position, bit, mask) = get_bit_byte_info(bit_mask_start, index as usize)?;
    let current_value = data[byte_position];
    let is_claimed = current_value & mask == mask;

    msg!(
        "Item checked: byte position={}, mask={}, current value={}, is claimed={}, bit position={}",
        byte_position - bit_mask_start,
        mask,
        current_value,
        is_claimed,
        bit
    );

    drop(data);

    Ok(is_claimed)
}

pub fn claim_item(gumball_machine: &mut Box<Account<GumballMachine>>, index: u32) -> Result<u64> {
    let account_info = gumball_machine.to_account_info();
    let mut data = account_info.data.borrow_mut();

    // bit-mask
    let bit_mask_start = gumball_machine.get_claimed_items_bit_mask_position();
    let (byte_position, bit, mask) = get_bit_byte_info(bit_mask_start, index as usize)?;
    let current_value = data[byte_position];
    let is_claimed = current_value & mask == mask;
    require!(!is_claimed, GumballError::ItemAlreadyClaimed);

    data[byte_position] |= mask;

    msg!(
        "Item processed: byte position={}, mask={}, current value={}, new value={}, bit position={}",
        byte_position - bit_mask_start,
        mask,
        current_value,
        data[byte_position],
        bit
    );

    let item_amount = if gumball_machine.version >= 2 {
        let config_line_size = gumball_machine.get_config_line_size();
        let config_line_position = GUMBALL_MACHINE_SIZE + 4 + (index as usize) * config_line_size;
        u64::from_le_bytes(
            data[config_line_position + CONFIG_LINE_SIZE
                ..config_line_position + CONFIG_LINE_SIZE + 8]
                .try_into()
                .unwrap(),
        )
    } else {
        1
    };

    if gumball_machine.version >= 6 {
        let standard_position =
            GUMBALL_MACHINE_SIZE + 4 + index as usize * gumball_machine.get_config_line_size() + 96;
        if data[standard_position] == crate::TokenStandard::Compressed as u8 {
            let buyer_position = standard_position - 32;
            if data[buyer_position..buyer_position + 32] != Pubkey::default().to_bytes() {
                let outstanding_position = gumball_machine.get_outstanding_draws_position()?;
                let outstanding = gumball_machine.get_outstanding_draws(&data)?;
                data[outstanding_position..outstanding_position + 8].copy_from_slice(
                    &outstanding
                        .checked_sub(1)
                        .ok_or(GumballError::NumericalOverflowError)?
                        .to_le_bytes(),
                );
            }
            let reserve = gumball_machine.get_refund_reserve(&data)?;
            let payment = gumball_machine.get_draw_payment(&data, index)?;
            let position = gumball_machine.get_refund_reserve_position()?;
            data[position..position + 8].copy_from_slice(
                &reserve
                    .checked_sub(payment)
                    .ok_or(GumballError::NumericalOverflowError)?
                    .to_le_bytes(),
            );
        }
    }
    drop(data);

    Ok(item_amount)
}
