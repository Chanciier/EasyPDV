-- CreateTable
CREATE TABLE "ClubReminderLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerCpf" TEXT NOT NULL,
    "daysBeforeExpiry" INTEGER NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClubReminderLog_organizationId_customerCpf_idx" ON "ClubReminderLog"("organizationId", "customerCpf");

-- CreateIndex
CREATE UNIQUE INDEX "ClubReminderLog_organizationId_customerCpf_daysBeforeExpiry_key" ON "ClubReminderLog"("organizationId", "customerCpf", "daysBeforeExpiry", "validUntil");

-- AddForeignKey
ALTER TABLE "ClubReminderLog" ADD CONSTRAINT "ClubReminderLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
