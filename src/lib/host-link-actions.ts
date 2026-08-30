"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireHost } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import {
  hostLinkInputSchema,
  MAX_HOST_LINKS,
} from "@/lib/host-links";
import {
  parseProfileStackOrder,
  stackEntryKey,
  stringifyProfileStackOrder,
  type ProfileStackEntry,
} from "@/lib/profile-stack";

async function hostSlug(hostId: string) {
  const host = await prisma.host.findUnique({
    where: { id: hostId },
    select: { slug: true },
  });
  return host?.slug;
}

function revalidateHost(slug: string | undefined) {
  if (!slug) return;
  revalidatePath(`/${slug}`);
  revalidatePath("/dash/profile");
}

export async function addHostLinkAction(formData: FormData) {
  const host = await requireHost();
  let parsed;
  try {
    parsed = hostLinkInputSchema.parse({
      title: String(formData.get("title") ?? ""),
      url: String(formData.get("url") ?? ""),
      iconKey: String(formData.get("iconKey") ?? ""),
      emoji: String(formData.get("emoji") ?? ""),
    });
  } catch (err) {
    if (err instanceof ZodError) {
      throw new Error(err.issues[0]?.message ?? "Invalid link");
    }
    throw err;
  }

  const count = await prisma.hostLink.count({
    where: { hostId: host.id, active: true },
  });
  if (count >= MAX_HOST_LINKS) {
    throw new Error(`You can add up to ${MAX_HOST_LINKS} links`);
  }

  const link = await prisma.hostLink.create({
    data: {
      hostId: host.id,
      title: parsed.title,
      url: parsed.url,
      iconKey: parsed.iconKey,
      emoji: parsed.emoji,
    },
  });

  const stack = parseProfileStackOrder(host.profileStackOrderJson);
  stack.push({ type: "link", linkId: link.id });
  await prisma.host.update({
    where: { id: host.id },
    data: { profileStackOrderJson: stringifyProfileStackOrder(stack) },
  });

  revalidateHost(host.slug);

  return {
    id: link.id,
    title: link.title,
    url: link.url,
    iconKey: link.iconKey,
    emoji: link.emoji,
  };
}

export async function updateHostLinkAction(formData: FormData) {
  const host = await requireHost();
  const linkId = String(formData.get("linkId") ?? "");
  let parsed;
  try {
    parsed = hostLinkInputSchema.parse({
      title: String(formData.get("title") ?? ""),
      url: String(formData.get("url") ?? ""),
      iconKey: String(formData.get("iconKey") ?? ""),
      emoji: String(formData.get("emoji") ?? ""),
    });
  } catch (err) {
    if (err instanceof ZodError) {
      throw new Error(err.issues[0]?.message ?? "Invalid link");
    }
    throw err;
  }

  const existing = await prisma.hostLink.findFirst({
    where: { id: linkId, hostId: host.id },
  });
  if (!existing) throw new Error("Link not found");

  await prisma.hostLink.update({
    where: { id: linkId },
    data: {
      title: parsed.title,
      url: parsed.url,
      iconKey: parsed.iconKey,
      emoji: parsed.emoji,
    },
  });

  revalidateHost(host.slug);
}

export async function deleteHostLinkAction(formData: FormData) {
  const host = await requireHost();
  const linkId = String(formData.get("linkId") ?? "");

  const existing = await prisma.hostLink.findFirst({
    where: { id: linkId, hostId: host.id },
  });
  if (!existing) throw new Error("Link not found");

  await prisma.hostLink.delete({ where: { id: linkId } });

  const stack = parseProfileStackOrder(host.profileStackOrderJson).filter(
    (e) => !(e.type === "link" && e.linkId === linkId),
  );
  await prisma.host.update({
    where: { id: host.id },
    data: { profileStackOrderJson: stringifyProfileStackOrder(stack) },
  });

  revalidateHost(host.slug);
}

export async function saveProfileStackOrderAction(formData: FormData) {
  const host = await requireHost();
  const raw = String(formData.get("profileStackOrderJson") ?? "[]");
  const parsed = parseProfileStackOrder(raw);

  const links = await prisma.hostLink.findMany({
    where: { hostId: host.id, active: true },
    select: { id: true },
  });
  const linkIds = new Set(links.map((l) => l.id));

  const cleaned: ProfileStackEntry[] = [];
  const seen = new Set<string>();
  for (const entry of parsed) {
    const key = stackEntryKey(entry);
    if (seen.has(key)) continue;
    if (entry.type === "link" && !linkIds.has(entry.linkId)) continue;
    cleaned.push(entry);
    seen.add(key);
  }

  await prisma.host.update({
    where: { id: host.id },
    data: { profileStackOrderJson: stringifyProfileStackOrder(cleaned) },
  });

  revalidateHost(host.slug);
}
