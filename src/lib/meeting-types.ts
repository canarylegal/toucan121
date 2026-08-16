import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  DEFAULT_WEEKDAY_WINDOWS,
  type WeeklyWindow,
  parseAvailabilityJson,
} from "@/lib/availability";
import { approvalRulesSchema, parseApprovalRules } from "@/lib/approval";
import {
  DEFAULT_REMINDER_PREFS,
  parseReminderPrefs,
  reminderPrefsSchema,
  stringifyReminderPrefs,
} from "@/lib/reminders";
import { randomSlugSuffix, slugify } from "@/lib/slug";

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

export const weeklyWindowSchema = z.object({
  day: z.number().int().min(0).max(6),
  start: z.string().regex(timeRe, "Start time must be HH:MM"),
  end: z.string().regex(timeRe, "End time must be HH:MM"),
});

export const meetingTypeSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    description: z.string().trim().max(1000),
    durationMins: z.coerce.number().int().min(5).max(480),
    bufferBefore: z.coerce.number().int().min(0).max(180).default(0),
    bufferAfter: z.coerce.number().int().min(0).max(180).default(0),
    locationType: z.enum(["VIDEO", "IN_PERSON"]),
    venuePolicy: z.enum(["HOST_FIXED", "GUEST_PROPOSES"]).default("HOST_FIXED"),
    locationNote: z.string().trim().max(200),
    videoMode: z.enum(["jitsi", "custom"]).default("jitsi"),
    /** VIDEO + custom: standing Zoom/Teams/Meet link; ignored for jitsi */
    videoUrl: z.string().trim().max(500).default(""),
    suffix: z.string().trim().max(48).optional(),
    active: z.boolean().default(true),
    approvalMode: z.enum(["AUTO", "MANUAL", "CONDITIONAL", "CONNECTIONS"]).default("AUTO"),
    approvalRules: approvalRulesSchema.default({
      requireKnownGuest: false,
      minNoticeHours: null,
    }),
    hostReminder: reminderPrefsSchema.default(DEFAULT_REMINDER_PREFS),
    guestReminder: reminderPrefsSchema.default(DEFAULT_REMINDER_PREFS),
    windows: z.array(weeklyWindowSchema).default([]),
  })
  .superRefine((data, ctx) => {
    for (const w of data.windows) {
      if (w.start >= w.end) {
        ctx.addIssue({
          code: "custom",
          message: `Day ${w.day}: end time must be after start time`,
          path: ["windows"],
        });
      }
    }
    if (data.approvalMode === "CONDITIONAL") {
      const rules = data.approvalRules;
      if (!rules.requireKnownGuest && rules.minNoticeHours == null) {
        ctx.addIssue({
          code: "custom",
          message:
            "Conditional mode needs at least one rule (known guest and/or minimum notice)",
          path: ["approvalRules"],
        });
      }
    }
    if (
      data.locationType === "IN_PERSON" &&
      data.venuePolicy === "HOST_FIXED" &&
      !data.locationNote.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Add a venue when the host sets the location",
        path: ["locationNote"],
      });
    }
    if (data.locationType === "VIDEO" && data.videoMode === "custom") {
      if (!data.videoUrl.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Add a video URL for the fixed link",
          path: ["videoUrl"],
        });
      } else {
        try {
          const u = new URL(data.videoUrl.trim());
          if (u.protocol !== "http:" && u.protocol !== "https:") {
            throw new Error("bad protocol");
          }
        } catch {
          ctx.addIssue({
            code: "custom",
            message: "Video link must be a valid http(s) URL",
            path: ["videoUrl"],
          });
        }
      }
    }
  });

export function parseWindowsFromJson(raw: string): WeeklyWindow[] {
  const windows = parseAvailabilityJson(raw);
  return windows
    .map((w) => ({
      day: w.day,
      start: String(w.start).slice(0, 5),
      end: String(w.end).slice(0, 5),
    }))
    .filter(
      (w) =>
        Number.isInteger(w.day) &&
        w.day >= 0 &&
        w.day <= 6 &&
        timeRe.test(w.start) &&
        timeRe.test(w.end) &&
        w.start < w.end,
    );
}

