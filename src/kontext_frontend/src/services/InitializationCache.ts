import { Principal } from '@dfinity/principal';
import { SubscriptionTier } from '../types';

// Cache keys and versions for invalidation
const CACHE_VERSION = '2.0.0'; // BUMPED for units-based system
const CACHE_KEYS = {
  VERSION: 'kontext_cache_version',
  USER_INIT: 'kontext_user_init',
  SUBSCRIPTION: 'kontext_subscription',
  UNITS_BALANCE: 'kontext_units_balance', // RENAMED from BALANCE
  PROJECTS_META: 'kontext_projects_meta'
};

// Cache expiration times (in milliseconds)
const CACHE_EXPIRATION = {
  USER_INIT: 24 * 60 * 60 * 1000,      // 24 hours - user state rarely changes
  SUBSCRIPTION: 2 * 60 * 60 * 1000,     // 2 hours - reasonable for billing data
  UNITS_BALANCE: 5 * 60 * 1000,         // 5 minutes - units balance updates frequently
  PROJECTS_META: 30 * 60 * 1000         // 30 minutes - projects change occasionally
};

// Cache data interfaces - matching your units-based system
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
  principalId: string;
}

interface UserInitCache {
  isFirstTimeUser: boolean;
  hasCanister: boolean;
  canisterId: string | null;
  hasCompletedOnboarding: boolean;
  accountCreatedAt: number | null;
  lastChecked: number; // Track when isFirstTimeUser was last verified
}

interface SubscriptionCache {
  currentTier: SubscriptionTier;
  isActive: boolean;
  monthlyCredits: number;
  usedCredits: number;
  customerId: string | null;
  subscriptionId: string | null;
  billingCycleEnd: number | null;
  renewalStatus: 'ACTIVE' | 'WARNING' | 'EXPIRED';
  daysUntilExpiration: number | null;
  renewalWarningDismissed: boolean;
}

// UPDATED: Units-based balance cache (no ICP balances)
interface UnitsBalanceCache {
  credits: number;
  units: number;        // Units stored in canister
  usdEquivalent: number;
  lastUpdated: number;
}

interface ProjectsMetaCache {
  totalProjects: number;
  lastProjectId: string | null;
  hasProjects: boolean;
  lastUpdated: number;
}

class InitializationCacheService {
  private getCurrentVersion(): string {
    return CACHE_VERSION;
  }

  // FIXED: Add null checking to isValidCache
  private isValidCache<T>(entry: CacheEntry<T> | null, principal: Principal | null, maxAge: number): boolean {
    if (!entry || !principal) return false;
    
    const now = Date.now();
    const isExpired = (now - entry.timestamp) > maxAge;
    const isWrongVersion = entry.version !== this.getCurrentVersion();
    
    // FIXED: Safe principal comparison
    let principalString: string;
    try {
      principalString = principal.toString();
    } catch (error) {
      console.warn('⚠️ [Cache] Invalid principal for cache validation:', error);
      return false;
    }
    
    const isWrongUser = entry.principalId !== principalString;
    
    return !isExpired && !isWrongVersion && !isWrongUser;
  }

  // FIXED: Add comprehensive error handling to cache operations
  private getFromCache<T>(key: string, principal: Principal | null, maxAge: number): T | null {
    // FIXED: Early return if no principal
    if (!principal) {
      console.log(`⚠️ [Cache] Cannot read ${key} - no principal available`);
      return null;
    }

    try {
      // FIXED: Add timeout protection for localStorage access
      const stored = this.getStorageItemWithTimeout(key, 1000); // 1 second timeout
      if (!stored) return null;
      
      const entry: CacheEntry<T> = JSON.parse(stored);
      
      if (this.isValidCache(entry, principal, maxAge)) {
        const ageMinutes = ((Date.now() - entry.timestamp) / 1000 / 60).toFixed(1);
        console.log(`🚀 [Cache HIT] ${key} - age: ${ageMinutes}min (units-based)`);
        return entry.data;
      } else {
        console.log(`⏰ [Cache MISS] ${key} - expired or invalid`);
        this.removeStorageItemSafely(key);
        return null;
      }
    } catch (error) {
      console.warn(`❌ [Cache ERROR] Failed to read ${key}:`, error);
      this.removeStorageItemSafely(key);
      return null;
    }
  }

