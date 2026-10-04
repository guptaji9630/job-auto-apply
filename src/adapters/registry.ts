import type { PlatformAdapter } from './base';
import type { PlatformType } from '../types';

class AdapterRegistry {
  private adapters: Map<PlatformType, PlatformAdapter> = new Map();

  register(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.platform, adapter);
  }

  get(platform: PlatformType): PlatformAdapter | undefined {
    return this.adapters.get(platform);
  }

  getAll(): PlatformAdapter[] {
    return Array.from(this.adapters.values());
  }

  getEnabled(enabledPlatforms: PlatformType[]): PlatformAdapter[] {
    return enabledPlatforms.map(p => this.adapters.get(p)).filter(Boolean) as PlatformAdapter[];
  }
}

export const adapterRegistry = new AdapterRegistry();