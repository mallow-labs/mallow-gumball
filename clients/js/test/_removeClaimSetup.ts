/**
 * Batch-local test helpers that create *real* on-chain assets the mallow-gumball
 * program can ingest via `addNft` / `addCoreAsset`. Because there are no kit
 * clients for Token Metadata or MPL Core in this tree, the instructions are
 * hand-encoded with `@solana/kit` codecs. Byte layouts + discriminators mirror
 * the umi-generated `createV1`/`mintV1` (token-metadata) and `createV2`
 * (mpl-core) instructions used by the umi test helpers.
 */
import { findAssociatedTokenPda } from '@solana-program/token';
import {
  AccountRole,
  addEncoderSizePrefix,
  generateKeyPairSigner,
  getAddressEncoder,
  getArrayEncoder,
  getBooleanEncoder,
  getBytesEncoder,
  getOptionEncoder,
  getStructEncoder,
  getU16Encoder,
  getU32Encoder,
  getU64Encoder,
  getU8Encoder,
  getUtf8Encoder,
  type Address,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';
import {
  findMasterEditionPda,
  findMetadataPda,
  findTokenRecordPda,
} from '../src';
import { sendTransaction, type Client } from './_setup';

// -----------------------------------------------------------------------------
// Program addresses
// -----------------------------------------------------------------------------

const TOKEN_METADATA_PROGRAM =
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s' as Address;
const MPL_CORE_PROGRAM =
  'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d' as Address;
const SPL_TOKEN_PROGRAM =
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;
const SPL_ATA_PROGRAM =
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address;
const SYSTEM_PROGRAM = '11111111111111111111111111111111' as Address;
const SYSVAR_INSTRUCTIONS =
  'Sysvar1nstructions1111111111111111111111111' as Address;

// Token-metadata TokenStandard enum values.
const TOKEN_STANDARD_NON_FUNGIBLE = 0;
const TOKEN_STANDARD_PROGRAMMABLE_NON_FUNGIBLE = 4;

// Mirrors the umi `defaultAssetData()`: name 'My Asset',
// uri 'https://example.com/my-asset.json', sellerFeeBasisPoints 1000 (10%).
const ASSET_NAME = 'My Asset';
const ASSET_URI = 'https://example.com/my-asset.json';
const SELLER_FEE_BASIS_POINTS = 1000;

// -----------------------------------------------------------------------------
// Account-meta helpers
// -----------------------------------------------------------------------------

const readonly = (address: Address) => ({
  address,
  role: AccountRole.READONLY,
});
const writable = (address: Address) => ({
  address,
  role: AccountRole.WRITABLE,
});
const readonlySigner = (signer: TransactionSigner) => ({
  address: signer.address,
  role: AccountRole.READONLY_SIGNER,
  signer,
});
const writableSigner = (signer: TransactionSigner) => ({
  address: signer.address,
  role: AccountRole.WRITABLE_SIGNER,
  signer,
});

// -----------------------------------------------------------------------------
// Token Metadata codecs (borsh) — field order copied from the umi generated
// `createV1` / `mintV1` instruction data serializers.
// -----------------------------------------------------------------------------

const borshString = () =>
  addEncoderSizePrefix(getUtf8Encoder(), getU32Encoder());

const creatorEncoder = getStructEncoder([
  ['address', getAddressEncoder()],
  ['verified', getBooleanEncoder()],
  ['share', getU8Encoder()],
]);

// discriminator 42 + createV1Discriminator 0, then the CreateV1 args.
const createV1DataEncoder = getStructEncoder([
  ['discriminator', getU8Encoder()],
  ['createV1Discriminator', getU8Encoder()],
  ['name', borshString()],
  ['symbol', borshString()],
  ['uri', borshString()],
  ['sellerFeeBasisPoints', getU16Encoder()],
  ['creators', getOptionEncoder(getArrayEncoder(creatorEncoder))],
  ['primarySaleHappened', getBooleanEncoder()],
  ['isMutable', getBooleanEncoder()],
  ['tokenStandard', getU8Encoder()],
  ['collection', getOptionEncoder(getAddressEncoder())],
  ['uses', getOptionEncoder(getBytesEncoder())],
  ['collectionDetails', getOptionEncoder(getBytesEncoder())],
  ['ruleSet', getOptionEncoder(getAddressEncoder())],
  ['decimals', getOptionEncoder(getU8Encoder())],
  // PrintSupply::Zero is enum variant 0 with no fields.
  ['printSupply', getOptionEncoder(getU8Encoder())],
]);

// discriminator 43 + mintV1Discriminator 0, amount u64, authorizationData None.
const mintV1DataEncoder = getStructEncoder([
  ['discriminator', getU8Encoder()],
  ['mintV1Discriminator', getU8Encoder()],
  ['amount', getU64Encoder()],
  ['authorizationData', getOptionEncoder(getBytesEncoder())],
]);

const encodeCreateV1Data = (
  tokenStandard: number,
  owner: Address
): Uint8Array =>
  new Uint8Array(
    createV1DataEncoder.encode({
      discriminator: 42,
      createV1Discriminator: 0,
      name: ASSET_NAME,
      symbol: '',
      uri: ASSET_URI,
      sellerFeeBasisPoints: SELLER_FEE_BASIS_POINTS,
      creators: [{ address: owner, verified: true, share: 100 }],
      primarySaleHappened: false,
      isMutable: true,
      tokenStandard,
      collection: null,
      uses: null,
      collectionDetails: null,
      ruleSet: null,
      decimals: null,
      printSupply: 0,
    })
  );

const encodeMintV1Data = (): Uint8Array =>
  new Uint8Array(
    mintV1DataEncoder.encode({
      discriminator: 43,
      mintV1Discriminator: 0,
      amount: 1n,
      authorizationData: null,
    })
  );

/**
 * Build the createV1 + mintV1 instruction pair for a Token Metadata digital
 * asset. `owner` is the mint/update authority *and* the token recipient;
 * `payer` funds account creation (and is the tx fee payer).
 */
async function buildTokenMetadataInstructions(
  tokenStandard: number,
  mint: TransactionSigner,
  owner: TransactionSigner,
  payer: TransactionSigner
): Promise<Instruction[]> {
  const [metadata] = await findMetadataPda({ mint: mint.address });
  const [masterEdition] = await findMasterEditionPda({ mint: mint.address });
  const [tokenAccount] = await findAssociatedTokenPda({
    owner: owner.address,
    mint: mint.address,
    tokenProgram: SPL_TOKEN_PROGRAM,
  });

  const isProgrammable =
    tokenStandard === TOKEN_STANDARD_PROGRAMMABLE_NON_FUNGIBLE;
  const [tokenRecord] = isProgrammable
    ? await findTokenRecordPda({ mint: mint.address, token: tokenAccount })
    : [TOKEN_METADATA_PROGRAM];

  const createV1: Instruction = {
    programAddress: TOKEN_METADATA_PROGRAM,
    accounts: [
      writable(metadata),
      writable(masterEdition),
      writableSigner(mint),
      readonlySigner(owner), // authority (mint + update authority)
      writableSigner(payer),
      readonly(owner.address), // updateAuthority
      readonly(SYSTEM_PROGRAM),
      readonly(SYSVAR_INSTRUCTIONS),
      readonly(SPL_TOKEN_PROGRAM),
    ],
    data: encodeCreateV1Data(tokenStandard, owner.address),
  };

  const mintV1: Instruction = {
    programAddress: TOKEN_METADATA_PROGRAM,
    accounts: [
      writable(tokenAccount),
      readonly(owner.address), // tokenOwner
      writable(metadata),
      writable(masterEdition),
      // pNFT: real writable token-record PDA; NFT: readonly program-id placeholder.
      isProgrammable ? writable(tokenRecord) : readonly(tokenRecord),
      writable(mint.address),
      readonlySigner(owner), // authority
      readonly(TOKEN_METADATA_PROGRAM), // delegateRecord (absent)
      writableSigner(payer),
      readonly(SYSTEM_PROGRAM),
      readonly(SYSVAR_INSTRUCTIONS),
      readonly(SPL_TOKEN_PROGRAM),
      readonly(SPL_ATA_PROGRAM),
      readonly(TOKEN_METADATA_PROGRAM), // authorizationRulesProgram (absent)
      readonly(TOKEN_METADATA_PROGRAM), // authorizationRules (absent)
    ],
    data: encodeMintV1Data(),
  };

  return [createV1, mintV1];
}

// -----------------------------------------------------------------------------
// MPL Core codecs (borsh) — field order copied from the umi generated
// `createV2` instruction + BaseRoyalties / Creator / BaseRuleSet types.
// -----------------------------------------------------------------------------

const coreCreatorEncoder = getStructEncoder([
  ['address', getAddressEncoder()],
  ['percentage', getU8Encoder()],
]);

// The Royalties plugin as a `PluginAuthorityPair`. `plugin` is a data-enum whose
// first variant (index 0) is Royalties(BaseRoyalties); BaseRoyalties.ruleSet is
// a data-enum whose first variant (index 0) is None. `authority` is None.
const pluginAuthorityPairEncoder = getStructEncoder([
  ['pluginDiscriminator', getU8Encoder()], // 0 = Royalties
  ['basisPoints', getU16Encoder()],
  ['creators', getArrayEncoder(coreCreatorEncoder)],
  ['ruleSet', getU8Encoder()], // 0 = None
  ['authority', getOptionEncoder(getU8Encoder())], // None
]);

// discriminator 20 + dataState 0 (AccountState) + name + uri + plugins +
// externalPluginAdapters (empty).
const createV2DataEncoder = getStructEncoder([
  ['discriminator', getU8Encoder()],
  ['dataState', getU8Encoder()],
  ['name', borshString()],
  ['uri', borshString()],
  ['plugins', getOptionEncoder(getArrayEncoder(pluginAuthorityPairEncoder))],
  [
    'externalPluginAdapters',
    getOptionEncoder(getArrayEncoder(getBytesEncoder())),
  ],
]);

const encodeCreateV2Data = (owner: Address): Uint8Array =>
  new Uint8Array(
    createV2DataEncoder.encode({
      discriminator: 20,
      dataState: 0,
      name: ASSET_NAME,
      uri: ASSET_URI,
      plugins: [
        {
          pluginDiscriminator: 0,
          basisPoints: SELLER_FEE_BASIS_POINTS,
          creators: [{ address: owner, percentage: 100 }],
          ruleSet: 0,
          authority: null,
        },
      ],
      externalPluginAdapters: [],
    })
  );

// -----------------------------------------------------------------------------
// Public helpers
// -----------------------------------------------------------------------------

/**
 * Create a Token Metadata NonFungible (mint + metadata + master edition) with
 * exactly one token minted to `owner`'s associated token account. `owner`
 * defaults to `client.payer` and must sign.
 */
export async function createNft(
  client: Client,
  input: { owner?: TransactionSigner } = {}
): Promise<{ mint: Address }> {
  const owner = input.owner ?? client.payer;
  const mint = await generateKeyPairSigner();
  const instructions = await buildTokenMetadataInstructions(
    TOKEN_STANDARD_NON_FUNGIBLE,
    mint,
    owner,
    client.payer
  );
  await sendTransaction(client.svm, client.payer, instructions);
  return { mint: mint.address };
}

/**
 * Create a Token Metadata ProgrammableNonFungible (pNFT, with a token record)
 * with exactly one token minted to `owner`'s associated token account. `owner`
 * defaults to `client.payer` and must sign. The pNFT uses no auth rule set.
 */
export async function createProgrammableNft(
  client: Client,
  input: { owner?: TransactionSigner } = {}
): Promise<{ mint: Address }> {
  const owner = input.owner ?? client.payer;
  const mint = await generateKeyPairSigner();
  const instructions = await buildTokenMetadataInstructions(
    TOKEN_STANDARD_PROGRAMMABLE_NON_FUNGIBLE,
    mint,
    owner,
    client.payer
  );
  await sendTransaction(client.svm, client.payer, instructions);
  return { mint: mint.address };
}

/**
 * Create an MPL Core AssetV1 owned by `owner` (default `client.payer`) with a
 * Royalties plugin (1000 bps, single creator = owner at 100%, ruleSet None) —
 * mirrors the umi `createCoreAsset` helper.
 */
export async function createCoreAsset(
  client: Client,
  input: { owner?: TransactionSigner } = {}
): Promise<{ asset: Address }> {
  const owner = input.owner ?? client.payer;
  const asset = await generateKeyPairSigner();

  const createV2: Instruction = {
    programAddress: MPL_CORE_PROGRAM,
    accounts: [
      writableSigner(asset),
      readonly(MPL_CORE_PROGRAM), // collection (absent)
      readonly(MPL_CORE_PROGRAM), // authority (absent -> defaults to payer)
      writableSigner(client.payer),
      readonly(owner.address), // owner
      readonly(MPL_CORE_PROGRAM), // updateAuthority (absent)
      readonly(SYSTEM_PROGRAM),
      readonly(MPL_CORE_PROGRAM), // logWrapper (absent)
    ],
    data: encodeCreateV2Data(owner.address),
  };

  await sendTransaction(client.svm, client.payer, [createV2]);
  return { asset: asset.address };
}
