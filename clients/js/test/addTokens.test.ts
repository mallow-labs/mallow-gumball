import {
  fetchToken,
  findAssociatedTokenPda,
  setComputeUnitLimit,
  TokenState,
} from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  none,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  addNft,
  addTokens,
  fetchGumballMachine,
  fetchSellerHistory,
  findGumballMachineAuthorityPda,
  findSellerHistoryPda,
  getMerkleProof,
  getMerkleRoot,
  GumballMachine,
  SellerHistory,
  TokenStandard,
} from '../src';
import { create, createMintWithHolders, createNft, createUmi } from './_setup';

test('it can add tokens to a gumball machine as the authority', async (t) => {
  // Given a Gumball Machine with 5 nfts.
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 5 } });

  const [tokenMint] = await createMintWithHolders(umi, {
    holders: [{ owner: umi.identity, amount: 100 }],
  });

  // When we add an nft to the Gumball Machine.
  await transactionBuilder()
    .add(
      addTokens(umi, {
        gumballMachine: gumballMachine.publicKey,
        mint: tokenMint.publicKey,
        amount: 100,
        quantity: 1,
      })
    )
    .sendAndConfirm(umi);

  // Then the Gumball Machine has been updated properly.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );

  t.like(gumballMachineAccount, <Pick<GumballMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 1,
    items: [
      {
        index: 0,
        isDrawn: false,
        isClaimed: false,
        isSettled: false,
        mint: tokenMint.publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.Fungible,
        amount: 100,
      },
    ],
  });

  // Then seller's token account is empty
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: tokenMint.publicKey,
      owner: umi.identity.publicKey,
    })[0]
  );
  t.like(tokenAccount, {
    state: TokenState.Initialized,
    owner: umi.identity.publicKey,
    delegate: none(),
    amount: 0n,
  });

  // Then authority pda's token account is filled
  const authorityPda = findGumballMachineAuthorityPda(umi, {
    gumballMachine: gumballMachine.publicKey,
  })[0];
  const authorityTokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: tokenMint.publicKey,
      owner: authorityPda,
    })[0]
  );
  t.like(authorityTokenAccount, {
    state: TokenState.Initialized,
    owner: authorityPda,
    delegate: none(),
    amount: 100n,
  });

  // Seller history state is correct
  const sellerHistoryAccount = await fetchSellerHistory(
    umi,
    findSellerHistoryPda(umi, {
      gumballMachine: gumballMachine.publicKey,
      seller: umi.identity.publicKey,
    })[0]
  );

  t.like(sellerHistoryAccount, <SellerHistory>{
    gumballMachine: gumballMachine.publicKey,
    seller: umi.identity.publicKey,
    itemCount: 1n,
  });
});

test('it can add multiple tokens items to a gumball machine as the authority', async (t) => {
  const quantity = 1000;
  // Given a Gumball Machine with 5 nfts.
  const umi = await createUmi();
  const gumballMachine = await create(umi, {
    settings: { itemCapacity: quantity },
  });

  const [tokenMint] = await createMintWithHolders(umi, {
    holders: [{ owner: umi.identity, amount: quantity }],
  });

  // When we add an nft to the Gumball Machine.
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 1_400_000 }))
    .add(
      addTokens(umi, {
        gumballMachine: gumballMachine.publicKey,
        mint: tokenMint.publicKey,
        amount: 1,
        quantity,
      })
    )
    .sendAndConfirm(umi);

  // Then the Gumball Machine has been updated properly.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );

  const item = {
    isDrawn: false,
    isClaimed: false,
    isSettled: false,
    mint: tokenMint.publicKey,
    seller: umi.identity.publicKey,
    buyer: undefined,
    tokenStandard: TokenStandard.Fungible,
    amount: 1,
  };

  const items = Array.from({ length: quantity }, (_, i) => ({
    ...item,
    index: i,
  }));

  t.like(gumballMachineAccount, <Pick<GumballMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: quantity,
    items,
  });

  // Then seller's token account is empty
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: tokenMint.publicKey,
      owner: umi.identity.publicKey,
    })[0]
  );
  t.like(tokenAccount, {
    state: TokenState.Initialized,
    owner: umi.identity.publicKey,
    delegate: none(),
    amount: 0n,
  });

  // Then authority pda's token account is filled
  const authorityPda = findGumballMachineAuthorityPda(umi, {
    gumballMachine: gumballMachine.publicKey,
  })[0];
  const authorityTokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: tokenMint.publicKey,
      owner: authorityPda,
    })[0]
  );
  t.like(authorityTokenAccount, {
    state: TokenState.Initialized,
    owner: authorityPda,
    delegate: none(),
    amount: BigInt(quantity),
  });

  // Seller history state is correct
  const sellerHistoryAccount = await fetchSellerHistory(
    umi,
    findSellerHistoryPda(umi, {
      gumballMachine: gumballMachine.publicKey,
      seller: umi.identity.publicKey,
    })[0]
  );

  t.like(sellerHistoryAccount, <SellerHistory>{
    gumballMachine: gumballMachine.publicKey,
    seller: umi.identity.publicKey,
    itemCount: BigInt(quantity),
  });
});

