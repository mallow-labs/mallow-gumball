// Codama client generation — replaces the legacy kinobi pipeline.
//
// Reads the two Anchor 1.1.2 (spec-0.1.0) IDLs from `idls/`, merges them into a
// single root (mallow_gumball as the main program, gumball_guard as an
// additional program), applies the customizations previously encoded in
// `configs/kinobi.cjs`, and renders the umi client into
// `clients/js/src/generated/`.
//
// Run via `pnpm generate` (which also runs prettier).

import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js-umi";
import * as c from "codama";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const idlDir = path.join(__dirname, "idls");
const jsDir = path.join(__dirname, "clients", "js", "src", "generated");

// Program IDs (spec-0.1.0 IDLs carry metadata.address, but we still reference
// these for account default values that inject a program address).
const MALLOW_GUMBALL_ID = "MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa";
const MALLOW_JELLYBEAN_ID = "J3LLYcm8V5hJRzCKENRPW3yGdQ6xU8Nie8jr3mU88eqq";

// ---------------------------------------------------------------------------
// Load + pre-process the IDLs.
// ---------------------------------------------------------------------------

const gumballIdl = JSON.parse(
  readFileSync(path.join(idlDir, "mallow_gumball.json"), "utf-8")
);
const guardIdl = JSON.parse(
  readFileSync(path.join(idlDir, "gumball_guard.json"), "utf-8")
);

// The `IdlHints` event exists only to force Anchor to emit the guard/config-line
// types into the IDL (see programs/*/src/events/idl_hints.rs). Strip it so it
// isn't rendered into the client.
const stripIdlHints = (idl) => {
  idl.types = (idl.types ?? []).filter((t) => t.name !== "IdlHints");
  idl.events = (idl.events ?? []).filter((e) => e.name !== "IdlHints");
};
stripIdlHints(gumballIdl);
stripIdlHints(guardIdl);

// Anchor 1.1.2 emits `pda` seeds on instruction accounts. Codama turns these
// into standalone PDA nodes for accounts that aren't program accounts (e.g.
// `authority_pda`), but the umi renderer only renders PDA finders inside
// account files, so those finders never materialize. Strip the instruction-
// account seeds and drive all PDA resolution from the explicit account seeds
// (updateAccountsVisitor) + default values below — the same model as kinobi.
const stripInstructionAccountPdas = (idl) => {
  for (const ix of idl.instructions ?? []) {
    for (const acc of ix.accounts ?? []) delete acc.pda;
  }
};
stripInstructionAccountPdas(gumballIdl);
stripInstructionAccountPdas(guardIdl);

// The Anchor 1.1.2 guard IDL now surfaces copies of the gumball machine's own
// types (the guard reads the machine via a typed `Account<GumballMachine>`).
// They are structurally identical to the mallow_gumball definitions and would
// collide in the merged, single-namespace client. Codama has no per-program
// prefix (unlike kinobi's `Cg`/`Cm`), so drop the guard's copies — the
// mallow_gumball program supplies the canonical versions.
const GUARD_DUPLICATE_TYPES = new Set([
  "GumballMachine",
  "GumballSettings",
  "GumballState",
  "FeeConfig",
]);
guardIdl.types = guardIdl.types.filter((t) => !GUARD_DUPLICATE_TYPES.has(t.name));

// ---------------------------------------------------------------------------
// Build the merged root (mallow_gumball main, gumball_guard additional).
// ---------------------------------------------------------------------------

// `rootNodeFromAnchor(idl)` (the dispatcher) only reads the first arg and
// applies codama's default normalization visitor. Build each root separately so
// both get normalized, then merge the guard in as an additional program.
const gumballRoot = rootNodeFromAnchor(gumballIdl);
const guardRoot = rootNodeFromAnchor(guardIdl);

// Both Anchor programs export standard error names (PublicKeyMismatch,
// IncorrectOwner, …). Codama has no per-program prefix (kinobi used `Cg`/`Cm`),
// so the guard's error classes would collide with the gumball machine's.
// Prefix the guard's errors with "Cg" to match the legacy client's names.
const guardProgram = {
  ...guardRoot.program,
  errors: guardRoot.program.errors.map((e) => ({
    ...e,
    name: c.camelCase(`cg ${e.name}`),
  })),
};

