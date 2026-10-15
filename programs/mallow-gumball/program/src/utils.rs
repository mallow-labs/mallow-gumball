use crate::{
    constants::GUMBALL_MACHINE_SIZE, instructions::AddItemArgs, ConfigLine, ConfigLineV2,
    GumballError, GumballMachine, GumballState, SellerHistory, TokenStandard,
};
use anchor_lang::prelude::*;
use anchor_spl::token::approve;
use anchor_spl::token::Approve;
use anchor_spl::token_2022::spl_token_2022::{
    extension::StateWithExtensions, state::Account as SplTokenAccount,
};
use anchor_spl::token_interface::{
    close_account as close_currency_account, CloseAccount as CloseCurrencyAccount,
};
use arrayref::array_ref;
use mpl_core::{
    accounts::BaseAssetV1,
    fetch_plugin,
    instructions::{
        AddPluginV1CpiBuilder, ApprovePluginAuthorityV1CpiBuilder, RemovePluginV1CpiBuilder,
        RevokePluginAuthorityV1CpiBuilder, UpdatePluginV1CpiBuilder,
    },
    types::{
        FreezeDelegate, Plugin, PluginAuthority, PluginType, TransferDelegate, UpdateAuthority,
    },
    Asset, Collection,
};
use mpl_token_metadata::{
    accounts::{Metadata, TokenRecord},
    instructions::{
        DelegateCpiBuilder, FreezeDelegatedAccountCpi, FreezeDelegatedAccountCpiAccounts,
        LockCpiBuilder, RevokeCpiBuilder, ThawDelegatedAccountCpi, ThawDelegatedAccountCpiAccounts,
        UnlockCpiBuilder,
    },
    types::{
        AuthorizationData, DelegateArgs, LockArgs, ProgrammableConfig, RevokeArgs,
        TokenDelegateRole, TokenStandard as MplTokenStandard, UnlockArgs,
    },
};
use solana_program::{
    account_info::AccountInfo,
    program_memory::sol_memcmp,
    pubkey::{Pubkey, PUBKEY_BYTES},
};
use utils::{assert_keys_equal, get_auth_payload, transfer_spl, verify_proof};

/// Anchor wrapper for Token program.
#[derive(Debug, Clone)]
pub struct Token;

impl anchor_lang::Id for Token {
    fn id() -> Pubkey {
        anchor_spl::token::ID
    }
}

/// Anchor wrapper for Associated Token program.
#[derive(Debug, Clone)]
pub struct AssociatedToken;

impl anchor_lang::Id for AssociatedToken {
    fn id() -> Pubkey {
        anchor_spl::associated_token::ID
    }
}

pub fn assert_can_add_item(
    gumball_machine: &mut Box<Account<GumballMachine>>,
    seller_history: &mut Box<Account<SellerHistory>>,
    quantity: u16,
    args: &AddItemArgs,
) -> Result<()> {
    let AddItemArgs {
        seller_proof_path,
        index,
    } = args;

    // Having an index means we're re-adding an item
    if index.is_some() {
        // Can only add item back to a live solo gumball
        require!(!gumball_machine.is_collab(), GumballError::NotASoloGumball);
        require!(
            gumball_machine.state == GumballState::SaleLive,
            GumballError::InvalidState
        );
    }

    let seller = seller_history.seller;

    if seller == gumball_machine.authority {
        return Ok(());
    }

    if seller_history.item_count + quantity as u64
        > gumball_machine.settings.items_per_seller as u64
    {
        return err!(GumballError::SellerTooManyItems);
    }

    if seller_proof_path.is_none() || gumball_machine.settings.sellers_merkle_root.is_none() {
        return err!(GumballError::InvalidProofPath);
    }

    let leaf = solana_program::keccak::hashv(&[seller.to_string().as_bytes()]);
    require!(
        verify_proof(
            &seller_proof_path.as_ref().unwrap()[..],
            &gumball_machine.settings.sellers_merkle_root.unwrap(),
            &leaf.to_bytes(),
        ),
        GumballError::InvalidProofPath
    );

    Ok(())
}

pub fn assert_can_request_add_item(
    gumball_machine: &mut Box<Account<GumballMachine>>,
    seller_history: &mut Box<Account<SellerHistory>>,
) -> Result<()> {
    let seller = seller_history.seller;

    if seller == gumball_machine.authority {
        return err!(GumballError::SellerCannotBeAuthority);
    }

    if seller_history.item_count >= gumball_machine.settings.items_per_seller as u64 {
        return err!(GumballError::SellerTooManyItems);
    }

    Ok(())
}

/// Live requests occupy eight reserved header bytes on every account version.
/// The URI bound leaves at least nine bytes before the hidden config section.
// Old machines fail closed until the marketplace attests a complete request scan.
pub const ADD_REQUESTS_MIGRATED_POSITION: usize = GUMBALL_MACHINE_SIZE - 9;

pub fn add_requests_migrated(data: &[u8]) -> bool {
    data.get(ADD_REQUESTS_MIGRATED_POSITION) == Some(&1)
}

pub const PENDING_ADD_REQUESTS_POSITION: usize = GUMBALL_MACHINE_SIZE - 8;

pub fn pending_add_requests(data: &[u8]) -> Result<u64> {
    let bytes = data
        .get(PENDING_ADD_REQUESTS_POSITION..GUMBALL_MACHINE_SIZE)
        .ok_or(GumballError::InvalidGumballMachine)?;
    Ok(u64::from_le_bytes(bytes.try_into().unwrap()))
}

pub fn extend_add_item_request<'info>(
    request: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    rent: &Rent,
) -> Result<()> {
    if request.data_len() < crate::AddItemRequest::TRACKED_SPACE {
        let top_up = rent
            .minimum_balance(crate::AddItemRequest::TRACKED_SPACE)
            .saturating_sub(request.lamports());
        if top_up > 0 {
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    system_program.key(),
                    anchor_lang::system_program::Transfer {
                        from: payer.clone(),
                        to: request.clone(),
                    },
                ),
                top_up,
            )?;
        }
        request.resize(crate::AddItemRequest::TRACKED_SPACE)?;
    }
    Ok(())
}

pub fn track_add_item_request(request: &AccountInfo, machine: &AccountInfo) -> Result<()> {
    let mut data = machine.try_borrow_mut_data()?;
    let count = pending_add_requests(&data)?
        .checked_add(1)
        .ok_or(GumballError::NumericalOverflowError)?;
    data[PENDING_ADD_REQUESTS_POSITION..GUMBALL_MACHINE_SIZE].copy_from_slice(&count.to_le_bytes());
    request.try_borrow_mut_data()?[crate::AddItemRequest::SPACE + 1] = 1;
    Ok(())
}

pub fn resolve_add_item_request(request: &AccountInfo, machine: &AccountInfo) -> Result<()> {
    if !crate::AddItemRequest::is_tracked(request)? {
        return Ok(());
    }
    // Cancellation still works after the machine has closed.
    if *machine.owner != crate::ID {
        return Ok(());
    }
    let mut data = machine.try_borrow_mut_data()?;
    let count = pending_add_requests(&data)?
        .checked_sub(1)
        .ok_or(GumballError::InvalidGumballMachine)?;
    data[PENDING_ADD_REQUESTS_POSITION..GUMBALL_MACHINE_SIZE].copy_from_slice(&count.to_le_bytes());
    Ok(())
}

/// New cancellations append the writable machine after proof nodes. Legacy
/// requests keep accepting their original account lists.
pub fn resolve_cancelled_add_item_request<'a, 'info>(
    request: &Account<crate::AddItemRequest>,
    remaining: &'a [AccountInfo<'info>],
) -> Result<&'a [AccountInfo<'info>]> {
    if let Some(machine) = remaining
        .last()
        .filter(|a| a.key() == request.gumball_machine)
    {
        require!(machine.is_writable, GumballError::InvalidGumballMachine);
        // A closed machine can be recreated or assigned by its keypair holder.
        // Request cancellation must not depend on unrelated data at that address.
        let live_count = if *machine.owner == crate::ID {
            use anchor_lang::Discriminator;
            let data = machine.try_borrow_data()?;
            if data.len() >= GUMBALL_MACHINE_SIZE
                && data.starts_with(crate::GumballMachine::DISCRIMINATOR)
            {
                pending_add_requests(&data)?
            } else {
                0
            }
        } else {
            0
        };
        if live_count > 0 {
            resolve_add_item_request(&request.to_account_info(), machine)?;
        }
        return Ok(&remaining[..remaining.len() - 1]);
    }
    require!(
        !crate::AddItemRequest::is_tracked(&request.to_account_info())?,
        GumballError::InvalidGumballMachine
    );
    Ok(remaining)
}

