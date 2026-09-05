import { fixCodecSize, transformCodec } from '@solana/kit';
import { MaximumOfFiveAdditionalProgramsError } from '../errors';
import {
  getProgramGateCodec,
  ProgramGate,
  ProgramGateArgs,
} from '../generated';
import { GuardManifest, noopParser } from '../guards';

/**
 * The programGate guard restricts the programs that can be invoked within
 * the mint transaction. It allows the necessary programs for the mint
 * instruction to work and any other program specified in the configuration.
 *
 * The `additional` argument allows you to specify additional programs
 * that can be invoked in a mint transaction.
 * These programs are in addition to the mandatory programs that
 * are required for the mint instruction to work. Providing an empty
 * array is equivalent to only authorising the mandatory programs.
 *
 * The mandatory programs are:
 * - The SPL System Program
 * - The SPL Token Program
 * - The SPL Associated Token Program
 * - The SPL Compute Budget Program
 * - The MPL Gumball Machine Core Program
 * - The MPL Gumball Guard Program
 * - The MPL System Extras Program
 */
export const programGateGuardManifest: GuardManifest<
  ProgramGateArgs,
  ProgramGate
> = {
  name: 'programGate',
  codec: () =>
    transformCodec(
      fixCodecSize(getProgramGateCodec(), 4 + 32 * 5),
      (value: ProgramGateArgs) => {
        if (value.additional.length > 5) {
          throw new MaximumOfFiveAdditionalProgramsError();
        }
        return value;
      }
    ),
  mintParser: noopParser,
  routeParser: noopParser,
};
