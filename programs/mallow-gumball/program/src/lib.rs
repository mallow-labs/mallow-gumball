#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

pub use errors::GumballError;
use instructions::*;
pub use state::*;
pub use utils::*;

pub mod constants;
pub mod errors;
mod events;
mod instructions;
mod processors;
mod state;
mod utils;

declare_id!("MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa");

#[program]
pub mod mallow_gumball {
    use super::*;

    /// Initialize the gumball machine account with the specified data.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account (must be pre-allocated but zero content)
    ///   2. `[]` Gumball Machine authority
    ///   3. `[signer]` Payer
    pub fn initialize(
        ctx: Context<Initialize>,
        settings: GumballSettings,
        fee_config: Option<FeeConfig>,
    ) -> Result<()> {
        instructions::initialize(ctx, settings, fee_config)
    }

    /// Updates gumball machine settings.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[signer]` Gumball Machine authority
    pub fn update_settings(ctx: Context<UpdateSettings>, settings: GumballSettings) -> Result<()> {
        instructions::update_settings(ctx, settings)
    }

    /// Add legacy NFTs to the gumball machine.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[signer, writable]` Seller
    ///   4. `[]` Mint account
    ///   5. `[writable]` Token account
    ///   6. `[]` Metadata account
    ///   7. `[]` Edition account
    ///   8. `[]` Token program
    ///   9. `[]` Token Metadata program
    ///   10. `[]` System program
    pub fn add_nft(ctx: Context<AddNft>, seller_proof_path: Option<Vec<[u8; 32]>>) -> Result<()> {
        instructions::add_nft(ctx, seller_proof_path)
    }

    /// Add Core assets to the gumball machine.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[signer, writable]` Seller
    ///   4. `[writable]` Asset account
    ///   5. `[writable, optional]` Collection account
    ///   6. `[]` MPL Core program
    ///   7. `[]` System program
    pub fn add_core_asset(
        ctx: Context<AddCoreAsset>,
        seller_proof_path: Option<Vec<[u8; 32]>>,
    ) -> Result<()> {
        instructions::add_core_asset(ctx, seller_proof_path)
    }

    /// Add fungible tokens to the gumball machine.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[signer, writable]` Seller
    ///   4. `[]` Mint account
    ///   5. `[writable]` Seller's token account
    ///   6. `[writable]` Gumball machine's token account
    ///   7. `[]` Token program
    ///   8. `[]` Associated Token program
    ///   9. `[]` System program
    ///   10. `[]` Rent sysvar
    pub fn add_tokens(
        ctx: Context<AddTokens>,
        amount: u64,
        quantity: u16,
        seller_proof_path: Option<Vec<[u8; 32]>>,
    ) -> Result<()> {
        instructions::add_tokens(ctx, amount, quantity, seller_proof_path)
    }

    /// Request to add a NFT to the gumball machine.
    pub fn request_add_nft(ctx: Context<RequestAddNft>) -> Result<()> {
        instructions::request_add_nft(ctx)
    }

    /// Request to add a core asset to the gumball machine.
    pub fn request_add_core_asset(ctx: Context<RequestAddCoreAsset>) -> Result<()> {
        instructions::request_add_core_asset(ctx)
    }

    /// Cancel a request to add a NFT to the gumball machine.
    pub fn cancel_add_nft_request(ctx: Context<CancelAddNftRequest>) -> Result<()> {
        instructions::cancel_add_nft_request(ctx)
    }

    /// Cancel a request to add a core asset to the gumball machine.
    pub fn cancel_add_core_asset_request(ctx: Context<CancelAddCoreAssetRequest>) -> Result<()> {
        instructions::cancel_add_core_asset_request(ctx)
    }

    /// Approve adding an item to the gumball machine.
    pub fn approve_add_item(ctx: Context<ApproveAddItem>) -> Result<()> {
        instructions::approve_add_item(ctx)
    }

    /// Remove legacy NFT from the gumball machine.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[signer]` Gumball Machine authority
    pub fn remove_nft(ctx: Context<RemoveNft>, index: u32) -> Result<()> {
        instructions::remove_nft(ctx, index)
    }

    /// Remove Core asset from the gumball machine.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[signer]` Gumball Machine authority
    pub fn remove_core_asset(ctx: Context<RemoveCoreAsset>, index: u32) -> Result<()> {
        instructions::remove_core_asset(ctx, index)
    }

    /// Remove fungible tokens from the gumball machine.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[signer, writable]` Seller
    ///   4. `[]` Mint account
    ///   5. `[writable]` Seller's token account
    ///   6. `[writable]` Gumball machine's token account
    ///   7. `[]` Token program
    ///   8. `[]` Associated Token program
    ///   9. `[]` System program
    ///   10. `[]` Rent sysvar
    pub fn remove_tokens(ctx: Context<RemoveTokens>, indices: Vec<u8>, amount: u64) -> Result<()> {
        instructions::remove_tokens(ctx, indices, amount)
    }

    /// Allows minting to begin.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[signer]` Gumball Machine authority
    pub fn start_sale(ctx: Context<StartSale>) -> Result<()> {
        instructions::start_sale(ctx)
    }

    /// Disables minting and allows sales to be settled.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[signer]` Gumball Machine authority
    pub fn end_sale(ctx: Context<EndSale>) -> Result<()> {
        instructions::end_sale(ctx)
    }

