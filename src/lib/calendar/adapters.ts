/**
 * Calendar adapters — stubs for the thin vertical slice.
 * Real CalDAV / Microsoft Graph implementations plug in here later.
 */

export type BusyBlock = {
  startsAt: Date;
  endsAt: Date;
  title?: string;
};

export type CalendarEventInput = {
  title: string;
  description?: string;
  location?: string;
  startsAt: Date;
  endsAt: Date;
  attendeeEmail?: string;
  /**
   * Stable iCal UID. Must match the .ics emailed to guests so clients
   * dedupe against the CalDAV/Graph copy (especially self-bookings).
   */
  uid?: string;
};

export type CalendarAdapter = {
  listBusy(rangeStart: Date, rangeEnd: Date): Promise<BusyBlock[]>;
  createEvent(input: CalendarEventInput): Promise<{ eventId: string }>;
  cancelEvent(eventId: string): Promise<void>;
};

/** In-memory adapter used until CalDAV/Outlook connectors are wired. */
export function createLocalBusyAdapter(existing: BusyBlock[] = []): CalendarAdapter {
  const busy = [...existing];
  return {
    async listBusy(rangeStart, rangeEnd) {
      return busy.filter((b) => b.startsAt < rangeEnd && b.endsAt > rangeStart);
    },
    async createEvent(input) {
      const eventId = `local-${Date.now()}`;
      busy.push({
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        title: input.title,
      });
      console.info("[toucan:calendar] wrote local event", { eventId, ...input });
      return { eventId };
    },
    async cancelEvent(eventId) {
      console.info("[toucan:calendar] cancel stub", eventId);
    },
  };
}

export function createCalDavAdapterStub(): CalendarAdapter {
  return {
    async listBusy() {
      console.warn("[toucan:caldav] stub — returning no busy blocks");
      return [];
    },
    async createEvent(input) {
      console.warn("[toucan:caldav] stub createEvent", input);
      return { eventId: `caldav-stub-${Date.now()}` };
    },
    async cancelEvent(eventId) {
      console.warn("[toucan:caldav] stub cancelEvent", eventId);
    },
  };
}

export function createOutlookAdapterStub(): CalendarAdapter {
  return {
    async listBusy() {
      console.warn("[toucan:outlook] stub — returning no busy blocks");
      return [];
    },
    async createEvent(input) {
      console.warn("[toucan:outlook] stub createEvent", input);
      return { eventId: `outlook-stub-${Date.now()}` };
    },
    async cancelEvent(eventId) {
      console.warn("[toucan:outlook] stub cancelEvent", eventId);
    },
  };
}
