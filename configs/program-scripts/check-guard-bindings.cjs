#!/usr/bin/env node
"use strict";

const { createHash } = require("node:crypto");
const { readFileSync, writeFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { parseArgs } = require("node:util");
const requireClient = createRequire(
  resolve(__dirname, "../../clients/umi/package.json"),
);
const { PublicKey, Connection } = requireClient("@solana/web3.js");
const PROGRAMS = {
  gumball: "MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa",
  jellybean: "J3LLYcm8V5hJRzCKENRPW3yGdQ6xU8Nie8jr3mU88eqq",
  guards: "GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF",
};
const NAMES = {
  gumball: "GumballMachine",
  jellybean: "JellybeanMachine",
  guards: "GumballGuard",
};
const discriminator = (name) =>
  createHash("sha256").update(`account:${name}`).digest().subarray(0, 8);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function header(entry, group) {
  assert(
    new PublicKey(entry.pubkey).toBase58() === entry.pubkey,
    "Noncanonical public key",
  );
  assert(
    entry.account.owner === PROGRAMS[group] &&
      entry.account.executable === false,
    `Invalid account owner or executable: ${entry.pubkey}`,
  );
  assert(
    Array.isArray(entry.account.data) && entry.account.data[1] === "base64",
    "Require base64 header data",
  );
  const data = Buffer.from(entry.account.data[0], "base64");
  assert(
    data.length >= 73 &&
      data.subarray(0, 8).equals(discriminator(NAMES[group])),
    `Truncated or invalid ${NAMES[group]}: ${entry.pubkey}`,
  );
  return data;
}

function inspectSnapshot(snapshot) {
  assert(snapshot.commitment === "finalized", "Require finalized inventory");
  assert(
    Object.entries(PROGRAMS).every(
      ([group, program]) => snapshot.programs?.[group] === program,
    ),
    "Wrong inventory programs",
  );
  const guards = new Map();
  const machines = new Set();
  const slots = [];
  for (const group of Object.keys(PROGRAMS)) {
    const slot = snapshot.slots?.[group];
    assert(
      Number.isSafeInteger(slot) && slot >= 0,
      `Missing finalized slot: ${group}`,
    );
    assert(Array.isArray(snapshot[group]), `Missing complete scan: ${group}`);
    slots.push(slot);
  }
  assert(new Set(slots).size === 1, "Inventory scans must share one finalized slot");
  for (const entry of snapshot.guards) {
    assert(!guards.has(entry.pubkey), "Duplicate guard");
    const data = header(entry, "guards");
    const base = new PublicKey(data.subarray(8, 40));
    const [canonical, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("gumball_guard"), base.toBuffer()],
      new PublicKey(PROGRAMS.guards),
    );
    assert(
      canonical.toBase58() === entry.pubkey && bump === data[40],
      `Invalid guard PDA: ${entry.pubkey}`,
    );
    guards.set(entry.pubkey, {
      guard: entry.pubkey,
      base: base.toBase58(),
      machines: [],
    });
  }
  const blockers = [];
  const unwrapped = [];
  const bindings = [];
  for (const group of ["gumball", "jellybean"]) {
    for (const entry of snapshot[group]) {
      assert(!machines.has(entry.pubkey), "Duplicate machine");
      machines.add(entry.pubkey);
      const data = header(entry, group);
      const mintAuthority = new PublicKey(data.subarray(41, 73)).toBase58();
      const guard = guards.get(mintAuthority);
      const binding = {
        program: PROGRAMS[group],
        machine: entry.pubkey,
        mintAuthority,
      };
      if (!guard) {
        unwrapped.push(binding);
        continue;
      }
      guard.machines.push(entry.pubkey);
      bindings.push({ ...binding, base: guard.base });
      if (guard.base !== entry.pubkey)
        blockers.push({ type: "base-mismatch", ...binding, base: guard.base });
    }
  }
  for (const guard of guards.values())
    if (guard.machines.length > 1)
      blockers.push({ type: "shared-guard", ...guard });
  return {
    dryRun: true,
    commitment: "finalized",
    slots: snapshot.slots,
    minimumSlot: Math.min(...slots),
    counts: {
      gumball: snapshot.gumball.length,
      jellybean: snapshot.jellybean.length,
      guards: guards.size,
      wrapped: bindings.length,
    },
    releaseBlocked: blockers.length > 0,
    blockers,
    bindings,
    unwrapped,
    unusedGuards: [...guards.values()].filter(
      (guard) => !guard.machines.length,
    ),
  };
}

async function scanFinalized(connection, minimumSlot = 0, attempts = 5, fullGuards = false) {
  const { base58 } = requireClient("@metaplex-foundation/umi/serializers");
  const groups = Object.keys(PROGRAMS);
  // Only immutable binding fields are needed. Slice before transport so large
  // machine inventories never download their item and proceeds ledgers.
  const scans = await Promise.all(
    groups.map((group) =>
      connection.getProgramAccounts(new PublicKey(PROGRAMS[group]), {
        commitment: "finalized",
        minContextSlot: minimumSlot,
        withContext: true,
        ...(group === "guards" && fullGuards
          ? {}
          : { dataSlice: { offset: 0, length: 73 } }),
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: base58.deserialize(discriminator(NAMES[group]))[0],
            },
          },
        ],
      }),
    ),
  );
  const scanSlots = scans.map((scan) => scan.context.slot);
  assert(scanSlots.every((slot) => slot >= minimumSlot), "Stale scan");
  if (new Set(scanSlots).size !== 1) {
    assert(attempts > 1, "Could not obtain one finalized slot for all scans");
    return scanFinalized(connection, Math.max(...scanSlots), attempts - 1, fullGuards);
  }
  const snapshot = { programs: PROGRAMS, commitment: "finalized", slots: {} };
  for (let i = 0; i < groups.length; i += 1) {
    const group = groups[i];
    snapshot.slots[group] = scans[i].context.slot;
    assert(snapshot.slots[group] >= minimumSlot, `Stale scan: ${group}`);
    snapshot[group] = scans[i].value.map(({ pubkey, account }) => ({
      pubkey: pubkey.toBase58(),
      account: {
        owner: account.owner.toBase58(),
        executable: account.executable,
        data: [account.data.toString("base64"), "base64"],
      },
    }));
  }
  return snapshot;
}

async function main() {
  const { values } = parseArgs({
    options: {
      rpc: { type: "string" },
      snapshot: { type: "string" },
      "write-snapshot": { type: "string" },
      "min-context-slot": { type: "string", default: "0" },
      "dry-run": { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      "Read-only release gate (always dry run): check-guard-bindings.cjs --rpc URL [--write-snapshot FILE] [--min-context-slot SLOT]\nOffline verification: --snapshot FILE\nExit 1 blocks release on a mismatched base, shared guard, invalid account or incomplete scan. No signing or transaction submission is supported.",
    );
    return;
  }
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
    : await scanFinalized(new Connection(values.rpc, "finalized"), minimumSlot);
  const result = inspectSnapshot(snapshot);
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

module.exports = { PROGRAMS, discriminator, inspectSnapshot, scanFinalized };
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
