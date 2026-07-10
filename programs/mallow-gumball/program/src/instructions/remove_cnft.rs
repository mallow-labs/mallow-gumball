use crate::{
    assert_cnft_tree_config, assert_cnft_v1, cnft_asset_id, compute_cnft_creator_hash,
    compute_cnft_data_hash,
    constants::{
        AUTHORITY_SEED, SELLER_HISTORY_SEED, SPL_ACCOUNT_COMPRESSION_PROGRAM, SPL_NOOP_PROGRAM,
    },
    processors,
    state::GumballMachine,
    transfer_cnft, CnftArgs, GumballError, SellerHistory,
};
use anchor_lang::prelude::*;

/// Remove a compressed NFT from a gumball machine (escrow-out `PDA -> seller`).
/// The signer can be the gumball machine authority or the item's seller.
///
/// Proof nodes are passed as remaining accounts.
#[derive(Accounts)]
pub struct RemoveCnft<'info> {
    /// Gumball Machine account.
    #[account(
        mut,
        constraint = gumball_machine.can_edit_items() @ GumballError::InvalidState,
    )]
    gumball_machine: Account<'info, GumballMachine>,

    /// Seller history account.
    #[account(
        mut,
        seeds = [
            SELLER_HISTORY_SEED.as_bytes(),
            gumball_machine.key().as_ref(),
            seller.key().as_ref(),
        ],
        bump,
        has_one = gumball_machine,
        has_one = seller,
    )]
    seller_history: Box<Account<'info, SellerHistory>>,

    /// CHECK: Safe due to seeds constraint. Current (escrow) leaf owner.
    #[account(
        mut,
        seeds = [AUTHORITY_SEED.as_bytes(), gumball_machine.key().as_ref()],
        bump
    )]
    authority_pda: UncheckedAccount<'info>,

    /// Authority allowed to remove (gumball machine authority or item seller).
    authority: Signer<'info>,

    /// CHECK: Safe due to item seller check. Receives the leaf back.
    #[account(mut)]
    seller: UncheckedAccount<'info>,

    /// CHECK: Bubblegum tree authority PDA, verified against merkle_tree.
    tree_config: UncheckedAccount<'info>,

    /// CHECK: Merkle tree. Untrusted; bound to the stored asset id via the
    /// derived asset id passed into `remove_multiple_items_span`.
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

pub fn remove_cnft<'info>(
    ctx: Context<'_, '_, '_, 'info, RemoveCnft<'info>>,
    index: u32,
    args: CnftArgs,
) -> Result<()> {
    assert_cnft_v1(args.version)?;

    let system_program = &ctx.accounts.system_program.to_account_info();
    let authority = &ctx.accounts.authority.to_account_info();
    let seller = &ctx.accounts.seller.to_account_info();
    let authority_pda = &ctx.accounts.authority_pda.to_account_info();
    let merkle_tree = &ctx.accounts.merkle_tree.to_account_info();
    let tree_config = &ctx.accounts.tree_config.to_account_info();
    let log_wrapper = &ctx.accounts.log_wrapper.to_account_info();
    let compression_program = &ctx.accounts.compression_program.to_account_info();
    let bubblegum_program = &ctx.accounts.bubblegum_program.to_account_info();
    let gumball_machine = &mut ctx.accounts.gumball_machine;
    let seller_history = &mut ctx.accounts.seller_history;

    // Anti-substitution: derive the asset id from the untrusted merkle tree +
    // nonce and pass it into `remove_multiple_items_span`, which requires it to
    // equal the asset id stored in the config line (mint field). A wrong tree
    // therefore fails the InvalidMint check.
    let asset_id = cnft_asset_id(&merkle_tree.key(), args.nonce);
    assert_cnft_tree_config(&tree_config.key(), &merkle_tree.key())?;

    processors::remove_multiple_items_span(
        gumball_machine,
        authority.key(),
        asset_id,
        seller.key(),
        1,
        index,
        index,
    )?;

    let auth_seeds = [
        AUTHORITY_SEED.as_bytes(),
        gumball_machine.to_account_info().key.as_ref(),
        &[ctx.bumps.authority_pda],
    ];

    let data_hash = compute_cnft_data_hash(&args.meta_hash, args.seller_fee_basis_points);
    let creator_hash = compute_cnft_creator_hash(&args.creators);

    // Escrow-out: authority PDA -> seller. PDA signs via seeds.
    transfer_cnft(
        bubblegum_program,
        tree_config,
        authority_pda,
        seller,
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
        Some(&auth_seeds),
    )?;

    seller_history.item_count -= 1;

    if seller_history.item_count == 0 {
        seller_history.close(seller.to_account_info())?;
    }

    Ok(())
}
