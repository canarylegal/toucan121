-- CreateEnum
CREATE TYPE "VenuePolicy" AS ENUM ('HOST_FIXED', 'GUEST_PROPOSES');

-- AlterTable
ALTER TABLE "MeetingType" ADD COLUMN "venuePolicy" "VenuePolicy" NOT NULL DEFAULT 'HOST_FIXED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "venue" TEXT NOT NULL DEFAULT '';
