/**
 * Simple in-memory cache for MVP
 * Can be replaced with Redis for production
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class InMemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Cleanup expired entries every minute (skip in test environment)
    if (process.env.NODE_ENV !== 'test') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }
  }

  /**
   * Get a cached value
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    
    return entry.value;
  }

  /**
   * Set a cached value with TTL in seconds
   */
  set<T>(key: string, value: T, ttlSeconds: number = 300): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Delete a cached value
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all cached values
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Delete expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Stop the cleanup interval (for graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get cache stats
   */
  stats(): { size: number } {
    return { size: this.store.size };
  }
}

// Global cache instance
export const cache = new InMemoryCache();

// License check cache helpers
export function getLicenseCheckCacheKey(ipId: string, buyer: string): string {
  return `license:${ipId}:${buyer.toLowerCase()}`;
}

export function cacheLicenseCheck(
  ipId: string,
  buyer: string,
  hasLicense: boolean,
  licenseId?: number
): void {
  const key = getLicenseCheckCacheKey(ipId, buyer);
  cache.set(key, { hasLicense, licenseId }, 60); // Cache for 1 minute
}

export function getCachedLicenseCheck(
  ipId: string,
  buyer: string
): { hasLicense: boolean; licenseId?: number } | null {
  const key = getLicenseCheckCacheKey(ipId, buyer);
  return cache.get(key);
}

export function invalidateLicenseCache(ipId: string, buyer: string): void {
  const key = getLicenseCheckCacheKey(ipId, buyer);
  cache.delete(key);
}

