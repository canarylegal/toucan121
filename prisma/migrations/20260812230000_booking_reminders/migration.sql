-- CreateEnum
CREATE TYPE "ReminderRecipient" AS ENUM ('HOST', 'GUEST');
CREATE TYPE "ReminderKind" AS ENUM ('RECURRING', 'FINAL');

-- AlterTable MeetingType
ALTER TABLE "MeetingType" ADD COLUMN "hostReminderJson" TEXT NOT NULL DEFAULT '{"recurring":{"enabled":false,"every":1,"unit":"WEEKS"},"final":{"enabled":true,"amount":24,"unit":"HOURS"}}';
ALTER TABLE "MeetingType" ADD COLUMN "guestReminderJson" TEXT NOT NULL DEFAULT '{"recurring":{"enabled":false,"every":1,"unit":"WEEKS"},"final":{"enabled":true,"amount":24,"unit":"HOURS"}}';

-- AlterTable Booking
ALTER TABLE "Booking" ADD COLUMN "hostReminderJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Booking" ADD COLUMN "guestReminderJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Booking" ADD COLUMN "confirmedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BookingReminder" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "recipient" "ReminderRecipient" NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingReminder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingReminder_scheduledFor_sentAt_cancelledAt_idx" ON "BookingReminder"("scheduledFor", "sentAt", "cancelledAt");
CREATE INDEX "BookingReminder_bookingId_idx" ON "BookingReminder"("bookingId");

ALTER TABLE "BookingReminder" ADD CONSTRAINT "BookingReminder_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
