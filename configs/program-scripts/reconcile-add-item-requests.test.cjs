"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { randomBytes } = require("node:crypto");
const {
  PROGRAM,
  discriminator,
  inspectSnapshot,
  plan,
  reconcile,
  scanFinalized,
} = require("./reconcile-add-item-requests.cjs");
const { PublicKey } = createRequire(
  resolve(__dirname, "../../clients/umi/package.json"),
)("@solana/web3.js");
const key = () => new PublicKey(randomBytes(32)).toBase58();
const entry = (pubkey, data) => ({
  pubkey,
  account: {
    owner: PROGRAM,
    executable: false,
    data: [data.toString("base64"), "base64"],
  },
});
const read = (e) => Buffer.from(e.account.data[0], "base64");
const store = (e, data) => {
  e.account.data[0] = data.toString("base64");
};
const fixture = (count = 3) => {
  const machine = key();
  const header = Buffer.concat([
    discriminator("GumballMachine"),
    Buffer.from([5]),
    randomBytes(32),
    randomBytes(32),
    Buffer.from([0]),
    Buffer.alloc(24),
    Buffer.from([0]),
    Buffer.alloc(4),
    Buffer.alloc(8),
    Buffer.alloc(2),
    Buffer.from([0]),
    Buffer.alloc(2),
    Buffer.from([0]),
    randomBytes(32),
  ]);
  const data = Buffer.alloc(419);
  header.copy(data);
  const requests = Array.from({ length: count }, (_, i) => {
    const asset = randomBytes(32);
    const request = PublicKey.findProgramAddressSync(
      [Buffer.from("add_item_request"), asset],
      new PublicKey(PROGRAM),
    )[0].toBase58();
    // Include 105-byte v1, 106-byte v2, and a larger marker-zero request.
    const body = Buffer.alloc(105 + (i % 3));
    discriminator("AddItemRequest").copy(body);
    new PublicKey(machine).toBuffer().copy(body, 8);
    randomBytes(32).copy(body, 40);
    asset.copy(body, 72);
    if (body.length > 105) body[105] = 2;
    return entry(request, body);
  });
  return {
    program: PROGRAM,
    commitment: "finalized",
    slot: 10,
    machines: [entry(machine, data)],
    requests,
    legacy105: requests
      .filter((e) => read(e).length === 105)
      .map((e) => e.pubkey),
  };
};

test("dry-run plans all untracked account sizes, bounded batches, then completion; never sends", async () => {
  const snapshot = fixture(3);
  const output = await reconcile({
    snapshot,
    batchSize: 2,
    scan: () => {
      throw Error("scan called");
    },
    sendBatch: () => {
      throw Error("send called");
    },
  });
  assert.deepEqual(
    output.transactions.map((t) => [t.requests.length, t.complete]),
    [
      [2, false],
      [1, false],
      [0, true],
    ],
  );
  assert.equal(
    inspectSnapshot(snapshot, { preUpgrade: true }).machines.size,
    1,
  );
});

test("finalized confirmed batches are rescanned before completion; rerun is idempotent", async () => {
  const snapshot = fixture(3);
  const current = structuredClone(snapshot);
  const events = [];
  const scan = async (slot) => {
    assert.ok(current.slot >= slot);
    events.push("scan");
    return structuredClone(current);
  };
  const sendBatch = async (batch) => {
    events.push(batch.complete ? "complete" : "batch");
    const data = read(current.machines[0]);
    if (batch.complete) {
      assert.ok(current.requests.every((e) => read(e)[106] === 1));
      data[410] = 1;
    } else
      for (const request of batch.requests) {
        const e = current.requests.find((r) => r.pubkey === request);
        const tracked = Buffer.alloc(107);
        read(e).copy(tracked);
        tracked[106] = 1;
        store(e, tracked);
        data.writeBigUInt64LE(data.readBigUInt64LE(411) + 1n, 411);
      }
    store(current.machines[0], data);
    current.legacy105 = current.requests
      .filter((e) => read(e).length === 105)
      .map((e) => e.pubkey);
    current.slot++;
    return current.slot;
  };
  const result = await reconcile({
    snapshot,
    scan,
    sendBatch,
    batchSize: 2,
    execute: true,
  });
  assert.deepEqual(events, [
    "scan",
    "batch",
    "scan",
    "batch",
    "scan",
    "complete",
    "scan",
    "scan",
  ]);
  assert.deepEqual(result.transactions, []);
  await reconcile({
    snapshot,
    scan,
    sendBatch: () => {
      throw Error("repeat send");
    },
    execute: true,
  });
});

