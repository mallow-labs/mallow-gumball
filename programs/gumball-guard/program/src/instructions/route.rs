use crate::{
    state::{GuardSet, GuardType, GumballGuard, GumballGuardData, DATA_OFFSET},
    try_from,
};
use anchor_lang::prelude::*;
use mallow_gumball::GumballMachine;
use mallow_jellybean_sdk::accounts::JellybeanMachine;

/// Route the transaction to the specified guard. This instruction allows the use of
/// empty gumball guard and gumball machine accounts and it is up to individual guard
/// instructions to validate whether the instruction can be executed or not.
pub fn route<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, Route<'info>>,
    args: RouteArgs,
    label: Option<String>,
) -> Result<()> {
    // checks if the gumball guard account is not empty
    let gumball_guard_account = if ctx.accounts.gumball_guard.data_is_empty() {
        None
    } else {
        let account = try_from!(Account::<GumballGuard>, ctx.accounts.gumball_guard)?;
        Some(account)
    };

    // checks if the gumball machine account is not empty

    let machine = &ctx.accounts.machine;
    let machine_mint_authority = if machine.to_account_info().data_is_empty() {
        None
    } else {
        // TODO: Make this less expensive
        if let Ok(machine) = try_from!(Account::<GumballMachine>, machine) {
            Some(machine.mint_authority)
        } else if let Ok(machine) = try_from!(Account::<JellybeanMachine>, machine) {
            Some(machine.mint_authority)
        } else {
            None
        }
    };

    // retrieve the active guard set

    let guard_set = if let Some(account) = &gumball_guard_account {
        let account_info = account.to_account_info();
        let data = account_info.data.borrow();
        // loads the active guard set
        let guard_set = GumballGuardData::active_set(&data[DATA_OFFSET..], label)?;

        Some(guard_set)
    } else {
        None
    };

    let route_context = RouteContext {
        gumball_guard: gumball_guard_account,
        machine_mint_authority: machine_mint_authority,
        guard_set,
    };

    GuardSet::route(ctx, route_context, args)
}

/// Withdraw the rent SOL from the gumball guard account.
#[derive(Accounts)]
#[instruction(args: RouteArgs)]
pub struct Route<'info> {
    /// CHECK: account constraints checked in instruction
    pub gumball_guard: UncheckedAccount<'info>,
    /// CHECK: account constraints checked in instruction
    #[account(mut)]
    pub machine: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
}

/// Arguments for a route transaction.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct RouteArgs {
    /// The target guard type.
    pub guard: GuardType,
    /// Arguments for the guard instruction.
    pub data: Vec<u8>,
}

/// Struct to hold references to gumball guard and gumball machine
/// accounts, if present.
pub struct RouteContext<'info> {
    /// The gumball guard account.
    pub gumball_guard: Option<Account<'info, GumballGuard>>,
    /// The machine mint authority key.
    pub machine_mint_authority: Option<Pubkey>,
    // The active guard set.
    pub guard_set: Option<Box<GuardSet>>,
}