/// Trust the guard's canonical global fee authority, never a machine creator.
pub fn assert_marketplace_authority(authority: &AccountInfo, config: &AccountInfo) -> Result<()> {
    let expected = Pubkey::find_program_address(
        &[b"global_config"],
        &crate::constants::GUMBALL_GUARD_PROGRAM,
    )
    .0;
    require!(authority.is_signer, GumballError::InvalidAuthority);
    require_keys_eq!(config.key(), expected, GumballError::InvalidAuthority);
    require_keys_eq!(
        *config.owner,
        crate::constants::GUMBALL_GUARD_PROGRAM,
        GumballError::InvalidAuthority
    );
    let data = config.try_borrow_data()?;
    require!(
        data.len() == 72 && data[..8] == [149, 8, 156, 202, 160, 252, 176, 217],
        GumballError::InvalidAuthority
    );
    require_keys_eq!(
        authority.key(),
        Pubkey::new_from_array(data[40..72].try_into().unwrap()),
        GumballError::InvalidAuthority
    );
    Ok(())
}

pub fn assert_config_line(
    gumball_machine: &Box<Account<GumballMachine>>,
    index: u32,
    config_line: ConfigLine,
    is_burnt: bool,
) -> Result<()> {
    let account_info = gumball_machine.to_account_info();
    let data = account_info.data.borrow();
    let count = get_config_count(&data)?;

    if index >= count as u32 {
        return err!(GumballError::IndexGreaterThanLength);
    }

    let config_line_position =
        GUMBALL_MACHINE_SIZE + 4 + (index as usize) * gumball_machine.get_config_line_size();

    let mint = Pubkey::try_from(&data[config_line_position..config_line_position + 32]).unwrap();
    require!(config_line.mint == mint, GumballError::InvalidMint);

    let seller =
        Pubkey::try_from(&data[config_line_position + 32..config_line_position + 64]).unwrap();
    // Only the gumball machine authority or the seller can remove a config line
    require!(config_line.seller == seller, GumballError::InvalidSeller);

    let buyer =
        Pubkey::try_from(&data[config_line_position + 64..config_line_position + 96]).unwrap();
    require!(config_line.buyer == buyer, GumballError::InvalidBuyer);

    // No need to verify the token standard for burnt assets
    if !is_burnt {
        let token_standard = u8::from_le_bytes(*array_ref![data, config_line_position + 96, 1]);
        require!(
            config_line.token_standard as u8 == token_standard,
            GumballError::InvalidTokenStandard
        );
    }

    drop(data);

    Ok(())
}

pub fn assert_config_line_values(
    gumball_machine_data: &[u8],
    config_line_position: usize,
    index: u32,
    mint: Pubkey,
    seller: Pubkey,
    buyer: Pubkey,
) -> Result<ConfigLineV2> {
    let count = get_config_count(gumball_machine_data)?;

    if index >= count as u32 {
        return err!(GumballError::IndexGreaterThanLength);
    }

    let config_line = ConfigLineV2::try_from_slice(
        &gumball_machine_data
            [config_line_position..config_line_position + ConfigLineV2::INIT_SPACE],
    )?;

    require!(mint == config_line.mint, GumballError::InvalidMint);
    require!(seller == config_line.seller, GumballError::InvalidSeller);
    require!(buyer == config_line.buyer, GumballError::InvalidBuyer);

    Ok(config_line)
}

/// Return the current number of lines written to the account.
pub fn get_config_count(data: &[u8]) -> Result<usize> {
    Ok(u32::from_le_bytes(*array_ref![data, GUMBALL_MACHINE_SIZE, 4]) as usize)
}

pub fn cmp_pubkeys(a: &Pubkey, b: &Pubkey) -> bool {
    // `sol_memcmp` became an `unsafe` syscall binding in Solana 3.0. The inputs are
    // fixed-size (`PUBKEY_BYTES`) pubkey slices, so the read is in bounds.
    unsafe { sol_memcmp(a.as_ref(), b.as_ref(), PUBKEY_BYTES) == 0 }
}

pub fn get_core_asset_update_authority<'info>(
    asset_info: &AccountInfo<'info>,
    collection_info: Option<&AccountInfo<'info>>,
) -> Result<(Option<Pubkey>, Box<Asset>)> {
    // Considered a primary sale if owner is the update authority (most likely creator)
    let asset = Box::<Asset>::try_from(asset_info)?;
    match asset.base.update_authority {
        UpdateAuthority::Address(address) => {
            return Ok((Some(address), asset));
        }
        UpdateAuthority::Collection(collection_key) => {
            if let Some(collection_info) = collection_info {
                assert_keys_equal(
                    *collection_info.key,
                    collection_key,
                    "Invalid collection key",
                )?;
                let collection = Box::<Collection>::try_from(collection_info)?;
                return Ok((Some(collection.base.update_authority), asset));
            } else {
                return Ok((None, asset));
            }
        }
        UpdateAuthority::None => return Ok((None, asset)),
    }
}

pub fn get_bit_byte_info(base_position: usize, position: usize) -> Result<(usize, usize, u8)> {
    let byte_position = base_position
        + position
            .checked_div(8)
            .ok_or(GumballError::NumericalOverflowError)?;
    // bit index corresponding to the position of the line
    let bit = 7 - position
        .checked_rem(8)
        .ok_or(GumballError::NumericalOverflowError)?;
    let mask = u8::pow(2, bit as u32);

    return Ok((byte_position, bit, mask));
}

pub fn approve_and_freeze_core_asset<'a>(
    payer: &AccountInfo<'a>,
    asset_info: &AccountInfo<'a>,
    collection: Option<&AccountInfo<'a>>,
    new_authority_info: &AccountInfo<'a>,
    new_authority_seeds: &[&[u8]],
    mpl_core_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
) -> Result<()> {
    let new_authority = new_authority_info.key();

    // Approve
    if let Err(_) =
        fetch_plugin::<BaseAssetV1, TransferDelegate>(asset_info, PluginType::TransferDelegate)
    {
        AddPluginV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(payer)
            .plugin(Plugin::TransferDelegate(TransferDelegate {}))
            .init_authority(PluginAuthority::Address {
                address: new_authority,
            })
            .system_program(system_program)
            .invoke()?;
    } else {
        ApprovePluginAuthorityV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(payer)
            .new_authority(PluginAuthority::Address {
                address: new_authority,
            })
            .plugin_type(PluginType::TransferDelegate)
            .system_program(system_program)
            .invoke()?;
    }

    // Freeze
    if let Err(_) =
        fetch_plugin::<BaseAssetV1, TransferDelegate>(asset_info, PluginType::FreezeDelegate)
    {
        AddPluginV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(payer)
            .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: true }))
            .init_authority(PluginAuthority::Address {
                address: new_authority,
            })
            .system_program(system_program)
            .invoke_signed(&[&new_authority_seeds])?;
    } else {
        ApprovePluginAuthorityV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(payer)
            .new_authority(PluginAuthority::Address {
                address: new_authority,
            })
            .plugin_type(PluginType::FreezeDelegate)
            .system_program(system_program)
            .invoke()?;

        UpdatePluginV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(payer)
            .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: true }))
            .authority(Some(new_authority_info))
            .system_program(system_program)
            .invoke_signed(&[&new_authority_seeds])?;
    }

    Ok(())
}