const codama = c.createFromRoot(
  c.rootNode(gumballRoot.program, [
    guardProgram,
    ...gumballRoot.additionalPrograms,
    ...guardRoot.additionalPrograms,
  ])
);

// ---------------------------------------------------------------------------
// Promote the size-discriminated guard PDAs (manually serialized on-chain, so
// they arrive as defined types) into account nodes.
// ---------------------------------------------------------------------------

codama.update(
  c.transformDefinedTypesIntoAccountsVisitor([
    "mintCounter",
    "allowListProof",
    "allocationTracker",
  ])
);

// ---------------------------------------------------------------------------
// Seeds (reused across accounts).
// ---------------------------------------------------------------------------

const stringSeed = (value) => c.constantPdaSeedNodeFromString("utf8", value);
const pubkeySeed = (name, doc) =>
  c.variablePdaSeedNode(name, c.publicKeyTypeNode(), doc);

const gumballGuardSeed = pubkeySeed(
  "gumballGuard",
  "The address of the Gumball Guard account"
);
const gumballMachineSeed = pubkeySeed(
  "gumballMachine",
  "The address of the Gumball Machine account"
);
const machineSeed = pubkeySeed("machine", "The address of the Machine account");
const userSeed = pubkeySeed("user", "The address of the wallet trying to mint");

// ---------------------------------------------------------------------------
// Update accounts (seeds, sizes, size discriminators).
// ---------------------------------------------------------------------------

codama.update(
  c.updateAccountsVisitor({
    gumballGuard: {
      seeds: [
        stringSeed("gumball_guard"),
        pubkeySeed(
          "base",
          "The base address which the Gumball Guard PDA derives from"
        ),
      ],
    },
    sellerHistory: {
      seeds: [
        stringSeed("seller_history"),
        gumballMachineSeed,
        pubkeySeed("seller", "The seller this history is tracking"),
      ],
    },
    addItemRequest: {
      seeds: [
        stringSeed("add_item_request"),
        pubkeySeed(
          "asset",
          "The address of the asset being added to the Gumball Machine"
        ),
      ],
    },
    globalConfig: {
      seeds: [stringSeed("global_config")],
    },
    mintCounter: {
      size: 2,
      discriminators: [c.sizeDiscriminatorNode(2)],
      seeds: [
        stringSeed("mint_limit"),
        c.variablePdaSeedNode(
          "id",
          c.numberTypeNode("u8"),
          "A unique identifier in the context of a Gumball Machine/Gumball Guard combo"
        ),
        userSeed,
        gumballGuardSeed,
        machineSeed,
      ],
    },
    allowListProof: {
      size: 8,
      discriminators: [c.sizeDiscriminatorNode(8)],
      seeds: [
        stringSeed("allow_list"),
        c.variablePdaSeedNode(
          "merkleRoot",
          c.fixedSizeTypeNode(c.bytesTypeNode(), 32),
          "The Merkle Root used when verifying the user"
        ),
        userSeed,
        gumballGuardSeed,
        machineSeed,
      ],
    },
    allocationTracker: {
      size: 4,
      discriminators: [c.sizeDiscriminatorNode(4)],
      seeds: [
        stringSeed("allocation"),
        c.variablePdaSeedNode(
          "id",
          c.numberTypeNode("u8"),
          "Unique identifier of the allocation"
        ),
        gumballGuardSeed,
        machineSeed,
      ],
    },
  })
);

// ---------------------------------------------------------------------------
// Force the AllowList `merkleRoot` field to a fixed-size 32-byte codec, to
// match the seed usage above.
// ---------------------------------------------------------------------------

codama.update(
  c.bottomUpTransformerVisitor([
    {
      select: (node) =>
        c.isNode(node, "structFieldTypeNode") && node.name === "merkleRoot",
      transform: (node) => ({
        ...node,
        type: c.fixedSizeTypeNode(c.bytesTypeNode(), 32),
      }),
    },
  ])
);

// ---------------------------------------------------------------------------
// Default account value helpers (kinobi's `defaultsToXxx`).
// ---------------------------------------------------------------------------

const pk = (address) => c.publicKeyValueNode(address);
const account = (name) => c.accountValueNode(name);

const ataPda = (mint = "mint", owner = "owner") =>
  c.pdaValueNode("associatedToken", [
    c.pdaSeedValueNode("mint", account(mint)),
    c.pdaSeedValueNode("owner", account(owner)),
  ]);
