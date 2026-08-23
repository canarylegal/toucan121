-- CreateEnum
CREATE TYPE "HostingPreference" AS ENUM ('VISITOR', 'HOST');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "hostingPreference" "HostingPreference";

-- AlterTable
ALTER TABLE "Host" ADD COLUMN "hostingActive" BOOLEAN NOT NULL DEFAULT true;
