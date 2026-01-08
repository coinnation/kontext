import { Principal } from '@dfinity/principal';
import { Identity } from '@dfinity/agent';

/**
 * Initialization Recovery Service
 * 
 * Tracks and manages recovery from failed user account initialization.
 * Provides retry mechanisms and state persistence for resuming failed setups.
 */

export enum InitializationStep {
  CANISTER_CREATION = 'CANISTER_CREATION',
  WASM_DEPLOYMENT = 'WASM_DEPLOYMENT',
  ACCOUNT_INITIALIZATION = 'ACCOUNT_INITIALIZATION',
  SUBSCRIPTION_SETUP = 'SUBSCRIPTION_SETUP',
  COMPLETE = 'COMPLETE'
}

export interface InitializationState {
  step: InitializationStep;
  completedSteps: InitializationStep[];
  failedSteps: InitializationStep[];
  canisterId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  subscriptionTier: string | null;
  monthlyCredits: number | null;
  billingCycleStart: number | null;
  billingCycleEnd: number | null;
  error: string | null;
  lastAttemptAt: number | null;
  retryCount: number;
  sessionId: string | null; // Stripe session ID for recovery
}

export interface RecoveryResult {
  success: boolean;
  canRetry: boolean;
  nextStep: InitializationStep | null;
  error?: string;
  state?: InitializationState;
}

export class InitializationRecoveryService {
  private static instance: InitializationRecoveryService;
  private stateStorage: Map<string, InitializationState> = new Map();
  private readonly STORAGE_KEY_PREFIX = 'init_recovery_';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 2000; // 2 seconds base delay

  private constructor() {
    this.loadPersistedStates();
  }

  public static getInstance(): InitializationRecoveryService {
    if (!InitializationRecoveryService.instance) {
      InitializationRecoveryService.instance = new InitializationRecoveryService();
    }
    return InitializationRecoveryService.instance;
  }

