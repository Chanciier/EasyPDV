-- CreateTable
CREATE TABLE "OrgAuthSession" (
    "id" TEXT NOT NULL,
    "orgUserId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgAuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgAuthSession_orgUserId_idx" ON "OrgAuthSession"("orgUserId");

-- AddForeignKey
ALTER TABLE "OrgAuthSession" ADD CONSTRAINT "OrgAuthSession_orgUserId_fkey" FOREIGN KEY ("orgUserId") REFERENCES "OrgUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
