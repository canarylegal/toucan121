"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  calendarConnectAction,
  type CalendarFormState,
} from "@/lib/calendar-actions";
import { CalendarConnectConfirm } from "@/components/calendar-connect-confirm";

type Props = {
  connected: null | {
    label: string;
    serverUrl: string;
    username: string;
    calendarDisplayName?: string;
  };
  /** When true, skip the standalone "already connected" card (parent shows it). */
  embedded?: boolean;
};

export function CalDavConnectForm({ connected, embedded = false }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    calendarConnectAction,
    { step: "credentials" } satisfies CalendarFormState,
  );
  const [selectedUrl, setSelectedUrl] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);

  useEffect(() => {
    if (state.step === "done" || state.success) {
      router.refresh();
    }
  }, [state.step, state.success, router]);

  useEffect(() => {
    setSelectedUrl("");
    setConfirmChecked(false);
  }, [state.formKey, state.step]);

  if (
    !embedded &&
    ((connected && state.step !== "pick-calendar" && state.step !== "confirm") ||
      state.step === "done")
  ) {
    const label =
      connected?.calendarDisplayName ||
      connected?.label ||
      "CalDAV calendar";
    return (
      <div className="space-y-4">
        {state.success ? (
          <p className="text-sm text-accent">{state.success}</p>
        ) : null}
        {connected ? (
          <>
            <div className="rounded-md border border-line bg-white px-4 py-3 text-sm">
              <p className="font-medium">{label}</p>
              <p className="mt-1 text-muted">
                {connected.username} · {connected.serverUrl}
              </p>
              <p className="mt-2 text-xs text-muted">
                Bookings are written here and existing events block availability.
              </p>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-accent">
                Connect a different CalDAV calendar
              </summary>
              <div className="mt-4">
                <CredentialsFields
                  action={action}
                  pending={pending}
                  state={state}
                />
              </div>
            </details>
          </>
        ) : (
          <p className="text-sm text-muted">Refreshing…</p>
        )}
      </div>
    );
  }

  if (state.step === "confirm" && state.pendingCalendar && state.values) {
    const pendingCal = state.pendingCalendar;
    const values = state.values;
    return (
      <form action={action} className="space-y-4">
        <input type="hidden" name="serverUrl" value={values.serverUrl} />
        <input type="hidden" name="username" value={values.username} />
        <input type="hidden" name="password" value={values.password} />
        <input type="hidden" name="calendarUrl" value={pendingCal.url} />
        {state.calendars ? (
          <input
            type="hidden"
            name="calendarsJson"
            value={JSON.stringify(state.calendars)}
          />
        ) : null}

        <CalendarConnectConfirm
          calendarName={pendingCal.displayName}
          checked={confirmChecked}
          onCheckedChange={setConfirmChecked}
        />

        {state.error ? (
          <p className="text-sm text-red-700">{state.error}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            name="intent"
            value="confirm"
            disabled={pending || !confirmChecked}
            className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Connecting…" : "Connect calendar"}
          </button>
          <button
            type="submit"
            name="intent"
            value="back"
            disabled={pending}
            className="text-sm text-muted underline hover:text-foreground"
            formNoValidate
          >
            Back
          </button>
        </div>
      </form>
    );
  }

  if (state.step === "pick-calendar" && state.calendars?.length) {
    const values = state.values!;
    return (
      <form action={action} className="space-y-4">
        <input type="hidden" name="intent" value="select" />
        <input type="hidden" name="serverUrl" value={values.serverUrl} />
        <input type="hidden" name="username" value={values.username} />
        <input type="hidden" name="password" value={values.password} />
        <input
          type="hidden"
          name="calendarsJson"
          value={JSON.stringify(state.calendars)}
        />
        <input type="hidden" name="calendarUrl" value={selectedUrl} />

        <p className="text-sm text-muted">
          Several calendars were found — choose which one Toucan 121 should use.
        </p>
        <ul className="space-y-2">
          {state.calendars.map((cal) => {
            const active = selectedUrl === cal.url;
            return (
              <li key={cal.url}>
                <button
                  type="button"
                  onClick={() => setSelectedUrl(cal.url)}
                  className={`flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left text-sm transition ${
                    active
                      ? "border-accent bg-accent-soft"
                      : "border-line bg-white hover:bg-accent-soft/60"
                  }`}
                >
                  <span
                    className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border ${
                      active
                        ? "border-accent bg-accent"
                        : "border-line bg-white"
                    }`}
                    aria-hidden
                  />
                  <span>
                    <span className="font-medium">{cal.displayName}</span>
                    <span className="mt-0.5 block break-all text-xs text-muted">
                      {cal.url}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {state.error ? (
          <p className="text-sm text-red-700">{state.error}</p>
        ) : null}
        {!selectedUrl ? (
          <p className="text-xs text-muted">Select a calendar to continue.</p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !selectedUrl}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Continuing…" : "Continue"}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      {state.success ? (
        <p className="text-sm text-accent">{state.success}</p>
      ) : null}
      <CredentialsFields action={action} pending={pending} state={state} />
    </div>
  );
}

function CredentialsFields({
  action,
  pending,
  state,
}: {
  action: (payload: FormData) => void;
  pending: boolean;
  state: CalendarFormState;
}) {
  const values = state.values;
  return (
    <form key={state.formKey ?? 0} action={action} className="space-y-4">
      <input type="hidden" name="intent" value="discover" />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">CalDAV server URL</span>
        <input
          name="serverUrl"
          type="url"
          required
          placeholder="https://cloud.example.com/remote.php/dav"
          defaultValue={values?.serverUrl}
          className="w-full rounded-md border border-line bg-white px-3 py-2"
        />
        <span className="text-xs text-muted">
          Nextcloud example: https://your-server/remote.php/dav
        </span>
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Username</span>
        <input
          name="username"
          required
          autoComplete="username"
          defaultValue={values?.username}
          className="w-full rounded-md border border-line bg-white px-3 py-2"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-line bg-white px-3 py-2"
        />
        <span className="text-xs text-muted">
          Prefer an app password. Stored encrypted on the server for calendar
          sync.
        </span>
      </label>
      {state.error && state.step === "credentials" ? (
        <p className="text-sm text-red-700">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Connecting…" : "Continue"}
      </button>
    </form>
  );
}
