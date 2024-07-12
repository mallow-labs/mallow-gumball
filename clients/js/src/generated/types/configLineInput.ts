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
} from '@metaplex-foundation/umi/serializers';

/** Config line struct for storing asset (NFT) data pre-mint. */
export type ConfigLineInput = {
  /** Mint account of the asset. */
  mint: PublicKey;
  /** Wallet that submitted the asset for sale. */
  seller: PublicKey;
};

export type ConfigLineInputArgs = ConfigLineInput;

export function getConfigLineInputSerializer(): Serializer<
  ConfigLineInputArgs,
  ConfigLineInput
> {
  return struct<ConfigLineInput>(
    [
      ['mint', publicKeySerializer()],
      ['seller', publicKeySerializer()],
    ],
    { description: 'ConfigLineInput' }
  ) as Serializer<ConfigLineInputArgs, ConfigLineInput>;
}