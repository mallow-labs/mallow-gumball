/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { PublicKey } from '@metaplex-foundation/umi';
import {
  Serializer,
  publicKey as publicKeySerializer,
  struct,
  u64,
} from '@metaplex-foundation/umi/serializers';
import {
  TokenStandard,
  TokenStandardArgs,
  getTokenStandardSerializer,
} from '.';

/** Config line struct for storing asset data. */
export type ConfigLineV2 = {
  /** Mint account of the asset. */
  mint: PublicKey;
  /** Wallet that submitted the asset for sale. */
  seller: PublicKey;
  /** Wallet that will receive the asset upon sale. Empty until drawn. */
  buyer: PublicKey;
  /** Token standard. */
  tokenStandard: TokenStandard;
  /** Amount of the asset. */
  amount: bigint;
};

export type ConfigLineV2Args = {
  /** Mint account of the asset. */
  mint: PublicKey;
  /** Wallet that submitted the asset for sale. */
  seller: PublicKey;
  /** Wallet that will receive the asset upon sale. Empty until drawn. */
  buyer: PublicKey;
  /** Token standard. */
  tokenStandard: TokenStandardArgs;
  /** Amount of the asset. */
  amount: number | bigint;
};

export function getConfigLineV2Serializer(): Serializer<
  ConfigLineV2Args,
  ConfigLineV2
> {
  return struct<ConfigLineV2>(
    [
      ['mint', publicKeySerializer()],
      ['seller', publicKeySerializer()],
      ['buyer', publicKeySerializer()],
      ['tokenStandard', getTokenStandardSerializer()],
      ['amount', u64()],
    ],
    { description: 'ConfigLineV2' }
  ) as Serializer<ConfigLineV2Args, ConfigLineV2>;
}
