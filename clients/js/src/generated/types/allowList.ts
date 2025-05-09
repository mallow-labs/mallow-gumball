/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  Serializer,
  bytes,
  struct,
} from '@metaplex-foundation/umi/serializers';

/**
 * Guard that uses a merkle tree to specify the addresses allowed to mint.
 *
 * List of accounts required:
 *
 * 0. `[]` Pda created by the merkle proof instruction (seeds `["allow_list", merke tree root,
 * payer key, gumball guard pubkey, gumball machine pubkey]`).
 */

export type AllowList = {
  /** Merkle root of the addresses allowed to mint. */
  merkleRoot: Uint8Array;
};

export type AllowListArgs = AllowList;

export function getAllowListSerializer(): Serializer<AllowListArgs, AllowList> {
  return struct<AllowList>([['merkleRoot', bytes({ size: 32 })]], {
    description: 'AllowList',
  }) as Serializer<AllowListArgs, AllowList>;
}
