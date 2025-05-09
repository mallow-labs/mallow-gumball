/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  Account,
  Context,
  Pda,
  PublicKey,
  RpcAccount,
  RpcGetAccountOptions,
  RpcGetAccountsOptions,
  assertAccountExists,
  deserializeAccount,
  gpaBuilder,
  publicKey as toPublicKey,
} from '@metaplex-foundation/umi';
import {
  Serializer,
  bytes,
  i64,
  publicKey as publicKeySerializer,
  string,
  struct,
} from '@metaplex-foundation/umi/serializers';

/** PDA to track whether an address has been validated or not. */
export type AllowListProof = Account<AllowListProofAccountData>;

export type AllowListProofAccountData = { timestamp: bigint };

export type AllowListProofAccountDataArgs = { timestamp: number | bigint };

export function getAllowListProofAccountDataSerializer(): Serializer<
  AllowListProofAccountDataArgs,
  AllowListProofAccountData
> {
  return struct<AllowListProofAccountData>([['timestamp', i64()]], {
    description: 'AllowListProofAccountData',
  }) as Serializer<AllowListProofAccountDataArgs, AllowListProofAccountData>;
}

export function deserializeAllowListProof(
  rawAccount: RpcAccount
): AllowListProof {
  return deserializeAccount(
    rawAccount,
    getAllowListProofAccountDataSerializer()
  );
}

export async function fetchAllowListProof(
  context: Pick<Context, 'rpc'>,
  publicKey: PublicKey | Pda,
  options?: RpcGetAccountOptions
): Promise<AllowListProof> {
  const maybeAccount = await context.rpc.getAccount(
    toPublicKey(publicKey, false),
    options
  );
  assertAccountExists(maybeAccount, 'AllowListProof');
  return deserializeAllowListProof(maybeAccount);
}

export async function safeFetchAllowListProof(
  context: Pick<Context, 'rpc'>,
  publicKey: PublicKey | Pda,
  options?: RpcGetAccountOptions
): Promise<AllowListProof | null> {
  const maybeAccount = await context.rpc.getAccount(
    toPublicKey(publicKey, false),
    options
  );
  return maybeAccount.exists ? deserializeAllowListProof(maybeAccount) : null;
}

export async function fetchAllAllowListProof(
  context: Pick<Context, 'rpc'>,
  publicKeys: Array<PublicKey | Pda>,
  options?: RpcGetAccountsOptions
): Promise<AllowListProof[]> {
  const maybeAccounts = await context.rpc.getAccounts(
    publicKeys.map((key) => toPublicKey(key, false)),
    options
  );
  return maybeAccounts.map((maybeAccount) => {
    assertAccountExists(maybeAccount, 'AllowListProof');
    return deserializeAllowListProof(maybeAccount);
  });
}

export async function safeFetchAllAllowListProof(
  context: Pick<Context, 'rpc'>,
  publicKeys: Array<PublicKey | Pda>,
  options?: RpcGetAccountsOptions
): Promise<AllowListProof[]> {
  const maybeAccounts = await context.rpc.getAccounts(
    publicKeys.map((key) => toPublicKey(key, false)),
    options
  );
  return maybeAccounts
    .filter((maybeAccount) => maybeAccount.exists)
    .map((maybeAccount) =>
      deserializeAllowListProof(maybeAccount as RpcAccount)
    );
}

export function getAllowListProofGpaBuilder(
  context: Pick<Context, 'rpc' | 'programs'>
) {
  const programId = context.programs.getPublicKey(
    'gumballGuard',
    'GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF'
  );
  return gpaBuilder(context, programId)
    .registerFields<{ timestamp: number | bigint }>({ timestamp: [0, i64()] })
    .deserializeUsing<AllowListProof>((account) =>
      deserializeAllowListProof(account)
    )
    .whereSize(8);
}

export function getAllowListProofSize(): number {
  return 8;
}

export function findAllowListProofPda(
  context: Pick<Context, 'eddsa' | 'programs'>,
  seeds: {
    /** The Merkle Root used when verifying the user */
    merkleRoot: Uint8Array;
    /** The address of the wallet trying to mint */
    user: PublicKey;
    /** The address of the Gumball Guard account */
    gumballGuard: PublicKey;
    /** The address of the Gumball Machine account */
    gumballMachine: PublicKey;
  }
): Pda {
  const programId = context.programs.getPublicKey(
    'gumballGuard',
    'GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF'
  );
  return context.eddsa.findPda(programId, [
    string({ size: 'variable' }).serialize('allow_list'),
    bytes({ size: 32 }).serialize(seeds.merkleRoot),
    publicKeySerializer().serialize(seeds.user),
    publicKeySerializer().serialize(seeds.gumballGuard),
    publicKeySerializer().serialize(seeds.gumballMachine),
  ]);
}

export async function fetchAllowListProofFromSeeds(
  context: Pick<Context, 'eddsa' | 'programs' | 'rpc'>,
  seeds: Parameters<typeof findAllowListProofPda>[1],
  options?: RpcGetAccountOptions
): Promise<AllowListProof> {
  return fetchAllowListProof(
    context,
    findAllowListProofPda(context, seeds),
    options
  );
}

export async function safeFetchAllowListProofFromSeeds(
  context: Pick<Context, 'eddsa' | 'programs' | 'rpc'>,
  seeds: Parameters<typeof findAllowListProofPda>[1],
  options?: RpcGetAccountOptions
): Promise<AllowListProof | null> {
  return safeFetchAllowListProof(
    context,
    findAllowListProofPda(context, seeds),
    options
  );
}
