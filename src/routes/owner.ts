import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../db/prisma';
import { checkDnsTxt } from '../services/dnsCheck';
import { checkMetaTag } from '../services/metaCheck';
import { checkRightsFile, generateRightsFileTemplate } from '../services/rightsVerify';
import { registerIpAsset } from '../services/story';

const router = Router();

/**
 * POST /api/owner/register
 * Register a new site for verification
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { domain, ownerWallet } = req.body;

    // Validate input
    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ error: 'domain is required and must be a string' });
    }
    if (!ownerWallet || typeof ownerWallet !== 'string') {
      return res.status(400).json({ error: 'ownerWallet is required and must be a string' });
    }

    // Validate wallet address format (basic check)
    if (!/^0x[a-fA-F0-9]{40}$/.test(ownerWallet)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    // Normalize domain (remove protocol and trailing slashes)
    const normalizedDomain = domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '')
      .trim();

    // Check if site already exists
    const existing = await prisma.site.findUnique({
      where: { domain: normalizedDomain },
    });

    if (existing) {
      return res.status(409).json({
        error: 'Site already registered',
        siteId: existing.id,
        verified: existing.verified,
      });
    }

    // Generate verification token
    const verificationToken = `scrapesafe-${uuidv4()}`;

    // Create site record
    const site = await prisma.site.create({
      data: {
        domain: normalizedDomain,
        ownerAddress: ownerWallet,
        verificationToken,
        verified: false,
      },
    });

    // Generate rights file template
    const { payload, instructions: fileInstructions } = generateRightsFileTemplate(
      normalizedDomain,
      ownerWallet,
      verificationToken
    );

    return res.status(201).json({
      siteId: site.id,
      verificationToken,
      instructions: {
        dns: `Add a TXT record at _scrapesafe.${normalizedDomain} with value: ${verificationToken}`,
        meta: `Add to your HTML <head>: <meta name="scrapesafe" content="${verificationToken}">`,
        file: `Place a signed JSON file at https://${normalizedDomain}/.well-known/scrapesafe.json`,
        fileTemplate: payload,
        fileInstructions,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/owner/verify
 * Verify site ownership using DNS, meta tag, or file method
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { siteId, method } = req.body;

    // Validate input
    if (!siteId || typeof siteId !== 'number') {
      return res.status(400).json({ error: 'siteId is required and must be a number' });
    }
    if (!method || !['dns', 'meta', 'file'].includes(method)) {
      return res.status(400).json({ error: 'method must be one of: dns, meta, file' });
    }

    // Find site
    const site = await prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    if (site.verified) {
      return res.status(200).json({
        ok: true,
        details: 'Site already verified',
        method: site.verificationMethod,
      });
    }

    let verificationResult: { ok: boolean; details: string };

    switch (method) {
      case 'dns': {
        const result = await checkDnsTxt(site.domain, site.verificationToken);
        verificationResult = {
          ok: result.found,
          details: result.details,
        };
        break;
      }
      case 'meta': {
        const result = await checkMetaTag(site.domain, site.verificationToken);
        verificationResult = {
          ok: result.found,
          details: result.details,
        };
        break;
      }
      case 'file': {
        const result = await checkRightsFile(
          site.domain,
          site.verificationToken,
          site.ownerAddress
        );
        verificationResult = {
          ok: result.found && result.valid,
          details: result.details,
        };
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid verification method' });
    }

    // Update site if verification succeeded
    if (verificationResult.ok) {
      // Register as Story IP asset
      const storyResult = await registerIpAsset(
        site.id,
        site.domain,
        site.ownerAddress
      );

      await prisma.site.update({
        where: { id: siteId },
        data: {
          verified: true,
          verificationMethod: method,
          storyIpId: storyResult.ipId,
        },
      });

      return res.status(200).json({
        ok: true,
        details: verificationResult.details,
        storyIpId: storyResult.ipId,
        storySimulated: storyResult.simulated,
      });
    }

    return res.status(200).json({
      ok: false,
      details: verificationResult.details,
    });
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/owner/test-mint
 * DEV ONLY: Test Story Protocol minting without verification
 * Remove this endpoint in production!
 */
