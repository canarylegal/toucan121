"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { registerUser, signupSchema } from "@/lib/register";
import { safeCallbackPath } from "@/lib/safe-callback";
import { ZodError } from "zod";

export type SignupValues = {
  name: string;
  email: string;
};

export type AuthFormState = {
  error?: string;
  values?: SignupValues;
  /** Bump to remount the form so defaultValues apply after an error. */
  formKey?: number;
};

function readSignupValues(formData: FormData): SignupValues {
  return {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
}

function friendlySignupError(err: unknown): string {
  if (err instanceof ZodError) {
    return err.issues[0]?.message ?? "Invalid input";
  }
  if (err instanceof AuthError) {
    return "Account created, but sign-in failed. Try logging in.";
  }
  if (err instanceof Error) {
    const msg = err.message;
    if (msg.includes("Unique constraint") || msg.includes("already exists")) {
      return "An account with that email already exists";
    }
    if (
      msg.includes("prisma.") ||
      msg.includes("Invalid `") ||
      msg.includes("Unknown argument")
    ) {
      console.error("[signup]", err);
      return "Could not create account. Please try again.";
    }
    return msg;
  }
  return "Could not create account";
}

export async function signupAction(
  prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = readSignupValues(formData);
  const formKey = (prev.formKey ?? 0) + 1;

  try {
    const raw = {
      ...values,
      password: String(formData.get("password") ?? ""),
      passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
    };
    const parsed = signupSchema.parse(raw);
    await registerUser(parsed);
    await signIn("credentials", {
      email: parsed.email,
      password: parsed.password,
      redirect: false,
    });
  } catch (err) {
    return {
      error: friendlySignupError(err),
      values,
      formKey,
    };
  }

  const callback = safeCallbackPath(formData.get("callbackUrl"));
  if (!callback || callback === "/dash") {
    redirect("/dash/welcome");
  }
  redirect(callback);
}

export async function loginAction(
  prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const formKey = (prev.formKey ?? 0) + 1;
  const values: SignupValues = {
    name: "",
    email,
  };

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Invalid email or password", values, formKey };
    }
    return { error: "Could not sign in", values, formKey };
  }

  redirect(safeCallbackPath(formData.get("callbackUrl")));
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
