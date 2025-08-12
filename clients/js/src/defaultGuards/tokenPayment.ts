import { findAssociatedTokenPda } from '@metaplex-foundation/mpl-toolbox';
import { PublicKey } from '@metaplex-foundation/umi';
import {
  getTokenPaymentSerializer,
  MachineType,
  TokenPayment,
  TokenPaymentArgs,
} from '../generated';
import { GuardManifest, noopParser } from '../guards';
import { findGumballMachineAuthorityPda } from '../hooked';

/**
 * The tokenPayment guard allows minting by charging the
 * payer a specific amount of tokens from a certain mint acount.
 * The tokens will be transfered to a predefined destination.
 *
 * This guard alone does not limit how many times a holder
 * can mint. A holder can mint as many times as they have
 * the required amount of tokens to pay with.
 */
export const tokenPaymentGuardManifest: GuardManifest<
  TokenPaymentArgs,
  TokenPayment,
  TokenPaymentMintArgs
> = {
  name: 'tokenPayment',
  serializer: getTokenPaymentSerializer,
  mintParser: (context, mintContext, args) => {
    const [sourceAta] = findAssociatedTokenPda(context, {
      mint: args.mint,
      owner: mintContext.payer.publicKey,
    });

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
      remainingAccounts: [
        { publicKey: sourceAta, isWritable: true },
        ...feeAccounts.map((feeAccount) => ({
          publicKey: findAssociatedTokenPda(context, {
            mint: args.mint,
            owner: feeAccount,
          })[0],
          isWritable: true,
        })),
      ],
    };
  },
  routeParser: noopParser,
};

export type TokenPaymentMintArgs = Omit<TokenPaymentArgs, 'amount'> & {
  feeAccounts?: PublicKey[];
};
