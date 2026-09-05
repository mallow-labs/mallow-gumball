import { getCreateAccountInstruction } from '@solana-program/system';
import {
  getInitializeAccount3Instruction,
  getInitializeMintInstruction,
  getMintSize,
  getTokenSize,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  AccountRole,
  addEncoderSizePrefix,
  generateKeyPairSigner,
  getAddressEncoder,
  getArrayEncoder,
  getBooleanEncoder,
  getOptionEncoder,
  getStructEncoder,
  getU16Encoder,
  getU32Encoder,
  getU64Encoder,
  getU8Encoder,
  getUtf8Encoder,
  none,
  some,
  type AccountMeta,
  type AccountSignerMeta,
  type Address,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';
import {
  findAssociatedTokenPda,
  findMasterEditionPda,
  findMetadataPda,
  findTokenRecordPda,
} from '../src';
import { COMPUTE_UNITS, sendTransaction, type Client } from './_setup';

// -----------------------------------------------------------------------------
// Hand-rolled @solana/kit instructions for creating real on-chain test assets in
// the LiteSVM ledger. There is no kit client for mpl-token-metadata or mpl-core
// in this repo, so we encode the instructions directly. Layouts mirror the umi
// `createV1` / `mintV1` (mpl-token-metadata) and `createV1` (mpl-core) generated
// clients, matching the umi test helpers in `clients/umi/test/_setup.ts`.
// -----------------------------------------------------------------------------

const TOKEN_METADATA_PROGRAM =
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s' as Address;
const MPL_CORE_PROGRAM =
  'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d' as Address;
const SYSTEM_PROGRAM = '11111111111111111111111111111111' as Address;
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;
const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address;
const SYSVAR_INSTRUCTIONS =
  'Sysvar1nstructions1111111111111111111111111' as Address;
const TOKEN_AUTH_RULES_PROGRAM =
  'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg' as Address;

const TOKEN_STANDARD_NON_FUNGIBLE = 0;
const TOKEN_STANDARD_PROGRAMMABLE_NON_FUNGIBLE = 4;

const DEFAULT_NAME = 'My Asset';
const DEFAULT_URI = 'https://example.com/my-asset.json';
const DEFAULT_SELLER_FEE_BASIS_POINTS = 1000;

// Borsh string: u32 length prefix + utf8 bytes.
const stringEncoder = addEncoderSizePrefix(getUtf8Encoder(), getU32Encoder());

// --- Account-meta helpers ----------------------------------------------------

const readonly = (address: Address): AccountMeta => ({
  address,
  role: AccountRole.READONLY,
});
const writable = (address: Address): AccountMeta => ({
  address,
  role: AccountRole.WRITABLE,
});
const readonlySigner = (signer: TransactionSigner): AccountSignerMeta => ({
  address: signer.address,
  role: AccountRole.READONLY_SIGNER,
  signer,
});
const writableSigner = (signer: TransactionSigner): AccountSignerMeta => ({
  address: signer.address,
  role: AccountRole.WRITABLE_SIGNER,
  signer,
});
/** Metaplex optional-account convention: absent => the program's own id. */
const optional = (address: Address | null, program: Address): AccountMeta =>
  readonly(address ?? program);

// -----------------------------------------------------------------------------
// mpl-token-metadata: CreateV1 (disc 42) + MintV1 (disc 43)
// -----------------------------------------------------------------------------

const tmCreatorEncoder = getStructEncoder([
  ['address', getAddressEncoder()],
  ['verified', getBooleanEncoder()],
  ['share', getU8Encoder()],
]);

const createV1DataEncoder = getStructEncoder([
  ['discriminator', getU8Encoder()],
  ['createV1Discriminator', getU8Encoder()],
  ['name', stringEncoder],
  ['symbol', stringEncoder],
  ['uri', stringEncoder],
  ['sellerFeeBasisPoints', getU16Encoder()],
  ['creators', getOptionEncoder(getArrayEncoder(tmCreatorEncoder))],
  ['primarySaleHappened', getBooleanEncoder()],
  ['isMutable', getBooleanEncoder()],
  ['tokenStandard', getU8Encoder()],
  // Option<{ verified: bool, key: Address }>. `none()` encodes to a single 0
  // byte, identical to a `u8` option, so existing `none()` callers are unchanged.
  [
    'collection',
    getOptionEncoder(
      getStructEncoder([
        ['verified', getBooleanEncoder()],
        ['key', getAddressEncoder()],
      ])
    ),
  ],
  ['uses', getOptionEncoder(getU8Encoder())],
  ['collectionDetails', getOptionEncoder(getU8Encoder())],
  ['ruleSet', getOptionEncoder(getAddressEncoder())],
  ['decimals', getOptionEncoder(getU8Encoder())],
  // PrintSupply is a data enum; `Zero` is variant 0 with no fields.
  ['printSupply', getOptionEncoder(getU8Encoder())],
]);

const mintV1DataEncoder = getStructEncoder([
  ['discriminator', getU8Encoder()],
  ['mintV1Discriminator', getU8Encoder()],
  ['amount', getU64Encoder()],
  ['authorizationData', getOptionEncoder(getU8Encoder())],
]);

type NftCreatorInput = { address: Address; verified?: boolean; share: number };

type NftCollection = { verified: boolean; key: Address };

type NftOptions = {
  owner?: Address;
  creators?: NftCreatorInput[];
  sellerFeeBasisPoints?: number;
  primarySaleHappened?: boolean;
  /** An (un)verified collection reference to write in the item metadata. */
  collection?: NftCollection;
};

// VerifyV1 (disc 52) with VerificationArgs::CollectionV1 (variant 1). Mirrors the
// umi `verifyCollectionV1` generated client, which encodes `[52, 1]`.
const verifyCollectionV1Data = new Uint8Array([52, 1]);

type CreateNftInput = NftOptions & {
  /** A pre-created (SPL-initialised) mint to wrap; a fresh one otherwise. */
  mint?: TransactionSigner;
  /** A pre-created (non-associated) token account to mint into. */
  token?: Address;
  /**
   * Mint + update authority signer (default `client.payer`). Used to make a
   * collection parent whose update authority is a dedicated signer.
   */
  authority?: TransactionSigner;
  /** Programmable-config rule set stored in the metadata (pNFT only). */
  ruleSet?: Address;
  /** When set, append a VerifyV1 signed by `authority` for this collection. */
  verify?: { collectionMint: Address; authority: TransactionSigner };
};

async function createTokenMetadataNft(
  client: Client,
  tokenStandard: number,
  opts: CreateNftInput
): Promise<{ mint: Address }> {
  const { payer, svm } = client;
  const authority = opts.authority ?? payer;
  const owner = opts.owner ?? payer.address;
  const creators = opts.creators ?? [
    { address: payer.address, verified: false, share: 100 },
  ];
  const sellerFeeBasisPoints =
    opts.sellerFeeBasisPoints ?? DEFAULT_SELLER_FEE_BASIS_POINTS;
  const primarySaleHappened = opts.primarySaleHappened ?? false;
  const isProgrammable =
    tokenStandard === TOKEN_STANDARD_PROGRAMMABLE_NON_FUNGIBLE;

  const mint = opts.mint ?? (await generateKeyPairSigner());
  const [metadata] = await findMetadataPda({ mint: mint.address });
  const [edition] = await findMasterEditionPda({ mint: mint.address });
  const [ata] = await findAssociatedTokenPda({ mint: mint.address, owner });
  const tokenAccount = opts.token ?? ata;
  const [tokenRecord] = await findTokenRecordPda({
    mint: mint.address,
    token: tokenAccount,
  });

  // CreateV1 both initialises the mint and writes the metadata + master edition.
  const createInstruction: Instruction = {
    programAddress: TOKEN_METADATA_PROGRAM,
    accounts: [
      writable(metadata),
      writable(edition),
      writableSigner(mint),
      readonlySigner(authority), // authority (mint / update authority)
      writableSigner(payer), // payer
      readonly(authority.address), // updateAuthority
      readonly(SYSTEM_PROGRAM),
      readonly(SYSVAR_INSTRUCTIONS),
      readonly(TOKEN_PROGRAM),
    ],
    data: createV1DataEncoder.encode({
      discriminator: 42,
      createV1Discriminator: 0,
      name: DEFAULT_NAME,
      symbol: '',
      uri: DEFAULT_URI,
      sellerFeeBasisPoints,
      creators: some(
        creators.map((c) => ({
          address: c.address,
          verified: c.verified ?? false,
          share: c.share,
        }))
      ),
      primarySaleHappened,
      isMutable: true,
      tokenStandard,
      collection: opts.collection ? some(opts.collection) : none(),
      uses: none(),
      collectionDetails: none(),
      ruleSet: opts.ruleSet ? some(opts.ruleSet) : none(),
      decimals: some(0),
      printSupply: some(0),
    }),
  };

  // MintV1 creates the owner ATA (or uses `token`) and mints the single token.
  const mintInstruction: Instruction = {
    programAddress: TOKEN_METADATA_PROGRAM,
    accounts: [
      writable(tokenAccount),
      readonly(owner), // tokenOwner
      readonly(metadata),
      writable(edition),
      isProgrammable
        ? writable(tokenRecord)
        : optional(null, TOKEN_METADATA_PROGRAM),
      writable(mint.address),
      readonlySigner(authority), // authority (mint authority)
      optional(null, TOKEN_METADATA_PROGRAM), // delegateRecord
      writableSigner(payer), // payer
      readonly(SYSTEM_PROGRAM),
      readonly(SYSVAR_INSTRUCTIONS),
      readonly(TOKEN_PROGRAM),
      readonly(ATA_PROGRAM),
      opts.ruleSet
        ? readonly(TOKEN_AUTH_RULES_PROGRAM)
        : optional(null, TOKEN_METADATA_PROGRAM), // authorizationRulesProgram
      opts.ruleSet
        ? readonly(opts.ruleSet)
        : optional(null, TOKEN_METADATA_PROGRAM), // authorizationRules
    ],
    data: mintV1DataEncoder.encode({
      discriminator: 43,
      mintV1Discriminator: 0,
      amount: 1n,
      authorizationData: none(),
    }),
  };

  const instructions: Instruction[] = [
    COMPUTE_UNITS,
    createInstruction,
    mintInstruction,
  ];

  if (opts.verify) {
    const [collectionMetadata] = await findMetadataPda({
      mint: opts.verify.collectionMint,
    });
    const [collectionEdition] = await findMasterEditionPda({
      mint: opts.verify.collectionMint,
    });
    instructions.push({
      programAddress: TOKEN_METADATA_PROGRAM,
      accounts: [
        readonlySigner(opts.verify.authority), // collection update authority
        optional(null, TOKEN_METADATA_PROGRAM), // delegateRecord
        writable(metadata), // item metadata
        readonly(opts.verify.collectionMint),
        writable(collectionMetadata),
        readonly(collectionEdition),
        readonly(SYSTEM_PROGRAM),
        readonly(SYSVAR_INSTRUCTIONS),
      ],
      data: verifyCollectionV1Data,
    });
  }

  await sendTransaction(svm, payer, instructions);

  return { mint: mint.address };
}

/**
 * A regular NFT (Token Metadata, TokenStandard NonFungible). Mints one token to
 * `owner` (default `client.payer.address`) with metadata + master edition.
 */
export const createNft = (
  client: Client,
  opts: NftOptions = {}
): Promise<{ mint: Address }> =>
  createTokenMetadataNft(client, TOKEN_STANDARD_NON_FUNGIBLE, opts);

/** Programmable NFT (Token Metadata, TokenStandard ProgrammableNonFungible). */
export const createProgrammableNft = (
  client: Client,
  opts: NftOptions = {}
): Promise<{ mint: Address }> =>
  createTokenMetadataNft(
    client,
    TOKEN_STANDARD_PROGRAMMABLE_NON_FUNGIBLE,
    opts
  );

/**
 * A collection-parent NFT (Token Metadata, NonFungible). Its update authority is
 * `opts.authority` (default `client.payer`) — the signer allowed to verify items
 * into the collection. The guard only checks `verified` + `key`, so this is an
 * unsized collection (`collectionDetails` none).
 */
export const createCollectionNft = (
  client: Client,
  opts: { authority?: TransactionSigner } = {}
): Promise<{ mint: Address }> =>
  createTokenMetadataNft(client, TOKEN_STANDARD_NON_FUNGIBLE, {
    authority: opts.authority ?? client.payer,
  });

type VerifiedNftInput = {
  tokenOwner?: Address;
  mint?: TransactionSigner;
  token?: Address;
  ruleSet?: Address;
  collectionMint: Address;
  collectionAuthority: TransactionSigner;
};

const createVerifiedTokenMetadataNft = (
  client: Client,
  tokenStandard: number,
  opts: VerifiedNftInput
): Promise<{ mint: Address }> =>
  createTokenMetadataNft(client, tokenStandard, {
    owner: opts.tokenOwner,
    mint: opts.mint,
    token: opts.token,
    ruleSet: opts.ruleSet,
    collection: { verified: false, key: opts.collectionMint },
    verify: {
      collectionMint: opts.collectionMint,
      authority: opts.collectionAuthority,
    },
  });

/**
 * An item NFT (NonFungible) created with `collection: Some({ verified: false })`
 * and then verified into `collectionMint` by `collectionAuthority`.
 */
export const createVerifiedNft = (
  client: Client,
  opts: VerifiedNftInput
): Promise<{ mint: Address }> =>
  createVerifiedTokenMetadataNft(client, TOKEN_STANDARD_NON_FUNGIBLE, opts);

/** As {@link createVerifiedNft} but a ProgrammableNonFungible. */
export const createVerifiedProgrammableNft = (
  client: Client,
  opts: VerifiedNftInput
): Promise<{ mint: Address }> =>
  createVerifiedTokenMetadataNft(
    client,
    TOKEN_STANDARD_PROGRAMMABLE_NON_FUNGIBLE,
    opts
  );

/**
 * Create an SPL mint (decimals 0) and a non-associated token account owned by
 * `owner` (default payer). Used to test NFTs held off their associated token
 * account: the mint is later wrapped by `createVerifiedNft` via CreateV1.
 */
export const createMintWithNonAssociatedToken = async (
  client: Client,
  owner?: Address
): Promise<{ mint: TransactionSigner; token: Address }> => {
  const { payer, svm } = client;
  const tokenOwner = owner ?? payer.address;
  const mint = await generateKeyPairSigner();
  const token = await generateKeyPairSigner();
  const mintSpace = BigInt(getMintSize());
  const tokenSpace = BigInt(getTokenSize());

  await sendTransaction(svm, payer, [
    getCreateAccountInstruction({
      payer,
      newAccount: mint,
      lamports: svm.minimumBalanceForRentExemption(mintSpace),
      space: mintSpace,
      programAddress: TOKEN_PROGRAM_ADDRESS,
    }),
    getInitializeMintInstruction({
      mint: mint.address,
      decimals: 0,
      mintAuthority: payer.address,
      freezeAuthority: payer.address,
    }),
    getCreateAccountInstruction({
      payer,
      newAccount: token,
      lamports: svm.minimumBalanceForRentExemption(tokenSpace),
      space: tokenSpace,
      programAddress: TOKEN_PROGRAM_ADDRESS,
    }),
    getInitializeAccount3Instruction({
      account: token.address,
      mint: mint.address,
      owner: tokenOwner,
    }),
  ]);

  return { mint, token: token.address };
};

// -----------------------------------------------------------------------------
// mpl-token-metadata: legacy BurnNft (disc 29)
// -----------------------------------------------------------------------------

/**
 * Burn a regular NFT held in `owner`'s associated token account: burns the
 * single token and closes the token account, metadata and master edition.
 * Mirrors the umi `burnNft` generated client used by the umi tests; the
 * optional collection-metadata account is omitted.
 */
export const getBurnNftInstruction = async (input: {
  owner: TransactionSigner;
  mint: Address;
}): Promise<Instruction> => {
  const [metadata] = await findMetadataPda({ mint: input.mint });
  const [edition] = await findMasterEditionPda({ mint: input.mint });
  const [token] = await findAssociatedTokenPda({
    mint: input.mint,
    owner: input.owner.address,
  });
  return {
    programAddress: TOKEN_METADATA_PROGRAM,
    accounts: [
      writable(metadata),
      writableSigner(input.owner),
      writable(input.mint),
      writable(token),
      writable(edition),
      readonly(TOKEN_PROGRAM),
    ],
    data: new Uint8Array([29]),
  };
};

// -----------------------------------------------------------------------------
// mpl-core: CreateV1 (disc 0) with an inline Royalties plugin
// -----------------------------------------------------------------------------

const coreCreatorEncoder = getStructEncoder([
  ['address', getAddressEncoder()],
  ['percentage', getU8Encoder()],
]);

// Plugin is a data enum; `Royalties` is variant 0 (a single-field tuple).
const royaltiesPluginEncoder = getStructEncoder([
  ['pluginType', getU8Encoder()],
  ['basisPoints', getU16Encoder()],
  ['creators', getArrayEncoder(coreCreatorEncoder)],
  // BaseRuleSet data enum; `None` is variant 0 with no fields.
  ['ruleSet', getU8Encoder()],
]);

const pluginAuthorityPairEncoder = getStructEncoder([
  ['plugin', royaltiesPluginEncoder],
  // Option<BasePluginAuthority>; None => the plugin's default authority.
  ['authority', getOptionEncoder(getU8Encoder())],
]);

const coreCreateV1DataEncoder = getStructEncoder([
  ['discriminator', getU8Encoder()],
  ['dataState', getU8Encoder()],
  ['name', stringEncoder],
  ['uri', stringEncoder],
  ['plugins', getOptionEncoder(getArrayEncoder(pluginAuthorityPairEncoder))],
]);

// CreateCollectionV1 (disc 1): like CreateV1 but without the `dataState` field.
const coreCreateCollectionV1DataEncoder = getStructEncoder([
  ['discriminator', getU8Encoder()],
  ['name', stringEncoder],
  ['uri', stringEncoder],
  ['plugins', getOptionEncoder(getArrayEncoder(pluginAuthorityPairEncoder))],
]);

const royaltiesPlugin = (
  basisPoints: number,
  creators: { address: Address; percentage: number }[]
) => ({
  plugin: { pluginType: 0, basisPoints, creators, ruleSet: 0 },
  authority: none<number>(),
});

/**
 * Core asset (mpl-core, TokenStandard Core) with a default Royalties plugin
 * (basisPoints 1000, ruleSet None, one creator = owner at 100%). When
 * `collection` is given, the asset is added to it and its update authority
 * becomes `Collection(collection)` (the collection update authority, i.e. the
 * payer, signs).
 */
export const createCoreAsset = async (
  client: Client,
  opts: {
    owner?: Address;
    collection?: Address;
    royaltyBasisPoints?: number;
    royaltyCreators?: { address: Address; percentage: number }[];
  } = {}
): Promise<{ asset: Address }> => {
  const { payer, svm } = client;
  const owner = opts.owner ?? payer.address;
  const royaltyBasisPoints =
    opts.royaltyBasisPoints ?? DEFAULT_SELLER_FEE_BASIS_POINTS;
  const royaltyCreators = opts.royaltyCreators ?? [
    { address: payer.address, percentage: 100 },
  ];

  const asset = await generateKeyPairSigner();

  const createInstruction: Instruction = {
    programAddress: MPL_CORE_PROGRAM,
    accounts: [
      writableSigner(asset),
      opts.collection
        ? writable(opts.collection)
        : optional(null, MPL_CORE_PROGRAM),
      // authority: the collection update authority must sign when adding to a
      // collection; otherwise it defaults to the payer.
      opts.collection
        ? readonlySigner(payer)
        : optional(null, MPL_CORE_PROGRAM),
      writableSigner(payer), // payer
      readonly(owner),
      optional(null, MPL_CORE_PROGRAM), // updateAuthority
      readonly(SYSTEM_PROGRAM),
      optional(null, MPL_CORE_PROGRAM), // logWrapper
    ],
    data: coreCreateV1DataEncoder.encode({
      discriminator: 0,
      dataState: 0,
      name: DEFAULT_NAME,
      uri: DEFAULT_URI,
      plugins: some([royaltiesPlugin(royaltyBasisPoints, royaltyCreators)]),
    }),
  };

  await sendTransaction(svm, payer, [createInstruction]);

  return { asset: asset.address };
};

/**
 * Core collection (mpl-core CreateCollectionV1) with a default Royalties plugin.
 * Its update authority defaults to the payer, who can then add assets to it.
 */
export const createCoreCollection = async (
  client: Client,
  opts: {
    royaltyBasisPoints?: number;
    royaltyCreators?: { address: Address; percentage: number }[];
  } = {}
): Promise<{ collection: Address }> => {
  const { payer, svm } = client;
  const royaltyBasisPoints =
    opts.royaltyBasisPoints ?? DEFAULT_SELLER_FEE_BASIS_POINTS;
  const royaltyCreators = opts.royaltyCreators ?? [
    { address: payer.address, percentage: 100 },
  ];

  const collection = await generateKeyPairSigner();

  const createInstruction: Instruction = {
    programAddress: MPL_CORE_PROGRAM,
    accounts: [
      writableSigner(collection),
      optional(null, MPL_CORE_PROGRAM), // updateAuthority (defaults to payer)
      writableSigner(payer), // payer
      readonly(SYSTEM_PROGRAM),
    ],
    data: coreCreateCollectionV1DataEncoder.encode({
      discriminator: 1,
      name: DEFAULT_NAME,
      uri: DEFAULT_URI,
      plugins: some([royaltiesPlugin(royaltyBasisPoints, royaltyCreators)]),
    }),
  };

  await sendTransaction(svm, payer, [createInstruction]);

  return { collection: collection.address };
};
