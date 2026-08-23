"use client";

type Props = {
  /** Calendar name shown in the summary line */
  calendarName: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
};

/** Explains busy-import + write behaviour; requires explicit opt-in. */
export function CalendarConnectConfirm({
  calendarName,
  checked,
  onCheckedChange,
}: Props) {
  return (
    <div className="space-y-3 rounded-md border border-line bg-white px-4 py-3">
      <p className="text-sm font-medium">Confirm calendar “{calendarName}”</p>
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
        <li>
          Existing events on this calendar will be treated as busy — those times
          won’t be offered for booking.
        </li>
        <li>
          Upcoming confirmed and pending Toucan 121 bookings, plus blocked
          times, will be copied here. New bookings will be written here too.
        </li>
      </ul>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="confirmSync"
          value="yes"
          required
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I understand existing events will block availability, and I want to
          connect this calendar.
        </span>
      </label>
    </div>
  );
}
