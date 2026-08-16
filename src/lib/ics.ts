import ical, { ICalCalendarMethod, ICalEventStatus } from "ical-generator";
import { APP_NAME } from "@/lib/brand";

export type InviteInput = {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: Date;
  endsAt: Date;
  organizerName: string;
  organizerEmail: string;
  guestName: string;
  guestEmail: string;
  url?: string;
};

/** Build a METHOD:REQUEST .ics for guest mailbox acceptance. */
export function buildCalendarInvite(input: InviteInput): string {
  const calendar = ical({
    name: `${APP_NAME} Booking`,
    method: ICalCalendarMethod.REQUEST,
  });

  calendar.createEvent({
    id: input.uid,
    start: input.startsAt,
    end: input.endsAt,
    summary: input.title,
    description: input.description,
    location: input.location,
    url: input.url,
    organizer: {
      name: input.organizerName,
      email: input.organizerEmail,
    },
    attendees: [
      {
        name: input.guestName,
        email: input.guestEmail,
        rsvp: true,
      },
    ],
  });

  return calendar.toString();
}

/** Build a METHOD:CANCEL .ics so guests can remove the event. */
export function buildCalendarCancel(input: InviteInput): string {
  const calendar = ical({
    name: `${APP_NAME} Booking`,
    method: ICalCalendarMethod.CANCEL,
  });

  calendar.createEvent({
    id: input.uid,
    start: input.startsAt,
    end: input.endsAt,
    summary: input.title,
    description: input.description,
    location: input.location,
    url: input.url,
    status: ICalEventStatus.CANCELLED,
    sequence: 1,
    organizer: {
      name: input.organizerName,
      email: input.organizerEmail,
    },
    attendees: [
      {
        name: input.guestName,
        email: input.guestEmail,
        rsvp: false,
      },
    ],
  });

  return calendar.toString();
}