const sellerHistoryPda = (seller = "seller") =>
  c.pdaValueNode("sellerHistory", [c.pdaSeedValueNode("seller", account(seller))]);
const addItemRequestPda = (asset = "asset") =>
  c.pdaValueNode("addItemRequest", [c.pdaSeedValueNode("asset", account(asset))]);
const eventAuthorityPda = () => c.pdaValueNode("eventAuthority");
const jellybeanEventAuthorityPda = () =>
  c.pdaValueNode("jellybeanEventAuthority");
const gumballMachineAuthorityPda = (gumballMachine = "gumballMachine") =>
  c.pdaValueNode("gumballMachineAuthority", [
    c.pdaSeedValueNode("gumballMachine", account(gumballMachine)),
  ]);
const globalConfigPda = () => c.pdaValueNode("globalConfig");
const jellybeanMachineAuthorityPda = (jellybeanMachine = "jellybeanMachine") =>
  c.pdaValueNode("jellybeanMachineAuthority", [
    c.pdaSeedValueNode("jellybeanMachine", account(jellybeanMachine)),
  ]);
const jellybeanUnclaimedPrizesPda = (
  jellybeanMachine = "jellybeanMachine",
  buyer = "buyer"
) =>
  c.pdaValueNode("jellybeanUnclaimedPrizes", [
    c.pdaSeedValueNode("jellybeanMachine", account(jellybeanMachine)),
    c.pdaSeedValueNode("buyer", account(buyer)),
  ]);
const gumballGuardPda = (base = "base") =>
  c.pdaValueNode("gumballGuard", [c.pdaSeedValueNode("base", account(base))]);
const metadataPda = (mint = "mint") =>
  c.pdaValueNode("metadata", [c.pdaSeedValueNode("mint", account(mint))]);
const masterEditionPda = (mint = "mint") =>
  c.pdaValueNode("masterEdition", [c.pdaSeedValueNode("mint", account(mint))]);
const tokenRecordPda = (mint = "mint", tokenAccount = "tokenAccount") =>
  c.pdaValueNode("tokenRecord", [
    c.pdaSeedValueNode("mint", account(mint)),
    c.pdaSeedValueNode("token", account(tokenAccount)),
  ]);

const SYSVAR_INSTRUCTIONS = "Sysvar1nstructions1111111111111111111111111";
const SPL_SYSTEM = "11111111111111111111111111111111";

// ---------------------------------------------------------------------------
// Automatically recognize account default values (kinobi
// SetInstructionAccountDefaultValuesVisitor).
// ---------------------------------------------------------------------------

const identity = () => c.identityValueNode();

codama.update(
  c.setInstructionAccountDefaultValuesVisitor([
    { account: "recentSlothashes", ignoreIfOptional: true, defaultValue: pk("SysvarS1otHashes111111111111111111111111111") },
    { account: "gumballMachineAuthority", ignoreIfOptional: true, defaultValue: identity() },
    { account: "machineAuthority", ignoreIfOptional: true, defaultValue: identity() },
    { account: "eventAuthority", ignoreIfOptional: true, defaultValue: eventAuthorityPda() },
    { account: "gumballEventAuthority", ignoreIfOptional: true, defaultValue: eventAuthorityPda() },
    { account: "jellybeanEventAuthority", ignoreIfOptional: true, defaultValue: jellybeanEventAuthorityPda() },
    { account: "program", ignoreIfOptional: true, defaultValue: pk(MALLOW_GUMBALL_ID) },
    { account: "gumballMachineProgram", ignoreIfOptional: true, defaultValue: pk(MALLOW_GUMBALL_ID) },
    { account: "jellybeanMachineProgram", ignoreIfOptional: true, defaultValue: pk(MALLOW_JELLYBEAN_ID) },
    { account: "machineProgram", ignoreIfOptional: true, defaultValue: pk(MALLOW_GUMBALL_ID) },
    { account: "payer", ignoreIfOptional: true, defaultValue: c.payerValueNode() },
    { account: "sellerHistory", ignoreIfOptional: true, defaultValue: sellerHistoryPda() },
    { account: "addItemRequest", ignoreIfOptional: true, defaultValue: addItemRequestPda() },
    { account: "mintAuthority", ignoreIfOptional: true, defaultValue: identity() },
    { account: "authorityPda", ignoreIfOptional: true, defaultValue: gumballMachineAuthorityPda() },
    { account: "gumballMachineAuthorityPda", ignoreIfOptional: true, defaultValue: gumballMachineAuthorityPda() },
    { account: "jellybeanMachineAuthorityPda", ignoreIfOptional: true, defaultValue: jellybeanMachineAuthorityPda() },
    { account: "unclaimedPrizes", ignoreIfOptional: true, defaultValue: jellybeanUnclaimedPrizesPda() },
    { account: "metadata", ignoreIfOptional: true, defaultValue: metadataPda("mint") },
    { account: "edition", ignoreIfOptional: true, defaultValue: masterEditionPda("mint") },
    { account: "tokenAccount", ignoreIfOptional: true, defaultValue: ataPda("mint", "seller") },
    { account: "buyerTokenAccount", ignoreIfOptional: true, defaultValue: ataPda("mint", "buyer") },
    { account: "authorityPdaTokenAccount", ignoreIfOptional: true, defaultValue: ataPda("mint", "authorityPda") },
    { account: "mplCoreProgram", ignoreIfOptional: true, defaultValue: pk("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d") },
    { account: "associatedTokenProgram", ignoreIfOptional: true, defaultValue: pk("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL") },
    { account: "bubblegumProgram", ignoreIfOptional: true, defaultValue: pk("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY") },
    { account: "compressionProgram", ignoreIfOptional: true, defaultValue: pk("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK") },
    { account: "logWrapper", ignoreIfOptional: true, defaultValue: pk("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV") },
  ])
);

