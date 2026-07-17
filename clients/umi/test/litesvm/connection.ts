/* eslint-disable import/no-extraneous-dependencies */
import { AccountLayout, MintLayout } from '@solana/spl-token';
import {
  AddressLookupTableAccount,
  Keypair,
  Message,
  PublicKey,
  Transaction,
  VersionedMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  Account,
  FailedTransactionMetadata,
  LiteSvm,
  SlotHash,
  TransactionMetadata,
} from 'litesvm/dist/internal';
import { getSvm } from './svm';

// A real validator keeps the last 512 slot hashes; LiteSVM never maintains the
// SlotHashes sysvar as its clock advances (it stays pinned at genesis). The
// AddressLookupTable program requires the caller's `recentSlot` to be a recent,
// past slot, so we mirror a validator by maintaining a descending 512-entry ring.
// This also survives ava's intra-file test concurrency, where sibling tests
// advance the shared clock between a test fetching `recentSlot` and its LUT
// create executing. SlotHash instances can't be constructed from JS, so the ring
// is bootstrapped by duplicating the genesis entry (which yields distinct mutable
// wrappers) and then recycled in place.
const SLOT_HASH_RING = 512;
let slotHashRing: SlotHash[] | null = null;

function recordSlotHash(svm: LiteSvm, slot: bigint): void {
  if (!slotHashRing) {
    const seed = svm.getSlotHashes()[0];
    if (!seed) return;
    svm.setSlotHashes(new Array(SLOT_HASH_RING).fill(seed));
    slotHashRing = svm.getSlotHashes();
  }
  // The just-left slot is strictly greater than every entry, so pushing it to the
  // front keeps the ring sorted descending (as `SlotHashes::get` expects).
  const recycled = slotHashRing.pop()!;
  recycled.slot = slot;
  slotHashRing.unshift(recycled);
  svm.setSlotHashes(slotHashRing);
}

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Minimal base58 encoder (web3.js's bundled bs58 isn't reachable at top level). */
function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;

  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  let out = '';
  for (let i = 0; i < zeros; i += 1) out += '1';
  for (let i = digits.length - 1; i >= 0; i -= 1)
    out += BASE58_ALPHABET[digits[i]];
  return out;
}

