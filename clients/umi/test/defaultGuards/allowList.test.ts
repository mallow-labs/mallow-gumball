import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  base58PublicKey,
  generateSigner,
  publicKey,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  closeAllowlistProof,
  closeGumballMachine,
  deleteGumballGuard,
  draw,
  findAllowListProofPda,
  findGumballGuardPda,
  getMerkleProof,
  getMerkleRoot,
  route,
  settleNftSale,
  TokenStandard,
} from '../../src';
import {
  assertBotTax,
  assertItemBought,
  create,
  createNft,
  createUmi,
  getTestAuthority,
  setupGlobalConfig,
} from '../_setup';

test('it allows minting from wallets of a predefined list', async (t) => {
  // Given the identity is part of an allow list.
  const umi = await createUmi();
  const allowList = [
    base58PublicKey(umi.identity),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Gumball Machine with the allow list guard.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When we verify the payer first by providing a valid merkle proof.
  await transactionBuilder()
    .add(
      route(umi, {
        machine: gumballMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(umi.identity)),
        },
      })
    )
    .sendAndConfirm(umi);

  // And then mint from the Gumball Machine using the identity.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        mintArgs: { allowList: some({ merkleRoot }) },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { gumballMachine });
});

test('it is possible to verify the proof and mint in the same transaction if there is space', async (t) => {
  // Given the identity is part of an allow list.
  const umi = await createUmi();
  const allowList = [
    publicKey(umi.identity),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Gumball Machine with the allow list guard.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When we verify the identity using a valid merkle proof
  // and mint from the Gumball Machine at the same time.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      route(umi, {
        machine: gumballMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(umi.identity)),
        },
      })
    )
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: { allowList: some({ merkleRoot }) },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { gumballMachine });
});

test('it allows minting even when the payer is different from the buyer', async (t) => {
  // Given a separate buyer that is part of an allow list.
  const umi = await createUmi();
  const buyer = generateSigner(umi);
  const allowList = [
    publicKey(buyer),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Gumball Machine with the allow list guard.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When we verify and mint from the Gumball Machine using the buyer.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      route(umi, {
        machine: gumballMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(buyer)),
          buyer: publicKey(buyer), // <-- We need to tell the route instruction who the buyer is.
        },
      })
    )
    .add(
      draw(umi, {
        gumballMachine,
        buyer,
        mintArgs: { allowList: some({ merkleRoot }) },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { gumballMachine, buyer: publicKey(buyer) });
});

test('it forbids minting from wallets that are not part of a predefined list', async (t) => {
  // Given the identity is not part of the allow list.
  const umi = await createUmi();
  const allowList = [
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Gumball Machine with the allow list guard.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When the identity tries to verify itself on the allow list.
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      route(umi, {
        machine: gumballMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(umi.identity)),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /AddressNotFoundInAllowedList/ });
});

test('it forbids minting from wallets that are providing the wrong proof', async (t) => {
  // Given the identity is part of the allow list.
  const umi = await createUmi();
  const allowList = [
    base58PublicKey(umi.identity),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Gumball Machine with the allow list guard.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When the identity tries to verify itself using the wrong proof.
  const wrongProof = getMerkleProof(
    allowList,
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB'
  );
  const promise = transactionBuilder()
    .add(
      route(umi, {
        machine: gumballMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: wrongProof,
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /AddressNotFoundInAllowedList/ });
});

test('it forbids minting if the wallet has not been verified via the route instruction first', async (t) => {
  // Given the identity is part of an allow list.
  const umi = await createUmi();
  const allowList = [
    base58PublicKey(umi.identity),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Gumball Machine with an allow list guard.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When the identity tries to mints from that Gumball Machine
  // without having been verified via the route instruction.

  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: { allowList: some({ merkleRoot }) },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /MissingAllowedListProof/ });
});

test('it charges a bot tax when trying to mint whilst not verified', async (t) => {
  // Given the identity is part of an allow list.
  const umi = await createUmi();
  const allowList = [
    base58PublicKey(umi.identity),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Gumball Machine with an allow list and a bot tax guard.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      allowList: some({ merkleRoot }),
    },
  });

  // When the identity tries to mints from that Gumball Machine
  // without having been verified via the route instruction.

  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: { allowList: some({ merkleRoot }) },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a silent bot tax error.
  await assertBotTax(t, umi, signature, /MissingAllowedListProof/);
});