pub fn thaw_and_revoke_core_asset<'a>(
    payer: &AccountInfo<'a>,
    owner: &AccountInfo<'a>,
    asset_info: &AccountInfo<'a>,
    collection: Option<&AccountInfo<'a>>,
    authority: &AccountInfo<'a>,
    authority_seeds: &[&[u8]],
    mpl_core_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
) -> Result<()> {
    // Thaw
    UpdatePluginV1CpiBuilder::new(mpl_core_program)
        .asset(asset_info)
        .collection(collection)
        .payer(payer)
        .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: false }))
        .authority(Some(authority))
        .system_program(system_program)
        .invoke_signed(&[&authority_seeds])?;

    // Can only remove plugins if the seller is the authority
    if owner.key() == payer.key() {
        // Clean up freeze plugin back to seller
        RemovePluginV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(payer)
            .plugin_type(PluginType::FreezeDelegate)
            .system_program(system_program)
            .invoke()?;

        // Clean up transfer delegate plugin back to seller
        RemovePluginV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(payer)
            .plugin_type(PluginType::TransferDelegate)
            .system_program(system_program)
            .invoke()?;
    } else {
        // Revoke
        RevokePluginAuthorityV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(payer)
            .plugin_type(PluginType::FreezeDelegate)
            .authority(Some(authority))
            .system_program(system_program)
            .invoke_signed(&[&authority_seeds])?;

        // Revoke
        RevokePluginAuthorityV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(payer)
            .plugin_type(PluginType::TransferDelegate)
            .authority(Some(authority))
            .system_program(system_program)
            .invoke_signed(&[&authority_seeds])?;
    }

    Ok(())
}

pub fn approve_and_freeze_nft_v2<'a>(
    payer: &AccountInfo<'a>,
    owner: &AccountInfo<'a>,
    mint: &AccountInfo<'a>,
    token_account: &AccountInfo<'a>,
    edition: &AccountInfo<'a>,
    new_authority_info: &AccountInfo<'a>,
    new_authority_seeds: &[&[u8]],
    token_metadata_program: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    metadata_info: &AccountInfo<'a>,
    metadata: &Metadata,
    token_record: Option<&UncheckedAccount<'a>>,
    rules: Option<&UncheckedAccount<'a>>,
    system_program: &AccountInfo<'a>,
    sysvar_instructions: Option<&UncheckedAccount<'a>>,
    auth_rules_program: Option<&UncheckedAccount<'a>>,
) -> Result<()> {
    if let Some(sysvar_instructions) = sysvar_instructions {
        let mut delegate_builder = DelegateCpiBuilder::new(token_metadata_program);
        delegate_builder
            .delegate(new_authority_info)
            .authority(owner)
            .metadata(metadata_info)
            .master_edition(Some(edition))
            .mint(mint)
            .token(Some(token_account))
            .payer(owner)
            .spl_token_program(Some(token_program))
            .system_program(system_program)
            .sysvar_instructions(sysvar_instructions);

        let mut delegate_args = DelegateArgs::StandardV1 { amount: 1 };

        let mut lock_builder = LockCpiBuilder::new(token_metadata_program);
        lock_builder
            .authority(new_authority_info)
            .token(token_account)
            .mint(mint)
            .metadata(metadata_info)
            .edition(Some(edition))
            .payer(owner)
            .spl_token_program(Some(token_program))
            .system_program(system_program)
            .sysvar_instructions(sysvar_instructions);

        if let Some(standard) = &metadata.token_standard {
            if *standard == MplTokenStandard::ProgrammableNonFungible
                || *standard == MplTokenStandard::ProgrammableNonFungibleEdition
            {
                delegate_args = DelegateArgs::LockedTransferV1 {
                    amount: 1,
                    locked_address: new_authority_info.key(),
                    authorization_data: Some(AuthorizationData {
                        payload: get_auth_payload(new_authority_info),
                    }),
                };
                delegate_builder.token_record(token_record.map(|acc| acc.as_ref()));

                lock_builder.token_record(token_record.map(|acc| acc.as_ref()));
            }
        }

        if let Some(config) = &metadata.programmable_config {
            match *config {
                ProgrammableConfig::V1 { rule_set } => {
                    if let Some(_rule_set) = rule_set {
                        delegate_builder.authorization_rules_program(
                            auth_rules_program.map(|acc| acc.as_ref()),
                        );
                        delegate_builder.authorization_rules(rules.map(|acc| acc.as_ref()));

                        lock_builder.authorization_rules_program(
                            auth_rules_program.map(|acc| acc.as_ref()),
                        );
                        lock_builder.authorization_rules(rules.map(|acc| acc.as_ref()));
                    }
                }
            }
        }

        delegate_builder.delegate_args(delegate_args);
        delegate_builder.invoke()?;

        lock_builder.lock_args(LockArgs::V1 {
            authorization_data: Some(AuthorizationData {
                payload: get_auth_payload(new_authority_info),
            }),
        });
        lock_builder.invoke_signed(&[new_authority_seeds])?;
    } else {
        approve(
            CpiContext::new(
                token_program.key(),
                Approve {
                    to: token_account.to_account_info(),
                    delegate: new_authority_info.to_account_info(),
                    authority: payer.to_account_info(),
                },
            ),
            1,
        )?;

        FreezeDelegatedAccountCpi::new(
            token_metadata_program,
            FreezeDelegatedAccountCpiAccounts {
                delegate: new_authority_info,
                token_account,
                edition,
                mint,
                token_program,
            },
        )
        .invoke_signed(&[&new_authority_seeds])?;
    }

    Ok(())
}

pub fn token_standard_from_mpl_token_standard(metadata: &Metadata) -> Result<TokenStandard> {
    if let Some(standard) = &metadata.token_standard {
        if *standard == MplTokenStandard::ProgrammableNonFungible
            || *standard == MplTokenStandard::ProgrammableNonFungibleEdition
        {
            return Ok(TokenStandard::ProgrammableNonFungible);
        }

        if *standard == MplTokenStandard::Fungible || *standard == MplTokenStandard::FungibleAsset {
            return Ok(TokenStandard::Fungible);
        }
    }

    Ok(TokenStandard::NonFungible)
}

pub fn thaw_and_revoke_nft_v2<'a>(
    payer: &AccountInfo<'a>,
    owner: &AccountInfo<'a>,
    mint: &AccountInfo<'a>,
    token_account: &AccountInfo<'a>,
    edition: &AccountInfo<'a>,
    authority: &AccountInfo<'a>,
    authority_seeds: &[&[u8]],
    token_metadata_program: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    metadata_info: Option<&AccountInfo<'a>>,
    token_record: Option<&UncheckedAccount<'a>>,
    rules: Option<&UncheckedAccount<'a>>,
    system_program: &AccountInfo<'a>,
    sysvar_instructions: Option<&UncheckedAccount<'a>>,
    auth_rules_program: Option<&UncheckedAccount<'a>>,
    associated_token_program: &AccountInfo<'a>,
    authority_pda_token_account: &AccountInfo<'a>,
) -> Result<()> {
    let metadata = if let Some(metadata_info) = metadata_info {
        Some(Metadata::try_from(metadata_info)?)
    } else {
        None
    };

    thaw_nft(
        payer,
        owner,
        mint,
        token_account,
        edition,
        authority,
        authority_seeds,
        token_metadata_program,
        token_program,
        metadata_info,
        metadata.as_ref(),
        token_record,
        rules,
        system_program,
        sysvar_instructions,
        auth_rules_program,
    )?;

    if let Some(sysvar_instructions) = sysvar_instructions {
        let mut revoke_builder = RevokeCpiBuilder::new(token_metadata_program);
        revoke_builder
            .delegate(authority)
            .authority(owner)
            .metadata(metadata_info.unwrap())
            .master_edition(Some(edition))
            .mint(mint)
            .token(Some(token_account))
            .payer(owner)
            .spl_token_program(Some(token_program))
            .system_program(system_program)
            .sysvar_instructions(sysvar_instructions);
        let mut revoke_args = RevokeArgs::StandardV1;

        if let Some(standard) = &metadata.as_ref().unwrap().token_standard {
            if *standard == MplTokenStandard::ProgrammableNonFungible
                || *standard == MplTokenStandard::ProgrammableNonFungibleEdition
            {
                let token_record_info = &token_record.unwrap().to_account_info();
                let token_record_data = TokenRecord::try_from(token_record_info)?;
                let delegate_role = token_record_data.delegate_role.unwrap();
                if delegate_role == TokenDelegateRole::Migration {
                    revoke_args = RevokeArgs::MigrationV1;
                } else {
                    revoke_args = RevokeArgs::LockedTransferV1;
                }
                revoke_builder.token_record(token_record.map(|acc| acc.as_ref()));
            }
        }

        if let Some(config) = &metadata.as_ref().unwrap().programmable_config {
            match *config {
                ProgrammableConfig::V1 { rule_set } => {
                    if let Some(_rule_set) = rule_set {
                        revoke_builder.authorization_rules_program(
                            auth_rules_program.map(|acc| acc.as_ref()),
                        );
                        revoke_builder.authorization_rules(rules.map(|acc| acc.as_ref()));
                    }
                }
            }
        }

        revoke_builder.revoke_args(revoke_args);
        revoke_builder.invoke()?;
    } else {
        transfer_spl(
            owner,
            authority,
            token_account,
            authority_pda_token_account,
            mint,
            payer,
            associated_token_program,
            token_program,
            system_program,
            Some(authority),
            Some(authority_seeds),
            None,
            1,
        )?;

        transfer_spl(
            authority,
            owner,
            authority_pda_token_account,
            token_account,
            mint,
            payer,
            associated_token_program,
            token_program,
            system_program,
            Some(authority),
            Some(authority_seeds),
            None,
            1,
        )?;
    }

    Ok(())
}