  /**
   * Load persisted states from localStorage
   */
  private loadPersistedStates(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.STORAGE_KEY_PREFIX)) {
          const principal = key.replace(this.STORAGE_KEY_PREFIX, '');
          const stored = localStorage.getItem(key);
          if (stored) {
            try {
              const state = JSON.parse(stored);
              this.stateStorage.set(principal, state);
            } catch (e) {
              console.warn(`[RecoveryService] Failed to parse state for ${principal}:`, e);
            }
          }
        }
      });
    } catch (error) {
      console.error('[RecoveryService] Failed to load persisted states:', error);
    }
  }

  /**
   * Persist state to localStorage
   */
  private persistState(principal: string, state: InitializationState): void {
    try {
      const key = `${this.STORAGE_KEY_PREFIX}${principal}`;
      localStorage.setItem(key, JSON.stringify(state));
      this.stateStorage.set(principal, state);
    } catch (error) {
      console.error('[RecoveryService] Failed to persist state:', error);
    }
  }

  /**
   * Clear persisted state (after successful completion)
   */
  public clearState(principal: string): void {
    try {
      const key = `${this.STORAGE_KEY_PREFIX}${principal}`;
      localStorage.removeItem(key);
      this.stateStorage.delete(principal);
    } catch (error) {
      console.error('[RecoveryService] Failed to clear state:', error);
    }
  }

  /**
   * Start tracking initialization
   */
  public startInitialization(
    principal: string,
    sessionId: string | null = null
  ): InitializationState {
    const state: InitializationState = {
      step: InitializationStep.CANISTER_CREATION,
      completedSteps: [],
      failedSteps: [],
      canisterId: null,
      customerId: null,
      subscriptionId: null,
      subscriptionTier: null,
      monthlyCredits: null,
      billingCycleStart: null,
      billingCycleEnd: null,
      error: null,
      lastAttemptAt: Date.now(),
      retryCount: 0,
      sessionId
    };

    this.persistState(principal, state);
    return state;
  }

  /**
   * Mark a step as completed
   */
  public markStepCompleted(
    principal: string,
    step: InitializationStep,
    data?: Partial<InitializationState>
  ): InitializationState {
    const current = this.getState(principal);
    if (!current) {
      throw new Error('No initialization state found. Call startInitialization first.');
    }

    const updated: InitializationState = {
      ...current,
      completedSteps: [...current.completedSteps, step],
      failedSteps: current.failedSteps.filter(s => s !== step),
      step: this.getNextStep(step),
      error: null,
      retryCount: 0,
      ...data
    };

    this.persistState(principal, updated);
    return updated;
  }

  /**
   * Mark a step as failed
   */
  public markStepFailed(
    principal: string,
    step: InitializationStep,
    error: string
  ): InitializationState {
    const current = this.getState(principal);
    if (!current) {
      throw new Error('No initialization state found. Call startInitialization first.');
    }

    const updated: InitializationState = {
      ...current,
      failedSteps: current.failedSteps.includes(step) 
        ? current.failedSteps 
        : [...current.failedSteps, step],
      error,
      lastAttemptAt: Date.now(),
      retryCount: current.retryCount + 1
    };

    this.persistState(principal, updated);
    return updated;
  }

  /**
   * Get current state for a principal
   */
  public getState(principal: string): InitializationState | null {
    return this.stateStorage.get(principal) || null;
  }

  /**
   * Check if there's a recovery needed for a principal
   */
  public needsRecovery(principal: string): boolean {
    const state = this.getState(principal);
    if (!state) return false;

    // Needs recovery if there are failed steps or incomplete initialization
    return state.failedSteps.length > 0 || 
           state.step !== InitializationStep.COMPLETE;
  }

  /**
   * Get recovery information
   */
  public getRecoveryInfo(principal: string): RecoveryResult {
    const state = this.getState(principal);
    
    if (!state) {
      return {
        success: false,
        canRetry: false,
        nextStep: null,
        error: 'No initialization state found'
      };
    }

    if (state.step === InitializationStep.COMPLETE) {
      return {
        success: true,
        canRetry: false,
        nextStep: null
      };
    }

    // Check if we can retry
    const canRetry = state.retryCount < this.MAX_RETRIES;
    const nextStep = state.failedSteps.length > 0 
      ? state.failedSteps[0] // Retry first failed step
      : state.step; // Continue from current step

    return {
      success: false,
      canRetry,
      nextStep,
      state,
      error: state.error || undefined
    };
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  public getRetryDelay(retryCount: number): number {
    return this.RETRY_DELAY_MS * Math.pow(2, retryCount);
  }

  /**
   * Get next step in sequence
   */
  private getNextStep(currentStep: InitializationStep): InitializationStep {
    switch (currentStep) {
      case InitializationStep.CANISTER_CREATION:
        return InitializationStep.WASM_DEPLOYMENT;
      case InitializationStep.WASM_DEPLOYMENT:
        return InitializationStep.ACCOUNT_INITIALIZATION;
      case InitializationStep.ACCOUNT_INITIALIZATION:
        return InitializationStep.SUBSCRIPTION_SETUP;
      case InitializationStep.SUBSCRIPTION_SETUP:
        return InitializationStep.COMPLETE;
      default:
        return InitializationStep.COMPLETE;
    }
  }

  /**
   * Update state with subscription data
   */
  public updateSubscriptionData(
    principal: string,
    data: {
      customerId?: string;
      subscriptionId?: string;
      tier?: string;
      monthlyCredits?: number;
      billingCycleStart?: number;
      billingCycleEnd?: number;
    }
  ): InitializationState {
    const current = this.getState(principal);
    if (!current) {
      throw new Error('No initialization state found.');
    }

    const updated: InitializationState = {
      ...current,
      ...data
    };

    this.persistState(principal, updated);
    return updated;
  }

  /**
   * Check if canister exists (for recovery)
   */
  public async checkCanisterExists(
    canisterId: string | null
  ): Promise<boolean> {
    if (!canisterId) return false;

    try {
      // Try to query the canister to see if it exists
      const { Actor, HttpAgent } = await import('@dfinity/agent');
      const agent = new HttpAgent({ host: 'https://icp0.io' });
      
      // Simple check - try to read canister status
      // This is a lightweight check that doesn't require authentication
      const response = await fetch(`https://icp0.io/api/v2/canister/${canisterId}/status`);
      return response.ok;
    } catch (error) {
      console.warn('[RecoveryService] Could not verify canister existence:', error);
      return false;
    }
  }

  /**
   * Check if WASM is deployed (for recovery)
   */
  public async checkWasmDeployed(
    canisterId: string | null,
    identity: Identity
  ): Promise<boolean> {
    if (!canisterId) return false;

    try {
      const { userCanisterService } = await import('./UserCanisterService');
      await userCanisterService.initializeWithIdentity(identity);
      
      // Try to call a method that requires WASM to be deployed
      const userActor = await userCanisterService.getUserActor(canisterId, identity);
      
      // Try a simple read operation
      try {
        await userActor.getUserProfile();
        return true; // If we can call this, WASM is likely deployed
      } catch {
        return false;
      }
    } catch (error) {
      console.warn('[RecoveryService] Could not verify WASM deployment:', error);
      return false;
    }
  }

  /**
   * Check if account is initialized (for recovery)
   */
  public async checkAccountInitialized(
    canisterId: string,
    identity: Identity
  ): Promise<boolean> {
    try {
      const { userCanisterService } = await import('./UserCanisterService');
      await userCanisterService.initializeWithIdentity(identity);
      
      const userActor = await userCanisterService.getUserActor(canisterId, identity);
      
      try {
        const profile = await userActor.getUserProfile();
        return profile !== null && profile !== undefined;
      } catch {
        return false;
      }
    } catch (error) {
      console.warn('[RecoveryService] Could not verify account initialization:', error);
      return false;
    }
  }

  /**
   * Detect current state by checking what's actually completed
   */
  public async detectCurrentState(
    principal: string,
    identity: Identity
  ): Promise<InitializationState | null> {
    const stored = this.getState(principal);
    
    // If no stored state, check if user already has a canister
    if (!stored) {
      // Try to detect if user already has setup
      // This would require checking the main canister for user's canister ID
      return null;
    }

    // Verify each completed step
    const verified: InitializationState = {
      ...stored,
      completedSteps: [],
      failedSteps: []
    };

    // Check canister creation
    if (stored.canisterId) {
      const canisterExists = await this.checkCanisterExists(stored.canisterId);
      if (canisterExists) {
        verified.completedSteps.push(InitializationStep.CANISTER_CREATION);
      } else {
        verified.failedSteps.push(InitializationStep.CANISTER_CREATION);
      }
    }

    // Check WASM deployment
    if (stored.canisterId && verified.completedSteps.includes(InitializationStep.CANISTER_CREATION)) {
      const wasmDeployed = await this.checkWasmDeployed(stored.canisterId, identity);
      if (wasmDeployed) {
        verified.completedSteps.push(InitializationStep.WASM_DEPLOYMENT);
      } else {
        verified.failedSteps.push(InitializationStep.WASM_DEPLOYMENT);
      }
    }

    // Check account initialization
    if (stored.canisterId && verified.completedSteps.includes(InitializationStep.WASM_DEPLOYMENT)) {
      const accountInitialized = await this.checkAccountInitialized(stored.canisterId, identity);
      if (accountInitialized) {
        verified.completedSteps.push(InitializationStep.ACCOUNT_INITIALIZATION);
      } else {
        verified.failedSteps.push(InitializationStep.ACCOUNT_INITIALIZATION);
      }
    }

    // Determine current step
    if (verified.completedSteps.length === 0) {
      verified.step = InitializationStep.CANISTER_CREATION;
    } else if (verified.completedSteps.length === 1) {
      verified.step = InitializationStep.WASM_DEPLOYMENT;
    } else if (verified.completedSteps.length === 2) {
      verified.step = InitializationStep.ACCOUNT_INITIALIZATION;
    } else if (verified.completedSteps.length === 3) {
      verified.step = InitializationStep.SUBSCRIPTION_SETUP;
    } else {
      verified.step = InitializationStep.COMPLETE;
    }

    this.persistState(principal, verified);
    return verified;
  }
}

export const initializationRecoveryService = InitializationRecoveryService.getInstance();
