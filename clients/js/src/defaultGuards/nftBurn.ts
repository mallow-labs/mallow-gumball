import { type Address } from '@solana/kit';
import {
  getNftBurnCodec,
  NftBurn,
  NftBurnArgs,
  TokenStandard,
} from '../generated';
import { GuardManifest, GuardRemainingAccount, noopParser } from '../guards';
import {
  findAssociatedTokenPda,
  findMasterEditionPda,
  findMetadataPda,
  findTokenRecordPda,
} from '../hooked';

const isProgrammable = (tokenStandard: TokenStandard): boolean =>
  tokenStandard === TokenStandard.ProgrammableNonFungible;

/**
 * The nftBurn guard restricts the mint to holders of a predefined
 * NFT Collection and burns the holder's NFT when minting.
 *
 * This means the mint address of the NFT to burn must be
 * passed when minting. This guard alone does not limit how many
 * times a holder can mint. A holder can mint as many times
 * as they have NFTs from the required collection to burn.
 */
export const nftBurnGuardManifest: GuardManifest<
  NftBurnArgs,
  NftBurn,
  NftBurnMintArgs
> = {
  name: 'nftBurn',
  codec: getNftBurnCodec,
  mintParser: async (mintContext, args) => {
    const nftTokenAccount =
      args.tokenAccount ??
      (
        await findAssociatedTokenPda({
          mint: args.mint,
          owner: mintContext.buyer.address,
        })
      )[0];
    const [nftMetadata] = await findMetadataPda({ mint: args.mint });
    const [nftMasterEdition] = await findMasterEditionPda({
      mint: args.mint,
    });
    const [collectionMetadata] = await findMetadataPda({
      mint: args.requiredCollection,
    });

    const remainingAccounts: GuardRemainingAccount[] = [
      { address: nftTokenAccount, isWritable: true },
      { address: nftMetadata, isWritable: true },
      { address: nftMasterEdition, isWritable: true },
      { address: args.mint, isWritable: true },
      { address: collectionMetadata, isWritable: true },
    ];

    if (isProgrammable(args.tokenStandard)) {
      const [nftTokenRecord] = await findTokenRecordPda({
        mint: args.mint,
        token: nftTokenAccount,
      });
      remainingAccounts.push({ address: nftTokenRecord, isWritable: true });
    }

    return { data: new Uint8Array(), remainingAccounts };
  },
  routeParser: noopParser,
};

export type NftBurnMintArgs = NftBurnArgs & {
  /**
   * The mint address of the NFT to burn.
   * This must be part of the required collection and must
   * belong to the payer.
   */
  mint: Address;

  /**
   * The token standard of the NFT to burn.
   */
  tokenStandard: TokenStandard;

  /**
   * The token account linking the NFT with its owner.
   *
   * @defaultValue
   * Defaults to the associated token address using the
   * mint address of the NFT and the payer's address.
   */
  tokenAccount?: Address;
};
