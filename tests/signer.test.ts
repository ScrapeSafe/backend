import { ethers } from 'ethers';
import { 
  initServerSigner, 
  getServerAddress, 
  signMessage, 
  signReceipt,
  verifySignature,
  verifyReceipt,
  verifyOwnerSignature,
} from '../src/services/signer';
import { stableStringify } from '../src/utils/stableStringify';

describe('Signer Service', () => {
  const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const expectedAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

  beforeAll(() => {
    process.env.SERVER_SIGNER_PRIVATE_KEY = testPrivateKey;
    initServerSigner();
  });

  describe('initServerSigner', () => {
    it('should initialize with correct address', () => {
      const address = getServerAddress();
      expect(address.toLowerCase()).toBe(expectedAddress.toLowerCase());
    });
  });

  describe('signMessage', () => {
    it('should sign a message and be verifiable', async () => {
      const message = 'Hello, ScrapeSafe!';
      const signature = await signMessage(message);

      expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/);

      const recoveredAddress = verifySignature(message, signature);
      expect(recoveredAddress.toLowerCase()).toBe(expectedAddress.toLowerCase());
    });
  });

  describe('signReceipt', () => {
    it('should sign a receipt object canonically', async () => {
      const receipt = {
        licenseId: 1,
        buyerAddress: '0x1234',
        issuedAt: '2024-01-01T00:00:00Z',
      };

      const signature = await signReceipt(receipt);
      expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/);

      // Verify by signing the same canonical string
      const canonicalString = stableStringify(receipt);
      const wallet = new ethers.Wallet(testPrivateKey);
      const expectedSig = await wallet.signMessage(canonicalString);
      
      expect(signature).toBe(expectedSig);
    });

    it('should produce same signature regardless of key order', async () => {
      const receipt1 = { z: 1, a: 2 };
      const receipt2 = { a: 2, z: 1 };

      const sig1 = await signReceipt(receipt1);
      const sig2 = await signReceipt(receipt2);

      expect(sig1).toBe(sig2);
    });
  });

  describe('verifyReceipt', () => {
    it('should verify a valid server-signed receipt', async () => {
      const receipt = {
        licenseId: 42,
        buyer: '0xbuyer',
        timestamp: Date.now(),
      };

      const signature = await signReceipt(receipt);
      const result = verifyReceipt(receipt, signature);

      expect(result.valid).toBe(true);
      expect(result.signer.toLowerCase()).toBe(expectedAddress.toLowerCase());
    });

    it('should reject a tampered receipt', async () => {
      const receipt = { amount: 100 };
      const signature = await signReceipt(receipt);

      const tamperedReceipt = { amount: 0 };
      const result = verifyReceipt(tamperedReceipt, signature);

      expect(result.valid).toBe(false);
    });

    it('should reject an invalid signature', () => {
      const receipt = { test: true };
      const invalidSig = '0x' + '00'.repeat(65);

      const result = verifyReceipt(receipt, invalidSig);
      expect(result.valid).toBe(false);
    });
  });

  describe('verifyOwnerSignature', () => {
    it('should verify owner signature on rights file', async () => {
      const ownerWallet = ethers.Wallet.createRandom();
      const payload = {
        domain: 'example.com',
        owner: ownerWallet.address,
        token: 'scrapesafe-123',
        timestamp: new Date().toISOString(),
      };

      const canonicalMessage = stableStringify(payload);
      const signature = await ownerWallet.signMessage(canonicalMessage);

      const result = verifyOwnerSignature(payload, signature, ownerWallet.address);
      expect(result.valid).toBe(true);
      expect(result.signer.toLowerCase()).toBe(ownerWallet.address.toLowerCase());
    });

    it('should reject wrong owner', async () => {
      const realOwner = ethers.Wallet.createRandom();
      const wrongOwner = ethers.Wallet.createRandom();
      
      const payload = { data: 'test' };
      const canonicalMessage = stableStringify(payload);
      const signature = await realOwner.signMessage(canonicalMessage);

      const result = verifyOwnerSignature(payload, signature, wrongOwner.address);
      expect(result.valid).toBe(false);
    });
  });
});

