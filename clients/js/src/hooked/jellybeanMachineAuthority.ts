import { Context, Pda, PublicKey } from '@metaplex-foundation/umi';
import { publicKey, string } from '@metaplex-foundation/umi/serializers';

export function findJellybeanMachineAuthorityPda(
  context: Pick<Context, 'eddsa' | 'programs'>,
  seeds: {
    jellybeanMachine: PublicKey;
  }
): Pda {
  const programId = context.programs.get('mallowJellybean').publicKey;
  return context.eddsa.findPda(programId, [
    string({ size: 'variable' }).serialize('jellybean_machine'),
    publicKey().serialize(seeds.jellybeanMachine),
  ]);
}
