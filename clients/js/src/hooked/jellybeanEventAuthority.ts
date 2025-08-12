import { Context, Pda } from '@metaplex-foundation/umi';
import { string } from '@metaplex-foundation/umi/serializers';

export function findJellybeanEventAuthorityPda(
  context: Pick<Context, 'eddsa' | 'programs'>
): Pda {
  const programId = context.programs.get('mallowJellybean').publicKey;
  return context.eddsa.findPda(programId, [
    string({ size: 'variable' }).serialize('__event_authority'),
  ]);
}
