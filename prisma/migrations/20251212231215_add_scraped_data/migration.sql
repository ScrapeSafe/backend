-- CreateTable
CREATE TABLE "ScrapedData" (
    "id" SERIAL NOT NULL,
    "siteId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "scrapedData" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapedData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScrapedData_siteId_idx" ON "ScrapedData"("siteId");

-- CreateIndex
CREATE INDEX "ScrapedData_url_idx" ON "ScrapedData"("url");

-- AddForeignKey
ALTER TABLE "ScrapedData" ADD CONSTRAINT "ScrapedData_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

