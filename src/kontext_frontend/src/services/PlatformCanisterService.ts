import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { idlFactory } from '../../candid/kontext_backend.did.js';
import { _SERVICE } from '../../candid/kontext_backend.did';
import { icpData } from '../icpData';
import { getSharedAuthClient } from './SharedAuthClient';
import { Principal } from '@dfinity/principal';

export class PlatformCanisterService {
  private static instance: PlatformCanisterService;
  private mainActor: _SERVICE | null = null;
  private isInitialized = false;
  private identity?: Identity;

  private constructor(identity?: Identity) {
    this.identity = identity;
    this.isInitialized = false;
    this.mainActor = null;
  }

  public static getInstance(): PlatformCanisterService {
    if (!PlatformCanisterService.instance) {
      PlatformCanisterService.instance = new PlatformCanisterService();
    }
    return PlatformCanisterService.instance;
  }

  /**
   * Create a new instance with a specific identity (for admin features)
   */
  public static createWithIdentity(identity: Identity): PlatformCanisterService {
    return new PlatformCanisterService(identity);
  }

  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const globalAuthClient = await getSharedAuthClient();
      const actualHost = 'https://icp0.io' || (
        typeof window !== 'undefined' && (
          window.location.hostname === 'localhost' || 
          window.location.hostname === '127.0.0.1'
        ) ? 'http://127.0.0.1:4943' : 'https://icp0.io'
      );

      let identity: Identity | undefined = this.identity;
      if (!identity) {
        const isAuth = await globalAuthClient.isAuthenticated();
        if (isAuth) {
          identity = globalAuthClient.getIdentity();
        }
      }

      const agentOptions: any = { host: actualHost };
      if (identity) {
        agentOptions.identity = identity;
      }

      const agent = new HttpAgent(agentOptions);
      
      if (actualHost.includes('localhost') || actualHost.includes('127.0.0.1')) {
        await agent.fetchRootKey();
      }

      const canisterActor = Actor.createActor<_SERVICE>(idlFactory, {
        agent,
        canisterId: 'pkmhr-fqaaa-aaaaa-qcfeq-cai', // Platform canister
      });

      this.mainActor = new Proxy(canisterActor, {
        get(target, prop) {
          if (typeof target[prop] === 'function') {
            return async (...args: any[]) => {
              const result = await target[prop](...args);
              return icpData.fromCanister(result);
            };
          }
          return target[prop];
        }
      });

