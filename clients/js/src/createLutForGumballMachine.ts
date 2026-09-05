import {
  findAddressLookupTablePda,
  getCreateLookupTableInstruction,
  getExtendLookupTableInstruction,
} from '@solana-program/address-lookup-table';
import {
  type Address,
  type GetAccountInfoApi,
  type Instruction,
  type Rpc,
  type TransactionSigner,
} from '@solana/kit';
import {
  fetchGumballMachine,
  MALLOW_GUMBALL_PROGRAM_ADDRESS,
} from './generated';
import { findGumballGuardPda } from './generated/pdas';

const SPL_TOKEN_PROGRAM_ID =
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;
const SPL_ASSOCIATED_TOKEN_PROGRAM_ID =
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address;
const TOKEN_METADATA_PROGRAM_ID =
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s' as Address;
const SYSVAR_INSTRUCTIONS =
  'Sysvar1nstructions1111111111111111111111111' as Address;
const SYSVAR_SLOT_HASHES =
  'SysvarS1otHashes111111111111111111111111111' as Address;

export type CreateLutForGumballMachineInput = {
  rpc: Rpc<GetAccountInfoApi>;
  recentSlot: bigint;
  gumballMachine: Address;
  /** Authority (and payer) of the lookup table. */
  authority: TransactionSigner;
  payer?: TransactionSigner;
  /** The gumball machine authority to include (defaults to `authority`). */
  gumballMachineAuthority?: Address;
};

/**
 * Collects the addresses a gumball machine draw touches, for inclusion in an
 * Address Lookup Table.
 */
export const getLutAddressesForGumballMachine = async (
  rpc: Rpc<GetAccountInfoApi>,
  gumballMachine: Address,
  wallet: Address
): Promise<Address[]> => {
  const gumballMachineAccount = await fetchGumballMachine(rpc, gumballMachine);
  const { mintAuthority } = gumballMachineAccount.data;
  const [gumballGuard] = await findGumballGuardPda({ base: gumballMachine });

  return [
    ...new Set<Address>([
      gumballMachine,
      gumballGuard,
      wallet,
      mintAuthority,
      SYSVAR_INSTRUCTIONS,
      SYSVAR_SLOT_HASHES,
      SPL_TOKEN_PROGRAM_ID,
      SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_METADATA_PROGRAM_ID,
      MALLOW_GUMBALL_PROGRAM_ADDRESS,
    ]),
  ];
};

/**
 * Builds the create + extend instructions for an Address Lookup Table populated
 * with a gumball machine's draw addresses, returning the instructions and the
 * derived lookup-table address.
 */
export const createLutForGumballMachine = async (
  input: CreateLutForGumballMachineInput
): Promise<{ instructions: Instruction[]; lookupTableAddress: Address }> => {
  const { rpc, recentSlot, gumballMachine, authority } = input;
  const payer = input.payer ?? authority;
  const wallet = input.gumballMachineAuthority ?? authority.address;

  const addresses = await getLutAddressesForGumballMachine(
    rpc,
    gumballMachine,
    wallet
  );

  const [lookupTableAddress, bump] = await findAddressLookupTablePda({
    authority: authority.address,
    recentSlot,
  });

  const createInstruction = getCreateLookupTableInstruction({
    address: [lookupTableAddress, bump],
    authority,
    payer,
    recentSlot,
  });
  const extendInstruction = getExtendLookupTableInstruction({
    address: lookupTableAddress,
    authority,
    payer,
    addresses,
  });

  return {
    instructions: [createInstruction, extendInstruction],
    lookupTableAddress,
  };
};
