use anchor_lang::prelude::*;

pub const CNFT_RECOVERY_SEED: &[u8] = b"cnft_recovery";

/// Survives machine closure until an undeliverable escrowed leaf can be returned.
#[account]
#[derive(InitSpace)]
pub struct CnftRecovery {
    pub gumball_machine: Pubkey,
    pub authority: Pubkey,
    pub seller: Pubkey,
    pub asset: Pubkey,
    pub merkle_tree: Pubkey,
    pub nonce: u64,
    pub rent_payer: Pubkey,
}

/// Current proof evidence; identity and nonce are bound to the stored item.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CnftV2RefundLeaf {
    pub owner: Pubkey,
    pub delegate: Pubkey,
    pub data_hash: [u8; 32],
    pub creator_hash: [u8; 32],
    pub collection_hash: [u8; 32],
    pub asset_data_hash: [u8; 32],
    pub flags: u8,
}

impl CnftV2RefundLeaf {
    pub fn hash(&self, asset: Pubkey, nonce: u64) -> [u8; 32] {
        mpl_bubblegum::types::LeafSchema::V2 {
            id: asset,
            owner: self.owner,
            delegate: self.delegate,
            nonce,
            data_hash: self.data_hash,
            creator_hash: self.creator_hash,
            collection_hash: self.collection_hash,
            asset_data_hash: self.asset_data_hash,
            flags: self.flags,
        }
        .hash()
    }
}
