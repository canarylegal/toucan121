"use client";

import { useActionState } from "react";
import {
  requestConnectionByLookupAction,
  type ConnectionLookupState,
} from "@/lib/connection-actions";

const initial: ConnectionLookupState = {};

export function ConnectionLookupForm() {
  const [state, action, pending] = useActionState(
    requestConnectionByLookupAction,
    initial,
  );

  return (
    <form action={action} className="space-y-3">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Email or profile path</span>
        <input
          name="lookup"
          required
          placeholder="name@example.com or /colin"
          className="w-full rounded-md border border-line bg-white px-3 py-2"
        />
      </label>
      <p className="text-xs text-muted">
        If they have a Toucan account, they&apos;ll see your request. We
        won&apos;t say whether that contact exists.
      </p>
      {state.error ? (
        <p className="text-sm text-red-700">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-accent">{state.success}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
