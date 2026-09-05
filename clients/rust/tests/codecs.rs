//! Runtime verification for the hand-written hooked codecs. Each test builds an
//! account byte buffer exactly as the on-chain programs serialize it, then
//! asserts the decoder recovers the expected values (items, flags, guards).

use mallow_gumball_client::accounts::{
    GumballGuard, GumballMachine, GUMBALL_GUARD_DISCRIMINATOR, GUMBALL_MACHINE_DISCRIMINATOR,
};
use mallow_gumball_client::types::{
    BotTax, BuyBackConfig, ConfigLineV2, EndDate, GumballSettings, GumballState, SolPayment,
    TokenStandard,
};
use mallow_gumball_client::{
    GumballGuardAccountData, GumballMachineAccountData, GUMBALL_MACHINE_HIDDEN_SECTION,
};
use solana_address::Address;

fn addr(byte: u8) -> Address {
    Address::from([byte; 32])
}

#[test]
fn decodes_gumball_machine_hidden_section() {
    // A version-5 machine with capacity 2, one item already drawn (redeemed).
    let base = GumballMachine {
        discriminator: GUMBALL_MACHINE_DISCRIMINATOR,
        version: 5,
        authority: addr(1),
        mint_authority: addr(2),
        marketplace_fee_config: None,
        items_redeemed: 1,
        items_settled: 0,
        total_revenue: 0,
        state: GumballState::SaleLive,
        settings: GumballSettings {
            uri: "https://example.com/machine.json".to_string(),
            item_capacity: 2,
            items_per_seller: 10,
            sellers_merkle_root: None,
            curator_fee_bps: 0,
            hide_sold_items: false,
            payment_mint: addr(9),
        },
    };

    let mut buf = borsh::to_vec(&base).unwrap();
    // The hidden section starts at a fixed offset; pad the (variable) base out to it.
    assert!(buf.len() <= GUMBALL_MACHINE_HIDDEN_SECTION);
    buf.resize(GUMBALL_MACHINE_HIDDEN_SECTION, 0);

    // items_loaded
    buf.extend_from_slice(&2u32.to_le_bytes());
    // config line 0: undrawn/unsold, no buyer, token standard NonFungible, amount 1
    buf.extend_from_slice(
        &borsh::to_vec(&ConfigLineV2 {
            mint: addr(10),
            seller: addr(11),
            buyer: addr(0), // all-zero => None
            token_standard: TokenStandard::NonFungible,
            amount: 1,
        })
        .unwrap(),
    );
    // config line 1: drawn by a buyer, token standard Core, amount 5
    buf.extend_from_slice(
        &borsh::to_vec(&ConfigLineV2 {
            mint: addr(12),
            seller: addr(13),
            buyer: addr(14),
            token_standard: TokenStandard::Core,
            amount: 5,
        })
        .unwrap(),
    );
    // claimed bitmap (1 byte): index 1 claimed (MSB-first => bit 6 = 0x40)
    buf.push(0x40);
    // settled bitmap (1 byte): index 0 settled (bit 7 = 0x80)
    buf.push(0x80);
    // items_left_to_mint (capacity 2 u32s). items_remaining = loaded(2) - redeemed(1) = 1,
    // so only the first entry is meaningful: index 1 is still mintable (not drawn).
    buf.extend_from_slice(&1u32.to_le_bytes());
    buf.extend_from_slice(&0u32.to_le_bytes());
    // version >= 3: disable_royalties, [u8;3] unused, disable_primary_split
    buf.push(1); // disable_royalties = true
    buf.extend_from_slice(&[0u8; 3]);
    buf.push(0); // disable_primary_split = false
                 // version >= 4: buy_back_config + buy_back_funds_available
    buf.extend_from_slice(
        &borsh::to_vec(&BuyBackConfig {
            enabled: true,
            to_gumball_machine: false,
            oracle_signer: addr(20),
            value_pct: 10,
            marketplace_fee_bps: 100,
            cutoff_pct: 50,
        })
        .unwrap(),
    );
    buf.extend_from_slice(&12_345u64.to_le_bytes());
    // version >= 5: total_proceeds_settled
    buf.extend_from_slice(&67_890u64.to_le_bytes());

    let decoded = GumballMachineAccountData::from_bytes(&buf).unwrap();

    assert_eq!(decoded.items_loaded, 2);
    assert_eq!(decoded.base.version, 5);
    assert_eq!(decoded.items.len(), 2);

    let item0 = &decoded.items[0];
    assert_eq!(item0.index, 0);
    assert!(item0.is_drawn, "index 0 is not in the remaining-mint list");
    assert!(!item0.is_claimed);
    assert!(item0.is_settled);
    assert_eq!(item0.mint, addr(10));
    assert_eq!(item0.buyer, None);
    assert_eq!(item0.token_standard, TokenStandard::NonFungible);
    assert_eq!(item0.amount, 1);

    let item1 = &decoded.items[1];
    assert_eq!(item1.index, 1);
    assert!(
        !item1.is_drawn,
        "index 1 is still in the remaining-mint list"
    );
    assert!(item1.is_claimed);
    assert!(!item1.is_settled);
    assert_eq!(item1.buyer, Some(addr(14)));
    assert_eq!(item1.token_standard, TokenStandard::Core);
    assert_eq!(item1.amount, 5);

    assert!(decoded.disable_royalties);
    assert!(!decoded.disable_primary_split);
    assert!(decoded.buy_back_config.enabled);
    assert_eq!(decoded.buy_back_config.value_pct, 10);
    assert_eq!(decoded.buy_back_config.marketplace_fee_bps, 100);
    assert_eq!(decoded.buy_back_config.cutoff_pct, 50);
    assert_eq!(decoded.buy_back_funds_available, 12_345);
    assert_eq!(decoded.total_proceeds_settled, 67_890);
}

