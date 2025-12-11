import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { parseSiteIdFromIpId } from '../services/story';

const router = Router();

/**
 * GET /api/market
 * List all enabled license terms with site info
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const listings = await prisma.licenseTerms.findMany({
      where: { enabled: true },
      include: {
        site: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = listings.map((listing) => ({
      site: {
        id: listing.site.id,
        domain: listing.site.domain,
        ownerAddress: listing.site.ownerAddress,
        storyIpId: listing.site.storyIpId,
        verified: listing.site.verified,
      },
      licenseTerms: {
        id: listing.id,
        allowedActions: JSON.parse(listing.allowedActions),
        priceModel: listing.priceModel,
        pricePerUnit: listing.pricePerUnit,
        priceToken: listing.priceToken,
        termsUri: listing.termsUri,
        enabled: listing.enabled,
        createdAt: listing.createdAt,
      },
    }));

    return res.status(200).json(formatted);
  } catch (error) {
    console.error('Market listing error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/asset/:ipId
 * Get asset details by Story IP ID or site ID
 */
router.get('/asset/:ipId', async (req: Request, res: Response) => {
  try {
    const ipId = req.params.ipId ?? '';

    if (!ipId) {
      return res.status(400).json({ error: 'ipId is required' });
    }

    // Try to find by storyIpId first
    let site = await prisma.site.findFirst({
      where: { storyIpId: ipId },
      include: {
        licenseTerms: {
          where: { enabled: true },
        },
      },
    });

    // If not found, try parsing as site ID
    if (!site) {
      const siteId = parseSiteIdFromIpId(ipId);
      if (siteId !== null) {
        site = await prisma.site.findUnique({
          where: { id: siteId },
          include: {
            licenseTerms: {
              where: { enabled: true },
            },
          },
        });
      }
    }

    if (!site) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const licenseTerms = site.licenseTerms[0];

    return res.status(200).json({
      site: {
        id: site.id,
        domain: site.domain,
        ownerAddress: site.ownerAddress,
        storyIpId: site.storyIpId,
        verified: site.verified,
      },
      licenseTerms: licenseTerms
        ? {
            id: licenseTerms.id,
            allowedActions: JSON.parse(licenseTerms.allowedActions),
            priceModel: licenseTerms.priceModel,
            pricePerUnit: licenseTerms.pricePerUnit,
            priceToken: licenseTerms.priceToken,
            termsUri: licenseTerms.termsUri,
            enabled: licenseTerms.enabled,
          }
        : null,
    });
  } catch (error) {
    console.error('Get asset error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

