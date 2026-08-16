import { NextResponse } from "next/server";
import { getOptionalHost } from "@/lib/current-user";
import {
  getHostExternalScheduleItems,
  rangeInZone,
} from "@/lib/host-schedule";

export async function GET(request: Request) {
  const host = await getOptionalHost();
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = new URL(request.url).searchParams;
  const start = sp.get("start") ?? "";
  const end = sp.get("end") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return NextResponse.json(
      { error: "start and end (yyyy-MM-dd) are required" },
      { status: 400 },
    );
  }

  try {
    const { rangeStart, rangeEnd } = rangeInZone(start, end, host.timezone);
    const { items, error } = await getHostExternalScheduleItems({
      hostId: host.id,
      timezone: host.timezone,
      rangeStart,
      rangeEnd,
    });
    return NextResponse.json({ items, error: error ?? null });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load calendar busy";
    return NextResponse.json({ error: message, items: [] }, { status: 400 });
  }
}
