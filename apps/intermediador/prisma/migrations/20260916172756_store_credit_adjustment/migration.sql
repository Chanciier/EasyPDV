-- CreateTable
CREATE TABLE "StoreCreditAdjustment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerCpf" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT,
    "storeId" TEXT,
    "terminalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreCreditAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreCreditAdjustment_organizationId_customerCpf_idx" ON "StoreCreditAdjustment"("organizationId", "customerCpf");

-- AddForeignKey
ALTER TABLE "StoreCreditAdjustment" ADD CONSTRAINT "StoreCreditAdjustment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