test('it can add tokens to a gumball machine as allowlisted seller', async (t) => {
  // Given a Gumball Machine with 5 nfts.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const sellersMerkleRoot = getMerkleRoot([otherSellerUmi.identity.publicKey]);
  const gumballMachine = await create(umi, {
    settings: { itemCapacity: 5, sellersMerkleRoot },
  });

  const [tokenMint] = await createMintWithHolders(otherSellerUmi, {
    holders: [{ owner: otherSellerUmi.identity, amount: 100 }],
  });

  // When we add tokens to the Gumball Machine.
  await transactionBuilder()
    .add(
      addTokens(otherSellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        mint: tokenMint.publicKey,
        amount: 100,
        quantity: 1,
        sellerProofPath: getMerkleProof(
          [otherSellerUmi.identity.publicKey],
          otherSellerUmi.identity.publicKey
        ),
      })
    )
    .sendAndConfirm(otherSellerUmi);

  // Then the Gumball Machine has been updated properly.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );

  t.like(gumballMachineAccount, <Pick<GumballMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 1,
    items: [
      {
        index: 0,
        isDrawn: false,
        isClaimed: false,
        isSettled: false,
        mint: tokenMint.publicKey,
        seller: otherSellerUmi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.Fungible,
        amount: 100,
      },
    ],
  });

  // Then seller's token account is empty
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: tokenMint.publicKey,
      owner: otherSellerUmi.identity.publicKey,
    })[0]
  );
  t.like(tokenAccount, {
    state: TokenState.Initialized,
    owner: otherSellerUmi.identity.publicKey,
    delegate: none(),
    amount: 0n,
  });

  // Then authority pda's token account is filled
  const authorityPda = findGumballMachineAuthorityPda(umi, {
    gumballMachine: gumballMachine.publicKey,
  })[0];
  const authorityTokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: tokenMint.publicKey,
      owner: authorityPda,
    })[0]
  );
  t.like(authorityTokenAccount, {
    state: TokenState.Initialized,
    owner: authorityPda,
    delegate: none(),
    amount: 100n,
  });

  // Seller history state is correct
  const sellerHistoryAccount = await fetchSellerHistory(
    umi,
    findSellerHistoryPda(umi, {
      gumballMachine: gumballMachine.publicKey,
      seller: otherSellerUmi.identity.publicKey,
    })[0]
  );

  t.like(sellerHistoryAccount, <SellerHistory>{
    gumballMachine: gumballMachine.publicKey,
    seller: otherSellerUmi.identity.publicKey,
    itemCount: 1n,
  });
});

