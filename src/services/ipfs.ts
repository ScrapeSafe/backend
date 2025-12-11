/**
 * IPFS service for pinning metadata and receipts
 * Uses web3.storage if token is available, otherwise returns mock URIs
 */

interface UploadResult {
  uri: string;
  cid?: string;
  mocked: boolean;
}

// In-memory storage for mocked IPFS (development/testing)
const mockStorage = new Map<string, unknown>();
let mockCounter = 0;

/**
 * Check if web3.storage is configured
 */
export function isIpfsConfigured(): boolean {
  return !!process.env.WEB3_STORAGE_TOKEN;
}

/**
 * Upload JSON data to IPFS
 * Falls back to mock storage if no token configured
 */
export async function uploadJson(data: unknown, filename?: string): Promise<UploadResult> {
  const token = process.env.WEB3_STORAGE_TOKEN;
  
  if (!token) {
    // Mock mode - store in memory and return fake CID
    const mockCid = `bafymock${++mockCounter}${Date.now().toString(36)}`;
    mockStorage.set(mockCid, data);
    console.log(`[IPFS Mock] Stored ${filename || 'data'} as ${mockCid}`);
    return {
      uri: `ipfs://${mockCid}`,
      cid: mockCid,
      mocked: true,
    };
  }
  
  // Real web3.storage upload
  try {
    const jsonBlob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const file = new File([jsonBlob], filename || 'data.json', { type: 'application/json' });
    
    // Using web3.storage HTTP API
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('https://api.web3.storage/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`web3.storage upload failed: ${response.status}`);
    }
    
    const result = await response.json() as { cid: string };
    
    return {
      uri: `ipfs://${result.cid}`,
      cid: result.cid,
      mocked: false,
    };
  } catch (error) {
    console.error('[IPFS] Upload failed, falling back to mock:', error);
    // Fallback to mock on error
    const mockCid = `bafymock${++mockCounter}${Date.now().toString(36)}`;
    mockStorage.set(mockCid, data);
    return {
      uri: `ipfs://${mockCid}`,
      cid: mockCid,
      mocked: true,
    };
  }
}

/**
 * Retrieve data from mock storage (for testing)
 */
export function getMockData(cid: string): unknown | undefined {
  return mockStorage.get(cid);
}

/**
 * Clear mock storage (for testing)
 */
export function clearMockStorage(): void {
  mockStorage.clear();
  mockCounter = 0;
}

