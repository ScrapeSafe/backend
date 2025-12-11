-- CreateTable
CREATE TABLE "Site" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "domain" TEXT NOT NULL,
    "ownerAddress" TEXT NOT NULL,
    "storyIpId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT NOT NULL,
    "verificationMethod" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LicenseTerms" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siteId" INTEGER NOT NULL,
    "allowedActions" TEXT NOT NULL,
    "priceModel" TEXT NOT NULL,
    "pricePerUnit" REAL NOT NULL,
    "priceToken" TEXT NOT NULL,
    "termsUri" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LicenseTerms_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "License" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "licenseTermsId" INTEGER NOT NULL,
    "buyerAddress" TEXT NOT NULL,
    "proofUri" TEXT,
    "proofSignature" TEXT,
    "txHash" TEXT,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiry" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    CONSTRAINT "License_licenseTermsId_fkey" FOREIGN KEY ("licenseTermsId") REFERENCES "LicenseTerms" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Nonce" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "owner" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Site_domain_key" ON "Site"("domain");

-- CreateIndex
CREATE INDEX "License_buyerAddress_idx" ON "License"("buyerAddress");

-- CreateIndex
CREATE INDEX "License_licenseTermsId_idx" ON "License"("licenseTermsId");

-- CreateIndex
CREATE UNIQUE INDEX "Nonce_value_key" ON "Nonce"("value");

-- CreateIndex
CREATE INDEX "Nonce_owner_idx" ON "Nonce"("owner");
