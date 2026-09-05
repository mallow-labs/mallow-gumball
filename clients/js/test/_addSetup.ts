/* eslint-disable no-bitwise */
import { getCreateAccountInstruction } from '@solana-program/system';
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getInitializeMintInstruction,
  getMintSize,
  getMintToInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  AccountRole,
  getAddressEncoder,
  getProgramDerivedAddress,
  getU16Encoder,
  getU32Encoder,
  getU64Encoder,
  getUtf8Encoder,
  type Address,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';
import {
  decodeAddItemRequest,
  decodeSellerHistory,
  findAddItemRequestPda,
  findSellerHistoryPda,
  getCreateGumballMachineInstructionsAsync,
  type AddItemRequest,
  type GumballSettingsArgs,
  type SellerHistory,
} from '../src';
import {
  COMPUTE_UNITS,
  defaultGumballSettings,
  generateKeyPairSignerWithSol,
  sendTransaction,
  type Client,
} from './_setup';

// -----------------------------------------------------------------------------
// Program constants
// -----------------------------------------------------------------------------

export const TOKEN_METADATA_PROGRAM_ADDRESS =
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s' as Address;
export const MPL_CORE_PROGRAM_ADDRESS =
  'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d' as Address;
const SYSVAR_INSTRUCTIONS_ADDRESS =
  'Sysvar1nstructions1111111111111111111111111' as Address;
const ATA_PROGRAM_ADDRESS =
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address;
const SYSTEM_PROGRAM_ADDRESS = '11111111111111111111111111111111' as Address;

// -----------------------------------------------------------------------------
// Minimal byte encoders (mirror the umi/kinobi serializers so we can build the
// mpl-token-metadata `createV1`/`mintV1` and mpl-core `createV1` instructions by
// hand — there is no generated kit client for those programs in this workspace).
// -----------------------------------------------------------------------------

const u16 = getU16Encoder();
const u32 = getU32Encoder();
const u64 = getU64Encoder();
const addressEncoder = getAddressEncoder();
const utf8 = getUtf8Encoder();

const concat = (...parts: ReadonlyArray<Uint8Array>): Uint8Array => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};

const b = (...bytes: number[]): Uint8Array => new Uint8Array(bytes);
const encStr = (s: string): Uint8Array => {
  const bytes = new Uint8Array(utf8.encode(s));
  return concat(new Uint8Array(u32.encode(bytes.length)), bytes);
};
const encAddr = (a: Address): Uint8Array =>
  new Uint8Array(addressEncoder.encode(a));
const optNone = (): Uint8Array => b(0);
const optSome = (bytes: Uint8Array): Uint8Array => concat(b(1), bytes);

// -----------------------------------------------------------------------------
// Account-meta helpers
// -----------------------------------------------------------------------------

const signerW = (s: TransactionSigner) => ({
  address: s.address,
  role: AccountRole.WRITABLE_SIGNER,
  signer: s,
});
const signerR = (s: TransactionSigner) => ({
  address: s.address,
  role: AccountRole.READONLY_SIGNER,
  signer: s,
});
const writable = (a: Address) => ({ address: a, role: AccountRole.WRITABLE });
const readonly = (a: Address) => ({ address: a, role: AccountRole.READONLY });

// -----------------------------------------------------------------------------
// Token-metadata PDAs
// -----------------------------------------------------------------------------

const findMetadataPda = async (mint: Address): Promise<Address> => {
  const [pda] = await getProgramDerivedAddress({
    programAddress: TOKEN_METADATA_PROGRAM_ADDRESS,
    seeds: [
      utf8.encode('metadata'),
      addressEncoder.encode(TOKEN_METADATA_PROGRAM_ADDRESS),
      addressEncoder.encode(mint),
    ],
  });
  return pda;
};

const findMasterEditionPda = async (mint: Address): Promise<Address> => {
  const [pda] = await getProgramDerivedAddress({
    programAddress: TOKEN_METADATA_PROGRAM_ADDRESS,
    seeds: [
      utf8.encode('metadata'),
      addressEncoder.encode(TOKEN_METADATA_PROGRAM_ADDRESS),
      addressEncoder.encode(mint),
      utf8.encode('edition'),
    ],
  });
  return pda;
};

