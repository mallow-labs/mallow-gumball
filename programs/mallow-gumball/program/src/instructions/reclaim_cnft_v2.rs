use crate::{
    assert_cnft_tree_config, assert_cnft_v2, compute_cnft_creator_hash, compute_cnft_data_hash,
    constants::{AUTHORITY_SEED, MPL_ACCOUNT_COMPRESSION_PROGRAM, MPL_NOOP_PROGRAM},
    transfer_cnft_v2, CnftArgsV2, CnftRecovery, GumballError, CNFT_RECOVERY_SEED,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ReclaimCnftV2<'info> {
    /// Marketplace fee authority from the canonical guard GlobalConfig.
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, close = rent_payer,
        seeds = [CNFT_RECOVERY_SEED, recovery.gumball_machine.as_ref(), recovery.merkle_tree.as_ref(), &recovery.nonce.to_le_bytes()],
        bump, has_one = seller, has_one = merkle_tree, has_one = rent_payer)]
    pub recovery: Account<'info, CnftRecovery>,
    /// CHECK: Original escrow, even after machine closure.
    #[account(seeds = [AUTHORITY_SEED.as_bytes(), recovery.gumball_machine.as_ref()], bump)]
    pub authority_pda: UncheckedAccount<'info>,
    /// CHECK: Only the seller recorded at refund can receive the asset.
    pub seller: UncheckedAccount<'info>,
    /// CHECK: Refund payer receives the receipt's rent.
    #[account(mut)]
    pub rent_payer: UncheckedAccount<'info>,
    /// CHECK: Canonical Bubblegum PDA checked in handler.
    #[account(mut)]
    pub tree_config: UncheckedAccount<'info>,
    /// CHECK: Stored tree; owner and asset identity checked in handler.
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    /// CHECK: Membership and transfer rules authenticated by Bubblegum.
    pub core_collection: Option<UncheckedAccount<'info>>,
    /// CHECK: Fixed program.
    #[account(address = MPL_NOOP_PROGRAM)]
    pub log_wrapper: UncheckedAccount<'info>,
    /// CHECK: Fixed program.
    #[account(address = MPL_ACCOUNT_COMPRESSION_PROGRAM)]
    pub compression_program: UncheckedAccount<'info>,
    /// CHECK: Fixed program.
    #[account(address = mpl_bubblegum::ID)]
    pub bubblegum_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    /// CHECK: Address bound to the receipt, including after closure or address reuse.
    #[account(address = recovery.gumball_machine)]
    pub gumball_machine: UncheckedAccount<'info>,
}

pub fn reclaim_cnft_v2<'info>(
    ctx: Context<'info, ReclaimCnftV2<'info>>,
    args: CnftArgsV2,
) -> Result<()> {
    let recovery = &ctx.accounts.recovery;
    let config = ctx
        .remaining_accounts
        .first()
        .ok_or(GumballError::InvalidAuthority)?;
    crate::assert_marketplace_authority(&ctx.accounts.authority.to_account_info(), config)?;
    assert_cnft_v2(args.version, &ctx.accounts.merkle_tree.to_account_info())?;
    require!(
        args.nonce == recovery.nonce && u64::from(args.index) == recovery.nonce,
        GumballError::InvalidMerkleTree
    );
    crate::assert_cnft_asset_id(&recovery.merkle_tree, args.nonce, &recovery.asset)?;
    assert_cnft_tree_config(&ctx.accounts.tree_config.key(), &recovery.merkle_tree)?;
    let collection = ctx
        .accounts
        .core_collection
        .as_ref()
        .map(|a| a.to_account_info());
    let seeds = [
        AUTHORITY_SEED.as_bytes(),
        recovery.gumball_machine.as_ref(),
        &[ctx.bumps.authority_pda],
    ];
    transfer_cnft_v2(
        &ctx.accounts.bubblegum_program.to_account_info(),
        &ctx.accounts.tree_config.to_account_info(),
        &ctx.accounts.authority.to_account_info(),
        &ctx.accounts.authority_pda.to_account_info(),
        &ctx.accounts.authority_pda.to_account_info(),
        &ctx.accounts.seller.to_account_info(),
        &ctx.accounts.merkle_tree.to_account_info(),
        collection.as_ref(),
        &ctx.accounts.log_wrapper.to_account_info(),
        &ctx.accounts.compression_program.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        &ctx.remaining_accounts[1..],
        args.root,
        compute_cnft_data_hash(&args.meta_hash, args.seller_fee_basis_points),
        compute_cnft_creator_hash(&args.creators),
        args.asset_data_hash,
        args.flags,
        args.nonce,
        args.index,
        Some(&seeds),
    )
}
