import { getCreateAccountInstruction } from '@solana-program/system';
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getInitializeMintInstruction,
  getMintSize,
  getMintToInstruction,
  getTokenDecoder,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  generateKeyPairSigner,
  type Address,
  type TransactionSigner,
} from '@solana/kit';
import {
  findSellerHistoryPda,
  getCreateGumballMachineInstructionsAsync,
  type GumballSettingsArgs,
  type InitializeGumballMachineAsyncInput,
} from '../src';
import { defaultGumballSettings, sendTransaction, type Client } from './_setup';

/** LiteSVM lamport balance for an address (0 if the account does not exist). */
export const getBalance = (client: Client, address: Address): bigint =>
  client.svm.getBalance(address) ?? 0n;

/** True when the seller-history PDA still exists on the ledger. */
export const sellerHistoryExists = async (
  client: Client,
  input: { gumballMachine: Address; seller: Address }
): Promise<boolean> => {
  const [pda] = await findSellerHistoryPda(input);
  const account = client.svm.getAccount(pda);
  return Boolean(account && account.exists);
};

/** Decoded SPL token account off the ledger (throws if missing). */
export const fetchTokenAccount = (client: Client, tokenAccount: Address) => {
  const account = client.svm.getAccount(tokenAccount);
  if (!account || !account.exists) {
    throw new Error(`Token account ${tokenAccount} not found`);
  }
  return getTokenDecoder().decode(account.data);
};

/**
 * Create a bare gumball machine (no guard, no wrap) so the machine mint
 * authority stays the payer — used by the wrap/unwrap flows. Mirrors the umi
 * `create` helper when called without guards.
 */
export const createGumballMachineOnly = async (
  client: Client,
  input: {
    gumballMachine?: TransactionSigner;
    settings?: Partial<GumballSettingsArgs>;
    feeConfig?: InitializeGumballMachineAsyncInput['feeConfig'];
  } = {}
): Promise<{ gumballMachine: Address }> => {
  const gumballMachine =
    input.gumballMachine ?? (await generateKeyPairSigner());
  const instructions = await getCreateGumballMachineInstructionsAsync(
    {
      gumballMachine,
      authority: client.payer.address,
      payer: client.payer,
      settings: defaultGumballSettings(input.settings),
      feeConfig: input.feeConfig,
    },
    { rpc: client.rpc }
  );
  await sendTransaction(client.svm, client.payer, instructions);
  return { gumballMachine: gumballMachine.address };
};

/**
 * Create a fungible SPL mint and distribute `amount` to each holder's ATA.
 * Mirrors the umi `createMintWithHolders` helper. Returns the mint plus the
 * created ATAs (in holder order).
 */
export const createMintWithHolders = async (
  client: Client,
  input: {
    holders: { owner: Address; amount: number | bigint }[];
    mint?: TransactionSigner;
    decimals?: number;
  }
): Promise<{ mint: Address; atas: Address[] }> => {
  const { payer, svm } = client;
  const decimals = input.decimals ?? 0;
  const mint = input.mint ?? (await generateKeyPairSigner());
  const space = BigInt(getMintSize());
  const rent = svm.minimumBalanceForRentExemption(space);

  const instructions = [
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
  ];

  const atas: Address[] = [];
  for (const holder of input.holders) {
    // eslint-disable-next-line no-await-in-loop
    const [ata] = await findAssociatedTokenPda({
      owner: holder.owner,
      mint: mint.address,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    atas.push(ata);
    instructions.push(
      // eslint-disable-next-line no-await-in-loop
      await getCreateAssociatedTokenInstructionAsync({
        payer,
        owner: holder.owner,
        mint: mint.address,
      })
    );
    if (holder.amount > 0) {
      instructions.push(
        getMintToInstruction({
          mint: mint.address,
          token: ata,
          mintAuthority: payer,
          amount: holder.amount,
        })
      );
    }
  }

  await sendTransaction(svm, payer, instructions);
  return { mint: mint.address, atas };
};
