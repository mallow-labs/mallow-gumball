import { isFixedSize } from '@solana/kit';
import {
  UnregisteredGumballGuardError,
  VariableSizeGuardError,
} from '../errors';
import { GuardManifest } from './guardManifest';

export type AnyGuardManifest = GuardManifest<any, any, any, any>;

export interface GuardRepository {
  /** Registers one or many guards by providing their manifest. */
  add(...manifests: AnyGuardManifest[]): void;

  /** Gets the manifest of a guard using its name. */
  get<T extends AnyGuardManifest = AnyGuardManifest>(name: string): T;

  /** Gets all registered guard manifests. */
  all(): AnyGuardManifest[];

  /**
   * Gets the guard manifests for the provided ordered list of guard names.
   *
   * It fails if the manifest of any requested guard is not registered.
   * Manifests are returned in the order in which the names are provided (which
   * must match the program's on-chain guard ordering).
   */
  forProgram(availableGuards: string[]): AnyGuardManifest[];
}

export class DefaultGuardRepository implements GuardRepository {
  protected readonly manifests = new Map<string, AnyGuardManifest>();

  add(...manifests: AnyGuardManifest[]): void {
    manifests.forEach((manifest) => {
      if (!isFixedSize(manifest.codec())) {
        throw new VariableSizeGuardError(manifest.name);
      }
      this.manifests.set(manifest.name, manifest);
    });
  }

  get<T extends AnyGuardManifest = AnyGuardManifest>(name: string): T {
    const manifest = this.manifests.get(name);
    if (!manifest) {
      throw new UnregisteredGumballGuardError(name);
    }
    return manifest as T;
  }

  all(): AnyGuardManifest[] {
    return Array.from(this.manifests.values());
  }

  forProgram(availableGuards: string[]): AnyGuardManifest[] {
    return availableGuards.map((name) => this.get(name));
  }
}
