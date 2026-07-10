use crate::{
    assert_can_add_item, assert_cnft_tree_config, assert_cnft_v1, cnft_asset_id,
    compute_cnft_creator_hash, compute_cnft_data_hash,
    constants::{AUTHORITY_SEED, SELLER_HISTORY_SEED, SPL_ACCOUNT_COMPRESSION_PROGRAM, SPL_NOOP_PROGRAM},
    state::GumballMachine,
    transfer_cnft, CnftArgs, ConfigLineV2Input, GumballError, SellerHistory, TokenStandard,
};
use anchor_lang::prelude::*;

use super::AddItemArgs;

/// Add a compressed NFT (Bubblegum V1) to a gumball machine.
///
/// Unlike legacy NFTs / Core assets (which are frozen in place), a cNFT is
/// escrowed: the leaf is transferred `seller -> authority PDA` because Bubblegum
/// V1 has no freeze. The asset id (a 32-byte PDA) is stored in the config line's
/// existing `mint` field, so no layout change is needed.
///
/// Proof nodes are passed as remaining accounts.
#[derive(Accounts)]
pub struct AddCnft<'info> {
    /// Gumball Machine account.
    #[account(
        mut,
        constraint = gumball_machine.can_add_items() @ GumballError::InvalidState,
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

    /// CHECK: Safe due to seeds constraint. Receives the escrowed leaf.
    #[account(
        mut,
        seeds = [
            AUTHORITY_SEED.as_bytes(),
            gumball_machine.key().as_ref()
        ],
        bump
    )]
    authority_pda: UncheckedAccount<'info>,

    /// Seller of the cNFT (current leaf owner).
    #[account(mut)]
    seller: Signer<'info>,

    /// CHECK: Bubblegum tree authority PDA, verified against merkle_tree.
    tree_config: UncheckedAccount<'info>,

    /// CHECK: Merkle tree holding the leaf. Untrusted; bound to the stored asset
    /// id via `assert_cnft_asset_id` (the ONLY binding between this account and
    /// the item we store).
    #[account(mut)]
    merkle_tree: UncheckedAccount<'info>,

    /// CHECK: Safe due to address constraint.
    #[account(address = SPL_NOOP_PROGRAM)]
    log_wrapper: UncheckedAccount<'info>,

    /// CHECK: Safe due to address constraint.
    #[account(address = SPL_ACCOUNT_COMPRESSION_PROGRAM)]
    compression_program: UncheckedAccount<'info>,

    /// CHECK: Safe due to address constraint.
    #[account(address = mpl_bubblegum::ID)]
    bubblegum_program: UncheckedAccount<'info>,

    system_program: Program<'info, System>,
}

pub fn add_cnft<'info>(
    ctx: Context<'_, '_, '_, 'info, AddCnft<'info>>,
    args: CnftArgs,
    add_item_args: AddItemArgs,
) -> Result<()> {
    // V2 leaves are not tradable on-chain in this build.
    assert_cnft_v1(args.version)?;

    let seller = &ctx.accounts.seller.to_account_info();
    let system_program = &ctx.accounts.system_program.to_account_info();
    let authority_pda = &ctx.accounts.authority_pda.to_account_info();
    let merkle_tree = &ctx.accounts.merkle_tree.to_account_info();
    let tree_config = &ctx.accounts.tree_config.to_account_info();
    let log_wrapper = &ctx.accounts.log_wrapper.to_account_info();
    let compression_program = &ctx.accounts.compression_program.to_account_info();
    let bubblegum_program = &ctx.accounts.bubblegum_program.to_account_info();
    let gumball_machine = &mut ctx.accounts.gumball_machine;
    let seller_history = &mut ctx.accounts.seller_history;

    seller_history.gumball_machine = gumball_machine.key();
    seller_history.seller = seller.key();

    // Validate the seller (merkle allow-list / per-seller cap).
    assert_can_add_item(gumball_machine, seller_history, 1, &add_item_args)?;

    seller_history.item_count += 1;

    // Derive the asset id from the untrusted tree + nonce. This is what we store
    // and what all later instructions re-derive and compare against.
    let asset_id = cnft_asset_id(&merkle_tree.key(), args.nonce);
    assert_cnft_tree_config(&tree_config.key(), &merkle_tree.key())?;

    crate::processors::add_item(
        gumball_machine,
        ConfigLineV2Input {
            mint: asset_id,
            seller: ctx.accounts.seller.key(),
            amount: 1,
        },
        TokenStandard::Compressed,
        1,
        add_item_args.index,
    )?;

    let data_hash = compute_cnft_data_hash(&args.meta_hash, args.seller_fee_basis_points);
    let creator_hash = compute_cnft_creator_hash(&args.creators);

    // Escrow: seller -> authority PDA. Seller signs the outer tx.
    transfer_cnft(
        bubblegum_program,
        tree_config,
        seller,
        authority_pda,
        merkle_tree,
        log_wrapper,
        compression_program,
        system_program,
        ctx.remaining_accounts,
        args.root,
        data_hash,
        creator_hash,
        args.nonce,
        args.index,
        None,
    )?;

    Ok(())
}
