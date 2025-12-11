import request from 'supertest';
import { app } from '../src/index';
import prisma from '../src/db/prisma';
import { getServerAddress } from '../src/services/signer';
import { stableStringify } from '../src/utils/stableStringify';
import { ethers } from 'ethers';

// Test wallet for signing
const testWallet = new ethers.Wallet(
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' // Hardhat #1
);

describe('ScrapeSafe API', () => {
  beforeAll(async () => {
    // Clean up database before tests
    await prisma.license.deleteMany();
    await prisma.licenseTerms.deleteMany();
    await prisma.site.deleteMany();
    await prisma.nonce.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Health Check', () => {
    it('GET /health should return ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.serverAddress).toBeDefined();
    });
  });

  describe('Owner Registration Flow', () => {
    let siteId: number;
    let verificationToken: string;

    it('POST /api/owner/register should create a new site', async () => {
      const res = await request(app)
        .post('/api/owner/register')
        .send({
          domain: 'example.com',
          ownerWallet: testWallet.address,
        });

      expect(res.status).toBe(201);
      expect(res.body.siteId).toBeDefined();
      expect(res.body.verificationToken).toMatch(/^scrapesafe-/);
      expect(res.body.instructions).toBeDefined();
      expect(res.body.instructions.dns).toContain('_scrapesafe.example.com');
      expect(res.body.instructions.meta).toContain('meta name="scrapesafe"');
      expect(res.body.instructions.file).toContain('.well-known/scrapesafe.json');

      siteId = res.body.siteId;
      verificationToken = res.body.verificationToken;
    });

    it('POST /api/owner/register should reject duplicate domain', async () => {
      const res = await request(app)
        .post('/api/owner/register')
        .send({
          domain: 'example.com',
          ownerWallet: testWallet.address,
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Site already registered');
    });

    it('POST /api/owner/register should validate wallet format', async () => {
      const res = await request(app)
        .post('/api/owner/register')
        .send({
          domain: 'invalid-wallet.com',
          ownerWallet: 'not-a-wallet',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid wallet address');
    });

    it('GET /api/owner/site/:siteId should return site details', async () => {
      const res = await request(app).get(`/api/owner/site/${siteId}`);

      expect(res.status).toBe(200);
      expect(res.body.site.domain).toBe('example.com');
      expect(res.body.site.verified).toBe(false);
    });

    // Note: DNS/meta/file verification requires external resources
    // These would be tested with mocks in a real scenario
    it('POST /api/owner/verify with DNS should attempt verification', async () => {
      const res = await request(app)
        .post('/api/owner/verify')
        .send({
          siteId,
          method: 'dns',
        });

      expect(res.status).toBe(200);
      // Will fail because example.com doesn't have our TXT record
      expect(res.body.ok).toBe(false);
      expect(res.body.details).toBeDefined();
    });
  });

  describe('Manual Verification and License Terms', () => {
    let siteId: number;

    beforeAll(async () => {
      // Create and manually verify a site for testing
      const site = await prisma.site.create({
        data: {
          domain: 'verified-test.com',
          ownerAddress: testWallet.address,
          verificationToken: 'scrapesafe-test-token',
          verified: true,
          verificationMethod: 'manual',
          storyIpId: 'story:local:test',
        },
      });
      siteId = site.id;
    });

    it('POST /api/owner/set-terms should set license terms', async () => {
      const res = await request(app)
        .post('/api/owner/set-terms')
        .send({
          siteId,
          allowedActions: ['SCRAPE', 'TRAIN'],
          priceModel: 'FLAT',
          pricePerUnit: 100,
          priceToken: 'USDC',
          termsUri: 'https://example.com/terms',
        });

      expect(res.status).toBe(200);
      expect(res.body.licenseTerms).toBeDefined();
      expect(res.body.licenseTerms.allowedActions).toEqual(['SCRAPE', 'TRAIN']);
      expect(res.body.licenseTerms.priceModel).toBe('FLAT');
      expect(res.body.licenseTerms.pricePerUnit).toBe(100);
    });

    it('POST /api/owner/set-terms should reject unverified site', async () => {
      // Create unverified site
      const unverified = await prisma.site.create({
        data: {
          domain: 'unverified.com',
          ownerAddress: testWallet.address,
          verificationToken: 'token',
          verified: false,
        },
      });

      const res = await request(app)
        .post('/api/owner/set-terms')
        .send({
          siteId: unverified.id,
          allowedActions: ['SCRAPE'],
          priceModel: 'FLAT',
          pricePerUnit: 50,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('verified');
    });

    it('GET /api/market should list enabled terms', async () => {
      const res = await request(app).get('/api/market');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      
      const listing = res.body.find((l: any) => l.site.domain === 'verified-test.com');
      expect(listing).toBeDefined();
      expect(listing.licenseTerms.allowedActions).toEqual(['SCRAPE', 'TRAIN']);
    });

    it('GET /api/asset/:ipId should return asset by story IP ID', async () => {
      const res = await request(app).get('/api/asset/story:local:test');

      expect(res.status).toBe(200);
      expect(res.body.site.domain).toBe('verified-test.com');
      expect(res.body.licenseTerms).toBeDefined();
    });

    it('GET /api/asset/:siteId should return asset by site ID', async () => {
      const res = await request(app).get(`/api/asset/${siteId}`);

      expect(res.status).toBe(200);
      expect(res.body.site.domain).toBe('verified-test.com');
    });
  });

  describe('License Purchase Flow', () => {
    let siteId: number;
    let licenseId: number;
    let receipt: any;
    let signature: string;

    const buyerWallet = new ethers.Wallet(
      '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' // Hardhat #2
    );

    beforeAll(async () => {
      // Create a verified site with terms
      const site = await prisma.site.create({
        data: {
          domain: 'buy-test.com',
          ownerAddress: testWallet.address,
          verificationToken: 'token',
          verified: true,
          verificationMethod: 'manual',
          storyIpId: 'story:local:buytest',
        },
      });
      siteId = site.id;

      await prisma.licenseTerms.create({
        data: {
          siteId: site.id,
          allowedActions: JSON.stringify(['SCRAPE']),
          priceModel: 'FLAT',
          pricePerUnit: 50,
          priceToken: 'USD',
          enabled: true,
        },
      });
    });

    it('POST /api/buy should create a license with signed receipt', async () => {
      const res = await request(app)
        .post('/api/buy')
        .send({
          ipId: 'story:local:buytest',
          buyerAddress: buyerWallet.address,
        });

      expect(res.status).toBe(200);
      expect(res.body.licenseId).toBeDefined();
      expect(res.body.receipt).toBeDefined();
      expect(res.body.signature).toBeDefined();
      expect(res.body.receipt.buyerAddress).toBe(buyerWallet.address.toLowerCase());
      expect(res.body.receipt.issuer).toBe(getServerAddress());
      expect(res.body.paymentNote).toBeDefined();

      licenseId = res.body.licenseId;
      receipt = res.body.receipt;
      signature = res.body.signature;
    });

    it('GET /api/license/:licenseId should return license details', async () => {
      const res = await request(app).get(`/api/license/${licenseId}`);

      expect(res.status).toBe(200);
      expect(res.body.license.id).toBe(licenseId);
      expect(res.body.license.status).toBe('active');
      expect(res.body.license.proofSignature).toBe(signature);
      expect(res.body.terms).toBeDefined();
      expect(res.body.site).toBeDefined();
    });

    it('GET /api/check-license should return true for licensed buyer', async () => {
      const res = await request(app)
        .get('/api/check-license')
        .query({
          ipId: 'story:local:buytest',
          buyer: buyerWallet.address,
        });

      expect(res.status).toBe(200);
      expect(res.body.hasLicense).toBe(true);
      expect(res.body.licenseId).toBe(licenseId);
    });

    it('GET /api/check-license should return false for unlicensed buyer', async () => {
      const res = await request(app)
        .get('/api/check-license')
        .query({
          ipId: 'story:local:buytest',
          buyer: '0x0000000000000000000000000000000000000001',
        });

      expect(res.status).toBe(200);
      expect(res.body.hasLicense).toBe(false);
    });

    it('POST /api/validate-proof should verify valid signature', async () => {
      const res = await request(app)
        .post('/api/validate-proof')
        .send({
          receiptJson: receipt,
          signature,
        });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.signer).toBe(getServerAddress());
    });

    it('POST /api/validate-proof should reject invalid signature', async () => {
      const fakeSignature = '0x' + '00'.repeat(65);
      const res = await request(app)
        .post('/api/validate-proof')
        .send({
          receiptJson: receipt,
          signature: fakeSignature,
        });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    it('POST /api/validate-proof should reject tampered receipt', async () => {
      const tamperedReceipt = { ...receipt, pricePerUnit: 0 };
      const res = await request(app)
        .post('/api/validate-proof')
        .send({
          receiptJson: tamperedReceipt,
          signature,
        });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });
  });

  describe('Admin Routes', () => {
    let licenseId: number;

    beforeAll(async () => {
      // Create a license to revoke
      const site = await prisma.site.create({
        data: {
          domain: 'admin-test.com',
          ownerAddress: testWallet.address,
          verificationToken: 'token',
          verified: true,
          storyIpId: 'story:local:admintest',
        },
      });

      const terms = await prisma.licenseTerms.create({
        data: {
          siteId: site.id,
          allowedActions: JSON.stringify(['SCRAPE']),
          priceModel: 'FLAT',
          pricePerUnit: 25,
          priceToken: 'USD',
        },
      });

      const license = await prisma.license.create({
        data: {
          licenseTermsId: terms.id,
          buyerAddress: '0x1234567890123456789012345678901234567890',
          status: 'active',
        },
      });
      licenseId = license.id;
    });

    it('POST /api/admin/revoke-license should revoke a license', async () => {
      const res = await request(app)
        .post('/api/admin/revoke-license')
        .send({
          licenseId,
          reason: 'Test revocation',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it's revoked
      const license = await prisma.license.findUnique({
        where: { id: licenseId },
      });
      expect(license?.status).toBe('revoked');
    });

    it('GET /api/admin/stats should return statistics', async () => {
      const res = await request(app).get('/api/admin/stats');

      expect(res.status).toBe(200);
      expect(res.body.sites).toBeDefined();
      expect(res.body.sites.total).toBeGreaterThan(0);
      expect(res.body.licenses).toBeDefined();
    });
  });
});

describe('Utility Functions', () => {
  describe('stableStringify', () => {
    it('should produce consistent output regardless of key order', () => {
      const obj1 = { b: 2, a: 1, c: 3 };
      const obj2 = { a: 1, c: 3, b: 2 };

      expect(stableStringify(obj1)).toBe(stableStringify(obj2));
      expect(stableStringify(obj1)).toBe('{"a":1,"b":2,"c":3}');
    });

    it('should handle nested objects', () => {
      const obj = { z: { b: 2, a: 1 }, a: 1 };
      expect(stableStringify(obj)).toBe('{"a":1,"z":{"a":1,"b":2}}');
    });

    it('should handle arrays', () => {
      const obj = { arr: [3, 1, 2], key: 'value' };
      expect(stableStringify(obj)).toBe('{"arr":[3,1,2],"key":"value"}');
    });
  });
});

