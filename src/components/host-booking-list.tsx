import Link from "next/link";
import {
  approveBookingAction,
  cancelBookingAction,
  declineBookingAction,
} from "@/lib/host-booking-manage-actions";
import {
  actionPointsAllDone,
  parseActionPoints,
  type ActionPoint,
} from "@/lib/action-points";
import { ActionPointsDisclosure } from "@/components/action-points-disclosure";

export type HostBookingRow = {
  id: string;
  guestName: string;
  guestEmail: string;
  startsAt: Date;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  pendingOn: "HOST" | "GUEST" | null;
  meetingType: { title: string };
  actionPoints?: string;
  actionPointsDone?: boolean;
};

type Props = {
  bookings: HostBookingRow[];
  timezone: string;
  empty: string;
  /** Show reschedule for cancelled rows (reactivates the booking). */
  allowRescheduleCancelled?: boolean;
  /** Recent completed meetings — show action-point checklist. */
  showActionStatus?: boolean;
};

export function HostBookingList({
  bookings,
  timezone,
  empty,
  allowRescheduleCancelled = false,
  showActionStatus = false,
}: Props) {
  if (bookings.length === 0) {
    return <p className="mt-3 text-sm text-muted">{empty}</p>;
  }

  return (
    <ul className="mt-3 space-y-3 text-sm">
      {bookings.map((b) => {
        const statusLabel =
          b.status === "PENDING"
            ? b.pendingOn === "GUEST"
              ? "awaiting guest"
              : "needs approval"
            : b.status === "COMPLETED"
              ? "completed"
              : b.status.toLowerCase();
        const showReschedule =
          b.status === "PENDING" ||
          b.status === "CONFIRMED" ||
          (b.status === "CANCELLED" && allowRescheduleCancelled);
        const showCancel =
          b.status === "PENDING" || b.status === "CONFIRMED";

        const points: ActionPoint[] =
          showActionStatus && b.status === "COMPLETED"
            ? parseActionPoints(b.actionPoints)
            : [];
        const allDone =
          b.actionPointsDone ?? actionPointsAllDone(points);

        return (
          <li
            key={b.id}
            className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {b.guestName}{" "}
                <span className="font-normal text-muted">
                  · {b.meetingType.title}
                </span>
              </p>
              <p className="text-muted">
                {b.guestEmail} ·{" "}
                {b.startsAt.toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: timezone,
                })}
              </p>
              {points.length > 0 ? (
                <ActionPointsDisclosure bookingId={b.id} points={points} />
              ) : null}
              {b.status === "PENDING" && b.pendingOn === "HOST" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={approveBookingAction}>
                    <input type="hidden" name="bookingId" value={b.id} />
                    <button
                      type="submit"
                      className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Approve
                    </button>
                  </form>
                  <form action={declineBookingAction}>
                    <input type="hidden" name="bookingId" value={b.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold hover:bg-accent-soft"
                    >
                      Decline
                    </button>
                  </form>
                </div>
              ) : showReschedule || showCancel ? (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {showReschedule ? (
                    <Link
                      href={`/dash/bookings/${b.id}/reschedule`}
                      className="text-xs font-medium text-accent underline"
                    >
                      Reschedule
                    </Link>
                  ) : null}
                  {showCancel ? (
                    <form action={cancelBookingAction}>
                      <input type="hidden" name="bookingId" value={b.id} />
                      <button
                        type="submit"
                        className="text-xs font-medium text-muted underline hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {showActionStatus && b.status === "COMPLETED" ? (
                <ActionStatusChip done={allDone} />
              ) : (
                <span
                  className={
                    b.status === "PENDING"
                      ? "text-xs font-medium uppercase tracking-wide text-amber-700"
                      : b.status === "CANCELLED"
                        ? "text-xs font-medium uppercase tracking-wide text-red-700/80"
                        : "text-xs font-medium uppercase tracking-wide text-muted"
                  }
                >
                  {statusLabel}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ActionStatusChip({ done }: { done: boolean }) {
  if (done) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
        title="No outstanding action points"
      >
        <span aria-hidden>✓</span>
        Done
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
      title="Outstanding action points"
    >
      <span aria-hidden>●</span>
      Actions
    </span>
  );
}
