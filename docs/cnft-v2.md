# Bubblegum v2 gumball recovery

Existing instruction discriminators, arguments and named accounts are unchanged.
Generate clients with `heavy -- pnpm generate:clients` after the documented build.

| Instruction | Arguments | Remaining accounts |
| --- | --- | --- |
| `refund_cnft_sale_v2` | `index: u32`, `nonce: u64`, `root: [u8; 32]`, `leaf: Option<CnftV2RefundLeaf>` | Current Merkle proof |
| `admin_refund_cnft_sale_v2` | Same as permissionless refund | Marketplace fee authority **signer**, canonical guard `GlobalConfig`, then current Merkle proof |
| `reclaim_cnft_v2` | `args: CnftArgsV2` | Canonical guard `GlobalConfig`, then current Merkle proof |
| `close_missing_cnft_recovery_v2` | `root: [u8; 32]`, `leaf: Option<CnftV2RefundLeaf>` | Current Merkle proof; for marketplace-authorized unprovable-tree cleanup, use no leaf, zero root and the marketplace fee authority **signer** followed by canonical guard `GlobalConfig`, with no proof |

`CnftV2RefundLeaf` contains owner, delegate, data hash, creator hash, collection
hash, asset-data hash and flags. Tree and nonce derive the stored asset identity;
nonce also identifies the proof slot. On the permissionless path, `None` proves
the compression empty node or a closed recorded tree, not a default-owner
Bubblegum leaf. Proof-based live-tree recovery requires the exact current root;
marketplace-authorized unprovable-tree exits use the zero-root form below.

Both refund instructions use the same named accounts, in order: payer (signer,
writable), machine, authority PDA, seller, seller history, optional buyer,
optional authority PDA payment account, optional buyer payment account,
optional payment mint, tree, recovery receipt, MPL compression, token program,
associated token program, system program, optional Core collection, event
authority, gumball program. The collection slot supplies proof-bound Permanent*
plugin evidence for a drawn item when its recorded buyer signs. The generated receipt resolver
uses machine, tree and nonce. Pass Token-2022 explicitly as `tokenProgram` for
Token-2022 refunds; the helpers authenticate the escrow and buyer ATAs.

The admin discriminator is `[182, 15, 184, 198, 77, 222, 134, 213]`. Its extra
signer is the **first remaining account**, rather than a new named account.
This preserves every existing refund account index, including event-CPI accounts.
The signer must equal `account_fee_authority` in the canonical Gumball Guard
`GlobalConfig` PDA at `["global_config"]`, owned by
`GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF`. The second remaining account
is that config; owner, address, discriminator and signer status are checked.
The mainnet PDA is `8zUgYdS3vQYaXEJSgoKV82VMXPEvHMNJ1np6eQdywpLR`;
a read-only finalized RPC check on 2026-10-04 confirmed its 72-byte layout and
mallow fee authority `MADMQ67GBNsVQPtq1ZnYSZzJ3Fd2gLJFWtT6bKWo97E`.
Use the current config value after authority rotation. A machine's user-supplied
fee config and creator authority never authorize admin recovery.
The admin signer does not need to pay transaction fees or receipt rent.
`reclaim_cnft_v2.authority` uses the same trusted signer and takes the config as
its first remaining account, before proof. Both paths work without creator consent.

## Closed trees

Bubblegum `CloseTreeV2` closes an all-empty tree and its tree config. The tree
keypair holder can re-create the address. Empty-leaf recovery therefore checks
whether the recorded slot can still exist in the account at that address:

- A non-MPL owner, with any data length, is missing-tree evidence, except an
  SPL account-compression owner (see marketplace authorization below).
- An MPL-owned account is missing-tree evidence if its concurrent-tree header
  is absent/uninitialized, the tree counters/layout are invalid, or the recorded
  index is at least the append index (`rightmost_proof.index`) or tree capacity.
- An initialized MPL tree with the recorded index below its append index uses
  the existing current-root empty-leaf proof when one is available. A replacement
  with an occupied or unprovable slot is not permissionless missing-leaf evidence;
  the marketplace-authorized exit below handles it after off-chain verification.

`refund_cnft_sale_v2` and `close_missing_cnft_recovery_v2` use `leaf = None` for
missing-tree evidence. For settlement, first refund an unclaimed missing item;
then use `args.flags = 255` on the claimed item, including an unsold item marked
claimed by recovery. Keep `version = 2` and `nonce == index`. A drawn missing
item refunds its full original payment; a claimed burnt item pays its seller;
unsold recovery retains its pooled share; receipt closure returns rent to its
recorded payer.

SPL-owned accounts need special care because config lines do not record the
compressed asset version, and live v1 trees cannot close. Permissionless refund
and burnt settlement must not mistake a live v1 tree for a closed v2 tree.
Use `admin_refund_cnft_sale_v2` with `leaf = None` for an SPL-owned replacement.
For subsequent burnt settlement, or for any other replacement whose loss cannot
be established permissionlessly, use `args.flags = 255` with a zero root and
prefix the remaining accounts with the
marketplace fee authority **signer**, then canonical guard `GlobalConfig`, then
any Token-2022 payment-program slot. There are no creator payout accounts or
proof nodes in this form. The marketplace must confirm missing v2 delivery
off-chain before signing. Receipt cleanup needs no signer: the typed
`CnftRecovery` receipt was created by a v2 recovery path and establishes that
this is not a live v1 config line. For an occupied/unprovable MPL replacement,
receipt cleanup uses `leaf = None`, a zero root, and the same marketplace signer
and canonical GlobalConfig prefix. The original rent payer remains the recipient.
Machine closure follows the normal all-settled and outstanding-draw checks.

With `leaf = None`, the marketplace-authorized admin refund is independent of
the tree account, root and VerifyLeaf CPI. It still checks the tree/nonce-derived
asset against the recorded config line and retains every authority, state,
currency and draw-ledger check. With a live leaf supplied, it retains current-root
proof verification. Operator tooling must simulate the same claim and refuse
an admin refund if delivery succeeds. Umi's `prepareAdminRefundCnftSaleV2` now
supports missing-tree evidence: it checks the account/slot, requires zero root
and no proof, and simulates the same draw. It rejects occupied original live v1
and v2 slots, claim/refund identity mismatches, funding failures and unrelated
pre-CPI errors. An occupied MPL tree whose header authority differs from the
canonical Bubblegum tree-config PDA is off-chain replacement evidence only;
permissionless evidence remains unchanged. Occupied SPL slots are always refused.
`prepareAdminSettleMissingCnftSaleV2` and `prepareAdminCloseMissingCnftRecoveryV2`
apply the same off-chain evidence gate and simulate the resulting authorised exit.
All three preparation helpers build transactions without sending them. For SPL
settlement, establish v2 origin from escrow-entry history before signing.

Pass the recorded tree key and canonical tree-config PDA even when those
accounts are gone or re-created. Use a zero root and no proof nodes for the
missing-tree forms. Any live-leaf input, transfer settlement, claim or reclaim
continues to require a live MPL-owned v2 tree. When an escrowed recovery leaf no
longer exists in the recorded tree, close its receipt instead of reclaiming it. No named account, argument,
discriminator, config line or ledger layout changes.

Backend builders must mirror the owner/header/append-index rules on recovery
exits, and the SPL authorization convention above. Use cached tree dimensions /
owner on live settlement; fetch full tree data only on an exit when missing-slot
evidence is needed. DAS may have no metadata/proof after closure. For admin
preparation, simulate the same claim before constructing `leaf = None` with zero
root and no proof. Backend changes belong to the monorepo worktree.

## Evidence and operator recovery

Permissionless refunds accept proof-verified leaf evidence: empty/burnt,
owner different from the escrow authority PDA, or nonzero leaf flags. A drawn
item also qualifies if its current Core collection has a PermanentFreezeDelegate,
PermanentTransferDelegate or PermanentBurnDelegate plugin. The account must be
owned by Core, have the collection discriminator, and hash to the current leaf's
proof-verified collection hash. Only the recorded buyer may sign this collection
refund; the buyer can choose ordinary claim or transfer settlement instead.
Collection length and unrelated plugin shape never authorize this exit. Unsold
collection failures continue to require the marketplace-authorized admin path.

Eligibility is an escrow-entry snapshot. A collection/tree authority can change
metadata or collection membership, even after delivery, and a permanent delegate
can later claw back or burn a claimed leaf. Once claimed, the seller can receive
proceeds and this draw has no refund recourse. The new option protects the buyer's
choice before claim; it does not guarantee future collection-authority behavior.

Other collection failures use `admin_refund_cnft_sale_v2`. Operator tooling must build
and simulate the actual claim with the current leaf, proof and collection;
**refuse an admin refund when claim succeeds**. Reuse already fetched accounts
and proof. Treat invalid inputs, missing accounts and insufficient payer funds
as preparation errors, not collection failure. The Umi
`prepareAdminRefundCnftSaleV2` helper validates that claim/refund identify the
same draw and authenticated metadata, simulates claim, rejects success and
pre-delivery/funding failures, and then adds the marketplace signer and canonical config to the refund.
It builds transactions without sending them. The Rust backend must apply the
same simulation rule before building its generated admin instruction. The Umi
preparation helper handles drawn items; for an unsold item simulate ordinary
settlement with its actual delivery before authorizing skipped delivery.

Entry still rejects nonzero flags and any permanent freeze, transfer or burn
delegate plugin. TransferV2 itself validates membership and deliverability.
The old `CNFT_COLLECTION_RECOVERY_SIZE` constant and entry size rejection are
removed from the program and all clients. Large AppData can transfer; small
Attributes vectors can exhaust Bubblegum's heap.

The committed LiteSVM fixtures measure these **shape-specific** limits against
the pinned Bubblegum binary; none is an admission or refund threshold:

| Shape | Transfers | Allocation failure |
| --- | --- | --- |
| Single large attribute, review fixture | 22,213 collection bytes | 22,214 bytes (correcting the former 24,156 claim) |
| Single large attribute, `Shape fixture` test | 22,210 collection bytes | 22,211 bytes, adjacent boundary measured by simulation |
| One-byte key/value Attributes, `Shape fixture` | 170 entries / 1,838 bytes | 180 entries / 1,938 bytes; also 200 / 2,138 |
| AppData, one external adapter | 30,000 and 60,000 data bytes, at entry and after escrow | No failure in these fixtures |

Base names and plugin layouts affect allocations. The exact-size tests also
cover 16,384, 16,385, 17,156, 22,156, 22,212, 22,213, 22,214 and 24,156 bytes.
Failing shapes refund the buyer fully through the admin path; transferable
shapes reject permissionless refunds. The Bubblegum SHA-256 is
`b3a04a9d16cf2f168ae50e13756557867b3f6805c77519546147ec4065838bab`;
MPL Core is `96fa631a61234766afa538437c5166c628100dbc70e5c3ddb2f306d5dc5a8ba5`.

