/** Common IANA time zones first, then the rest available in this runtime. */
const PREFERRED = [
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Zurich",
  "Europe/Stockholm",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "UTC",
] as const;

/** Friendlier city / region labels for preferred zones. */
const CITY_LABELS: Record<string, string> = {
  "Europe/London": "London",
  "Europe/Dublin": "Dublin",
  "Europe/Paris": "Paris",
  "Europe/Berlin": "Berlin",
  "Europe/Amsterdam": "Amsterdam",
  "Europe/Madrid": "Madrid",
  "Europe/Rome": "Rome",
  "Europe/Zurich": "Zurich",
  "Europe/Stockholm": "Stockholm",
  "America/New_York": "New York",
  "America/Chicago": "Chicago",
  "America/Denver": "Denver",
  "America/Los_Angeles": "Los Angeles",
  "America/Toronto": "Toronto",
  "America/Vancouver": "Vancouver",
  "Australia/Sydney": "Sydney",
  "Australia/Melbourne": "Melbourne",
  "Pacific/Auckland": "Auckland",
  "Asia/Dubai": "Dubai",
  "Asia/Singapore": "Singapore",
  "Asia/Hong_Kong": "Hong Kong",
  "Asia/Tokyo": "Tokyo",
  UTC: "UTC",
};

function allIanaZones(): string[] {
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (supported?.length) return [...supported].sort((a, b) => a.localeCompare(b));
  } catch {
    // ignore
  }
  return [...PREFERRED];
}

/** Deduped list for <select>: preferred first, then remaining IANA zones. */
export function listTimezones(): string[] {
  const all = allIanaZones();
  const preferred = PREFERRED.filter((z) => all.includes(z));
  const rest = all.filter((z) => !PREFERRED.includes(z as (typeof PREFERRED)[number]));
  return [...preferred, ...rest];
}

export function isValidTimezone(value: string): boolean {
  return listTimezones().includes(value);
}

/** Current offset for a zone, e.g. "GMT", "GMT+1", "GMT-5", "GMT+5:30". */
export function formatGmtOffset(
  timeZone: string,
  at: Date = new Date(),
): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(at);
    const raw =
      parts.find((p) => p.type === "timeZoneName")?.value?.toUpperCase() ??
      "GMT";
    // Normalize GMT0 / UTC → GMT; GMT+01:00 → GMT+1; GMT+05:30 → GMT+5:30
    let s = raw.replace(/^UTC/, "GMT");
    if (s === "GMT" || s === "GMT+0" || s === "GMT-0" || s === "GMT+00:00") {
      return "GMT";
    }
    s = s.replace(/^GMT([+-])0?(\d+)(?::?00)?$/, (_, sign, hour) => {
      return `GMT${sign}${Number(hour)}`;
    });
    s = s.replace(/^GMT([+-])0?(\d+):(\d+)$/, (_, sign, hour, min) => {
      const m = Number(min);
      return m === 0
        ? `GMT${sign}${Number(hour)}`
        : `GMT${sign}${Number(hour)}:${String(m).padStart(2, "0")}`;
    });
    return s;
  } catch {
    return "GMT";
  }
}

export function timezoneCityLabel(timeZone: string): string {
  if (CITY_LABELS[timeZone]) return CITY_LABELS[timeZone];
  const leaf = timeZone.split("/").pop() ?? timeZone;
  return leaf.replace(/_/g, " ");
}

/** Compact public display: "GMT · London" or "GMT+1 · Paris". */
export function formatTimezoneDisplay(
  timeZone: string,
  at: Date = new Date(),
): string {
  const offset = formatGmtOffset(timeZone, at);
  const city = timezoneCityLabel(timeZone);
  if (timeZone === "UTC") return offset === "GMT" ? "GMT" : offset;
  return `${offset} · ${city}`;
}

/** Select option text: "GMT+1 · Paris". */
export function formatTimezoneOptionLabel(
  timeZone: string,
  at: Date = new Date(),
): string {
  return formatTimezoneDisplay(timeZone, at);
}
