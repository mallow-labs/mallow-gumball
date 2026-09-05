import { PublicKey } from '@metaplex-foundation/umi';
import {
  getSolPaymentSerializer,
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
  serializer: getSolPaymentSerializer,
  mintParser: (context, mintContext, args) => {
    const feeAccounts: PublicKey[] = [];
    if (mintContext.machineType === MachineType.Gumball) {
      feeAccounts.push(
        findGumballMachineAuthorityPda(context, {
          gumballMachine: mintContext.machine,
        })[0]
      );
    }

    if (args.feeAccounts) {
      feeAccounts.push(...args.feeAccounts);
    }

    return {
      data: new Uint8Array(),
      remainingAccounts: feeAccounts.map((feeAccount) => ({
        publicKey: feeAccount,
        isWritable: true,
      })),
    };
  },
  routeParser: noopParser,
};

export type SolPaymentMintArgs = {
  feeAccounts?: PublicKey[];
};
