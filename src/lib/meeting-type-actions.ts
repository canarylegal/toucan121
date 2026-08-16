"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireHost } from "@/lib/current-user";
import {
  createMeetingType,
  deleteMeetingType,
  meetingTypeSchema,
  parseWindowsFromJson,
  setMeetingTypeActive,
  updateMeetingType,
} from "@/lib/meeting-types";
import {
  DEFAULT_REMINDER_PREFS,
  reminderPrefsFromFormData,
  type ReminderPrefs,
} from "@/lib/reminders";

export type MeetingTypeFormState = {
  error?: string;
  success?: string;
  values?: {
    title: string;
    description: string;
    durationMins: string;
    bufferBefore: string;
    bufferAfter: string;
    locationType: "VIDEO" | "IN_PERSON";
    venuePolicy: "HOST_FIXED" | "GUEST_PROPOSES";
    locationNote: string;
    videoMode: "jitsi" | "custom";
    videoUrl: string;
    suffix: string;
    active: boolean;
    approvalMode: "AUTO" | "MANUAL" | "CONDITIONAL" | "CONNECTIONS";
    requireKnownGuest: boolean;
    minNoticeHours: string;
    hostReminder: ReminderPrefs;
    guestReminder: ReminderPrefs;
    availabilityJson: string;
  };
  formKey?: number;
};

function readValues(formData: FormData): NonNullable<MeetingTypeFormState["values"]> {
  const locationType =
    formData.get("locationType") === "IN_PERSON" ? "IN_PERSON" : "VIDEO";
  const venuePolicy =
    formData.get("venuePolicy") === "GUEST_PROPOSES"
      ? "GUEST_PROPOSES"
      : "HOST_FIXED";
  const videoMode =
    formData.get("videoMode") === "custom" ? "custom" : "jitsi";
  const approvalModeRaw = String(formData.get("approvalMode") ?? "AUTO");
  const approvalMode =
    approvalModeRaw === "MANUAL" ||
    approvalModeRaw === "CONDITIONAL" ||
    approvalModeRaw === "CONNECTIONS"
      ? approvalModeRaw
      : "AUTO";

  return {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    durationMins: String(formData.get("durationMins") ?? "30"),
    bufferBefore: String(formData.get("bufferBefore") ?? "0"),
    bufferAfter: String(formData.get("bufferAfter") ?? "0"),
    locationType,
    venuePolicy,
    locationNote: String(formData.get("locationNote") ?? ""),
    videoMode,
    videoUrl: String(formData.get("videoUrl") ?? ""),
    suffix: String(formData.get("suffix") ?? ""),
    active: formData.get("active") === "on",
    approvalMode,
    requireKnownGuest: formData.get("requireKnownGuest") === "on",
    minNoticeHours: String(formData.get("minNoticeHours") ?? ""),
    hostReminder: reminderPrefsFromFormData(formData, "host"),
    guestReminder: reminderPrefsFromFormData(formData, "guest"),
    availabilityJson: String(formData.get("availabilityJson") ?? "[]"),
  };
}

function toInput(values: NonNullable<MeetingTypeFormState["values"]>) {
  const minRaw = values.minNoticeHours.trim();
  const minNoticeHours =
    minRaw === "" ? null : Number.parseInt(minRaw, 10);

  return meetingTypeSchema.parse({
    title: values.title,
    description: values.description,
    durationMins: values.durationMins,
    bufferBefore: values.bufferBefore,
    bufferAfter: values.bufferAfter,
    locationType: values.locationType,
    venuePolicy: values.venuePolicy,
    locationNote: values.locationNote,
    videoMode: values.videoMode,
    videoUrl:
      values.locationType === "VIDEO" && values.videoMode === "custom"
        ? values.videoUrl.trim()
        : "",
    suffix: values.suffix || undefined,
    active: values.active,
    approvalMode: values.approvalMode,
    approvalRules: {
      requireKnownGuest: values.requireKnownGuest,
      minNoticeHours:
        Number.isFinite(minNoticeHours) && minNoticeHours !== null
          ? minNoticeHours
          : null,
    },
    hostReminder: values.hostReminder ?? DEFAULT_REMINDER_PREFS,
    guestReminder: values.guestReminder ?? DEFAULT_REMINDER_PREFS,
    windows: parseWindowsFromJson(values.availabilityJson),
  });
}

function friendlyError(err: unknown): string {
  if (err instanceof ZodError) {
    return err.issues[0]?.message ?? "Invalid input";
  }
  if (err instanceof Error) {
    if (err.message.includes("Unique constraint")) {
      return "That meeting suffix is already in use";
    }
    return err.message;
  }
  return "Something went wrong";
}

export async function createMeetingTypeAction(
  prev: MeetingTypeFormState,
  formData: FormData,
): Promise<MeetingTypeFormState> {
  const values = readValues(formData);
  const formKey = (prev.formKey ?? 0) + 1;

  try {
    const host = await requireHost();
    await createMeetingType({
      hostId: host.id,
      input: toInput(values),
    });
    revalidatePath("/dash");
    revalidatePath(`/${host.slug}`);
  } catch (err) {
    return { error: friendlyError(err), values, formKey };
  }

  // redirect() must run outside try/catch (Next.js throws a special error)
  redirect("/dash?meetingTypeCreated=1");
}

export async function updateMeetingTypeAction(
  meetingTypeId: string,
  prev: MeetingTypeFormState,
  formData: FormData,
): Promise<MeetingTypeFormState> {
  const values = readValues(formData);
  const formKey = (prev.formKey ?? 0) + 1;

  try {
    const host = await requireHost();
    const mt = await updateMeetingType({
      hostId: host.id,
      meetingTypeId,
      input: toInput(values),
    });
    revalidatePath("/dash");
    revalidatePath(`/dash/meetings/${mt.id}`);
    revalidatePath(`/${host.slug}`);
    revalidatePath(`/${host.slug}/${mt.slug}`);
    return { success: "Meeting type saved", values, formKey };
  } catch (err) {
    return { error: friendlyError(err), values, formKey };
  }
}

export async function toggleMeetingTypeAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  const host = await requireHost();
  const mt = await setMeetingTypeActive({
    hostId: host.id,
    meetingTypeId: id,
    active,
  });
  revalidatePath("/dash");
  revalidatePath(`/${host.slug}`);
  revalidatePath(`/dash/meetings/${mt.id}`);
}

export async function deleteMeetingTypeAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const host = await requireHost();

  try {
    const mt = await deleteMeetingType({
      hostId: host.id,
      meetingTypeId: id,
    });
    revalidatePath("/dash");
    revalidatePath(`/${host.slug}`);
    revalidatePath(`/${host.slug}/${mt.slug}`);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not delete meeting type";
    redirect(
      `/dash/meetings/${id}?error=${encodeURIComponent(message)}`,
    );
  }

  redirect("/dash?deletedMeetingType=1");
}
