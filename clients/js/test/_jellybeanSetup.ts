/* eslint-disable no-await-in-loop */
/* eslint-disable import/no-extraneous-dependencies */
import {
  addCoreItem,
  createJellybeanMachine,
  mallowJellybean,
  startSale as startJellybeanSale,
} from '@mallow-labs/mallow-jellybean-umi';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  none,
  OptionOrNullable,
  publicKey,
  PublicKey,
  transactionBuilder,
  Umi,
} from '@metaplex-foundation/umi';
import {
  createGumballGuard as baseCreateGumballGuard,
  DefaultGuardSetArgs,
  findGumballGuardPda,
  GuardSetArgs,
  wrap,
} from '../src';
import { createCoreAsset } from './_setup';

// Jellybean Machine program id (see litesvm/svm.ts + dump.sh).
export const MALLOW_JELLYBEAN_PROGRAM_ID = publicKey(
  'J3LLYcm8V5hJRzCKENRPW3yGdQ6xU8Nie8jr3mU88eqq'
);

// A umi wired with the gumball, gumball-guard AND jellybean programs. `createUmi`
// already registers the mallow programs; we layer the jellybean plugin so its
// PDAs (`mallowJellybean`) resolve for `drawJellybean`.
export const createJellybeanUmi = async (
  createUmi: () => Promise<Umi>
): Promise<Umi> => (await createUmi()).use(mallowJellybean());

// A jellybean fee account: `address` receives `basisPoints` of every sale.
export type JellybeanFeeAccount = { address: PublicKey; basisPoints: number };

/**
 * Stand up a jellybean machine wired to a gumball guard, loaded with core-asset
 * prizes and started, so it is ready for `drawJellybean`. Mirrors the gumball
 * `create` helper: initialize -> add items -> create+wrap guard -> start sale.
 *
 * `feeAccounts` are written into the machine settings; the solPayment/token
 * payment guards distribute the draw price across them. Pass `[]` to build a
 * machine with no fee destinations (used to exercise the MissingFeeAccounts
 * guard path).
 */
export const setupJellybeanMachine = async <
  DA extends GuardSetArgs = DefaultGuardSetArgs,
>(
  umi: Umi,
  input: {
    feeAccounts: JellybeanFeeAccount[];
    guards?: Partial<DA>;
    prizeCount?: number;
    printFeeConfig?: OptionOrNullable<any>;
  }
): Promise<PublicKey> => {
  const { feeAccounts, guards = {}, prizeCount = 3 } = input;
  const jellybeanMachine = generateSigner(umi);

  // Prizes are mpl-core assets held in escrow by the machine authority PDA.
  const assets = await Promise.all(
    Array.from({ length: prizeCount }, () => createCoreAsset(umi))
  );

  // Machine init (own tx: the account allocation + initialize).
  await (
    await createJellybeanMachine(umi, {
      jellybeanMachine,
      args: {
        uri: 'https://example.com/jellybean.json',
        feeAccounts,
        printFeeConfig: input.printFeeConfig ?? none(),
      },
    })
  ).sendAndConfirm(umi);

  // Load prizes (one per tx — each add is a full mpl-core transfer CPI).
  for (const asset of assets) {
    await transactionBuilder()
      .add(setComputeUnitLimit(umi, { units: 400_000 }))
      .add(
        addCoreItem(umi, {
          jellybeanMachine: jellybeanMachine.publicKey,
          asset: asset.publicKey,
        })
      )
      .sendAndConfirm(umi);
  }

  // Create the guard, hand the machine's mint authority to it (wrap), start sale.
  const gumballGuard = findGumballGuardPda(umi, {
    base: jellybeanMachine.publicKey,
  });
  await transactionBuilder()
    .add(baseCreateGumballGuard<DA>(umi, { base: jellybeanMachine, guards }))
    .add(
      wrap(umi, {
        machine: jellybeanMachine.publicKey,
        gumballGuard,
        machineProgram: MALLOW_JELLYBEAN_PROGRAM_ID,
        machineAuthority: umi.identity,
      })
    )
    .add(
      startJellybeanSale(umi, {
        jellybeanMachine: jellybeanMachine.publicKey,
      })
    )
    .sendAndConfirm(umi);

  return jellybeanMachine.publicKey;
};
