/*
  Warnings:

  - Added the required column `apiKey` to the `StoreIdentity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `terminalId` to the `StoreIdentity` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StoreIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "activatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_StoreIdentity" ("activatedAt", "id", "organizationId", "storeId", "storeName") SELECT "activatedAt", "id", "organizationId", "storeId", "storeName" FROM "StoreIdentity";
DROP TABLE "StoreIdentity";
ALTER TABLE "new_StoreIdentity" RENAME TO "StoreIdentity";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