      this.isInitialized = true;
      console.log('✅ [PlatformCanisterService] Initialized');
    } catch (error) {
      console.error('❌ [PlatformCanisterService] Initialization failed:', error);
      throw error;
    }
  }

  private async ensureInitialized(): Promise<_SERVICE> {
    if (!this.isInitialized || !this.mainActor) {
      await this.initialize();
    }
    if (!this.mainActor) {
      throw new Error('Platform canister service not initialized');
    }
    return this.mainActor;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCIAL ANALYTICS - AI TOKEN RESERVE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calculate AI Token Reserve (Claude API funding needed)
   */
  public async calculateAITokenReserve(): Promise<any> {
    const actor = await this.ensureInitialized();
    const result: any = await actor.calculateAITokenReserve();
    
    if ('ok' in result) {
      return result.ok;
    } else {
      throw new Error(result.err || 'Failed to calculate AI token reserve');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCIAL ANALYTICS - ICP RESERVE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calculate ICP Reserve (Platform wallet funding needed)
   */
  public async calculateICPReserve(): Promise<any> {
    const actor = await this.ensureInitialized();
    const result: any = await actor.calculateICPReserve();
    
    if ('ok' in result) {
      return result.ok;
    } else {
      throw new Error(result.err || 'Failed to calculate ICP reserve');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCIAL ANALYTICS - SUBSCRIPTION ALLOCATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get subscription allocation breakdown
   */
  public async getSubscriptionAllocations(): Promise<any[]> {
    const actor = await this.ensureInitialized();
    return await actor.getSubscriptionAllocations();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCIAL ANALYTICS - DOMAIN TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Track a domain purchase
   */
  public async trackDomainPurchase(
    domainName: string,
    domainType: any,
    costCents: bigint,
    provider: string
  ): Promise<bigint> {
    const actor = await this.ensureInitialized();
    const result: any = await actor.trackDomainPurchase(
      domainName,
      domainType,
      costCents,
      provider
    );
    
    if ('ok' in result) {
      return result.ok;
    } else {
      throw new Error(result.err || 'Failed to track domain purchase');
    }
  }

  /**
   * Get domain statistics
   */
  public async getDomainStatistics(): Promise<any> {
    const actor = await this.ensureInitialized();
    const result: any = await actor.getDomainStatistics();
    
    if ('ok' in result) {
      return result.ok;
    } else {
      throw new Error(result.err || 'Failed to get domain statistics');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCIAL ANALYTICS - TEAM MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Add a team member
   */
  public async addTeamMember(
    name: string,
    role: string,
    revenueSharePercent: number,
    subscriptionShare: boolean,
    creditCommissionShare: boolean,
    marketplaceShare: boolean
  ): Promise<bigint> {
    const actor = await this.ensureInitialized();
    const result: any = await actor.addTeamMember(
      name,
      role,
      revenueSharePercent,
      subscriptionShare,
      creditCommissionShare,
      marketplaceShare
    );
    
    if ('ok' in result) {
      return result.ok;
    } else {
      throw new Error(result.err || 'Failed to add team member');
    }
  }

  /**
   * Get all team members
   */
  public async getTeamMembers(): Promise<any[]> {
    const actor = await this.ensureInitialized();
    const result: any = await actor.getTeamMembers();
    
    if ('ok' in result) {
      return result.ok;
    } else {
      throw new Error(result.err || 'Failed to get team members');
    }
  }

  /**
   * Update a team member
   */
  public async updateTeamMember(
    memberId: bigint,
    revenueSharePercent?: number,
    active?: boolean
  ): Promise<void> {
    const actor = await this.ensureInitialized();
    const result: any = await actor.updateTeamMember(
      memberId,
      revenueSharePercent !== undefined ? [revenueSharePercent] : [],
      active !== undefined ? [active] : []
    );
    
    if ('err' in result) {
      throw new Error(result.err || 'Failed to update team member');
    }
  }

  /**
   * Calculate team earnings
   */
  public async calculateTeamEarnings(): Promise<any> {
    const actor = await this.ensureInitialized();
    const result: any = await actor.calculateTeamEarnings();
    
    if ('ok' in result) {
      return result.ok;
    } else {
      throw new Error(result.err || 'Failed to calculate team earnings');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCIAL ANALYTICS - COMMISSION TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Track credit commission (20% markup)
   */
  public async trackCreditCommission(
    userId: Principal,
    baseCostCredits: bigint,
    commissionCredits: bigint
  ): Promise<void> {
    const actor = await this.ensureInitialized();
    await actor.trackCreditCommission(userId, baseCostCredits, commissionCredits);
  }

  /**
   * Get credit commission percentage
   */
  public async getCreditCommissionPercent(): Promise<number> {
    const actor = await this.ensureInitialized();
    return await actor.getCreditCommissionPercent();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCIAL ANALYTICS - DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get complete financial dashboard
   */
  public async getFinancialDashboard(): Promise<string> {
    const actor = await this.ensureInitialized();
    const result: any = await actor.getFinancialDashboard();
    
    if ('ok' in result) {
      return result.ok;
    } else {
      throw new Error(result.err || 'Failed to get financial dashboard');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN - UPDATE BALANCES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update current balances (admin only)
   */
  public async updateCurrentBalances(
    claudeBalanceUSD: number,
    icpBalance: number
  ): Promise<void> {
    const actor = await this.ensureInitialized();
    const result: any = await actor.updateCurrentBalances(claudeBalanceUSD, icpBalance);
    
    if ('err' in result) {
      throw new Error(result.err || 'Failed to update current balances');
    }
  }

  // ===================================
  // ADMIN MANAGEMENT
  // ===================================

  /**
   * Add a new admin (only existing admins can do this)
   */
  public async addAdmin(newAdminPrincipal: string): Promise<string> {
    const actor = await this.ensureInitialized();
    const principal = Principal.fromText(newAdminPrincipal);
    const result: any = await actor.addAdmin(principal);
    
    if ('err' in result) {
      throw new Error(result.err || 'Failed to add admin');
    }
    
    return result.ok;
  }

  /**
   * Remove an admin (only existing admins can do this)
   */
  public async removeAdmin(adminPrincipal: string): Promise<string> {
    const actor = await this.ensureInitialized();
    const principal = Principal.fromText(adminPrincipal);
    const result: any = await actor.removeAdmin(principal);
    
    if ('err' in result) {
      throw new Error(result.err || 'Failed to remove admin');
    }
    
    return result.ok;
  }

  /**
   * Get list of all admins (only admins can view this)
   */
  public async getAdmins(): Promise<string[]> {
    const actor = await this.ensureInitialized();
    const result: any = await actor.getAdmins();
    
    if ('err' in result) {
      throw new Error(result.err || 'Failed to get admin list');
    }
    
    return result.ok;
  }

  /**
   * Check if current user is an admin
   */
  public async isAdmin(): Promise<boolean> {
    const actor = await this.ensureInitialized();
    return await actor.isAdmin();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CANISTER POOL MANAGEMENT (Admin Only)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Add a user canister to the pool
   */
  public async addUserCanisterToPool(
    canisterId: Principal,
    memoryGB: number,
    durationDays: number,
    metadata: Array<[string, string]> | null
  ): Promise<any> {
    const actor = await this.ensureInitialized();
    return await actor.addUserCanisterToPool(canisterId, BigInt(memoryGB), BigInt(durationDays), metadata ? [metadata] : []);
  }

  /**
   * Add a server pair to the pool
   */
  public async addServerPairToPool(
    pairId: string,
    frontendCanisterId: Principal,
    backendCanisterId: Principal,
    poolType: any,
    metadata: Array<[string, string]> | null
  ): Promise<any> {
    const actor = await this.ensureInitialized();
    return await actor.addServerPairToPool(pairId, frontendCanisterId, backendCanisterId, poolType, metadata ? [metadata] : []);
  }

  /**
   * Get pool statistics
   */
  public async getPoolStats(poolType: any): Promise<any> {
    const actor = await this.ensureInitialized();
    return await actor.getPoolStats(poolType);
  }

  /**
   * Get all pooled user canisters
   */
  public async getAllPooledUserCanisters(): Promise<any> {
    const actor = await this.ensureInitialized();
    return await actor.getAllPooledUserCanisters();
  }

  /**
   * Get all pooled server pairs
   */
  public async getAllPooledServerPairs(poolType: any): Promise<any> {
    const actor = await this.ensureInitialized();
    return await actor.getAllPooledServerPairs(poolType ? [poolType] : []);
  }

  /**
   * Remove a user canister from the pool
   */
  public async removeUserCanisterFromPool(canisterId: Principal): Promise<any> {
    const actor = await this.ensureInitialized();
    return await actor.removeUserCanisterFromPool(canisterId);
  }

  /**
   * Remove a server pair from the pool
   */
  public async removeServerPairFromPool(pairId: string): Promise<any> {
    const actor = await this.ensureInitialized();
    return await actor.removeServerPairFromPool(pairId);
  }

  /**
   * Get an available user canister from pool (for user creation flow)
   */
  public async getAvailableUserCanisterFromPool(): Promise<any> {
    const actor = await this.ensureInitialized();
    return await actor.getAvailableUserCanisterFromPool();
  }

  /**
   * Assign a user canister from pool to a user
   */
  public async assignUserCanisterFromPool(canisterId: Principal, userPrincipal: Principal): Promise<any> {
    const actor = await this.ensureInitialized();
    return await actor.assignUserCanisterFromPool(canisterId, userPrincipal);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER CANISTER ADMIN MANAGEMENT (Admin Only)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get user canister information for admin troubleshooting
   */
  public async getUserCanisterInfo(userPrincipal: Principal): Promise<any> {
    const actor = await this.ensureInitialized();
    return await actor.getUserCanisterInfo(userPrincipal);
  }

  /**
   * Top up a user's canister (Admin only)
   */
  public async adminTopUpUserCanister(userPrincipal: Principal, icpE8s: bigint): Promise<any> {
    const actor = await this.ensureInitialized();
    return await actor.adminTopUpUserCanister(userPrincipal, BigInt(icpE8s));
  }

  /**
   * Replace a user's canister with a new one (Admin only)
   */
  public async adminReplaceUserCanister(
    userPrincipal: Principal,
    newCanisterId: Principal,
    reason: string
  ): Promise<any> {
    const actor = await this.ensureInitialized();
    return await actor.adminReplaceUserCanister(userPrincipal, newCanisterId, reason);
  }

  /**
   * Get all users with their canister IDs (Admin only)
   */
  public async getAllUserCanisters(): Promise<any> {
    const actor = await this.ensureInitialized();
    return await actor.getAllUserCanisters();
  }

    /**
     * Update WASM configuration (Admin only)
     */
    public async updateWasmConfig(config: {
        assetCanisterId?: string;
        basePath?: string;
        userCanisterWasm?: string;
        assetStorageWasm?: string;
        agentWasm?: string;
        agentWasmGz?: string;
        agencyWasm?: string;
        agencyWasmGz?: string;
    }): Promise<any> {
        const actor = await this.ensureInitialized();
        
        return await actor.updateWasmConfig(
            config.assetCanisterId ? [config.assetCanisterId] : [],
            config.basePath ? [config.basePath] : [],
            config.userCanisterWasm ? [config.userCanisterWasm] : [],
            config.assetStorageWasm ? [config.assetStorageWasm] : [],
            config.agentWasm ? [config.agentWasm] : [],
            config.agentWasmGz ? [config.agentWasmGz] : [],
            config.agencyWasm ? [config.agencyWasm] : [],
            config.agencyWasmGz ? [config.agencyWasmGz] : []
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MARKETPLACE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Register a new marketplace listing
     */
    public async registerMarketplaceListing(
        projectId: string,
        userCanisterId: Principal,
        exportId: string,
        title: string,
        description: string,
        price: bigint,
        stripeAccountId: string,
        previewImages: string[],
        demoUrl: [] | [string],
        category: string,
        tags: string[],
        version: string
    ): Promise<{ ok?: any; err?: string }> {
        const actor = await this.ensureInitialized();
        try {
            // Convert demoUrl to optional format (?Text)
            // demoUrl is [] | [string], so check if it's an array with a value
            const demoUrlOpt: [] | [string] = (Array.isArray(demoUrl) && demoUrl.length > 0 && typeof demoUrl[0] === 'string') 
                ? [demoUrl[0]] 
                : [];
            
            const result = await actor.registerMarketplaceListing(
                projectId,
                userCanisterId,
                exportId,
                title,
                description,
                price,
                stripeAccountId,
                previewImages,
                demoUrlOpt,
                category,
                tags,
                version
            );
            
            // Handle Result type
            if (result && typeof result === 'object') {
                if ('ok' in result) {
                    return { ok: result.ok };
                } else if ('err' in result) {
                    return { err: result.err };
                } else if ('Ok' in result) {
                    return { ok: result.Ok };
                } else if ('Err' in result) {
                    return { err: result.Err };
                }
            }
            
            return { ok: result };
        } catch (error) {
            console.error('❌ [PlatformCanisterService] Error registering marketplace listing:', error);
            return { 
                err: error instanceof Error ? error.message : 'Unknown error registering listing' 
            };
        }
    }

    /**
     * Get all published marketplace listings (public)
     */
    public async getPublishedListings(): Promise<any[]> {
        const actor = await this.ensureInitialized();
        return await actor.getPublishedListings();
    }

    /**
     * Get published listings (paginated)
     */
    public async getPublishedListingsPaginated(limit: number, offset: number): Promise<{ listings: any[]; total: number }> {
        const actor = await this.ensureInitialized();
        const [listings, total] = await actor.getPublishedListingsPaginated(BigInt(limit), BigInt(offset));
        return { listings, total: Number(total) };
    }

    /**
     * Get all listings (admin only) - includes unpublished for moderation
     */
    public async getAllListings(): Promise<{ ok?: any[]; err?: string }> {
        const actor = await this.ensureInitialized();
        try {
            const result = await actor.getAllListings();
            if (result && typeof result === 'object') {
                if ('ok' in result) {
                    return { ok: result.ok };
                } else if ('err' in result) {
                    return { err: result.err };
                }
            }
            return { ok: result };
        } catch (error) {
            console.error('❌ [PlatformCanisterService] Error getting all listings:', error);
            return { 
                err: error instanceof Error ? error.message : 'Unknown error getting all listings' 
            };
        }
    }

    /**
     * Get all listings (admin only, paginated)
     */
    public async getAllListingsPaginated(limit: number, offset: number): Promise<{ ok?: { listings: any[]; total: number }; err?: string }> {
        const actor = await this.ensureInitialized();
        try {
            const result = await actor.getAllListingsPaginated(BigInt(limit), BigInt(offset));
            if (result && typeof result === 'object') {
                if ('ok' in result && Array.isArray(result.ok)) {
                    const [listings, total] = result.ok as [any[], bigint];
                    return { ok: { listings, total: Number(total) } };
                } else if ('err' in result) {
                    return { err: result.err as string };
                }
            }
            return { err: 'Unexpected result format' };
        } catch (error) {
            console.error('❌ [PlatformCanisterService] Error getting all listings (paginated):', error);
            return { err: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Get seller's own listings (any user)
     */
    public async getSellerListings(): Promise<any[]> {
        const actor = await this.ensureInitialized();
        return await actor.getSellerListings();
    }

    /**
     * Get listings by category
     */
    public async getListingsByCategory(category: string): Promise<any[]> {
        const actor = await this.ensureInitialized();
        return await actor.getListingsByCategory(category);
    }

    /**
     * Get listings by category (paginated)
     */
    public async getListingsByCategoryPaginated(category: string, limit: number, offset: number): Promise<{ listings: any[]; total: number }> {
        const actor = await this.ensureInitialized();
        const [listings, total] = await actor.getListingsByCategoryPaginated(category, BigInt(limit), BigInt(offset));
        return { listings, total: Number(total) };
    }

    /**
     * Get seller's listings (paginated)
     */
    public async getSellerListingsPaginated(limit: number, offset: number): Promise<{ listings: any[]; total: number }> {
        const actor = await this.ensureInitialized();
        const [listings, total] = await actor.getSellerListingsPaginated(BigInt(limit), BigInt(offset));
        return { listings, total: Number(total) };
    }

    /**
     * Get a specific listing
     */
    public async getMarketplaceListing(listingId: string): Promise<any> {
        const actor = await this.ensureInitialized();
        return await actor.getMarketplaceListing(listingId);
    }

    /**
     * Update marketplace listing (seller can update own, admin can update any)
     */
    public async updateMarketplaceListing(
        listingId: string,
        price?: bigint,
        title?: string,
        description?: string,
        previewImages?: string[],
        demoUrl?: string | null,
        tags?: string[],
        version?: string,
        isActive?: boolean
    ): Promise<{ ok?: any; err?: string }> {
        const actor = await this.ensureInitialized();
        try {
            // Convert demoUrl to nested optional format: [] for null/undefined, [[value]] for present
            // Backend expects: ?(?Text) which is [] | [Text] | [[Text]]
            const demoUrlOpt: [] | [string] | [[string]] = demoUrl && demoUrl.trim() 
                ? [[demoUrl]]  // Nested optional: [[string]]
                : [];          // Empty optional: []
            
            const result = await actor.updateMarketplaceListing(
                listingId,
                price !== undefined ? [price] : [],
                title ? [title] : [],
                description ? [description] : [],
                previewImages ? [previewImages] : [],
                demoUrlOpt,
                tags ? [tags] : [],
                version ? [version] : [],
                isActive !== undefined ? [isActive] : []
            );
            
            if (result && typeof result === 'object') {
                if ('ok' in result) {
                    return { ok: result.ok };
                } else if ('err' in result) {
                    return { err: result.err };
                }
            }
            return { ok: result };
        } catch (error) {
            console.error('❌ [PlatformCanisterService] Error updating marketplace listing:', error);
            return { 
                err: error instanceof Error ? error.message : 'Unknown error updating listing' 
            };
        }
    }

    /**
     * Publish listing (admin only)
     */
    public async publishListing(listingId: string): Promise<{ ok?: void; err?: string }> {
        const actor = await this.ensureInitialized();
        try {
            const result = await actor.publishListing(listingId);
            return result;
        } catch (error) {
            console.error('❌ [PlatformCanisterService] Error publishing listing:', error);
            return { 
                err: error instanceof Error ? error.message : 'Unknown error publishing listing' 
            };
        }
    }

    /**
     * Unpublish listing (admin only)
     */
    public async unpublishListing(listingId: string): Promise<{ ok?: void; err?: string }> {
        const actor = await this.ensureInitialized();
        try {
            const result = await actor.unpublishListing(listingId);
            return result;
        } catch (error) {
            console.error('❌ [PlatformCanisterService] Error unpublishing listing:', error);
            return { 
                err: error instanceof Error ? error.message : 'Unknown error unpublishing listing' 
            };
        }
    }

    /**
     * Delete marketplace listing (admin only) - for policy violations, orphaned listings, etc.
     */
    public async deleteMarketplaceListing(listingId: string): Promise<{ ok?: void; err?: string }> {
        const actor = await this.ensureInitialized();
        try {
            const result = await actor.deleteMarketplaceListing(listingId);
            return result;
        } catch (error) {
            console.error('❌ [PlatformCanisterService] Error deleting marketplace listing:', error);
            return { 
                err: error instanceof Error ? error.message : 'Unknown error deleting listing' 
            };
        }
    }

    /**
     * Get review summary for a listing
     */
    public async getListingReviewSummary(listingId: string): Promise<any> {
        const actor = await this.ensureInitialized();
        return await actor.getListingReviewSummary(listingId);
    }

    /**
     * Get all reviews for a listing
     */
    public async getListingReviews(listingId: string): Promise<any[]> {
        const actor = await this.ensureInitialized();
        return await actor.getListingReviews(listingId);
    }

    /**
     * Create a review (requires verified purchase)
     */
    public async createReview(
        listingId: string,
        purchaseId: string,
        rating: number,
        title: string,
        comment: string,
        pros: string[],
        cons: string[],
        wouldRecommend: boolean
    ): Promise<any> {
        const actor = await this.ensureInitialized();
        return await actor.createReview(
            listingId,
            purchaseId,
            rating,
            title,
            comment,
            pros,
            cons,
            wouldRecommend
        );
    }

    /**
     * Vote on review helpfulness
     */
    public async voteReviewHelpful(reviewId: string, isHelpful: boolean): Promise<any> {
        const actor = await this.ensureInitialized();
        return await actor.voteReviewHelpful(reviewId, isHelpful);
    }

    /**
     * Report a review
     */
    public async reportReview(
        reviewId: string,
        reason: any,
        description: string
    ): Promise<any> {
        const actor = await this.ensureInitialized();
        return await actor.reportReview(reviewId, reason, description);
    }

    /**
     * Get buyer's purchases
     */
    public async getBuyerPurchases(): Promise<any[]> {
        const actor = await this.ensureInitialized();
        return await actor.getBuyerPurchases();
    }

    /**
     * Generate download token after purchase
     */
    public async generateDownloadToken(purchaseId: string): Promise<any> {
        const actor = await this.ensureInitialized();
        return await actor.generateDownloadToken(purchaseId);
    }

    /**
     * Get user purchases (alias for getBuyerPurchases)
     */
    public async getUserPurchases(): Promise<any[]> {
        return this.getBuyerPurchases();
    }

    /**
     * Create Stripe checkout session for marketplace purchase
     */
    public async createMarketplaceCheckout(
        listingId: string,
        seller: string,
        stripeAccountId: string
    ): Promise<any> {
        const actor = await this.ensureInitialized();
        // Note: This calls the existing createCheckoutSession with marketplace-specific parameters
        return await actor.createMarketplaceCheckout(listingId, Principal.fromText(seller), stripeAccountId);
    }

    /**
     * Install purchased app into user's environment
     */
    public async installPurchasedApp(
        purchaseId: string,
        listingId: string
    ): Promise<any> {
        const actor = await this.ensureInitialized();
        return await actor.installPurchasedApp(purchaseId, listingId);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // SUBSCRIPTION PLAN MANAGEMENT
    // ═════════════════════════════════════════════════════════════════════════════

    /**
     * Get active subscription plans (public)
     */
    public async getActiveSubscriptionPlans(): Promise<any> {
        const actor = await this.ensureInitialized();
        return await actor.getActiveSubscriptionPlans();
    }

    /**
     * Get subscription plan by tier (public)
     */
    public async getSubscriptionPlanByTier(tier: any): Promise<any> {
        const actor = await this.ensureInitialized();
        return await actor.getSubscriptionPlanByTier(tier);
    }

    /**
     * Get all subscription plans (admin only)
     */
    public async getAllSubscriptionPlans(): Promise<any> {
        const actor = await this.ensureInitialized();
        const identity = this.identity || (await getSharedAuthClient()).getIdentity();
        return await actor.getAllSubscriptionPlans(identity.getPrincipal());
    }

    /**
     * Create or update subscription plan (admin only)
     */
    public async upsertSubscriptionPlan(planInput: any): Promise<any> {
        const actor = await this.ensureInitialized();
        return await actor.upsertSubscriptionPlan(planInput);
    }

    /**
     * Delete subscription plan (admin only)
     */
    public async deleteSubscriptionPlan(tier: any): Promise<any> {
        const actor = await this.ensureInitialized();
        return await actor.deleteSubscriptionPlan(tier);
    }

    /**
     * Initialize default subscription plans (admin only)
     */
    public async initializeDefaultSubscriptionPlans(): Promise<any> {
        const actor = await this.ensureInitialized();
        return await actor.initializeDefaultSubscriptionPlans();
    }

    /**
     * Get comprehensive subscription enforcement prompt (admin only)
     * Returns a formatted document for AI to understand tier restrictions
     */
    public async getSubscriptionPrompt(): Promise<any> {
        const actor = await this.ensureInitialized();
        const identity = this.identity || (await getSharedAuthClient()).getIdentity();
        return await actor.getSubscriptionPrompt(identity.getPrincipal());
    }

    // ========================================================================
    // UNIVERSITY CONTENT MANAGEMENT
    // ========================================================================

    /**
     * Create a new academic program (admin only)
     * FIXED: Converts string variants to proper Motoko variant format
     */
    public async createProgram(
        title: string,
        description: string,
        shortDescription: string,
        thumbnailUrl: string,
        instructorName: string,
        courseIds: string[],
        requiredCourses: string[],
        electiveCourses: string[],
        totalCredits: number,
        estimatedHours: number,
        difficulty: string,
        category: string,
        tags: string[],
        prerequisites: string[],
        degreeType: string
    ): Promise<any> {
        const actor = await this.ensureInitialized();
        
        // Convert difficulty string to variant: #beginner, #intermediate, #advanced, #expert
        const difficultyVariant = this.convertDifficultyToVariant(difficulty);
        
        // Convert degreeType string to variant: #certificate, #specialization, #diploma, #associate, #bachelor, #master, #nanodegree
        const degreeTypeVariant = this.convertDegreeTypeToVariant(degreeType);
        
        // Try createAcademicProgram first (actual backend method name), fallback to createProgram
        const methodName = typeof actor.createAcademicProgram === 'function' 
            ? 'createAcademicProgram' 
            : 'createProgram';
        
        const result = await actor[methodName](
            title,
            description,
            shortDescription,
            thumbnailUrl,
            instructorName,
            courseIds,
            requiredCourses,
            electiveCourses,
            totalCredits,
            estimatedHours,
            difficultyVariant,
            category,
            tags,
            prerequisites,
            degreeTypeVariant
        );
        
        // Extract result if it's wrapped in Result
        if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
            return result.ok || result.Ok;
        }
        return result;
    }

    /**
     * Update academic program (admin only)
     * Allows updating program fields including publishing status
     */
    public async updateProgram(
        programId: string,
        title?: string,
        description?: string,
        shortDescription?: string,
        courseIds?: string[],
        isPublished?: boolean
    ): Promise<{ ok?: void; err?: string }> {
        const actor = await this.ensureInitialized();
        
        const result = await actor.updateAcademicProgram(
            programId,
            title ? [title] : [],
            description ? [description] : [],
            shortDescription ? [shortDescription] : [],
            courseIds ? [courseIds] : [],
            isPublished !== undefined ? [isPublished] : []
        );
        
        return result;
    }

    /**
     * Publish/unpublish a program (admin only)
     */
    public async publishProgram(programId: string, publish: boolean): Promise<{ ok?: void; err?: string }> {
        return this.updateProgram(programId, undefined, undefined, undefined, undefined, publish);
    }

    /**
     * Create a new course (admin only)
     * FIXED: Converts programId to optional format, accessTier and difficulty to variants
     */
    public async createCourse(
        programId: string,
        title: string,
        description: string,
        shortDescription: string,
        thumbnailUrl: string,
        instructorName: string,
        lessonIds: string[],
        credits: number,
        estimatedHours: number,
        difficulty: string,
        category: string,
        tags: string[],
        prerequisites: string[],
        accessTier: string,
        syllabus: Array<{ week: number; topic: string; }>
    ): Promise<any> {
        const actor = await this.ensureInitialized();
        
        // Convert programId to optional format: [] for empty/null, [value] for present
        const programIdOpt = programId && programId.trim() ? [programId] : [];
        
        // Convert difficulty string to variant
        const difficultyVariant = this.convertDifficultyToVariant(difficulty);
        
        // Convert accessTier string to variant: #free, #starter, #developer, #pro, #enterprise
        const accessTierVariant = this.convertAccessTierToVariant(accessTier);
        
        // Convert syllabus format if needed (backend expects { sectionTitle, lessonIds, description })
        const syllabusFormatted = syllabus.map(item => ({
            sectionTitle: item.topic || `Week ${item.week}`,
            lessonIds: [],
            description: item.topic || ''
        }));
        
        const result = await actor.createCourse(
            programIdOpt,
            title,
            description,
            shortDescription,
            thumbnailUrl,
            instructorName,
            lessonIds,
            credits,
            estimatedHours,
            difficultyVariant,
            category,
            tags,
            prerequisites,
            accessTierVariant,
            syllabusFormatted
        );
        
        // Extract result if it's wrapped in Result
        if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
            return result.ok || result.Ok;
        }
        return result;
    }

    /**
     * Update academic course (admin only)
     * Allows updating course fields including publishing status
     */
    public async updateCourse(
        courseId: string,
        title?: string,
        description?: string,
        shortDescription?: string,
        lessonIds?: string[],
        isPublished?: boolean,
        isActive?: boolean
    ): Promise<{ ok?: void; err?: string }> {
        const actor = await this.ensureInitialized();
        
        const result = await actor.updateAcademicCourse(
            courseId,
            title ? [title] : [],
            description ? [description] : [],
            shortDescription ? [shortDescription] : [],
            lessonIds ? [lessonIds] : [],
            isPublished !== undefined ? [isPublished] : [],
            isActive !== undefined ? [isActive] : []
        );
        
        return result;
    }

    /**
     * Publish/unpublish a course (admin only)
     */
    public async publishCourse(courseId: string, publish: boolean): Promise<{ ok?: void; err?: string }> {
        return this.updateCourse(courseId, undefined, undefined, undefined, undefined, publish, undefined);
    }

    /**
     * Create a new lesson (admin only)
     * FIXED: Converts accessTier to variant, transcript to optional format
     */
    public async createLesson(
        courseId: string,
        title: string,
        description: string,
        youtubeVideoId: string,
        duration: number,
        orderIndex: number,
        accessTier: string,
        isFree: boolean,
        resources: Array<{ 
            title: string; 
            url: string; 
            resourceType: string;
        }>,
        transcript: string
    ): Promise<any> {
        const actor = await this.ensureInitialized();
        
        // Convert accessTier string to variant: #free, #starter, #developer, #pro, #enterprise
        const accessTierVariant = this.convertAccessTierToVariant(accessTier);
        
        // Convert transcript to optional format: [] for empty/null, [value] for present
        const transcriptOpt = transcript && transcript.trim() ? [transcript] : [];
        
        // Convert resources format - backend expects { resourceId, title, description, fileUrl, fileType, fileSize }
        const resourcesFormatted = resources.map((res, index) => ({
            resourceId: `resource_${Date.now()}_${index}`,
            title: res.title,
            description: res.title, // Use title as description if not provided
            fileUrl: res.url,
            fileType: this.convertResourceTypeToVariant(res.resourceType || 'other'),
            fileSize: 0 // Size not provided from UI, default to 0
        }));
        
        const result = await actor.createLesson(
            courseId,
            title,
            description,
            youtubeVideoId,
            duration,
            orderIndex,
            accessTierVariant,
            isFree,
            resourcesFormatted,
            transcriptOpt
        );
        
        // Extract result if it's wrapped in Result
        if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
            return result.ok || result.Ok;
        }
        return result;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LEARNING PATHS (Admin only)
    // ═══════════════════════════════════════════════════════════════════════════

    public async createLearningPath(
        title: string,
        description: string,
        programIds: string[],
        courseIds: string[],
        estimatedHours: number,
        difficulty: string,
        forRole: string
    ): Promise<string> {
        const actor = await this.ensureInitialized();
        
        const difficultyVariant = this.convertDifficultyToVariant(difficulty);
        
        console.log('📞 [PlatformCanisterService] Creating learning path...');
        
        const result = await actor.createLearningPath(
            title,
            description,
            programIds,
            courseIds,
            estimatedHours,
            difficultyVariant,
            forRole
        );
        
        if ('ok' in result) {
            console.log('✅ [PlatformCanisterService] Learning path created:', result.ok);
            return result.ok;
        } else {
            throw new Error(result.err);
        }
    }

    public async getLearningPaths(): Promise<any[]> {
        const actor = await this.ensureInitialized();
        
        try {
            const paths = await actor.getLearningPaths();
            console.log('✅ [PlatformCanisterService] Fetched learning paths:', paths.length);
            return paths;
        } catch (error) {
            console.error('❌ [PlatformCanisterService] Failed to get learning paths:', error);
            return [];
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER METHODS: Convert UI strings to Motoko variant format
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Convert difficulty string to Motoko variant format
     * Input: 'beginner' | 'intermediate' | 'advanced' | 'expert'
     * Output: { beginner: null } | { intermediate: null } | { advanced: null } | { expert: null }
     */
    private convertDifficultyToVariant(difficulty: string): any {
        const normalized = difficulty.toLowerCase().trim();
        switch (normalized) {
            case 'beginner':
                return { beginner: null };
            case 'intermediate':
                return { intermediate: null };
            case 'advanced':
                return { advanced: null };
            case 'expert':
                return { expert: null };
            default:
                console.warn(`⚠️ [PlatformCanisterService] Unknown difficulty "${difficulty}", defaulting to beginner`);
                return { beginner: null };
        }
    }

    /**
     * Convert accessTier string to Motoko variant format
     * Input: 'free' | 'starter' | 'developer' | 'pro' | 'enterprise'
     * Output: { free: null } | { starter: null } | { developer: null } | { pro: null } | { enterprise: null }
     */
    private convertAccessTierToVariant(accessTier: string): any {
        const normalized = accessTier.toLowerCase().trim();
        switch (normalized) {
            case 'free':
                return { free: null };
            case 'starter':
                return { starter: null };
            case 'developer':
                return { developer: null };
            case 'pro':
                return { pro: null };
            case 'enterprise':
                return { enterprise: null };
            default:
                console.warn(`⚠️ [PlatformCanisterService] Unknown accessTier "${accessTier}", defaulting to free`);
                return { free: null };
        }
    }

    /**
     * Convert degreeType string to Motoko variant format
     * Input: 'certificate' | 'specialization' | 'diploma' | 'associate' | 'bachelor' | 'master' | 'nanodegree' | 'doctorate'
     * Output: { certificate: null } | { specialization: null } | etc.
     * Note: 'doctorate' from UI maps to 'master' in backend (backend doesn't have doctorate)
     */
    private convertDegreeTypeToVariant(degreeType: string): any {
        const normalized = degreeType.toLowerCase().trim();
        switch (normalized) {
            case 'certificate':
                return { certificate: null };
            case 'specialization':
                return { specialization: null };
            case 'diploma':
                return { diploma: null };
            case 'associate':
                return { associate: null };
            case 'bachelor':
                return { bachelor: null };
            case 'master':
                return { master: null };
            case 'doctorate':
                // Backend doesn't have doctorate, map to master
                console.warn(`⚠️ [PlatformCanisterService] "doctorate" not supported, mapping to master`);
                return { master: null };
            case 'nanodegree':
                return { nanodegree: null };
            default:
                console.warn(`⚠️ [PlatformCanisterService] Unknown degreeType "${degreeType}", defaulting to certificate`);
                return { certificate: null };
        }
    }

    /**
     * Convert resourceType string to Motoko variant format
     * Backend expects: #pdf, #code, #slides, #worksheet, #other
     * Output: { pdf: null } | { code: null } | { slides: null } | { worksheet: null } | { other: null }
     */
    private convertResourceTypeToVariant(resourceType: string): any {
        const normalized = resourceType.toLowerCase().trim();
        switch (normalized) {
            case 'pdf':
            case 'document':
                return { pdf: null };
            case 'code':
            case 'codefile':
            case 'source':
                return { code: null };
            case 'slides':
            case 'presentation':
            case 'ppt':
            case 'pptx':
                return { slides: null };
            case 'worksheet':
            case 'exercise':
            case 'assignment':
                return { worksheet: null };
            case 'other':
            case 'link':
            case 'url':
            case 'video':
            default:
                console.warn(`⚠️ [PlatformCanisterService] Unknown resourceType "${resourceType}", defaulting to other`);
                return { other: null };
        }
    }
}

// Export singleton instance
export const platformCanisterService = PlatformCanisterService.getInstance();

