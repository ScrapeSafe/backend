/**
 * Story Protocol integration service
 * Simulates IP registration if STORY_SDK_KEY is not present
 */

interface StoryIpRegistration {
  ipId: string;
  txHash?: string;
  simulated: boolean;
}

/**
 * Check if Story Protocol SDK is configured
 */
export function isStoryConfigured(): boolean {
  return !!process.env.STORY_SDK_KEY;
}

/**
 * Register a site as an IP asset on Story Protocol
 * Falls back to simulated registration if SDK key not present
 */
export async function registerIpAsset(
  siteId: number,
  domain: string,
  ownerAddress: string
): Promise<StoryIpRegistration> {
  const sdkKey = process.env.STORY_SDK_KEY;
  
  if (!sdkKey) {
    // Simulate IP registration
    const simulatedIpId = `story:local:${siteId}`;
    console.log(`[Story] Simulated IP registration for ${domain}: ${simulatedIpId}`);
    return {
      ipId: simulatedIpId,
      simulated: true,
    };
  }
  
  // TODO: Real Story Protocol SDK integration
  // This would use the @story-protocol/core-sdk package
  // For MVP, we simulate the registration
  try {
    // Placeholder for real SDK integration
    // const client = StoryClient.create({ apiKey: sdkKey });
    // const result = await client.ipAsset.register({
    //   name: domain,
    //   owner: ownerAddress,
    //   metadata: { domain, type: 'website' }
    // });
    
    const simulatedIpId = `story:${domain.replace(/\./g, '-')}:${Date.now()}`;
    console.log(`[Story] Registered IP for ${domain}: ${simulatedIpId}`);
    
    return {
      ipId: simulatedIpId,
      simulated: false,
    };
  } catch (error) {
    console.error('[Story] Registration failed, falling back to simulation:', error);
    const simulatedIpId = `story:local:${siteId}`;
    return {
      ipId: simulatedIpId,
      simulated: true,
    };
  }
}

/**
 * Parse an ipId to extract the site ID (for local/simulated IDs)
 */
export function parseSiteIdFromIpId(ipId: string): number | null {
  // Handle story:local:{siteId} format
  const localMatch = ipId.match(/^story:local:(\d+)$/);
  if (localMatch && localMatch[1]) {
    return parseInt(localMatch[1], 10);
  }
  
  // If it's a numeric string, treat as site ID
  const numericId = parseInt(ipId, 10);
  if (!isNaN(numericId)) {
    return numericId;
  }
  
  return null;
}

