/**
 * Scraping Routes
 * Handles web scraping requests
 */

import express from 'express';
import { scrapeWebsite, scrapeWebsiteBySiteId, getScrapedDataForSite, getScrapedDataById } from '../services/scraper';
import prisma from '../db/prisma';

const router = express.Router();

/**
 * POST /api/scrape/site/:siteId
 * Scrape a website by site ID
 */
router.post('/site/:siteId', async (req, res) => {
  try {
    const siteId = parseInt(req.params.siteId, 10);
    
    if (isNaN(siteId)) {
      return res.status(400).json({ error: 'Invalid site ID' });
    }

    const { elementPrompts, url } = req.body;

    const result = await scrapeWebsiteBySiteId(siteId, {
      elementPrompts,
      url,
    });

    if (!result.success) {
      return res.status(500).json({
        error: 'Scraping failed',
        message: result.error,
        scrapedDataId: result.scrapedDataId,
      });
    }

    res.json({
      success: true,
      data: result.data,
      scrapedDataId: result.scrapedDataId,
    });
  } catch (error) {
    console.error('[Scrape Route] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/scrape/domain/:domain
 * Scrape a website by domain
 * Note: Domain should be just the domain name (e.g., "cursor.com"), not a full URL or path
 */
router.post('/domain/:domain', async (req, res) => {
  try {
    // Decode the domain parameter in case it's URL encoded
    const domain = decodeURIComponent(req.params.domain);
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    // Find site by domain
    const site = await prisma.site.findUnique({
      where: { domain },
    });

    if (!site) {
      return res.status(404).json({ 
        error: `Site with domain "${domain}" not found in database`,
        hint: 'Register the site first using POST /api/owner/register'
      });
    }

    const { elementPrompts, url } = req.body;

    const result = await scrapeWebsite(site.domain, site.id, {
      elementPrompts,
      url,
    });

    if (!result.success) {
      return res.status(500).json({
        error: 'Scraping failed',
        message: result.error,
        scrapedDataId: result.scrapedDataId,
      });
    }

    res.json({
      success: true,
      data: result.data,
      scrapedDataId: result.scrapedDataId,
    });
  } catch (error) {
    console.error('[Scrape Route] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/scrape/url
 * Scrape any URL directly (doesn't require site registration or database)
 * Useful for testing - returns scraped data without storing in DB
 */
router.post('/url', async (req, res) => {
  try {
    const { url, elementPrompts } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required in request body' });
    }

    // Validate URL format
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Import JigsawStack directly for this endpoint
    const { JigsawStack } = require('jigsawstack');
    const JIGSAW_API_KEY = process.env.JIGSAW_API_KEY || "sk_ec951836b34e6827a0751dc89b38471a2937e52d4a1ff54e85c7d6084ea964a6a03066d7e6b9cf830194d223429994150d9fd0024ba0c4cfa425325beaff8bb9024vFA1kTxrMkHMIx3sSx";
    const jigsaw = JigsawStack({ apiKey: JIGSAW_API_KEY });

    // Default element prompts if not provided (max 5 allowed by JigsawStack API)
    const defaultPrompts = [
      "post_titles",
      "post_points", 
      "post_username",
      "main_content",
      "headings"
    ];
    const prompts = elementPrompts 
      ? (Array.isArray(elementPrompts) ? elementPrompts.slice(0, 5) : defaultPrompts) // Limit to max 5
      : defaultPrompts;

    console.log(`[Scraper] Scraping ${url} (test mode, no DB storage)...`);

    // Call JigsawStack API directly
    const response = await jigsaw.web.ai_scrape({
      url,
      element_prompts: prompts,
    });

    console.log(`[Scraper] Successfully scraped ${url}`);

    res.json({
      success: true,
      data: response,
      url,
      scrapedAt: new Date().toISOString(),
      note: 'Data not stored in database (test mode)',
    });
  } catch (error) {
    console.error('[Scrape Route] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Scraping failed',
      message: errorMessage,
    });
  }
});

/**
 * GET /api/scrape/site/:siteId/data
 * Get all scraped data for a site
 */
router.get('/site/:siteId/data', async (req, res) => {
  try {
    const siteId = parseInt(req.params.siteId, 10);
    
    if (isNaN(siteId)) {
      return res.status(400).json({ error: 'Invalid site ID' });
    }

    const scrapedData = await getScrapedDataForSite(siteId);

    res.json({
      success: true,
      count: scrapedData.length,
      data: scrapedData,
    });
  } catch (error) {
    console.error('[Scrape Route] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/scrape/data/:id
 * Get scraped data by ID
 */
router.get('/data/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid scraped data ID' });
    }

    const scrapedData = await getScrapedDataById(id);

    if (!scrapedData) {
      return res.status(404).json({ error: 'Scraped data not found' });
    }

    res.json({
      success: true,
      data: scrapedData,
    });
  } catch (error) {
    console.error('[Scrape Route] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

