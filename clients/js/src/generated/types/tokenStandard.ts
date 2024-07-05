/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { Serializer, scalarEnum } from '@metaplex-foundation/umi/serializers';

export enum TokenStandard {
  NonFungible,
  Core,
}

export type TokenStandardArgs = TokenStandard;

export function getTokenStandardSerializer(): Serializer<
  TokenStandardArgs,
  TokenStandard
> {
  return scalarEnum<TokenStandard>(TokenStandard, {
    description: 'TokenStandard',
  }) as Serializer<TokenStandardArgs, TokenStandard>;
}
