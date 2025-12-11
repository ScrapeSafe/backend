import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { verifyReceipt, getServerAddress } from '../services/signer';
import { stableStringify } from '../utils/stableStringify';
import { 
  cacheLicenseCheck, 
  getCachedLicenseCheck,
  getLicenseCheckCacheKey 
} from '../services/cache';
import { parseSiteIdFromIpId } from '../services/story';

const router = Router();

/**
 * GET /api/license/:licenseId
 * Get license details and proof
 */
router.get('/license/:licenseId', async (req: Request, res: Response) => {
  try {
    const licenseId = parseInt(req.params.licenseId ?? '', 10);

    if (isNaN(licenseId)) {
      return res.status(400).json({ error: 'Invalid licenseId' });
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

    return res.status(200).json({
      license: {
        id: license.id,
        buyerAddress: license.buyerAddress,
        status: license.status,
        issuedAt: license.issuedAt,
        expiry: license.expiry,
        proofUri: license.proofUri,
        proofSignature: license.proofSignature,
        txHash: license.txHash,
      },
      terms: {
        id: license.licenseTerms.id,
        allowedActions: JSON.parse(license.licenseTerms.allowedActions),
        priceModel: license.licenseTerms.priceModel,
        pricePerUnit: license.licenseTerms.pricePerUnit,
        priceToken: license.licenseTerms.priceToken,
        termsUri: license.licenseTerms.termsUri,
      },
      site: {
        id: license.licenseTerms.site.id,
        domain: license.licenseTerms.site.domain,
        storyIpId: license.licenseTerms.site.storyIpId,
        ownerAddress: license.licenseTerms.site.ownerAddress,
      },
    });
  } catch (error) {
    console.error('Get license error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/check-license
 * Fast check if a buyer has an active license for an IP
 */
router.get('/check-license', async (req: Request, res: Response) => {
  try {
    const { ipId, buyer } = req.query;

    if (!ipId || typeof ipId !== 'string') {
      return res.status(400).json({ error: 'ipId query parameter is required' });
    }
    if (!buyer || typeof buyer !== 'string') {
      return res.status(400).json({ error: 'buyer query parameter is required' });
    }

    const normalizedBuyer = buyer.toLowerCase();

    // Check cache first
    const cached = getCachedLicenseCheck(ipId, normalizedBuyer);
    if (cached !== null) {
      return res.status(200).json({
        hasLicense: cached.hasLicense,
        licenseId: cached.licenseId,
        cached: true,
      });
    }

    // Find site by storyIpId or site ID
    let site = await prisma.site.findFirst({
      where: { storyIpId: ipId },
    });

    if (!site) {
      const siteId = parseSiteIdFromIpId(ipId);
      if (siteId !== null) {
        site = await prisma.site.findUnique({
          where: { id: siteId },
        });
      }
    }

    if (!site) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Find active license for this buyer
    const license = await prisma.license.findFirst({
      where: {
        buyerAddress: normalizedBuyer,
        status: 'active',
        licenseTerms: {
          siteId: site.id,
          enabled: true,
        },
        OR: [
          { expiry: null },
          { expiry: { gt: new Date() } },
        ],
      },
      include: {
        licenseTerms: true,
      },
    });

    const hasLicense = !!license;
    
    // Cache the result
    cacheLicenseCheck(ipId, normalizedBuyer, hasLicense, license?.id);

    if (hasLicense && license) {
      return res.status(200).json({
        hasLicense: true,
        licenseId: license.id,
        proof: {
          signature: license.proofSignature,
          uri: license.proofUri,
        },
        cached: false,
      });
    }

    return res.status(200).json({
      hasLicense: false,
      cached: false,
    });
  } catch (error) {
    console.error('Check license error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/validate-proof
 * Validate a license receipt signature
 */
router.post('/validate-proof', async (req: Request, res: Response) => {
  try {
    const { receiptJson, signature } = req.body;

    if (!receiptJson) {
      return res.status(400).json({ error: 'receiptJson is required' });
    }
    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({ error: 'signature is required and must be a string' });
    }

    // Parse receipt if it's a string
    let receipt: Record<string, unknown>;
    if (typeof receiptJson === 'string') {
      try {
        receipt = JSON.parse(receiptJson);
      } catch {
        return res.status(400).json({ error: 'receiptJson is not valid JSON' });
      }
    } else {
      receipt = receiptJson;
    }

    // Verify the signature
    const result = verifyReceipt(receipt, signature);

    return res.status(200).json({
      valid: result.valid,
      signer: result.signer,
      expectedSigner: getServerAddress(),
    });
  } catch (error) {
    console.error('Validate proof error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

