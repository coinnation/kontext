import { userCanisterService } from './UserCanisterService';
import { Identity } from '@dfinity/agent';
import { getIcpXdrConversionRate, icpToCycles } from '../utils/icpUtils';

export interface CreditsCalculation {
  credits: number;
  units: number;
  usdEquivalent: number;
  lastUpdated: number;
}

export interface CreditsConversion {
  creditsToUsd: (credits: number) => Promise<number>; 
  usdToCredits: (usd: number) => Promise<number>;
  unitsToCredits: (units: number) => Promise<number>;
  creditsToDescriptiveString: (credits: number) => string;
  getXdrRate: () => Promise<number>;
  getCyclesPerXdr: () => Promise<bigint>; // NEW: Direct XDR to cycles rate
}

export interface UserBalanceInfo {
  principal: string | null;
  subaccount: string | null;
  accountIdentifier: string | null;
  credits: number;
  units: number;
  usdEquivalent: number;
  lastFetched: number;
}

export interface PaymentCalculation {
  usdAmount: number;
  unitsAmount: number;
  estimatedCredits: number;
  xdrRate: number;
  cyclesPerXdr: string; // NEW: Direct cycles per XDR
}

export class CreditsService {
  private static xdrRateCache: { rate: number; timestamp: number } | null = null;
  private static cyclesPerXdrCache: { cycles: bigint; timestamp: number } | null = null; // NEW: Direct XDR to cycles cache
  private static readonly XDR_RATE_CACHE_TTL = 300000; // 5 minutes
  private static readonly CYCLES_PER_XDR_CACHE_TTL = 300000; // 5 minutes
  private static readonly FALLBACK_XDR_RATE = 1.35; // $1.35 per XDR approximately
  private static readonly FALLBACK_CYCLES_PER_XDR = BigInt(1_000_000_000_000); // 1T cycles per XDR

  private static balanceCaches: Map<string, { data: CreditsCalculation; timestamp: number }> = new Map();
  private static readonly BALANCE_CACHE_TTL = 120000; // 2 minutes

  private static readonly CREDITS_PER_TB_CYCLES = 1000;
  private static readonly TB_CYCLES = 1_000_000_000_000n;
  private static readonly UNITS_MULTIPLIER = 100; // $1 = 100 units
  
  private static ongoingFetches = new Map<string, Promise<any>>();

  /**
   * Get or create a promise for a specific operation
   */
  private static async getOrCreatePromise<T>(
    key: string,
    factory: () => Promise<T>
  ): Promise<T> {
    const existing = this.ongoingFetches.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = factory().finally(() => {
      this.ongoingFetches.delete(key);
    });

    this.ongoingFetches.set(key, promise);
    return promise;
  }

  /**
   * Fetch XDR to USD conversion rate with caching
   */
  public static async getXdrRate(): Promise<number> {
    return this.fetchXdrRate();
  }

  /**
   * Fetch XDR to USD conversion rate with caching (internal)
   */
  private static async fetchXdrRate(): Promise<number> {
    if (this.xdrRateCache && Date.now() - this.xdrRateCache.timestamp < this.XDR_RATE_CACHE_TTL) {
      return this.xdrRateCache.rate;
    }

    return this.getOrCreatePromise('xdr_rate', async () => {
      try {
        console.log('💱 [CreditsService] Fetching XDR to USD rate...');
        
        // Fetch XDR rate from IMF or reliable financial API
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/XDR');
        
        if (!response.ok) {
          throw new Error(`XDR API error: ${response.status}`);
        }
        
        const data = await response.json();
        const rate = data.rates?.USD;
        
        if (typeof rate !== 'number' || rate <= 0) {
          throw new Error('Invalid XDR rate data');
        }
        
        this.xdrRateCache = { rate, timestamp: Date.now() };
        console.log(`✅ [CreditsService] Current XDR rate: $${rate.toFixed(4)} per XDR`);
        return rate;
      } catch (error) {
        console.error('❌ [CreditsService] Error fetching XDR rate:', error);
        const fallbackRate = this.xdrRateCache?.rate || this.FALLBACK_XDR_RATE;
        console.log(`⚠️ [CreditsService] Using fallback XDR rate: $${fallbackRate}`);
        return fallbackRate;
      }
    });
  }

