-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AlterTable
ALTER TABLE "Host" ADD COLUMN "userId" TEXT;

-- Backfill: one User per existing Host (password: password123)
INSERT INTO "User" ("id", "email", "passwordHash", "name", "createdAt", "updatedAt")
SELECT
  'user_' || "id",
  "email",
  '$2b$12$TBKAbGeE4/GPtg6JP5g/4eO4nyClicdggfFoy3wpf3K8EINQUQx4O',
  "name",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Host"
WHERE "userId" IS NULL;

UPDATE "Host" h
SET "userId" = 'user_' || h."id"
WHERE h."userId" IS NULL;

-- Enforce required relation
ALTER TABLE "Host" ALTER COLUMN "userId" SET NOT NULL;
CREATE UNIQUE INDEX "Host_userId_key" ON "Host"("userId");
ALTER TABLE "Host" ADD CONSTRAINT "Host_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
