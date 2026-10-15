use crate::{
    assert_cnft_asset_id, assert_cnft_tree_config, assert_cnft_v2, compute_cnft_creator_hash,
    compute_cnft_data_hash,
    constants::{
        ADD_ITEM_REQUEST_SEED, AUTHORITY_SEED, MPL_ACCOUNT_COMPRESSION_PROGRAM, MPL_NOOP_PROGRAM,
        SELLER_HISTORY_SEED,
    },
    transfer_cnft_v2, AddItemRequest, CnftArgsV2, GumballError, SellerHistory,
};
use anchor_lang::prelude::*;

/// Cancel a request to add a compressed NFT. Transfers the escrowed leaf back to
/// the seller (`PDA -> seller`) and closes the request account.
///
/// Proof nodes are passed as remaining accounts.
#[derive(Accounts)]
pub struct CancelAddCnftRequestV2<'info> {
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

    /// Add item request account (keyed by asset id). Will be closed.
    #[account(
        mut,
        close = seller,
        seeds = [
            ADD_ITEM_REQUEST_SEED.as_bytes(),
            asset.key().as_ref()
        ],
        bump,
        has_one = seller @ GumballError::InvalidSeller,
        has_one = asset @ GumballError::InvalidMint,
    )]
    add_item_request: Box<Account<'info, AddItemRequest>>,

    /// CHECK: Safe due to seeds constraint. Current (escrow) leaf owner.
    #[account(
        mut,
        seeds = [
            AUTHORITY_SEED.as_bytes(),
            add_item_request.gumball_machine.key().as_ref()
        ],
        bump
    )]
    authority_pda: UncheckedAccount<'info>,

    /// Seller of the cNFT.
    #[account(mut)]
    seller: Signer<'info>,

    /// The cNFT asset id (a Bubblegum PDA; not a real account).
    /// CHECK: Bound to (merkle_tree, nonce) via `assert_cnft_asset_id`.
    asset: UncheckedAccount<'info>,

    /// CHECK: Bubblegum tree authority PDA, verified against merkle_tree.
    #[account(mut)]
    tree_config: UncheckedAccount<'info>,

    /// CHECK: Merkle tree. Untrusted; bound to `asset` via `assert_cnft_asset_id`.
    #[account(mut)]
    merkle_tree: UncheckedAccount<'info>,

    /// CHECK: Core ownership, type and leaf membership validated by Bubblegum.
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

pub fn cancel_add_cnft_request_v2<'info>(
    ctx: Context<'info, CancelAddCnftRequestV2<'info>>,
    args: CnftArgsV2,
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
    let seller_history = &mut ctx.accounts.seller_history;
    let proof = crate::resolve_cancelled_add_item_request(
        &ctx.accounts.add_item_request,
        ctx.remaining_accounts,
    )?;

    // Anti-substitution: bind the request's stored asset id to the untrusted
    // merkle tree + nonce.
    assert_cnft_asset_id(&merkle_tree.key(), args.nonce, &ctx.accounts.asset.key())?;
    assert_cnft_tree_config(&tree_config.key(), &merkle_tree.key())?;

    let auth_seeds = [
        AUTHORITY_SEED.as_bytes(),
        seller_history.gumball_machine.as_ref(),
        &[ctx.bumps.authority_pda],
    ];

    let data_hash = compute_cnft_data_hash(&args.meta_hash, args.seller_fee_basis_points);
    let creator_hash = compute_cnft_creator_hash(&args.creators);

    // Escrow-out: authority PDA -> seller. PDA signs via seeds.
    transfer_cnft_v2(
        bubblegum_program,
        tree_config,
        seller,
        authority_pda,
        authority_pda,
        seller,
        merkle_tree,
        core_collection,
        log_wrapper,
        compression_program,
        system_program,
        proof,
        args.root,
        data_hash,
        creator_hash,
        args.asset_data_hash,
        args.flags,
        args.nonce,
        args.index,
        Some(&auth_seeds),
    )?;

    seller_history.item_count -= 1;

    if seller_history.item_count == 0 {
        seller_history.close(seller.to_account_info())?;
    }

    Ok(())
}
