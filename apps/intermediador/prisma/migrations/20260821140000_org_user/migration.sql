-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('operador', 'supervisor', 'gerente', 'administrador', 'proprietario', 'auditor', 'tecnico');

-- CreateTable
CREATE TABLE "OrgUser" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "employeeCode" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgUser_organizationId_idx" ON "OrgUser"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgUser_organizationId_email_key" ON "OrgUser"("organizationId", "email");

-- AddForeignKey
ALTER TABLE "OrgUser" ADD CONSTRAINT "OrgUser_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
