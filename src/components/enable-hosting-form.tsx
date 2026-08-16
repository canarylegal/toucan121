"use client";

import { useActionState } from "react";
import {
  enableHostingAction,
  type HostingFormState,
} from "@/lib/hosting-actions";
import { formatTimezoneOptionLabel, listTimezones } from "@/lib/timezones";

const TIMEZONES = listTimezones();

export function EnableHostingForm({
  defaultName,
}: {
  defaultName: string;
}) {
  const [state, action, pending] = useActionState(enableHostingAction, {
    values: {
      name: defaultName,
      businessName: "",
      timezone: "Europe/London",
      suffix: "",
    },
  } satisfies HostingFormState);
  const values = state.values;

  return (
    <form key={state.formKey ?? 0} action={action} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Display name</span>
        <input
          name="name"
          required
          defaultValue={values?.name ?? defaultName}
          className="w-full rounded-md border border-line bg-white px-3 py-2"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Business name (optional)</span>
        <input
          name="businessName"
          defaultValue={values?.businessName}
          className="w-full rounded-md border border-line bg-white px-3 py-2"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Profile page suffix</span>
        <div className="flex items-center gap-0 rounded-md border border-line bg-white">
          <span className="shrink-0 pl-3 text-sm text-muted">/</span>
          <input
            className="w-full rounded-r-md bg-transparent py-2 pr-3 outline-none"
            name="suffix"
            placeholder="jane.smith"
            autoComplete="off"
            defaultValue={values?.suffix}
          />
        </div>
        <span className="text-xs text-muted">
          Leave blank to generate from your display name.
        </span>
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Timezone</span>
        <select
          name="timezone"
          required
          defaultValue={values?.timezone || "Europe/London"}
          className="w-full rounded-md border border-line bg-white px-3 py-2"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {formatTimezoneOptionLabel(tz)}
            </option>
          ))}
        </select>
      </label>

      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Setting up…" : "Start hosting"}
      </button>
    </form>
  );
}
