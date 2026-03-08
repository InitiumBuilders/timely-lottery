-- CreateTable
CREATE TABLE "Initium" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Initium_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifyToken" TEXT,
    "resetToken" TEXT,
    "resetExpires" DATETIME,
    "pendingEmail" TEXT,
    "changeEmailToken" TEXT,
    "displayName" TEXT,
    "bio" TEXT,
    "dashUsername" TEXT,
    "xHandle" TEXT,
    "avatarUrl" TEXT,
    "timelyTruth" TEXT,
    "totalDashContributed" REAL NOT NULL DEFAULT 0,
    "totalDashWon" REAL NOT NULL DEFAULT 0,
    "totalTicketsEarned" INTEGER NOT NULL DEFAULT 0,
    "lotteriesEntered" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("avatarUrl", "createdAt", "dashUsername", "displayName", "email", "emailVerified", "id", "passwordHash", "resetExpires", "resetToken", "timelyTruth", "updatedAt", "verifyToken", "xHandle") SELECT "avatarUrl", "createdAt", "dashUsername", "displayName", "email", "emailVerified", "id", "passwordHash", "resetExpires", "resetToken", "timelyTruth", "updatedAt", "verifyToken", "xHandle" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Initium_slug_key" ON "Initium"("slug");
