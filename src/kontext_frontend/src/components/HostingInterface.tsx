import React, { useState, useEffect } from 'react';
import { Principal } from '@dfinity/principal';
import { Actor, Identity } from '@dfinity/agent';
import { createAgent } from '@dfinity/utils';
import { userCanisterService } from '../services/UserCanisterService';
import { CreditsService } from '../services/CreditsService';
import { icpPriceService, IcpPriceData } from '../services/IcpPriceService';
import { useAppStore } from '../store/appStore';
import { useCanister } from '../useCanister';
import { ServerManagementDialog } from './ServerManagementDialog';
import { ServerPairAssignmentDialog } from './ServerPairAssignmentDialog';
import { getIcpXdrConversionRate, icpToCycles } from '../utils/icpUtils';
import { storeTransactionData, storeCycleTopupTransaction } from './TransactionTrackingModal';
import { economyMetricsService } from '../services/EconomyMetricsService';
import pako from 'pako';

interface HostingInterfaceProps {
  projectId: string;
  projectName: string;
  userCanisterId?: string | null;
  selectedServerPair?: ServerPair | null; // 🔥 NEW: Coordinated server pair from parent
}

interface ServerPair {
  pairId: string;
  name: string;
  createdAt: number;
  creditsAllocated: number;
  frontendCanisterId: string;
  backendCanisterId: string;
}

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

interface UserCanister {
  principal: { toText?: () => string } | string;
  canisterType: string;
  name: string;
}

interface UserCanisterMetadata {
  balance: number;
  cycleBalance: bigint;
  lastUpdated: number;
  memoryUsage: number;
  version: string;
  uptime: number;
}

interface CyclesMintingCanister {
  notify_top_up: (args: {
    block_index: bigint;
    canister_id: Principal;
  }) => Promise<null>;
}

// 🔥 FIX: Use getter function to prevent initialization error
// CMC Principal ID - lazy initialized to avoid "Cannot access before initialization"
const getCMCCanisterId = () => Principal.fromText("rkp4c-7iaaa-aaaaa-aaaca-cai");

// Hosting Storage WASM URL (loaded dynamically from config)
// Removed hardcoded URL - now fetched from wasmConfigService

// FIXED: Realistic resource calculations with creation overhead included
const REALISTIC_COSTS = {
  // Runtime cycles per server for 1GB/30days
  CYCLES_PER_SERVER_RUNTIME_1GB_30DAYS: 2_000_000_000_000n, // 2T cycles
  
  // Creation overhead per server
  CANISTER_CREATION_FEE: 100_000_000_000n, // 100B cycles per canister
  WASM_INSTALLATION_OVERHEAD: 300_000_000_000n, // 300B cycles per canister
  MEMORY_INITIALIZATION: 100_000_000_000n, // 100B cycles per canister
  CONTROLLER_SETUP: 50_000_000_000n, // 50B cycles per canister
  
  // Hosting infrastructure deployment (one-time for frontend)
  HOSTING_DEPLOYMENT_COST: 200_000_000_000n, // 200B cycles total
  
  // Safety buffer for network operations
  SAFETY_BUFFER_PERCENTAGE: 0.10, // 10% buffer
  
  // Minimum memory enforced
  MINIMUM_MEMORY_GB: 1
};

// Helper to get the network host
const getICPHost = () => {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:4943'
    : 'https://icp0.io';
};

// Helper to generate URLs for servers
const generateCanisterUrls = (canisterId: string, isLocal: boolean) => {
  if (isLocal) {
    return {
      candidUrl: `http://127.0.0.1:4943/?canisterId=${canisterId}`,
      siteUrl: `http://${canisterId}.localhost:4943`,
    };
  } else {
    return {
      candidUrl: `https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id=${canisterId}`,
      siteUrl: `https://${canisterId}.icp0.io`,
    };
  }
};

// ENHANCED: Financial Operations Logger with detailed conversion tracking
class FinancialLogger {
  private static logGroup(title: string, callback: () => void) {
    console.group(`🏗️ ${title}`);
    try {
      callback();
    } finally {
      console.groupEnd();
    }
  }

  // UPDATED: Log detailed conversion rate analysis using cloud infrastructure pricing
  static logConversionRateAnalysis(details: {
    creditsRequested: number;
    usdEquivalent: number;
    realIcpPrice: number;
    estimatedIcpTokens: number;
    estimatedIcpE8s: bigint;
    estimatedCyclesFromIcp: bigint;
    currentIcpCyclesRate?: number;
    conversionMethod: string;
    priceSource: string;
    priceAge: number;
  }) {
    this.logGroup('📊 CLOUD INFRASTRUCTURE CONVERSION ANALYSIS', () => {
      console.log(`💰 Credits Requested: ${details.creditsRequested}`);
      console.log(`💵 USD Equivalent: $${details.usdEquivalent.toFixed(4)}`);
      console.log(`📈 Cloud Infrastructure Rate: $${details.realIcpPrice.toFixed(4)} (${details.priceSource})`);
      console.log(`⏰ Price Age: ${Math.round(details.priceAge / 1000)}s old`);
      console.log(`🪙 Calculated Tokens: ${details.estimatedIcpTokens.toFixed(6)}`);
      console.log(`🪙 Token Amount (e8s): ${details.estimatedIcpE8s.toString()}`);
      console.log(`⚡ Estimated Resources: ${details.estimatedCyclesFromIcp.toString()} (${Number(details.estimatedCyclesFromIcp)/1_000_000_000_000}T)`);
      if (details.currentIcpCyclesRate) {
        console.log(`⚡ Current Resource Rate: ${details.currentIcpCyclesRate.toFixed(2)}T resources per token`);
      }
      console.log(`🔧 Conversion Method: ${details.conversionMethod}`);
      console.log(`✅ Cloud infrastructure pricing verified`);
    });
  }

  // ENHANCED: Compare estimated vs actual conversion results
  static logConversionComparison(comparison: {
    estimatedCycles: bigint;
    actualCyclesReceived: bigint;
    realIcpPrice: number;
    actualIcpCyclesRate: number;
    blockIndex: bigint;
    conversionEfficiency: number;
    marketVariance: number;
  }) {
    this.logGroup('🔍 CLOUD RESOURCE ALLOCATION COMPARISON', () => {
      console.log(`🎯 Estimated Resources: ${comparison.estimatedCycles.toString()} (${Number(comparison.estimatedCycles)/1_000_000_000_000}T)`);
      console.log(`✅ Actual Resources Received: ${comparison.actualCyclesReceived.toString()} (${Number(comparison.actualCyclesReceived)/1_000_000_000_000}T)`);
      console.log(`📊 Conversion Efficiency: ${(comparison.conversionEfficiency * 100).toFixed(1)}% (actual vs estimated)`);
      console.log(`📈 Market Variance: ${comparison.marketVariance > 0 ? '+' : ''}${(comparison.marketVariance * 100).toFixed(1)}%`);
      console.log(`💰 Cloud Infrastructure Rate Used: $${comparison.realIcpPrice.toFixed(4)}`);
      console.log(`⚡ Resource Conversion Rate: ${comparison.actualIcpCyclesRate.toFixed(2)}T resources per token`);
      console.log(`🔗 Blockchain Block: ${comparison.blockIndex.toString()}`);
      
      if (comparison.conversionEfficiency > 1.1) {
        console.log(`🎉 BONUS: You received ${((comparison.conversionEfficiency - 1) * 100).toFixed(1)}% more resources than estimated!`);
        console.log(`💡 This means the cloud conditions were more favorable`);
      } else if (comparison.conversionEfficiency < 0.9) {
        console.log(`⚠️ NOTICE: You received ${((1 - comparison.conversionEfficiency) * 100).toFixed(1)}% fewer resources than estimated`);
        console.log(`💡 This means the cloud conditions changed during the operation`);
      } else {
        console.log(`✅ EXPECTED: Conversion efficiency within normal range (±10%) - Cloud conditions stable`);
      }
    });
  }

  static logCostAnalysis(config: {
    memoryGB: number;
    durationDays: number;
    runtimeCyclesPerServer: bigint;
    creationOverheadPerServer: bigint;
    totalCyclesPerServer: bigint;
    creditsRequested: number;
    usdEquivalent: number;
    realIcpPrice: number;
  }) {
    this.logGroup('💰 COMPREHENSIVE COST ANALYSIS', () => {
      console.log(`📊 Memory: ${config.memoryGB}GB (minimum enforced)`);
      console.log(`📅 Duration: ${config.durationDays} days`);
      console.log(`⚡ Runtime resources per server: ${Number(config.runtimeCyclesPerServer)/1_000_000_000_000}T`);
      console.log(`🏗️ Creation overhead per server: ${Number(config.creationOverheadPerServer)/1_000_000_000_000}T`);
      console.log(`📈 Total per server: ${Number(config.totalCyclesPerServer)/1_000_000_000_000}T resources`);
      console.log(`💰 Credits requested: ${config.creditsRequested}`);
      console.log(`💵 USD equivalent: $${config.usdEquivalent.toFixed(4)}`);
      console.log(`📈 Cloud infrastructure rate: $${config.realIcpPrice.toFixed(4)}`);
      console.log(`✅ Cost includes ALL overhead: creation fees, setup, hosting deployment`);
      console.log(`🌐 Cloud infrastructure handles all technical complexity`);
    });
  }

  static logBalanceSnapshot(title: string, balances: {
    userWalletCredits?: number;
    userServerCredits?: number;
    userServerCycles?: bigint;
    platformStatus?: string;
    cloudStatus?: string;
  }) {
    this.logGroup(`🏦 ${title}`, () => {
      if (balances.userWalletCredits !== undefined) {
        console.log(`💳 User Credits: ${balances.userWalletCredits}`);
      }
      if (balances.userServerCredits !== undefined) {
        console.log(`🏭 Management Server Credits: ${balances.userServerCredits}`);
      }
      if (balances.userServerCycles !== undefined) {
        console.log(`⚡ Management Server Resources: ${balances.userServerCycles.toString()} (${Number(balances.userServerCycles)/1_000_000_000_000}T)`);
      }
      if (balances.platformStatus) {
        console.log(`🌐 Platform Status: ${balances.platformStatus}`);
      }
      if (balances.cloudStatus) {
        console.log(`☁️ Cloud Infrastructure: ${balances.cloudStatus}`);
      }
    });
  }

  static logPlatformResourceProvision(details: {
    fromBalance: number;
    creditsDeducted: number;
    targetServer: string;
    blockIndex?: bigint;
    platformSource: string;
    realIcpPrice: number;
    icpAmount: number;
  }) {
    this.logGroup('📤 PLATFORM RESOURCE PROVISION', () => {
      console.log(`📊 User Credits Before: ${details.fromBalance}`);
      console.log(`📊 Credits Deducted: ${details.creditsDeducted}`);
      console.log(`📊 User Credits After: ${details.fromBalance - details.creditsDeducted}`);
      console.log(`💸 Platform Source: ${details.platformSource}`);
      console.log(`📈 Cloud Infrastructure Rate Used: $${details.realIcpPrice.toFixed(4)}`);
      console.log(`🪙 Token Amount Transferred: ${details.icpAmount.toFixed(6)} tokens`);
      console.log(`🎯 Target server: ${details.targetServer}`);
      if (details.blockIndex) {
        console.log(`🔗 Block index: ${details.blockIndex.toString()}`);
      }
      console.log(`✅ Resource provision: Platform using cloud infrastructure pricing`);
    });
  }

  static logPaymentOperation(details: {
    serverId: string;
    blockIndex?: bigint;
    success: boolean;
    error?: string;
    sourceType: 'platform_wallet' | 'user_wallet';
    realIcpPrice?: number;
  }) {
    this.logGroup('🔄 RESOURCE PROVISIONING', () => {
      console.log(`🎯 Target server: ${details.serverId}`);
      console.log(`💳 Resource Source: ${details.sourceType === 'platform_wallet' ? 'Platform Cloud Infrastructure' : 'User Wallet'}`);
      if (details.realIcpPrice) {
        console.log(`📈 Cloud Infrastructure Rate: $${details.realIcpPrice.toFixed(4)}`);
      }
      if (details.blockIndex) {
        console.log(`🔗 Block index: ${details.blockIndex.toString()}`);
      }
      if (details.success) {
        console.log(`✅ Resource provisioning: SUCCESS`);
        console.log(`⏳ Status: Waiting for resources...`);
      } else {
        console.log(`❌ Resource provisioning: FAILED`);
        console.log(`💥 Error: ${details.error}`);
        if (details.error && details.error.includes('insufficient')) {
          console.log(`⚠️ Platform Action Required: Cloud resource balance may need replenishment`);
        }
      }
    });
  }

