import { PublicKey, TransactionBuilder } from '@metaplex-foundation/umi';

/** Append the live-request accounting account after any compressed proof nodes. */
export function withRequestCancellationMachine(
  builder: TransactionBuilder,
  gumballMachine: PublicKey
): TransactionBuilder {
  return builder.addRemainingAccounts([
    { pubkey: gumballMachine, isSigner: false, isWritable: true },
  ]);
}
