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
const {
  PublicKey,
  Connection,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} = requireClient("@solana/web3.js");
const PROGRAM = "MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa";
const GUARD = "GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF";
const discriminator = (name) =>
  createHash("sha256").update(`account:${name}`).digest().subarray(0, 8);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const bytes = (entry, name) => {
  assert(entry.account.owner === PROGRAM, `Wrong owner: ${entry.pubkey}`);
  assert(
    entry.account.executable === false,
    `Executable account: ${entry.pubkey}`,
  );
  assert(
    entry.account.data[1] === "base64",
    "Snapshot must contain full base64 account data",
  );
  const data = Buffer.from(entry.account.data[0], "base64");
  assert(
    data.subarray(0, 8).equals(discriminator(name)),
    `Wrong discriminator: ${entry.pubkey}`,
  );
  return data;
};

function machineHeader(entry) {
  const data = bytes(entry, "GumballMachine");
  assert(data.length >= 419, `Truncated machine: ${entry.pubkey}`);
  let cursor = 73;
  const option = () => {
    const tag = data[cursor++];
    assert(tag === 0 || tag === 1, `Invalid option: ${entry.pubkey}`);
    return tag;
  };
  if (option()) cursor += 34;
  cursor += 24;
  assert(data[cursor++] <= 3, `Invalid state: ${entry.pubkey}`);
  const uriLength = data.readUInt32LE(cursor);
  cursor += 4 + uriLength;
  cursor += 8 + 2;
  if (option()) cursor += 32;
  cursor += 2 + 1 + 32;
  assert(cursor <= 410, `Settings overlap migration bytes: ${entry.pubkey}`);
  assert(
    data[410] === 0 || data[410] === 1,
    `Invalid migration marker: ${entry.pubkey}`,
  );
  return {
    key: entry.pubkey,
    migrated: data[410] === 1,
    count: data.readBigUInt64LE(411),
    settingsEnd: cursor,
    reservedZero: data.subarray(410, 419).every((b) => b === 0),
  };
}

function inspectSnapshot(snapshot, { preUpgrade = false } = {}) {
  assert(
    snapshot.program === PROGRAM && snapshot.commitment === "finalized",
    "Require a finalized gumball snapshot",
  );
  assert(
    Number.isSafeInteger(snapshot.slot) && snapshot.slot >= 0,
    "Invalid snapshot slot",
  );
  assert(
    Array.isArray(snapshot.legacy105),
    "Snapshot must include the dataSize 105 scan",
  );
  const machines = new Map();
  for (const entry of snapshot.machines) {
    assert(!machines.has(entry.pubkey), "Duplicate machine in snapshot");
    const header = machineHeader(entry);
    if (preUpgrade)
      assert(
        header.reservedZero,
        `Release blocker: pre-upgrade header bytes 410..418 are nonzero: ${entry.pubkey}`,
      );
    machines.set(entry.pubkey, {
      ...header,
      tracked: [],
      untracked: [],
      rejected: [],
    });
  }
  const keys = new Set();
  const actual105 = new Set();
  const closedMachineRequests = [];
  for (const entry of snapshot.requests) {
    assert(!keys.has(entry.pubkey), "Duplicate request in snapshot");
    keys.add(entry.pubkey);
    const data = bytes(entry, "AddItemRequest");
    assert(data.length >= 105, `Truncated request: ${entry.pubkey}`);
    const machine = new PublicKey(data.subarray(8, 40)).toBase58();
    const asset = data.subarray(72, 104);
    const [canonical] = PublicKey.findProgramAddressSync(
      [Buffer.from("add_item_request"), asset],
      new PublicKey(PROGRAM),
    );
    assert(
      canonical.toBase58() === entry.pubkey,
      `Noncanonical request PDA: ${entry.pubkey}`,
    );
    const marker = data[106] ?? 0;
    assert(marker <= 2, `Invalid request marker: ${entry.pubkey}`);
    if (data.length === 105) actual105.add(entry.pubkey);
    const group = machines.get(machine);
    if (!group) {
      closedMachineRequests.push(entry.pubkey);
      continue;
    }
    group[
      marker === 1 ? "tracked" : marker === 2 ? "rejected" : "untracked"
    ].push(entry.pubkey);
  }
  const legacy = new Set(snapshot.legacy105);
  assert(
    legacy.size === snapshot.legacy105.length &&
      legacy.size === actual105.size &&
      [...legacy].every((key) => actual105.has(key)),
    "dataSize 105 scan disagrees with complete request scan; take a new finalized snapshot",
  );
  for (const group of machines.values()) {
    assert(
      group.count === BigInt(group.tracked.length),
      `Count mismatch: ${group.key}: header=${group.count}, tracked=${group.tracked.length}`,
    );
    assert(
      !(group.migrated && group.untracked.length),
      `Release blocker: reconciled machine has untracked requests: ${group.key}`,
    );
  }
  return { machines, closedMachineRequests };
}

