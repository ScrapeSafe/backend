import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { invalidateLicenseCache } from '../services/cache';

const router = Router();

/**
 * POST /api/admin/revoke-license
 * Revoke a license (stretch goal)
 */
router.post('/revoke-license', async (req: Request, res: Response) => {
  try {
    const { licenseId, reason } = req.body;

    if (!licenseId || typeof licenseId !== 'number') {
      return res.status(400).json({ error: 'licenseId is required and must be a number' });
    }

    const license = await prisma.license.findUnique({
      where: { id: licenseId },
      include: {
        licenseTerms: {
          include: {
            site: true,
          },
        },
      },
    });

    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }

    if (license.status === 'revoked') {
      return res.status(400).json({ error: 'License is already revoked' });
    }

    // Update license status
    await prisma.license.update({
      where: { id: licenseId },
      data: {
        status: 'revoked',
      },
    });

    // Invalidate cache
    const ipId = license.licenseTerms.site.storyIpId || 
                 `story:local:${license.licenseTerms.site.id}`;
    invalidateLicenseCache(ipId, license.buyerAddress);

    return res.status(200).json({
      success: true,
      message: `License ${licenseId} has been revoked`,
      reason: reason || 'No reason provided',
    });
  } catch (error) {
    console.error('Revoke license error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/stats
 * Get system statistics (stretch goal)
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [
      totalSites,
      verifiedSites,
      totalLicenses,
      activeLicenses,
    ] = await Promise.all([
      prisma.site.count(),
      prisma.site.count({ where: { verified: true } }),
      prisma.license.count(),
      prisma.license.count({ where: { status: 'active' } }),
    ]);

    return res.status(200).json({
      sites: {
        total: totalSites,
        verified: verifiedSites,
      },
      licenses: {
        total: totalLicenses,
        active: activeLicenses,
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

