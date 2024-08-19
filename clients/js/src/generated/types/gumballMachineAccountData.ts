/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { Option, OptionOrNullable, PublicKey } from '@metaplex-foundation/umi';
import {
  array,
  mapSerializer,
  option,
  publicKey as publicKeySerializer,
  Serializer,
  struct,
  u64,
  u8,
} from '@metaplex-foundation/umi/serializers';
import {
  FeeConfig,
  FeeConfigArgs,
  getFeeConfigSerializer,
  getGumballSettingsSerializer,
  getGumballStateSerializer,
  GumballSettings,
  GumballSettingsArgs,
  GumballState,
  GumballStateArgs,
} from '.';

/** Gumball machine state and config data. */
export type GumballMachineAccountData = {
  discriminator: Array<number>;
  /** Version of the account. */
  version: number;
  /** Authority address. */
  authority: PublicKey;
  /** Authority address allowed to mint from the gumball machine. */
  mintAuthority: PublicKey;
  /** Fee config for the marketplace this gumball is listed on */
  marketplaceFeeConfig: Option<FeeConfig>;
  /** Number of assets redeemed. */
  itemsRedeemed: bigint;
  /** Number of assets settled after sale. */
  itemsSettled: bigint;
  /** Amount of lamports/tokens received from purchases. */
  totalRevenue: bigint;
  /** True if the authority has finalized details, which prevents adding more nfts. */
  state: GumballState;
  /** User-defined settings */
  settings: GumballSettings;
};

export type GumballMachineAccountDataArgs = {
  /** Version of the account. */
  version: number;
  /** Authority address. */
  authority: PublicKey;
  /** Authority address allowed to mint from the gumball machine. */
  mintAuthority: PublicKey;
  /** Fee config for the marketplace this gumball is listed on */
  marketplaceFeeConfig: OptionOrNullable<FeeConfigArgs>;
  /** Number of assets redeemed. */
  itemsRedeemed: number | bigint;
  /** Number of assets settled after sale. */
  itemsSettled: number | bigint;
  /** Amount of lamports/tokens received from purchases. */
  totalRevenue: number | bigint;
  /** True if the authority has finalized details, which prevents adding more nfts. */
  state: GumballStateArgs;
  /** User-defined settings */
  settings: GumballSettingsArgs;
};

export function getGumballMachineAccountDataSerializer(): Serializer<
  GumballMachineAccountDataArgs,
  GumballMachineAccountData
> {
  return mapSerializer<
    GumballMachineAccountDataArgs,
    any,
    GumballMachineAccountData
  >(
    struct<GumballMachineAccountData>(
      [
        ['discriminator', array(u8(), { size: 8 })],
        ['version', u8()],
        ['authority', publicKeySerializer()],
        ['mintAuthority', publicKeySerializer()],
        ['marketplaceFeeConfig', option(getFeeConfigSerializer())],
        ['itemsRedeemed', u64()],
        ['itemsSettled', u64()],
        ['totalRevenue', u64()],
        ['state', getGumballStateSerializer()],
        ['settings', getGumballSettingsSerializer()],
      ],
      { description: 'GumballMachineAccountData' }
    ),
    (value) => ({ ...value, discriminator: [87, 13, 57, 25, 98, 234, 26, 27] })
  ) as Serializer<GumballMachineAccountDataArgs, GumballMachineAccountData>;
}
