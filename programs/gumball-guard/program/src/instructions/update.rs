use crate::{
    errors::GumballGuardError,
    state::{GumballGuard, GumballGuardData, DATA_OFFSET, SEED},
    try_from,
};
use anchor_lang::prelude::*;
use mallow_gumball::{GumballMachine, GumballState};
use mallow_jellybean_sdk::{accounts::JellybeanMachine, types::JellybeanState};
use solana_program::{
    entrypoint::MAX_PERMITTED_DATA_INCREASE, program::invoke, system_instruction,
};
use utils::assert_keys_equal;

pub fn update(ctx: Context<Update>, data: Vec<u8>) -> Result<()> {
    let machine = &ctx.accounts.machine.to_account_info();

    // TODO: Make this less expensive
    if let Ok(machine) = try_from!(Account::<GumballMachine>, machine) {
        assert_keys_equal(
            ctx.accounts.gumball_guard.key(),
            machine.mint_authority,
            "Invalid machine mint authority",
        )?;
        require!(
            machine.state == GumballState::None || machine.items_redeemed == 0,
            GumballGuardError::InvalidMachineState
        );
    } else if let Ok(machine) = try_from!(Account::<JellybeanMachine>, machine) {
        assert_keys_equal(
            ctx.accounts.gumball_guard.key(),
            machine.mint_authority,
            "Invalid machine mint authority",
        )?;
        require!(
            machine.state != JellybeanState::SaleEnded,
            GumballGuardError::InvalidMachineState
        );
    } else {
        return err!(GumballGuardError::InvalidMachine);
    }

    // deserializes the gumball guard data
    let data = GumballGuardData::load(&data)?;
    // validates guard settings
    data.verify()?;

    let account_info = ctx.accounts.gumball_guard.to_account_info();

    // check whether we need to grow or shrink the account size or not
    if data.account_size() != account_info.data_len() {
        // no risk of overflow here since the sizes will range from DATA_OFFSET to 10_000_000
        let difference = data.account_size() as i64 - account_info.data_len() as i64;
        let snapshot = account_info.lamports();

        if difference > 0 {
            if difference as usize > MAX_PERMITTED_DATA_INCREASE {
                return err!(GumballGuardError::DataIncrementLimitExceeded);
            }

            let lamports_diff = Rent::get()?
                .minimum_balance(data.account_size())
                .checked_sub(snapshot)
                .ok_or(GumballGuardError::NumericalOverflowError)?;

            msg!("Funding {} lamports for account realloc", lamports_diff);

            invoke(
                &system_instruction::transfer(
                    ctx.accounts.payer.key,
                    account_info.key,
                    lamports_diff,
                ),
                &[
                    ctx.accounts.payer.to_account_info(),
                    account_info.clone(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        } else {
            let lamports_diff = snapshot
                .checked_sub(Rent::get()?.minimum_balance(data.account_size()))
                .ok_or(GumballGuardError::NumericalOverflowError)?;

            msg!(
                "Withdrawing {} lamports from account realloc",
                lamports_diff
            );

            **account_info.lamports.borrow_mut() = snapshot - lamports_diff;
            let payer = &ctx.accounts.payer;

            **payer.lamports.borrow_mut() = payer
                .lamports()
                .checked_add(lamports_diff)
                .ok_or(GumballGuardError::NumericalOverflowError)?;
        }

        msg!("Account realloc by {} bytes", difference);
        // changes the account size to fit the size required by the guards
        // this means that the size can grow or shrink
        account_info.realloc(data.account_size(), false)?;
    }

    // save the guards information to the account data and stores
    // the updated feature flag
    let mut account_data = account_info.data.borrow_mut();
    data.save(&mut account_data[DATA_OFFSET..])?;

    Ok(())
}

#[derive(Accounts)]
#[instruction(data: Vec<u8>)]
pub struct Update<'info> {
    #[account(
        mut,
        has_one = authority,
        seeds = [SEED, gumball_guard.base.key().as_ref()],
        bump = gumball_guard.bump
    )]
    pub gumball_guard: Account<'info, GumballGuard>,
    /// Machine account.
    /// CHECK: account constraints checked in instruction
    #[account(mut)]
    pub machine: UncheckedAccount<'info>,
    pub authority: Signer<'info>,
    // Payer for the account resizing.
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
