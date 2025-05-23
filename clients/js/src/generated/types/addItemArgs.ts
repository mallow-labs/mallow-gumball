/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { Option, OptionOrNullable, none } from '@metaplex-foundation/umi';
import {
  Serializer,
  array,
  bytes,
  mapSerializer,
  option,
  struct,
  u32,
} from '@metaplex-foundation/umi/serializers';

export type AddItemArgs = {
  sellerProofPath: Option<Array<Uint8Array>>;
  index: Option<number>;
};

export type AddItemArgsArgs = {
  sellerProofPath?: OptionOrNullable<Array<Uint8Array>>;
  index?: OptionOrNullable<number>;
};

export function getAddItemArgsSerializer(): Serializer<
  AddItemArgsArgs,
  AddItemArgs
> {
  return mapSerializer<AddItemArgsArgs, any, AddItemArgs>(
    struct<AddItemArgs>(
      [
        ['sellerProofPath', option(array(bytes({ size: 32 })))],
        ['index', option(u32())],
      ],
      { description: 'AddItemArgs' }
    ),
    (value) => ({
      ...value,
      sellerProofPath: value.sellerProofPath ?? none(),
      index: value.index ?? none(),
    })
  ) as Serializer<AddItemArgsArgs, AddItemArgs>;
}