test('it creates a proof for a buyer even when the buyer is not a signer', async (t) => {
  // Given a separate buyer that is part of an allow list and not a signer.
  const umi = await createUmi();
  const buyer = generateSigner(umi).publicKey;
  const allowList = [
    base58PublicKey(buyer),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Gumball Machine with the allow list guard.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When we verify the buyer on the allow list from the Gumball Machine.
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      route(umi, {
        machine: gumballMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(buyer)),
          buyer, // <-- We need to tell the route instruction who the buyer is.
        },
      })
    )
    .sendAndConfirm(umi);

  // Then a proof has been created for the buyer.
  const [gumballGuard] = findGumballGuardPda(umi, { base: gumballMachine });
  t.true(
    await umi.rpc.accountExists(
      findAllowListProofPda(umi, {
        gumballGuard,
        machine: gumballMachine,
        merkleRoot,
        user: buyer,
      })[0]
    )
  );

  // But no proof has been created for the payer.
  t.false(
    await umi.rpc.accountExists(
      findAllowListProofPda(umi, {
        gumballGuard,
        machine: gumballMachine,
        merkleRoot,
        user: publicKey(umi.payer),
      })[0]
    )
  );
});

// ---------------------------------------------------------------------------
// close_allowlist_proof tests
// ---------------------------------------------------------------------------

test('it can close an allow list proof after guard is deleted', async (t) => {
  // Given the identity is part of an allow list.
  const umi = await createUmi();
  const allowList = [
    base58PublicKey(umi.identity),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // Use 1 item so drawing it auto-transitions to SaleEnded.
  const nft = await createNft(umi);
  const { publicKey: gumballMachine } = await create(umi, {
    items: [{ id: nft.publicKey, tokenStandard: TokenStandard.NonFungible }],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // Verify and draw (last item auto-transitions to SaleEnded).
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      route(umi, {
        machine: gumballMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(umi.identity)),
        },
      })
    )
    .add(
      draw(umi, {
        gumballMachine,
        mintArgs: { allowList: some({ merkleRoot }) },
      })
    )
    .sendAndConfirm(umi);

  const gumballGuard = findGumballGuardPda(umi, { base: gumballMachine })[0];
  const allowListProofPda = findAllowListProofPda(umi, {
    merkleRoot,
    user: umi.identity.publicKey,
    machine: gumballMachine,
    gumballGuard,
  });

  // Confirm the AllowListProof PDA exists.
  t.true(await umi.rpc.accountExists(allowListProofPda[0]));

  // Settle the single drawn item so the guard can be deleted.
  const payer = await generateSignerWithSol(umi, sol(10));
  await settleNftSale(umi, {
    payer,
    index: 0,
    gumballMachine,
    buyer: umi.identity.publicKey,
    seller: umi.identity.publicKey,
    mint: nft.publicKey,
    creators: [umi.identity.publicKey],
  })
    .prepend(setComputeUnitLimit(umi, { units: 600_000 }))
    .sendAndConfirm(umi);

  // Delete the gumball guard.
  await deleteGumballGuard(umi, {
    gumballGuard,
    machine: gumballMachine,
  }).sendAndConfirm(umi);

  // Set up the GlobalConfig authority and close the allow list proof.
  const authority = getTestAuthority(umi);
  await setupGlobalConfig(umi, authority);

  await transactionBuilder()
    .add(
      closeAllowlistProof(umi, {
        authority,
        gumballGuard,
        allowListProof: allowListProofPda[0],
      })
    )
    .sendAndConfirm(umi);

  // Then the AllowListProof PDA no longer exists.
  t.false(await umi.rpc.accountExists(allowListProofPda[0]));
});