pub fn thaw_nft<'a>(
    payer: &AccountInfo<'a>,
    owner: &AccountInfo<'a>,
    mint: &AccountInfo<'a>,
    token_account: &AccountInfo<'a>,
    edition: &AccountInfo<'a>,
    authority: &AccountInfo<'a>,
    authority_seeds: &[&[u8]],
    token_metadata_program: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    metadata_info: Option<&AccountInfo<'a>>,
    metadata: Option<&Metadata>,
    token_record: Option<&UncheckedAccount<'a>>,
    rules: Option<&UncheckedAccount<'a>>,
    system_program: &AccountInfo<'a>,
    sysvar_instructions: Option<&UncheckedAccount<'a>>,
    auth_rules_program: Option<&UncheckedAccount<'a>>,
) -> Result<()> {
    if let Some(sysvar_instructions) = sysvar_instructions {
        let mut unlock_builder = UnlockCpiBuilder::new(token_metadata_program);
        unlock_builder
            .authority(authority)
            .token_owner(Some(owner))
            .token(token_account)
            .mint(mint)
            .metadata(metadata_info.unwrap())
            .edition(Some(edition))
            .payer(payer)
            .spl_token_program(Some(token_program))
            .system_program(system_program)
            .sysvar_instructions(sysvar_instructions);

        if let Some(standard) = &metadata.unwrap().token_standard {
            if *standard == MplTokenStandard::ProgrammableNonFungible
                || *standard == MplTokenStandard::ProgrammableNonFungibleEdition
            {
                unlock_builder.token_record(token_record.map(|acc| acc.as_ref()));
            }
        }

        if let Some(config) = &metadata.unwrap().programmable_config {
            match *config {
                ProgrammableConfig::V1 { rule_set } => {
                    if let Some(_rule_set) = rule_set {
                        unlock_builder.authorization_rules_program(
                            auth_rules_program.map(|acc| acc.as_ref()),
                        );
                        unlock_builder.authorization_rules(rules.map(|acc| acc.as_ref()));
                    }
                }
            }
        }

        unlock_builder.unlock_args(UnlockArgs::V1 {
            authorization_data: Some(AuthorizationData {
                payload: get_auth_payload(authority),
            }),
        });
        unlock_builder.invoke_signed(&[authority_seeds])?;
    } else {
        ThawDelegatedAccountCpi::new(
            token_metadata_program,
            ThawDelegatedAccountCpiAccounts {
                delegate: authority,
                token_account,
                edition,
                mint,
                token_program,
            },
        )
        .invoke_signed(&[&authority_seeds])?;
    }

    Ok(())
}

/// Moves `amount` out of `token_account` and closes it when it ends up empty.
///
/// `token_account` is an `AccountInfo` rather than a typed account so this works
/// for both token programs: `Account<'_, TokenAccount>` pins the owner to classic
/// SPL Token and would reject a Token-2022 payment account. The remaining balance
/// is re-read from the account data through `StateWithExtensions`, which parses a
/// Token-2022 account carrying extensions as well as a classic 165-byte one.
///
/// `token_program` must be the program that owns `mint` — the caller resolves it
/// from the §D5 slot on the payment path, and passes the classic program on the
/// prize path.
pub fn transfer_and_close_if_empty<'a>(
    payer: &AccountInfo<'a>,
    authority: &AccountInfo<'a>,
    token_account: &AccountInfo<'a>,
    recipient: &AccountInfo<'a>,
    recipient_token_account: &AccountInfo<'a>,
    mint: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    associated_token_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    rent_recipient: &AccountInfo<'a>,
    auth_seeds: &[&[u8]],
    amount: u64,
) -> Result<()> {
    if amount > 0 {
        transfer_spl(
            authority,
            recipient,
            token_account,
            recipient_token_account,
            mint,
            payer,
            associated_token_program,
            token_program,
            system_program,
            Some(authority),
            Some(&auth_seeds),
            None,
            amount,
        )?;
    }

    let remaining_balance = {
        let data = token_account.try_borrow_data()?;
        StateWithExtensions::<SplTokenAccount>::unpack(&data)?
            .base
            .amount
    };

    let rent_recipient = if utils::can_receive_lamports(rent_recipient) {
        rent_recipient
    } else {
        payer
    };
    // Close the token account back to authority if token account is empty
    if remaining_balance == 0 {
        close_currency_account(CpiContext::new_with_signer(
            token_program.key(),
            CloseCurrencyAccount {
                account: token_account.to_account_info(),
                destination: rent_recipient.to_account_info(),
                authority: authority.to_account_info(),
            },
            &[auth_seeds],
        ))?;
    }

    Ok(())
}

/// Requires both the v1 leaf argument and the SPL-compression tree owner.
pub fn assert_cnft_v1(version: u8, merkle_tree: &AccountInfo) -> Result<()> {
    require!(
        version == crate::constants::BUBBLEGUM_V1_VERSION
            && *merkle_tree.owner == crate::constants::SPL_ACCOUNT_COMPRESSION_PROGRAM,
        GumballError::UnsupportedCnftVersion
    );
    Ok(())
}

/// Requires both the v2 leaf argument and the MPL-compression tree owner.
pub fn assert_cnft_v2(version: u8, merkle_tree: &AccountInfo) -> Result<()> {
    require!(
        version == crate::constants::BUBBLEGUM_V2_VERSION
            && *merkle_tree.owner == crate::constants::MPL_ACCOUNT_COMPRESSION_PROGRAM,
        GumballError::UnsupportedCnftVersion
    );
    Ok(())
}

/// Empty-leaf evidence at a recorded v2 address, including replacement accounts.
/// SPL trees need marketplace authorization: config lines also contain live v1 assets.
pub fn is_closed_cnft_v2_tree(merkle_tree: &AccountInfo, index: u32) -> Result<bool> {
    if *merkle_tree.owner == crate::constants::SPL_ACCOUNT_COMPRESSION_PROGRAM {
        return Ok(false);
    }
    if *merkle_tree.owner != crate::constants::MPL_ACCOUNT_COMPRESSION_PROGRAM {
        return Ok(true);
    }
    let data = merkle_tree.try_borrow_data()?;
    if data.len() < 80 || data[0] != 1 || data[1] != 0 {
        return Ok(true);
    }
    let buffer = u32::from_le_bytes(data[2..6].try_into().unwrap()) as usize;
    let depth = u32::from_le_bytes(data[6..10].try_into().unwrap()) as usize;
    if depth == 0 || depth > 30 || !(8..=2048).contains(&buffer) || !buffer.is_power_of_two() {
        return Ok(true);
    }
    // Header (56), counters (24), changelog ring, then Path's proof/leaf/index.
    let rightmost_offset = 80 + buffer * (40 + 32 * depth) + 32 * (depth + 1);
    if data.len() < rightmost_offset + 8 {
        return Ok(true);
    }
    let active = u64::from_le_bytes(data[64..72].try_into().unwrap());
    let used = u64::from_le_bytes(data[72..80].try_into().unwrap());
    if active >= buffer as u64 || used == 0 || used > buffer as u64 {
        return Ok(true);
    }
    let rightmost = u32::from_le_bytes(
        data[rightmost_offset..rightmost_offset + 4]
            .try_into()
            .unwrap(),
    );
    // The append index never decreases in a live tree, including after burns.
    // Such a slot could not have belonged to this tree's current incarnation.
    Ok(u64::from(index) >= (1u64 << depth) || index >= rightmost)
}

