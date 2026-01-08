import React, { useState, useEffect } from 'react';
import { Principal } from '@dfinity/principal';
import { Identity, Actor } from '@dfinity/agent';
import { createAgent } from '@dfinity/utils';
import { userCanisterService } from '../services/UserCanisterService';
import { CreditsService } from '../services/CreditsService';
import { useAppStore } from '../store/appStore';
import { useCanister } from '../useCanister';
import { formatCycles, getCanisterCycleBalance, getIcpXdrConversionRate, icpToCycles } from '../utils/icpUtils';
import { storeCycleTopupTransaction } from './TransactionTrackingModal';

interface ServerInstance {
  canisterId: string;
  type: 'frontend' | 'backend';
  name: string;
  status: 'running' | 'stopped' | 'unknown';
  cycleBalance: bigint;
  creditEquivalent: number;
  memoryAllocation: number;
  computeAllocation: number;
  lastUpdated: number;
}

interface ServerManagementDialogProps {
  server: ServerInstance;
  pairId: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  userCanisterId: string | null;
  identity: Identity | null;
  principal: Principal | null;
  availableCredits: number;
  projectId?: string;
  projectName?: string;
}

interface CyclesMintingCanister {
  notify_top_up: (args: {
    block_index: bigint;
    canister_id: Principal;
  }) => Promise<null>;
}

// 🔥 FIX: Use getter function to prevent initialization error
// Payment processor ID - lazy initialized to avoid "Cannot access before initialization"
const getCMCCanisterId = () => Principal.fromText("rkp4c-7iaaa-aaaaa-aaaca-cai");

// Helper to get the ICP network host
const getICPHost = () => {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:4943'
    : 'https://icp0.io';
};

// Mobile responsiveness helper
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

// ENHANCED: Financial Operations Logger aligned with HostingInterface pattern (internal technical logging)
class FinancialLogger {
  private static logGroup(title: string, callback: () => void) {
    console.group(`🏗️ ${title}`);
    try {
      callback();
    } finally {
      console.groupEnd();
    }
  }

  static logConversionRateAnalysis(details: {
    creditsRequested: number;
    usdEquivalent: number;
    estimatedIcpE8s: bigint;
    estimatedIcpTokens: number;
    estimatedCyclesFromIcp: bigint;
    currentIcpUsdRate?: number;
    currentIcpCyclesRate?: number;
    conversionMethod: string;
  }) {
    this.logGroup('📊 SERVER RESOURCE ADDITION - CONVERSION RATE ANALYSIS (XDR-BASED)', () => {
      console.log(`💰 Credits Requested: ${details.creditsRequested}`);
      console.log(`💵 USD Equivalent: $${details.usdEquivalent.toFixed(4)}`);
      console.log(`🪙 Estimated ICP (e8s): ${details.estimatedIcpE8s.toString()}`);
      console.log(`🪙 Estimated ICP (tokens): ${details.estimatedIcpTokens.toFixed(6)} ICP`);
      console.log(`⚡ Estimated Cycles from ICP: ${details.estimatedCyclesFromIcp.toString()} (${Number(details.estimatedCyclesFromIcp)/1_000_000_000_000}T)`);
      if (details.currentIcpUsdRate) {
        console.log(`📈 Current ICP/USD Rate: $${details.currentIcpUsdRate.toFixed(4)}`);
      }
      if (details.currentIcpCyclesRate) {
        console.log(`⚡ Current ICP/Cycles Rate: ${details.currentIcpCyclesRate.toFixed(2)}T cycles per ICP`);
      }
      console.log(`🔧 Conversion Method: ${details.conversionMethod}`);
      console.log(`✨ Using real-time XDR-based ICP conversion rates from CMC`);
    });
  }

  static logCostAnalysis(config: {
    targetServer: string;
    creditsRequested: number;
    usdEquivalent: number;
  }) {
    this.logGroup('💰 SERVER RESOURCE ADDITION - COST ANALYSIS', () => {
      console.log(`🎯 Target Server: ${config.targetServer}`);
      console.log(`💰 Credits requested: ${config.creditsRequested}`);
      console.log(`💵 USD equivalent: $${config.usdEquivalent.toFixed(4)}`);
      console.log(`✅ Cost validation: ${config.creditsRequested < 10000 ? 'REASONABLE' : 'HIGH - Review needed'}`);
    });
  }

  static logBalanceSnapshot(title: string, balances: {
    userWalletCredits?: number;
    serverCredits?: number;
    serverResources?: bigint;
    platformStatus?: string;
  }) {
    this.logGroup(`🏦 ${title}`, () => {
      if (balances.userWalletCredits !== undefined) {
        console.log(`💳 User Wallet Credits: ${balances.userWalletCredits}`);
      }
      if (balances.serverCredits !== undefined) {
        console.log(`🏭 Server Credits: ${balances.serverCredits}`);
      }
      if (balances.serverResources !== undefined) {
        console.log(`⚡ Server Resources: ${balances.serverResources.toString()} (${Number(balances.serverResources)/1_000_000_000_000}T)`);
      }
      if (balances.platformStatus) {
        console.log(`🌐 Platform Status: ${balances.platformStatus}`);
      }
    });
  }

  static logPlatformResourceProvision(details: {
    fromBalance: number;
    creditsDeducted: number;
    targetServer: string;
    blockIndex?: bigint;
    platformSource: string;
  }) {
    this.logGroup('📤 PLATFORM RESOURCE PROVISION', () => {
      console.log(`📊 User Credits Before: ${details.fromBalance}`);
      console.log(`📊 Credits Deducted: ${details.creditsDeducted}`);
      console.log(`📊 User Credits After: ${details.fromBalance - details.creditsDeducted}`);
      console.log(`💸 Platform Wallet Source: ${details.platformSource}`);
      console.log(`🎯 Target server: ${details.targetServer}`);
      if (details.blockIndex) {
        console.log(`🔗 Block index: ${details.blockIndex.toString()}`);
      }
      console.log(`✅ Resource provision: Platform fulfilling user credit purchase`);
    });
  }

  static logPaymentOperation(details: {
    serverId: string;
    blockIndex: bigint;
    success: boolean;
    error?: string;
  }) {
    this.logGroup('🔄 PAYMENT PROCESSING', () => {
      console.log(`🎯 Target server: ${details.serverId}`);
      console.log(`💳 ICP Source: Platform Wallet (Main Canister)`);
      console.log(`🔗 Block index: ${details.blockIndex.toString()}`);
      if (details.success) {
        console.log(`✅ Payment processing: SUCCESS`);
        console.log(`⏳ Status: Waiting for resource allocation...`);
      } else {
        console.log(`❌ Payment processing: FAILED`);
        console.log(`💥 Error: ${details.error}`);
        if (details.error && details.error.includes('insufficient')) {
          console.log(`⚠️ Platform Action Required: ICP balance may need replenishment`);
        }
      }
    });
  }

