use crate::{
    assert_cnft_tree_config, assert_cnft_v1, assert_config_line, cnft_asset_id,
    compute_cnft_creator_hash, compute_cnft_data_hash,
    constants::{AUTHORITY_SEED, SPL_ACCOUNT_COMPRESSION_PROGRAM, SPL_NOOP_PROGRAM},
    events::ClaimItemEvent,
    processors::claim_item,
    state::GumballMachine,
    transfer_cnft, CnftArgs, ConfigLine, GumballError, GumballState, TokenStandard,
};
use anchor_lang::prelude::*;

/// Claims a compressed NFT for the recorded buyer (escrow-out `PDA -> buyer`).
/// The buyer is recorded at draw time (draw is unchanged for cNFTs).
///
/// Proof nodes are passed as remaining accounts.
#[event_cpi]
#[derive(Accounts)]
pub struct ClaimCnft<'info> {
    /// Anyone can claim the item for the recorded buyer.
    #[account(mut)]
    payer: Signer<'info>,

    /// Gumball machine account.
    #[account(
        mut,
        constraint = gumball_machine.state == GumballState::SaleLive || gumball_machine.state == GumballState::SaleEnded @ GumballError::InvalidState
    )]
    gumball_machine: Box<Account<'info, GumballMachine>>,

    /// CHECK: Safe due to seeds constraint. Current (escrow) leaf owner.
    #[account(
        mut,
        seeds = [
            AUTHORITY_SEED.as_bytes(),
            gumball_machine.key().as_ref()
        ],
        bump
    )]
    authority_pda: UncheckedAccount<'info>,

    /// Seller of the cNFT.
    /// CHECK: Safe due to item check.
    seller: UncheckedAccount<'info>,

    /// Buyer of the cNFT (recorded at draw). Receives the leaf.
    /// CHECK: Safe due to item check.
    #[account(mut)]
    buyer: UncheckedAccount<'info>,

    /// CHECK: Bubblegum tree authority PDA, verified against merkle_tree.
    tree_config: UncheckedAccount<'info>,

    /// CHECK: Merkle tree. Untrusted; bound to the stored asset id via
    /// `assert_config_line` (which compares the derived asset id to the stored
    /// config-line mint).
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

pub fn claim_cnft<'info>(
    ctx: Context<'_, '_, '_, 'info, ClaimCnft<'info>>,
    index: u32,
    args: CnftArgs,
) -> Result<()> {
    assert_cnft_v1(args.version)?;

    let gumball_machine = &mut ctx.accounts.gumball_machine;
    let buyer = &ctx.accounts.buyer.to_account_info();
    let seller = &ctx.accounts.seller.to_account_info();
    let authority_pda = &ctx.accounts.authority_pda.to_account_info();
    let merkle_tree = &ctx.accounts.merkle_tree.to_account_info();
    let tree_config = &ctx.accounts.tree_config.to_account_info();
    let log_wrapper = &ctx.accounts.log_wrapper.to_account_info();
    let compression_program = &ctx.accounts.compression_program.to_account_info();
    let bubblegum_program = &ctx.accounts.bubblegum_program.to_account_info();
    let system_program = &ctx.accounts.system_program.to_account_info();

    // Anti-substitution: derive asset id from the untrusted tree + nonce and
    // require it equals the stored config-line mint.
    let asset_id = cnft_asset_id(&merkle_tree.key(), args.nonce);
    assert_cnft_tree_config(&tree_config.key(), &merkle_tree.key())?;

    assert_config_line(
        gumball_machine,
        index,
        ConfigLine {
            mint: asset_id,
            seller: seller.key(),
            buyer: buyer.key(),
            token_standard: TokenStandard::Compressed,
        },
        false,
    )?;

    // Reject unsold items: their recorded buyer is the default pubkey, and
    // transferring the escrowed leaf there would burn it irrecoverably.
    require!(
        buyer.key() != Pubkey::default(),
        GumballError::IncorrectOwner
    );

    // Mark claimed (guards double-claim).
    claim_item(gumball_machine, index)?;

    let auth_seeds = [
        AUTHORITY_SEED.as_bytes(),
        gumball_machine.to_account_info().key.as_ref(),
        &[ctx.bumps.authority_pda],
    ];

    let data_hash = compute_cnft_data_hash(&args.meta_hash, args.seller_fee_basis_points);
    let creator_hash = compute_cnft_creator_hash(&args.creators);

    // Escrow-out: authority PDA -> buyer. PDA signs via seeds.
    transfer_cnft(
        bubblegum_program,
        tree_config,
        authority_pda,
        buyer,
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

    emit_cpi!(ClaimItemEvent {
        mint: asset_id,
        authority: gumball_machine.authority.key(),
        seller: seller.key(),
        buyer: buyer.key(),
        amount: 1,
    });

    Ok(())
}
