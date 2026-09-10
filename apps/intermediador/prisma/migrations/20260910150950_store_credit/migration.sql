-- CreateTable
CREATE TABLE "StoreCreditBalance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerCpf" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreCreditBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreCreditGrant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerCpf" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "storeId" TEXT,
    "terminalId" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreCreditGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreCreditGrantItem" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "restock" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StoreCreditGrantItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreCreditRedemption" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerCpf" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "storeId" TEXT,
    "terminalId" TEXT,
    "saleReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreCreditRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreCreditBalance_organizationId_idx" ON "StoreCreditBalance"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreCreditBalance_organizationId_customerCpf_key" ON "StoreCreditBalance"("organizationId", "customerCpf");

-- CreateIndex
CREATE INDEX "StoreCreditGrant_organizationId_customerCpf_idx" ON "StoreCreditGrant"("organizationId", "customerCpf");

-- CreateIndex
CREATE INDEX "StoreCreditGrantItem_grantId_idx" ON "StoreCreditGrantItem"("grantId");

-- CreateIndex
CREATE INDEX "StoreCreditRedemption_organizationId_customerCpf_idx" ON "StoreCreditRedemption"("organizationId", "customerCpf");

-- AddForeignKey
ALTER TABLE "StoreCreditBalance" ADD CONSTRAINT "StoreCreditBalance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCreditGrant" ADD CONSTRAINT "StoreCreditGrant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCreditGrantItem" ADD CONSTRAINT "StoreCreditGrantItem_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "StoreCreditGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCreditRedemption" ADD CONSTRAINT "StoreCreditRedemption_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
