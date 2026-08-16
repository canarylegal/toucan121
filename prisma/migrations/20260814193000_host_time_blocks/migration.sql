-- AlterTable
ALTER TABLE "Host" ALTER COLUMN "scheduleView" SET DEFAULT 'WEEK';

-- CreateTable
CREATE TABLE "HostTimeBlock" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "calendarEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostTimeBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HostTimeBlock_hostId_startsAt_idx" ON "HostTimeBlock"("hostId", "startsAt");

-- AddForeignKey
ALTER TABLE "HostTimeBlock" ADD CONSTRAINT "HostTimeBlock_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE CASCADE ON UPDATE CASCADE;
