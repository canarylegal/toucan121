-- CreateEnum
CREATE TYPE "ScheduleViewMode" AS ENUM ('DAY', 'WEEK', 'MONTH', 'LIST');

-- AlterTable
ALTER TABLE "Host" ADD COLUMN "scheduleView" "ScheduleViewMode" NOT NULL DEFAULT 'MONTH';
