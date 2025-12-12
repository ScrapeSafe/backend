-- CreateTable
CREATE TABLE "Site" (
    "id" SERIAL NOT NULL,
    "domain" TEXT NOT NULL,
    "ownerAddress" TEXT NOT NULL,
    "storyIpId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT NOT NULL,
    "verificationMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseTerms" (
    "id" SERIAL NOT NULL,
    "siteId" INTEGER NOT NULL,
    "allowedActions" TEXT NOT NULL,
    "priceModel" TEXT NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "priceToken" TEXT NOT NULL,
    "termsUri" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenseTerms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "License" (
    "id" SERIAL NOT NULL,
    "licenseTermsId" INTEGER NOT NULL,
    "buyerAddress" TEXT NOT NULL,
    "proofUri" TEXT,
    "proofSignature" TEXT,
    "txHash" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiry" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nonce" (
    "id" SERIAL NOT NULL,
    "owner" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nonce_pkey" PRIMARY KEY ("id")
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

-- AddForeignKey
ALTER TABLE "LicenseTerms" ADD CONSTRAINT "LicenseTerms_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_licenseTermsId_fkey" FOREIGN KEY ("licenseTermsId") REFERENCES "LicenseTerms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
