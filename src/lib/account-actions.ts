"use server";

import { compare, hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { signIn } from "@/lib/auth";
import { requireUser } from "@/lib/current-user";
import { sendAuthEmail } from "@/lib/email";
import { renderNoticeEmail } from "@/lib/email-templates";
import { APP_NAME } from "@/lib/brand";
import {
  appBaseUrl,
  consumeEmailToken,
  issueEmailToken,
} from "@/lib/email-tokens";
import { sendVerifyEmailForUser } from "@/lib/account-mail";

const GENERIC_RESET =
  "If that email has a Toucan account, we sent a reset link.";

const passwordSchema = z.string().min(8).max(128);

export type AccountFormState = {
  error?: string;
  success?: string;
};

function changeSchema() {
  return z
    .object({
      currentPassword: z.string().min(1),
      password: passwordSchema,
      passwordConfirm: z.string().min(1),
    })
    .refine((d) => d.password === d.passwordConfirm, {
      message: "Passwords do not match",
      path: ["passwordConfirm"],
    });
}

export async function requestPasswordResetAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    return { error: "Enter the email for your account." };
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, name: true },
  });
  if (user) {
    try {
      const raw = await issueEmailToken(user.id, "PASSWORD_RESET");
      const url = `${appBaseUrl()}/reset/${raw}`;
      const mail = renderNoticeEmail({
        subject: `Reset your ${APP_NAME} password`,
        title: "Reset your password",
        greeting: `Hi ${user.name},`,
        intro: `Use the button below to choose a new password for your ${APP_NAME} account.`,
        primaryCta: { label: "Choose a new password", url },
        footerNote: "This link expires in 1 hour. If you did not ask for a reset, you can ignore this message.",
      });
      await sendAuthEmail({
        to: user.email,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
    } catch (err) {
      console.error("[auth] reset email", err);
    }
  }

  return { success: GENERIC_RESET };
}

export async function resetPasswordAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const token = String(formData.get("token") ?? "");
  const parsed = z
    .object({
      password: passwordSchema,
      passwordConfirm: z.string().min(1),
    })
    .refine((d) => d.password === d.passwordConfirm, {
      message: "Passwords do not match",
      path: ["passwordConfirm"],
    })
    .safeParse({
      password: String(formData.get("password") ?? ""),
      passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid password" };
  }

  const consumed = await consumeEmailToken(token, "PASSWORD_RESET");
  if (!consumed) {
    return { error: "That reset link is invalid or has expired." };
  }

  const passwordHash = await hash(parsed.data.password, 12);
  const user = await prisma.user.update({
    where: { id: consumed.userId },
    data: { passwordHash },
    select: { email: true },
  });

  await signIn("credentials", {
    email: user.email,
    password: parsed.data.password,
    redirect: false,
  });

  redirect("/dash");
}

export async function changePasswordAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await requireUser();
  const parsed = changeSchema().safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    password: String(formData.get("password") ?? ""),
    passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid password" };
  }

  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row) return { error: "Account not found" };

  const ok = await compare(parsed.data.currentPassword, row.passwordHash);
  if (!ok) return { error: "Current password is incorrect." };

  const passwordHash = await hash(parsed.data.password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  const mail = renderNoticeEmail({
    subject: `Your ${APP_NAME} password was changed`,
    title: "Password changed",
    greeting: `Hi ${row.name},`,
    intro: `Your ${APP_NAME} password was just changed. If that was not you, reset it from the sign-in page.`,
    primaryCta: {
      label: "Sign in",
      url: `${appBaseUrl()}/login`,
    },
  });
  await sendAuthEmail({
    to: row.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  }).catch((err) => console.error("[auth] password-changed email", err));

  return { success: "Password updated." };
}

export async function resendVerifyEmailAction(): Promise<void> {
  const session = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
  if (!user || user.emailVerifiedAt) return;

  await sendVerifyEmailForUser(user).catch((err) =>
    console.error("[auth] verify email", err),
  );
}
