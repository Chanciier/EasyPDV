-- CreateTable
CREATE TABLE "ClubMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "ErpProvider" NOT NULL DEFAULT 'bling',
    "customerCpf" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClubMembership_organizationId_validUntil_idx" ON "ClubMembership"("organizationId", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ClubMembership_organizationId_provider_customerCpf_key" ON "ClubMembership"("organizationId", "provider", "customerCpf");

-- AddForeignKey
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
