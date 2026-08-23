-- CreateTable
CREATE TABLE "ReminderSuppression" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "recipient" "ReminderRecipient" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReminderSuppression_email_recipient_key" ON "ReminderSuppression"("email", "recipient");

-- CreateIndex
CREATE INDEX "ReminderSuppression_email_idx" ON "ReminderSuppression"("email");
