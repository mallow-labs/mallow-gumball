# Codama migration plan — JS client generation

Replaces the legacy `kinobi` + `shank-js` client pipeline with `codama`, so the JS
client can be regenerated from the **Anchor 1.1.2** (spec 0.1.0) IDLs produced by
the toolkit upgrade.

## Where things stand

- Programs are migrated to Anchor 1.1.2 / Agave 3.1.12 and build via
  `cargo build-sbf --arch v2` (committed on `toolkit-upgrade`).
- `anchor build` now emits **spec-0.1.0** IDLs to `programs/<p>/target/idl/*.json`
  (`mallow_gumball`: 36 instr / 18 types; `gumball_guard`: 13 instr / 9 types).
- **`kinobi@0.14` cannot parse spec-0.1.0** — verified failure:
  `TypeNode: Unsupported type {"defined":{"name":"CnftArgs"}}`. It must be replaced.
- The existing JS client (`clients/js`) is **umi-based**; **40 ava integration
  tests** in `clients/js/test/` exercise it against a local validator (amman),
  deploying the built `.so` programs.

Reference implementation to mirror: `../mallow-program-library/codama.mjs` (same
team, same idioms — but it renders a `gill`/`kit` client, not umi).

## Goal

`node codama.mjs` reads both spec-0.1.0 IDLs, applies the customizations currently
in `configs/kinobi.cjs`, and regenerates the **umi** client into
`clients/js/src/generated/`, with the 40 ava tests green.

## 1. Packages (root `package.json`)

Remove: `@metaplex-foundation/kinobi`, `@metaplex-foundation/shank-js`.
Add (devDependencies):

- `codama` (^1.9)
- `@codama/nodes-from-anchor` (^1.5)
- `@codama/renderers-js-umi` (^1.1)  ← umi renderer, preserves the client shape
  the tests depend on (do **not** use `@codama/renderers-js`, which emits a
  different `@solana/kit` client).

## 2. Pipeline (`package.json` scripts + `build.sh`)

IDLs now come from `anchor build`, not shank. Recommended:

- `build.sh`: after `anchor build`, copy `programs/<p>/target/idl/*.json` → `idls/`
  (keep `idls/` as the canonical codama input). Drop `generate:idls` (shank).
- `generate:clients`: `node ./codama.mjs && pnpm --filter @mallow-labs/mallow-gumball format:fix`
- Keep `programs:build` → `build.sh` (already `--arch v2`).

## 3. Port `configs/kinobi.cjs` (~600 lines) → `codama.mjs`

Two programs render into **one** client. `rootNodeFromAnchor(idl)` yields one root
per IDL, so merge: build the mallow_gumball root, then attach the gumball_guard
program via `additionalPrograms` on the root node before `createFromRoot`.

kinobi → codama construct mapping (verify exact names against installed codama):

| kinobi (`k.`) | codama (`c.`) |
|---|---|
| `createFromIdls([a,b])` | `createFromRoot(rootNodeFromAnchor(a))` + attach `b`'s program via `additionalPrograms` |
| `UpdateProgramsVisitor` | `updateProgramsVisitor` |
| `UpdateAccountsVisitor` (seeds/size/discriminator) | `updateAccountsVisitor` |
| `UpdateDefinedTypesVisitor({x:{delete:true}})` | `updateDefinedTypesVisitor` |
| `UpdateInstructionsVisitor` (name/internal/args/accounts) | `updateInstructionsVisitor` |
| `SetInstructionAccountDefaultValuesVisitor` | `setInstructionAccountDefaultValuesVisitor` |
| `SetStructDefaultValuesVisitor` | `setStructDefaultValuesVisitor` |
| `SetNumberWrappersVisitor` | `setNumberWrappersVisitor` |
| `TransformNodesVisitor` | `bottomUpTransformerVisitor` |
| `FlattenInstructionArgsStructVisitor` | codama flattens args by default (likely drop) |
| `stringConstantSeed('x')` | `constantPdaSeedNodeFromString('utf8','x')` |
| `publicKeySeed`/`variableSeed(name,type,doc)` | `variablePdaSeedNode(name, typeNode, doc)` |
| `sizeAccountDiscriminator()` | account `discriminator: sizeDiscriminatorNode(n)` |
| `identityDefault()` | `identityValueNode()` |
| `payerDefault()` | `payerValueNode()` |
| `publicKeyDefault(addr)` | `publicKeyValueNode(addr)` |
| `programDefault(name,addr)` | `publicKeyValueNode(addr)` (or program-id node) |
| `pdaDefault(name,{seeds})` | `pdaValueNode(name,[pdaSeedValueNode(...)])` |
| `conditionalDefault('account',x,{ifTrue})` | `conditionalValueNode({condition, ifTrue})` |
| `vNone()/vScalar(v)/vStruct({..})` | `noneValueNode()/booleanValueNode(v)/structValueNode` |
| `RenderJavaScriptVisitor(dir,{prettier,dependencyMap})` | `renderVisitor(dir,{dependencyMap})` from `@codama/renderers-js-umi` |

