import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import type { EmailTokenPurpose } from "@/generated/prisma/client";

const RESET_TTL_MS = 60 * 60 * 1000;
const VERIFY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function issueEmailToken(
  userId: string,
  purpose: EmailTokenPurpose,
): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  const ttl = purpose === "PASSWORD_RESET" ? RESET_TTL_MS : VERIFY_TTL_MS;

  await prisma.emailToken.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.emailToken.create({
    data: {
      userId,
      purpose,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + ttl),
    },
  });

  return raw;
}

export async function consumeEmailToken(
  raw: string,
  purpose: EmailTokenPurpose,
): Promise<{ userId: string } | null> {
  const tokenHash = hashToken(raw.trim());
  const row = await prisma.emailToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      purpose: true,
      expiresAt: true,
      usedAt: true,
    },
  });
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt < new Date()) {
    return null;
  }

  await prisma.emailToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });

  return { userId: row.userId };
}

export function appBaseUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
