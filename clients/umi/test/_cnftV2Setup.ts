/* eslint-disable import/no-extraneous-dependencies */
import {
  createTreeV2,
  findLeafAssetIdPda,
  findTreeConfigPda,
  getMetadataArgsV2Serializer,
  hash,
  hashAssetData,
  hashLeafV2,
  MetadataArgsV2Args,
  mintV2,
  mplBubblegum,
} from '@metaplex-foundation/mpl-bubblegum';
import {
  ExternalPluginAdapterSchema,
  ExternalPluginAdapterType,
  getExternalPluginAdapterSerializer,
  getPluginHeaderV1AccountDataSerializer,
  getPluginSerializer,
  PluginType,
} from '@metaplex-foundation/mpl-core';
import { getCollectionV1AccountDataSerializer } from '@metaplex-foundation/mpl-core/dist/src/generated/types/collectionV1AccountData';
import { getPluginRegistryV1AccountDataSerializer } from '@metaplex-foundation/mpl-core/dist/src/generated/types/pluginRegistryV1AccountData';
import {
  generateSigner,
  none,
  publicKey,
  PublicKey,
  publicKeyBytes,
  Signer,
  some,
  Umi,
} from '@metaplex-foundation/umi';
import { Account } from 'litesvm/dist/internal';
import { CnftArgsV2Args } from '../src';
import { CnftCreatorInput } from './_cnftSetup';
import { getSvm } from './litesvm/svm';
export { proofAccounts, settleRemainingAccounts } from './_cnftSetup';

// Model collection growth after escrow without sending an oversized instruction.
// Keep every existing plugin body and offset intact; append Attributes before
// the registry and move only the registry pointer.
export const addLargeCollectionAttributes = (
  collection: PublicKey,
  size = 40_000,
  count = 1
) => {
  const svm = getSvm();
  const key = publicKeyBytes(collection);
  const account = svm.getAccount(key)!;
  const data = account.data();
  const [, baseLen] = getCollectionV1AccountDataSerializer().deserialize(data);
  const headerSerializer = getPluginHeaderV1AccountDataSerializer();
  const [header] = headerSerializer.deserialize(data, baseLen);
  const registrySerializer = getPluginRegistryV1AccountDataSerializer();
  const registryOffset = Number(header.pluginRegistryOffset);
  const [registry] = registrySerializer.deserialize(data, registryOffset);
  const attributes = getPluginSerializer().serialize({
    __kind: 'Attributes',
    fields: [
      {
        attributeList: Array.from({ length: count }, () => ({
          key: count === 1 ? 'large' : 'k',
          value: 'x'.repeat(size),
        })),
      },
    ],
  });
  const newHeader = headerSerializer.serialize({
    ...header,
    pluginRegistryOffset: registryOffset + attributes.length,
  });
  const newRegistry = registrySerializer.serialize({
    ...registry,
    registry: [
      ...registry.registry,
      {
        pluginType: PluginType.Attributes,
        authority: { __kind: 'UpdateAuthority' },
        offset: registryOffset,
      },
    ],
  });
  const enlarged = new Uint8Array(
    registryOffset + attributes.length + newRegistry.length
  );
  enlarged.set(data.slice(0, registryOffset));
  enlarged.set(newHeader, baseLen);
  enlarged.set(attributes, registryOffset);
  enlarged.set(newRegistry, registryOffset + attributes.length);
  svm.setAccount(
    key,
    new Account(
      account.lamports() + 1_000_000_000n,
      enlarged,
      account.owner(),
      false,
      0n
    )
  );
};

// Append valid, distinct AppData adapters after escrow. Internal offsets stay fixed.
export const addCollectionExternalAdapters = (
  umi: Umi,
  collection: PublicKey,
  count: number,
  dataSize = 0
) => {
  const svm = getSvm();
  const key = publicKeyBytes(collection);
  const account = svm.getAccount(key)!;
  const data = account.data();
  const [, baseLen] = getCollectionV1AccountDataSerializer().deserialize(data);
  const headerSerializer = getPluginHeaderV1AccountDataSerializer();
  const [header] = headerSerializer.deserialize(data, baseLen);
  const registrySerializer = getPluginRegistryV1AccountDataSerializer();
  const offset = Number(header.pluginRegistryOffset);
  const [registry] = registrySerializer.deserialize(data, offset);
  const bodies: Uint8Array[] = [];
  let cursor = offset;
  const records = Array.from({ length: count }, () => {
    const body = getExternalPluginAdapterSerializer().serialize({
      __kind: 'AppData',
      fields: [
        {
          dataAuthority: {
            __kind: 'Address',
            address: generateSigner(umi).publicKey,
          },
          schema: ExternalPluginAdapterSchema.Binary,
        },
      ],
    });
    const record = {
      pluginType: ExternalPluginAdapterType.AppData,
      authority: { __kind: 'UpdateAuthority' as const },
      lifecycleChecks: none(),
      offset: cursor,
      dataOffset: some(cursor + body.length),
      dataLen: some(dataSize),
    };
    bodies.push(new Uint8Array([...body, ...new Uint8Array(dataSize)]));
    cursor += body.length + dataSize;
    return record;
  });
  const newRegistry = registrySerializer.serialize({
    ...registry,
    externalRegistry: [...registry.externalRegistry, ...records],
  });
  const enlarged = new Uint8Array(cursor + newRegistry.length);
  enlarged.set(data.slice(0, offset));
  enlarged.set(
    headerSerializer.serialize({ ...header, pluginRegistryOffset: cursor }),
    baseLen
  );
  let bodyOffset = offset;
  for (const body of bodies) {
    enlarged.set(body, bodyOffset);
    bodyOffset += body.length;
  }
  enlarged.set(newRegistry, cursor);
  svm.setAccount(
    key,
    new Account(
      account.lamports() + 1_000_000_000n,
      enlarged,
      account.owner(),
      false,
      0n
    )
  );
};

