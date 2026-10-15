"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const {
  PROGRAMS,
  discriminator,
  inspectSnapshot,
  scanFinalized,
} = require("./check-guard-bindings.cjs");
const { PublicKey } = createRequire(
  resolve(__dirname, "../../clients/umi/package.json"),
)("@solana/web3.js");
const key = () => new PublicKey(randomBytes(32));
const entry = (pubkey, data, owner) => ({
  pubkey: pubkey.toBase58(),
  account: {
    owner,
    executable: false,
    data: [data.toString("base64"), "base64"],
  },
});
const fixture = () => {
  const snapshot = {
    programs: PROGRAMS,
    commitment: "finalized",
    slots: { gumball: 12, jellybean: 12, guards: 12 },
    gumball: [],
    jellybean: [],
    guards: [],
  };
  for (const group of ["gumball", "jellybean"]) {
    const machine = key();
    const [guard, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("gumball_guard"), machine.toBuffer()],
      new PublicKey(PROGRAMS.guards),
    );
    const m = Buffer.alloc(73);
    discriminator(
      group === "gumball" ? "GumballMachine" : "JellybeanMachine",
    ).copy(m);
    m[8] = 5;
    key().toBuffer().copy(m, 9);
    guard.toBuffer().copy(m, 41);
    const g = Buffer.alloc(73);
    discriminator("GumballGuard").copy(g);
    machine.toBuffer().copy(g, 8);
    g[40] = bump;
    key().toBuffer().copy(g, 41);
    snapshot[group].push(entry(machine, m, PROGRAMS[group]));
    snapshot.guards.push(entry(guard, g, PROGRAMS.guards));
  }
  return snapshot;
};
const setAuthority = (machine, guard) => {
  const data = Buffer.from(machine.account.data[0], "base64");
  new PublicKey(guard).toBuffer().copy(data, 41);
  machine.account.data[0] = data.toString("base64");
};

test("matching gumball and jellybean bases pass the release gate", () => {
  const result = inspectSnapshot(fixture());
  assert.equal(result.releaseBlocked, false);
  assert.equal(result.dryRun, true);
  assert.deepEqual(result.counts, {
    gumball: 1,
    jellybean: 1,
    guards: 2,
    wrapped: 2,
  });
});
for (const group of ["gumball", "jellybean"])
  test(`${group} with a different guard base blocks release`, () => {
    const f = fixture();
    setAuthority(f[group][0], f.guards[group === "gumball" ? 1 : 0].pubkey);
    const result = inspectSnapshot(f);
    assert.equal(result.releaseBlocked, true);
    assert(result.blockers.some((b) => b.type === "base-mismatch"));
  });
test("a guard shared across machine programs blocks release", () => {
  const f = fixture();
  setAuthority(f.jellybean[0], f.guards[0].pubkey);
  assert(
    inspectSnapshot(f).blockers.some(
      (b) => b.type === "shared-guard" && b.machines.length === 2,
    ),
  );
});
test("solo authorities and unused guards are reported", () => {
  const f = fixture();
  setAuthority(f.gumball[0], key().toBase58());
  const result = inspectSnapshot(f);
  assert.equal(result.releaseBlocked, false);
  assert.equal(result.unwrapped.length, 1);
  assert.equal(result.unusedGuards.length, 1);
});
test("invalid owner, executable, truncated header and discriminator fail closed", () => {
  for (const edit of [
    (e) => {
      e.account.owner = PROGRAMS.jellybean;
    },
    (e) => {
      e.account.executable = true;
    },
    (e) => {
      e.account.data[0] = Buffer.alloc(72).toString("base64");
    },
    (e) => {
      e.account.data[0] = Buffer.alloc(73).toString("base64");
    },
  ]) {
    const f = fixture();
    edit(f.gumball[0]);
    assert.throws(() => inspectSnapshot(f));
  }
});
test("noncanonical guards fail closed", () => {
  const f = fixture();
  f.guards[0].pubkey = key().toBase58();
  assert.throws(() => inspectSnapshot(f), /Invalid guard PDA/);
});
test("missing scans, duplicate accounts and non-finalized inventories fail closed", () => {
  const missing = fixture();
  delete missing.jellybean;
  assert.throws(() => inspectSnapshot(missing));
  const duplicate = fixture();
  duplicate.gumball.push(duplicate.gumball[0]);
  assert.throws(() => inspectSnapshot(duplicate), /Duplicate/);
  const old = fixture();
  old.commitment = "confirmed";
  assert.throws(() => inspectSnapshot(old), /finalized/);
});
test("RPC scans all three programs with finalized header slices and no write methods", async () => {
  const f = fixture();
  const calls = [];
  const connection = {
    async getProgramAccounts(program, options) {
      calls.push({ program, options });
      const group = Object.keys(PROGRAMS).find(
        (g) => PROGRAMS[g] === program.toBase58(),
      );
      return {
        context: { slot: 20 },
        value: f[group].map((e) => ({
          pubkey: new PublicKey(e.pubkey),
          account: {
            owner: new PublicKey(e.account.owner),
            executable: false,
            data: Buffer.from(e.account.data[0], "base64"),
          },
        })),
      };
    },
  };
  const snapshot = await scanFinalized(connection, 15);
  assert.equal(inspectSnapshot(snapshot).releaseBlocked, false);
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.options.commitment, "finalized");
    assert.equal(call.options.minContextSlot, 15);
    assert.equal(call.options.withContext, true);
    assert.deepEqual(call.options.dataSlice, { offset: 0, length: 73 });
    assert.equal(call.options.filters[0].memcmp.offset, 0);
  }
  await assert.rejects(scanFinalized(connection, 21), /Stale scan/);
});
test("offline CLI exits nonzero on blockers and refuses execution flags", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "guard-bindings-"));
  try {
    const path = resolve(dir, "inventory.json");
    const cli = resolve(__dirname, "check-guard-bindings.cjs");
    const f = fixture();
    writeFileSync(path, JSON.stringify(f));
    const pass = spawnSync(process.execPath, [cli, "--snapshot", path], {
      encoding: "utf8",
    });
    assert.equal(pass.status, 0);
    assert.equal(JSON.parse(pass.stdout).dryRun, true);
    setAuthority(f.jellybean[0], f.guards[0].pubkey);
    writeFileSync(path, JSON.stringify(f));
    const fail = spawnSync(process.execPath, [cli, "--snapshot", path], {
      encoding: "utf8",
    });
    assert.equal(fail.status, 1);
    assert.equal(JSON.parse(fail.stdout).releaseBlocked, true);
    assert.equal(
      spawnSync(process.execPath, [cli, "--snapshot", path, "--execute"])
        .status,
      1,
    );
    assert.equal(
      spawnSync(process.execPath, [
        cli,
        "--snapshot",
        path,
        "--min-context-slot",
        "13",
      ]).status,
      1,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

 test("split-slot inventories are rejected and RPC scans retry to a common slot", async () => {
  const f = fixture();
  f.slots.guards += 1;
  assert.throws(() => inspectSnapshot(f), /one finalized slot/);
  let calls = 0;
  const connection = { async getProgramAccounts(_program, options) {
    calls += 1;
    return {context: {slot: calls <= 3 ? 20 + calls : 24}, value: []};
  }};
  const snapshot = await scanFinalized(connection);
  assert.equal(calls, 6);
  assert.equal(inspectSnapshot(snapshot).minimumSlot, 24);
  calls = 0;
  await assert.rejects(scanFinalized(connection, 0, 1), /one finalized slot/);
 });
