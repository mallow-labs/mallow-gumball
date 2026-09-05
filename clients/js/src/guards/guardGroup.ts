import {
  combineCodec,
  createDecoder,
  createEncoder,
  getUtf8Decoder,
  getUtf8Encoder,
  type Codec,
  type Decoder,
  type Encoder,
} from '@solana/kit';
import { GUMBALL_GUARD_LABEL_SIZE } from '../constants';
import { GuardGroupLabelTooLongError } from '../errors';
import { AnyGuardManifest } from './guardRepository';
import {
  getGuardSetDecoder,
  getGuardSetEncoder,
  GuardSet,
  GuardSetArgs,
} from './guardSet';

/**
 * A group represent a specific set of guards. When groups are used, transactions
 * must specify which group should be used during validation.
 */
export type GuardGroup<D extends GuardSet> = {
  label: string;
  guards: D;
};

export type GuardGroupArgs<DA extends GuardSetArgs> = {
  label: string;
  guards: Partial<DA>;
};

const utf8Encoder = getUtf8Encoder();
const utf8Decoder = getUtf8Decoder();

function encodeLabel(label: string): Uint8Array {
  if (label.length > GUMBALL_GUARD_LABEL_SIZE) {
    throw new GuardGroupLabelTooLongError(label);
  }
  const bytes = new Uint8Array(GUMBALL_GUARD_LABEL_SIZE);
  bytes.set(
    new Uint8Array(utf8Encoder.encode(label)).slice(
      0,
      GUMBALL_GUARD_LABEL_SIZE
    ),
    0
  );
  return bytes;
}

export function getGuardGroupEncoder<DA extends GuardSetArgs>(
  manifests: AnyGuardManifest[]
): Encoder<GuardGroupArgs<DA>> {
  const guardsEncoder = getGuardSetEncoder<DA>(manifests);
  return createEncoder({
    getSizeFromValue: (group: GuardGroupArgs<DA>) =>
      GUMBALL_GUARD_LABEL_SIZE + guardsEncoder.encode(group.guards).length,
    write: (group: GuardGroupArgs<DA>, bytes, offset) => {
      bytes.set(encodeLabel(group.label), offset);
      return guardsEncoder.write(
        group.guards,
        bytes,
        offset + GUMBALL_GUARD_LABEL_SIZE
      );
    },
  });
}

export function getGuardGroupDecoder<D extends GuardSet>(
  manifests: AnyGuardManifest[]
): Decoder<GuardGroup<D>> {
  const guardsDecoder = getGuardSetDecoder<D>(manifests);
  return createDecoder({
    read: (bytes, offset) => {
      const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const labelBytes = view.slice(offset, offset + GUMBALL_GUARD_LABEL_SIZE);
      const label = utf8Decoder.decode(labelBytes).replace(/\0+$/, '');
      const [guards, newOffset] = guardsDecoder.read(
        bytes,
        offset + GUMBALL_GUARD_LABEL_SIZE
      );
      return [{ label, guards }, newOffset];
    },
  });
}

export function getGuardGroupCodec<
  DA extends GuardSetArgs,
  D extends DA & GuardSet,
>(manifests: AnyGuardManifest[]): Codec<GuardGroupArgs<DA>, GuardGroup<D>> {
  return combineCodec(
    getGuardGroupEncoder<DA>(manifests),
    getGuardGroupDecoder<D>(manifests)
  );
}
