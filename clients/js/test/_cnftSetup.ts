/* eslint-disable import/no-extraneous-dependencies */
import {
  createTree,
  findLeafAssetIdPda,
  findTreeConfigPda,
  getMerkleProof,
  getMerkleRoot,
  getMetadataArgsSerializer,
  hash,
  hashLeaf,
  MetadataArgsArgs,
  mintV1,
  mplBubblegum,
} from '@metaplex-foundation/mpl-bubblegum';
import {
  generateSigner,
  none,
  publicKey,
  publicKeyBytes,
  PublicKey,
  Signer,
  Umi,
} from '@metaplex-foundation/umi';
import { CnftArgsArgs } from '../src';

// Small trees keep proofs simple (canopy 0). (5, 8) is a valid Bubblegum
// depth/buffer pair. One leaf per tree (index 0) means the proof siblings are
// just the empty-subtree hashes and never change — only the root moves as the
// leaf owner changes.
export const CNFT_MAX_DEPTH = 5;
export const CNFT_MAX_BUFFER_SIZE = 8;

export type CnftCreatorInput = {
  address: PublicKey;
  verified: boolean;
  share: number;
};

// Everything needed to build a cNFT instruction. `owner` is mutated by the test
// as the leaf is escrowed/claimed so the next proof/root can be recomputed.
export type CnftItem = {
  merkleTree: PublicKey;
  treeConfig: PublicKey;
  leafIndex: number;
  assetId: PublicKey;
  metadata: MetadataArgsArgs;
  metaHash: Uint8Array;
  sellerFeeBasisPoints: number;
  creators: CnftCreatorInput[];
  owner: PublicKey;
};

// A umi already wired with both the gumball and bubblegum programs.
export const createCnftUmi = async (createUmi: () => Promise<Umi>): Promise<Umi> =>
  (await createUmi()).use(mplBubblegum());

export const createBubblegumTree = async (umi: Umi): Promise<Signer> => {
  const merkleTree = generateSigner(umi);
  const builder = await createTree(umi, {
    merkleTree,
    maxDepth: CNFT_MAX_DEPTH,
    maxBufferSize: CNFT_MAX_BUFFER_SIZE,
    public: false,
  });
  await builder.sendAndConfirm(umi);
  return merkleTree;
};

// Mint a single V1 cNFT to `owner` at `leafIndex` (default 0) on a fresh tree.
export const mintCnft = async (
  umi: Umi,
  input: {
    owner?: PublicKey;
    leafIndex?: number;
    sellerFeeBasisPoints?: number;
    creators?: CnftCreatorInput[];
    merkleTree?: Signer;
  } = {}
): Promise<CnftItem> => {
  const merkleTree = input.merkleTree ?? (await createBubblegumTree(umi));
  const owner = input.owner ?? umi.identity.publicKey;
  const leafIndex = input.leafIndex ?? 0;
  const sellerFeeBasisPoints = input.sellerFeeBasisPoints ?? 500;
  const creators = input.creators ?? [
    { address: owner, verified: false, share: 100 },
  ];

  const metadata: MetadataArgsArgs = {
    name: 'My cNFT',
    uri: 'https://example.com/my-cnft.json',
    sellerFeeBasisPoints,
    collection: none(),
    creators: creators.map((c) => ({
      address: c.address,
      verified: c.verified,
      share: c.share,
    })),
  };

  await mintV1(umi, {
    leafOwner: owner,
    merkleTree: merkleTree.publicKey,
    metadata,
  }).sendAndConfirm(umi);

  const [assetId] = findLeafAssetIdPda(umi, {
    merkleTree: merkleTree.publicKey,
    leafIndex,
  });
  const [treeConfig] = findTreeConfigPda(umi, {
    merkleTree: merkleTree.publicKey,
  });

  // Inner keccak(borsh(MetadataArgs)); on-chain `data_hash = keccak(metaHash ‖ sfbp_le)`.
  const metaHash = hash(getMetadataArgsSerializer().serialize(metadata));

  return {
    merkleTree: merkleTree.publicKey,
    treeConfig: publicKey(treeConfig),
    leafIndex,
    assetId: publicKey(assetId),
    metadata,
    metaHash,
    sellerFeeBasisPoints,
    creators,
    owner: publicKey(owner),
  };
};

// Recompute the current leaf hash, root and proof for `item.owner`. Because each
// test tree has a single leaf at index 0, the proof is stable and the root
// tracks the current owner.
export const getCnftProof = (
  umi: Umi,
  item: CnftItem
): { root: PublicKey; proof: PublicKey[]; leaf: PublicKey } => {
  const leaf = publicKey(
    hashLeaf(umi, {
      merkleTree: item.merkleTree,
      owner: item.owner,
      leafIndex: item.leafIndex,
      metadata: item.metadata,
    })
  );
  const leaves = [leaf];
  const root = getMerkleRoot(leaves, CNFT_MAX_DEPTH);
  const proof = getMerkleProof(leaves, CNFT_MAX_DEPTH, leaf, item.leafIndex);
  return { root, proof, leaf };
};

// Build the CnftArgs struct for the current tree state.
export const cnftArgs = (
  umi: Umi,
  item: CnftItem,
  overrides: Partial<CnftArgsArgs> = {}
): CnftArgsArgs => {
  const { root } = getCnftProof(umi, item);
  return {
    root: publicKeyBytes(root),
    metaHash: item.metaHash,
    sellerFeeBasisPoints: item.sellerFeeBasisPoints,
    creators: item.creators,
    nonce: item.leafIndex,
    index: item.leafIndex,
    version: 1,
    ...overrides,
  };
};

// Proof nodes formatted as read-only, non-signer remaining accounts.
export const proofAccounts = (proof: PublicKey[]) =>
  proof.map((pubkey) => ({ pubkey, isSigner: false, isWritable: false }));

// Creator payout accounts (native SOL: one wallet each), followed by proof.
export const settleRemainingAccounts = (
  creators: CnftCreatorInput[],
  proof: PublicKey[]
) => [
  ...creators.map((c) => ({
    pubkey: c.address,
    isSigner: false,
    isWritable: true,
  })),
  ...proofAccounts(proof),
];
