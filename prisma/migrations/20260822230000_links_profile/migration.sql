-- AlterEnum
ALTER TYPE "HostingPreference" ADD VALUE IF NOT EXISTS 'LINKS';

-- AlterTable
ALTER TABLE "Host" ADD COLUMN IF NOT EXISTS "bookingEnabled" BOOLEAN NOT NULL DEFAULT true;