/** Decode a base58 string to bytes (inverse of base58Encode). */
function base58Decode(str: string): Uint8Array {
  const bytes: number[] = [];
  for (const ch of str) {
    let carry = BASE58_ALPHABET.indexOf(ch);
    if (carry < 0) throw new Error(`invalid base58 character '${ch}'`);
    for (let j = 0; j < bytes.length; j += 1) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  let leadingZeros = 0;
  for (let k = 0; k < str.length && str[k] === '1'; k += 1) leadingZeros += 1;
  return Uint8Array.from([
    ...new Array(leadingZeros).fill(0),
    ...bytes.reverse(),
  ]);
}

/**
 * A serialized transaction begins with a compact-u16 signature count (always a
 * single byte here since sig counts are tiny), followed by 64-byte signatures,
 * then the message. Legacy messages start with the writable-signer count; a
 * versioned message's first byte has the high bit set (0x80 | version).
 */
function messageStartOffset(raw: Uint8Array): number {
  const sigCount = raw[0];
  return 1 + sigCount * 64;
}

function isVersioned(raw: Uint8Array): boolean {
  return (raw[messageStartOffset(raw)] & 0x80) !== 0;
}

/** First signature of a serialized transaction, base58-encoded (its txid). */
function firstSignature(raw: Uint8Array): string {
  return base58Encode(raw.slice(1, 65));
}

/**
 * Deserialize the message portion of a raw transaction into a web3.js Message.
 * umi's `getTransaction` runs `fromWeb3JsMessage(transaction.message)`, which
 * throws on a null message, so a real message is required (used by `assertBotTax`
 * across the guard suites). `VersionedMessage.deserialize` returns a legacy
 * `Message` or a `MessageV0` as appropriate; both are accepted downstream.
 */
function extractMessage(raw: Uint8Array): Message | VersionedMessage {
  const messageBytes = raw.slice(messageStartOffset(raw));
  return isVersioned(raw)
    ? VersionedMessage.deserialize(messageBytes)
    : Message.from(messageBytes);
}

/**
 * Structural check for a VersionedTransaction. `instanceof` is unreliable here:
 * the SDK and this shim can resolve different `@solana/web3.js` module instances,
 * so a VersionedTransaction built by the SDK fails an `instanceof` against our
 * imported class. A legacy `Transaction` exposes `.instructions`; a
 * `VersionedTransaction` exposes `.message` and no `.instructions`.
 */
function isVersionedTransaction(
  tx: Transaction | VersionedTransaction
): tx is VersionedTransaction {
  return (
    (tx as any).message !== undefined && (tx as any).instructions === undefined
  );
}

/**
 * Turn a FailedTransactionMetadata into a thrown-friendly Error that the test
 * assertions can introspect. The logs already contain `custom program error:
 * 0x<hex>` and Anchor's `Error Number: <n>`; we also surface a JSON-RPC style
 * `{"InstructionError":[i,{"Custom":n}]}` for the code branch.
 */
function toTransactionError(failed: FailedTransactionMetadata): Error & {
  logs: string[];
  err: unknown;
} {
  const logs = failed.meta().logs();

  let jsonErr: unknown = 'TransactionError';
  let rpcString = '';
  try {
    const inner = failed.err() as any;
    if (
      inner &&
      typeof inner.err === 'function' &&
      typeof inner.index === 'number'
    ) {
      const instErr = inner.err();
      if (instErr && typeof instErr.code === 'number') {
        jsonErr = { InstructionError: [inner.index, { Custom: instErr.code }] };
        rpcString =
          JSON.stringify(jsonErr) + ` (error: 0x${instErr.code.toString(16)})`;
      } else {
        jsonErr = { InstructionError: [inner.index, String(instErr)] };
        rpcString = JSON.stringify(jsonErr);
      }
    } else {
      jsonErr = String(inner);
      rpcString = String(inner);
    }
  } catch {
    rpcString = failed.toString();
  }

  const error = new Error(
    `Transaction failed: ${rpcString}\n${logs.join('\n')}`
  ) as Error & {
    logs: string[];
    err: unknown;
    toJSON: () => unknown;
  };
  error.logs = logs;
  error.err = jsonErr;
  error.toJSON = () => jsonErr;
  return error;
}

type CachedResult = {
  err: (Error & { logs: string[]; err: unknown }) | null;
  logs: string[];
  message?: Message | VersionedMessage;
};

// Seconds added on top of real wall-clock time when syncing LiteSVM's clock.
// Tests that need to jump past a start/end date call `advanceClockBy(secs)`; the
// offset persists across transactions (unlike a raw setClock, which the per-tx
// clock sync would immediately overwrite).
let clockOffsetSecs = 0;
export function advanceClockBy(secs: number): void {
  clockOffsetSecs += secs;
}
export function resetClock(): void {
  clockOffsetSecs = 0;
}

/**
 * A duck-typed `@solana/web3.js` Connection backed by an in-process LiteSVM,
 * passed to `umi-rpc-web3js` (via `testPlugins`), the mallow SDK, and
 * `@solana/spl-token` cast as `Connection`.
 *
 * Execution is synchronous inside LiteSVM: a transaction runs the moment it is
 * submitted. We cache each result by signature so a subsequent
 * `confirmTransaction` / `getSignatureStatuses` / `getTransaction` reports the
 * true outcome.
 */
export class LiteSVMConnection {
  readonly rpcEndpoint = 'litesvm://in-process';

  readonly commitment = 'processed' as const;

  private results = new Map<string, CachedResult>();

  // Resolved lazily through `getSvm()` rather than captured in the constructor so
  // the connection always follows the current singleton. The constructor arg is
  // accepted for call-site compatibility but ignored.
  get svm(): LiteSvm {
    return getSvm();
  }

  constructor(_svm?: LiteSvm) {}

  private slot(): number {
    return Number(this.svm.getClock().slot);
  }

  /**
   * Advance LiteSVM's clock to real wall-clock time before executing. The tests
   * assert on-chain timestamps against `now()` (umi wall-clock), and LiteSVM's
   * clock is otherwise frozen at genesis.
   *
   * When `advanceSlot` is set (real sends) the slot is bumped via `warpToSlot` and
   * the slot we just left is pushed into the SlotHashes ring (see
   * `recordSlotHash`). The slot is left unadvanced for simulation so a
   * simulate-then-send pair only advances once.
   */
  private syncClock(advanceSlot = true): void {
    if (advanceSlot) {
      const prevSlot = this.svm.getClock().slot;
      this.svm.warpToSlot(prevSlot + 1n);
      recordSlotHash(this.svm, prevSlot);
    }
    const clock = this.svm.getClock();
    clock.unixTimestamp = BigInt(
      Math.floor(Date.now() / 1000) + clockOffsetSecs
    );
    this.svm.setClock(clock);
  }

  private execute(raw: Uint8Array): { sig: string; result: CachedResult } {
    this.syncClock();
    const res = isVersioned(raw)
      ? this.svm.sendVersionedTransaction(raw)
      : this.svm.sendLegacyTransaction(raw);
    const sig = firstSignature(raw);

    let message: Message | VersionedMessage | undefined;
    try {
      message = extractMessage(raw);
    } catch {
      message = undefined;
    }

    let result: CachedResult;
    if (res instanceof FailedTransactionMetadata) {
      result = {
        err: toTransactionError(res),
        logs: res.meta().logs(),
        message,
      };
    } else {
      result = {
        err: null,
        logs: (res as TransactionMetadata).logs(),
        message,
      };
    }
    this.results.set(sig, result);
    return { sig, result };
  }

  private toAccountInfo(acc: Account | null) {
    if (!acc) return null;
    return {
      executable: acc.executable(),
      owner: new PublicKey(acc.owner()),
      lamports: Number(acc.lamports()),
      data: Buffer.from(acc.data()),
      rentEpoch: Number(acc.rentEpoch()),
    };
  }

  // --- reads ---------------------------------------------------------------

  async getAccountInfo(pubkey: PublicKey, _commitment?: unknown) {
    return this.toAccountInfo(this.svm.getAccount(pubkey.toBytes()));
  }

  async getAccountInfoAndContext(pubkey: PublicKey, _commitment?: unknown) {
    return {
      context: { slot: this.slot() },
      value: await this.getAccountInfo(pubkey),
    };
  }

  async getMultipleAccountsInfo(pubkeys: PublicKey[], _commitment?: unknown) {
    return pubkeys.map((pk) =>
      this.toAccountInfo(this.svm.getAccount(pk.toBytes()))
    );
  }

  async getMultipleAccountsInfoAndContext(
    pubkeys: PublicKey[],
    _commitment?: unknown
  ) {
    return {
      context: { slot: this.slot() },
      value: await this.getMultipleAccountsInfo(pubkeys),
    };
  }

  async getBalance(pubkey: PublicKey, _commitment?: unknown) {
    return Number(this.svm.getBalance(pubkey.toBytes()) ?? 0n);
  }

  async getBalanceAndContext(pubkey: PublicKey, _commitment?: unknown) {
    return {
      context: { slot: this.slot() },
      value: await this.getBalance(pubkey),
    };
  }

  async getMinimumBalanceForRentExemption(
    dataLength: number,
    _commitment?: unknown
  ) {
    return Number(this.svm.minimumBalanceForRentExemption(BigInt(dataLength)));
  }

  async getTokenAccountBalance(pubkey: PublicKey, _commitment?: unknown) {
    const acc = this.svm.getAccount(pubkey.toBytes());
    if (!acc)
      throw new Error(`Could not find token account ${pubkey.toBase58()}`);
    const tokenAccount = AccountLayout.decode(Buffer.from(acc.data()));
    const mintAcc = this.svm.getAccount(tokenAccount.mint.toBytes());
    const decimals = mintAcc
      ? MintLayout.decode(Buffer.from(mintAcc.data())).decimals
      : 0;
    const { amount } = tokenAccount;
    const uiAmount = Number(amount) / 10 ** decimals;
    return {
      context: { slot: this.slot() },
      value: {
        amount: amount.toString(),
        decimals,
        uiAmount,
        uiAmountString: uiAmount.toString(),
      },
    };
  }

  async getLatestBlockhash(_commitmentOrConfig?: unknown) {
    return {
      blockhash: this.svm.latestBlockhash(),
      lastValidBlockHeight: this.slot() + 150,
    };
  }

  async getLatestBlockhashAndContext(_commitmentOrConfig?: unknown) {
    return {
      context: { slot: this.slot() },
      value: await this.getLatestBlockhash(),
    };
  }

  async getRecentBlockhash(_commitment?: unknown) {
    return {
      blockhash: this.svm.latestBlockhash(),
      feeCalculator: { lamportsPerSignature: 5000 },
    };
  }

  async getSlot(_commitment?: unknown) {
    return this.slot();
  }

  async getBlockHeight(_commitment?: unknown) {
    return this.slot();
  }

  async getFeeForMessage(_message: unknown, _commitment?: unknown) {
    return { context: { slot: this.slot() }, value: 5000 };
  }

  async getGenesisHash() {
    return '11111111111111111111111111111111';
  }

  async getAddressLookupTable(accountKey: PublicKey, _config?: unknown) {
    const info = await this.getAccountInfo(accountKey);
    if (!info) return { context: { slot: this.slot() }, value: null };
    const state = AddressLookupTableAccount.deserialize(info.data);
    return {
      context: { slot: this.slot() },
      value: new AddressLookupTableAccount({ key: accountKey, state }),
    };
  }

  // --- signature status ----------------------------------------------------

  async getSignatureStatuses(signatures: string[], _config?: unknown) {
    const slot = this.slot();
    return {
      context: { slot },
      value: signatures.map((sig) => {
        const r = this.results.get(sig);
        if (!r) return null;
        return {
          slot,
          confirmations: null,
          err: r.err,
          confirmationStatus: 'finalized',
        };
      }),
    };
  }

  async getSignatureStatus(signature: string, _config?: unknown) {
    const { context, value } = await this.getSignatureStatuses([signature]);
    return { context, value: value[0] };
  }

  async getTransaction(signature: string, _config?: unknown) {
    let meta: TransactionMetadata | FailedTransactionMetadata | null = null;
    try {
      meta = this.svm.getTransaction(base58Decode(signature));
    } catch {
      meta = null;
    }
    const cached = this.results.get(signature);
    if (!meta && !cached) return null;

    const tm = meta instanceof FailedTransactionMetadata ? meta.meta() : meta;
    const logs = tm ? tm.logs() : (cached?.logs ?? []);
    const err = cached
      ? cached.err
      : meta instanceof FailedTransactionMetadata
        ? {}
        : null;
    let returnData: { programId: string; data: [string, string] } | null = null;
    try {
      const rd = tm?.returnData();
      const data = rd?.data();
      if (data && data.length > 0) {
        returnData = {
          programId: new PublicKey(rd!.programId()).toBase58(),
          data: [Buffer.from(data).toString('base64'), 'base64'],
        };
      }
    } catch {
      returnData = null;
    }

    return {
      slot: this.slot(),
      blockTime: Math.floor(Date.now() / 1000),
      meta: {
        err,
        fee: 5000,
        logMessages: logs,
        preBalances: [],
        postBalances: [],
        innerInstructions: [],
        preTokenBalances: [],
        postTokenBalances: [],
        returnData,
        computeUnitsConsumed: tm ? Number(tm.computeUnitsConsumed()) : 0,
      },
      transaction: {
        message: cached?.message ?? null,
        signatures: [signature],
      },
      version: 0 as const,
    };
  }

  // --- writes --------------------------------------------------------------

  async sendRawTransaction(
    rawTransaction: Buffer | Uint8Array | number[],
    options?: { skipPreflight?: boolean }
  ) {
    const raw =
      rawTransaction instanceof Uint8Array
        ? rawTransaction
        : Uint8Array.from(rawTransaction);
    const { sig, result } = this.execute(raw);
    // With preflight enabled a real RPC rejects at send time; with skipPreflight
    // the failure only surfaces at confirmation. Emulate both.
    if (result.err && !options?.skipPreflight) throw result.err;
    return sig;
  }

  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    signersOrOptions?: Keypair[] | { skipPreflight?: boolean },
    maybeOptions?: { skipPreflight?: boolean }
  ) {
    let raw: Uint8Array;
    if (isVersionedTransaction(transaction)) {
      raw = transaction.serialize();
    } else {
      const tx = transaction as Transaction;
      const signers = Array.isArray(signersOrOptions) ? signersOrOptions : [];
      if (!tx.recentBlockhash) tx.recentBlockhash = this.svm.latestBlockhash();
      if (!tx.feePayer) {
        tx.feePayer = signers[0]?.publicKey ?? tx.signatures[0]?.publicKey;
      }
      if (signers.length) tx.partialSign(...signers);
      raw = tx.serialize();
    }
    const options = Array.isArray(signersOrOptions)
      ? maybeOptions
      : signersOrOptions;
    return this.sendRawTransaction(raw, options);
  }

  async confirmTransaction(
    strategyOrSignature: string | { signature: string },
    _commitment?: unknown
  ) {
    const sig =
      typeof strategyOrSignature === 'string'
        ? strategyOrSignature
        : strategyOrSignature.signature;
    const r = this.results.get(sig);
    // Throw the rich, introspectable error directly on a failed confirmation.
    if (r?.err) throw r.err;
    return { context: { slot: this.slot() }, value: { err: r ? r.err : null } };
  }

  async simulateTransaction(
    transaction: Transaction | VersionedTransaction,
    _configOrSigners?: unknown,
    _includeAccounts?: unknown
  ) {
    this.syncClock(false);
    let raw: Uint8Array;
    const versioned = isVersionedTransaction(transaction);
    if (versioned) {
      raw = transaction.serialize();
    } else {
      const tx = transaction as Transaction;
      if (!tx.recentBlockhash) tx.recentBlockhash = this.svm.latestBlockhash();
      if (!tx.feePayer) tx.feePayer = tx.signatures[0]?.publicKey;
      raw = tx.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
    }

    const res = versioned
      ? this.svm.simulateVersionedTransaction(raw)
      : this.svm.simulateLegacyTransaction(raw);
    const slot = this.slot();

    if (res instanceof FailedTransactionMetadata) {
      const meta = res.meta();
      return {
        context: { slot },
        value: {
          err: toTransactionError(res),
          logs: meta.logs(),
          unitsConsumed: Number(meta.computeUnitsConsumed()),
          accounts: null,
          returnData: null,
        },
      };
    }

    const meta = res.meta();
    return {
      context: { slot },
      value: {
        err: null,
        logs: meta.logs(),
        unitsConsumed: Number(meta.computeUnitsConsumed()),
        accounts: null,
        returnData: null,
      },
    };
  }

  // --- funding -------------------------------------------------------------

  async requestAirdrop(to: PublicKey, lamports: number) {
    const res = this.svm.airdrop(to.toBytes(), BigInt(lamports));
    const sig =
      res instanceof FailedTransactionMetadata
        ? firstSignatureFromMeta(res.meta())
        : res
          ? firstSignatureFromMeta(res)
          : base58Encode(Keypair.generate().publicKey.toBytes());
    this.results.set(sig, {
      err:
        res instanceof FailedTransactionMetadata
          ? toTransactionError(res)
          : null,
      logs: [],
    });
    return sig;
  }

  // --- subscription no-ops (some libs register listeners) ------------------

  onAccountChange() {
    return 0;
  }

  async removeAccountChangeListener() {}

  onSignature() {
    return 0;
  }

  async removeSignatureListener() {}

  onLogs() {
    return 0;
  }

  async removeOnLogsListener() {}
}

function firstSignatureFromMeta(meta: TransactionMetadata): string {
  return base58Encode(meta.signature());
}
