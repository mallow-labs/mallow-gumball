/* eslint-disable import/no-extraneous-dependencies */
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import { PublicKey, transactionBuilder, Umi } from '@metaplex-foundation/umi';
import { FailedTransactionMetadata } from 'litesvm/dist/internal';
import { draw } from '../../src';
import { getSvm } from '../litesvm/svm';

// Raised well above any single instruction so measurement never clips; the
// reported `computeUnitsConsumed` is the true amount regardless of the ceiling.
export const CU_LIMIT = 1_400_000;

// LiteSVM retains each executed transaction's metadata by signature. umi's
// `sendAndConfirm` returns the raw signature bytes, which is exactly what
// `getTransaction` expects — so CU is read straight off the just-sent tx.
export function cuOf(signature: Uint8Array): number {
  const tx = getSvm().getTransaction(signature);
  if (!tx) throw new Error('no transaction metadata for signature');
  const meta = tx instanceof FailedTransactionMetadata ? tx.meta() : tx;
  return Number(meta.computeUnitsConsumed());
}

// Sends a single `draw` (with a raised CU limit) and returns the CU it consumed.
// `drawInput` carries the per-guard `mintArgs` and any payer/buyer overrides.
export async function drawCu(
  umi: Umi,
  gumballMachine: PublicKey,
  drawInput: Omit<Parameters<typeof draw>[1], 'gumballMachine'> = {}
): Promise<number> {
  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: CU_LIMIT }))
    .add(draw(umi, { gumballMachine, ...drawInput }))
    .sendAndConfirm(umi);
  return cuOf(signature);
}
