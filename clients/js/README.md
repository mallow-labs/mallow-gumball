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

```sh
pnpm build   # tsup (cjs + esm) + tsc declarations
pnpm test    # tsup + ava (LiteSVM; requires Node >= 24)
pnpm lint
```

The generated code is produced from the repo-root `codama.mjs` (`pnpm generate` at the repo root renders both this client and the umi client).
