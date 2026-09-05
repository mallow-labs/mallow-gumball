/* eslint-disable import/no-extraneous-dependencies */
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import {
  addCoreAsset,
  addNft,
  addTokens,
  draw,
  settleNftSale,
  startSale,
  TokenStandard,
} from '../../src';
import {
  create,
  createCoreAsset,
  createMintWithHolders,
  createNft,
} from '../_setup';
import { CU_LIMIT, cuOf } from './measure';
import { createDeterministicUmi as createUmi } from './umi';

// Each scenario provisions its own machine so measurements are independent and
// the numbers are stable across runs (no shared, order-dependent state).
const scenarios: Record<string, () => Promise<number>> = {
  async addNft() {
    const umi = await createUmi();
    const nft = await createNft(umi);
    const gumballMachine = generateSigner(umi);
    await create(umi, { gumballMachine });
    const { signature } = await transactionBuilder()
      .add(
        addNft(umi, {
          gumballMachine: gumballMachine.publicKey,
          mint: nft.publicKey,
        })
      )
      .sendAndConfirm(umi);
    return cuOf(signature);
  },

  async addCoreAsset() {
    const umi = await createUmi();
    const asset = await createCoreAsset(umi);
    const gumballMachine = generateSigner(umi);
    await create(umi, { gumballMachine });
    const { signature } = await transactionBuilder()
      .add(
        addCoreAsset(umi, {
          gumballMachine: gumballMachine.publicKey,
          asset: asset.publicKey,
        })
      )
      .sendAndConfirm(umi);
    return cuOf(signature);
  },

  async addTokens() {
    const umi = await createUmi();
    const [mint] = await createMintWithHolders(umi, {
      holders: [{ owner: umi.identity.publicKey, amount: 10 }],
    });
    const gumballMachine = generateSigner(umi);
    await create(umi, { gumballMachine });
    const { signature } = await transactionBuilder()
      .add(
        addTokens(umi, {
          gumballMachine: gumballMachine.publicKey,
          mint: mint.publicKey,
          amount: 1,
          quantity: 1,
        })
      )
      .sendAndConfirm(umi);
    return cuOf(signature);
  },

  async startSale() {
    const umi = await createUmi();
    const nft = await createNft(umi);
    const gumballMachine = generateSigner(umi);
    await create(umi, {
      gumballMachine,
      items: [{ id: nft.publicKey, tokenStandard: TokenStandard.NonFungible }],
    });
    const { signature } = await transactionBuilder()
      .add(startSale(umi, { gumballMachine: gumballMachine.publicKey }))
      .sendAndConfirm(umi);
    return cuOf(signature);
  },

  async drawNoGuards() {
    const umi = await createUmi();
    const nft = await createNft(umi);
    const gumballMachine = generateSigner(umi);
    await create(umi, {
      gumballMachine,
      items: [{ id: nft.publicKey, tokenStandard: TokenStandard.NonFungible }],
      startSale: true,
      guards: {},
      groups: [],
    });
    const buyer = generateSigner(umi);
    const { signature } = await transactionBuilder()
      .add(setComputeUnitLimit(umi, { units: CU_LIMIT }))
      .add(draw(umi, { gumballMachine: gumballMachine.publicKey, buyer }))
      .sendAndConfirm(umi);
    return cuOf(signature);
  },

  async drawSolPayment() {
    const umi = await createUmi();
    const nft = await createNft(umi);
    const gumballMachine = generateSigner(umi);
    await create(umi, {
      gumballMachine,
      items: [{ id: nft.publicKey, tokenStandard: TokenStandard.NonFungible }],
      startSale: true,
      guards: { solPayment: { lamports: sol(1) } },
    });
    const buyer = await createUmi();
    const payer = await generateSignerWithSol(umi, sol(10));
    const { signature } = await transactionBuilder()
      .add(setComputeUnitLimit(umi, { units: CU_LIMIT }))
      .add(
        draw(umi, {
          gumballMachine: gumballMachine.publicKey,
          payer,
          buyer: buyer.identity,
          mintArgs: { solPayment: some(true) },
        })
      )
      .sendAndConfirm(umi);
    return cuOf(signature);
  },

  async settleNftSale() {
    const umi = await createUmi();
    const nft = await createNft(umi);
    const gumballMachine = generateSigner(umi);
    await create(umi, {
      gumballMachine,
      items: [{ id: nft.publicKey, tokenStandard: TokenStandard.NonFungible }],
      startSale: true,
      guards: { solPayment: { lamports: sol(1) } },
      disablePrimarySplit: true,
    });
    const buyer = await createUmi();
    const payer = await generateSignerWithSol(umi, sol(10));
    await transactionBuilder()
      .add(setComputeUnitLimit(umi, { units: CU_LIMIT }))
      .add(
        draw(umi, {
          gumballMachine: gumballMachine.publicKey,
          payer,
          buyer: buyer.identity,
          mintArgs: { solPayment: some(true) },
        })
      )
      .sendAndConfirm(umi);
    const { signature } = await transactionBuilder()
      .add(setComputeUnitLimit(umi, { units: CU_LIMIT }))
      .add(
        settleNftSale(umi, {
          index: 0,
          gumballMachine: gumballMachine.publicKey,
          authority: umi.identity.publicKey,
          buyer: buyer.identity.publicKey,
          seller: umi.identity.publicKey,
          mint: nft.publicKey,
          creators: [umi.identity.publicKey],
        })
      )
      .sendAndConfirm(umi);
    return cuOf(signature);
  },
};

// Runs every scenario sequentially and returns a label -> CU map.
export async function measureCu(): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  // eslint-disable-next-line no-restricted-syntax
  for (const [label, run] of Object.entries(scenarios)) {
    // eslint-disable-next-line no-await-in-loop
    results[label] = await run();
  }
  return results;
}
