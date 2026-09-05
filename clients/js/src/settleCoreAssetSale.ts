import { AccountRole, type Address, type Instruction } from '@solana/kit';
import {
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from './constants';
import {
  getBaseSettleCoreAssetSaleInstructionAsync,
  type BaseSettleCoreAssetSaleAsyncInput,
} from './generated';
import {
  findAssociatedTokenPda,
  findGumballMachineAuthorityPda,
} from './hooked';
/** The address of an account input that may be an address or a signer. */
const addressOf = (value: unknown): Address =>
  typeof value === 'string'
    ? (value as Address)
    : (value as { address: Address }).address;

export type SettleCoreAssetSaleInput = BaseSettleCoreAssetSaleAsyncInput & {
  creators: Address[];
  /**
   * The token program that owns the machine's payment mint. Defaults to classic
   * SPL Token; a Token-2022 payment mint must pass it explicitly (TOKEN22_PLAN
   * §D3 — resolved from the token registry, never probed).
   *
   * Two things depend on it: the program id is part of the ATA seeds, so a
   * classic derivation lands on an address Token-2022 never credits; and the
   * on-chain settle path reads the program itself from §D5 remaining-account
   * slot 0, ahead of the creator pairs.
   */
  paymentTokenProgram?: Address;
};

/**
 * Builds the `baseSettleCoreAssetSale` instruction and appends the creator
 * royalty remaining accounts (and their payment-mint ATAs for SPL payments).
 */
export const getSettleCoreAssetSaleInstructionAsync = async (
  input: SettleCoreAssetSaleInput
): Promise<Instruction> => {
  const { creators, paymentTokenProgram, ...rest } = input;
  const tokenProgram = paymentTokenProgram ?? TOKEN_PROGRAM_ID;
  const isNativePayment =
    input.paymentMint == null || input.paymentMint === NATIVE_MINT;

  // The codama-generated resolver derives every payment ATA with the *classic*
  // program (the program id is not among its seeds), which for a Token-2022
  // payment mint produces addresses Token-2022 never created. Resolve them here
  // instead, with the program the caller named, unless they were passed
  // explicitly.
  const paymentAccounts: Partial<{
    authorityPdaPaymentAccount: Address;
    authorityPaymentAccount: Address;
    sellerPaymentAccount: Address;
    feePaymentAccount: Address;
  }> = {};
  if (!isNativePayment && tokenProgram === TOKEN_2022_PROGRAM_ID) {
    const mint = input.paymentMint as Address;
    const [authorityPda] = await findGumballMachineAuthorityPda({
      gumballMachine: addressOf(rest.gumballMachine),
    });
    if (rest.authorityPdaPaymentAccount == null) {
      [paymentAccounts.authorityPdaPaymentAccount] =
        await findAssociatedTokenPda({
          mint,
          owner: authorityPda,
          tokenProgram,
        });
    }
    if (rest.authorityPaymentAccount == null && rest.authority != null) {
      [paymentAccounts.authorityPaymentAccount] = await findAssociatedTokenPda({
        mint,
        owner: addressOf(rest.authority),
        tokenProgram,
      });
    }
    if (rest.sellerPaymentAccount == null && rest.seller != null) {
      [paymentAccounts.sellerPaymentAccount] = await findAssociatedTokenPda({
        mint,
        owner: addressOf(rest.seller),
        tokenProgram,
      });
    }
    if (rest.feePaymentAccount == null && rest.feeAccount != null) {
      [paymentAccounts.feePaymentAccount] = await findAssociatedTokenPda({
        mint,
        owner: addressOf(rest.feeAccount),
        tokenProgram,
      });
    }
  }

  const instruction = await getBaseSettleCoreAssetSaleInstructionAsync({
    ...rest,
    ...paymentAccounts,
  });

  const remaining = [];
  // §D5 slot 0 — before the creator pairs, which is where `claim_proceeds`
  // consumes it. Empty for a classic payment mint, so an existing settle call
  // is byte-for-byte unchanged.
  if (!isNativePayment && tokenProgram === TOKEN_2022_PROGRAM_ID) {
    remaining.push({
      address: TOKEN_2022_PROGRAM_ID,
      role: AccountRole.READONLY,
    });
  }
  for (const creator of creators) {
    remaining.push({
      address: creator,
      role: isNativePayment ? AccountRole.WRITABLE : AccountRole.READONLY,
    });
    if (!isNativePayment) {
      // eslint-disable-next-line no-await-in-loop
      const [ata] = await findAssociatedTokenPda({
        mint: input.paymentMint as Address,
        owner: creator,
        tokenProgram,
      });
      remaining.push({ address: ata, role: AccountRole.WRITABLE });
    }
  }

  return {
    ...instruction,
    accounts: [...(instruction.accounts ?? []), ...remaining],
  };
};
