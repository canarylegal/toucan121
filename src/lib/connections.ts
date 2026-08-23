import { prisma } from "@/lib/db";
import { sendAuthEmail } from "@/lib/email";
import { renderNoticeEmail } from "@/lib/email-templates";
import { APP_NAME } from "@/lib/brand";

function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function orderedUserIds(
  a: string,
  b: string,
): { low: string; high: string } {
  if (a === b) {
    throw new Error("Cannot pair a user with themselves");
  }
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

export type ConnectionPeer = {
  id: string;
  name: string;
  email: string;
  hostSlug: string | null;
};

export type ListedConnection = {
  id: string;
  status: "PENDING" | "ACCEPTED";
  requestedById: string;
  createdAt: Date;
  updatedAt: Date;
  other: ConnectionPeer;
};

function otherId(row: { userLowId: string; userHighId: string }, selfId: string) {
  return row.userLowId === selfId ? row.userHighId : row.userLowId;
}

async function peersById(
  ids: string[],
): Promise<Map<string, ConnectionPeer>> {
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: {
      id: true,
      name: true,
      email: true,
      host: { select: { slug: true } },
    },
  });
  return new Map(
    users.map((u) => [
      u.id,
      {
        id: u.id,
        name: u.name,
        email: u.email,
        hostSlug: u.host?.slug ?? null,
      },
    ]),
  );
}

function toListed(
  row: {
    id: string;
    status: "PENDING" | "ACCEPTED";
    requestedById: string;
    createdAt: Date;
    updatedAt: Date;
    userLowId: string;
    userHighId: string;
  },
  selfId: string,
  peers: Map<string, ConnectionPeer>,
): ListedConnection | null {
  const oid = otherId(row, selfId);
  const other = peers.get(oid);
  if (!other) return null;
  return {
    id: row.id,
    status: row.status,
    requestedById: row.requestedById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    other,
  };
}

export async function listConnectionsForUser(userId: string): Promise<{
  accepted: ListedConnection[];
  incoming: ListedConnection[];
  outgoing: ListedConnection[];
}> {
  const rows = await prisma.userConnection.findMany({
    where: {
      OR: [{ userLowId: userId }, { userHighId: userId }],
    },
    orderBy: { updatedAt: "desc" },
  });
  const peers = await peersById(rows.map((r) => otherId(r, userId)));

  const accepted: ListedConnection[] = [];
  const incoming: ListedConnection[] = [];
  const outgoing: ListedConnection[] = [];

  for (const row of rows) {
    const listed = toListed(row, userId, peers);
    if (!listed) continue;
    if (row.status === "ACCEPTED") {
      accepted.push(listed);
    } else if (row.requestedById === userId) {
      outgoing.push(listed);
    } else {
      incoming.push(listed);
    }
  }

  return { accepted, incoming, outgoing };
}

export async function getConnectionBetween(userAId: string, userBId: string) {
  if (userAId === userBId) return null;
  const { low, high } = orderedUserIds(userAId, userBId);
  return prisma.userConnection.findUnique({
    where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
  });
}

export async function incomingConnectionCount(userId: string): Promise<number> {
  return prisma.userConnection.count({
    where: {
      status: "PENDING",
      requestedById: { not: userId },
      OR: [{ userLowId: userId }, { userHighId: userId }],
    },
  });
}

/** Match by signed-in account id and/or booking email (case-insensitive). */
export async function isGuestConnectedToHost(opts: {
  hostUserId: string;
  guestEmail: string;
  guestUserId?: string | null;
}): Promise<boolean> {
  const guestIds = new Set<string>();
  if (opts.guestUserId) guestIds.add(opts.guestUserId);

  const email = opts.guestEmail.trim();
  if (email) {
    const byEmail = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (byEmail) guestIds.add(byEmail.id);
  }

  if (guestIds.has(opts.hostUserId)) return true;

  for (const guestUserId of guestIds) {
    const row = await getConnectionBetween(opts.hostUserId, guestUserId);
    if (row?.status === "ACCEPTED") return true;
  }
  return false;
}