// ---------------------------------------------------------------------------
// pNFT conditional-account defaults (kinobi sellerPnftDefault etc.).
// ---------------------------------------------------------------------------

const ifAuthRulesProgram = (defaultValue) =>
  c.conditionalValueNode({
    condition: account("authRulesProgram"),
    ifTrue: defaultValue,
  });
const ifTokenMetadataProgram = (defaultValue) =>
  c.conditionalValueNode({
    condition: account("tokenMetadataProgram"),
    ifTrue: defaultValue,
  });
const ifPaymentMint = (defaultValue) =>
  c.conditionalValueNode({
    condition: account("paymentMint"),
    ifTrue: defaultValue,
  });

const sellerPnftDefault = () => ({
  // authRulesProgram is the pNFT toggle: the IDL gives it an `address`
  // constraint, but codama would then auto-resolve it, wrongly firing the
  // conditional pNFT accounts for regular NFTs. Keep it undefined (as kinobi
  // did) so callers opt into the pNFT path explicitly.
  authRulesProgram: { defaultValue: null },
  instructions: { defaultValue: ifAuthRulesProgram(pk(SYSVAR_INSTRUCTIONS)) },
  sellerTokenRecord: { defaultValue: ifAuthRulesProgram(tokenRecordPda()) },
});
const sellerWithMetadataPnftDefault = () => ({
  ...sellerPnftDefault(),
  metadata: { defaultValue: ifAuthRulesProgram(metadataPda()) },
});
const claimPnftDefault = () => ({
  ...sellerPnftDefault(),
  authorityPdaTokenRecord: {
    defaultValue: ifAuthRulesProgram(
      tokenRecordPda("mint", "authorityPdaTokenAccount")
    ),
  },
  buyerTokenRecord: {
    defaultValue: ifAuthRulesProgram(tokenRecordPda("mint", "buyerTokenAccount")),
  },
});

const ataOnPaymentMint = (owner) => ({
  defaultValue: ifPaymentMint(ataPda("paymentMint", owner)),
});
const paymentAccountsDefault = () => ({
  authorityPdaPaymentAccount: ataOnPaymentMint("authorityPda"),
  authorityPaymentAccount: ataOnPaymentMint("authority"),
  sellerPaymentAccount: ataOnPaymentMint("seller"),
});

// ---------------------------------------------------------------------------
// Update instructions (renames + account defaults).
// ---------------------------------------------------------------------------

