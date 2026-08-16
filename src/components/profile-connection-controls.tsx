import {
  acceptConnectionAction,
  removeConnectionAction,
  requestConnectionByUserIdAction,
} from "@/lib/connection-actions";

export function ProfileConnectionControls({
  hostName,
  hostSlug,
  targetUserId,
  state,
}: {
  hostName: string;
  hostSlug: string;
  targetUserId: string;
  state:
    | { kind: "none" }
    | { kind: "outgoing"; connectionId: string }
    | { kind: "incoming"; connectionId: string }
    | { kind: "accepted"; connectionId: string };
}) {
  const extras = (
    <>
      <input type="hidden" name="targetUserId" value={targetUserId} />
      <input type="hidden" name="hostSlug" value={hostSlug} />
      {"connectionId" in state ? (
        <input type="hidden" name="connectionId" value={state.connectionId} />
      ) : null}
    </>
  );

  if (state.kind === "accepted") {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
        <p className="text-muted">Connected with {hostName}.</p>
        <form action={removeConnectionAction}>
          {extras}
          <button
            type="submit"
            className="font-medium text-muted underline hover:text-foreground"
          >
            Remove
          </button>
        </form>
      </div>
    );
  }

  if (state.kind === "outgoing") {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
        <p className="text-muted">Connection request sent to {hostName}.</p>
        <form action={removeConnectionAction}>
          {extras}
          <button
            type="submit"
            className="font-medium text-muted underline hover:text-foreground"
          >
            Cancel
          </button>
        </form>
      </div>
    );
  }

  if (state.kind === "incoming") {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
        <p className="text-muted">{hostName} asked to connect.</p>
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
      </div>
    );
  }

  return (
    <form action={requestConnectionByUserIdAction} className="mt-6">
      {extras}
      <button
        type="submit"
        className="rounded-md border border-line bg-panel px-4 py-2 text-sm font-semibold hover:bg-accent-soft"
      >
        Add as connection
      </button>
    </form>
  );
}
