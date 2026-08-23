import type { ReactNode } from "react";
import Link from "next/link";
import {
  acceptConnectionAction,
  removeConnectionAction,
  requestConnectionByUserIdAction,
} from "@/lib/connection-actions";

type ConnectionState =
  | { kind: "none" }
  | { kind: "outgoing"; connectionId: string }
  | { kind: "incoming"; connectionId: string }
  | { kind: "accepted"; connectionId: string };

export function ProfileConnectionControls({
  hostName,
  hostSlug,
  targetUserId,
  state,
  emailVerified,
  variant = "default",
}: {
  hostName: string;
  hostSlug: string;
  targetUserId: string;
  emailVerified: boolean;
  state: ConnectionState;
  /** Compact top-bar placement on tree layout profiles. */
  variant?: "default" | "header";
}) {
  const isHeader = variant === "header";
  const surfaceClass = isHeader ? "profile-booking-surface" : "";
  const rowClass = isHeader
    ? "flex flex-wrap items-center justify-end gap-2 text-sm"
    : "mt-6 flex flex-wrap items-center gap-3 text-sm";
  const addLabel = isHeader ? "Add connection" : "Add as connection";
  const addButtonClass = isHeader
    ? "rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-accent-soft"
    : "rounded-md border border-line bg-panel px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent-soft";

  const extras = (
    <>
      <input type="hidden" name="targetUserId" value={targetUserId} />
      <input type="hidden" name="hostSlug" value={hostSlug} />
      {"connectionId" in state ? (
        <input type="hidden" name="connectionId" value={state.connectionId} />
      ) : null}
    </>
  );

  function wrap(content: ReactNode) {
    if (!surfaceClass) return content;
    return <div className={surfaceClass}>{content}</div>;
  }

  if (state.kind === "accepted") {
    return wrap(
      <div className={rowClass}>
        <p className="text-muted">
          {isHeader ? "Connected" : `Connected with ${hostName}.`}
        </p>
        <form action={removeConnectionAction}>
          {extras}
          <button
            type="submit"
            className="font-medium text-muted underline hover:text-foreground"
          >
            Remove
          </button>
        </form>
      </div>,
    );
  }

  if (state.kind === "outgoing") {
    return wrap(
      <div className={rowClass}>
        <p className="text-muted">
          {isHeader ? "Request sent" : `Connection request sent to ${hostName}.`}
        </p>
        <form action={removeConnectionAction}>
          {extras}
          <button
            type="submit"
            className="font-medium text-muted underline hover:text-foreground"
          >
            Cancel
          </button>
        </form>
      </div>,
    );
  }

  if (state.kind === "incoming") {
    return wrap(
      <div className={rowClass}>
        <p className="text-muted">
          {isHeader ? `${hostName} wants to connect` : `${hostName} asked to connect.`}
        </p>
        <form action={acceptConnectionAction}>
          {extras}
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Accept
          </button>
        </form>
        <form action={removeConnectionAction}>
          {extras}
          <button
            type="submit"
            className="font-medium text-muted underline hover:text-foreground"
          >
            Ignore
          </button>
        </form>
      </div>,
    );
  }

  if (emailVerified) {
    return wrap(
      <form action={requestConnectionByUserIdAction} className={isHeader ? "" : "mt-6"}>
        {extras}
        <button type="submit" className={addButtonClass}>{addLabel}</button>
      </form>,
    );
  }

  return (
    <p className={isHeader ? "text-sm text-muted" : "mt-6 text-sm text-muted"}>
      <Link href="/dash/account" className="font-medium text-accent underline">
        Confirm your email
      </Link>
      {isHeader ? null : " to add a connection."}
    </p>
  );
}