  static async logResourcePolling(
    userServerId: string,
    identity: Identity,
    initialBalance: bigint,
    expectedAmount: bigint,
    maxWaitSeconds: number = 60
  ): Promise<{ success: boolean; finalBalance: bigint; resourcesAdded: bigint; waitTime: number }> {
    return new Promise(async (resolve) => {
      this.logGroup('⏳ RESOURCE ALLOCATION VERIFICATION', async () => {
        console.log(`🎯 Monitoring server: ${userServerId}`);
        console.log(`📊 Initial balance: ${initialBalance.toString()} (${Number(initialBalance)/1_000_000_000_000}T)`);
        console.log(`🎯 Expected addition: ${expectedAmount.toString()} (${Number(expectedAmount)/1_000_000_000_000}T)`);
        console.log(`⏱️ Max wait time: ${maxWaitSeconds} seconds`);
        console.log(`🌐 Resource Source: Platform Cloud Infrastructure`);
        
        const startTime = Date.now();
        let pollCount = 0;
        
        const pollBalance = async (): Promise<void> => {
          try {
            pollCount++;
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            
            const metadata = await userCanisterService.getUserStateMetadata(userServerId, identity);
            const currentBalance = metadata?.cycleBalance || 0n;
            const resourcesAdded = currentBalance - initialBalance;
            
            console.log(`📊 Poll #${pollCount} (${elapsed}s): ${currentBalance.toString()} resources (${Number(currentBalance)/1_000_000_000_000}T)`);
            
            if (resourcesAdded >= expectedAmount * 8n / 10n) { // Allow 20% tolerance
              console.log(`✅ RESOURCES ALLOCATED! Added: ${resourcesAdded.toString()} resources`);
              console.log(`🎉 Success in ${elapsed} seconds via cloud infrastructure provisioning`);
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

  static logServerCreation(details: {
    serverType: string;
    serverId?: string;
    resourcesAllocated: bigint;
    success: boolean;
    error?: string;
  }) {
    this.logGroup(`🏗️ ${details.serverType.toUpperCase()} SERVER CREATION`, () => {
      console.log(`⚡ Resources allocated: ${details.resourcesAllocated.toString()} (${Number(details.resourcesAllocated)/1_000_000_000_000}T)`);
      console.log(`🌐 Resource Source: Platform Cloud Infrastructure`);
      if (details.success && details.serverId) {
        console.log(`✅ SUCCESS: ${details.serverId}`);
      } else {
        console.log(`❌ FAILED: ${details.error}`);
      }
    });
  }

  static logHostingSetup(details: {
    serverId: string;
    setupSize: number;
    success: boolean;
    error?: string;
    deploymentMethod: 'direct' | 'chunked';
  }) {
    this.logGroup('🎨 HOSTING SETUP', () => {
      console.log(`🎯 Target server: ${details.serverId}`);
      console.log(`📦 Setup size: ${(details.setupSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`🔧 Method: ${details.deploymentMethod}`);
      if (details.success) {
        console.log(`✅ HOSTING CONFIGURED SUCCESSFULLY`);
      } else {
        console.log(`❌ SETUP FAILED: ${details.error}`);
      }
    });
  }

  // FIXED: Enhanced operation summary with cloud infrastructure tracking
  static logOperationSummary(summary: {
    operationType: 'credit_addition' | 'server_creation' | 'cycle_topup' | 'server_assignment' | 'server_removal';
    totalCreditsRequested: number;
    totalResourcesAllocated: bigint;
    frontendCreated?: boolean;
    backendCreated?: boolean;
    hostingConfigured?: boolean;
    pairCreated?: boolean;
    managementServerCredited?: boolean;
    serversAssigned?: boolean;
    serversRemoved?: boolean;
    totalTime: number;
    success: boolean;
    platformProvision: boolean;
    conversionEfficiency?: number;
    realIcpPrice?: number;
    targetServer?: string;
    targetServerType?: string;
  }) {
    this.logGroup('📋 OPERATION SUMMARY (CLOUD INFRASTRUCTURE PLATFORM)', () => {
      console.log(`🎯 Operation Type: ${summary.operationType === 'credit_addition' ? 'MANAGEMENT SERVER CREDIT ADDITION' : 
                                          summary.operationType === 'server_creation' ? 'SERVER PAIR CREATION' : 
                                          summary.operationType === 'cycle_topup' ? 'RESOURCE TOP-UP' :
                                          summary.operationType === 'server_assignment' ? 'SERVER PAIR ASSIGNMENT' :
                                          'SERVER PAIR REMOVAL'}`);
      console.log(`💰 Credits deducted from user: ${summary.totalCreditsRequested}`);
      console.log(`🌐 Resources provided by: ${summary.platformProvision ? 'Platform Cloud Infrastructure' : 'User Wallet'}`);
      if (summary.realIcpPrice) {
        console.log(`📈 Cloud Infrastructure Rate Used: $${summary.realIcpPrice.toFixed(4)}`);
      }
      console.log(`⚡ Resources allocated: ${summary.totalResourcesAllocated.toString()} (${Number(summary.totalResourcesAllocated)/1_000_000_000_000}T)`);
      
      if (summary.conversionEfficiency) {
        console.log(`📊 Conversion Efficiency: ${(summary.conversionEfficiency * 100).toFixed(1)}% of estimated`);
        console.log(`✨ Cloud infrastructure accuracy: ${summary.conversionEfficiency > 0.9 && summary.conversionEfficiency < 1.1 ? 'EXCELLENT' : 'NORMAL VARIANCE'}`);
      }

      // Show appropriate metrics based on operation type
      if (summary.operationType === 'server_creation') {
        console.log(`🎨 Frontend server: ${summary.frontendCreated ? '✅ CREATED' : '❌ FAILED'}`);
        console.log(`⚙️ Backend server: ${summary.backendCreated ? '✅ CREATED' : '❌ FAILED'}`);
        console.log(`🌐 Hosting setup: ${summary.hostingConfigured ? '✅ CONFIGURED' : '❌ FAILED'}`);
        console.log(`🔗 Server pair record: ${summary.pairCreated ? '✅ CREATED' : '❌ FAILED'}`);
      } else if (summary.operationType === 'credit_addition') {
        console.log(`🏭 Management server credited: ${summary.managementServerCredited ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`📈 Server resource increase: ${Number(summary.totalResourcesAllocated)/1_000_000_000_000}T resources added via cloud infrastructure`);
      } else if (summary.operationType === 'cycle_topup') {
        console.log(`🔋 Target server: ${summary.targetServer} (${summary.targetServerType})`);
        console.log(`📈 Resource top-up: ${Number(summary.totalResourcesAllocated)/1_000_000_000_000}T resources added via cloud infrastructure`);
      } else if (summary.operationType === 'server_assignment') {
        console.log(`🔗 Servers assigned: ${summary.serversAssigned ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`📈 Server pair moved to project via metadata-based system`);
      } else if (summary.operationType === 'server_removal') {
        console.log(`🗑️ Servers removed: ${summary.serversRemoved ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`📈 Server pair unassigned from project via metadata-based system`);
      }

      console.log(`⏱️ Total time: ${summary.totalTime} seconds`);
      console.log(`🎯 Overall result: ${summary.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      
      if (summary.success) {
        if (summary.operationType === 'credit_addition') {
          console.log(`🎉 Management server is now properly funded via cloud infrastructure and ready for operations!`);
        } else if (summary.operationType === 'cycle_topup') {
          console.log(`🎉 Server ${summary.targetServer} has been topped up with cloud infrastructure and is ready for continued operations!`);
        } else if (summary.operationType === 'server_assignment') {
          console.log(`🎉 Server pair has been assigned to project and is ready for use!`);
        } else if (summary.operationType === 'server_removal') {
          console.log(`🎉 Server pair has been removed from project and is now available for reassignment!`);
        }
      }
      
      console.log(`🌐 Cloud infrastructure handles all technical complexity`);
    });
  }
}

// ENHANCED: Calculate comprehensive server resource needs with ALL overhead costs
function calculateComprehensiveServerResources(
  memoryGB: number,
  durationDays: number
): {
  runtimeCycles: bigint;
  creationOverhead: bigint;
  totalWithSafetyBuffer: bigint;
  description: string;
} {
  // ENFORCE 1GB MINIMUM - no fractional GB allowed
  const actualMemoryGB = Math.max(REALISTIC_COSTS.MINIMUM_MEMORY_GB, Math.floor(memoryGB));
  
  // Runtime cycles calculation
  const baseRate = REALISTIC_COSTS.CYCLES_PER_SERVER_RUNTIME_1GB_30DAYS; // 2T per GB per 30 days
  const memoryFactor = actualMemoryGB;
  const durationFactor = durationDays / 30.0;
  const runtimeCycles = BigInt(Math.floor(Number(baseRate) * memoryFactor * durationFactor));
  
  // Creation overhead calculation (per server)
  const creationOverhead = (
    REALISTIC_COSTS.CANISTER_CREATION_FEE +
    REALISTIC_COSTS.WASM_INSTALLATION_OVERHEAD +
    REALISTIC_COSTS.MEMORY_INITIALIZATION +
    REALISTIC_COSTS.CONTROLLER_SETUP
  );
  
  // Total per server
  const totalPerServer = runtimeCycles + creationOverhead;
  
  // Add safety buffer
  const safetyBufferAmount = BigInt(Math.floor(Number(totalPerServer) * REALISTIC_COSTS.SAFETY_BUFFER_PERCENTAGE));
  const totalWithSafetyBuffer = totalPerServer + safetyBufferAmount;
  
  const description = `${actualMemoryGB}GB for ${durationDays} days (includes creation overhead + ${(REALISTIC_COSTS.SAFETY_BUFFER_PERCENTAGE * 100).toFixed(0)}% buffer)`;
  
  return {
    runtimeCycles,
    creationOverhead,
    totalWithSafetyBuffer,
    description
  };
}

// Convert resources to credits for UI display (1TB resources = 1000 credits)
function resourcesToCredits(resources: bigint): number {
  const tbResources = Number(resources) / 1_000_000_000_000;
  return Math.ceil(tbResources * 1000);
}

// 🔥 NEW: Calculate ICP from actual cycles needed (cycles → ICP)
// This ensures platform wallet receives enough ICP to cover ALL costs
async function calculateIcpFromCycles(targetCycles: bigint): Promise<{
  icpE8s: bigint;
  icpTokens: number;
  estimatedCycles: bigint;
  conversionMethod: string;
  realIcpPrice: number;
  icpCyclesRate: number;
  priceSource: string;
  priceAge: number;
}> {
  console.log('⚡ [IcpFromCycles] Calculating ICP needed for exact cycles:', {
    targetCycles: targetCycles.toString(),
    targetCyclesT: (Number(targetCycles) / 1_000_000_000_000).toFixed(6)
  });
  
  try {
    // Get real-time ICP cycles rate
    const cyclesPerIcp = await getIcpXdrConversionRate();
    const icpCyclesRate = Number(cyclesPerIcp) / 1_000_000_000_000; // Convert to T cycles
    
    console.log(`⚡ [IcpFromCycles] Real-time ICP cycles rate: ${icpCyclesRate.toFixed(2)}T cycles per ICP`);
    
    // Calculate ICP needed: cycles ÷ cyclesPerICP (round UP to ensure enough)
    const icpTokens = Number(targetCycles) / Number(cyclesPerIcp);
    const icpE8s = BigInt(Math.ceil(icpTokens * 100_000_000)); // Round UP to ensure enough
    
    // Get ICP price for logging
    const priceData: IcpPriceData = await icpPriceService.getCurrentPrice();
    const realIcpPrice = priceData.price;
    
    console.log(`💰 [IcpFromCycles] ICP calculation: ${targetCycles.toString()} cycles ÷ ${cyclesPerIcp.toString()} = ${icpTokens.toFixed(6)} ICP tokens`);
    console.log(`💰 [IcpFromCycles] ICP amount: ${icpE8s.toString()} e8s (${icpTokens.toFixed(6)} tokens)`);
    console.log(`📈 [IcpFromCycles] Current ICP price: $${realIcpPrice.toFixed(4)} (${priceData.source}, ${Math.round(priceData.cacheAge / 1000)}s old)`);
    
    return {
      icpE8s,
      icpTokens,
      estimatedCycles: targetCycles, // Return the exact target cycles
      conversionMethod: 'Cycles → ICP (exact resource-based calculation)',
      realIcpPrice,
      icpCyclesRate: icpCyclesRate,
      priceSource: priceData.source,
      priceAge: priceData.cacheAge
    };
  } catch (error) {
    console.error('❌ [IcpFromCycles] Error calculating ICP for cycles:', error);
    throw new Error(`Cannot calculate ICP from cycles: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Calculate cloud resource conversion using current market pricing
async function calculateCloudResourceConversion(usdAmount: number): Promise<{
  icpE8s: bigint;
  icpTokens: number;
  estimatedCycles: bigint;
  conversionMethod: string;
  realIcpPrice: number;
  icpCyclesRate: number;
  priceSource: string;
  priceAge: number;
}> {
  console.log('⚡ [CloudResourceConversion] Starting cloud resource conversion calculation...');
  
  try {
    // Get current cloud infrastructure pricing
    const priceData: IcpPriceData = await icpPriceService.getCurrentPrice();
    const realIcpPrice = priceData.price;
    
    console.log(`📈 [CloudResourceConversion] Cloud infrastructure rate: $${realIcpPrice.toFixed(4)} (${Math.round(priceData.cacheAge / 1000)}s old)`);
    
    // Calculate tokens needed using current pricing
    // 🔥 FIX: Use Math.ceil to ensure platform wallet receives enough ICP to cover all costs
    // Rounding down causes losses when the platform wallet needs to provision resources
    const icpTokens = usdAmount / realIcpPrice;
    const icpE8s = BigInt(Math.ceil(icpTokens * 100_000_000)); // Convert to e8s (round UP to ensure enough)
    
    console.log(`💰 [CloudResourceConversion] Cloud pricing calculation: $${usdAmount.toFixed(4)} ÷ $${realIcpPrice.toFixed(4)} = ${icpTokens.toFixed(6)} tokens`);
    
    // Get resource conversion from infrastructure
    const cyclesPerIcp = await getIcpXdrConversionRate();
    const icpCyclesRate = Number(cyclesPerIcp) / 1_000_000_000_000; // Convert to T cycles
    
    // Calculate expected resources using conversion rates
    const conversionResult = await icpToCycles(icpE8s);
    const estimatedCycles = conversionResult.cycles;
    
    console.log(`⚡ [CloudResourceConversion] Cloud resource conversion: ${icpTokens.toFixed(6)} tokens × ${icpCyclesRate.toFixed(2)}T = ${Number(estimatedCycles)/1_000_000_000_000}T resources`);
    console.log(`✅ [CloudResourceConversion] Cloud infrastructure calculation complete`);
    
    return {
      icpE8s,
      icpTokens,
      estimatedCycles,
      conversionMethod: 'Cloud infrastructure pricing + resource conversion',
      realIcpPrice,
      icpCyclesRate: conversionResult.rate,
      priceSource: priceData.source,
      priceAge: priceData.cacheAge
    };
    
  } catch (error) {
    console.error('❌ [CloudResourceConversion] Cloud resource calculation failed:', error);
    
    // CRITICAL: Fail explicitly if pricing unavailable
    throw new Error(`Cannot proceed without current cloud infrastructure pricing: ${error instanceof Error ? error.message : 'Unknown pricing error'}`);
  }
}

// UPDATED: Calculate optimal server configuration with comprehensive costs
function calculateOptimalServerConfig(availableCredits: number): {
  canCreateServers: boolean;
  perServerCredits: number;
  perServerResources: bigint;
  memoryGB: number;
  durationDays: number;
  totalResourcesNeeded: bigint;
  message: string;
} {
  const halfCredits = Math.floor(availableCredits / 2);
  
  // Try different realistic configurations - ALL with 1GB minimum
  const configs = [
    { memoryGB: 1, durationDays: 30 },   // Standard: ~2.8T cycles + buffer per server
    { memoryGB: 1, durationDays: 21 },   // Shorter: ~2.0T cycles + buffer per server
    { memoryGB: 1, durationDays: 14 },   // Shorter: ~1.4T cycles + buffer per server
    { memoryGB: 1, durationDays: 7 },    // Very short: ~0.8T cycles + buffer per server
    { memoryGB: 2, durationDays: 30 },   // Larger if they have lots of credits
  ];
  
  for (const config of configs) {
    const calculation = calculateComprehensiveServerResources(config.memoryGB, config.durationDays);
    const creditsNeeded = resourcesToCredits(calculation.totalWithSafetyBuffer);
    
    if (halfCredits >= creditsNeeded) {
      // For server pair, add hosting deployment cost to frontend server
      const hostingCostCredits = resourcesToCredits(REALISTIC_COSTS.HOSTING_DEPLOYMENT_COST);
      const totalResourcesNeeded = (calculation.totalWithSafetyBuffer * 2n) + REALISTIC_COSTS.HOSTING_DEPLOYMENT_COST;
      
      return {
        canCreateServers: true,
        perServerCredits: creditsNeeded,
        perServerResources: calculation.totalWithSafetyBuffer,
        memoryGB: config.memoryGB,
        durationDays: config.durationDays,
        totalResourcesNeeded,
        message: `✅ Can create server pair: ${calculation.description} (~${creditsNeeded + Math.ceil(hostingCostCredits/2)} credits each incl. hosting)`
      };
    }
  }
  
  // Calculate what they'd need for the standard 1GB/30day config
  const standardCalculation = calculateComprehensiveServerResources(1, 30);
  const standardCreditsNeeded = resourcesToCredits(standardCalculation.totalWithSafetyBuffer) * 2;
  const hostingCostCredits = resourcesToCredits(REALISTIC_COSTS.HOSTING_DEPLOYMENT_COST);
  const totalNeeded = standardCreditsNeeded + hostingCostCredits;
  
  return {
    canCreateServers: false,
    perServerCredits: 0,
    perServerResources: 0n,
    memoryGB: 0,
    durationDays: 0,
    totalResourcesNeeded: 0n,
    message: `❌ Insufficient credits. Need ~${totalNeeded} credits for 1GB/30day server pair with hosting (you have ${availableCredits}). All overhead costs included.`
  };
}

// Mobile responsiveness helper
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      setIsTablet(width > 768 && width <= 1024);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return { isMobile, isTablet };
};

export const HostingInterface: React.FC<HostingInterfaceProps> = ({
  projectId,
  projectName,
  userCanisterId,
  selectedServerPair: coordinatedServerPair // 🔥 NEW: Coordinated server pair from parent
}) => {
  const identity = useAppStore(state => state.identity);
  const principal = useAppStore(state => state.principal);
  const { credits, fetchCreditsBalance, deductUnitsFromBalance, setProjectServerPair, notifyServerPairUpdate, getProjectServerPair } = useAppStore(state => ({
    credits: state.credits,
    fetchCreditsBalance: state.fetchCreditsBalance,
    deductUnitsFromBalance: state.deductUnitsFromBalance,
    setProjectServerPair: state.setProjectServerPair,
    notifyServerPairUpdate: state.notifyServerPairUpdate,
    getProjectServerPair: state.getProjectServerPair
  }));

  // Access main actor for platform operations
  const { actor: mainActor } = useCanister('main');

  // Mobile responsiveness
  const { isMobile, isTablet } = useIsMobile();

  // State management
  // 🚀 REMOVED: allUserCanisters state - was fetched but never used
  const [projectServerPairs, setProjectServerPairs] = useState<ServerPair[]>([]);
  const [userCanisterMetadata, setUserCanisterMetadata] = useState<UserCanisterMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [isCreatingServer, setIsCreatingServer] = useState(false);
  const [isAddingCredits, setIsAddingCredits] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddCreditsDialog, setShowAddCreditsDialog] = useState(false);
  
  // NEW: Server pair assignment dialog state
  const [showServerPairAssignmentDialog, setShowServerPairAssignmentDialog] = useState(false);
  
  const [selectedServer, setSelectedServer] = useState<{ server: ServerInstance; pairId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userServerUsd, setUserServerUsd] = useState<number>(0);

  // NEW: Server removal state
  const [isRemovingServerPair, setIsRemovingServerPair] = useState(false);
  const [removeOperationStatus, setRemoveOperationStatus] = useState<{ phase: string; message: string; timeMs: number } | null>(null);

  // Cloud infrastructure service state (hidden from user)
  const [cloudInfrastructureReady, setCloudInfrastructureReady] = useState(false);
  const [infrastructureError, setInfrastructureError] = useState<string | null>(null);
  const [isInfrastructureLoading, setIsInfrastructureLoading] = useState(true);

  // Mobile-specific state
  const [managementServerExpanded, setManagementServerExpanded] = useState(!isMobile);

  // Server configuration and form state
  const [serverName, setServerName] = useState('');
  const [creditsToAllocate, setCreditsToAllocate] = useState<number>(4500); // Default credits per server pair
  const [serverConfig, setServerConfig] = useState<ReturnType<typeof calculateOptimalServerConfig> | null>(null);

  // Add credits form state
  const [creditsToAdd, setCreditsToAdd] = useState<number>(3000);
  const [creditsToAddInput, setCreditsToAddInput] = useState<string>('3000');
  const [creditsToAllocateInput, setCreditsToAllocateInput] = useState<string>('4500');

  // Hosting setup state
  const [hostingStatus, setHostingStatus] = useState<string>('');
  const [hostingProgress, setHostingProgress] = useState<number>(0);

  // Credit refresh state
  const [isRefreshingCredits, setIsRefreshingCredits] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Check if running locally
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Initialize cloud infrastructure (hidden from user)
  useEffect(() => {
    const initializeCloudInfrastructure = async () => {
      setIsInfrastructureLoading(true);
      setInfrastructureError(null);
      
      try {
        console.log('🌐 [CloudInfrastructure] Initializing cloud infrastructure...');
        const priceData = await icpPriceService.getCurrentPrice();
        setCloudInfrastructureReady(true);
        console.log(`✅ [CloudInfrastructure] Cloud infrastructure ready`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Cloud infrastructure unavailable';
        setInfrastructureError(errorMessage);
        console.error('❌ [CloudInfrastructure] Infrastructure initialization failed:', error);
      } finally {
        setIsInfrastructureLoading(false);
      }
    };

    initializeCloudInfrastructure();
  }, []);

  // Enhanced credit refresh functionality
  const refreshCreditBalance = async (force: boolean = false) => {
    if (isRefreshingCredits && !force) return;
    
    try {
      setIsRefreshingCredits(true);
      await fetchCreditsBalance();
      console.log('💰 Credit balance refreshed successfully');
    } catch (error) {
      console.warn('⚠️ Credit balance refresh failed:', error);
    } finally {
      setIsRefreshingCredits(false);
    }
  };

  // Set up credit refresh during operations
  const startPeriodicCreditRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    
    const interval = setInterval(() => {
      refreshCreditBalance();
    }, 2000); // Refresh every 2 seconds during operations for better responsiveness
    
    setRefreshInterval(interval);
  };

  const stopPeriodicCreditRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  };

  // Clean up refresh interval on unmount
  useEffect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [refreshInterval]);

  // Refresh credits when component mounts or gains focus
  useEffect(() => {
    refreshCreditBalance();
    
    const handleFocus = () => refreshCreditBalance();
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      stopPeriodicCreditRefresh();
    };
  }, []);

  // Helper function to safely convert server ID
  const getServerIdString = (serverData: any): string => {
    if (typeof serverData === 'string') {
      return serverData;
    }
    if (serverData && typeof serverData.toText === 'function') {
      return serverData.toText();
    }
    if (serverData && serverData.principal) {
      if (typeof serverData.principal === 'string') {
        return serverData.principal;
      }
      if (typeof serverData.principal.toText === 'function') {
        return serverData.principal.toText();
      }
    }
    return serverData?.toString() || 'unknown';
  };

  // Convert ServerPair to ServerInstance for dialog
  const convertServerPairToInstance = (serverPair: ServerPair, type: 'frontend' | 'backend'): ServerInstance => {
    const serverId = type === 'frontend' ? serverPair.frontendCanisterId : serverPair.backendCanisterId;
    
    return {
      canisterId: serverId,
      type: type,
      name: `${serverPair.name} ${type === 'frontend' ? 'Frontend' : 'Backend'}`,
      status: 'running' as 'running' | 'stopped' | 'unknown',
      cycleBalance: 0n,
      creditEquivalent: 0,
      memoryAllocation: 1,
      computeAllocation: 0,
      lastUpdated: Date.now()
    };
  };

  // Create payment processing actor for transactions
  const createCMCActor = async (identity: Identity): Promise<CyclesMintingCanister> => {
    const host = getICPHost();

    const agent = await createAgent({
      host,
      identity,
      fetchRootKey: host.includes('localhost') || host.includes('127.0.0.1'),
    });

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

  // Input handling for credits to allocate
  const handleCreditsToAllocateChange = (value: string) => {
    setCreditsToAllocateInput(value);
    
    const numericValue = parseInt(value);
    if (!isNaN(numericValue) && numericValue >= 1000) {
      const constrainedValue = Math.min(numericValue, credits.balance);
      setCreditsToAllocate(constrainedValue);
    }
  };

  const handleCreditsToAllocateBlur = () => {
    const finalValue = Math.max(2500, Math.min(creditsToAllocate, credits.balance));
    setCreditsToAllocate(finalValue);
    setCreditsToAllocateInput(finalValue.toString());
  };

  // Input handling for credits to add
  const handleCreditsToAddChange = (value: string) => {
    setCreditsToAddInput(value);
    
    const numericValue = parseInt(value);
    if (!isNaN(numericValue) && numericValue >= 100) {
      const constrainedValue = Math.min(numericValue, credits.balance);
      setCreditsToAdd(constrainedValue);
    }
  };

  const handleCreditsToAddBlur = () => {
    const finalValue = Math.max(100, Math.min(creditsToAdd, credits.balance));
    setCreditsToAdd(finalValue);
    setCreditsToAddInput(finalValue.toString());
  };

  // Calculate server config when credits change
  useEffect(() => {
    const config = calculateOptimalServerConfig(creditsToAllocate);
    setServerConfig(config);
  }, [creditsToAllocate]);

  // Update management server expansion based on device type
  useEffect(() => {
    setManagementServerExpanded(!isMobile);
  }, [isMobile]);

// Fetch and configure hosting infrastructure
const fetchAndConfigureHosting = async (
  frontendServerId: string,
  userPrincipal: Principal
): Promise<void> => {
  try {
    setHostingStatus('Downloading hosting infrastructure...');
    setHostingProgress(10);
    
    console.log('🎭 [HostingSetup] Starting hosting configuration for:', frontendServerId);
    
    // Get WASM URL from configuration
    const { wasmConfigService } = await import('../services/WasmConfigService');
    const HOSTING_STORAGE_WASM_URL = await wasmConfigService.getAssetStorageWasmUrl();
    console.log('📥 [HostingSetup] Fetching asset storage WASM from:', HOSTING_STORAGE_WASM_URL);
    
    const response = await fetch(HOSTING_STORAGE_WASM_URL, {
      headers: {
        'Accept': 'application/octet-stream'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch hosting infrastructure: ${response.status} ${response.statusText}`);
    }

    setHostingStatus('Preparing hosting setup...');
    setHostingProgress(25);

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    setHostingStatus('Processing hosting configuration...');
    setHostingProgress(40);

    const compressed = new Uint8Array(arrayBuffer);
    const assetsWasmBytes = Array.from(compressed);

    setHostingStatus('Configuring hosting infrastructure...');
    setHostingProgress(60);

    const userActor = await userCanisterService.getUserActor(userCanisterId!, identity!);
    const frontendPrincipal = Principal.fromText(frontendServerId);

    setHostingStatus('Configuring hosting...');
    setHostingProgress(80);

    const setupResult = await userActor.deployToExistingCanister(
      frontendPrincipal,
      assetsWasmBytes,
      'frontend',
      'assetstorage',
      userPrincipal,
      [],
      [],
      ['reinstall']
    );

    FinancialLogger.logHostingSetup({
      serverId: frontendServerId,
      setupSize: assetsWasmBytes.length,
      success: true,
      deploymentMethod: 'direct-raw'
    });

    if (!setupResult || ('Err' in setupResult)) {
      const errorMsg = setupResult?.Err || 'Unknown setup error';
      throw new Error(`Hosting setup failed: ${JSON.stringify(errorMsg)}`);
    }

    setHostingStatus('Hosting configured successfully!');
    setHostingProgress(100);
    
    console.log('🎭 [HostingSetup] Configuration completed successfully');

  } catch (error) {
    console.error('🎭 [HostingSetup] Configuration failed:', error);
    
    FinancialLogger.logHostingSetup({
      serverId: frontendServerId,
      setupSize: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      deploymentMethod: 'direct-raw'
    });
    
    throw error;
  }
};

  // Load management server information
  const loadUserCanisterMetadata = async () => {
    if (!userCanisterId || !identity) {
      setIsLoadingMetadata(false);
      return;
    }

    try {
      setIsLoadingMetadata(true);
      const metadata = await userCanisterService.getUserStateMetadata(userCanisterId, identity);
      
      if (metadata) {
        setUserCanisterMetadata(metadata);
      }
    } catch (error) {
      console.error('❌ Error loading management server information:', error);
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  // 🚀 OPTIMIZED: Load servers - removed unnecessary getUserCanisters() call
  const loadServers = async () => {
    if (!userCanisterId || !identity) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('📡 [HostingInterface] Loading server pairs for project:', projectId);
      
      // 🚀 PERFORMANCE FIX: Removed getUserCanisters() call - it was fetching ALL canisters
      // but the data was NEVER used anywhere. This was causing unnecessary slowness.
      // Now we only fetch what we actually need: the project's server pairs.

      const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
      const serverPairsResult = await userActor.getProjectServerPairs(projectId);

      if (serverPairsResult && 'ok' in serverPairsResult) {
        const serverPairsData = serverPairsResult.ok;
        
        if (Array.isArray(serverPairsData)) {
          const mappedPairs = serverPairsData.map((pair: any) => ({
            pairId: pair.pairId,
            name: pair.name,
            createdAt: Number(pair.createdAt) / 1_000_000,
            creditsAllocated: Number(pair.creditsAllocated),
            frontendCanisterId: pair.frontendCanisterId.toText(),
            backendCanisterId: pair.backendCanisterId.toText()
          }));
          setProjectServerPairs(mappedPairs);
          console.log(`✅ [HostingInterface] Loaded ${mappedPairs.length} server pair(s) in O(1) time`);
        } else {
          setProjectServerPairs([]);
        }
      } else {
        const error = serverPairsResult?.err || 'Unknown error';
        console.error('❌ [HostingInterface] Server pairs query failed:', error);
        setProjectServerPairs([]);
      }

    } catch (error) {
      console.error('❌ [HostingInterface] Error loading servers:', error);
      setError(error instanceof Error ? error.message : 'Failed to load servers');
    } finally {
      setIsLoading(false);
    }
  };

  // ENHANCED: Add credits to management server with cloud infrastructure AND enhanced credit refresh
  const addCreditsToManagementServer = async () => {
    if (!userCanisterId || !identity || !principal || !mainActor) {
      setError('Missing required information or platform unavailable');
      return;
    }

    // CRITICAL: Check cloud infrastructure availability before proceeding
    if (!cloudInfrastructureReady || infrastructureError) {
      setError('Cannot add credits: Cloud infrastructure is temporarily unavailable. Please try again shortly.');
      return;
    }

    try {
      setIsAddingCredits(true);
      setError(null);

      // Start periodic credit refresh for better user experience
      startPeriodicCreditRefresh();

      const operationStartTime = Date.now();

      // Step 1: Validate using units-based credit system
      await fetchCreditsBalance();
      
      const validation = CreditsService.validateSufficientCredits(
        credits.balance,
        creditsToAdd,
        'management server credit addition'
      );

      if (!validation.valid) {
        throw new Error(validation.message);
      }

      // Step 2: Calculate USD equivalent and cloud infrastructure conversion
      const conversionUtils = CreditsService.getConversionUtils();
      const usdEquivalent = await conversionUtils.creditsToUsd(creditsToAdd);

      // NEW: Calculate using cloud infrastructure pricing
      const cloudConversion = await calculateCloudResourceConversion(usdEquivalent);

      // Log comprehensive cloud infrastructure analysis
      FinancialLogger.logConversionRateAnalysis({
        creditsRequested: creditsToAdd,
        usdEquivalent: usdEquivalent,
        realIcpPrice: cloudConversion.realIcpPrice,
        estimatedIcpTokens: cloudConversion.icpTokens,
        estimatedIcpE8s: cloudConversion.icpE8s,
        estimatedCyclesFromIcp: cloudConversion.estimatedCycles,
        currentIcpCyclesRate: cloudConversion.icpCyclesRate,
        conversionMethod: cloudConversion.conversionMethod,
        priceSource: cloudConversion.priceSource,
        priceAge: cloudConversion.priceAge
      });

      // Get initial balances for transparency
      const initialMetadata = await userCanisterService.getUserStateMetadata(userCanisterId, identity);
      const initialServerResources = initialMetadata?.cycleBalance || 0n;

      // Log comprehensive cost analysis with cloud infrastructure
      const serverCalculation = calculateComprehensiveServerResources(1, 30);
      FinancialLogger.logCostAnalysis({
        memoryGB: 1,
        durationDays: 30,
        runtimeCyclesPerServer: serverCalculation.runtimeCycles,
        creationOverheadPerServer: serverCalculation.creationOverhead,
        totalCyclesPerServer: serverCalculation.totalWithSafetyBuffer,
        creditsRequested: creditsToAdd,
        usdEquivalent: usdEquivalent,
        realIcpPrice: cloudConversion.realIcpPrice
      });

      // Log pre-operation balance snapshot
      FinancialLogger.logBalanceSnapshot('PRE-OPERATION BALANCES', {
        userWalletCredits: credits.balance,
        userServerCredits: Math.floor(Number(initialServerResources) / 1_000_000_000_000 * 1000),
        userServerCycles: initialServerResources,
        platformStatus: 'Platform will provide cloud infrastructure resources',
        cloudStatus: `Current rate: $${cloudConversion.realIcpPrice.toFixed(4)} from ${cloudConversion.priceSource}`
      });

      // Step 3: Deduct credits from user's units-based balance first
      const unitsToDeduct = Math.round(usdEquivalent * 100);
      const deductionSuccess = await deductUnitsFromBalance(
        unitsToDeduct,
        projectId,
        `Management server credit addition: ${creditsToAdd} credits`
      );

      if (!deductionSuccess) {
        throw new Error('Failed to deduct credits from user balance');
      }

      // Immediate credit balance refresh after deduction
      await refreshCreditBalance(true);

      // Step 4: Use cloud infrastructure amount calculated from current pricing
      const serverPrincipal = Principal.fromText(userCanisterId);
      const icpE8sNeeded = cloudConversion.icpE8s;
      
      console.log(`💰 [CloudInfrastructure] Using current infrastructure-based amount: ${icpE8sNeeded.toString()} e8s (${cloudConversion.icpTokens.toFixed(6)} tokens at $${cloudConversion.realIcpPrice.toFixed(4)})`);
      
      const transferResult = await mainActor.topUpCanisterCMC(
        serverPrincipal,
        icpE8sNeeded
      );

      if (!transferResult || (typeof transferResult === 'object' && 'err' in transferResult)) {
        // Restore user credits if platform provisioning fails
        const restoreUnits = await useAppStore.getState().addUnitsToBalance(unitsToDeduct);
        if (restoreUnits) {
          console.log('✅ User credits restored after platform provisioning failure');
          await refreshCreditBalance(true);
        }
        
        const errorMessage = transferResult?.err || 'Platform provisioning failed';
        
        if (typeof errorMessage === 'string' && errorMessage.includes('insufficient')) {
          throw new Error('Platform is temporarily unable to provision resources. Please try again shortly or contact support if this persists.');
        }
        
        throw new Error(`Platform error: ${JSON.stringify(errorMessage)}`);
      }

      // Extract block index
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
        throw new Error(`Platform succeeded but could not extract block index. Response: ${transferResult}`);
      }

      // Log platform resource provision with cloud infrastructure data
      FinancialLogger.logPlatformResourceProvision({
        fromBalance: credits.balance + creditsToAdd, // Show original balance before deduction
        creditsDeducted: creditsToAdd,
        targetServer: userCanisterId,
        blockIndex: blockIndex,
        platformSource: 'Main Platform (Cloud Infrastructure)',
        realIcpPrice: cloudConversion.realIcpPrice,
        icpAmount: cloudConversion.icpTokens
      });

      // Step 5: Payment Processing with verification
      try {
        const cmcActor = await createCMCActor(identity);
        
        await cmcActor.notify_top_up({
          block_index: blockIndex,
          canister_id: serverPrincipal
        });

        FinancialLogger.logPaymentOperation({
          serverId: userCanisterId,
          blockIndex: blockIndex,
          success: true,
          sourceType: 'platform_wallet',
          realIcpPrice: cloudConversion.realIcpPrice
        });

      } catch (notifyError: any) {
        FinancialLogger.logPaymentOperation({
          serverId: userCanisterId,
          blockIndex: blockIndex,
          success: false,
          error: notifyError.message,
          sourceType: 'platform_wallet',
          realIcpPrice: cloudConversion.realIcpPrice
        });
        
        let errorMsg = `Credits deducted but platform resource allocation failed: ${notifyError.message}`;
        
        if (notifyError.message) {
          if (notifyError.message.includes("canister_not_found")) {
            errorMsg = `Server ${userCanisterId} not found by platform resource allocator. Please contact support.`;
          } else if (notifyError.message.includes("Reject text: ")) {
            const rejectMatch = notifyError.message.match(/Reject text: (.+?)($|\.)/);
            if (rejectMatch && rejectMatch[1]) {
              errorMsg = `Platform resource allocator rejected request: ${rejectMatch[1]}`;
            }
          }
        }
        
        throw new Error(errorMsg);
      }

      // Step 6: Verify resources were actually allocated
      const resourceVerification = await FinancialLogger.logResourcePolling(
        userCanisterId,
        identity,
        initialServerResources,
        cloudConversion.estimatedCycles,
        60
      );

      if (!resourceVerification.success) {
        throw new Error(`Platform resources were not allocated within 60 seconds. Expected ${cloudConversion.estimatedCycles.toString()} resources, only received ${resourceVerification.resourcesAdded.toString()}`);
      }

      // Calculate and log conversion efficiency
      const conversionEfficiency = Number(resourceVerification.resourcesAdded) / Number(cloudConversion.estimatedCycles);
      
      FinancialLogger.logConversionComparison({
        estimatedCycles: cloudConversion.estimatedCycles,
        actualCyclesReceived: resourceVerification.resourcesAdded,
        realIcpPrice: cloudConversion.realIcpPrice,
        actualIcpCyclesRate: cloudConversion.icpCyclesRate,
        blockIndex: blockIndex,
        conversionEfficiency: conversionEfficiency,
        marketVariance: conversionEfficiency - 1
      });

      // SUCCESS: Store comprehensive cycle top-up transaction data
      const operationTime = Math.round((Date.now() - operationStartTime) / 1000);

      console.log('📊 [TransactionTracking] Storing management server cycle top-up transaction data...');
      
      try {
        storeCycleTopupTransaction({
          projectId: projectId,
          projectName: projectName,
          targetServerId: userCanisterId,
          targetServerType: 'management',
          targetServerName: 'Management Server',
          creditsRequested: creditsToAdd,
          icpConversion: {
            realIcpPrice: cloudConversion.realIcpPrice,
            priceSource: cloudConversion.priceSource,
            priceAge: cloudConversion.priceAge,
            icpTokens: cloudConversion.icpTokens,
            icpE8s: cloudConversion.icpE8s,
            usdEquivalent: usdEquivalent
          },
          platformIcpTransferred: cloudConversion.icpE8s,
          blockIndex: blockIndex,
          actualCyclesReceived: resourceVerification.resourcesAdded,
          conversionEfficiency: conversionEfficiency,
          operationDuration: operationTime,
          resourceAllocationTime: resourceVerification.waitTime,
          success: true
        });
        
        console.log('✅ [TransactionTracking] Management server cycle top-up transaction stored successfully');
      } catch (trackingError) {
        console.warn('⚠️ [TransactionTracking] Failed to store transaction data:', trackingError);
      }

      // Success! Log final summary
      FinancialLogger.logOperationSummary({
        operationType: 'cycle_topup',
        totalCreditsRequested: creditsToAdd,
        totalResourcesAllocated: resourceVerification.resourcesAdded,
        managementServerCredited: true,
        totalTime: operationTime,
        success: true,
        platformProvision: true,
        conversionEfficiency: conversionEfficiency,
        realIcpPrice: cloudConversion.realIcpPrice,
        targetServer: userCanisterId,
        targetServerType: 'management'
      });

      const efficiencyMessage = conversionEfficiency > 1.1 
        ? ` Bonus: You got ${((conversionEfficiency - 1) * 100).toFixed(1)}% more resources than estimated due to favorable cloud conditions!`
        : conversionEfficiency < 0.9
        ? ` Note: You received ${((1 - conversionEfficiency) * 100).toFixed(1)}% fewer resources than estimated due to cloud changes.`
        : ' Cloud infrastructure conversion was highly accurate.';

      setSuccess(`Successfully added ${creditsToAdd.toLocaleString()} credits to management server using cloud infrastructure! ${Number(resourceVerification.resourcesAdded)/1_000_000_000_000}T resources allocated in ${resourceVerification.waitTime} seconds.${efficiencyMessage}`);
      setShowAddCreditsDialog(false);
      setCreditsToAdd(3000);
      setCreditsToAddInput('3000');

      // Final refresh after successful operation
      await refreshCreditBalance(true);

      // Refresh data after successful credit addition
      setTimeout(() => {
        loadUserCanisterMetadata();
        refreshCreditBalance(true);
      }, 2000);

    } catch (error) {
      console.error('❌ Management server credit addition failed:', error);
      
      // Store failed transaction data for debugging
      try {
        const operationTime = Math.round((Date.now() - operationStartTime) / 1000);
        const conversionUtils = CreditsService.getConversionUtils();
        const usdEquivalent = await conversionUtils.creditsToUsd(creditsToAdd);
        
        storeCycleTopupTransaction({
          projectId: projectId,
          projectName: projectName,
          targetServerId: userCanisterId!,
          targetServerType: 'management',
          targetServerName: 'Management Server',
          creditsRequested: creditsToAdd,
          icpConversion: cloudInfrastructureReady ? {
            realIcpPrice: 0, // Will be filled by pricing service if available
            priceSource: 'unavailable',
            priceAge: 0,
            icpTokens: 0,
            icpE8s: 0n,
            usdEquivalent: usdEquivalent
          } : {
            realIcpPrice: 0,
            priceSource: 'unavailable',
            priceAge: 0,
            icpTokens: 0,
            icpE8s: 0n,
            usdEquivalent: usdEquivalent
          },
          platformIcpTransferred: 0n,
          actualCyclesReceived: 0n,
          conversionEfficiency: 0,
          operationDuration: operationTime,
          resourceAllocationTime: 0,
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
        
        console.log('📊 [TransactionTracking] Failed management server top-up transaction stored for debugging');
      } catch (trackingError) {
        console.warn('⚠️ [TransactionTracking] Failed to store failed transaction data:', trackingError);
      }
      
      setError(error instanceof Error ? error.message : 'Failed to add credits to management server');
    } finally {
      setIsAddingCredits(false);
      stopPeriodicCreditRefresh();
      // Ensure final balance refresh
      setTimeout(() => refreshCreditBalance(true), 1000);
    }
  };

  // ENHANCED: Create server pair with cloud infrastructure AND enhanced credit refresh
  const createServerPair = async () => {
    if (!userCanisterId || !identity || !principal || !serverName.trim() || !mainActor) {
      setError('Missing required information, server name, or platform unavailable');
      return;
    }

    if (!serverConfig || !serverConfig.canCreateServers) {
      setError(serverConfig?.message || 'Invalid server configuration');
      return;
    }

    // CRITICAL: Check cloud infrastructure availability before proceeding
    if (!cloudInfrastructureReady || infrastructureError) {
      setError('Cannot create servers: Cloud infrastructure is temporarily unavailable. Please try again shortly.');
      return;
    }

    try {
      setIsCreatingServer(true);
      setError(null);
      setHostingStatus('');
      setHostingProgress(0);

      // Start periodic credit refresh for better user experience
      startPeriodicCreditRefresh();

      const operationStartTime = Date.now();

      console.group('🚀 SERVER PAIR CREATION WITH CLOUD INFRASTRUCTURE');

      // Step 1: Comprehensive pre-operation analysis
      await fetchCreditsBalance();
      
      const validation = CreditsService.validateSufficientCredits(
        credits.balance,
        creditsToAllocate,
        'server pair creation'
      );

      if (!validation.valid) {
        throw new Error(validation.message);
      }

      // Step 2: Calculate USD equivalent (for user billing) and actual cycles needed
      const conversionUtils = CreditsService.getConversionUtils();
      const usdEquivalent = await conversionUtils.creditsToUsd(creditsToAllocate);

      // 🔥 CRITICAL FIX: Calculate ICP from ACTUAL cycles needed, not from credits
      // This ensures platform wallet receives enough ICP to cover ALL costs including hosting
      const actualCyclesNeeded = serverConfig.totalResourcesNeeded;
      console.log(`💰 [ServerCreation] Actual cycles needed: ${actualCyclesNeeded.toString()} (${Number(actualCyclesNeeded)/1_000_000_000_000}T cycles)`);
      
      const cloudConversion = await calculateIcpFromCycles(actualCyclesNeeded);

      // Log comprehensive cloud infrastructure analysis
      FinancialLogger.logConversionRateAnalysis({
        creditsRequested: creditsToAllocate,
        usdEquivalent: usdEquivalent,
        realIcpPrice: cloudConversion.realIcpPrice,
        estimatedIcpTokens: cloudConversion.icpTokens,
        estimatedIcpE8s: cloudConversion.icpE8s,
        estimatedCyclesFromIcp: cloudConversion.estimatedCycles,
        currentIcpCyclesRate: cloudConversion.icpCyclesRate,
        conversionMethod: cloudConversion.conversionMethod,
        priceSource: cloudConversion.priceSource,
        priceAge: cloudConversion.priceAge
      });

      // Get comprehensive initial balances
      const initialMetadata = await userCanisterService.getUserStateMetadata(userCanisterId, identity);
      const initialServerResources = initialMetadata?.cycleBalance || 0n;

      // Log detailed cost analysis with cloud infrastructure
      const serverCalculation = calculateComprehensiveServerResources(serverConfig.memoryGB, serverConfig.durationDays);
      FinancialLogger.logCostAnalysis({
        memoryGB: serverConfig.memoryGB,
        durationDays: serverConfig.durationDays,
        runtimeCyclesPerServer: serverCalculation.runtimeCycles,
        creationOverheadPerServer: serverCalculation.creationOverhead,
        totalCyclesPerServer: serverCalculation.totalWithSafetyBuffer,
        creditsRequested: creditsToAllocate,
        usdEquivalent: usdEquivalent,
        realIcpPrice: cloudConversion.realIcpPrice
      });

      // Log comprehensive pre-operation snapshot
      FinancialLogger.logBalanceSnapshot('PRE-OPERATION BALANCES', {
        userWalletCredits: credits.balance,
        userServerCredits: Math.floor(Number(initialServerResources) / 1_000_000_000_000 * 1000),
        userServerCycles: initialServerResources,
        platformStatus: 'Cloud infrastructure platform will provide resources',
        cloudStatus: `Current rate: $${cloudConversion.realIcpPrice.toFixed(4)} from ${cloudConversion.priceSource} (${Math.round(cloudConversion.priceAge/1000)}s old)`
      });

      // Step 3: Deduct credits from user's balance first
      const unitsToDeduct = Math.round(usdEquivalent * 100);
      const deductionSuccess = await deductUnitsFromBalance(
        unitsToDeduct,
        projectId,
        `Server pair creation: ${serverName} (${creditsToAllocate} credits)`
      );

      if (!deductionSuccess) {
        throw new Error('Failed to deduct credits from user balance');
      }

      // Immediate credit balance refresh after deduction
      await refreshCreditBalance(true);

      // Step 4: Use cloud infrastructure amount calculated from current pricing
      const serverPrincipal = Principal.fromText(userCanisterId);
      const icpE8sNeeded = cloudConversion.icpE8s;
      
      console.log(`💰 [CloudInfrastructure] Using current infrastructure-based amount for server creation: ${icpE8sNeeded.toString()} e8s (${cloudConversion.icpTokens.toFixed(6)} tokens at $${cloudConversion.realIcpPrice.toFixed(4)})`);
      
      const transferResult = await mainActor.topUpCanisterCMC(
        serverPrincipal,
        icpE8sNeeded
      );

      if (!transferResult || (typeof transferResult === 'object' && 'err' in transferResult)) {
        // Restore user credits if platform provisioning fails
        const restoreUnits = await useAppStore.getState().addUnitsToBalance(unitsToDeduct);
        if (restoreUnits) {
          console.log('✅ User credits restored after platform provisioning failure');
          await refreshCreditBalance(true);
        }
        
        const errorMessage = transferResult?.err || 'Platform provisioning failed';
        
        if (typeof errorMessage === 'string' && errorMessage.includes('insufficient')) {
          throw new Error('Platform is temporarily unable to provision server resources. Please try again shortly or contact support if this persists.');
        }
        
        throw new Error(`Platform error: ${JSON.stringify(errorMessage)}`);
      }

      // Extract block index
      let blockIndex: bigint;
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
          throw new Error(`Could not extract block index from: ${blockIndexStr}`);
        }
      }

      // Log platform resource provision with cloud infrastructure data
      FinancialLogger.logPlatformResourceProvision({
        fromBalance: credits.balance + creditsToAllocate, // Show original balance before deduction
        creditsDeducted: creditsToAllocate,
        targetServer: userCanisterId,
        blockIndex: blockIndex,
        platformSource: 'Main Platform (Cloud Infrastructure)',
        realIcpPrice: cloudConversion.realIcpPrice,
        icpAmount: cloudConversion.icpTokens
      });

      // Step 5: Payment Processing
      const cmcActor = await createCMCActor(identity);
      try {
        await cmcActor.notify_top_up({
          block_index: blockIndex,
          canister_id: serverPrincipal
        });

        FinancialLogger.logPaymentOperation({
          serverId: userCanisterId,
          blockIndex: blockIndex,
          success: true,
          sourceType: 'platform_wallet',
          realIcpPrice: cloudConversion.realIcpPrice
        });
      } catch (cmcError: any) {
        FinancialLogger.logPaymentOperation({
          serverId: userCanisterId,
          blockIndex: blockIndex,
          success: false,
          error: cmcError.message,
          sourceType: 'platform_wallet',
          realIcpPrice: cloudConversion.realIcpPrice
        });
        throw cmcError;
      }

      // Step 6: Wait for resources before server creation
      const resourceVerification = await FinancialLogger.logResourcePolling(
        userCanisterId,
        identity,
        initialServerResources,
        cloudConversion.estimatedCycles,
        90
      );

      if (!resourceVerification.success) {
        throw new Error(`Failed to receive expected platform resources before server creation. Expected: ${cloudConversion.estimatedCycles.toString()}, Received: ${resourceVerification.resourcesAdded.toString()}`);
      }

      // Calculate conversion efficiency for server creation
      const conversionEfficiency = Number(resourceVerification.resourcesAdded) / Number(cloudConversion.estimatedCycles);
      
      FinancialLogger.logConversionComparison({
        estimatedCycles: cloudConversion.estimatedCycles,
        actualCyclesReceived: resourceVerification.resourcesAdded,
        realIcpPrice: cloudConversion.realIcpPrice,
        actualIcpCyclesRate: cloudConversion.icpCyclesRate,
        blockIndex: blockIndex,
        conversionEfficiency: conversionEfficiency,
        marketVariance: conversionEfficiency - 1
      });

      // Step 7: Create frontend server with verified resources
      let frontendResult: any;
      try {
        frontendResult = await userCanisterService.createServerFromUserCanister(
          userCanisterId,
          identity,
          principal,
          `${serverName} Frontend`,
          'frontend',
          {
            cyclesAmount: Number(serverConfig.perServerResources),
            memoryGB: serverConfig.memoryGB,
            computeAllocation: 0,
            freezingThreshold: [],
            durationInDays: serverConfig.durationDays 
          },
          {
            projectId: projectId,
            projectName: projectName
          }
        );

        FinancialLogger.logServerCreation({
          serverType: 'frontend',
          serverId: frontendResult.success ? frontendResult.canisterId : undefined,
          resourcesAllocated: serverConfig.perServerResources,
          success: frontendResult.success,
          error: frontendResult.error?.message
        });

        if (!frontendResult.success || !frontendResult.canisterId) {
          throw new Error(`Frontend server creation failed: ${frontendResult.error?.message}`);
        }
      } catch (error) {
        FinancialLogger.logServerCreation({
          serverType: 'frontend',
          resourcesAllocated: serverConfig.perServerResources,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }

      // Step 8: Create backend server
      let backendResult: any;
      try {
        backendResult = await userCanisterService.createServerFromUserCanister(
          userCanisterId,
          identity,
          principal,
          `${serverName} Backend`,
          'backend',
          {
            cyclesAmount: Number(serverConfig.perServerResources),
            memoryGB: serverConfig.memoryGB,
            computeAllocation: 0,
            freezingThreshold: [],
            durationInDays: serverConfig.durationDays 
          },
          {
            projectId: projectId,
            projectName: projectName
          }
        );

        FinancialLogger.logServerCreation({
          serverType: 'backend',
          serverId: backendResult.success ? backendResult.canisterId : undefined,
          resourcesAllocated: serverConfig.perServerResources,
          success: backendResult.success,
          error: backendResult.error?.message
        });

        if (!backendResult.success || !backendResult.canisterId) {
          throw new Error(`Backend server creation failed: ${backendResult.error?.message}`);
        }
      } catch (error) {
        FinancialLogger.logServerCreation({
          serverType: 'backend',
          resourcesAllocated: serverConfig.perServerResources,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }

      // Step 9: Configure Hosting for Frontend Server
      let hostingConfigured = false;
      try {
        await fetchAndConfigureHosting(frontendResult.canisterId, principal);
        hostingConfigured = true;
      } catch (hostingError) {
        console.error('❌ Hosting configuration failed:', hostingError);
        setError(`Servers created using cloud infrastructure but hosting configuration failed: ${hostingError instanceof Error ? hostingError.message : 'Unknown error'}`);
      }

      // Step 10: Create server pair record
      const frontendPrincipal = Principal.fromText(frontendResult.canisterId);
      const backendPrincipal = Principal.fromText(backendResult.canisterId);
      
      const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
      const serverPairResult = await userActor.createServerPair(
        projectId,
        serverName,
        frontendPrincipal,
        backendPrincipal,
        creditsToAllocate
      );

      const pairCreated = serverPairResult && !(typeof serverPairResult === 'object' && 'err' in serverPairResult);
      
      if (!pairCreated) {
        console.warn('Server pair record creation failed:', serverPairResult);
      } else {
        // Reload servers to get the updated list with the new server pair
        const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
        const refreshedPairsResult = await userActor.getProjectServerPairs(projectId);
        
        if (refreshedPairsResult && 'ok' in refreshedPairsResult && Array.isArray(refreshedPairsResult.ok)) {
          const refreshedPairs = refreshedPairsResult.ok.map((pair: any) => ({
            pairId: pair.pairId,
            name: pair.name,
            createdAt: Number(pair.createdAt) / 1_000_000,
            creditsAllocated: Number(pair.creditsAllocated),
            frontendCanisterId: pair.frontendCanisterId.toText(),
            backendCanisterId: pair.backendCanisterId.toText()
          }));
          
          // Find the newly created pair by matching frontend/backend canister IDs
          const newlyCreatedPair = refreshedPairs.find(pair => 
            pair.frontendCanisterId === frontendResult.canisterId && 
            pair.backendCanisterId === backendResult.canisterId
          );
          
          // If we found the newly created pair, set it as the default for this project and notify
          if (newlyCreatedPair && projectId) {
            console.log('🔄 [HostingInterface] Setting newly created server pair as default for project:', { projectId, serverPairId: newlyCreatedPair.pairId });
            setProjectServerPair(projectId, newlyCreatedPair.pairId);
            notifyServerPairUpdate(projectId, newlyCreatedPair.pairId);
            
            // Dispatch event to notify other components
            window.dispatchEvent(new CustomEvent('serverPairsUpdated', {
              detail: { userCanisterId, timestamp: Date.now() }
            }));
          }
        }
        
        // Also reload the full server list for UI update
        await loadServers();
      }

      // SUCCESS: Store comprehensive transaction data for tracking
      const operationTime = Math.round((Date.now() - operationStartTime) / 1000);
      
      console.log('📊 [TransactionTracking] Storing server creation transaction data...');
      
      try {
        storeTransactionData({
          projectId: projectId,
          projectName: projectName,
          operationType: 'server_creation',
          source: 'hosting_interface',
          
          // Input data
          creditsRequested: creditsToAllocate,
          serverPairName: serverName,
          memoryGB: serverConfig.memoryGB,
          durationDays: serverConfig.durationDays,
          
          // Infrastructure conversion data
          icpConversion: {
            realIcpPrice: cloudConversion.realIcpPrice,
            priceSource: cloudConversion.priceSource,
            priceAge: cloudConversion.priceAge,
            icpTokens: cloudConversion.icpTokens,
            icpE8s: cloudConversion.icpE8s,
            usdEquivalent: usdEquivalent
          },
          
          // Cycles breakdown
          cyclesBreakdown: {
            runtimeCycles: serverCalculation.runtimeCycles,
            creationOverhead: serverCalculation.creationOverhead,
            hostingDeploymentCost: REALISTIC_COSTS.HOSTING_DEPLOYMENT_COST,
            safetyBuffer: serverCalculation.totalWithSafetyBuffer - serverCalculation.runtimeCycles - serverCalculation.creationOverhead,
            totalCyclesExpected: cloudConversion.estimatedCycles
          },
          
          // Transaction results
          platformIcpTransferred: cloudConversion.icpE8s,
          blockIndex: blockIndex,
          actualCyclesReceived: resourceVerification.resourcesAdded,
          conversionEfficiency: conversionEfficiency,
          
          // Server creation results
          frontendServerId: frontendResult.canisterId,
          backendServerId: backendResult.canisterId,
          hostingConfigured: hostingConfigured,
          
          // Verification data
          estimatedVsActual: {
            estimatedCycles: cloudConversion.estimatedCycles,
            actualCycles: resourceVerification.resourcesAdded,
            variance: conversionEfficiency - 1,
            withinTolerance: Math.abs(conversionEfficiency - 1) <= 0.1
          },
          
          // Timing data
          operationDuration: operationTime,
          resourceAllocationTime: resourceVerification.waitTime,
          
          // Status
          success: true
        });
        
        console.log('✅ [TransactionTracking] Server creation transaction stored successfully');
      } catch (trackingError) {
        console.warn('⚠️ [TransactionTracking] Failed to store transaction data:', trackingError);
      }

      // Step 11: Final operation summary with cloud infrastructure tracking
      FinancialLogger.logOperationSummary({
        operationType: 'server_creation',
        totalCreditsRequested: creditsToAllocate,
        totalResourcesAllocated: resourceVerification.resourcesAdded,
        frontendCreated: true,
        backendCreated: true,
        hostingConfigured: hostingConfigured,
        pairCreated: pairCreated,
        totalTime: operationTime,
        success: true,
        platformProvision: true,
        conversionEfficiency: conversionEfficiency,
        realIcpPrice: cloudConversion.realIcpPrice
      });

      console.groupEnd();

      await loadServers();
      
      const efficiencyMessage = conversionEfficiency > 1.1 
        ? ` Bonus: Cloud conditions were ${((conversionEfficiency - 1) * 100).toFixed(1)}% more favorable than estimated!`
        : conversionEfficiency < 0.9
        ? ` Note: Cloud conditions resulted in ${((1 - conversionEfficiency) * 100).toFixed(1)}% fewer resources than estimated.`
        : ' Cloud infrastructure conversion was highly accurate.';

      // 🔥 NEW: Track cycle consumption in economy metrics
      try {
        economyMetricsService.trackCycleConsumption({
          userId: userCanisterId!,
          userPrincipal: principal!.toString(),
          canisterId: frontendResult.canisterId,
          canisterType: 'server_pair_frontend',
          cyclesConsumed: resourceVerification.resourcesAdded / BigInt(2), // Split between frontend and backend
          timestamp: Date.now()
        });
        economyMetricsService.trackCycleConsumption({
          userId: userCanisterId!,
          userPrincipal: principal!.toString(),
          canisterId: backendResult.canisterId,
          canisterType: 'server_pair_backend',
          cyclesConsumed: resourceVerification.resourcesAdded / BigInt(2),
          timestamp: Date.now()
        });
        console.log('📊 [HostingInterface] Cycle consumption tracked in economy metrics');
      } catch (trackingError) {
        console.warn('⚠️ [HostingInterface] Failed to track cycle consumption:', trackingError);
      }

      const successMessage = hostingConfigured 
        ? `Server pair "${serverName}" created successfully using cloud infrastructure with hosting configured! Frontend: ${frontendResult.canisterId}, Backend: ${backendResult.canisterId}. Ready for your website!${efficiencyMessage}`
        : `Server pair "${serverName}" created successfully using cloud infrastructure! Frontend: ${frontendResult.canisterId}, Backend: ${backendResult.canisterId}. Hosting configuration failed but can be retried.${efficiencyMessage}`;
        
      setSuccess(successMessage);
      setServerName('');
      setCreditsToAllocate(6500);
      setCreditsToAllocateInput('6500');
      setShowCreateDialog(false);
      setHostingStatus('');
      setHostingProgress(0);

      // Final refresh after successful operation
      await refreshCreditBalance(true);

      setTimeout(() => {
        refreshCreditBalance(true);
        loadUserCanisterMetadata();
      }, 2000);

    } catch (error) {
      console.groupEnd();
      console.error('Server pair creation failed:', error);
      
      // Store failed transaction data for debugging
      try {
        const operationTime = Math.round((Date.now() - operationStartTime) / 1000);
        const conversionUtils = CreditsService.getConversionUtils();
        const usdEquivalent = await conversionUtils.creditsToUsd(creditsToAllocate);
        const serverCalculation = calculateComprehensiveServerResources(serverConfig?.memoryGB || 1, serverConfig?.durationDays || 30);
        
        storeTransactionData({
          projectId: projectId,
          projectName: projectName,
          operationType: 'server_creation',
          source: 'hosting_interface',
          
          // Input data
          creditsRequested: creditsToAllocate,
          serverPairName: serverName,
          memoryGB: serverConfig?.memoryGB || 1,
          durationDays: serverConfig?.durationDays || 30,
          
          // Infrastructure conversion data (may be partial)
          icpConversion: cloudInfrastructureReady ? {
            realIcpPrice: 0, // Will be filled if available
            priceSource: 'unavailable',
            priceAge: 0,
            icpTokens: 0,
            icpE8s: 0n,
            usdEquivalent: usdEquivalent
          } : {
            realIcpPrice: 0,
            priceSource: 'unavailable',
            priceAge: 0,
            icpTokens: 0,
            icpE8s: 0n,
            usdEquivalent: usdEquivalent
          },
          
          // Cycles breakdown
          cyclesBreakdown: {
            runtimeCycles: serverCalculation.runtimeCycles,
            creationOverhead: serverCalculation.creationOverhead,
            hostingDeploymentCost: REALISTIC_COSTS.HOSTING_DEPLOYMENT_COST,
            safetyBuffer: serverCalculation.totalWithSafetyBuffer - serverCalculation.runtimeCycles - serverCalculation.creationOverhead,
            totalCyclesExpected: 0n
          },
          
          // Transaction results (failed)
          platformIcpTransferred: 0n,
          actualCyclesReceived: 0n,
          conversionEfficiency: 0,
          
          // Verification data
          estimatedVsActual: {
            estimatedCycles: 0n,
            actualCycles: 0n,
            variance: 0,
            withinTolerance: false
          },
          
          // Timing data
          operationDuration: operationTime,
          resourceAllocationTime: 0,
          
          // Status
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
        
        console.log('📊 [TransactionTracking] Failed server creation transaction stored for debugging');
      } catch (trackingError) {
        console.warn('⚠️ [TransactionTracking] Failed to store failed transaction data:', trackingError);
      }
      
      setError(error instanceof Error ? error.message : 'Failed to create server pair using cloud infrastructure');
      setHostingStatus('');
      setHostingProgress(0);
    } finally {
      setIsCreatingServer(false);
      stopPeriodicCreditRefresh();
      // Ensure final balance refresh
      setTimeout(() => refreshCreditBalance(true), 1000);
    }
  };

  // NEW: Handle server pair removal from project
  const removeServerPairFromProject = async (pairId: string, pairName: string) => {
    if (!userCanisterId || !identity) {
      setError('Missing required authentication information');
      return;
    }

    const confirmRemoval = window.confirm(
      `Are you sure you want to remove server pair "${pairName}" from project "${projectName}"?\n\n` +
      'The servers will become unassigned and available for use in other projects. This action cannot be undone.'
    );

    if (!confirmRemoval) {
      return;
    }

    try {
      setIsRemovingServerPair(true);
      setError(null);
      setSuccess(null);
      setRemoveOperationStatus({ phase: 'starting', message: 'Preparing server pair removal...', timeMs: 0 });

      console.log(`🗑️ [HostingInterface] Starting server pair removal: ${pairId} from project: ${projectId}`);

      const operationStartTime = Date.now();

      // Progress callback to update UI
      const progressCallback = (phase: string, message: string, timeMs: number) => {
        console.log(`🗑️ [HostingInterface] ${phase}: ${message} (${timeMs}ms)`);
        setRemoveOperationStatus({ phase, message, timeMs });
      };

      // Call the removal method from UserCanisterService
      const result = await userCanisterService.removeServerPairFromProject(
        pairId,
        userCanisterId,
        identity,
        progressCallback
      );

      const totalTime = Date.now() - operationStartTime;

      if (result.success) {
        // Log successful operation summary
        FinancialLogger.logOperationSummary({
          operationType: 'server_removal',
          totalCreditsRequested: 0, // No credits involved in removal
          totalResourcesAllocated: 0n, // No new resources allocated
          serversRemoved: true,
          totalTime: Math.round(totalTime / 1000),
          success: true,
          platformProvision: false, // No platform resources involved
          targetServer: pairId,
          targetServerType: 'server_pair'
        });

        setSuccess(`Server pair "${pairName}" has been successfully removed from project "${projectName}". The servers are now unassigned and available for other projects.`);
        
        console.log(`✅ [HostingInterface] Server pair removal completed successfully in ${totalTime}ms`);
        console.log(`📊 [HostingInterface] Performance metrics:`, result.performanceMetrics);

        // Reload the servers list to reflect changes
        await loadServers();

      } else {
        console.error('❌ [HostingInterface] Server pair removal failed:', result.error);
        setError(`Failed to remove server pair: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ [HostingInterface] Server pair removal operation failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to remove server pair from project');
    } finally {
      setIsRemovingServerPair(false);
      setRemoveOperationStatus(null);
    }
  };

  // NEW: Handle assignment completion callback
  const handleAssignmentComplete = async () => {
    console.log('🔄 [HostingInterface] Server pair assignment completed, refreshing data...');
    setSuccess('Server pair has been successfully assigned to the project!');
    setShowServerPairAssignmentDialog(false);
    await loadServers();
  };

  // Handle server card click - convert to ServerInstance
  const handleServerClick = (serverPair: ServerPair, serverType: 'frontend' | 'backend') => {
    const serverInstance = convertServerPairToInstance(serverPair, serverType);
    setSelectedServer({
      server: serverInstance,
      pairId: serverPair.pairId
    });
  };

  // Handle setting a server pair as default for the project
  const handleSetAsDefault = (serverPair: ServerPair) => {
    if (!projectId) return;
    
    console.log('🔄 [HostingInterface] Setting server pair as default:', { projectId, serverPairId: serverPair.pairId });
    setProjectServerPair(projectId, serverPair.pairId);
    notifyServerPairUpdate(projectId, serverPair.pairId);
    
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('serverPairsUpdated', {
      detail: { userCanisterId, timestamp: Date.now() }
    }));
    
    setSuccess(`"${serverPair.name}" is now the default server pair for this project`);
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setSuccess(`${label} copied to clipboard!`);
    }).catch(() => {
      setError(`Failed to copy ${label}`);
    });
  };

  // Open URL helper
  const openUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Refresh callback for dialog
  const handleRefreshServers = async () => {
    await loadServers();
    await loadUserCanisterMetadata();
    await refreshCreditBalance(true);
  };

  // Load data on component mount
  useEffect(() => {
    if (userCanisterId && identity) {
      loadServers();
      loadUserCanisterMetadata();
    }
  }, [userCanisterId, identity, projectId]);

  // Auto-clear messages
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 12000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 12000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleRefresh = () => {
    loadServers();
    loadUserCanisterMetadata();
    refreshCreditBalance(true);
  };

  const balanceStatus = CreditsService.getBalanceStatus(credits.balance);
  const userServerCredits = userCanisterMetadata 
    ? Math.floor(Number(userCanisterMetadata.cycleBalance) / 1_000_000_000_000 * 1000)
    : 0;
  const userServerStatus = CreditsService.getBalanceStatus(userServerCredits);

   useEffect(() => {
      const calculateUsd = async () => {
        if (userServerCredits > 0) {
          const conversionUtils = CreditsService.getConversionUtils();
          const usd = await conversionUtils.creditsToUsd(userServerCredits);
          setUserServerUsd(usd);
        }
      };
      calculateUsd();
    }, [userServerCredits]);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: isMobile ? '1rem' : isTablet ? '1.5rem' : '2rem',
      paddingBottom: isMobile 
        ? 'calc(120px + env(safe-area-inset-bottom, 20px))' 
        : (isTablet ? '2rem' : '2rem'),
      gap: isMobile ? '1rem' : '1.5rem',
      overflow: 'auto'
    }}>
      {/* Mobile-Optimized Header */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? '1rem' : '1.5rem'
      }}>
        <div>
          <h2 style={{
            fontSize: isMobile ? '1.5rem' : isTablet ? '1.7rem' : '1.8rem',
            fontWeight: '700',
            color: '#ffffff',
            margin: '0 0 0.5rem 0'
          }}>
            🌐 App Hosting & Publishing
          </h2>
          <p style={{
            color: 'var(--text-gray)',
            margin: 0,
            fontSize: isMobile ? '0.9rem' : '0.95rem',
            lineHeight: 1.4
          }}>
            Deploy and manage servers for <strong>{projectName}</strong>
            <br />
            <span style={{ fontSize: isMobile ? '0.8rem' : '0.85rem', opacity: 0.8 }}>
              🌐 A Sovereign Cloud Network • 🔒 Tamper Proof Architecture • 📊 Decentralized Servers
            </span>
          </p>
        </div>

        <div style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '0.75rem' : '1rem', 
          alignItems: 'stretch' 
        }}>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              padding: isMobile ? '0.875rem' : '0.75rem 1rem',
              borderRadius: '8px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              fontSize: isMobile ? '1rem' : '0.9rem',
              opacity: isLoading ? 0.6 : 1,
              minHeight: '44px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }
            }}
          >
            {isLoading ? '⏳' : '🔄'} {isRefreshingCredits && 'Refreshing...'} {!isRefreshingCredits && 'Refresh'}
          </button>

          {/* NEW: Assign Existing Servers Button */}
          <button
            onClick={() => setShowServerPairAssignmentDialog(true)}
            disabled={isLoading || !userCanisterId || !identity}
            style={{
              background: isLoading || !userCanisterId || !identity
                ? 'rgba(139, 92, 246, 0.3)'
                : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              border: 'none',
              color: '#ffffff',
              padding: isMobile ? '0.875rem 1.25rem' : '0.75rem 1.5rem',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: isLoading || !userCanisterId || !identity ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              fontSize: isMobile ? '1rem' : '0.9rem',
              opacity: isLoading || !userCanisterId || !identity ? 0.6 : 1,
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
              minHeight: '44px',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              if (!isLoading && userCanisterId && identity) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading && userCanisterId && identity) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
              }
            }}
          >
            {isLoading ? '⏳ Loading...' : 
             !userCanisterId || !identity ? '⚠️ Auth Required' :
             isMobile ? '🔗 Assign' : '🔗 Assign Existing'}
          </button>

          <button
            onClick={() => setShowCreateDialog(true)}
            disabled={isCreatingServer || !mainActor || !cloudInfrastructureReady || !!infrastructureError}
            style={{
              background: (isCreatingServer || !mainActor || !cloudInfrastructureReady || !!infrastructureError)
                ? 'rgba(255, 107, 53, 0.3)'
                : 'linear-gradient(135deg, var(--accent-orange), #f59e0b)',
              border: 'none',
              color: '#ffffff',
              padding: isMobile ? '0.875rem 1.25rem' : '0.75rem 1.5rem',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: (isCreatingServer || !mainActor || !cloudInfrastructureReady || !!infrastructureError) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              fontSize: isMobile ? '1rem' : '0.9rem',
              opacity: (isCreatingServer || !mainActor || !cloudInfrastructureReady || !!infrastructureError) ? 0.6 : 1,
              boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)',
              minHeight: '44px',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              if (!isCreatingServer && mainActor && cloudInfrastructureReady && !infrastructureError) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isCreatingServer && mainActor && cloudInfrastructureReady && !infrastructureError) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.3)';
              }
            }}
          >
            {isCreatingServer ? '⏳ Creating...' : 
             !mainActor ? '⚠️ Platform Unavailable' :
             !cloudInfrastructureReady || infrastructureError ? '🌐 Cloud Required' :
             isMobile ? '🚀 Create' : '🚀 Create Servers'}
          </button>
        </div>
      </div>

      {/* Credit Balance Display */}
      <div style={{
        background: `linear-gradient(135deg, ${balanceStatus.color}20, ${balanceStatus.color}10)`,
        border: `1px solid ${balanceStatus.color}40`,
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1rem 1.5rem',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'center',
        gap: isMobile ? '0.75rem' : '1rem'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: isMobile ? '0.8rem' : '0.85rem', 
            color: 'var(--text-gray)', 
            marginBottom: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            Available Credits 
            {isRefreshingCredits && (
              <div style={{
                width: '12px',
                height: '12px',
                border: '2px solid rgba(255, 107, 53, 0.3)',
                borderTopColor: 'var(--accent-orange)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            )}
          </div>
          <div style={{ 
            fontSize: isMobile ? '1.2rem' : '1.4rem', 
            fontWeight: '700', 
            color: balanceStatus.color,
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'baseline',
            gap: isMobile ? '0.25rem' : '0.5rem'
          }}>
            <span>💰 {CreditsService.formatCreditsDisplay(credits.balance)} Credits</span>
            {credits.usdEquivalent > 0 && (
              <span style={{ 
                fontSize: isMobile ? '0.75rem' : '0.8rem', 
                opacity: 0.8,
                fontWeight: '500'
              }}>
                (${credits.usdEquivalent.toFixed(2)} stable purchasing power)
              </span>
            )}
          </div>
        </div>
        <div style={{ 
          fontSize: isMobile ? '0.8rem' : '0.85rem', 
          color: balanceStatus.color,
          fontWeight: '500',
          textAlign: isMobile ? 'left' : 'right'
        }}>
          {balanceStatus.message}
          {(!mainActor || !cloudInfrastructureReady || infrastructureError) && (
            <div style={{ 
              color: '#ef4444', 
              fontSize: isMobile ? '0.75rem' : '0.8rem',
              marginTop: '0.25rem'
            }}>
              ⚠️ {!mainActor ? 'Platform unavailable' : 'Cloud infrastructure required'}
            </div>
          )}
        </div>
      </div>

      {/* Management Server Info */}
      <div style={{
        background: `linear-gradient(135deg, ${userServerStatus.color}15, ${userServerStatus.color}08)`,
        border: `1px solid ${userServerStatus.color}30`,
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.5rem',
        position: 'relative'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: managementServerExpanded ? '1rem' : '0'
        }}>
          <div style={{ flex: 1 }}>
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '0.5rem',
                cursor: isMobile ? 'pointer' : 'default'
              }}
              onClick={isMobile ? () => setManagementServerExpanded(!managementServerExpanded) : undefined}
            >
              <h3 style={{
                fontSize: isMobile ? '1.1rem' : '1.2rem',
                fontWeight: '600',
                color: '#ffffff',
                margin: 0
              }}>
                🏭 Management Server
              </h3>
              {isMobile && (
                <span style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-gray)',
                  transform: managementServerExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }}>
                  ▶
                </span>
              )}
            </div>
            
            <p style={{
              fontSize: isMobile ? '0.8rem' : '0.85rem',
              color: 'var(--text-gray)',
              margin: '0 0 1rem 0',
              lineHeight: 1.5,
              display: managementServerExpanded ? 'block' : 'none'
            }}>
              🏠 Your root server - all other servers come from this one • 📁 Stores all your files, preferences, and settings • ⚡ Must stay active  • 💰 Always keep topped up 
            </p>

            {managementServerExpanded && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: isMobile ? '0.75rem' : '1rem'
              }}>
                {/* Credit Balance */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  padding: isMobile ? '0.875rem' : '1rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-gray)',
                    marginBottom: '0.25rem'
                  }}>
                    Server Credits (Cloud Infrastructure)
                  </div>
                  {isLoadingMetadata ? (
                    <div style={{ fontSize: '1rem', color: 'var(--text-gray)' }}>Loading...</div>
                  ) : (
                    <div>
                      <div style={{
                        fontSize: isMobile ? '1rem' : '1.2rem',
                        fontWeight: '700',
                        color: userServerStatus.color
                      }}>
                        {CreditsService.formatCreditsDisplay(userServerCredits)} Credits
                      </div>
                      <div style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-gray)',
                        marginTop: '0.25rem'
                      }}>
                        (${userServerUsd.toFixed(2)})
                      </div>
                    </div>
                  )}
                </div>

                {/* Server ID */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  padding: isMobile ? '0.875rem' : '1rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-gray)',
                    marginBottom: '0.25rem'
                  }}>
                    Server ID
                  </div>
                  <div style={{
                    fontSize: isMobile ? '0.8rem' : '0.85rem',
                    fontFamily: 'monospace',
                    color: '#ffffff',
                    wordBreak: 'break-all'
                  }}>
                    {userCanisterId ? `${userCanisterId.substring(0, isMobile ? 12 : 15)}...` : 'Loading...'}
                  </div>
                  {userCanisterId && (
                    <button
                      onClick={() => copyToClipboard(userCanisterId, 'Management Server ID')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-orange)',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        marginTop: '0.25rem',
                        padding: 0,
                        minHeight: '24px'
                      }}
                    >
                      📋 Copy
                    </button>
                  )}
                </div>

                {/* Performance */}
                {userCanisterMetadata && !isMobile && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    padding: '1rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-gray)',
                      marginBottom: '0.25rem'
                    }}>
                      Performance
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#ffffff' }}>
                      <div>Memory: {(userCanisterMetadata.memoryUsage / 1024 / 1024).toFixed(1)} MB</div>
                      <div>Uptime: {Math.floor(userCanisterMetadata.uptime / 3600)}h</div>
                      <div>Version: {userCanisterMetadata.version}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Add Credits Button */}
          <button
            onClick={() => setShowAddCreditsDialog(true)}
            disabled={isAddingCredits || !mainActor || !cloudInfrastructureReady || !!infrastructureError}
            style={{
              background: (isAddingCredits || !mainActor || !cloudInfrastructureReady || !!infrastructureError)
                ? 'rgba(239, 68, 68, 0.3)'
                : userServerCredits < 3000
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : 'linear-gradient(135deg, var(--accent-green), #059669)',
              border: 'none',
              color: '#ffffff',
              padding: isMobile ? '0.75rem' : '0.75rem 1rem',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: isMobile ? '0.8rem' : '0.85rem',
              cursor: (isAddingCredits || !mainActor || !cloudInfrastructureReady || !!infrastructureError) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: (isAddingCredits || !mainActor || !cloudInfrastructureReady || !!infrastructureError) ? 0.6 : 1,
              flexShrink: 0,
              minHeight: '44px',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              if (!isAddingCredits && mainActor && cloudInfrastructureReady && !infrastructureError) {
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isAddingCredits && mainActor && cloudInfrastructureReady && !infrastructureError) {
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {isAddingCredits && (
              <div style={{
                width: '12px',
                height: '12px',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderTopColor: '#ffffff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            )}
            {isAddingCredits ? '⏳' :
             !mainActor ? (isMobile ? '⚠️ Unavailable' : '⚠️ Platform Unavailable') :
             !cloudInfrastructureReady || infrastructureError ? (isMobile ? '🌐 Cloud Needed' : '🌐 Cloud Required') :
             userServerCredits < 3000 ? (isMobile ? '⚠️ Add' : '⚠️ Low Credits') : 
             (isMobile ? '⚡ Add' : '⚡ Add Credits')}
          </button>
        </div>

        {/* Status indicator with cloud infrastructure integration */}
        {managementServerExpanded && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: isMobile ? '0.75rem' : '0.8rem',
            marginTop: '0.5rem'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: (!mainActor || !cloudInfrastructureReady || infrastructureError) ? '#ef4444' :
                         userServerCredits >= 6500 ? '#10b981' : 
                         userServerCredits >= 3000 ? '#f59e0b' : '#ef4444'
            }}></div>
            <span style={{
              color: (!mainActor || !cloudInfrastructureReady || infrastructureError) ? '#ef4444' :
                     userServerCredits >= 6500 ? '#10b981' : 
                     userServerCredits >= 3000 ? '#f59e0b' : '#ef4444'
            }}>
              {(!mainActor || !cloudInfrastructureReady || infrastructureError) ? 
                (isMobile ? 'Cloud infrastructure required' : 'Cloud infrastructure required - cannot provision resources') :
               userServerCredits >= 6500 ? 
                (isMobile ? 'Healthy' : 'Healthy - Ready for server creation') :
               userServerCredits >= 3000 ? 
                (isMobile ? 'Adequate' : 'Adequate - Can create shorter-duration servers using cloud infrastructure') :
                (isMobile ? 'Needs credits' : 'Critical - Needs credits for cloud infrastructure resource provisioning')}
            </span>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: isMobile ? '0.875rem' : '1rem',
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
          color: '#10b981',
          fontSize: isMobile ? '0.85rem' : '0.9rem',
          lineHeight: 1.4
        }}>
          ✅ {success}
        </div>
      )}

      {/* Cloud infrastructure requirement notice */}
      {(!mainActor || !cloudInfrastructureReady || infrastructureError) && (
        <div style={{
          background: 'rgba(255, 193, 7, 0.1)',
          border: '1px solid rgba(255, 193, 7, 0.3)',
          borderRadius: '8px',
          padding: isMobile ? '0.875rem' : '1rem',
          color: '#ffc107',
          fontSize: isMobile ? '0.85rem' : '0.9rem',
          lineHeight: 1.4,
          textAlign: 'center'
        }}>
          ⚠️ <strong>Cloud Infrastructure Required</strong><br />
          Server operations require cloud infrastructure. {!mainActor && 'Platform connection needed. '}{(!cloudInfrastructureReady || infrastructureError) && 'Waiting for cloud infrastructure service. '}Please refresh if this persists.
        </div>
      )}

      {/* NEW: Server removal progress display */}
      {removeOperationStatus && (
        <div style={{
          background: 'rgba(255, 193, 7, 0.1)',
          border: '1px solid rgba(255, 193, 7, 0.3)',
          borderRadius: '8px',
          padding: isMobile ? '0.875rem' : '1rem',
          color: '#ffc107',
          fontSize: isMobile ? '0.85rem' : '0.9rem',
          lineHeight: 1.4
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              border: '2px solid rgba(255, 193, 7, 0.3)',
              borderTopColor: '#ffc107',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <span style={{ fontWeight: '600' }}>
              🗑️ Removing Server Pair
            </span>
          </div>
          <div>
            Phase: {removeOperationStatus.phase} • {removeOperationStatus.message}
            {removeOperationStatus.timeMs > 0 && ` (${removeOperationStatus.timeMs}ms)`}
          </div>
        </div>
      )}

      {/* Server Pairs List */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: isMobile ? '1rem' : '1.5rem',
        flex: 1,
        marginBottom: isMobile ? '2rem' : '0'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: isMobile ? '1rem' : '1.5rem'
        }}>
          <h3 style={{
            fontSize: isMobile ? '1.1rem' : '1.2rem',
            fontWeight: '600',
            color: '#ffffff',
            margin: 0
          }}>
            🚀 Your Servers ({projectServerPairs.length})
          </h3>
        </div>

        {isLoading ? (
          <div style={{
            textAlign: 'center',
            padding: isMobile ? '2rem 1rem' : '3rem',
            color: 'var(--text-gray)'
          }}>
            <div style={{
              width: isMobile ? '32px' : '40px',
              height: isMobile ? '32px' : '40px',
              border: '3px solid rgba(255, 107, 53, 0.3)',
              borderTop: '3px solid var(--accent-orange)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }}></div>
            Loading your servers...
          </div>
        ) : projectServerPairs.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: isMobile ? '2rem 1rem' : '3rem',
            color: 'var(--text-gray)'
          }}>
            <div style={{ fontSize: isMobile ? '2rem' : '3rem', marginBottom: '1rem', opacity: 0.5 }}>
              🚀
            </div>
            <h4 style={{ 
              fontSize: isMobile ? '1.1rem' : '1.2rem', 
              fontWeight: '600', 
              color: '#ffffff', 
              margin: '0 0 0.5rem 0' 
            }}>
              Ready to Deploy?
            </h4>
            <p style={{ 
              margin: '0 0 1.5rem 0', 
              lineHeight: 1.6,
              fontSize: isMobile ? '0.9rem' : '1rem'
            }}>
              Create your first server pair to start hosting your project!
              {!isMobile && (
                <>
                  <br />
                  Each pair includes a frontend server for your website and a backend server for your code.
                  <br />
                  Resources are provisioned using cloud infrastructure for maximum reliability.
                </>
              )}
            </p>
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: '1rem',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <button
                onClick={() => setShowServerPairAssignmentDialog(true)}
                disabled={!userCanisterId || !identity}
                style={{
                  background: !userCanisterId || !identity
                    ? 'rgba(139, 92, 246, 0.3)'
                    : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                  border: 'none',
                  color: '#ffffff',
                  padding: isMobile ? '0.875rem 1.25rem' : '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: !userCanisterId || !identity ? 'not-allowed' : 'pointer',
                  fontSize: isMobile ? '0.9rem' : '0.9rem',
                  opacity: !userCanisterId || !identity ? 0.6 : 1,
                  minHeight: '44px',
                  whiteSpace: isMobile ? 'normal' : 'nowrap',
                  textAlign: 'center',
                  lineHeight: isMobile ? '1.3' : '1'
                }}
              >
                {!userCanisterId || !identity ? 
                  (isMobile ? '⚠️ Auth Required' : '⚠️ Authentication Required') :
                  (isMobile ? '🔗 Assign Existing' : '🔗 Assign Existing Server Pair')
                }
              </button>
              
              <span style={{ 
                color: 'var(--text-gray)', 
                fontSize: isMobile ? '0.8rem' : '0.9rem',
                margin: isMobile ? '0' : '0 0.5rem'
              }}>
                or
              </span>
              
              <button
                onClick={() => setShowCreateDialog(true)}
                disabled={userServerCredits < 3000 || !mainActor || !cloudInfrastructureReady || !!infrastructureError}
                style={{
                  background: (userServerCredits < 3000 || !mainActor || !cloudInfrastructureReady || !!infrastructureError)
                    ? 'rgba(255, 107, 53, 0.3)'
                    : 'linear-gradient(135deg, var(--accent-orange), #f59e0b)',
                  border: 'none',
                  color: '#ffffff',
                  padding: isMobile ? '0.875rem 1.25rem' : '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: (userServerCredits < 3000 || !mainActor || !cloudInfrastructureReady || !!infrastructureError) ? 'not-allowed' : 'pointer',
                  fontSize: isMobile ? '0.9rem' : '0.9rem',
                  opacity: (userServerCredits < 3000 || !mainActor || !cloudInfrastructureReady || !!infrastructureError) ? 0.6 : 1,
                  minHeight: '44px',
                  whiteSpace: isMobile ? 'normal' : 'nowrap',
                  textAlign: 'center',
                  lineHeight: isMobile ? '1.3' : '1'
                }}
              >
                {!mainActor ? 
                  (isMobile ? '⚠️ Platform Required' : '⚠️ Platform Required') :
                 !cloudInfrastructureReady || infrastructureError ? 
                  (isMobile ? '🌐 Cloud Required' : '🌐 Cloud Infrastructure Required') :
                 userServerCredits < 3000 ? 
                  (isMobile ? '⚠️ Add Credits First' : '⚠️ Add Credits to Management Server First') : 
                  (isMobile ? '🚀 Create New' : '🚀 Create New Server Pair')
                }
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(auto-fill, minmax(320px, 1fr))' : 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: isMobile ? '1rem' : '1.5rem'
          }}>
            {projectServerPairs.map((serverPair) => {
              const frontendUrls = generateCanisterUrls(serverPair.frontendCanisterId, isLocal);
              const backendUrls = generateCanisterUrls(serverPair.backendCanisterId, isLocal);
              
              return (
                <div
                  key={serverPair.pairId}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    padding: isMobile ? '1rem' : '1.5rem',
                    transition: 'all 0.2s ease',
                    opacity: isRemovingServerPair ? 0.7 : 1,
                    pointerEvents: isRemovingServerPair ? 'none' : 'auto'
                  }}
                  onMouseEnter={(e) => {
                    if (!isMobile && !isRemovingServerPair) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.3)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isMobile && !isRemovingServerPair) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {/* Server Pair Header - Improved Layout */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    marginBottom: '1rem'
                  }}>
                    {/* Top row: Name and Remove button */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '0.75rem'
                    }}>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <h4 style={{
                          fontSize: isMobile ? '1rem' : '1.1rem',
                          fontWeight: '600',
                          color: '#ffffff',
                          margin: '0',
                          lineHeight: '1.3',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          overflow: 'hidden'
                        }}>
                          <span style={{ flexShrink: 0 }}>🚀</span>
                          <span style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            minWidth: 0
                          }}>
                            {serverPair.name}
                          </span>
                          {getProjectServerPair(projectId) === serverPair.pairId && (
                            <span style={{
                              fontSize: '0.7rem',
                              color: '#10b981',
                              fontWeight: '500',
                              flexShrink: 0
                            }}>
                              ✓ Default
                            </span>
                          )}
                        </h4>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        {getProjectServerPair(projectId) !== serverPair.pairId && (
                          <button
                            onClick={() => handleSetAsDefault(serverPair)}
                            disabled={isRemovingServerPair}
                            style={{
                              background: 'rgba(16, 185, 129, 0.2)',
                              color: '#10b981',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '6px',
                              fontSize: '0.65rem',
                              fontWeight: '500',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              cursor: isRemovingServerPair ? 'not-allowed' : 'pointer',
                              opacity: isRemovingServerPair ? 0.6 : 1,
                              transition: 'all 0.2s ease',
                              minHeight: '28px'
                            }}
                            onMouseEnter={(e) => {
                              if (!isRemovingServerPair) {
                                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.3)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isRemovingServerPair) {
                                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)';
                              }
                            }}
                            title="Set as default server pair for this project"
                          >
                            ⭐ Set Default
                          </button>
                        )}
                        <button
                          onClick={() => removeServerPairFromProject(serverPair.pairId, serverPair.name)}
                          disabled={isRemovingServerPair}
                          style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.65rem',
                            fontWeight: '500',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            cursor: isRemovingServerPair ? 'not-allowed' : 'pointer',
                            flexShrink: 0,
                            opacity: isRemovingServerPair ? 0.6 : 1,
                            transition: 'all 0.2s ease',
                            minHeight: '28px'
                          }}
                          onMouseEnter={(e) => {
                            if (!isRemovingServerPair) {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isRemovingServerPair) {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                            }
                          }}
                        >
                          🗑️ Remove
                        </button>
                      </div>
                    </div>
                    
                    {/* Bottom row: Meta info and Credits badge */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-gray)',
                        flex: 1
                      }}>
                        Created {new Date(serverPair.createdAt).toLocaleDateString()} • Cloud Infrastructure
                      </div>
                      <div style={{
                        background: 'rgba(16, 185, 129, 0.2)',
                        color: '#10b981',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: '600',
                        flexShrink: 0,
                        whiteSpace: 'nowrap'
                      }}>
                        {serverPair.creditsAllocated} Credits
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Frontend Server */}
                    <div style={{
                      background: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '8px',
                      padding: isMobile ? '0.75rem' : '0.875rem'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '0.5rem'
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontSize: isMobile ? '0.8rem' : '0.85rem', 
                            fontWeight: '600', 
                            color: '#8b5cf6',
                            marginBottom: '0.25rem'
                          }}>
                            🌐 Frontend Server
                          </div>
                          <div style={{ 
                            fontSize: '0.7rem', 
                            color: 'var(--text-gray)', 
                            fontFamily: 'monospace',
                            wordBreak: 'break-all',
                            marginBottom: '0.25rem'
                          }}>
                            {serverPair.frontendCanisterId}
                          </div>
                        </div>
                        <button
                          onClick={() => handleServerClick(serverPair, 'frontend')}
                          disabled={isRemovingServerPair}
                          style={{
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#10b981',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '8px',
                            fontSize: '0.65rem',
                            fontWeight: '500',
                            border: 'none',
                            cursor: isRemovingServerPair ? 'not-allowed' : 'pointer',
                            flexShrink: 0,
                            minHeight: '32px',
                            opacity: isRemovingServerPair ? 0.6 : 1
                          }}
                        >
                          Manage
                        </button>
                      </div>
                      
                      <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap'
                      }}>
                        <button
                          onClick={() => copyToClipboard(serverPair.frontendCanisterId, 'Frontend Server ID')}
                          disabled={isRemovingServerPair}
                          style={{
                            background: 'none',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            color: '#8b5cf6',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            cursor: isRemovingServerPair ? 'not-allowed' : 'pointer',
                            minHeight: '28px',
                            opacity: isRemovingServerPair ? 0.6 : 1
                          }}
                        >
                          📋 Copy ID
                        </button>
                        <button
                          onClick={() => openUrl(frontendUrls.siteUrl)}
                          disabled={isRemovingServerPair}
                          style={{
                            background: 'none',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            color: '#8b5cf6',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            cursor: isRemovingServerPair ? 'not-allowed' : 'pointer',
                            minHeight: '28px',
                            opacity: isRemovingServerPair ? 0.6 : 1
                          }}
                        >
                          🌐 Site
                        </button>
                        <button
                          onClick={() => openUrl(frontendUrls.candidUrl)}
                          disabled={isRemovingServerPair}
                          style={{
                            background: 'none',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            color: '#8b5cf6',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            cursor: isRemovingServerPair ? 'not-allowed' : 'pointer',
                            minHeight: '28px',
                            opacity: isRemovingServerPair ? 0.6 : 1
                          }}
                        >
                          🔧 Candid
                        </button>
                      </div>
                    </div>

                    {/* Backend Server */}
                    <div style={{
                      background: 'rgba(255, 107, 53, 0.1)',
                      border: '1px solid rgba(255, 107, 53, 0.3)',
                      borderRadius: '8px',
                      padding: isMobile ? '0.75rem' : '0.875rem'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '0.5rem'
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontSize: isMobile ? '0.8rem' : '0.85rem', 
                            fontWeight: '600', 
                            color: '#ff6b35',
                            marginBottom: '0.25rem'
                          }}>
                            ⚙️ Backend Server
                          </div>
                          <div style={{ 
                            fontSize: '0.7rem', 
                            color: 'var(--text-gray)', 
                            fontFamily: 'monospace',
                            wordBreak: 'break-all',
                            marginBottom: '0.25rem'
                          }}>
                            {serverPair.backendCanisterId}
                          </div>
                        </div>
                        <button
                          onClick={() => handleServerClick(serverPair, 'backend')}
                          disabled={isRemovingServerPair}
                          style={{
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#10b981',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '8px',
                            fontSize: '0.65rem',
                            fontWeight: '500',
                            border: 'none',
                            cursor: isRemovingServerPair ? 'not-allowed' : 'pointer',
                            flexShrink: 0,
                            minHeight: '32px',
                            opacity: isRemovingServerPair ? 0.6 : 1
                          }}
                        >
                          Manage
                        </button>
                      </div>
                      
                      <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap'
                      }}>
                        <button
                          onClick={() => copyToClipboard(serverPair.backendCanisterId, 'Backend Server ID')}
                          disabled={isRemovingServerPair}
                          style={{
                            background: 'none',
                            border: '1px solid rgba(255, 107, 53, 0.3)',
                            color: '#ff6b35',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            cursor: isRemovingServerPair ? 'not-allowed' : 'pointer',
                            minHeight: '28px',
                            opacity: isRemovingServerPair ? 0.6 : 1
                          }}
                        >
                          📋 Copy ID
                        </button>
                        <button
                          onClick={() => openUrl(backendUrls.candidUrl)}
                          disabled={isRemovingServerPair}
                          style={{
                            background: 'none',
                            border: '1px solid rgba(255, 107, 53, 0.3)',
                            color: '#ff6b35',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            cursor: isRemovingServerPair ? 'not-allowed' : 'pointer',
                            minHeight: '28px',
                            opacity: isRemovingServerPair ? 0.6 : 1
                          }}
                        >
                          🔧 Candid
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Server Dialog */}
      {showCreateDialog && (
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
          zIndex: 1000,
          padding: isMobile ? '0' : '2rem'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a1a, #2a2a2a)',
            borderRadius: isMobile ? '16px 16px 0 0' : '16px',
            border: '1px solid rgba(255, 107, 53, 0.3)',
            padding: isMobile ? '1.5rem' : '2rem',
            maxWidth: isMobile ? '100%' : '600px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            maxHeight: isMobile ? '90vh' : '90vh',
            overflowY: 'auto',
            ...(isMobile && {
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderBottom: 'none'
            })
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{
                fontSize: isMobile ? '1.2rem' : '1.4rem',
                fontWeight: '700',
                color: '#ffffff',
                margin: 0
              }}>
                🚀 Create New Servers
              </h3>
              <button
                onClick={() => setShowCreateDialog(false)}
                disabled={isCreatingServer}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  fontSize: '1.5rem',
                  cursor: isCreatingServer ? 'not-allowed' : 'pointer',
                  padding: '0.5rem',
                  minHeight: '44px',
                  minWidth: '44px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Cloud infrastructure information */}
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              padding: isMobile ? '0.875rem' : '1rem',
              marginBottom: '1.5rem',
              fontSize: isMobile ? '0.8rem' : '0.85rem',
              color: '#10b981',
              lineHeight: 1.5
            }}>
              ✨ <strong>What you'll get:</strong> A frontend server for your website and a backend server for your code, both funded using cloud infrastructure and ready to deploy your project!
              <br />
              🌐 <strong>Cloud Infrastructure:</strong> Professional-grade hosting infrastructure handles all the technical complexity behind the scenes.
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '0.85rem' : '0.9rem',
                color: 'var(--text-gray)',
                marginBottom: '0.5rem'
              }}>
                Server Name
              </label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="Enter server name (e.g., Production, Staging)"
                style={{
                  width: '100%',
                  padding: isMobile ? '0.875rem' : '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#ffffff',
                  fontSize: isMobile ? '1rem' : '0.9rem',
                  minHeight: '44px'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '0.85rem' : '0.9rem',
                color: 'var(--text-gray)',
                marginBottom: '0.5rem'
              }}>
                Credits to Allocate (Cloud Infrastructure Calculated)
              </label>
              <input
                type="number"
                value={creditsToAllocateInput}
                onChange={(e) => handleCreditsToAllocateChange(e.target.value)}
                onBlur={handleCreditsToAllocateBlur}
                min="2500"
                max={credits.balance}
                step="100"
                placeholder="Enter credits amount"
                style={{
                  width: '100%',
                  padding: isMobile ? '0.875rem' : '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#ffffff',
                  fontSize: isMobile ? '1rem' : '0.9rem',
                  minHeight: '44px'
                }}
              />
              <div style={{ 
                fontSize: isMobile ? '0.7rem' : '0.75rem', 
                color: 'var(--text-gray)', 
                marginTop: '0.5rem',
                lineHeight: 1.4
              }}>
                Available: {CreditsService.formatCreditsDisplay(credits.balance)} credits • Minimum: 1,000 credits • Includes ALL creation overhead
              </div>
            </div>

            {/* Server Configuration Display */}
            {serverConfig && (
              <div style={{
                background: serverConfig.canCreateServers 
                  ? 'rgba(16, 185, 129, 0.1)' 
                  : 'rgba(239, 68, 68, 0.1)',
                border: serverConfig.canCreateServers 
                  ? '1px solid rgba(16, 185, 129, 0.3)' 
                  : '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: isMobile ? '0.875rem' : '1rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  fontSize: isMobile ? '0.85rem' : '0.9rem',
                  fontWeight: '600',
                  color: serverConfig.canCreateServers ? '#10b981' : '#ef4444',
                  marginBottom: '0.5rem'
                }}>
                  {serverConfig.canCreateServers ? '✅ Ready to Create Using Cloud Infrastructure' : '❌ Configuration Invalid'}
                </div>
                <div style={{
                  fontSize: isMobile ? '0.8rem' : '0.85rem',
                  color: serverConfig.canCreateServers ? '#10b981' : '#ef4444',
                  marginBottom: '0.75rem',
                  lineHeight: 1.4
                }}>
                  {serverConfig.message}
                </div>
                {serverConfig.canCreateServers && (
                  <div style={{
                    fontSize: isMobile ? '0.75rem' : '0.8rem',
                    color: 'var(--text-gray)',
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                    gap: '0.5rem',
                    lineHeight: 1.3
                  }}>
                    <div>Memory: {serverConfig.memoryGB}GB per server (min enforced)</div>
                    <div>Duration: {serverConfig.durationDays} days</div>
                    <div>Per Server: {serverConfig.perServerCredits} credits (all overhead included)</div>
                    <div>Total Cost: {resourcesToCredits(serverConfig.totalResourcesNeeded)} credits</div>
                    <div style={{ gridColumn: isMobile ? '1' : '1 / -1', color: '#10b981', fontSize: '0.75rem' }}>
                      🌐 Resources provided using cloud infrastructure
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cloud infrastructure unavailable warning */}
            {(!mainActor || !cloudInfrastructureReady || infrastructureError) && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: isMobile ? '0.875rem' : '1rem',
                marginBottom: '1.5rem',
                color: '#ef4444',
                fontSize: isMobile ? '0.8rem' : '0.85rem',
                lineHeight: 1.4,
                textAlign: 'center'
              }}>
                ⚠️ <strong>Cloud Infrastructure Required</strong><br />
                Cannot create servers without cloud infrastructure. {!mainActor && 'Platform connection needed. '}{(!cloudInfrastructureReady || infrastructureError) && 'Waiting for cloud infrastructure service. '}Please refresh if this persists.
              </div>
            )}

            {/* Hosting Progress Display */}
            {isCreatingServer && hostingStatus && (
              <div style={{
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '8px',
                padding: isMobile ? '0.875rem' : '1rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  fontSize: isMobile ? '0.85rem' : '0.9rem',
                  fontWeight: '600',
                  color: '#8b5cf6',
                  marginBottom: '0.5rem'
                }}>
                  🌐 Setting up hosting using cloud infrastructure
                </div>
                <div style={{
                  fontSize: isMobile ? '0.8rem' : '0.85rem',
                  color: '#8b5cf6',
                  marginBottom: '0.75rem',
                  lineHeight: 1.4
                }}>
                  {hostingStatus}
                </div>
                {hostingProgress > 0 && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    height: '6px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
                      height: '100%',
                      width: `${hostingProgress}%`,
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                )}
              </div>
            )}

            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? '0.75rem' : '1rem'
            }}>
              <button
                onClick={() => setShowCreateDialog(false)}
                disabled={isCreatingServer}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  padding: isMobile ? '0.875rem' : '0.75rem',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: isCreatingServer ? 'not-allowed' : 'pointer',
                  opacity: isCreatingServer ? 0.6 : 1,
                  minHeight: '44px',
                  fontSize: isMobile ? '1rem' : '0.9rem'
                }}
              >
                Cancel
              </button>
              <button
                onClick={createServerPair}
                disabled={isCreatingServer || !serverName.trim() || !serverConfig?.canCreateServers || creditsToAllocate > credits.balance || creditsToAllocate < 2500 || !mainActor || !cloudInfrastructureReady || !!infrastructureError}
                style={{
                  flex: 1,
                  background: (isCreatingServer || !serverName.trim() || !serverConfig?.canCreateServers || creditsToAllocate > credits.balance || creditsToAllocate < 2500 || !mainActor || !cloudInfrastructureReady || !!infrastructureError)
                    ? 'rgba(255, 107, 53, 0.3)'
                    : 'linear-gradient(135deg, var(--accent-orange), #f59e0b)',
                  border: 'none',
                  color: '#ffffff',
                  padding: isMobile ? '0.875rem' : '0.75rem',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: (isCreatingServer || !serverName.trim() || !serverConfig?.canCreateServers || creditsToAllocate > credits.balance || creditsToAllocate < 2500 || !mainActor || !cloudInfrastructureReady || !!infrastructureError) ? 'not-allowed' : 'pointer',
                  opacity: (isCreatingServer || !serverName.trim() || !serverConfig?.canCreateServers || creditsToAllocate > credits.balance || creditsToAllocate < 2500 || !mainActor || !cloudInfrastructureReady || !!infrastructureError) ? 0.6 : 1,
                  minHeight: '44px',
                  fontSize: isMobile ? '1rem' : '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                {isCreatingServer && (
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                )}
                {isCreatingServer ? '⏳ Creating with Cloud Infrastructure...' : 
                 !mainActor ? '⚠️ Platform Required' :
                 !cloudInfrastructureReady || infrastructureError ? '🌐 Cloud Required' :
                 '🚀 Create Servers'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Credits Dialog */}
      {showAddCreditsDialog && (
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
          zIndex: 1000,
          padding: isMobile ? '0' : '2rem'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a1a, #2a2a2a)',
            borderRadius: isMobile ? '16px 16px 0 0' : '16px',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            padding: isMobile ? '1.5rem' : '2rem',
            maxWidth: isMobile ? '100%' : '500px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            ...(isMobile && {
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderBottom: 'none'
            })
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{
                fontSize: isMobile ? '1.2rem' : '1.4rem',
                fontWeight: '700',
                color: '#ffffff',
                margin: 0
              }}>
                ⚡ Add Credits to Management Server
              </h3>
              <button
                onClick={() => setShowAddCreditsDialog(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  minHeight: '44px',
                  minWidth: '44px'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              padding: isMobile ? '0.875rem' : '1rem',
              marginBottom: '1.5rem',
              fontSize: isMobile ? '0.85rem' : '0.9rem',
              color: '#10b981',
              lineHeight: 1.5
            }}>
              💡 Your management server needs credits to create and manage your project servers.
              <br />
              🌐 Resources will be provisioned using cloud infrastructure - professional-grade hosting with maximum reliability!
            </div>

            {/* Cloud infrastructure unavailable warning */}
            {(!mainActor || !cloudInfrastructureReady || infrastructureError) && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: isMobile ? '0.875rem' : '1rem',
                marginBottom: '1.5rem',
                color: '#ef4444',
                fontSize: isMobile ? '0.8rem' : '0.85rem',
                lineHeight: 1.4,
                textAlign: 'center'
              }}>
                ⚠️ <strong>Cloud Infrastructure Required</strong><br />
                Cannot add credits without cloud infrastructure. {!mainActor && 'Platform connection needed. '}{(!cloudInfrastructureReady || infrastructureError) && 'Waiting for cloud infrastructure service. '}Please refresh if this persists.
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '0.85rem' : '0.9rem',
                color: 'var(--text-gray)',
                marginBottom: '0.5rem'
              }}>
                Credits to Add (Cloud Infrastructure Calculated)
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
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#ffffff',
                  fontSize: isMobile ? '1rem' : '0.9rem',
                  minHeight: '44px'
                }}
              />
              <div style={{ 
                fontSize: isMobile ? '0.7rem' : '0.75rem', 
                color: 'var(--text-gray)', 
                marginTop: '0.5rem',
                lineHeight: 1.4
              }}>
                Available: {CreditsService.formatCreditsDisplay(credits.balance)} credits •{' '}
                Server will have: {CreditsService.formatCreditsDisplay(userServerCredits + creditsToAdd)} credits
                <br />
                <span style={{ color: '#10b981' }}>🌐 Resources provisioned using cloud infrastructure</span>
              </div>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? '0.75rem' : '1rem'
            }}>
              <button
                onClick={() => setShowAddCreditsDialog(false)}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  padding: isMobile ? '0.875rem' : '0.75rem',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  minHeight: '44px',
                  fontSize: isMobile ? '1rem' : '0.9rem'
                }}
              >
                Cancel
              </button>
              <button
                onClick={addCreditsToManagementServer}
                disabled={isAddingCredits || creditsToAdd > credits.balance || creditsToAdd < 100 || !mainActor || !cloudInfrastructureReady || !!infrastructureError}
                style={{
                  flex: 1,
                  background: (isAddingCredits || creditsToAdd > credits.balance || creditsToAdd < 100 || !mainActor || !cloudInfrastructureReady || !!infrastructureError)
                    ? 'rgba(16, 185, 129, 0.3)'
                    : 'linear-gradient(135deg, var(--accent-green), #059669)',
                  border: 'none',
                  color: '#ffffff',
                  padding: isMobile ? '0.875rem' : '0.75rem',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: (isAddingCredits || creditsToAdd > credits.balance || creditsToAdd < 100 || !mainActor || !cloudInfrastructureReady || !!infrastructureError) ? 'not-allowed' : 'pointer',
                  opacity: (isAddingCredits || creditsToAdd > credits.balance || creditsToAdd < 100 || !mainActor || !cloudInfrastructureReady || !!infrastructureError) ? 0.6 : 1,
                  minHeight: '44px',
                  fontSize: isMobile ? '1rem' : '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                {isAddingCredits && (
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                )}
                {isAddingCredits ? '⏳ Adding with Cloud Infrastructure...' : 
                 !mainActor ? '⚠️ Platform Required' :
                 !cloudInfrastructureReady || infrastructureError ? '🌐 Cloud Required' :
                 '⚡ Add Credits'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Server Pair Assignment Dialog */}
      {showServerPairAssignmentDialog && (
        <ServerPairAssignmentDialog
          projectId={projectId}
          projectName={projectName}
          userCanisterId={userCanisterId}
          identity={identity}
          onClose={() => setShowServerPairAssignmentDialog(false)}
          onAssignmentComplete={handleAssignmentComplete}
        />
      )}

      {/* Server Management Dialog */}
      {selectedServer && (
        <ServerManagementDialog
          server={selectedServer.server}
          pairId={selectedServer.pairId}
          onClose={() => setSelectedServer(null)}
          onRefresh={handleRefreshServers}
          userCanisterId={userCanisterId}
          identity={identity}
          principal={principal}
          availableCredits={credits.balance}
          projectId={projectId}
          projectName={projectName}
        />
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};