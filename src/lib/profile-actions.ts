"use server";

import { revalidatePath } from "next/cache";
import { updateHostProfile, profileSchema } from "@/lib/profile";
import type { ProfileFormValues } from "@/lib/profile";
import { parseSocialOrder } from "@/lib/social-order";
import { requireHost } from "@/lib/current-user";
import { ZodError } from "zod";

export type ProfileFormState = {
  error?: string;
  success?: string;
  values?: Omit<ProfileFormValues, "avatarPath">;
  formKey?: number;
};

function readValues(formData: FormData): Omit<ProfileFormValues, "avatarPath"> {
  return {
    name: String(formData.get("name") ?? ""),
    headline: String(formData.get("headline") ?? ""),
    businessName: String(formData.get("businessName") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    websiteUrl: String(formData.get("websiteUrl") ?? ""),
    publicEmail: String(formData.get("publicEmail") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    linkedinUrl: String(formData.get("linkedinUrl") ?? ""),
    facebookUrl: String(formData.get("facebookUrl") ?? ""),
    instagramUrl: String(formData.get("instagramUrl") ?? ""),
    tiktokUrl: String(formData.get("tiktokUrl") ?? ""),
    xUrl: String(formData.get("xUrl") ?? ""),
    youtubeUrl: String(formData.get("youtubeUrl") ?? ""),
    socialOrder: parseSocialOrder(String(formData.get("socialOrderJson") ?? "[]")),
    timezone: String(formData.get("timezone") ?? "Europe/London"),
    bookingHorizonDays: Number(formData.get("bookingHorizonDays") ?? 60),
  };
}

export async function updateProfileAction(
  prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const values = readValues(formData);
  const formKey = (prev.formKey ?? 0) + 1;
  const removeAvatar = formData.get("removeAvatar") === "on";
  const avatar = formData.get("avatar");
  const avatarFile = avatar instanceof File ? avatar : null;

  try {
    const hostRecord = await requireHost();
    const parsed = profileSchema.parse({
      ...values,
      socialOrderJson: JSON.stringify(values.socialOrder),
      removeAvatar,
    });
    const host = await updateHostProfile({
      hostId: hostRecord.id,
      userId: hostRecord.userId,
      input: parsed,
      avatarFile,
    });

    revalidatePath("/dash");
    revalidatePath("/dash/profile");
    revalidatePath(`/${host.slug}`);

    return {
      success: "Profile saved",
      values: {
        name: host.name,
        headline: host.headline,
        businessName: host.businessName,
        bio: host.bio,
        websiteUrl: host.websiteUrl,
        publicEmail: host.publicEmail,
        phone: host.phone,
        linkedinUrl: host.linkedinUrl,
        facebookUrl: host.facebookUrl,
        instagramUrl: host.instagramUrl,
        tiktokUrl: host.tiktokUrl,
        xUrl: host.xUrl,
        youtubeUrl: host.youtubeUrl,
        socialOrder: parseSocialOrder(host.socialOrderJson),
        timezone: host.timezone,
        bookingHorizonDays: host.bookingHorizonDays,
      },
      formKey,
    };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        error: err.issues[0]?.message ?? "Invalid input",
        values,
        formKey,
      };
    }
    return {
      error: err instanceof Error ? err.message : "Could not save profile",
      values,
      formKey,
    };
  }
}