pub fn assert_refund_mint_authority(
    machine: &GumballMachine,
    mint_authority: &AccountInfo,
) -> Result<()> {
    if machine.version >= 6 {
        require_keys_eq!(
            *mint_authority.owner,
            crate::constants::GUMBALL_GUARD_PROGRAM,
            GumballError::InvalidAuthority
        );
    }
    Ok(())
}

fn load_cnft_collection(collection: &AccountInfo) -> Result<mpl_core::accounts::BaseCollectionV1> {
    use mpl_core::SolanaAccount;
    require_keys_eq!(
        *collection.owner,
        mpl_core::ID,
        GumballError::InvalidCoreCollection
    );
    let base = mpl_core::accounts::BaseCollectionV1::load(collection, 0)
        .map_err(|_| error!(GumballError::InvalidCoreCollection))?;
    require!(
        base.key == mpl_core::types::Key::CollectionV1,
        GumballError::InvalidCoreCollection
    );
    Ok(base)
}

/// Only the internal registry is relevant to cNFT eligibility and royalties.
/// Borrow it in place: external adapters and unrelated plugin bodies never allocate.
#[derive(Default)]
struct CnftCollectionPlugins {
    royalties: Option<usize>,
    verified_creators: Option<usize>,
    permanent_delegate: bool,
}

fn cnft_collection_plugins(data: &[u8], base_len: usize) -> Result<CnftCollectionPlugins> {
    use borsh::BorshDeserialize;
    use mpl_core::{
        accounts::PluginHeaderV1,
        types::{Key, PluginAuthority, PluginType},
    };
    let invalid = || error!(GumballError::InvalidCoreCollection);
    let mut plugins = CnftCollectionPlugins::default();
    if data.len() == base_len {
        return Ok(plugins);
    }
    let header = PluginHeaderV1::from_bytes(data.get(base_len..).ok_or_else(invalid)?)
        .map_err(|_| invalid())?;
    require!(
        header.key == Key::PluginHeaderV1,
        GumballError::InvalidCoreCollection
    );
    let registry_offset = usize::try_from(header.plugin_registry_offset).map_err(|_| invalid())?;
    require!(
        registry_offset >= base_len + PluginHeaderV1::LEN,
        GumballError::InvalidCoreCollection
    );
    let mut registry = data.get(registry_offset..).ok_or_else(invalid)?;
    require!(
        Key::deserialize(&mut registry).map_err(|_| invalid())? == Key::PluginRegistryV1,
        GumballError::InvalidCoreCollection
    );
    let count = u32::deserialize(&mut registry).map_err(|_| invalid())?;
    for _ in 0..count {
        let plugin_type = u8::deserialize(&mut registry).map_err(|_| invalid())?;
        PluginAuthority::deserialize(&mut registry).map_err(|_| invalid())?;
        let offset = usize::try_from(u64::deserialize(&mut registry).map_err(|_| invalid())?)
            .map_err(|_| invalid())?;
        require!(
            offset >= base_len + PluginHeaderV1::LEN && offset < registry_offset,
            GumballError::InvalidCoreCollection
        );
        if plugin_type == PluginType::Royalties as u8 {
            require!(
                data[offset] == plugin_type,
                GumballError::InvalidCoreCollection
            );
            plugins.royalties = Some(offset + 1);
        } else if plugin_type == PluginType::VerifiedCreators as u8 {
            require!(
                data[offset] == plugin_type,
                GumballError::InvalidCoreCollection
            );
            plugins.verified_creators = Some(offset + 1);
        }
        if [
            PluginType::PermanentFreezeDelegate as u8,
            PluginType::PermanentTransferDelegate as u8,
            PluginType::PermanentBurnDelegate as u8,
        ]
        .contains(&plugin_type)
        {
            require!(
                data[offset] == plugin_type,
                GumballError::InvalidCoreCollection
            );
            plugins.permanent_delegate = true;
        }
    }
    Ok(plugins)
}

/// Inspect authenticated Core collection plugin records without loading unrelated payloads.
pub fn cnft_collection_has_permanent_delegate(collection: &AccountInfo) -> Result<bool> {
    use mpl_core::DataBlob;
    let base = load_cnft_collection(collection)?;
    let data = collection.try_borrow_data()?;
    Ok(cnft_collection_plugins(&data, base.len())?.permanent_delegate)
}

/// Entry eligibility. The TransferV2 proof authenticates collection membership.
pub fn assert_cnft_v2_eligible(flags: u8, collection: Option<&AccountInfo>) -> Result<()> {
    require!(flags == 0, GumballError::IneligibleCnftFlags);
    if let Some(collection) = collection {
        require!(
            !cnft_collection_has_permanent_delegate(collection)?,
            GumballError::InvalidAssetPlugin
        );
    }
    Ok(())
}

/// Resolve secondary-sale payouts without changing the proof-bound leaf inputs.
pub fn get_cnft_v2_royalty_info(
    args: &crate::CnftArgsV2,
    collection: Option<&AccountInfo>,
) -> Result<utils::RoyaltyInfo> {
    if let Some(collection) = collection {
        require_keys_eq!(
            *collection.owner,
            mpl_core::ID,
            GumballError::InvalidCoreCollection
        );
        require!(
            collection.try_borrow_data()?.first()
                == Some(&(mpl_core::types::Key::CollectionV1 as u8)),
            GumballError::InvalidCoreCollection
        );
    }
    let mut info = utils::RoyaltyInfo {
        is_primary_sale: false,
        seller_fee_basis_points: 0,
        creators: None,
    };
    if args.seller_fee_basis_points != u16::MAX && !args.creators.is_empty() {
        info.seller_fee_basis_points = args.seller_fee_basis_points;
        info.creators = Some(
            args.creators
                .iter()
                .map(|c| mpl_token_metadata::types::Creator {
                    address: c.address,
                    verified: c.verified,
                    share: c.share,
                })
                .collect(),
        );
    } else if let Some(collection) = collection {
        use borsh::BorshDeserialize;
        use mpl_core::{
            types::{Royalties, VerifiedCreators},
            DataBlob,
        };
        let base = load_cnft_collection(collection)?;
        let data = collection.try_borrow_data()?;
        let plugins = cnft_collection_plugins(&data, base.len())?;
        let invalid = || error!(GumballError::InvalidCoreCollection);
        if let Some(offset) = plugins.royalties {
            let royalties = Royalties::deserialize(&mut &data[offset..]).map_err(|_| invalid())?;
            let verified = plugins
                .verified_creators
                .map(|offset| {
                    VerifiedCreators::deserialize(&mut &data[offset..]).map_err(|_| invalid())
                })
                .transpose()?;
            info.seller_fee_basis_points = royalties.basis_points;
            info.creators = Some(
                royalties
                    .creators
                    .iter()
                    .map(|c| mpl_token_metadata::types::Creator {
                        address: c.address,
                        verified: verified.as_ref().is_some_and(|v| {
                            v.signatures
                                .iter()
                                .any(|s| s.verified && s.address == c.address)
                        }),
                        share: c.percentage,
                    })
                    .collect(),
            );
        }
    }
    Ok(info)
}

/// Recomputes the Bubblegum leaf `data_hash` from the DAS-supplied `meta_hash`.
///
/// Mirrors `mpl_bubblegum::hash::hash_metadata`'s trailing step:
/// `data_hash = keccak(keccak(borsh(MetadataArgs)) ‖ sfbp_le)` where `meta_hash`
/// is the inner `keccak(borsh(MetadataArgs))`. Because `seller_fee_basis_points`
/// is folded in here, a lie about it changes `data_hash` and the proof fails.
pub fn compute_cnft_data_hash(meta_hash: &[u8; 32], seller_fee_basis_points: u16) -> [u8; 32] {
    solana_program::keccak::hashv(&[meta_hash, &seller_fee_basis_points.to_le_bytes()]).to_bytes()
}

