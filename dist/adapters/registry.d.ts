import type { PlatformAdapter } from './base';
import type { PlatformType } from '../types';
declare class AdapterRegistry {
    private adapters;
    register(adapter: PlatformAdapter): void;
    get(platform: PlatformType): PlatformAdapter | undefined;
    getAll(): PlatformAdapter[];
    getEnabled(enabledPlatforms: PlatformType[]): PlatformAdapter[];
}
export declare const adapterRegistry: AdapterRegistry;
export {};
//# sourceMappingURL=registry.d.ts.map