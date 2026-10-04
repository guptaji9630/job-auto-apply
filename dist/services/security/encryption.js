"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveKey = deriveKey;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
const crypto_1 = __importDefault(require("crypto"));
const argon2_1 = __importDefault(require("argon2"));
async function deriveKey(password, salt) {
    return argon2_1.default.hash(password, {
        type: argon2_1.default.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
        salt,
        raw: true,
    });
}
function encrypt(data, key) {
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    return { iv, ciphertext, tag: cipher.getAuthTag() };
}
function decrypt(encrypted, key) {
    const iv = Buffer.isBuffer(encrypted.iv) ? encrypted.iv : Buffer.from(encrypted.iv);
    const ciphertext = Buffer.isBuffer(encrypted.ciphertext)
        ? encrypted.ciphertext
        : Buffer.from(encrypted.ciphertext);
    const tag = Buffer.isBuffer(encrypted.tag) ? encrypted.tag : Buffer.from(encrypted.tag);
    const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
//# sourceMappingURL=encryption.js.map