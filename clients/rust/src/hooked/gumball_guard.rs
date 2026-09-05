//! Hand-written runtime codec for the variable-size `GumballGuard` account.
//!
//! The Codama-generated [`GumballGuard`] struct decodes only the fixed base
//! header (base / bump / authority). On-chain the account continues with a
//! manually serialized guard section that the `gumball_guard` program writes via
//! the `GuardSet` derive macro: a `u64` feature bitmask followed by the packed,
//! fixed-size data of each enabled guard, in guard-type order; then a `u32`
//! group count and, per group, a 6-byte label plus a nested guard set.
//!
//! This module mirrors that layout so the active guards can be read off-chain.
//! Each guard's byte size and feature bit are taken directly from the program's
//! `Guard` impls (`programs/gumball-guard/.../guards/*.rs`).

use borsh::BorshDeserialize;

use crate::generated::{
    accounts::GumballGuard,
    types::{
        AddressGate, Allocation, AllowList, BotTax, EndDate, Gatekeeper, MintLimit, NftBurn,
        NftGate, NftPayment, ProgramGate, RedeemedAmount, SolPayment, StartDate, ThirdPartySigner,
        Token2022Payment, TokenBurn, TokenGate, TokenPayment,
    },
};

/// Byte offset at which the guard data section begins:
/// 8 discriminator + 32 base + 1 bump + 32 authority. Mirrors the program's
/// `DATA_OFFSET`.
pub const DATA_OFFSET: usize = 8 + 32 + 1 + 32;

/// Fixed on-chain byte size reserved for each guard (its program `Guard::size`).
mod guard_size {
    pub const BOT_TAX: usize = 9; // u64 lamports + bool
    pub const START_DATE: usize = 8; // i64 date
    pub const SOL_PAYMENT: usize = 8; // u64 lamports
    pub const TOKEN_PAYMENT: usize = 40; // u64 amount + Pubkey mint
    pub const THIRD_PARTY_SIGNER: usize = 32; // Pubkey signer
    pub const TOKEN_GATE: usize = 40; // u64 amount + Pubkey mint
    pub const GATEKEEPER: usize = 33; // Pubkey network + bool expire_on_use
    pub const END_DATE: usize = 8; // i64 date
    pub const ALLOW_LIST: usize = 32; // [u8; 32] merkle root
    pub const MINT_LIMIT: usize = 3; // u8 id + u16 limit
    pub const NFT_PAYMENT: usize = 64; // Pubkey collection + Pubkey destination
    pub const REDEEMED_AMOUNT: usize = 8; // u64 maximum
    pub const ADDRESS_GATE: usize = 32; // Pubkey address
    pub const NFT_GATE: usize = 32; // Pubkey collection
    pub const NFT_BURN: usize = 32; // Pubkey collection
    pub const TOKEN_BURN: usize = 40; // u64 amount + Pubkey mint
    pub const PROGRAM_GATE: usize = 164; // u32 len + 5 * Pubkey (fixed reserve)
    pub const ALLOCATION: usize = 5; // u8 id + u32 limit
    pub const TOKEN2022_PAYMENT: usize = 72; // u64 amount + Pubkey mint + Pubkey destination
}

/// The set of guards available, in the program's guard-type (feature bit) order.
/// A `None` field means the guard is not enabled in this set.
#[derive(Clone, Debug, Default)]
pub struct GuardSet {
    pub bot_tax: Option<BotTax>,
    pub start_date: Option<StartDate>,
    pub sol_payment: Option<SolPayment>,
    pub token_payment: Option<TokenPayment>,
    pub third_party_signer: Option<ThirdPartySigner>,
    pub token_gate: Option<TokenGate>,
    pub gatekeeper: Option<Gatekeeper>,
    pub end_date: Option<EndDate>,
    pub allow_list: Option<AllowList>,
    pub mint_limit: Option<MintLimit>,
    pub nft_payment: Option<NftPayment>,
    pub redeemed_amount: Option<RedeemedAmount>,
    pub address_gate: Option<AddressGate>,
    pub nft_gate: Option<NftGate>,
    pub nft_burn: Option<NftBurn>,
    pub token_burn: Option<TokenBurn>,
    pub program_gate: Option<ProgramGate>,
    pub allocation: Option<Allocation>,
    pub token2022_payment: Option<Token2022Payment>,
}

impl GuardSet {
    /// Decodes a guard set from the start of `data`, returning the set and the
    /// number of bytes it consumed (the 8-byte feature mask plus each enabled
    /// guard's fixed size).
    pub fn from_data(data: &[u8]) -> std::io::Result<(Self, usize)> {
        let features = u64::from_le_bytes(
            data.get(0..8)
                .ok_or_else(|| std::io::Error::other("missing guard feature mask"))?
                .try_into()
                .unwrap(),
        );
        let mut cursor = 8usize;

        let set = GuardSet {
            bot_tax: read_guard(data, features, 0, guard_size::BOT_TAX, &mut cursor)?,
            start_date: read_guard(data, features, 1, guard_size::START_DATE, &mut cursor)?,
            sol_payment: read_guard(data, features, 2, guard_size::SOL_PAYMENT, &mut cursor)?,
            token_payment: read_guard(data, features, 3, guard_size::TOKEN_PAYMENT, &mut cursor)?,
            third_party_signer: read_guard(
                data,
                features,
                4,
                guard_size::THIRD_PARTY_SIGNER,
                &mut cursor,
            )?,
            token_gate: read_guard(data, features, 5, guard_size::TOKEN_GATE, &mut cursor)?,
            gatekeeper: read_guard(data, features, 6, guard_size::GATEKEEPER, &mut cursor)?,
            end_date: read_guard(data, features, 7, guard_size::END_DATE, &mut cursor)?,
            allow_list: read_guard(data, features, 8, guard_size::ALLOW_LIST, &mut cursor)?,
            mint_limit: read_guard(data, features, 9, guard_size::MINT_LIMIT, &mut cursor)?,
            nft_payment: read_guard(data, features, 10, guard_size::NFT_PAYMENT, &mut cursor)?,
            redeemed_amount: read_guard(
                data,
                features,
                11,
                guard_size::REDEEMED_AMOUNT,
                &mut cursor,
            )?,
            address_gate: read_guard(data, features, 12, guard_size::ADDRESS_GATE, &mut cursor)?,
            nft_gate: read_guard(data, features, 13, guard_size::NFT_GATE, &mut cursor)?,
            nft_burn: read_guard(data, features, 14, guard_size::NFT_BURN, &mut cursor)?,
            token_burn: read_guard(data, features, 15, guard_size::TOKEN_BURN, &mut cursor)?,
            program_gate: read_guard(data, features, 16, guard_size::PROGRAM_GATE, &mut cursor)?,
            allocation: read_guard(data, features, 17, guard_size::ALLOCATION, &mut cursor)?,
            token2022_payment: read_guard(
                data,
                features,
                18,
                guard_size::TOKEN2022_PAYMENT,
                &mut cursor,
            )?,
        };

        Ok((set, cursor))
    }
}

