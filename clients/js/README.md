# @mallow-labs/mallow-gumball

A [Solana Kit](https://github.com/anza-xyz/kit) client for the Mallow Gumball Machine and Gumball Guard programs.

> Looking for the umi client? It now lives at [`@mallow-labs/mallow-gumball-umi`](../umi).

## Installation

```sh
pnpm install @mallow-labs/mallow-gumball @solana/kit
```

## Overview

This client is generated from the on-chain IDLs via [Codama](https://github.com/codama-idl/codama) (`@codama/renderers-js`) and layered with hand-written helpers that Codama cannot generate:

- **Generated** (`src/generated`): account decoders, instruction builders (`get*InstructionAsync`), PDA finders, defined types, and typed program errors.
- **Guard framework** (`src/guards`, `src/defaultGuards`): the Gumball Guard guard-set framework and the 19 default guards, ported to Kit codecs.
- **Account codecs** (`src/hooked`): the variable-size `GumballMachine` and dynamic `GumballGuard` account decoders, plus the external PDA finders (ATA, Token Metadata, event/authority PDAs).
- **High-level builders** (`src/*.ts`): `create`, `draw`, `route`, `createGumballGuard`, `updateGumballGuard`, `sellItem`, settle/close helpers, and Merkle allow-list helpers.

Because Kit derives PDAs asynchronously, the guard-aware builders (`draw`, `route`, `create`, …) are `async` and return Kit `Instruction`s (or `Instruction[]`).

## Example

```ts
import { generateKeyPairSigner } from '@solana/kit';
import { create, draw, some } from '@mallow-labs/mallow-gumball';

// Create a gumball machine + guard (needs an RPC to compute rent).
const instructions = await create(
  {
    gumballMachine,
    authority,
    payer,
    settings: { itemCapacity: 10n /* … */ },
    guards: { solPayment: some({ lamports: 1_000_000_000n }) },
  },
  { rpc }
);

// Draw an item, running the guard mint parsers.
const drawIx = await draw({
  gumballMachine: gumballMachine.address,
  buyer,
  payer,
  mintArgs: { solPayment: some(true) },
});
```

## Development

`getSettleCnftSaleV2InstructionAsync` uses the live leaf's current flags, owner,
delegate, metadata and proof, including default owner/delegate keys. For a
claimed, burnt leaf only, set `args.flags = 255`, supply an empty-slot proof and
`nonce == index`, and omit creator payout accounts. If the recorded tree was
closed, pass its key with a zero root and no proof nodes instead. See the
[v2 instruction reference](../../programs/mallow-gumball/README.md#bubblegum-v2-compressed-nfts).
Missing-tree evidence also covers foreign/uninitialized replacement accounts and
recorded slots at or beyond a replacement MPL tree's append index or capacity.
SPL-owned replacements require the marketplace-admin no-leaf refund; burnt
settlement prefixes remaining accounts with the marketplace fee authority signer
and canonical guard GlobalConfig before any Token-2022 payment-program slot.
Live v1 trees never qualify as permissionless v2 missing-tree evidence. See the
[exact recovery rules](../../docs/cnft-v2.md#closed-trees).

Occupied/unprovable MPL replacements require marketplace-authorized exits after
off-chain verification. For claimed or recovered-unsold settlement, use a zero
root, `args.flags = 255`, `nonce == index`, and the marketplace signer/canonical
GlobalConfig prefix before any Token-2022 slot. Receipt cleanup uses no leaf,
zero root and the same prefix, returning rent to its recorded payer. Normal
machine close follows settlement. No on-chain permissionless predicate changes.


```sh
pnpm build   # tsup (cjs + esm) + tsc declarations
pnpm test    # builds ../umi fixtures, then tsup + ava (Node >= 24)
pnpm lint
```

Install dependencies in both `clients/js` and `clients/umi` before testing.
The Kit tests reuse the Umi LiteSVM fixtures; `pnpm test` builds them automatically,
including when invoked through the root `pnpm test:js` or `pnpm test`.

The generated code is produced from the repo-root `codama.mjs` (`pnpm generate` at the repo root renders both this client and the umi client).
