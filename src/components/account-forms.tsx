"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  requestPasswordResetAction,
  resetPasswordAction,
  type AccountFormState,
} from "@/lib/account-actions";

const initial: AccountFormState = {};

function Field({
  label,
  name,
  autoComplete,
}: {
  label: string;
  name: string;
  autoComplete: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input
        className="w-full rounded-md border border-line bg-white px-3 py-2"
        name={name}
        type="password"
        required
        minLength={name === "currentPassword" ? 1 : 8}
        autoComplete={autoComplete}
      />
    </label>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    requestPasswordResetAction,
    initial,
  );

  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Email</span>
        <input
          className="w-full rounded-md border border-line bg-white px-3 py-2"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
      </label>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm text-accent">{state.success}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(
    resetPasswordAction,
    initial,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="New password" name="password" autoComplete="new-password" />
      <Field
        label="Confirm password"
        name="passwordConfirm"
        autoComplete="new-password"
      />
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(
    changePasswordAction,
    initial,
  );

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Current password"
        name="currentPassword"
        autoComplete="current-password"
      />
      <Field label="New password" name="password" autoComplete="new-password" />
      <Field
        label="Confirm new password"
        name="passwordConfirm"
        autoComplete="new-password"
      />
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm text-accent">{state.success}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