router.post('/test-mint', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.body;

    if (!siteId || typeof siteId !== 'number') {
      return res.status(400).json({ error: 'siteId is required and must be a number' });
    }

    // Find site
    const site = await prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // If already has Story IP, return it
    if (site.storyIpId) {
      return res.status(200).json({
        ok: true,
        storyIpId: site.storyIpId,
        storySimulated: site.storyIpId.startsWith('story:local:'),
        details: 'Site already has Story IP',
      });
    }

    // Force mint Story IP (bypass verification)
    console.log(`[DEV TEST] Force minting Story IP for site ${siteId}: ${site.domain}`);
    const storyResult = await registerIpAsset(
      site.id,
      site.domain,
      site.ownerAddress
    );

    // Update site with Story IP
    await prisma.site.update({
      where: { id: siteId },
      data: {
        verified: true,
        verificationMethod: 'dev-test',
        storyIpId: storyResult.ipId,
      },
    });

    return res.status(200).json({
      ok: true,
      storyIpId: storyResult.ipId,
      storySimulated: storyResult.simulated,
      details: 'Story IP minted via test endpoint',
    });
  } catch (error) {
    console.error('Test mint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/owner/set-terms
 * Set or update license terms for a site
 */
router.post('/set-terms', async (req: Request, res: Response) => {
  try {
    const { siteId, allowedActions, priceModel, pricePerUnit, priceToken, termsUri } = req.body;

    // Validate input
    if (!siteId || typeof siteId !== 'number') {
      return res.status(400).json({ error: 'siteId is required and must be a number' });
    }
    if (!Array.isArray(allowedActions) || allowedActions.length === 0) {
      return res.status(400).json({ error: 'allowedActions must be a non-empty array' });
    }
    if (!['PER_SCRAPE', 'SUBSCRIPTION', 'FLAT'].includes(priceModel)) {
      return res.status(400).json({ error: 'priceModel must be one of: PER_SCRAPE, SUBSCRIPTION, FLAT' });
    }
    if (typeof pricePerUnit !== 'number' || pricePerUnit < 0) {
      return res.status(400).json({ error: 'pricePerUnit must be a non-negative number' });
    }

    // Find site
    const site = await prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    if (!site.verified) {
      return res.status(403).json({ error: 'Site must be verified before setting terms' });
    }

    // Check for existing terms
    const existingTerms = await prisma.licenseTerms.findFirst({
      where: { siteId, enabled: true },
    });

    let licenseTerms;

    if (existingTerms) {
      // Update existing terms
      licenseTerms = await prisma.licenseTerms.update({
        where: { id: existingTerms.id },
        data: {
          allowedActions: JSON.stringify(allowedActions),
          priceModel,
          pricePerUnit,
          priceToken: priceToken || 'USD',
          termsUri: termsUri || null,
        },
      });
    } else {
      // Create new terms
      licenseTerms = await prisma.licenseTerms.create({
        data: {
          siteId,
          allowedActions: JSON.stringify(allowedActions),
          priceModel,
          pricePerUnit,
          priceToken: priceToken || 'USD',
          termsUri: termsUri || null,
        },
      });
    }

    return res.status(200).json({
      licenseTerms: {
        ...licenseTerms,
        allowedActions: JSON.parse(licenseTerms.allowedActions),
      },
    });
  } catch (error) {
    console.error('Set terms error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/owner/site/:siteId
 * Get site details with terms and licenses
 */
router.get('/site/:siteId', async (req: Request, res: Response) => {
  try {
    const siteId = parseInt(req.params.siteId ?? '', 10);

    if (isNaN(siteId)) {
      return res.status(400).json({ error: 'Invalid siteId' });
    }

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: {
        licenseTerms: {
          include: {
            licenses: true,
          },
        },
      },
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Parse allowedActions JSON for each term
    const formattedTerms = site.licenseTerms.map((term) => ({
      ...term,
      allowedActions: JSON.parse(term.allowedActions),
    }));

    return res.status(200).json({
      site: {
        id: site.id,
        domain: site.domain,
        ownerAddress: site.ownerAddress,
        storyIpId: site.storyIpId,
        verified: site.verified,
        verificationMethod: site.verificationMethod,
        createdAt: site.createdAt,
      },
      licenseTerms: formattedTerms,
    });
  } catch (error) {
    console.error('Get site error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

