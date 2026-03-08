-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Initium" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "slug" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "totalDashEarned" REAL NOT NULL DEFAULT 0,
    "totalVotusEarned" INTEGER NOT NULL DEFAULT 0,
    "dashAddress" TEXT,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "totalLotteries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Initium_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Initium" ("createdAt", "description", "id", "isPublic", "lastUsedAt", "mediaType", "mediaUrl", "slug", "timesUsed", "title", "totalDashEarned", "totalVotusEarned", "updatedAt", "url", "userId", "viewCount") SELECT "createdAt", "description", "id", "isPublic", "lastUsedAt", "mediaType", "mediaUrl", "slug", "timesUsed", "title", "totalDashEarned", "totalVotusEarned", "updatedAt", "url", "userId", "viewCount" FROM "Initium";
DROP TABLE "Initium";
ALTER TABLE "new_Initium" RENAME TO "Initium";
CREATE UNIQUE INDEX "Initium_slug_key" ON "Initium"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
