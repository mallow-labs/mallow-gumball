use anchor_lang::prelude::*;

use crate::{
    constants::{CONFIG_LINE_SIZE, CONFIG_LINE_V2_SIZE, GUMBALL_MACHINE_SIZE},
    GumballError,
};

/// Gumball machine state and config data.
#[account]
#[derive(Debug)]
pub struct GumballMachine {
    /// Version of the account.
    pub version: u8,
    /// Authority address.
    pub authority: Pubkey,
    /// Authority address allowed to mint from the gumball machine.
    pub mint_authority: Pubkey,
    /// Fee config for the marketplace this gumball is listed on
    pub marketplace_fee_config: Option<FeeConfig>,
    /// Number of assets redeemed.
    pub items_redeemed: u64,
    /// Number of assets settled after sale.
    pub items_settled: u64,
    /// Amount of lamports/tokens received from purchases.
    pub total_revenue: u64,
    /// True if the authority has finalized details, which prevents adding more nfts.
    pub state: GumballState,
    /// User-defined settings
    pub settings: GumballSettings,
    // The final eight reserved header bytes hold the live add-request count.
    // hidden data section to avoid deserialisation:
    //
    // - (u32) how many actual lines of data there are currently (eventually
    //   equals item_capacity)
    // - (CONFIG_LINE_SIZE * item_capacity)
    // - (item_capacity / 8) + 1 bit mask to keep track of which items have been claimed
    // - (item_capacity / 8) + 1 bit mask to keep track of which items have been settled
    // - (u32 * item_capacity) mint indices
    //
    // - version 3:
    // - (boolean) disable_royalties
    // - ([u8; 3]) unused bytes
    // - (boolean) disable_primary_split
    //
    // - version 4:
    // - (BuyBackConfig) buy_back_config
    // - (u64) buy_back_funds_available
    //
    // - version 5:
    // - (u64) total_proceeds_settled
    //
    // - version 6 (enabled before the first v2 escrow entry):
    // - (u64) pending_draw_payment
    // - (u64) refund_reserve
    // - ([u64; item_capacity]) actual draw payments
    // - (u64) refunded items
    // - (u64) outstanding compressed draws
    // - ([u64; item_capacity]) gross proceeds paid per item
    // - (u64) proceeds paid on not-yet-finalized items
}

impl GumballMachine {
    pub const CURRENT_VERSION: u8 = 5;

    /// Gets the size of the gumball machine given the number of items.
    pub fn get_size(item_count: u64, version: u8) -> usize {
        GUMBALL_MACHINE_SIZE
            + 4 // number of items inserted
            + ((if version >= 2 { CONFIG_LINE_V2_SIZE } else { CONFIG_LINE_SIZE }) * item_count as usize) // config lines
            + (item_count as usize / 8) + 1 // bit mask tracking claimed items
            + (item_count as usize / 8) + 1 // bit mask tracking settled items
            + 4 + (4 * item_count as usize) // mint indices
            + if version >= 3 { 1 } else { 0 } // disable_primary_split
            + if version >= 4 { BuyBackConfig::INIT_SPACE + 8 } else { 0 } // buy_back_config
            + if version >= 5 { 8 } else { 0 } // total_proceeds_settled
            + if version >= 6 { 40 + 16 * item_count as usize } else { 0 } // refund accounting
    }

    pub fn get_config_line_size(&self) -> usize {
        if self.version < 2 {
            CONFIG_LINE_SIZE
        } else {
            CONFIG_LINE_V2_SIZE
        }
    }

    pub fn get_claimed_items_bit_mask_position(&self) -> usize {
        GUMBALL_MACHINE_SIZE
            + 4
            + (self.settings.item_capacity as usize) * self.get_config_line_size()
    }

    pub fn get_settled_items_bit_mask_position(&self) -> Result<usize> {
        let mask_size = (self.settings.item_capacity)
            .checked_div(8)
            .ok_or(GumballError::NumericalOverflowError)? as usize;
        let position = self.get_claimed_items_bit_mask_position() + mask_size + 1;
        Ok(position)
    }

