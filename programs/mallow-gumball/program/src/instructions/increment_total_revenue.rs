use crate::{GumballError, GumballMachine, GumballState};
use anchor_lang::prelude::*;

/// Increments total revenue. This is required as token transfers occur in guard.
#[derive(Accounts)]
pub struct IncrementTotalRevenue<'info> {
    /// Gumball machine account.
    #[account(
        mut,
        has_one = mint_authority,
        constraint = gumball_machine.state == GumballState::SaleLive @ GumballError::InvalidState
    )]
    gumball_machine: Box<Account<'info, GumballMachine>>,

    /// Gumball machine mint authority (mint only allowed for the mint_authority).
    mint_authority: Signer<'info>,
}

pub fn increment_total_revenue<'info>(
    ctx: Context<'info, IncrementTotalRevenue<'info>>,
    revenue: u64,
) -> Result<()> {
    crate::assert_refund_mint_authority(
        &ctx.accounts.gumball_machine,
        &ctx.accounts.mint_authority.to_account_info(),
    )?;
    ctx.accounts.gumball_machine.total_revenue = ctx
        .accounts
        .gumball_machine
        .total_revenue
        .checked_add(revenue)
        .ok_or(GumballError::NumericalOverflowError)?;

    let machine = &ctx.accounts.gumball_machine;
    if machine.version >= 6 {
        let info = machine.to_account_info();
        let mut data = info.try_borrow_mut_data()?;
        let position = machine.get_pending_draw_payment_position()?;
        let pending = GumballMachine::read_amount(&data, position)?;
        data[position..position + 8].copy_from_slice(
            &pending
                .checked_add(revenue)
                .ok_or(GumballError::NumericalOverflowError)?
                .to_le_bytes(),
        );
    }
    Ok(())
}
