import { defaultPublicKey, PublicKey } from '@metaplex-foundation/umi';
import {
  array,
  bitArray,
  bool,
  mapSerializer,
  publicKey,
  Serializer,
  struct,
  u32,
  u64,
  u8,
} from '@metaplex-foundation/umi/serializers';
import { GUMBALL_MACHINE_HIDDEN_SECTION } from '../constants';
import {
  BuyBackConfig,
  getBuyBackConfigSerializer,
  TokenStandard,
} from '../generated';
import {
  getGumballMachineAccountDataSerializer as baseGetGumballMachineAccountDataSerializer,
  GumballMachineAccountData as BaseGumballMachineAccountData,
  GumballMachineAccountDataArgs as BaseGumballMachineAccountDataArgs,
} from '../generated/types/gumballMachineAccountData';

export type GumballMachineAccountData = BaseGumballMachineAccountData & {
  itemsLoaded: number;
  items: GumballMachineItem[];
};

export type GumballMachineAccountDataArgs = BaseGumballMachineAccountDataArgs;

/**
 * Represent an item inside a Gumball Machine that has been or
 * will eventually be minted into an NFT.
 *
 * It only contains the name and the URI of the NFT to be as
 * the rest of the data is shared by all NFTs and lives
 * in the Gumball Machine configurations (e.g. `symbol`, `creators`, etc).
 */
export type GumballMachineItem = {
  /** The index of the config line. */
  readonly index: number;

  /** Whether the item has been drawn or not. */
  readonly isDrawn: boolean;

  /** Whether the item has been claimed or not. */
  readonly isClaimed: boolean;

  /** Whether the item has been settled or not. */
  readonly isSettled: boolean;

  /** The name of the NFT to be. */
  readonly mint: string;

  /** The URI of the NFT to be, pointing to some off-chain JSON Metadata. */
  readonly seller: string;

  readonly buyer?: string;

  readonly tokenStandard: TokenStandard;

  readonly amount: number;
};

type GumballMachineHiddenSection = {
  itemsLoaded: number;
  rawConfigLines: {
    mint: PublicKey;
    seller: PublicKey;
    buyer: PublicKey;
    tokenStandard: TokenStandard;
  }[];
  itemsClaimedMap: boolean[];
  itemsSettledMap: boolean[];
  itemsLeftToMint: number[];
};

type GumballMachineHiddenSectionV2 = {
  itemsLoaded: number;
  rawConfigLines: {
    mint: PublicKey;
    seller: PublicKey;
    buyer: PublicKey;
    tokenStandard: TokenStandard;
    amount: number | bigint;
  }[];
  itemsClaimedMap: boolean[];
  itemsSettledMap: boolean[];
  itemsLeftToMint: number[];
};

type GumballMachineHiddenSectionV3 = GumballMachineHiddenSectionV2 & {
  disablePrimarySplit: boolean;
};

type GumballMachineHiddenSectionV4 = GumballMachineHiddenSectionV3 & {
  buyBackConfig: BuyBackConfig;
};

function getDefaultBuyBackConfig(): BuyBackConfig {
  return {
    enabled: false,
    toGumballMachine: false,
    oracleSigner: defaultPublicKey(),
    valuePct: 0,
    fundsAvailable: 0n,
    marketplaceFeeBps: 0,
  };
}

function getHiddenSection(
  version: number,
  itemCapacity: number,
  slice: Uint8Array
): GumballMachineHiddenSectionV4 {
  if (version === 2) {
    const v2 = getHiddenSectionV2(itemCapacity, slice);
    return {
      ...v2,
      disablePrimarySplit: false,
      buyBackConfig: getDefaultBuyBackConfig(),
    };
  }

  if (version === 3) {
    const v3 = getHiddenSectionV3(itemCapacity, slice);
    return {
      ...v3,
      buyBackConfig: getDefaultBuyBackConfig(),
    };
  }

  if (version >= 4) {
    return getHiddenSectionV4(itemCapacity, slice);
  }

  const hiddenSectionSerializer: Serializer<GumballMachineHiddenSection> =
    struct<GumballMachineHiddenSection>([
      ['itemsLoaded', u32()],
      [
        'rawConfigLines',
        array(
          struct<{
            mint: PublicKey;
            seller: PublicKey;
            buyer: PublicKey;
            tokenStandard: TokenStandard;
          }>([
            ['mint', publicKey()],
            ['seller', publicKey()],
            ['buyer', publicKey()],
            ['tokenStandard', u8()],
          ]),
          { size: itemCapacity }
        ),
      ],
      ['itemsClaimedMap', bitArray(Math.floor(itemCapacity / 8) + 1)],
      ['itemsSettledMap', bitArray(Math.floor(itemCapacity / 8) + 1)],
      ['itemsLeftToMint', array(u32(), { size: itemCapacity })],
    ]);

  const [hiddenSection] = hiddenSectionSerializer.deserialize(slice);
  return {
    ...hiddenSection,
    rawConfigLines: hiddenSection.rawConfigLines.map((item) => ({
      ...item,
      amount: 1n,
    })),
    disablePrimarySplit: false,
    buyBackConfig: getDefaultBuyBackConfig(),
  };
}

