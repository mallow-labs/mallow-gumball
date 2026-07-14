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
    ///   1. `[]` Gumball Machine authority
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[signer, writable]` Payer
    ///   4. `[]` System program
    pub fn initialize(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {
        instructions::initialize(ctx, args)
    }

    /// Updates gumball machine settings.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[signer, writable]` Gumball Machine authority
    pub fn update_settings(ctx: Context<UpdateSettings>, args: UpdateArgs) -> Result<()> {
        instructions::update_settings(ctx, args)
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
    ///   6. `[writable]` Metadata account
    ///   7. `[]` Edition account
    ///   8. `[]` Token program
    ///   9. `[]` Token Metadata program
    ///   10. `[]` System program
    ///   11. `[writable, optional]` Seller token record (pNFT)
    ///   12. `[optional]` Auth rules account (pNFT)
    ///   13. `[optional]` Instructions sysvar (pNFT)
    ///   14. `[optional]` Auth rules program (pNFT)
    pub fn add_nft(ctx: Context<AddNft>, args: AddItemArgs) -> Result<()> {
        instructions::add_nft(ctx, args)
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
    pub fn add_core_asset(ctx: Context<AddCoreAsset>, args: AddItemArgs) -> Result<()> {
        instructions::add_core_asset(ctx, args)
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
        args: AddItemArgs,
    ) -> Result<()> {
        instructions::add_tokens(ctx, amount, quantity, args)
    }

    /// Request to add a NFT to the gumball machine.
    /// Freezes the seller's NFT and creates a request account.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account.
    ///   1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]).
    ///   2. `[writable]` Add item request account (PDA, seeds: ["add_item_request", mint]).
    ///   3. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine]).
    ///   4. `[signer, writable]` Seller of the nft.
    ///   5. `[]` Mint account of the NFT.
    ///   6. `[writable]` Seller's token account for the NFT.
    ///   7. `[writable]` Metadata account of the NFT.
    ///   8. `[]` Edition account of the NFT.
    ///   9. `[]` Token program.
    ///   10. `[]` Token Metadata program.
    ///   11. `[]` System program.
    ///   12. `[writable, optional]` Seller token record (pNFT).
    ///   13. `[optional]` Auth rules account (pNFT).
    ///   14. `[optional]` Instructions sysvar (pNFT).
    ///   15. `[optional]` Auth rules program (pNFT).
    pub fn request_add_nft(ctx: Context<RequestAddNft>) -> Result<()> {
        instructions::request_add_nft(ctx)
    }

    /// Request to add a core asset to the gumball machine.
    /// Freezes the seller's asset and creates a request account.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account.
    ///   1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]).
    ///   2. `[writable]` Add item request account (PDA, seeds: ["add_item_request", asset]).
    ///   3. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine]).
    ///   4. `[signer, writable]` Seller of the asset.
    ///   5. `[writable]` Asset account.
    ///   6. `[writable, optional]` Collection account if asset is part of one.
    ///   7. `[]` MPL Core program.
    ///   8. `[]` System program.
    pub fn request_add_core_asset(ctx: Context<RequestAddCoreAsset>) -> Result<()> {
        instructions::request_add_core_asset(ctx)
    }

    /// Cancel a request to add a NFT to the gumball machine.
    /// Thaws and revokes delegate from the seller's NFT and closes the request account.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Seller history account (PDA, seeds: ["seller_history", add_item_request.gumball_machine, seller]).
    ///   1. `[writable]` Add item request account (PDA, seeds: ["add_item_request", mint]). Will be closed.
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", add_item_request.gumball_machine]).
    ///   3. `[signer, writable]` Seller of the NFT.
    ///   4. `[]` Mint account of the NFT.
    ///   5. `[writable]` Seller's token account for the NFT.
    ///   6. `[writable]` Authority PDA's token account.
    ///   7. `[]` Edition account of the NFT.
    ///   8. `[]` Token program.
    ///   9. `[]` Associated Token program.
    ///   10. `[]` Token Metadata program.
    ///   11. `[]` System program.
    ///   12. `[]` Rent sysvar.
    ///   13. `[writable, optional]` Metadata account (pNFT).
    ///   14. `[writable, optional]` Seller token record (pNFT).
    ///   15. `[optional]` Auth rules account (pNFT).
    ///   16. `[optional]` Instructions sysvar (pNFT).
    ///   17. `[optional]` Auth rules program (pNFT).
    pub fn cancel_add_nft_request(ctx: Context<CancelAddNftRequest>) -> Result<()> {
        instructions::cancel_add_nft_request(ctx)
    }

    /// Cancel a request to add a core asset to the gumball machine.
    /// Thaws and revokes delegate from the seller's asset and closes the request account.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Seller history account (PDA, seeds: ["seller_history", add_item_request.gumball_machine, seller]).
    ///   1. `[writable]` Add item request account (PDA, seeds: ["add_item_request", asset]). Will be closed.
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", add_item_request.gumball_machine]).
    ///   3. `[signer, writable]` Seller of the asset.
    ///   4. `[writable]` Asset account.
    ///   5. `[writable, optional]` Collection account if asset is part of one.
    ///   6. `[]` MPL Core program.
    ///   7. `[]` System program.
    pub fn cancel_add_core_asset_request(ctx: Context<CancelAddCoreAssetRequest>) -> Result<()> {
        instructions::cancel_add_core_asset_request(ctx)
    }

    /// Approve adding an item to the gumball machine.
    /// Moves the item from the request to the gumball machine's config lines.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account.
    ///   1. `[writable]` Add item request account (PDA, seeds: ["add_item_request", asset]). Will be closed.
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine]).
    ///   3. `[signer, writable]` Authority of the gumball machine.
    ///   4. `[writable]` Seller account (receiver of closed request account rent).
    ///   5. `[]` Asset/Mint account (checked via add_item_request constraint).
    ///   6. `[]` System program.
    pub fn approve_add_item(ctx: Context<ApproveAddItem>) -> Result<()> {
        instructions::approve_add_item(ctx)
    }

    /// Remove legacy NFT from the gumball machine.
    /// Thaws and revokes delegate from the seller's NFT and removes it from the config lines.
    /// The signer can be the Gumball Machine authority or the seller of the specific item.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account.
    ///   1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]).
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine]).
    ///   3. `[signer]` Authority allowed to remove (gumball machine authority or item seller).
    ///   4. `[writable]` Seller account (owner of the NFT).
    ///   5. `[]` Mint account of the NFT.
    ///   6. `[writable]` Seller's token account for the NFT.
    ///   7. `[writable]` Authority PDA's token account.
    ///   8. `[]` Edition account of the NFT.
    ///   9. `[]` Token program.
    ///   10. `[]` Associated Token program.
    ///   11. `[]` Token Metadata program.
    ///   12. `[]` System program.
    ///   13. `[]` Rent sysvar.
    ///   14. `[writable, optional]` Metadata account (pNFT).
    ///   15. `[writable, optional]` Seller token record (pNFT).
    ///   16. `[optional]` Auth rules account (pNFT).
    ///   17. `[optional]` Instructions sysvar (pNFT).
    ///   18. `[optional]` Auth rules program (pNFT).
    pub fn remove_nft(ctx: Context<RemoveNft>, index: u32) -> Result<()> {
        instructions::remove_nft(ctx, index)
    }

    /// Remove Core asset from the gumball machine.
    /// Thaws and revokes delegate from the seller's asset and removes it from the config lines.
    /// The signer can be the Gumball Machine authority or the seller of the specific item.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account.
    ///   1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]).
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine]).
    ///   3. `[signer]` Authority allowed to remove (gumball machine authority or item seller).
    ///   4. `[writable]` Seller account (owner of the asset).
    ///   5. `[writable]` Asset account.
    ///   6. `[writable, optional]` Collection account if asset is part of one.
    ///   7. `[]` MPL Core program.
    ///   8. `[]` System program.
    pub fn remove_core_asset(ctx: Context<RemoveCoreAsset>, index: u32) -> Result<()> {
        instructions::remove_core_asset(ctx, index)
    }

    /// Remove fungible tokens from the gumball machine.
    /// The signer can be the Gumball Machine authority or the seller of the specific item.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[signer, writable]` Authority allowed to remove (gumball machine authority or item seller).
    ///   4. `[writable]` Seller account (owner of the tokens).
    ///   5. `[]` Mint account
    ///   6. `[writable]` Seller's token account
    ///   7. `[writable]` Gumball machine's token account
    ///   8. `[]` Token program
    ///   9. `[]` Associated Token program
    ///   10. `[]` System program
    ///   11. `[]` Rent sysvar
    /// DEPRECATED: Use remove_tokens_span instead
    pub fn remove_tokens(ctx: Context<RemoveTokens>, indices: Vec<u8>, amount: u64) -> Result<()> {
        instructions::remove_tokens(ctx, indices, amount)
    }

    /// Remove fungible tokens from the gumball machine.
    /// The signer can be the Gumball Machine authority or the seller of the specific item.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[signer, writable]` Authority allowed to remove (gumball machine authority or item seller).
    ///   4. `[writable]` Seller account (owner of the tokens).
    ///   5. `[]` Mint account
    ///   6. `[writable]` Seller's token account
    ///   7. `[writable]` Gumball machine's token account
    ///   8. `[]` Token program
    ///   9. `[]` Associated Token program
    ///   10. `[]` System program
    ///   11. `[]` Rent sysvar
    pub fn remove_tokens_span(
        ctx: Context<RemoveTokens>,
        amount: u64,
        start_index: u32,
        end_index: u32,
    ) -> Result<()> {
        instructions::remove_tokens_span(ctx, amount, start_index, end_index)
    }

    /// Allows minting to begin.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[signer]` Gumball Machine authority (authority or mint_authority)
    pub fn start_sale(ctx: Context<StartSale>) -> Result<()> {
        instructions::start_sale(ctx)
    }

    /// Disables minting and allows sales to be settled.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[signer, writable]` Gumball Machine authority
    pub fn end_sale(ctx: Context<EndSale>) -> Result<()> {
        instructions::end_sale(ctx)
    }

    /// Draw for a random item from the gumball machine.
    /// Only the gumball machine mint authority is allowed to draw.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[signer]` Gumball Machine mint authority
    ///   2. `[signer, writable]` Payer
    ///   3. `[]` Buyer account
    ///   4. `[]` System program
    ///   5. `[]` SlotHashes sysvar cluster data
    pub fn draw<'info>(ctx: Context<'info, Draw<'info>>) -> Result<()> {
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
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[signer]` Gumball Machine mint authority
    pub fn increment_total_revenue<'info>(
        ctx: Context<'info, IncrementTotalRevenue<'info>>,
        revenue: u64,
    ) -> Result<()> {
        instructions::increment_total_revenue(ctx, revenue)
    }

    /// Sell an item back to the gumball machine using buy back funds.
    /// The payer must be the seller or the oracle_signer.
    /// Buying back to the gumball machine is currently not supported, but will be in the future.
    /// If buying back to the authority, the item is marked as claimed and transferred to the buyer (authority).
    ///
    /// # Accounts
    ///
    ///   0. `[signer, writable]` Payer (must be seller or oracle_signer)
    ///   1. `[signer]` Oracle signer (must match buy_back_config)
    ///   2. `[writable]` Gumball Machine account
    ///   3. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   4. `[writable]` Mint account of the item (or Asset account for Core)
    ///   5. `[writable]` Seller account
    ///   6. `[writable]` Buyer account (must be gumball machine or authority)
    ///   7. `[]` System program
    ///   8. `[]` Token program
    ///   9. `[]` Associated Token program
    ///   10. `[]` Rent sysvar
    ///   11. `[writable, optional]` Fee account (if fee configured)
    ///   12. `[writable, optional]` Fee payment account (if fee configured)
    ///   13. `[writable, optional]` Payment mint (if not native SOL)
    ///   14. `[writable, optional]` Seller payment account (if not native SOL)
    ///   15. `[writable, optional]` Authority PDA payment account (if not native SOL)
    ///   16. `[writable, optional]` Collection account (for Core asset)
    ///   17. `[optional]` MPL Core program (for Core asset)
    ///   18. `[writable, optional]` Authority PDA token account (for NFT/Fungible)
    ///   19. `[writable, optional]` Seller token account (for NFT/Fungible)
    ///   20. `[writable, optional]` Buyer token account (for NFT/Fungible)
    ///   21. `[writable, optional]` Metadata account (for NFT/PNFT)
    ///   22. `[writable, optional]` Edition account (for NFT/PNFT)
    ///   23. `[optional]` Token Metadata program (for NFT/PNFT)
    ///   24. `[writable, optional]` Authority PDA token record (for pNFT)
    ///   25. `[writable, optional]` Buyer token record (for pNFT)
    ///   26. `[optional]` Auth rules account (for pNFT)
    ///   27. `[optional]` Instructions sysvar (for pNFT)
    ///   28. `[optional]` Auth rules program (for pNFT)
    pub fn sell_item<'info>(
        ctx: Context<'info, SellItem<'info>>,
        index: u32,
        amount: u64,
        buy_price: u64,
    ) -> Result<()> {
        instructions::sell_item(ctx, index, amount, buy_price)
    }

    /// Claims a Core asset from the gumball machine for a specific buyer.
    /// Transfers the asset from the PDA to the buyer.
    ///
    /// # Accounts
    ///
    ///   0. `[signer, writable]` Payer (anyone can claim the item)
    ///   1. `[writable]` Gumball Machine account (must be in SaleLive or SaleEnded state)
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[writable]` Seller account
    ///   4. `[]` Buyer account
    ///   5. `[]` System program
    ///   6. `[writable]` Asset account
    ///   7. `[writable, optional]` Collection account if asset is part of one.
    ///   8. `[]` MPL Core program.
    pub fn claim_core_asset<'info>(
        ctx: Context<'info, ClaimCoreAsset<'info>>,
        index: u32,
    ) -> Result<()> {
        instructions::claim_core_asset(ctx, index)
    }

    /// Claims a legacy NFT from the gumball machine for a specific buyer.
    /// Thaws and transfers the NFT from the PDA to the buyer.
    ///
    /// # Accounts
    ///
    ///   0. `[signer, writable]` Payer (anyone can claim the item)
    ///   1. `[writable]` Gumball Machine account (must be in SaleLive or SaleEnded state)
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[writable]` Seller account
    ///   4. `[]` Buyer account
    ///   5. `[]` Token program
    ///   6. `[]` Associated Token program
    ///   7. `[]` System program
    ///   8. `[]` Rent sysvar
    ///   9. `[]` Mint account
    ///   10. `[writable]` Buyer's token account
    ///   11. `[writable]` Authority PDA's token account
    ///   12. `[writable]` Metadata account
    ///   13. `[writable]` Edition account
    ///   14. `[]` Token Metadata program
    ///   15. `[writable, optional]` Seller token record (pNFT)
    ///   16. `[writable, optional]` Authority PDA token record (pNFT)
    ///   17. `[writable, optional]` Buyer token record (pNFT)
    ///   18. `[optional]` Auth rules account (pNFT)
    ///   19. `[optional]` Instructions sysvar (pNFT)
    ///   20. `[optional]` Auth rules program (pNFT)
    pub fn claim_nft<'info>(
        ctx: Context<'info, ClaimNft<'info>>,
        index: u32,
    ) -> Result<()> {
        instructions::claim_nft(ctx, index)
    }

    /// Claims fungible tokens from the gumball machine for a specific buyer.
    ///
    /// # Accounts
    ///
    ///   0. `[signer, writable]` Payer (anyone can claim the tokens)
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
        ctx: Context<'info, ClaimTokens<'info>>,
        index: u32,
    ) -> Result<()> {
        instructions::claim_tokens(ctx, index)
    }

    /// Settles a Core asset sale
    /// If the item hasn't been claimed yet, it claims it for the seller (or buyer if specified).
    /// Distributes proceeds according to royalties and fee configuration.
    ///
    /// # Accounts
    ///
    ///   0. `[signer, writable]` Payer (anyone can settle the sale)
    ///   1. `[writable]` Gumball Machine account (must be in SaleEnded state)
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[writable, optional]` Authority PDA payment account
    ///   4. `[writable]` Authority account
    ///   5. `[writable, optional]` Authority payment account
    ///   6. `[writable]` Seller account
    ///   7. `[writable, optional]` Seller payment account
    ///   8. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])
    ///   9. `[]` Buyer account
    ///   10. `[writable, optional]` Fee account
    ///   11. `[writable, optional]` Fee payment account
    ///   12. `[optional]` Payment mint
    ///   13. `[]` Token program
    ///   14. `[]` Associated Token program
    ///   15. `[]` System program
    ///   16. `[]` Rent sysvar
    ///   17. `[writable]` Asset account
    ///   18. `[writable, optional]` Collection account if asset is part of one.
    ///   19. `[]` MPL Core program.
    ///   Remaining accounts: Royalty recipients
    pub fn settle_core_asset_sale<'info>(
        ctx: Context<'info, SettleCoreAssetSale<'info>>,
        index: u32,
    ) -> Result<()> {
        instructions::settle_core_asset_sale(ctx, index)
    }

    /// Settles a legacy NFT sale
    /// If the item hasn't been claimed yet, it claims it for the seller (or buyer if specified).
    /// Distributes proceeds according to royalties and fee configuration. Marks primary sale happened if applicable.
    ///
    /// # Accounts
    ///
    ///   0. `[signer, writable]` Payer (anyone can settle the sale)
    ///   1. `[writable]` Gumball Machine account (must be in SaleEnded state)
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[writable, optional]` Authority PDA payment account
    ///   4. `[writable]` Authority account
    ///   5. `[writable, optional]` Authority payment account
    ///   6. `[writable]` Seller account
    ///   7. `[writable, optional]` Seller payment account
    ///   8. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])
    ///   9. `[]` Buyer account
    ///   10. `[writable, optional]` Fee account
    ///   11. `[writable, optional]` Fee payment account
    ///   12. `[optional]` Payment mint
    ///   13. `[]` Token program
    ///   14. `[]` Associated Token program
    ///   15. `[]` System program
    ///   16. `[]` Rent sysvar
    ///   17. `[]` Mint account
    ///   18. `[writable]` Buyer's token account
    ///   19. `[writable]` Authority PDA's token account
    ///   20. `[writable]` Metadata account
    ///   21. `[writable]` Edition account
    ///   22. `[]` Token Metadata program
    ///   23. `[writable, optional]` Seller token record (pNFT)
    ///   24. `[writable, optional]` Authority PDA token record (pNFT)
    ///   25. `[writable, optional]` Buyer token record (pNFT)
    ///   26. `[optional]` Auth rules account (pNFT)
    ///   27. `[optional]` Instructions sysvar (pNFT)
    ///   28. `[optional]` Auth rules program (pNFT)
    ///   Remaining accounts: Royalty recipients
    pub fn settle_nft_sale<'info>(
        ctx: Context<'info, SettleNftSale<'info>>,
        index: u32,
    ) -> Result<()> {
        instructions::settle_nft_sale(ctx, index)
    }

    /// Settles a fungible tokens sale
    /// If the item hasn't been claimed yet, it claims it for the seller (or buyer if specified).
    /// Distributes proceeds according to fee configuration.
    ///
    /// # Accounts
    ///
    ///   0. `[signer, writable]` Payer (anyone can settle the sale)
    ///   1. `[writable]` Gumball Machine account (must be in SaleEnded state)
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[writable, optional]` Authority PDA payment account
    ///   4. `[writable]` Authority account
    ///   5. `[writable, optional]` Authority payment account
    ///   6. `[writable]` Seller account
    ///   7. `[writable, optional]` Seller payment account
    ///   8. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])
    ///   9. `[]` Buyer account
    ///   10. `[writable, optional]` Fee account
    ///   11. `[writable, optional]` Fee payment account
    ///   12. `[optional]` Payment mint
    ///   13. `[]` Token program
    ///   14. `[]` Associated Token program
    ///   15. `[]` System program
    ///   16. `[]` Rent sysvar
    ///   17. `[]` Mint account
    ///   18. `[writable]` Receiver's token account (buyer or seller if buyer is default)
    ///   19. `[writable]` Authority PDA's token account
    ///   Remaining accounts: Fee recipients
    pub fn settle_tokens_sale<'info>(
        ctx: Context<'info, SettleTokensSale<'info>>,
        index: u32,
    ) -> Result<()> {
        instructions::settle_tokens_sale(ctx, index)
    }

    /// Settles a fungible tokens sale that has already been claimed by the buyer or does not have a buyer.
    /// This can settle multiple items in a single transaction via the `start_index` and `end_index` args.
    /// Distributes proceeds according to fee configuration and sends unsold tokens back to the seller.
    ///
    /// # Accounts
    ///
    ///   0. `[signer, writable]` Payer (anyone can settle the sale)
    ///   1. `[writable]` Gumball Machine account (must be in SaleEnded state)
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[writable, optional]` Authority PDA payment account
    ///   4. `[writable]` Authority account
    ///   5. `[writable, optional]` Authority payment account
    ///   6. `[writable]` Seller account
    ///   7. `[writable, optional]` Seller payment account
    ///   8. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])
    ///   9. `[optional]` Payment mint
    ///   10. `[]` Token program
    ///   11. `[]` Associated Token program
    ///   12. `[]` System program
    ///   13. `[]` Rent sysvar
    ///   14. `[]` Mint account
    ///   15. `[writable]` Seller's token account (for receiving unsold tokens)
    ///   16. `[writable]` Authority PDA's token account
    ///   Remaining accounts: Fee recipients
    pub fn settle_tokens_sale_claimed<'info>(
        ctx: Context<'info, SettleTokensSaleClaimed<'info>>,
        args: SettleTokensSaleClaimedArgs,
    ) -> Result<()> {
        instructions::settle_tokens_sale_claimed(ctx, args)
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
    ///   2. `[signer]` New gumball machine authority
    pub fn set_mint_authority(ctx: Context<SetMintAuthority>) -> Result<()> {
        instructions::set_mint_authority(ctx)
    }

    /// Withdraw the rent lamports and send them to the authority address.
    /// If a non-native payment mint was used, also closes the PDA payment token account,
    /// sending its balance to the authority's associated token account.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account (will be closed)
    ///   1. `[signer, writable]` Gumball Machine authority
    ///   2. `[signer, writable]` Gumball Machine mint authority
    ///   3. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   4. `[writable, optional]` Authority PDA payment account
    ///   5. `[]` Token program
    ///   Remaining accounts (if closing non-native payment account):
    ///     - `[]` Payment Mint
    ///     - `[writable]` Authority's token account for payment mint
    ///     - `[]` Associated Token program
    ///     - `[]` System program
    ///     - `[]` Rent sysvar
    pub fn withdraw<'info>(
        ctx: Context<'info, CloseGumballMachine<'info>>,
    ) -> Result<()> {
        instructions::close_gumball_machine(ctx)
    }

    /// Manage the buy back funds of the gumball machine.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[signer, writable]` Gumball Machine authority
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[writable, optional]` Authority's payment account
    ///   4. `[writable, optional]` Authority PDA's payment account
    ///   5. `[optional]` Payment mint
    ///   6. `[]` Token program
    ///   7. `[]` Associated Token program
    ///   8. `[]` System program
    ///   9. `[]` Rent sysvar
    pub fn manage_buy_back_funds<'info>(
        ctx: Context<'info, ManageBuyBackFunds<'info>>,
        amount: u64,
        is_withdraw: bool,
    ) -> Result<()> {
        instructions::manage_buy_back_funds(ctx, amount, is_withdraw)
    }

    /// Add a compressed NFT (Bubblegum V1) to the gumball machine.
    /// Escrows the leaf `seller -> authority PDA` (cNFTs cannot be frozen in
    /// place) and stores the asset id in the config line's mint field.
    /// Only V1 leaves are accepted; V2 leaves are rejected.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[signer, writable]` Seller (leaf owner)
    ///   4. `[]` Bubblegum tree config PDA
    ///   5. `[writable]` Merkle tree
    ///   6. `[]` SPL No-op (log wrapper) program
    ///   7. `[]` SPL Account Compression program
    ///   8. `[]` Bubblegum program
    ///   9. `[]` System program
    ///   Remaining accounts: merkle proof nodes
    pub fn add_cnft<'info>(
        ctx: Context<'info, AddCnft<'info>>,
        args: CnftArgs,
        add_item_args: AddItemArgs,
    ) -> Result<()> {
        instructions::add_cnft(ctx, args, add_item_args)
    }

    /// Request to add a compressed NFT to the gumball machine (collab flow).
    /// Escrows the leaf and creates a request account keyed by the asset id.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])
    ///   2. `[writable]` Add item request account (PDA, seeds: ["add_item_request", asset_id])
    ///   3. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   4. `[signer, writable]` Seller (leaf owner)
    ///   5. `[]` Asset id (Bubblegum PDA; not a real account)
    ///   6. `[]` Bubblegum tree config PDA
    ///   7. `[writable]` Merkle tree
    ///   8. `[]` SPL No-op (log wrapper) program
    ///   9. `[]` SPL Account Compression program
    ///   10. `[]` Bubblegum program
    ///   11. `[]` System program
    ///   Remaining accounts: merkle proof nodes
    pub fn request_add_cnft<'info>(
        ctx: Context<'info, RequestAddCnft<'info>>,
        args: CnftArgs,
    ) -> Result<()> {
        instructions::request_add_cnft(ctx, args)
    }

    /// Cancel a request to add a compressed NFT.
    /// Transfers the escrowed leaf back to the seller and closes the request.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Seller history account (PDA, seeds: ["seller_history", add_item_request.gumball_machine, seller])
    ///   1. `[writable]` Add item request account (PDA, seeds: ["add_item_request", asset_id]). Will be closed.
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", add_item_request.gumball_machine])
    ///   3. `[signer, writable]` Seller
    ///   4. `[]` Asset id (Bubblegum PDA; not a real account)
    ///   5. `[]` Bubblegum tree config PDA
    ///   6. `[writable]` Merkle tree
    ///   7. `[]` SPL No-op (log wrapper) program
    ///   8. `[]` SPL Account Compression program
    ///   9. `[]` Bubblegum program
    ///   10. `[]` System program
    ///   Remaining accounts: merkle proof nodes
    pub fn cancel_add_cnft_request<'info>(
        ctx: Context<'info, CancelAddCnftRequest<'info>>,
        args: CnftArgs,
    ) -> Result<()> {
        instructions::cancel_add_cnft_request(ctx, args)
    }

    /// Remove a compressed NFT from the gumball machine.
    /// Transfers the escrowed leaf back to the seller. The signer can be the
    /// gumball machine authority or the item's seller.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Gumball Machine account
    ///   1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[signer]` Authority allowed to remove (gumball machine authority or item seller)
    ///   4. `[writable]` Seller (receiver of the leaf)
    ///   5. `[]` Bubblegum tree config PDA
    ///   6. `[writable]` Merkle tree
    ///   7. `[]` SPL No-op (log wrapper) program
    ///   8. `[]` SPL Account Compression program
    ///   9. `[]` Bubblegum program
    ///   10. `[]` System program
    ///   Remaining accounts: merkle proof nodes
    pub fn remove_cnft<'info>(
        ctx: Context<'info, RemoveCnft<'info>>,
        index: u32,
        args: CnftArgs,
    ) -> Result<()> {
        instructions::remove_cnft(ctx, index, args)
    }

    /// Claims a compressed NFT from the gumball machine for the recorded buyer.
    /// Transfers the leaf from the authority PDA to the buyer.
    ///
    /// # Accounts
    ///
    ///   0. `[signer, writable]` Payer (anyone can claim)
    ///   1. `[writable]` Gumball Machine account (must be in SaleLive or SaleEnded state)
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[]` Seller
    ///   4. `[writable]` Buyer (receiver of the leaf)
    ///   5. `[]` Bubblegum tree config PDA
    ///   6. `[writable]` Merkle tree
    ///   7. `[]` SPL No-op (log wrapper) program
    ///   8. `[]` SPL Account Compression program
    ///   9. `[]` Bubblegum program
    ///   10. `[]` System program
    ///   Remaining accounts: merkle proof nodes
    pub fn claim_cnft<'info>(
        ctx: Context<'info, ClaimCnft<'info>>,
        index: u32,
        args: CnftArgs,
    ) -> Result<()> {
        instructions::claim_cnft(ctx, index, args)
    }

    /// Settles a compressed NFT sale.
    /// If unclaimed, transfers the leaf out of escrow (verifying creator/data
    /// hash), then distributes proceeds. Royalties are paid from the proof-bound
    /// creators arg. If already claimed, the creators/sfbp args are instead bound
    /// to the asset via a `VerifyLeaf` CPI on the current leaf
    /// (`current_leaf_owner`/`current_leaf_delegate` from DAS, current root/proof).
    ///
    /// # Accounts
    ///
    ///   0. `[signer, writable]` Payer (anyone can settle)
    ///   1. `[writable]` Gumball Machine account (must be settleable)
    ///   2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])
    ///   3. `[writable, optional]` Authority PDA payment account
    ///   4. `[writable]` Authority account
    ///   5. `[writable, optional]` Authority payment account
    ///   6. `[writable]` Seller account
    ///   7. `[writable, optional]` Seller payment account
    ///   8. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])
    ///   9. `[writable]` Buyer account
    ///   10. `[writable, optional]` Fee account
    ///   11. `[writable, optional]` Fee payment account
    ///   12. `[optional]` Payment mint
    ///   13. `[]` Token program
    ///   14. `[]` Associated Token program
    ///   15. `[]` System program
    ///   16. `[]` Rent sysvar
    ///   17. `[]` Bubblegum tree config PDA
    ///   18. `[writable]` Merkle tree
    ///   19. `[]` SPL No-op (log wrapper) program
    ///   20. `[]` SPL Account Compression program
    ///   21. `[]` Bubblegum program
    ///   Remaining accounts: creator payout accounts, then merkle proof nodes
    pub fn settle_cnft_sale<'info>(
        ctx: Context<'info, SettleCnftSale<'info>>,
        index: u32,
        args: CnftArgs,
        current_leaf_owner: Pubkey,
        current_leaf_delegate: Pubkey,
    ) -> Result<()> {
        instructions::settle_cnft_sale(ctx, index, args, current_leaf_owner, current_leaf_delegate)
    }
}
