//! Token-2022 currency support (TOKEN22_PLAN §D2, §D4, §D6).
//!
//! Only the **payment** side of a gumball / jellybean accepts Token-2022. Prize
//! tokens (`add_tokens` / `claim_tokens` / `remove_tokens`) and every NFT / Core
//! asset path stay on classic SPL Token.
//!
//! This is a deliberate copy of `mallow-utils/src/token22.rs` in the
//! `mallow-program-library` repo: the two repos share no crate, and
//! `programs/utils/src/transfer.rs` is already a near-duplicate of
//! `mallow-utils/src/transfer.rs`. Keep the two in step.
//!
//! # Extension allowlist (§D2)
//!
//! A currency mint is accepted only if **every** extension on it is on
//! [`ALLOWED_MINT_EXTENSIONS`]. Deny-by-default: anything absent from the list
//! is rejected, so the reject list is documentation, not logic.
//!
//! The screen is durable because no *rejected* extension can appear after
//! `InitializeMint`: every one of them initializes through `unpack_uninitialized`,
//! which only succeeds pre-init. The three extensions that can be added later
//! (`TokenMetadata`, `TokenGroup`, `TokenGroupMember`) are all allowed, and their
//! prerequisite pointers (`MetadataPointer` / `GroupPointer` / `GroupMemberPointer`)
//! are pre-init-only. So a screened mint can only ever grow *allowed* extensions.
//! The one escape — close and re-initialize at the same address — is why
//! `MintCloseAuthority` is rejected. A list-time screen is therefore sufficient
//! and no re-check is needed at buy or settle time.
//!
//! **Version caveat.** An extension unknown to the linked `spl-token-2022`
//! version does not parse as an `ExtensionType` at all: `get_extension_types()`
//! returns `InvalidAccountData` and the mint fails closed. Safe, but it means the
//! allowlist's effective surface is bounded by the crate version in the graph.

use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::{
    extension::{BaseStateWithExtensions, ExtensionType, StateWithExtensions},
    state::Mint as SplMint,
};
use solana_program::account_info::AccountInfo;
use solana_program::pubkey::Pubkey;

use crate::error::Error;

/// Classic SPL Token program id.
pub fn spl_token_program_id() -> Pubkey {
    anchor_spl::token::ID
}

/// Token-2022 program id.
pub fn token_2022_program_id() -> Pubkey {
    anchor_spl::token_2022::ID
}

/// Mint extensions a Token-2022 **currency** mint may carry.
///
/// Everything else — `TransferFeeConfig`, `TransferHook`, `NonTransferable`,
/// `PermanentDelegate`, `DefaultAccountState`, `ConfidentialTransferMint`,
/// `ConfidentialTransferFeeConfig`, `ConfidentialMintBurn`, `MintCloseAuthority`,
/// `Pausable`, `InterestBearingConfig`, `ScaledUiAmount` — fails closed with
/// [`Error::UnsupportedTokenExtension`].
///
/// Transfer-fee currencies are deliberately out of scope: the recipient would
/// receive less than the sender sends, and every royalty split, escrow balance
/// and fee calculation would need a gross-up. Rejecting them here is what makes
/// "never infer amount-received from amount-sent" a safe assumption everywhere
/// downstream.
pub const ALLOWED_MINT_EXTENSIONS: &[ExtensionType] = &[
    ExtensionType::MetadataPointer,
    ExtensionType::TokenMetadata,
    ExtensionType::GroupPointer,
    ExtensionType::GroupMemberPointer,
    ExtensionType::TokenGroup,
    ExtensionType::TokenGroupMember,
];

/// True when `account` is owned by the Token-2022 program.
pub fn is_token_2022_account(account: &AccountInfo) -> bool {
    *account.owner == token_2022_program_id()
}

/// True when `program_id` is either token program.
pub fn is_token_program(program_id: &Pubkey) -> bool {
    *program_id == spl_token_program_id() || *program_id == token_2022_program_id()
}

/// Applies the §D2 extension allowlist to a mint account.
///
/// Classic SPL mints cannot carry extensions, so they short-circuit. Call this
/// wherever a payment mint is first accepted — machine creation, and the
/// `Token2022Payment` guard's `validate` — not on the hot transfer path.
pub fn assert_mint_extensions_allowed(mint: &AccountInfo) -> Result<()> {
    if *mint.owner == spl_token_program_id() {
        return Ok(());
    }

    let data = mint.try_borrow_data()?;
    let state = StateWithExtensions::<SplMint>::unpack(&data)?;
    for extension in state.get_extension_types()? {
        if !ALLOWED_MINT_EXTENSIONS.contains(&extension) {
            msg!("Unsupported token extension: {:?}", extension);
            return err!(Error::UnsupportedTokenExtension);
        }
    }

    Ok(())
}

