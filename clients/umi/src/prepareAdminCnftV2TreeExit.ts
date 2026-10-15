import {
  Context,
  isSome,
  publicKey,
  Signer,
  TransactionBuilder,
} from '@metaplex-foundation/umi';
import { getMissingCnftV2TreeEvidence } from './cnftV2TreeEvidence';
import {
  closeMissingCnftRecoveryV2,
  fetchCnftRecovery,
  findGlobalConfigPda,
  getCloseMissingCnftRecoveryV2InstructionDataSerializer,
  getCnftArgsV2Serializer,
  settleCnftSaleV2,
} from './generated';

const simulateAdminExit = async (
  context: Context,
  authority: Signer,
  builder: TransactionBuilder,
  token2022Program?: ReturnType<typeof publicKey>
) => {
  const admin = builder.addRemainingAccounts([
    { signer: authority, isWritable: false },
    {
      pubkey: findGlobalConfigPda(context)[0],
      isSigner: false,
      isWritable: false,
    },
    ...(token2022Program
      ? [{ pubkey: token2022Program, isSigner: false, isWritable: false }]
      : []),
  ]);
  const simulation = await context.rpc.simulateTransaction(
    await admin.buildAndSign(context)
  );
  if (simulation.err !== null) {
    throw new Error(
      `Admin tree exit simulation failed: ${(simulation.logs ?? []).join('\n')}`
    );
  }
  return admin;
};

/** Verify missing delivery and simulate settlement; never send a transaction. */
export async function prepareAdminSettleMissingCnftSaleV2(
  context: Context,
  input: {
    authority: Signer;
    settle: Parameters<typeof settleCnftSaleV2>[1];
    token2022Program?: ReturnType<typeof publicKey>;
  }
): Promise<TransactionBuilder> {
  const args = getCnftArgsV2Serializer().deserialize(
    getCnftArgsV2Serializer().serialize(input.settle.args)
  )[0];
  if (
    args.version !== 2 ||
    args.flags !== 255 ||
    args.root.some((byte) => byte !== 0) ||
    args.nonce !== BigInt(args.index)
  ) {
    throw new Error(
      'Missing-tree settlement requires version 2, flags 255, zero root and nonce == index'
    );
  }
  if (
    !(await getMissingCnftV2TreeEvidence(
      context,
      publicKey(input.settle.merkleTree),
      args.index
    ))
  ) {
    throw new Error(
      'Admin tree exit requires independently verified missing delivery'
    );
  }
  return simulateAdminExit(
    context,
    input.authority,
    settleCnftSaleV2(context, input.settle),
    input.token2022Program
  );
}

/** Verify missing delivery and simulate receipt closure; never send a transaction. */
export async function prepareAdminCloseMissingCnftRecoveryV2(
  context: Context,
  input: {
    authority: Signer;
    close: Parameters<typeof closeMissingCnftRecoveryV2>[1];
  }
): Promise<TransactionBuilder> {
  const args =
    getCloseMissingCnftRecoveryV2InstructionDataSerializer().deserialize(
      getCloseMissingCnftRecoveryV2InstructionDataSerializer().serialize(
        input.close
      )
    )[0];
  const receipt = await fetchCnftRecovery(context, input.close.recovery);
  if (
    isSome(args.leaf) ||
    args.root.some((byte) => byte !== 0) ||
    receipt.merkleTree !== publicKey(input.close.merkleTree) ||
    receipt.rentPayer !== publicKey(input.close.rentPayer)
  ) {
    throw new Error(
      'Admin receipt exit must use the recorded tree, rent payer, no leaf and zero root'
    );
  }
  const index = Number(receipt.nonce);
  if (
    index > 0xffffffff ||
    !(await getMissingCnftV2TreeEvidence(context, receipt.merkleTree, index))
  ) {
    throw new Error(
      'Admin tree exit requires independently verified missing delivery'
    );
  }
  return simulateAdminExit(
    context,
    input.authority,
    closeMissingCnftRecoveryV2(context, input.close)
  );
}
