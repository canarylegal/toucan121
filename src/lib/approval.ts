import { z } from "zod";
import { differenceInHours } from "date-fns";
import { prisma } from "@/lib/db";
import { isGuestConnectedToHost } from "@/lib/connections";
import type {
  BookingApprovalMode,
  BookingPendingOn,
  MeetingType,
} from "@/generated/prisma/client";

export const approvalRulesSchema = z.object({
  /** Prior confirmed booking with this host → auto-confirm */
  requireKnownGuest: z.boolean().default(false),
  /** Starts at least N hours from now → auto-confirm (when set) */
  minNoticeHours: z.number().int().min(0).max(24 * 30).nullable().default(null),
});

export type ApprovalRules = z.infer<typeof approvalRulesSchema>;

export function parseApprovalRules(raw: string): ApprovalRules {
  try {
    return approvalRulesSchema.parse(JSON.parse(raw || "{}"));
  } catch {
    return approvalRulesSchema.parse({});
  }
}

export type ApprovalDecision = {
  status: "CONFIRMED" | "PENDING";
  pendingOn: BookingPendingOn | null;
  reason: string;
};

export async function resolveBookingApproval(opts: {
  meetingType: Pick<MeetingType, "approvalMode" | "approvalRulesJson" | "hostId">;
  guestEmail: string;
  startsAt: Date;
  initiatedBy: "guest" | "host";
  hostUserId: string;
  guestUserId?: string | null;
}): Promise<ApprovalDecision> {
  // Host-created invites always wait for the invitee to accept.
  if (opts.initiatedBy === "host") {
    return {
      status: "PENDING",
      pendingOn: "GUEST",
      reason: "Awaiting invitee acceptance",
    };
  }

  const mode = opts.meetingType.approvalMode as BookingApprovalMode;

  if (mode === "AUTO") {
    return {
      status: "CONFIRMED",
      pendingOn: null,
      reason: "Auto-confirmed by meeting type policy",
    };
  }

  if (mode === "MANUAL") {
    return {
      status: "PENDING",
      pendingOn: "HOST",
      reason: "Requires host approval",
    };
  }

  if (mode === "CONNECTIONS") {
    const connected = await isGuestConnectedToHost({
      hostUserId: opts.hostUserId,
      guestEmail: opts.guestEmail,
      guestUserId: opts.guestUserId,
    });
    if (connected) {
      return {
        status: "CONFIRMED",
        pendingOn: null,
        reason: "Auto-confirmed — guest is an accepted connection",
      };
    }
    return {
      status: "PENDING",
      pendingOn: "HOST",
      reason: "Requires host approval — guest is not an accepted connection",
    };
  }

  // CONDITIONAL
  const rules = parseApprovalRules(opts.meetingType.approvalRulesJson);
  const checks: { ok: boolean; label: string }[] = [];

  if (rules.requireKnownGuest) {
    const prior = await prisma.booking.findFirst({
      where: {
        hostId: opts.meetingType.hostId,
        guestEmail: { equals: opts.guestEmail, mode: "insensitive" },
        status: "CONFIRMED",
      },
      select: { id: true },
    });
    checks.push({
      ok: Boolean(prior),
      label: prior ? "Known guest" : "New guest (not previously confirmed)",
    });
  }

  if (rules.minNoticeHours != null) {
    const hours = differenceInHours(opts.startsAt, new Date());
    const ok = hours >= rules.minNoticeHours;
    checks.push({
      ok,
      label: ok
        ? `≥ ${rules.minNoticeHours}h notice`
        : `Needs ≥ ${rules.minNoticeHours}h notice (has ~${Math.max(0, hours)}h)`,
    });
  }

  if (checks.length === 0) {
    return {
      status: "PENDING",
      pendingOn: "HOST",
      reason: "Conditional mode has no rules configured — requires host approval",
    };
  }

  const allOk = checks.every((c) => c.ok);
  if (allOk) {
    return {
      status: "CONFIRMED",
      pendingOn: null,
      reason: `Conditions met: ${checks.map((c) => c.label).join("; ")}`,
    };
  }

  return {
    status: "PENDING",
    pendingOn: "HOST",
    reason: `Conditions not met: ${checks
      .filter((c) => !c.ok)
      .map((c) => c.label)
      .join("; ")}`,
  };
}
