import { fetchToken } from '@metaplex-foundation/mpl-toolbox';
import test from 'ava';
import { fetchGumballMachine, findSellerHistoryPda } from '../src';
import { measureInstruction } from './_round13Token';
import { setup } from './_round14Payouts';

for (const use2022 of [false, true]) {
  for (const kind of ['curator', 'fee', 'solo', 'multiple']) {
    test(`R14-01: token folds return rent after payouts; ${kind}, token2022=${use2022}`, async (t) => {
      const f = await setup(use2022, kind);
      await f.block();
      await f.settle(0).sendAndConfirm(f.seller);
      const ledger = await f.seller.rpc.getAccount(f.escrow);
      t.is(ledger.data.length, kind === 'multiple' ? 224 : 112);
      const deposit = new DataView(
        ledger.data.buffer,
        ledger.data.byteOffset
      ).getBigUint64(104, true);
      const totalDeposit = deposit * (kind === 'multiple' ? 2n : 1n);
      const parked = new DataView(
        ledger.data.buffer,
        ledger.data.byteOffset
      ).getBigUint64(64, true);
      if (kind === 'solo') t.is(parked, 3n); // Two curator tokens + one primary-split dust token.
      await f.restore();
      const history = await f.caller.rpc.getAccount(
        findSellerHistoryPda(f.caller, {
          gumballMachine: f.machine,
          seller: f.seller.identity.publicKey,
        })[0]
      );
      const before = (
        await f.caller.rpc.getBalance(f.seller.identity.publicKey)
      ).basisPoints;
      // A third-party payer proves the invited seller receives exactly its deposit.
      await measureInstruction(
        f.caller,
        f.settle(1, f.caller),
        t,
        'settle_core_asset_sale'
      );
      t.is(
        (await f.caller.rpc.getBalance(f.seller.identity.publicKey))
          .basisPoints - before,
        totalDeposit + history.lamports.basisPoints
      ); // Closed seller history rent.
      t.is((await f.caller.rpc.getAccount(f.escrow)).data.length, 0);
      t.is((await fetchGumballMachine(f.caller, f.machine)).itemsSettled, 2n);
      t.is((await fetchToken(f.caller, f.vault)).amount, 0n);
      await f.close();
      t.false((await f.caller.rpc.getAccount(f.vault)).exists);
    });
  }
}
