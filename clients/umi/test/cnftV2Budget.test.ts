import { withRequestCancellationMachine } from '../src';
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-await-in-loop */
import { createCollection, ruleSet } from '@metaplex-foundation/mpl-core';
import {
  createEmptyLut,
  createLutForTransactionBuilder,
  extendLut,
  fetchAddressLookupTable,
  findAssociatedTokenPda,
  getSplTokenProgramId,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-toolbox';
import {
  createSignerFromKeypair,
  generateSigner,
  signerIdentity,
  sol,
  some,
  transactionBuilder,
  TransactionBuilder,
  Umi,
} from '@metaplex-foundation/umi';
import { toWeb3JsTransaction } from '@metaplex-foundation/umi-web3js-adapters';
import test from 'ava';
import { FailedTransactionMetadata } from 'litesvm';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  addCnftV2,
  cancelAddCnftRequestV2,
  claimCnftV2,
  draw,
  fetchGumballMachine,
  findGumballMachineAuthorityPda,
  findSellerHistoryPda,
  removeCnftV2,
  requestAddCnftV2,
  settleCnftSaleV2,
  startSale,
} from '../src';
import {
  addLargeCollectionAttributes,
  cnftArgs,
  createCnftUmi,
  getCnftProof,
  mintCnft,
  proofAccounts,
  settleRemainingAccounts,
} from './_cnftV2Setup';
import { create, createMintWithHolders, createUmi } from './_setup';
import { getSvm } from './litesvm/svm';

const rows: any[] = [];
const committedRows: any[] = process.env.CNFT_V2_METRICS_OUT
  ? []
  : JSON.parse(readFileSync('../../docs/cnft-v2-metrics.json', 'utf8'));
const rowKey = (row: any) =>
  `${row.instruction}/${row.scenario}/${row.proofDepth}`;
const checkCommittedRow = (row: any) => {
  if (process.env.CNFT_V2_METRICS_OUT) return;
  const baseline = committedRows.find((r) => rowKey(r) === rowKey(row));
  if (!baseline) throw new Error(`Missing committed budget: ${rowKey(row)}`);
  for (const field of [
    'withoutLutBytes',
    'withLutBytes',
    'withoutLutFitsPacket',
    'withLutFitsPacket',
    'cuCeiling',
  ]) {
    if (row[field] !== baseline[field])
      throw new Error(
        `${rowKey(row)} ${field}: ${row[field]} != committed ${baseline[field]}`
      );
  }
  for (const field of ['withoutLutCu', 'withLutCu']) {
    const tolerance = Math.max(100, Math.ceil(baseline[field] * 0.03));
    if (Math.abs(row[field] - baseline[field]) > tolerance)
      throw new Error(
        `${rowKey(row)} ${field}: ${row[field]} differs from committed ${baseline[field]} by more than ${tolerance} CU`
      );
  }
};
let keyIndex = 0;
// Public, test-only seeds make PDA bump searches and CU samples reproducible.
const fixedUmi = async () => {
  const umi = await createCnftUmi(createUmi);
  umi.eddsa.generateKeypair = () =>
    umi.eddsa.createKeypairFromSeed(
      createHash('sha256').update(`gumball-v2-budget-${keyIndex++}`).digest()
    );
  umi.use(
    signerIdentity(createSignerFromKeypair(umi, umi.eddsa.generateKeypair()))
  );
  await umi.rpc.airdrop(umi.identity.publicKey, sol(100));
  return umi;
};

