-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 0,
    "reservedQuantity" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StockItem_productId_idx" ON "StockItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_warehouseId_productId_key" ON "StockItem"("warehouseId", "productId");

-- CreateIndex
CREATE INDEX "StockMovement_warehouseId_productId_idx" ON "StockMovement"("warehouseId", "productId");