### Constructs needing special care

1. **Two-program single client** — root-node merge (`additionalPrograms`). This is
   the first thing to get right; everything else renders off it.
2. **Program name→prefix** — kinobi renamed programs (`gumballGuard`/`mallowGumball`)
   with prefixes `Cg`/`Cm`. Reproduce with `updateProgramsVisitor`; confirm codama's
   conflict/prefix handling matches (may need explicit renames on colliding types).
3. **Size-discriminated guard accounts** (`mintCounter`, `allowListProof`,
   `allocationTracker`) — in the 1.x IDL these are *defined types*, not accounts
   (no 8-byte anchor discriminator). kinobi promoted them via
   `TransformDefinedTypesIntoAccountsVisitor`. In codama, promote them to account
   nodes with a `sizeDiscriminatorNode` and attach their PDA seeds.
4. **Custom `gumballMachine` serializer** (`UseCustomAccountSerializerVisitor`,
   `extract:true`) — the machine is a variable-size, manually-serialized account.
   Its custom codec lives in `clients/js/src/hooked/`. Preserve that and wire it via
   a `linkOverrides`/hooked account override in codama.
5. **`importFrom: "hooked"` PDAs** (`eventAuthority`, `gumballMachineAuthority`,
   `gumballGuard`, `jellybean*`, `tokenRecord`, etc.) — these resolve to hand-written
   code in `clients/js/src/hooked/`. Audit that dir; keep the manual PDAs/resolvers,
   fixing import paths/type names against the regenerated output.

## 4. Preserve / reconcile `clients/js/src/hooked/`

Hand-written PDAs, the `gumballMachine` custom codec, and helper resolvers live
here. They are NOT regenerated. After the first codama render, reconcile their
imports and exported symbols with the new `generated/` output.

## 5. Test loop

1. `pnpm programs:build` — v2 `.so` → `programs/.bin`, IDLs → `idls/`.
2. `pnpm generate` — codama regenerates `clients/js/src/generated`.
3. `cd clients/js && pnpm build` — TypeScript compile; fixes surface as type errors.
4. `pnpm test` — ava. Tests deploy the `.so` via amman/test-validator (see
   `clients/js/test/_setup.ts`, `configs/program-scripts/dump.sh` for external
   program dumps). The local validator must run **SBPFv2** programs (Agave 3.1.12
   does) and load the v2-built `programs/.bin`.
5. Iterate on `codama.mjs` + hooked modules until green.

## Risks / gotchas

- **Renderer output drift**: umi renderer discriminator handling, account-data
  codecs, and import paths differ from kinobi — expect a batch of test fixups.
- **Program IDs**: spec-0.1.0 IDLs carry `metadata.address`, so no injection needed
  (unlike the reference's pre-0.1.0 IDLs).
- **`bytes` fixed-size** for `merkleRoot` (32) — confirm codama emits a fixed-size
  bytes codec, matching the seed usage.
- **Jellybean types in the guard IDL**: the guard IDL references `JellybeanMachine`
  (external). Confirm codama renders it acceptably or link it out.

## Estimated effort

Large and iterative — a faithful ~600-line config port + hooked reconciliation +
driving 40 integration tests (with a validator) to green. Best done as a dedicated
pass, not folded into the on-chain migration.
