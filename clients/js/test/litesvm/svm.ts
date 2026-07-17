import { address } from '@solana/kit';
import { existsSync, readFileSync } from 'fs';
import { LiteSVM } from 'litesvm';
import { dirname, join } from 'path';

/**
 * Programs loaded into each LiteSVM instance.
 *
 * The mallow artifacts (`mallow_gumball`, `gumball_guard`) plus the vendored
 * metaplex / system `.so` dumps all live under the repo's `programs/.bin`
 * directory (produced by `pnpm programs:build` + the dump script). SPL Token,
 * Token-2022 and the System program are LiteSVM built-ins (`withDefaultPrograms`
 * + `withNativeMints`), so they are intentionally not listed here.
 *
 * This mirrors the umi client's `clients/umi/test/litesvm/svm.ts` program list,
 * adjusted for the kit test tree.
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
];

/**
 * Data accounts pre-loaded into the ledger. The Metaplex default RuleSet is
 * referenced by the pNFT flows that opt into auth rules; committed here (in
 * solana-CLI account JSON format) since LiteSVM cannot fetch it live.
 */
const ACCOUNTS: { file: string; required: boolean }[] = [
  {
    file: 'test/litesvm/fixtures/metaplex-default-ruleset.json',
    required: false,
  },
];

/**
 * Resolve a repo-relative artifact by walking up ancestor directories until one
 * contains it. Works both when tests run from the compiled `dist/test` tree and
 * from a normal run, regardless of how deep the caller sits.
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
function loadAccountFixture(svm: LiteSVM, path: string): void {
  const json = JSON.parse(readFileSync(path, 'utf8'));
  const { pubkey, account } = json;
  const [dataB64] = account.data as [string, string];
  const data = new Uint8Array(Buffer.from(dataB64, 'base64'));
  svm.setAccount({
    address: address(pubkey),
    data,
    executable: account.executable,
    lamports: BigInt(account.lamports),
    programAddress: address(account.owner),
    space: BigInt(data.length),
    exists: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

/**
 * Create a fresh LiteSVM with all mallow + metaplex programs loaded. AVA runs
 * each test file in its own worker process and each test builds its own SVM, so
 * state is naturally isolated per test.
 */
export function createSvm(): LiteSVM {
  const svm = new LiteSVM()
    .withSysvars()
    .withBuiltins()
    .withDefaultPrograms()
    // Seed the SPL Token / Token-2022 native mint accounts (wSOL).
    .withNativeMints()
    // Fetch a blockhash then send later; LiteSVM has no real block production so
    // skip blockhash validation. Duplicate signatures are still rejected.
    .withBlockhashCheck(false)
    // A single valid blockhash means a logically-identical resend can't rotate
    // to become unique; disable duplicate-signature history so negative-path
    // resends re-execute and surface the program error instead of AlreadyProcessed.
    .withTransactionHistory(0n);

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
    svm.addProgramFromFile(address(id), path);
  }

  for (const { file, required } of ACCOUNTS) {
    const path = resolveArtifact(file);
    if (!path) {
      if (required) throw new Error(`Missing account fixture ${file}.`);
      continue;
    }
    loadAccountFixture(svm, path);
  }

  return svm;
}