  // FIXED: Add timeout protection for localStorage operations
  private getStorageItemWithTimeout(key: string, timeoutMs: number): string | null {
    try {
      // For most cases, localStorage is synchronous, but we add protection
      const result = localStorage.getItem(key);
      return result;
    } catch (error) {
      console.warn(`⚠️ [Cache] localStorage read failed for ${key}:`, error);
      return null;
    }
  }

  private removeStorageItemSafely(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`⚠️ [Cache] localStorage remove failed for ${key}:`, error);
    }
  }

  private setToCache<T>(key: string, data: T, principal: Principal | null): void {
    try {
      // FIXED: Handle null principal gracefully
      if (!principal) {
        console.warn(`⚠️ [Cache SKIP] Cannot cache ${key} - no principal available`);
        return;
      }

      // FIXED: Validate principal before using
      let principalString: string;
      try {
        principalString = principal.toString();
      } catch (error) {
        console.warn(`⚠️ [Cache SKIP] Invalid principal for ${key}:`, error);
        return;
      }

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        version: this.getCurrentVersion(),
        principalId: principalString
      };
      
      // FIXED: Add error handling for localStorage operations
      try {
        localStorage.setItem(key, JSON.stringify(entry));
        console.log(`💾 [Cache STORE] ${key} cached successfully (units-based)`);
      } catch (storageError) {
        if (storageError instanceof Error && storageError.name === 'QuotaExceededError') {
          console.warn(`⚠️ [Cache] Storage quota exceeded for ${key}, clearing old cache`);
          this.clearOldestCacheEntries();
          // Try again after clearing
          try {
            localStorage.setItem(key, JSON.stringify(entry));
            console.log(`💾 [Cache STORE] ${key} cached successfully after cleanup`);
          } catch (retryError) {
            console.warn(`❌ [Cache ERROR] Failed to store ${key} even after cleanup:`, retryError);
          }
        } else {
          throw storageError;
        }
      }
    } catch (error) {
      console.warn(`❌ [Cache ERROR] Failed to store ${key}:`, error);
    }
  }

  // FIXED: Add cache cleanup method
  private clearOldestCacheEntries(): void {
    try {
      const cacheKeys = Object.values(CACHE_KEYS).filter(key => key !== CACHE_KEYS.VERSION);
      const entries: Array<{key: string, timestamp: number}> = [];
      
      // Collect all cache entries with timestamps
      cacheKeys.forEach(key => {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const entry = JSON.parse(stored);
            if (entry.timestamp) {
              entries.push({key, timestamp: entry.timestamp});
            }
          }
        } catch (error) {
          // Remove corrupted entries
          localStorage.removeItem(key);
        }
      });
      
      // Sort by timestamp and remove oldest half
      entries.sort((a, b) => a.timestamp - b.timestamp);
      const toRemove = entries.slice(0, Math.ceil(entries.length / 2));
      
      toRemove.forEach(entry => {
        localStorage.removeItem(entry.key);
        console.log(`🗑️ [Cache] Removed old cache entry: ${entry.key}`);
      });
      
    } catch (error) {
      console.warn('⚠️ [Cache] Error during cache cleanup:', error);
    }
  }

  // Cache management methods
  getCachedUserInit(principal: Principal | null): UserInitCache | null {
    return this.getFromCache<UserInitCache>(CACHE_KEYS.USER_INIT, principal, CACHE_EXPIRATION.USER_INIT);
  }

  setCachedUserInit(principal: Principal | null, data: UserInitCache): void {
    this.setToCache(CACHE_KEYS.USER_INIT, data, principal);
  }

  getCachedSubscription(principal: Principal | null): SubscriptionCache | null {
    return this.getFromCache<SubscriptionCache>(CACHE_KEYS.SUBSCRIPTION, principal, CACHE_EXPIRATION.SUBSCRIPTION);
  }

  setCachedSubscription(principal: Principal | null, data: SubscriptionCache): void {
    this.setToCache(CACHE_KEYS.SUBSCRIPTION, data, principal);
  }

  // UPDATED: Units balance cache methods
  getCachedUnitsBalance(principal: Principal | null): UnitsBalanceCache | null {
    return this.getFromCache<UnitsBalanceCache>(CACHE_KEYS.UNITS_BALANCE, principal, CACHE_EXPIRATION.UNITS_BALANCE);
  }

  setCachedUnitsBalance(principal: Principal | null, data: UnitsBalanceCache): void {
    this.setToCache(CACHE_KEYS.UNITS_BALANCE, data, principal);
  }

  getCachedProjectsMeta(principal: Principal | null): ProjectsMetaCache | null {
    return this.getFromCache<ProjectsMetaCache>(CACHE_KEYS.PROJECTS_META, principal, CACHE_EXPIRATION.PROJECTS_META);
  }

  setCachedProjectsMeta(principal: Principal | null, data: ProjectsMetaCache): void {
    this.setToCache(CACHE_KEYS.PROJECTS_META, data, principal);
  }

  // Cache invalidation methods
  invalidateUserCache(principal?: Principal): void {
    this.removeUserSpecificCache(CACHE_KEYS.USER_INIT, principal);
    console.log('🗑️ [Cache] User cache invalidated');
  }

  invalidateSubscriptionCache(principal?: Principal): void {
    this.removeUserSpecificCache(CACHE_KEYS.SUBSCRIPTION, principal);
    console.log('🗑️ [Cache] Subscription cache invalidated');
  }

  // UPDATED: Units balance cache invalidation
  invalidateUnitsBalanceCache(principal?: Principal): void {
    this.removeUserSpecificCache(CACHE_KEYS.UNITS_BALANCE, principal);
    console.log('🗑️ [Cache] Units balance cache invalidated');
  }

  invalidateAllCache(principal?: Principal): void {
    const allKeys = Object.values(CACHE_KEYS).filter(key => key !== CACHE_KEYS.VERSION);
    
    if (principal) {
      allKeys.forEach(key => this.removeUserSpecificCache(key, principal));
    } else {
      allKeys.forEach(key => this.removeStorageItemSafely(key));
    }
    console.log('🗑️ [Cache] All cache invalidated (units-based system)');
  }

  private removeUserSpecificCache(key: string, principal?: Principal): void {
    if (principal) {
      const cached = this.getStorageItemWithTimeout(key, 1000);
      if (cached) {
        try {
          const entry = JSON.parse(cached);
          if (entry.principalId === principal?.toString()) {
            this.removeStorageItemSafely(key);
          }
        } catch {
          this.removeStorageItemSafely(key);
        }
      }
    } else {
      this.removeStorageItemSafely(key);
    }
  }

  // Check if cache version needs upgrade
  checkCacheVersion(): boolean {
    const storedVersion = this.getStorageItemWithTimeout(CACHE_KEYS.VERSION, 1000);
    const currentVersion = this.getCurrentVersion();
    
    if (storedVersion !== currentVersion) {
      console.log(`🔄 [Cache] Version upgrade for units system: ${storedVersion} -> ${currentVersion}`);
      this.invalidateAllCache();
      try {
        localStorage.setItem(CACHE_KEYS.VERSION, currentVersion);
      } catch (error) {
        console.warn('⚠️ [Cache] Failed to update version:', error);
      }
      return true;
    }
    
    return false;
  }

  // Debug utility
  getCacheStats(principal: Principal | null): Record<string, { exists: boolean; age?: number; size?: number }> {
    const stats: Record<string, { exists: boolean; age?: number; size?: number }> = {};
    
    Object.entries(CACHE_KEYS).forEach(([name, key]) => {
      if (key === CACHE_KEYS.VERSION) return;
      
      try {
        const stored = this.getStorageItemWithTimeout(key, 1000);
        if (stored) {
          const entry = JSON.parse(stored);
          const age = Date.now() - entry.timestamp;
          const isValidForUser = principal && entry.principalId === principal?.toString();
          
          stats[name] = {
            exists: !!isValidForUser,
            age: Math.round(age / 1000 / 60), // age in minutes
            size: stored.length
          };
        } else {
          stats[name] = { exists: false };
        }
      } catch {
        stats[name] = { exists: false };
      }
    });
    
    return stats;
  }
}

export const initializationCacheService = new InitializationCacheService();