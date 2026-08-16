-- AlterEnum
CREATE TYPE "BookingApprovalMode" AS ENUM ('AUTO', 'MANUAL', 'CONDITIONAL');

-- AlterEnum
CREATE TYPE "BookingPendingOn" AS ENUM ('HOST', 'GUEST');

-- AlterTable
ALTER TABLE "MeetingType" ADD COLUMN "approvalMode" "BookingApprovalMode" NOT NULL DEFAULT 'AUTO';
ALTER TABLE "MeetingType" ADD COLUMN "approvalRulesJson" TEXT NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "pendingOn" "BookingPendingOn";
ALTER TABLE "Booking" ADD COLUMN "manageToken" TEXT;

-- Backfill tokens for existing bookings
UPDATE "Booking" SET "manageToken" = md5(random()::text || id) WHERE "manageToken" IS NULL;

ALTER TABLE "Booking" ALTER COLUMN "manageToken" SET NOT NULL;
CREATE UNIQUE INDEX "Booking_manageToken_key" ON "Booking"("manageToken");
CREATE INDEX "Booking_hostId_status_pendingOn_idx" ON "Booking"("hostId", "status", "pendingOn");
