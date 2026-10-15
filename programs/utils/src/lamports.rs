use anchor_lang::prelude::*;

/// Agave active and pending reserved keys, plus the incinerator. Keep the SDK
/// parity gate and target-runtime source check current before activation.
pub const RESERVED_LAMPORT_RECIPIENT_KEYS: &[Pubkey] = &[
    solana_program::pubkey!("AddressLookupTab1e1111111111111111111111111"),
    solana_program::pubkey!("BPFLoader2111111111111111111111111111111111"),
    solana_program::pubkey!("BPFLoader1111111111111111111111111111111111"),
    solana_program::pubkey!("BPFLoaderUpgradeab1e11111111111111111111111"),
    solana_program::pubkey!("ComputeBudget111111111111111111111111111111"),
    solana_program::pubkey!("Config1111111111111111111111111111111111111"),
    solana_program::pubkey!("Ed25519SigVerify111111111111111111111111111"),
    solana_program::pubkey!("Feature111111111111111111111111111111111111"),
    solana_program::pubkey!("1nc1nerator11111111111111111111111111111111"),
    solana_program::pubkey!("LoaderV411111111111111111111111111111111111"),
    solana_program::pubkey!("NativeLoader1111111111111111111111111111111"),
    solana_program::pubkey!("KeccakSecp256k11111111111111111111111111111"),
    solana_program::pubkey!("Secp256r1SigVerify1111111111111111111111111"),
    solana_program::pubkey!("StakeConfig11111111111111111111111111111111"),
    solana_program::pubkey!("Stake11111111111111111111111111111111111111"),
    solana_program::pubkey!("11111111111111111111111111111111"),
    solana_program::pubkey!("Vote111111111111111111111111111111111111111"),
    solana_program::pubkey!("Sysvar1111111111111111111111111111111111111"),
    solana_program::pubkey!("SysvarC1ock11111111111111111111111111111111"),
    solana_program::pubkey!("SysvarEpochRewards1111111111111111111111111"),
    solana_program::pubkey!("SysvarEpochSchedu1e111111111111111111111111"),
    solana_program::pubkey!("SysvarFees111111111111111111111111111111111"),
    solana_program::pubkey!("Sysvar1nstructions1111111111111111111111111"),
    solana_program::pubkey!("SysvarLastRestartS1ot1111111111111111111111"),
    solana_program::pubkey!("SysvarRecentB1ockHashes11111111111111111111"),
    solana_program::pubkey!("SysvarRent111111111111111111111111111111111"),
    solana_program::pubkey!("SysvarRewards111111111111111111111111111111"),
    solana_program::pubkey!("SysvarS1otHashes111111111111111111111111111"),
    solana_program::pubkey!("SysvarS1otHistory11111111111111111111111111"),
    solana_program::pubkey!("SysvarStakeHistory1111111111111111111111111"),
    solana_program::pubkey!("ZkTokenProof1111111111111111111111111111111"),
    solana_program::pubkey!("ZkE1Gama1Proof11111111111111111111111111111"),
];

pub fn is_reserved_lamport_recipient(key: &Pubkey) -> bool {
    RESERVED_LAMPORT_RECIPIENT_KEYS.contains(key)
}

/// Whether an account can accept a direct lamport credit. Writability is checked
/// separately so permissionless callers cannot redirect a healthy payout by
/// passing its recipient read-only. Callers also account for post-credit rent.
pub fn can_receive_lamports(account: &AccountInfo) -> bool {
    !is_reserved_lamport_recipient(account.key)
        && !account.executable
        && *account.owner != solana_program::sysvar::ID
        && *account.owner != solana_program::pubkey!("NativeLoader1111111111111111111111111111111")
}
