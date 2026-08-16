import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

function keyMaterial(): Buffer {
  const raw =
    process.env.CALENDAR_SECRETS_KEY?.trim() ||
    process.env.AUTH_SECRET?.trim();
  if (!raw) {
    throw new Error(
      "CALENDAR_SECRETS_KEY or AUTH_SECRET must be set to encrypt calendar credentials",
    );
  }
  return createHash("sha256").update(raw).digest();
}

export function isEncryptedConfigJson(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

/** Encrypt a plaintext JSON string for CalendarConnection.configJson. */
export function encryptConfigJson(plainJson: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyMaterial(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plainJson, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return (
    PREFIX +
    Buffer.concat([iv, tag, ciphertext]).toString("base64url")
  );
}

/**
 * Decrypt stored configJson. Plain JSON (pre-encryption rows) is returned as-is
 * so existing connections keep working until rewritten.
 */
export function decryptConfigJson(stored: string): string {
  if (!isEncryptedConfigJson(stored)) {
    return stored;
  }

  const raw = Buffer.from(stored.slice(PREFIX.length), "base64url");
  if (raw.length < 12 + 16) {
    throw new Error("Invalid encrypted calendar config");
  }
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", keyMaterial(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

/** Serialize an object and encrypt for storage. */
export function encodeCalendarConfig(config: unknown): string {
  return encryptConfigJson(JSON.stringify(config));
}

/** Decrypt (if needed) then parse JSON. */
export function decodeCalendarConfig<T = unknown>(stored: string): T {
  return JSON.parse(decryptConfigJson(stored)) as T;
}
