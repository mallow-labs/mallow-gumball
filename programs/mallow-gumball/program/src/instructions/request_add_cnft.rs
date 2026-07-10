use crate::{
    assert_can_request_add_item, assert_cnft_asset_id, assert_cnft_tree_config, assert_cnft_v1,
    compute_cnft_creator_hash, compute_cnft_data_hash,
    constants::{
        ADD_ITEM_REQUEST_SEED, AUTHORITY_SEED, SELLER_HISTORY_SEED,
        SPL_ACCOUNT_COMPRESSION_PROGRAM, SPL_NOOP_PROGRAM,
    },
    state::GumballMachine,
    transfer_cnft, AddItemRequest, CnftArgs, GumballError, SellerHistory, TokenStandard,
};
use anchor_lang::prelude::*;

/// Request to add a compressed NFT to a gumball machine (collab flow).
/// Escrows the leaf (`seller -> authority PDA`) and creates a request account
/// keyed by the derived asset id, to be approved later via `approve_add_item`.
///
/// Proof nodes are passed as remaining accounts.
#[derive(Accounts)]
pub struct RequestAddCnft<'info> {
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

    /// Add item request account, keyed by the asset id.
    #[account(
        init,
        seeds = [
            ADD_ITEM_REQUEST_SEED.as_bytes(),
            asset.key().as_ref()
        ],
        bump,
        space = AddItemRequest::SPACE,
        payer = seller
    )]
    add_item_request: Box<Account<'info, AddItemRequest>>,

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

    /// The cNFT asset id (a Bubblegum PDA; not a real account). Used only as the
    /// request PDA seed and bound to (merkle_tree, nonce) in the handler.
    /// CHECK: Verified equal to the derived asset id.
    asset: UncheckedAccount<'info>,

    /// CHECK: Bubblegum tree authority PDA, verified against merkle_tree.
    tree_config: UncheckedAccount<'info>,

    /// CHECK: Merkle tree. Untrusted; bound to `asset` via `assert_cnft_asset_id`.
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

pub fn request_add_cnft<'info>(
    ctx: Context<'_, '_, '_, 'info, RequestAddCnft<'info>>,
    args: CnftArgs,
) -> Result<()> {
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
    let add_item_request = &mut ctx.accounts.add_item_request;

    // Anti-substitution: the request PDA is seeded by `asset`; require it equals
    // the asset id derived from the untrusted merkle tree + nonce. This is the
    // ONLY binding between the merkle tree and the stored request.
    assert_cnft_asset_id(&merkle_tree.key(), args.nonce, &ctx.accounts.asset.key())?;
    assert_cnft_tree_config(&tree_config.key(), &merkle_tree.key())?;

    add_item_request.init(
        gumball_machine.key(),
        seller.key(),
        ctx.accounts.asset.key(),
        TokenStandard::Compressed,
    )?;

    seller_history.gumball_machine = gumball_machine.key();
    seller_history.seller = seller.key();

    // Validate the seller.
    assert_can_request_add_item(gumball_machine, seller_history)?;

    seller_history.item_count += 1;

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