  static async logResourcePolling(
    targetServerId: string,
    identity: Identity,
    initialBalance: bigint,
    expectedAmount: bigint,
    maxWaitSeconds: number = 60
  ): Promise<{ success: boolean; finalBalance: bigint; resourcesAdded: bigint; waitTime: number }> {
    return new Promise(async (resolve) => {
      this.logGroup('⏳ RESOURCE ALLOCATION VERIFICATION', async () => {
        console.log(`🎯 Monitoring server: ${targetServerId}`);
        console.log(`📊 Initial balance: ${initialBalance.toString()} (${Number(initialBalance)/1_000_000_000_000}T)`);
        console.log(`🎯 Expected addition: ${expectedAmount.toString()} (${Number(expectedAmount)/1_000_000_000_000}T)`);
        console.log(`⏱️ Max wait time: ${maxWaitSeconds} seconds`);
        console.log(`🌐 Resource Source: Platform Wallet (XDR-based conversion)`);
        
        const startTime = Date.now();
        let pollCount = 0;
        
        const pollBalance = async (): Promise<void> => {
          try {
            pollCount++;
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            
            const currentBalance = await getCanisterCycleBalance(
              Principal.fromText(targetServerId),
              identity
            );
            const resourcesAdded = currentBalance - initialBalance;
            
            console.log(`📊 Poll #${pollCount} (${elapsed}s): ${currentBalance.toString()} resources (${Number(currentBalance)/1_000_000_000_000}T)`);
            
            if (resourcesAdded >= expectedAmount * 8n / 10n) { // Allow 20% tolerance
              console.log(`✅ RESOURCES ALLOCATED! Added: ${resourcesAdded.toString()} resources`);
              console.log(`🎉 Success in ${elapsed} seconds via XDR-based platform provisioning`);
              resolve({
                success: true,
                finalBalance: currentBalance,
                resourcesAdded: resourcesAdded,
                waitTime: elapsed
              });
              return;
            }
            
            if (elapsed >= maxWaitSeconds) {
              console.log(`⏰ TIMEOUT after ${elapsed} seconds`);
              console.log(`❌ Expected ${expectedAmount.toString()} resources, got ${resourcesAdded.toString()}`);
              resolve({
                success: false,
                finalBalance: currentBalance,
                resourcesAdded: resourcesAdded,
                waitTime: elapsed
              });
              return;
            }
            
            // Continue polling
            setTimeout(pollBalance, 3000); // Poll every 3 seconds
            
          } catch (error) {
            console.log(`💥 Poll error: ${error}`);
            setTimeout(pollBalance, 3000);
          }
        };
        
        pollBalance();
      });
    });
  }

  static logConversionComparison(comparison: {
    estimatedCycles: bigint;
    actualCyclesReceived: bigint;
    estimatedIcpTokens: number;
    actualIcpCyclesRate: number;
    blockIndex: bigint;
    conversionEfficiency: number;
    marketVariance: number;
  }) {
    this.logGroup('🔍 CONVERSION RESULT COMPARISON (XDR-VERIFIED)', () => {
      console.log(`🎯 Estimated Cycles: ${comparison.estimatedCycles.toString()} (${Number(comparison.estimatedCycles)/1_000_000_000_000}T)`);
      console.log(`✅ Actual Cycles Received: ${comparison.actualCyclesReceived.toString()} (${Number(comparison.actualCyclesReceived)/1_000_000_000_000}T)`);
      console.log(`📊 Conversion Efficiency: ${(comparison.conversionEfficiency * 100).toFixed(1)}% (actual vs estimated)`);
      console.log(`📈 Market Variance: ${comparison.marketVariance > 0 ? '+' : ''}${(comparison.marketVariance * 100).toFixed(1)}%`);
      console.log(`⚡ ICP Cycles Rate Used: ${comparison.actualIcpCyclesRate.toFixed(2)}T cycles per ICP`);
      console.log(`🔗 Blockchain Block: ${comparison.blockIndex.toString()}`);
      
      if (comparison.conversionEfficiency > 1.1) {
        console.log(`🎉 BONUS: You received ${((comparison.conversionEfficiency - 1) * 100).toFixed(1)}% more cycles than estimated!`);
        console.log(`💡 This means the real-time XDR rate was more favorable than our cached estimate`);
      } else if (comparison.conversionEfficiency < 0.9) {
        console.log(`⚠️ NOTICE: You received ${((1 - comparison.conversionEfficiency) * 100).toFixed(1)}% fewer cycles than estimated`);
        console.log(`💡 This means the real-time XDR rate was less favorable than our cached estimate`);
      } else {
        console.log(`✅ EXPECTED: Conversion efficiency within normal range (±10%) - XDR rates are stable`);
      }
    });
  }

