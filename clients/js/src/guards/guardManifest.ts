import { type Address, type Codec, type TransactionSigner } from '@solana/kit';
import { MachineType } from '../generated';

/**
 * A guard manifest describes, for a single guard, how to (de)serialize its
 * settings and how to parse its extra data + remaining accounts for the `draw`
 * and `route` instructions.
 *
 * Ported from the umi client to Solana Kit idioms: umi `Serializer` becomes a
 * kit `Codec`, and the mint/route parsers are async because kit PDA derivation
 * is async.
 */
export type GuardManifest<
  DA extends object = object,
  D extends DA = DA,
  MA extends object = object,
  RA extends object = object,
> = {
  name: string;
  codec: () => Codec<DA, D>;
  mintParser: MintParser<MA>;
  routeParser: RouteParser<RA>;
};

export type MintParser<MA extends object> = (
  mintContext: MintContext,
  args: MA
) => Promise<GuardInstructionExtras>;

export type RouteParser<RA extends object> = (
  routeContext: RouteContext,
  args: RA
) => Promise<GuardInstructionExtras>;

export const noopParser: MintParser<object> &
  RouteParser<object> = async () => ({
  data: new Uint8Array(),
  remainingAccounts: [],
});

export type MintContext = {
  /** The wallet to use for validation and non-SOL fees, this is typically the payer. */
  buyer: TransactionSigner;
  /** The wallet to use for SOL fees. */
  payer: TransactionSigner;
  /** The address of the Gumball/Jellybean Machine we are using. */
  machine: Address;
  /** The address of the Gumball Guard we are using. */
  gumballGuard: Address;
  /** The type of machine we are using. */
  machineType: MachineType;
};

export type RouteContext = Omit<MintContext, 'buyer'>;

/** Additional data and accounts to pass to the mint or route instruction. */
export type GuardInstructionExtras = {
  /** The serialized data to pass to the instruction. */
  data: Uint8Array;
  /** {@inheritDoc GuardRemainingAccount} */
  remainingAccounts: GuardRemainingAccount[];
};

/**
 * A remaining account to push to the mint or route instruction. When `signer`
 * is provided, the account is a signer and the `TransactionSigner` is carried
 * so the transaction can collect it.
 */
export type GuardRemainingAccount =
  | { address: Address; isWritable: boolean }
  | { signer: TransactionSigner; isWritable: boolean };
