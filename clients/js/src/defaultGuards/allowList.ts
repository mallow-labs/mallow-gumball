import {
  fixEncoderSize,
  getArrayEncoder,
  getBytesEncoder,
  type Address,
  type TransactionSigner,
} from '@solana/kit';
import {
  AllowList,
  AllowListArgs,
  findAllowListProofPda,
  getAllowListCodec,
} from '../generated';
import { GuardManifest, GuardRemainingAccount } from '../guards';

const SYSTEM_PROGRAM_ADDRESS = '11111111111111111111111111111111' as Address;

const toAddress = (value: Address | TransactionSigner): Address =>
  typeof value === 'string' ? value : value.address;

/**
 * The allowList guard validates the minting wallet against
 * a predefined list of wallets.
 *
 * Instead of passing the entire list of wallets as settings,
 * this guard accepts the Root of a Merkle Tree created from
 * this allow list. The program can then validate that the minting
 * wallet is part of the allow list by requiring a Merkle Proof.
 * Minting will fail if either the minting address is not part of
 * the merkle tree or if no Merkle Proof is specified.
 *
 * You may use the `getMerkleRoot` and `getMerkleProof` helper
 * functions provided by the SDK to help you set up this guard.
 * Here is an example.
 *
 * ```ts
 * import { getMerkleProof, getMerkleRoot } from '@mallow-labs/mallow-gumball';
 * const allowList = [
 *   'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
 *   'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
 *   'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
 * ];
 * const merkleRoot = getMerkleRoot(allowList);
 * const validMerkleProof = getMerkleProof(allowList, 'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB');
 * const invalidMerkleProof = getMerkleProof(allowList, 'invalid-address');
 * ```
 *
 * Note that you will need to provide the Merkle Proof for the
 * minting wallet before calling the mint instruction via the
 * special "route" instruction of the guard.
 * See {@link AllowListRouteArgs} for more information.
 */
export const allowListGuardManifest: GuardManifest<
  AllowListArgs,
  AllowList,
  AllowListMintArgs,
  AllowListRouteArgs
> = {
  name: 'allowList',
  codec: getAllowListCodec,
  mintParser: async (mintContext, args) => ({
    data: new Uint8Array(),
    remainingAccounts: [
      {
        isWritable: false,
        address: (
          await findAllowListProofPda({
            merkleRoot: args.merkleRoot,
            user: mintContext.buyer.address,
            machine: mintContext.machine,
            gumballGuard: mintContext.gumballGuard,
          })
        )[0],
      },
    ],
  }),
  routeParser: async (routeContext, args) => {
    const remainingAccounts: GuardRemainingAccount[] = [
      {
        isWritable: true,
        address: (
          await findAllowListProofPda({
            merkleRoot: args.merkleRoot,
            user: args.buyer
              ? toAddress(args.buyer)
              : routeContext.payer.address,
            machine: routeContext.machine,
            gumballGuard: routeContext.gumballGuard,
          })
        )[0],
      },
      { isWritable: false, address: SYSTEM_PROGRAM_ADDRESS },
      ...(args.buyer !== undefined
        ? [{ isWritable: false, address: toAddress(args.buyer) }]
        : []),
    ];
    return {
      data: new Uint8Array(
        getArrayEncoder(fixEncoderSize(getBytesEncoder(), 32)).encode(
          args.merkleProof
        )
      ),
      remainingAccounts,
    };
  },
};

export type AllowListMintArgs = AllowListArgs;

/**
 * The settings for the allowList guard that should be provided
 * when accessing the guard's special "route" instruction.
 *
 * ## Proof
 * The `proof` path allows you to provide a Merkle Proof
 * for a specific wallet in order to allow minting for that wallet.
 * This will create a small PDA account on the Program as a proof
 * that the wallet has been allowed to mint.
 *
 * ```ts
 * route(umi, {
 *   // ...
 *   guard: 'allowList',
 *   routeArgs: {
 *     path: 'proof',
 * .   merkleRoot: getMerkleRoot(allowList),
 *     merkleProof: getMerkleProof(allowList, base58PublicKey(umi.identity)),
 *   },
 * });
 *
 * // You are now allows to mint with this wallet.
 * ```
 */
export type AllowListRouteArgs = AllowListArgs & {
  /** Selects the path to execute in the route instruction. */
  path: 'proof';

  /**
   * The Proof that the minting wallet is part of the
   * Merkle Tree-based allow list. You may use the
   * `getMerkleProof` helper function to generate this.
   */
  merkleProof: Uint8Array[];

  /**
   * The address of the minter to validate if it is not the payer.
   * Here, we allow it to be a Signer for backwards compatibility
   * but the account will not be used as a signer.
   */
  buyer?: Address | TransactionSigner;
};
