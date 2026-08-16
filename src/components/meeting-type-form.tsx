"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AvailabilityEditor } from "@/components/availability-editor";
import { ReminderPrefsFields } from "@/components/reminder-prefs-fields";
import type { WeeklyWindow } from "@/lib/availability";
import {
  createMeetingTypeAction,
  updateMeetingTypeAction,
  type MeetingTypeFormState,
} from "@/lib/meeting-type-actions";
import { DEFAULT_REMINDER_PREFS } from "@/lib/reminders";

const BUFFER_OPTIONS = [0, 5, 10, 15, 30, 45, 60, 90, 120] as const;

type Values = NonNullable<MeetingTypeFormState["values"]>;

type Props = {
  mode: "create" | "edit";
  meetingTypeId?: string;
  initial: Values;
  initialWindows: WeeklyWindow[];
  bookingPreviewPath: string;
};

export function MeetingTypeForm({
  mode,
  meetingTypeId,
  initial,
  initialWindows,
  bookingPreviewPath,
}: Props) {
  const router = useRouter();
  const actionFn =
    mode === "create"
      ? createMeetingTypeAction
      : updateMeetingTypeAction.bind(null, meetingTypeId!);

  const [state, action, pending] = useActionState(
    actionFn,
    { values: initial } satisfies MeetingTypeFormState,
  );
  const values = state.values ?? initial;
  const [locationType, setLocationType] = useState(values.locationType);
  const [videoMode, setVideoMode] = useState<"jitsi" | "custom">(
    values.videoMode ?? (values.videoUrl?.trim() ? "custom" : "jitsi"),
  );
  const [venuePolicy, setVenuePolicy] = useState(
    values.venuePolicy ?? "HOST_FIXED",
  );
  const [approvalMode, setApprovalMode] = useState(values.approvalMode);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <form key={state.formKey ?? 0} action={action} className="space-y-5">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Location</span>
        <select
          name="locationType"
          value={locationType}
          onChange={(e) =>
            setLocationType(e.target.value as "VIDEO" | "IN_PERSON")
          }
          className="w-full rounded-md border border-line bg-white px-3 py-2"
        >
          <option value="VIDEO">Video call</option>
          <option value="IN_PERSON">In person</option>
        </select>
      </label>

      {locationType === "IN_PERSON" ? (
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Who chooses the venue?</span>
            <select
              name="venuePolicy"
              value={venuePolicy}
              onChange={(e) =>
                setVenuePolicy(
                  e.target.value as "HOST_FIXED" | "GUEST_PROPOSES",
                )
              }
              className="w-full rounded-md border border-line bg-white px-3 py-2"
            >
              <option value="HOST_FIXED">Host sets the venue</option>
              <option value="GUEST_PROPOSES">
                Guest / invitee proposes the venue
              </option>
            </select>
          </label>
          {venuePolicy === "HOST_FIXED" ? (
            <Field
              label="Venue"
              name="locationNote"
              required
              placeholder="e.g. Pret a Manger, King Street"
              defaultValue={values.locationNote}
            />
          ) : (
            <>
              <input type="hidden" name="locationNote" value="" />
              <p className="text-xs text-muted">
                The person booking (or accepting an invite) will enter a venue.
              </p>
            </>
          )}
          <input type="hidden" name="videoMode" value="jitsi" />
          <input type="hidden" name="videoUrl" value="" />
        </div>
      ) : (
        <div className="space-y-4">
          <input type="hidden" name="venuePolicy" value="HOST_FIXED" />
          <input type="hidden" name="locationNote" value="" />
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Video link</legend>
            <label className="flex gap-2 text-sm">
              <input
                type="radio"
                name="videoMode"
                value="jitsi"
                checked={videoMode === "jitsi"}
                onChange={() => setVideoMode("jitsi")}
                className="mt-1"
              />
              <span>
                <span className="font-medium">New Jitsi room each booking</span>
                <span className="block text-muted">
                  Toucan creates a unique meet.jit.si link automatically.
                </span>
              </span>
            </label>
            <label className="flex gap-2 text-sm">
              <input
                type="radio"
                name="videoMode"
                value="custom"
                checked={videoMode === "custom"}
                onChange={() => setVideoMode("custom")}
                className="mt-1"
              />
              <span>
                <span className="font-medium">
                  Fixed link (Zoom, Teams, Meet, …)
                </span>
                <span className="block text-muted">
                  Same join URL for every booking of this type.
                </span>
              </span>
            </label>
          </fieldset>
          {videoMode === "custom" ? (
            <Field
              label="Video URL"
              name="videoUrl"
              type="url"
              required
              placeholder="https://zoom.us/j/… or Teams / Meet link"
              defaultValue={values.videoUrl}
            />
          ) : (
            <input type="hidden" name="videoUrl" value="" />
          )}
        </div>
      )}

      <Field label="Title" name="title" required defaultValue={values.title} />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Description</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={values.description}
          className="w-full rounded-md border border-line bg-white px-3 py-2"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Duration (minutes)</span>
        <input
          type="number"
          name="durationMins"
          min={5}
          max={480}
          step={5}
          required
          defaultValue={values.durationMins}
          className="w-full rounded-md border border-line bg-white px-3 py-2"
        />
      </label>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Buffer time</legend>
        <p className="text-xs text-muted">
          Block time before and/or after each booking so meetings aren&apos;t
          back-to-back. Before + after stack between two bookings.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Before (minutes)</span>
            <select
              name="bufferBefore"
              defaultValue={values.bufferBefore ?? "0"}
              className="w-full rounded-md border border-line bg-white px-3 py-2"
            >
              {BUFFER_OPTIONS.map((m) => (
                <option key={`before-${m}`} value={m}>
                  {m === 0 ? "None" : `${m} min`}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">After (minutes)</span>
            <select
              name="bufferAfter"
              defaultValue={values.bufferAfter ?? "0"}
              className="w-full rounded-md border border-line bg-white px-3 py-2"
            >
              {BUFFER_OPTIONS.map((m) => (
                <option key={`after-${m}`} value={m}>
                  {m === 0 ? "None" : `${m} min`}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">URL suffix (optional)</span>
        <div className="flex items-center rounded-md border border-line bg-white">
          <span className="shrink-0 pl-3 text-sm text-muted">
            …/{bookingPreviewPath}/
          </span>
          <input
            name="suffix"
            defaultValue={values.suffix}
            placeholder="intro-call"
            className="w-full rounded-r-md bg-transparent py-2 pr-3 outline-none"
          />
        </div>
        <span className="text-xs text-muted">
          Leave blank to generate from the title.
        </span>
      </label>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Booking approval</legend>
        <p className="text-xs text-muted">
          Controls what happens when a guest books this meeting type from your
          public page. Host-created invitations always wait for the invitee to
          accept.
        </p>
        {(
          [
            {
              value: "AUTO",
              label: "Auto-confirm",
              hint: "Booking is confirmed immediately.",
            },
            {
              value: "MANUAL",
              label: "Manual approval",
              hint: "You approve or decline each request.",
            },
            {
              value: "CONDITIONAL",
              label: "Auto if conditions met",
              hint: "Confirm automatically when rules pass; otherwise you approve.",
            },
            {
              value: "CONNECTIONS",
              label: "Auto if a connection",
              hint: "Confirm automatically when the guest is an accepted connection (signed-in account or matching email). Everyone else waits for your approval.",
            },
          ] as const
        ).map((opt) => (
          <label key={opt.value} className="flex gap-2 text-sm">
            <input
              type="radio"
              name="approvalMode"
              value={opt.value}
              checked={approvalMode === opt.value}
              onChange={() => setApprovalMode(opt.value)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">{opt.label}</span>
              <span className="block text-muted">{opt.hint}</span>
            </span>
          </label>
        ))}

        {approvalMode === "CONDITIONAL" ? (
          <div className="ml-6 space-y-3 rounded-md border border-line bg-white p-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="requireKnownGuest"
                defaultChecked={values.requireKnownGuest}
                className="mt-1"
              />
              <span>
                <span className="font-medium">Known guest</span>
                <span className="block text-muted">
                  Auto-confirm if this email already has a confirmed booking
                  with you.
                </span>
              </span>
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Minimum notice (hours)</span>
              <input
                type="number"
                name="minNoticeHours"
                min={0}
                max={720}
                placeholder="e.g. 24"
                defaultValue={values.minNoticeHours}
                className="w-full rounded-md border border-line bg-white px-3 py-2"
              />
              <span className="text-xs text-muted">
                Leave blank to ignore notice. When set, short-notice requests
                need your approval.
              </span>
            </label>
          </div>
        ) : (
          <>
            <input type="hidden" name="requireKnownGuest" value="" />
            <input type="hidden" name="minNoticeHours" value="" />
          </>
        )}
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={values.active} />
        Active on public profile page
      </label>

      <div className="space-y-5 border-t border-line pt-5">
        <ReminderPrefsFields
          prefix="host"
          title="Your reminders (host)"
          description="How Toucan 121 emails you about confirmed bookings of this type."
          value={values.hostReminder ?? DEFAULT_REMINDER_PREFS}
        />
        <ReminderPrefsFields
          prefix="guest"
          title="Default guest reminders"
          description="Guests see these defaults when booking or accepting an invite, and can change them."
          value={values.guestReminder ?? DEFAULT_REMINDER_PREFS}
        />
      </div>

      <AvailabilityEditor initialWindows={initialWindows} />

      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm text-accent">{state.success}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending
          ? "Saving…"
          : mode === "create"
            ? "Create meeting type"
            : "Save meeting type"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input
        className="w-full rounded-md border border-line bg-white px-3 py-2"
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
      />
    </label>
  );
}
