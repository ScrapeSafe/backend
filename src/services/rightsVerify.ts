import { verifyOwnerSignature } from './signer';

interface RightsFile {
  domain: string;
  owner: string;
  token: string;
  timestamp: string;
  signature: string;
}

/**
 * Check .well-known/scrapesafe.json file for domain verification
 * The file must contain a valid signature from the owner wallet
 */
export async function checkRightsFile(
  domain: string, 
  expectedToken: string,
  expectedOwner: string
): Promise<{
  found: boolean;
  valid: boolean;
  details: string;
  payload?: RightsFile;
}> {
  const url = `https://${domain}/.well-known/scrapesafe.json`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ScrapeSafe-Verifier/1.0',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      return {
        found: false,
        valid: false,
        details: `Failed to fetch ${url}: HTTP ${response.status}`,
      };
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json') && !contentType.includes('text/')) {
      return {
        found: false,
        valid: false,
        details: `Invalid content type: ${contentType}. Expected application/json`,
      };
    }
    
    const payload = await response.json() as RightsFile;
    
    // Validate required fields
    if (!payload.domain || !payload.owner || !payload.token || !payload.signature) {
      return {
        found: true,
        valid: false,
        details: 'Rights file missing required fields (domain, owner, token, signature)',
        payload,
      };
    }
    
    // Check domain matches
    if (payload.domain !== domain) {
      return {
        found: true,
        valid: false,
        details: `Domain mismatch. Expected: ${domain}, Got: ${payload.domain}`,
        payload,
      };
    }
    
    // Check token matches
    if (payload.token !== expectedToken) {
      return {
        found: true,
        valid: false,
        details: `Token mismatch. Expected: ${expectedToken}, Got: ${payload.token}`,
        payload,
      };
    }
    
    // Check owner matches
    if (payload.owner.toLowerCase() !== expectedOwner.toLowerCase()) {
      return {
        found: true,
        valid: false,
        details: `Owner mismatch. Expected: ${expectedOwner}, Got: ${payload.owner}`,
        payload,
      };
    }
    
    // Verify signature (signature field is NOT part of the signed payload)
    const { signature, ...payloadWithoutSig } = payload;
    const verification = verifyOwnerSignature(payloadWithoutSig, signature, expectedOwner);
    
    if (!verification.valid) {
      return {
        found: true,
        valid: false,
        details: `Invalid signature. Recovered signer: ${verification.signer || 'none'}`,
        payload,
      };
    }
    
    return {
      found: true,
      valid: true,
      details: `Valid rights file with verified owner signature`,
      payload,
    };
  } catch (error) {
    const err = error as Error;
    return {
      found: false,
      valid: false,
      details: `Failed to fetch or parse rights file: ${err.message}`,
    };
  }
}

/**
 * Generate a rights file template for the owner to sign and host
 */
export function generateRightsFileTemplate(
  domain: string,
  owner: string,
  token: string
): { payload: object; instructions: string } {
  const payload = {
    domain,
    owner,
    token,
    timestamp: new Date().toISOString(),
  };
  
  const instructions = `
To verify your site using the file method:

1. Sign this JSON payload with your wallet (${owner}) using personal_sign:
   ${JSON.stringify(payload, null, 2)}

2. Add the "signature" field to the JSON

3. Host the complete JSON at:
   https://${domain}/.well-known/scrapesafe.json

Example signed file:
{
  "domain": "${domain}",
  "owner": "${owner}",
  "token": "${token}",
  "timestamp": "${payload.timestamp}",
  "signature": "0x..."
}
`.trim();
  
  return { payload, instructions };
}

