"use client";

import { useActionState } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/brand";
import {
  loginAction,
  signupAction,
  type AuthFormState,
} from "@/lib/auth-actions";

const initial: AuthFormState = {};

export function SignupForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action, pending] = useActionState(signupAction, initial);
  const values = state.values;
  const returnTo = callbackUrl || "/dash";
  const loginHref = `/login?callbackUrl=${encodeURIComponent(returnTo)}`;

  return (
    <form key={state.formKey ?? 0} action={action} className="space-y-4">
      {returnTo !== "/dash" ? (
        <input type="hidden" name="callbackUrl" value={returnTo} />
      ) : null}
      <Field
        label="Name"
        name="name"
        required
        autoComplete="name"
        defaultValue={values?.name}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
        defaultValue={values?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
      />
      <Field
        label="Confirm password"
        name="passwordConfirm"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
      />

      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}

      <p className="text-xs leading-relaxed text-muted">
        By creating an account you agree we may email you about your{" "}
        {APP_NAME} account (verification, password resets, and connection
        notices). See our{" "}
        <Link href="/privacy" className="font-medium text-accent underline">
          privacy policy
        </Link>
        .
      </p>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={loginHref} className="font-medium text-accent underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);
  const returnTo = callbackUrl || "/dash";
  const signupHref = `/signup?callbackUrl=${encodeURIComponent(returnTo)}`;

  return (
    <form key={state.formKey ?? 0} action={action} className="space-y-4">
      {returnTo !== "/dash" ? (
        <input type="hidden" name="callbackUrl" value={returnTo} />
      ) : null}
      <Field
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
        defaultValue={state.values?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
      />

      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-sm text-muted">
        <Link href="/forgot" className="font-medium text-accent underline">
          Forgot password?
        </Link>
      </p>

      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href={signupHref} className="font-medium text-accent underline">
          Create an account
        </Link>
      </p>
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
  minLength,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  minLength?: number;
  autoComplete?: string;
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
        minLength={minLength}
        autoComplete={autoComplete}
      />
    </label>
  );
}