/// Unpacks a mint owned by **either** token program and returns its decimals.
///
/// Never pins the owner to classic SPL Token, and never hardcodes a mint account
/// size — a Token-2022 mint with extensions is larger than the classic 82 bytes
/// (TOADS is 369).
pub fn unpack_currency_mint_decimals(mint: &AccountInfo) -> Result<u8> {
    if !is_token_program(mint.owner) {
        msg!("Mint {} is not owned by a token program", mint.key());
        return err!(Error::InvalidOwner);
    }

    let data = mint.try_borrow_data()?;
    let state = StateWithExtensions::<SplMint>::unpack(&data)?;
    if !state.base.is_initialized {
        return err!(Error::UninitializedAccount);
    }

    Ok(state.base.decimals)
}

/// Full currency-mint screen: accepts either token program, applies the §D2
/// extension allowlist, and returns `(owning token program id, decimals)`.
pub fn assert_is_currency_mint(mint: &AccountInfo) -> Result<(Pubkey, u8)> {
    let decimals = unpack_currency_mint_decimals(mint)?;
    assert_mint_extensions_allowed(mint)?;
    Ok((*mint.owner, decimals))
}

/// §D6 anti-spoof invariant: the mint must be owned by the token program the
/// caller is about to CPI into.
///
/// Without this a caller could hand a Token-2022 mint alongside the classic
/// program (or the reverse) and have the transfer executed by the wrong program.
pub fn assert_mint_matches_token_program(
    mint: &AccountInfo,
    token_program: &AccountInfo,
) -> Result<()> {
    if *mint.owner != *token_program.key {
        msg!(
            "Mint {} is owned by {} but token program {} was supplied",
            mint.key(),
            mint.owner,
            token_program.key()
        );
        return err!(Error::InvalidTokenProgram);
    }

    Ok(())
}

/// Resolves the token program that owns a currency mint.
///
/// `token_program` is the program the instruction already names — the classic
/// `Program<'info, Token>` for a §D5 Class 2 instruction, or the dedicated
/// `Interface<'info, TokenInterface>` for a Class 3 one. When it already matches
/// the mint's owner it is used directly and no slot is needed; that covers both
/// every classic call (unchanged, byte for byte) and every Class 3 call.
///
/// Otherwise the mint must be Token-2022 and `slot` — the §D5 conditional
/// remaining account — must carry the Token-2022 program, bound by key so it
/// cannot be spoofed. A Token-2022 mint with the slot omitted fails closed.
///
/// `currency_mint` is `None` for a native-SOL payment; nothing to resolve.
pub fn resolve_currency_token_program<'a, 'b>(
    currency_mint: Option<&'b AccountInfo<'a>>,
    slot: Option<&'b AccountInfo<'a>>,
    token_program: &'b AccountInfo<'a>,
) -> Result<&'b AccountInfo<'a>> {
    let mint = match currency_mint {
        None => return Ok(token_program),
        Some(mint) => mint,
    };

    if !is_token_program(mint.owner) {
        msg!("Mint {} is not owned by a token program", mint.key());
        return err!(Error::InvalidOwner);
    }

    // §D6: the named program already owns the mint.
    if *mint.owner == *token_program.key {
        return Ok(token_program);
    }

    // The only remaining legitimate case is a Token-2022 mint reached through an
    // instruction that names the classic program.
    if *mint.owner != token_2022_program_id() || *token_program.key != spl_token_program_id() {
        msg!(
            "Mint {} is owned by {} but token program {} was supplied",
            mint.key(),
            mint.owner,
            token_program.key()
        );
        return err!(Error::InvalidTokenProgram);
    }

    let slot = match slot {
        Some(slot) => slot,
        None => {
            msg!(
                "Token-2022 currency mint {} requires the Token-2022 program in its remaining-account slot",
                mint.key()
            );
            return err!(Error::MissingTokenProgram);
        }
    };

    if *slot.key != token_2022_program_id() {
        msg!(
            "Expected the Token-2022 program in the currency slot, got {}",
            slot.key()
        );
        return err!(Error::InvalidTokenProgram);
    }

    Ok(slot)
}

/// Convenience wrapper over [`resolve_currency_token_program`] that reads both
/// the mint and the program out of a remaining-account slice.
///
/// `mint_index` / `slot_index` are absolute indices into `remaining_accounts`.
/// See the layout table in `transfer.rs` for the per-family values.
pub fn resolve_currency_token_program_at<'a, 'b>(
    remaining_accounts: &'b [AccountInfo<'a>],
    mint_index: usize,
    slot_index: usize,
    classic_token_program: &'b AccountInfo<'a>,
) -> Result<&'b AccountInfo<'a>> {
    let mint = remaining_accounts.get(mint_index);
    let slot = remaining_accounts.get(slot_index);
    resolve_currency_token_program(mint, slot, classic_token_program)
}

/// True when a Token-2022 program slot is expected right after this mint's
/// currency accounts. Used by the layout-owning helpers to know whether to
/// consume one extra remaining account.
pub fn expects_token_program_slot(currency_mint: Option<&AccountInfo>) -> bool {
    currency_mint.is_some_and(is_token_2022_account)
}