  /**
   * NEW: Fetch cycles per XDR conversion rate (public)
   */
  public static async getCyclesPerXdr(): Promise<bigint> {
    return this.fetchCyclesPerXdr();
  }

  /**
   * NEW: Fetch direct XDR to Cycles conversion rate (bypassing ICP entirely)
   */
  private static async fetchCyclesPerXdr(): Promise<bigint> {
    if (this.cyclesPerXdrCache && Date.now() - this.cyclesPerXdrCache.timestamp < this.CYCLES_PER_XDR_CACHE_TTL) {
      // console.log(`💾 [CreditsService] Using cached cycles per XDR: ${this.cyclesPerXdrCache.cycles.toString()}`);
      return this.cyclesPerXdrCache.cycles;
    }

    return this.getOrCreatePromise('cycles_per_xdr', async () => {
      try {
        console.log('⚡ [CreditsService] Fetching DIRECT XDR to Cycles rate (no ICP involved)...');
        
        // Use icpUtils to get the CMC XDR data, but extract the direct XDR-to-cycles relationship
        const cyclesPerIcp = await getIcpXdrConversionRate();
        
        console.log(`🔍 [CreditsService] CMC returned cycles per ICP: ${cyclesPerIcp.toString()}`);
        
        // From CMC data, we can derive the base XDR-to-cycles rate
        // The CMC gives us cycles per ICP, but we need cycles per XDR
        // Since 1 XDR historically = 1T cycles (this is the fundamental IC economic constant)
        const cyclesPerXdr = BigInt(1_000_000_000_000); // 1T cycles per XDR (base IC economic rate)
        
        console.log(`📐 [CreditsService] Using base IC economic rate: 1 XDR = ${cyclesPerXdr.toString()} cycles (1T)`);
        
        this.cyclesPerXdrCache = { cycles: cyclesPerXdr, timestamp: Date.now() };
        
        console.log(`✅ [CreditsService] Direct XDR to cycles rate established: ${cyclesPerXdr.toString()} cycles per XDR`);
        console.log(`💡 [CreditsService] This means: 1 XDR = ${Number(cyclesPerXdr) / 1_000_000_000_000}T cycles`);
        
        return cyclesPerXdr;
      } catch (error) {
        console.error('❌ [CreditsService] Error fetching direct XDR to cycles rate:', error);
        const fallbackRate = this.cyclesPerXdrCache?.cycles || this.FALLBACK_CYCLES_PER_XDR;
        console.log(`⚠️ [CreditsService] Using fallback XDR to cycles rate: ${fallbackRate.toString()} cycles per XDR`);
        return fallbackRate;
      }
    });
  }

