import { randomBytes } from "crypto";

/** Create a unique Jitsi room URL for a booking. */
export function createJitsiRoomUrl(opts?: {
  baseUrl?: string;
  prefix?: string;
}): string {
  const base = (
    opts?.baseUrl ??
    process.env.JITSI_BASE_URL ??
    "https://meet.jit.si"
  ).replace(/\/$/, "");
  const prefix = opts?.prefix ?? "toucan";
  const token = randomBytes(8).toString("hex");
  return `${base}/${prefix}-${token}`;
}

/** Resolve the join URL for a VIDEO meeting type (custom standing link or new Jitsi room). */
export function resolveMeetingVideoUrl(meetingType: {
  locationType: string;
  videoUrl?: string | null;
}): string | null {
  if (meetingType.locationType !== "VIDEO") return null;
  const custom = meetingType.videoUrl?.trim();
  if (custom) return custom;
  return createJitsiRoomUrl();
}