/// Recomputes the Bubblegum leaf `creator_hash` from the supplied creators.
///
/// Delegates to `mpl_bubblegum::hash::hash_creators` after mapping the local
/// `CnftCreator` type to `mpl_bubblegum::types::Creator` (the local type exists
/// only so creators can cross the Anchor instruction boundary, which the mpl
/// borsh types can't). Calling the mpl helper keeps this in lockstep with
/// Bubblegum's on-chain hashing. A lie about creators changes `creator_hash` and
/// the proof fails, so royalty payouts driven off these creators are trustless.
pub fn compute_cnft_creator_hash(creators: &[crate::CnftCreator]) -> [u8; 32] {
    let creators: Vec<mpl_bubblegum::types::Creator> = creators
        .iter()
        .map(|c| mpl_bubblegum::types::Creator {
            address: c.address,
            verified: c.verified,
            share: c.share,
        })
        .collect();
    mpl_bubblegum::hash::hash_creators(&creators)
}

/// Derives the Bubblegum asset id for a leaf: `PDA(["asset", tree, nonce_le])`.
pub fn cnft_asset_id(merkle_tree: &Pubkey, nonce: u64) -> Pubkey {
    mpl_bubblegum::utils::get_asset_id(merkle_tree, nonce)
}

/// MANDATORY anti-substitution binding for compressed NFTs.
///
/// In gumball the merkle tree arrives as an untrusted instruction account and
/// there is no config-line room to store it — so the ONLY thing binding the
/// passed tree to the item we stored is this derivation. We re-derive
/// `asset_id = PDA(["asset", merkle_tree, nonce_le])` and require it equals the
/// asset id recorded in the config line (`expected_asset_id`). Without this, a
/// caller could supply a different (cheaper) leaf's tree/nonce/proof and settle
/// or claim against the wrong asset. Returns the verified asset id.
pub fn assert_cnft_asset_id(
    merkle_tree: &Pubkey,
    nonce: u64,
    expected_asset_id: &Pubkey,
) -> Result<Pubkey> {
    let asset_id = cnft_asset_id(merkle_tree, nonce);
    require!(
        asset_id == *expected_asset_id,
        GumballError::InvalidMerkleTree
    );
    Ok(asset_id)
}

/// Verifies the passed `tree_config` account is the canonical Bubblegum tree
/// authority PDA for `merkle_tree`. Defense-in-depth: the Bubblegum CPI also
/// enforces this, but we bind it here so a wrong tree_config fails early.
pub fn assert_cnft_tree_config(tree_config: &Pubkey, merkle_tree: &Pubkey) -> Result<()> {
    let (expected, _) = mpl_bubblegum::accounts::TreeConfig::find_pda(merkle_tree);
    assert_keys_equal(expected, *tree_config, "Invalid tree config PDA")?;
    Ok(())
}

/// Executes a Bubblegum V1 `Transfer` CPI moving a leaf `leaf_owner -> new_leaf_owner`.
///
/// `leaf_owner`/`leaf_delegate` are the same account here (mallow never sets a
/// separate leaf delegate): on escrow-in it is the seller (a tx signer); on
/// escrow-out it is the gumball authority PDA (signed via `signer_seeds`). Proof
/// nodes are passed as read-only, non-signer remaining accounts. The CPI verifies
/// leaf ↔ root ↔ proof using `data_hash`/`creator_hash`, which binds sfbp and
/// creators to the on-chain state.
#[allow(clippy::too_many_arguments)]
pub fn transfer_cnft<'a, 'b>(
    bubblegum_program: &AccountInfo<'a>,
    tree_config: &AccountInfo<'a>,
    leaf_owner: &AccountInfo<'a>,
    new_leaf_owner: &AccountInfo<'a>,
    merkle_tree: &AccountInfo<'a>,
    log_wrapper: &AccountInfo<'a>,
    compression_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    proof: &'b [AccountInfo<'a>],
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    nonce: u64,
    index: u32,
    signer_seeds: Option<&[&[u8]]>,
) -> Result<()> {
    let mut builder = mpl_bubblegum::instructions::TransferCpiBuilder::new(bubblegum_program);
    builder
        .tree_config(tree_config)
        // leaf_owner and leaf_delegate are the same account; it authorizes the
        // transfer (seller signature on escrow-in, PDA seeds on escrow-out).
        .leaf_owner(leaf_owner, true)
        .leaf_delegate(leaf_owner, true)
        .new_leaf_owner(new_leaf_owner)
        .merkle_tree(merkle_tree)
        .log_wrapper(log_wrapper)
        .compression_program(compression_program)
        .system_program(system_program)
        .root(root)
        .data_hash(data_hash)
        .creator_hash(creator_hash)
        .nonce(nonce)
        .index(index);

    // Proof nodes: untrusted, but only ever read-only non-signers. The CPI hashes
    // them up to the root, so a bad proof simply fails verification.
    for node in proof.iter() {
        builder.add_remaining_account(node, false, false);
    }

    match signer_seeds {
        Some(seeds) => builder.invoke_signed(&[seeds])?,
        None => builder.invoke()?,
    };

    Ok(())
}

/// Transfer a v2 leaf with a wallet fee payer and a separate owner authority.
/// Delegates and proof nodes remain non-signers; escrow exits sign only the PDA.
#[allow(clippy::too_many_arguments)]
pub fn transfer_cnft_v2<'a>(
    bubblegum_program: &AccountInfo<'a>,
    tree_config: &AccountInfo<'a>,
    payer: &AccountInfo<'a>,
    leaf_owner: &AccountInfo<'a>,
    leaf_delegate: &AccountInfo<'a>,
    new_leaf_owner: &AccountInfo<'a>,
    merkle_tree: &AccountInfo<'a>,
    core_collection: Option<&AccountInfo<'a>>,
    log_wrapper: &AccountInfo<'a>,
    compression_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    proof: &[AccountInfo<'a>],
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    asset_data_hash: Option<[u8; 32]>,
    flags: u8,
    nonce: u64,
    index: u32,
    signer_seeds: Option<&[&[u8]]>,
) -> Result<()> {
    let mut builder = mpl_bubblegum::instructions::TransferV2CpiBuilder::new(bubblegum_program);
    builder
        .tree_config(tree_config)
        .payer(payer)
        .authority(Some(leaf_owner))
        .leaf_owner(leaf_owner)
        .leaf_delegate(Some(leaf_delegate))
        .new_leaf_owner(new_leaf_owner)
        .merkle_tree(merkle_tree)
        .core_collection(core_collection)
        .log_wrapper(log_wrapper)
        .compression_program(compression_program)
        .system_program(system_program)
        .root(root)
        .data_hash(data_hash)
        .creator_hash(creator_hash)
        .flags(flags)
        .nonce(nonce)
        .index(index);
    if let Some(hash) = asset_data_hash {
        builder.asset_data_hash(hash);
    }
    for node in proof {
        builder.add_remaining_account(node, false, false);
    }
    match signer_seeds {
        Some(seeds) => builder.invoke_signed(&[seeds])?,
        None => builder.invoke()?,
    }
    Ok(())
}

/// MPL compression preserves the Anchor VerifyLeaf layout: one readonly tree,
/// then readonly proof nodes; args are root, leaf hash, index. Confirmed against
/// metaplex-foundation/mpl-account-compression programs/account-compression/src/lib.rs.
/// No offline MPL compression crate is available, so reuse the encoded CPI.
pub fn verify_cnft_leaf_v2<'a>(
    compression_program: &AccountInfo<'a>,
    merkle_tree: &AccountInfo<'a>,
    proof: &[AccountInfo<'a>],
    root: [u8; 32],
    leaf: [u8; 32],
    index: u32,
) -> Result<()> {
    require_keys_eq!(
        compression_program.key(),
        crate::constants::MPL_ACCOUNT_COMPRESSION_PROGRAM,
        GumballError::InvalidMerkleTree
    );
    assert_cnft_v2(crate::constants::BUBBLEGUM_V2_VERSION, merkle_tree)?;
    verify_cnft_leaf(compression_program, merkle_tree, proof, root, leaf, index)
}

