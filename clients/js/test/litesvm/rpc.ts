import {
  type Address,
  type GetAccountInfoApi,
  type GetMinimumBalanceForRentExemptionApi,
  type GetMultipleAccountsApi,
  type MaybeEncodedAccount,
  type Rpc,
} from '@solana/kit';
import { type LiteSVM } from 'litesvm';

/**
 * The slice of the Solana JSON-RPC surface the kit gumball client actually
 * exercises in these tests:
 *  - `getMinimumBalanceForRentExemption` — `create` / `getCreateGumballMachine*`
 *    size the machine account.
 *  - `getAccountInfo` / `getMultipleAccounts` — the generated `fetchGumballMachine`
 *    / `fetchGumballGuard` decoders read account bytes through `fetchEncodedAccount`.
 */
export type LiteSvmRpc = Rpc<
  GetAccountInfoApi &
    GetMultipleAccountsApi &
    GetMinimumBalanceForRentExemptionApi
>;

// A pending request in kit terms is any object exposing `.send()`. The generated
// fetchers call `rpc.getAccountInfo(...).send({ abortSignal })`; `create` calls
// `rpc.getMinimumBalanceForRentExemption(space).send()`.
const pending = <T>(value: () => T | Promise<T>) => ({
  send: async () => value(),
});

// Re-emit a LiteSVM account (already a kit `MaybeEncodedAccount`) in the base64
// JSON-RPC value shape `fetchEncodedAccount` -> `parseBase64RpcAccount` expects.
function toRpcAccount(acc: MaybeEncodedAccount) {
  if (!acc || acc.exists === false) return null;
  const data = acc.data as Uint8Array;
  return {
    executable: acc.executable,
    lamports: acc.lamports,
    owner: acc.programAddress,
    rentEpoch: 0n,
    space: BigInt(data.length),
    data: [Buffer.from(data).toString('base64'), 'base64'] as [
      string,
      'base64',
    ],
  };
}

/**
 * Build a minimal kit RPC backed by an in-process LiteSVM. This is the "kit RPC
 * over LiteSVM" the gumball client is driven through: rent lookups for account
 * creation and base64 account reads for the generated decoders.
 */
export function createLiteSvmRpc(svm: LiteSVM): LiteSvmRpc {
  const slot = () => 0n;
  const rpc = {
    getMinimumBalanceForRentExemption(space: bigint) {
      return pending(() => svm.minimumBalanceForRentExemption(BigInt(space)));
    },
    getAccountInfo(addr: Address) {
      return pending(() => ({
        context: { slot: slot() },
        value: toRpcAccount(svm.getAccount(addr)),
      }));
    },
    getMultipleAccounts(addrs: Address[]) {
      return pending(() => ({
        context: { slot: slot() },
        value: addrs.map((a) => toRpcAccount(svm.getAccount(a))),
      }));
    },
  };
  return rpc as unknown as LiteSvmRpc;
}