// -----------------------------------------------------------------------------
// NFT creation (mpl-token-metadata createV1 + mintV1, TokenStandard::NonFungible)
// -----------------------------------------------------------------------------

/**
 * Create a NonFungible NFT owned by `owner` (defaults to the payer), minting a
 * single token to the owner's ATA. Mirrors umi's `createNft` helper.
 */
export const createNft = async (
  client: Client,
  owner: TransactionSigner = client.payer,
  overrides: { name?: string; uri?: string } = {}
): Promise<{ mint: Address }> => {
  const mint = await generateKeyPairSignerWithSol(client.svm, 0n);
  const name = overrides.name ?? 'My Asset';
  const uri = overrides.uri ?? 'https://example.com/my-asset.json';

  const metadata = await findMetadataPda(mint.address);
  const masterEdition = await findMasterEditionPda(mint.address);
  const [tokenAccount] = await findAssociatedTokenPda({
    owner: owner.address,
    mint: mint.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  // createV1 data (discriminator 42, createV1Discriminator 0).
  const createData = concat(
    b(42),
    b(0),
    encStr(name),
    encStr(''), // symbol
    encStr(uri),
    new Uint8Array(u16.encode(1000)), // sellerFeeBasisPoints (10%)
    // creators: Some([{ address: owner, verified: true, share: 100 }])
    optSome(
      concat(
        new Uint8Array(u32.encode(1)),
        encAddr(owner.address),
        b(1),
        b(100)
      )
    ),
    b(0), // primarySaleHappened = false
    b(1), // isMutable = true
    b(0), // tokenStandard = NonFungible
    optNone(), // collection
    optNone(), // uses
    optNone(), // collectionDetails
    optNone(), // ruleSet
    optNone(), // decimals (none for NonFungible)
    optSome(b(0)) // printSupply = Some(Zero)
  );

  const createIx: Instruction = {
    programAddress: TOKEN_METADATA_PROGRAM_ADDRESS,
    accounts: [
      writable(metadata),
      writable(masterEdition),
      signerW(mint),
      signerR(owner), // authority
      signerW(owner), // payer
      readonly(owner.address), // updateAuthority
      readonly(SYSTEM_PROGRAM_ADDRESS),
      readonly(SYSVAR_INSTRUCTIONS_ADDRESS),
      readonly(TOKEN_PROGRAM_ADDRESS),
    ],
    data: createData,
  };

  // mintV1 data (discriminator 43, mintV1Discriminator 0, amount 1, authData none).
  const mintData = concat(
    b(43),
    b(0),
    new Uint8Array(u64.encode(1n)),
    optNone()
  );
  const placeholder = readonly(TOKEN_METADATA_PROGRAM_ADDRESS);
  const mintIx: Instruction = {
    programAddress: TOKEN_METADATA_PROGRAM_ADDRESS,
    accounts: [
      writable(tokenAccount),
      readonly(owner.address), // tokenOwner
      readonly(metadata),
      writable(masterEdition),
      placeholder, // tokenRecord (none)
      writable(mint.address),
      signerR(owner), // authority
      placeholder, // delegateRecord (none)
      signerW(owner), // payer
      readonly(SYSTEM_PROGRAM_ADDRESS),
      readonly(SYSVAR_INSTRUCTIONS_ADDRESS),
      readonly(TOKEN_PROGRAM_ADDRESS),
      readonly(ATA_PROGRAM_ADDRESS),
      placeholder, // authorizationRulesProgram (none)
      placeholder, // authorizationRules (none)
    ],
    data: mintData,
  };

  await sendTransaction(client.svm, owner, [COMPUTE_UNITS, createIx, mintIx]);
  return { mint: mint.address };
};

// -----------------------------------------------------------------------------
// Core asset creation (mpl-core createV1 with a Royalties plugin)
// -----------------------------------------------------------------------------

/**
 * Create an mpl-core asset owned by `owner` (defaults to the payer) carrying a
 * Royalties plugin (1000 bps, owner as sole creator). Mirrors umi's
 * `createCoreAsset` helper.
 */
export const createCoreAsset = async (
  client: Client,
  owner: TransactionSigner = client.payer,
  overrides: { name?: string; uri?: string } = {}
): Promise<{ asset: Address }> => {
  const asset = await generateKeyPairSignerWithSol(client.svm, 0n);
  const name = overrides.name ?? 'My Asset';
  const uri = overrides.uri ?? 'https://example.com/my-asset.json';

  // createV1 data (discriminator 0, dataState 0 = AccountState).
  const royaltiesPluginPair = concat(
    b(0), // Plugin::Royalties (variant 0)
    new Uint8Array(u16.encode(1000)), // basisPoints
    new Uint8Array(u32.encode(1)), // creators len
    encAddr(owner.address),
    b(100), // percentage
    b(0), // ruleSet = None
    optNone() // authority = None
  );
  const createData = concat(
    b(0), // discriminator CreateV1
    b(0), // dataState = AccountState
    encStr(name),
    encStr(uri),
    optSome(concat(new Uint8Array(u32.encode(1)), royaltiesPluginPair)) // plugins
  );

  const placeholder = readonly(MPL_CORE_PROGRAM_ADDRESS);
  const createIx: Instruction = {
    programAddress: MPL_CORE_PROGRAM_ADDRESS,
    accounts: [
      signerW(asset),
      placeholder, // collection (none)
      placeholder, // authority (none -> payer)
      signerW(owner), // payer
      placeholder, // owner (none -> payer)
      placeholder, // updateAuthority (none)
      readonly(SYSTEM_PROGRAM_ADDRESS),
      placeholder, // logWrapper (none)
    ],
    data: createData,
  };

  await sendTransaction(client.svm, owner, [createIx]);
  return { asset: asset.address };
};

// -----------------------------------------------------------------------------
// Unwrapped gumball machine (no guard / no wrap)
// -----------------------------------------------------------------------------

/**
 * Create a gumball machine WITHOUT wrapping it in a guard. The shared `_setup`
 * `createGumballMachine` always wraps (setting the machine's mint authority to
 * the guard PDA), which makes `deleteGumballMachine` impossible without an
 * unwrap. The umi suite creates unwrapped machines when no guards are supplied,
 * so this mirrors that for the delete-based flows. Returns the machine address;
 * its mint authority is the payer.
 */
export const createUnwrappedGumballMachine = async (
  client: Client,
  settings: Partial<GumballSettingsArgs> = {}
): Promise<{ gumballMachine: Address }> => {
  const gumballMachine = await generateKeyPairSignerWithSol(client.svm, 0n);
  const instructions = await getCreateGumballMachineInstructionsAsync(
    {
      gumballMachine,
      authority: client.payer.address,
      payer: client.payer,
      settings: defaultGumballSettings(settings),
    },
    { rpc: client.rpc }
  );
  await sendTransaction(client.svm, client.payer, instructions);
  return { gumballMachine: gumballMachine.address };
};

// -----------------------------------------------------------------------------
// Fungible token creation (mints `amount` tokens to `owner`'s ATA)
// -----------------------------------------------------------------------------

/**
 * Create a fresh SPL mint and mint `amount` tokens to `owner`'s ATA (defaults to
 * the payer). Mirrors umi's `createMintWithHolders` for a single holder.
 */
export const createTokensForSeller = async (
  client: Client,
  owner: TransactionSigner = client.payer,
  amount: number | bigint = 100
): Promise<{ mint: Address; sellerAta: Address }> => {
  const { svm } = client;
  const mint = await generateKeyPairSignerWithSol(svm, 0n);
  const space = BigInt(getMintSize());
  const rent = svm.minimumBalanceForRentExemption(space);
  const [sellerAta] = await findAssociatedTokenPda({
    owner: owner.address,
    mint: mint.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  await sendTransaction(svm, owner, [
    getCreateAccountInstruction({
      payer: owner,
      newAccount: mint,
      lamports: rent,
      space,
      programAddress: TOKEN_PROGRAM_ADDRESS,
    }),
    getInitializeMintInstruction({
      mint: mint.address,
      decimals: 0,
      mintAuthority: owner.address,
    }),
    await getCreateAssociatedTokenInstructionAsync({
      payer: owner,
      owner: owner.address,
      mint: mint.address,
    }),
    getMintToInstruction({
      mint: mint.address,
      token: sellerAta,
      mintAuthority: owner,
      amount,
    }),
  ]);

  return { mint: mint.address, sellerAta };
};

// -----------------------------------------------------------------------------
// Transfers (used by the "re-add" flows to move a drawn item back to the seller)
// -----------------------------------------------------------------------------

/** Build an mpl-core `TransferV1` instruction (asset owner `owner` -> `newOwner`). */
export const transferCoreAsset = (
  asset: Address,
  owner: TransactionSigner,
  newOwner: Address
): Instruction => {
  const placeholder = readonly(MPL_CORE_PROGRAM_ADDRESS);
  return {
    programAddress: MPL_CORE_PROGRAM_ADDRESS,
    accounts: [
      writable(asset),
      placeholder, // collection (none)
      signerW(owner), // payer
      placeholder, // authority (none -> payer)
      readonly(newOwner),
      readonly(SYSTEM_PROGRAM_ADDRESS),
      placeholder, // logWrapper (none)
    ],
    data: b(14, 0), // discriminator 14, compressionProof = None
  };
};

/** Build an mpl-token-metadata `TransferV1` instruction (NonFungible, `owner` -> `newOwner`). */
export const transferNft = async (
  mint: Address,
  owner: TransactionSigner,
  newOwner: Address
): Promise<Instruction> => {
  const metadata = await findMetadataPda(mint);
  const edition = await findMasterEditionPda(mint);
  const [ownerAta] = await findAssociatedTokenPda({
    owner: owner.address,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const [destinationAta] = await findAssociatedTokenPda({
    owner: newOwner,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const placeholder = readonly(TOKEN_METADATA_PROGRAM_ADDRESS);
  return {
    programAddress: TOKEN_METADATA_PROGRAM_ADDRESS,
    accounts: [
      writable(ownerAta), // token
      readonly(owner.address), // tokenOwner
      writable(destinationAta), // destinationToken
      readonly(newOwner), // destinationOwner
      readonly(mint),
      writable(metadata),
      readonly(edition),
      placeholder, // tokenRecord (none)
      placeholder, // destinationTokenRecord (none)
      signerR(owner), // authority
      signerW(owner), // payer
      readonly(SYSTEM_PROGRAM_ADDRESS),
      readonly(SYSVAR_INSTRUCTIONS_ADDRESS),
      readonly(TOKEN_PROGRAM_ADDRESS),
      readonly(ATA_PROGRAM_ADDRESS),
      placeholder, // authorizationRulesProgram (none)
      placeholder, // authorizationRules (none)
    ],
    data: concat(b(49, 0), new Uint8Array(u64.encode(1n)), optNone()),
  };
};

// -----------------------------------------------------------------------------
// Account reads (decoded straight off the LiteSVM ledger)
// -----------------------------------------------------------------------------

export const getSellerHistory = async (
  client: Client,
  gumballMachine: Address,
  seller: Address
): Promise<SellerHistory | null> => {
  const [pda] = await findSellerHistoryPda({ gumballMachine, seller });
  const account = client.svm.getAccount(pda);
  if (!account || !account.exists) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return decodeSellerHistory(account as any).data;
};

export const getAddItemRequest = async (
  client: Client,
  asset: Address
): Promise<AddItemRequest | null> => {
  const [pda] = await findAddItemRequestPda({ asset });
  const account = client.svm.getAccount(pda);
  if (!account || !account.exists) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return decodeAddItemRequest(account as any).data;
};
