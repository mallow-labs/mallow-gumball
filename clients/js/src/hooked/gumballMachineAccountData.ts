import {
  combineCodec,
  createDecoder,
  createEncoder,
  getAddressDecoder,
  getArrayDecoder,
  getBooleanDecoder,
  getStructDecoder,
  getU32Decoder,
  getU64Decoder,
  getU8Decoder,
  transformDecoder,
  type Address,
  type Codec,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';
import { GUMBALL_MACHINE_HIDDEN_SECTION } from '../constants';
import {
  getBuyBackConfigDecoder,
  getTokenStandardDecoder,
  type BuyBackConfig,
  type TokenStandard,
} from '../generated';
import {
  getGumballMachineAccountDataDecoder as baseGetGumballMachineAccountDataDecoder,
  type GumballMachineAccountData as BaseGumballMachineAccountData,
  type GumballMachineAccountDataArgs as BaseGumballMachineAccountDataArgs,
} from '../generated/types/gumballMachineAccountData';

export type GumballMachineAccountData = BaseGumballMachineAccountData & {
  itemsLoaded: number;
  items: GumballMachineItem[];
  disablePrimarySplit: boolean;
  disableRoyalties: boolean;
  buyBackConfig: BuyBackConfig;
  buyBackFundsAvailable: number | bigint;
  totalProceedsSettled: number | bigint;
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

type RawConfigLine = {
  mint: Address;
  seller: Address;
  buyer: Address;
  tokenStandard: TokenStandard;
  amount: number | bigint;
};

type GumballMachineHiddenSectionV5 = {
  itemsLoaded: number;
  rawConfigLines: RawConfigLine[];
  itemsClaimedMap: boolean[];
  itemsSettledMap: boolean[];
  itemsLeftToMint: number[];
  disableRoyalties: boolean;
  unused: number[];
  disablePrimarySplit: boolean;
  buyBackConfig: BuyBackConfig;
  buyBackFundsAvailable: number | bigint;
  totalProceedsSettled: number | bigint;
};

const DEFAULT_ADDRESS = '11111111111111111111111111111111' as Address;

export function getDefaultBuyBackConfig(): BuyBackConfig {
  return {
    enabled: false,
    toGumballMachine: false,
    oracleSigner: DEFAULT_ADDRESS,
    valuePct: 0,
    marketplaceFeeBps: 0,
    cutoffPct: 0,
  };
}

/**
 * Decodes a fixed-length bit array of `size` bytes into `size * 8` booleans,
 * reading most-significant-bit first. This mirrors umi's `bitArray` serializer
 * (forward / non-backward mode) byte-for-byte.
 */
function getBitArrayDecoder(size: number): Decoder<boolean[]> {
  return createDecoder({
    read(bytes: ReadonlyUint8Array, offset: number): [boolean[], number] {
      const slice = bytes.slice(offset, offset + size);
      if (slice.length !== size) {
        throw new Error(
          `bitArray: not enough bytes, expected ${size}, got ${slice.length}`
        );
      }
      const booleans: boolean[] = [];
      slice.forEach((value) => {
        let byte = value;
        for (let i = 0; i < 8; i += 1) {
          booleans.push(Boolean(byte & 0b1000_0000));
          byte <<= 1;
        }
      });
      return [booleans, offset + size];
    },
  });
}

function getRawConfigLineDecoder(version: number): Decoder<RawConfigLine> {
  if (version <= 1) {
    return transformDecoder(
      getStructDecoder([
        ['mint', getAddressDecoder()],
        ['seller', getAddressDecoder()],
        ['buyer', getAddressDecoder()],
        ['tokenStandard', getTokenStandardDecoder()],
      ]),
      (value): RawConfigLine => ({ ...value, amount: 1n })
    );
  }

  return getStructDecoder([
    ['mint', getAddressDecoder()],
    ['seller', getAddressDecoder()],
    ['buyer', getAddressDecoder()],
    ['tokenStandard', getTokenStandardDecoder()],
    ['amount', getU64Decoder()],
  ]);
}

/**
 * Parses the trailing "hidden section" of a Gumball Machine account, starting
 * from the raw byte `slice` that begins at `GUMBALL_MACHINE_HIDDEN_SECTION`.
 * Replicates the umi `getHiddenSection` logic for every account version.
 */
function getHiddenSection(
  version: number,
  itemCapacity: number,
  slice: ReadonlyUint8Array
): GumballMachineHiddenSectionV5 {
  const bitmapSize = Math.floor(itemCapacity / 8) + 1;
  let offset = 0;

  // Reads a value and advances the shared `offset` cursor, so each single-
  // assignment binding below stays `const` while threading the offset.
  const read = <T>(decoder: {
    read: (bytes: ReadonlyUint8Array, o: number) => readonly [T, number];
  }): T => {
    const [value, newOffset] = decoder.read(slice, offset);
    offset = newOffset;
    return value;
  };

  const itemsLoaded = read(getU32Decoder());
  const rawConfigLines = read(
    getArrayDecoder(getRawConfigLineDecoder(version), { size: itemCapacity })
  );
  const itemsClaimedMap = read(getBitArrayDecoder(bitmapSize));
  const itemsSettledMap = read(getBitArrayDecoder(bitmapSize));
  const itemsLeftToMint = read(
    getArrayDecoder(getU32Decoder(), { size: itemCapacity })
  );

  let disableRoyalties = false;
  let unused = [0, 0, 0];
  let disablePrimarySplit = false;
  if (version >= 3) {
    [disableRoyalties, offset] = getBooleanDecoder().read(slice, offset);
    [unused, offset] = getArrayDecoder(getU8Decoder(), { size: 3 }).read(
      slice,
      offset
    );
    [disablePrimarySplit, offset] = getBooleanDecoder().read(slice, offset);
  }

  let buyBackConfig = getDefaultBuyBackConfig();
  let buyBackFundsAvailable: number | bigint = 0n;
  if (version >= 4) {
    [buyBackConfig, offset] = getBuyBackConfigDecoder().read(slice, offset);
    [buyBackFundsAvailable, offset] = getU64Decoder().read(slice, offset);
  }

  let totalProceedsSettled: number | bigint = 0n;
  if (version >= 5) {
    [totalProceedsSettled, offset] = getU64Decoder().read(slice, offset);
  }

  return {
    itemsLoaded,
    rawConfigLines,
    itemsClaimedMap,
    itemsSettledMap,
    itemsLeftToMint,
    disableRoyalties,
    unused,
    disablePrimarySplit,
    buyBackConfig,
    buyBackFundsAvailable,
    totalProceedsSettled,
  };
}

export function getGumballMachineAccountDataDecoder(): Decoder<GumballMachineAccountData> {
  const baseDecoder = baseGetGumballMachineAccountDataDecoder();
  return createDecoder({
    read(
      bytes: ReadonlyUint8Array,
      offset: number
    ): [GumballMachineAccountData, number] {
      const [base] = baseDecoder.read(bytes, offset);
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
        const item: GumballMachineItem = {
          index,
          isDrawn: !itemsLeftToMint.includes(index),
          isClaimed,
          isSettled: hiddenSection.itemsSettledMap[index],
          mint: rawItem.mint,
          seller: rawItem.seller,
          buyer: rawItem.buyer === DEFAULT_ADDRESS ? undefined : rawItem.buyer,
          tokenStandard: rawItem.tokenStandard,
          amount: Number(rawItem.amount),
        };
        items.push(item);
      });

      const value: GumballMachineAccountData = {
        ...base,
        items,
        itemsLoaded: hiddenSection.itemsLoaded,
        disablePrimarySplit: hiddenSection.disablePrimarySplit,
        disableRoyalties: hiddenSection.disableRoyalties,
        buyBackConfig: hiddenSection.buyBackConfig,
        buyBackFundsAvailable: hiddenSection.buyBackFundsAvailable,
        totalProceedsSettled: hiddenSection.totalProceedsSettled,
      };

      return [value, bytes.length];
    },
  });
}

/**
 * GumballMachine accounts have a dynamic, variable-size "hidden section" that is
 * only ever read on the client. Encoding is intentionally unsupported.
 */
export function getGumballMachineAccountDataEncoder(): Encoder<GumballMachineAccountDataArgs> {
  const fail = (): never => {
    throw new Error('GumballMachine accounts cannot be encoded client-side');
  };
  return createEncoder<GumballMachineAccountDataArgs>({
    getSizeFromValue: () => fail(),
    write: () => fail(),
  });
}

export function getGumballMachineAccountDataCodec(): Codec<
  GumballMachineAccountDataArgs,
  GumballMachineAccountData
> {
  return combineCodec(
    getGumballMachineAccountDataEncoder(),
    getGumballMachineAccountDataDecoder()
  );
}
