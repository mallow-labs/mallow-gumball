use anchor_lang::{prelude::*, Discriminator};
use mallow_jellybean_sdk::instructions::DrawCpiBuilder;
use solana_program::{instruction::Instruction, program::invoke_signed};

use crate::{
    guards::{EvaluationContext, MachineType},
    state::{GuardSet, GumballGuardData, DATA_OFFSET, SEED},
};

pub fn process_draw(
    ctx: &mut EvaluationContext<'_, '_, '_>,
    mint_args: Vec<u8>,
    label: Option<String>,
) -> Result<()> {
    let account_info = ctx.accounts.gumball_guard.to_account_info();
    let account_data = account_info.data.borrow();
    // loads the active guard set
    let guard_set = match GumballGuardData::active_set(&account_data[DATA_OFFSET..], label) {
        Ok(guard_set) => guard_set,
        Err(error) => {
            // load the default guard set to look for the bot_tax since errors only occur
            // when trying to load guard set groups
            let guard_set = GumballGuardData::load(&account_data[DATA_OFFSET..])?;
            return process_error(ctx, &guard_set.default, error);
        }
    };
    drop(account_data);

    let conditions = guard_set.enabled_conditions();

    // validates enabled guards (any error at this point is subject to bot tax)

    for condition in &conditions {
        if let Err(error) = condition.validate(ctx, &guard_set, &mint_args) {
            return process_error(ctx, &guard_set, error);
        }
    }

    // after this point, errors might occur, which will cause the transaction to fail
    // no bot tax from this point since the actions must be reverted in case of an error

    for condition in &conditions {
        condition.pre_actions(ctx, &guard_set, &mint_args)?;
    }

    cpi_draw(ctx)?;

    for condition in &conditions {
        condition.post_actions(ctx, &guard_set, &mint_args)?;
    }

    Ok(())
}

// Handles errors + bot tax charge.
fn process_error(ctx: &EvaluationContext, guard_set: &GuardSet, error: Error) -> Result<()> {
    if let Some(bot_tax) = &guard_set.bot_tax {
        bot_tax.punish_bots(ctx, error)?;
        Ok(())
    } else {
        Err(error)
    }
}

/// Send a mint transaction to the gumball machine.
fn cpi_draw(ctx: &EvaluationContext) -> Result<()> {
    let gumball_guard = &ctx.accounts.gumball_guard;
    // PDA signer for the transaction
    let seeds = [SEED, &gumball_guard.base.to_bytes(), &[gumball_guard.bump]];
    let signer = [&seeds[..]];

    match ctx.machine_type {
        MachineType::Gumball => {
            // gumball machine mint instruction accounts
            let mint_accounts = Box::new(mallow_gumball::cpi::accounts::Draw {
                gumball_machine: ctx.accounts.machine.to_account_info(),
                mint_authority: gumball_guard.to_account_info(),
                payer: ctx.accounts.payer.clone(),
                buyer: ctx.accounts.buyer.clone(),
                system_program: ctx.accounts.system_program.clone(),
                recent_slothashes: ctx.accounts.recent_slothashes.clone(),
                event_authority: ctx.accounts.event_authority.clone(),
                program: ctx.accounts._machine_program.clone(),
            });

            let mint_infos = mint_accounts.to_account_infos();
            let mint_metas = mint_accounts.to_account_metas(None);

            let mint_ix = Instruction {
                program_id: mallow_gumball::ID,
                accounts: mint_metas,
                data: mallow_gumball::instruction::Draw::DISCRIMINATOR.to_vec(),
            };

            invoke_signed(&mint_ix, &mint_infos, &signer)?;
        }
        MachineType::Jellybean => {
            DrawCpiBuilder::new(&ctx.accounts._machine_program)
                .jellybean_machine(&ctx.accounts.machine)
                .authority_pda(ctx.accounts.authority_pda.as_ref().unwrap())
                .mint_authority(&gumball_guard.to_account_info())
                .payer(&ctx.accounts.payer)
                .buyer(&ctx.accounts.buyer)
                .unclaimed_prizes(ctx.accounts.unclaimed_prizes.as_ref().unwrap())
                .system_program(&ctx.accounts.system_program)
                .rent(ctx.accounts.rent.as_ref().unwrap())
                .recent_slothashes(&ctx.accounts.recent_slothashes)
                .event_authority(&ctx.accounts.event_authority)
                .program(&ctx.accounts._machine_program)
                .print_fee_account(ctx.accounts.print_fee_account.as_ref())
                .invoke_signed(&signer)?;
        }
    }

    Ok(())
}
