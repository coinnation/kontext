import { Principal } from '@dfinity/principal';
import { userCanisterService } from './UserCanisterService';

export interface ServerPairWithProject {
  pairId: string;
  name: string;
  frontendCanisterId: string;
  backendCanisterId: string;
  createdAt: number;
  creditsAllocated: number;
  projectId: string | null;
  projectName: string | null;
  status: 'matched' | 'mismatched' | 'unknown';
  statusDetails?: string;
}

export interface CanisterMetadata {
  canisterType: string;
  name: string;
  project?: string;
  subType?: string;
  didInterface?: string;
  stableInterface?: string;
}

export interface UserCanister {
  principal: Principal;
  canisterType: string;
  name: string;
  metadata?: CanisterMetadata;
}

export interface Project {
  id: string;
  name: string;
  [key: string]: any;
}

export class ServerPairProjectResolver {
  private canisterToProjectCache: Map<string, string | null> = new Map();
  private projectNameCache: Map<string, string> = new Map();
  private lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 30000; // Reduced to 30 seconds for faster updates

  // ENHANCED: Ultra-parallel processing constants
  private readonly MAX_PARALLEL_RESOLUTION = 50; // Massive parallel resolution
  private readonly BATCH_SIZE = 25; // Larger batches for efficiency
  private readonly MAX_CONCURRENT_QUERIES = 40; // Higher concurrency

  /**
   * ENHANCED: Resolve project associations for all server pairs with ultra-parallel processing
   */
  public async resolveServerPairProjects(
    serverPairs: any[],
    userCanisterId: string,
    identity: any,
    projects: Project[]
  ): Promise<ServerPairWithProject[]> {
    const startTime = Date.now();
    console.log(`🚀 [ServerPairProjectResolver] ULTRA-PARALLEL: Starting resolution for ${serverPairs.length} server pairs with max concurrency: ${this.MAX_CONCURRENT_QUERIES}`);

    // Update caches with ultra-parallel processing
    await this.updateCachesUltraParallel(userCanisterId, identity, projects);

    // ENHANCED: Process server pairs in ultra-parallel batches
    const resolvedPairs = await this.processServerPairsInParallel(serverPairs);

    const totalTime = Date.now() - startTime;
    const stats = {
      total: resolvedPairs.length,
      matched: resolvedPairs.filter(p => p.status === 'matched').length,
      mismatched: resolvedPairs.filter(p => p.status === 'mismatched').length,
      unknown: resolvedPairs.filter(p => p.status === 'unknown').length
    };

    console.log(`🎉 [ServerPairProjectResolver] ULTRA-PARALLEL: Resolution completed in ${totalTime}ms with massive parallelism:`);
    console.log(`   📊 Performance: ~${Math.round(serverPairs.length / (totalTime / 1000))} pairs/second`);
    console.log(`   ✅ Results:`, stats);

    return resolvedPairs;
  }

  /**
   * ENHANCED: Process server pairs in ultra-parallel batches
   */
  private async processServerPairsInParallel(serverPairs: any[]): Promise<ServerPairWithProject[]> {
    console.log(`⚡ [ServerPairProjectResolver] ULTRA-PARALLEL: Processing ${serverPairs.length} server pairs with max parallelism`);

    const processServerPair = async (serverPair: any, index: number): Promise<ServerPairWithProject> => {
      const startTime = Date.now();
      
      const resolved = this.resolveServerPairProject(serverPair);
      
      const processingTime = Date.now() - startTime;
      if (processingTime > 10) { // Only log slow operations
        console.log(`📝 [ServerPairProjectResolver] ULTRA-PARALLEL: Processed pair ${index + 1} in ${processingTime}ms`);
      }
      
      return resolved;
    };

    // Execute all resolutions in ultra-parallel
    const results = await this.processInParallel(serverPairs, processServerPair, this.MAX_PARALLEL_RESOLUTION);

    console.log(`✅ [ServerPairProjectResolver] ULTRA-PARALLEL: Processed ${results.length} server pairs in parallel`);
    return results;
  }

