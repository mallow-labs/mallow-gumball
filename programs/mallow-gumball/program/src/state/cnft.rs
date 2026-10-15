use anchor_lang::prelude::*;

/// Creator entry for a compressed NFT leaf.
///
/// Mirrors the field layout of `mpl_bubblegum::types::Creator` /
/// `mpl_token_metadata::types::Creator`, but is defined locally so it can be used
/// directly as an Anchor instruction argument (the mpl types only derive borsh,
/// not `AnchorSerialize`/`AnchorDeserialize`). The `(address, verified, share)`
/// tuple is folded into `creator_hash` exactly as Bubblegum does on-chain, so
/// these values are proof-bound by the Transfer CPI.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CnftCreator {
    /// Creator wallet.
    pub address: Pubkey,
    /// Whether the creator is verified on the leaf.
    pub verified: bool,
    /// Royalty share (0-100). Sum across creators must be 100.
    pub share: u8,
}

/// Leaf parameters shared by all compressed-NFT instructions.
///
/// Everything here is verified against the on-chain merkle root by the Bubblegum
/// V1 `Transfer` CPI: a lie about `seller_fee_basis_points` changes `data_hash`
/// and a lie about `creators` changes `creator_hash`, either of which makes the
/// proof fail. This is what makes royalties trustless without server trust.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CnftArgs {
    /// Current merkle root (fetched fresh from DAS at build time).
    pub root: [u8; 32],
    /// Inner `keccak(borsh(MetadataArgs))` supplied from DAS. `data_hash` is
    /// recomputed on-chain as `keccak(meta_hash ‖ sfbp_le)`.
    pub meta_hash: [u8; 32],
    /// Seller fee basis points, folded into `data_hash`.
    pub seller_fee_basis_points: u16,
    /// Creators, folded into `creator_hash` and used for royalty payouts.
    pub creators: Vec<CnftCreator>,
    /// Leaf nonce. Binds the asset id: `asset_id = PDA(["asset", tree, nonce_le])`.
    pub nonce: u64,
    /// Leaf index within the merkle tree.
    pub index: u32,
    /// Bubblegum leaf version. Must be V1 (`1`) for the original instructions.
    pub version: u8,
}

/// Proof-authenticated Bubblegum v2 metadata and leaf fields.
/// Proof creators are independent from collection royalty payout creators.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CnftArgsV2 {
    pub root: [u8; 32],
    /// Inner keccak of Borsh MetadataArgsV2; never use the v1 metadata layout.
    pub meta_hash: [u8; 32],
    /// Raw leaf rate, including 65535 for collection inheritance.
    pub seller_fee_basis_points: u16,
    pub creators: Vec<CnftCreator>,
    pub nonce: u64,
    pub index: u32,
    pub version: u8,
    /// None represents Bubblegum's default empty asset-data hash.
    pub asset_data_hash: Option<[u8; 32]>,
    pub flags: u8,
}
