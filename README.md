# mallow Gumball Machine

The mallow Gumball Machine enables randomly drawn sales using pre-minted Metaplex Core or Legacy NFTs.

## Programs

This project contains the following programs:

- [mallow Gumball](./programs/mallow-gumball/README.md) `MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa`
- [Gumball Guard](./programs/gumball-guard/README.md) `GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF`

Build with `heavy -- pnpm programs:build`. The documented build generates Anchor IDLs,
then produces SBPFv2 binaries with platform-tools pinned to v1.52.
`programs/.bin` and `target/deploy` contain identical deployable program bytes.
Cold-cache builds create local placeholder keypairs before Anchor's IDL phase;
these keys are never deployment identities. The build verifies the canonical
MGUM/GGRD declarations and IDL addresses before publishing any outputs.

For the v2 release, upgrade **gumball-guard first** and verify it, then extend
and upgrade **mallow-gumball**. Keep new v2 entries disabled until the programs,
clients and consumers are ready. The old guard deducts fees on draw and cannot
fund the v6 gross-payment reserve. See [the rollout details](./docs/cnft-v2.md).

## Clients

This project contains the following clients, all generated from the on-chain
IDLs via [Codama](https://github.com/codama-idl/codama) (`codama.mjs`):

- [`@mallow-labs/mallow-gumball`](./clients/js/README.md) — Solana Kit client (`clients/js`)
- [`@mallow-labs/mallow-gumball-umi`](./clients/umi/README.md) — umi client (`clients/umi`)
- [`mallow-gumball-client`](./clients/rust/README.md) — Rust client (`clients/rust`)

A guard is bound to the machine whose address equals its immutable `base`.
Wrapping, guard edits, guard closure and draws enforce this for gumball and
Jellybean machines. Guard edits use that machine's collaborator custody lock;
closing a guard also requires closing its bound machine. Existing matching-base
guards need no account migration; mismatched legacy bindings fail closed and
must be identified before rollout.


V2 missing-tree exits survive re-creation of the recorded tree address. Foreign
owners, uninitialized MPL accounts and absent replacement-tree slots use
empty-leaf recovery; SPL replacements require marketplace authorization to
preserve live v1 validation. Other occupied/unprovable replacement slots use
marketplace-authorized refund, settlement and receipt closure after off-chain
verification; normal machine close then releases its rent. See [the recovery rules](./docs/cnft-v2.md#closed-trees).
