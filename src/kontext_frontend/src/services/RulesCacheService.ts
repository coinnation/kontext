/**
 * RulesCacheService
 * 
 * Caches backend/frontend rules and vibe enhancement documents with automatic cache invalidation
 * based on ETag and Last-Modified headers (same pattern as TemplateManagerService).
 * 
 * This prevents fetching 750KB of rules on EVERY message, improving response time by 1-3 seconds.
 */

interface AssetMetadata {
  lastModified?: string; // Last-Modified header value
  etag?: string; // ETag header value
  url: string;
  cachedAt: number;
}

interface CachedDocument {
  content: string;
  fetchedAt: number;
  metadata?: AssetMetadata;
}

export class RulesCacheService {
  private static instance: RulesCacheService;
  
  private cache: {
    backendRules?: CachedDocument;
    frontendRules?: CachedDocument;
    vibeEnhancement?: CachedDocument;
  } = {};
  
  // 30-minute cache timeout (same as TemplateManagerService)
  private readonly cacheTimeout = 30 * 60 * 1000;
  
  // Base URL for rules files
  private static readonly BASE_URL = 'https://pwi5a-sqaaa-aaaaa-qcfgq-cai.raw.icp0.io/projects/project-mfvtjz8x-hc7uz';
  
  private constructor() {}
  
  public static getInstance(): RulesCacheService {
    if (!RulesCacheService.instance) {
      RulesCacheService.instance = new RulesCacheService();
    }
    return RulesCacheService.instance;
  }
  
  /**
   * Fetch all rules documents with caching
   * Returns cached versions if they're still valid
   */
  public async fetchAllRules(): Promise<{
    backendRules: string;
    frontendRules: string;
    vibeEnhancement: string;
  }> {
    console.log('📋 [RulesCache] Fetching rules documents...');
    
    const startTime = Date.now();
    
    // Fetch all three in parallel
    const [backendRules, frontendRules, vibeEnhancement] = await Promise.all([
      this.fetchCachedDocument('backendRules', `${RulesCacheService.BASE_URL}/backend_rules.md`),
      this.fetchCachedDocument('frontendRules', `${RulesCacheService.BASE_URL}/frontend_rules.md`),
      this.fetchCachedDocument('vibeEnhancement', `${RulesCacheService.BASE_URL}/vibe_enhancement.md`)
    ]);
    
    const duration = Date.now() - startTime;
    console.log(`✅ [RulesCache] All rules fetched in ${duration}ms`, {
      backendRulesSize: backendRules.length,
      frontendRulesSize: frontendRules.length,
      vibeEnhancementSize: vibeEnhancement.length,
      backendCached: this.cache.backendRules?.fetchedAt ? Date.now() - this.cache.backendRules.fetchedAt < 1000 : false,
      frontendCached: this.cache.frontendRules?.fetchedAt ? Date.now() - this.cache.frontendRules.fetchedAt < 1000 : false,
      vibeCached: this.cache.vibeEnhancement?.fetchedAt ? Date.now() - this.cache.vibeEnhancement.fetchedAt < 1000 : false
    });
    
    return {
      backendRules,
      frontendRules,
      vibeEnhancement
    };
  }
  
