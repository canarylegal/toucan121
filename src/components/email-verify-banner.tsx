import { resendVerifyEmailAction } from "@/lib/account-actions";

export function EmailVerifyBanner() {
  return (
    <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
      <p className="font-medium">Confirm your email</p>
      <p className="mt-1">
        We sent a link to your inbox. You need it confirmed before hosting or
        adding connections.
      </p>
      <form action={resendVerifyEmailAction} className="mt-2">
        <button
          type="submit"
          className="font-medium text-accent underline hover:text-foreground"
        >
          Resend confirm email
        </button>
      </form>
    </div>
  );
}