async function uniqueMeetingSlug(
  hostId: string,
  desired: string,
  excludeId?: string,
): Promise<string> {
  const base =
    slugify(desired)
      .replace(/\./g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "meeting";
  let candidate = base;

  for (let i = 0; i < 8; i++) {
    const existing = await prisma.meetingType.findUnique({
      where: { hostId_slug: { hostId, slug: candidate } },
    });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${randomSlugSuffix()}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createMeetingType(opts: {
  hostId: string;
  input: z.infer<typeof meetingTypeSchema>;
}) {
  const data = meetingTypeSchema.parse(opts.input);
  const slug = await uniqueMeetingSlug(
    opts.hostId,
    data.suffix || data.title,
  );
  const windows =
    data.windows.length > 0 ? data.windows : DEFAULT_WEEKDAY_WINDOWS;

  return prisma.meetingType.create({
    data: {
      hostId: opts.hostId,
      slug,
      title: data.title,
      description: data.description,
      durationMins: data.durationMins,
      bufferBefore: data.bufferBefore,
      bufferAfter: data.bufferAfter,
      locationType: data.locationType,
      venuePolicy:
        data.locationType === "VIDEO" ? "HOST_FIXED" : data.venuePolicy,
      locationNote:
        data.locationType === "VIDEO"
          ? ""
          : data.venuePolicy === "GUEST_PROPOSES"
            ? ""
            : data.locationNote,
      videoUrl:
        data.locationType === "VIDEO" && data.videoMode === "custom"
          ? data.videoUrl.trim()
          : "",
      availabilityJson: JSON.stringify(windows),
      approvalMode: data.approvalMode,
      approvalRulesJson: JSON.stringify(data.approvalRules),
      hostReminderJson: stringifyReminderPrefs(data.hostReminder),
      guestReminderJson: stringifyReminderPrefs(data.guestReminder),
      active: data.active,
    },
  });
}

export async function updateMeetingType(opts: {
  hostId: string;
  meetingTypeId: string;
  input: z.infer<typeof meetingTypeSchema>;
}) {
  const existing = await prisma.meetingType.findFirst({
    where: { id: opts.meetingTypeId, hostId: opts.hostId, deletedAt: null },
  });
  if (!existing) throw new Error("Meeting type not found");

  const data = meetingTypeSchema.parse(opts.input);
  const slug = await uniqueMeetingSlug(
    opts.hostId,
    data.suffix || data.title,
    existing.id,
  );
  const windows =
    data.windows.length > 0 ? data.windows : DEFAULT_WEEKDAY_WINDOWS;

  return prisma.meetingType.update({
    where: { id: existing.id },
    data: {
      slug,
      title: data.title,
      description: data.description,
      durationMins: data.durationMins,
      bufferBefore: data.bufferBefore,
      bufferAfter: data.bufferAfter,
      locationType: data.locationType,
      venuePolicy:
        data.locationType === "VIDEO" ? "HOST_FIXED" : data.venuePolicy,
      locationNote:
        data.locationType === "VIDEO"
          ? ""
          : data.venuePolicy === "GUEST_PROPOSES"
            ? ""
            : data.locationNote,
      videoUrl:
        data.locationType === "VIDEO" && data.videoMode === "custom"
          ? data.videoUrl.trim()
          : "",
      availabilityJson: JSON.stringify(windows),
      approvalMode: data.approvalMode,
      approvalRulesJson: JSON.stringify(data.approvalRules),
      hostReminderJson: stringifyReminderPrefs(data.hostReminder),
      guestReminderJson: stringifyReminderPrefs(data.guestReminder),
      active: data.active,
    },
  });
}

export async function setMeetingTypeActive(opts: {
  hostId: string;
  meetingTypeId: string;
  active: boolean;
}) {
  const existing = await prisma.meetingType.findFirst({
    where: { id: opts.meetingTypeId, hostId: opts.hostId, deletedAt: null },
  });
  if (!existing) throw new Error("Meeting type not found");

  return prisma.meetingType.update({
    where: { id: existing.id },
    data: { active: opts.active },
  });
}

export async function deleteMeetingType(opts: {
  hostId: string;
  meetingTypeId: string;
}) {
  const existing = await prisma.meetingType.findFirst({
    where: {
      id: opts.meetingTypeId,
      hostId: opts.hostId,
      deletedAt: null,
    },
  });
  if (!existing) throw new Error("Meeting type not found");

  const openBookings = await prisma.booking.count({
    where: {
      meetingTypeId: existing.id,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
  });
  if (openBookings > 0) {
    throw new Error(
      "This meeting type still has upcoming or pending bookings — cancel or complete them first, or deactivate the type instead.",
    );
  }

  // Soft-delete so past bookings keep their meeting type for history.
  // Free the public slug so a new type can reuse the name.
  return prisma.meetingType.update({
    where: { id: existing.id },
    data: {
      deletedAt: new Date(),
      active: false,
      slug: `deleted-${existing.id}`,
    },
  });
}

export { parseApprovalRules, parseReminderPrefs };