  /**
   * COMPLETELY NEW: Convert units to credits using DIRECT XDR path (no ICP involved)
   */
  public static async convertUnitsToCredits(units: number): Promise<number> {
    if (units <= 0) return 0;

    try {
      // console.log('💰 [CreditsService] Starting DIRECT XDR units to credits conversion (NO ICP):', {
      //   inputUnits: units,
      //   method: 'direct_xdr_to_cycles_conversion'
      // });

      // Get current XDR rate and direct XDR-to-cycles rate
      const [xdrRate, cyclesPerXdr] = await Promise.all([
        this.fetchXdrRate(),      // USD per XDR
        this.fetchCyclesPerXdr()  // Cycles per XDR (direct, no ICP)
      ]);
      
      // Step 1: Convert units to USD
      const usdValue = units / this.UNITS_MULTIPLIER;
      
      // console.log('💰 [CreditsService] DIRECT XDR Step 1 - Units to USD:', {
      //   units,
      //   usdValue: usdValue.toFixed(2),
      //   unitsMultiplier: this.UNITS_MULTIPLIER,
      //   formula: `${units} units ÷ ${this.UNITS_MULTIPLIER} = $${usdValue.toFixed(2)}`
      // });
      
      // Step 2: Convert USD to XDR (direct)
      const xdrAmount = usdValue / xdrRate;
      
      // console.log('💰 [CreditsService] DIRECT XDR Step 2 - USD to XDR:', {
      //   usdValue: usdValue.toFixed(2),
      //   xdrRate: xdrRate.toFixed(4),
      //   xdrAmount: xdrAmount.toFixed(6),
      //   formula: `$${usdValue.toFixed(2)} ÷ $${xdrRate.toFixed(4)} per XDR = ${xdrAmount.toFixed(6)} XDR`
      // });
      
      // Step 3: Convert XDR to Cycles (direct, no ICP)
      const totalCycles = BigInt(Math.floor(xdrAmount * Number(cyclesPerXdr)));
      const totalCyclesInTrillions = Number(totalCycles) / 1_000_000_000_000;
      
      // console.log('💰 [CreditsService] DIRECT XDR Step 3 - XDR to Cycles:', {
      //   xdrAmount: xdrAmount.toFixed(6),
      //   cyclesPerXdr: cyclesPerXdr.toString(),
      //   cyclesPerXdrInTrillions: (Number(cyclesPerXdr) / 1_000_000_000_000).toFixed(3) + 'T',
      //   totalCycles: totalCycles.toString(),
      //   totalCyclesInTrillions: totalCyclesInTrillions.toFixed(6) + 'T',
      //   formula: `${xdrAmount.toFixed(6)} XDR × ${Number(cyclesPerXdr) / 1_000_000_000_000}T cycles/XDR = ${totalCyclesInTrillions.toFixed(3)}T cycles`
      // });
      
      // Step 4: Convert Cycles to Credits
      const credits = Math.floor(totalCyclesInTrillions * this.CREDITS_PER_TB_CYCLES);
      
      // console.log('💰 [CreditsService] DIRECT XDR Step 4 - Cycles to Credits:', {
      //   totalCyclesInTrillions: totalCyclesInTrillions.toFixed(6),
      //   creditsPerTB: this.CREDITS_PER_TB_CYCLES,
      //   finalCredits: credits,
      //   formula: `${totalCyclesInTrillions.toFixed(3)}T cycles × ${this.CREDITS_PER_TB_CYCLES} credits/T = ${credits} credits`
      // });
      
      // console.log('💰 [CreditsService] DIRECT XDR conversion complete (NO ICP NEEDED):', {
      //   inputUnits: units,
      //   inputUsd: usdValue.toFixed(2),
      //   xdrAmount: xdrAmount.toFixed(6),
      //   totalCyclesT: totalCyclesInTrillions.toFixed(3),
      //   finalCredits: credits,
      //   conversionPath: 'Units → USD → XDR → Cycles → Credits',
      //   noIcpRequired: true,
      //   improvement: 'Direct XDR conversion eliminates ICP price volatility'
      // });
      
      // Calculate what this would be for $100 for reference
      if (units === 10000) { // $100 worth
        console.log('💰 [CreditsService] $100 DIRECT XDR conversion reference:', {
          expectedFor100USD: credits,
          conversionRate: `$1 = ${(credits / 100).toFixed(0)} credits`,
          xdrBasedRate: `1 XDR = ${(credits * xdrRate / 100).toFixed(0)} credits`
        });
      }
      
      return credits;
    } catch (error) {
      console.error('❌ [CreditsService] Error in DIRECT XDR units to credits conversion:', error);
      // Fallback calculation using current market estimates
      const usdValue = units / this.UNITS_MULTIPLIER;
      const fallbackCredits = Math.floor(usdValue * 15000); // Rough estimate: $1 ≈ 15,000 credits
      console.log('⚠️ [CreditsService] Using fallback calculation:', {
        units,
        usdValue: usdValue.toFixed(2),
        fallbackCredits,
        method: 'fallback_direct_estimate'
      });
      return fallbackCredits;
    }
  }

  /**
   * Convert credits directly to cycles
   * Formula: 1 credit = 1 billion cycles (1,000,000,000 cycles)
   * This is the DIRECT conversion without going through USD/ICP
   */
  public static convertCreditsToCycles(credits: number): bigint {
    if (credits <= 0) return BigInt(0);
    
    // Direct conversion: 1 credit = 1 billion cycles
    // 1000 credits = 1 trillion cycles = 1.0T cycles
    const cyclesPerCredit = 1_000_000_000; // 1 billion cycles per credit
    const totalCycles = BigInt(Math.floor(credits * cyclesPerCredit));
    
    console.log('💰 [CreditsService] Direct credits to cycles conversion:', {
      credits,
      cyclesPerCredit,
      totalCycles: totalCycles.toString(),
      totalCyclesInTrillions: (Number(totalCycles) / 1_000_000_000_000).toFixed(6),
      formula: `${credits} credits × ${cyclesPerCredit} cycles/credit = ${totalCycles.toString()} cycles`
    });
    
    return totalCycles;
  }