/// Refunds cannot use compression's historical-root fast-forwarding: a flagged
/// leaf may have become transferable again since that historical root.
pub fn assert_current_cnft_v2_root(tree: &AccountInfo, root: &[u8; 32]) -> Result<()> {
    let data = tree.try_borrow_data()?;
    let invalid = || error!(GumballError::InvalidRefundEvidence);
    let read_u32 = |offset: usize| -> Result<u32> {
        Ok(u32::from_le_bytes(
            data.get(offset..offset + 4)
                .ok_or_else(invalid)?
                .try_into()
                .unwrap(),
        ))
    };
    let read_u64 = |offset: usize| -> Result<u64> {
        Ok(u64::from_le_bytes(
            data.get(offset..offset + 8)
                .ok_or_else(invalid)?
                .try_into()
                .unwrap(),
        ))
    };
    require!(
        data.first() == Some(&1) && data.get(1) == Some(&0),
        GumballError::InvalidRefundEvidence
    );
    let buffer = read_u32(2)? as usize;
    let depth = read_u32(6)? as usize;
    let active = usize::try_from(read_u64(64)?).map_err(|_| invalid())?;
    require!(
        depth <= 30 && buffer.is_power_of_two() && active < buffer,
        GumballError::InvalidRefundEvidence
    );
    let offset = 80 + active * (40 + 32 * depth);
    require!(
        data.get(offset..offset + 32) == Some(root.as_slice()),
        GumballError::StaleRefundEvidence
    );
    Ok(())
}

/// Verifies a Bubblegum leaf against the tree's CURRENT state via the
/// spl-account-compression `VerifyLeaf` CPI.
///
/// Used by `settle_cnft_sale` on the already-claimed path: the leaf left escrow
/// in a prior `claim_cnft`, so no Transfer CPI runs at settle time to bind
/// `creators`/`seller_fee_basis_points` to the real asset. Verifying a leaf
/// reconstructed from those args (plus the caller-supplied current owner and
/// delegate) restores that binding — a lie about creators or sfbp changes the
/// leaf hash and the proof fails.
///
/// The instruction is hand-encoded because the program doesn't depend on the
/// spl-account-compression crate (Bubblegum CPIs go through mpl-bubblegum).
pub fn verify_cnft_leaf<'a, 'b>(
    compression_program: &AccountInfo<'a>,
    merkle_tree: &AccountInfo<'a>,
    proof: &'b [AccountInfo<'a>],
    root: [u8; 32],
    leaf: [u8; 32],
    index: u32,
) -> Result<()> {
    // Anchor discriminator: sha256("global:verify_leaf")[..8]. Pinned as a
    // constant and checked against a runtime hash in `tests::verify_leaf_discriminator`.
    const VERIFY_LEAF_DISCRIMINATOR: [u8; 8] = [124, 220, 22, 223, 104, 10, 250, 224];

    let mut data = Vec::with_capacity(8 + 32 + 32 + 4);
    data.extend_from_slice(&VERIFY_LEAF_DISCRIMINATOR);
    data.extend_from_slice(&root);
    data.extend_from_slice(&leaf);
    data.extend_from_slice(&index.to_le_bytes());

    let mut account_metas = Vec::with_capacity(1 + proof.len());
    let mut account_infos = Vec::with_capacity(1 + proof.len());
    account_metas.push(solana_program::instruction::AccountMeta::new_readonly(
        merkle_tree.key(),
        false,
    ));
    account_infos.push(merkle_tree.clone());
    for node in proof.iter() {
        account_metas.push(solana_program::instruction::AccountMeta::new_readonly(
            node.key(),
            false,
        ));
        account_infos.push(node.clone());
    }

    solana_program::program::invoke(
        &solana_program::instruction::Instruction {
            program_id: compression_program.key(),
            accounts: account_metas,
            data,
        },
        &account_infos,
    )?;

    Ok(())
}

