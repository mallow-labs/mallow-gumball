import {
  getAddressEncoder,
  getProgramDerivedAddress,
  getUtf8Encoder,
  type Address,
  type ProgramDerivedAddress,
} from '@solana/kit';

// PDA finders codama cannot self-derive in the single-program (mallow_gumball)
// tree: external SPL/Metaplex program PDAs, the external Jellybean-program PDAs,
// and the two gumball-program PDAs the umi client also keeps hand-written. Each
// is async (kit derivation) and returns a `ProgramDerivedAddress` so the
// generated `*Async` instruction builders can await + assign them directly.

const addressEncoder = getAddressEncoder();
const utf8Encoder = getUtf8Encoder();

const SPL_TOKEN_PROGRAM =
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;
const ASSOCIATED_TOKEN_PROGRAM =
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address;
const TOKEN_METADATA_PROGRAM =
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s' as Address;
const MALLOW_GUMBALL_PROGRAM =
  'MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa' as Address;
const MALLOW_JELLYBEAN_PROGRAM =
  'J3LLYcm8V5hJRzCKENRPW3yGdQ6xU8Nie8jr3mU88eqq' as Address;

export async function findAssociatedTokenPda(seeds: {
  mint: Address;
  owner: Address;
  tokenProgram?: Address;
}): Promise<ProgramDerivedAddress> {
  const { tokenProgram = SPL_TOKEN_PROGRAM } = seeds;
  return await getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM,
    seeds: [
      addressEncoder.encode(seeds.owner),
      addressEncoder.encode(tokenProgram),
      addressEncoder.encode(seeds.mint),
    ],
  });
}

export async function findMetadataPda(seeds: {
  mint: Address;
}): Promise<ProgramDerivedAddress> {
  return await getProgramDerivedAddress({
    programAddress: TOKEN_METADATA_PROGRAM,
    seeds: [
      utf8Encoder.encode('metadata'),
      addressEncoder.encode(TOKEN_METADATA_PROGRAM),
      addressEncoder.encode(seeds.mint),
    ],
  });
}

export async function findMasterEditionPda(seeds: {
  mint: Address;
}): Promise<ProgramDerivedAddress> {
  return await getProgramDerivedAddress({
    programAddress: TOKEN_METADATA_PROGRAM,
    seeds: [
      utf8Encoder.encode('metadata'),
      addressEncoder.encode(TOKEN_METADATA_PROGRAM),
      addressEncoder.encode(seeds.mint),
      utf8Encoder.encode('edition'),
    ],
  });
}

export async function findTokenRecordPda(seeds: {
  mint: Address;
  token: Address;
}): Promise<ProgramDerivedAddress> {
  return await getProgramDerivedAddress({
    programAddress: TOKEN_METADATA_PROGRAM,
    seeds: [
      utf8Encoder.encode('metadata'),
      addressEncoder.encode(TOKEN_METADATA_PROGRAM),
      addressEncoder.encode(seeds.mint),
      utf8Encoder.encode('token_record'),
      addressEncoder.encode(seeds.token),
    ],
  });
}

export async function findEventAuthorityPda(
  config: { programAddress?: Address } = {}
): Promise<ProgramDerivedAddress> {
  const { programAddress = MALLOW_GUMBALL_PROGRAM } = config;
  return await getProgramDerivedAddress({
    programAddress,
    seeds: [utf8Encoder.encode('__event_authority')],
  });
}

export async function findGumballMachineAuthorityPda(seeds: {
  gumballMachine: Address;
}): Promise<ProgramDerivedAddress> {
  return await getProgramDerivedAddress({
    programAddress: MALLOW_GUMBALL_PROGRAM,
    seeds: [
      utf8Encoder.encode('gumball_machine'),
      addressEncoder.encode(seeds.gumballMachine),
    ],
  });
}

export async function findJellybeanEventAuthorityPda(): Promise<ProgramDerivedAddress> {
  return await getProgramDerivedAddress({
    programAddress: MALLOW_JELLYBEAN_PROGRAM,
    seeds: [utf8Encoder.encode('__event_authority')],
  });
}

export async function findJellybeanMachineAuthorityPda(seeds: {
  jellybeanMachine: Address;
}): Promise<ProgramDerivedAddress> {
  return await getProgramDerivedAddress({
    programAddress: MALLOW_JELLYBEAN_PROGRAM,
    seeds: [
      utf8Encoder.encode('jellybean_machine'),
      addressEncoder.encode(seeds.jellybeanMachine),
    ],
  });
}

export async function findJellybeanUnclaimedPrizesPda(seeds: {
  jellybeanMachine: Address;
  buyer: Address;
}): Promise<ProgramDerivedAddress> {
  return await getProgramDerivedAddress({
    programAddress: MALLOW_JELLYBEAN_PROGRAM,
    seeds: [
      utf8Encoder.encode('unclaimed_prizes'),
      addressEncoder.encode(seeds.jellybeanMachine),
      addressEncoder.encode(seeds.buyer),
    ],
  });
}
