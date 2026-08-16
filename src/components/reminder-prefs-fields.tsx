"use client";

import type { ReminderPrefs } from "@/lib/reminders";

export function ReminderPrefsFields({
  prefix,
  title,
  description,
  value,
  onChange,
}: {
  /** Form field prefix, e.g. "guest" or "host" → guestRecurringEnabled */
  prefix: string;
  title: string;
  description?: string;
  value: ReminderPrefs;
  onChange?: (next: ReminderPrefs) => void;
}) {
  const controlled = Boolean(onChange);

  function patch(next: ReminderPrefs) {
    onChange?.(next);
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{title}</legend>
      {description ? (
        <p className="text-xs text-muted">{description}</p>
      ) : null}

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name={`${prefix}RecurringEnabled`}
          className="mt-1"
          {...(controlled
            ? {
                checked: value.recurring.enabled,
                onChange: (e) =>
                  patch({
                    ...value,
                    recurring: { ...value.recurring, enabled: e.target.checked },
                  }),
              }
            : { defaultChecked: value.recurring.enabled })}
        />
        <span>
          <span className="font-medium">Recurring after confirmation</span>
          <span className="mt-1 flex flex-wrap items-center gap-2">
            Every
            <input
              type="number"
              name={`${prefix}RecurringEvery`}
              min={1}
              max={365}
              className="w-16 rounded-md border border-line bg-white px-2 py-1"
              {...(controlled
                ? {
                    value: value.recurring.every,
                    onChange: (e) =>
                      patch({
                        ...value,
                        recurring: {
                          ...value.recurring,
                          every: Number(e.target.value) || 1,
                        },
                      }),
                  }
                : { defaultValue: value.recurring.every })}
            />
            <select
              name={`${prefix}RecurringUnit`}
              className="rounded-md border border-line bg-white px-2 py-1"
              {...(controlled
                ? {
                    value: value.recurring.unit,
                    onChange: (e) =>
                      patch({
                        ...value,
                        recurring: {
                          ...value.recurring,
                          unit: e.target.value as ReminderPrefs["recurring"]["unit"],
                        },
                      }),
                  }
                : { defaultValue: value.recurring.unit })}
            >
              <option value="DAYS">days</option>
              <option value="WEEKS">weeks</option>
              <option value="MONTHS">months</option>
            </select>
          </span>
        </span>
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name={`${prefix}FinalEnabled`}
          className="mt-1"
          {...(controlled
            ? {
                checked: value.final.enabled,
                onChange: (e) =>
                  patch({
                    ...value,
                    final: { ...value.final, enabled: e.target.checked },
                  }),
              }
            : { defaultChecked: value.final.enabled })}
        />
        <span>
          <span className="font-medium">Final reminder before appointment</span>
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <input
              type="number"
              name={`${prefix}FinalAmount`}
              min={1}
              max={100000}
              className="w-16 rounded-md border border-line bg-white px-2 py-1"
              {...(controlled
                ? {
                    value: value.final.amount,
                    onChange: (e) =>
                      patch({
                        ...value,
                        final: {
                          ...value.final,
                          amount: Number(e.target.value) || 1,
                        },
                      }),
                  }
                : { defaultValue: value.final.amount })}
            />
            <select
              name={`${prefix}FinalUnit`}
              className="rounded-md border border-line bg-white px-2 py-1"
              {...(controlled
                ? {
                    value: value.final.unit,
                    onChange: (e) =>
                      patch({
                        ...value,
                        final: {
                          ...value.final,
                          unit: e.target.value as ReminderPrefs["final"]["unit"],
                        },
                      }),
                  }
                : { defaultValue: value.final.unit })}
            >
              <option value="MINUTES">minutes</option>
              <option value="HOURS">hours</option>
              <option value="DAYS">days</option>
            </select>
            before
          </span>
        </span>
      </label>
    </fieldset>
  );
}
