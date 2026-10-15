use crate::{
    assert_cnft_v2, assert_config_line, assert_current_cnft_v2_root, cnft_asset_id,
    constants::{AUTHORITY_SEED, MPL_ACCOUNT_COMPRESSION_PROGRAM, SELLER_HISTORY_SEED},
    get_bit_byte_info, is_closed_cnft_v2_tree,
    processors::{claim_item, transfer_or_park},
    verify_cnft_leaf_v2, CnftRecovery, CnftV2RefundLeaf, ConfigLine, GumballError, GumballMachine,
    GumballState, SellerHistory, TokenStandard, CNFT_RECOVERY_SEED,
};
use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token_interface::TokenInterface};
use utils::is_native_mint;

#[event_cpi]
#[derive(Accounts)]
#[instruction(index: u32, nonce: u64)]
pub struct RefundCnftSaleV2<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut,
        constraint = matches!(gumball_machine.state, GumballState::SaleLive | GumballState::SaleEnded) @ GumballError::InvalidState,
        constraint = gumball_machine.version >= 6 @ GumballError::InvalidVersion)]
    pub gumball_machine: Box<Account<'info, GumballMachine>>,
    /// CHECK: Escrow and payment authority, bound by seeds.
    #[account(mut, seeds = [AUTHORITY_SEED.as_bytes(), gumball_machine.key().as_ref()], bump)]
    pub authority_pda: UncheckedAccount<'info>,
    /// CHECK: Bound to the recorded config line.
    #[account(mut)]
    pub seller: UncheckedAccount<'info>,
    #[account(mut, seeds = [SELLER_HISTORY_SEED.as_bytes(), gumball_machine.key().as_ref(), seller.key().as_ref()],
        bump, has_one = gumball_machine, has_one = seller)]
    pub seller_history: Box<Account<'info, SellerHistory>>,
    /// CHECK: Must be the recorded buyer, or absent for an unsold item.
    #[account(mut)]
    pub buyer: Option<UncheckedAccount<'info>>,
    /// CHECK: Payment helper validates the escrow ATA and mint.
    #[account(mut)]
    pub authority_pda_payment_account: Option<UncheckedAccount<'info>>,
    /// CHECK: Payment helper validates the recorded buyer's ATA.
    #[account(mut)]
    pub buyer_payment_account: Option<UncheckedAccount<'info>>,
    /// CHECK: Validated against the machine's payment mint and token program.
    pub payment_mint: Option<UncheckedAccount<'info>>,
    /// CHECK: Bound to the recorded asset via tree and nonce.
    pub merkle_tree: UncheckedAccount<'info>,
    #[account(init, payer = payer, space = 8 + CnftRecovery::INIT_SPACE,
        seeds = [CNFT_RECOVERY_SEED, gumball_machine.key().as_ref(), merkle_tree.key().as_ref(), &nonce.to_le_bytes()], bump)]
    pub recovery: Account<'info, CnftRecovery>,
    /// CHECK: Fixed program authenticates the current leaf proof.
    #[account(address = MPL_ACCOUNT_COMPRESSION_PROGRAM)]
    pub compression_program: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    /// CHECK: Core ownership/type and proof-bound membership checked for Permanent* evidence.
    pub core_collection: Option<UncheckedAccount<'info>>,
}

#[event]
pub struct RefundCnftSaleEvent {
    pub gumball_machine: Pubkey,
    pub mint: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub payment_mint: Pubkey,
    pub refund_amount: u64,
    pub recovery: Option<Pubkey>,
}

/// Remaining accounts are only proof nodes. None proves an empty (burnt) slot.
pub fn refund_cnft_sale_v2<'info>(
    ctx: Context<'info, RefundCnftSaleV2<'info>>,
    index: u32,
    nonce: u64,
    root: [u8; 32],
    leaf: Option<CnftV2RefundLeaf>,
) -> Result<()> {
    refund_cnft_sale_v2_inner(ctx, index, nonce, root, leaf, false)
}

/// Remaining accounts start with the marketplace signer and canonical guard GlobalConfig.
/// Operator tooling must first simulate claim and reject successful delivery.
pub fn admin_refund_cnft_sale_v2<'info>(
    ctx: Context<'info, RefundCnftSaleV2<'info>>,
    index: u32,
    nonce: u64,
    root: [u8; 32],
    leaf: Option<CnftV2RefundLeaf>,
) -> Result<()> {
    refund_cnft_sale_v2_inner(ctx, index, nonce, root, leaf, true)
}

