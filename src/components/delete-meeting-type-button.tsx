"use client";

import { deleteMeetingTypeAction } from "@/lib/meeting-type-actions";

type Props = {
  meetingTypeId: string;
  title: string;
  openBookingCount: number;
};

export function DeleteMeetingTypeButton({
  meetingTypeId,
  title,
  openBookingCount,
}: Props) {
  if (openBookingCount > 0) {
    return (
      <p className="text-xs text-muted">
        Delete unavailable — {openBookingCount} upcoming or pending booking
        {openBookingCount === 1 ? "" : "s"} still use this type. Cancel or
        complete them first, or deactivate to hide it from guests.
      </p>
    );
  }

  return (
    <form
      action={deleteMeetingTypeAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete “${title}”? Past meetings keep their history; this type will no longer appear for new bookings.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={meetingTypeId} />
      <button
        type="submit"
        className="text-sm font-medium text-red-700/90 underline hover:text-red-800"
      >
        Delete meeting type
      </button>
    </form>
  );
}
