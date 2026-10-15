use crate::{
    assert_cnft_tree_config, assert_cnft_v2, assert_config_line, cnft_asset_id,
    compute_cnft_creator_hash, compute_cnft_data_hash,
    constants::{
        AUTHORITY_SEED, MPL_ACCOUNT_COMPRESSION_PROGRAM, MPL_NOOP_PROGRAM, SELLER_HISTORY_SEED,
    },
    events::SettleItemSaleEvent,
    is_closed_cnft_v2_tree,
    processors::{claim_item, claim_proceeds, is_item_claimed},
    state::GumballMachine,
    transfer_cnft_v2, verify_cnft_leaf_v2, AssociatedToken, CnftArgsV2, ConfigLine, GumballError,
    SellerHistory, Token, TokenStandard,
};
use anchor_lang::prelude::*;
use mpl_bubblegum::types::LeafSchema;
use utils::{is_native_mint, is_token_2022_account};

/// Settles a Bubblegum v2 compressed NFT sale as a secondary sale.
/// Unclaimed leaves transfer out of escrow; already-claimed leaves are verified
/// against their current owner/delegate. Both paths authenticate all leaf fields.
/// A claimed, burnt leaf uses flags = u8::MAX and an empty-node proof.
/// Leaf royalties fall back to the Core collection Royalties plugin.
///
/// Remaining accounts: payout creator wallets (wallet + ATA for token payment),
/// prefixed by the Token-2022 program slot when needed, then merkle proof nodes.
/// For marketplace-authorized missing-tree settlement, use flags = u8::MAX,
/// a zero root and prefix with the marketplace fee authority signer and canonical
/// guard GlobalConfig, before any Token-2022 slot. SPL replacements require it.
#[event_cpi]
#[derive(Accounts)]
pub struct SettleCnftSaleV2<'info> {
    /// Anyone can settle the sale.
    #[account(mut)]
    payer: Signer<'info>,

    /// Gumball machine account.
    #[account(
        mut,
        has_one = authority @ GumballError::InvalidAuthority,
        constraint = gumball_machine.can_settle_items() @ GumballError::InvalidState
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

    /// Payment account for authority pda if using token payment.
    #[account(mut)]
    authority_pda_payment_account: Option<UncheckedAccount<'info>>,

    /// CHECK: Safe due to gumball machine constraint.
    authority: UncheckedAccount<'info>,

    /// Payment account for authority if using token payment.
    #[account(mut)]
    authority_payment_account: Option<UncheckedAccount<'info>>,

    /// Seller of the cNFT.
    /// CHECK: Safe due to item check.
    #[account(mut)]
    seller: UncheckedAccount<'info>,

    /// Payment account for seller if using token payment.
    #[account(mut)]
    seller_payment_account: Option<UncheckedAccount<'info>>,

    /// Seller history account.
    #[account(
        mut,
        seeds = [
            SELLER_HISTORY_SEED.as_bytes(),
            gumball_machine.key().as_ref(),
            seller.key().as_ref()
        ],
        bump
    )]
    seller_history: Box<Account<'info, SellerHistory>>,

    /// Buyer of the cNFT. Not `mut`: the account is only read (`.key()` /
    /// leaf-transfer target), never written. Marking it `mut` would break unsold
    /// settle, where `buyer == Pubkey::default()` (the System Program) cannot be
    /// a writable account. Mirrors `settle_nft_sale`.
    /// CHECK: Safe due to item check.
    buyer: UncheckedAccount<'info>,

    /// Fee account for marketplace fee if using fee config.
    #[account(mut)]
    fee_account: Option<UncheckedAccount<'info>>,

    /// Payment account for marketplace fee if using token payment.
    #[account(mut)]
    fee_payment_account: Option<UncheckedAccount<'info>>,

    /// Payment mint if using non-native payment token.
    payment_mint: Option<UncheckedAccount<'info>>,

    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,

    /// CHECK: Bubblegum tree authority PDA, verified against merkle_tree.
    #[account(mut)]
    tree_config: UncheckedAccount<'info>,

    /// CHECK: Merkle tree. Untrusted; bound to the stored asset id via
    /// `assert_config_line`.
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
}

