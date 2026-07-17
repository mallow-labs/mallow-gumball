import { type Address } from '@solana/kit';
import {
  getSolPaymentCodec,
  MachineType,
  SolPayment,
  SolPaymentArgs,
} from '../generated';
import { GuardManifest, noopParser } from '../guards';
import { findGumballMachineAuthorityPda } from '../hooked';

/**
 * The solPayment guard is used to charge an
 * amount in SOL for the minted NFT.
 */
export const solPaymentGuardManifest: GuardManifest<
  SolPaymentArgs,
  SolPayment,
  SolPaymentMintArgs
> = {
  name: 'solPayment',
  codec: getSolPaymentCodec,
  mintParser: async (mintContext, args) => {
    const feeAccounts: Address[] = [];
    if (mintContext.machineType === MachineType.Gumball) {
      feeAccounts.push(
        (
          await findGumballMachineAuthorityPda({
            gumballMachine: mintContext.machine,
          })
        )[0]
      );
    }

    if (args.feeAccounts) {
      feeAccounts.push(...args.feeAccounts);
    }

    return {
      data: new Uint8Array(),
      remainingAccounts: feeAccounts.map((feeAccount) => ({
        address: feeAccount,
        isWritable: true,
      })),
    };
  },
  routeParser: noopParser,
};

export type SolPaymentMintArgs = {
  feeAccounts?: Address[];
};
