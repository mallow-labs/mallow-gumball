import { type Address } from '@solana/kit';
import {
  getNftPaymentCodec,
  NftPayment,
  NftPaymentArgs,
  TokenStandard,
} from '../generated';
import { GuardManifest, GuardRemainingAccount, noopParser } from '../guards';
import {
  findAssociatedTokenPda,
  findMasterEditionPda,
  findMetadataPda,
  findTokenRecordPda,
} from '../hooked';

const ASSOCIATED_TOKEN_PROGRAM_ID =
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address;
const TOKEN_AUTH_RULES_PROGRAM_ID =
  'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg' as Address;

const isProgrammable = (tokenStandard: TokenStandard): boolean =>
  tokenStandard === TokenStandard.ProgrammableNonFungible;

/**
 * The nftPayment guard allows minting by charging the
 * payer an NFT from a specified NFT collection.
 * The NFT will be transfered to a predefined destination.
 *
 * This means the mint address of the NFT to transfer must be
 * passed when minting. This guard alone does not limit how many
 * times a holder can mint. A holder can mint as many times
 * as they have NFTs from the required collection to pay with.
 */
export const nftPaymentGuardManifest: GuardManifest<
  NftPaymentArgs,
  NftPayment,
  NftPaymentMintArgs
> = {
  name: 'nftPayment',
  codec: getNftPaymentCodec,
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
    const [destinationAta] = await findAssociatedTokenPda({
      mint: args.mint,
      owner: args.destination,
    });

    const remainingAccounts: GuardRemainingAccount[] = [
      { address: nftTokenAccount, isWritable: true },
      { address: nftMetadata, isWritable: true },
      { address: args.mint, isWritable: false },
      { address: args.destination, isWritable: false },
      { address: destinationAta, isWritable: true },
      {
        address: ASSOCIATED_TOKEN_PROGRAM_ID,
        isWritable: false,
      },
    ];

    if (isProgrammable(args.tokenStandard)) {
      const [nftMasterEdition] = await findMasterEditionPda({
        mint: args.mint,
      });
      const [ownerTokenRecord] = await findTokenRecordPda({
        mint: args.mint,
        token: nftTokenAccount,
      });
      const [destinationTokenRecord] = await findTokenRecordPda({
        mint: args.mint,
        token: destinationAta,
      });
      remainingAccounts.push(
        ...[
          { address: nftMasterEdition, isWritable: false },
          { address: ownerTokenRecord, isWritable: true },
          { address: destinationTokenRecord, isWritable: true },
        ]
      );

      if (args.ruleSet) {
        remainingAccounts.push(
          ...[
            { address: TOKEN_AUTH_RULES_PROGRAM_ID, isWritable: false },
            { address: args.ruleSet, isWritable: false },
          ]
        );
      }
    }

    return { data: new Uint8Array(), remainingAccounts };
  },
  routeParser: noopParser,
};

export type NftPaymentMintArgs = Omit<NftPaymentArgs, 'requiredCollection'> & {
  /**
   * The mint address of the NFT to pay with.
   * This must be part of the required collection and must
   * belong to the payer.
   */
  mint: Address;

  /**
   * The token standard of the NFT used to pay.
   */
  tokenStandard: TokenStandard;

  /**
   * The ruleSet of the PNFT used to pay, if any.
   *
   * @defaultValue Default to not using a ruleSet.
   */
  ruleSet?: Address;

  /**
   * The token account linking the NFT with its owner.
   *
   * @defaultValue
   * Defaults to the associated token address using the
   * mint address of the NFT and the payer's address.
   */
  tokenAccount?: Address;
};
