import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);
const DEFAULT_DIGEST = "sha256";
const DEFAULT_ITERATIONS = 210_000;
const DEFAULT_KEY_LENGTH = 32;
const DEFAULT_SALT_LENGTH = 16;
const HASH_PREFIX = "pbkdf2";

export function createNodeCryptoPasswordHasher({
  digest = DEFAULT_DIGEST,
  iterations = DEFAULT_ITERATIONS,
  keyLength = DEFAULT_KEY_LENGTH,
  saltLength = DEFAULT_SALT_LENGTH,
  randomBytesProvider = randomBytes
} = {}) {
  return Object.freeze({
    async hash(password) {
      assertPassword(password);

      const salt = randomBytesProvider(saltLength);
      const derivedKey = await pbkdf2Async(password, salt, iterations, keyLength, digest);

      return [
        HASH_PREFIX,
        digest,
        String(iterations),
        salt.toString("base64url"),
        derivedKey.toString("base64url")
      ].join(":");
    },

    async verify(password, encodedHash) {
      if (typeof password !== "string" || typeof encodedHash !== "string") {
        return false;
      }

      const parsed = parseHash(encodedHash);

      if (!parsed) {
        return false;
      }

      const derivedKey = await pbkdf2Async(
        password,
        parsed.salt,
        parsed.iterations,
        parsed.hash.length,
        parsed.digest
      );

      return (
        derivedKey.length === parsed.hash.length &&
        timingSafeEqual(derivedKey, parsed.hash)
      );
    }
  });
}

function assertPassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    throw new TypeError("Password must be a non-empty string.");
  }
}

function parseHash(encodedHash) {
  const [prefix, digest, iterations, salt, hash] = encodedHash.split(":");

  if (prefix !== HASH_PREFIX || !digest || !iterations || !salt || !hash) {
    return null;
  }

  const parsedIterations = Number(iterations);

  if (!Number.isInteger(parsedIterations) || parsedIterations < 1) {
    return null;
  }

  return {
    digest,
    iterations: parsedIterations,
    salt: Buffer.from(salt, "base64url"),
    hash: Buffer.from(hash, "base64url")
  };
}
