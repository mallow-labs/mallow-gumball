import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import { getCreateAccountInstruction } from '@solana-program/system';
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getInitializeMintInstruction,
  getMintSize,
  getMintToInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  generateKeyPairSigner,
  lamports,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Blockhash,
  type Instruction,
  type Lamports,
  type TransactionSigner,
} from '@solana/kit';
import { FailedTransactionMetadata, LiteSVM } from 'litesvm';
import {
  create,
  createGumballGuard,
  decodeGumballGuard,
  decodeGumballMachine,
  DefaultGuardSetArgs,
  findGumballGuardPda,
  GumballGuardAccountData,
  GumballMachineAccountData,
  GumballSettingsArgs,
  type CreateInput,
} from '../src';
import { createLiteSvmRpc, type LiteSvmRpc } from './litesvm/rpc';
import { createSvm } from './litesvm/svm';

export const NATIVE_MINT: Address =
  'So11111111111111111111111111111111111111112' as Address;

/** SOL amount expressed as branded `Lamports` (1 SOL = 1e9 lamports). */
export const sol = (amount: number): Lamports =>
  lamports(BigInt(Math.round(amount * 1e9)));

export type Client = {
  svm: LiteSVM;
  rpc: LiteSvmRpc;
  /** Default fee payer and machine authority. */
  payer: TransactionSigner;
};

/** Generate a fresh signer and fund it directly on the ledger. */
export const generateKeyPairSignerWithSol = async (
  svm: LiteSVM,
  putativeLamports: bigint = sol(100)
): Promise<TransactionSigner> => {
  const signer = await generateKeyPairSigner();
  svm.airdrop(signer.address, lamports(putativeLamports));
  return signer;
};

export const createClient = async (): Promise<Client> => {
  const svm = createSvm();
  const rpc = createLiteSvmRpc(svm);
  const payer = await generateKeyPairSignerWithSol(svm);
  return { svm, rpc, payer };
};

/**
 * Advance the ledger clock/slot before executing. Draw reads the SlotHashes
 * sysvar for randomness (empty at genesis), and time-based guards read the
 * clock's unix timestamp; warping a slot forward populates both.
 */
function syncClock(svm: LiteSVM): void {
  const clock = svm.getClock();
  svm.warpToSlot(clock.slot + 1n);
  const next = svm.getClock();
  next.unixTimestamp = BigInt(Math.floor(Date.now() / 1000));
  svm.setClock(next);
}

/**
 * Build, sign and send a kit transaction to LiteSVM. Every signer carried in the
 * instruction account metas (fee payer, new-account and authority signers) is
 * collected by `signTransactionMessageWithSigners`. Throws on failure with the
 * program logs in the message so tests can assert on error codes.
 */
export const sendTransaction = async (
  svm: LiteSVM,
  feePayer: TransactionSigner,
  instructions: Instruction[]
): Promise<void> => {
  syncClock(svm);
  const blockhash = svm.latestBlockhash() as unknown as Blockhash;
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) =>
      setTransactionMessageLifetimeUsingBlockhash(
        { blockhash, lastValidBlockHeight: 2n ** 63n },
        m
      ),
    (m) => appendTransactionMessageInstructions(instructions, m)
  );
  const signedTransaction = await signTransactionMessageWithSigners(message);
  const result = svm.sendTransaction(signedTransaction);
  if (result instanceof FailedTransactionMetadata) {
    const logs = result.meta().logs().join('\n');
    throw new Error(`Transaction failed: ${result.toString()}\n${logs}`);
  }
};

export const COMPUTE_UNITS = getSetComputeUnitLimitInstruction({
  units: 1_400_000,
});

// -----------------------------------------------------------------------------
// Account fetching (kit — decode straight off the LiteSVM ledger)
// -----------------------------------------------------------------------------

export const fetchGumballMachine = (
  svm: LiteSVM,
  machine: Address
): GumballMachineAccountData => {
  const account = svm.getAccount(machine);
  if (!account || !account.exists) {
    throw new Error(`Gumball machine ${machine} not found`);
  }
  return decodeGumballMachine(account).data;
};

