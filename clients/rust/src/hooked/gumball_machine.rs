//! Hand-written runtime codec for the variable-size `GumballMachine` account.
//!
//! The Codama-generated [`GumballMachine`] struct decodes only the fixed base
//! header (up to `settings`). On-chain the account continues with a manually
//! serialized "hidden section" that the `mallow_gumball` program writes at a
//! fixed byte offset (see `programs/mallow-gumball` state + `add_item` /
//! `claim_item` processors). This module mirrors that layout — byte-for-byte
//! with the umi/js `getGumballMachineAccountData` decoder — so the full account,
//! including the loaded items, can be read off-chain.

use borsh::BorshDeserialize;
use solana_address::Address;

use crate::generated::{
    accounts::GumballMachine,
    types::{BuyBackConfig, TokenStandard},
};

/// Byte offset at which the hidden section begins. Mirrors the program's
/// `GUMBALL_MACHINE_SIZE` constant:
///
///   8 discriminator + 1 version + 32 authority + 32 mint_authority
///   + 34 fee_config + 1 marketplace_fee_config (option flag) + 8 items_redeemed
///   + 8 items_settled + 8 total_revenue + 1 state + 200 uri + 8 item_capacity
///   + 2 items_per_seller + 33 sellers_merkle_root (option flag + hash)
///   + 2 curator_fee_bps + 1 hide_sold_items + 32 payment_mint = 419.
pub const GUMBALL_MACHINE_HIDDEN_SECTION: usize = 419;

/// A single item (config line) loaded into a Gumball Machine, decoded from the
/// hidden section and cross-referenced against the claimed/settled bitmaps and
/// the remaining-mint index list.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GumballMachineItem {
    /// The index of the config line.
    pub index: u32,
    /// Whether the item has been drawn (no longer in the mint pool).
    pub is_drawn: bool,
    /// Whether the item has been claimed.
    pub is_claimed: bool,
    /// Whether the item's sale has been settled.
    pub is_settled: bool,
    /// Mint / asset address.
    pub mint: Address,
    /// Wallet that submitted the item for sale.
    pub seller: Address,
    /// Wallet that drew the item, if any (empty on-chain address decodes to `None`).
    pub buyer: Option<Address>,
    /// Token standard of the item.
    pub token_standard: TokenStandard,
    /// Amount of the asset (always 1 for account versions < 2).
    pub amount: u64,
}

/// The fully decoded `GumballMachine` account: the generated fixed base header
/// plus the manually serialized hidden section.
#[derive(Clone, Debug)]
pub struct GumballMachineAccountData {
    /// The fixed base header (version, authority, settings, …).
    pub base: GumballMachine,
    /// Number of config lines actually loaded.
    pub items_loaded: u32,
    /// The loaded items.
    pub items: Vec<GumballMachineItem>,
    /// Whether royalties are disabled (account version >= 3).
    pub disable_royalties: bool,
    /// Whether the primary sale split is disabled (account version >= 3).
    pub disable_primary_split: bool,
    /// Buy-back configuration (account version >= 4).
    pub buy_back_config: BuyBackConfig,
    /// Lamports/tokens held for buy-backs (account version >= 4).
    pub buy_back_funds_available: u64,
    /// Total proceeds settled to date (account version >= 5).
    pub total_proceeds_settled: u64,
}

