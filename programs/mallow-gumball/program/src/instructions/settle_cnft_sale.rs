use crate::{
    assert_cnft_tree_config, assert_cnft_v1, assert_config_line, cnft_asset_id,
    compute_cnft_creator_hash, compute_cnft_data_hash,
    constants::{
        AUTHORITY_SEED, SELLER_HISTORY_SEED, SPL_ACCOUNT_COMPRESSION_PROGRAM, SPL_NOOP_PROGRAM,
    },
    events::SettleItemSaleEvent,
    processors::{claim_item, claim_proceeds, is_item_claimed},
    state::GumballMachine,
    transfer_cnft, AssociatedToken, CnftArgs, ConfigLine, GumballError, SellerHistory, Token,
    TokenStandard,
};
use anchor_lang::prelude::*;
use mpl_token_metadata::types::Creator as MetadataCreator;
use utils::{is_native_mint, RoyaltyInfo};

/// Settles a compressed NFT sale.
///
/// Mirrors `settle_nft_sale`: if the item hasn't been claimed yet, the leaf is
/// transferred out of escrow (`PDA -> buyer`, or `PDA -> seller` if unsold), then
/// proceeds are distributed. Royalties are paid from the `creators` arg, which is
/// proof-bound by the Transfer CPI (`creator_hash`) and `seller_fee_basis_points`
/// (folded into `data_hash`).
///
/// Remaining accounts layout: `[creator payout accounts..., proof nodes...]`.
/// The creator payout accounts (one per creator for native payment, two per
/// creator — wallet + token account — for SPL payment) come first because
/// `claim_proceeds` consumes them from the front; the merkle proof follows and is
/// used by the Transfer CPI.
#[event_cpi]
#[derive(Accounts)]
pub struct SettleCnftSale<'info> {
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
    #[account(mut)]
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

    /// Buyer of the cNFT.
    /// CHECK: Safe due to item check.
    #[account(mut)]
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
    tree_config: UncheckedAccount<'info>,

    /// CHECK: Merkle tree. Untrusted; bound to the stored asset id via
    /// `assert_config_line`.
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
}

pub fn settle_cnft_sale<'info>(
    ctx: Context<'_, '_, '_, 'info, SettleCnftSale<'info>>,
    index: u32,
    args: CnftArgs,
) -> Result<()> {
    assert_cnft_v1(args.version)?;

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

    // Secondary trading only: royalties are the seller-fee split, computed from
    // the proof-bound creators + sfbp.
    let royalty_info = RoyaltyInfo {
        is_primary_sale: false,
        seller_fee_basis_points: args.seller_fee_basis_points,
        creators: Some(
            args.creators
                .iter()
                .map(|c| MetadataCreator {
                    address: c.address,
                    verified: c.verified,
                    share: c.share,
                })
                .collect(),
        ),
    };

    // Split remaining accounts: creator payout accounts (front) then proof (back).
    let is_native = is_native_mint(gumball_machine.settings.payment_mint);
    let per_creator = if is_native { 1 } else { 2 };
    let creator_accounts_count = args.creators.len() * per_creator;
    require!(
        creator_accounts_count <= ctx.remaining_accounts.len(),
        GumballError::InvalidInputLength
    );
    let (creator_accounts, proof) = ctx.remaining_accounts.split_at(creator_accounts_count);

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

    let mut amount = 0;
    if !is_item_claimed(gumball_machine, index)? {
        amount = 1;

        // Mark claimed then move the leaf out of escrow. The Transfer CPI verifies
        // creator_hash/data_hash here, making the royalty payout below trustless.
        claim_item(gumball_machine, index)?;

        let data_hash = compute_cnft_data_hash(&args.meta_hash, args.seller_fee_basis_points);
        let creator_hash = compute_cnft_creator_hash(&args.creators);

        // Unsold items (buyer == default) return to the seller.
        let new_leaf_owner = if buyer.key() == Pubkey::default() {
            seller_for_to
        } else {
            buyer
        };

        transfer_cnft(
            bubblegum_program,
            tree_config,
            authority_pda,
            new_leaf_owner,
            merkle_tree,
            log_wrapper,
            compression_program,
            system_program,
            proof,
            args.root,
            data_hash,
            creator_hash,
            args.nonce,
            args.index,
            Some(&auth_seeds),
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
