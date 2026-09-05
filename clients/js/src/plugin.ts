import {
  addressGateGuardManifest,
  allocationGuardManifest,
  allowListGuardManifest,
  botTaxGuardManifest,
  endDateGuardManifest,
  gatekeeperGuardManifest,
  mintLimitGuardManifest,
  nftBurnGuardManifest,
  nftGateGuardManifest,
  nftPaymentGuardManifest,
  programGateGuardManifest,
  redeemedAmountGuardManifest,
  solPaymentGuardManifest,
  startDateGuardManifest,
  thirdPartySignerGuardManifest,
  token2022PaymentGuardManifest,
  tokenBurnGuardManifest,
  tokenGateGuardManifest,
  tokenPaymentGuardManifest,
} from './defaultGuards';
import {
  AnyGuardManifest,
  DefaultGuardRepository,
  GuardRepository,
} from './guards';

/**
 * The default guard manifests, in the on-chain guard order the Gumball Guard
 * program expects (this order defines the features-bitset positions).
 *
 * Returned from a function so the manifest module-level consts are always fully
 * initialized by the time it runs (avoids ESM circular-import init pitfalls).
 */
export function getDefaultGuardManifests(): AnyGuardManifest[] {
  return [
    botTaxGuardManifest,
    startDateGuardManifest,
    solPaymentGuardManifest,
    tokenPaymentGuardManifest,
    thirdPartySignerGuardManifest,
    tokenGateGuardManifest,
    gatekeeperGuardManifest,
    endDateGuardManifest,
    allowListGuardManifest,
    mintLimitGuardManifest,
    nftPaymentGuardManifest,
    redeemedAmountGuardManifest,
    addressGateGuardManifest,
    nftGateGuardManifest,
    nftBurnGuardManifest,
    tokenBurnGuardManifest,
    programGateGuardManifest,
    allocationGuardManifest,
    token2022PaymentGuardManifest,
  ];
}

/** Builds a guard repository preloaded with the default guards. */
export function createDefaultGuardRepository(): GuardRepository {
  const repository = new DefaultGuardRepository();
  repository.add(...getDefaultGuardManifests());
  return repository;
}

let sharedRepository: GuardRepository | undefined;

/** A lazily-created shared default guard repository (guards are stateless). */
export function getDefaultGuardRepository(): GuardRepository {
  if (!sharedRepository) {
    sharedRepository = createDefaultGuardRepository();
  }
  return sharedRepository;
}
