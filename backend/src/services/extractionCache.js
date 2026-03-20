/**
 * Extraction Cache Service
 * Caches extraction results to avoid redundant API calls
 */

// In-memory cache for extraction results
const extractionCache = new Map();

// Cache TTL (time-to-live) in milliseconds
const CACHE_TTL_MS = 3600000; // 1 hour

// Maximum cache size (number of entries)
const MAX_CACHE_SIZE = 500;

/**
 * Generate cache key from document ID and provider
 * @param {string} documentId - Document UUID
 * @param {string} provider - Extraction provider name
 * @returns {string} Cache key
 */
function getCacheKey(documentId, provider) {
  return `${documentId}:${provider}`;
}

/**
 * Get cached extraction result
 * @param {string} documentId - Document UUID
 * @param {string} provider - Extraction provider name
 * @returns {Object|null} Cached extraction result or null if not found/expired
 */
export function getCachedExtraction(documentId, provider) {
  const key = getCacheKey(documentId, provider);
  const cached = extractionCache.get(key);
  
  if (!cached) {
    return null;
  }
  
  // Check if cache entry has expired
  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL_MS) {
    extractionCache.delete(key);
    console.log(`[ExtractionCache] Cache expired for ${key}`);
    return null;
  }
  
  console.log(`[ExtractionCache] Cache hit for ${key}`, {
    age: Math.round((now - cached.timestamp) / 1000),
    provider: cached.result.provider
  });
  
  return cached.result;
}

/**
 * Store extraction result in cache
 * @param {string} documentId - Document UUID
 * @param {string} provider - Extraction provider name
 * @param {Object} result - Extraction result to cache
 */
export function cacheExtraction(documentId, provider, result) {
  const key = getCacheKey(documentId, provider);
  
  // Enforce cache size limit (LRU eviction)
  if (extractionCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry
    const firstKey = extractionCache.keys().next().value;
    extractionCache.delete(firstKey);
    console.log(`[ExtractionCache] Evicted oldest entry: ${firstKey}`);
  }
  
  extractionCache.set(key, {
    result,
    timestamp: Date.now()
  });
  
  console.log(`[ExtractionCache] Cached extraction for ${key}`, {
    sections: result.sections?.length || 0,
    provider: result.provider
  });
}

/**
 * Invalidate cache entry
 * @param {string} documentId - Document UUID
 * @param {string} provider - Optional provider (if not specified, invalidates all providers)
 */
export function invalidateCache(documentId, provider = null) {
  if (provider) {
    const key = getCacheKey(documentId, provider);
    const deleted = extractionCache.delete(key);
    console.log(`[ExtractionCache] Invalidated ${key}: ${deleted}`);
  } else {
    // Invalidate all providers for this document
    const keysToDelete = [];
    for (const key of extractionCache.keys()) {
      if (key.startsWith(`${documentId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => extractionCache.delete(key));
    console.log(`[ExtractionCache] Invalidated ${keysToDelete.length} entries for document ${documentId}`);
  }
}

/**
 * Clear entire cache
 */
export function clearCache() {
  const size = extractionCache.size;
  extractionCache.clear();
  console.log(`[ExtractionCache] Cleared ${size} cache entries`);
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getCacheStats() {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;
  
  for (const [key, cached] of extractionCache.entries()) {
    if (now - cached.timestamp > CACHE_TTL_MS) {
      expiredEntries++;
    } else {
      validEntries++;
    }
  }
  
  return {
    totalEntries: extractionCache.size,
    validEntries,
    expiredEntries,
    maxSize: MAX_CACHE_SIZE,
    ttlMs: CACHE_TTL_MS
  };
}