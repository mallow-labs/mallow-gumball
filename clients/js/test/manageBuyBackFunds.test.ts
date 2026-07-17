import test from 'ava';
import {
  getDefaultBuyBackConfig,
  getManageBuyBackFundsInstructionAsync,
} from '../src';
import { createMachineNoGuard } from './_lifecycleSetup';
import {
  createClient,
  fetchGumballMachine,
  sendTransaction,
  sol,
} from './_setup';

const enabledBuyBackConfig = () => ({
  ...getDefaultBuyBackConfig(),
  enabled: true,
});

test('it can deposit buy back funds', async (t) => {
  const client = await createClient();

  // Given an existing gumball machine with buy back enabled.
  const { gumballMachine } = await createMachineNoGuard(client, {
    buyBackConfig: enabledBuyBackConfig(),
  });

  // When we deposit funds.
  const depositAmount = sol(1);
  await sendTransaction(client.svm, client.payer, [
    await getManageBuyBackFundsInstructionAsync({
      gumballMachine,
      authority: client.payer,
      amount: depositAmount,
      isWithdraw: false,
    }),
  ]);

  // Then the funds are available.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.buyBackFundsAvailable, depositAmount);
});

test('it can withdraw all buy back funds', async (t) => {
  const client = await createClient();

  const { gumballMachine } = await createMachineNoGuard(client, {
    buyBackConfig: enabledBuyBackConfig(),
  });

  // Deposit funds first.
  const depositAmount = sol(1);
  await sendTransaction(client.svm, client.payer, [
    await getManageBuyBackFundsInstructionAsync({
      gumballMachine,
      authority: client.payer,
      amount: depositAmount,
      isWithdraw: false,
    }),
  ]);

  // When we withdraw all funds.
  await sendTransaction(client.svm, client.payer, [
    await getManageBuyBackFundsInstructionAsync({
      gumballMachine,
      authority: client.payer,
      amount: depositAmount,
      isWithdraw: true,
    }),
  ]);

  // Then no funds remain.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.buyBackFundsAvailable, 0n);
});

test('it can withdraw partial buy back funds', async (t) => {
  const client = await createClient();

  const { gumballMachine } = await createMachineNoGuard(client, {
    buyBackConfig: enabledBuyBackConfig(),
  });

  // Deposit funds first.
  const depositAmount = sol(2);
  await sendTransaction(client.svm, client.payer, [
    await getManageBuyBackFundsInstructionAsync({
      gumballMachine,
      authority: client.payer,
      amount: depositAmount,
      isWithdraw: false,
    }),
  ]);

  // When we withdraw partial funds.
  const withdrawAmount = sol(1);
  await sendTransaction(client.svm, client.payer, [
    await getManageBuyBackFundsInstructionAsync({
      gumballMachine,
      authority: client.payer,
      amount: withdrawAmount,
      isWithdraw: true,
    }),
  ]);

  let account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.buyBackFundsAvailable, depositAmount - withdrawAmount);

  // When we withdraw the rest.
  await sendTransaction(client.svm, client.payer, [
    await getManageBuyBackFundsInstructionAsync({
      gumballMachine,
      authority: client.payer,
      amount: withdrawAmount,
      isWithdraw: true,
    }),
  ]);

  account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.buyBackFundsAvailable, 0n);
});

test('it cannot withdraw more than the available buy back funds', async (t) => {
  const client = await createClient();

  const { gumballMachine } = await createMachineNoGuard(client, {
    buyBackConfig: enabledBuyBackConfig(),
  });

  // Deposit funds first.
  await sendTransaction(client.svm, client.payer, [
    await getManageBuyBackFundsInstructionAsync({
      gumballMachine,
      authority: client.payer,
      amount: sol(1),
      isWithdraw: false,
    }),
  ]);

  // When we try to withdraw more funds than available.
  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getManageBuyBackFundsInstructionAsync({
        gumballMachine,
        authority: client.payer,
        amount: sol(2),
        isWithdraw: true,
      }),
    ]),
    { message: /InsufficientFunds/ }
  );
});

test('it cannot deposit buy back funds when buy back setting is disabled', async (t) => {
  const client = await createClient();

  // Given an existing gumball machine with buy back explicitly disabled.
  const { gumballMachine } = await createMachineNoGuard(client, {
    buyBackConfig: { ...getDefaultBuyBackConfig(), enabled: false },
  });

  // When we try to deposit funds.
  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getManageBuyBackFundsInstructionAsync({
        gumballMachine,
        authority: client.payer,
        amount: sol(1),
        isWithdraw: false,
      }),
    ]),
    { message: /BuyBackNotEnabled/ }
  );
});
