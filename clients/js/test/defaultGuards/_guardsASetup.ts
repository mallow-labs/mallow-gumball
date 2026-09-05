import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Blockhash,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';
import { FailedTransactionMetadata, LiteSVM } from 'litesvm';
import {
  getAddTokensInstructionAsync,
  getStartSaleInstruction,
  type DefaultGuardSetArgs,
  type GumballSettingsArgs,
} from '../../src';
import {
  createClient,
  createFungibleMint,
  createGumballMachine,
  sendTransaction,
  type Client,
} from '../_setup';

export { createClient };

/** SPL Memo program — an "extra" program used by programGate tests. */
export const MEMO_PROGRAM_ADDRESS =
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr' as Address;

/** Build a bare SPL Memo instruction (no accounts, UTF-8 payload). */
export const memoInstruction = (text: string): Instruction => ({
  programAddress: MEMO_PROGRAM_ADDRESS,
  accounts: [],
  data: new TextEncoder().encode(text),
});

/**
 * Warp the ledger clock/slot forward — mirrors the private `syncClock` in
 * `_setup.ts` so draws read a populated SlotHashes sysvar and a current
 * unix timestamp. Kept batch-local since `_setup.ts` does not export it.
 */
function syncClock(svm: LiteSVM): void {
  const clock = svm.getClock();
  svm.warpToSlot(clock.slot + 1n);
  const next = svm.getClock();
  next.unixTimestamp = BigInt(Math.floor(Date.now() / 1000));
  svm.setClock(next);
}

/**
 * Like `sendTransaction`, but returns the program logs on success (so bot-tax
 * tests can assert the guard taxed silently). Throws on failure.
 */
export const sendAndGetLogs = async (
  svm: LiteSVM,
  feePayer: TransactionSigner,
  instructions: Instruction[]
): Promise<string> => {
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
  return result.logs().join('\n');
};

/**
 * Create a machine with the given guards, load `quantity` fungible token items
 * from the payer/seller and start the sale. Fungible tokens are the simplest
 * drawable item in the kit harness (see `draw.test.ts`), standing in for the
 * NFTs the umi tests loaded.
 */
export const createMachineWithGuards = async (
  client: Client,
  input: {
    guards?: Partial<DefaultGuardSetArgs>;
    settings?: Partial<GumballSettingsArgs>;
    quantity?: number;
  } = {}
): Promise<{
  gumballMachine: Address;
  gumballGuard: Address;
  mint: Address;
}> => {
  const quantity = input.quantity ?? 1;
  // `amount` is per-item; addTokens transfers `amount * quantity` in total.
  const { mint } = await createFungibleMint(client, {
    amount: 100 * quantity,
  });
  const { gumballMachine, gumballGuard } = await createGumballMachine(client, {
    settings: { itemCapacity: Math.max(quantity, 5), ...input.settings },
    guards: input.guards,
  });
  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 100,
      quantity,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);
  return { gumballMachine, gumballGuard, mint };
};
