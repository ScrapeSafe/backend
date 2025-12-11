import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { signReceipt, getServerAddress } from '../services/signer';
import { uploadJson } from '../services/ipfs';
import { parseSiteIdFromIpId } from '../services/story';
import { invalidateLicenseCache } from '../services/cache';

const router = Router();

/**
 * POST /api/buy
 * Purchase a license for a site/IP asset
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { ipId, buyerAddress } = req.body;

    // Validate input
    if (!ipId) {
      return res.status(400).json({ error: 'ipId is required' });
    }
    if (!buyerAddress || typeof buyerAddress !== 'string') {
      return res.status(400).json({ error: 'buyerAddress is required and must be a string' });
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(buyerAddress)) {
      return res.status(400).json({ error: 'Invalid buyerAddress format' });
    }

    // Find site by storyIpId or site ID
    let site = await prisma.site.findFirst({
      where: { storyIpId: ipId },
      include: {
        licenseTerms: {
          where: { enabled: true },
        },
      },
    });

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

    if (!licenseTerms) {
      return res.status(400).json({ error: 'No license terms available for this asset' });
    }

    if (!licenseTerms.enabled) {
      return res.status(400).json({ error: 'License terms are not enabled' });
    }

    // Create license record with pending status
    const license = await prisma.license.create({
      data: {
        licenseTermsId: licenseTerms.id,
        buyerAddress: buyerAddress.toLowerCase(),
        status: 'pending',
      },
    });

    // Create receipt
    const receipt = {
      licenseId: license.id,
      ipId: site.storyIpId || `story:local:${site.id}`,
      siteId: site.id,
      domain: site.domain,
      buyerAddress: buyerAddress.toLowerCase(),
      issuer: getServerAddress(),
      termsId: licenseTerms.id,
      termsUri: licenseTerms.termsUri,
      allowedActions: JSON.parse(licenseTerms.allowedActions),
      priceModel: licenseTerms.priceModel,
      pricePerUnit: licenseTerms.pricePerUnit,
      priceToken: licenseTerms.priceToken,
      issuedAt: new Date().toISOString(),
      expiry: null,
    };

    // Sign the receipt
    const signature = await signReceipt(receipt);

    // Upload to IPFS (or mock)
    const ipfsResult = await uploadJson(
      { receipt, signature },
      `license-${license.id}.json`
    );

    // Update license with signature and proof
    await prisma.license.update({
      where: { id: license.id },
      data: {
        proofSignature: signature,
        proofUri: ipfsResult.uri,
        status: 'active',
      },
    });

    // Invalidate cache
    invalidateLicenseCache(site.storyIpId || `story:local:${site.id}`, buyerAddress);

    // Payment note (for MVP - no real token transfer)
    const paymentNote = `NOTE: For MVP demo, payment is simulated. In production, buyer (${buyerAddress}) would transfer ${licenseTerms.pricePerUnit} ${licenseTerms.priceToken} to site owner (${site.ownerAddress}).`;

    return res.status(200).json({
      licenseId: license.id,
      receipt,
      signature,
      proofUri: ipfsResult.uri,
      proofMocked: ipfsResult.mocked,
      paymentNote,
    });
  } catch (error) {
    console.error('Buy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