codama.update(
  c.updateInstructionsVisitor({
    // --- gumball guard ---
    "gumballGuard.closeMintLimit": {
      accounts: {
        globalConfig: { defaultValue: globalConfigPda() },
        systemProgram: { defaultValue: pk(SPL_SYSTEM) },
      },
    },
    "gumballGuard.closeAllowlistProof": {
      accounts: {
        globalConfig: { defaultValue: globalConfigPda() },
        systemProgram: { defaultValue: pk(SPL_SYSTEM) },
      },
    },
    "gumballGuard.createGlobalConfig": {
      accounts: {
        globalConfig: { defaultValue: globalConfigPda() },
        systemProgram: { defaultValue: pk(SPL_SYSTEM) },
      },
    },
    "gumballGuard.updateGlobalConfig": {
      accounts: { globalConfig: { defaultValue: globalConfigPda() } },
    },
    "gumballGuard.initialize": {
      name: "initializeGumballGuard",
      accounts: { gumballGuard: { defaultValue: gumballGuardPda() } },
    },
    "gumballGuard.draw": {
      arguments: { label: { name: "group" } },
      accounts: {
        gumballGuard: { defaultValue: gumballGuardPda("gumballMachine") },
        buyer: { defaultValue: identity() },
      },
    },
    "gumballGuard.drawJellybean": {
      arguments: { label: { name: "group" } },
      accounts: {
        gumballGuard: { defaultValue: gumballGuardPda("jellybeanMachine") },
        buyer: { defaultValue: identity() },
      },
    },
    "gumballGuard.route": {
      arguments: { label: { name: "group" } },
      accounts: { gumballGuard: { defaultValue: gumballGuardPda("machine") } },
    },
    "gumballGuard.setAuthority": { name: "setGumballGuardAuthority" },
    "gumballGuard.update": { name: "updateGumballGuard" },
    "gumballGuard.withdraw": {
      name: "deleteGumballGuard",
      accounts: {
        authorityPda: { defaultValue: gumballMachineAuthorityPda("machine") },
      },
    },

    // --- mallow gumball ---
    "mallowGumball.initialize": { name: "initializeGumballMachine" },
    "mallowGumball.addNft": {
      accounts: { seller: { defaultValue: identity() }, ...sellerPnftDefault() },
    },
    "mallowGumball.requestAddNft": {
      accounts: {
        seller: { defaultValue: identity() },
        addItemRequest: { defaultValue: addItemRequestPda("mint") },
        ...sellerPnftDefault(),
      },
    },
    "mallowGumball.cancelAddNftRequest": {
      accounts: {
        // No gumball_machine account here, so the machine-seeded PDAs can't be
        // auto-derived — require them as inputs (matches the legacy client).
        authorityPda: { defaultValue: null },
        sellerHistory: { defaultValue: null },
        seller: { defaultValue: identity() },
        tokenAccount: { defaultValue: ataPda("mint", "seller") },
        addItemRequest: { defaultValue: addItemRequestPda("mint") },
        ...sellerWithMetadataPnftDefault(),
      },
    },
    "mallowGumball.removeNft": {
      accounts: {
        authority: { defaultValue: identity() },
        seller: { defaultValue: identity() },
        tokenAccount: { defaultValue: ataPda("mint", "authority") },
        ...sellerWithMetadataPnftDefault(),
      },
    },
    "mallowGumball.addCoreAsset": {
      accounts: { seller: { defaultValue: identity() } },
    },
    "mallowGumball.requestAddCoreAsset": {
      accounts: { seller: { defaultValue: identity() } },
    },
    "mallowGumball.cancelAddCoreAssetRequest": {
      accounts: {
        authorityPda: { defaultValue: null },
        sellerHistory: { defaultValue: null },
        seller: { defaultValue: identity() },
      },
    },
    "mallowGumball.removeCoreAsset": {
      accounts: {
        authority: { defaultValue: identity() },
        seller: { defaultValue: identity() },
      },
    },
    "mallowGumball.addTokens": {
      accounts: { seller: { defaultValue: identity() } },
    },
    "mallowGumball.removeTokens": {
      accounts: {
        authority: { defaultValue: identity() },
        seller: { defaultValue: identity() },
      },
    },
    "mallowGumball.removeTokensSpan": {
      accounts: {
        authority: { defaultValue: identity() },
        seller: { defaultValue: identity() },
      },
    },
    "mallowGumball.draw": {
      name: "drawFromGumballMachine",
      accounts: { buyer: { defaultValue: identity() } },
    },
    "mallowGumball.claimNft": {
      accounts: {
        buyer: { defaultValue: identity() },
        buyerTokenAccount: { defaultValue: ataPda("mint", "buyer") },
        ...claimPnftDefault(),
      },
    },
    "mallowGumball.claimCoreAsset": {
      accounts: { buyer: { defaultValue: identity() } },
    },
    "mallowGumball.claimTokens": {
      accounts: {
        buyer: { defaultValue: identity() },
        buyerTokenAccount: { defaultValue: ataPda("mint", "buyer") },
      },
    },
    "mallowGumball.sellItem": {
      name: "sellItemBack",
      accounts: {
        seller: { defaultValue: identity() },
        sellerPaymentAccount: ataOnPaymentMint("seller"),
        authorityPdaPaymentAccount: ataOnPaymentMint("authorityPda"),
        metadata: { defaultValue: ifTokenMetadataProgram(metadataPda()) },
        edition: { defaultValue: ifTokenMetadataProgram(masterEditionPda()) },
        authorityPdaTokenAccount: {
          defaultValue: ifTokenMetadataProgram(ataPda("mint", "authorityPda")),
        },
        sellerTokenAccount: {
          defaultValue: ifTokenMetadataProgram(ataPda("mint", "seller")),
        },
        buyerTokenAccount: {
          defaultValue: ifTokenMetadataProgram(ataPda("mint", "buyer")),
        },
        ...claimPnftDefault(),
      },
    },
    "mallowGumball.settleNftSale": {
      name: "baseSettleNftSale",
      accounts: {
        buyer: { defaultValue: identity() },
        buyerTokenAccount: { defaultValue: ataPda("mint", "buyer") },
        ...paymentAccountsDefault(),
        ...claimPnftDefault(),
      },
    },
    "mallowGumball.settleCoreAssetSale": {
      name: "baseSettleCoreAssetSale",
      accounts: {
        buyer: { defaultValue: identity() },
        ...paymentAccountsDefault(),
      },
    },
    "mallowGumball.settleTokensSale": {
      accounts: {
        buyer: { defaultValue: identity() },
        buyerTokenAccount: { defaultValue: ataPda("mint", "buyer") },
        ...paymentAccountsDefault(),
      },
    },
    "mallowGumball.settleTokensSaleClaimed": {
      accounts: {
        ...paymentAccountsDefault(),
        sellerTokenAccount: { defaultValue: ataPda("mint", "seller") },
      },
    },
    "mallowGumball.setAuthority": { name: "setGumballMachineAuthority" },
    "mallowGumball.withdraw": { name: "deleteGumballMachine" },
    "mallowGumball.manageBuyBackFunds": {
      accounts: {
        authorityPdaPaymentAccount: ataOnPaymentMint("authorityPda"),
        authorityPaymentAccount: ataOnPaymentMint("authority"),
      },
    },
    "mallowGumball.addCnft": {
      accounts: { seller: { defaultValue: identity() } },
    },
    "mallowGumball.requestAddCnft": {
      accounts: {
        seller: { defaultValue: identity() },
        addItemRequest: { defaultValue: addItemRequestPda("asset") },
      },
    },
    "mallowGumball.cancelAddCnftRequest": {
      accounts: {
        authorityPda: { defaultValue: null },
        sellerHistory: { defaultValue: null },
        seller: { defaultValue: identity() },
        addItemRequest: { defaultValue: addItemRequestPda("asset") },
      },
    },
    "mallowGumball.removeCnft": {
      accounts: {
        authority: { defaultValue: identity() },
        seller: { defaultValue: identity() },
      },
    },
    "mallowGumball.claimCnft": {
      accounts: { buyer: { defaultValue: identity() } },
    },
    "mallowGumball.settleCnftSale": {
      accounts: {
        buyer: { defaultValue: identity() },
        ...paymentAccountsDefault(),
      },
    },
  })
);

