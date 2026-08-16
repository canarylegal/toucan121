import { NextResponse } from "next/server";
import { listSlotsForMeetingType } from "@/lib/booking";
import { dayKeyInZone, formatSlotTime } from "@/lib/availability";

/** Public availability for a host profile booking calendar. */
export async function GET(
  request: Request,
  context: { params: Promise<{ hostSlug: string }> },
) {
  const { hostSlug } = await context.params;
  const meetingTypeSlug = new URL(request.url).searchParams.get(
    "meetingTypeSlug",
  );
  if (!meetingTypeSlug) {
    return NextResponse.json(
      { error: "meetingTypeSlug is required" },
      { status: 400 },
    );
  }

  try {
    const { host, meetingType, candidates } = await listSlotsForMeetingType({
      hostSlug,
      meetingTypeSlug,
    });

    return NextResponse.json({
      timezone: host.timezone,
      meetingType: {
        id: meetingType.id,
        title: meetingType.title,
        slug: meetingType.slug,
        durationMins: meetingType.durationMins,
      },
      candidates: candidates.map((c) => ({
        value: c.startsAt.toISOString(),
        dayKey: dayKeyInZone(c.startsAt, host.timezone),
        timeLabel: formatSlotTime(c.startsAt, host.timezone),
        available: c.available,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load slots";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