    pub fn get_mint_indices_position(&self) -> Result<usize> {
        let mask_size = (self.settings.item_capacity)
            .checked_div(8)
            .ok_or(GumballError::NumericalOverflowError)? as usize;
        let position = self.get_settled_items_bit_mask_position()? + mask_size + 1;
        Ok(position)
    }

    pub fn get_disable_royalties_position(&self) -> Result<usize> {
        let position =
            self.get_mint_indices_position()? + (4 * self.settings.item_capacity as usize);
        Ok(position)
    }

    pub fn get_disable_primary_split_position(&self) -> Result<usize> {
        // NOTE: +1 for disable royalties bool, + 3 unused bytes and can be used for future purposes
        let position = self.get_disable_royalties_position()? + 4;
        Ok(position)
    }

    pub fn get_buy_back_config_position(&self) -> Result<usize> {
        let position = self.get_disable_primary_split_position()? + 1;
        Ok(position)
    }

    pub fn get_buy_back_config(&self, data: &[u8]) -> Result<BuyBackConfig> {
        if self.version < 4 {
            return Ok(BuyBackConfig::default());
        }
        let position = self.get_buy_back_config_position()?;

        let buy_back_config =
            BuyBackConfig::try_from_slice(&data[position..position + BuyBackConfig::INIT_SPACE])?;
        Ok(buy_back_config)
    }

    pub fn get_buy_back_funds_available_position(&self) -> Result<usize> {
        let position = self.get_buy_back_config_position()? + BuyBackConfig::INIT_SPACE;
        Ok(position)
    }

    pub fn get_buy_back_funds_available(&self, data: &[u8]) -> Result<u64> {
        let position = self.get_buy_back_funds_available_position()?;
        Ok(u64::from_le_bytes(
            data[position..position + 8].try_into().unwrap(),
        ))
    }

    pub fn get_total_proceeds_settled_position(&self) -> Result<usize> {
        let position = self.get_buy_back_funds_available_position()? + 8;
        Ok(position)
    }

    pub fn get_total_proceeds_settled(&self, data: &[u8]) -> Result<u64> {
        if self.version < 5 {
            return Ok(0);
        }

        let position = self.get_total_proceeds_settled_position()?;
        Ok(u64::from_le_bytes(
            data[position..position + 8].try_into().unwrap(),
        ))
    }

    pub fn get_pending_draw_payment_position(&self) -> Result<usize> {
        Ok(self.get_total_proceeds_settled_position()? + 8)
    }

    pub fn get_refund_reserve_position(&self) -> Result<usize> {
        Ok(self.get_pending_draw_payment_position()? + 8)
    }

    pub fn get_draw_payment_position(&self, index: u32) -> Result<usize> {
        require!(
            u64::from(index) < self.settings.item_capacity,
            GumballError::IndexGreaterThanLength
        );
        Ok(self.get_refund_reserve_position()? + 8 + index as usize * 8)
    }

    pub fn get_items_refunded_position(&self) -> Result<usize> {
        Ok(self.get_refund_reserve_position()? + 8 + self.settings.item_capacity as usize * 8)
    }

    pub fn get_outstanding_draws_position(&self) -> Result<usize> {
        Ok(self.get_items_refunded_position()? + 8)
    }

    pub fn get_item_proceeds_position(&self, index: u32) -> Result<usize> {
        require!(
            u64::from(index) < self.settings.item_capacity,
            GumballError::IndexGreaterThanLength
        );
        Ok(self.get_outstanding_draws_position()? + 8 + index as usize * 8)
    }

    pub fn get_unfinalized_proceeds_position(&self) -> Result<usize> {
        Ok(self.get_outstanding_draws_position()? + 8 + self.settings.item_capacity as usize * 8)
    }

    pub fn get_unfinalized_proceeds(&self, data: &[u8]) -> Result<u64> {
        Self::read_amount(data, self.get_unfinalized_proceeds_position()?)
    }

    pub fn get_items_refunded(&self, data: &[u8]) -> Result<u64> {
        Self::read_amount(data, self.get_items_refunded_position()?)
    }

    pub fn get_outstanding_draws(&self, data: &[u8]) -> Result<u64> {
        Self::read_amount(data, self.get_outstanding_draws_position()?)
    }

