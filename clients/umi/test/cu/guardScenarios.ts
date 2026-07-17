/* eslint-disable import/no-extraneous-dependencies */
import { TokenStandard as MplTokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import {
  createMintWithAssociatedToken,
  getSplMemoProgramId,
} from '@metaplex-foundation/mpl-toolbox';
import {
  base58PublicKey,
  generateSigner,
  sol,
  some,
  transactionBuilder,
  Umi,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import {
  findGumballMachineAuthorityPda,
  getMerkleProof,
  getMerkleRoot,
  route,
  TokenStandard,
} from '../../src';
import {
  create,
  createCollectionNft,
  createMintWithHolders,
  createNft,
  createVerifiedNft,
  tomorrow,
  yesterday,
} from '../_setup';
import { drawCu } from './measure';
import { createDeterministicUmi as createUmi } from './umi';

const nftItem = async (umi: Umi) => ({
  id: (await createNft(umi)).publicKey,
  tokenStandard: TokenStandard.NonFungible,
});

// Each scenario loads a fresh single-item machine guarded by exactly the guard
// under test, satisfies that guard's precondition, then measures one `draw`. The
// result is the CU cost of a successful mint gated by that guard.
const guardScenarios: Record<string, () => Promise<number>> = {
  async botTax() {
    const umi = await createUmi();
    // lastInstruction:true passes when draw is the final instruction, which it is.
    const { publicKey: gumballMachine } = await create(umi, {
      items: [await nftItem(umi)],
      startSale: true,
      guards: { botTax: some({ lamports: sol(0.01), lastInstruction: true }) },
    });
    return drawCu(umi, gumballMachine);
  },

  async solPayment() {
    const umi = await createUmi();
    const { publicKey: gumballMachine } = await create(umi, {
      items: [await nftItem(umi)],
      startSale: true,
      guards: { solPayment: some({ lamports: sol(1) }) },
    });
    const payer = await generateSignerWithSol(umi, sol(10));
    const buyer = generateSigner(umi);
    return drawCu(umi, gumballMachine, {
      payer,
      buyer,
      mintArgs: { solPayment: some(true) },
    });
  },

  async tokenPayment() {
    const umi = await createUmi();
    const gumballMachineSigner = generateSigner(umi);
    const gumballMachine = gumballMachineSigner.publicKey;
    const destination = findGumballMachineAuthorityPda(umi, {
      gumballMachine,
    })[0];
    const [tokenMint] = await createMintWithHolders(umi, {
      holders: [
        { owner: destination, amount: 100 },
        { owner: umi.identity, amount: 12 },
      ],
    });
    await create(umi, {
      gumballMachine: gumballMachineSigner,
      items: [await nftItem(umi)],
      startSale: true,
      settings: { paymentMint: tokenMint.publicKey },
      guards: { tokenPayment: some({ mint: tokenMint.publicKey, amount: 5 }) },
    });
    return drawCu(umi, gumballMachine, {
      mintArgs: { tokenPayment: some({ mint: tokenMint.publicKey }) },
    });
  },

  async token2022Payment() {
    const umi = await createUmi();
    const programsWithToken22 = umi.programs.clone();
    programsWithToken22.bind('splToken', 'splToken2022');
    const destination = generateSigner(umi).publicKey;
    const [tokenMint, destinationAta] = await createMintWithHolders(
      { ...umi, programs: programsWithToken22 },
      {
        holders: [
          { owner: destination, amount: 100 },
          { owner: umi.identity, amount: 12 },
        ],
      }
    );
    const { publicKey: gumballMachine } = await create(umi, {
      items: [await nftItem(umi)],
      startSale: true,
      settings: { paymentMint: tokenMint.publicKey },
      guards: {
        token2022Payment: some({
          mint: tokenMint.publicKey,
          destinationAta,
          amount: 5,
        }),
      },
    });
    return drawCu(umi, gumballMachine, {
      mintArgs: {
        token2022Payment: some({ mint: tokenMint.publicKey, destinationAta }),
      },
    });
  },

  async startDate() {
    const umi = await createUmi();
    const { publicKey: gumballMachine } = await create(umi, {
      items: [await nftItem(umi)],
      startSale: true,
      guards: { startDate: some({ date: yesterday() }) },
    });
    return drawCu(umi, gumballMachine);
  },

  async endDate() {
    const umi = await createUmi();
    const { publicKey: gumballMachine } = await create(umi, {
      items: [await nftItem(umi)],
      startSale: true,
      guards: { endDate: some({ date: tomorrow() }) },
    });
    return drawCu(umi, gumballMachine);
  },

  async addressGate() {
    const umi = await createUmi();
    const { publicKey: gumballMachine } = await create(umi, {
      items: [await nftItem(umi)],
      startSale: true,
      guards: { addressGate: some({ address: umi.identity.publicKey }) },
    });
    return drawCu(umi, gumballMachine);
  },

  async redeemedAmount() {
    const umi = await createUmi();
    const { publicKey: gumballMachine } = await create(umi, {
      items: [await nftItem(umi)],
      startSale: true,
      guards: { redeemedAmount: some({ maximum: 1 }) },
    });
    return drawCu(umi, gumballMachine);
  },

  async programGate() {
    const umi = await createUmi();
    const memoProgram = getSplMemoProgramId(umi);
    const { publicKey: gumballMachine } = await create(umi, {
      items: [await nftItem(umi)],
      startSale: true,
      guards: { programGate: some({ additional: [memoProgram] }) },
    });
    return drawCu(umi, gumballMachine);
  },

  async mintLimit() {
    const umi = await createUmi();
    const { publicKey: gumballMachine } = await create(umi, {
      items: [await nftItem(umi)],
      startSale: true,
      guards: { mintLimit: some({ id: 1, limit: 5 }) },
    });
    return drawCu(umi, gumballMachine, {
      mintArgs: { mintLimit: some({ id: 1 }) },
    });
  },

  async allocation() {
    const umi = await createUmi();
    const { publicKey: gumballMachine } = await create(umi, {
      items: [await nftItem(umi)],
      startSale: true,
      guards: { allocation: some({ id: 1, limit: 5 }) },
    });
    // The allocation tracker PDA must be initialized before minting.
    await transactionBuilder()
      .add(
        route(umi, {
          machine: gumballMachine,
          guard: 'allocation',
          routeArgs: { id: 1, gumballGuardAuthority: umi.identity },
        })
      )
      .sendAndConfirm(umi);
    return drawCu(umi, gumballMachine, {
      mintArgs: { allocation: some({ id: 1 }) },
    });
  },

  async thirdPartySigner() {
    const umi = await createUmi();
    const thirdPartySigner = generateSigner(umi);
    const { publicKey: gumballMachine } = await create(umi, {
      items: [await nftItem(umi)],
      startSale: true,
      guards: {
        thirdPartySigner: some({ signerKey: thirdPartySigner.publicKey }),
      },
    });
    return drawCu(umi, gumballMachine, {
      mintArgs: { thirdPartySigner: some({ signer: thirdPartySigner }) },
    });
  },

  async allowList() {
    const umi = await createUmi();
    const allowList = [
      base58PublicKey(umi.identity),
      'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
      'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
      '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
      'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
    ];
    const merkleRoot = getMerkleRoot(allowList);
    const { publicKey: gumballMachine } = await create(umi, {
      items: [await nftItem(umi)],
      startSale: true,
      guards: { allowList: some({ merkleRoot }) },
    });
    // Verify the payer against the merkle root before minting.
    await transactionBuilder()
      .add(
        route(umi, {
          machine: gumballMachine,
          guard: 'allowList',
          routeArgs: {
            path: 'proof',
            merkleRoot,
            merkleProof: getMerkleProof(
              allowList,
              base58PublicKey(umi.identity)
            ),
          },
        })
      )
      .sendAndConfirm(umi);
    return drawCu(umi, gumballMachine, {
      mintArgs: { allowList: some({ merkleRoot }) },
    });
  },

  async tokenGate() {
    const umi = await createUmi();
    const tokenMint = generateSigner(umi);
    await transactionBuilder()
      .add(
        createMintWithAssociatedToken(umi, {
          mint: tokenMint,
          owner: umi.identity.publicKey,
          amount: 1,
        })
      )
      .sendAndConfirm(umi);
    const { publicKey: gumballMachine } = await create(umi, {
      items: [await nftItem(umi)],
      startSale: true,
      guards: { tokenGate: some({ mint: tokenMint.publicKey, amount: 1 }) },
    });
    return drawCu(umi, gumballMachine, {
      mintArgs: { tokenGate: some({ mint: tokenMint.publicKey }) },
    });
  },

  async tokenBurn() {
    const umi = await createUmi();
    const tokenMint = generateSigner(umi);
    await transactionBuilder()
      .add(
        createMintWithAssociatedToken(umi, {
          mint: tokenMint,
          owner: umi.identity.publicKey,
          amount: 1,
        })
      )
      .sendAndConfirm(umi);
    const { publicKey: gumballMachine } = await create(umi, {
      items: [await nftItem(umi)],
      startSale: true,
      guards: { tokenBurn: some({ mint: tokenMint.publicKey, amount: 1 }) },
    });
    return drawCu(umi, gumballMachine, {
      mintArgs: { tokenBurn: some({ mint: tokenMint.publicKey }) },
    });
  },

  async nftGate() {
    const umi = await createUmi();
    const collectionAuthority = generateSigner(umi);
    const { publicKey: requiredCollection } = await createCollectionNft(umi, {
      authority: collectionAuthority,
    });
    const nftToVerify = await createVerifiedNft(umi, {
      tokenOwner: umi.identity.publicKey,
      collectionMint: requiredCollection,
      collectionAuthority,
    });
    const { publicKey: gumballMachine } = await create(umi, {
      items: [await nftItem(umi)],
      startSale: true,
      guards: { nftGate: some({ requiredCollection }) },
    });
    return drawCu(umi, gumballMachine, {
      mintArgs: { nftGate: some({ mint: nftToVerify.publicKey }) },
    });
  },

  async nftBurn() {
    const umi = await createUmi();
    const collectionAuthority = generateSigner(umi);
    const { publicKey: requiredCollection } = await createCollectionNft(umi, {
      authority: collectionAuthority,
    });
    const nftToBurn = await createVerifiedNft(umi, {
      tokenOwner: umi.identity.publicKey,
      collectionMint: requiredCollection,
      collectionAuthority,
    });
    const { publicKey: gumballMachine } = await create(umi, {
      items: [await nftItem(umi)],
      startSale: true,
      guards: { nftBurn: some({ requiredCollection }) },
    });
    return drawCu(umi, gumballMachine, {
      mintArgs: {
        nftBurn: some({
          tokenStandard: MplTokenStandard.NonFungible,
          requiredCollection,
          mint: nftToBurn.publicKey,
        }),
      },
    });
  },

  async nftPayment() {
    const umi = await createUmi();
    const destination = generateSigner(umi).publicKey;
    const collectionAuthority = generateSigner(umi);
    const { publicKey: requiredCollection } = await createCollectionNft(umi, {
      authority: collectionAuthority,
    });
    const { publicKey: gumballMachine } = await create(umi, {
      items: [await nftItem(umi)],
      startSale: true,
      guards: { nftPayment: some({ requiredCollection, destination }) },
    });
    const nftToSend = await createVerifiedNft(umi, {
      tokenOwner: umi.identity.publicKey,
      collectionMint: requiredCollection,
      collectionAuthority,
    });
    return drawCu(umi, gumballMachine, {
      mintArgs: {
        nftPayment: some({
          tokenStandard: MplTokenStandard.NonFungible,
          requiredCollection,
          mint: nftToSend.publicKey,
          destination,
        }),
      },
    });
  },
};

// Runs every guard scenario sequentially and returns a `draw:<guard>` -> CU map.
export async function measureGuardCu(): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  // eslint-disable-next-line no-restricted-syntax
  for (const [label, run] of Object.entries(guardScenarios)) {
    // eslint-disable-next-line no-await-in-loop
    results[`draw:${label}`] = await run();
  }
  return results;
}
