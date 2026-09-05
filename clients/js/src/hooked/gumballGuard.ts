import {
  combineCodec,
  fixDecoderSize,
  fixEncoderSize,
  getAddressDecoder,
  getAddressEncoder,
  getArrayDecoder,
  getArrayEncoder,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  getU8Decoder,
  getU8Encoder,
  transformEncoder,
  type Address,
  type Codec,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';
import { DefaultGuardSet, DefaultGuardSetArgs } from '../defaultGuards';
import {
  AnyGuardManifest,
  getGuardGroupDecoder,
  getGuardGroupEncoder,
  getGuardSetDecoder,
  getGuardSetEncoder,
  GuardSet,
  GuardSetArgs,
} from '../guards';
import { getDefaultGuardManifests } from '../plugin';
import { GumballGuardData, GumballGuardDataArgs } from './gumballGuardData';

const DISCRIMINATOR = new Uint8Array([95, 25, 33, 117, 164, 206, 9, 250]);

export type GumballGuardAccountData<D extends GuardSet = DefaultGuardSet> = {
  discriminator: ReadonlyUint8Array;
  base: Address;
  bump: number;
  authority: Address;
} & GumballGuardData<D>;

export type GumballGuardAccountDataArgs<
  DA extends GuardSetArgs = DefaultGuardSetArgs,
> = {
  base: Address;
  bump: number;
  authority: Address;
} & GumballGuardDataArgs<DA>;

export function getGumballGuardAccountDataEncoder<DA extends GuardSetArgs>(
  manifests: AnyGuardManifest[] = getDefaultGuardManifests()
): Encoder<GumballGuardAccountDataArgs<DA>> {
  return transformEncoder(
    getStructEncoder([
      ['discriminator', fixEncoderSize(getBytesEncoder(), 8)],
      ['base', getAddressEncoder()],
      ['bump', getU8Encoder()],
      ['authority', getAddressEncoder()],
      ['guards', getGuardSetEncoder<DA>(manifests)],
      ['groups', getArrayEncoder(getGuardGroupEncoder<DA>(manifests))],
    ]),
    (value: GumballGuardAccountDataArgs<DA>) => ({
      ...value,
      discriminator: DISCRIMINATOR,
    })
  ) as Encoder<GumballGuardAccountDataArgs<DA>>;
}

export function getGumballGuardAccountDataDecoder<D extends GuardSet>(
  manifests: AnyGuardManifest[] = getDefaultGuardManifests()
): Decoder<GumballGuardAccountData<D>> {
  return getStructDecoder([
    ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
    ['base', getAddressDecoder()],
    ['bump', getU8Decoder()],
    ['authority', getAddressDecoder()],
    ['guards', getGuardSetDecoder<D>(manifests)],
    ['groups', getArrayDecoder(getGuardGroupDecoder<D>(manifests))],
  ]) as Decoder<GumballGuardAccountData<D>>;
}

export function getGumballGuardAccountDataCodec<
  DA extends GuardSetArgs,
  D extends DA & GuardSet,
>(
  manifests: AnyGuardManifest[] = getDefaultGuardManifests()
): Codec<GumballGuardAccountDataArgs<DA>, GumballGuardAccountData<D>> {
  return combineCodec(
    getGumballGuardAccountDataEncoder<DA>(manifests),
    getGumballGuardAccountDataDecoder<D>(manifests)
  );
}