    pub fn get_refund_reserve(&self, data: &[u8]) -> Result<u64> {
        if self.version < 6 {
            return Ok(0);
        }
        Self::read_amount(data, self.get_refund_reserve_position()?)
    }

    pub fn get_draw_payment(&self, data: &[u8], index: u32) -> Result<u64> {
        require!(self.version >= 6, GumballError::InvalidVersion);
        Self::read_amount(data, self.get_draw_payment_position(index)?)
    }

    pub fn read_amount(data: &[u8], position: usize) -> Result<u64> {
        let bytes = data
            .get(position..position + 8)
            .ok_or(GumballError::InvalidVersion)?;
        Ok(u64::from_le_bytes(bytes.try_into().unwrap()))
    }

    /// Upgrade only before any draw, so no historical payment or fee is guessed.
    pub fn enable_cnft_refunds<'info>(
        &mut self,
        account: &AccountInfo<'info>,
        payer: &AccountInfo<'info>,
        system_program: &AccountInfo<'info>,
    ) -> Result<()> {
        require!(self.version >= 5, GumballError::InvalidVersion);
        if self.version >= 6 {
            return Ok(());
        }
        require!(
            self.can_edit_items() && self.items_redeemed == 0 && self.total_revenue == 0,
            GumballError::InvalidVersion
        );
        let size = Self::get_size(self.settings.item_capacity, 6);
        if account.data_len() < size {
            require!(
                size - account.data_len() <= 10_240,
                GumballError::CnftLedgerGrowthTooLarge
            );
            require_keys_eq!(
                payer.key(),
                self.authority,
                GumballError::CnftLedgerRequiresAuthority
            );
            let rent = Rent::get()?
                .minimum_balance(size)
                .saturating_sub(account.lamports());
            if rent > 0 {
                anchor_lang::system_program::transfer(
                    CpiContext::new(
                        system_program.key(),
                        anchor_lang::system_program::Transfer {
                            from: payer.clone(),
                            to: account.clone(),
                        },
                    ),
                    rent,
                )?;
            }
            account.resize(size)?;
        }
        // Clients may preallocate this extension; never assume it is zeroed.
        account.try_borrow_mut_data()?[self.get_pending_draw_payment_position()?..size].fill(0);
        self.version = 6;
        Ok(())
    }

    /// Custody and finalized collaborator terms bind both the guard and its price.
    pub fn has_invited_custody(&self, data: &[u8]) -> Result<bool> {
        if !crate::add_requests_migrated(data) || crate::pending_add_requests(data)? > 0 {
            return Ok(true);
        }
        let count = crate::get_config_count(data)? as usize;
        for index in 0..count {
            let seller = GUMBALL_MACHINE_SIZE + 4 + index * self.get_config_line_size() + 32;
            let bytes = data
                .get(seller..seller + 32)
                .ok_or(GumballError::InvalidGumballMachine)?;
            if bytes != self.authority.as_ref() {
                return Ok(true);
            }
        }
        Ok(false)
    }

    pub fn assert_can_change_guard(&self, data: &[u8]) -> Result<()> {
        require!(
            !self.has_invited_custody(data)?
                && !(self.state != GumballState::None && self.is_collab()),
            GumballError::InvalidSettingUpdate
        );
        Ok(())
    }

    pub fn assert_can_set_mint_authority(&self, data: &[u8], authority: Pubkey) -> Result<()> {
        // Idempotent wrapping cannot change the path. Initial wrapping remains
        // available on machines initialized with a collaborator root.
        if authority == self.mint_authority
            || (self.mint_authority == self.authority
                && self.can_edit_items()
                && crate::add_requests_migrated(data)
                && crate::get_config_count(data)? == 0
                && crate::pending_add_requests(data)? == 0)
        {
            return Ok(());
        }
        self.assert_can_change_guard(data)
    }

    pub fn can_edit_items(&self) -> bool {
        self.state == GumballState::None || self.state == GumballState::DetailsFinalized
    }

    pub fn can_add_items(&self) -> bool {
        self.can_edit_items()
            || (self.state == GumballState::SaleLive && !self.is_collab() && self.version >= 5)
    }

    pub fn is_collab(&self) -> bool {
        self.settings.sellers_merkle_root.is_some()
    }

    pub fn can_settle_items(&self) -> bool {
        self.state == GumballState::SaleEnded
            || (self.state == GumballState::SaleLive && !self.is_collab() && self.version >= 5)
    }

    pub fn assert_can_settle_item(&self, buyer: Pubkey) -> Result<()> {
        require!(
            buyer != Pubkey::default() || self.state == GumballState::SaleEnded,
            GumballError::InvalidState
        );
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct FeeConfig {
    /// Where fees will go
    pub fee_account: Pubkey,
    /// Sale basis points for fees
    pub fee_bps: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, Default)]