function getHiddenSectionV2(
  itemCapacity: number,
  slice: Uint8Array
): GumballMachineHiddenSectionV2 {
  const hiddenSectionSerializer: Serializer<GumballMachineHiddenSectionV2> =
    struct<GumballMachineHiddenSectionV2>([
      ['itemsLoaded', u32()],
      [
        'rawConfigLines',
        array(
          struct<{
            mint: PublicKey;
            seller: PublicKey;
            buyer: PublicKey;
            tokenStandard: TokenStandard;
            amount: number | bigint;
          }>([
            ['mint', publicKey()],
            ['seller', publicKey()],
            ['buyer', publicKey()],
            ['tokenStandard', u8()],
            ['amount', u64()],
          ]),
          { size: itemCapacity }
        ),
      ],
      ['itemsClaimedMap', bitArray(Math.floor(itemCapacity / 8) + 1)],
      ['itemsSettledMap', bitArray(Math.floor(itemCapacity / 8) + 1)],
      ['itemsLeftToMint', array(u32(), { size: itemCapacity })],
    ]);

  const [hiddenSection] = hiddenSectionSerializer.deserialize(slice);
  return hiddenSection;
}

function getHiddenSectionV3(
  itemCapacity: number,
  slice: Uint8Array
): GumballMachineHiddenSectionV3 {
  const hiddenSectionSerializer: Serializer<GumballMachineHiddenSectionV3> =
    struct<GumballMachineHiddenSectionV3>([
      ['itemsLoaded', u32()],
      [
        'rawConfigLines',
        array(
          struct<{
            mint: PublicKey;
            seller: PublicKey;
            buyer: PublicKey;
            tokenStandard: TokenStandard;
            amount: number | bigint;
          }>([
            ['mint', publicKey()],
            ['seller', publicKey()],
            ['buyer', publicKey()],
            ['tokenStandard', u8()],
            ['amount', u64()],
          ]),
          { size: itemCapacity }
        ),
      ],
      ['itemsClaimedMap', bitArray(Math.floor(itemCapacity / 8) + 1)],
      ['itemsSettledMap', bitArray(Math.floor(itemCapacity / 8) + 1)],
      ['itemsLeftToMint', array(u32(), { size: itemCapacity })],
      ['disablePrimarySplit', bool()],
    ]);

  const [hiddenSection] = hiddenSectionSerializer.deserialize(slice);
  return hiddenSection;
}

function getHiddenSectionV4(
  itemCapacity: number,
  slice: Uint8Array
): GumballMachineHiddenSectionV4 {
  const hiddenSectionSerializer: Serializer<GumballMachineHiddenSectionV4> =
    struct<GumballMachineHiddenSectionV4>([
      ['itemsLoaded', u32()],
      [
        'rawConfigLines',
        array(
          struct<{
            mint: PublicKey;
            seller: PublicKey;
            buyer: PublicKey;
            tokenStandard: TokenStandard;
            amount: number | bigint;
          }>([
            ['mint', publicKey()],
            ['seller', publicKey()],
            ['buyer', publicKey()],
            ['tokenStandard', u8()],
            ['amount', u64()],
          ]),
          { size: itemCapacity }
        ),
      ],
      ['itemsClaimedMap', bitArray(Math.floor(itemCapacity / 8) + 1)],
      ['itemsSettledMap', bitArray(Math.floor(itemCapacity / 8) + 1)],
      ['itemsLeftToMint', array(u32(), { size: itemCapacity })],
      ['disablePrimarySplit', bool()],
      ['buyBackConfig', getBuyBackConfigSerializer()],
    ]);

  const [hiddenSection] = hiddenSectionSerializer.deserialize(slice);
  return hiddenSection;
}

export function getGumballMachineAccountDataSerializer(): Serializer<
  GumballMachineAccountDataArgs,
  GumballMachineAccountData
> {
  return mapSerializer<
    GumballMachineAccountDataArgs,
    BaseGumballMachineAccountDataArgs,
    GumballMachineAccountData,
    BaseGumballMachineAccountData
  >(
    baseGetGumballMachineAccountDataSerializer(),
    (args) => args,
    (base, bytes, offset) => {
      const slice = bytes.slice(offset + GUMBALL_MACHINE_HIDDEN_SECTION);
      const itemCapacity = Number(base.settings.itemCapacity);

      const hiddenSection = getHiddenSection(base.version, itemCapacity, slice);

      const itemsMinted = Number(base.itemsRedeemed);
      const itemsRemaining = hiddenSection.itemsLoaded - itemsMinted;

      const itemsLeftToMint = hiddenSection.itemsLeftToMint.slice(
        0,
        itemsRemaining
      );

      const items: GumballMachineItem[] = [];
      hiddenSection.itemsClaimedMap.forEach((isClaimed, index) => {
        if (index >= hiddenSection.itemsLoaded) {
          return;
        }

        const rawItem = hiddenSection.rawConfigLines[index];
        const item = {
          index,
          isDrawn: !itemsLeftToMint.includes(index),
          isClaimed,
          isSettled: hiddenSection.itemsSettledMap[index],
          mint: rawItem.mint,
          seller: rawItem.seller,
          buyer:
            rawItem.buyer === defaultPublicKey() ? undefined : rawItem.buyer,
          tokenStandard: rawItem.tokenStandard,
          amount: Number(rawItem.amount),
        };
        items.push(item);
      });

      return {
        ...base,
        items,
        itemsLoaded: hiddenSection.itemsLoaded,
      };
    }
  );
}