/// A named group of guards. Transactions select a group by its label.
#[derive(Clone, Debug)]
pub struct Group {
    /// Group label (up to 6 bytes on-chain; trailing null padding is stripped).
    pub label: String,
    /// The guards for this group.
    pub guards: GuardSet,
}

/// The decoded guard data section: the default guard set plus any named groups.
#[derive(Clone, Debug)]
pub struct GumballGuardData {
    pub default: GuardSet,
    pub groups: Vec<Group>,
}

/// Maximum on-chain group label size (mirrors the program's `MAX_LABEL_SIZE`).
const MAX_LABEL_SIZE: usize = 6;

impl GumballGuardData {
    /// Decodes the guard data section from a full Gumball Guard account's data.
    pub fn from_bytes(account_data: &[u8]) -> std::io::Result<Self> {
        let data = account_data
            .get(DATA_OFFSET..)
            .ok_or_else(|| std::io::Error::other("account too small for guard data"))?;

        let (default, default_size) = GuardSet::from_data(data)?;
        let mut cursor = default_size;

        let group_counter = u32::from_le_bytes(
            data.get(cursor..cursor + 4)
                .ok_or_else(|| std::io::Error::other("missing guard group count"))?
                .try_into()
                .unwrap(),
        );
        cursor += 4;

        let mut groups = Vec::with_capacity(group_counter as usize);
        for _ in 0..group_counter {
            let label_bytes = data
                .get(cursor..cursor + MAX_LABEL_SIZE)
                .ok_or_else(|| std::io::Error::other("missing guard group label"))?;
            let label = String::from_utf8_lossy(label_bytes)
                .trim_end_matches('\0')
                .to_string();
            cursor += MAX_LABEL_SIZE;

            let (guards, guards_size) = GuardSet::from_data(
                data.get(cursor..)
                    .ok_or_else(|| std::io::Error::other("missing guard group data"))?,
            )?;
            cursor += guards_size;

            groups.push(Group { label, guards });
        }

        Ok(Self { default, groups })
    }
}

/// The fully decoded `GumballGuard` account: the generated fixed base header
/// plus the manually serialized guard data section.
#[derive(Clone, Debug)]
pub struct GumballGuardAccountData {
    /// The fixed base header (base, bump, authority).
    pub base: GumballGuard,
    /// The default guard set and any named groups.
    pub data: GumballGuardData,
}

impl GumballGuardAccountData {
    /// Decodes a full Gumball Guard account from its raw account data.
    pub fn from_bytes(account_data: &[u8]) -> std::io::Result<Self> {
        let base = GumballGuard::from_bytes(account_data)?;
        let data = GumballGuardData::from_bytes(account_data)?;
        Ok(Self { base, data })
    }
}

impl<'a> TryFrom<&solana_account_info::AccountInfo<'a>> for GumballGuardAccountData {
    type Error = std::io::Error;

    fn try_from(account_info: &solana_account_info::AccountInfo<'a>) -> Result<Self, Self::Error> {
        Self::from_bytes(&account_info.data.borrow())
    }
}

/// Fetches and fully decodes a Gumball Guard account, including its guards.
#[cfg(feature = "fetch")]
pub fn fetch_gumball_guard_account_data(
    rpc: &solana_rpc_client::rpc_client::RpcClient,
    address: &solana_address::Address,
) -> Result<GumballGuardAccountData, std::io::Error> {
    let decoded = crate::generated::accounts::fetch_gumball_guard(rpc, address)?;
    GumballGuardAccountData::from_bytes(&decoded.account.data)
}

/// Reads one guard of type `T` if its `bit` is set in `features`, borsh-decoding
/// exactly `size` bytes from `data[cursor..]` and advancing the cursor. Uses the
/// reader-style `deserialize` (not `try_from_slice`) so guards whose serialized
/// data is shorter than their reserved size (e.g. `ProgramGate`) decode cleanly.
fn read_guard<T: BorshDeserialize>(
    data: &[u8],
    features: u64,
    bit: u8,
    size: usize,
    cursor: &mut usize,
) -> std::io::Result<Option<T>> {
    if features & (1u64 << bit) == 0 {
        return Ok(None);
    }
    let end = *cursor + size;
    let mut slice = data
        .get(*cursor..end)
        .ok_or_else(|| std::io::Error::other("guard data out of bounds"))?;
    let guard = T::deserialize(&mut slice)?;
    *cursor = end;
    Ok(Some(guard))
}
