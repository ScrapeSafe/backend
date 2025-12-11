/**
 * IPFS Pin Worker
 * Handles background pinning of license receipts to IPFS
 * For MVP: Uses simple queue with in-memory storage
 */

import { uploadJson, isIpfsConfigured } from '../services/ipfs';
import prisma from '../db/prisma';

interface PinJob {
  licenseId: number;
  data: unknown;
  retries: number;
}

// Simple in-memory job queue
const pinQueue: PinJob[] = [];
let isProcessing = false;

/**
 * Add a pin job to the queue
 */
export function enqueuePinJob(licenseId: number, data: unknown): void {
  pinQueue.push({
    licenseId,
    data,
    retries: 0,
  });
  
  // Start processing if not already running
  if (!isProcessing) {
    processQueue();
  }
}

/**
 * Process the pin queue
 */
async function processQueue(): Promise<void> {
  if (isProcessing || pinQueue.length === 0) {
    return;
  }

  isProcessing = true;

  while (pinQueue.length > 0) {
    const job = pinQueue.shift();
    if (!job) continue;

    try {
      await processJob(job);
    } catch (error) {
      console.error(`[PinWorker] Failed to process job for license ${job.licenseId}:`, error);
      
      // Retry logic
      if (job.retries < 3) {
        job.retries++;
        pinQueue.push(job);
        console.log(`[PinWorker] Retrying job for license ${job.licenseId} (attempt ${job.retries + 1})`);
      }
    }

    // Small delay between jobs
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  isProcessing = false;
}

/**
 * Process a single pin job
 */
async function processJob(job: PinJob): Promise<void> {
  if (!isIpfsConfigured()) {
    console.log(`[PinWorker] IPFS not configured, skipping pin for license ${job.licenseId}`);
    return;
  }

  console.log(`[PinWorker] Pinning data for license ${job.licenseId}`);

  const result = await uploadJson(job.data, `license-${job.licenseId}.json`);

  // Update license with IPFS URI if it's a real pin (not mocked)
  if (!result.mocked) {
    await prisma.license.update({
      where: { id: job.licenseId },
      data: { proofUri: result.uri },
    });
    console.log(`[PinWorker] Updated license ${job.licenseId} with IPFS URI: ${result.uri}`);
  }
}

/**
 * Get queue status
 */
export function getQueueStatus(): { pending: number; processing: boolean } {
  return {
    pending: pinQueue.length,
    processing: isProcessing,
  };
}

/**
 * Clear the queue (for testing)
 */
export function clearQueue(): void {
  pinQueue.length = 0;
  isProcessing = false;
}