// Simulate identical v0 messages before changing the ledger. Send the LUT form
// so deep proofs also execute within the 1232-byte packet limit.
const measure = async (
  umi: Umi,
  instruction: string | null,
  proofDepth: number,
  builder: TransactionBuilder,
  scenario = 'leaf-sol'
) => {
  const bare = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(builder)
    .useV0();
  const noLut = await bare.buildAndSign(umi);
  // Umi's serializer can size an oversized message; web3.js allocates a packet-
  // sized message buffer and throws first. Simulate raw bytes locally for CU,
  // while reporting the packet limit separately. Never send the oversized form.
  const noLutRaw = umi.transactions.serialize(noLut);
  const withoutLutBytes = noLutRaw.length;
  if (
    withoutLutBytes <= 1232 &&
    toWeb3JsTransaction(noLut).serialize().length !== withoutLutBytes
  )
    throw new Error('Transaction serializers disagree');
  const withoutLutSimulation = getSvm().simulateVersionedTransaction(noLutRaw);
  if (withoutLutSimulation instanceof FailedTransactionMetadata)
    throw new Error(withoutLutSimulation.meta().logs().join('\n'));
  const recentSlot = (await umi.rpc.getSlot()) - 1;
  const [, tables] = createLutForTransactionBuilder(umi, bare, recentSlot);
  // The toolbox helper can drop its final extension at a packet boundary.
  // Keep its address selection, but create and extend in explicit small chunks.
  for (const [tableIndex, table] of tables.entries()) {
    await createEmptyLut(umi, {
      recentSlot: recentSlot - tableIndex,
    }).sendAndConfirm(umi);
    for (let offset = 0; offset < table.addresses.length; offset += 20)
      await extendLut(umi, {
        address: table.publicKey,
        addresses: table.addresses.slice(offset, offset + 20),
      }).sendAndConfirm(umi);
    const stored = await fetchAddressLookupTable(umi, table.publicKey);
    if (stored.addresses.join() !== table.addresses.join())
      throw new Error('Lookup table contents differ from the measured message');
  }
  // Move the test clock past LUT extension so addresses can be loaded.
  getSvm().warpToSlot(BigInt(await umi.rpc.getSlot()) + 1n);
  const withLut = await bare.setAddressLookupTables(tables).buildAndSign(umi);
  const withLutBytes = toWeb3JsTransaction(withLut).serialize().length;
  const withLutSimulation = await umi.rpc.simulateTransaction(withLut);
  if (withLutSimulation.err) throw new Error(JSON.stringify(withLutSimulation));
  const withoutLutCu = Number(
    withoutLutSimulation.meta().computeUnitsConsumed()
  );
  const withLutCu = withLutSimulation.unitsConsumed!;
  const cuCeiling =
    scenario === 'leaf-sol'
      ? instruction === 'settle_cnft_sale_v2_transfer'
        ? 135_000
        : 110_000
      : 170_000;
  if (withoutLutCu > cuCeiling || withLutCu > cuCeiling)
    throw new Error(
      `${instruction}/${scenario} exceeds ${cuCeiling} CU: ${withoutLutCu}/${withLutCu}`
    );
  if (instruction) {
    const row = {
      instruction,
      scenario,
      proofDepth,
      withoutLutBytes,
      withLutBytes,
      withoutLutCu,
      withLutCu,
      cuCeiling,
      withoutLutFitsPacket: withoutLutBytes <= 1232,
      withLutFitsPacket: withLutBytes <= 1232,
    };
    checkCommittedRow(row);
    rows.push(row);
  }
  if (withLutBytes > 1232)
    throw new Error(`LUT transaction exceeds packet: ${withLutBytes}`);
  await umi.rpc.sendTransaction(withLut);
};