test('it can add tokens to a gumball machine as allowlisted seller on allowlist of 10K addresses', async (t) => {
  // Given a Gumball Machine with 5 nfts.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const addresses = Array.from(
    { length: 10_000 },
    (_, i) => generateSigner(umi).publicKey
  );
  addresses.push(otherSellerUmi.identity.publicKey);
  const sellersMerkleRoot = getMerkleRoot(addresses);
  const gumballMachine = await create(umi, {
    settings: { itemCapacity: 5, sellersMerkleRoot },
  });

  const [tokenMint] = await createMintWithHolders(otherSellerUmi, {
    holders: [{ owner: otherSellerUmi.identity, amount: 100 }],
  });

  // When we add tokens to the Gumball Machine.
  await transactionBuilder()
    .add(
      addTokens(otherSellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        mint: tokenMint.publicKey,
        amount: 100,
        quantity: 1,
        sellerProofPath: getMerkleProof(
          addresses,
          otherSellerUmi.identity.publicKey
        ),
      })
    )
    .sendAndConfirm(otherSellerUmi);

  // Then the Gumball Machine has been updated properly.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );

  t.like(gumballMachineAccount, <Pick<GumballMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 1,
    items: [
      {
        index: 0,
        isDrawn: false,
        isClaimed: false,
        isSettled: false,
        mint: tokenMint.publicKey,
        seller: otherSellerUmi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.Fungible,
        amount: 100,
      },
    ],
  });

  // Then seller's token account is empty
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: tokenMint.publicKey,
      owner: otherSellerUmi.identity.publicKey,
    })[0]
  );
  t.like(tokenAccount, {
    state: TokenState.Initialized,
    owner: otherSellerUmi.identity.publicKey,
    delegate: none(),
    amount: 0n,
  });

  // Then authority pda's token account is filled
  const authorityPda = findGumballMachineAuthorityPda(umi, {
    gumballMachine: gumballMachine.publicKey,
  })[0];
  const authorityTokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: tokenMint.publicKey,
      owner: authorityPda,
    })[0]
  );
  t.like(authorityTokenAccount, {
    state: TokenState.Initialized,
    owner: authorityPda,
    delegate: none(),
    amount: 100n,
  });

  // Seller history state is correct
  const sellerHistoryAccount = await fetchSellerHistory(
    umi,
    findSellerHistoryPda(umi, {
      gumballMachine: gumballMachine.publicKey,
      seller: otherSellerUmi.identity.publicKey,
    })[0]
  );

  t.like(sellerHistoryAccount, <SellerHistory>{
    gumballMachine: gumballMachine.publicKey,
    seller: otherSellerUmi.identity.publicKey,
    itemCount: 1n,
  });
});

test('it cannot add tokens as non gumball authority when there is no seller allowlist set', async (t) => {
  // Given a Gumball Machine with 5 nfts.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 5 } });

  const [tokenMint] = await createMintWithHolders(otherSellerUmi, {
    holders: [{ owner: otherSellerUmi.identity, amount: 100 }],
  });

  // When we add tokens to the Gumball Machine.
  const promise = transactionBuilder()
    .add(
      addTokens(otherSellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        mint: tokenMint.publicKey,
        amount: 100,
        quantity: 1,
      })
    )
    .sendAndConfirm(otherSellerUmi);

  await t.throwsAsync(promise, { message: /InvalidProofPath/ });
});

test('it cannot add tokens as non-allowlisted seller when there is a seller allowlist set', async (t) => {
  // Given a Gumball Machine with 5 nfts.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const gumballMachine = await create(umi, {
    settings: {
      itemCapacity: 5,
      sellersMerkleRoot: getMerkleRoot([umi.identity.publicKey]),
    },
  });

  const [tokenMint] = await createMintWithHolders(otherSellerUmi, {
    holders: [{ owner: otherSellerUmi.identity, amount: 100 }],
  });

  // When we add tokens to the Gumball Machine.
  const promise = transactionBuilder()
    .add(
      addTokens(otherSellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        mint: tokenMint.publicKey,
        amount: 100,
        quantity: 1,
      })
    )
    .sendAndConfirm(otherSellerUmi);

  await t.throwsAsync(promise, { message: /InvalidProofPath/ });
});

test('it can append additional tokens to a gumball machine', async (t) => {
  // Given a Gumball Machine with capacity for 2 tokens
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 2 } });

  const [tokenMint] = await createMintWithHolders(umi, {
    holders: [{ owner: umi.identity, amount: 200 }],
  });

  // When we add tokens to the Gumball Machine in two steps
  await transactionBuilder()
    .add(
      addTokens(umi, {
        gumballMachine: gumballMachine.publicKey,
        mint: tokenMint.publicKey,
        amount: 100,
        quantity: 1,
      })
    )
    .sendAndConfirm(umi);

  await transactionBuilder()
    .add(
      addTokens(umi, {
        gumballMachine: gumballMachine.publicKey,
        mint: tokenMint.publicKey,
        amount: 100,
        quantity: 1,
      })
    )
    .sendAndConfirm(umi);

  // Then the Gumball Machine has been updated properly
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );

  t.like(gumballMachineAccount, <Pick<GumballMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 2,
    items: [
      {
        index: 0,
        isDrawn: false,
        isClaimed: false,
        isSettled: false,
        mint: tokenMint.publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.Fungible,
        amount: 100,
      },
      {
        index: 1,
        isDrawn: false,
        isClaimed: false,
        isSettled: false,
        mint: tokenMint.publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.Fungible,
        amount: 100,
      },
    ],
  });

  // Then seller's token account is empty
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: tokenMint.publicKey,
      owner: umi.identity.publicKey,
    })[0]
  );
  t.like(tokenAccount, {
    state: TokenState.Initialized,
    owner: umi.identity.publicKey,
    delegate: none(),
    amount: 0n,
  });

  // Then authority pda's token account is filled
  const authorityPda = findGumballMachineAuthorityPda(umi, {
    gumballMachine: gumballMachine.publicKey,
  })[0];
  const authorityTokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: tokenMint.publicKey,
      owner: authorityPda,
    })[0]
  );
  t.like(authorityTokenAccount, {
    state: TokenState.Initialized,
    owner: authorityPda,
    delegate: none(),
    amount: 200n,
  });

  // Seller history state is correct
  const sellerHistoryAccount = await fetchSellerHistory(
    umi,
    findSellerHistoryPda(umi, {
      gumballMachine: gumballMachine.publicKey,
      seller: umi.identity.publicKey,
    })[0]
  );

  t.like(sellerHistoryAccount, <SellerHistory>{
    gumballMachine: gumballMachine.publicKey,
    seller: umi.identity.publicKey,
    itemCount: 2n,
  });
});

