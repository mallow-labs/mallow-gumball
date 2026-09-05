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