test("resumes partial migration without recounting tracked or rejected requests", () => {
  const snapshot = fixture(3);
  for (const [index, marker] of [
    [0, 1],
    [1, 2],
  ]) {
    const data = Buffer.alloc(107);
    read(snapshot.requests[index]).copy(data);
    data[106] = marker;
    store(snapshot.requests[index], data);
  }
  const data = read(snapshot.machines[0]);
  data.writeBigUInt64LE(1n, 411);
  store(snapshot.machines[0], data);
  snapshot.legacy105 = [];
  assert.equal(plan(snapshot).transactions[0].requests.length, 1);
  assert.equal(
    inspectSnapshot(snapshot).machines.values().next().value.rejected.length,
    1,
  );
});

test("pre-upgrade nonzero reserved bytes and reconciled untracked requests block release", () => {
  const snapshot = fixture(1);
  const data = read(snapshot.machines[0]);
  data[410] = 1;
  store(snapshot.machines[0], data);
  assert.throws(
    () => inspectSnapshot(snapshot, { preUpgrade: true }),
    /nonzero/,
  );
  assert.throws(() => plan(snapshot), /reconciled machine has untracked/);
});

test("settings may not overlap byte 410", () => {
  const snapshot = fixture(0);
  const data = read(snapshot.machines[0]);
  data.writeUInt32LE(300, 99);
  store(snapshot.machines[0], data);
  assert.throws(() => inspectSnapshot(snapshot), /overlap/);
});

test("count mismatch and incomplete legacy scan prevent completion", () => {
  const snapshot = fixture(1);
  snapshot.legacy105 = [];
  assert.throws(() => plan(snapshot), /dataSize 105/);
  snapshot.legacy105 = [snapshot.requests[0].pubkey];
  const data = read(snapshot.machines[0]);
  data.writeBigUInt64LE(1n, 411);
  store(snapshot.machines[0], data);
  assert.throws(() => plan(snapshot), /Count mismatch/);
});

test("snapshot owner, discriminator, canonical PDA and finalized commitment are mandatory", () => {
  for (const change of [
    (s) => {
      s.commitment = "confirmed";
    },
    (s) => {
      s.requests[0].account.owner = key();
    },
    (s) => {
      const data = read(s.requests[0]);
      data[0] ^= 1;
      store(s.requests[0], data);
    },
    (s) => {
      s.requests[0].pubkey = key();
    },
  ]) {
    const s = fixture(1);
    change(s);
    assert.throws(() => plan(s));
  }
});

test("closed-machine requests remain cancellable; empty live machines receive completion", () => {
  const snapshot = fixture(1);
  snapshot.machines = [];
  assert.deepEqual(plan(snapshot).closedMachineRequests, [
    snapshot.requests[0].pubkey,
  ]);
  assert.deepEqual(plan(snapshot).transactions, []);
  assert.equal(plan(fixture(0)).transactions[0].complete, true);
});

test("failed batch stops before attestation", async () => {
  const snapshot = fixture(1);
  await assert.rejects(
    reconcile({
      snapshot,
      scan: async () => snapshot,
      sendBatch: async (b) => {
        assert.equal(b.complete, false);
        throw Error("failed confirmation");
      },
      execute: true,
    }),
    /failed confirmation/,
  );
});

test("RPC snapshot includes full finalized machine/request scans and dataSize 105, with minimum slot", async () => {
  const calls = [];
  const connection = {
    getProgramAccounts: async (program, options) => {
      assert.equal(program.toBase58(), PROGRAM);
      calls.push(options);
      return { context: { slot: 100 + calls.length }, value: [] };
    },
  };
  const snapshot = await scanFinalized(connection, 90);
  assert.equal(snapshot.slot, 101);
  assert.equal(calls.length, 3);
  assert.ok(
    calls.every(
      (c) =>
        c.commitment === "finalized" &&
        c.minContextSlot === 90 &&
        c.withContext,
    ),
  );
  assert.equal(calls[2].filters[1].dataSize, 105);
  assert.ok(calls.every((c) => typeof c.filters[0].memcmp.bytes === "string"));
});
