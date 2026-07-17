import { type Address } from '@solana/kit';
import {
  getNftGateCodec,
  NftGate,
  NftGateArgs,
  TokenStandard,
} from '../generated';
import { GuardManifest, noopParser } from '../guards';
import { findAssociatedTokenPda, findMetadataPda } from '../hooked';

/**
 * The nftGate guard restricts minting to holders
 * of a specified NFT collection.
 *
 * This means the mint address of an NFT from this
 * collection must be passed when minting.
 */
export const nftGateGuardManifest: GuardManifest<
  NftGateArgs,
  NftGate,
  NftGateMintArgs
> = {
  name: 'nftGate',
  codec: getNftGateCodec,
  mintParser: async (mintContext, args) => {
    const tokenStandard = args.tokenStandard ?? TokenStandard.NonFungible;

    switch (tokenStandard) {
      case TokenStandard.Core: {
        return {
          data: new Uint8Array(),
          remainingAccounts: [
            { address: args.mint, isWritable: false },
            { address: args.mint, isWritable: false },
          ],
        };
      }
      default: {
        const tokenAccount =
          args.tokenAccount ??
          (
            await findAssociatedTokenPda({
              mint: args.mint,
              owner: mintContext.buyer.address,
            })
          )[0];
        const [tokenMetadata] = await findMetadataPda({ mint: args.mint });
        return {
          data: new Uint8Array(),
          remainingAccounts: [
            { address: tokenAccount, isWritable: false },
            { address: tokenMetadata, isWritable: false },
          ],
        };
      }
    }
  },
  routeParser: noopParser,
};

export type NftGateMintArgs = {
  /**
   * The mint address of an NFT from the required
   * collection that belongs to the payer.
   */
  mint: Address;

  /**
   * The token account linking the NFT with its owner.
   *
   * @defaultValue
   * Defaults to the associated token address using the
   * mint address of the NFT and the payer's address.
   */
  tokenAccount?: Address;

  /**
   * The token standard of the NFT.
   *
   * @defaultValue
   * Defaults to `TokenStandard.NonFungible`.
   */
  tokenStandard?: TokenStandard;
};
