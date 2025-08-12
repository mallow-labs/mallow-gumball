use crate::{
    errors::GumballGuardError,
    state::{GumballGuard, SEED},
    try_from,
};
use anchor_lang::prelude::*;
use mallow_gumball::{
    cpi::{accounts::SetMintAuthority, set_mint_authority},
    GumballMachine,
};
use mallow_jellybean_sdk::{accounts::JellybeanMachine, instructions::SetMintAuthorityCpiBuilder};
use utils::{assert_keys_equal, assert_owned_by};

pub fn wrap(ctx: Context<Wrap>) -> Result<()> {
    let gumball_guard = &ctx.accounts.gumball_guard;

    // PDA signer for the transaction
    let seeds = [SEED, &gumball_guard.base.to_bytes(), &[gumball_guard.bump]];
    let signer = [&seeds[..]];

    let machine_program = ctx.accounts.machine_program.to_account_info();
    let authority = ctx.accounts.machine_authority.to_account_info();

    let machine = &ctx.accounts.machine.to_account_info();
    assert_owned_by(machine, ctx.accounts.machine_program.key)?;

    // TODO: Make this less expensive
    if let Ok(gumball_machine) = try_from!(Account::<GumballMachine>, machine) {
        assert_keys_equal(
            ctx.accounts.machine_authority.key(),
            gumball_machine.authority,
            "Invalid machine authority",
        )?;

        // gumball machine set_mint_authority CPI
        set_mint_authority(CpiContext::new_with_signer(
            machine_program,
            SetMintAuthority {
                gumball_machine: machine.to_account_info(),
                authority,
                mint_authority: gumball_guard.to_account_info(),
            },
            &signer,
        ))?;
    } else if let Ok(jellybean_machine) = try_from!(Account::<JellybeanMachine>, machine) {
        assert_keys_equal(
            ctx.accounts.machine_authority.key(),
            jellybean_machine.authority,
            "Invalid machine authority",
        )?;

        SetMintAuthorityCpiBuilder::new(&machine_program)
            .jellybean_machine(machine)
            .authority(&authority)
            .mint_authority(&gumball_guard.to_account_info())
            .invoke_signed(&signer)?;
    } else {
        return err!(GumballGuardError::InvalidMachine);
    }

    Ok(())
}

#[derive(Accounts)]
pub struct Wrap<'info> {
    #[account(has_one = authority)]
    pub gumball_guard: Account<'info, GumballGuard>,
    // gumball guard authority
    pub authority: Signer<'info>,
    /// CHECK: account constraints checked in instruction
    #[account(mut)]
    pub machine: UncheckedAccount<'info>,
    /// CHECK: account constraints checked in account trait
    pub machine_program: AccountInfo<'info>,
    // gumball machine authority
    pub machine_authority: Signer<'info>,
}