export const fetchGumballGuard = (
  svm: LiteSVM,
  guard: Address
): GumballGuardAccountData => {
  const account = svm.getAccount(guard);
  if (!account || !account.exists) {
    throw new Error(`Gumball guard ${guard} not found`);
  }
  return decodeGumballGuard(account).data;
};

// -----------------------------------------------------------------------------
// Gumball machine + guard scaffolding (kit)
// -----------------------------------------------------------------------------

export const defaultGumballSettings = (
  overrides: Partial<GumballSettingsArgs> = {}
): GumballSettingsArgs => ({
  itemCapacity: 5,
  uri: 'https://example.com/gumball-machine.json',
  itemsPerSeller: 3,
  sellersMerkleRoot: null,
  curatorFeeBps: 500,
  hideSoldItems: false,
  paymentMint: NATIVE_MINT,
  ...overrides,
});

/**
 * Create a machine + guard (+ wrap) via the high-level kit `create` builder and
 * send it. Returns the machine and guard addresses.
 */
export const createGumballMachine = async (
  client: Client,
  input: Omit<Partial<CreateInput>, 'settings' | 'authority' | 'payer'> & {
    gumballMachine?: TransactionSigner;
    settings?: Partial<GumballSettingsArgs>;
    guards?: CreateInput['guards'];
    groups?: CreateInput['groups'];
  } = {}
): Promise<{ gumballMachine: Address; gumballGuard: Address }> => {
  const gumballMachine =
    input.gumballMachine ?? (await generateKeyPairSigner());
  const instructions = await create(
    {
      ...input,
      gumballMachine,
      authority: client.payer,
      payer: client.payer,
      settings: defaultGumballSettings(input.settings),
    },
    { rpc: client.rpc }
  );
  await sendTransaction(client.svm, client.payer, instructions);
  const [gumballGuard] = await findGumballGuardPda({
    base: gumballMachine.address,
  });
  return { gumballMachine: gumballMachine.address, gumballGuard };
};

/**
 * Create a standalone gumball guard (no machine) with the given guards/groups,
 * derived from a random base signer. Returns the guard PDA.
 */
export const createStandaloneGumballGuard = async (
  client: Client,
  input: {
    guards?: Partial<DefaultGuardSetArgs>;
    groups?: CreateInput['groups'];
  } = {}
): Promise<{ base: Address; gumballGuard: Address }> => {
  const base = await generateKeyPairSigner();
  const instruction = await createGumballGuard({
    base,
    authority: client.payer.address,
    payer: client.payer,
    guards: input.guards,
    groups: input.groups,
  });
  await sendTransaction(client.svm, client.payer, [instruction]);
  const [gumballGuard] = await findGumballGuardPda({ base: base.address });
  return { base: base.address, gumballGuard };
};

// -----------------------------------------------------------------------------
// SPL token scaffolding (kit) — the simplest gumball item to load & draw.
// -----------------------------------------------------------------------------

/**
 * Create a fresh SPL mint and mint `amount` tokens to the payer's associated
 * token account (the seller). Returns the mint + seller ATA addresses.
 */
export const createFungibleMint = async (
  client: Client,
  input: { amount: number | bigint; decimals?: number } = { amount: 100 }
): Promise<{ mint: Address; sellerAta: Address }> => {
  const { payer, svm } = client;
  const decimals = input.decimals ?? 0;
  const mint = await generateKeyPairSigner();
  const space = BigInt(getMintSize());
  const rent = svm.minimumBalanceForRentExemption(space);
  const [sellerAta] = await findAssociatedTokenPda({
    owner: payer.address,
    mint: mint.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  await sendTransaction(svm, payer, [
    getCreateAccountInstruction({
      payer,
      newAccount: mint,
      lamports: rent,
      space,
      programAddress: TOKEN_PROGRAM_ADDRESS,
    }),
    getInitializeMintInstruction({
      mint: mint.address,
      decimals,
      mintAuthority: payer.address,
    }),
    await getCreateAssociatedTokenInstructionAsync({
      payer,
      owner: payer.address,
      mint: mint.address,
    }),
    getMintToInstruction({
      mint: mint.address,
      token: sellerAta,
      mintAuthority: payer,
      amount: input.amount,
    }),
  ]);

  return { mint: mint.address, sellerAta };
};