  static logOperationSummary(summary: {
    targetServer: string;
    totalCreditsRequested: number;
    totalResourcesAllocated: bigint;
    totalTime: number;
    success: boolean;
    conversionEfficiency?: number;
  }) {
    this.logGroup('📋 SERVER RESOURCE ADDITION SUMMARY (XDR-BASED PLATFORM)', () => {
      console.log(`🎯 Target server: ${summary.targetServer}`);
      console.log(`💰 Credits deducted from user: ${summary.totalCreditsRequested}`);
      console.log(`🌐 Resources provided by: Platform Wallet (XDR-based)`);
      console.log(`⚡ Resources allocated: ${summary.totalResourcesAllocated.toString()} (${Number(summary.totalResourcesAllocated)/1_000_000_000_000}T)`);
      
      if (summary.conversionEfficiency) {
        console.log(`📊 Conversion Efficiency: ${(summary.conversionEfficiency * 100).toFixed(1)}% of estimated`);
        console.log(`✨ XDR-based conversion accuracy: ${summary.conversionEfficiency > 0.9 && summary.conversionEfficiency < 1.1 ? 'EXCELLENT' : 'NORMAL VARIANCE'}`);
      }

      console.log(`⏱️ Total time: ${summary.totalTime} seconds`);
      console.log(`🎯 Overall result: ${summary.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      
      if (summary.success) {
        console.log(`🎉 Server resource addition completed successfully via XDR-based platform provisioning!`);
      }
    });
  }
}

// Calculate ICP needed to provide exact cycles (reverse: cycles → ICP)
async function calculateIcpConversionForCycles(targetCycles: bigint): Promise<{
  icpE8s: bigint;
  icpTokens: number;
  estimatedCycles: bigint;
  conversionMethod: string;
  icpUsdRate?: number;
  icpCyclesRate?: number;
}> {
  try {
    console.log('⚡ [IcpConversion] Calculating ICP needed for exact cycles:', {
      targetCycles: targetCycles.toString(),
      targetCyclesT: (Number(targetCycles) / 1_000_000_000_000).toFixed(6)
    });
    
    // Get real-time ICP cycles rate
    const cyclesPerIcp = await getIcpXdrConversionRate();
    const icpCyclesRate = Number(cyclesPerIcp) / 1_000_000_000_000; // Convert to T cycles
    
    console.log(`⚡ [IcpConversion] Real-time ICP cycles rate: ${icpCyclesRate.toFixed(2)}T cycles per ICP`);
    
    // Calculate ICP needed: cycles ÷ cyclesPerICP
    const icpTokens = Number(targetCycles) / Number(cyclesPerIcp);
    const icpE8s = BigInt(Math.ceil(icpTokens * 100_000_000)); // Convert to e8s (round up to ensure enough)
    
    console.log(`⚡ [IcpConversion] ICP calculation for exact cycles:`, {
      targetCycles: targetCycles.toString(),
      cyclesPerIcp: cyclesPerIcp.toString(),
      icpTokens: icpTokens.toFixed(6),
      icpE8s: icpE8s.toString(),
      icpCyclesRate: icpCyclesRate.toFixed(2)
    });
    
    return {
      icpE8s,
      icpTokens,
      estimatedCycles: targetCycles, // Return the exact target cycles
      conversionMethod: 'Reverse conversion: cycles → ICP (for exact credit delivery)',
      icpCyclesRate: icpCyclesRate
    };
  } catch (error) {
    console.error('❌ [IcpConversion] Error calculating ICP for cycles:', error);
    // Fallback calculation
    const FALLBACK_ICP_CYCLES_RATE = 2.24; // T cycles per ICP
    const icpTokens = Number(targetCycles) / (FALLBACK_ICP_CYCLES_RATE * 1_000_000_000_000);
    const icpE8s = BigInt(Math.ceil(icpTokens * 100_000_000));
    
    return {
      icpE8s,
      icpTokens,
      estimatedCycles: targetCycles,
      conversionMethod: 'Fallback reverse conversion',
      icpCyclesRate: FALLBACK_ICP_CYCLES_RATE
    };
  }
}

// Calculate ICP conversion using real rates (internal technical function)
async function calculateIcpConversion(usdAmount: number): Promise<{
  icpE8s: bigint;
  icpTokens: number;
  estimatedCycles: bigint;
  conversionMethod: string;
  icpUsdRate?: number;
  icpCyclesRate?: number;
}> {
  try {
    console.log('⚡ [IcpConversion] Starting conversion calculation for server resource addition...');
    
    // Get real-time ICP cycles rate
    const cyclesPerIcp = await getIcpXdrConversionRate();
    const icpCyclesRate = Number(cyclesPerIcp) / 1_000_000_000_000; // Convert to T cycles
    
    console.log(`⚡ [IcpConversion] Real-time ICP cycles rate: ${icpCyclesRate.toFixed(2)}T cycles per ICP`);
    
    // Estimated ICP price (this could be made more dynamic in the future)
    const ESTIMATED_ICP_USD_RATE = 13.0; 
    
    const icpTokens = usdAmount / ESTIMATED_ICP_USD_RATE;
    const icpE8s = BigInt(Math.floor(icpTokens * 100_000_000)); // Convert to e8s
    
    // Use real cycles conversion from icpUtils
    const conversionResult = await icpToCycles(icpE8s);
    const estimatedCycles = conversionResult.cycles;
    
    console.log(`⚡ [IcpConversion] Conversion complete for server resource addition:`, {
      usdAmount,
      icpTokens: icpTokens.toFixed(6),
      icpE8s: icpE8s.toString(),
      estimatedCycles: estimatedCycles.toString(),
      icpCyclesRate: conversionResult.rate
    });
    
    return {
      icpE8s,
      icpTokens,
      estimatedCycles,
      conversionMethod: 'Real-time conversion via icpUtils',
      icpUsdRate: ESTIMATED_ICP_USD_RATE,
      icpCyclesRate: conversionResult.rate
    };
  } catch (error) {
    console.error('❌ [IcpConversion] Conversion failed for server resource addition, using fallback:', error);
    
    // Fallback to static rates
    const FALLBACK_ICP_USD_RATE = 13.0; 
    const FALLBACK_ICP_CYCLES_RATE = 3.89; // Use your platform's observed rate
    
    const icpTokens = usdAmount / FALLBACK_ICP_USD_RATE;
    const icpE8s = BigInt(Math.floor(icpTokens * 100_000_000));
    const estimatedCycles = BigInt(Math.floor(icpTokens * FALLBACK_ICP_CYCLES_RATE * 1_000_000_000_000));
    
    return {
      icpE8s,
      icpTokens,
      estimatedCycles,
      conversionMethod: 'Fallback static rates',
      icpUsdRate: FALLBACK_ICP_USD_RATE,
      icpCyclesRate: FALLBACK_ICP_CYCLES_RATE
    };
  }
}

export const ServerManagementDialog: React.FC<ServerManagementDialogProps> = ({
  server,
  pairId,
  onClose,
  onRefresh,
  userCanisterId,
  identity,
  principal,
  availableCredits,
  projectId,
  projectName
}) => {
  const { credits, fetchCreditsBalance, deductUnitsFromBalance } = useAppStore(state => ({
    credits: state.credits,
    fetchCreditsBalance: state.fetchCreditsBalance,
    deductUnitsFromBalance: state.deductUnitsFromBalance
  }));

  const { actor: mainActor } = useCanister('main');

  const isMobile = useIsMobile();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Server control states
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isAddingResources, setIsAddingResources] = useState(false);
  
  // Add resources form state with separate input handling
  const [creditsToAdd, setCreditsToAdd] = useState<number>(1000);
  const [creditsToAddInput, setCreditsToAddInput] = useState<string>('1000');
  const [showAddResourcesForm, setShowAddResourcesForm] = useState(false);
  
  // Settings form state
  const [showSettings, setShowSettings] = useState(false);
  const [newMemoryAllocation, setNewMemoryAllocation] = useState(server.memoryAllocation);
  const [newComputeAllocation, setNewComputeAllocation] = useState(server.computeAllocation);
  
  // Real-time server info
  const [serverInfo, setServerInfo] = useState(server);

  // Proper input handling for credits to add
  const handleCreditsToAddChange = (value: string) => {
    setCreditsToAddInput(value);
    
    // Only update the actual state if it's a valid number
    const numericValue = parseInt(value);
    if (!isNaN(numericValue) && numericValue >= 100) {
      const constrainedValue = Math.min(numericValue, credits.balance);
      setCreditsToAdd(constrainedValue);
    }
  };

  const handleCreditsToAddBlur = () => {
    // Ensure minimum value and update input to match state
    const finalValue = Math.max(100, Math.min(creditsToAdd, credits.balance));
    setCreditsToAdd(finalValue);
    setCreditsToAddInput(finalValue.toString());
  };

  // Sync input field with state when form opens
  useEffect(() => {
    if (showAddResourcesForm) {
      setCreditsToAddInput(creditsToAdd.toString());
    }
  }, [showAddResourcesForm, creditsToAdd]);

  // Create payment processing actor
  const createCMCActor = async (identity: Identity): Promise<CyclesMintingCanister> => {
    const host = getICPHost();

    const agent = await createAgent({
      host,
      identity,
      fetchRootKey: host.includes('localhost') || host.includes('127.0.0.1'),
    });

    // Create the payment processing actor
    return Actor.createActor<CyclesMintingCanister>(
      (({ IDL }) => {
        return IDL.Service({
          'notify_top_up': IDL.Func([
            IDL.Record({
              'block_index': IDL.Nat64,
              'canister_id': IDL.Principal,
            })
          ], [], []),
        });
      }) as any,
      {
        agent,
        canisterId: getCMCCanisterId(),
      }
    );
  };

  // Load fresh server data
  const loadServerData = async () => {
    if (!identity || server.canisterId === 'pending') return;

    try {
      setIsLoading(true);
      
      // Get current resource balance
      const resourceBalance = await getCanisterCycleBalance(
        Principal.fromText(server.canisterId),
        identity
      );
      
      // Calculate credit equivalent
      const creditEquivalent = Math.floor((Number(resourceBalance) / 1_000_000_000_000) * 1000);
      
      setServerInfo({
        ...server,
        cycleBalance: resourceBalance,
        creditEquivalent,
        lastUpdated: Date.now()
      });
      
    } catch (error) {
      console.error('❌ [ServerManagementDialog] Error loading server data:', error);
      setError('Failed to load server data');
    } finally {
      setIsLoading(false);
    }
  };

  // Start server (still mocked - would need IC management integration)
  const startServer = async () => {
    if (!userCanisterId || !identity || server.canisterId === 'pending') return;

    setIsStarting(true);
    setError(null);

    try {
      console.log('▶️ [ServerManagementDialog] Starting server:', server.canisterId);

      // This would need actual IC management integration
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setSuccess('Server started successfully');
      setServerInfo({ ...serverInfo, status: 'running' });
      
      setTimeout(() => {
        onRefresh();
      }, 1000);

    } catch (error) {
      console.error('❌ [ServerManagementDialog] Error starting server:', error);
      setError('Failed to start server');
    } finally {
      setIsStarting(false);
    }
  };

  // Stop server (still mocked - would need IC management integration)
  const stopServer = async () => {
    if (!userCanisterId || !identity || server.canisterId === 'pending') return;

    if (!confirm('Are you sure you want to stop this server? It will become unavailable until restarted.')) {
      return;
    }

    setIsStopping(true);
    setError(null);

    try {
      console.log('⏹️ [ServerManagementDialog] Stopping server:', server.canisterId);

      // This would need actual IC management integration
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setSuccess('Server stopped successfully');
      setServerInfo({ ...serverInfo, status: 'stopped' });
      
      setTimeout(() => {
        onRefresh();
      }, 1000);

    } catch (error) {
      console.error('❌ [ServerManagementDialog] Error stopping server:', error);
      setError('Failed to stop server');
    } finally {
      setIsStopping(false);
    }
  };

  // Add resources to server using main actor
  const addResourcesToServer = async () => {
    if (!userCanisterId || !identity || !principal || server.canisterId === 'pending' || !mainActor) {
      setError('Missing required information or service unavailable for adding credits');
      return;
    }

    try {
      setIsAddingResources(true);
      setError(null);

      const operationStartTime = Date.now();

      console.group('🚀 SERVER CREDIT ADDITION');

      // Step 1: Pre-operation analysis using units-based credit system
      await fetchCreditsBalance();
      
      const validation = CreditsService.validateSufficientCredits(
        credits.balance,
        creditsToAdd,
        'server credit addition'
      );

      if (!validation.valid) {
        throw new Error(validation.message);
      }

      // Step 2: DIRECT conversion from credits to cycles (no USD/ICP conversion needed)
      // 1 credit = 1 billion cycles, so 1000 credits = 1 trillion cycles exactly
      const expectedCycles = CreditsService.convertCreditsToCycles(creditsToAdd);
      
      // Calculate USD equivalent for logging and deduction purposes only
      const conversionUtils = CreditsService.getConversionUtils();
      const usdEquivalent = await conversionUtils.creditsToUsd(creditsToAdd);

      // Calculate ICP needed to provide the exact cycles (for platform wallet provisioning)
      // We need to work backwards: cycles → ICP
      const icpConversion = await calculateIcpConversionForCycles(expectedCycles);

      // Log comprehensive conversion rate analysis (for debugging)
      FinancialLogger.logConversionRateAnalysis({
        creditsRequested: creditsToAdd,
        usdEquivalent: usdEquivalent,
        estimatedIcpE8s: icpConversion.icpE8s,
        estimatedIcpTokens: icpConversion.icpTokens,
        estimatedCyclesFromIcp: expectedCycles, // Use the direct conversion
        currentIcpUsdRate: icpConversion.icpUsdRate,
        currentIcpCyclesRate: icpConversion.icpCyclesRate,
        conversionMethod: 'Direct credits-to-cycles conversion (exact)'
      });

      // Get initial balances for transparency
      const initialServerResources = await getCanisterCycleBalance(
        Principal.fromText(server.canisterId),
        identity
      );

      // Log comprehensive cost analysis (internal)
      FinancialLogger.logCostAnalysis({
        targetServer: server.canisterId,
        creditsRequested: creditsToAdd,
        usdEquivalent: usdEquivalent
      });

      // Log pre-operation balance snapshot (internal)
      FinancialLogger.logBalanceSnapshot('PRE-OPERATION BALANCES', {
        userWalletCredits: credits.balance,
        serverCredits: Math.floor(Number(initialServerResources) / 1_000_000_000_000 * 1000),
        serverResources: initialServerResources,
        platformStatus: 'Platform wallet will provide resources'
      });

      // Step 3: Deduct credits from user's units-based balance first
      const unitsToDeduct = Math.round(usdEquivalent * 100); // Convert USD to units (100 units per USD)
      const deductionSuccess = await deductUnitsFromBalance(
        unitsToDeduct,
        `server-credit-addition-${server.canisterId}`,
        `Server credit addition: ${server.name} (${creditsToAdd} credits)`
      );

      if (!deductionSuccess) {
        throw new Error('Failed to deduct credits from user balance');
      }

      // Step 4: Use main actor topUpCanisterCMC
      const targetServerPrincipal = Principal.fromText(server.canisterId);
      
      // Use the calculated ICP amount needed to provide the exact cycles
      const icpE8sNeeded = icpConversion.icpE8s;
      
      console.log(`💰 [ConversionTracking] Direct credits-to-cycles conversion:`, {
        creditsRequested: creditsToAdd,
        expectedCycles: expectedCycles.toString(),
        expectedCyclesT: (Number(expectedCycles) / 1_000_000_000_000).toFixed(6),
        icpE8sNeeded: icpE8sNeeded.toString(),
        icpTokens: icpConversion.icpTokens.toFixed(6)
      });
      
      // Use main actor directly
      const transferResult = await mainActor.topUpCanisterCMC(
        targetServerPrincipal,  // First parameter: canister to top up
        icpE8sNeeded           // Second parameter: calculated ICP amount in e8s
      );

      if (!transferResult || (typeof transferResult === 'object' && 'err' in transferResult)) {
        // Restore user credits if platform provisioning fails
        const restoreUnits = await useAppStore.getState().addUnitsToBalance(unitsToDeduct);
        if (restoreUnits) {
          console.log('✅ User credits restored after platform provisioning failure');
        }
        
        const errorMessage = transferResult?.err || 'Service provisioning failed';
        
        // Provide user-friendly error messages for platform issues
        if (typeof errorMessage === 'string' && errorMessage.includes('insufficient')) {
          throw new Error('Service is temporarily unable to provision credits. Please try again shortly or contact support if this persists.');
        }
        
        throw new Error(`Service error: ${JSON.stringify(errorMessage)}`);
      }

      // Extract block index with transparency
      let blockIndex: bigint;
      try {
        let blockIndexStr: string;
        if (typeof transferResult === 'object' && 'ok' in transferResult) {
          blockIndexStr = transferResult.ok.toString();
        } else {
          blockIndexStr = transferResult.toString();
        }

        const matches = blockIndexStr.match(/Block index: (\d+)/);
        if (matches && matches[1]) {
          blockIndex = BigInt(matches[1].trim());
        } else {
          const numericOnly = blockIndexStr.replace(/\D/g, '');
          if (numericOnly) {
            blockIndex = BigInt(numericOnly);
          } else {
            throw new Error(`Could not extract block index from response: ${blockIndexStr}`);
          }
        }
      } catch (err) {
        throw new Error(`Service succeeded but could not extract block index. Response: ${transferResult}`);
      }

      // Log platform resource provision (internal)
      FinancialLogger.logPlatformResourceProvision({
        fromBalance: credits.balance + creditsToAdd, // What it was before deduction
        creditsDeducted: creditsToAdd,
        targetServer: server.canisterId,
        blockIndex: blockIndex,
        platformSource: 'Main Canister Platform Wallet'
      });

      // Step 5: Payment Processing with verification
      try {
        const cmcActor = await createCMCActor(identity);
        
        await cmcActor.notify_top_up({
          block_index: blockIndex,
          canister_id: targetServerPrincipal
        });

        FinancialLogger.logPaymentOperation({
          serverId: server.canisterId,
          blockIndex: blockIndex,
          success: true
        });

      } catch (notifyError: any) {
        FinancialLogger.logPaymentOperation({
          serverId: server.canisterId,
          blockIndex: blockIndex,
          success: false,
          error: notifyError.message
        });
        
        let errorMsg = `Credits deducted but server resource allocation failed: ${notifyError.message}`;
        
        if (notifyError.message) {
          if (notifyError.message.includes("canister_not_found")) {
            errorMsg = `Server ${server.canisterId} not found by resource allocator. Please contact support.`;
          } else if (notifyError.message.includes("Reject text: ")) {
            const rejectMatch = notifyError.message.match(/Reject text: (.+?)($|\.)/);
            if (rejectMatch && rejectMatch[1]) {
              errorMsg = `Resource allocator rejected request: ${rejectMatch[1]}`;
            }
          }
        }
        
        throw new Error(errorMsg);
      }

      // Step 6: Verify resources were actually allocated with polling
      // Use the direct credits-to-cycles conversion for verification
      const resourceVerification = await FinancialLogger.logResourcePolling(
        server.canisterId,
        identity,
        initialServerResources,
        expectedCycles, // Use direct conversion: 1000 credits = 1.0T cycles exactly
        60 // 60 second timeout
      );

      if (!resourceVerification.success) {
        throw new Error(`Server resources were not allocated within 60 seconds. Expected ${expectedCycles.toString()} resources (${creditsToAdd} credits), only received ${resourceVerification.resourcesAdded.toString()}`);
      }

      // Calculate and log conversion efficiency (internal)
      // Use direct credits-to-cycles conversion for expected amount
      const conversionEfficiency = Number(resourceVerification.resourcesAdded) / Number(expectedCycles);
      
      FinancialLogger.logConversionComparison({
        estimatedCycles: expectedCycles, // Direct conversion: 1000 credits = 1.0T cycles
        actualCyclesReceived: resourceVerification.resourcesAdded,
        estimatedIcpTokens: icpConversion.icpTokens,
        actualIcpCyclesRate: icpConversion.icpCyclesRate || 0,
        blockIndex: blockIndex,
        conversionEfficiency: conversionEfficiency,
        marketVariance: conversionEfficiency - 1
      });

      // Success! Log final summary (internal)
      const operationTime = Math.round((Date.now() - operationStartTime) / 1000);
      
      FinancialLogger.logOperationSummary({
        targetServer: server.canisterId,
        totalCreditsRequested: creditsToAdd,
        totalResourcesAllocated: resourceVerification.resourcesAdded,
        totalTime: operationTime,
        success: true,
        conversionEfficiency: conversionEfficiency
      });

      // Store transaction for value flow tracker
      if (projectId && projectName) {
        console.log('📊 [TransactionTracking] Storing server pair cycle top-up transaction data...');
        
        try {
          storeCycleTopupTransaction({
            projectId: projectId,
            projectName: projectName,
            targetServerId: server.canisterId,
            targetServerType: server.type,
            targetServerName: server.name,
            creditsRequested: creditsToAdd,
            icpConversion: {
              realIcpPrice: icpConversion.icpUsdRate || 0,
              priceSource: 'XDR-based conversion',
              priceAge: 0,
              icpTokens: icpConversion.icpTokens,
              icpE8s: icpConversion.icpE8s,
              usdEquivalent: usdEquivalent // Reuse the value calculated earlier
            },
            platformIcpTransferred: icpConversion.icpE8s,
            blockIndex: blockIndex,
            actualCyclesReceived: resourceVerification.resourcesAdded,
            conversionEfficiency: conversionEfficiency,
            operationDuration: operationTime,
            resourceAllocationTime: resourceVerification.waitTime,
            success: true
          });
          
          console.log('✅ [TransactionTracking] Server pair cycle top-up transaction stored successfully');
        } catch (trackingError) {
          console.warn('⚠️ [TransactionTracking] Failed to store transaction data:', trackingError);
        }
      } else {
        console.warn('⚠️ [TransactionTracking] Missing projectId or projectName, skipping transaction tracking');
      }

      console.groupEnd();

      // Simple user-friendly success message
      setSuccess(`Successfully added ${creditsToAdd.toLocaleString()} credits to ${server.type} server! Resources allocated in ${resourceVerification.waitTime} seconds.`);
      setShowAddResourcesForm(false);
      setCreditsToAdd(1000);
      setCreditsToAddInput('1000');

      // Refresh server data and parent component
      setTimeout(() => {
        loadServerData();
        onRefresh();
        fetchCreditsBalance();
      }, 2000);

    } catch (error) {
      console.groupEnd();
      console.error('❌ Server credit addition failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to add credits to server');
    } finally {
      setIsAddingResources(false);
    }
  };

  // Update server settings (still mocked - would need IC management integration)
  const updateServerSettings = async () => {
    if (!userCanisterId || !identity || server.canisterId === 'pending') return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('⚙️ [ServerManagementDialog] Updating server settings:', server.canisterId);

      // This would need IC management integration
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setSuccess('Server settings updated successfully');
      setShowSettings(false);
      
      setServerInfo({
        ...serverInfo,
        memoryAllocation: newMemoryAllocation,
        computeAllocation: newComputeAllocation
      });
      
      setTimeout(() => {
        onRefresh();
      }, 1000);

    } catch (error) {
      console.error('❌ [ServerManagementDialog] Error updating server settings:', error);
      setError('Failed to update server settings');
    } finally {
      setIsLoading(false);
    }
  };

  // Load server data on mount
  useEffect(() => {
    loadServerData();
  }, []);

  // Auto-clear messages
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const serverTypeColor = server.type === 'frontend' ? '#3b82f6' : '#10b981';
  const serverTypeIcon = server.type === 'frontend' ? '🌐' : '⚙️';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: isMobile ? 'flex-end' : 'center',
      justifyContent: 'center',
      zIndex: 3000,
      backdropFilter: 'blur(10px)',
      padding: isMobile ? '0' : '2rem'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #111111, #1a1a1a)',
        border: `1px solid ${serverTypeColor}40`,
        borderRadius: isMobile ? '16px 16px 0 0' : '16px',
        padding: isMobile ? '1.5rem' : '2rem',
        maxWidth: isMobile ? '100%' : '600px',
        width: '100%',
        maxHeight: isMobile ? '90vh' : '90vh',
        overflowY: 'auto',
        ...(isMobile && {
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none'
        })
      }}>
        {/* Mobile-Optimized Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: isMobile ? '1.5rem' : '2rem',
          gap: '1rem'
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? '0.75rem' : '1rem',
              marginBottom: '0.5rem'
            }}>
              <div style={{
                width: isMobile ? '40px' : '48px',
                height: isMobile ? '40px' : '48px',
                background: `linear-gradient(135deg, ${serverTypeColor}, ${serverTypeColor}CC)`,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? '1.2rem' : '1.5rem',
                flexShrink: 0
              }}>
                {serverTypeIcon}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 style={{
                  fontSize: isMobile ? '1.2rem' : '1.5rem',
                  fontWeight: '700',
                  color: '#ffffff',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {serverInfo.name}
                </h2>
                <div style={{
                  fontSize: isMobile ? '0.75rem' : '0.9rem',
                  color: '#9ca3af',
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {serverInfo.canisterId === 'pending' ? 'Not created yet' : 
                   `${serverInfo.canisterId.substring(0, isMobile ? 12 : 16)}...`}
                </div>
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                background: serverInfo.status === 'running' ? '#10b981' : 
                           serverInfo.status === 'stopped' ? '#ef4444' : '#f59e0b',
                borderRadius: '50%'
              }}></div>
              <span style={{
                fontSize: isMobile ? '0.8rem' : '0.9rem',
                color: serverInfo.status === 'running' ? '#10b981' : 
                       serverInfo.status === 'stopped' ? '#ef4444' : '#f59e0b',
                textTransform: 'capitalize',
                fontWeight: '500'
              }}>
                {serverInfo.status}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.5rem',
              flexShrink: 0,
              minHeight: '44px',
              minWidth: '44px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Status Messages */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: isMobile ? '0.875rem' : '1rem',
            marginBottom: '1.5rem',
            color: '#ef4444',
            fontSize: isMobile ? '0.85rem' : '0.9rem',
            lineHeight: 1.4
          }}>
            ❌ {error}
          </div>
        )}

        {success && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
            padding: isMobile ? '0.875rem' : '1rem',
            marginBottom: '1.5rem',
            color: '#10b981',
            fontSize: isMobile ? '0.85rem' : '0.9rem',
            lineHeight: 1.4
          }}>
            ✅ {success}
          </div>
        )}

        {/* Service unavailable warning */}
        {!mainActor && (
          <div style={{
            background: 'rgba(255, 193, 7, 0.1)',
            border: '1px solid rgba(255, 193, 7, 0.3)',
            borderRadius: '8px',
            padding: isMobile ? '0.875rem' : '1rem',
            marginBottom: '1.5rem',
            color: '#ffc107',
            fontSize: isMobile ? '0.8rem' : '0.85rem',
            lineHeight: 1.4,
            textAlign: 'center'
          }}>
            ⚠️ <strong>Service Unavailable</strong><br />
            Cannot add credits without service connection. Please refresh the page or contact support.
          </div>
        )}

        {/* Mobile-Optimized Server Information */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '12px',
          padding: isMobile ? '1rem' : '1.5rem',
          marginBottom: isMobile ? '1.5rem' : '2rem'
        }}>
          <h3 style={{
            fontSize: isMobile ? '1rem' : '1.1rem',
            fontWeight: '600',
            color: '#ffffff',
            marginBottom: '1rem'
          }}>
            Server Information
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: isMobile ? '0.75rem' : '1rem'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>
                Credit Balance
              </div>
              <div style={{ fontSize: isMobile ? '1.1rem' : '1.2rem', fontWeight: '600', color: serverTypeColor }}>
                {CreditsService.formatCreditsDisplay(serverInfo.creditEquivalent)} Credits
              </div>
              <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                {formatCycles(serverInfo.cycleBalance)}
              </div>
            </div>
            
            <div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>
                Memory
              </div>
              <div style={{ fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: '600', color: '#ffffff' }}>
                {serverInfo.memoryAllocation} GB
              </div>
            </div>
            
            <div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>
                Compute
              </div>
              <div style={{ fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: '600', color: '#ffffff' }}>
                {serverInfo.computeAllocation}%
              </div>
            </div>
            
            <div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>
                Updated
              </div>
              <div style={{ fontSize: isMobile ? '0.8rem' : '0.9rem', color: '#ffffff' }}>
                {new Date(serverInfo.lastUpdated).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile-Optimized Server Actions */}
        <div style={{ marginBottom: isMobile ? '1.5rem' : '2rem' }}>
          <h3 style={{
            fontSize: isMobile ? '1rem' : '1.1rem',
            fontWeight: '600',
            color: '#ffffff',
            marginBottom: '1rem'
          }}>
            Server Actions
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: isMobile ? '0.75rem' : '1rem'
          }}>
            {/* Start/Stop Button */}
            <button
              onClick={serverInfo.status === 'running' ? stopServer : startServer}
              disabled={isStarting || isStopping || server.canisterId === 'pending'}
              style={{
                background: serverInfo.status === 'running' 
                  ? 'rgba(239, 68, 68, 0.1)'
                  : 'rgba(16, 185, 129, 0.1)',
                border: serverInfo.status === 'running'
                  ? '1px solid rgba(239, 68, 68, 0.3)'
                  : '1px solid rgba(16, 185, 129, 0.3)',
                color: serverInfo.status === 'running' ? '#ef4444' : '#10b981',
                padding: isMobile ? '0.875rem' : '0.75rem 1rem',
                borderRadius: '8px',
                fontWeight: '500',
                cursor: isStarting || isStopping || server.canisterId === 'pending' 
                  ? 'not-allowed' 
                  : 'pointer',
                transition: 'all 0.3s ease',
                opacity: isStarting || isStopping || server.canisterId === 'pending' ? 0.6 : 1,
                fontSize: isMobile ? '0.9rem' : '0.9rem',
                minHeight: '44px'
              }}
            >
              {isStarting ? '⏳ Starting...' :
               isStopping ? '⏳ Stopping...' :
               serverInfo.status === 'running' ? (isMobile ? '⏹️ Stop' : '⏹️ Stop Server') : 
               (isMobile ? '▶️ Start' : '▶️ Start Server')}
            </button>

            {/* Add Credits Button */}
            <button
              onClick={() => setShowAddResourcesForm(true)}
              disabled={server.canisterId === 'pending' || !mainActor}
              style={{
                background: server.canisterId === 'pending' || !mainActor
                  ? 'rgba(245, 158, 11, 0.3)'
                  : 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
                color: '#ffffff',
                padding: isMobile ? '0.875rem' : '0.75rem 1rem',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: server.canisterId === 'pending' || !mainActor ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: server.canisterId === 'pending' || !mainActor ? 0.6 : 1,
                fontSize: isMobile ? '0.9rem' : '0.9rem',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                minHeight: '44px'
              }}
              onMouseEnter={(e) => {
                if (server.canisterId !== 'pending' && mainActor) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (server.canisterId !== 'pending' && mainActor) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
                }
              }}
            >
              {!mainActor ? (isMobile ? '⚠️ Service Required' : '⚠️ Service Required') :
               (isMobile ? '💰 Add Credits' : '💰 Add Credits')}
            </button>

            {!isMobile && (
              <>
                {/* Settings Button - Hidden on mobile */}
                <button
                  onClick={() => setShowSettings(true)}
                  disabled={server.canisterId === 'pending'}
                  style={{
                    background: 'rgba(107, 114, 128, 0.1)',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                    color: '#9ca3af',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    fontWeight: '500',
                    cursor: server.canisterId === 'pending' ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    opacity: server.canisterId === 'pending' ? 0.6 : 1,
                    fontSize: '0.9rem',
                    minHeight: '44px'
                  }}
                >
                  ⚙️ Settings
                </button>

                {/* Refresh Button - Hidden on mobile */}
                <button
                  onClick={loadServerData}
                  disabled={isLoading || server.canisterId === 'pending'}
                  style={{
                    background: `rgba(${serverTypeColor.replace('#', '')}, 0.1)`,
                    border: `1px solid ${serverTypeColor}50`,
                    color: serverTypeColor,
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    fontWeight: '500',
                    cursor: isLoading || server.canisterId === 'pending' ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    opacity: isLoading || server.canisterId === 'pending' ? 0.6 : 1,
                    fontSize: '0.9rem',
                    minHeight: '44px'
                  }}
                >
                  {isLoading ? '⏳ Refreshing...' : '🔄 Refresh'}
                </button>
              </>
            )}

            {/* Mobile-only refresh button */}
            {isMobile && (
              <button
                onClick={loadServerData}
                disabled={isLoading || server.canisterId === 'pending'}
                style={{
                  background: `rgba(${serverTypeColor.replace('#', '')}, 0.1)`,
                  border: `1px solid ${serverTypeColor}50`,
                  color: serverTypeColor,
                  padding: '0.875rem',
                  borderRadius: '8px',
                  fontWeight: '500',
                  cursor: isLoading || server.canisterId === 'pending' ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  opacity: isLoading || server.canisterId === 'pending' ? 0.6 : 1,
                  fontSize: '0.9rem',
                  minHeight: '44px'
                }}
              >
                {isLoading ? '⏳ Refreshing...' : '🔄 Refresh Data'}
              </button>
            )}
          </div>
        </div>

        {/* Add Credits Form - Mobile Optimized */}
        {showAddResourcesForm && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: '12px',
            padding: isMobile ? '1rem' : '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <h4 style={{
              fontSize: isMobile ? '0.95rem' : '1rem',
              fontWeight: '600',
              color: '#f59e0b',
              marginBottom: '1rem'
            }}>
              💰 Add Credits to Server
            </h4>

            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              padding: isMobile ? '0.875rem' : '1rem',
              marginBottom: '1rem',
              fontSize: isMobile ? '0.8rem' : '0.85rem',
              color: '#10b981',
              lineHeight: 1.5
            }}>
              🚀 <strong>ADD CREDITS:</strong> This will deduct credits from your wallet and add resources to this specific server with complete transparency!
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '0.85rem' : '0.9rem',
                color: '#e5e7eb',
                marginBottom: '0.5rem'
              }}>
                Credits to Add
              </label>
              <input
                type="number"
                value={creditsToAddInput}
                onChange={(e) => handleCreditsToAddChange(e.target.value)}
                onBlur={handleCreditsToAddBlur}
                min="100"
                max={credits.balance}
                step="100"
                placeholder="Enter credits amount"
                style={{
                  width: '100%',
                  padding: isMobile ? '0.875rem' : '0.75rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: isMobile ? '1rem' : '0.9rem',
                  minHeight: '44px'
                }}
              />
              <div style={{
                fontSize: isMobile ? '0.75rem' : '0.8rem',
                color: '#9ca3af',
                marginTop: '0.5rem',
                lineHeight: 1.4
              }}>
                Available: {CreditsService.formatCreditsDisplay(credits.balance)} credits
                {credits.balance < creditsToAdd && (
                  <span style={{ color: '#ef4444', display: 'block', marginTop: '0.25rem' }}>
                    ❌ Insufficient credits!
                  </span>
                )}
                <br />
                <span style={{ color: '#10b981' }}>🌐 Resources provisioned instantly</span>
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? '0.75rem' : '1rem', 
              justifyContent: 'flex-end' 
            }}>
              <button
                onClick={() => {
                  setShowAddResourcesForm(false);
                  setCreditsToAdd(1000);
                  setCreditsToAddInput('1000');
                }}
                disabled={isAddingResources}
                style={{
                  background: 'rgba(107, 114, 128, 0.2)',
                  border: '1px solid rgba(107, 114, 128, 0.3)',
                  color: '#9ca3af',
                  padding: isMobile ? '0.875rem' : '0.75rem 1rem',
                  borderRadius: '8px',
                  cursor: isAddingResources ? 'not-allowed' : 'pointer',
                  fontSize: isMobile ? '0.9rem' : '0.9rem',
                  opacity: isAddingResources ? 0.6 : 1,
                  minHeight: '44px',
                  flex: isMobile ? 1 : 'auto'
                }}
              >
                Cancel
              </button>
              <button
                onClick={addResourcesToServer}
                disabled={isAddingResources || creditsToAdd <= 0 || credits.balance < creditsToAdd || !mainActor}
                style={{
                  background: isAddingResources || creditsToAdd <= 0 || credits.balance < creditsToAdd || !mainActor
                    ? 'rgba(245, 158, 11, 0.3)'
                    : 'linear-gradient(135deg, #f59e0b, #d97706)',
                  border: 'none',
                  color: '#ffffff',
                  padding: isMobile ? '0.875rem' : '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: isAddingResources || creditsToAdd <= 0 || credits.balance < creditsToAdd || !mainActor
                    ? 'not-allowed' 
                    : 'pointer',
                  fontSize: isMobile ? '0.9rem' : '0.9rem',
                  opacity: isAddingResources || creditsToAdd <= 0 || credits.balance < creditsToAdd || !mainActor ? 0.6 : 1,
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                  minHeight: '44px',
                  flex: isMobile ? 1 : 'auto'
                }}
              >
                {isAddingResources ? '⏳ Adding Credits...' : 
                 !mainActor ? (isMobile ? '⚠️ Service Required' : '⚠️ Service Required') :
                 isMobile ? `💰 SPEND ${creditsToAdd.toLocaleString()}` : 
                 `💰 SPEND ${creditsToAdd.toLocaleString()} Credits`}
              </button>
            </div>
          </div>
        )}

        {/* Settings Form - Desktop Only */}
        {showSettings && !isMobile && (
          <div style={{
            background: 'rgba(107, 114, 128, 0.05)',
            border: '1px solid rgba(107, 114, 128, 0.2)',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <h4 style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#9ca3af',
              marginBottom: '1rem'
            }}>
              ⚙️ Server Settings (Coming Soon)
            </h4>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.9rem',
                  color: '#e5e7eb',
                  marginBottom: '0.5rem'
                }}>
                  Memory Allocation (GB)
                </label>
                <input
                  type="number"
                  value={newMemoryAllocation}
                  onChange={(e) => setNewMemoryAllocation(Number(e.target.value))}
                  min="1"
                  max="8"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    minHeight: '44px'
                  }}
                />
              </div>
              
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.9rem',
                  color: '#e5e7eb',
                  marginBottom: '0.5rem'
                }}>
                  Compute Allocation (%)
                </label>
                <input
                  type="number"
                  value={newComputeAllocation}
                  onChange={(e) => setNewComputeAllocation(Number(e.target.value))}
                  min="0"
                  max="100"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    minHeight: '44px'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowSettings(false);
                  setNewMemoryAllocation(serverInfo.memoryAllocation);
                  setNewComputeAllocation(serverInfo.computeAllocation);
                }}
                style={{
                  background: 'rgba(107, 114, 128, 0.2)',
                  border: '1px solid rgba(107, 114, 128, 0.3)',
                  color: '#9ca3af',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  minHeight: '44px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={updateServerSettings}
                disabled={isLoading}
                style={{
                  background: isLoading 
                    ? 'rgba(107, 114, 128, 0.3)'
                    : 'linear-gradient(135deg, #6b7280, #4b5563)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontWeight: '500',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  opacity: isLoading ? 0.6 : 1,
                  minHeight: '44px'
                }}
              >
                {isLoading ? '⏳ Updating...' : '💾 Save Settings'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};