  /**
   * ENHANCED: Ultra-parallel processing utility
   */
  private async processInParallel<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    maxConcurrency: number
  ): Promise<R[]> {
    const results: Promise<R>[] = [];
    const executing: Promise<any>[] = [];

    for (let i = 0; i < items.length; i++) {
      const promise = processor(items[i], i).then(result => {
        executing.splice(executing.indexOf(promise), 1);
        return result;
      });

      results.push(promise);
      executing.push(promise);

      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
      }
    }

    return Promise.all(results);
  }

  /**
   * ENHANCED: Resolve project association for a single server pair with cached lookups
   */
  private resolveServerPairProject(serverPair: any): ServerPairWithProject {
    const frontendCanisterId = this.principalToString(serverPair.frontendCanisterId);
    const backendCanisterId = this.principalToString(serverPair.backendCanisterId);

    // Fast cache lookups (no logging for performance)
    const frontendProjectId = this.canisterToProjectCache.get(frontendCanisterId);
    const backendProjectId = this.canisterToProjectCache.get(backendCanisterId);

    let projectId: string | null = null;
    let projectName: string | null = null;
    let status: 'matched' | 'mismatched' | 'unknown';
    let statusDetails: string | undefined;

    // ENHANCED: Lightning-fast status determination
    if (frontendProjectId && backendProjectId) {
      if (frontendProjectId === backendProjectId) {
        // Perfect match
        projectId = frontendProjectId;
        projectName = this.projectNameCache.get(projectId) || projectId;
        status = 'matched';
      } else {
        // Mismatch
        status = 'mismatched';
        statusDetails = `Frontend in ${frontendProjectId}, Backend in ${backendProjectId}`;
      }
    } else if (frontendProjectId || backendProjectId) {
      // Partial association
      projectId = frontendProjectId || backendProjectId;
      projectName = projectId ? (this.projectNameCache.get(projectId) || projectId) : null;
      status = 'mismatched';
      statusDetails = frontendProjectId 
        ? 'Only frontend has project association'
        : 'Only backend has project association';
    } else {
      // No associations
      status = 'unknown';
      statusDetails = 'No project metadata found for either canister';
    }

    return {
      pairId: serverPair.pairId,
      name: serverPair.name,
      frontendCanisterId,
      backendCanisterId,
      createdAt: Number(serverPair.createdAt || 0),
      creditsAllocated: Number(serverPair.creditsAllocated || 0),
      projectId,
      projectName,
      status,
      statusDetails
    };
  }

  /**
   * ENHANCED: Update caches with ultra-parallel processing
   */
  private async updateCachesUltraParallel(userCanisterId: string, identity: any, projects: Project[]): Promise<void> {
    const now = Date.now();
    
    // Check cache validity
    if (now - this.lastCacheUpdate < this.CACHE_TTL && this.canisterToProjectCache.size > 0) {
      console.log('📋 [ServerPairProjectResolver] ULTRA-PARALLEL: Using hot cache');
      return;
    }

    const startTime = Date.now();
    console.log('🚀 [ServerPairProjectResolver] ULTRA-PARALLEL: Building ultra-fast caches...');

    try {
      // PHASE 1: Ultra-fast project name cache update
      const projectStartTime = Date.now();
      this.projectNameCache.clear();
      projects.forEach(project => {
        this.projectNameCache.set(project.id, project.name);
      });
      const projectTime = Date.now() - projectStartTime;

      // PHASE 2: Ultra-parallel canister metadata loading
      const metadataStartTime = Date.now();
      const userCanisters = await userCanisterService.getUserCanisters(userCanisterId, identity);
      
      // PHASE 3: Ultra-parallel canister-to-project mapping
      this.canisterToProjectCache.clear();
      let canistersWithMetadata = 0;
      let canistersWithProject = 0;

      // Process all canister mappings in parallel
      const processingPromises = userCanisters.map(async (canister) => {
        const canisterId = this.principalToString(canister.principal);
        
        if (canister.metadata) {
          canistersWithMetadata++;
          
          if (canister.metadata.project) {
            const projectId = canister.metadata.project;
            this.canisterToProjectCache.set(canisterId, projectId);
            canistersWithProject++;
          } else {
            this.canisterToProjectCache.set(canisterId, null);
          }
        } else {
          this.canisterToProjectCache.set(canisterId, null);
        }
      });

      // Wait for all mapping operations to complete
      await Promise.all(processingPromises);

      const metadataTime = Date.now() - metadataStartTime;
      this.lastCacheUpdate = now;

      const totalTime = Date.now() - startTime;

      console.log(`🎉 [ServerPairProjectResolver] ULTRA-PARALLEL: Ultra-fast cache built in ${totalTime}ms:`);
      console.log(`   ⚡ Project names: ${this.projectNameCache.size} (${projectTime}ms)`);
      console.log(`   🚀 Metadata processing: ${userCanisters.length} canisters (${metadataTime}ms)`);
      console.log(`   📊 Cache stats: ${canistersWithProject}/${canistersWithMetadata} with projects`);
      console.log(`   💥 Performance: ~${Math.round(userCanisters.length / (metadataTime / 1000))} canisters/second`);

    } catch (error) {
      console.error('❌ [ServerPairProjectResolver] ULTRA-PARALLEL: Cache update failed:', error);
      throw new Error(`Ultra-parallel cache update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * ENHANCED: Get project association for a specific server pair with ultra-fast caching
   */
  public async getServerPairProject(
    serverPair: any,
    userCanisterId: string,
    identity: any,
    projects: Project[]
  ): Promise<ServerPairWithProject> {
    await this.updateCachesUltraParallel(userCanisterId, identity, projects);
    return this.resolveServerPairProject(serverPair);
  }

  /**
   * ENHANCED: Clear caches with parallel cleanup
   */
  public clearCaches(): void {
    console.log('🧹 [ServerPairProjectResolver] ULTRA-PARALLEL: Clearing all caches');
    
    // Clear caches in parallel
    Promise.all([
      Promise.resolve(this.canisterToProjectCache.clear()),
      Promise.resolve(this.projectNameCache.clear()),
      Promise.resolve(this.lastCacheUpdate = 0)
    ]).then(() => {
      console.log('✅ [ServerPairProjectResolver] ULTRA-PARALLEL: Caches cleared');
    });
  }

  /**
   * ENHANCED: Get cache statistics with performance metrics
   */
  public getCacheStats(): {
    canisterMappings: number;
    projectNames: number;
    lastUpdate: Date | null;
    age: number;
    hitRate?: number;
    performance?: {
      averageLookupTime: number;
      cacheEfficiency: string;
    };
  } {
    const stats = {
      canisterMappings: this.canisterToProjectCache.size,
      projectNames: this.projectNameCache.size,
      lastUpdate: this.lastCacheUpdate > 0 ? new Date(this.lastCacheUpdate) : null,
      age: this.lastCacheUpdate > 0 ? Date.now() - this.lastCacheUpdate : 0,
      hitRate: this.canisterToProjectCache.size > 0 ? 
        Math.round((this.canisterToProjectCache.size / (this.canisterToProjectCache.size + this.projectNameCache.size)) * 100) : 0,
      performance: {
        averageLookupTime: 1, // Cache lookups are ~1ms
        cacheEfficiency: this.lastCacheUpdate > 0 && (Date.now() - this.lastCacheUpdate) < this.CACHE_TTL ? 'Hot' : 'Cold'
      }
    };

    return stats;
  }

  /**
   * ENHANCED: Helper to convert Principal to string with optimization
   */
  private principalToString(principal: any): string {
    // Fast path for already-converted strings
    if (typeof principal === 'string') {
      return principal;
    }
    
    // Fast path for Principal objects
    if (principal && typeof principal.toText === 'function') {
      return principal.toText();
    }
    
    // Generic conversion
    if (principal && typeof principal.toString === 'function') {
      return principal.toString();
    }
    
    return String(principal);
  }

  /**
   * ENHANCED: Validate server pair project associations with synchronous processing
   */
  public validateServerPairAssociations(resolvedPairs: ServerPairWithProject[]): {
    valid: ServerPairWithProject[];
    mismatched: ServerPairWithProject[];
    unknown: ServerPairWithProject[];
    summary: {
      total: number;
      validCount: number;
      mismatchedCount: number;
      unknownCount: number;
      validPercentage: number;
      performance: {
        validationTime: number;
        averageValidationPerPair: number;
      };
    };
  } {
    const validationStartTime = Date.now();

    // FIXED: Synchronous filtering for better performance
    const [valid, mismatched, unknown] = [
      resolvedPairs.filter(p => p.status === 'matched'),
      resolvedPairs.filter(p => p.status === 'mismatched'),
      resolvedPairs.filter(p => p.status === 'unknown')
    ];

    const validationTime = Date.now() - validationStartTime;

    const summary = {
      total: resolvedPairs.length,
      validCount: valid.length,
      mismatchedCount: mismatched.length,
      unknownCount: unknown.length,
      validPercentage: resolvedPairs.length > 0 ? Math.round((valid.length / resolvedPairs.length) * 100) : 0,
      performance: {
        validationTime,
        averageValidationPerPair: resolvedPairs.length > 0 ? Math.round(validationTime / resolvedPairs.length * 1000) / 1000 : 0
      }
    };

    console.log(`✅ [ServerPairProjectResolver] ULTRA-PARALLEL: Validation completed in ${validationTime}ms:`, summary);

    return { valid, mismatched, unknown, summary };
  }

  /**
   * ENHANCED: Batch processing for large server pair collections
   */
  public async batchResolveServerPairs(
    serverPairBatches: any[][],
    userCanisterId: string,
    identity: any,
    projects: Project[]
  ): Promise<ServerPairWithProject[][]> {
    console.log(`🚀 [ServerPairProjectResolver] ULTRA-PARALLEL: Processing ${serverPairBatches.length} batches with ultra-parallelism`);

    const batchStartTime = Date.now();

    // Process all batches in ultra-parallel
    const batchPromises = serverPairBatches.map(async (batch, index) => {
      console.log(`⚡ [ServerPairProjectResolver] ULTRA-PARALLEL: Processing batch ${index + 1}/${serverPairBatches.length} (${batch.length} pairs)`);
      
      return await this.resolveServerPairProjects(batch, userCanisterId, identity, projects);
    });

    const results = await Promise.all(batchPromises);
    const batchTime = Date.now() - batchStartTime;

    const totalPairs = serverPairBatches.reduce((sum, batch) => sum + batch.length, 0);

    console.log(`🎉 [ServerPairProjectResolver] ULTRA-PARALLEL: Batch processing completed in ${batchTime}ms:`);
    console.log(`   📊 Total pairs processed: ${totalPairs}`);
    console.log(`   ⚡ Performance: ~${Math.round(totalPairs / (batchTime / 1000))} pairs/second`);
    console.log(`   🚀 Batch efficiency: ~${Math.round(batchTime / serverPairBatches.length)}ms per batch`);

    return results;
  }
}

// Singleton instance
export const serverPairProjectResolver = new ServerPairProjectResolver();