// ---------------------------------------------------------------------------
// Struct default values (make optional args optional).
// ---------------------------------------------------------------------------

// `AddItemArgs` is shared across several instructions, so it stays a named type
// (kept as the `args` argument). Make its fields optional.
codama.update(
  c.setStructDefaultValuesVisitor({
    addItemArgs: {
      sellerProofPath: c.noneValueNode(),
      index: c.noneValueNode(),
    },
  })
);

// Flatten single-use `args: XxxArgs` instruction arguments into top-level fields
// (kinobi's FlattenInstructionArgsStructVisitor). Only inlines types used once —
// InitializeArgs, UpdateArgs, RouteArgs, SettleTokensSaleClaimedArgs — leaving
// the shared AddItemArgs/CnftArgs as named `args` arguments.
codama.update(c.unwrapInstructionArgsDefinedTypesVisitor());

// The unwrap above drops the per-field defaults, and the `args` argument for the
// shared AddItemArgs needs a default to be optional. Re-apply both here (this
// runs after the rename above, so `initialize` is now `initializeGumballMachine`).
const emptyAddItemArgs = c.structValueNode([
  c.structFieldValueNode("sellerProofPath", c.noneValueNode()),
  c.structFieldValueNode("index", c.noneValueNode()),
]);
codama.update(
  c.updateInstructionsVisitor({
    "mallowGumball.initializeGumballMachine": {
      arguments: {
        feeConfig: { defaultValue: c.noneValueNode() },
        disablePrimarySplit: { defaultValue: c.booleanValueNode(false) },
        buyBackConfig: { defaultValue: c.noneValueNode() },
        disableRoyalties: { defaultValue: c.booleanValueNode(false) },
      },
    },
    "mallowGumball.updateSettings": {
      arguments: { buyBackConfig: { defaultValue: c.noneValueNode() } },
    },
    "mallowGumball.addNft": {
      arguments: { args: { defaultValue: emptyAddItemArgs } },
    },
    "mallowGumball.addCoreAsset": {
      arguments: { args: { defaultValue: emptyAddItemArgs } },
    },
    "mallowGumball.addTokens": {
      arguments: { args: { defaultValue: emptyAddItemArgs } },
    },
  })
);

