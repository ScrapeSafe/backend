/**
 * Check HTML meta tag for domain verification
 * Looks for <meta name="scrapesafe" content="{token}">
 */
export async function checkMetaTag(domain: string, expectedToken: string): Promise<{
  found: boolean;
  content: string | null;
  details: string;
}> {
  const url = `https://${domain}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ScrapeSafe-Verifier/1.0',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (!response.ok) {
      return {
        found: false,
        content: null,
        details: `Failed to fetch ${url}: HTTP ${response.status}`,
      };
    }
    
    const html = await response.text();
    
    // Parse meta tag - look for <meta name="scrapesafe" content="...">
    const metaRegex = /<meta\s+[^>]*name=["']scrapesafe["'][^>]*content=["']([^"']+)["'][^>]*>/i;
    const altRegex = /<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']scrapesafe["'][^>]*>/i;
    
    let match = html.match(metaRegex) || html.match(altRegex);
    
    if (match && match[1]) {
      const content = match[1];
      const found = content === expectedToken || content.includes(expectedToken);
      
      return {
        found,
        content,
        details: found 
          ? `Found valid scrapesafe meta tag` 
          : `Meta tag found but token mismatch. Expected: ${expectedToken}, Got: ${content}`,
      };
    }
    
    return {
      found: false,
      content: null,
      details: `No <meta name="scrapesafe"> tag found in page head`,
    };
  } catch (error) {
    const err = error as Error;
    return {
      found: false,
      content: null,
      details: `Failed to fetch or parse ${url}: ${err.message}`,
    };
  }
}