export type CnftV2Item = {
  merkleTree: PublicKey;
  merkleTreeSigner?: Signer;
  treeConfig: PublicKey;
  leafIndex: number;
  assetId: PublicKey;
  metadata: MetadataArgsV2Args;
  metaHash: Uint8Array;
  sellerFeeBasisPoints: number;
  creators: CnftCreatorInput[];
  owner: PublicKey;
  delegate?: PublicKey;
  collection?: PublicKey;
  depth: number;
  canopyDepth: number;
  flags: number;
  assetData?: Uint8Array;
};
export const createCnftUmi = async (
  createUmi: () => Promise<Umi>
): Promise<Umi> => (await createUmi()).use(mplBubblegum());

export const mintCnft = async (
  umi: Umi,
  input: {
    owner?: PublicKey;
    delegate?: PublicKey;
    sellerFeeBasisPoints?: number;
    creators?: CnftCreatorInput[];
    merkleTree?: Signer;
    leafIndex?: number;
    collection?: PublicKey;
    depth?: number;
    canopyDepth?: number;
    maxBufferSize?: number;
  } = {}
): Promise<CnftV2Item> => {
  const merkleTree = input.merkleTree ?? generateSigner(umi);
  const depth = input.depth ?? 5;
  const canopyDepth = input.canopyDepth ?? 0;
  if (!input.merkleTree) {
    await (
      await createTreeV2(umi, {
        merkleTree,
        maxDepth: depth,
        maxBufferSize:
          input.maxBufferSize ?? (depth <= 5 ? 8 : depth === 10 ? 32 : 64),
        canopyDepth,
        public: false,
      })
    ).sendAndConfirm(umi);
  }
  const owner = input.owner ?? umi.identity.publicKey;
  const creators = input.creators ?? [
    { address: owner, verified: false, share: 100 },
  ];
  const sellerFeeBasisPoints = input.sellerFeeBasisPoints ?? 500;
  const metadata: MetadataArgsV2Args = {
    name: 'My v2 cNFT',
    uri: 'https://example.com/my-cnft-v2.json',
    sellerFeeBasisPoints,
    collection: input.collection ?? none(),
    creators,
  };
  await mintV2(umi, {
    leafOwner: owner,
    leafDelegate: input.delegate,
    merkleTree: merkleTree.publicKey,
    coreCollection: input.collection,
    metadata,
  }).sendAndConfirm(umi);
  const [assetId] = findLeafAssetIdPda(umi, {
    merkleTree: merkleTree.publicKey,
    leafIndex: input.leafIndex ?? 0,
  });
  const [treeConfig] = findTreeConfigPda(umi, {
    merkleTree: merkleTree.publicKey,
  });
  return {
    merkleTree: merkleTree.publicKey,
    merkleTreeSigner: merkleTree,
    treeConfig: publicKey(treeConfig),
    leafIndex: input.leafIndex ?? 0,
    assetId: publicKey(assetId),
    metadata,
    metaHash: hash(getMetadataArgsV2Serializer().serialize(metadata)),
    sellerFeeBasisPoints,
    creators,
    owner: publicKey(owner),
    delegate: input.delegate,
    collection: input.collection,
    depth,
    canopyDepth,
    flags: 0,
  };
};

export const getCnftProof = (umi: Umi, item: CnftV2Item) => {
  const leaf = publicKey(
    hashLeafV2(umi, {
      merkleTree: item.merkleTree,
      owner: item.owner,
      delegate: item.delegate ?? item.owner,
      leafIndex: item.leafIndex,
      metadata: item.metadata,
      assetData: item.assetData,
      flags: item.flags,
    })
  );
  // These fixtures have one live leaf; previous slots were burnt. Build the
  // sparse path in O(depth), avoiding a million-node allocation at depth 20.
  const proof: PublicKey[] = [];
  let empty = new Uint8Array(32);
  let node: Uint8Array = publicKeyBytes(leaf);
  for (let level = 0; level < item.depth; level += 1) {
    proof.push(publicKey(empty));
    node = hash(
      (item.leafIndex & (1 << level)) === 0
        ? new Uint8Array([...node, ...empty])
        : new Uint8Array([...empty, ...node])
    );
    empty = hash(new Uint8Array([...empty, ...empty]));
  }
  return {
    leaf,
    root: publicKey(node),
    proof: proof.slice(0, item.depth - item.canopyDepth),
  };
};

export const cnftArgs = (
  umi: Umi,
  item: CnftV2Item,
  overrides: Partial<CnftArgsV2Args> = {}
): CnftArgsV2Args => ({
  root: publicKeyBytes(getCnftProof(umi, item).root),
  metaHash: item.metaHash,
  sellerFeeBasisPoints: item.sellerFeeBasisPoints,
  creators: item.creators,
  nonce: item.leafIndex,
  index: item.leafIndex,
  version: 2,
  assetDataHash: item.assetData ? some(hashAssetData(item.assetData)) : none(),
  flags: item.flags,
  ...overrides,
});