pub fn settle_cnft_sale_v2<'info>(
    ctx: Context<'info, SettleCnftSaleV2<'info>>,
    index: u32,
    args: CnftArgsV2,
    current_leaf_owner: Pubkey,
    current_leaf_delegate: Pubkey,
) -> Result<()> {
    let tree = ctx.accounts.merkle_tree.to_account_info();
    // An explicit marketplace prefix authorizes otherwise unprovable replacement
    // evidence. SPL evidence always needs it because config lines also hold v1.
    let admin_evidence = args.flags == u8::MAX
        && (*tree.owner == crate::constants::SPL_ACCOUNT_COMPRESSION_PROGRAM
            || (args.root == [0; 32] && ctx.remaining_accounts.len() >= 2));
    let remaining_accounts = if admin_evidence {
        crate::assert_marketplace_authority(
            ctx.remaining_accounts
                .first()
                .ok_or(GumballError::InvalidAuthority)?,
            ctx.remaining_accounts
                .get(1)
                .ok_or(GumballError::InvalidAuthority)?,
        )?;
        &ctx.remaining_accounts[2..]
    } else {
        ctx.remaining_accounts
    };
    let closed_tree =
        args.flags == u8::MAX && (admin_evidence || is_closed_cnft_v2_tree(&tree, args.index)?);
    if closed_tree {
        require!(
            args.version == crate::constants::BUBBLEGUM_V2_VERSION,
            GumballError::UnsupportedCnftVersion
        );
    } else {
        assert_cnft_v2(args.version, &tree)?;
    }

    let core_collection_info = ctx
        .accounts
        .core_collection
        .as_ref()
        .map(|c| c.to_account_info());
    let core_collection = core_collection_info.as_ref();
    let gumball_machine = &mut ctx.accounts.gumball_machine;
    let seller_history = &mut ctx.accounts.seller_history;
    let payer = &ctx.accounts.payer.to_account_info();
    let buyer = &ctx.accounts.buyer.to_account_info();
    let authority_pda = &mut ctx.accounts.authority_pda.to_account_info();
    let authority = &mut ctx.accounts.authority.to_account_info();
    let seller = &mut ctx.accounts.seller.to_account_info();
    // Immutable alias used as the leaf-transfer target for unsold items.
    let seller_for_to = &ctx.accounts.seller.to_account_info();
    let merkle_tree = &ctx.accounts.merkle_tree.to_account_info();
    let tree_config = &ctx.accounts.tree_config.to_account_info();
    let log_wrapper = &ctx.accounts.log_wrapper.to_account_info();
    let compression_program = &ctx.accounts.compression_program.to_account_info();
    let bubblegum_program = &ctx.accounts.bubblegum_program.to_account_info();
    let token_program = &ctx.accounts.token_program.to_account_info();
    let associated_token_program = &ctx.accounts.associated_token_program.to_account_info();
    let system_program = &ctx.accounts.system_program.to_account_info();

    // Anti-substitution: derive asset id and bind it to the stored config line.
    let asset_id = cnft_asset_id(&merkle_tree.key(), args.nonce);
    assert_cnft_tree_config(&tree_config.key(), &merkle_tree.key())?;

    gumball_machine.assert_can_settle_item(buyer.key())?;

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

    let already_claimed = is_item_claimed(gumball_machine, index)?;
    // Live leaves can have default owner/delegate keys. Bubblegum uses only
    // flag bits 0-2; reserve u8::MAX explicitly for empty-slot verification.
    let is_burnt = already_claimed && args.flags == u8::MAX;
    if closed_tree {
        require!(already_claimed, GumballError::UnsupportedCnftVersion);
    }
    if is_burnt {
        // Bubblegum nonces are leaf indices. Bind the empty slot to the stored
        // asset id so a different, unused slot cannot waive royalties.
        require!(
            args.nonce == u64::from(args.index),
            GumballError::InvalidMerkleTree
        );
    }
    let royalty_info = if is_burnt {
        utils::RoyaltyInfo {
            is_primary_sale: false,
            seller_fee_basis_points: 0,
            creators: None,
        }
    } else {
        crate::get_cnft_v2_royalty_info(&args, core_collection)?
    };

    // Split remaining accounts: the §D5 Token-2022 slot (if any) and the creator
    // payout accounts at the front, then the merkle proof.
    //
    // The slot MUST be inside the front slice: `claim_proceeds` strips it from
    // the head of whatever it is handed. Counting it here — rather than letting
    // it fall into the proof — is what keeps both halves aligned; miss it and
    // the last creator ATA lands in the proof and Bubblegum's verification
    // fails on a shifted proof.
    let is_native = is_native_mint(gumball_machine.settings.payment_mint);
    let per_creator = if is_native { 1 } else { 2 };
    let token22_slot = if !is_native
        && ctx
            .accounts
            .payment_mint
            .as_ref()
            .is_some_and(|mint| is_token_2022_account(&mint.to_account_info()))
    {
        1
    } else {
        0
    };
    let creator_accounts_count =
        royalty_info.creators.as_ref().map_or(0, Vec::len) * per_creator + token22_slot;
    require!(
        creator_accounts_count <= remaining_accounts.len(),
        GumballError::InvalidInputLength
    );
    let (creator_accounts, proof) = remaining_accounts.split_at(creator_accounts_count);

    let payment_mint_info = ctx
        .accounts
        .payment_mint
        .as_ref()
        .map(|mint| mint.to_account_info());
    let payment_mint = payment_mint_info.as_ref();

    let authority_pda_payment_account_info = ctx
        .accounts
        .authority_pda_payment_account
        .as_ref()
        .map(|account| account.to_account_info());
    let authority_pda_payment_account = authority_pda_payment_account_info.as_ref();

    let authority_payment_account_info = ctx
        .accounts
        .authority_payment_account
        .as_ref()
        .map(|account| account.to_account_info());
    let authority_payment_account = authority_payment_account_info.as_ref();

    let seller_payment_account_info = ctx
        .accounts
        .seller_payment_account
        .as_ref()
        .map(|account| account.to_account_info());
    let seller_payment_account = seller_payment_account_info.as_ref();

    let mut fee_account_info = ctx
        .accounts
        .fee_account
        .as_ref()
        .map(|account| account.to_account_info());
    let fee_account = fee_account_info.as_mut();

    let fee_payment_account_info = ctx
        .accounts
        .fee_payment_account
        .as_ref()
        .map(|account| account.to_account_info());
    let fee_payment_account = fee_payment_account_info.as_ref();

    let auth_seeds = [
        AUTHORITY_SEED.as_bytes(),
        gumball_machine.to_account_info().key.as_ref(),
        &[ctx.bumps.authority_pda],
    ];

    let (data_hash, creator_hash) = if is_burnt {
        ([0; 32], [0; 32])
    } else {
        (
            compute_cnft_data_hash(&args.meta_hash, args.seller_fee_basis_points),
            compute_cnft_creator_hash(&args.creators),
        )
    };

    let mut amount = 0;
    if !already_claimed {
        amount = 1;

        // Mark claimed then move the leaf out of escrow. The Transfer CPI verifies
        // creator_hash/data_hash here, making the royalty payout below trustless.
        claim_item(gumball_machine, index)?;

        // Unsold items (buyer == default) return to the seller.
        let new_leaf_owner = if buyer.key() == Pubkey::default() {
            seller_for_to
        } else {
            buyer
        };

        transfer_cnft_v2(
            bubblegum_program,
            tree_config,
            payer,
            authority_pda,
            authority_pda,
            new_leaf_owner,
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
    } else if is_burnt {
        // VerifyLeaf proves against the current tree, fast-forwarding historical
        // proofs and rejecting changed leaves. An old pre-mint empty root cannot
        // prove a live claimed leaf is burnt.
        if !closed_tree {
            verify_cnft_leaf_v2(
                compression_program,
                merkle_tree,
                proof,
                args.root,
                [0; 32],
                args.index,
            )?;
        }
    } else {
        // The leaf already left escrow via `claim_cnft`, so no Transfer CPI runs
        // here — and that CPI was the only thing binding `args.creators` /
        // `args.seller_fee_basis_points` to the real asset. Unverified, they'd
        // let anyone settle with fake creators/sfbp and redirect the seller's
        // proceeds. Restore the binding by verifying the CURRENT leaf (owner and
        // delegate as of now, supplied by the caller from DAS — the buyer right
        // after claim, or a later holder if the buyer has moved it) against the
        // tree. `args.root` and the proof must likewise be current.
        let leaf = LeafSchema::V2 {
            id: asset_id,
            owner: current_leaf_owner,
            delegate: current_leaf_delegate,
            nonce: args.nonce,
            data_hash,
            creator_hash,
            collection_hash: mpl_bubblegum::hash::hash_collection_option(
                core_collection.map(|c| c.key()),
            )?,
            asset_data_hash: args
                .asset_data_hash
                .unwrap_or(mpl_bubblegum::hash::DEFAULT_ASSET_DATA_HASH),
            flags: args.flags,
        }
        .hash();
        verify_cnft_leaf_v2(
            compression_program,
            merkle_tree,
            proof,
            args.root,
            leaf,
            args.index,
        )?;
    }

    let total_proceeds = claim_proceeds(
        gumball_machine,
        index,
        seller_history,
        payer,
        authority_pda,
        authority_pda_payment_account,
        authority,
        authority_payment_account,
        seller,
        seller_payment_account,
        fee_account,
        fee_payment_account,
        payment_mint,
        &royalty_info,
        creator_accounts,
        associated_token_program,
        token_program,
        system_program,
        &auth_seeds,
    )?;

    emit_cpi!(SettleItemSaleEvent {
        mint: asset_id,
        authority: gumball_machine.authority.key(),
        seller: seller.key(),
        buyer: buyer.key(),
        total_proceeds,
        payment_mint: gumball_machine.settings.payment_mint,
        fee_config: gumball_machine.marketplace_fee_config,
        curator_fee_bps: gumball_machine.settings.curator_fee_bps,
        amount
    });

    Ok(())
}