## Payment ledger and partial settlement

An authorized v2 add or approval enables version 6 on an unused, editable v5
machine (`items_redeemed == 0`, `total_revenue == 0`). Requests retain v5 and
append their v2 marker plus the shared live-request marker to the legacy request
prefix until approval (all newly created request accounts are 107 bytes).
Growth may not exceed 10,240 bytes per instruction. A minimally allocated v5
machine can therefore grow through capacity **637** (`40 + 16 × 637 = 10,232`),
but capacity 638 requires 10,248 bytes and returns `CnftLedgerGrowthTooLarge`
(6078). Existing Kit/Umi size helpers include nineteen padding bytes, so their
unextended v5 accounts fit through capacity 638; inspect actual account length.
A larger existing account cannot be preallocated retroactively by these entry
instructions: cancel/remove editable inventory and recreate with v6 space.
Kit/Umi creation helpers preallocate the extension while initialization remains
v5. If growth is needed, only the machine authority may fund it (6079 otherwise).
Invited sellers use a request followed by authority approval, or wait until the
authority initializes the ledger. Their direct adds never fund growth rent that
would return to the creator at close. This v6 family has not shipped; consumers
must synchronize its complete layout before release.

Immediately after `total_proceeds_settled`, the hidden section contains:

| Field | Encoding |
| --- | --- |
| `pending_draw_payment` | u64 |
| `refund_reserve` | u64 |
| `draw_payments` | u64 × item capacity, no length prefix |
| `items_refunded` | u64 |
| `outstanding_draws` | u64 |
| `item_proceeds_paid` | u64 × item capacity, no length prefix |
| `unfinalized_proceeds` | u64 |

The extension remains **40 + 16 × item_capacity bytes**. The two full-width u64
arrays retain independent original draw payments and cumulative payout amounts.
Reusing a slot after claim could preserve current settlement arithmetic, but
would discard the historical payment exposed by all three decoders; reusing the
legacy config-line amount changes existing storage semantics. Narrowing either
array loses exactness for valid u64 payments. Sparse per-draw accounts add rent,
accounts and CPIs to the hot path. We keep exact records and O(1) accounting,
with the growth ceiling and creator-funded rent made explicit above.
These fields are exposed by
Kit, Umi and the handwritten Rust runtime decoder. Each compressed draw reserves
its entire actual gross payment and increments `outstanding_draws`, including
zero-price draws. Claim releases its payment and decrements the draw count.
Refund also removes that full payment from revenue and forfeits its pooled share.
Sold-item proof and marketplace-admin refunds are available during `SaleLive`
and `SaleEnded`, including collab machines; they never depend on the untrusted
machine authority ending the sale. Unsold recovery still requires `SaleEnded`.

All v6 settlement paths, including batch tokens and v1 asset standards inside a
v6 machine, use the same cumulative accounting. For each item:

```
resolved_revenue = total_revenue - refund_reserve
remaining_pool = resolved_revenue - total_proceeds_settled + unfinalized_proceeds
remaining_items = items_loaded - items_settled
entitlement = remaining_pool / remaining_items
payment_now = entitlement - item_proceeds_paid[index]
```

Pay available proceeds while holding every pending refund in escrow. Record each
item's gross payout; repeated settlement with unchanged revenue pays zero.
Partial payouts retain the item settlement bit and seller history for top-ups.
When all outstanding draws resolve **and the sale has ended or all inventory
has been drawn**, another settlement pays the balance owed and finalizes the
item. An early live solo payout stays open even when no draw is currently
outstanding: a later draw can still require a refund. This ensures the last
refund cannot strand an earlier item's unpaid entitlement. Final division leaves integer dust for the last item, exactly
as legacy pooled settlement does; every gross unit is accounted for.
`unfinalized_proceeds` prevents earlier partial payouts or finalized/re-added
slots from changing another seller's entitlement or spending a reserve.

For example, two collab sellers with two 1 SOL draws and one pending draw can
receive 0.5 SOL from resolved revenue. If the pending draw is refunded, the
remaining seller receives another 0.5 SOL; if it is claimed, each seller finishes
at 1 SOL. The stuck leaf cannot block the honest seller's first payout. Close
still requires final settlement; outstanding draws retain their top-up records.

Marketplace and curator fees use differences between cumulative rounded amounts
on repeated item settlement, preserving exact fee accounting. V6 retains
marketplace fees on draw and pays fees at settlement. Curator fees apply after
marketplace fees and become immutable once any v6 proceeds have been paid.
Existing v1–v5 settlement economics remain unchanged.

Unsold recovery refunds zero and skips **only asset delivery**. It marks the
item claimed and optionally creates a recovery receipt, while keeping its seller
history, settlement bit and pooled entitlement open. Run ordinary
`settle_cnft_sale_v2` afterwards with current authenticated metadata/proof (or
an empty-node proof with `args.flags = 255` for a burnt leaf); it pays the normal share and fees without
attempting TransferV2. Recovery works before or after other payouts and never
shrinks their divisor. Permissionless unsold recovery requires the seller or
machine authority as payer; admin recovery instead requires the marketplace
signer. Marketplace tooling must verify collection-level undeliverability for
unsold recovery too; a healthy unsold item can settle normally.
Unsold settlement remains restricted to `SaleEnded` for all standards/versions.
Burnt settlement uses the reserved `u8::MAX` flags signal, never owner/delegate
key inference. Its proof must authenticate the empty slot with `nonce == index`.
For live leaves, use their actual flags (bits 0–2) and current metadata/proof,
even if both owner and delegate equal `Pubkey::default()`. The backend's
claimed-burnt settlement builder must set `args.flags = 255`; accounts,
argument layouts and discriminators are unchanged.
V6 solo re-adds retain their instruction interface but normal draws cannot refill
mid-sale: each live payout remains provisional while inventory is drawable, so
re-add fails with 6036. The last normal draw automatically sets `SaleEnded`, which
also rejects re-add even after every paid slot is settled again and finalized.
A finished sale cannot reopen; create a new machine for replacement inventory.
Finalizing payouts is necessary for closing, not a way to enable live refills.

Every v6 settlement builder must supply the configured marketplace fee wallet
and, for token payment, its ATA. Backend `settle_fee_account` must include v6 as
well as version 0. Batch token settlement appends fee accounts after the existing
Token-2022 program slot. Missing fee accounts fail atomically.
The signing mint authority for v6 revenue reporting and direct draws must be
owned by the canonical gumball-guard program.

## Recovery receipts and existing behavior

Drawn-item refunds mark the item claimed/settled, decrement seller history and
emit `RefundCnftSaleEvent` with the full payment. Unsold recovery emits the same
event with default buyer and zero amount, but **does not mean settled**; its
seller history and payout remain open for ordinary settlement. Neither refund
instruction directly pays seller royalties or curator fees. If the leaf remains escrowed, the payer funds a
208-byte receipt at `["cnft_recovery", machine, tree, nonce_le_u64]`. Otherwise
that receipt closes immediately to the payer. The indexer must distinguish refund
and partial settlement events; a settle event alone no longer proves an item is
finally settled. Check its machine bitmap / accounting fields.