impl GumballMachineAccountData {
    /// Decodes a full Gumball Machine account from its raw account data.
    pub fn from_bytes(data: &[u8]) -> std::io::Result<Self> {
        let base = GumballMachine::from_bytes(data)?;
        let version = base.version;
        let item_capacity = base.settings.item_capacity as usize;
        // Bit masks are `(item_capacity / 8) + 1` bytes (matches the program).
        let bitmap_size = item_capacity / 8 + 1;

        let mut rdr: &[u8] = data
            .get(GUMBALL_MACHINE_HIDDEN_SECTION..)
            .ok_or_else(|| std::io::Error::other("account too small for hidden section"))?;

        let items_loaded = u32::deserialize(&mut rdr)?;

        let default_address = Address::from([0u8; 32]);
        let mut raw_lines: Vec<(Address, Address, Address, TokenStandard, u64)> =
            Vec::with_capacity(item_capacity);
        for _ in 0..item_capacity {
            let mint = Address::deserialize(&mut rdr)?;
            let seller = Address::deserialize(&mut rdr)?;
            let buyer = Address::deserialize(&mut rdr)?;
            let token_standard = TokenStandard::deserialize(&mut rdr)?;
            // Version 1 config lines have no `amount` field; the program treats it as 1.
            let amount = if version >= 2 {
                u64::deserialize(&mut rdr)?
            } else {
                1
            };
            raw_lines.push((mint, seller, buyer, token_standard, amount));
        }

        let items_claimed = read_bit_array(&mut rdr, bitmap_size)?;
        let items_settled = read_bit_array(&mut rdr, bitmap_size)?;

        let mut items_left_to_mint = Vec::with_capacity(item_capacity);
        for _ in 0..item_capacity {
            items_left_to_mint.push(u32::deserialize(&mut rdr)?);
        }

        let mut disable_royalties = false;
        let mut disable_primary_split = false;
        if version >= 3 {
            disable_royalties = bool::deserialize(&mut rdr)?;
            let _unused = <[u8; 3]>::deserialize(&mut rdr)?;
            disable_primary_split = bool::deserialize(&mut rdr)?;
        }

        let mut buy_back_config = default_buy_back_config(default_address);
        let mut buy_back_funds_available = 0u64;
        if version >= 4 {
            buy_back_config = BuyBackConfig::deserialize(&mut rdr)?;
            buy_back_funds_available = u64::deserialize(&mut rdr)?;
        }

        let mut total_proceeds_settled = 0u64;
        if version >= 5 {
            total_proceeds_settled = u64::deserialize(&mut rdr)?;
        }

        // Items that have NOT yet been drawn appear in the remaining-mint list,
        // which is only meaningful up to `items_loaded - items_redeemed` entries.
        let items_minted = base.items_redeemed as usize;
        let items_remaining = (items_loaded as usize).saturating_sub(items_minted);
        let left_slice = &items_left_to_mint[..items_remaining.min(items_left_to_mint.len())];

        let mut items = Vec::with_capacity(items_loaded as usize);
        for (index, &(mint, seller, buyer, token_standard, amount)) in
            raw_lines.iter().take(items_loaded as usize).enumerate()
        {
            items.push(GumballMachineItem {
                index: index as u32,
                is_drawn: !left_slice.contains(&(index as u32)),
                is_claimed: items_claimed.get(index).copied().unwrap_or(false),
                is_settled: items_settled.get(index).copied().unwrap_or(false),
                mint,
                seller,
                buyer: if buyer == default_address {
                    None
                } else {
                    Some(buyer)
                },
                token_standard,
                amount,
            });
        }

        Ok(Self {
            base,
            items_loaded,
            items,
            disable_royalties,
            disable_primary_split,
            buy_back_config,
            buy_back_funds_available,
            total_proceeds_settled,
        })
    }
}

impl<'a> TryFrom<&solana_account_info::AccountInfo<'a>> for GumballMachineAccountData {
    type Error = std::io::Error;

    fn try_from(account_info: &solana_account_info::AccountInfo<'a>) -> Result<Self, Self::Error> {
        Self::from_bytes(&account_info.data.borrow())
    }
}

/// Fetches and fully decodes a Gumball Machine account, including its items.
#[cfg(feature = "fetch")]
pub fn fetch_gumball_machine_account_data(
    rpc: &solana_rpc_client::rpc_client::RpcClient,
    address: &Address,
) -> Result<GumballMachineAccountData, std::io::Error> {
    let decoded = crate::generated::accounts::fetch_gumball_machine(rpc, address)?;
    GumballMachineAccountData::from_bytes(&decoded.account.data)
}

/// The default (all-zero) buy-back config used for account versions < 4, which
/// predate the buy-back feature. Mirrors the program's `BuyBackConfig::default`.
fn default_buy_back_config(default_address: Address) -> BuyBackConfig {
    BuyBackConfig {
        enabled: false,
        to_gumball_machine: false,
        oracle_signer: default_address,
        value_pct: 0,
        marketplace_fee_bps: 0,
        cutoff_pct: 0,
    }
}

/// Decodes a fixed-length bit array of `size` bytes into `size * 8` booleans,
/// reading most-significant-bit first (matches the program's bit masks and
/// umi's forward `bitArray` serializer), advancing the reader past it.
fn read_bit_array(rdr: &mut &[u8], size: usize) -> std::io::Result<Vec<bool>> {
    if rdr.len() < size {
        return Err(std::io::Error::other("not enough bytes for bit array"));
    }
    let (slice, rest) = rdr.split_at(size);
    *rdr = rest;
    let mut bits = Vec::with_capacity(size * 8);
    for &byte in slice {
        let mut b = byte;
        for _ in 0..8 {
            bits.push(b & 0b1000_0000 != 0);
            b <<= 1;
        }
    }
    Ok(bits)
}
