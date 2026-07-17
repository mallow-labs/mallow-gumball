# Rust client

A generated Rust library for the Mallow Gumball and Gumball Guard programs.

## Getting started

To build and test your Rust client from the root of the repository, you may use the following command.

```sh
pnpm clients:rust:test
```

## Note on manually-serialized accounts

The `GumballMachine` and `GumballGuard` accounts are variable-size / manually
serialized on-chain. The generated borsh structs in `src/generated/accounts`
compile, but do not decode the trailing variable-length sections. Use the
JavaScript / UMI clients (which hand-write those codecs) if you need to
deserialize those accounts.
