import { type Address } from '@solana/kit';
import {
  getTokenPaymentCodec,
  MachineType,
  TokenPayment,
  TokenPaymentArgs,
} from '../generated';
import { GuardManifest, noopParser } from '../guards';
import {
  findAssociatedTokenPda,
  findGumballMachineAuthorityPda,
} from '../hooked';

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
  codec: getTokenPaymentCodec,
  mintParser: async (mintContext, args) => {
    const [sourceAta] = await findAssociatedTokenPda({
      mint: args.mint,
      owner: mintContext.payer.address,
    });

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

    const feeAtas = await Promise.all(
      feeAccounts.map(async (feeAccount) => ({
        address: (
          await findAssociatedTokenPda({
            mint: args.mint,
            owner: feeAccount,
          })
        )[0],
        isWritable: true,
      }))
    );

    return {
      data: new Uint8Array(),
      remainingAccounts: [{ address: sourceAta, isWritable: true }, ...feeAtas],
    };
  },
  routeParser: noopParser,
};

export type TokenPaymentMintArgs = Omit<TokenPaymentArgs, 'amount'> & {
  feeAccounts?: Address[];
};