  /**
   * Calculate units needed to achieve a target credit amount
   * Reverse of convertUnitsToCredits: credits → XDR → USD → units
   */
  public static async calculateUnitsForCredits(targetCredits: number): Promise<number> {
    if (targetCredits <= 0) return 0;

    try {
      console.log('💰 [CreditsService] Calculating units needed for target credits:', targetCredits);

      // Get current XDR rate
      const xdrRate = await this.fetchXdrRate();

      // Reverse calculation:
      // 1. Credits → TB cycles (1T cycles = 1000 credits)
      const tbCycles = targetCredits / this.CREDITS_PER_TB_CYCLES;
      
      // 2. TB cycles = XDR (since 1 XDR = 1T cycles)
      const xdrAmount = tbCycles;
      
      // 3. XDR → USD
      const usdValue = xdrAmount * xdrRate;
      
      // 4. USD → Units (100 units per $1)
      const unitsNeeded = Math.ceil(usdValue * this.UNITS_MULTIPLIER);

      console.log('💰 [CreditsService] Units calculation for target credits:', {
        targetCredits,
        tbCycles: tbCycles.toFixed(6),
        xdrAmount: xdrAmount.toFixed(6),
        xdrRate: xdrRate.toFixed(4),
        usdValue: usdValue.toFixed(2),
        unitsNeeded,
        formula: `${targetCredits} credits → ${tbCycles.toFixed(3)}T cycles → ${xdrAmount.toFixed(3)} XDR → $${usdValue.toFixed(2)} → ${unitsNeeded} units`
      });

      return unitsNeeded;
    } catch (error) {
      console.error('❌ [CreditsService] Error calculating units for credits:', error);
      // Fallback: approximate 7.35 credits per unit (observed rate)
      const fallbackUnits = Math.ceil(targetCredits / 7.35);
      console.log('⚠️ [CreditsService] Using fallback calculation:', {
        targetCredits,
        fallbackUnits,
        method: 'fallback_approximate'
      });
      return fallbackUnits;
    }
  }

  /**
   * Fetch user balance from units stored in canister
   */
  public static async fetchUserBalance(
    userCanisterId: string, 
    identity: Identity
  ): Promise<CreditsCalculation | null> {
    const cachedBalance = this.balanceCaches.get(userCanisterId);
    if (cachedBalance && Date.now() - cachedBalance.timestamp < this.BALANCE_CACHE_TTL) {
      return cachedBalance.data;
    }

    const cacheKey = `balance_${userCanisterId}`;

    return this.getOrCreatePromise(cacheKey, async () => {
      try {
        // console.log('💰 [CreditsService] Fetching units balance from user canister:', userCanisterId.substring(0, 10) + '...');

        // Fetch units from AI credits balance in canister
        let unitsBalance = await userCanisterService.getUserUnitsBalance(userCanisterId, identity);
        
        if (unitsBalance === null || unitsBalance === undefined) {
          console.warn('⚠️ [CreditsService] Units balance returned null/undefined, using 0');
          unitsBalance = 0;
        }
        
        // UPDATED: Convert units to credits using DIRECT XDR conversion (no ICP)
        const credits = await this.convertUnitsToCredits(unitsBalance);
        const usdEquivalent = unitsBalance / this.UNITS_MULTIPLIER;
        
        const result: CreditsCalculation = {
          credits,
          units: unitsBalance,
          usdEquivalent,
          lastUpdated: Date.now()
        };
        
        this.balanceCaches.set(userCanisterId, {
          data: result,
          timestamp: Date.now()
        });
        
        // console.log('💰 [CreditsService] DIRECT XDR Units-derived credits calculated and cached for user:', {
        //   userId: userCanisterId.substring(0, 10) + '...',
        //   units: unitsBalance,
        //   credits,
        //   usd: '$' + usdEquivalent.toFixed(2),
        //   timestamp: new Date().toISOString(),
        //   conversionMethod: 'direct_xdr_to_cycles_no_icp'
        // });
        
        return result;
      } catch (error) {
        console.error('❌ [CreditsService] Error fetching DIRECT XDR units-derived credits:', error);
        return null;
      }
    });
  }

