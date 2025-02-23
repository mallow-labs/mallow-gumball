use crate::{
    approve_and_freeze_nft, assert_can_add_item,
    constants::{AUTHORITY_SEED, SELLER_HISTORY_SEED},
    state::GumballMachine,
    ConfigLineV2Input, GumballError, SellerHistory, Token, TokenStandard,
};
use anchor_lang::prelude::*;
use mpl_token_metadata::accounts::Metadata;
use utils::assert_is_non_printable_edition;

/// Add nft to a gumball machine.
#[derive(Accounts)]
pub struct AddNft<'info> {
    /// Gumball Machine account.
    #[account(
        mut,
        constraint = gumball_machine.can_edit_items() @ GumballError::InvalidState,
    )]
    gumball_machine: Box<Account<'info, GumballMachine>>,

    /// Seller history account.
    #[account(
		init_if_needed,
		seeds = [
			SELLER_HISTORY_SEED.as_bytes(),
			gumball_machine.key().as_ref(),
            seller.key().as_ref(),
		],
		bump,
		space = SellerHistory::SPACE,
		payer = seller
	)]
    seller_history: Box<Account<'info, SellerHistory>>,

    /// CHECK: Safe due to seeds constraint
    #[account(
        mut,
        seeds = [
            AUTHORITY_SEED.as_bytes(), 
            gumball_machine.key().as_ref()
        ],
        bump
    )]
    authority_pda: UncheckedAccount<'info>,

    /// Seller of the nft
    #[account(mut)]
    seller: Signer<'info>,

    /// CHECK: Safe due to freeze
    mint: UncheckedAccount<'info>,

    /// CHECK: Safe due to freeze
    #[account(mut)]
    token_account: UncheckedAccount<'info>,

    /// CHECK: Safe due to processor mint check
    metadata: UncheckedAccount<'info>,

    /// CHECK: Safe due to freeze
    edition: UncheckedAccount<'info>,

    token_program: Program<'info, Token>,

    /// CHECK: Safe due to constraint
    #[account(address = mpl_token_metadata::ID)]
    token_metadata_program: UncheckedAccount<'info>,

    system_program: Program<'info, System>,
}

pub fn add_nft(ctx: Context<AddNft>, seller_proof_path: Option<Vec<[u8; 32]>>) -> Result<()> {
    let token_program = &ctx.accounts.token_program.to_account_info();
    let token_account = &ctx.accounts.token_account.to_account_info();
    let token_metadata_program = &ctx.accounts.token_metadata_program.to_account_info();
    let authority_pda = &ctx.accounts.authority_pda.to_account_info();
    let seller = &ctx.accounts.seller.to_account_info();
    let metadata_account = &ctx.accounts.metadata.to_account_info();
    let edition = &ctx.accounts.edition.to_account_info();
    let mint = &ctx.accounts.mint.to_account_info();
    let gumball_machine = &mut ctx.accounts.gumball_machine;
    let seller_history = &mut ctx.accounts.seller_history;

    seller_history.gumball_machine = gumball_machine.key();
    seller_history.seller = seller.key();

    // Validate the seller
    assert_can_add_item(gumball_machine, seller_history, 1, seller_proof_path)?;

    seller_history.item_count += 1;

    // Validate that the metadata is for the correct mint
    let metadata = Metadata::try_from(metadata_account)?;
    require!(
        metadata.mint == ctx.accounts.mint.key(),
        GumballError::MintMismatch
    );

    // Prevent selling printable master editions
    assert_is_non_printable_edition(&ctx.accounts.edition.to_account_info())?;

    crate::processors::add_item(
        gumball_machine,
        ConfigLineV2Input {
            mint: ctx.accounts.mint.key(),
            seller: ctx.accounts.seller.key(),
            amount: 1,
        },
        TokenStandard::NonFungible,
        1,
    )?;

    let auth_seeds = [
        AUTHORITY_SEED.as_bytes(),
        ctx.accounts.gumball_machine.to_account_info().key.as_ref(),
        &[ctx.bumps.authority_pda],
    ];

    approve_and_freeze_nft(
        seller,
        mint,
        token_account,
        edition,
        authority_pda,
        &auth_seeds,
        token_metadata_program,
        token_program,
    )?;

    Ok(())
}
