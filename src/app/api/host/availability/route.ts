import { NextResponse } from "next/server";
import { getOptionalHost } from "@/lib/current-user";
import { listSlotsForMeetingType } from "@/lib/booking";
import { dayKeyInZone, formatSlotTime } from "@/lib/availability";

export async function GET(request: Request) {
  const hostRecord = await getOptionalHost();
  if (!hostRecord) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meetingTypeId = new URL(request.url).searchParams.get("meetingTypeId");
  if (!meetingTypeId) {
    return NextResponse.json(
      { error: "meetingTypeId is required" },
      { status: 400 },
    );
  }

  const excludeBookingId = new URL(request.url).searchParams.get(
    "excludeBookingId",
  );

  try {
    const { host, meetingType, candidates } = await listSlotsForMeetingType({
      hostId: hostRecord.id,
      meetingTypeId,
      allowInactive: true,
      excludeBookingId: excludeBookingId || undefined,
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
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
