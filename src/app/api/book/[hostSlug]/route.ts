import { NextResponse } from "next/server";
import { createBooking } from "@/lib/booking";
import { getOptionalUser } from "@/lib/current-user";
import { ZodError } from "zod";

export async function POST(
  request: Request,
  context: { params: Promise<{ hostSlug: string }> },
) {
  const { hostSlug } = await context.params;

  try {
    const body = await request.json();
    const viewer = await getOptionalUser();
    const booking = await createBooking({
      hostSlug,
      input: body,
      guestUserId: viewer?.id,
    });
    return NextResponse.json({ booking });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    const message = err instanceof Error ? err.message : "Booking failed";
    const status =
      message.includes("not found") || message.includes("no longer available")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