#[test]
fn version_1_machine_defaults_amount_and_skips_versioned_fields() {
    // Version-1 config lines carry no `amount` (defaults to 1) and none of the
    // version >= 3/4/5 trailing fields exist.
    let base = GumballMachine {
        discriminator: GUMBALL_MACHINE_DISCRIMINATOR,
        version: 1,
        authority: addr(1),
        mint_authority: addr(2),
        marketplace_fee_config: None,
        items_redeemed: 0,
        items_settled: 0,
        total_revenue: 0,
        state: GumballState::None,
        settings: GumballSettings {
            uri: "x".to_string(),
            item_capacity: 1,
            items_per_seller: 1,
            sellers_merkle_root: None,
            curator_fee_bps: 0,
            hide_sold_items: false,
            payment_mint: addr(9),
        },
    };

    let mut buf = borsh::to_vec(&base).unwrap();
    buf.resize(GUMBALL_MACHINE_HIDDEN_SECTION, 0);

    buf.extend_from_slice(&1u32.to_le_bytes()); // items_loaded
                                                // v1 config line: mint + seller + buyer + token_standard (no amount)
    buf.extend_from_slice(addr(10).as_ref());
    buf.extend_from_slice(addr(11).as_ref());
    buf.extend_from_slice(addr(0).as_ref());
    buf.push(0); // token standard NonFungible
    buf.push(0x00); // claimed bitmap (1 byte, none)
    buf.push(0x00); // settled bitmap (1 byte, none)
    buf.extend_from_slice(&0u32.to_le_bytes()); // items_left_to_mint[0]

    let decoded = GumballMachineAccountData::from_bytes(&buf).unwrap();
    assert_eq!(decoded.items.len(), 1);
    assert_eq!(decoded.items[0].amount, 1);
    // items_redeemed == 0 => nothing drawn yet; index 0 is in the remaining list.
    assert!(!decoded.items[0].is_drawn);
    assert!(!decoded.buy_back_config.enabled);
    assert_eq!(decoded.total_proceeds_settled, 0);
}

#[test]
fn decodes_gumball_guard_default_and_groups() {
    let base = GumballGuard {
        discriminator: GUMBALL_GUARD_DISCRIMINATOR,
        base: addr(1),
        bump: 254,
        authority: addr(2),
    };

    let mut buf = borsh::to_vec(&base).unwrap();
    assert_eq!(buf.len(), 73); // DATA_OFFSET

    // Default guard set: bot_tax (bit 0) + sol_payment (bit 2) enabled.
    buf.extend_from_slice(&0b101u64.to_le_bytes());
    buf.extend_from_slice(
        &borsh::to_vec(&BotTax {
            lamports: 1000,
            last_instruction: true,
        })
        .unwrap(),
    );
    buf.extend_from_slice(&borsh::to_vec(&SolPayment { lamports: 5000 }).unwrap());

    // One group "vip" with only end_date (bit 7) enabled.
    buf.extend_from_slice(&1u32.to_le_bytes());
    let mut label = b"vip".to_vec();
    label.resize(6, 0); // null-padded to MAX_LABEL_SIZE
    buf.extend_from_slice(&label);
    buf.extend_from_slice(&(1u64 << 7).to_le_bytes());
    buf.extend_from_slice(&borsh::to_vec(&EndDate { date: 999 }).unwrap());

    let decoded = GumballGuardAccountData::from_bytes(&buf).unwrap();

    assert_eq!(decoded.base.bump, 254);
    assert_eq!(decoded.base.authority, addr(2));

    let default = &decoded.data.default;
    assert_eq!(
        default
            .bot_tax
            .as_ref()
            .map(|g| (g.lamports, g.last_instruction)),
        Some((1000, true))
    );
    assert_eq!(default.sol_payment.as_ref().map(|g| g.lamports), Some(5000));
    assert!(default.start_date.is_none());
    assert!(default.end_date.is_none());

    assert_eq!(decoded.data.groups.len(), 1);
    let group = &decoded.data.groups[0];
    assert_eq!(group.label, "vip");
    assert_eq!(group.guards.end_date.as_ref().map(|g| g.date), Some(999));
    assert!(group.guards.bot_tax.is_none());
}
