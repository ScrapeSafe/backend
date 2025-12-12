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
 */
router.post('/domain/:domain', async (req, res) => {
  try {
    const domain = req.params.domain;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    // Find site by domain
    const site = await prisma.site.findUnique({
      where: { domain },
    });

    if (!site) {
      return res.status(404).json({ error: `Site with domain ${domain} not found` });
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

