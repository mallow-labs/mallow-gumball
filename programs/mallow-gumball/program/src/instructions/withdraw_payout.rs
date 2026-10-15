use crate::{
    constants::AUTHORITY_SEED, processors::payment_currency, GumballError, GumballMachine,
};
use anchor_lang::prelude::*;
use anchor_lang::Discriminator;
use anchor_spl::{associated_token::AssociatedToken, token_interface::TokenInterface};
use utils::{can_receive_lamports, can_receive_token, transfer_sol_from_pda};

/// Withdraw parked proceeds to a token account owned by the recipient, or SOL
/// to the recipient. Rent returns to its payer when receivable, else the recipient.
#[derive(Accounts)]
pub struct WithdrawPayout<'info> {
    /// CHECK: key gives escrow seeds; owner and discriminator determine whether the
    /// final post-close token withdrawal sweeps the vault balance and may close it.
    pub gumball_machine: UncheckedAccount<'info>,
    /// CHECK: program-owned escrow and ledger bound to the machine.
    #[account(mut, owner = crate::ID, seeds = [AUTHORITY_SEED.as_bytes(), gumball_machine.key().as_ref()], bump)]
    pub authority_pda: UncheckedAccount<'info>,
    #[account(mut)]
    pub recipient: Signer<'info>,
    /// CHECK: bound to the rent payer recorded in the claim entry.
    #[account(mut)]
    pub rent_payer: UncheckedAccount<'info>,
    /// CHECK: currency checked against the escrow entry.
    pub payment_mint: Option<UncheckedAccount<'info>>,
    /// CHECK: validated canonical source ATA.
    #[account(mut)]
    pub authority_pda_payment_account: Option<UncheckedAccount<'info>>,
    /// CHECK: validated token owner and currency; may be a noncanonical account.
    #[account(mut)]
    pub recipient_payment_account: Option<UncheckedAccount<'info>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn withdraw_payout(ctx: Context<WithdrawPayout>, amount: u64) -> Result<()> {
    let escrow = ctx.accounts.authority_pda.to_account_info();
    let recipient = ctx.accounts.recipient.to_account_info();
    let data = escrow.try_borrow_data()?;
    let supplied_mint = ctx.accounts.payment_mint.as_ref().map(|mint| mint.key());
    let (position, mint_key) =
        super::recover_payout_rent::entry_position(&data, recipient.key, |mint, _| {
            supplied_mint.map_or(utils::is_native_mint(*mint), |supplied| {
                supplied == *mint
                    || (utils::is_native_mint(supplied) && utils::is_native_mint(*mint))
            })
        })?;
    let available = u64::from_le_bytes(data[position + 64..position + 72].try_into().unwrap());
    require!(
        amount > 0 && amount <= available,
        GumballError::InsufficientFunds
    );
    require!(
        data[position + 72..position + 104] == ctx.accounts.rent_payer.key().to_bytes(),
        GumballError::InvalidAuthority
    );
    let deposit = u64::from_le_bytes(data[position + 104..position + 112].try_into().unwrap());
    drop(data);
    let mint_info = ctx
        .accounts
        .payment_mint
        .as_ref()
        .map(|a| a.to_account_info());
    let mint = payment_currency(mint_key, mint_info.as_ref())?;
    if let Some(mint) = mint {
        let source = ctx
            .accounts
            .authority_pda_payment_account
            .as_ref()
            .ok_or(GumballError::InvalidPaymentMint)?
            .to_account_info();
        let destination = ctx
            .accounts
            .recipient_payment_account
            .as_ref()
            .ok_or(GumballError::InvalidPaymentMint)?
            .to_account_info();
        let token_program = ctx.accounts.token_program.to_account_info();
        utils::assert_mint_matches_token_program(mint, &token_program)?;
        utils::assert_is_ata_for_program(&source, escrow.key, mint.key, token_program.key)?;
        require!(
            can_receive_token(
                &destination,
                recipient.key,
                mint.key,
                token_program.key,
                false
            )?,
            GumballError::InvalidAuthority
        );
        let machine_key = ctx.accounts.gumball_machine.key();
        let seeds = [
            AUTHORITY_SEED.as_bytes(),
            machine_key.as_ref(),
            &[ctx.bumps.authority_pda],
        ];
        let machine = ctx.accounts.gumball_machine.to_account_info();
        let closed = *machine.owner != crate::ID
            || !machine
                .try_borrow_data()?
                .starts_with(GumballMachine::DISCRIMINATOR);
        let release_vault = closed
            && crate::processors::parked_amount(&escrow.try_borrow_data()?, &mint_key)? == amount;
        // Sweep unsolicited post-close tokens with the last entitlement, using
        // the same validated destination and transfer CPI.
        let transfer_amount = if release_vault {
            let source_data = source.try_borrow_data()?;
            let vault =
                anchor_spl::token_interface::TokenAccount::try_deserialize(&mut &source_data[..])?;
            require!(vault.amount >= amount, GumballError::InsufficientFunds);
            vault.amount
        } else {
            amount
        };
        anchor_spl::token_2022::transfer_checked(
            CpiContext::new(
                token_program.key(),
                anchor_spl::token_2022::TransferChecked {
                    from: source.clone(),
                    mint: mint.clone(),
                    to: destination,
                    authority: escrow.clone(),
                },
            )
            .with_signer(&[&seeds]),
            transfer_amount,
            utils::unpack_currency_mint_decimals(mint)?,
        )?;
        // The last post-close token withdrawal also releases the empty vault.
        // Do this before the direct claim-rent credits below.
        if release_vault {
            let rent_payer = ctx.accounts.rent_payer.to_account_info();
            let rent_recipient =
                if super::recover_payout_rent::can_return_deposit(&recipient, source.lamports())? {
                    Some(&recipient)
                } else if super::recover_payout_rent::can_return_deposit(
                    &rent_payer,
                    source.lamports(),
                )? {
                    Some(&rent_payer)
                } else {
                    None
                };
            if let Some(rent_recipient) = rent_recipient {
                anchor_spl::token_2022::close_account(
                    CpiContext::new(
                        token_program.key(),
                        anchor_spl::token_2022::CloseAccount {
                            account: source,
                            destination: rent_recipient.clone(),
                            authority: escrow.clone(),
                        },
                    )
                    .with_signer(&[&seeds]),
                )?;
            }
        }
    } else {
        require!(
            can_receive_lamports(&recipient),
            GumballError::InvalidAuthority
        );
        require!(
            recipient.lamports().saturating_add(amount)
                >= Rent::get()?.minimum_balance(recipient.data_len()),
            GumballError::InsufficientFunds
        );
        transfer_sol_from_pda(&mut escrow.clone(), &mut recipient.clone(), amount)?;
    }
    let remaining = available - amount;
    escrow.try_borrow_mut_data()?[position + 64..position + 72]
        .copy_from_slice(&remaining.to_le_bytes());
    if remaining == 0 {
        super::recover_payout_rent::finish_claim(
            &escrow,
            &ctx.accounts.rent_payer.to_account_info(),
            &recipient,
            position,
            deposit,
        )?;
    }
    Ok(())
}
