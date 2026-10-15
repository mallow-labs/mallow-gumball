/* eslint-disable import/no-extraneous-dependencies */
import { transactionBuilder } from '@metaplex-foundation/umi';
import { fromWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';
import {
  AuthorityType,
  createDisableRequiredMemoTransfersInstruction,
  createEnableRequiredMemoTransfersInstruction,
  createReallocateInstruction,
  createSetAuthorityInstruction,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';

export const sendInstruction = (
  umi: any,
  instruction: TransactionInstruction,
  signer = umi.identity
) =>
  transactionBuilder()
    .add({
      instruction: fromWeb3JsInstruction(instruction),
      signers: [signer],
      bytesCreatedOnChain: 0,
    })
    .sendAndConfirm(umi);

export const reassignTokenOwner = (umi: any, account: any, newOwner: any) =>
  sendInstruction(
    umi,
    createSetAuthorityInstruction(
      new PublicKey(account),
      new PublicKey(umi.identity.publicKey),
      AuthorityType.AccountOwner,
      new PublicKey(newOwner)
    )
  );

export const requireMemo = async (umi: any, account: any) => {
  await sendInstruction(
    umi,
    createReallocateInstruction(
      new PublicKey(account),
      new PublicKey(umi.identity.publicKey),
      [ExtensionType.MemoTransfer],
      new PublicKey(umi.identity.publicKey),
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );
  await sendInstruction(
    umi,
    createEnableRequiredMemoTransfersInstruction(
      new PublicKey(account),
      new PublicKey(umi.identity.publicKey),
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );
};
export const disableMemo = (umi: any, account: any) =>
  sendInstruction(
    umi,
    createDisableRequiredMemoTransfersInstruction(
      new PublicKey(account),
      new PublicKey(umi.identity.publicKey),
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );

export const disableRentPayer = async (umi: any, payer: any, mode: string) =>
  sendInstruction(
    umi,
    mode === 'assign'
      ? SystemProgram.assign({
          accountPubkey: new PublicKey(payer.publicKey),
          programId: new PublicKey(
            'NativeLoader1111111111111111111111111111111'
          ),
        })
      : SystemProgram.transfer({
          fromPubkey: new PublicKey(payer.publicKey),
          toPubkey: new PublicKey(umi.identity.publicKey),
          lamports: Number(
            (await umi.rpc.getBalance(payer.publicKey)).basisPoints
          ),
        }),
    payer
  );

export const measureInstruction = async (
  umi: any,
  builder: any,
  t: any,
  instruction: string
) => {
  const transaction = await builder.buildAndSign(umi);
  const simulation = await umi.rpc.simulateTransaction(transaction);
  if (simulation.err) throw new Error(simulation.logs.join('\n'));
  const row = {
    instruction,
    scenario: t.title,
    computeUnits: simulation.unitsConsumed,
    serializedBytes: umi.transactions.serialize(transaction).length,
  };
  t.true(row.computeUnits <= 200000);
  t.true(row.serializedBytes <= 1232);
  t.log(`FIX13_METRIC ${JSON.stringify(row)}`);
  await builder.sendAndConfirm(umi);
};
