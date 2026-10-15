use crate::{
    assert_cnft_v2, assert_current_cnft_v2_root,
    constants::{AUTHORITY_SEED, MPL_ACCOUNT_COMPRESSION_PROGRAM},
    is_closed_cnft_v2_tree, verify_cnft_leaf_v2, CnftRecovery, CnftV2RefundLeaf, GumballError,
    CNFT_RECOVERY_SEED,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CloseMissingCnftRecoveryV2<'info> {
    pub payer: Signer<'info>,
    #[account(mut, close = rent_payer,
        seeds = [CNFT_RECOVERY_SEED, recovery.gumball_machine.as_ref(), recovery.merkle_tree.as_ref(), &recovery.nonce.to_le_bytes()],
        bump, has_one = merkle_tree, has_one = rent_payer)]
    pub recovery: Account<'info, CnftRecovery>,
    /// CHECK: Original receipt payer receives its rent.
    #[account(mut)]
    pub rent_payer: UncheckedAccount<'info>,
    /// CHECK: Stored tree; owner and current proof checked in handler.
    pub merkle_tree: UncheckedAccount<'info>,
    /// CHECK: Fixed compression program.
    #[account(address = MPL_ACCOUNT_COMPRESSION_PROGRAM)]
    pub compression_program: UncheckedAccount<'info>,
}

pub fn close_missing_cnft_recovery_v2<'info>(
    ctx: Context<'info, CloseMissingCnftRecoveryV2<'info>>,
    root: [u8; 32],
    leaf: Option<CnftV2RefundLeaf>,
) -> Result<()> {
    let recovery = &ctx.accounts.recovery;
    let tree = ctx.accounts.merkle_tree.to_account_info();
    let leaf_index =
        u32::try_from(recovery.nonce).map_err(|_| error!(GumballError::InvalidMerkleTree))?;
    // The marketplace can attest to loss when a replacement's appended slot
    // has no usable leaf proof. This does not widen permissionless evidence.
    if leaf.is_none() && root == [0; 32] && ctx.remaining_accounts.len() >= 2 {
        crate::assert_marketplace_authority(
            &ctx.remaining_accounts[0],
            &ctx.remaining_accounts[1],
        )?;
        return Ok(());
    }
    // Only v2 recovery creates this typed receipt, so an SPL replacement cannot
    // be confused with a live v1 config line here.
    if leaf.is_none()
        && (*tree.owner == crate::constants::SPL_ACCOUNT_COMPRESSION_PROGRAM
            || is_closed_cnft_v2_tree(&tree, leaf_index)?)
    {
        return Ok(());
    }
    assert_cnft_v2(2, &tree)?;
    let escrow = Pubkey::find_program_address(
        &[AUTHORITY_SEED.as_bytes(), recovery.gumball_machine.as_ref()],
        &crate::ID,
    )
    .0;
    let hash = if let Some(leaf) = leaf {
        require_keys_neq!(leaf.owner, escrow, GumballError::AssetDeliverable);
        leaf.hash(recovery.asset, recovery.nonce)
    } else {
        [0; 32]
    };
    assert_current_cnft_v2_root(&tree, &root)?;
    verify_cnft_leaf_v2(
        &ctx.accounts.compression_program.to_account_info(),
        &tree,
        ctx.remaining_accounts,
        root,
        hash,
        leaf_index,
    )
}
