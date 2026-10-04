export interface PlatformCredentials {
    email: string;
    password: string;
    totpSecret?: string;
}
export declare class CredentialVault {
    private vaultPath;
    private key;
    private data;
    constructor(vaultPath?: string);
    unlock(masterPassword: string): Promise<void>;
    load(): Promise<void>;
    save(): Promise<void>;
    get(platform: string): PlatformCredentials | undefined;
    set(platform: string, creds: PlatformCredentials): Promise<void>;
    rotateKey(newPassword: string): Promise<void>;
}
//# sourceMappingURL=credential-vault.d.ts.map