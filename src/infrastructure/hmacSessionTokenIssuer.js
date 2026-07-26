import { createHmac, timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../domain/securityPolicy.js";

const DEFAULT_TTL_MS = 60 * 60 * 1000;
const HEADER = Object.freeze({
  alg: "HS256",
  typ: "JWT"
});

export function createHmacSessionTokenIssuer({
  secret,
  ttlMs = DEFAULT_TTL_MS,
  clock = () => new Date()
} = {}) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new TypeError("Session token secret must be at least 32 characters.");
  }

  if (!Number.isInteger(ttlMs) || ttlMs < 1000) {
    throw new TypeError("Session token ttlMs must be at least 1000.");
  }

  return Object.freeze({
    async issue({ user_id, email } = {}) {
      if (typeof user_id !== "string" || user_id.trim() === "") {
        throw new TypeError("Session user_id must be a non-empty string.");
      }

      const issuedAt = Math.floor(nowMs(clock) / 1000);
      const expiresAt = issuedAt + Math.floor(ttlMs / 1000);
      const payload = {
        sub: user_id.trim(),
        email,
        iat: issuedAt,
        exp: expiresAt
      };

      return {
        token_type: "Bearer",
        token: signJwt(payload, secret),
        expires_at: new Date(expiresAt * 1000).toISOString()
      };
    },

    async verify(token) {
      const payload = verifyJwt(token, secret);
      const expiresAtMs = payload.exp * 1000;

      if (expiresAtMs <= nowMs(clock)) {
        throw new AuthenticationError("Session has expired.", "session_expired");
      }

      return {
        user_id: payload.sub,
        email: payload.email,
        expires_at: new Date(expiresAtMs).toISOString()
      };
    }
  });
}

function signJwt(payload, secret) {
  const encodedHeader = encodeJson(HEADER);
  const encodedPayload = encodeJson(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  return `${signingInput}.${signatureFor(signingInput, secret)}`;
}

function verifyJwt(token, secret) {
  if (typeof token !== "string") {
    throw new AuthenticationError("Session token is required.", "missing_session");
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new AuthenticationError("Session token is invalid.", "invalid_session");
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = signatureFor(signingInput, secret);

  if (!safeEqual(signature, expectedSignature)) {
    throw new AuthenticationError("Session token is invalid.", "invalid_session");
  }

  const header = decodeJson(encodedHeader);
  const payload = decodeJson(encodedPayload);

  if (
    header.alg !== HEADER.alg ||
    header.typ !== HEADER.typ ||
    typeof payload.sub !== "string" ||
    payload.sub.trim() === "" ||
    !Number.isInteger(payload.exp) ||
    payload.exp < 1
  ) {
    throw new AuthenticationError("Session token is invalid.", "invalid_session");
  }

  return payload;
}

function signatureFor(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeJson(value) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new AuthenticationError("Session token is invalid.", "invalid_session");
  }
}

function nowMs(clock) {
  const value = typeof clock === "function" ? clock() : clock.now();
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Clock must return a valid date.");
  }

  return date.getTime();
}
