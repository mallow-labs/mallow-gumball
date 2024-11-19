use crate::{
    assert_can_request_add_item, assert_no_permanent_delegates, 
    constants::{ADD_ITEM_REQUEST_SEED, SELLER_HISTORY_SEED}, 
    state::GumballMachine, AddItemRequest, GumballError, SellerHistory, TokenStandard
};
use anchor_lang::prelude::*;
use mpl_core::{
    accounts::BaseAssetV1,
    fetch_plugin,
    instructions::{
        AddPluginV1CpiBuilder, ApprovePluginAuthorityV1CpiBuilder, UpdatePluginV1CpiBuilder,
    },
    types::{
        FreezeDelegate,
        Plugin, PluginAuthority, PluginType, TransferDelegate,
    },
};

/// Request to add a core asset to a gumball machine.
#[derive(Accounts)]
pub struct RequestAddCoreAsset<'info> {
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

    /// Add item request account.
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

    /// Seller of the asset.
    #[account(mut)]
    seller: Signer<'info>,

    /// CHECK: Safe due to freeze
    #[account(mut)]
    asset: UncheckedAccount<'info>,

    /// Core asset's collection if it's part of one.
    /// CHECK: Verified in mpl_core processors
    #[account(mut)]
    collection: Option<UncheckedAccount<'info>>,

    /// CHECK: Safe due to address constraint
    #[account(address = mpl_core::ID)]
    mpl_core_program: UncheckedAccount<'info>,

    system_program: Program<'info, System>,
}

pub fn request_add_core_asset(
    ctx: Context<RequestAddCoreAsset>,
) -> Result<()> {
    let asset_info = &ctx.accounts.asset.to_account_info();
    let seller = &ctx.accounts.seller.to_account_info();
    let mpl_core_program = &ctx.accounts.mpl_core_program.to_account_info();
    let system_program = &ctx.accounts.system_program.to_account_info();
    let add_item_request = &mut ctx.accounts.add_item_request;
    let gumball_machine = &mut ctx.accounts.gumball_machine;
    let seller_history = &mut ctx.accounts.seller_history;

    add_item_request.init(
        gumball_machine.key(), 
        seller.key(),
         ctx.accounts.asset.key(),
          TokenStandard::Core
    )?;

    seller_history.gumball_machine = gumball_machine.key();
    seller_history.seller = seller.key();

    // Validate the seller
    assert_can_request_add_item(gumball_machine, seller_history)?;

    seller_history.item_count += 1;

    let collection_info = ctx
        .accounts
        .collection
        .as_ref()
        .map(|account| account.to_account_info());
    let collection = collection_info.as_ref();

    assert_no_permanent_delegates(collection)?;

    let authority_address = add_item_request.key();

    // Approve
    if let Err(_) =
        fetch_plugin::<BaseAssetV1, TransferDelegate>(asset_info, PluginType::TransferDelegate)
    {
        AddPluginV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(seller)
            .plugin(Plugin::TransferDelegate(TransferDelegate {}))
            .init_authority(PluginAuthority::Address {
                address: authority_address,
            })
            .system_program(system_program)
            .invoke()?;
    } else {
        ApprovePluginAuthorityV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(seller)
            .new_authority(PluginAuthority::Address {
                address: authority_address,
            })
            .plugin_type(PluginType::TransferDelegate)
            .system_program(system_program)
            .invoke()?;
    }

    let auth_seeds = add_item_request.auth_seeds();

    // Freeze
    if let Err(_) =
        fetch_plugin::<BaseAssetV1, TransferDelegate>(asset_info, PluginType::FreezeDelegate)
    {
        AddPluginV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(seller)
            .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: true }))
            .init_authority(PluginAuthority::Address {
                address: authority_address,
            })
            .system_program(system_program)
            .invoke_signed(&[&auth_seeds])?;
    } else {
        ApprovePluginAuthorityV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(seller)
            .new_authority(PluginAuthority::Address {
                address: authority_address,
            })
            .plugin_type(PluginType::FreezeDelegate)
            .system_program(system_program)
            .invoke()?;

        UpdatePluginV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(seller)
            .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: true }))
            .authority(Some(&add_item_request.to_account_info()))
            .system_program(system_program)
            .invoke_signed(&[&auth_seeds])?;
    }

    Ok(())
}
