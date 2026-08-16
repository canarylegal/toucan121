-- AlterEnum
ALTER TYPE "BookingApprovalMode" ADD VALUE IF NOT EXISTS 'CONNECTIONS';

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- CreateTable
CREATE TABLE "UserConnection" (
    "id" TEXT NOT NULL,
    "userLowId" TEXT NOT NULL,
    "userHighId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserConnection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserConnection_ordered_pair" CHECK ("userLowId" < "userHighId"),
    CONSTRAINT "UserConnection_requester_in_pair" CHECK ("requestedById" = "userLowId" OR "requestedById" = "userHighId")
);

CREATE UNIQUE INDEX "UserConnection_userLowId_userHighId_key" ON "UserConnection"("userLowId", "userHighId");
CREATE INDEX "UserConnection_userLowId_status_idx" ON "UserConnection"("userLowId", "status");
CREATE INDEX "UserConnection_userHighId_status_idx" ON "UserConnection"("userHighId", "status");
CREATE INDEX "UserConnection_requestedById_status_idx" ON "UserConnection"("requestedById", "status");

ALTER TABLE "UserConnection" ADD CONSTRAINT "UserConnection_userLowId_fkey" FOREIGN KEY ("userLowId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserConnection" ADD CONSTRAINT "UserConnection_userHighId_fkey" FOREIGN KEY ("userHighId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserConnection" ADD CONSTRAINT "UserConnection_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
