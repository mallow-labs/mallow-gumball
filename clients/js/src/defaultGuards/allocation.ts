import { type Address, type TransactionSigner } from '@solana/kit';
import {
  Allocation,
  AllocationArgs,
  findAllocationTrackerPda,
  getAllocationCodec,
} from '../generated';
import { GuardManifest, GuardRemainingAccount } from '../guards';

const SYSTEM_PROGRAM_ADDRESS = '11111111111111111111111111111111' as Address;

/**
 * Guard to specify the maximum number of mints in a guard set.
 *
 */
export const allocationGuardManifest: GuardManifest<
  AllocationArgs,
  Allocation,
  AllocationMintArgs,
  AllocationRouteArgs
> = {
  name: 'allocation',
  codec: getAllocationCodec,
  mintParser: async (mintContext, args) => ({
    data: new Uint8Array(),
    remainingAccounts: [
      {
        address: (
          await findAllocationTrackerPda({
            id: args.id,
            machine: mintContext.machine,
            gumballGuard: mintContext.gumballGuard,
          })
        )[0],
        isWritable: true,
      },
    ],
  }),
  routeParser: async (routeContext, args) => {
    const remainingAccounts: GuardRemainingAccount[] = [
      {
        isWritable: true,
        address: (
          await findAllocationTrackerPda({
            id: args.id,
            machine: routeContext.machine,
            gumballGuard: routeContext.gumballGuard,
          })
        )[0],
      },
      { isWritable: false, signer: args.gumballGuardAuthority },
      { isWritable: false, address: SYSTEM_PROGRAM_ADDRESS },
    ];
    return { data: new Uint8Array(), remainingAccounts };
  },
};

export type AllocationMintArgs = Omit<AllocationArgs, 'limit'>;

/**
 * The allocation guard arguments that should be provided
 * when accessing the guard's special "route" instruction.
 */
export type AllocationRouteArgs = Omit<AllocationArgs, 'limit'> & {
  /** The authority of the Gumball Guard as a Signer. */
  gumballGuardAuthority: TransactionSigner;
};