function plan(snapshot, options = {}) {
  const { machines, closedMachineRequests } = inspectSnapshot(
    snapshot,
    options,
  );
  const batchSize = options.batchSize ?? 8;
  assert(
    Number.isInteger(batchSize) && batchSize >= 1 && batchSize <= 16,
    "batch-size must be between 1 and 16",
  );
  const transactions = [];
  for (const machine of machines.values()) {
    if (machine.migrated) continue;
    for (let i = 0; i < machine.untracked.length; i += batchSize)
      transactions.push({
        machine: machine.key,
        requests: machine.untracked.slice(i, i + batchSize),
        complete: false,
      });
    transactions.push({ machine: machine.key, requests: [], complete: true });
  }
  return {
    slot: snapshot.slot,
    liveMachines: machines.size,
    alreadyReconciled: [...machines.values()].filter((m) => m.migrated).length,
    closedMachineRequests,
    transactions,
  };
}

async function reconcile({
  snapshot,
  scan,
  sendBatch,
  batchSize = 8,
  execute = false,
}) {
  const initial = plan(snapshot, { batchSize });
  if (!execute) return initial;
  let minimumSlot = snapshot.slot;
  // A fresh scan includes machines that appeared since the archived snapshot.
  let latest = await scan(minimumSlot);
  assert(latest.slot >= minimumSlot, "Stale finalized scan");
  let state = inspectSnapshot(latest);
  for (const key of state.machines.keys()) {
    for (;;) {
      const machine = state.machines.get(key);
      if (!machine || machine.migrated) break;
      if (machine.untracked.length) {
        const confirmedSlot = await sendBatch({
          machine: key,
          requests: machine.untracked.slice(0, batchSize),
          complete: false,
        });
        assert(
          Number.isSafeInteger(confirmedSlot) && confirmedSlot >= minimumSlot,
          "Batch must be finalized before re-scan",
        );
        minimumSlot = confirmedSlot;
      } else {
        // The latest complete finalized scan proves every live request is
        // marked and its count agrees before marketplace attestation.
        const confirmedSlot = await sendBatch({
          machine: key,
          requests: [],
          complete: true,
        });
        assert(
          Number.isSafeInteger(confirmedSlot) && confirmedSlot >= minimumSlot,
          "Completion must be finalized before re-scan",
        );
        minimumSlot = confirmedSlot;
      }
      latest = await scan(minimumSlot);
      assert(latest.slot >= minimumSlot, "Stale finalized scan");
      state = inspectSnapshot(latest);
    }
  }
  const final = await scan(minimumSlot);
  assert(final.slot >= minimumSlot, "Stale finalized scan");
  const result = plan(final, { batchSize });
  assert(
    result.transactions.length === 0,
    "New unreconciled machines appeared; re-run before readiness",
  );
  return result;
}

