
import { JigsawStack } from "jigsawstack";
import prisma from '../db/prisma';

const typedPrisma = prisma as typeof prisma & {
  scrapedData: {
    create: (args: { data: any }) => Promise<any>;
    update: (args: { where: any; data: any }) => Promise<any>;
    findMany: (args?: { where?: any; orderBy?: any }) => Promise<any[]>;
    findUnique: (args: { where: any; include?: any }) => Promise<any | null>;
  };
};

const JIGSAW_API_KEY = process.env.JIGSAW_API_KEY || "sk_ec951836b34e6827a0751dc89b38471a2937e52d4a1ff54e85c7d6084ea964a6a03066d7e6b9cf830194d223429994150d9fd0024ba0c4cfa425325beaff8bb9024vFA1kTxrMkHMIx3sSx";

const jigsaw = JigsawStack({ apiKey: JIGSAW_API_KEY });

export interface ScrapeOptions {
  elementPrompts?: string[];
  url?: string;
}

export interface ScrapeResult {
  success: boolean;
  data?: unknown;
  error?: string;
  scrapedDataId?: number;
}

/**
 * Scrape a website using JigsawStack
 * @param domain - Domain to scrape (e.g., "example.com")
 * @param siteId - Site ID from database
 * @param options - Optional scraping options
 */
export async function scrapeWebsite(
  domain: string,
  siteId: number,
  options: ScrapeOptions = {}
): Promise<ScrapeResult> {
  try {
    // Construct URL - use provided URL or default to https://{domain}
    const url = options.url || `https://${domain}`;
    
    // Default element prompts if not provided
    const elementPrompts = options.elementPrompts || [
      "post_titles",
      "post_points", 
      "post_username",
      "main_content",
      "headings",
      "links"
    ];

    console.log(`[Scraper] Scraping ${url} for site ${siteId}...`);

    // Create pending record in database
    const scrapedDataRecord = await typedPrisma.scrapedData.create({
      data: {
        siteId,
        url,
        scrapedData: {},
        status: "pending",
      },
    });

    try {
      // Call JigsawStack API
      const response = await jigsaw.web.ai_scrape({
        url,
        element_prompts: elementPrompts,
      });

      console.log(`[Scraper] Successfully scraped ${url}`);

      // Update database with scraped data
      const updated = await typedPrisma.scrapedData.update({
        where: { id: scrapedDataRecord.id },
        data: {
          scrapedData: response as unknown,
          status: "success",
        },
      });

      return {
        success: true,
        data: response,
        scrapedDataId: updated.id,
      };
    } catch (scrapeError) {
      const errorMessage = scrapeError instanceof Error ? scrapeError.message : String(scrapeError);
      console.error(`[Scraper] Failed to scrape ${url}:`, errorMessage);

      // Update database with error
      await typedPrisma.scrapedData.update({
        where: { id: scrapedDataRecord.id },
        data: {
          status: "error",
          errorMessage: errorMessage,
        },
      });

      return {
        success: false,
        error: errorMessage,
        scrapedDataId: scrapedDataRecord.id,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Scraper] Error scraping ${domain}:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Scrape website by site ID (looks up domain from database)
 */
export async function scrapeWebsiteBySiteId(
  siteId: number,
  options: ScrapeOptions = {}
): Promise<ScrapeResult> {
  try {
    const site = await prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return {
        success: false,
        error: `Site with ID ${siteId} not found`,
      };
    }

    return await scrapeWebsite(site.domain, siteId, options);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get all scraped data for a site
 */
export async function getScrapedDataForSite(siteId: number) {
  return await typedPrisma.scrapedData.findMany({
    where: { siteId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get scraped data by ID
 */
export async function getScrapedDataById(id: number) {
  return await typedPrisma.scrapedData.findUnique({
    where: { id },
    include: {
      site: {
        select: {
          id: true,
          domain: true,
          ownerAddress: true,
        },
      },
    },
  });
}

