-- CreateTable
CREATE TABLE "FiscalDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'nfce',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "documentNumber" TEXT,
    "accessKey" TEXT,
    "danfeUrl" TEXT,
    "errorMessage" TEXT,
    "issuedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FiscalDocument_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FiscalDocument_saleId_key" ON "FiscalDocument"("saleId");