async function scanFinalized(connection, minimumSlot = 0) {
  const bs58 = requireClient("@metaplex-foundation/umi/serializers").base58;
  const get = async (name, extra = []) =>
    connection.getProgramAccounts(new PublicKey(PROGRAM), {
      commitment: "finalized",
      minContextSlot: minimumSlot,
      withContext: true,
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.deserialize(discriminator(name))[0],
          },
        },
        ...extra,
      ],
    });
  const [machines, requests, legacy] = await Promise.all([
    get("GumballMachine"),
    get("AddItemRequest"),
    get("AddItemRequest", [{ dataSize: 105 }]),
  ]);
  const encode = ({ pubkey, account }) => ({
    pubkey: pubkey.toBase58(),
    account: {
      ...account,
      owner: account.owner.toBase58(),
      data: [account.data.toString("base64"), "base64"],
    },
  });
  return {
    program: PROGRAM,
    commitment: "finalized",
    slot: Math.min(
      machines.context.slot,
      requests.context.slot,
      legacy.context.slot,
    ),
    machines: machines.value.map(encode),
    requests: requests.value.map(encode),
    legacy105: legacy.value.map((e) => e.pubkey.toBase58()),
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      rpc: { type: "string" },
      snapshot: { type: "string" },
      "write-snapshot": { type: "string" },
      "pre-upgrade": { type: "boolean" },
      execute: { type: "boolean" },
      "signer-module": { type: "string" },
      "batch-size": { type: "string", default: "8" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      "Dry run (default): reconcile-add-item-requests.cjs --snapshot FILE [--pre-upgrade]\nRead-only finalized snapshot: --rpc URL --write-snapshot FILE --pre-upgrade\nExecute after upgrade: --rpc URL --snapshot PRE_UPGRADE_FILE --execute --signer-module FILE\nSigner module exports authority, payer (public keys), and async sendAndConfirm({connection, transaction, summary}) -> signature. It must obtain operator wallet approval and sign/send the supplied transaction; secrets never enter this script.",
    );
    return;
  }
  assert(values.snapshot || values.rpc, "Provide --snapshot or --rpc");
  assert(
    !values.execute ||
      (values.rpc &&
        values.snapshot &&
        values["signer-module"] &&
        !values["pre-upgrade"]),
    "Execute requires RPC, a verified pre-upgrade snapshot and operator signer module; cannot execute pre-upgrade",
  );
  const connection = values.rpc
    ? new Connection(values.rpc, "finalized")
    : undefined;
  const snapshot = values.snapshot
    ? JSON.parse(readFileSync(values.snapshot, "utf8"))
    : await scanFinalized(connection);
  if (values.execute || values["pre-upgrade"])
    inspectSnapshot(snapshot, { preUpgrade: true });
  if (values["write-snapshot"])
    writeFileSync(
      values["write-snapshot"],
      `${JSON.stringify(snapshot, null, 2)}\n`,
      { flag: "wx" },
    );
  const batchSize = Number(values["batch-size"]);
  if (!values.execute) {
    console.log(
      JSON.stringify(
        plan(snapshot, { batchSize, preUpgrade: values["pre-upgrade"] }),
        null,
        2,
      ),
    );
    return;
  }
  const signer = require(resolve(values["signer-module"]));
  assert(
    typeof signer.sendAndConfirm === "function",
    "Signer module missing sendAndConfirm",
  );
  const authority = new PublicKey(signer.authority);
  const payer = new PublicKey(signer.payer);
  const [globalConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_config")],
    new PublicKey(GUARD),
  );
  const config = await connection.getAccountInfo(globalConfig, "finalized");
  assert(
    config &&
      config.owner.equals(new PublicKey(GUARD)) &&
      config.data.subarray(0, 8).equals(discriminator("GlobalConfig")) &&
      config.data.length >= 72,
    "Invalid canonical GlobalConfig",
  );
  assert(
    new PublicKey(config.data.subarray(40, 72)).equals(authority),
    "Signer must be the marketplace account_fee_authority",
  );
  const { getMigrateAddItemRequestsInstructionDataSerializer } = require(
    resolve(__dirname, "../../clients/umi/dist/src/index.js"),
  );
  const scan = (slot) => scanFinalized(connection, slot);
  const sendBatch = async (batch) => {
    const latest = await connection.getLatestBlockhash("finalized");
    const instruction = new TransactionInstruction({
      programId: new PublicKey(PROGRAM),
      keys: [
        {
          pubkey: new PublicKey(batch.machine),
          isSigner: false,
          isWritable: true,
        },
        { pubkey: authority, isSigner: true, isWritable: false },
        { pubkey: globalConfig, isSigner: false, isWritable: false },
        { pubkey: payer, isSigner: true, isWritable: true },
        {
          pubkey: new PublicKey("11111111111111111111111111111111"),
          isSigner: false,
          isWritable: false,
        },
        ...batch.requests.map((key) => ({
          pubkey: new PublicKey(key),
          isSigner: false,
          isWritable: true,
        })),
      ],
      data: Buffer.from(
        getMigrateAddItemRequestsInstructionDataSerializer().serialize({
          complete: batch.complete,
        }),
      ),
    });
    const transaction = new VersionedTransaction(
      new TransactionMessage({
        payerKey: payer,
        recentBlockhash: latest.blockhash,
        instructions: [instruction],
      }).compileToV0Message(),
    );
    assert(
      transaction.serialize().length <= 1232,
      "Batch exceeds packet budget; reduce --batch-size",
    );
    const simulation = await connection.simulateTransaction(transaction, {
      commitment: "finalized",
      sigVerify: false,
    });
    assert(
      !simulation.value.err,
      `Migration simulation failed: ${JSON.stringify(simulation.value.err)}`,
    );
    const summary = {
      ...batch,
      clusterGenesisHash: await connection.getGenesisHash(),
      payer: payer.toBase58(),
      authority: authority.toBase58(),
      computeUnits: simulation.value.unitsConsumed,
      serializedBytes: transaction.serialize().length,
    };
    console.log(JSON.stringify(summary));
    const signature = await signer.sendAndConfirm({
      connection,
      transaction,
      summary,
    });
    const confirmation = await connection.confirmTransaction(
      { ...latest, signature },
      "finalized",
    );
    assert(!confirmation.value.err, `Batch failed: ${signature}`);
    return confirmation.context.slot;
  };
  console.log(
    JSON.stringify(
      await reconcile({ snapshot, scan, sendBatch, batchSize, execute: true }),
      null,
      2,
    ),
  );
}

module.exports = {
  PROGRAM,
  discriminator,
  machineHeader,
  inspectSnapshot,
  plan,
  reconcile,
  scanFinalized,
};
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
