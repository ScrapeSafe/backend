import { ethers } from 'ethers';
import { stableStringify } from '../utils/stableStringify';

// Server signer wallet (initialized from env)
let serverWallet: ethers.Wallet | null = null;

/**
 * Initialize the server signing wallet
 */
export function initServerSigner(): ethers.Wallet {
  const privateKey = process.env.SERVER_SIGNER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('SERVER_SIGNER_PRIVATE_KEY environment variable is required');
  }
  serverWallet = new ethers.Wallet(privateKey);
  console.log(`Server signer initialized: ${serverWallet.address}`);
  return serverWallet;
}

/**
 * Get the server wallet instance
 */
export function getServerWallet(): ethers.Wallet {
  if (!serverWallet) {
    return initServerSigner();
  }
  return serverWallet;
}

/**
 * Get the server's public address
 */
export function getServerAddress(): string {
  return getServerWallet().address;
}

/**
 * Sign a message using the server's private key
 * Uses EIP-191 personal_sign
 */
export async function signMessage(message: string): Promise<string> {
  const wallet = getServerWallet();
  return wallet.signMessage(message);
}

/**
 * Sign a receipt object (canonicalizes before signing)
 */
export async function signReceipt(receipt: Record<string, unknown>): Promise<string> {
  const canonicalMessage = stableStringify(receipt);
  return signMessage(canonicalMessage);
}

/**
 * Verify a signature and recover the signer address
 */
export function verifySignature(message: string, signature: string): string {
  return ethers.verifyMessage(message, signature);
}

/**
 * Verify a signed receipt
 */
export function verifyReceipt(
  receipt: Record<string, unknown>,
  signature: string
): { valid: boolean; signer: string } {
  try {
    const canonicalMessage = stableStringify(receipt);
    const recoveredAddress = verifySignature(canonicalMessage, signature);
    const serverAddress = getServerAddress();
    return {
      valid: recoveredAddress.toLowerCase() === serverAddress.toLowerCase(),
      signer: recoveredAddress,
    };
  } catch (error) {
    return {
      valid: false,
      signer: '',
    };
  }
}

/**
 * Verify an owner's signature on a rights file
 */
export function verifyOwnerSignature(
  payload: Record<string, unknown>,
  signature: string,
  expectedOwner: string
): { valid: boolean; signer: string } {
  try {
    const canonicalMessage = stableStringify(payload);
    const recoveredAddress = verifySignature(canonicalMessage, signature);
    return {
      valid: recoveredAddress.toLowerCase() === expectedOwner.toLowerCase(),
      signer: recoveredAddress,
    };
  } catch (error) {
    return {
      valid: false,
      signer: '',
    };
  }
}

