# Rust client

A generated Rust library for the Mallow Gumball and Gumball Guard programs.

## Getting started

To build and test your Rust client from the root of the repository, you may use the following command.

```sh
pnpm clients:rust:test
```

## Manually-serialized accounts

The `GumballMachine` and `GumballGuard` accounts are variable-size / manually
serialized on-chain, so their generated `src/generated/accounts` structs decode
only the fixed base header. Hand-written codecs in `src/hooked` decode the full
accounts, mirroring the js/umi clients:

- `GumballMachineAccountData::from_bytes` — base header plus the hidden section
  (loaded items, claimed/settled state, buy-back config, …).
- `GumballGuardAccountData::from_bytes` — base header plus the active guard set
  and any named groups.

Both are re-exported from the crate root, along with `TryFrom<&AccountInfo>`
impls and (under the `fetch` feature) `fetch_gumball_machine_account_data` /
`fetch_gumball_guard_account_data` helpers.

## Recovery receipt seeds

`CnftRecovery::find_pda` and `create_pda` take the leaf nonce as eight
little-endian bytes: pass `nonce.to_le_bytes()`. The generator uses a fixed
byte seed so the Rust renderer cannot format the nonce as a decimal string.


For v2 missing-tree exits, use `leaf = None` (refund/receipt cleanup) or
`args.flags = 255` (claimed burnt settlement), zero root and no proof nodes.
Foreign-owned replacements, invalid MPL headers and slots outside the append
index/capacity qualify. SPL-owned replacements use marketplace-authorized
`admin_refund_cnft_sale_v2`; burnt settlement prefixes remaining accounts with
the marketplace signer and canonical guard GlobalConfig before any Token-2022
slot. This preserves live v1 verification. See the
[recovery rules](../../docs/cnft-v2.md#closed-trees).