// ---------------------------------------------------------------------------
// Number wrappers.
// ---------------------------------------------------------------------------

codama.update(
  c.setNumberWrappersVisitor({
    "startDate.date": { kind: "DateTime" },
    "endDate.date": { kind: "DateTime" },
    "botTax.lamports": { kind: "SolAmount" },
    "solPayment.lamports": { kind: "SolAmount" },
  })
);

// ---------------------------------------------------------------------------
// Render the umi client.
// ---------------------------------------------------------------------------

await codama.accept(
  renderVisitor(jsDir, {
    deleteFolderBeforeRendering: true,
    formatCode: false,
    dependencyMap: {
      mplTokenMetadata: "@metaplex-foundation/mpl-token-metadata",
    },
    // Redirect these PDA links to the hand-written finders in src/hooked.
    linkOverrides: {
      pdas: {
        associatedToken: "mplToolbox",
        metadata: "mplTokenMetadata",
        masterEdition: "mplTokenMetadata",
        tokenRecord: "mplTokenMetadata",
        eventAuthority: "hooked",
        jellybeanEventAuthority: "hooked",
        gumballMachineAuthority: "hooked",
        jellybeanMachineAuthority: "hooked",
        jellybeanUnclaimedPrizes: "hooked",
        // findGumballGuardPda is re-exported by src/hooked (the guard account
        // itself is hand-written there); the internal guard instructions import
        // it from there, matching the legacy client.
        gumballGuard: "hooked",
      },
    },
    // The gumball machine account is variable-size and manually serialized; its
    // codec lives in src/hooked/gumballMachineAccountData.ts.
    customAccountData: [{ name: "gumballMachine", extract: true }],
    // Rendered but not re-exported from the index — public wrappers live in
    // src/ (draw.ts, route.ts, createGumballGuard.ts, updateGumballGuard.ts …).
    // Note: the gumballGuard *account* is also internal (hooked provides it), but
    // it can't go here without also hiding the same-named guard *program* (which
    // plugin.ts needs); it's dropped from the account index in the post-step.
    internalNodes: [
      "initializeGumballGuard",
      "draw",
      "drawJellybean",
      "route",
      "updateGumballGuard",
    ],
  })
);

// The gumball guard account is fully provided by src/hooked (fetch/deserialize/
// serializer + a re-exported findGumballGuardPda). Its file must render, but it
// must NOT be re-exported from the account index or it collides with the hooked
// exports. Codama's `internalNodes` can't target it without also hiding the
// same-named program, so drop just its re-export here.
const accountsIndexPath = path.join(jsDir, "accounts", "index.ts");
writeFileSync(
  accountsIndexPath,
  readFileSync(accountsIndexPath, "utf-8")
    .split("\n")
    .filter((line) => !/from ['"]\.\/gumballGuard['"]/.test(line))
    .join("\n")
);
