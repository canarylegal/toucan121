-- CreateEnum
CREATE TYPE "ProfileLayoutMode" AS ENUM ('BOOK_FIRST', 'LINKS_FIRST');

-- AlterTable
ALTER TABLE "Host" ADD COLUMN "profileLayoutMode" "ProfileLayoutMode" NOT NULL DEFAULT 'BOOK_FIRST';
ALTER TABLE "Host" ADD COLUMN "profileStackOrderJson" TEXT NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "HostLink" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HostLink_hostId_idx" ON "HostLink"("hostId");

-- AddForeignKey
ALTER TABLE "HostLink" ADD CONSTRAINT "HostLink_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE CASCADE ON UPDATE CASCADE;
