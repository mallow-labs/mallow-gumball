use std::collections::BTreeMap;

use anchor_lang::{prelude::*, solana_program::sysvar};
use mallow_jellybean_sdk::accounts::JellybeanMachine;

use crate::{
    guards::{EvaluationContext, MachineType},
    instructions::DrawAccounts,
    processors::process_draw,
    state::{GumballGuard, SEED},
};

use super::Token;

pub fn draw_jellybean<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, DrawJellybean<'info>>,
    mint_args: Vec<u8>,
    label: Option<String>,
) -> Result<()> {
    let accounts = DrawAccounts {
        gumball_guard: &ctx.accounts.gumball_guard,
        machine: ctx.accounts.jellybean_machine.to_account_info(),
        _machine_program: ctx.accounts.jellybean_machine_program.to_account_info(),
        payer: ctx.accounts.payer.to_account_info(),
        buyer: ctx.accounts.buyer.to_account_info(),
        recent_slothashes: ctx.accounts.recent_slothashes.to_account_info(),
        spl_token_program: ctx.accounts.spl_token_program.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        sysvar_instructions: ctx.accounts.sysvar_instructions.to_account_info(),
        remaining: ctx.remaining_accounts,
        event_authority: ctx.accounts.jellybean_event_authority.to_account_info(),
        token_metadata_program: None,
        authority_pda: Some(
            ctx.accounts
                .jellybean_machine_authority_pda
                .to_account_info(),
        ),
        unclaimed_prizes: Some(ctx.accounts.unclaimed_prizes.to_account_info()),
        print_fee_account: ctx
            .accounts
            .print_fee_account
            .as_ref()
            .map(|a| a.to_account_info()),
        rent: Some(ctx.accounts.rent.to_account_info()),
    };

    // evaluation context for this transaction
    let mut ctx = EvaluationContext {
        accounts,
        account_cursor: 0,
        args_cursor: 0,
        indices: BTreeMap::new(),
        machine_type: MachineType::Jellybean,
    };

    process_draw(&mut ctx, mint_args, label)
}

/// Mint an NFT.
#[derive(Accounts)]
pub struct DrawJellybean<'info> {
    /// Gumball Guard account.
    #[account(seeds = [SEED, gumball_guard.base.key().as_ref()], bump = gumball_guard.bump)]
    gumball_guard: Account<'info, GumballGuard>,

    /// Jellybean Machine program account.
    ///
    /// CHECK: account constraints checked in account trait
    #[account(address = mallow_jellybean_sdk::ID)]
    jellybean_machine_program: UncheckedAccount<'info>,

    /// Jellybean machine account.
    #[account(mut, constraint = gumball_guard.key() == jellybean_machine.mint_authority)]
    jellybean_machine: Box<Account<'info, JellybeanMachine>>,

    /// CHECK: safe due to check in jellybean machine
    #[account(mut)]
    jellybean_machine_authority_pda: UncheckedAccount<'info>,

    /// Payer for the mint (SOL) fees.
    #[account(mut)]
    payer: Signer<'info>,

    /// Minter account for validation and non-SOL fees.
    #[account(mut)]
    buyer: Signer<'info>,

    /// CHECK: safe due to check in jellybean machine
    #[account(mut)]
    unclaimed_prizes: UncheckedAccount<'info>,

    /// Print fee account. Required if the jellybean machine has a print fee config.
    #[account(mut)]
    print_fee_account: Option<UncheckedAccount<'info>>,

    /// SPL Token program.
    spl_token_program: Program<'info, Token>,

    /// System program.
    system_program: Program<'info, System>,

    /// Rent.
    /// CHECK: account constraints checked in account trait
    #[account(address = sysvar::rent::id())]
    rent: UncheckedAccount<'info>,

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

    /// CHECK: safe due to check in jellybean machine
    jellybean_event_authority: UncheckedAccount<'info>,
}
