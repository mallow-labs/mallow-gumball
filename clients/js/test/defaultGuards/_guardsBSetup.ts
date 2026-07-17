import { getCreateAccountInstruction } from '@solana-program/system';
import {
  findAssociatedTokenPda as findAta,
  getCreateAssociatedTokenInstructionAsync as getCreateAtaAsync,
  getInitializeMintInstruction,
  getMintSize,
  getMintToInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  findAssociatedTokenPda as findAta22,
  getCreateAssociatedTokenInstructionAsync as getCreateAtaAsync22,
  getInitializeMintInstruction as getInitializeMintInstruction22,
  getMintSize as getMintSize22,
  getMintToInstruction as getMintToInstruction22,
  TOKEN_2022_PROGRAM_ADDRESS,
} from '@solana-program/token-2022';
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  generateKeyPairSigner,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Blockhash,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';
import type { Assertions } from 'ava';
import { FailedTransactionMetadata, type LiteSVM } from 'litesvm';
import {
  getAddTokensInstructionAsync,
  getStartSaleInstruction,
  type CreateInput,
  type DefaultGuardSetArgs,
  type GumballSettingsArgs,
} from '../../src';
import {
  createFungibleMint,
  createGumballMachine,
  sendTransaction,
  type Client,
} from '../_setup';

export { TOKEN_2022_PROGRAM_ADDRESS, TOKEN_PROGRAM_ADDRESS };

/**
 * Advance the clock/slot the same way `_setup.sendTransaction` does (draw reads
 * SlotHashes for randomness). Replicated here because `syncClock` is private.
 */
const syncClock = (svm: LiteSVM): void => {
  const clock = svm.getClock();
  svm.warpToSlot(clock.slot + 1n);
  const next = svm.getClock();
  next.unixTimestamp = BigInt(Math.floor(Date.now() / 1000));
  svm.setClock(next);
};

/**
 * Send a transaction and return its program logs, whether it succeeded or was
 * silently taxed (bot tax path). Unlike `_setup.sendTransaction`, this never
 * throws on a program error — used for asserting bot-tax behaviour.
 */
export const sendForLogs = async (
  client: Client,
  feePayer: TransactionSigner,
  instructions: Instruction[]
): Promise<string[]> => {
  syncClock(client.svm);
  const blockhash = client.svm.latestBlockhash() as unknown as Blockhash;
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
  const signed = await signTransactionMessageWithSigners(message);
  const result = client.svm.sendTransaction(signed);
  return result instanceof FailedTransactionMetadata
    ? result.meta().logs()
    : result.logs();
};

/** Decode the little-endian u64 `amount` (bytes 64..72) from an SPL/Token-2022 account. */
export const fetchTokenAmount = (client: Client, ata: Address): bigint => {
  const account = client.svm.getAccount(ata);
  if (!account.exists) throw new Error(`Token account ${ata} not found`);
  const data = account.data as Uint8Array;
  return new DataView(data.buffer, data.byteOffset + 64, 8).getBigUint64(
    0,
    true
  );
};

/** True if the given account exists on the ledger. */
export const accountExists = (client: Client, address: Address): boolean => {
  const account = client.svm.getAccount(address);
  return account.exists && account.lamports > 0n;
};

/** Assert the given logs show a silent bot tax (+ optional extra reason regex). */
export const assertBotTax = (
  t: Assertions,
  logs: string[],
  extraRegex?: RegExp
): void => {
  const joined = logs.join('');
  t.regex(joined, /Gumball Guard Botting is taxed/);
  if (extraRegex !== undefined) t.regex(joined, extraRegex);
};

/** The associated-token PDA finder for the given token program. */
export const findTokenPda = (
  args: { mint: Address; owner: Address },
  tokenProgram: Address = TOKEN_PROGRAM_ADDRESS
) =>
  tokenProgram === TOKEN_2022_PROGRAM_ADDRESS
    ? findAta22({ ...args, tokenProgram })
    : findAta({ ...args, tokenProgram });

