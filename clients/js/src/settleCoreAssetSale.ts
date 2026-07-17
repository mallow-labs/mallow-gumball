import { AccountRole, type Address, type Instruction } from '@solana/kit';
import { NATIVE_MINT } from './constants';
import {
  getBaseSettleCoreAssetSaleInstructionAsync,
  type BaseSettleCoreAssetSaleAsyncInput,
} from './generated';
import { findAssociatedTokenPda } from './hooked';

export type SettleCoreAssetSaleInput = BaseSettleCoreAssetSaleAsyncInput & {
  creators: Address[];
};

/**
 * Builds the `baseSettleCoreAssetSale` instruction and appends the creator
 * royalty remaining accounts (and their payment-mint ATAs for SPL payments).
 */
export const getSettleCoreAssetSaleInstructionAsync = async (
  input: SettleCoreAssetSaleInput
): Promise<Instruction> => {
  const { creators, ...rest } = input;
  const instruction = await getBaseSettleCoreAssetSaleInstructionAsync(rest);
  const isNativePayment =
    input.paymentMint == null || input.paymentMint === NATIVE_MINT;

  const remaining = [];
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
      });
      remaining.push({ address: ata, role: AccountRole.WRITABLE });
    }
  }

  return {
    ...instruction,
    accounts: [...(instruction.accounts ?? []), ...remaining],
  };
};
