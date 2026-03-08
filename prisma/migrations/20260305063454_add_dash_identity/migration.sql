-- CreateTable
CREATE TABLE "DashChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nonce" TEXT NOT NULL,
    "dpnsName" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "dashAddress" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL DEFAULT '',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifyToken" TEXT,
    "resetToken" TEXT,
    "resetExpires" DATETIME,
    "pendingEmail" TEXT,
    "changeEmailToken" TEXT,
    "dashIdentityId" TEXT,
    "dashIdentityAddr" TEXT,
    "dashLoginOnly" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_User" ("avatarUrl", "bio", "changeEmailToken", "createdAt", "dashUsername", "displayName", "email", "emailVerified", "id", "lotteriesEntered", "passwordHash", "pendingEmail", "resetExpires", "resetToken", "timelyTruth", "totalDashContributed", "totalDashWon", "totalTicketsEarned", "updatedAt", "verifyToken", "xHandle") SELECT "avatarUrl", "bio", "changeEmailToken", "createdAt", "dashUsername", "displayName", "email", "emailVerified", "id", "lotteriesEntered", "passwordHash", "pendingEmail", "resetExpires", "resetToken", "timelyTruth", "totalDashContributed", "totalDashWon", "totalTicketsEarned", "updatedAt", "verifyToken", "xHandle" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_dashIdentityId_key" ON "User"("dashIdentityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "DashChallenge_nonce_key" ON "DashChallenge"("nonce");
