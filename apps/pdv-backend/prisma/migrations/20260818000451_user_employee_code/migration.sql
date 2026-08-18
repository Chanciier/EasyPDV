/*
  Warnings:

  - Added the required column `employeeCode` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "employeeCode" INTEGER NOT NULL
);
-- employeeCode backfillado por ordem de criação (quem existe há mais tempo
-- vira a matrícula mais baixa) — ROW_NUMBER() em vez de rowid porque cuid()
-- não é sequencial por ordem de inserção de forma garantida.
INSERT INTO "new_User" ("active", "createdAt", "email", "id", "name", "passwordHash", "role", "updatedAt", "employeeCode")
SELECT "active", "createdAt", "email", "id", "name", "passwordHash", "role", "updatedAt",
  ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC)
FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_employeeCode_key" ON "User"("employeeCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
