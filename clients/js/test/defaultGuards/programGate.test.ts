import { generateKeyPairSigner, some } from '@solana/kit';
import test from 'ava';
import { draw } from '../../src';
import {
  COMPUTE_UNITS,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
  sol,
} from '../_setup';
import {
  createClient,
  createMachineWithGuards,
  MEMO_PROGRAM_ADDRESS,
  memoInstruction,
  sendAndGetLogs,
} from './_guardsASetup';

test('it allows minting with specified program in transaction', async (t) => {
  // Given a loaded Gumball Machine with a programGate guard allowing the memo program.
  const client = await createClient();
  const { gumballMachine } = await createMachineWithGuards(client, {
    guards: { programGate: some({ additional: [MEMO_PROGRAM_ADDRESS] }) },
  });

  // When we draw with a memo instruction in the transaction.
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    memoInstruction('Instruction from the Memo program'),
    await draw({ gumballMachine, payer: buyer, buyer }),
  ]);

  // Then minting was successful.
  t.is(fetchGumballMachine(client.svm, gumballMachine).itemsRedeemed, 1n);
});

test('it allows minting even when the payer is different from the buyer', async (t) => {
  // Given a loaded Gumball Machine with a programGate guard allowing the memo program.
  const client = await createClient();
  const { gumballMachine } = await createMachineWithGuards(client, {
    guards: { programGate: some({ additional: [MEMO_PROGRAM_ADDRESS] }) },
  });

  // When we draw with a memo instruction using an explicit buyer, paid for by
  // the machine authority.
  const buyer = await generateKeyPairSigner();
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    memoInstruction('Instruction from the Memo program'),
    await draw({ gumballMachine, payer: client.payer, buyer }),
  ]);

  // Then minting was successful for that buyer.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === buyer.address).length, 1);
});

test('it forbids minting with unspecified program in transaction', async (t) => {
  // Given a loaded Gumball Machine with a programGate guard allowing no
  // additional programs.
  const client = await createClient();
  const { gumballMachine } = await createMachineWithGuards(client, {
    guards: { programGate: some({ additional: [] }) },
  });

  // When we try to draw with a memo instruction, then we expect a program error.
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await t.throwsAsync(
    sendTransaction(client.svm, buyer, [
      COMPUTE_UNITS,
      memoInstruction('Instruction from the Memo program'),
      await draw({ gumballMachine, payer: buyer, buyer }),
    ]),
    { message: /UnauthorizedProgramFound/ }
  );
});

test('it forbids gumball machine creation with more than 5 specified programs', async (t) => {
  // When we try to create a Gumball Machine with a programGate guard allowing
  // more than 5 programs, then we expect a client error.
  const client = await createClient();
  await t.throwsAsync(
    createMachineWithGuards(client, {
      guards: {
        programGate: some({ additional: Array(6).fill(MEMO_PROGRAM_ADDRESS) }),
      },
    }),
    { name: 'MaximumOfFiveAdditionalProgramsError' }
  );
});

test('it charges a bot tax when minting with unspecified program in transaction', async (t) => {
  // Given a loaded Gumball Machine with a botTax guard and a programGate guard
  // allowing no additional programs.
  const client = await createClient();
  const { gumballMachine } = await createMachineWithGuards(client, {
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      programGate: some({ additional: [] }),
    },
  });

  // When we try to draw with a memo instruction in the transaction.
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const logs = await sendAndGetLogs(client.svm, buyer, [
    COMPUTE_UNITS,
    memoInstruction('Instruction from the Memo program'),
    await draw({ gumballMachine, payer: buyer, buyer }),
  ]);

  // Then we expect a silent bot tax error and no item redeemed.
  t.regex(logs, /Botting is taxed/);
  t.regex(logs, /UnauthorizedProgramFound/);
  t.is(fetchGumballMachine(client.svm, gumballMachine).itemsRedeemed, 0n);
});
