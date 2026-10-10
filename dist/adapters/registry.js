"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adapterRegistry = void 0;
class AdapterRegistry {
    adapters = new Map();
    register(adapter) {
        this.adapters.set(adapter.platform, adapter);
    }
    get(platform) {
        return this.adapters.get(platform);
    }
    getAll() {
        return Array.from(this.adapters.values());
    }
    getEnabled(enabledPlatforms) {
        return enabledPlatforms.map(p => this.adapters.get(p)).filter(Boolean);
    }
}
exports.adapterRegistry = new AdapterRegistry();
//# sourceMappingURL=registry.js.map