async function notifyConnectionRequest(opts: {
  toEmail: string;
  toName: string;
  fromName: string;
}) {
  const url = `${appUrl()}/dash/connections`;
  const mail = renderNoticeEmail({
    subject: `${opts.fromName} wants to connect on ${APP_NAME}`,
    title: "Connection request",
    greeting: `Hi ${opts.toName},`,
    intro: `${opts.fromName} sent you a connection request on ${APP_NAME}. If you accept, meeting types that auto-confirm connections can confirm their bookings without waiting for approval.`,
    primaryCta: { label: "Review request", url },
    footerNote: "You can ignore this if you do not want to connect.",
  });
  await sendAuthEmail({
    to: opts.toEmail,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}

async function notifyConnectionAccepted(opts: {
  toEmail: string;
  toName: string;
  fromName: string;
}) {
  const url = `${appUrl()}/dash/connections`;
  const mail = renderNoticeEmail({
    subject: `${opts.fromName} accepted your connection request`,
    title: "Connected",
    greeting: `Hi ${opts.toName},`,
    intro: `${opts.fromName} accepted your connection request on ${APP_NAME}.`,
    primaryCta: { label: "View connections", url },
  });
  await sendAuthEmail({
    to: opts.toEmail,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}

export type RequestConnectionResult =
  | { ok: true; outcome: "created" | "accepted" | "already_pending" | "already_connected" }
  | { ok: false; error: string };

export async function requestConnection(opts: {
  fromUserId: string;
  toUserId: string;
}): Promise<RequestConnectionResult> {
  if (opts.fromUserId === opts.toUserId) {
    return { ok: false, error: "You can't connect with yourself" };
  }

  const from = await prisma.user.findUnique({
    where: { id: opts.fromUserId },
    select: { id: true, name: true, email: true, emailVerifiedAt: true },
  });
  const to = await prisma.user.findUnique({
    where: { id: opts.toUserId },
    select: { id: true, name: true, email: true },
  });
  if (!from || !to) {
    return { ok: false, error: "Account not found" };
  }
  if (!from.emailVerifiedAt) {
    return {
      ok: false,
      error: "Confirm your email before adding connections.",
    };
  }

  const { low, high } = orderedUserIds(from.id, to.id);
  const existing = await prisma.userConnection.findUnique({
    where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
  });

  if (existing?.status === "ACCEPTED") {
    return { ok: true, outcome: "already_connected" };
  }

  if (existing?.status === "PENDING") {
    if (existing.requestedById === from.id) {
      return { ok: true, outcome: "already_pending" };
    }
    await prisma.userConnection.update({
      where: { id: existing.id },
      data: { status: "ACCEPTED" },
    });
    await notifyConnectionAccepted({
      toEmail: to.email,
      toName: to.name,
      fromName: from.name,
    }).catch((err) => console.error("[connections] accept email", err));
    return { ok: true, outcome: "accepted" };
  }

  await prisma.userConnection.create({
    data: {
      userLowId: low,
      userHighId: high,
      requestedById: from.id,
      status: "PENDING",
    },
  });
  await notifyConnectionRequest({
    toEmail: to.email,
    toName: to.name,
    fromName: from.name,
  }).catch((err) => console.error("[connections] request email", err));
  return { ok: true, outcome: "created" };
}

/** Resolve a public profile slug or Toucan account email. Does not leak existence to callers. */
export async function findUserByConnectionLookup(
  lookup: string,
): Promise<{ id: string } | null> {
  const raw = lookup.trim();
  if (!raw) return null;

  if (raw.includes("@")) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: raw, mode: "insensitive" } },
      select: { id: true },
    });
    return user;
  }

  let slug = raw;
  try {
    if (/^https?:\/\//i.test(raw)) {
      slug = new URL(raw).pathname.replace(/^\//, "").split("/")[0] ?? "";
    } else {
      slug = raw.replace(/^\//, "").split("/")[0] ?? "";
    }
  } catch {
    slug = raw.replace(/^\//, "").split("/")[0] ?? "";
  }
  slug = slug.trim().toLowerCase();
  if (!slug) return null;

  const host = await prisma.host.findUnique({
    where: { slug },
    select: { userId: true },
  });
  return host ? { id: host.userId } : null;
}

export async function acceptConnection(opts: {
  userId: string;
  connectionId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await prisma.userConnection.findUnique({
    where: { id: opts.connectionId },
  });
  if (!row) return { ok: false, error: "Request not found" };
  if (row.userLowId !== opts.userId && row.userHighId !== opts.userId) {
    return { ok: false, error: "Request not found" };
  }
  if (row.status !== "PENDING") {
    return { ok: false, error: "This request is no longer pending" };
  }
  if (row.requestedById === opts.userId) {
    return { ok: false, error: "You can't accept your own request" };
  }

  await prisma.userConnection.update({
    where: { id: row.id },
    data: { status: "ACCEPTED" },
  });

  const [self, other] = await Promise.all([
    prisma.user.findUnique({
      where: { id: opts.userId },
      select: { name: true },
    }),
    prisma.user.findUnique({
      where: {
        id: otherId(row, opts.userId),
      },
      select: { name: true, email: true },
    }),
  ]);
  if (self && other) {
    await notifyConnectionAccepted({
      toEmail: other.email,
      toName: other.name,
      fromName: self.name,
    }).catch((err) => console.error("[connections] accept email", err));
  }
  return { ok: true };
}

export async function removeConnection(opts: {
  userId: string;
  connectionId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await prisma.userConnection.findUnique({
    where: { id: opts.connectionId },
  });
  if (!row) return { ok: false, error: "Connection not found" };
  if (row.userLowId !== opts.userId && row.userHighId !== opts.userId) {
    return { ok: false, error: "Connection not found" };
  }
  await prisma.userConnection.delete({ where: { id: row.id } });
  return { ok: true };
}
