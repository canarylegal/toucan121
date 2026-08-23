"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { ZodError } from "zod";
import { requireUser } from "@/lib/current-user";
import { enableHosting, enableHostingSchema } from "@/lib/register";
import { prisma } from "@/lib/db";

export type HostingFormState = {
  error?: string;
  values?: {
    name: string;
    businessName: string;
    timezone: string;
    suffix: string;
  };
  formKey?: number;
};

function readValues(formData: FormData): NonNullable<HostingFormState["values"]> {
  return {
    name: String(formData.get("name") ?? ""),
    businessName: String(formData.get("businessName") ?? ""),
    timezone: String(formData.get("timezone") ?? "Europe/London"),
    suffix: String(formData.get("suffix") ?? ""),
  };
}

export async function enableHostingAction(
  prev: HostingFormState,
  formData: FormData,
): Promise<HostingFormState> {
  const values = readValues(formData);
  const formKey = (prev.formKey ?? 0) + 1;

  try {
    const user = await requireUser();
    if (!user.emailVerified) {
      return {
        error:
          "Confirm your email before you start hosting — check your inbox.",
        values,
        formKey,
      };
    }
    const existing = await prisma.host.findUnique({
      where: { userId: user.id },
    });
    if (existing?.hostingActive && existing.bookingEnabled) {
      redirect("/dash");
    }

    const parsed = enableHostingSchema.parse(values);
    await enableHosting(user.id, parsed);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof ZodError) {
      return {
        error: err.issues[0]?.message ?? "Invalid input",
        values,
        formKey,
      };
    }
    return {
      error: err instanceof Error ? err.message : "Could not enable hosting",
      values,
      formKey,
    };
  }

  redirect("/dash?hostingEnabled=1");
}
