/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  ClusterFilter,
  Context,
  Program,
  PublicKey,
} from '@metaplex-foundation/umi';
import {
  getGumballGuardErrorFromCode,
  getGumballGuardErrorFromName,
} from '../errors';

export const GUMBALL_GUARD_PROGRAM_ID =
  'GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF' as PublicKey<'GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF'>;

export function createGumballGuardProgram(): Program {
  return {
    name: 'gumballGuard',
    publicKey: GUMBALL_GUARD_PROGRAM_ID,
    getErrorFromCode(code: number, cause?: Error) {
      return getGumballGuardErrorFromCode(code, this, cause);
    },
    getErrorFromName(name: string, cause?: Error) {
      return getGumballGuardErrorFromName(name, this, cause);
    },
    isOnCluster() {
      return true;
    },
  };
}

export function getGumballGuardProgram<T extends Program = Program>(
  context: Pick<Context, 'programs'>,
  clusterFilter?: ClusterFilter
): T {
  return context.programs.get<T>('gumballGuard', clusterFilter);
}

export function getGumballGuardProgramId(
  context: Pick<Context, 'programs'>,
  clusterFilter?: ClusterFilter
): PublicKey {
  return context.programs.getPublicKey(
    'gumballGuard',
    GUMBALL_GUARD_PROGRAM_ID,
    clusterFilter
  );
}
