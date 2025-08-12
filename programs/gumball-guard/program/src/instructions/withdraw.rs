use super::Token;
use crate::{
    errors::GumballGuardError,
    state::{GumballGuard, SEED},
    try_from,
};
use anchor_lang::prelude::*;
use mallow_gumball::{
    cpi::{accounts::CloseGumballMachine, withdraw as withdraw_cpi},
    GumballMachine,
};
use mallow_jellybean_sdk::{accounts::JellybeanMachine, instructions::WithdrawCpiBuilder};

/// Withdraw the rent SOL from the gumball guard account, ensuring that Gumball Machine can also be closed.
#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, close = authority, has_one = authority)]
    pub gumball_guard: Account<'info, GumballGuard>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Checked in gumball machine ix
    #[account(mut)]
    pub machine: UncheckedAccount<'info>,
    /// CHECK: Checked in gumball machine ix
    #[account(mut)]
    pub authority_pda: UncheckedAccount<'info>,
    /// Payment account for authority pda if using token payment
    /// CHECK: Checked in gumball machine ix
    #[account(mut)]
    pub authority_pda_payment_account: Option<UncheckedAccount<'info>>,

    /// CHECK: account constraints checked in account trait
    pub machine_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn withdraw<'info>(ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>) -> Result<()> {
    let gumball_guard = &ctx.accounts.gumball_guard;
    let machine_program = ctx.accounts.machine_program.to_account_info();
    let machine = &ctx.accounts.machine.to_account_info();
    let authority = ctx.accounts.authority.to_account_info();

    // PDA signer for the transaction
    let seeds = [SEED, &gumball_guard.base.to_bytes(), &[gumball_guard.bump]];
    let signer = [&seeds[..]];

    // TODO: Make this less expensive
    if let Ok(_) = try_from!(Account::<GumballMachine>, machine) {
        withdraw_cpi(
            CpiContext::new_with_signer(
                machine_program,
                CloseGumballMachine {
                    gumball_machine: machine.to_account_info(),
                    authority,
                    mint_authority: gumball_guard.to_account_info(),
                    authority_pda: ctx.accounts.authority_pda.to_account_info(),
                    authority_pda_payment_account: if let Some(authority_pda_payment_account) =
                        &ctx.accounts.authority_pda_payment_account
                    {
                        Some(authority_pda_payment_account.to_account_info())
                    } else {
                        None
                    },
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
                &signer,
            )
            .with_remaining_accounts(ctx.remaining_accounts.to_vec()),
        )?;
    } else if let Ok(_) = try_from!(Account::<JellybeanMachine>, machine) {
        WithdrawCpiBuilder::new(&machine_program)
            .jellybean_machine(machine)
            .authority(&authority)
            .mint_authority(&gumball_guard.to_account_info())
            .invoke_signed(&signer)?;
    } else {
        return err!(GumballGuardError::InvalidMachine);
    }

    Ok(())
}
