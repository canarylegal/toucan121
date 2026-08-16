import { createHmac, randomUUID, timingSafeEqual } from "crypto";

function secret(): string {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Short-lived signed OAuth state (hostId + nonce + expiry). */
export function createOAuthState(hostId: string, ttlMs = 15 * 60 * 1000): string {
  const body = Buffer.from(
    JSON.stringify({
      hostId,
      nonce: randomUUID(),
      exp: Date.now() + ttlMs,
    }),
    "utf8",
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyOAuthState(
  state: string,
): { hostId: string } | { error: string } {
  const [body, sig] = state.split(".");
  if (!body || !sig) return { error: "Invalid OAuth state" };

  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { error: "Invalid OAuth state signature" };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as { hostId?: string; exp?: number };
    if (!parsed.hostId || typeof parsed.exp !== "number") {
      return { error: "Invalid OAuth state payload" };
    }
    if (Date.now() > parsed.exp) return { error: "OAuth state expired — try again" };
    return { hostId: parsed.hostId };
  } catch {
    return { error: "Invalid OAuth state payload" };
  }
}