fn refund_cnft_sale_v2_inner<'info>(
    ctx: Context<'info, RefundCnftSaleV2<'info>>,
    index: u32,
    nonce: u64,
    root: [u8; 32],
    leaf: Option<CnftV2RefundLeaf>,
    admin: bool,
) -> Result<()> {
    let proof = if admin {
        let authority = ctx
            .remaining_accounts
            .first()
            .ok_or(GumballError::InvalidAuthority)?;
        let config = ctx
            .remaining_accounts
            .get(1)
            .ok_or(GumballError::InvalidAuthority)?;
        crate::assert_marketplace_authority(authority, config)?;
        &ctx.remaining_accounts[2..]
    } else {
        ctx.remaining_accounts
    };
    let tree = ctx.accounts.merkle_tree.to_account_info();
    // Bubblegum allocates nonce == index. Derive the slot instead of accepting
    // a separate index that could redirect an empty-node proof to another asset.
    let leaf_index = u32::try_from(nonce).map_err(|_| error!(GumballError::InvalidMerkleTree))?;
    let closed_tree = leaf.is_none() && (admin || is_closed_cnft_v2_tree(&tree, leaf_index)?);
    if !closed_tree {
        assert_cnft_v2(2, &tree)?;
    }
    let asset = cnft_asset_id(tree.key, nonce);
    let buyer_key = ctx
        .accounts
        .buyer
        .as_ref()
        .map_or(Pubkey::default(), |b| b.key());
    let machine = &mut ctx.accounts.gumball_machine;
    assert_config_line(
        machine,
        index,
        ConfigLine {
            mint: asset,
            seller: ctx.accounts.seller.key(),
            buyer: buyer_key,
            token_standard: TokenStandard::Compressed,
        },
        false,
    )?;
    require!(
        buyer_key != Pubkey::default() || machine.state == GumballState::SaleEnded,
        GumballError::InvalidState
    );
    if buyer_key == Pubkey::default() {
        require!(
            admin
                || ctx.accounts.payer.key() == ctx.accounts.seller.key()
                || ctx.accounts.payer.key() == machine.authority,
            GumballError::InvalidAuthority
        );
    }
    let still_escrowed = leaf
        .as_ref()
        .is_some_and(|l| l.owner == ctx.accounts.authority_pda.key());
    let hash = if let Some(leaf) = &leaf {
        if !admin && still_escrowed && leaf.flags == 0 {
            let collection = ctx
                .accounts
                .core_collection
                .as_ref()
                .ok_or(GumballError::AssetDeliverable)?;
            require!(
                leaf.collection_hash
                    == mpl_bubblegum::hash::hash_collection_option(Some(collection.key()))
                        .map_err(|_| error!(GumballError::InvalidRefundEvidence))?,
                GumballError::InvalidRefundEvidence
            );
            require!(
                buyer_key != Pubkey::default()
                    && crate::cnft_collection_has_permanent_delegate(
                        &collection.to_account_info()
                    )?,
                GumballError::AssetDeliverable
            );
            // Delivery remains available: only the buyer chooses this refund.
            require!(
                ctx.accounts.buyer.as_ref().is_some_and(|b| b.is_signer),
                GumballError::InvalidAuthority
            );
        }
        leaf.hash(asset, nonce)
    } else {
        [0; 32]
    };
    if !closed_tree {
        assert_current_cnft_v2_root(&tree, &root)?;
        verify_cnft_leaf_v2(
            &ctx.accounts.compression_program.to_account_info(),
            &tree,
            proof,
            root,
            hash,
            leaf_index,
        )?;
    }

    // A claimed item already delivered value; it cannot be refunded here.
    claim_item(machine, index)?;
    let info = machine.to_account_info();
    let mut data = info.try_borrow_mut_data()?;
    let (byte, _, mask) = get_bit_byte_info(
        machine.get_settled_items_bit_mask_position()?,
        index as usize,
    )?;
    require!(data[byte] & mask == 0, GumballError::ItemAlreadySettled);
    let settled = machine.get_total_proceeds_settled(&data)?;
    let amount = if buyer_key == Pubkey::default() {
        0
    } else {
        machine.get_draw_payment(&data, index)?
    };
    // Refund gross revenue, never a pooled share or settlement proceeds.
    machine.total_revenue = machine
        .total_revenue
        .checked_sub(amount)
        .ok_or(GumballError::NumericalOverflowError)?;
    require!(
        machine.total_revenue >= settled,
        GumballError::NumericalOverflowError
    );
    if buyer_key != Pubkey::default() {
        let refunded_position = machine.get_items_refunded_position()?;
        let refunded = machine.get_items_refunded(&data)?;
        data[refunded_position..refunded_position + 8].copy_from_slice(
            &refunded
                .checked_add(1)
                .ok_or(GumballError::NumericalOverflowError)?
                .to_le_bytes(),
        );
        data[byte] |= mask;
    }
    drop(data);

    let mint = ctx
        .accounts
        .payment_mint
        .as_ref()
        .map(|a| a.to_account_info());
    let native = is_native_mint(machine.settings.payment_mint);
    require!(
        if native {
            mint.is_none()
        } else {
            mint.as_ref()
                .is_some_and(|m| m.key() == machine.settings.payment_mint)
        },
        GumballError::InvalidPaymentMint
    );
    if amount > 0 {
        let from_ata = ctx
            .accounts
            .authority_pda_payment_account
            .as_ref()
            .map(|a| a.to_account_info());
        let to_ata = ctx
            .accounts
            .buyer_payment_account
            .as_ref()
            .map(|a| a.to_account_info());
        require!(
            native || (from_ata.is_some() && to_ata.is_some()),
            GumballError::MissingTokenAccount
        );
        let machine_key = machine.key();
        let seeds = [
            AUTHORITY_SEED.as_bytes(),
            machine_key.as_ref(),
            &[ctx.bumps.authority_pda],
        ];
        if let Some((recipient, rent_payer)) = transfer_or_park(
            machine,
            &mut ctx.accounts.authority_pda.to_account_info(),
            &mut ctx.accounts.buyer.as_ref().unwrap().to_account_info(),
            from_ata.as_ref(),
            to_ata.as_ref(),
            mint.as_ref(),
            Some(&ctx.accounts.payer.to_account_info()),
            Some(&ctx.accounts.associated_token_program.to_account_info()),
            Some(&ctx.accounts.token_program.to_account_info()),
            &ctx.accounts.system_program.to_account_info(),
            &seeds,
            None,
            amount,
            0,
            &[ctx.accounts.seller.to_account_info()],
            &[],
        )? {
            crate::processors::finish_folded_claim(
                machine,
                &ctx.accounts.authority_pda.to_account_info(),
                &recipient,
                &rent_payer,
            )?;
        }
    }
    // Unsold recovery skips only delivery. Its seller history and pooled share
    // stay open for ordinary settlement with authenticated royalty metadata.
    // This works before or after other payouts without changing their divisor.
    if buyer_key != Pubkey::default() {
        ctx.accounts.seller_history.item_count = ctx
            .accounts
            .seller_history
            .item_count
            .checked_sub(1)
            .ok_or(GumballError::NumericalOverflowError)?;
        if ctx.accounts.seller_history.item_count == 0 {
            ctx.accounts
                .seller_history
                .close(ctx.accounts.seller.to_account_info())?;
        }
        machine.items_settled = machine
            .items_settled
            .checked_add(1)
            .ok_or(GumballError::NumericalOverflowError)?;
    }
    let recovery_key = if still_escrowed {
        ctx.accounts.recovery.set_inner(CnftRecovery {
            gumball_machine: machine.key(),
            authority: machine.authority,
            seller: ctx.accounts.seller.key(),
            asset,
            merkle_tree: tree.key(),
            nonce,
            rent_payer: ctx.accounts.payer.key(),
        });
        Some(ctx.accounts.recovery.key())
    } else {
        ctx.accounts
            .recovery
            .close(ctx.accounts.payer.to_account_info())?;
        None
    };
    emit_cpi!(RefundCnftSaleEvent {
        gumball_machine: machine.key(),
        mint: asset,
        seller: ctx.accounts.seller.key(),
        buyer: buyer_key,
        payment_mint: machine.settings.payment_mint,
        refund_amount: amount,
        recovery: recovery_key
    });
    Ok(())
}