test('it fails to close an allow list proof when guard still exists', async (t) => {
  // Given the identity is part of an allow list.
  const umi = await createUmi();
  const allowList = [
    base58PublicKey(umi.identity),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Gumball Machine with the allow list guard (2 items so draw doesn't auto-end).
  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // Verify and draw.
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      route(umi, {
        machine: gumballMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(umi.identity)),
        },
      })
    )
    .add(
      draw(umi, {
        gumballMachine,
        mintArgs: { allowList: some({ merkleRoot }) },
      })
    )
    .sendAndConfirm(umi);

  const gumballGuard = findGumballGuardPda(umi, { base: gumballMachine })[0];
  const allowListProofPda = findAllowListProofPda(umi, {
    merkleRoot,
    user: umi.identity.publicKey,
    machine: gumballMachine,
    gumballGuard,
  });
  const authority = getTestAuthority(umi);
  await setupGlobalConfig(umi, authority);

  // When we try to close without deleting the guard first.
  const promise = transactionBuilder()
    .add(
      closeAllowlistProof(umi, {
        authority,
        gumballGuard,
        allowListProof: allowListProofPda[0],
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error because the guard still exists.
  await t.throwsAsync(promise, { message: /InvalidMachineState/ });
});

test('it fails to close an allow list proof when signed by a non-authority', async (t) => {
  // Given the identity is part of an allow list.
  const umi = await createUmi();
  const allowList = [
    base58PublicKey(umi.identity),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // Use 1 item so drawing it auto-transitions to SaleEnded.
  const nft = await createNft(umi);
  const { publicKey: gumballMachine } = await create(umi, {
    items: [{ id: nft.publicKey, tokenStandard: TokenStandard.NonFungible }],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // Verify and draw (last item auto-transitions to SaleEnded).
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      route(umi, {
        machine: gumballMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(umi.identity)),
        },
      })
    )
    .add(
      draw(umi, {
        gumballMachine,
        mintArgs: { allowList: some({ merkleRoot }) },
      })
    )
    .sendAndConfirm(umi);

  const gumballGuard = findGumballGuardPda(umi, { base: gumballMachine })[0];
  const allowListProofPda = findAllowListProofPda(umi, {
    merkleRoot,
    user: umi.identity.publicKey,
    machine: gumballMachine,
    gumballGuard,
  });

  // Settle the single drawn item so the guard can be deleted.
  const payer = await generateSignerWithSol(umi, sol(10));
  await settleNftSale(umi, {
    payer,
    index: 0,
    gumballMachine,
    buyer: umi.identity.publicKey,
    seller: umi.identity.publicKey,
    mint: nft.publicKey,
    creators: [umi.identity.publicKey],
  })
    .prepend(setComputeUnitLimit(umi, { units: 600_000 }))
    .sendAndConfirm(umi);

  // Delete the gumball guard.
  await deleteGumballGuard(umi, {
    gumballGuard,
    machine: gumballMachine,
  }).sendAndConfirm(umi);

  // Ensure GlobalConfig is set to the test authority.
  const authority = getTestAuthority(umi);
  await setupGlobalConfig(umi, authority);

  // When a random wallet tries to close the allow list proof.
  const randomSigner = generateSigner(umi);
  const promise = transactionBuilder()
    .add(
      closeAllowlistProof(umi, {
        authority: randomSigner,
        gumballGuard,
        allowListProof: allowListProofPda[0],
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a constraint/signature error.
  await t.throwsAsync(promise, { message: /MissingRequiredSignature/ });
});

test('it can close an allow list proof after machine is fully closed', async (t) => {
  // Given the identity is part of an allow list.
  const umi = await createUmi();
  const allowList = [
    base58PublicKey(umi.identity),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // Use 1 item so drawing it auto-transitions to SaleEnded.
  const nft = await createNft(umi);
  const { publicKey: gumballMachine } = await create(umi, {
    items: [{ id: nft.publicKey, tokenStandard: TokenStandard.NonFungible }],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // Verify and draw (last item auto-transitions to SaleEnded).
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      route(umi, {
        machine: gumballMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(umi.identity)),
        },
      })
    )
    .add(
      draw(umi, {
        gumballMachine,
        mintArgs: { allowList: some({ merkleRoot }) },
      })
    )
    .sendAndConfirm(umi);

  const gumballGuard = findGumballGuardPda(umi, { base: gumballMachine })[0];
  const allowListProofPda = findAllowListProofPda(umi, {
    merkleRoot,
    user: umi.identity.publicKey,
    machine: gumballMachine,
    gumballGuard,
  });

  // Settle the single drawn item (index 0 is always correct with 1 item).
  const payer = await generateSignerWithSol(umi, sol(10));
  await settleNftSale(umi, {
    payer,
    index: 0,
    gumballMachine,
    buyer: umi.identity.publicKey,
    seller: umi.identity.publicKey,
    mint: nft.publicKey,
    creators: [umi.identity.publicKey],
  })
    .prepend(setComputeUnitLimit(umi, { units: 600_000 }))
    .sendAndConfirm(umi);

  await transactionBuilder()
    .add(closeGumballMachine(umi, { machine: gumballMachine, gumballGuard }))
    .sendAndConfirm(umi);

  // Confirm the machine is closed.
  t.false(await umi.rpc.accountExists(gumballMachine));

  // When we close the allow list proof (machine and guard accounts are gone).
  const authority = getTestAuthority(umi);
  await setupGlobalConfig(umi, authority);

  await transactionBuilder()
    .add(
      closeAllowlistProof(umi, {
        authority,
        gumballGuard,
        allowListProof: allowListProofPda[0],
      })
    )
    .sendAndConfirm(umi);

  // Then the AllowListProof PDA no longer exists.
  t.false(await umi.rpc.accountExists(allowListProofPda[0]));
});

test('it creates a proof for the payer when the buyer is not present', async (t) => {
  // Given the payer that is part of an allow list.
  const umi = await createUmi();
  const allowList = [
    base58PublicKey(umi.payer),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Gumball Machine with the allow list guard.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When we verify the payer on the allow list from the Gumball Machine.
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      route(umi, {
        machine: gumballMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(umi.payer)),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then a proof has been created for the payer.
  const [gumballGuard] = findGumballGuardPda(umi, { base: gumballMachine });
  t.true(
    await umi.rpc.accountExists(
      findAllowListProofPda(umi, {
        gumballGuard,
        machine: gumballMachine,
        merkleRoot,
        user: publicKey(umi.payer),
      })[0]
    )
  );
});
