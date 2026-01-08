import React, { useState, useEffect } from 'react';
import { useServerPairDialog, useCredits, useAuth, useInitialization } from '../store/appStore';
import { X, Plus, Link, ArrowRight, Zap, Server, Database, AlertTriangle, CheckCircle, RefreshCw, Globe, Download, Settings } from 'lucide-react';
import { userCanisterService } from '../services/UserCanisterService';
import { CreditsService } from '../services/CreditsService';
import { icpPriceService, IcpPriceData } from '../services/IcpPriceService';
import { getIcpXdrConversionRate, icpToCycles } from '../utils/icpUtils';
import { useCanister } from '../useCanister';
import { Principal } from '@dfinity/principal';
import { Actor, Identity } from '@dfinity/agent';
import { createAgent } from '@dfinity/utils';

interface ServerPairSelectionDialogProps {
  // Props can be added if needed for additional customization
}

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

// 🔥 FIX: Use getter function to prevent initialization error
// CMC Principal ID for payment processing - lazy initialized to avoid "Cannot access before initialization"
const getCMCCanisterId = () => Principal.fromText("rkp4c-7iaaa-aaaaa-aaaca-cai");

// Helper to get the ICP network host
const getICPHost = () => {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:4943'
    : 'https://icp0.io';
};

// Cycles Minting Canister interface
interface CyclesMintingCanister {
  notify_top_up: (args: {
    block_index: bigint;
    canister_id: Principal;
  }) => Promise<null>;
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

// COMPLETELY NEW: Calculate ICP conversion using REAL market prices from CryptoCompare
async function calculateIcpConversion(usdAmount: number): Promise<{
  icpE8s: bigint;
  icpTokens: number;
  estimatedCycles: bigint;
  conversionMethod: string;
  realIcpPrice: number;
  icpCyclesRate: number;
  priceSource: string;
  priceAge: number;
}> {
  console.log('⚡ [IcpConversion] Starting REAL ICP market price conversion calculation...');
  
  try {
    // Get REAL ICP price from CryptoCompare - NO FAKE PRICES ALLOWED
    const priceData: IcpPriceData = await icpPriceService.getCurrentPrice();
    const realIcpPrice = priceData.price;
    
    console.log(`📈 [IcpConversion] REAL ICP market price: $${realIcpPrice.toFixed(4)} (${Math.round(priceData.cacheAge / 1000)}s old)`);
    
    // Calculate ICP tokens needed using REAL market price
    // 🔥 FIX: Use Math.ceil to ensure platform wallet receives enough ICP to cover all costs
    // Rounding down causes losses when the platform wallet needs to provision resources
    const icpTokens = usdAmount / realIcpPrice;
    const icpE8s = BigInt(Math.ceil(icpTokens * 100_000_000)); // Convert to e8s (round UP to ensure enough)
    
    console.log(`💰 [IcpConversion] Real price calculation: $${usdAmount.toFixed(4)} ÷ $${realIcpPrice.toFixed(4)} = ${icpTokens.toFixed(6)} ICP`);
    
    // Get real cycles conversion from XDR system
    const cyclesPerIcp = await getIcpXdrConversionRate();
    const icpCyclesRate = Number(cyclesPerIcp) / 1_000_000_000_000; // Convert to T cycles
    
    // Calculate expected cycles using real conversion rates
    const conversionResult = await icpToCycles(icpE8s);
    const estimatedCycles = conversionResult.cycles;
    
    console.log(`⚡ [IcpConversion] Real ICP-to-cycles conversion: ${icpTokens.toFixed(6)} ICP × ${icpCyclesRate.toFixed(2)}T = ${Number(estimatedCycles)/1_000_000_000_000}T cycles`);
    console.log(`✅ [IcpConversion] NO FAKE PRICES - All calculations use real market data`);
    
    return {
      icpE8s,
      icpTokens,
      estimatedCycles,
      conversionMethod: 'Real CryptoCompare market price + XDR cycles conversion',
      realIcpPrice,
      icpCyclesRate: conversionResult.rate,
      priceSource: priceData.source,
      priceAge: priceData.cacheAge
    };
    
  } catch (error) {
    console.error('❌ [IcpConversion] REAL ICP price conversion failed:', error);
    
    // CRITICAL: NO FAKE FALLBACK PRICES - Fail explicitly
    throw new Error(`Cannot proceed without real ICP pricing: ${error instanceof Error ? error.message : 'Unknown pricing error'}`);
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

// ENHANCED: Get phase-specific icon for progress display
const getPhaseIcon = (phase: string) => {
  switch (phase) {
    case 'setup': return '⚙️';
    case 'hosting': return '🌐';
    case 'complete': return '🎉';
    case 'error': return '❌';
    default: return '🚀';
  }
};

// ENHANCED: Get phase-specific color for progress display
const getPhaseColor = (phase: string) => {
  switch (phase) {
    case 'setup': return '#3b82f6';
    case 'hosting': return '#8b5cf6';
    case 'complete': return '#10b981';
    case 'error': return '#ef4444';
    default: return '#f59e0b';
  }
};

const ServerPairSelectionDialog: React.FC<ServerPairSelectionDialogProps> = () => {
  // Authentication and initialization state
  const { isAuthenticated, identity } = useAuth();
  const { stage, isReady, userCanisterId } = useInitialization();

  const {
    serverPairDialog,
    closeServerPairSelectionDialog,
    setServerPairDialogOption,
    setSelectedServerPairId,
    setNewServerPairName,
    setCreditsToAllocate,
    createServerPairAndProject,
    assignServerPairAndProject,
    createProjectWithoutServerPair,
    calculateServerConfigFromCredits,
    getMinimumCreditsRequired,
    loadAllUserServerPairs, // Direct access to data loading function
  } = useServerPairDialog();

  const { credits } = useCredits();

  // Access main actor for platform wallet operations
  const { actor: mainActor } = useCanister();

  const [isMobile, setIsMobile] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [serverConfig, setServerConfig] = useState<any>(null);

  // ENHANCED: Flexible credits input state
  const [creditsInputValue, setCreditsInputValue] = useState<string>('');

  // OPTION 1: Local loading flag to provide immediate feedback
  const [isTriggeredLoading, setIsTriggeredLoading] = useState(false);

  // ICP pricing service state
  const [icpPriceData, setIcpPriceData] = useState<IcpPriceData | null>(null);
  const [icpPriceError, setIcpPriceError] = useState<string | null>(null);
  const [isIcpPriceLoading, setIsIcpPriceLoading] = useState(true);

  // Initialize credits input value with current allocation
  useEffect(() => {
    setCreditsInputValue(serverPairDialog.creditsToAllocate.toString());
  }, [serverPairDialog.creditsToAllocate]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // OPTION 1: Reset local loading flag when store state updates
  useEffect(() => {
    if (serverPairDialog.allServerPairs.length > 0 || serverPairDialog.serverPairsError) {
      setIsTriggeredLoading(false);
    }
  }, [serverPairDialog.allServerPairs.length, serverPairDialog.serverPairsError]);

  // Initialize ICP price service in background (non-blocking)
  useEffect(() => {
    const initializeIcpPricing = async () => {
      setIsIcpPriceLoading(true);
      setIcpPriceError(null);
      
      try {
        console.log('📈 [ServerPairDialog] Initializing real ICP price service...');
        const priceData = await icpPriceService.getCurrentPrice();
        setIcpPriceData(priceData);
        console.log(`✅ [ServerPairDialog] ICP price service ready: $${priceData.price.toFixed(4)}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'ICP pricing service unavailable';
        setIcpPriceError(errorMessage);
        console.error('❌ [ServerPairDialog] ICP price initialization failed:', error);
      } finally {
        setIsIcpPriceLoading(false);
      }
    };

    initializeIcpPricing();

    // Set up periodic price refresh every 3 minutes
    const priceRefreshInterval = setInterval(async () => {
      try {
        const priceData = await icpPriceService.getCurrentPrice();
        setIcpPriceData(priceData);
        setIcpPriceError(null);
      } catch (error) {
        console.warn('⚠️ [ServerPairDialog] Price refresh failed:', error);
        // Don't set error state for refresh failures, keep using cached data
      }
    }, 180000); // 3 minutes

    return () => clearInterval(priceRefreshInterval);
  }, []);

  // Calculate server configuration when credits change - using real ICP pricing
  useEffect(() => {
    if (serverPairDialog.selectedOption === 'create') {
      const config = calculateOptimalServerConfig(serverPairDialog.creditsToAllocate);
      setServerConfig(config);
    }
  }, [serverPairDialog.creditsToAllocate, serverPairDialog.selectedOption]);

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

  // Validation now supports reassignment and real ICP pricing
  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (serverPairDialog.selectedOption === 'create') {
      // Name validation
      if (!serverPairDialog.newServerPairName.trim()) {
        errors.name = 'Server pair name is required';
      } else if (serverPairDialog.newServerPairName.trim().length < 3) {
        errors.name = 'Server pair name must be at least 3 characters';
      } else if (!/^[a-zA-Z0-9\s_-]+$/.test(serverPairDialog.newServerPairName.trim())) {
        errors.name = 'Server pair name can only contain letters, numbers, spaces, hyphens, and underscores';
      }

      // Credits validation
      const minCredits = getMinimumCreditsRequired();
      if (serverPairDialog.creditsToAllocate < minCredits) {
        errors.credits = `Minimum ${minCredits.toLocaleString()} credits required for server pair creation`;
      } else if (serverPairDialog.creditsToAllocate > credits.balance) {
        errors.credits = `Insufficient credits. You have ${credits.balance.toLocaleString()} available`;
      } else if (serverPairDialog.creditsToAllocate > 50000) {
        errors.credits = 'Maximum 50,000 credits allowed per server pair';
      }

      // Server configuration validation
      if (serverConfig && !serverConfig.canCreateServers) {
        errors.config = serverConfig.message;
      }

      // Platform wallet validation
      if (!mainActor) {
        errors.platform = 'Platform wallet connection required';
      }
    }

    if (serverPairDialog.selectedOption === 'assign') {
      if (!serverPairDialog.selectedServerPairId) {
        errors.selection = 'Please select a server pair to assign';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // OPTION 1: Enhanced option selection with immediate loading feedback
  const handleOptionSelect = (option: 'create' | 'assign' | 'skip') => {
    setServerPairDialogOption(option);
    setValidationErrors({});
    
    // Reset server config when changing options
    if (option !== 'create') {
      setServerConfig(null);
    }
    
    // OPTION 1: Load server pairs only if not already loaded or loading
    // The dialog now pre-loads in background, so this should rarely be needed
    if (option === 'assign' && serverPairDialog.allServerPairs.length === 0 && !serverPairDialog.isLoadingServerPairs) {
      console.log('🚀 [ServerPairDialog] User selected assign option, loading server pairs (pre-load may have been in progress)...');
      
      // Set local loading flag IMMEDIATELY for instant UI feedback
      setIsTriggeredLoading(true);
      
      // Then trigger the store action (which will eventually update the store's loading state)
      loadAllUserServerPairs();
    }
  };

  // ENHANCED: Flexible credits input handler - allows any input
  const handleCreditsInputChange = (value: string) => {
    // Allow any input, including empty string and non-numeric
    setCreditsInputValue(value);
    
    // Try to parse as number for internal state
    const numericValue = parseInt(value) || 0;
    
    // Update the store value, but don't clamp here
    setCreditsToAllocate(numericValue);
  };

  // ENHANCED: Handle credits slider change (separate from text input)
  const handleCreditsSliderChange = (value: number) => {
    const clampedValue = Math.max(100, Math.min(value, credits.balance));
    setCreditsToAllocate(clampedValue);
    setCreditsInputValue(clampedValue.toString());
  };

  // ENHANCED: Get credits validation info without blocking input
  const getCreditsValidationInfo = () => {
    const numericValue = parseInt(creditsInputValue) || 0;
    const minCredits = getMinimumCreditsRequired();
    
    if (!creditsInputValue.trim()) {
      return { type: 'warning', message: 'Credits amount is required' };
    }
    
    if (isNaN(numericValue) || numericValue <= 0) {
      return { type: 'error', message: 'Please enter a valid positive number' };
    }
    
    if (numericValue < minCredits) {
      return { type: 'warning', message: `Minimum ${minCredits.toLocaleString()} credits recommended for reliable server creation` };
    }
    
    if (numericValue > credits.balance) {
      return { type: 'error', message: `Insufficient credits. You have ${credits.balance.toLocaleString()} available` };
    }
    
    if (numericValue > 50000) {
      return { type: 'warning', message: 'Very high allocation. Consider using fewer credits for testing first' };
    }
    
    return { type: 'success', message: `✅ Valid allocation of ${numericValue.toLocaleString()} credits` };
  };

  // FIXED: Simplified server pair selection - no intermediate confirmation
  const handleServerPairSelection = (pairId: string) => {
    setSelectedServerPairId(pairId);
  };

  // ENHANCED: Handle form submission with real progress tracking from slice
  const handleSubmit = async () => {
    if (!validateForm()) return;

    console.log('🔵 Submit button clicked, starting operation:', serverPairDialog.selectedOption);

    try {
      let success = false;

      switch (serverPairDialog.selectedOption) {
        case 'create':
          console.log('🚀 Starting createServerPairAndProject with real ICP pricing and integrated progress tracking...');
          
          // CRITICAL: Ensure ICP pricing is available before server creation
          if (!icpPriceData || icpPriceError) {
            throw new Error('Cannot create servers: Real-time ICP pricing is required but currently unavailable');
          }

          if (!mainActor) {
            throw new Error('Platform wallet connection required for server creation');
          }

          // Call the enhanced creation method - progress tracking is integrated via slice state
          success = await createServerPairAndProject(mainActor, icpPriceData);
          
          break;
        case 'assign':
          console.log('🔗 Starting assignServerPairAndProject...');
          success = await assignServerPairAndProject();
          break;
        case 'skip':
          console.log('⏭️ Starting createProjectWithoutServerPair...');
          success = await createProjectWithoutServerPair();
          break;
      }

      console.log('✅ Operation completed, success:', success);

      if (success) {
        console.log('✅ Server pair dialog: Project creation completed successfully');
        // Dialog will be closed automatically by the action
      }
    } catch (error) {
      console.error('❌ Server pair dialog: Project creation failed:', error);
    }
  };

  // Get credits status color
  const getCreditsStatusColor = () => {
    const validationInfo = getCreditsValidationInfo();
    if (validationInfo.type === 'error') return '#ef4444';
    if (validationInfo.type === 'warning') return '#f59e0b';
    return '#10b981';
  };

  // Get assignment status display
  const getAssignmentStatusDisplay = (pair: any) => {
    if (pair.currentProjectName) {
      return {
        text: `Assigned to "${pair.currentProjectName}"`,
        color: '#f59e0b',
        icon: '🔗',
        isReassignment: true
      };
    } else {
      return {
        text: 'Available',
        color: '#10b981',
        icon: '✅',
        isReassignment: false
      };
    }
  };

  // FIXED: Always show dialog when open - no more blocking authentication checks
  if (!serverPairDialog.isOpen) return null;

  const { pendingProjectData, selectedOption } = serverPairDialog;
  
  // FIXED: Use isOperationLoading instead of isLoading for progress overlay condition
  const isOperationInProgress = serverPairDialog.isOperationLoading;
  const currentProgress = serverPairDialog.hostingProgress;
  const minCredits = getMinimumCreditsRequired();

  // FIXED: Show authentication warning inside dialog instead of blocking
  const showAuthWarning = !isAuthenticated || !isReady || stage !== 'READY';

  // OPTION 1: Enhanced loading state logic - combines local and store loading states
  const allServerPairs = serverPairDialog.allServerPairs;
  const isActuallyLoading = isTriggeredLoading || serverPairDialog.isLoadingServerPairs;
  const serverPairsError = serverPairDialog.serverPairsError;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeServerPairSelectionDialog}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          animation: 'fadeIn 0.2s ease-out'
        }}
      />

      {/* FIXED: Progress Overlay - Only shows during ACTUAL operations, not data loading */}
      {isOperationInProgress && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.95)',
          backdropFilter: 'blur(12px)',
          zIndex: 100002,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--secondary-black), var(--primary-black))',
            border: `2px solid ${getPhaseColor(currentProgress.phase)}`,
            borderRadius: '20px',
            padding: '3rem',
            textAlign: 'center',
            maxWidth: '500px',
            width: '90%',
            boxShadow: `0 25px 70px ${getPhaseColor(currentProgress.phase)}40, 0 0 0 1px rgba(255, 255, 255, 0.1)`
          }}>
            {/* Progress Circle with Phase-Based Styling */}
            <div style={{
              position: 'relative',
              width: '120px',
              height: '120px',
              margin: '0 auto 2rem',
              background: `conic-gradient(${getPhaseColor(currentProgress.phase)} 0deg, ${getPhaseColor(currentProgress.phase)} ${currentProgress.progress * 3.6}deg, rgba(255, 255, 255, 0.1) ${currentProgress.progress * 3.6}deg)`,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                width: '90px',
                height: '90px',
                background: 'var(--primary-black)',
                borderRadius: '50%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: getPhaseColor(currentProgress.phase)
              }}>
                {getPhaseIcon(currentProgress.phase)}
                <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  {currentProgress.progress}%
                </div>
              </div>
            </div>
            
            {/* Real Progress Information from Slice */}
            <h3 style={{
              fontSize: '1.4rem',
              fontWeight: 700,
              color: '#ffffff',
              marginBottom: '0.5rem',
              lineHeight: 1.2
            }}>
              {currentProgress.status || 
               (selectedOption === 'create' 
                ? '🚀 Creating Server Pair with Hosting'
                : selectedOption === 'assign'
                  ? serverPairDialog.selectedServerPairId && allServerPairs.find(p => p.pairId === serverPairDialog.selectedServerPairId)?.currentProjectName
                    ? '🔄 Reassigning Server Pair & Creating Project'
                    : '🔗 Assigning Server Pair & Creating Project'
                  : '📝 Creating Project'
              )}
            </h3>
            
            {/* Phase-Specific Progress Messages */}
            <p style={{
              color: 'var(--text-gray)',
              fontSize: '0.95rem',
              lineHeight: 1.5,
              marginBottom: '2rem',
              minHeight: '3rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {(() => {
                // Show real status from slice if available, otherwise show phase-appropriate defaults
                if (currentProgress.status && currentProgress.status !== 'Ready') {
                  // Real status from backend
                  if (currentProgress.status.includes('hosting') || currentProgress.status.includes('Hosting')) {
                    return `🌐 ${currentProgress.status}`;
                  } else if (currentProgress.status.includes('download') || currentProgress.status.includes('Download')) {
                    return `⬇️ ${currentProgress.status}`;
                  } else if (currentProgress.status.includes('configur') || currentProgress.status.includes('Configur')) {
                    return `⚙️ ${currentProgress.status}`;
                  } else {
                    return currentProgress.status;
                  }
                } else {
                  // Default messages based on operation type and phase
                  if (selectedOption === 'create') {
                    switch (currentProgress.phase) {
                      case 'setup':
                        return `⚙️ Setting up server infrastructure with ${serverPairDialog.creditsToAllocate.toLocaleString()} credits...`;
                      case 'hosting':
                        return `🌐 Configuring website hosting capabilities for frontend server...`;
                      case 'complete':
                        return `🎉 Server pair created successfully with hosting configured!`;
                      case 'error':
                        return `❌ Server pair creation encountered an issue...`;
                      default:
                        return `🚀 Processing server pair creation with hosting...`;
                    }
                  } else if (selectedOption === 'assign') {
                    const selectedPair = allServerPairs.find(p => p.pairId === serverPairDialog.selectedServerPairId);
                    const isReassignment = selectedPair?.currentProjectName;
                    return isReassignment 
                      ? `🔄 Moving server pair from "${selectedPair.currentProjectName}" to "${pendingProjectData?.name}"...`
                      : `🔗 Assigning server pair to "${pendingProjectData?.name}"...`;
                  } else {
                    return `📝 Creating project "${pendingProjectData?.name}" without hosting...`;
                  }
                }
              })()}
            </p>

            {/* Real Progress Bar */}
            <div style={{
              width: '100%',
              height: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              marginBottom: '1.5rem',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${currentProgress.progress}%`,
                height: '100%',
                background: currentProgress.phase === 'error' 
                  ? 'linear-gradient(90deg, #ef4444, #dc2626)' 
                  : currentProgress.phase === 'hosting'
                  ? 'linear-gradient(90deg, #8b5cf6, #7c3aed)'
                  : currentProgress.phase === 'complete'
                  ? 'linear-gradient(90deg, #10b981, #059669)'
                  : 'linear-gradient(90deg, var(--accent-orange), #f59e0b)',
                borderRadius: '4px',
                transition: 'width 0.5s ease-out'
              }} />
            </div>

            {/* Phase and Progress Information */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.85rem',
              color: 'var(--text-gray)',
              marginBottom: '1.5rem'
            }}>
              <span style={{
                color: getPhaseColor(currentProgress.phase),
                fontWeight: 600
              }}>
                Phase: {currentProgress.phase.replace('_', ' ').toUpperCase()}
                {currentProgress.phase === 'hosting' && ' 🌐'}
              </span>
              <span>
                {currentProgress.progress}% Complete
              </span>
            </div>

            {/* Action Buttons with Phase-Appropriate Options */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              {currentProgress.phase === 'setup' && (
                <button
                  onClick={() => {
                    // In a real implementation, you'd cancel the operation
                    closeServerPairSelectionDialog();
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    color: '#ef4444',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Cancel
                </button>
              )}
              
              {currentProgress.phase === 'complete' && (
                <button
                  onClick={() => {
                    closeServerPairSelectionDialog();
                  }}
                  style={{
                    padding: '0.75rem 2rem',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Continue to Project
                </button>
              )}

              {currentProgress.phase === 'error' && (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={() => {
                      closeServerPairSelectionDialog();
                    }}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-gray)',
                      fontSize: '0.9rem',
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                  {selectedOption === 'create' && (
                    <button
                      onClick={handleSubmit}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: 'linear-gradient(135deg, var(--accent-orange), #f59e0b)',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Retry Creation
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Real-time Operation Details */}
            {selectedOption === 'create' && (
              <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: `${getPhaseColor(currentProgress.phase)}20`,
                border: `1px solid ${getPhaseColor(currentProgress.phase)}50`,
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: 'var(--text-gray)'
              }}>
                <div style={{ 
                  fontWeight: 600, 
                  color: getPhaseColor(currentProgress.phase), 
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  {currentProgress.phase === 'hosting' ? <Globe size={14} /> : 
                   currentProgress.phase === 'setup' ? <Settings size={14} /> : 
                   currentProgress.phase === 'complete' ? <CheckCircle size={14} /> :
                   <Server size={14} />}
                  {currentProgress.phase === 'hosting' ? 
                    '🌐 Website Hosting Configuration Active' :
                    '⚙️ Server Infrastructure Creation Active'
                  }
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  <div>Credits: {serverPairDialog.creditsToAllocate.toLocaleString()}</div>
                  <div>Memory: {serverConfig?.memoryGB || 1}GB per server</div>
                  <div>Duration: {serverConfig?.durationDays || 30} days</div>
                  <div>Phase: {currentProgress.phase}</div>
                  {currentProgress.phase === 'hosting' && (
                    <>
                      <div style={{ gridColumn: '1 / -1', color: getPhaseColor(currentProgress.phase), fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        🌐 Frontend server receiving website hosting capabilities...
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FIXED: Main Dialog - Always visible when isOpen is true, only hidden by progress overlay during operations */}
      <div style={{
        position: 'fixed',
        top: isMobile ? '0' : '50%',
        left: isMobile ? '0' : '50%',
        transform: isMobile ? 'none' : 'translate(-50%, -50%)',
        width: isMobile ? '100vw' : 'min(90vw, 900px)',
        height: isMobile ? '100vh' : 'auto',
        maxHeight: isMobile ? '100vh' : '85vh',
        background: 'linear-gradient(135deg, var(--secondary-black), var(--primary-black))',
        border: isMobile ? 'none' : '1px solid var(--border-color)',
        borderRadius: isMobile ? '0' : '16px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        animation: isMobile ? 'slideUpMobile 0.3s ease-out' : 'slideUp 0.3s ease-out',
        zIndex: 100000,
        isolation: 'isolate',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: isMobile ? '1rem' : '2rem',
          paddingBottom: isMobile ? '1rem' : '1.5rem',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(255, 107, 53, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--accent-orange), #f59e0b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              boxShadow: '0 4px 15px rgba(255, 107, 53, 0.3)'
            }}>
              🖥️
            </div>
            <div>
              <h2 style={{
                fontSize: isMobile ? '1.25rem' : '1.5rem',
                fontWeight: 700,
                color: '#ffffff',
                margin: 0,
                marginBottom: '0.25rem'
              }}>
                Server Pair Setup
              </h2>
              <p style={{
                fontSize: '0.9rem',
                color: 'var(--text-gray)',
                margin: 0
              }}>
                Configure hosting for "{pendingProjectData?.name}" with server infrastructure
              </p>
            </div>
          </div>

          {/* Credits Display in Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '0.25rem'
            }}>
              <span style={{
                fontSize: '0.75rem',
                color: 'var(--text-gray)'
              }}>
                Available Credits
              </span>
              <span style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: '#ffffff'
              }}>
                💰 {credits.balance.toLocaleString()}
              </span>
            </div>

            <button
              onClick={closeServerPairSelectionDialog}
              disabled={isOperationInProgress}
              style={{
                width: '40px',
                height: '40px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isOperationInProgress ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: isOperationInProgress ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!isOperationInProgress) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isOperationInProgress) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }
              }}
            >
              <X size={20} color="var(--text-gray)" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          padding: isMobile ? '1rem' : '2rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          {/* FIXED: Show authentication warning inside dialog instead of blocking */}
          {showAuthWarning && (
            <div style={{
              padding: '1rem',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '8px',
              fontSize: '0.85rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <AlertTriangle size={16} color="#f59e0b" />
                <span style={{ fontWeight: 600, color: '#f59e0b' }}>
                  Authentication Required
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#f59e0b' }}>
                ⚠️ Please ensure you're fully authenticated. Some features may be limited until authentication is complete.
              </div>
            </div>
          )}

          {/* FIXED: Options - ALWAYS VISIBLE - No loading state blocking them */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem'
          }}>
            {/* Create New Server Pair */}
            <div
              onClick={() => handleOptionSelect('create')}
              style={{
                padding: '1.5rem',
                background: selectedOption === 'create' 
                  ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(245, 158, 11, 0.1))'
                  : 'rgba(255, 255, 255, 0.03)',
                border: selectedOption === 'create' 
                  ? '2px solid var(--accent-orange)' 
                  : '1px solid var(--border-color)',
                borderRadius: '12px',
                cursor: isOperationInProgress ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: isOperationInProgress ? 0.7 : 1,
                boxShadow: selectedOption === 'create' 
                  ? '0 4px 20px rgba(255, 107, 53, 0.2)' 
                  : 'none'
              }}
              onMouseEnter={(e) => {
                if (!isOperationInProgress && selectedOption !== 'create') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isOperationInProgress && selectedOption !== 'create') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                <Plus size={24} color="var(--accent-orange)" style={{ marginRight: '0.75rem' }} />
                <h3 style={{
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  margin: 0
                }}>
                  Create New Server Pair
                </h3>
              </div>
              <p style={{
                fontSize: '0.85rem',
                color: 'var(--text-gray)',
                lineHeight: 1.5,
                margin: 0,
                marginBottom: '1rem'
              }}>
                Create dedicated frontend and backend servers with resources and automatic hosting configuration.
              </p>
              
              {selectedOption === 'create' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Server Name Input */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#ffffff',
                      marginBottom: '0.5rem'
                    }}>
                      Server Pair Name
                    </label>
                    <input
                      type="text"
                      value={serverPairDialog.newServerPairName}
                      onChange={(e) => setNewServerPairName(e.target.value)}
                      placeholder="e.g., My Project Production Servers"
                      disabled={isOperationInProgress}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${validationErrors.name ? '#ef4444' : 'var(--border-color)'}`,
                        borderRadius: '6px',
                        color: '#ffffff',
                        fontSize: '0.9rem',
                        transition: 'border-color 0.2s ease',
                        opacity: isOperationInProgress ? 0.7 : 1
                      }}
                      onFocus={(e) => {
                        if (!validationErrors.name) {
                          e.target.style.borderColor = 'var(--accent-orange)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!validationErrors.name) {
                          e.target.style.borderColor = 'var(--border-color)';
                        }
                      }}
                    />
                    {validationErrors.name && (
                      <p style={{
                        fontSize: '0.75rem',
                        color: '#ef4444',
                        margin: '0.25rem 0 0 0'
                      }}>
                        {validationErrors.name}
                      </p>
                    )}
                  </div>

                  {/* ENHANCED: Flexible Credits Allocation */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#ffffff',
                      marginBottom: '0.5rem'
                    }}>
                      Credits to Allocate (Server Resources + Hosting)
                      <span style={{
                        fontSize: '0.7rem',
                        color: getCreditsStatusColor(),
                        marginLeft: '0.5rem'
                      }}>
                        {serverConfig && serverConfig.canCreateServers && (
                          <>({serverConfig.memoryGB}GB × {serverConfig.durationDays} days + hosting)</>
                        )}
                      </span>
                    </label>
                    
                    {/* ENHANCED: Flexible Credits Input Field */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input
                        type="text"
                        value={creditsInputValue}
                        onChange={(e) => handleCreditsInputChange(e.target.value)}
                        placeholder={`Minimum ${minCredits} recommended`}
                        disabled={isOperationInProgress}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: `1px solid ${getCreditsStatusColor()}`,
                          borderRadius: '6px',
                          color: '#ffffff',
                          fontSize: '0.85rem',
                          opacity: isOperationInProgress ? 0.7 : 1,
                          transition: 'border-color 0.2s ease'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'var(--accent-orange)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = getCreditsStatusColor();
                        }}
                      />
                      <button
                        onClick={() => {
                          const maxValue = Math.min(credits.balance, 10000);
                          handleCreditsInputChange(maxValue.toString());
                        }}
                        disabled={isOperationInProgress}
                        style={{
                          padding: '0.5rem 0.75rem',
                          background: 'rgba(255, 107, 53, 0.2)',
                          border: '1px solid var(--accent-orange)',
                          borderRadius: '6px',
                          color: 'var(--accent-orange)',
                          fontSize: '0.75rem',
                          cursor: isOperationInProgress ? 'not-allowed' : 'pointer',
                          opacity: isOperationInProgress ? 0.7 : 1
                        }}
                      >
                        Max
                      </button>
                    </div>

                    {/* Credits Slider (separate from text input) */}
                    <input
                      type="range"
                      min={minCredits}
                      max={Math.min(credits.balance, 20000)}
                      step="100"
                      value={serverPairDialog.creditsToAllocate}
                      onChange={(e) => handleCreditsSliderChange(parseInt(e.target.value))}
                      disabled={isOperationInProgress}
                      style={{
                        width: '100%',
                        opacity: isOperationInProgress ? 0.7 : 1,
                        accentColor: 'var(--accent-orange)'
                      }}
                    />
                    
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.7rem',
                      color: 'var(--text-gray)',
                      marginTop: '0.25rem'
                    }}>
                      <span>{minCredits.toLocaleString()} (min)</span>
                      <span>{Math.min(credits.balance, 20000).toLocaleString()}</span>
                    </div>

                    {/* ENHANCED: Credits Validation Feedback */}
                    {creditsInputValue && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        background: getCreditsValidationInfo().type === 'error' 
                          ? 'rgba(239, 68, 68, 0.1)' 
                          : getCreditsValidationInfo().type === 'warning'
                          ? 'rgba(245, 158, 11, 0.1)'
                          : 'rgba(16, 185, 129, 0.1)',
                        border: `1px solid ${getCreditsStatusColor()}`,
                        borderRadius: '6px',
                        fontSize: '0.8rem'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginBottom: '0.5rem'
                        }}>
                          {getCreditsValidationInfo().type === 'error' ? (
                            <AlertTriangle size={14} color="#ef4444" />
                          ) : getCreditsValidationInfo().type === 'warning' ? (
                            <AlertTriangle size={14} color="#f59e0b" />
                          ) : (
                            <CheckCircle size={14} color="#10b981" />
                          )}
                          <span style={{
                            fontWeight: 600,
                            color: getCreditsStatusColor()
                          }}>
                            Credits Validation
                          </span>
                        </div>
                        <p style={{
                          color: getCreditsStatusColor(),
                          margin: 0,
                          lineHeight: 1.4
                        }}>
                          {getCreditsValidationInfo().message}
                        </p>
                      </div>
                    )}

                    {/* Server Configuration Display */}
                    {serverConfig && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        background: serverConfig.canCreateServers 
                          ? 'rgba(16, 185, 129, 0.1)' 
                          : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${serverConfig.canCreateServers ? '#10b981' : '#ef4444'}`,
                        borderRadius: '6px',
                        fontSize: '0.8rem'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginBottom: '0.5rem'
                        }}>
                          {serverConfig.canCreateServers ? (
                            <CheckCircle size={14} color="#10b981" />
                          ) : (
                            <AlertTriangle size={14} color="#ef4444" />
                          )}
                          <span style={{
                            fontWeight: 600,
                            color: serverConfig.canCreateServers ? '#10b981' : '#ef4444'
                          }}>
                            {serverConfig.canCreateServers ? 'Ready to Create with Hosting' : 'Configuration Issue'}
                          </span>
                        </div>
                        <p style={{
                          color: serverConfig.canCreateServers ? '#10b981' : '#ef4444',
                          margin: 0,
                          lineHeight: 1.4
                        }}>
                          {serverConfig.message}
                        </p>
                        {serverConfig.canCreateServers && (
                          <div style={{
                            marginTop: '0.5rem',
                            fontSize: '0.75rem',
                            color: 'var(--text-gray)',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '0.25rem'
                          }}>
                            <div>💾 {serverConfig.memoryGB}GB per server</div>
                            <div>⏱️ {serverConfig.durationDays} days runtime</div>
                            <div>💰 {serverConfig.perServerCredits} credits each</div>
                            <div>🌐 Hosting included automatically</div>
                            <div style={{ gridColumn: '1 / -1', color: '#10b981', fontSize: '0.7rem' }}>
                              🌍 Server infrastructure with automatic website hosting configuration
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Validation Errors */}
                    {(validationErrors.credits || validationErrors.config || validationErrors.platform) && (
                      <div style={{ marginTop: '0.5rem' }}>
                        {validationErrors.credits && (
                          <p style={{ fontSize: '0.75rem', color: '#ef4444', margin: '0.25rem 0 0 0' }}>
                            {validationErrors.credits}
                          </p>
                        )}
                        {validationErrors.config && (
                          <p style={{ fontSize: '0.75rem', color: '#ef4444', margin: '0.25rem 0 0 0' }}>
                            {validationErrors.config}
                          </p>
                        )}
                        {validationErrors.platform && (
                          <p style={{ fontSize: '0.75rem', color: '#ef4444', margin: '0.25rem 0 0 0' }}>
                            {validationErrors.platform}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Assign Existing Server Pair */}
            <div
              onClick={() => handleOptionSelect('assign')}
              style={{
                padding: '1.5rem',
                background: selectedOption === 'assign' 
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1))'
                  : 'rgba(255, 255, 255, 0.03)',
                border: selectedOption === 'assign' 
                  ? '2px solid var(--accent-green)' 
                  : '1px solid var(--border-color)',
                borderRadius: '12px',
                cursor: isOperationInProgress ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: isOperationInProgress ? 0.7 : 1,
                boxShadow: selectedOption === 'assign' 
                  ? '0 4px 20px rgba(16, 185, 129, 0.2)' 
                  : 'none'
              }}
              onMouseEnter={(e) => {
                if (!isOperationInProgress && selectedOption !== 'assign') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isOperationInProgress && selectedOption !== 'assign') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                <Link size={24} color="var(--accent-green)" style={{ marginRight: '0.75rem' }} />
                <h3 style={{
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  margin: 0
                }}>
                  Use Existing Server Pair
                </h3>
              </div>
              <p style={{
                fontSize: '0.85rem',
                color: 'var(--text-gray)',
                lineHeight: 1.5,
                margin: 0,
                marginBottom: '1rem'
              }}>
                Assign an existing server pair to this project. Can reassign from other projects. Loads when you select this option.
              </p>

              {selectedOption === 'assign' && (
                <div>
                  {/* OPTION 1: Enhanced loading state logic with immediate feedback */}
                  {isActuallyLoading ? (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '2rem',
                      color: 'var(--text-gray)'
                    }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        border: '2px solid rgba(16, 185, 129, 0.3)',
                        borderTopColor: '#10b981',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        marginBottom: '1rem'
                      }} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#10b981' }}>
                          Loading Server Pairs
                        </div>
                        <div style={{ fontSize: '0.9rem' }}>
                          {isTriggeredLoading 
                            ? 'Fetching your existing server pairs...' 
                            : 'Loading your existing server pairs...'
                          }
                        </div>
                      </div>
                    </div>
                  ) : serverPairsError ? (
                    <div style={{
                      padding: '1rem',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '6px',
                      textAlign: 'center',
                      color: '#ef4444',
                      fontSize: '0.85rem'
                    }}>
                      <AlertTriangle size={24} color="#ef4444" style={{ marginBottom: '0.5rem' }} />
                      <div>{serverPairsError}</div>
                      <button
                        onClick={() => {
                          setIsTriggeredLoading(true);
                          loadAllUserServerPairs();
                        }}
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.5rem 1rem',
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid #ef4444',
                          borderRadius: '4px',
                          color: '#ef4444',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        Retry Loading
                      </button>
                    </div>
                  ) : allServerPairs.length === 0 ? (
                    <div style={{
                      padding: '1rem',
                      background: 'rgba(156, 163, 175, 0.1)',
                      border: '1px solid rgba(156, 163, 175, 0.3)',
                      borderRadius: '6px',
                      textAlign: 'center',
                      color: 'var(--text-gray)',
                      fontSize: '0.85rem'
                    }}>
                      <Server size={24} color="var(--text-gray)" style={{ marginBottom: '0.5rem' }} />
                      <div>No server pairs available</div>
                      <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        Create a new server pair to get started
                      </div>
                    </div>
                  ) : (
                    <>
                      <label style={{
                        display: 'block',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#ffffff',
                        marginBottom: '0.5rem'
                      }}>
                        Select Server Pair ({allServerPairs.length} available)
                      </label>
                      
                      {/* Server pair list */}
                      <div style={{
                        maxHeight: '300px',
                        overflowY: 'auto',
                        border: `1px solid ${validationErrors.selection ? '#ef4444' : 'var(--border-color)'}`,
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.05)'
                      }}>
                        {allServerPairs.map((pair) => {
                          const assignmentStatus = getAssignmentStatusDisplay(pair);
                          const isSelected = serverPairDialog.selectedServerPairId === pair.pairId;
                          
                          return (
                            <div
                              key={pair.pairId}
                              onClick={() => handleServerPairSelection(pair.pairId)}
                              style={{
                                padding: '1rem',
                                cursor: isOperationInProgress ? 'not-allowed' : 'pointer',
                                borderBottom: '1px solid var(--border-color)',
                                background: isSelected 
                                  ? 'rgba(16, 185, 129, 0.1)' 
                                  : 'transparent',
                                transition: 'all 0.2s ease',
                                opacity: isOperationInProgress ? 0.7 : 1
                              }}
                              onMouseEnter={(e) => {
                                if (!isOperationInProgress && !isSelected) {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isOperationInProgress && !isSelected) {
                                  e.currentTarget.style.background = 'transparent';
                                }
                              }}
                            >
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                marginBottom: '0.5rem'
                              }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    color: isSelected ? '#10b981' : '#ffffff',
                                    marginBottom: '0.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                  }}>
                                    {isSelected && <CheckCircle size={16} color="#10b981" />}
                                    {pair.name}
                                  </div>
                                  
                                  <div style={{
                                    fontSize: '0.8rem',
                                    color: assignmentStatus.color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    marginBottom: '0.25rem'
                                  }}>
                                    <span>{assignmentStatus.icon}</span>
                                    <span>{assignmentStatus.text}</span>
                                    {assignmentStatus.isReassignment && (
                                      <span style={{
                                        fontSize: '0.7rem',
                                        background: 'rgba(245, 158, 11, 0.2)',
                                        color: '#f59e0b',
                                        padding: '0.125rem 0.375rem',
                                        borderRadius: '4px',
                                        marginLeft: '0.25rem'
                                      }}>
                                        REASSIGN
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--text-gray)',
                                    display: 'flex',
                                    gap: '1rem'
                                  }}>
                                    <span>💰 {pair.creditsAllocated.toLocaleString()} credits</span>
                                    <span>📅 {new Date(pair.createdAt).toLocaleDateString()}</span>
                                  </div>
                                </div>
                                
                                {isSelected && (
                                  <div style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    background: '#10b981',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}>
                                    <CheckCircle size={12} color="#ffffff" />
                                  </div>
                                )}
                              </div>
                              
                              <div style={{
                                fontSize: '0.7rem',
                                color: 'var(--text-gray)',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '0.25rem'
                              }}>
                                <div>🎨 Frontend: {pair.frontendCanisterId.substring(0, 8)}...</div>
                                <div>🔧 Backend: {pair.backendCanisterId.substring(0, 8)}...</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {validationErrors.selection && (
                        <p style={{
                          fontSize: '0.75rem',
                          color: '#ef4444',
                          margin: '0.25rem 0 0 0'
                        }}>
                          {validationErrors.selection}
                        </p>
                      )}
                      
                      {/* Selected Server Pair Summary with Reassignment Warning */}
                      {serverPairDialog.selectedServerPairId && (
                        <div style={{
                          marginTop: '0.75rem',
                          padding: '0.75rem',
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: '6px',
                          fontSize: '0.8rem'
                        }}>
                          {(() => {
                            const selectedPair = allServerPairs.find(p => p.pairId === serverPairDialog.selectedServerPairId);
                            if (!selectedPair) return null;
                            
                            const assignmentStatus = getAssignmentStatusDisplay(selectedPair);
                            
                            return (
                              <div style={{ color: '#10b981' }}>
                                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                                  ✅ Selected: {selectedPair.name}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginBottom: '0.25rem' }}>
                                  {assignmentStatus.text} • {selectedPair.creditsAllocated.toLocaleString()} credits allocated
                                </div>
                                {assignmentStatus.isReassignment && (
                                  <div style={{
                                    fontSize: '0.75rem',
                                    color: '#f59e0b',
                                    background: 'rgba(245, 158, 11, 0.1)',
                                    padding: '0.5rem',
                                    borderRadius: '4px',
                                    marginTop: '0.5rem'
                                  }}>
                                    ⚠️ This will reassign the server pair from "{selectedPair.currentProjectName}" to "{pendingProjectData?.name}". 
                                    The previous project will lose access to these servers. Click "Reassign & Create Project" below to confirm.
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Skip Server Pair */}
            <div
              onClick={() => handleOptionSelect('skip')}
              style={{
                padding: '1.5rem',
                background: selectedOption === 'skip' 
                  ? 'linear-gradient(135deg, rgba(156, 163, 175, 0.2), rgba(107, 114, 128, 0.1))'
                  : 'rgba(255, 255, 255, 0.03)',
                border: selectedOption === 'skip' 
                  ? '2px solid #9ca3af' 
                  : '1px solid var(--border-color)',
                borderRadius: '12px',
                cursor: isOperationInProgress ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: isOperationInProgress ? 0.7 : 1,
                boxShadow: selectedOption === 'skip' 
                  ? '0 4px 20px rgba(156, 163, 175, 0.2)' 
                  : 'none'
              }}
              onMouseEnter={(e) => {
                if (!isOperationInProgress && selectedOption !== 'skip') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(156, 163, 175, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isOperationInProgress && selectedOption !== 'skip') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                <ArrowRight size={24} color="#9ca3af" style={{ marginRight: '0.75rem' }} />
                <h3 style={{
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  margin: 0
                }}>
                  Skip For Now
                </h3>
              </div>
              <p style={{
                fontSize: '0.85rem',
                color: 'var(--text-gray)',
                lineHeight: 1.5,
                margin: 0
              }}>
                Create the project without a server pair. You can always add hosting later from the Deploy tab.
              </p>
            </div>
          </div>

          {/* Info Section - Reorganized but keeping all text */}
          <div style={{
            padding: '1.5rem',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '8px',
            fontSize: '0.85rem',
            color: 'var(--text-gray)',
            lineHeight: 1.5
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <span style={{ 
                color: '#3b82f6', 
                marginTop: '0.1rem',
                fontSize: '1.25rem',
                flexShrink: 0
              }}>
                💡
              </span>
              <div>
                <div style={{ 
                  color: '#ffffff',
                  fontWeight: 600,
                  marginBottom: '0.75rem',
                  fontSize: '0.95rem'
                }}>
                  App Hosting Setup
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  Get your app online with our complete hosting solution. We'll set up everything needed to make your app accessible to users around the world.
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: '0.5rem 1rem',
                  fontSize: '0.8rem'
                }}>
                  <div style={{ fontWeight: 600, color: '#3b82f6' }}>🚀 Create New:</div>
                  <div>We'll build fresh hosting infrastructure and get your app ready to go live</div>

                  <div style={{ fontWeight: 600, color: '#3b82f6' }}>🔗 Assign Existing:</div>
                  <div>Use hosting infrastructure you've already set up for other projects</div>

                  <div style={{ fontWeight: 600, color: '#3b82f6' }}>⏭️ Skip:</div>
                  <div>Set up your project now, add hosting later when you're ready to go live</div>

                  <div style={{ fontWeight: 600, color: '#3b82f6' }}>🌐 Hosting Ready:</div>
                  <div>Your app will be live and accessible to users immediately after setup</div>
                </div>

                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  color: '#10b981',
                  fontWeight: 500
                }}>
                  <strong>✨ Quick Setup:</strong> Choose your option and we'll handle all the technical details automatically.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: isMobile ? '1rem' : '2rem',
          paddingTop: isMobile ? '1rem' : '1.5rem',
          borderTop: '1px solid var(--border-color)',
          background: 'rgba(255, 255, 255, 0.02)',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '1rem',
          justifyContent: 'flex-end',
          flexShrink: 0
        }}>
          <button
            onClick={closeServerPairSelectionDialog}
            disabled={isOperationInProgress}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-gray)',
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: isOperationInProgress ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: isOperationInProgress ? 0.5 : 1,
              order: isMobile ? 2 : 1
            }}
            onMouseEnter={(e) => {
              if (!isOperationInProgress) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isOperationInProgress) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={!selectedOption || isOperationInProgress || (selectedOption === 'assign' && allServerPairs.length === 0) || (selectedOption === 'create' && (!icpPriceData || icpPriceError || !mainActor))}
            style={{
              padding: '0.75rem 2rem',
              background: selectedOption && !isOperationInProgress && (selectedOption !== 'create' || (icpPriceData && !icpPriceError && mainActor))
                ? 'linear-gradient(135deg, var(--accent-orange), #f59e0b)' 
                : 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              color: selectedOption && !isOperationInProgress && (selectedOption !== 'create' || (icpPriceData && !icpPriceError && mainActor)) ? '#ffffff' : 'var(--text-gray)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: selectedOption && !isOperationInProgress && (selectedOption !== 'create' || (icpPriceData && !icpPriceError && mainActor)) ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: selectedOption && !isOperationInProgress && (selectedOption !== 'create' || (icpPriceData && !icpPriceError && mainActor))
                ? '0 4px 15px rgba(255, 107, 53, 0.3)' 
                : 'none',
              order: isMobile ? 1 : 2,
              minHeight: '44px'
            }}
            onMouseEnter={(e) => {
              if (selectedOption && !isOperationInProgress && (selectedOption !== 'create' || (icpPriceData && !icpPriceError && mainActor))) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedOption && !isOperationInProgress && (selectedOption !== 'create' || (icpPriceData && !icpPriceError && mainActor))) {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 107, 53, 0.3)';
              }
            }}
          >
            {isOperationInProgress && (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderTopColor: '#ffffff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            )}
            {isOperationInProgress
              ? selectedOption === 'create' 
                ? currentProgress.phase === 'hosting' 
                  ? 'Configuring Hosting...'
                  : 'Creating with Hosting...'
                : selectedOption === 'assign'
                  ? 'Assigning & Creating Project...'
                  : 'Creating Project...'
              : selectedOption === 'create' 
                ? (!icpPriceData || icpPriceError) 
                  ? '📊 Loading Pricing...'
                  : !mainActor 
                    ? '⚠️ Platform Required' 
                    : `🌐 Create with Auto-Hosting (${serverPairDialog.creditsToAllocate.toLocaleString()} credits)`
                : selectedOption === 'assign'
                  ? serverPairDialog.selectedServerPairId && allServerPairs.find(p => p.pairId === serverPairDialog.selectedServerPairId)?.currentProjectName
                    ? 'Reassign & Create Project'
                    : 'Assign & Create Project'
                  : selectedOption === 'skip'
                    ? 'Create Project Without Hosting'
                    : 'Select an Option'
            }
          </button>
        </div>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { 
            opacity: 0; 
            transform: translate(-50%, -40%) scale(0.95); 
          }
          to { 
            opacity: 1; 
            transform: translate(-50%, -50%) scale(1); 
          }
        }
        
        @keyframes slideUpMobile {
          from { 
            opacity: 0; 
            transform: translateY(100%); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        
        /* Custom scrollbar for dialog content */
        div::-webkit-scrollbar {
          width: 6px;
        }
        
        div::-webkit-scrollbar-track {
          background: transparent;
        }
        
        div::-webkit-scrollbar-thumb {
          background-color: rgba(255, 107, 53, 0.3);
          border-radius: 3px;
          transition: background-color 0.2s ease;
        }
        
        div::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255, 107, 53, 0.5);
        }
        
        /* Enhanced input styles */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        
        input[type="number"] {
          -moz-appearance: textfield;
        }
        
        input[type="range"] {
          -webkit-appearance: none;
          height: 6px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.1);
          outline: none;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--accent-orange);
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(255, 107, 53, 0.3);
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--accent-orange);
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(255, 107, 53, 0.3);
        }
      `}</style>
    </>
  );
};

export default ServerPairSelectionDialog;