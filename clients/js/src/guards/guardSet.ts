import {
  AccountRole,
  combineCodec,
  createDecoder,
  createEncoder,
  isNone,
  isOption,
  isSome,
  none,
  some,
  wrapNullable,
  type AccountMeta,
  type AccountSignerMeta,
  type Codec,
  type Decoder,
  type Encoder,
  type Option,
  type OptionOrNullable,
  type TransactionSigner,
} from '@solana/kit';
import { UnregisteredGumballGuardError } from '../errors';
import {
  GuardInstructionExtras,
  GuardRemainingAccount,
  MintContext,
  RouteContext,
} from './guardManifest';
import { AnyGuardManifest } from './guardRepository';

export type GuardSetArgs = {
  [name: string]: OptionOrNullable<object>;
};

export type GuardSet = {
  [name: string]: Option<object>;
};

export type GuardSetMintArgs = {
  [name: string]: OptionOrNullable<object>;
};

export type GuardSetRouteArgs = {
  [name: string]: object;
};

// The on-chain guard set is prefixed by an 8-byte little-endian "features"
// bitset: guard index `i` maps to byte `i >> 3`, bit `1 << (i & 7)`. This
// matches the umi client's `reverseSerializer(bitArray(8, true))`.
const FEATURES_SIZE = 8;

function encodeFeatures(features: boolean[]): Uint8Array {
  const bytes = new Uint8Array(FEATURES_SIZE);
  features.forEach((enabled, i) => {
    if (enabled) bytes[Math.floor(i / 8)] |= 1 << (i % 8);
  });
  return bytes;
}

function readFeatures(
  bytes: Uint8Array,
  offset: number,
  count: number
): boolean[] {
  const features: boolean[] = [];
  for (let i = 0; i < count; i += 1) {
    const byte = bytes[offset + Math.floor(i / 8)] ?? 0;
    features.push((byte & (1 << (i % 8))) !== 0);
  }
  return features;
}

function mergeBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let cursor = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, cursor);
    cursor += chunk.length;
  });
  return result;
}

export function getGuardSetEncoder<DA extends GuardSetArgs>(
  manifests: AnyGuardManifest[]
): Encoder<Partial<DA>> {
  return createEncoder({
    getSizeFromValue: (set: Partial<DA>) => {
      let size = FEATURES_SIZE;
      manifests.forEach((manifest) => {
        const value = (set as GuardSetArgs)[manifest.name] ?? none();
        const option = isOption(value) ? value : wrapNullable(value);
        if (isSome(option)) {
          size += manifest.codec().encode(option.value).length;
        }
      });
      return size;
    },
    write: (set: Partial<DA>, bytes, offset) => {
      const features: boolean[] = [];
      const chunks: Uint8Array[] = [];
      manifests.forEach((manifest) => {
        const value = (set as GuardSetArgs)[manifest.name] ?? none();
        const option = isOption(value) ? value : wrapNullable(value);
        features.push(isSome(option));
        chunks.push(
          isSome(option)
            ? new Uint8Array(manifest.codec().encode(option.value))
            : new Uint8Array()
        );
      });
      bytes.set(encodeFeatures(features), offset);
      let cursor = offset + FEATURES_SIZE;
      chunks.forEach((chunk) => {
        bytes.set(chunk, cursor);
        cursor += chunk.length;
      });
      return cursor;
    },
  });
}

export function getGuardSetDecoder<D extends GuardSet>(
  manifests: AnyGuardManifest[]
): Decoder<D> {
  return createDecoder({
    read: (bytes, offset) => {
      const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const features = readFeatures(view, offset, manifests.length);
      let cursor = offset + FEATURES_SIZE;
      const guardSet = {} as GuardSet;
      manifests.forEach((manifest, index) => {
        guardSet[manifest.name] = none();
        if (!(features[index] ?? false)) return;
        const [value, newOffset] = manifest.codec().read(bytes, cursor);
        cursor = newOffset;
        guardSet[manifest.name] = some(value);
      });
      return [guardSet as D, cursor];
    },
  });
}

export function getGuardSetCodec<
  DA extends GuardSetArgs,
  D extends DA & GuardSet,
>(manifests: AnyGuardManifest[]): Codec<Partial<DA>, D> {
  return combineCodec(
    getGuardSetEncoder<DA>(manifests),
    getGuardSetDecoder<D>(manifests)
  );
}

export async function parseMintArgs<MA extends GuardSetMintArgs>(
  manifests: AnyGuardManifest[],
  mintContext: MintContext,
  mintArgs: Partial<MA>
): Promise<GuardInstructionExtras> {
  let acc: GuardInstructionExtras = {
    data: new Uint8Array(),
    remainingAccounts: [],
  };
  for (const manifest of manifests) {
    const args = (mintArgs as GuardSetMintArgs)[manifest.name] ?? none();
    const argsAsOption = isOption(args) ? args : wrapNullable(args);
    if (isNone(argsAsOption)) continue;
    // eslint-disable-next-line no-await-in-loop
    const { data, remainingAccounts } = await manifest.mintParser(
      mintContext,
      argsAsOption.value
    );
    acc = {
      data: mergeBytes([acc.data, data]),
      remainingAccounts: [...acc.remainingAccounts, ...remainingAccounts],
    };
  }
  return acc;
}

export async function parseRouteArgs<
  G extends keyof RA & string,
  RA extends GuardSetRouteArgs,
>(
  manifests: AnyGuardManifest[],
  routeContext: RouteContext,
  guard: G,
  routeArgs: RA[G]
): Promise<GuardInstructionExtras & { guardIndex: number }> {
  const guardIndex = manifests.findIndex((m) => m.name === guard);
  if (guardIndex < 0) {
    throw new UnregisteredGumballGuardError(guard);
  }
  const extras = await manifests[guardIndex].routeParser(
    routeContext,
    routeArgs
  );
  return { ...extras, guardIndex };
}

/**
 * Converts the guard-provided remaining accounts into kit instruction account
 * metas. Signer accounts carry their `TransactionSigner` so the transaction can
 * collect them (kit's `AccountSignerMeta`).
 */
export function parseGuardRemainingAccounts(
  remainingAccounts: GuardRemainingAccount[]
): Array<AccountMeta | AccountSignerMeta<string, TransactionSigner>> {
  return remainingAccounts.map((account) => {
    if ('signer' in account) {
      return {
        address: account.signer.address,
        role: account.isWritable
          ? AccountRole.WRITABLE_SIGNER
          : AccountRole.READONLY_SIGNER,
        signer: account.signer,
      };
    }
    return {
      address: account.address,
      role: account.isWritable ? AccountRole.WRITABLE : AccountRole.READONLY,
    };
  });
}