  /**
   * Fetch a single cached document with ETag/Last-Modified validation
   */
  private async fetchCachedDocument(
    type: 'backendRules' | 'frontendRules' | 'vibeEnhancement',
    url: string
  ): Promise<string> {
    const cached = this.cache[type];
    
    // Check if cache is valid
    if (cached && cached.fetchedAt) {
      const age = Date.now() - cached.fetchedAt;
      
      // If within timeout, check metadata to see if asset has been updated
      if (age < this.cacheTimeout) {
        const metadataCheck = await this.checkAssetMetadata(url, cached.metadata);
        
        if (!metadataCheck.hasChanged && cached.metadata) {
          console.log(`✅ [RulesCache] Using cached ${type} (metadata unchanged, age: ${Math.round(age / 1000)}s)`);
          return cached.content;
        }
        
        if (metadataCheck.hasChanged) {
          console.log(`🔄 [RulesCache] Asset updated, fetching fresh ${type}`);
        }
      } else {
        console.log(`⏰ [RulesCache] Cache expired for ${type}, fetching fresh (age: ${Math.round(age / 1000)}s)`);
      }
    }
    
    // Fetch fresh document
    console.log(`📥 [RulesCache] Fetching ${type} from ${url}...`);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`❌ [RulesCache] Failed to fetch ${type}: ${response.status}`);
      // Return cached version if available (even if expired), otherwise empty string
      return cached?.content || '';
    }
    
    const content = await response.text();
    
    // Extract metadata for cache invalidation
    const lastModified = response.headers.get('Last-Modified');
    const etag = response.headers.get('ETag');
    
    const metadata: AssetMetadata = {
      lastModified: lastModified || undefined,
      etag: etag || undefined,
      url,
      cachedAt: Date.now()
    };
    
    // Update cache
    this.cache[type] = {
      content,
      fetchedAt: Date.now(),
      metadata
    };
    
    console.log(`✅ [RulesCache] ${type} fetched and cached (${content.length} chars)`);
    
    return content;
  }
  
  /**
   * Check if asset has been updated by comparing metadata (Last-Modified or ETag headers)
   * This allows immediate detection of asset updates without waiting for cache timeout
   */
  private async checkAssetMetadata(
    url: string,
    cachedMetadata?: AssetMetadata
  ): Promise<{ hasChanged: boolean; newMetadata?: AssetMetadata }> {
    try {
      // Make HEAD request to check metadata without downloading content
      const response = await fetch(url, { method: 'HEAD' });
      
      if (!response.ok) {
        console.log(`⚠️ [RulesCache] HEAD request failed for ${url}, will fetch to check`);
        return { hasChanged: true };
      }
      
      const lastModified = response.headers.get('Last-Modified');
      const etag = response.headers.get('ETag');
      
      // If no metadata available, assume unchanged (fallback to time-based cache)
      if (!lastModified && !etag) {
        console.log(`ℹ️ [RulesCache] No metadata headers available for ${url}, using time-based cache`);
        return { hasChanged: false };
      }
      
      // Check if metadata has changed
      const hasChanged = cachedMetadata ? (
        (lastModified && cachedMetadata.lastModified !== lastModified) ||
        (etag && cachedMetadata.etag !== etag)
      ) : true;
      
      const newMetadata: AssetMetadata = {
        lastModified: lastModified || undefined,
        etag: etag || undefined,
        url,
        cachedAt: Date.now()
      };
      
      return { hasChanged, newMetadata };
      
    } catch (error) {
      console.warn(`⚠️ [RulesCache] Error checking asset metadata for ${url}:`, error);
      // On error, assume we need to fetch
      return { hasChanged: true };
    }
  }
  
  /**
   * Clear the cache (useful for testing or manual refresh)
   */
  public clearCache(): void {
    this.cache = {};
    console.log('🗑️ [RulesCache] Cache cleared');
  }
  
  /**
   * Get cache stats for debugging
   */
  public getCacheStats(): {
    backendRules: { cached: boolean; age?: number; size?: number };
    frontendRules: { cached: boolean; age?: number; size?: number };
    vibeEnhancement: { cached: boolean; age?: number; size?: number };
  } {
    const now = Date.now();
    
    return {
      backendRules: {
        cached: !!this.cache.backendRules,
        age: this.cache.backendRules ? now - this.cache.backendRules.fetchedAt : undefined,
        size: this.cache.backendRules?.content.length
      },
      frontendRules: {
        cached: !!this.cache.frontendRules,
        age: this.cache.frontendRules ? now - this.cache.frontendRules.fetchedAt : undefined,
        size: this.cache.frontendRules?.content.length
      },
      vibeEnhancement: {
        cached: !!this.cache.vibeEnhancement,
        age: this.cache.vibeEnhancement ? now - this.cache.vibeEnhancement.fetchedAt : undefined,
        size: this.cache.vibeEnhancement?.content.length
      }
    };
  }
}

export const rulesCacheService = RulesCacheService.getInstance();