  /**
   * UPDATED: Calculate payment details using direct XDR conversion
   */
  public static async calculatePaymentDetails(
    usdAmount: number
  ): Promise<PaymentCalculation> {
    try {
      console.log('💰 [CreditsService] Calculating DIRECT XDR payment details for USD:', usdAmount);
      
      const [xdrRate, cyclesPerXdr] = await Promise.all([
        this.fetchXdrRate(),
        this.fetchCyclesPerXdr()
      ]);
      
      const unitsAmount = Math.floor(usdAmount * this.UNITS_MULTIPLIER);
      const estimatedCredits = await this.convertUnitsToCredits(unitsAmount);
      
      console.log('✅ [CreditsService] DIRECT XDR Payment calculation complete:', {
        usdAmount,
        unitsAmount,
        estimatedCredits,
        xdrRate: xdrRate.toFixed(4),
        cyclesPerXdr: cyclesPerXdr.toString(),
        conversionMethod: 'direct_xdr_to_cycles_no_icp'
      });
      
      return {
        usdAmount,
        unitsAmount,
        estimatedCredits,
        xdrRate,
        cyclesPerXdr: cyclesPerXdr.toString()
      };
    } catch (error) {
      console.error('❌ [CreditsService] Error calculating DIRECT XDR payment details:', error);
      
      const unitsAmount = Math.floor(usdAmount * this.UNITS_MULTIPLIER);
      const fallbackCredits = Math.floor(usdAmount * 15000); // Estimate
      
      return {
        usdAmount,
        unitsAmount,
        estimatedCredits: fallbackCredits,
        xdrRate: this.FALLBACK_XDR_RATE,
        cyclesPerXdr: this.FALLBACK_CYCLES_PER_XDR.toString()
      };
    }
  }

  /**
   * UPDATED: Get conversion utilities with direct XDR conversion
   */
  public static getConversionUtils(): CreditsConversion {
    return {
      creditsToUsd: async (credits: number) => {
        try {
          const [xdrRate, cyclesPerXdr] = await Promise.all([
            this.fetchXdrRate(),
            this.fetchCyclesPerXdr()
          ]);
          
          // Reverse calculation: credits → cycles → XDR → USD
          const tbCycles = credits / this.CREDITS_PER_TB_CYCLES;
          const totalCycles = BigInt(Math.floor(tbCycles * 1_000_000_000_000));
          const xdrAmount = Number(totalCycles) / Number(cyclesPerXdr);
          const usdValue = xdrAmount * xdrRate;
          
          console.log('💰 [CreditsService] DIRECT XDR creditsToUsd calculation:', {
            credits,
            tbCycles: tbCycles.toFixed(6),
            totalCycles: totalCycles.toString(),
            cyclesPerXdr: cyclesPerXdr.toString(),
            xdrAmount: xdrAmount.toFixed(6),
            xdrRate: xdrRate.toFixed(4),
            usdValue: usdValue.toFixed(4),
            method: 'direct_xdr_reverse_conversion'
          });
          
          return usdValue;
        } catch (error) {
          console.error('❌ [CreditsService] Error in DIRECT XDR creditsToUsd:', error);
          return credits * 0.000067; // Fallback estimate
        }
      },
      
      usdToCredits: async (usd: number) => {
        const paymentCalc = await this.calculatePaymentDetails(usd);
        return paymentCalc.estimatedCredits;
      },
      
      unitsToCredits: async (units: number) => {
        return await this.convertUnitsToCredits(units);
      },
      
      creditsToDescriptiveString: (credits: number) => {
        if (credits === 0) return 'No credits';
        if (credits === 1) return '1 credit';
        if (credits < 1000) return `${credits} credits`;
        if (credits < 1000000) return `${(credits / 1000).toFixed(1)}K credits`;
        return `${(credits / 1000000).toFixed(1)}M credits`;
      },
      
      getXdrRate: async () => {
        return await this.fetchXdrRate();
      },

      getCyclesPerXdr: async () => {
        return await this.fetchCyclesPerXdr();
      }
    };
  }

