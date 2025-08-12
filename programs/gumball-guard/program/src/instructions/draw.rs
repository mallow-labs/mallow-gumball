use std::collections::BTreeMap;

use anchor_lang::{prelude::*, solana_program::sysvar};
use mallow_gumball::GumballMachine;

use crate::{
    guards::{EvaluationContext, MachineType},
    processors::process_draw,
    state::{GumballGuard, SEED},
};

use super::{DrawAccounts, Token};

pub fn draw<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, Draw<'info>>,
    mint_args: Vec<u8>,
    label: Option<String>,
) -> Result<()> {
    let accounts = DrawAccounts {
        gumball_guard: &ctx.accounts.gumball_guard,
        machine: ctx.accounts.gumball_machine.to_account_info(),
        _machine_program: ctx.accounts.gumball_machine_program.to_account_info(),
        payer: ctx.accounts.payer.to_account_info(),
        buyer: ctx.accounts.buyer.to_account_info(),
        recent_slothashes: ctx.accounts.recent_slothashes.to_account_info(),
        spl_token_program: ctx.accounts.spl_token_program.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        sysvar_instructions: ctx.accounts.sysvar_instructions.to_account_info(),
        token_metadata_program: Some(ctx.accounts.token_metadata_program.to_account_info()),
        remaining: ctx.remaining_accounts,
        event_authority: ctx.accounts.gumball_event_authority.to_account_info(),
        authority_pda: None,
        unclaimed_prizes: None,
        print_fee_account: None,
        rent: None,
    };

    // evaluation context for this transaction
    let mut ctx = EvaluationContext {
        accounts,
        account_cursor: 0,
        args_cursor: 0,
        indices: BTreeMap::new(),
        machine_type: MachineType::Gumball,
    };

    process_draw(&mut ctx, mint_args, label)
}

/// Mint an NFT.
#[derive(Accounts)]
pub struct Draw<'info> {
    /// Gumball Guard account.
    #[account(seeds = [SEED, gumball_guard.base.key().as_ref()], bump = gumball_guard.bump)]
    gumball_guard: Account<'info, GumballGuard>,

    /// Gumball Machine program account.
    ///
    /// CHECK: account constraints checked in account trait
    #[account(address = mallow_gumball::id())]
    gumball_machine_program: AccountInfo<'info>,

    /// Gumball machine account.
    #[account(mut, constraint = gumball_guard.key() == gumball_machine.mint_authority)]
    gumball_machine: Box<Account<'info, GumballMachine>>,

    /// Payer for the mint (SOL) fees.
    #[account(mut)]
    payer: Signer<'info>,

    /// Minter account for validation and non-SOL fees.
    #[account(mut)]
    buyer: Signer<'info>,

    /// Token Metadata program.
    ///
    /// CHECK: account checked in CPI
    #[account(address = mpl_token_metadata::ID)]
    token_metadata_program: UncheckedAccount<'info>,

    /// SPL Token program.
    spl_token_program: Program<'info, Token>,

    /// System program.
    system_program: Program<'info, System>,

    /// Instructions sysvar account.
    ///
    /// CHECK: account constraints checked in account trait
    #[account(address = sysvar::instructions::id())]
    sysvar_instructions: UncheckedAccount<'info>,

    /// SlotHashes sysvar cluster data.
    ///
    /// CHECK: account constraints checked in account trait
    #[account(address = sysvar::slot_hashes::id())]
    recent_slothashes: UncheckedAccount<'info>,

    /// CHECK: safe due to check in gumball machine
    gumball_event_authority: UncheckedAccount<'info>,
}