for (const proofDepth of [0, 5, 10, 14]) {
  test.serial(
    `v2 instruction budgets at proof depth ${proofDepth}`,
    async (t) => {
      const umi = await fixedUmi();
      const creators = [
        { address: generateSigner(umi).publicKey, verified: false, share: 100 },
      ];
      const item = await mintCnft(umi, {
        depth: proofDepth === 0 ? 5 : proofDepth,
        canopyDepth: proofDepth === 0 ? 5 : 0,
        creators,
      });
      const machine = (
        await create(umi, {
          settings: { itemCapacity: 1 },
          guards: { solPayment: { lamports: sol(1) } },
          disablePrimarySplit: true,
        })
      ).publicKey;
      const escrow = findGumballMachineAuthorityPda(umi, {
        gumballMachine: machine,
      })[0];
      const base = () => ({
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item),
      });
      const proof = () => proofAccounts(getCnftProof(umi, item).proof);
      // Request/cancel needs a seller distinct from the curator.
      const sellerUmi = await fixedUmi();
      const requested = await mintCnft(umi, {
        owner: sellerUmi.identity.publicKey,
        creators,
        depth: item.depth,
        canopyDepth: item.canopyDepth,
      });
      const requestBase = () => ({
        asset: requested.assetId,
        treeConfig: requested.treeConfig,
        merkleTree: requested.merkleTree,
        args: cnftArgs(umi, requested),
      });
      await measure(
        sellerUmi,
        'request_add_cnft_v2',
        proofDepth,
        requestAddCnftV2(sellerUmi, {
          gumballMachine: machine,
          leafDelegate: requested.owner,
          ...requestBase(),
        }).addRemainingAccounts(
          proofAccounts(getCnftProof(umi, requested).proof)
        )
      );
      requested.owner = escrow;
      await measure(
        sellerUmi,
        'cancel_add_cnft_request_v2',
        proofDepth,
        withRequestCancellationMachine(
          cancelAddCnftRequestV2(sellerUmi, {
            ...requestBase(),
            authorityPda: escrow,
            sellerHistory: findSellerHistoryPda(umi, {
              gumballMachine: machine,
              seller: sellerUmi.identity.publicKey,
            })[0],
          }).addRemainingAccounts(
            proofAccounts(getCnftProof(umi, requested).proof)
          ),
          machine
        )
      );
      await measure(
        umi,
        'add_cnft_v2',
        proofDepth,
        addCnftV2(umi, {
          gumballMachine: machine,
          leafDelegate: item.owner,
          ...base(),
          addItemArgs: {},
        }).addRemainingAccounts(proof())
      );
      item.owner = escrow;
      await measure(
        umi,
        'remove_cnft_v2',
        proofDepth,
        removeCnftV2(umi, {
          gumballMachine: machine,
          index: 0,
          seller: umi.identity.publicKey,
          ...base(),
        }).addRemainingAccounts(proof())
      );
      item.owner = umi.identity.publicKey;
      await measure(
        umi,
        null,
        proofDepth,
        addCnftV2(umi, {
          gumballMachine: machine,
          leafDelegate: item.owner,
          ...base(),
          addItemArgs: {},
        }).addRemainingAccounts(proof())
      );
      item.owner = escrow;
      await startSale(umi, { gumballMachine: machine }).sendAndConfirm(umi);
      const buyerUmi = await fixedUmi();
      await draw(umi, {
        gumballMachine: machine,
        buyer: buyerUmi.identity,
        mintArgs: { solPayment: some(true) },
      }).sendAndConfirm(umi);
      await measure(
        umi,
        'claim_cnft_v2',
        proofDepth,
        claimCnftV2(umi, {
          gumballMachine: machine,
          index: 0,
          seller: umi.identity.publicKey,
          buyer: buyerUmi.identity.publicKey,
          ...base(),
        }).addRemainingAccounts(proof())
      );
      item.owner = buyerUmi.identity.publicKey;
      const settle = () =>
        settleCnftSaleV2(umi, {
          gumballMachine: machine,
          index: 0,
          seller: umi.identity.publicKey,
          authority: umi.identity.publicKey,
          buyer: buyerUmi.identity.publicKey,
          ...base(),
          currentLeafOwner: item.owner,
          currentLeafDelegate: item.owner,
        }).addRemainingAccounts(
          settleRemainingAccounts(creators, getCnftProof(umi, item).proof)
        );
      await measure(umi, 'settle_cnft_sale_v2_claimed', proofDepth, settle());
      t.is((await fetchGumballMachine(umi, machine)).itemsSettled, 1n);

      const unclaimedItem = await mintCnft(umi, {
        creators,
        depth: item.depth,
        canopyDepth: item.canopyDepth,
      });
      const unclaimedMachine = (
        await create(umi, {
          settings: { itemCapacity: 1 },
          guards: { solPayment: { lamports: sol(1) } },
          disablePrimarySplit: true,
        })
      ).publicKey;
      await measure(
        umi,
        null,
        proofDepth,
        addCnftV2(umi, {
          gumballMachine: unclaimedMachine,
          treeConfig: unclaimedItem.treeConfig,
          merkleTree: unclaimedItem.merkleTree,
          leafDelegate: unclaimedItem.owner,
          args: cnftArgs(umi, unclaimedItem),
          addItemArgs: {},
        }).addRemainingAccounts(
          proofAccounts(getCnftProof(umi, unclaimedItem).proof)
        )
      );
      unclaimedItem.owner = findGumballMachineAuthorityPda(umi, {
        gumballMachine: unclaimedMachine,
      })[0];
      await startSale(umi, { gumballMachine: unclaimedMachine }).sendAndConfirm(
        umi
      );
      await draw(umi, {
        gumballMachine: unclaimedMachine,
        buyer: buyerUmi.identity,
        mintArgs: { solPayment: some(true) },
      }).sendAndConfirm(umi);
      await measure(
        umi,
        'settle_cnft_sale_v2_transfer',
        proofDepth,
        settleCnftSaleV2(umi, {
          gumballMachine: unclaimedMachine,
          index: 0,
          seller: umi.identity.publicKey,
          authority: umi.identity.publicKey,
          buyer: buyerUmi.identity.publicKey,
          treeConfig: unclaimedItem.treeConfig,
          merkleTree: unclaimedItem.merkleTree,
          args: cnftArgs(umi, unclaimedItem),
          currentLeafOwner: unclaimedItem.owner,
          currentLeafDelegate: unclaimedItem.owner,
        }).addRemainingAccounts(
          settleRemainingAccounts(
            creators,
            getCnftProof(umi, unclaimedItem).proof
          )
        )
      );
      t.is((await fetchGumballMachine(umi, unclaimedMachine)).itemsSettled, 1n);
    }
  );
}