#[macro_export]
macro_rules! try_from {
    ($ty: ty, $acc: expr) => {
        <$ty>::try_from(unsafe { std::mem::transmute::<_, &AccountInfo<'_>>($acc.as_ref()) })
    };
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    fn closed_cnft_tree_evidence_handles_replacements_but_preserves_v1() {
        let key = Pubkey::new_unique();
        for owner in [
            crate::constants::MPL_ACCOUNT_COMPRESSION_PROGRAM,
            crate::constants::SPL_ACCOUNT_COMPRESSION_PROGRAM,
            Pubkey::default(),
            Pubkey::new_unique(),
        ] {
            for size in [0, 1, 256] {
                let mut lamports = 1;
                let mut data = vec![0; size];
                let tree =
                    AccountInfo::new(&key, false, false, &mut lamports, &mut data, &owner, false);
                assert_eq!(
                    is_closed_cnft_v2_tree(&tree, 0).unwrap(),
                    owner != crate::constants::SPL_ACCOUNT_COMPRESSION_PROGRAM
                );
            }
        }
    }

    #[test]
    fn replacement_tree_empty_slots_are_bounded_by_the_append_index() {
        let key = Pubkey::new_unique();
        let mut lamports = 1;
        let mut data = vec![0; 80 + 8 * (40 + 32 * 5) + 32 * 6 + 8];
        data[0] = 1;
        data[2..6].copy_from_slice(&8u32.to_le_bytes());
        data[6..10].copy_from_slice(&5u32.to_le_bytes());
        data[72..80].copy_from_slice(&1u64.to_le_bytes());
        let rightmost = 80 + 8 * (40 + 32 * 5) + 32 * 6;
        data[rightmost..rightmost + 4].copy_from_slice(&2u32.to_le_bytes());
        let tree = AccountInfo::new(
            &key,
            false,
            false,
            &mut lamports,
            &mut data,
            &crate::constants::MPL_ACCOUNT_COMPRESSION_PROGRAM,
            false,
        );
        assert!(!is_closed_cnft_v2_tree(&tree, 0).unwrap());
        assert!(!is_closed_cnft_v2_tree(&tree, 1).unwrap());
        assert!(is_closed_cnft_v2_tree(&tree, 2).unwrap());
        assert!(is_closed_cnft_v2_tree(&tree, 32).unwrap());
        // Newly initialized empty tree and zeroed/uninitialized state.
        tree.try_borrow_mut_data().unwrap()[rightmost..rightmost + 4].fill(0);
        assert!(is_closed_cnft_v2_tree(&tree, 0).unwrap());
        tree.try_borrow_mut_data().unwrap()[72..80].fill(0);
        assert!(is_closed_cnft_v2_tree(&tree, 0).unwrap());
    }

    #[test]
    fn live_cnft_tree_ranges_cover_full_and_wrapped_nondefault_buffers() {
        for (depth, buffer, next_index) in [
            (3usize, 8usize, 8u32),
            (5, 8, 11),
            (14, 64, 3),
            (20, 1024, 3),
        ] {
            let key = Pubkey::new_unique();
            let mut lamports = 1;
            let rightmost = 80 + buffer * (40 + 32 * depth) + 32 * (depth + 1);
            let mut data = vec![0; rightmost + 8];
            data[0] = 1;
            data[2..6].copy_from_slice(&(buffer as u32).to_le_bytes());
            data[6..10].copy_from_slice(&(depth as u32).to_le_bytes());
            data[64..72].copy_from_slice(&((buffer - 1) as u64).to_le_bytes());
            data[72..80].copy_from_slice(&(buffer as u64).to_le_bytes());
            data[rightmost..rightmost + 4].copy_from_slice(&next_index.to_le_bytes());
            let tree = AccountInfo::new(
                &key,
                false,
                false,
                &mut lamports,
                &mut data,
                &crate::constants::MPL_ACCOUNT_COMPRESSION_PROGRAM,
                false,
            );
            assert!(!is_closed_cnft_v2_tree(&tree, 0).unwrap());
            assert!(!is_closed_cnft_v2_tree(&tree, next_index - 1).unwrap());
            assert!(is_closed_cnft_v2_tree(&tree, next_index).unwrap());
        }
    }

    #[test]
    fn refund_evidence_requires_the_exact_current_root() {
        let key = Pubkey::new_unique();
        let mut lamports = 0;
        let mut data = vec![0; 80 + 8 * (40 + 32 * 5)];
        data[0] = 1;
        data[2..6].copy_from_slice(&8u32.to_le_bytes());
        data[6..10].copy_from_slice(&5u32.to_le_bytes());
        data[64..72].copy_from_slice(&2u64.to_le_bytes());
        let root = [9; 32];
        data[480..512].copy_from_slice(&root);
        let tree = AccountInfo::new(
            &key,
            false,
            false,
            &mut lamports,
            &mut data,
            &crate::constants::MPL_ACCOUNT_COMPRESSION_PROGRAM,
            false,
        );
        assert!(assert_current_cnft_v2_root(&tree, &root).is_ok());
        let err = assert_current_cnft_v2_root(&tree, &[8; 32]).unwrap_err();
        assert!(
            matches!(err, anchor_lang::error::Error::AnchorError(e) if e.error_name == "StaleRefundEvidence")
        );
        tree.try_borrow_mut_data().unwrap()[64..72].copy_from_slice(&8u64.to_le_bytes());
        let err = assert_current_cnft_v2_root(&tree, &root).unwrap_err();
        assert!(
            matches!(err, anchor_lang::error::Error::AnchorError(e) if e.error_name == "InvalidRefundEvidence")
        );
    }

    #[test]
    fn verify_leaf_discriminator() {
        // The pinned constant in `verify_cnft_leaf` must be the Anchor
        // discriminator of spl-account-compression's `verify_leaf` — if it
        // drifts, the CPI silently targets a nonexistent instruction and the
        // already-claimed settle guard stops working.
        let hash = solana_program::hash::hash(b"global:verify_leaf");
        assert_eq!(hash.to_bytes()[..8], [124, 220, 22, 223, 104, 10, 250, 224]);
    }

    #[test]
    fn cnft_tree_versions_are_bound_to_account_owners() {
        let key = Pubkey::new_unique();
        for owner in [
            crate::constants::SPL_ACCOUNT_COMPRESSION_PROGRAM,
            crate::constants::MPL_ACCOUNT_COMPRESSION_PROGRAM,
            Pubkey::new_unique(),
        ] {
            let mut lamports = 0;
            let mut data = [];
            let tree = AccountInfo::new(&key, false, true, &mut lamports, &mut data, &owner, false);
            assert_eq!(
                assert_cnft_v1(1, &tree).is_ok(),
                owner == crate::constants::SPL_ACCOUNT_COMPRESSION_PROGRAM
            );
            assert_eq!(
                assert_cnft_v2(2, &tree).is_ok(),
                owner == crate::constants::MPL_ACCOUNT_COMPRESSION_PROGRAM
            );
            assert!(assert_cnft_v1(2, &tree).is_err());
            assert!(assert_cnft_v2(1, &tree).is_err());
        }
    }

    #[test]
    fn cnft_v2_flags_reject_unknown_bits_too() {
        assert!(assert_cnft_v2_eligible(0, None).is_ok());
        for flags in 1..=u8::MAX {
            assert!(assert_cnft_v2_eligible(flags, None).is_err());
        }
    }

    #[test]
    fn cnft_v2_leaf_royalties_and_missing_collection_fallback() {
        let creator = crate::CnftCreator {
            address: Pubkey::new_unique(),
            verified: true,
            share: 100,
        };
        let mut args = crate::CnftArgsV2 {
            root: [0; 32],
            meta_hash: [0; 32],
            seller_fee_basis_points: 500,
            creators: vec![creator.clone()],
            nonce: 0,
            index: 0,
            version: 2,
            asset_data_hash: None,
            flags: 0,
        };
        let info = get_cnft_v2_royalty_info(&args, None).unwrap();
        assert!(!info.is_primary_sale);
        assert_eq!(info.seller_fee_basis_points, 500);
        let paid = &info.creators.unwrap()[0];
        assert_eq!(paid.address, creator.address);
        assert!(paid.verified);
        assert_eq!(paid.share, 100);
        args.seller_fee_basis_points = u16::MAX;
        let info = get_cnft_v2_royalty_info(&args, None).unwrap();
        assert_eq!(info.seller_fee_basis_points, 0);
        assert!(info.creators.is_none());
        args.seller_fee_basis_points = 500;
        args.creators.clear();
        let info = get_cnft_v2_royalty_info(&args, None).unwrap();
        assert_eq!(info.seller_fee_basis_points, 0);
        assert!(info.creators.is_none());
    }

    #[test]
    fn cnft_v2_collection_verification_uses_signatures_not_update_authority() {
        use mpl_core::{
            accounts::{BaseCollectionV1, PluginHeaderV1, PluginRegistryV1},
            types::{
                Creator, Key, Plugin, PluginAuthority, PluginType, RegistryRecord, Royalties,
                RuleSet, VerifiedCreators, VerifiedCreatorsSignature,
            },
        };
        let authority = Pubkey::new_unique();
        let signed_creator = Pubkey::new_unique();
        let unsigned_creator = Pubkey::new_unique();
        for has_verified_plugin in [false, true] {
            let base = BaseCollectionV1 {
                key: Key::CollectionV1,
                update_authority: authority,
                name: "test".into(),
                uri: "".into(),
                num_minted: 1,
                current_size: 1,
            };
            let mut data = borsh::to_vec(&base).unwrap();
            let header_offset = data.len();
            data.resize(header_offset + 9, 0);
            let mut registry = vec![];
            let mut plugins = vec![Plugin::Royalties(Royalties {
                basis_points: 750,
                creators: vec![
                    Creator {
                        address: authority,
                        percentage: 40,
                    },
                    Creator {
                        address: signed_creator,
                        percentage: 30,
                    },
                    Creator {
                        address: unsigned_creator,
                        percentage: 30,
                    },
                ],
                rule_set: RuleSet::None,
            })];
            if has_verified_plugin {
                plugins.push(Plugin::VerifiedCreators(VerifiedCreators {
                    signatures: vec![
                        VerifiedCreatorsSignature {
                            address: signed_creator,
                            verified: true,
                        },
                        VerifiedCreatorsSignature {
                            address: unsigned_creator,
                            verified: false,
                        },
                    ],
                }));
            }
            plugins.push(Plugin::Attributes(mpl_core::types::Attributes {
                attribute_list: vec![mpl_core::types::Attribute {
                    key: "large".into(),
                    value: "x".repeat(40_000),
                }],
            }));
            for plugin in plugins {
                registry.push(RegistryRecord {
                    plugin_type: PluginType::from(&plugin),
                    authority: PluginAuthority::UpdateAuthority,
                    offset: data.len() as u64,
                });
                data.extend(borsh::to_vec(&plugin).unwrap());
            }
            let header = borsh::to_vec(&PluginHeaderV1 {
                key: Key::PluginHeaderV1,
                plugin_registry_offset: data.len() as u64,
            })
            .unwrap();
            data[header_offset..header_offset + 9].copy_from_slice(&header);
            data.extend(
                borsh::to_vec(&PluginRegistryV1 {
                    key: Key::PluginRegistryV1,
                    registry,
                    external_registry: vec![],
                })
                .unwrap(),
            );
            let key = Pubkey::new_unique();
            let mut lamports = 0;
            let collection = AccountInfo::new(
                &key,
                false,
                false,
                &mut lamports,
                &mut data,
                &mpl_core::ID,
                false,
            );
            let args = crate::CnftArgsV2 {
                root: [0; 32],
                meta_hash: [0; 32],
                seller_fee_basis_points: u16::MAX,
                creators: vec![],
                nonce: 0,
                index: 0,
                version: 2,
                asset_data_hash: None,
                flags: 0,
            };
            assert!(assert_cnft_v2_eligible(0, Some(&collection)).is_ok());
            let info = get_cnft_v2_royalty_info(&args, Some(&collection)).unwrap();
            assert!(!info.is_primary_sale);
            assert_eq!(info.seller_fee_basis_points, 750);
            let creators = info.creators.unwrap();
            assert!(!creators[0].verified);
            assert_eq!(creators[1].verified, has_verified_plugin);
            assert!(!creators[2].verified);
        }
    }

    #[test]
    fn check_keys_equal() {
        let key1 = Pubkey::new_unique();
        assert!(cmp_pubkeys(&key1, &key1));
    }

    #[test]
    fn check_keys_not_equal() {
        let key1 = Pubkey::new_unique();
        let key2 = Pubkey::new_unique();
        assert!(!cmp_pubkeys(&key1, &key2));
    }
}
