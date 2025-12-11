import { promises as dns } from 'dns';

/**
 * Check DNS TXT record for domain verification
 * Looks for TXT record at _scrapesafe.{domain}
 */
export async function checkDnsTxt(domain: string, expectedToken: string): Promise<{
  found: boolean;
  records: string[];
  details: string;
}> {
  const recordName = `_scrapesafe.${domain}`;
  
  try {
    const records = await dns.resolveTxt(recordName);
    // records is array of arrays (each TXT record can have multiple strings)
    const flatRecords = records.map(r => r.join(''));
    
    const found = flatRecords.some(record => 
      record.includes(expectedToken) || record === expectedToken
    );
    
    return {
      found,
      records: flatRecords,
      details: found 
        ? `Found valid token in TXT record at ${recordName}` 
        : `Token not found. Found records: ${flatRecords.join(', ') || 'none'}`,
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') {
      return {
        found: false,
        records: [],
        details: `No TXT record found at ${recordName}`,
      };
    }
    return {
      found: false,
      records: [],
      details: `DNS lookup failed: ${err.message}`,
    };
  }
}