Reclaim requires the canonical guard config's current marketplace fee authority,
including after machine closure or creator authority rotation. The receipt's
legacy `authority` field remains a historical creator snapshot and is not an
access-control source. The recorded seller is the sole asset recipient;
successful recovery returns receipt rent to its recorded payer.
Pass the receipt's machine address even after closure. Reclaim binds its address
only; a creator recreating or assigning that address cannot block seller recovery.
Missing-receipt cleanup requires current-root proof of burning or departure from
escrow, permissionless missing-tree evidence, or the marketplace-authorized
zero-root / no-leaf form described in [Closed trees](#closed-trees).

Across every account version, `update_settings` locks payment mint once any item
is loaded, details are finalized, any live add request exists, or the sale starts.
DetailsFinalized machines retain their finalized-term protections. Every pre-upgrade
machine additionally holds the request lock until marketplace-authorized migration
attests a complete scan, including state-None machines.
A live request also prevents increasing curator fees, decreasing items per seller,
or changing hide-sold-items, including on a root-None machine in state None.
Before sale, invite roots can change `Some(a) → Some(b)` even with inventory;
`None → Some` is also allowed while a request is pending. Clearing the collab
flag is allowed when only the creator has loaded items and no live requests remain.
Invited loaded items or pending requests block `Some → None`. Approval and every
cancellation decrement the live count; cancelled uninvited requests leave no
permanent marker. All roots remain immutable during and after sale.

The count is a little-endian u64 at header bytes **411..419** (before the fixed
config section) on every version, using reserved padding without reallocating
machines. Request accounts append a version byte (2 for v2 cNFT, 0 otherwise)
and a live-accounting marker (1) to the unchanged 105-byte request prefix.
Existing requests without the accounting marker retain their original cancellation
account lists until migrated. Migration grows each legacy request to 107 bytes,
counts it once and sets marker 1; its cancellation then appends the writable machine
and decrements the count. Marker 2 is a rejected request: it is excluded from live
accounting and can still use the original seller cancellation account list.

For new NFT, Core, v1 cNFT and v2 cNFT requests, cancellation appends the machine
address as a writable remaining account **after any proof nodes**. This account
may already be closed or recreated with unrelated data. Cancellation validates
the machine discriminator before adjusting a nonzero live count, so such address
reuse cannot trap a request. Kit and Umi export `withRequestCancellationMachine` to
append it without RPC calls; all three clients decode `pendingAddRequests`
(`pending_add_requests` in Rust). Sync backend cancellation builders accordingly.
A missing, substituted or read-only live accounting account fails with 6051.
No existing named accounts, argument layouts or instruction discriminators change.

Shared `approve_add_item` requires collab mode on every version. Build
`[updateSettings({sellersMerkleRoot: root}), approveAddItem…]` in that order in the
same transaction, or confirm the root update before sending approvals. Subsequent
approval groups must wait for that root-setting transaction. The atomic ordering
is verified on-chain; the web agent owns the corresponding React ordering fix.
A solo creator can still invite sellers before sale.
Permitted metadata edits preserve the state, and a finished sale cannot reopen.
Removal processors reject drawn, claimed, settled or paid items.

Existing codes remain stable: InvalidState 6036, InvalidAuthority 6037,
InvalidSettingUpdate 6045, AssetDeliverable 6074, StaleRefundEvidence 6075,
InvalidRefundEvidence 6076 and RefundReserveOutstanding 6077. Code 6077 is
retained for wire compatibility but unsold recovery no longer uses it to block
exits after payouts. New errors are CnftLedgerGrowthTooLarge 6078 and
CnftLedgerRequiresAuthority 6079. Existing `approve_add_item` now requires
collab mode and the machine's authority; its earlier `has_one` constraint adds
an IDL `relations` entry without changing account indices or instruction bytes.

## Round-nine collaborator controls and request migration

`set_mint_authority` refuses a different minting path while invited inventory or
pending requests exist, while a finalized collab root remains, or while legacy
request accounting is unreconciled (6045). Guard `wrap` and `unwrap` apply the
same check before CPI, so guard-first rollout protects those paths as well.
Each guard serves exactly the machine whose address equals its immutable `base`.
Guard `wrap`, `update`, `withdraw`, and both draw handlers enforce this binding
(guard error InvalidMachine 6056), including for Jellybean machines. Existing
guards use their stored base on first touch; there is no new field, resize or
migration transaction. A mismatched legacy guard fails closed. Before rollout,
run the read-only [guard-binding release gate](#guard-binding-release-gate),
which scans both machine programs and guards and blocks release if a wrapped
machine has a different guard base or a guard serves multiple machines. A finalized
read-only mainnet check on 2026-10-05 found all four live Jellybean machines
wrapped with matching bases, with no shared guards; the round-ten review found
all 130 live gumball machines also use matching bases.

Guard `update` checks the bound machine's lock and refuses prices, payment
destinations, groups and eligibility changes while it holds. Guard closure
must close that same machine, so outstanding inventory prevents closure and
reinitialization. These rules apply to versions 0–6 without changing any
existing instruction's accounts or arguments. Idempotent wrapping is allowed.
An empty, reconciled machine whose mint authority is still its creator can wrap
for the first time, including at creation with a sellers root. Solo creators
can edit their bound guard before a draw and unwrap/re-wrap it; a guard with an
unrelated base cannot replace it. Collaborators must review the existing guard
before submitting assets.

`reject_add_item_request` is signed by the machine authority. Named accounts,
in order: writable `gumball_machine`, writable `add_item_request`, writable
signer `authority`, `system_program`; no arguments. It resolves the live count
once and writes request byte **106 = 2**. Approval and repeated rejection then
fail with 6036. It does not transfer or draw the asset, finalize details, or grow
the machine's v6 ledger. The seller recovers custody and request/history rent
through the existing cancellation instruction, including after machine closure.
For a legacy request only, the authority funds any rent needed for two added
bytes; that rent returns to the seller on cancellation. This separation makes
rejection work without fresh compressed proofs, a cooperative seller or a
successful asset transfer, including capacity-700 v5 machines. Rejected requests
must be excluded from pending-request displays and approval builders.

`migrate_add_item_requests` is signed by the canonical guard GlobalConfig's
marketplace `account_fee_authority`, never a machine creator. Named accounts,
in order: writable `gumball_machine`, signer `authority`, `global_config`, writable
signer `payer`, `system_program`; argument `complete: bool`. Remaining accounts
are writable canonical request PDAs for that machine. Untracked requests grow to
107 bytes, retain their asset-version byte, gain marker 1 and increment the count
once. Already-counted/rejected requests are skipped, including duplicate accounts.
The payer funds only the actual cluster-rent shortfall of the two appended bytes.
`complete = false` permits batching. The final `complete = true` sets reserved
machine header byte **410 = 1**; before that, every economic and mint-path lock
conservatively treats legacy requests as outstanding. Completeness is a trusted
marketplace attestation after the off-chain scan below: an individual transaction
cannot prove that no other request PDA exists. Repeating a completed migration
fails with 6045. New machines initialize byte 410 to 1.

All clients decode `addRequestsMigrated` / Rust `add_requests_migrated`. Kit/Umi
export `getAddItemRequestStatus(rawData)` and Rust exports
`is_add_item_request_rejected(raw_data)`; these use already-fetched bytes and
need no extra RPC call. The 105-byte account prefix and original instruction
layouts remain unchanged. Existing claims, cancellation and settlement do not
require completed migration.

### Deploy-time request check

Immediately before upgrading, take a finalized `getProgramAccounts` snapshot of
`MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa`, filtered by the AddItemRequest
IDL discriminator `[234,140,142,7,121,224,48,173]`. Explicitly inspect a second
query with **dataSize 105** for legacy requests. Do not restrict the complete
scan to 105: 106-byte v2 requests and any untracked larger request also count.
Before upgrade, verify every live machine's serialized settings end at or before
byte 410 and every byte in **410..418 is zero**. Nonzero reserved bytes are a
release blocker; the old `update_settings` URI serialization could write them.
Any machine with byte 410 = 1 and a marker-zero request is also a release blocker,
not a machine to skip. Decode machine address from bytes 8..40 and batch
`getMultipleAccounts` on those addresses. Record live machines and their state, especially state None; closed
machine requests remain seller-cancellable and need no migration.

After upgrading gumball, repeat the complete request scan at finalized commitment.
For each live machine whose byte 410 is not 1, migrate every non-rejected,
untracked request in batches. Confirm each batch before preparing the next; new
requests created by the upgraded program are already counted. Re-scan before
signing `complete = true`, verify every remaining live request has marker 1 or 2,
and verify header bytes 411..419 equal the count of marker-1 requests for that
machine. The marketplace signs completion only after those checks. For machines
with no requests, attest completion with an empty remaining-account list. Finish
this for every live pre-upgrade machine before re-enabling creator settings or
new v2 entries behind `MALLOW_PROGRAMS_V2_READY`. A legacy requester may instead
cancel before migration and re-request under the upgraded program; cancellation
and other escrow exits stay available throughout.

### Executable reconciliation dependency

`configs/program-scripts/reconcile-add-item-requests.cjs` implements the scan,
batching and marketplace attestation above. This is a tracked release dependency
alongside `MALLOW_PROGRAMS_V2_READY`: reconcile **every** live pre-upgrade
machine, including solo machines with no requests, before enabling readiness.
The script is dry-run by default and was not run against any cluster during
implementation. Its ten offline tests cover full-size request scans, partial
resume, count/marker blockers, canonical PDAs, confirmation ordering and
idempotent reruns.

From the repo root, install the existing client dependencies and build the Umi
client with `heavy -- pnpm --dir clients/umi build`. Before upgrading, archive a
finalized snapshot and validate zero reserved bytes:

```bash
node configs/program-scripts/reconcile-add-item-requests.cjs \
  --rpc "$RPC_URL" --write-snapshot target/pre-upgrade-requests.json --pre-upgrade
```

Review an archived snapshot offline without loading any signer:

```bash
node configs/program-scripts/reconcile-add-item-requests.cjs \
  --snapshot target/pre-upgrade-requests.json --pre-upgrade --batch-size 8
```

After upgrade, explicit execution requires that verified pre-upgrade snapshot,
an RPC and a trusted operator wallet adapter. The CommonJS adapter exports
`authority` and `payer` public keys and an async
`sendAndConfirm({connection, transaction, summary})` returning the signature.
The adapter obtains the operator's wallet approval and signs/sends the supplied
versioned transaction; the reconciler never accepts or stores private keys.
It verifies `authority` against the canonical GlobalConfig's current marketplace
`account_fee_authority`. The payer covers transaction fees and actual request
rent growth, returned to the seller on cancellation.

```bash
node configs/program-scripts/reconcile-add-item-requests.cjs \
  --rpc "$RPC_URL" --snapshot target/pre-upgrade-requests.json \
  --execute --signer-module /path/to/operator-wallet-adapter.cjs --batch-size 8
```

Execution performs new complete finalized scans, including a separate dataSize
105 query; groups requests by live machine; simulates bounded batches; waits for
finalized confirmation; and rescans at or beyond that slot before continuing.
Only a fresh scan with no untracked requests and an exact marker-1/header count
allows `complete = true`. Closed-machine requests remain seller-cancellable.
Already-completed machines are skipped on rerun; tracked/rejected requests are
never counted twice. Invalid owners, discriminators, PDAs, settings bounds,
markers, counts, stale scans, simulations or confirmations stop the script.
Requests changing during the parallel RPC scans can cause a safe count/scan
mismatch: rerun during the controlled release window. Final output must have
an empty `transactions` list before readiness; any new unreconciled machine
requires another pass.

## Native creator payouts after round ten

Every native settlement path (NFT/pNFT, Core, cNFT v1/v2, including claimed
items and partial proceeds) uses the shared payout helper. Agave reserved keys,
executables, sysvar-owned and native-loader-owned accounts are unpayable creators;
their shares stay with the item's seller. All other nonzero creator payouts
require writable accounts (6045), so a permissionless settler cannot divert a
payable royalty by marking its creator read-only.

Rent uses the cluster's `Rent::get()` and each recipient's actual data length.
A share that makes the account rent-exempt is paid in full. Otherwise this item's
seller proceeds fund the shortfall, after marketplace and curator fees and all
other scheduled creator shares. Seller creator shares remain with the seller
and may fund a top-up. If the seller cannot cover a shortfall, that creator's
share stays with the seller; skipped shares cannot subsidize other creators.
The buyer still pays exactly the draw price. No top-up borrows other items'
proceeds, fee revenue, machine rent or outstanding refund reserves. SPL and
Token-2022 retain their token payout routing; cumulative budget clamps below
apply to both currencies too.

## Round-eleven payment and payout corrections

Every settlement entry point (Core, NFT/pNFT, tokens, claimed token batches,
cNFT v1 and cNFT v2) and both `manage_buy_back_funds` directions now validate
currency against `settings.payment_mint`. Native machines reject non-native
mint accounts and normalize an omitted/native mint to SOL. Token machines
require the exact configured mint, including on the claimed-token batch path.
The sell-item/refund paths and all monetary payment guards enforce the machine
currency. Round twelve additionally binds classic and Token-2022 guard payments
to the canonical machine escrow ATA; the previous Token-2022 destination check
was incomplete. Close binds token accounts to the stored mint. No instruction discriminator, argument or account order changes.

Cumulative creator increments are bounded by the current royalty budget so
rounding cannot overpay or underflow a primary split. Any rounding residue stays
with the seller. Creator rent top-ups reserve the seller's own rent shortfall;
seller-history rent counts only when that history closes in the same instruction.
A skipped recipient's share remains with the seller and does not subsidize other
creators. Existing v1 settlement behavior receives the same corrections.

The local `utils::can_receive_lamports` predicate matches the program-library
helper used by Market and Auction. It rejects all Agave active/pending reserved
keys (plus the incinerator), executables, sysvars and NativeLoader-owned accounts.
Writability and post-credit rent are checked separately: ordinary read-only
creators still fail, preventing a permissionless caller from diverting a payable
share. The pinned Agave SDK parity test must pass when the SDK/runtime changes.
The round-eleven checks reused supplied accounts. The former 251-CU saving claim
is withdrawn: its randomly keyed samples could not establish that difference.
The historical round-twelve samples below use fixed test seeds and serial execution.
Round-thirteen evidence below supersedes their artifact and settlement metrics.

## Guard-binding release gate

**Before the guard upgrade**, alongside the pre-upgrade add-request snapshot,
run the executable read-only inventory. It always performs a dry run and has no
signing, sending or execution mode:

```sh
node configs/program-scripts/check-guard-bindings.cjs \
  --rpc "$SOLANA_RPC_URL" \
  --write-snapshot target/guard-bindings-pre-upgrade.json
node configs/program-scripts/check-guard-bindings.cjs \
  --snapshot target/guard-bindings-pre-upgrade.json
```

Require exit **0** and `releaseBlocked: false`. Exit 1 blocks the release for a
mismatched guard base, a guard shared by multiple machines (including across
programs), or an invalid/incomplete inventory. Review `unwrapped` machines and
`unusedGuards`; a solo authority or an orphaned guard is reported separately.
Archive the finalized per-program slots and raw header snapshot with the release
artifacts. Repeat the live scan immediately before upgrade if machines/guards
have changed; an old offline snapshot proves only the archived inventory.
`--min-context-slot SLOT` refuses older scans/snapshots. Existing snapshot files
are never overwritten.

The scanner makes three independent finalized GPA calls for MGUM, J3LL and GGRD,
filtering by discriminator and returning only the 73-byte binding headers. It
validates program ownership, executability, discriminators, guard PDA/bump and
duplicates before matching both machines' mint authorities to guards. Its eleven
offline tests include the real CLI exit gate. The round-twelve Token-2022 gate
below also checked these bindings in a read-only mainnet scan. The monorepo
operator runbook must invoke this gate before
its guard-first upgrade step as part of the coordinated release.

## Rollout and allocation

Upgrade **gumball-guard first**, verify its gross-payment escrow behavior, then
extend and upgrade **mallow-gumball**. Otherwise the old guard deducts fees while
v6 reserves the gross payment and charges fees again. Programs, regenerated
clients, backend and SDK/web ship together behind `MALLOW_PROGRAMS_V2_READY`.
Gate new entries only; existing claims, refunds and recovery stay available.

Use the [M21 release artifact](#m21-marketplace-authorized-tree-exits) and
[`cnft-v2-fix21-metrics.json`](./cnft-v2-fix21-metrics.json) for the current
gumball and guard sizes, hashes and exact extension bytes. The release crates are
`mallow-gumball` 1.1.0, `gumball-guard` 1.1.0 and `utils` 0.2.0; both program IDLs
record `metadata.version` 1.1.0, distinct from the deployed 1.0.0 programs.
Recheck finalized ProgramData capacity before extending or upgrading.

The rebuilt guard is 935,784 bytes, SHA-256
`6f49951721952043c2b75f28536358b566990188d5295cf0be17fdb4a595d0b5`,
within its previously observed 1,038,504-byte allocation. The documented build
pins platform-tools v1.52 / SBPFv2 and uses localnet for Anchor IDL generation.
Cold builds pre-create local placeholder keypairs so Anchor does not rewrite the
canonical IDs. After both build phases the script checks each declaration and
IDL address before publishing artifacts. No extension, deployment or network transaction was
performed in this worktree.

These hashes identify the exact approved files to upload. Builds are path-dependent:
rebuilding in another worktree path can produce equal-sized, behaviorally identical
binaries with different SHA-256 hashes. Cross-path reproducibility is not claimed; see
[Reproducing the release binaries](#reproducing-the-release-binaries) for the
exact checkout path, command and toolchain.
Verify the retained release files and their identical deploy/test copies; do not
substitute an independent rebuild without approving and repinning that artifact.

## Parked payouts and compatibility

Token creators cannot block settlement with a reassigned, frozen, memo-required,
malformed or incorrectly owned payment account. The shared
`utils::can_receive_token` predicate screens them; their share stays with that
item's seller. Healthy payouts retain the existing ATA validation, avoiding a
second derivation. Missing canonical ATAs can be recreated by the action payer.
Curator, marketplace, seller and v2 buyer-refund payouts that cannot be delivered
are parked in the machine's existing authority PDA. The recorded amount remains owed to that
recipient and is excluded from all later item entitlements. Sale proceeds,
buy-back credit and draw reserves never fund claim-account rent.

The PDA is initially empty. Each claim entry is exactly 112 bytes, in order:
recipient pubkey (32), payment mint pubkey (32), amount u64 LE (8), original rent
payer pubkey (32), rent deposit u64 LE (8). Entries are looked up by recipient
and currency and compacted on removal. Native entries store the machine's native
mint key. A new entry's incremental rent is paid by the action payer. Removal
returns it to the recorded payer when that account can receive SOL rent-exempt,
otherwise to the payout recipient when receivable. If neither can receive, the
fully paid entry is still removed and the released deposit stays as escrow
surplus. Healthy transfers add no rent CPI or account resize.

Two generated instructions expose recovery:

- `withdraw_payout(amount: u64)` accounts, in order: machine (read), authority PDA
  (write), recipient (write/sign), recorded rent payer (write), optional payment
  mint (read), optional escrow payment ATA (write), optional recipient token
  account (write), payment token program (read), ATA program (read), System
  program (read). Token withdrawals accept any initialized, receivable account
  whose token owner is the signing recipient and whose mint/program match. Native
  withdrawals go to the signing recipient. Partial withdrawals are supported.
  The machine key gives the PDA seeds; its owner and discriminator determine
  whether the final post-close token withdrawal sweeps the vault balance and
  may close it. The machine may already be closed. Currency comes from the
  authenticated escrow entry; both recovery instructions require the escrow to
  remain gumball-program-owned.
- `recover_payout_rent(recipient: Pubkey)` accounts: machine (read), authority PDA
  (write), recorded rent payer (write/sign). It requires the claim amount to be
  zero and needs no recipient signature or live machine account. Existing
  zero-debt entries remain recoverable after close. A later successful direct
  payout consumes earlier parked debt for the same recipient/currency; it
  returns rent when the recorded payer is supplied writable, or leaves a
  zero-debt deposit entry for this independent recovery. Token settlements
  defer direct deposit credits until all payout CPIs have finished and re-find
  ledger positions after each removal; native payouts return deposits inline.

Machine close checks item settlement and buy-back funds, independently of the
payout ledger. The authority PDA and any token vault backing parked claims
survive close, so absent recipients cannot hold machine/guard rent hostage.
Recovery keeps the original machine key and ledger mint; re-initialization at
that machine address is refused by the existing escrow `init` constraint. The
currency vault reserves only nonzero ledger debt in its mint. Close sweeps the
remaining token surplus to the machine authority and closes the vault if no
unpaid token debt remains, even when zero-debt deposit entries survive. The
last post-close token withdrawal of the final debt in that mint transfers the
vault's entire balance, including any unsolicited residue, to the recipient's
validated token destination in the same transfer CPI. The credited amount can
therefore exceed the requested `amount`, which remains bounded by recorded debt.
It then closes the vault and returns its rent to the withdrawing recipient,
falling back to the recorded claim rent payer if needed. Partial withdrawals leave the
remaining entitlement and residue in the vault. A machine key is considered
closed when its owner differs from MGUM or its data lacks the GumballMachine
discriminator, including a re-created zero-data MGUM-owned account. This uses the
existing withdrawal accounts; no new recovery authority or instruction is added.
If neither account can receive SOL rent-exempt, withdrawal still succeeds and
the empty vault remains open. Zero-debt deposit recovery remains independent
of the token vault.

Native curator and seller proceeds are paid together when their recipient is
identical. Native rent checks include the earlier parked amount and pending
seller-history refund. Buyer-settled Core plugin rent is assessed after sale
proceeds/history rent are credited; separate claim-only cleanup retains its
existing sub-rent fallback to the buyer. Both proof and marketplace-authorized
v2 refunds use the same receivability/parking helper as settlement, resolve the
draw immediately and preserve the full original payment as the buyer's debt.

`set_authority` keeps its discriminator and `new_authority` argument, with an
optional `new_authority_signer` appended after the existing machine and authority
accounts. Rotations require that signer to match and accept the new authority;
new authorities must be on-curve, receivable wallet keys. Initialization applies
those checks too. Legacy idempotent calls may omit the trailing optional account.
Native settlement and token claims accept an unusable legacy authority account;
fees park and empty prize-token-account rent goes to the claim payer when the
old authority cannot receive it. Healthy authority accounts must still be
requested writable; the generated clients preserve their previous write flags
while the Anchor mut constraint is removed. All other existing accounts/args and
instruction discriminators are unchanged. Repin generated Kit, Umi and Rust
clients and update authority-rotation builders for the required acceptance signer.

Payment currency cannot change while buy-back funds or recorded revenue exist.
Native seller residues that cannot make an empty wallet rent-exempt are parked
as that seller's entitlement. Core plugin-removal rent remains with the buyer
when the seller cannot receive that small refund. Native rent funding includes
all already credited recipients in its CPI accounts so a partial settlement
remains balanced; it never debits another seller or a draw reserve.

### Token-2022 destination release gate

After building the current Umi client, run this read-only gate before the
coordinated program upgrade. It scans every default and grouped Token-2022
payment configuration on wrapped gumball guards using the generated serializers:

```sh
heavy -- pnpm --dir clients/umi build
node configs/program-scripts/check-token2022-escrows.cjs \
  --rpc "$SOLANA_RPC_URL" \
  --write-snapshot target/token2022-escrows-pre-upgrade.json
node configs/program-scripts/check-token2022-escrows.cjs \
  --snapshot target/token2022-escrows-pre-upgrade.json
```

Require exit 0 and `releaseBlocked: false`. This uses a coherent finalized
inventory, fetches full guard data in one GPA, and adds no per-machine RPC calls.
A redirected destination blocks the whole coordinated upgrade pending an
operator remediation plan; the scanner does not promise a per-machine activation
switch or change a guard. SOL already binds its escrow PDA; classic token
payments now require its canonical ATA too. NFT-payment guards are separate
in-kind payments and never increment the currency proceeds ledger.

A read-only mainnet run on 2026-10-05 passed at common finalized slot 453,544,930:
130 gumball machines, 4 Jellybean machines, 135 guards and 134 wrapped machines.
Both observed Token-2022 payment configurations used their canonical escrow
ATAs; there were no blockers. Snapshot and result are retained in
`target/fix12-token2022-mainnet*.json`. Re-run the gate immediately before rollout;
this snapshot does not authorize an upgrade.

## Validation and budgets

Round-twelve validation passes **1,016 tests**: Kit 300 (one existing todo), Umi
658 (one upstream asset-data skip), Rust clients 7, gumball program units 16,
shared-recipient utility tests 11 and operator-tool tests 24. The full repository
suite, final documented program build, generator and both client declaration
builds pass. Focused payout/authority/native regressions pass 30 tests; the
positive authority rotation additionally settles its sold Core item. Logs are
in `target/fix12-*.log`. Both program artifact copies match their hashes above.

Round-twelve evidence supersedes the historical round-eleven counts and samples
below. The current 58-scenario committed baseline retains the 1,232-byte wire
limit (maximum
1,537 bytes bare / 509 with a LUT), 110,000 CU entry/exit ceiling and 170,000 CU
collection ceiling. Leaf transfer-settlement ceiling is now 135,000 CU to cover
the required native recipient/rent checks; samples span 61,003–118,974 CU for
leaf paths and 73,623–165,460 CU for inherited collection paths.

[`cnft-v2-fix11-metrics.json`](./cnft-v2-fix11-metrics.json) now holds 39 seeded
native samples: 58,213–129,156 CU and 1,004–1,073 bytes. Three final runs produced
identical rows (40 tests per run). No precise CU-saving claim is made.
[`cnft-v2-fix12-metrics.json`](./cnft-v2-fix12-metrics.json) measures new payout
recovery and token settlement cases, with all sent packets at most 1,232 bytes;
Token-2022 cNFT settlements that exceed the bare limit use a LUT. Regenerate these
samples after any program change. Its 26 samples span 10,080–120,108 CU and
374–1,231 sent bytes; these are single-run samples with random payout fixtures.
Operator-script tests run through `pnpm test`.

The following round-eleven validation describes that earlier artifact and is
historical; its linked metric files have been refreshed for round twelve.

Round-eleven validation passes **976 tests**: Kit 300 (one existing todo), Umi
627 (one upstream asset-data skip), Rust clients 7, gumball program units 16,
shared-recipient utility tests 6 and operator-tool tests 20. The full repository
suite, documented final build, generator and both client declaration builds pass.
All 61 instruction interfaces and complete IDLs remain identical to the
round-ten starting point. Logs are in `target/fix11-validation/`.

The ten final budget tests refresh all 58 scenarios in
[`cnft-v2-metrics.json`](./cnft-v2-metrics.json); every existing CU and packet
ceiling remains unchanged. Leaf SOL samples span 58,876–114,005 CU; inherited
collection samples span 68,016–161,833 CU. Maximum packet sizes remain 1,537
bytes bare / 509 bytes with a LUT; oversized bare packets are simulation-only.
[`cnft-v2-fix11-metrics.json`](./cnft-v2-fix11-metrics.json) records 39 native
payout samples (including reserved keys and seller-history rent) at
51,415–126,827 CU and 1,004–1,073 bytes. No new account or CPI is added to the
payout paths. Currency validation uses the existing machine and mint accounts;
creator eligibility uses the already supplied account infos.


Round-ten validation passes **919 tests**: Kit 300 (one existing todo), Umi 587
(one upstream asset-data skip), Rust clients 7, Rust program unit tests 15, and
offline reconciler tests 10. Guard unit tests have zero cases and pass. The full
`heavy -- pnpm test`, documented program build, `heavy -- pnpm generate:clients`,
and both client builds (including declarations) pass. All **61** instruction
interfaces (48 gumball, 13 guard) and complete IDLs remain identical to the
round-ten starting commit. No new accounts, arguments, discriminators, errors
or generated client fields are introduced.

The 18 native payout regressions include claimed/unclaimed System Program and
Rent sysvar creators, post-escrow inherited payout swaps, read-only creator
rejection, above-rent shares, seller-funded top-ups, insufficient proceeds,
invited sellers with curator/marketplace fees, and no subsidy between creators.
The four guard regressions exercise second gumball/Jellybean machines and
close/reinitialization on v5/v6; the request regression preserves cancellation
of a marker-zero legacy request while refusing approval.

[`cnft-v2-metrics.json`](./cnft-v2-metrics.json) is refreshed against these final
artifacts with **58** deterministic samples. Leaf SOL paths use **58,082–113,211
CU**; inherited paths use **66,627–161,649 CU**. Packet sizes are unchanged,
maximum **1,537 bytes without a LUT / 509 with a LUT**; oversize bare messages
remain simulation-only and must use a LUT for execution. Native leaf transfer
settlement now has a **115,000-CU ceiling**, raised from 110,000: its deepest
sample is 113,211 CU, **+3,965 CU / 3.6%** from round nine. Other leaf paths keep
110,000 and inherited paths keep 170,000. Share fast paths preserve cumulative
rounding, key validation runs once, and native royalty credits use direct
lamport transfers with no added CPI. Wallet rent is computed once from cluster
rent; recipients with data use their own data length.

[`cnft-v2-fix10-metrics.json`](./cnft-v2-fix10-metrics.json) records **17** new
native payout samples: **52,193–104,672 CU**, **1,004–1,073 bytes**, with tests
requiring at most 200,000 CU and 1,232 bytes. Historical validation and sample
figures below describe their earlier artifacts; the two current JSONs and the
allocation hashes above are the round-ten release evidence. The reconciler is
not a hot trade path and was tested offline only; no deployment, transaction,
production action or live reconciliation was performed.

Historical round-nine validation passed **885 tests**: Kit 300 (one existing todo), Umi 564
(one upstream asset-data skip), Rust clients 7, and Rust program unit tests 14.
The new regressions cover mint/guard locks across versions 0–6, conservative
legacy migration, unauthorized/cross-machine migration, rejected Core/NFT/pNFT/
cNFT v1/v2 cancellation, capacity-700 v5 rejection, and rejection/cancellation
without double-decrementing another request's count. The final client builds,
including declarations, pass. All **59** previously existing instructions at the
round-eight branch head (46 gumball, 13 guard) retain identical discriminators,
arguments and ordered named-account layouts. The two new administrative
instructions and SDK status/readiness helpers are additive.

[`cnft-v2-fix9-metrics.json`](./cnft-v2-fix9-metrics.json) records eight final
artifact samples. Rejection uses **279 serialized bytes** and **12,237–15,237 CU**
for tracked requests; the legacy rent-growth sample uses **13,003 CU**. One legacy
request migration with rent growth uses **314 bytes / 15,808 CU**, while final
empty-list attestation uses **281 bytes / 9,255 CU**. PDA bump searches vary CU;
the tests enforce a 25,000-CU execution budget plus 1,500 CU per failed
canonical request PDA bump attempt, and a 1,232-byte packet ceiling. No proof
accounts or asset CPI are needed for rejection. The existing 58-scenario v2
budgets and 24-scenario legacy benchmark pass unchanged ceilings. The latter
measures no-guard draw at **27,267 CU** (+474 / 1.8%), SOL draw at **40,961 CU**
(+585 / 1.4%), and start-sale at **4,918 CU** (unchanged). Administrative handlers
are appended to preserve dispatch order, and draw borrows existing account infos
instead of cloning them; no new custody scan runs on draw.


The round-eight full suite passed **835 tests**: Kit 299 (one existing todo), Umi 530
(one skipped), Rust clients 6. Rust program unit tests passed **14** separately,
for **849 passing tests** total. The full suite includes 24 new round-eight
regressions, including requests on versions 0–5, missing/wrong accounting
accounts, legacy cancellations, root-before-approval order, address reuse,
Permanent* buyer refunds and the actual v6 refill restriction.
The v2 budget file passed 10 tests and refreshed all 58 scenarios in
[`cnft-v2-metrics.json`](./cnft-v2-metrics.json). Both TypeScript client builds,
including declaration generation, passed. All **49** pre-existing instruction
discriminators, arguments and ordered named-account layouts compare identically
against main (36 gumball, 13 guard); `approve_add_item`'s authority relation and
behavior changes are listed above. Admin refund/reclaim require the new remaining
account prefixes even though their named accounts and arguments are unchanged.
Kit regressions execute entry/removal, request/cancel/approval, claim/settlement
and refund/reclaim with real Bubblegum binaries and inspect nonzero v6 ledger
fields. The pinned Bubblegum binary still rejects `updateAssetDataV2` with 6050;
a new executed negative test proves the reason the non-default asset-data
end-to-end test remains skipped. No fixture can mint/update that unsupported data.

Cancellation accounting adds **673 CU**, **33 bytes without a LUT** and
**3 bytes with a LUT**; depth fourteen is 92,037 CU / 1,133 bytes without a LUT
and 423 bytes with a LUT. No new CPI or request-time inventory scan is added.

Historical round-eight v2 measurements span 54,117–109,246 CU for leaf SOL fixtures
and 58,287–161,782 CU for inherited-collection fixtures. Other serialized
sizes and the 110,000 / 170,000 CU ceilings are unchanged. The new accounting adds
roughly 1,885 CU to a claimed depth-five settlement and 2,503 to a transfer
settlement in the deterministic samples; it adds no CPI.

The prior round-seven full suite measured depth-five admin refunds at 53,722–70,222 CU /
1,083–1,115 bytes. The depth-14 admin refund executed at 65,997 CU with a LUT:
**1,380 bytes without LUT / 608 bytes with LUT**. The config prefix adds one
account (65 bytes without LUT, 3 with LUT). A permissionless flagged refund is
1,250 / 509 bytes at depth 14; use a LUT for both forms. Marketplace reclaim
measured 72,951 CU / 925 bytes; partial collab settlement measured
55,815–60,315 CU / 1,038 bytes. PDA bump searches vary CU between runs; these
are samples from the prior round-seven full suite.

Round-eight buyer-signed Permanent* refunds measured **50,050–65,059 CU /
953 bytes** at depth five. Reclaim after the machine address was recreated
measured **75,845 CU / 861 bytes**. Current depth-fourteen samples are admin
refund 67,495 CU / 1,380 bytes bare / 608 with LUT, and flagged refund 65,099 CU /
1,250 bare / 509 with LUT. The refreshed deterministic 58-row measurements above define the current
release ceilings; recovery samples vary with PDA bump searches.

The 24-scenario legacy CU benchmark retains its committed 2% ceiling. Moving v6
ledger recording into a separate function saved six CU on legacy draws and kept
that check passing without a baseline update. Each payout reads its own ledger
slot and scalar counters; no full-machine scan or extra CPI is needed to compute
an entitlement. Operator claim simulation uses supplied cached metadata/proof.


M13 post-merge verification rebuilt both programs, regenerated all documented
clients and passed the full root suite: 24 script tests, 300 Kit tests, 658 Umi
tests and seven Rust client tests. Program/utility tests pass another 27 cases
(16 program, six reserved-key, five token-recipient), for **1,016 passing tests**;
one existing Kit todo and one Umi skip remain. The authority-rotation settlement
fixture now passes the authenticated asset creator to the Umi payout wrapper.
At that historical M13 checkpoint, interfaces and artifact sizes/hashes remained unchanged.
Round-thirteen release evidence below supersedes that checkpoint.


## Round-thirteen release evidence (historical)

R13-03 resolves an undeliverable draw even when its recorded buyer's canonical
SPL ATA has a reassigned owner or its Token-2022 ATA requires a memo. Proof and
marketplace-authorized refunds both park the full recorded payment using the
existing recipient/currency ledger. The draw reserve and seller bookkeeping
resolve in the same transaction, allowing other sellers to finalize.

R13-04/R13-08 make fully paid withdrawals terminate even when the recorded rent
payer is empty or NativeLoader-owned, and allow ledger recovery after machine
close. R13-09 combines same-wallet native curator/seller proceeds, consumes
older parked debt on later payable transfers, and defers Core plugin-rent
receivability until sale proceeds/history rent have been credited. Existing
claim-only behavior is unchanged. R13-17 adds operator-script coverage to the Umi
CI job and a workflow regression. Round-thirteen documentation/evidence updates
cover the gumball portion of R13-18; Market/Auction/Flutter fixes belong to their
respective worktrees.

No account order, argument, discriminator or ledger/machine layout changed.
`withdraw_payout` and `recover_payout_rent` now treat the machine account as a key
and authenticate the escrow owner/PDA and recorded mint. The documented client
generator was rerun; its tracked outputs are byte-identical. Backend/SDK readers
and recovery builders must permit closed machines, reading the ledger mint
instead of requiring live machine metadata. Closing no longer requires ledger
entries to be withdrawn first. Token claims retain their canonical escrow vault;
withdrawal destinations still require the recipient's signature and token
ownership. Round-fourteen vault sweeping and final-withdrawal cleanup supersede
this checkpoint's vault-retention behavior.

Final validation passes **1,026 tests**: 25 operator-script, 300 Kit, 667 Umi,
seven Rust-client, 16 program-unit and 11 shared-recipient utility tests. One
existing Kit todo and one Umi asset-data skip remain. The final focused run
passes 11 tests, including all four collab blocked-token refunds, recovery
before/after close with an assigned rent payer, legacy zero-debt recovery,
same-wallet native fees, exact parked-dust consumption and buyer-settled Core
plugin rent. Both client declaration checks, both SBPF builds and the documented
client generator pass. The complete 58-row cNFT budget run passes 10 cases.

The historical round-thirteen measurements were recorded in
[`cnft-v2-metrics.json`](./cnft-v2-metrics.json); round fourteen refreshes it. The eight seeded leaf-native settle samples save **5,628 CU** each
relative to round twelve; inherited settle samples add **80 CU** for token
payments and **113 CU** for native payments. Entry/exit CU and all serialized
packet sizes remain unchanged. Existing ceilings remain 110,000 CU for leaf
entry/exit, 135,000 for transfer settlement and 170,000 for inherited paths.
[`cnft-v2-fix13-metrics.json`](./cnft-v2-fix13-metrics.json) records nine final,
single-run recovery/refund/Core samples with ordinary random fixtures: **23,664–
115,337 CU**, **558–985 bytes**. Four blocked-token refunds use **60,047–68,273
CU**, **855–985 bytes**. These samples enforce 200,000 CU and 1,232-byte ceilings;
PDA bump searches can vary their CU. Historical round-twelve measurements and
counts above remain labelled as historical and are superseded by this section.

Its artifact pins are superseded; use the M21 release artifact in Rollout and
allocation. No deployment, publication, production write or network transaction
was performed.

## M14 consumer handoff verification (historical checkpoint)

A fresh documented rebuild of Gumball and Guard reproduced the round-thirteen
artifacts. `pnpm generate:clients` makes no tracked
interface change. The full client/script suite plus program and recipient
utility tests pass **1,026 tests**, with one existing Kit todo and one Umi skip.
The rebuilt Umi runtimes and all **181 declaration files** match the monorepo's
installed registry patch exactly; its lock hash is unchanged.

The backend integration now accepts closed machine keys for payout discovery,
withdrawal and original-payer rent recovery, using the canonical escrow ledger's
currency. React allows a fully settled machine to close with retained ledger
entries and keeps recovery visible afterward. Authority rotation still requires
a live machine. Recheck finalized capacity before an operator-authorized
upgrade. No deployment or publication occurred.

## Historical Round-fourteen fixes and release evidence

Historical checkpoint; round-fifteen evidence below supersedes its vault behavior
and release artifact.

R14-01 defers folded token claim deposits until the last payout CPI; multiple
removals re-find ledger positions, and same-recipient folds return a deposit
only once. R14-03 reserves exactly the mint's unpaid token debt on close, sweeps
surplus, and releases the empty vault's rent at the final post-close withdrawal.
R14-04 includes operator scripts, root package metadata and Umi files in both
CI path-filter groups that enable the build/generation/client-test chain. The
workflow regression parses YAML aliases and tests script-only and Umi-only paths.

The complete final suites pass **1,063 tests**: 26 operator-script, 300 Kit,
703 Umi, seven Rust-client, 16 program-unit and 11 shared-recipient utility tests.
One existing Kit todo and one Umi upstream asset-data skip remain. A focused
payout run passes 42 tests, including eight token fold/deposit regressions and
four vault tests using real SPL owner reassignment or Token-2022 memo toggles.
The unchanged round-thirteen token fuzz probe passes **300/300 seeds** with exact
conservation; its committed regression runs seeds 1–24 by default, or all seeds
with `heavy -c 2 -- env FIX14_FUZZ_SEEDS=1-300 pnpm --dir clients/umi test test/round14TokenFuzz.test.ts`. Seeds 25–300 add 276 unique passing cases beyond
the complete suites, for **1,339 unique cases** exercised. All builds, tests and
declaration checks run through `heavy`; both client declaration checks pass.
The documented generator leaves all tracked IDLs and client outputs unchanged.
Instruction accounts, arguments, discriminators and layouts are unchanged.

The refreshed 58-row [`cnft-v2-metrics.json`](./cnft-v2-metrics.json) passes all
ten budget tests: 40 CU fields increase by only **86–88 CU**, while all packet
sizes and ceilings remain unchanged. Ten single-run final artifact samples in
[`cnft-v2-fix14-metrics.json`](./cnft-v2-fix14-metrics.json) measure token folds at
**71,820–111,182 CU / 815–912 bytes**, and final token withdrawal/vault closure at
**27,125–33,107 CU / 581 bytes**. PDA searches can vary these samples; tests enforce
200,000 CU and 1,232-byte ceilings. Healthy settles add no CPI; folded deposits
need no flushing CPI because their credits occur after all payout transfers.

Artifact pins are superseded by the M21 release artifact. Consumers need the
coordinated program upgrade;
no new SDK/backend account or argument changes are needed. No deployment,
publication, production write or network transaction was performed.


## Historical M15 round-fourteen integration verification

Historical integration checkpoint; use the M21 release artifact in Rollout and allocation.

The documented SBPFv2 build and `pnpm generate:clients` pass through `heavy`.
Gumball and Guard upload copies matched the round-fourteen artifacts. Both
regenerated IDLs and client
sources remain byte-identical. The full root suite passes **1,036 tests**
(26 scripts, 300 Kit, 703 Umi, seven Rust client), with its existing todo/skip;
16 program and 11 utility tests bring full verification to **1,063**.
The rebuilt Umi client matches the monorepo's installed 183 runtime/declaration
files and existing pnpm patch hash; no patch or lockfile byte change is needed.
Consumer Close gating continues to permit fully settled closure with retained
claims; token folds defer rent returns until the final payout CPI, and closure
releases vault surplus while reserving unpaid token debt.


## Historical Round-fifteen fixes and release evidence

R15-01 sweeps unsolicited post-close token residue to the final withdrawing
recipient in the existing transfer CPI and releases the vault rent. Live-machine
detection checks both owner and discriminator, so a keypair holder cannot retain
the vault by re-creating a zero-data or wrong-discriminator MGUM-owned account at
the closed machine key. Six LiteSVM regressions cover all three cases with classic
SPL and Token-2022; donation cases also prove a partial withdrawal leaves the debt
and residue reserved. All six regressions fail against the round-fourteen binary;
the rebuilt program passes all ten vault tests.

R15-06 includes shared utility and Rust-client paths in both program filters and
runs their host tests once in a separate job in `test-programs.yml`, independent
of the program matrix. A Rust-client-only change conservatively enables the same
program build, generation and client verification chain. R15-08 is the same
filter edit: toolchain pins select both programs; Codama, IDLs and the root pnpm
lock select the build/generation/client-test chain. The workflow regression
parses YAML aliases, checks every affected path and verifies the two cargo test
steps run after Rust installation. GitHub Actions itself was not triggered.

The final root suite passes **1,043 tests**: 27 operator-script, 300 Kit, 709 Umi
and seven Rust-client tests. Separate program-unit and shared-recipient utility
runs pass **16 and 11 tests**, bringing validation to **1,070 passing tests**.
One existing Kit todo and one Umi asset-data skip remain. The ten existing cNFT
budget tests pass, including their 58-row committed-budget comparisons.
All builds and tests used `heavy`. The documented SBPFv2 gumball build and
`pnpm generate:clients` pass; both IDLs and all generated client outputs remain
byte-identical. Instruction accounts, arguments, discriminators and layouts are
unchanged. No context-index files exist in this worktree.

Eight final-artifact withdrawal samples in
[`cnft-v2-fix15-metrics.json`](./cnft-v2-fix15-metrics.json) measure
**27,187–37,717 CU / 581 bytes**, including the six regressions and the two
ordinary final withdrawals. Random PDA bump searches affect these single-run
samples; tests enforce 200,000 CU and 1,232-byte ceilings. The residue sweep adds
no transfer CPI and no transaction accounts. Other payout paths are unchanged.

Artifact pins are superseded by the M21 release artifact. Consumers need the coordinated program upgrade behind `MALLOW_PROGRAMS_V2_READY`;
no new SDK/backend account or argument plumbing is required. No deployment,
package publication, production write or network transaction occurred.


## Historical M16 round-fifteen consumer verification

The documented program rebuild and `pnpm generate:clients` pass; all generated
interfaces remain byte-identical. Full root tests pass 27 operator-script, 300
Kit, 709 Umi and seven Rust-client checks. Separate host tests pass 16 program
and 11 utility checks: **1,070 tests** total, with one existing Kit todo and
one Umi asset-data skip. All commands run through `heavy`. The monorepo
verifies all **183 runtime/declaration files** and the existing pnpm patch
hash against the rebuilt Umi client; no patch or lockfile content changes
are required. Backend fixtures pin the R15-01 source `564b6e1` and the exact
Gumball upload hash of that round. Instruction accounts and layouts remain
unchanged.


## Historical Round-sixteen fixes and release evidence

R16-01 makes both proof and marketplace-admin refunds of sold v2 items available
in `SaleLive` on collab machines. The buyer receives the full recorded payment
without waiting for the untrusted machine authority to end the sale. Unsold
recovery still requires `SaleEnded`; evidence, buyer binding and admin authority
checks are unchanged. The refund resolves the draw, releases exactly its reserve,
removes exactly its payment from revenue and forfeits its pooled share. The
original per-draw payment remains recorded. Remaining inventory stays drawable.

Nine focused LiteSVM regressions pass, including the flipped R3-10 test, six
four-item/two-seller cases across SOL, classic SPL and Token-2022 for proof and
admin refunds, and two unsold-live rejection cases. Seven sold-live cases fail
with 6036 against the original binary. The matrix proves the SOL buyer receives
exactly **1,000,000,000 lamports**, token buyers receive their full **10,000 units**,
later draws preserve reserves, partial payouts cannot spend pending payments,
marketplace/curator fees reconcile exactly, remaining sellers receive equal
pooled shares including division dust, and the machine closes after end-sale and
final settlement.

R16-02 pre-creates missing local placeholder deploy keypairs before Anchor 1.1's
IDL phase; these keys are never deployment identities. Canonical source and IDL
address checks abort before artifact publication after either build phase.
Four script regressions cover fresh and warm caches plus source and IDL drift;
three fail against the original script. A real build of both programs with both
local keypair files absent also passes and preserves MGUM/GGRD. Compilation
caches were retained for that real build; the script fixture starts without any
target directory and mocks compiler/keygen commands. GitHub Actions was not run.

R16-07 corrects the machine-account documentation: its key gives escrow seeds,
and its owner/discriminator determine post-close vault sweeping/closure. The
final token withdrawal can credit more than the requested amount by sweeping
unsolicited residue. Vault rent goes to a creditable recipient, otherwise a
creditable recorded rent payer; the empty vault remains open if neither can
receive. The documentation regression fails against the original text. Generated
IDL/Kit/Umi/Rust changes contain account documentation only: account order,
arguments, discriminators and layouts remain unchanged.

The final root suite passes **1,056 tests**: 32 operator-script, 300 Kit, 717 Umi
and seven Rust-client checks. Separate program and shared-utility suites pass
**16 and 11 tests**, for **1,083 passing tests** total. One existing Kit todo and
one Umi asset-data skip remain. All builds, generation and tests used `heavy`.
The final documented rebuild and `pnpm generate:clients` pass; both deploy/test
artifact copies match. No context-index files exist in this worktree.

Six final-artifact live-collab refund samples in
[`cnft-v2-fix16-metrics.json`](./cnft-v2-fix16-metrics.json) measure
**61,600–70,701 CU / 759–985 serialized bytes**. Random PDA bump searches affect
these single-run samples. Tests enforce 200,000 CU and 1,232-byte ceilings.
The fix adds no accounts, CPI or per-item scan; it only changes the state gate.
The ten existing cNFT budget tests and their committed comparisons also pass.

Artifact pins are superseded by the M21 release artifact. Sync the artifact pins and generated account docs
for the coordinated release behind `MALLOW_PROGRAMS_V2_READY`; no new account
or argument plumbing is needed. No deployment, push, package publication,
production write or network transaction occurred.

## Historical M17 round-sixteen integrated rebuild

The first warm rebuild exposed a cached-build publication bug: Anchor replaced
the Guard deploy file with SBPFv0 and the cached SBF compiler left that newer
file untouched. Three Kit Core NFT-gate cases failed with stack access errors.
The build now removes Anchor's output before the SBPFv2 phase, matching the
program-library build. Both cold/warm orchestration fixtures simulate the v0
overwrite and cached compiler; they fail before the fix and pass afterward.

The corrected documented rebuild and client regeneration pass. Both deploy
copies and test copies retain ELF flags `0x2` and exactly match the round-sixteen
sizes/hashes above. The full suite passes 32 script, 300 Kit, 717 Umi and seven
Rust-client tests; the separate native suites pass 16 program and 11 utility
tests. Total coverage remains **1,083 passing tests**, with one existing Kit
todo and one Umi skip. Generated interfaces are unchanged. The monorepo refreshes
the two Umi declaration files carrying the R16-07 account documentation.

## Historical M18 settlement and CI corrections

`settle_cnft_sale_v2` now selects empty-slot verification only with
`args.flags = 255` on an already-claimed item. Default owner/delegate keys
remain valid live-leaf inputs. Leaf and inherited royalties both settle, pay
the seller and allow machine close after delivery to those keys. Empty-slot
proofs retain the nonce/index binding and cannot waive royalties on a live leaf.
The backend's claimed-burnt builder must use the new flags signal. No account,
argument layout or discriminator changed; documented build and client
generation leave the generated interfaces unchanged.

The Kit CI runner installs and builds its Umi fixtures before testing. Edits to
the committed `cnft-v2-metrics.json` baseline now select the client test chain;
historical fix metrics stay excluded. The instruction reference documents the
authority acceptance signer, retained payout vault debt and both payout exits.

Validation through `heavy`: the root suite passes **1,060 tests** (34 scripts,
300 Kit, 719 Umi, seven Rust client); after the final documentation regression,
the script suite passes **35 tests**. Separate gumball, guard and recipient
utility suites pass **16, one and 11 tests**, respectively. The existing Kit
todo and Umi asset-data skip remain. The four targeted live/burnt settlement
cases pass, including royalty authentication and machine closure. All ten
committed cNFT budget comparisons pass. Both client production builds pass.

The two full-suite default-owned settlement samples in
[`cnft-v2-fix18-metrics.json`](./cnft-v2-fix18-metrics.json) measure
**61,286 CU / 1,006 bytes** for leaf royalties and **67,591 CU / 1,004 bytes**
for inherited royalties. The state check adds no account, allocation or CPI.
Artifact pins are superseded by the M21 release artifact.

Whole-tree Umi `tsc --noEmit` includes tests and remains blocked by existing
test type errors; the production declaration build passes. No deployment,
publication, push or network transaction was performed.


M18-sync independently rebuilt and regenerated `e477cff`; all IDLs, generated
clients and all 183 installed monorepo Umi runtime/declaration files match
exactly. The client patch and lockfile hash remain unchanged. The root suite
passes **1,061 tests** (35 scripts, 300 Kit, 719 Umi, seven Rust-client tests),
with one existing Kit todo and Umi skip. Separate program/guard suites pass
16 / one tests. Deploy/test binaries retain the sizes and hashes above.
The downstream backend must send `args.flags = 255` only after verifying
the claimed item's current empty slot; live default owner/delegate keys must
retain their authenticated flags.


## Historical M19 closed-tree exits and local fixture builds

Historical checkpoint; the M20 replacement-account rules and the M21 artifact below supersede it.

R19-01 adds closed-tree evidence to both refunds (`leaf = None`), claimed burnt
settlement (`args.flags = 255`) and missing-receipt cleanup (`leaf = None`).
The recorded address must have no data and no MPL-compression ownership. All
identity, state, authority, currency and draw-ledger checks remain in force;
live inputs retain error 6069 for unsupported tree versions. No account list,
argument layout, discriminator, ledger layout or generated interface changed.
Refunded drawn items return the full payment; unsold recovered items retain their
pooled entitlement, and post-delivery burns settle normally without royalties.

Eleven new LiteSVM regressions assert exact buyer/seller/receipt balances,
collab seller shares, machine closure and errors 6039, 6049, 6069, 6070 and 6075.
The delivered-leaf case executes the pinned deployed `CloseTreeV2` layout,
including its writable fee recipient at index 4; closed escrow/receipt states
use direct LiteSVM account fixtures to isolate exit behavior from collection
mutations. The claimed settlement failed with 6069 on the previous artifact;
refund and receipt regressions also rejected the previous artifact. A unit test
covers empty/nonempty data with MPL, System and other owners. The original
live-tree version rejection and royalty/proof regressions also pass.

R19-02 makes the Kit test command build Umi fixtures first, so both direct
`clients/js` tests and the root `test:js`/`test` work with missing Umi `dist`.
Install dependencies in both clients before testing. Its script-order regression
failed before the fix. A cold run rebuilt and loaded the fixtures; the initial
full Kit run reached the memory cap, and two AVA workers passed the full suite
(300 passed, one existing todo). Kit and Umi tests must run sequentially because
the fixture build cleans Umi's `dist`.

Final focused validation through `heavy`: **171 cNFT lifecycle/recovery tests**
pass (one existing asset-data skip), **4 Kit v2 tests**, **36 script tests** and
**17 Rust program tests** pass. The documented build and client generator pass;
generated IDLs/clients match the prior interfaces. New tests use specific program
error codes. No unrelated program suite was rerun.

Eight final-artifact samples in [`cnft-v2-fix19-metrics.json`](./cnft-v2-fix19-metrics.json)
measure **8,042–60,686 CU / 345–904 bytes**. Closed-tree exits remove the impossible
proof CPI; the check adds no account, allocation or RPC operation to the program.
Artifact pins are superseded by the M21 release artifact.

Cross-repo handoff: the backend must build the closed-tree branches documented
above without asking DAS for an unavailable proof. Market's
`close_missing_cnft_listing_v2` and Auction's permissionless refund and
`close_missing_cnft_auction_v2` have the same live-tree proof requirement;
Auction's marketplace-admin refund remains independent of the tree. Those
repos are owned by other agents and were read only. No deployment, push,
publication of clients or network transaction was performed.


## Historical M19 consumer rebuild and request-budget verification

Historical checkpoint; use the M21 artifact and extension bytes in Rollout and allocation.

The documented SBPFv2 rebuild and `pnpm generate:clients` preserved that
round's IDL/client bytes and both program hashes.

The full ordinary suite passes 36 script checks, 300 Kit tests, 731 Umi tests
and seven Rust client tests; the existing Kit todo and Umi asset-data skip remain.
Native program/guard/utility checks pass 17 / 1 / 11. All builds and tests run
through `heavy`. The Kit and Umi runs stay sequential because Kit builds Umi
fixtures first.

A randomly generated legacy request exposed the flat 25,000-CU budget's failure
at 29,593 CU. The request admin measurement now accounts for the canonical PDA
search's 1,500-CU failed-attempt cost while preserving the execution and packet
budgets. A deterministic bump-245 fixture measures 28,093 CU / 279 bytes and
passes the normalized budget; it would fail the former flat limit. Measurements
are returned directly to concurrent tests instead of reading a shared last row.
No on-chain code, generated interface or artifact changed for this repair.


## Historical M20 recovery after tree address re-creation

Historical checkpoint; M21 below supersedes the admin-exit convention and artifact.

R20-01 widens missing-tree evidence for foreign accounts with data, invalid MPL
headers/layout/counters and recorded slots at or beyond a new tree's append
index/capacity. Appended slots in a valid replacement tree still use existing
current-root empty-leaf proofs. Marketplace-admin refunds with no leaf skip all
tree validation/proof CPIs. Asset identity, buyer payment, seller history,
reserve accounting and trusted marketplace authorization remain enforced.

SPL replacement refunds use the existing marketplace-admin instruction. Burnt
settlement adds one remaining-account convention: marketplace fee authority
signer, canonical guard GlobalConfig, then any Token-2022 slot. This is required
only for SPL-owned replacement evidence; live v1 trees remain ineligible for
permissionless v2 exits. The marketplace must confirm that the stored item
originally entered as v2 from escrow-entry history before signing an SPL
replacement exit. Typed v2 receipt cleanup accepts all non-MPL replacements,
including SPL, without additional accounts. Named accounts, args, discriminators,
config lines and account layouts are unchanged; regenerated IDLs change only
instruction documentation.

Umi admin preparation accepts zero-root/no-proof, no-leaf exits after checking
the recorded account/slot and simulating the same claim. It keeps identity and
funding checks and refuses occupied live v2 slots. On missing-owner evidence,
claim error 6069 is accepted only after absent-slot checks for both MPL and SPL
compression owners. It never establishes that an occupied SPL slot is v2 or
undeliverable; MPL header/slot failures still
need the failed Bubblegum invocation. The collection-level live-leaf helper
retains its authenticated metadata and proof checks. No full-tree fetch is added
to live preparation or settlement: only no-leaf admin exit preparation reads it.

Eighty new LiteSVM regressions execute BurnV2, deployed CloseTreeV2 and signed
re-creation at the actual recorded address as System-owned data, foreign-owned
data, a live SPL v1 tree, an uninitialized one-byte MPL account and a new
CreateTreeV2 tree. Nonzero original index 2 exercises the smaller replacement's
append bound. Tests cover SOL/SPL/Token-2022 full refunds and claimed/unsold
settlement, every replacement's retained receipt rent, machine closure, drawn /
unsold collaboration shares, simulated admin preparation, live-v1 rejection and
current-root proof verification for a slot already appended in a new tree.
The System replacement refund failed with 6069 on the previous artifact.

Validation through `heavy`: the focused **80** R20 regressions pass; full client
suites pass **36 script checks, 300 Kit tests, 811 Umi tests and seven Rust-client
tests**. The existing Kit todo and Umi upstream asset-data skip remain. Native
program/guard suites pass **18 / one tests**; utility integration tests pass
**11**. The documented SBPFv2 build, client generator and Umi declaration build
pass. Full budget tests retain the normal transfer/settlement baselines.

[`cnft-v2-fix20-metrics.json`](./cnft-v2-fix20-metrics.json) records **57**
final-artifact simulations: **8,039–86,738 CU / 345–1195 bytes**, all within the
200,000-CU and 1232-byte limits. No LUT is needed for these fixture transactions.
Normal live settlement gains no account, CPI or tree read. Recovery alone uses
the expanded evidence check and, for SPL replacements, its marketplace prefix.

Artifact pins are superseded by the M21 release artifact. For release, use the current Rollout and allocation section: upgrade guard
first, then extend/upgrade gumball, and synchronize the backend artifact
manifest before enabling v2 entries.

Downstream handoff: backend recovery builders must mirror the exact owner,
header and append-index rules, preserve the SPL marketplace convention, and
simulate before an admin exit. They must use cached owner/dimensions for live
settlement and download full tree data only on recovery exits (R20-03). Market
and Auction share the replacement-account exposure (R20-02); those repositories
and backend changes belong to their assigned agents. Nothing was deployed or
pushed, and no network transaction was sent.

## Historical M20 synchronized client verification

The documented program rebuild and client generator preserve the reviewed R20
program bytes. Full `heavy -- pnpm test` passes 36 script checks, 300 Kit tests,
811 Umi tests and seven Rust-client tests, with the existing Kit todo/Umi skip.
Native suites pass 18 program tests, one guard test and 11 utility tests.

The collaboration recovery regression now budgets 300,000 CU for settlement
and seats large SPL/Token-2022 packets in real lookup tables, matching consumer
composition. It still checks exact proceeds, refund reserves and seller shares.
Its 18 measured settlements use 84,504–175,007 CU and 498–1110 serialized bytes
including the compute-budget instruction; see `cnft-v2-m20-integration-metrics.json`.
No deployment or publication occurred.

## M21 marketplace-authorized tree exits

R21-01 follows the round-21 admin-trust decision: no additional on-chain tree
reconstruction heuristics. The permissionless owner/header/counter/append-index
predicate is unchanged. When a replacement tree's slot cannot prove loss of the
original leaf, the marketplace authority can authorize every remaining exit:

- Drawn, unclaimed items use existing `admin_refund_cnft_sale_v2` with no leaf.
  The per-draw ledger still refunds the full payment and releases its reserve.
- Claimed or recovered-unsold items use `settle_cnft_sale_v2` with `version = 2`,
  `args.flags = 255`, zero root and `nonce == index`. Prefix remaining accounts
  with marketplace fee authority **signer**, canonical guard `GlobalConfig`,
  then any Token-2022 slot. No creator accounts or proof follow. This opt-in
  prefix now works for MPL-owned occupied replacements, as well as SPL ones.
  Existing seller, curator and marketplace fee accounting remains exact.
- Retained receipts use `close_missing_cnft_recovery_v2` with no leaf, zero root
  and the same signer/config prefix; rent returns to the recorded rent payer.
  Use this exit instead of reclaim when the original leaf cannot be delivered.
- Machine close then uses the existing close instruction and accounting checks.

There are no named-account, argument, discriminator, receipt or machine-layout
changes. IDLs were rebuilt and clients regenerated with `pnpm generate:clients`;
only instruction documentation changed. V1 instructions remain unchanged.

Operator preparation is dry-run only: the Umi helpers return builders and never
send. A foreign authority in an occupied MPL tree is independently checkable
replacement evidence off-chain. The refund helper also simulates the same draw;
new `prepareAdminSettleMissingCnftSaleV2` and
`prepareAdminCloseMissingCnftRecoveryV2` validate the missing-tree inputs and
simulate their signed admin exits. They reject occupied canonical live trees,
invalid authorities and unusable settlement accounts. Canonical-authority
re-creations whose history cannot be established from their current account
are deliberately not automatically authorised by these helpers: inspect v2
escrow-entry history and the actual current claim/settlement simulation before
manually preparing the existing generated builder with the admin prefix.
The marketplace owns that off-chain decision, never the machine authority.
Backend operator tooling must apply the same gate and remain dry-run by default.

R21-03 applies absent-slot checks to SPL as well as MPL owners. A v2 claim error
6069 cannot establish that an occupied live v1 draw is undeliverable; use its v1
claim. The live-v1 regression first rejects admin preparation and then completes
the actual v1 claim. R21-06 rejects the machine authority, unsigned marketplace,
noncanonical config and swapped prefix before a correct prefix settles.

Twenty-four R21-01 regressions cover nonce 0 and 2, drawn/claimed/unsold exits,
retained receipt rent, SOL/SPL/Token-2022 settlement, exact collaboration shares,
curator/marketplace fees, operator simulations and machine closure. Eight live
controls use 3/8 (including full), 5/8 (including wrapped changelog), 14/64 with
canopy 9 and 20/1024 with canopy 15. Each rejects a proof-free refund and claimed
settlement, leaves state unchanged and then performs ordinary delivery/settlement.
The sparse single-live-leaf test helper is O(depth), avoiding million-node hashes
for depth-20 fixtures. The native range regression covers full buffers, nonzero
active indices and non-default buffer sizes.

[`cnft-v2-fix21-metrics.json`](./cnft-v2-fix21-metrics.json) contains 13 local
final-artifact simulations: **11,886–77,063 CU / 475–1195 serialized bytes**.
Normal live settlement gains no account, tree load or CPI; the admin prefix is
read only for the explicit zero-root burnt exit (SPL replacement requires it).

The current artifacts are built from `mallow-gumball` 1.1.0, `gumball-guard`
1.1.0 and `utils` 0.2.0. The gumball artifact is **1,713,672 bytes**, SHA-256
`1038b20c211fa7311f2762216f4f7aea7723fe9733d5d0e5a2f22a63d5dc988b`.
Deploy/test copies are byte-identical. Against the recorded **1,550,208-byte**
allocation, extend by exactly **163,464 bytes**, subject to rechecking finalized
capacity. Guard is **935,784 bytes**, SHA-256
`6f49951721952043c2b75f28536358b566990188d5295cf0be17fdb4a595d0b5`;
against its recorded **1,038,504-byte** allocation it needs no extension.
Both are SBPFv2. Upgrade guard first, then extend/upgrade gumball and
synchronize the backend artifact manifest before enabling v2 entries.
No deployment, publication, push or network transaction was performed.

### Reproducing the release binaries

These hashes reproduce byte-for-byte only when the checkout sits at
`/root/projects/mallow/mallow-gumball-cnft-v2`. A cold build at any other path
gives the same sizes but different SHA-256 hashes. The likely cause is that
`utils = { path = "../../utils" }` lies outside each program's own workspace, so
its absolute source path is embedded in the binary. The build is unchanged; to
reproduce or audit the pins, match all of these:

- **Checkout path:** `/root/projects/mallow/mallow-gumball-cnft-v2`, at the
  release commit.
- **Build command:** `heavy -- env NO_DNA=1 pnpm programs:build` from the repo
  root (`configs/program-scripts/build.sh`). Phase 1 is
  `anchor build --provider.cluster localnet --ignore-keys`. Phase 2 is
  `cargo build-sbf --arch v2 --tools-version v1.52`.
- **Toolchain:** Rust 1.92.0 (each program's `rust-toolchain.toml`), Anchor CLI
  1.1.2 with `solana_version = "4.1.2"` (each program's `Anchor.toml`) and
  platform-tools v1.52. On 2026-10-15 the active Agave CLI on the build box was
  3.1.10.

Then compare `programs/<program>/target/deploy/*.so` and `programs/.bin/*.so`
with the hashes above. A build that does not match all three gives a new
artifact; approve and repin it before any upload.


## M21 consumer synchronization

The release candidate rebuilds with `heavy -- env NO_DNA=1 pnpm programs:build`
and regenerates through `pnpm generate:clients`; the only tracked output change
is IDL `metadata.version` 1.1.0 in `idls/` and the Umi `AnchorIdls` types.
`heavy -- pnpm test` passes 39 script, 300 Kit, 836 Umi and seven Rust-client
tests; the existing Kit todo and Umi skip remain. Native checks pass 19 machine,
one guard and 11 utility tests.

The Umi build exports the tree-evidence/admin-exit helpers. Consumers copy both
JSON IDLs and the rebuilt Umi client, then repin the upload files. Gumball is
1,713,672 bytes; exact extension against recorded allocation 1,550,208 is
163,464 bytes. Guard is 935,784 bytes and requires no extension against recorded
allocation 1,038,504. All are SBPFv2. Recheck allocation before upgrade.
No deployment or publication occurred. A rebuild reproduces these hashes only
under the path, command and toolchain listed in
[Reproducing the release binaries](#reproducing-the-release-binaries).
