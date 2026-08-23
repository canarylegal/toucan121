import { z } from "zod";
import {
  addDays,
  addHours,
  addMinutes,
  addMonths,
  addWeeks,
  subDays,
  subHours,
  subMinutes,
} from "date-fns";

export const reminderUnitSchema = z.enum([
  "MINUTES",
  "HOURS",
  "DAYS",
  "WEEKS",
  "MONTHS",
]);

export type ReminderUnit = z.infer<typeof reminderUnitSchema>;

export const reminderPrefsSchema = z.object({
  recurring: z.object({
    enabled: z.boolean(),
    every: z.number().int().min(1).max(365),
    /** DAYS | WEEKS | MONTHS only in practice */
    unit: z.enum(["DAYS", "WEEKS", "MONTHS"]),
  }),
  final: z.object({
    enabled: z.boolean(),
    amount: z.number().int().min(1).max(365 * 24 * 60),
    unit: z.enum(["MINUTES", "HOURS", "DAYS"]),
  }),
});

export type ReminderPrefs = z.infer<typeof reminderPrefsSchema>;

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  recurring: { enabled: false, every: 1, unit: "WEEKS" },
  final: { enabled: true, amount: 24, unit: "HOURS" },
};

export const DISABLED_REMINDER_PREFS: ReminderPrefs = {
  recurring: { enabled: false, every: 1, unit: "WEEKS" },
  final: { enabled: false, amount: 24, unit: "HOURS" },
};

export function parseReminderPrefs(raw: string | null | undefined): ReminderPrefs {
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    return reminderPrefsSchema.parse({
      recurring: {
        ...DEFAULT_REMINDER_PREFS.recurring,
        ...(parsed.recurring ?? {}),
      },
      final: {
        ...DEFAULT_REMINDER_PREFS.final,
        ...(parsed.final ?? {}),
      },
    });
  } catch {
    return structuredClone(DEFAULT_REMINDER_PREFS);
  }
}

export function stringifyReminderPrefs(prefs: ReminderPrefs): string {
  return JSON.stringify(reminderPrefsSchema.parse(prefs));
}

function addInterval(from: Date, every: number, unit: "DAYS" | "WEEKS" | "MONTHS") {
  if (unit === "DAYS") return addDays(from, every);
  if (unit === "WEEKS") return addWeeks(from, every);
  return addMonths(from, every);
}

function subtractAmount(
  from: Date,
  amount: number,
  unit: "MINUTES" | "HOURS" | "DAYS",
) {
  if (unit === "MINUTES") return subMinutes(from, amount);
  if (unit === "HOURS") return subHours(from, amount);
  return subDays(from, amount);
}

export type PlannedReminder = {
  recipient: "HOST" | "GUEST";
  kind: "RECURRING" | "FINAL";
  scheduledFor: Date;
};

/**
 * Build reminder fire times for a confirmed booking.
 * Recurring: every X after confirmation while still before startsAt.
 * Final: startsAt minus offset (skipped if already past).
 */
export function planReminders(opts: {
  confirmedAt: Date;
  startsAt: Date;
  hostPrefs: ReminderPrefs;
  guestPrefs: ReminderPrefs;
  now?: Date;
}): PlannedReminder[] {
  const now = opts.now ?? new Date();
  const out: PlannedReminder[] = [];

  for (const [recipient, prefs] of [
    ["HOST", opts.hostPrefs],
    ["GUEST", opts.guestPrefs],
  ] as const) {
    if (prefs.recurring.enabled) {
      let next = addInterval(
        opts.confirmedAt,
        prefs.recurring.every,
        prefs.recurring.unit,
      );
      // Cap iterations so a tiny interval can't explode
      for (let i = 0; i < 500 && next < opts.startsAt; i++) {
        if (next > now) {
          out.push({
            recipient,
            kind: "RECURRING",
            scheduledFor: next,
          });
        }
        next = addInterval(next, prefs.recurring.every, prefs.recurring.unit);
      }
    }

    if (prefs.final.enabled) {
      const when = subtractAmount(
        opts.startsAt,
        prefs.final.amount,
        prefs.final.unit,
      );
      if (when > now && when < opts.startsAt) {
        out.push({ recipient, kind: "FINAL", scheduledFor: when });
      }
    }
  }

  return out.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
}

export function describeReminderPrefs(prefs: ReminderPrefs): string {
  const parts: string[] = [];
  if (prefs.recurring.enabled) {
    parts.push(
      `every ${prefs.recurring.every} ${prefs.recurring.unit.toLowerCase()} after confirm`,
    );
  }
  if (prefs.final.enabled) {
    parts.push(
      `${prefs.final.amount} ${prefs.final.unit.toLowerCase()} before`,
    );
  }
  return parts.length ? parts.join("; ") : "none";
}

/** Read reminder prefs from FormData field prefixes (e.g. guestReminder). */
export function reminderPrefsFromFormData(
  formData: FormData,
  prefix: string,
): ReminderPrefs {
  const recurringEnabled = formData.get(`${prefix}RecurringEnabled`) === "on";
  const finalEnabled = formData.get(`${prefix}FinalEnabled`) === "on";
  const every = Number.parseInt(
    String(formData.get(`${prefix}RecurringEvery`) ?? "1"),
    10,
  );
  const recurringUnit = String(
    formData.get(`${prefix}RecurringUnit`) ?? "WEEKS",
  );
  const amount = Number.parseInt(
    String(formData.get(`${prefix}FinalAmount`) ?? "24"),
    10,
  );
  const finalUnit = String(formData.get(`${prefix}FinalUnit`) ?? "HOURS");

  return reminderPrefsSchema.parse({
    recurring: {
      enabled: recurringEnabled,
      every: Number.isFinite(every) ? every : 1,
      unit:
        recurringUnit === "DAYS" || recurringUnit === "MONTHS"
          ? recurringUnit
          : "WEEKS",
    },
    final: {
      enabled: finalEnabled,
      amount: Number.isFinite(amount) ? amount : 24,
      unit:
        finalUnit === "MINUTES" || finalUnit === "DAYS" ? finalUnit : "HOURS",
    },
  });
}
