/**
 * Platform Analytics Service
 * 
 * Easy-to-use wrapper for tracking analytics in the platform canister
 * Call these functions throughout your app to automatically track user behavior
 */

import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { idlFactory } from '../../candid/kontext_backend.did.js';
import type { _SERVICE } from '../../candid/kontext_backend.did';
import { icpData } from '../icpData';
import { getSharedAuthClient } from './SharedAuthClient';

class PlatformAnalyticsService {
  private static instance: PlatformAnalyticsService;
  private mainActor: any = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): PlatformAnalyticsService {
    if (!PlatformAnalyticsService.instance) {
      PlatformAnalyticsService.instance = new PlatformAnalyticsService();
    }
    return PlatformAnalyticsService.instance;
  }

  /**
   * Initialize the service (call once on app load)
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

      let identity: Identity | undefined;
      const isAuth = await globalAuthClient.isAuthenticated();
      if (isAuth) {
        identity = globalAuthClient.getIdentity();
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
              try {
                const result = await target[prop](...args);
                return icpData.fromCanister(result);
              } catch (error) {
                console.error(`[Analytics] Error in ${String(prop)}:`, error);
                // Fail silently - analytics shouldn't break the app
                return null;
              }
            };
          }
          return target[prop];
        }
      });

      this.isInitialized = true;
      console.log('✅ [Analytics] Service initialized');
    } catch (error) {
      console.error('❌ [Analytics] Initialization failed:', error);
      // Don't throw - analytics failure shouldn't break the app
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // USER ACTIVITY TRACKING
  // ═════════════════════════════════════════════════════════════════════════

  public async trackLogin(sessionId?: string): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    try {
      await this.mainActor?.trackUserActivity(
        { Login: null },
        sessionId ? [sessionId] : [],
        []
      );
      console.log('📊 [Analytics] Login tracked');
    } catch (error) {
      console.error('[Analytics] trackLogin failed:', error);
    }
  }

  public async trackLogout(sessionId?: string): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    try {
      await this.mainActor?.trackUserActivity(
        { Logout: null },
        sessionId ? [sessionId] : [],
        []
      );
      console.log('📊 [Analytics] Logout tracked');
    } catch (error) {
      console.error('[Analytics] trackLogout failed:', error);
    }
  }

  public async trackProjectCreated(projectName: string, sessionId?: string): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    try {
      await this.mainActor?.trackUserActivity(
        { ProjectCreated: null },
        sessionId ? [sessionId] : [],
        [JSON.stringify({ projectName })]
      );
      console.log('📊 [Analytics] Project created tracked:', projectName);
    } catch (error) {
      console.error('[Analytics] trackProjectCreated failed:', error);
    }
  }

  public async trackProjectDeployed(projectName: string, sessionId?: string): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    try {
      await this.mainActor?.trackUserActivity(
        { ProjectDeployed: null },
        sessionId ? [sessionId] : [],
        [JSON.stringify({ projectName })]
      );
      console.log('📊 [Analytics] Project deployed tracked:', projectName);
    } catch (error) {
      console.error('[Analytics] trackProjectDeployed failed:', error);
    }
  }

  public async trackAgentDeployed(agentName: string, sessionId?: string): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    try {
      await this.mainActor?.trackUserActivity(
        { AgentDeployed: null },
        sessionId ? [sessionId] : [],
        [JSON.stringify({ agentName })]
      );
      console.log('📊 [Analytics] Agent deployed tracked:', agentName);
    } catch (error) {
      console.error('[Analytics] trackAgentDeployed failed:', error);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // FEATURE USAGE TRACKING
  // ═════════════════════════════════════════════════════════════════════════

  public async trackAIRequest(
    model: 'claude' | 'openai' | 'gemini' | 'kimi',
    tokensConsumed: number,
    durationMs: number,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    try {
      const modelVariant = model === 'claude' ? { Claude: null } :
                          model === 'openai' ? { OpenAI: null } :
                          model === 'gemini' ? { Gemini: null } :
                          { Kimi: null };

      await this.mainActor?.trackFeatureUsage(
        { AIChat: null },
        [modelVariant],
        [tokensConsumed],
        [durationMs],
        success,
        errorMessage ? [errorMessage] : []
      );
      console.log(`📊 [Analytics] AI request tracked: ${model}, ${tokensConsumed} tokens`);
    } catch (error) {
      console.error('[Analytics] trackAIRequest failed:', error);
    }
  }

  public async trackDatabaseQuery(durationMs: number, success: boolean): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    try {
      await this.mainActor?.trackFeatureUsage(
        { DatabaseInterface: null },
        [],
        [],
        [durationMs],
        success,
        []
      );
      console.log('📊 [Analytics] Database query tracked');
    } catch (error) {
      console.error('[Analytics] trackDatabaseQuery failed:', error);
    }
  }

  public async trackFileUpload(durationMs: number, success: boolean): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    try {
      await this.mainActor?.trackFeatureUsage(
        { FileStorage: null },
        [],
        [],
        [durationMs],
        success,
        []
      );
      console.log('📊 [Analytics] File upload tracked');
    } catch (error) {
      console.error('[Analytics] trackFileUpload failed:', error);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // REVENUE TRACKING
  // ═════════════════════════════════════════════════════════════════════════

  public async trackSubscriptionPurchase(
    amountCents: number,
    tier: string,
    stripePaymentId: string
  ): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    try {
      await this.mainActor?.trackRevenue(
        amountCents,
        'usd',
        [tier],
        { Subscription: null },
        { Succeeded: null },
        [stripePaymentId]
      );
      console.log(`📊 [Analytics] Subscription tracked: ${tier}, $${amountCents / 100}`);
    } catch (error) {
      console.error('[Analytics] trackSubscriptionPurchase failed:', error);
    }
  }

  public async trackCreditsPurchase(
    amountCents: number,
    stripePaymentId: string
  ): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    try {
      await this.mainActor?.trackRevenue(
        amountCents,
        'usd',
        [],
        { Credits: null },
        { Succeeded: null },
        [stripePaymentId]
      );
      console.log(`📊 [Analytics] Credits purchase tracked: $${amountCents / 100}`);
    } catch (error) {
      console.error('[Analytics] trackCreditsPurchase failed:', error);
    }
  }

  public async trackMarketplaceSale(
    amountCents: number,
    stripePaymentId: string
  ): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    try {
      await this.mainActor?.trackRevenue(
        amountCents,
        'usd',
        [],
        { MarketplaceSale: null },
        { Succeeded: null },
        [stripePaymentId]
      );
      console.log(`📊 [Analytics] Marketplace sale tracked: $${amountCents / 100}`);
    } catch (error) {
      console.error('[Analytics] trackMarketplaceSale failed:', error);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ERROR TRACKING
  // ═════════════════════════════════════════════════════════════════════════

  public async trackError(
    type: 'deployment' | 'payment' | 'api' | 'canister' | 'auth' | 'validation' | 'storage' | 'network',
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    feature?: string,
    stackTrace?: string
  ): Promise<number | null> {
    if (!this.isInitialized) await this.initialize();
    try {
      const errorType = type === 'deployment' ? { DeploymentFailed: null } :
                       type === 'payment' ? { PaymentFailed: null } :
                       type === 'api' ? { APIError: null } :
                       type === 'canister' ? { CanisterError: null } :
                       type === 'auth' ? { AuthenticationError: null } :
                       type === 'validation' ? { ValidationError: null } :
                       type === 'storage' ? { StorageError: null } :
                       type === 'network' ? { NetworkError: null } :
                       { UnknownError: null };

      const severityVariant = severity === 'low' ? { Low: null } :
                             severity === 'medium' ? { Medium: null } :
                             severity === 'high' ? { High: null } :
                             { Critical: null };

      const errorId = await this.mainActor?.trackError(
        errorType,
        message,
        feature ? [feature] : [],
        severityVariant,
        stackTrace ? [stackTrace] : []
      );

      console.log(`📊 [Analytics] Error tracked: ${type} (${severity})`);
      return errorId || null;
    } catch (error) {
      console.error('[Analytics] trackError failed:', error);
      return null;
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PERFORMANCE TRACKING
  // ═════════════════════════════════════════════════════════════════════════

  public async trackPerformance(
    operation: 'deployment' | 'ai_request' | 'database_query' | 'file_upload' | 'file_download',
    durationMs: number,
    success: boolean
  ): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    try {
      const operationType = operation === 'deployment' ? { Deployment: null } :
                           operation === 'ai_request' ? { AIRequest: null } :
                           operation === 'database_query' ? { DatabaseQuery: null } :
                           operation === 'file_upload' ? { FileUpload: null } :
                           { FileDownload: null };

      await this.mainActor?.trackPerformance(
        operationType,
        durationMs,
        success
      );
      console.log(`📊 [Analytics] Performance tracked: ${operation} (${durationMs}ms)`);
    } catch (error) {
      console.error('[Analytics] trackPerformance failed:', error);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // HELPER: Performance Timer
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Easy wrapper to track operation duration
   * 
   * Usage:
   *   await analytics.trackOperation('deployment', async () => {
   *     await deployProject();
   *   });
   */
  public async trackOperation<T>(
    operation: 'deployment' | 'ai_request' | 'database_query' | 'file_upload' | 'file_download',
    asyncFn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    
    try {
      const result = await asyncFn();
      success = true;
      return result;
    } finally {
      const durationMs = Date.now() - startTime;
      await this.trackPerformance(operation, durationMs, success);
    }
  }
}

// Export singleton instance
export const platformAnalytics = PlatformAnalyticsService.getInstance();



