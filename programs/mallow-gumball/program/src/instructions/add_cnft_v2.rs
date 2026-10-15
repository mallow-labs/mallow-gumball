use crate::{
    assert_can_add_item, assert_cnft_tree_config, assert_cnft_v2, cnft_asset_id,
    compute_cnft_creator_hash, compute_cnft_data_hash,
    constants::{
        AUTHORITY_SEED, MPL_ACCOUNT_COMPRESSION_PROGRAM, MPL_NOOP_PROGRAM, SELLER_HISTORY_SEED,
    },
    state::GumballMachine,
    transfer_cnft_v2, CnftArgsV2, ConfigLineV2Input, GumballError, SellerHistory, TokenStandard,
};
use anchor_lang::prelude::*;

use super::AddItemArgs;

/// Add a compressed NFT (Bubblegum V2) to a gumball machine.
///
/// Transfers custody to the authority PDA and stores the derived asset id in
/// the existing config-line mint field. Enables per-draw refund accounting.
///
/// Proof nodes are passed as remaining accounts.
#[derive(Accounts)]
pub struct AddCnftV2<'info> {
    /// Gumball Machine account.
    #[account(
        mut,
        constraint = gumball_machine.version >= 5 @ GumballError::InvalidVersion,
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

    /// CHECK: Actual leaf delegate, authenticated by the Bubblegum proof.
    leaf_delegate: UncheckedAccount<'info>,

    /// CHECK: Bubblegum tree authority PDA, verified against merkle_tree.
    #[account(mut)]
    tree_config: UncheckedAccount<'info>,

    /// CHECK: Merkle tree holding the leaf. Its key and nonce derive the asset
    /// id stored in the config line.
    #[account(mut)]
    merkle_tree: UncheckedAccount<'info>,

    /// CHECK: Core ownership and type checked locally; membership is proof-bound.
    core_collection: Option<UncheckedAccount<'info>>,

    /// CHECK: Safe due to address constraint.
    #[account(address = MPL_NOOP_PROGRAM)]
    log_wrapper: UncheckedAccount<'info>,

    /// CHECK: Safe due to address constraint.
    #[account(address = MPL_ACCOUNT_COMPRESSION_PROGRAM)]
    compression_program: UncheckedAccount<'info>,

    /// CHECK: Safe due to address constraint.
    #[account(address = mpl_bubblegum::ID)]
    bubblegum_program: UncheckedAccount<'info>,

    system_program: Program<'info, System>,
}

pub fn add_cnft_v2<'info>(
    ctx: Context<'info, AddCnftV2<'info>>,
    args: CnftArgsV2,
    add_item_args: AddItemArgs,
) -> Result<()> {
    assert_cnft_v2(args.version, &ctx.accounts.merkle_tree.to_account_info())?;

    let seller = &ctx.accounts.seller.to_account_info();
    let system_program = &ctx.accounts.system_program.to_account_info();
    let authority_pda = &ctx.accounts.authority_pda.to_account_info();
    let merkle_tree = &ctx.accounts.merkle_tree.to_account_info();
    let tree_config = &ctx.accounts.tree_config.to_account_info();
    let log_wrapper = &ctx.accounts.log_wrapper.to_account_info();
    let compression_program = &ctx.accounts.compression_program.to_account_info();
    let bubblegum_program = &ctx.accounts.bubblegum_program.to_account_info();
    let core_collection_info = ctx
        .accounts
        .core_collection
        .as_ref()
        .map(|c| c.to_account_info());
    let core_collection = core_collection_info.as_ref();
    let gumball_machine = &mut ctx.accounts.gumball_machine;
    let machine_info = gumball_machine.to_account_info();
    gumball_machine.enable_cnft_refunds(&machine_info, seller, system_program)?;
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

    crate::assert_cnft_v2_eligible(args.flags, core_collection)?;

    let data_hash = compute_cnft_data_hash(&args.meta_hash, args.seller_fee_basis_points);
    let creator_hash = compute_cnft_creator_hash(&args.creators);

    // Escrow: seller -> authority PDA. Seller signs the outer tx.
    transfer_cnft_v2(
        bubblegum_program,
        tree_config,
        seller,
        seller,
        &ctx.accounts.leaf_delegate.to_account_info(),
        authority_pda,
        merkle_tree,
        core_collection,
        log_wrapper,
        compression_program,
        system_program,
        ctx.remaining_accounts,
        args.root,
        data_hash,
        creator_hash,
        args.asset_data_hash,
        args.flags,
        args.nonce,
        args.index,
        None,
    )?;

    Ok(())
}