test.after.always((t) => {
  if (!process.env.CNFT_V2_METRICS_OUT) {
    t.is(
      rows.length,
      committedRows.length,
      'Every committed budget row must be measured'
    );
    t.is(
      new Set(rows.map(rowKey)).size,
      rows.length,
      'Budget keys must be unique'
    );
  }
  if (process.env.CNFT_V2_METRICS_OUT)
    writeFileSync(
      process.env.CNFT_V2_METRICS_OUT,
      `${JSON.stringify(rows, null, 2)}\n`
    );
});

for (const proofDepth of [5, 14]) {
  for (const payment of ['sol', 'spl', 'token2022']) {
    test.serial(
      `inherited collection royalties and ${payment} budgets at depth ${proofDepth}`,
      async (t) => {
        const umi = await fixedUmi();
        const programs = umi.programs.clone();
        if (payment === 'token2022') programs.bind('splToken', 'splToken2022');
        const tokenUmi = { ...umi, programs };
        const creatorA = generateSigner(umi).publicKey;
        const creatorB = generateSigner(umi).publicKey;
        for (const alreadyClaimed of [false, true]) {
          const collectionSigner = generateSigner(umi);
          await createCollection(umi, {
            collection: collectionSigner,
            name: 'Budget collection',
            uri: '',
            plugins: [
              { type: 'BubblegumV2' },
              {
                type: 'Royalties',
                basisPoints: 700,
                creators: [
                  { address: creatorA, percentage: 70 },
                  { address: creatorB, percentage: 30 },
                ],
                ruleSet: ruleSet('None'),
              },
            ],
          }).sendAndConfirm(umi);
          const collection = collectionSigner.publicKey;

          const machineSigner = generateSigner(umi);
          const machine = machineSigner.publicKey;
          const escrow = findGumballMachineAuthorityPda(umi, {
            gumballMachine: machine,
          })[0];
          let mint: any;
          let treasury: any;
          let creatorAtaA: any;
          let creatorAtaB: any;
          if (payment !== 'sol') {
            [mint, , treasury, creatorAtaA, creatorAtaB] =
              await createMintWithHolders(tokenUmi, {
                decimals: 0,
                holders: [
                  { owner: umi.identity, amount: 10_000 },
                  { owner: escrow, amount: 0 },
                  { owner: creatorA, amount: 0 },
                  { owner: creatorB, amount: 0 },
                ],
              });
          }
          const guard =
            payment === 'sol'
              ? undefined
              : {
                  mint: mint.publicKey,
                  destinationAta: treasury,
                  amount: 10_000,
                };
          await create(umi, {
            gumballMachine: machineSigner,
            settings: {
              itemCapacity: 1,
              curatorFeeBps: 0,
              ...(mint ? { paymentMint: mint.publicKey } : {}),
            },
            guards:
              payment === 'sol'
                ? { solPayment: { lamports: sol(1) } }
                : payment === 'spl'
                  ? { tokenPayment: some(guard!) }
                  : { token2022Payment: some(guard!) },
            disablePrimarySplit: true,
          });
          const item = await mintCnft(umi, {
            collection,
            sellerFeeBasisPoints: 65535,
            creators: [],
            depth: proofDepth,
          });
          // Bubblegum's transfer heap limits collection payloads independently
          // of gumball's targeted loaders. Grow after escrow/claim below.
          const base = () => ({
            treeConfig: item.treeConfig,
            merkleTree: item.merkleTree,
            coreCollection: collection,
            args: cnftArgs(umi, item),
          });
          const proof = () => proofAccounts(getCnftProof(umi, item).proof);
          const scenario = `collection-inherited-${payment}-attributes0k-${alreadyClaimed ? 'claim' : 'transfer'}`;
          await measure(
            umi,
            'add_cnft_v2',
            proofDepth,
            addCnftV2(umi, {
              gumballMachine: machine,
              leafDelegate: item.owner,
              addItemArgs: {},
              ...base(),
            }).addRemainingAccounts(proof()),
            scenario
          );
          item.owner = escrow;
          await startSale(umi, { gumballMachine: machine }).sendAndConfirm(umi);
          await draw(umi, {
            gumballMachine: machine,
            mintArgs:
              payment === 'sol'
                ? { solPayment: some(true) }
                : payment === 'spl'
                  ? {
                      tokenPayment: some({
                        mint: mint.publicKey,
                        destinationAta: treasury,
                      }),
                    }
                  : {
                      token2022Payment: some({
                        mint: mint.publicKey,
                        destinationAta: treasury,
                      }),
                    },
          }).sendAndConfirm(umi);
          if (alreadyClaimed) {
            await measure(
              umi,
              'claim_cnft_v2',
              proofDepth,
              claimCnftV2(umi, {
                gumballMachine: machine,
                index: 0,
                seller: umi.identity.publicKey,
                buyer: umi.identity.publicKey,
                ...base(),
              }).addRemainingAccounts(proof()),
              scenario
            );
            item.owner = umi.identity.publicKey;
          }
          addLargeCollectionAttributes(
            collection,
            alreadyClaimed ? 40_000 : 4_000
          );
          const accounts =
            payment === 'sol'
              ? settleRemainingAccounts(
                  [
                    { address: creatorA, verified: false, share: 70 },
                    { address: creatorB, verified: false, share: 30 },
                  ],
                  getCnftProof(umi, item).proof
                )
              : [
                  ...(payment === 'token2022'
                    ? [
                        {
                          pubkey: getSplTokenProgramId(tokenUmi),
                          isWritable: false,
                          isSigner: false,
                        },
                      ]
                    : []),
                  ...[creatorA, creatorAtaA, creatorB, creatorAtaB].map(
                    (pubkey) => ({ pubkey, isWritable: true, isSigner: false })
                  ),
                  ...proof(),
                ];
          const sellerAta = mint
            ? findAssociatedTokenPda(tokenUmi, {
                mint: mint.publicKey,
                owner: umi.identity.publicKey,
              })[0]
            : undefined;
          await measure(
            umi,
            alreadyClaimed
              ? 'settle_cnft_sale_v2_claimed'
              : 'settle_cnft_sale_v2_transfer',
            proofDepth,
            settleCnftSaleV2(umi, {
              gumballMachine: machine,
              index: 0,
              seller: umi.identity.publicKey,
              authority: umi.identity.publicKey,
              buyer: umi.identity.publicKey,
              ...base(),
              currentLeafOwner: item.owner,
              currentLeafDelegate: item.owner,
              ...(mint
                ? {
                    paymentMint: mint.publicKey,
                    authorityPdaPaymentAccount: treasury,
                    authorityPaymentAccount: sellerAta,
                    sellerPaymentAccount: sellerAta,
                  }
                : {}),
            }).addRemainingAccounts(accounts),
            `collection-inherited-${payment}-attributes${alreadyClaimed ? 40 : 4}k`
          );
          t.is((await fetchGumballMachine(umi, machine)).itemsSettled, 1n);
        }
      }
    );
  }
}
