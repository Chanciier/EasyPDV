-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastVerifiedCentrallyAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "orgUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_orgUserId_key" ON "User"("orgUserId");
