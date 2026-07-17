import {
  combineCodec,
  getArrayDecoder,
  getArrayEncoder,
  getStructDecoder,
  getStructEncoder,
  type Codec,
  type Decoder,
  type Encoder,
} from '@solana/kit';
import {
  AnyGuardManifest,
  getGuardGroupDecoder,
  getGuardGroupEncoder,
  getGuardSetDecoder,
  getGuardSetEncoder,
  GuardGroup,
  GuardGroupArgs,
  GuardSet,
  GuardSetArgs,
} from '../guards';
import { getDefaultGuardManifests } from '../plugin';

export type GumballGuardData<D extends GuardSet> = {
  guards: D;
  groups: Array<GuardGroup<D>>;
};

export type GumballGuardDataArgs<DA extends GuardSetArgs> = {
  guards: Partial<DA>;
  groups: Array<GuardGroupArgs<DA>>;
};

export function getGumballGuardDataEncoder<DA extends GuardSetArgs>(
  manifests: AnyGuardManifest[] = getDefaultGuardManifests()
): Encoder<GumballGuardDataArgs<DA>> {
  return getStructEncoder([
    ['guards', getGuardSetEncoder<DA>(manifests)],
    ['groups', getArrayEncoder(getGuardGroupEncoder<DA>(manifests))],
  ]) as Encoder<GumballGuardDataArgs<DA>>;
}

export function getGumballGuardDataDecoder<D extends GuardSet>(
  manifests: AnyGuardManifest[] = getDefaultGuardManifests()
): Decoder<GumballGuardData<D>> {
  return getStructDecoder([
    ['guards', getGuardSetDecoder<D>(manifests)],
    ['groups', getArrayDecoder(getGuardGroupDecoder<D>(manifests))],
  ]) as Decoder<GumballGuardData<D>>;
}

export function getGumballGuardDataCodec<
  DA extends GuardSetArgs,
  D extends DA & GuardSet,
>(
  manifests: AnyGuardManifest[] = getDefaultGuardManifests()
): Codec<GumballGuardDataArgs<DA>, GumballGuardData<D>> {
  return combineCodec(
    getGumballGuardDataEncoder<DA>(manifests),
    getGumballGuardDataDecoder<D>(manifests)
  );
}
