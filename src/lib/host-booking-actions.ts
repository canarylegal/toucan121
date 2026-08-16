"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";
import { requireHost } from "@/lib/current-user";
import { createBooking } from "@/lib/booking";

export type HostBookingFormState = {
  error?: string;
  values?: {
    meetingTypeId: string;
    guestName: string;
    guestEmail: string;
    notes: string;
    startsAt: string;
    venue: string;
  };
  formKey?: number;
};

const schema = z.object({
  meetingTypeId: z.string().min(1),
  startsAt: z.string().datetime(),
  guestName: z.string().trim().min(1).max(120),
  guestEmail: z.string().trim().email(),
  notes: z.string().trim().max(2000).optional(),
  venue: z.string().trim().max(300).optional(),
});

export async function createHostBookingAction(
  prev: HostBookingFormState,
  formData: FormData,
): Promise<HostBookingFormState> {
  const values = {
    meetingTypeId: String(formData.get("meetingTypeId") ?? ""),
    startsAt: String(formData.get("startsAt") ?? ""),
    guestName: String(formData.get("guestName") ?? ""),
    guestEmail: String(formData.get("guestEmail") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    venue: String(formData.get("venue") ?? ""),
  };
  const formKey = (prev.formKey ?? 0) + 1;

  try {
    const host = await requireHost();

    const parsed = schema.parse(values);
    await createBooking({
      hostId: host.id,
      initiatedBy: "host",
      allowInactiveMeetingType: true,
      input: {
        meetingTypeId: parsed.meetingTypeId,
        startsAt: parsed.startsAt,
        guestName: parsed.guestName,
        guestEmail: parsed.guestEmail,
        notes: parsed.notes,
        venue: parsed.venue,
        emailOptIn: true,
      },
    });

    revalidatePath("/dash");
    revalidatePath("/dash/bookings/new");
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        error: err.issues[0]?.message ?? "Invalid input",
        values,
        formKey,
      };
    }
    return {
      error: err instanceof Error ? err.message : "Could not create booking",
      values,
      formKey,
    };
  }

  redirect("/dash?booked=1");
}
