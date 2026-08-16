-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "actionPoints" TEXT NOT NULL DEFAULT '',
ADD COLUMN "actionPointsDone" BOOLEAN NOT NULL DEFAULT true;
