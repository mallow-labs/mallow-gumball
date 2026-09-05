import { getStartDateCodec, StartDate, StartDateArgs } from '../generated';
import { GuardManifest, noopParser } from '../guards';

/**
 * The startDate guard determines the start date of the mint.
 * Before this date, minting is not allowed.
 */
export const startDateGuardManifest: GuardManifest<StartDateArgs, StartDate> = {
  name: 'startDate',
  codec: getStartDateCodec,
  mintParser: noopParser,
  routeParser: noopParser,
};
