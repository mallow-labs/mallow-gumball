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

/**
 * Guard that charges an amount in a specified spl-token as payment for the mint.
 *
 * List of accounts required:
 *
 * 0. `[writable]` Token account holding the required amount.
 * 1. `[writable]` Address of the ATA to receive the tokens.
 */

export type TokenPayment = { amount: bigint; mint: PublicKey };

export type TokenPaymentArgs = { amount: number | bigint; mint: PublicKey };

export function getTokenPaymentSerializer(): Serializer<
  TokenPaymentArgs,
  TokenPayment
> {
  return struct<TokenPayment>(
    [
      ['amount', u64()],
      ['mint', publicKeySerializer()],
    ],
    { description: 'TokenPayment' }
  ) as Serializer<TokenPaymentArgs, TokenPayment>;
}
