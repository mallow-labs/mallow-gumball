use crate::{
    constants::{ADD_ITEM_REQUEST_SEED, AUTHORITY_SEED, SELLER_HISTORY_SEED}, 
    thaw_and_revoke_nft, AddItemRequest, AssociatedToken, GumballError, SellerHistory, Token
};
use anchor_lang::prelude::*;

/// Add nft to a gumball machine.
#[derive(Accounts)]
pub struct CancelAddNftRequest<'info> {
    /// Seller history account.
    #[account(
		mut,
		seeds = [
			SELLER_HISTORY_SEED.as_bytes(),
			seller_history.gumball_machine.as_ref(),
            seller.key().as_ref(),
		],
		bump,
        has_one = seller,
	)]
    seller_history: Box<Account<'info, SellerHistory>>,

    /// Add item request account.
    #[account(
        mut,
        close = seller,
        seeds = [
            ADD_ITEM_REQUEST_SEED.as_bytes(), 
            mint.key().as_ref()
        ],
        bump,
        has_one = seller @ GumballError::InvalidSeller,
        constraint = add_item_request.asset == mint.key() @ GumballError::InvalidMint,
    )]
    add_item_request: Box<Account<'info, AddItemRequest>>,

    /// CHECK: Safe due to seeds constraint
    #[account(
        mut,
        seeds = [
            AUTHORITY_SEED.as_bytes(), 
            add_item_request.gumball_machine.key().as_ref()
        ],
        bump
    )]
    authority_pda: UncheckedAccount<'info>,

    /// Seller of the NFT.
    #[account(mut)]
    seller: Signer<'info>,

    /// CHECK: Safe due to thaw/revoke
    mint: UncheckedAccount<'info>,

    /// CHECK: Safe due to thaw/revoke
    #[account(mut)]
    token_account: UncheckedAccount<'info>,

    /// CHECK: Safe due to thaw/revoke
    #[account(mut)]
    tmp_token_account: UncheckedAccount<'info>,

    /// CHECK: Safe due to thaw/revoke
    edition: UncheckedAccount<'info>,

    token_program: Program<'info, Token>,

    associated_token_program: Program<'info, AssociatedToken>,

    /// CHECK: Safe due to constraint
    #[account(address = mpl_token_metadata::ID)]
    token_metadata_program: UncheckedAccount<'info>,

    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}

pub fn cancel_add_nft_request(ctx: Context<CancelAddNftRequest>) -> Result<()> {
    let system_program = &ctx.accounts.system_program.to_account_info();
    let rent = &ctx.accounts.rent.to_account_info();
    let token_program = &ctx.accounts.token_program.to_account_info();
    let associated_token_program = &ctx.accounts.associated_token_program.to_account_info();
    let token_metadata_program = &ctx.accounts.token_metadata_program.to_account_info();
    let token_account = &ctx.accounts.token_account.to_account_info();
    let tmp_token_account = &ctx.accounts.tmp_token_account.to_account_info();
    let authority_pda = &ctx.accounts.authority_pda.to_account_info();
    let edition = &ctx.accounts.edition.to_account_info();
    let mint = &ctx.accounts.mint.to_account_info();
    let seller = &ctx.accounts.seller.to_account_info();
    let seller_history = &mut ctx.accounts.seller_history;

    let auth_seeds = [
        AUTHORITY_SEED.as_bytes(),
        seller_history.gumball_machine.as_ref(),
        &[ctx.bumps.authority_pda],
    ];

    thaw_and_revoke_nft(
        seller, 
        mint, 
        token_account, 
        tmp_token_account, 
        edition,
        authority_pda,
        &auth_seeds,
        token_metadata_program,
        token_program,
        associated_token_program,
        system_program,
        rent
    )?;

    seller_history.item_count -= 1;

    if seller_history.item_count == 0 {
        seller_history.close(seller.to_account_info())?;
    }

    Ok(())
}
