export declare function deriveKey(password: string, salt: Buffer): Promise<Buffer>;
export declare function encrypt(data: string, key: Buffer): {
    iv: Buffer;
    ciphertext: Buffer;
    tag: Buffer;
};
export declare function decrypt(encrypted: {
    iv: Buffer;
    ciphertext: Buffer;
    tag: Buffer;
}, key: Buffer): string;
//# sourceMappingURL=encryption.d.ts.map