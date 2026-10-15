/* eslint-disable no-await-in-loop */
// R14-01 regression: v6 cumulative TOKEN settlement with recipients' ATAs toggled
// unusable/usable between settles (parking, folding and creator skip).
import { ruleSet } from '@metaplex-foundation/mpl-core';
import {
  createAssociatedToken,
  findAssociatedTokenPda,
  mintTokensTo,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  PublicKey,
  publicKey,
  publicKeyBytes,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { Account } from 'litesvm/dist/internal';
import {
  addCnftV2,
  claimCnftV2,
  claimCoreAsset,
  draw,
  fetchGumballMachine,
  findGumballMachineAuthorityPda,
  settleCnftSaleV2,
  settleCoreAssetSale,
  startSale,
  TokenStandard,
} from '../src';
import {
  cnftArgs,
  createCnftUmi,
  getCnftProof,
  mintCnft,
  proofAccounts,
} from './_cnftV2Setup';
import {
  create,
  createCoreAsset,
  createMintWithHolders,
  createUmi,
} from './_setup';
import { getSvm } from './litesvm/svm';

const T22 = publicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const CLASSIC = publicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const pick = <T>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];
const bps = (a: bigint, b: number) => (a * BigInt(b)) / 10000n;
const SPLITS = [
  [100],
  [50, 50],
  [33, 33, 34],
  [1, 99],
  [10, 20, 30, 40],
  [97, 1, 1, 1],
];
const PRICES = [
  1_000_000_002n,
  1_000_001n,
  3_333_337n,
  999_999n,
  10_021n,
  7_777n,
  1_003n,
  101n,
];

const tokenAmount = (key: PublicKey): bigint => {
  const a = getSvm().getAccount(publicKeyBytes(key));
  if (!a || a.data().length < 72) return 0n;
  const d = a.data();
  return new DataView(d.buffer, d.byteOffset, d.byteLength).getBigUint64(
    64,
    true
  );
};

