import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const CIPHER_VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

export function createAesGcmSecretCipher({
  secretKey,
  randomBytesProvider = randomBytes
} = {}) {
  if (typeof secretKey !== "string" || secretKey.length < 32) {
    throw new TypeError("Secret cipher key must be at least 32 characters.");
  }

  const key = createHash("sha256").update(secretKey).digest();

  return Object.freeze({
    async encrypt(secret) {
      const iv = randomBytesProvider(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      const plaintext = Buffer.from(JSON.stringify(secret), "utf8");
      const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const tag = cipher.getAuthTag();

      return [
        CIPHER_VERSION,
        iv.toString("base64url"),
        tag.toString("base64url"),
        encrypted.toString("base64url")
      ].join(".");
    },

    async decrypt(encryptedSecret) {
      if (typeof encryptedSecret !== "string") {
        throw new TypeError("Encrypted secret must be a string.");
      }

      const [version, encodedIv, encodedTag, encodedEncrypted] = encryptedSecret.split(".");

      if (version !== CIPHER_VERSION || !encodedIv || !encodedTag || !encodedEncrypted) {
        throw new TypeError("Encrypted secret format is invalid.");
      }

      const decipher = createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(encodedIv, "base64url")
      );
      decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));

      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encodedEncrypted, "base64url")),
        decipher.final()
      ]);

      return JSON.parse(decrypted.toString("utf8"));
    }
  });
}