pub struct BuyBackConfig {
    /// Whether buying back prizes is enabled
    pub enabled: bool,
    /// Whether buying back prizes should be added back to the gumball machine (not yet supported)
    pub to_gumball_machine: bool,
    /// Authority that must sign when buying back prizes, to ensure pricing is correct
    pub oracle_signer: Pubkey,
    /// Percentage of prize value the creator/gumball machine will pay for buying back prizes
    pub value_pct: u8,
    /// Fee in basis points paid to marketplace authority when buying back prizes (paid from funds_available)
    pub marketplace_fee_bps: u16,
    /// Buy backs are disabled when the percentage of items remaining is less than or equal to this value
    /// 0 means there is no cutoff, 100 means buy back is always disabled, 50 means buy back is disabled when 50% of items are sold
    /// If an item is sold back to the gumball machine to increase the remaining % above this cutoff, buy back is re-enabled
    pub cutoff_pct: u8,
}

/// Config line struct for storing asset (NFT) data pre-mint.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ConfigLineInput {
    /// Mint account of the asset.
    pub mint: Pubkey,
    /// Wallet that submitted the asset for sale.
    pub seller: Pubkey,
}

/// Config line struct for storing asset (NFT) data pre-mint.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ConfigLineV2Input {
    /// Mint account of the asset.
    pub mint: Pubkey,
    /// Wallet that submitted the asset for sale.
    pub seller: Pubkey,
    /// Amount of the asset.
    pub amount: u64,
}

/// Config line struct for storing asset data.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ConfigLine {
    /// Mint account of the asset.
    pub mint: Pubkey,
    /// Wallet that submitted the asset for sale.
    pub seller: Pubkey,
    /// Wallet that will receive the asset upon sale. Empty until drawn.
    pub buyer: Pubkey,
    /// Token standard.
    pub token_standard: TokenStandard,
}

/// Config line struct for storing asset data.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub struct ConfigLineV2 {
    /// Mint account of the asset.
    pub mint: Pubkey,
    /// Wallet that submitted the asset for sale.
    pub seller: Pubkey,
    /// Wallet that will receive the asset upon sale. Empty until drawn.
    pub buyer: Pubkey,
    /// Token standard.
    pub token_standard: TokenStandard,
    /// Amount of the asset.
    pub amount: u64,
}

#[derive(Copy, AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug, InitSpace)]
pub enum TokenStandard {
    NonFungible,
    Core,
    Fungible,
    ProgrammableNonFungible,
    // Append-only: compressed NFT (Bubblegum). New variants MUST be appended to
    // preserve the 1-byte discriminator of existing config lines. Discriminator = 4.
    Compressed,
}

#[derive(Copy, AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum GumballState {
    None,             // Initial state
    DetailsFinalized, // Sellers invited so only some details can be updated
    SaleLive, // Sale started, can now mint items. Cannot no longer update details or add items.
    SaleEnded, // Sale ended, can now settle items
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct GumballSettings {
    /// Uri of off-chain metadata, max length 196
    pub uri: String,
    /// Number of assets that can be added.
    pub item_capacity: u64,
    /// Max number of items that can be added by a single seller.
    pub items_per_seller: u16,
    /// Merkle root hash for sellers who can add items to the machine.
    pub sellers_merkle_root: Option<[u8; 32]>,
    /// Fee basis points paid to the machine authority.
    pub curator_fee_bps: u16,
    /// True if the front end should hide items that have been sold.
    pub hide_sold_items: bool,
    /// Payment token for the mint
    pub payment_mint: Pubkey,
}
