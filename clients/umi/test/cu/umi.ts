/* eslint-disable import/no-extraneous-dependencies, no-param-reassign */
import {
  createSignerFromKeypair,
  signerIdentity,
  sol,
  Umi,
} from '@metaplex-foundation/umi';
import { createUmi } from '../_setup';

// CU on several instructions depends on PDA bump seeds: the program derives some
// PDAs on-chain with `find_program_address`, whose bump search costs ~1500 CU per
// iteration. Random keypairs yield random canonical bumps, so raw CU wobbles in
// 1500-CU steps run-to-run. To compare builds apples-to-apples we make every
// generated keypair deterministic — both builds then see identical addresses and
// bumps, so any CU delta is attributable to the compiler alone.

// A single monotonic counter shared across all umis/scenarios in a run. It starts
// at 0 on module load (a fresh process per `ava` run), so the exact same sequence
// of keypairs is produced every run — and each seed is unique, so no two accounts
// collide on the shared LiteSVM ledger.
let seedCounter = 0;

function nextSeed(): Uint8Array {
  const seed = new Uint8Array(32);
  let c = seedCounter;
  seedCounter += 1;
  for (let i = 0; i < 4; i += 1) {
    seed[31 - i] = c & 0xff;
    c >>>= 8;
  }
  return seed;
}

// Builds a umi whose keypair generation (and identity) is fully deterministic.
export async function createDeterministicUmi(): Promise<Umi> {
  const umi = await createUmi();
  // Route all future generateSigner()/generateKeypair() calls through the seed
  // counter so keypairs are reproducible across runs and builds.
  umi.eddsa.generateKeypair = () => umi.eddsa.createKeypairFromSeed(nextSeed());
  // Replace the randomly-generated identity with a deterministic one and fund it.
  const identity = createSignerFromKeypair(
    umi,
    umi.eddsa.createKeypairFromSeed(nextSeed())
  );
  umi.use(signerIdentity(identity));
  await umi.rpc.airdrop(umi.identity.publicKey, sol(100));
  return umi;
}