const SEEDS = (process.env.FIX14_FUZZ_SEEDS ?? '1-24').split('-').map(Number);
for (let seed = SEEDS[0]; seed <= SEEDS[1]; seed += 1) {
  test.serial(`R14-01 token payout fuzz seed=${seed}`, async (t) => {
    const r = rng(seed * 104729);
    const use2022 = r() < 0.5;
    const tp = use2022 ? T22 : CLASSIC;
    const K = 2 + Math.floor(r() * 3);
    const N = K + 1;
    const price = pick(r, PRICES);
    const primary = r() < 0.4;
    const curatorFeeBps = pick(r, [0, 1, 333, 500, 2500]);
    const feeBps = pick(r, [0, 1, 250, 777]);
    const royaltyBps = pick(r, [0, 1, 500, 999, 3333, 10000]);
    const seller = await createCnftUmi(createUmi);
    const caller = await createCnftUmi(createUmi);
    const programs = seller.programs.clone();
    if (use2022) programs.bind('splToken', 'splToken2022');
    const tokenUmi: any = { ...seller, programs };
    const feeWallet = generateSigner(caller).publicKey;
    const machineSigner = generateSigner(seller);
    const machine = machineSigner.publicKey;
    const [pda] = findGumballMachineAuthorityPda(seller, {
      gumballMachine: machine,
    });
    const [mint, treasury, feeAta, sellerAta] = await createMintWithHolders(
      tokenUmi,
      {
        decimals: 0,
        holders: [
          { owner: pda, amount: 0 },
          { owner: feeWallet, amount: 0 },
          { owner: seller.identity.publicKey, amount: 0 },
        ],
      }
    );
    const ata = (owner: PublicKey) =>
      findAssociatedTokenPda(seller, {
        mint: mint.publicKey,
        owner,
        tokenProgramId: tp,
      })[0];
    const items: {
      asset: PublicKey;
      creators: PublicKey[];
      shares: number[];
    }[] = [];
    for (let i = 0; i < K; i += 1) {
      const shares = pick(r, SPLITS);
      const creators = shares.map(() => generateSigner(seller).publicKey);
      for (const c of creators)
        if (r() < 0.6)
          await createAssociatedToken(tokenUmi, {
            mint: mint.publicKey,
            owner: c,
          }).sendAndConfirm(tokenUmi);
      const asset = await createCoreAsset(seller, {
        plugins: [
          {
            type: 'Royalties',
            basisPoints: royaltyBps,
            creators: creators.map((address, j) => ({
              address,
              percentage: shares[j],
            })),
            ruleSet: ruleSet('None'),
          },
        ],
      });
      items.push({ asset: asset.publicKey, creators, shares });
    }
    const guard = {
      mint: mint.publicKey,
      destinationAta: treasury,
      amount: price,
    };
    await create(seller, {
      gumballMachine: machineSigner,
      settings: { itemCapacity: N, curatorFeeBps, paymentMint: mint.publicKey },
      feeConfig: feeBps ? { feeAccount: feeWallet, feeBps } : null,
      disablePrimarySplit: !primary,
      items: items.map((x) => ({
        id: x.asset,
        tokenStandard: TokenStandard.Core,
      })),
      guards: use2022
        ? { token2022Payment: some(guard) }
        : { tokenPayment: some(guard) },
    } as any);
    const leaf = await mintCnft(seller, {
      sellerFeeBasisPoints: 0,
      creators: [],
    });
    await addCnftV2(seller, {
      gumballMachine: machine,
      treeConfig: leaf.treeConfig,
      merkleTree: leaf.merkleTree,
      leafDelegate: leaf.owner,
      addItemArgs: {},
      args: cnftArgs(seller, leaf),
    })
      .addRemainingAccounts(proofAccounts(getCnftProof(seller, leaf).proof))
      .sendAndConfirm(seller);
    leaf.owner = pda;
    await startSale(seller, { gumballMachine: machine }).sendAndConfirm(seller);
    const buyers: any[] = [];
    for (let i = 0; i < N; i += 1) {
      const b = await createCnftUmi(createUmi);
      buyers.push(b);
      await transactionBuilder()
        .add(
          createAssociatedToken(tokenUmi, {
            mint: mint.publicKey,
            owner: b.identity.publicKey,
          })
        )
        .add(
          mintTokensTo(tokenUmi, {
            mint: mint.publicKey,
            token: ata(b.identity.publicKey),
            amount: price,
          })
        )
        .sendAndConfirm(tokenUmi);
      const args = {
        mint: mint.publicKey,
        destinationAta: treasury,
        feeAccounts: feeBps ? [feeWallet] : [],
        feeAccount: feeBps ? feeWallet : undefined,
      };
      await transactionBuilder()
        .add(setComputeUnitLimit(b, { units: 600_000 }))
        .add(
          draw(b, {
            gumballMachine: machine,
            mintArgs: use2022
              ? { token2022Payment: some(args) }
              : { tokenPayment: some(args) },
          } as any)
        )
        .sendAndConfirm(b);
    }
    let gm = await fetchGumballMachine(seller, machine);
    t.is(gm.version, 6);
    const byIdx = gm.items.map((it) => {
      const item = items.find((x) => x.asset === it.mint) ?? {
        asset: it.mint,
        creators: [] as PublicKey[],
        shares: [] as number[],
      };
      const buyer = buyers.find((b) => b.identity.publicKey === it.buyer)!;
      return { ...item, buyer };
    });
    const leafIdx = gm.items.findIndex((it) => it.mint === leaf.assetId);
    const sellerKey = seller.identity.publicKey;
    const allCreators = [...new Set(byIdx.flatMap((x) => x.creators))];
    const toggleable: PublicKey[] = [
      sellerAta,
      ...(feeBps ? [feeAta] : []),
      ...allCreators.map(ata),
    ];
    const saved = new Map<string, any>();
    const modes = use2022 ? ['owner', 'frozen', 'memo'] : ['owner', 'frozen'];
    const breakAta = (k: PublicKey) => {
      const key = publicKeyBytes(k);
      const a = getSvm().getAccount(key);
      if (!a || a.data().length === 0 || saved.has(k)) return;
      saved.set(k, a);
      let d = a.data();
      const mode = pick(r, modes);
      if (mode === 'owner')
        d.set(publicKeyBytes(generateSigner(caller).publicKey), 32);
      else if (mode === 'frozen') d[108] = 2;
      else {
        const e = new Uint8Array(d.length + 5);
        e.set(d);
        e.set([8, 0, 1, 0, 1], d.length);
        d = e;
      }
      getSvm().setAccount(
        key,
        new Account(a.lamports(), d, a.owner(), false, 0n)
      );
    };
    const fixAta = (k: PublicKey) => {
      const a = saved.get(k);
      if (!a) return;
      const cur = getSvm().getAccount(publicKeyBytes(k))!;
      // restore metadata but keep the current balance
      const d = a.data();
      d.set(cur.data().slice(64, 72), 64);
      getSvm().setAccount(
        publicKeyBytes(k),
        new Account(cur.lamports(), d, a.owner(), false, 0n)
      );
      saved.delete(k);
    };
    const creatorRem = (creators: PublicKey[]) =>
      creators.flatMap((c) => [
        { pubkey: c, isSigner: false, isWritable: false },
        { pubkey: ata(c), isSigner: false, isWritable: true },
      ]);
    const settleTx = (i: number) =>
      i === leafIdx
        ? transactionBuilder()
            .add(setComputeUnitLimit(caller, { units: 1_400_000 }))
            .add(
              settleCnftSaleV2(caller, {
                gumballMachine: machine,
                index: i,
                seller: sellerKey,
                authority: sellerKey,
                buyer: byIdx[i].buyer.identity.publicKey,
                feeAccount: feeBps ? feeWallet : undefined,
                feePaymentAccount: feeBps ? feeAta : undefined,
                paymentMint: mint.publicKey,
                authorityPdaPaymentAccount: treasury,
                authorityPaymentAccount: sellerAta,
                sellerPaymentAccount: sellerAta,
                currentLeafOwner: leaf.owner,
                currentLeafDelegate: leaf.owner,
                treeConfig: leaf.treeConfig,
                merkleTree: leaf.merkleTree,
                args: cnftArgs(caller, leaf),
              } as any).addRemainingAccounts([
                ...(use2022
                  ? [{ pubkey: T22, isSigner: false, isWritable: false }]
                  : []),
                ...proofAccounts(getCnftProof(caller, leaf).proof),
              ])
            )
        : transactionBuilder()
            .add(setComputeUnitLimit(caller, { units: 1_400_000 }))
            .add(
              settleCoreAssetSale(caller, {
                index: i,
                gumballMachine: machine,
                authority: sellerKey,
                seller: sellerKey,
                buyer: byIdx[i].buyer.identity.publicKey,
                asset: byIdx[i].asset,
                creators: [],
                feeAccount: feeBps ? feeWallet : undefined,
                feePaymentAccount: feeBps ? feeAta : undefined,
                paymentMint: mint.publicKey,
                authorityPdaPaymentAccount: treasury,
                authorityPaymentAccount: sellerAta,
                sellerPaymentAccount: sellerAta,
                paymentTokenProgram: tp,
              } as any).addRemainingAccounts(creatorRem(byIdx[i].creators))
            );
    const claimed = new Set<number>();
    const finalized = new Set<number>();
    const settleCount = new Array(N).fill(0);
    const failures: string[] = [];
    let steps = 0;
    let breaks = 0;
    while (finalized.size < N && steps < 80) {
      steps += 1;
      for (const k of toggleable) {
        const x = r();
        if (x < 0.25) {
          breakAta(k);
          if (saved.has(k)) breaks += 1;
        } else if (x < 0.5) fixAta(k);
      }
      const open = [...Array(N).keys()].filter((i) => !finalized.has(i));
      const i = pick(r, open);
      if (!claimed.has(i) && r() < 0.3) {
        if (i === leafIdx) {
          await claimCnftV2(byIdx[i].buyer, {
            gumballMachine: machine,
            index: i,
            seller: sellerKey,
            buyer: byIdx[i].buyer.identity.publicKey,
            treeConfig: leaf.treeConfig,
            merkleTree: leaf.merkleTree,
            args: cnftArgs(byIdx[i].buyer, leaf),
          })
            .addRemainingAccounts(
              proofAccounts(getCnftProof(byIdx[i].buyer, leaf).proof)
            )
            .sendAndConfirm(byIdx[i].buyer);
          leaf.owner = byIdx[i].buyer.identity.publicKey;
        } else
          await claimCoreAsset(byIdx[i].buyer, {
            gumballMachine: machine,
            index: i,
            seller: sellerKey,
            asset: byIdx[i].asset,
          }).sendAndConfirm(byIdx[i].buyer);
        claimed.add(i);
        continue;
      }
      try {
        await settleTx(i).sendAndConfirm(caller);
      } catch (e: any) {
        const m = String(e.message);
        failures.push(
          `settle(${i}) ${(m.match(/Error Code: \w+|insufficient[^\n]*|Custom":\d+|memo[^\n]{0,60}/) ?? [m.slice(0, 160)])[0]}`
        );
        if (failures.length > 4) break;
        continue;
      }
      if (i === leafIdx) leaf.owner = byIdx[i].buyer.identity.publicKey;
      claimed.add(i);
      settleCount[i] += 1;
      const sim = await caller.rpc.simulateTransaction(
        await settleTx(i).buildAndSign(caller)
      );
      if (
        sim.err &&
        (sim.logs ?? []).some((l: string) =>
          /ItemAlreadySettled|AccountNotInitialized/.test(l)
        )
      )
        finalized.add(i);
    }
    for (const k of [...saved.keys()]) fixAta(k as any);
    gm = await fetchGumballMachine(seller, machine);
    const cfg = {
      seed,
      use2022,
      K,
      price: price.toString(),
      primary,
      curatorFeeBps,
      feeBps,
      royaltyBps,
      breaks,
    };
    if (failures.length || finalized.size < N) {
      t.log({ cfg, failures, finalized: [...finalized], settleCount });
      t.fail('settlement did not complete');
      return;
    }
    t.is(gm.totalProceedsSettled, BigInt(N) * price);
    const ledger = getSvm().getAccount(publicKeyBytes(pda))!.data();
    const dv = new DataView(
      ledger.buffer,
      ledger.byteOffset,
      ledger.byteLength
    );
    const parked: Record<string, bigint> = {};
    let parkedTotal = 0n;
    for (let o = 0; o < ledger.length; o += 112) {
      const who = publicKey(ledger.slice(o, o + 32)).toString();
      const m = publicKey(ledger.slice(o + 32, o + 64)).toString();
      if (m !== mint.publicKey.toString()) t.fail(`entry mint ${m}`);
      const amt = dv.getBigUint64(o + 64, true);
      parked[who] = (parked[who] ?? 0n) + amt;
      parkedTotal += amt;
    }
    const mf = bps(price, feeBps);
    const cur = bps(price - mf, curatorFeeBps);
    const net = price - mf - cur;
    const R = primary ? net : bps(net, royaltyBps);
    const problems: string[] = [];
    const feeGot = tokenAmount(feeAta) + (parked[feeWallet] ?? 0n);
    if (feeBps && feeGot !== BigInt(N) * mf)
      problems.push(`fee ${feeGot} != ${BigInt(N) * mf}`);
    let creatorsTotal = 0n;
    const perCreator = new Map<string, bigint>();
    for (let i = 0; i < N; i += 1)
      byIdx[i].creators.forEach((c, j) => {
        perCreator.set(
          c,
          (perCreator.get(c) ?? 0n) +
            (BigInt(byIdx[i].shares[j]) * R) / 100n +
            BigInt(settleCount[i])
        );
      });
    for (const c of allCreators) {
      const got = tokenAmount(ata(c));
      creatorsTotal += got;
      if (got > perCreator.get(c)!)
        problems.push(`creator over ${got} > ${perCreator.get(c)}`);
      if (parked[c]) problems.push(`creator parked ${c}`);
    }
    const sellerSide = tokenAmount(sellerAta) + (parked[sellerKey] ?? 0n);
    if (sellerSide + creatorsTotal + feeGot !== BigInt(N) * price)
      problems.push(
        `total seller ${sellerSide} + creators ${creatorsTotal} + fee ${feeGot} != ${BigInt(N) * price}`
      );
    if (tokenAmount(treasury) !== parkedTotal)
      problems.push(
        `escrow tokens ${tokenAmount(treasury)} != parked ${parkedTotal}`
      );
    t.log({
      cfg,
      settleCount,
      parked: Object.fromEntries(
        Object.entries(parked).map(([k, v]) => [
          k === sellerKey ? 'seller' : k === feeWallet ? 'fee' : k,
          v.toString(),
        ])
      ),
      creatorsTotal: creatorsTotal.toString(),
      problems,
    });
    t.deepEqual(problems, []);
  });
}
