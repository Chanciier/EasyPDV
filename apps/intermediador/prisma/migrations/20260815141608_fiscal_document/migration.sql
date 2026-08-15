-- CreateEnum
CREATE TYPE "FiscalDocumentType" AS ENUM ('nfce', 'comprovante_nao_fiscal');

-- CreateEnum
CREATE TYPE "FiscalDocumentStatus" AS ENUM ('pending', 'issued', 'cancelled', 'error');

-- CreateTable
CREATE TABLE "FiscalDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "ErpProvider" NOT NULL DEFAULT 'bling',
    "saleId" TEXT NOT NULL,
    "type" "FiscalDocumentType" NOT NULL DEFAULT 'nfce',
    "status" "FiscalDocumentStatus" NOT NULL DEFAULT 'pending',
    "externalId" TEXT NOT NULL,
    "externalStatus" INTEGER,
    "documentNumber" TEXT,
    "accessKey" TEXT,
    "danfeUrl" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiscalDocument_saleId_idx" ON "FiscalDocument"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalDocument_organizationId_provider_saleId_key" ON "FiscalDocument"("organizationId", "provider", "saleId");

-- AddForeignKey
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
