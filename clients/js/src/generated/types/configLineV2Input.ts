/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { PublicKey } from '@metaplex-foundation/umi';
import {
  publicKey as publicKeySerializer,
  Serializer,
  struct,
  u64,
} from '@metaplex-foundation/umi/serializers';

/** Config line struct for storing asset (NFT) data pre-mint. */
export type ConfigLineV2Input = {
  /** Mint account of the asset. */
  mint: PublicKey;
  /** Wallet that submitted the asset for sale. */
  seller: PublicKey;
  /** Amount of the asset. */
  amount: bigint;
};

export type ConfigLineV2InputArgs = {
  /** Mint account of the asset. */
  mint: PublicKey;
  /** Wallet that submitted the asset for sale. */
  seller: PublicKey;
  /** Amount of the asset. */
  amount: number | bigint;
};

export function getConfigLineV2InputSerializer(): Serializer<
  ConfigLineV2InputArgs,
  ConfigLineV2Input
> {
  return struct<ConfigLineV2Input>(
    [
      ['mint', publicKeySerializer()],
      ['seller', publicKeySerializer()],
      ['amount', u64()],
    ],
    { description: 'ConfigLineV2Input' }
  ) as Serializer<ConfigLineV2InputArgs, ConfigLineV2Input>;
}