/**
 * Create a fresh mint (SPL Token or Token-2022) and, for every holder, create
 * its associated token account and mint the requested amount. Mirrors the umi
 * `createMintWithHolders` helper: returns `[mint, ...holderAtas]` in order.
 */
export const createMintWithHolders = async (
  client: Client,
  input: {
    holders: { owner: Address; amount: number | bigint }[];
    decimals?: number;
    tokenProgram?: Address;
  }
): Promise<[Address, ...Address[]]> => {
  const { payer, svm } = client;
  const decimals = input.decimals ?? 0;
  const tokenProgram = input.tokenProgram ?? TOKEN_PROGRAM_ADDRESS;
  const is22 = tokenProgram === TOKEN_2022_PROGRAM_ADDRESS;

  const mint = await generateKeyPairSigner();
  const space = BigInt(is22 ? getMintSize22() : getMintSize());
  const rent = svm.minimumBalanceForRentExemption(space);

  const instructions: Instruction[] = [
    getCreateAccountInstruction({
      payer,
      newAccount: mint,
      lamports: rent,
      space,
      programAddress: tokenProgram,
    }),
    is22
      ? getInitializeMintInstruction22({
          mint: mint.address,
          decimals,
          mintAuthority: payer.address,
        })
      : getInitializeMintInstruction({
          mint: mint.address,
          decimals,
          mintAuthority: payer.address,
        }),
  ];

  const atas: Address[] = [];
  for (const holder of input.holders) {
    const [ata] = await findTokenPda(
      { mint: mint.address, owner: holder.owner },
      tokenProgram
    );
    atas.push(ata);
    instructions.push(
      is22
        ? await getCreateAtaAsync22({
            payer,
            owner: holder.owner,
            mint: mint.address,
          })
        : await getCreateAtaAsync({
            payer,
            owner: holder.owner,
            mint: mint.address,
          })
    );
    if (BigInt(holder.amount) > 0n) {
      instructions.push(
        is22
          ? getMintToInstruction22({
              mint: mint.address,
              token: ata,
              mintAuthority: payer,
              amount: holder.amount,
            })
          : getMintToInstruction({
              mint: mint.address,
              token: ata,
              mintAuthority: payer,
              amount: holder.amount,
            })
      );
    }
  }

  await sendTransaction(svm, payer, instructions);
  return [mint.address, ...atas];
};

/**
 * Create a gumball machine with the given guards/groups, load `itemCount`
 * fungible items (each quantity 1) and start the sale. Returns the machine and
 * guard addresses. The loaded item type is orthogonal to the guard under test.
 */
export const createLoadedGumballMachine = async (
  client: Client,
  input: {
    gumballMachine?: Awaited<ReturnType<typeof generateKeyPairSigner>>;
    guards?: Partial<DefaultGuardSetArgs>;
    groups?: CreateInput['groups'];
    settings?: Partial<GumballSettingsArgs>;
    feeConfig?: { feeAccount: Address; feeBps: number };
    itemCount?: number;
  } = {}
): Promise<{ gumballMachine: Address; gumballGuard: Address }> => {
  const itemCount = input.itemCount ?? 1;
  const gumballMachine =
    input.gumballMachine ?? (await generateKeyPairSigner());

  const { gumballGuard } = await createGumballMachine(client, {
    gumballMachine,
    settings: { itemCapacity: Math.max(itemCount, 1), ...input.settings },
    guards: input.guards,
    groups: input.groups,
    ...(input.feeConfig ? { feeConfig: input.feeConfig } : {}),
  });

  const addIxs: Instruction[] = [];
  for (let i = 0; i < itemCount; i += 1) {
    const { mint } = await createFungibleMint(client, { amount: 1 });
    addIxs.push(
      await getAddTokensInstructionAsync({
        gumballMachine: gumballMachine.address,
        seller: client.payer,
        mint,
        amount: 1,
        quantity: 1,
      })
    );
  }
  addIxs.push(
    getStartSaleInstruction({
      gumballMachine: gumballMachine.address,
      authority: client.payer,
    })
  );
  await sendTransaction(client.svm, client.payer, addIxs);

  return { gumballMachine: gumballMachine.address, gumballGuard };
};