    /// Mint an NFT.
    ///
    /// Only the gumball machine mint authority is allowed to mint. This handler mints both
    /// NFTs and Programmable NFTs.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account (must be pre-allocated but zero content)
    ///   2. `[signer]` Gumball Machine mint authority
    ///   3. `[signer]` Payer
    ///   4. `[writable]` Mint account of the NFT
    ///   18. `[]` System program
    ///   20. `[]` SlotHashes sysvar cluster data.
    pub fn draw<'info>(ctx: Context<'_, '_, '_, 'info, Draw<'info>>) -> Result<()> {
        instructions::draw(ctx)
    }

    /// Increments total revenue earned by the gumball machine.
    ///
    /// Only the gumball machine mint authority is allowed to increment revenue. This is
    /// required as token transfers don't occur in this program, but total is needed
    /// when settling.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account (must be pre-allocated but zero content)
    ///   2. `[signer]` Gumball Machine mint authority
    pub fn increment_total_revenue<'info>(
        ctx: Context<'_, '_, '_, 'info, IncrementTotalRevenue<'info>>,
        revenue: u64,
    ) -> Result<()> {
        instructions::increment_total_revenue(ctx, revenue)
    }

    /// Settles a Core asset sale
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[signer]` Gumball Machine authority
    pub fn claim_core_asset<'info>(
        ctx: Context<'_, '_, '_, 'info, ClaimCoreAsset<'info>>,
        index: u32,
    ) -> Result<()> {
        instructions::claim_core_asset(ctx, index)
    }

    /// Settles a legacy NFT sale
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[signer]` Gumball Machine authority
    pub fn claim_nft<'info>(
        ctx: Context<'_, '_, '_, 'info, ClaimNft<'info>>,
        index: u32,
    ) -> Result<()> {
        instructions::claim_nft(ctx, index)
    }

    /// Claims fungible tokens from the gumball machine for a specific buyer.
    ///
    /// # Accounts
    ///
    ///   0. `[signer]` Payer (anyone can settle the sale)
    ///   1. `[writable]` Gumball Machine account (must be in SaleLive or SaleEnded state)
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[writable]` Gumball Machine authority
    ///   4. `[writable]` Seller account
    ///   5. `[]` Buyer account
    ///   6. `[]` Token program
    ///   7. `[]` Associated Token program
    ///   8. `[]` System program
    ///   9. `[]` Rent sysvar
    ///   10. `[]` Mint account
    ///   11. `[writable]` Buyer's token account (must match mint and buyer)
    ///   12. `[writable]` Authority PDA's token account (must match mint and authority PDA)
    pub fn claim_tokens<'info>(
        ctx: Context<'_, '_, '_, 'info, ClaimTokens<'info>>,
        index: u32,
    ) -> Result<()> {
        instructions::claim_tokens(ctx, index)
    }

    /// Settles a Core asset sale
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[signer]` Gumball Machine authority
    pub fn settle_core_asset_sale<'info>(
        ctx: Context<'_, '_, '_, 'info, SettleCoreAssetSale<'info>>,
        index: u32,
    ) -> Result<()> {
        instructions::settle_core_asset_sale(ctx, index)
    }

    /// Settles a legacy NFT sale
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[signer]` Gumball Machine authority
    pub fn settle_nft_sale<'info>(
        ctx: Context<'_, '_, '_, 'info, SettleNftSale<'info>>,
        index: u32,
    ) -> Result<()> {
        instructions::settle_nft_sale(ctx, index)
    }

    /// Settles a fungible tokens sale
    ///
    /// # Accounts
    ///
    ///   0. `[signer, writable]` Payer (anyone can settle the sale)
    ///   1. `[writable]` Gumball Machine account (must be in SaleEnded state)
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[writable]` Authority PDA payment account (optional)
    ///   4. `[writable]` Authority account
    ///   5. `[writable]` Authority payment account (optional)
    ///   6. `[writable]` Seller account
    ///   7. `[writable]` Seller payment account (optional)
    ///   8. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])
    ///   9. `[]` Buyer account
    ///   10. `[writable]` Fee account (optional)
    ///   11. `[writable]` Fee payment account (optional)
    ///   12. `[]` Payment mint (optional)
    ///   13. `[]` Token program
    ///   14. `[]` Associated Token program
    ///   15. `[]` System program
    ///   16. `[]` Rent sysvar
    ///   17. `[]` Mint account
    ///   18. `[writable]` Receiver token account (must match mint)
    ///   19. `[writable]` Authority PDA token account (must match mint and authority PDA)
    pub fn settle_tokens_sale<'info>(
        ctx: Context<'_, '_, '_, 'info, SettleTokensSale<'info>>,
        index: u32,
    ) -> Result<()> {
        instructions::settle_tokens_sale(ctx, index)
    }

    /// Set a new authority of the gumball machine.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[signer]` Gumball Machine authority
    pub fn set_authority(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
        instructions::set_authority(ctx, new_authority)
    }

    /// Set a new mint authority of the gumball machine.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[signer]` Gumball Machine authority
    ///   1. `[signer]` New gumball machine authority
    pub fn set_mint_authority(ctx: Context<SetMintAuthority>) -> Result<()> {
        instructions::set_mint_authority(ctx)
    }

    /// Withdraw the rent lamports and send them to the authority address.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[signer]` Gumball Machine authority
    pub fn withdraw(ctx: Context<CloseGumballMachine>) -> Result<()> {
        instructions::close_gumball_machine(ctx)
    }
}
