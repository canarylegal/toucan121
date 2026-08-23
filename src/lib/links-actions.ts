"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { ZodError } from "zod";
import { requireUser } from "@/lib/current-user";
import { enableLinksProfile, enableHostingSchema } from "@/lib/register";
import { prisma } from "@/lib/db";

export type LinksFormState = {
  error?: string;
  values?: {
    name: string;
    businessName: string;
    timezone: string;
    suffix: string;
  };
  formKey?: number;
};

function readValues(formData: FormData): NonNullable<LinksFormState["values"]> {
  return {
    name: String(formData.get("name") ?? ""),
    businessName: String(formData.get("businessName") ?? ""),
    timezone: String(formData.get("timezone") ?? "Europe/London"),
    suffix: String(formData.get("suffix") ?? ""),
  };
}

export async function enableLinksProfileAction(
  prev: LinksFormState,
  formData: FormData,
): Promise<LinksFormState> {
  const values = readValues(formData);
  const formKey = (prev.formKey ?? 0) + 1;

  try {
    const user = await requireUser();
    if (!user.emailVerified) {
      return {
        error:
          "Confirm your email before you publish a profile — check your inbox.",
        values,
        formKey,
      };
    }
    const existing = await prisma.host.findUnique({
      where: { userId: user.id },
    });
    if (existing?.hostingActive && !existing.bookingEnabled) {
      redirect("/dash");
    }
    if (existing?.hostingActive && existing.bookingEnabled) {
      redirect("/dash");
    }
    if (existing && !existing.hostingActive) {
      const parsed = enableHostingSchema.parse(values);
      await enableLinksProfile(user.id, parsed);
      redirect("/dash?linksEnabled=1");
    }

    const parsed = enableHostingSchema.parse(values);
    await enableLinksProfile(user.id, parsed);
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
      error:
        err instanceof Error ? err.message : "Could not create links profile",
      values,
      formKey,
    };
  }

  redirect("/dash?linksEnabled=1");
}