test('it cannot add tokens that would make the gumball machine exceed the maximum capacity', async (t) => {
  // Given an existing Gumball Machine with a capacity of 1 item.
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 1 } });

  const [tokenMint] = await createMintWithHolders(umi, {
    holders: [{ owner: umi.identity, amount: 200 }],
  });

  // When we try to add 2 token entries to the Gumball Machine.
  const promise = transactionBuilder()
    .add(
      addTokens(umi, {
        gumballMachine: gumballMachine.publicKey,
        mint: tokenMint.publicKey,
        amount: 100,
        quantity: 2,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error to be thrown.
  await t.throwsAsync(promise, {
    message: /IndexGreaterThanLength/,
  });

  // Then seller's token account should remain unchanged
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: tokenMint.publicKey,
      owner: umi.identity.publicKey,
    })[0]
  );
  t.like(tokenAccount, {
    state: TokenState.Initialized,
    owner: umi.identity.publicKey,
    delegate: none(),
    amount: 200n,
  });
});

test('it cannot add tokens once the gumball machine is fully loaded', async (t) => {
  // Given a Gumball Machine with capacity for 1 token
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 1 } });

  const [tokenMint] = await createMintWithHolders(umi, {
    holders: [{ owner: umi.identity, amount: 200 }],
  });

  // When we add the first token to fill the machine
  await transactionBuilder()
    .add(
      addTokens(umi, {
        gumballMachine: gumballMachine.publicKey,
        mint: tokenMint.publicKey,
        amount: 100,
        quantity: 1,
      })
    )
    .sendAndConfirm(umi);

  // Then when we try to add another token, it should fail
  const promise = transactionBuilder()
    .add(
      addTokens(umi, {
        gumballMachine: gumballMachine.publicKey,
        mint: tokenMint.publicKey,
        amount: 100,
        quantity: 1,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error to be thrown
  await t.throwsAsync(promise, {
    message: /IndexGreaterThanLength/,
  });

  // Then the Gumball Machine state should remain unchanged
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );

  t.like(gumballMachineAccount, <Pick<GumballMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 1,
    items: [
      {
        index: 0,
        isDrawn: false,
        isClaimed: false,
        isSettled: false,
        mint: tokenMint.publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.Fungible,
        amount: 100,
      },
    ],
  });
});

test('it cannot add more tokens than allowed per seller', async (t) => {
  // Given a Gumball Machine with 5 nfts.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const sellersMerkleRoot = getMerkleRoot([otherSellerUmi.identity.publicKey]);
  const gumballMachine = await create(umi, {
    settings: { itemCapacity: 2, itemsPerSeller: 1, sellersMerkleRoot },
  });
  const nfts = await Promise.all([
    createNft(otherSellerUmi),
    createNft(otherSellerUmi),
  ]);

  // When we add an nft to the Gumball Machine.
  await transactionBuilder()
    .add(
      addNft(otherSellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nfts[0].publicKey,
        sellerProofPath: getMerkleProof(
          [otherSellerUmi.identity.publicKey],
          otherSellerUmi.identity.publicKey
        ),
      })
    )
    .sendAndConfirm(otherSellerUmi);

  const promise = transactionBuilder()
    .add(
      addNft(otherSellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nfts[1].publicKey,
        sellerProofPath: getMerkleProof(
          [otherSellerUmi.identity.publicKey],
          otherSellerUmi.identity.publicKey
        ),
      })
    )
    .sendAndConfirm(otherSellerUmi);

  await t.throwsAsync(promise, { message: /SellerTooManyItems/ });
});
