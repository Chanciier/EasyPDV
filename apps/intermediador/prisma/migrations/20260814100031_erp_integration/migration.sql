-- CreateEnum
CREATE TYPE "ErpProvider" AS ENUM ('bling', 'tiny', 'omie', 'conta_azul', 'proprio');

-- CreateTable
CREATE TABLE "ErpIntegration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "ErpProvider" NOT NULL DEFAULT 'bling',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSyncMapping" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "ErpProvider" NOT NULL DEFAULT 'bling',
    "localEntityType" TEXT NOT NULL,
    "localEntityId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErpSyncMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErpIntegration_organizationId_provider_key" ON "ErpIntegration"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "ErpSyncMapping_organizationId_provider_localEntityType_idx" ON "ErpSyncMapping"("organizationId", "provider", "localEntityType");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSyncMapping_organizationId_provider_localEntityType_loca_key" ON "ErpSyncMapping"("organizationId", "provider", "localEntityType", "localEntityId");

-- AddForeignKey
ALTER TABLE "ErpIntegration" ADD CONSTRAINT "ErpIntegration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSyncMapping" ADD CONSTRAINT "ErpSyncMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
