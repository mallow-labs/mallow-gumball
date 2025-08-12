import { Context, Pda, PublicKey } from '@metaplex-foundation/umi';
import { publicKey, string } from '@metaplex-foundation/umi/serializers';

export function findJellybeanUnclaimedPrizesPda(
  context: Pick<Context, 'eddsa' | 'programs'>,
  seeds: {
    jellybeanMachine: PublicKey;
    buyer: PublicKey;
  }
): Pda {
  const programId = context.programs.get('mallowJellybean').publicKey;
  return context.eddsa.findPda(programId, [
    string({ size: 'variable' }).serialize('unclaimed_prizes'),
    publicKey().serialize(seeds.jellybeanMachine),
    publicKey().serialize(seeds.buyer),
  ]);
}