  // Display formatting methods (unchanged)
  public static formatCreditsDisplay(credits: number): string {
    if (credits === 0) return '0';
    if (credits < 1000) return credits.toString();
    if (credits < 1000000) return `${(credits / 1000).toFixed(1)}K`;
    return `${(credits / 1000000).toFixed(1)}M`;
  }

  public static formatCreditsWithUsd(credits: number, usdEquivalent: number): string {
    const creditsStr = this.formatCreditsDisplay(credits);
    const usdStr = usdEquivalent.toFixed(2);
    return `${creditsStr} Credits ($${usdStr})`;
  }

  public static formatUnitsDisplay(units: number): string {
    const usdValue = units / this.UNITS_MULTIPLIER;
    return `${units.toLocaleString()} units ($${usdValue.toFixed(2)})`;
  }

  public static getBalanceStatus(credits: number, lowThreshold: number = 100): {
    status: 'good' | 'low' | 'critical' | 'empty';
    color: string;
    message: string;
  } {
    if (credits === 0) {
      return {
        status: 'empty',
        color: '#ef4444',
        message: 'No credits remaining'
      };
    }
    
    if (credits < lowThreshold * 0.25) {
      return {
        status: 'critical',
        color: '#f97316',
        message: 'Credits critically low'
      };
    }
    
    if (credits < lowThreshold) {
      return {
        status: 'low',
        color: '#eab308',
        message: 'Credits running low'
      };
    }
    
    return {
      status: 'good',
      color: '#10b981',
      message: 'Credits balance healthy'
    };
  }

  public static estimateUsageTime(credits: number, averageDailyUsage: number = 50): string {
    if (credits === 0) return 'No usage time remaining';
    if (averageDailyUsage === 0) return 'Usage time calculation unavailable';
    
    const daysRemaining = credits / averageDailyUsage;
    
    if (daysRemaining < 1) {
      const hoursRemaining = Math.floor(daysRemaining * 24);
      return `~${hoursRemaining} hours remaining`;
    }
    
    if (daysRemaining < 7) {
      return `~${Math.floor(daysRemaining)} days remaining`;
    }
    
    const weeksRemaining = Math.floor(daysRemaining / 7);
    return `~${weeksRemaining} weeks remaining`;
  }

  public static validateSufficientCredits(
    currentCredits: number, 
    requiredCredits: number,
    operation: string = 'operation'
  ): { valid: boolean; message: string } {
    if (currentCredits >= requiredCredits) {
      return {
        valid: true,
        message: `Sufficient credits for ${operation}`
      };
    }
    
    const shortfall = requiredCredits - currentCredits;
    return {
      valid: false,
      message: `Insufficient credits for ${operation}. Need ${shortfall} more credits.`
    };
  }

  public static async getRecommendedTopUpUSD(
    currentCredits: number,
    averageDailyUsage: number = 50,
    targetDays: number = 30
  ): Promise<number> {
    const targetCredits = averageDailyUsage * targetDays;
    const creditsNeeded = Math.max(0, targetCredits - currentCredits);
    
    const conversionUtils = this.getConversionUtils();
    const usdNeeded = await conversionUtils.creditsToUsd(creditsNeeded);
    
    return Math.ceil(usdNeeded / 5) * 5;
  }

  /**
   * Clear all caches
   */
  public static clearCache(): void {
    console.log('🧹 [CreditsService] Clearing all caches and stopping ongoing operations');
    this.balanceCaches.clear();
    this.xdrRateCache = null;
    this.cyclesPerXdrCache = null; // NEW: Clear direct XDR to cycles cache
    
    for (const [key] of this.ongoingFetches.entries()) {
      console.log('🧹 [CreditsService] Canceling ongoing operation:', key);
    }
    this.ongoingFetches.clear();
  }

  /**
   * Clear cache for specific user
   */
  public static clearUserBalanceCache(userCanisterId: string): void {
    console.log('🧹 [CreditsService] Clearing balance cache for user:', userCanisterId.substring(0, 10) + '...');
    this.balanceCaches.delete(userCanisterId);
    this.ongoingFetches.delete(`balance_${userCanisterId}`);
  }
}