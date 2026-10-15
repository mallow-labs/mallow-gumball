use mallow_gumball_client::instructions::{
    AddCnftV2, AddCnftV2InstructionArgs, ADD_CNFT_DISCRIMINATOR,
};
use mallow_gumball_client::types::{AddItemArgs, CnftArgs, CnftArgsV2, CnftCreator};
use solana_address::Address;

#[test]
fn v2_preserves_leaf_fields_and_separate_delegate_account() {
    let address = |byte| Address::from([byte; 32]);
    let args = CnftArgsV2 {
        root: [1; 32],
        meta_hash: [2; 32],
        seller_fee_basis_points: u16::MAX,
        creators: vec![],
        nonce: 17,
        index: 19,
        version: 2,
        asset_data_hash: Some([7; 32]),
        flags: 4,
    };
    let bytes = borsh::to_vec(&args).unwrap();
    assert_eq!(borsh::from_slice::<CnftArgsV2>(&bytes).unwrap(), args);
    let accounts = AddCnftV2 {
        gumball_machine: address(1),
        seller_history: address(2),
        authority_pda: address(3),
        seller: address(4),
        leaf_delegate: address(5),
        tree_config: address(6),
        merkle_tree: address(7),
        core_collection: Some(address(8)),
        log_wrapper: address(9),
        compression_program: address(10),
        bubblegum_program: address(11),
        system_program: address(12),
    };
    let instruction = accounts.instruction(AddCnftV2InstructionArgs {
        args,
        add_item_args: AddItemArgs {
            seller_proof_path: None,
            index: None,
        },
    });
    assert!(instruction.accounts[3].is_signer);
    assert!(!instruction.accounts[4].is_signer);
    assert_eq!(instruction.accounts[4].pubkey, address(5));
    assert!(instruction.accounts[5].is_writable);
    assert_eq!(instruction.accounts[7].pubkey, address(8));
    assert_ne!(instruction.data[..8], ADD_CNFT_DISCRIMINATOR);
}

#[test]
fn original_cnft_wire_layout_is_unchanged() {
    let args = CnftArgs {
        root: [1; 32],
        meta_hash: [2; 32],
        seller_fee_basis_points: 500,
        creators: vec![CnftCreator {
            address: Address::from([3; 32]),
            verified: true,
            share: 100,
        }],
        nonce: 4,
        index: 5,
        version: 1,
    };
    let mut expected = vec![1; 32];
    expected.extend([2; 32]);
    expected.extend(500u16.to_le_bytes());
    expected.extend(1u32.to_le_bytes());
    expected.extend([3; 32]);
    expected.extend([1, 100]);
    expected.extend(4u64.to_le_bytes());
    expected.extend(5u32.to_le_bytes());
    expected.push(1);
    assert_eq!(borsh::to_vec(&args).unwrap(), expected);
}

#[test]
fn recovery_pda_uses_little_endian_nonce_bytes() {
    use mallow_gumball_client::{accounts::CnftRecovery, ID as MALLOW_GUMBALL_ID};
    let machine = Address::from([1; 32]);
    let tree = Address::from([2; 32]);
    for nonce in [0u64, 7, 256, u64::MAX] {
        let (expected, bump) = Address::find_program_address(
            &[
                b"cnft_recovery",
                machine.as_ref(),
                tree.as_ref(),
                &nonce.to_le_bytes(),
            ],
            &MALLOW_GUMBALL_ID,
        );
        assert_eq!(
            CnftRecovery::find_pda(&machine, &tree, nonce.to_le_bytes()),
            (expected, bump)
        );
        assert_eq!(
            CnftRecovery::create_pda(machine, tree, nonce.to_le_bytes(), bump).unwrap(),
            expected
        );
    }
}
