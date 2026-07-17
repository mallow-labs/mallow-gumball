/* eslint-disable import/no-extraneous-dependencies */
import { PublicKey } from '@solana/web3.js';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
// Use the native NAPI binding directly. The public `litesvm` entrypoint pulls in
// `@solana/kit` (v2) types/runtime; the native binding speaks plain Uint8Array,
// which bridges cleanly to the web3.js v1 world these tests live in.
import { Account, LiteSvm } from 'litesvm/dist/internal';

/**
 * Programs loaded into the LiteSVM instance. The mallow artifacts
 * (`mallow_gumball`, `gumball_guard`) come from `pnpm programs:build`; the
 * metaplex/system `.so` files are dumped alongside them (see
 * `configs/program-scripts/dump.sh`). All live under `programs/.bin`.
 *
 * SPL Token, Token-2022, and the System program are LiteSVM built-ins (enabled by
 * the constructor + `withNativeMints`), so they are intentionally not listed here.
 * Gumball Guard is loaded as an ordinary program: `create_global_config` no longer
 * gates on the program's upgrade authority (it is a plain PDA `init`), so the
 * amman-era upgradeable-program fixture is obsolete.
 */
const PROGRAMS: { id: string; file: string; required: boolean }[] = [
  {
    id: 'MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa',
    file: 'programs/.bin/mallow_gumball.so',
    required: true,
  },
  {
    id: 'GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF',
    file: 'programs/.bin/gumball_guard.so',
    required: true,
  },
  {
    id: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
    file: 'programs/.bin/mpl_token_metadata.so',
    required: true,
  },
  {
    id: 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d',
    file: 'programs/.bin/mpl_core.so',
    required: true,
  },
  {
    id: 'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg',
    file: 'programs/.bin/mpl_token_auth_rules.so',
    required: false,
  },
  {
    id: 'SysExL2WDyJi9aRZrXorrjHJut3JwHQ7R9bTyctbNNG',
    file: 'programs/.bin/mpl_system_extras.so',
    required: false,
  },
  {
    id: 'TokExjvjJmhKaRBShsBAsbSvEWMA1AgUNK7ps4SAc2p',
    file: 'programs/.bin/mpl_token_extras.so',
    required: false,
  },
  {
    id: 'gatem74V238djXdzWnJf94Wo1DcnuGkfijbf3AuBhfs',
    file: 'programs/.bin/civic_gateway.so',
    required: false,
  },
  // Bubblegum V1 stack for the cNFT flows (cnft.test.ts + _cnftSetup.ts).
  {
    id: 'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY',
    file: 'programs/.bin/mpl_bubblegum.so',
    required: true,
  },
  {
    id: 'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK',
    file: 'programs/.bin/spl_account_compression.so',
    required: true,
  },
  {
    id: 'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV',
    file: 'programs/.bin/spl_noop.so',
    required: true,
  },
  // Jellybean Machine program, driven by the gumball-guard `draw_jellybean`
  // flow (drawJellybean.test.ts + _jellybeanSetup.ts).
  {
    id: 'J3LLYcm8V5hJRzCKENRPW3yGdQ6xU8Nie8jr3mU88eqq',
    file: 'programs/.bin/mallow_jellybean.so',
    required: true,
  },
];

/**
 * Data accounts pre-loaded into the ledger. The Metaplex default RuleSet is
 * referenced by the pNFT tests that opt into auth rules
 * (`createProgrammableNft({ withAuthRules: true })`). The amman setup fetched it
 * live from devnet; LiteSVM can't, so it is committed here (solana-CLI account
 * JSON format) and loaded from the source tree.
 */
const ACCOUNTS: { file: string; required: boolean }[] = [
  {
    file: 'clients/umi/test/litesvm/fixtures/metaplex-default-ruleset.json',
    required: true,
  },
];

/**
 * Resolve a repo-relative artifact by walking up ancestor directories until one
 * contains it. Tests run from the compiled `clients/umi/dist/test/**` tree, so the
 * repo root (holding `programs/.bin` and the committed test fixtures) is several
 * levels up.
 */
function resolveArtifact(relPath: string): string | null {
  let dir = __dirname;
  for (let i = 0; i < 10; i += 1) {
    const candidate = join(dir, relPath);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Load a solana-CLI JSON account fixture into the ledger via `setAccount`. */
function loadAccountFixture(instance: LiteSvm, path: string): void {
  const json = JSON.parse(readFileSync(path, 'utf8'));
  const { pubkey, account } = json;
  const [dataB64] = account.data as [string, string];
  // Solana CLI account dumps record rentEpoch as u64::MAX for rent-exempt
  // accounts; that value exceeds JS's safe-integer range (JSON.parse rounds it up
  // past 2^64 and the native u64 conversion overflows). rentEpoch is irrelevant
  // for a pre-loaded fixture, so pin it to 0.
  const acc = new Account(
    BigInt(account.lamports),
    new Uint8Array(Buffer.from(dataB64, 'base64')),
    new PublicKey(account.owner).toBytes(),
    account.executable,
    0n
  );
  instance.setAccount(new PublicKey(pubkey).toBytes(), acc);
}

let svm: LiteSvm | null = null;

/**
 * Lazily create (once per process) a LiteSVM instance with all gumball +
 * metaplex programs loaded. Ava runs each test file in its own worker process,
 * so this per-process singleton gives every file an isolated fresh ledger — no
 * cross-file reset machinery is needed.
 */
export function getSvm(): LiteSvm {
  if (svm) return svm;

  const instance = new LiteSvm();
  // Tests fetch a blockhash then send later (often concurrently). LiteSVM has no
  // real block production, so skip blockhash validation; duplicate signatures are
  // still rejected by transaction history.
  instance.setBlockhashCheck(false);
  // The client simulates transactions (compute-unit estimation) before signing,
  // and real RPC simulateTransaction defaults to sigVerify:false. Skip signature
  // verification; programs still enforce account-level `is_signer` authorization.
  instance.setSigverify(false);
  // Seed the SPL Token / Token-2022 native mint accounts (wSOL) used as the
  // default payment mint.
  instance.withNativeMints();

  for (const { id, file, required } of PROGRAMS) {
    const path = resolveArtifact(file);
    if (!path) {
      if (required) {
        throw new Error(
          `Missing program artifact ${file} for ${id}. Run \`pnpm programs:build\`.`
        );
      }
      continue;
    }
    instance.addProgramFromFile(new PublicKey(id).toBytes(), path);
  }

  for (const { file, required } of ACCOUNTS) {
    const path = resolveArtifact(file);
    if (!path) {
      if (required) throw new Error(`Missing account fixture ${file}.`);
      continue;
    }
    loadAccountFixture(instance, path);
  }

  svm = instance;
  return svm;
}
