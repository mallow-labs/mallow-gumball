#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { readFileSync, writeFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { parseArgs } = require("node:util");
const {
  PROGRAMS,
  inspectSnapshot,
  scanFinalized,
} = require("./check-guard-bindings.cjs");
const requireClient = createRequire(
  resolve(__dirname, "../../clients/umi/package.json"),
);
const { PublicKey, Connection } = requireClient("@solana/web3.js");
const TOKEN2022 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ATA = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
function expectedAta(machine, mint) {
  const [escrow] = PublicKey.findProgramAddressSync(
    [Buffer.from("gumball_machine"), new PublicKey(machine).toBuffer()],
    new PublicKey(PROGRAMS.gumball),
  );
  return PublicKey.findProgramAddressSync(
    [escrow.toBuffer(), TOKEN2022.toBuffer(), new PublicKey(mint).toBuffer()],
    ATA,
  )[0].toBase58();
}
function decodeGuardSets(data) {
  // Built from the documented client generator, including all variable guards.
  const client = requireClient(
    resolve(__dirname, "../../clients/umi/dist/src/index.js"),
  );
  const { createUmi, isSome } = requireClient("@metaplex-foundation/umi");
  const { testPlugins } = requireClient(
    "@metaplex-foundation/umi-bundle-tests",
  );
  const context = createUmi().use(testPlugins()).use(client.mallowGumball());
  const [guardData] = client
    .getGumballGuardDataSerializer(
      context,
      context.programs.get("gumballGuard"),
    )
    .deserialize(data, 73);
  return [
    { label: "default", guards: guardData.guards },
    ...guardData.groups,
  ].flatMap(({ label, guards }) =>
    isSome(guards.token2022Payment)
      ? [{ label, ...guards.token2022Payment.value }]
      : [],
  );
}
function inspectToken2022(snapshot, decode = decodeGuardSets) {
  const binding = inspectSnapshot(snapshot);
  const byGuard = new Map(
    snapshot.guards.map((entry) => [entry.pubkey, entry]),
  );
  const checked = [];
  const blockers = [...binding.blockers];
  for (const match of binding.bindings.filter(
    (b) => b.program === PROGRAMS.gumball,
  )) {
    const data = Buffer.from(
      byGuard.get(match.mintAuthority).account.data[0],
      "base64",
    );
    assert(data.length >= 85, "Full guard data required for payment audit");
    for (const payment of decode(data)) {
      const expected = expectedAta(match.machine, payment.mint);
      const row = {
        ...match,
        group: payment.label,
        mint: payment.mint,
        destinationAta: payment.destinationAta,
        expectedAta: expected,
      };
      checked.push(row);
      if (payment.destinationAta !== expected)
        blockers.push({ type: "non-escrow-token2022-destination", ...row });
    }
  }
  return {
    ...binding,
    paymentDestinationsChecked: true,
    token2022Payments: checked,
    blockers,
    releaseBlocked: blockers.length > 0,
  };
}
async function main() {
  const { values } = parseArgs({
    options: {
      rpc: { type: "string" },
      snapshot: { type: "string" },
      "write-snapshot": { type: "string" },
      "min-context-slot": { type: "string", default: "0" },
      "dry-run": { type: "boolean" },
    },
  });
  assert(
    Boolean(values.rpc) !== Boolean(values.snapshot),
    "Provide exactly one of --rpc or --snapshot",
  );
  const minimumSlot = Number(values["min-context-slot"]);
  assert(
    Number.isSafeInteger(minimumSlot) && minimumSlot >= 0,
    "Invalid minimum context slot",
  );
  const snapshot = values.snapshot
    ? JSON.parse(readFileSync(values.snapshot, "utf8"))
    : await scanFinalized(
        new Connection(values.rpc, "finalized"),
        minimumSlot,
        5,
        true,
      );
  const result = inspectToken2022(snapshot);
  assert(result.minimumSlot >= minimumSlot, "Stale inventory");
  if (values["write-snapshot"])
    writeFileSync(
      values["write-snapshot"],
      `${JSON.stringify(snapshot, null, 2)}\n`,
      { flag: "wx" },
    );
  console.log(JSON.stringify(result, null, 2));
  if (result.releaseBlocked) process.exitCode = 1;
}
module.exports = { expectedAta, decodeGuardSets, inspectToken2022 };
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
