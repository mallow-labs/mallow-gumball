import {
  createAccount,
  fetchToken,
  mintTokensTo,
  transferTokens,
} from '@metaplex-foundation/mpl-toolbox';
import test from 'ava';
import { MALLOW_GUMBALL_PROGRAM_ID, withdrawPayout } from '../src';
import { disableRentPayer, measureInstruction } from './_round13Token';
import { setup } from './_round14Payouts';

for (const use2022 of [false, true]) {
  for (const obstruction of ['donation', 'empty', 'wrong discriminator']) {
    test(`R15-01: final withdrawal releases obstructed vault; ${obstruction}; token2022=${use2022}`, async (t) => {
      const f = await setup(use2022);
      await f.block();
      await f.settle(0, f.caller).sendAndConfirm(f.caller);
      await f.settle(1, f.caller).sendAndConfirm(f.caller);
      await f.restore();
      await f.close();
      if (obstruction === 'donation') {
        // An ordinary holder can send one unsolicited base unit after close.
        await mintTokensTo(f.tokenUmi, {
          mint: f.mint.publicKey,
          token: f.authorityAta,
          amount: 1,
        }).sendAndConfirm(f.tokenUmi);
        await transferTokens(f.tokenUmi, {
          source: f.authorityAta,
          destination: f.vault,
          amount: 1,
        }).sendAndConfirm(f.tokenUmi);
      } else {
        const space = obstruction === 'empty' ? 0 : 8;
        await createAccount(f.authority, {
          newAccount: f.machineSigner,
          lamports: await f.authority.rpc.getRent(space),
          space,
          programId: MALLOW_GUMBALL_PROGRAM_ID,
        }).sendAndConfirm(f.authority);
        const machine = await f.buyer.rpc.getAccount(f.machine);
        t.is(machine.owner, MALLOW_GUMBALL_PROGRAM_ID);
        t.is(machine.data.length, space);
      }
      const vaultRent = (await f.buyer.rpc.getAccount(f.vault)).lamports
        .basisPoints;
      const recipientBefore = (
        await f.buyer.rpc.getBalance(f.authority.identity.publicKey)
      ).basisPoints;
      const rentPayerBefore = (
        await f.buyer.rpc.getBalance(f.caller.identity.publicKey)
      ).basisPoints;
      const withdraw = (amount: number) =>
        withdrawPayout(f.buyer, {
          gumballMachine: f.machine,
          recipient: f.authority.identity,
          rentPayer: f.caller.identity.publicKey,
          paymentMint: f.mint.publicKey,
          authorityPdaPaymentAccount: f.vault,
          recipientPaymentAccount: f.authorityAta,
          tokenProgram: f.tokenProgram,
          amount,
        });
      if (obstruction === 'donation') {
        await withdraw(100).sendAndConfirm(f.buyer);
        t.is((await fetchToken(f.buyer, f.authorityAta)).amount, 100n);
        t.is((await fetchToken(f.buyer, f.vault)).amount, 901n);
        t.is((await f.buyer.rpc.getAccount(f.escrow)).data.length, 112);
      }
      await measureInstruction(
        f.buyer,
        withdraw(obstruction === 'donation' ? 900 : 1000),
        t,
        'withdraw_payout'
      );
      t.is(
        (await fetchToken(f.buyer, f.authorityAta)).amount,
        obstruction === 'donation' ? 1001n : 1000n
      );
      t.is(
        (await f.buyer.rpc.getBalance(f.authority.identity.publicKey))
          .basisPoints - recipientBefore,
        vaultRent
      );
      t.is(
        (await f.buyer.rpc.getBalance(f.caller.identity.publicKey))
          .basisPoints - rentPayerBefore,
        779520n
      );
      t.is((await f.buyer.rpc.getAccount(f.escrow)).data.length, 0);
      t.false((await f.buyer.rpc.getAccount(f.vault)).exists);
    });
  }
  test(`R14-03: zero-debt entries cannot retain token vaults; token2022=${use2022}`, async (t) => {
    const f = await setup(use2022);
    await f.block();
    await f.settle(0, f.caller).sendAndConfirm(f.caller);
    await f.restore();
    // The original deposit payer is absent from the second settle.
    await f.settle(1).sendAndConfirm(f.seller);
    t.is((await f.seller.rpc.getAccount(f.escrow)).data.length, 112);
    t.is((await fetchToken(f.seller, f.vault)).amount, 0n);
    await disableRentPayer(f.buyer, f.caller.identity, 'assign');
    await f.close();
    t.false((await f.buyer.rpc.getAccount(f.vault)).exists);
    t.is((await f.buyer.rpc.getAccount(f.escrow)).data.length, 112);
  });
  test(`R14-03: close sweeps only surplus and final withdrawal closes vault; token2022=${use2022}`, async (t) => {
    const f = await setup(use2022);
    await f.block();
    await f.settle(0, f.caller).sendAndConfirm(f.caller);
    await f.settle(1, f.caller).sendAndConfirm(f.caller);
    await f.restore();
    await mintTokensTo(f.tokenUmi, {
      mint: f.mint.publicKey,
      token: f.vault,
      amount: 37,
    }).sendAndConfirm(f.tokenUmi);
    await f.close();
    t.is((await fetchToken(f.buyer, f.vault)).amount, 1000n);
    t.is((await fetchToken(f.buyer, f.authorityAta)).amount, 37n);
    const withdraw = (amount: number) =>
      withdrawPayout(f.buyer, {
        gumballMachine: f.machine,
        recipient: f.authority.identity,
        rentPayer: f.caller.identity.publicKey,
        paymentMint: f.mint.publicKey,
        authorityPdaPaymentAccount: f.vault,
        recipientPaymentAccount: f.authorityAta,
        tokenProgram: f.tokenProgram,
        amount,
      });
    await withdraw(100).sendAndConfirm(f.buyer);
    t.is((await fetchToken(f.buyer, f.vault)).amount, 900n);
    const vaultRent = (await f.buyer.rpc.getAccount(f.vault)).lamports
      .basisPoints;
    const recipientBefore = (
      await f.buyer.rpc.getBalance(f.authority.identity.publicKey)
    ).basisPoints;
    const rentPayerBefore = (
      await f.buyer.rpc.getBalance(f.caller.identity.publicKey)
    ).basisPoints;
    await measureInstruction(f.buyer, withdraw(900), t, 'withdraw_payout');
    t.is(
      (await f.buyer.rpc.getBalance(f.authority.identity.publicKey))
        .basisPoints - recipientBefore,
      vaultRent
    );
    t.is(
      (await f.buyer.rpc.getBalance(f.caller.identity.publicKey)).basisPoints -
        rentPayerBefore,
      779520n
    );
    t.is((await fetchToken(f.buyer, f.authorityAta)).amount, 1037n);
    t.is((await f.buyer.rpc.getAccount(f.escrow)).data.length, 0);
    t.false((await f.buyer.rpc.getAccount(f.vault)).exists);
  });
}
