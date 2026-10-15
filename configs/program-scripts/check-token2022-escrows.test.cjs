const test = require("node:test");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { PROGRAMS, discriminator } = require("./check-guard-bindings.cjs");
const {
  expectedAta,
  inspectToken2022,
} = require("./check-token2022-escrows.cjs");
const { PublicKey, Keypair } = createRequire(
  resolve(__dirname, "../../clients/umi/package.json"),
)("@solana/web3.js");
const key = () => Keypair.generate().publicKey;
const fixture = () => {
  const machine = key();
  const [guard, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("gumball_guard"), machine.toBuffer()],
    new PublicKey(PROGRAMS.guards),
  );
  const m = Buffer.alloc(73);
  discriminator("GumballMachine").copy(m);
  guard.toBuffer().copy(m, 41);
  const g = Buffer.alloc(85);
  discriminator("GumballGuard").copy(g);
  machine.toBuffer().copy(g, 8);
  g[40] = bump;
  const entry = (pubkey, data, owner) => ({
    pubkey: pubkey.toBase58(),
    account: {
      owner,
      executable: false,
      data: [data.toString("base64"), "base64"],
    },
  });
  return {
    machine: machine.toBase58(),
    snapshot: {
      programs: PROGRAMS,
      commitment: "finalized",
      slots: { gumball: 1, jellybean: 1, guards: 1 },
      gumball: [entry(machine, m, PROGRAMS.gumball)],
      jellybean: [],
      guards: [entry(guard, g, PROGRAMS.guards)],
    },
  };
};
test("canonical destinations in default and grouped guards pass", () => {
  const f = fixture();
  const mint = key().toBase58();
  const result = inspectToken2022(f.snapshot, () =>
    ["default", "vip"].map((label) => ({
      label,
      mint,
      destinationAta: expectedAta(f.machine, mint),
    })),
  );
  assert.equal(result.releaseBlocked, false);
  assert.equal(result.token2022Payments.length, 2);
});
test("redirected default and grouped payment destinations block release", () => {
  const f = fixture();
  const mint = key().toBase58();
  for (const label of ["default", "vip"]) {
    const result = inspectToken2022(f.snapshot, () => [
      { label, mint, destinationAta: key().toBase58() },
    ]);
    assert.equal(result.releaseBlocked, true);
    assert.equal(result.blockers[0].type, "non-escrow-token2022-destination");
  }
});
test("header-only inventories cannot claim to have audited payment guards", () => {
  const f = fixture();
  f.snapshot.guards[0].account.data[0] = Buffer.from(
    f.snapshot.guards[0].account.data[0],
    "base64",
  )
    .subarray(0, 73)
    .toString("base64");
  assert.throws(() => inspectToken2022(f.snapshot, () => []));
});
