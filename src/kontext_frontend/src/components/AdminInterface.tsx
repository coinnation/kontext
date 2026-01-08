import React, { useState, useEffect, Suspense } from 'react';
import { useCanister } from '../useCanister';
import { formatCycles, formatIcpBalance, icpToCycles } from '../utils/icpUtils';
import { useAuth } from '../store/appStore';
import { generationLogger, DebugControl } from '../services/GenerationLoggingService';
import { HttpAgent } from '@dfinity/agent';
import { AssetManager } from '@dfinity/assets';
import { Principal } from '@dfinity/principal';

// 🚀 PWA OPTIMIZATION: Lazy load heavy admin sub-components for faster initial Admin panel open
const EconomyDashboard = React.lazy(() => 
  import('./EconomyDashboard').then(module => {
    console.log('✅ [PWA] EconomyDashboard lazy loaded');
    return { default: module.EconomyDashboard };
  })
);

const FinancialAnalyticsDashboard = React.lazy(() => 
  import('./FinancialAnalyticsDashboard').then(module => {
    console.log('✅ [PWA] FinancialAnalyticsDashboard lazy loaded');
    return module;
  })
);

const CanisterPoolManager = React.lazy(() => 
  import('./CanisterPoolManager').then(module => {
    console.log('✅ [PWA] CanisterPoolManager lazy loaded');
    return { default: module.CanisterPoolManager };
  })
);

const UserCanisterAdmin = React.lazy(() => 
  import('./UserCanisterAdmin').then(module => {
    console.log('✅ [PWA] UserCanisterAdmin lazy loaded');
    return { default: module.UserCanisterAdmin };
  })
);

const WasmConfigManager = React.lazy(() => 
  import('./WasmConfigManager').then(module => {
    console.log('✅ [PWA] WasmConfigManager lazy loaded');
    return { default: module.WasmConfigManager };
  })
);

const ForumCategoryManager = React.lazy(() => 
  import('./ForumCategoryManager').then(module => {
    console.log('✅ [PWA] ForumCategoryManager lazy loaded');
    return { default: module.ForumCategoryManager };
  })
);

const SubscriptionPlanManager = React.lazy(() => 
  import('./SubscriptionPlanManager').then(module => {
    console.log('✅ [PWA] SubscriptionPlanManager lazy loaded');
    return { default: module.default };
  })
);

const UniversityContentManager = React.lazy(() => 
  import('./UniversityContentManager').then(module => {
    console.log('✅ [PWA] UniversityContentManager lazy loaded');
    return { default: module.UniversityContentManager };
  })
);

const MarketplaceAdminManager = React.lazy(() => 
  import('./MarketplaceAdminManager').then(module => {
    console.log('✅ [PWA] MarketplaceAdminManager lazy loaded');
    return { default: module.MarketplaceAdminManager };
  })
);

// MarketplaceItemCreator moved to ProfileInterface - users can create listings from their profile
// const MarketplaceItemCreator = React.lazy(() => 
//   import('./MarketplaceItemCreator').then(module => {
//     console.log('✅ [PWA] MarketplaceItemCreator lazy loaded');
//     return { default: module.MarketplaceItemCreator };
//   })
// );

const AdminNotificationSender = React.lazy(() => 
  import('./AdminNotificationSender').then(module => {
    console.log('✅ [PWA] AdminNotificationSender lazy loaded');
    return { default: module.AdminNotificationSender };
  })
);

interface AdminInterfaceProps {
  onClose: () => void;
}

// Platform Wallet Types
interface WalletId {
  principal: string;
  subaccount: string;
  accountIdentifier: string;
}

interface Transaction {
  transactionType: { [key: string]: null };
  counterparty: string;
  amount: bigint;
  timestamp: bigint;
  isPositive: boolean;
  memo: string[];
}

// Debug Session Types
interface DebugSession {
  sessionId: string;
  timestamp: number;
  userPrompt?: string;
  templateUsed?: string;
  success?: boolean;
  totalFiles?: number;
  duration?: number;
  confidence?: number;
  urls: {
    userPrompt?: string;
    templateRouting?: string;
    backendGeneration?: string;
    frontendGeneration?: string;
    fileExtraction?: string;
    generationSummary?: string;
    completeSession?: string;
  };
}

// File Analysis Types
interface FileAnalysis {
  sessionId: string;
  templateName?: string;
  requiredFiles: FileRequirement[];
  generatedFiles: GeneratedFile[];
  platformProvidedFiles: PlatformFile[];
  completenessScore: number;
  deploymentReadiness: number;
  issues: FileIssue[];
  recommendations: string[];
  templateAdherence: TemplateAdherence;
}

interface FileRequirement {
  category: 'backend' | 'frontend' | 'config' | 'core';
  fileName: string;
  filePattern?: string; // regex pattern for flexible matching
  required: boolean;
  description: string;
  templateSpecific?: boolean;
}

interface GeneratedFile {
  fileName: string;
  category: 'backend' | 'frontend' | 'config' | 'core' | 'unknown';
  size: number;
  isComplete: boolean;
  hasValidStructure: boolean;
  templateCompliant?: boolean;
}

interface PlatformFile {
  fileName: string;
  expected: boolean;
  present: boolean;
  category: string;
}

interface FileIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  issue: string;
  impact: string;
  suggestion: string;
}

interface TemplateAdherence {
  templateName: string;
  overallScore: number;
  backendCompliance: number;
  frontendCompliance: number;
  structuralCompliance: number;
  deviations: TemplateDeviation[];
}

interface TemplateDeviation {
  severity: 'major' | 'minor';
  component: string;
  expected: string;
  actual: string;
  impact: string;
}

interface TemplateAnalytics {
  templateName: string;
  usageCount: number;
  successRate: number;
  averageConfidence: number;
  averageFiles: number;
  averageDuration: number;
  commonPromptPatterns: string[];
}

interface PromptAnalytics {
  totalPrompts: number;
  successfulPrompts: number;
  averageLength: number;
  commonKeywords: string[];
  topFailureReasons: string[];
}

// Enhanced Debug Session Details
interface SessionAnalysis {
  sessionId: string;
  phase: 'healthy' | 'warning' | 'error';
  issues: string[];
  insights: string[];
  performance: {
    routingTime: number;
    backendTime: number;
    frontendTime: number;
    totalTime: number;
    efficiency: 'excellent' | 'good' | 'poor';
  };
  quality: {
    templateMatch: number;
    codeCompleteness: number;
    userSatisfaction: 'predicted-high' | 'predicted-medium' | 'predicted-low';
  };
}

// File Requirements Configuration
const PROJECT_FILE_REQUIREMENTS: FileRequirement[] = [
  // Backend Files
  { category: 'backend', fileName: 'main.mo', required: true, description: 'Main backend canister file' },
  { category: 'backend', fileName: 'canister.mo', required: false, description: 'Additional canister logic' },
  { category: 'backend', filePattern: '.*\\.mo$', required: true, description: 'At least one Motoko backend file' },
  
  // Frontend Core Files
  { category: 'frontend', fileName: 'App.tsx', required: true, description: 'Main React application component' },
  { category: 'frontend', fileName: 'index.tsx', required: true, description: 'React application entry point' },
  { category: 'frontend', fileName: 'index.html', required: true, description: 'HTML entry point' },
  
  // Frontend Components (Template Specific)
  { category: 'frontend', filePattern: '.*Component.*\\.tsx$', required: false, templateSpecific: true, description: 'React components following template patterns' },
  { category: 'frontend', filePattern: '.*\\.tsx$', required: true, description: 'At least one React component file' },
  
  // Configuration Files
  { category: 'config', fileName: 'package.json', required: true, description: 'Node.js package configuration' },
  { category: 'config', fileName: 'vite.config.ts', required: true, description: 'Vite bundler configuration' },
  { category: 'config', fileName: 'tailwind.config.js', required: false, description: 'Tailwind CSS configuration' },
  { category: 'config', fileName: 'tsconfig.json', required: false, description: 'TypeScript configuration' },
  
  // Core Support Files
  { category: 'core', fileName: 'styles.css', required: false, description: 'Main stylesheet' },
  { category: 'core', filePattern: '.*\\.css$', required: false, description: 'Styling files' },
  { category: 'core', filePattern: '.*types.*\\.ts$', required: false, description: 'TypeScript type definitions' },
];

const PLATFORM_PROVIDED_FILES: string[] = [
  'CrudBase.mo',
  'DataComponents.tsx',
  'FormComponents.tsx',
  'icpData.ts',
  'index.ts',
  'index.tsx',
  'StandardTypes.mo',
  'UIComponents.tsx',
  'useActor.ts',
  'useCommonQueries.ts',
  'useEntityManager.ts',
  'useInternetIdentity.ts',
  'useMutation.ts',
  'useQuery.ts',
  'vite.config.ts'
];

export const AdminInterface: React.FC<AdminInterfaceProps> = ({ onClose }) => {
  const { actor: mainActor } = useCanister('main');
  const { identity, principal } = useAuth();
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'wallet' | 'economy' | 'debug' | 'financials' | 'notifications' | 'pools' | 'userAdmin' | 'wasmConfig' | 'subscriptions' | 'university' | 'marketplace' | 'forumCategories' | 'platformSettings'>('wallet');
  const [activeDebugTab, setActiveDebugTab] = useState<'overview' | 'sessions' | 'templates' | 'prompts' | 'quality' | 'fileanalysis'>('overview');
  
  // Notification Command Center State
  
  // Platform Wallet State
  const [walletId, setWalletId] = useState<WalletId | null>(null);
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [cycleBalance, setCycleBalance] = useState<bigint>(BigInt(0));
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recipientPrincipal, setRecipientPrincipal] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [conversionRate, setConversionRate] = useState<number>(10.0);
  const [cycleEquivalent, setCycleEquivalent] = useState<bigint>(BigInt(0));
  
  // Debug Session State
  const [isLoading, setIsLoading] = useState(false);
  const [debugSessions, setDebugSessions] = useState<DebugSession[]>([]);
  const [templateAnalytics, setTemplateAnalytics] = useState<TemplateAnalytics[]>([]);
  const [promptAnalytics, setPromptAnalytics] = useState<PromptAnalytics | null>(null);
  const [selectedSession, setSelectedSession] = useState<DebugSession | null>(null);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [sessionAnalysis, setSessionAnalysis] = useState<SessionAnalysis | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const [manualSessionId, setManualSessionId] = useState('');
  // 🔧 NEW: Debug logging toggle state
  const [debugEnabled, setDebugEnabled] = useState(DebugControl.isEnabled());
  // 🔧 NEW: Asset canister and project path configuration
  const [assetCanisterId, setAssetCanisterId] = useState(generationLogger.getAssetCanisterId());
  const [projectPath, setProjectPath] = useState(generationLogger.getProjectPath());
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  
  // File Analysis State
  const [fileAnalyses, setFileAnalyses] = useState<Map<string, FileAnalysis>>(new Map());
  const [selectedFileAnalysis, setSelectedFileAnalysis] = useState<FileAnalysis | null>(null);
  const [fileAnalysisLoading, setFileAnalysisLoading] = useState<string | null>(null);
  
  // Enhanced Debug Interface State
  const [selectedDebugFile, setSelectedDebugFile] = useState<string | null>(null);
  const [debugFileContent, setDebugFileContent] = useState<any>(null);
  const [loadingDebugFile, setLoadingDebugFile] = useState<string | null>(null);
  const [debugViewMode, setDebugViewMode] = useState<'overview' | 'files' | 'analysis' | 'performance'>('overview');
  const [showRawJson, setShowRawJson] = useState(false);
  
  // Common State
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // MAINNET-ONLY Configuration (using configurable values from service)
  const ASSET_CANISTER_ID = assetCanisterId;
  const PROJECT_PATH = projectPath;
  const BASE_URL = `https://${ASSET_CANISTER_ID}.icp0.io/${PROJECT_PATH}/debug-logs`;
  const DEBUG_LOGS_PREFIX = `${PROJECT_PATH}/debug-logs/`;
  const MAINNET_HOST = 'https://icp0.io';

  // =============================================================================
  // PLATFORM WALLET FUNCTIONALITY (keeping existing implementation)
  // =============================================================================

  // Copy to clipboard utility
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess('Address copied to clipboard!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  // Calculate cycle equivalent of ICP balance using proper conversion
  const calculateCycleEquivalent = async (icpBalance: bigint) => {
    try {
      console.log('🔄 [AdminInterface] Calculating cycle equivalent for', formatIcpBalance(icpBalance), 'ICP');
      
      const conversionResult = await icpToCycles(icpBalance, identity);
      
      console.log('✅ [AdminInterface] Conversion result:', {
        cycles: formatCycles(conversionResult.cycles),
        rate: conversionResult.rate
      });
      
      setConversionRate(conversionResult.rate);
      setCycleEquivalent(conversionResult.cycles);
      
      return conversionResult.cycles;
    } catch (error) {
      console.error('❌ [AdminInterface] Error calculating cycle equivalent:', error);
      
      // Fallback calculation with default rate
      const fallbackRate = 10.0; // 10T cycles per ICP
      const fallbackCycles = icpBalance * BigInt(Math.floor(fallbackRate * 1_000_000_000_000)) / BigInt(100_000_000);
      
      setConversionRate(fallbackRate);
      setCycleEquivalent(fallbackCycles);
      
      return fallbackCycles;
    }
  };

  // Load wallet data
  const loadWalletData = async () => {
    if (!mainActor) return;
    
    try {
      setIsLoading(true);
      setError(null);

      console.log('🔄 [AdminInterface] Loading platform wallet data...');

      // Check if platform wallet exists
      const walletResult = await mainActor.getPlatformWalletId();
      
      if (!walletResult || walletResult.length === 0) {
        // No wallet exists, user needs to create one
        console.log('⚠️ [AdminInterface] No platform wallet found');
        setWalletId(null);
        setIsLoading(false);
        return;
      }

      const wallet = walletResult[0];
      setWalletId(wallet);

      console.log('✅ [AdminInterface] Platform wallet found:', wallet.accountIdentifier.substring(0, 8) + '...');

      // Get balances and transactions
      const [balanceResult, cycleBalanceResult, transactionResult] = await Promise.all([
        mainActor.getPlatformBalance(),
        mainActor.getPlatformCycleBalance(),
        mainActor.getPlatformTransactions([BigInt(10)])
      ]);

      const icpBalance = BigInt(balanceResult);
      const currentCycleBalance = BigInt(cycleBalanceResult);
      
      setBalance(icpBalance);
      setCycleBalance(currentCycleBalance);
      setTransactions(transactionResult);

      console.log('💰 [AdminInterface] Balances loaded:', {
        icp: formatIcpBalance(icpBalance),
        cycles: formatCycles(currentCycleBalance)
      });

      // Calculate what the ICP balance would be worth in cycles using real rates
      await calculateCycleEquivalent(icpBalance);

    } catch (err) {
      console.error('❌ [AdminInterface] Error loading wallet data:', err);
      setError(`Failed to load wallet data: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Create platform wallet
  const createWallet = async () => {
    if (!mainActor) return;

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 [AdminInterface] Creating platform wallet...');
      
      const result = await mainActor.createPlatformWallet();
      setSuccess(result);
      
      console.log('✅ [AdminInterface] Platform wallet created:', result);
      
      // Reload wallet data after creation
      setTimeout(() => {
        loadWalletData();
      }, 1000);

    } catch (err) {
      console.error('❌ [AdminInterface] Error creating wallet:', err);
      setError(`Failed to create wallet: ${err}`);
      setIsLoading(false);
    }
  };

  // Send ICP
  const handleSendICP = async () => {
    if (!mainActor || !recipientPrincipal || !sendAmount) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setIsSending(true);
      setError(null);

      console.log('💸 [AdminInterface] Sending', sendAmount, 'ICP to', recipientPrincipal);

      // Convert ICP to e8s
      const amountInE8s = BigInt(Math.floor(Number(sendAmount) * 100_000_000));

      let result;
      
      // Check if recipient is a principal or account ID
      if (recipientPrincipal.length === 64 && /^[0-9a-fA-F]+$/.test(recipientPrincipal)) {
        // Account ID format
        console.log('💳 [AdminInterface] Sending to account ID');
        result = await mainActor.sendICPFromPlatformToAccountId(recipientPrincipal, amountInE8s);
      } else {
        // Principal format
        try {
          // Validate principal format by trying to create Principal
          const principal = recipientPrincipal.trim();
          console.log('👤 [AdminInterface] Sending to principal');
          result = await mainActor.sendICPFromPlatform(principal, amountInE8s);
        } catch (principalError) {
          setError('Invalid recipient format. Please enter a valid principal ID or account ID.');
          return;
        }
      }

      if ('ok' in result) {
        console.log('✅ [AdminInterface] ICP sent successfully:', result.ok);
        setSuccess(`Successfully sent ${sendAmount} ICP: ${result.ok}`);
        setRecipientPrincipal('');
        setSendAmount('');
        
        // Reload wallet data
        setTimeout(() => {
          loadWalletData();
        }, 2000);
      } else if ('err' in result) {
        console.error('❌ [AdminInterface] Transaction failed:', result.err);
        setError(`Transaction failed: ${result.err}`);
      }

    } catch (err) {
      console.error('❌ [AdminInterface] Error sending ICP:', err);
      setError(`Failed to send ICP: ${err}`);
    } finally {
      setIsSending(false);
    }
  };

  // =============================================================================
  // DEBUG SESSION FUNCTIONALITY - ENHANCED WITH DEEP ANALYSIS
  // =============================================================================

  // Enhanced session discovery using mainnet-only approach
  const loadDebugSessions = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔍 [AdminInterface] Loading debug sessions (mainnet-only)');
      console.log('🔍 [AdminInterface] Looking for sessions in:', DEBUG_LOGS_PREFIX);
      
      const sessions: DebugSession[] = [];
      
      // 1. Get active sessions from GenerationLoggingService (these are still in progress)
      const activeSessions = generationLogger.getActiveSessions();
      console.log('🔍 Active sessions from GenerationLoggingService:', activeSessions);
      
      activeSessions.forEach(sessionId => {
        const timestamp = parseInt(sessionId.split('_')[1]) || Date.now();
        sessions.push({
          sessionId,
          timestamp,
          userPrompt: 'Active session - data being captured...',
          templateUsed: 'Unknown (in progress)',
          success: undefined,
          totalFiles: 0,
          duration: undefined,
          confidence: undefined,
          urls: {
            completeSession: `${BASE_URL}/${sessionId}/generation-summary.json`,
            userPrompt: `${BASE_URL}/${sessionId}/user-prompt.json`,
            templateRouting: `${BASE_URL}/${sessionId}/template-routing.json`,
            backendGeneration: `${BASE_URL}/${sessionId}/generation-backend.json`,
            frontendGeneration: `${BASE_URL}/${sessionId}/generation-frontend.json`,
            fileExtraction: `${BASE_URL}/${sessionId}/file-extraction.json`,
            generationSummary: `${BASE_URL}/${sessionId}/generation-summary.json`
          }
        });
      });

      // 2. Discover completed sessions using mainnet AssetManager
      const completedSessions = await discoverCompletedSessionsMainnet();
      sessions.push(...completedSessions);

      // 3. Remove duplicates and sort by timestamp
      const uniqueSessions = sessions.filter((session, index, self) => 
        index === self.findIndex(s => s.sessionId === session.sessionId)
      ).sort((a, b) => b.timestamp - a.timestamp);

      setDebugSessions(uniqueSessions);
      
      if (uniqueSessions.length === 0) {
        console.log(`ℹ️ No debug sessions found. Sessions will appear here after project generations with debug logging enabled.`);
      } else {
        console.log(`✅ Found ${uniqueSessions.length} debug sessions (${activeSessions.length} active, ${completedSessions.length} completed)`);
        
        // Calculate analytics from discovered sessions
        await calculateAnalytics(uniqueSessions);
      }
      
    } catch (error) {
      console.error('❌ [AdminInterface] Failed to load debug sessions:', error);
      setError(`Failed to load debug sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // MAINNET-ONLY session discovery using AssetManager - FIXED VERSION
  const discoverCompletedSessionsMainnet = async (): Promise<DebugSession[]> => {
    const discoveredSessions: DebugSession[] = [];
    
    try {
      console.log('📂 [AdminInterface] Using mainnet AssetManager to discover debug sessions...');
      
      if (!identity) {
        console.warn('⚠️ [AdminInterface] No identity available for asset manager setup');
        return discoveredSessions;
      }

      // Setup AssetManager for mainnet-only operation
      const agent = new HttpAgent({
        identity: identity,
        host: MAINNET_HOST
      });

      const assetManager = new AssetManager({
        canisterId: Principal.fromText(ASSET_CANISTER_ID),
        agent
      });

      console.log('✅ [AdminInterface] Mainnet AssetManager initialized for session discovery');

      // Get list of all assets from mainnet
      const assetList = await assetManager.list();
      console.log('📂 [AdminInterface] Retrieved asset list from mainnet, total assets:', assetList.length);

      if (!Array.isArray(assetList)) {
        console.error('❌ [AdminInterface] Asset list is not an array:', assetList);
        return discoveredSessions;
      }

      // Process assets to find debug session folders - IMPROVED LOGIC
      const sessionFolders = new Set<string>();
      const debugSessionPaths = new Set<string>();

      console.log('🔍 [AdminInterface] Analyzing all assets for debug session patterns...');
      
      for (const asset of assetList) {
        let key = "";

        // Handle different potential asset structures
        if (typeof asset === 'string') {
          key = asset;
        } else if (asset && typeof asset === 'object') {
          if ('key' in asset && typeof asset.key === 'string') {
            key = asset.key;
          } else if (asset.toString && typeof asset.toString === 'function') {
            key = asset.toString();
          } else {
            continue; // Skip this asset
          }
        } else {
          continue; // Skip this asset
        }

        // Debug: Log a few example paths to see what we're working with
        if (debugSessionPaths.size < 10 && key.includes('debug-logs')) {
          debugSessionPaths.add(key);
          console.log('🔍 [AdminInterface] Example debug path found:', key);
        }

        // Check if the key is in our debug logs directory (more flexible matching)
        if (key.includes(`${PROJECT_PATH}/debug-logs/`) && key.includes('gen_')) {
          // Extract the session ID from the path
          const debugLogsIndex = key.indexOf(`${PROJECT_PATH}/debug-logs/`);
          if (debugLogsIndex !== -1) {
            const afterDebugLogs = key.substring(debugLogsIndex + `${PROJECT_PATH}/debug-logs/`.length);
            const pathParts = afterDebugLogs.split('/');
            const sessionFolderName = pathParts[0];

            // Check if this looks like a session folder (starts with "gen_")
            if (sessionFolderName && sessionFolderName.startsWith('gen_') && sessionFolderName.includes('_')) {
              sessionFolders.add(sessionFolderName);
              console.log(`📁 [AdminInterface] Found debug session folder: ${sessionFolderName} from path: ${key}`);
            }
          }
        }
      }

      console.log(`📊 [AdminInterface] Debug session analysis complete. Found paths with debug-logs:`, debugSessionPaths.size);
      console.log(`📊 [AdminInterface] Mainnet discovery found ${sessionFolders.size} session folders`);
      
      if (sessionFolders.size === 0) {
        console.log('🔍 [AdminInterface] No session folders found. Let me try a broader search...');
        
        // Fallback: Look for any path containing gen_ and debug
        for (const asset of assetList) {
          let key = "";
          if (typeof asset === 'string') {
            key = asset;
          } else if (asset && typeof asset === 'object' && 'key' in asset) {
            key = String(asset.key);
          }
          
          if (key.includes('gen_') && key.includes('debug') && key.includes(PROJECT_PATH)) {
            console.log('🔍 [AdminInterface] Broad search found potential session file:', key);
            
            // Extract session ID pattern
            const genMatch = key.match(/gen_\d+_[a-zA-Z0-9]+/);
            if (genMatch) {
              sessionFolders.add(genMatch[0]);
              console.log(`📁 [AdminInterface] Extracted session folder from broad search: ${genMatch[0]}`);
            }
          }
        }
        
        console.log(`📊 [AdminInterface] After broad search: ${sessionFolders.size} session folders`);
      }

      // Process each discovered session folder
      for (const sessionId of sessionFolders) {
        try {
          console.log(`🔄 [AdminInterface] Processing session: ${sessionId}`);
          
          // Extract timestamp from session ID
          const timestampMatch = sessionId.match(/gen_(\d+)_/);
          const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : Date.now();

          // Try to load the generation summary for metadata from mainnet
          const summaryUrl = `${BASE_URL}/${sessionId}/generation-summary.json`;
          
          try {
            console.log(`🔍 [AdminInterface] Attempting to fetch summary from: ${summaryUrl}`);
            
            const response = await fetch(summaryUrl, { 
              method: 'GET',
              cache: 'no-cache'
            });
            
            if (response.ok) {
              const summaryData = await response.json();
              console.log(`✅ [AdminInterface] Loaded metadata for session: ${sessionId}`, summaryData);
              
              discoveredSessions.push({
                sessionId,
                timestamp,
                userPrompt: summaryData.userPrompt || 'Completed session',
                templateUsed: summaryData.template?.name || 'Unknown',
                success: summaryData.success,
                totalFiles: summaryData.results?.totalFiles || 0,
                duration: summaryData.performance?.totalTime || 0,
                confidence: summaryData.template?.confidence || 0,
                urls: {
                  completeSession: summaryUrl,
                  userPrompt: `${BASE_URL}/${sessionId}/user-prompt.json`,
                  templateRouting: `${BASE_URL}/${sessionId}/template-routing.json`,
                  backendGeneration: `${BASE_URL}/${sessionId}/generation-backend.json`,
                  frontendGeneration: `${BASE_URL}/${sessionId}/generation-frontend.json`,
                  fileExtraction: `${BASE_URL}/${sessionId}/file-extraction.json`,
                  generationSummary: summaryUrl
                }
              });
            } else {
              console.log(`⚠️ [AdminInterface] Session ${sessionId} summary returned ${response.status}, adding basic entry`);
              
              // Session folder exists but no summary file - add basic entry
              discoveredSessions.push({
                sessionId,
                timestamp,
                userPrompt: 'Session data incomplete',
                templateUsed: 'Unknown',
                success: undefined,
                totalFiles: 0,
                duration: undefined,
                confidence: undefined,
                urls: {
                  completeSession: summaryUrl,
                  userPrompt: `${BASE_URL}/${sessionId}/user-prompt.json`,
                  templateRouting: `${BASE_URL}/${sessionId}/template-routing.json`,
                  backendGeneration: `${BASE_URL}/${sessionId}/generation-backend.json`,
                  frontendGeneration: `${BASE_URL}/${sessionId}/generation-frontend.json`,
                  fileExtraction: `${BASE_URL}/${sessionId}/file-extraction.json`,
                  generationSummary: summaryUrl
                }
              });
            }
          } catch (summaryError) {
            console.warn(`⚠️ [AdminInterface] Could not load summary for ${sessionId}:`, summaryError);
            
            // Still add the session even if we can't load the summary
            discoveredSessions.push({
              sessionId,
              timestamp,
              userPrompt: 'Summary unavailable',
              templateUsed: 'Unknown',
              success: undefined,
              totalFiles: 0,
              duration: undefined,
              confidence: undefined,
              urls: {
                completeSession: summaryUrl,
                userPrompt: `${BASE_URL}/${sessionId}/user-prompt.json`,
                templateRouting: `${BASE_URL}/${sessionId}/template-routing.json`,
                backendGeneration: `${BASE_URL}/${sessionId}/generation-backend.json`,
                frontendGeneration: `${BASE_URL}/${sessionId}/generation-frontend.json`,
                fileExtraction: `${BASE_URL}/${sessionId}/file-extraction.json`,
                generationSummary: summaryUrl
              }
            });
          }
        } catch (sessionError) {
          console.error(`❌ [AdminInterface] Error processing session ${sessionId}:`, sessionError);
        }
      }

      console.log(`✅ [AdminInterface] Mainnet discovery completed: found ${discoveredSessions.length} completed sessions`);
      return discoveredSessions;
      
    } catch (error) {
      console.error('❌ [AdminInterface] Failed to discover sessions using mainnet AssetManager:', error);
      return discoveredSessions;
    }
  };

  // Manual session addition for debugging
  const addManualSession = async () => {
    if (!manualSessionId.trim()) {
      setError('Please enter a session ID');
      return;
    }

    const sessionId = manualSessionId.trim();
    console.log(`🔍 [AdminInterface] Manually adding session: ${sessionId}`);

    try {
      const testUrl = `${BASE_URL}/${sessionId}/generation-summary.json`;
      console.log(`🔍 [AdminInterface] Testing manual session URL: ${testUrl}`);
      
      const response = await fetch(testUrl);
      
      if (response.ok) {
        const summaryData = await response.json();
        console.log(`✅ [AdminInterface] Manual session data loaded:`, summaryData);
        
        const manualSession: DebugSession = {
          sessionId,
          timestamp: summaryData.timestamp || Date.now(),
          userPrompt: summaryData.userPrompt || 'Manually added session',
          templateUsed: summaryData.template?.name || 'Unknown',
          success: summaryData.success,
          totalFiles: summaryData.results?.totalFiles || 0,
          duration: summaryData.performance?.totalTime || 0,
          confidence: summaryData.template?.confidence || 0,
          urls: {
            completeSession: testUrl,
            userPrompt: `${BASE_URL}/${sessionId}/user-prompt.json`,
            templateRouting: `${BASE_URL}/${sessionId}/template-routing.json`,
            backendGeneration: `${BASE_URL}/${sessionId}/generation-backend.json`,
            frontendGeneration: `${BASE_URL}/${sessionId}/generation-frontend.json`,
            fileExtraction: `${BASE_URL}/${sessionId}/file-extraction.json`,
            generationSummary: testUrl
          }
        };

        // Add to existing sessions if not already present
        const existingIndex = debugSessions.findIndex(s => s.sessionId === sessionId);
        if (existingIndex >= 0) {
          // Update existing
          const updatedSessions = [...debugSessions];
          updatedSessions[existingIndex] = manualSession;
          setDebugSessions(updatedSessions);
          setSuccess(`Session ${sessionId} updated successfully`);
        } else {
          // Add new
          setDebugSessions(prev => [manualSession, ...prev].sort((a, b) => b.timestamp - a.timestamp));
          setSuccess(`Session ${sessionId} added successfully`);
        }
        
        setManualSessionId('');
      } else {
        console.log(`❌ [AdminInterface] Manual session not found. Response status: ${response.status}`);
        setError(`Session ${sessionId} not found or invalid (HTTP ${response.status})`);
      }
    } catch (error) {
      console.error('❌ [AdminInterface] Failed to add manual session:', error);
      setError(`Failed to add session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Calculate analytics from real sessions
  const calculateAnalytics = async (sessions: DebugSession[]) => {
    try {
      // Template Analytics
      const templateMap = new Map<string, {
        count: number;
        successes: number;
        totalConfidence: number;
        totalFiles: number;
        totalDuration: number;
        prompts: string[];
      }>();

      sessions.forEach(session => {
        if (session.templateUsed) {
          const existing = templateMap.get(session.templateUsed) || {
            count: 0,
            successes: 0,
            totalConfidence: 0,
            totalFiles: 0,
            totalDuration: 0,
            prompts: []
          };
          
          existing.count++;
          if (session.success) existing.successes++;
          if (session.confidence) existing.totalConfidence += session.confidence;
          if (session.totalFiles) existing.totalFiles += session.totalFiles;
          if (session.duration) existing.totalDuration += session.duration;
          if (session.userPrompt) existing.prompts.push(session.userPrompt);
          
          templateMap.set(session.templateUsed, existing);
        }
      });

      const templateAnalytics: TemplateAnalytics[] = Array.from(templateMap.entries()).map(([name, data]) => ({
        templateName: name,
        usageCount: data.count,
        successRate: data.count > 0 ? data.successes / data.count : 0,
        averageConfidence: data.count > 0 ? data.totalConfidence / data.count : 0,
        averageFiles: data.count > 0 ? data.totalFiles / data.count : 0,
        averageDuration: data.count > 0 ? data.totalDuration / data.count : 0,
        commonPromptPatterns: data.prompts.slice(0, 3)
      }));

      setTemplateAnalytics(templateAnalytics);

      // Prompt Analytics
      const allPrompts = sessions.filter(s => s.userPrompt).map(s => s.userPrompt!);
      const successfulPrompts = sessions.filter(s => s.success && s.userPrompt);
      
      setPromptAnalytics({
        totalPrompts: allPrompts.length,
        successfulPrompts: successfulPrompts.length,
        averageLength: allPrompts.reduce((sum, p) => sum + p.length, 0) / allPrompts.length || 0,
        commonKeywords: extractCommonKeywords(allPrompts),
        topFailureReasons: ['Template routing failed', 'File extraction error', 'Network timeout']
      });

    } catch (error) {
      console.error('❌ [AdminInterface] Failed to calculate analytics:', error);
    }
  };

  // Extract common keywords from prompts
  const extractCommonKeywords = (prompts: string[]): string[] => {
    const words = prompts.join(' ').toLowerCase().split(/\s+/);
    const wordCount = new Map<string, number>();
    
    words.forEach(word => {
      if (word.length > 3) {
        wordCount.set(word, (wordCount.get(word) || 0) + 1);
      }
    });
    
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  };

  // ======== FILE ANALYSIS FUNCTIONALITY ========

  // Comprehensive file analysis for a session
  const analyzeSessionFiles = async (session: DebugSession): Promise<FileAnalysis> => {
    setFileAnalysisLoading(session.sessionId);
    
    try {
      console.log(`📁 [AdminInterface] Starting comprehensive file analysis for session: ${session.sessionId}`);
      
      // Load session data to get file information
      const sessionData: any = { sessionId: session.sessionId, files: {} };
      const fileTypes = ['fileExtraction', 'generationSummary'];
      
      for (const fileType of fileTypes) {
        const url = session.urls[fileType as keyof typeof session.urls];
        if (url) {
          try {
            const fileResponse = await fetch(url);
            if (fileResponse.ok) {
              const fileData = await fileResponse.json();
              sessionData.files[fileType] = fileData;
            }
          } catch (fileError) {
            console.warn(`⚠️ Could not load ${fileType}:`, fileError);
          }
        }
      }
      
      // Extract generated files from session data
      const generatedFiles: GeneratedFile[] = [];
      const extractionData = sessionData.files.fileExtraction;
      const summaryData = sessionData.files.generationSummary;
      
      // Get files from different sources
      const allFileNames = new Set<string>();
      
      if (extractionData?.backendFiles) {
        extractionData.backendFiles.forEach((fileName: string) => allFileNames.add(fileName));
      }
      if (extractionData?.frontendFiles) {
        extractionData.frontendFiles.forEach((fileName: string) => allFileNames.add(fileName));
      }
      if (extractionData?.filesByType) {
        Object.values(extractionData.filesByType).flat().forEach((fileName: string) => allFileNames.add(fileName));
      }
      
      // Analyze each generated file
      Array.from(allFileNames).forEach(fileName => {
        const file: GeneratedFile = {
          fileName,
          category: categorizeFile(fileName),
          size: 0, // Could be populated from actual file content
          isComplete: true, // Could be analyzed from file content
          hasValidStructure: true, // Could be analyzed from file content
          templateCompliant: true // Could be analyzed against template expectations
        };
        generatedFiles.push(file);
      });
      
      // Check platform provided files
      const platformProvidedFiles: PlatformFile[] = PLATFORM_PROVIDED_FILES.map(fileName => ({
        fileName,
        expected: true,
        present: false, // Would need to check actual project state
        category: categorizeFile(fileName)
      }));
      
      // Analyze requirements completeness
      const requiredFiles = PROJECT_FILE_REQUIREMENTS;
      const issues: FileIssue[] = [];
      const recommendations: string[] = [];
      
      // Check critical requirements
      const criticalMissing = requiredFiles.filter(req => 
        req.required && !checkFileRequirement(req, generatedFiles)
      );
      
      criticalMissing.forEach(missing => {
        issues.push({
          severity: 'critical',
          category: missing.category,
          issue: `Missing required file: ${missing.fileName || missing.filePattern}`,
          impact: 'Project will not compile or deploy properly',
          suggestion: `Ensure ${missing.description} is generated`
        });
      });
      
      // Check template-specific requirements
      if (session.templateUsed && session.templateUsed !== 'Unknown') {
        const templateSpecificReqs = requiredFiles.filter(req => req.templateSpecific);
        templateSpecificReqs.forEach(req => {
          if (!checkFileRequirement(req, generatedFiles)) {
            issues.push({
              severity: 'warning',
              category: req.category,
              issue: `Missing template-specific file: ${req.fileName || req.filePattern}`,
              impact: 'Generated code may not follow template patterns',
              suggestion: `Check if ${req.description} should be included for ${session.templateUsed} template`
            });
          }
        });
      }
      
      // Calculate scores
      const totalRequiredFiles = requiredFiles.filter(r => r.required).length;
      const presentRequiredFiles = requiredFiles.filter(r => 
        r.required && checkFileRequirement(r, generatedFiles)
      ).length;
      
      const completenessScore = totalRequiredFiles > 0 ? presentRequiredFiles / totalRequiredFiles : 0;
      const deploymentReadiness = criticalMissing.length === 0 ? 
        (completenessScore > 0.8 ? 0.9 : 0.6) : 0.3;
      
      // Analyze template adherence
      const templateAdherence: TemplateAdherence = {
        templateName: session.templateUsed || 'Unknown',
        overallScore: session.confidence || 0.5,
        backendCompliance: 0.8, // Would need actual analysis
        frontendCompliance: 0.7, // Would need actual analysis
        structuralCompliance: completenessScore,
        deviations: [] // Would need template comparison
      };
      
      // Generate recommendations
      if (completenessScore < 0.8) {
        recommendations.push('Consider regenerating project with more specific requirements');
      }
      if (generatedFiles.filter(f => f.category === 'frontend').length < 3) {
        recommendations.push('Frontend appears incomplete - may need additional React components');
      }
      if (generatedFiles.filter(f => f.category === 'backend').length < 2) {
        recommendations.push('Backend appears minimal - consider adding more Motoko modules');
      }
      
      const analysis: FileAnalysis = {
        sessionId: session.sessionId,
        templateName: session.templateUsed,
        requiredFiles,
        generatedFiles,
        platformProvidedFiles,
        completenessScore,
        deploymentReadiness,
        issues,
        recommendations,
        templateAdherence
      };
      
      console.log(`✅ [AdminInterface] File analysis complete for session ${session.sessionId}:`, {
        completenessScore: Math.round(completenessScore * 100) + '%',
        deploymentReadiness: Math.round(deploymentReadiness * 100) + '%',
        issues: issues.length,
        totalFiles: generatedFiles.length
      });
      
      return analysis;
      
    } catch (error) {
      console.error(`❌ [AdminInterface] File analysis failed for session ${session.sessionId}:`, error);
      
      // Return minimal analysis on error
      return {
        sessionId: session.sessionId,
        templateName: session.templateUsed,
        requiredFiles: PROJECT_FILE_REQUIREMENTS,
        generatedFiles: [],
        platformProvidedFiles: [],
        completenessScore: 0,
        deploymentReadiness: 0,
        issues: [{
          severity: 'critical',
          category: 'analysis',
          issue: 'File analysis failed',
          impact: 'Cannot determine project completeness',
          suggestion: 'Try analyzing the session again or check debug data manually'
        }],
        recommendations: ['File analysis failed - manual review recommended'],
        templateAdherence: {
          templateName: session.templateUsed || 'Unknown',
          overallScore: 0,
          backendCompliance: 0,
          frontendCompliance: 0,
          structuralCompliance: 0,
          deviations: []
        }
      };
    } finally {
      setFileAnalysisLoading(null);
    }
  };
  
  // Helper function to categorize files
  const categorizeFile = (fileName: string): 'backend' | 'frontend' | 'config' | 'core' => {
    if (fileName.endsWith('.mo') || fileName.endsWith('.did')) return 'backend';
    if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) return 'frontend';
    if (fileName.includes('config') || fileName.includes('package.json') || fileName.includes('tsconfig')) return 'config';
    return 'core';
  };
  
  // Helper function to check if a file requirement is met
  const checkFileRequirement = (requirement: FileRequirement, generatedFiles: GeneratedFile[]): boolean => {
    if (requirement.fileName) {
      return generatedFiles.some(f => f.fileName === requirement.fileName);
    }
    if (requirement.filePattern) {
      const regex = new RegExp(requirement.filePattern);
      return generatedFiles.some(f => regex.test(f.fileName));
    }
    return false;
  };

  // Load file analysis for a session
  const loadFileAnalysis = async (session: DebugSession) => {
    const existingAnalysis = fileAnalyses.get(session.sessionId);
    if (existingAnalysis) {
      setSelectedFileAnalysis(existingAnalysis);
      return;
    }
    
    const analysis = await analyzeSessionFiles(session);
    
    setFileAnalyses(prev => new Map(prev.set(session.sessionId, analysis)));
    setSelectedFileAnalysis(analysis);
  };

  // ======== ENHANCED DEBUG SESSION ANALYSIS FUNCTIONS (keeping existing) ========

  // Load comprehensive session details with analysis
  const loadSessionDetails = async (session: DebugSession) => {
    try {
      setIsLoading(true);
      console.log('📄 [AdminInterface] Loading comprehensive session details:', session.sessionId);
      
      setSelectedSession(session);
      setDebugViewMode('overview');
      setSessionDetails(null);
      setSessionAnalysis(null);
      
      // Load all available session files
      const sessionData: any = { sessionId: session.sessionId, files: {} };
      const fileTypes = ['userPrompt', 'templateRouting', 'backendGeneration', 'frontendGeneration', 'fileExtraction', 'generationSummary'];
      
      for (const fileType of fileTypes) {
        const url = session.urls[fileType as keyof typeof session.urls];
        if (url) {
          try {
            console.log(`📥 Loading ${fileType} from: ${url}`);
            const fileResponse = await fetch(url);
            if (fileResponse.ok) {
              const fileData = await fileResponse.json();
              sessionData.files[fileType] = fileData;
              console.log(`✅ Loaded ${fileType}: ${JSON.stringify(fileData).length} chars`);
            } else {
              console.warn(`⚠️ Could not load ${fileType} (${fileResponse.status})`);
              sessionData.files[fileType] = { error: `HTTP ${fileResponse.status}` };
            }
          } catch (fileError) {
            console.warn(`❌ Error loading ${fileType}:`, fileError);
            sessionData.files[fileType] = { error: fileError instanceof Error ? fileError.message : 'Unknown error' };
          }
        }
      }
      
      setSessionDetails(sessionData);
      
      // Perform comprehensive session analysis
      const analysis = await analyzeSession(session, sessionData);
      setSessionAnalysis(analysis);
      
    } catch (error) {
      console.error('❌ [AdminInterface] Failed to load session details:', error);
      setError(`Failed to load session details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Comprehensive session analysis
  const analyzeSession = async (session: DebugSession, sessionData: any): Promise<SessionAnalysis> => {
    console.log('🔍 [AdminInterface] Performing comprehensive session analysis...');
    
    const analysis: SessionAnalysis = {
      sessionId: session.sessionId,
      phase: 'healthy',
      issues: [],
      insights: [],
      performance: {
        routingTime: 0,
        backendTime: 0,
        frontendTime: 0,
        totalTime: session.duration || 0,
        efficiency: 'good'
      },
      quality: {
        templateMatch: session.confidence || 0,
        codeCompleteness: 0.8,
        userSatisfaction: 'predicted-medium'
      }
    };

    try {
      // Analyze performance from session data
      if (sessionData.files.generationSummary?.performance) {
        const perf = sessionData.files.generationSummary.performance;
        analysis.performance = {
          routingTime: perf.routingTime || 0,
          backendTime: perf.backendTime || 0,
          frontendTime: perf.frontendTime || 0,
          totalTime: perf.totalTime || session.duration || 0,
          efficiency: perf.totalTime < 30000 ? 'excellent' : perf.totalTime < 60000 ? 'good' : 'poor'
        };
      }

      // Analyze template routing
      if (sessionData.files.templateRouting) {
        const routing = sessionData.files.templateRouting;
        if (routing.confidence > 0.8) {
          analysis.insights.push('🎯 High confidence template routing - excellent match');
        } else if (routing.confidence < 0.6) {
          analysis.issues.push('⚠️ Low template confidence - may need manual review');
          analysis.phase = 'warning';
        }
        
        if (routing.fallbackUsed) {
          analysis.issues.push('🔄 Fallback routing was used - template may not exist');
          analysis.phase = 'warning';
        }
      }

      // Analyze generation quality
      if (sessionData.files.backendGeneration) {
        const backend = sessionData.files.backendGeneration;
        if (backend.success && backend.responseLength > 5000) {
          analysis.insights.push('🏗️ Substantial backend code generated');
          analysis.quality.codeCompleteness += 0.1;
        }
        
        if (!backend.success) {
          analysis.issues.push('❌ Backend generation failed');
          analysis.phase = 'error';
          analysis.quality.codeCompleteness -= 0.3;
        }
      }

      if (sessionData.files.frontendGeneration) {
        const frontend = sessionData.files.frontendGeneration;
        if (frontend.success && frontend.responseLength > 8000) {
          analysis.insights.push('🎨 Comprehensive frontend interface generated');
          analysis.quality.codeCompleteness += 0.1;
        }
        
        if (!frontend.success) {
          analysis.issues.push('❌ Frontend generation failed');
          analysis.phase = 'error';
          analysis.quality.codeCompleteness -= 0.3;
        }
      }

      // Analyze file extraction
      if (sessionData.files.fileExtraction) {
        const extraction = sessionData.files.fileExtraction;
        if (extraction.totalFiles > 10) {
          analysis.insights.push(`📁 Rich project structure: ${extraction.totalFiles} files extracted`);
        } else if (extraction.totalFiles < 3) {
          analysis.issues.push('📁 Limited file extraction - may indicate incomplete generation');
          analysis.phase = 'warning';
        }
        
        if (extraction.parsingErrors && extraction.parsingErrors.length > 0) {
          analysis.issues.push(`🚨 ${extraction.parsingErrors.length} file parsing errors detected`);
          analysis.phase = 'warning';
        }
      }

      // Overall quality assessment
      if (analysis.quality.codeCompleteness > 0.9 && analysis.performance.efficiency === 'excellent') {
        analysis.quality.userSatisfaction = 'predicted-high';
      } else if (analysis.quality.codeCompleteness < 0.6 || analysis.issues.length > 2) {
        analysis.quality.userSatisfaction = 'predicted-low';
      }

      // Final phase determination
      if (analysis.issues.length === 0 && session.success) {
        analysis.phase = 'healthy';
      } else if (analysis.issues.some(issue => issue.includes('failed'))) {
        analysis.phase = 'error';
      }

    } catch (analysisError) {
      console.warn('⚠️ Error during session analysis:', analysisError);
      analysis.issues.push('🔧 Analysis incomplete due to data parsing errors');
    }

    console.log('✅ Session analysis complete:', analysis);
    return analysis;
  };

  // Load individual debug file content
  const loadDebugFile = async (fileName: string, url: string) => {
    if (loadingDebugFile === fileName) return; // Prevent double loading
    
    try {
      setLoadingDebugFile(fileName);
      setSelectedDebugFile(fileName);
      setDebugFileContent(null);
      
      console.log(`📄 Loading debug file: ${fileName} from ${url}`);
      
      const response = await fetch(url, { cache: 'no-cache' });
      if (response.ok) {
        const content = await response.json();
        setDebugFileContent(content);
        console.log(`✅ Debug file loaded: ${fileName} (${JSON.stringify(content).length} chars)`);
      } else {
        console.error(`❌ Failed to load ${fileName}: HTTP ${response.status}`);
        setDebugFileContent({ error: `HTTP ${response.status}: ${response.statusText}` });
      }
    } catch (error) {
      console.error(`❌ Error loading debug file ${fileName}:`, error);
      setDebugFileContent({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoadingDebugFile(null);
    }
  };

  // Format file content for display
  const formatFileContent = (content: any, fileName: string): string => {
    if (!content) return 'Loading...';
    
    if (content.error) {
      return `Error loading ${fileName}: ${content.error}`;
    }
    
    try {
      return JSON.stringify(content, null, 2);
    } catch {
      return String(content);
    }
  };

  // Get file size in human readable format
  const getFileSize = (content: any): string => {
    if (!content) return '0 B';
    try {
      const jsonString = JSON.stringify(content);
      const bytes = new TextEncoder().encode(jsonString).length;
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } catch {
      return 'Unknown';
    }
  };

  // Delete debug session - mainnet only
  const deleteDebugSession = async (sessionId: string) => {
    if (!identity) {
      setError('Identity required for deletion operations');
      return;
    }

    setDeletingSessionId(sessionId);
    setError(null);
    
    try {
      console.log('🗑️ [AdminInterface] Starting deletion of debug session:', sessionId);
      
      const agent = new HttpAgent({
        identity: identity,
        host: MAINNET_HOST
      });

      const assetManager = new AssetManager({
        canisterId: Principal.fromText(ASSET_CANISTER_ID),
        agent: agent,
      });

      const debugFiles = [
        'user-prompt.json',
        'template-routing.json',
        'generation-backend.json',
        'generation-frontend.json',
        'file-extraction.json',
        'processing-steps.json',
        'generation-summary.json'
      ];

      let deletedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const fileName of debugFiles) {
        try {
          const filePath = `${PROJECT_PATH}/debug-logs/${sessionId}/${fileName}`;
          console.log(`🗑️ Deleting file from mainnet: ${filePath}`);
          
          await assetManager.delete([filePath]);
          deletedCount++;
          console.log(`✅ Deleted from mainnet: ${filePath}`);
        } catch (fileError) {
          errorCount++;
          const errorMsg = fileError instanceof Error ? fileError.message : 'Unknown error';
          errors.push(`${fileName}: ${errorMsg}`);
          console.warn(`⚠️ Could not delete ${fileName}:`, errorMsg);
        }
      }

      if (deletedCount > 0) {
        setSuccess(`Successfully deleted ${deletedCount} files from session ${sessionId}${errorCount > 0 ? ` (${errorCount} files could not be deleted)` : ''}`);
        
        setDebugSessions(prev => prev.filter(s => s.sessionId !== sessionId));
        
        if (selectedSession?.sessionId === sessionId) {
          setSelectedSession(null);
          setSessionDetails(null);
          setSessionAnalysis(null);
        }
        
        console.log(`✅ Debug session ${sessionId} deleted successfully from mainnet`);
      } else {
        setError(`Could not delete any files from session ${sessionId}. Errors: ${errors.join(', ')}`);
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown deletion error';
      console.error('❌ [AdminInterface] Failed to delete debug session:', error);
      setError(`Failed to delete debug session: ${errorMsg}`);
    } finally {
      setDeletingSessionId(null);
      setDeleteConfirmation(null);
    }
  };

  // Test debug capture - mainnet only
  const testDebugCapture = async () => {
    try {
      console.log('🧪 [AdminInterface] Testing debug capture system (mainnet-only)...');
      setError(null);
      
      if (identity) {
        const debugContext = await generationLogger.initializeDebugSession('test_' + Date.now(), identity);
        
        debugContext.captureUserPrompt({
          sessionId: debugContext.sessionId,
          timestamp: Date.now(),
          userInput: 'Create a test application for debug capture (mainnet)',
          projectId: 'project-mfwz2yjm-s0hxe',
          projectName: 'Main Application Project',
          requestContext: {
            hasExistingFiles: false,
            fileCount: 0,
            requestType: 'create_project'
          }
        });

        debugContext.captureTemplateRouting({
          sessionId: debugContext.sessionId,
          timestamp: Date.now(),
          routingStartTime: Date.now() - 1000,
          routingEndTime: Date.now(),
          selectedTemplate: 'SimpleCrudAuth',
          confidence: 0.85,
          reasoning: 'Test debug capture with authentication patterns (mainnet)',
          alternatives: ['SimpleCrudPublic', 'MultiEntityRelationships'],
          clarificationQuestions: undefined,
          fallbackUsed: false,
          fallbackReason: undefined
        });

        debugContext.captureGenerationSummary({
          sessionId: debugContext.sessionId,
          timestamp: Date.now(),
          startTime: Date.now() - 5000,
          endTime: Date.now(),
          totalDuration: 5000,
          success: true,
          
          userPrompt: 'Create a test application for debug capture (mainnet)',
          projectContext: {
            projectId: 'project-mfwz2yjm-s0hxe',
            projectName: 'Main Application Project',
            hasExistingFiles: false
          },
          
          template: {
            name: 'SimpleCrudAuth',
            confidence: 0.85,
            routingTime: 1000,
            fetchingTime: 500,
            fallbackUsed: false
          },
          
          performance: {
            totalTime: 5000,
            routingTime: 1000,
            fetchingTime: 500,
            backendTime: 2000,
            frontendTime: 1500,
            extractionTime: 100
          },
          
          results: {
            totalFiles: 8,
            backendFiles: 3,
            frontendFiles: 5,
            candidGenerated: true,
            platformFilesIntegrated: true
          },
          
          quality: {
            templateAdherence: 'high',
            codeCompleteness: 1.0,
            extractionAccuracy: 1.0,
            userSatisfactionPredicted: 'high'
          }
        });
        
        await debugContext.persistAllData();
        
        console.log('✅ [AdminInterface] Debug capture test completed successfully (mainnet)');
        setSuccess(`Debug capture test completed successfully on mainnet! Session ID: ${debugContext.sessionId}`);
        
        // Wait a moment then reload sessions
        setTimeout(() => {
          loadDebugSessions();
        }, 2000);
      } else {
        setError('Identity required for debug capture testing');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown test error';
      console.error('❌ [AdminInterface] Debug capture test failed:', error);
      setError(`Debug capture test failed: ${errorMsg}`);
    }
  };

  // Refresh data based on active tab
  const refreshData = () => {
    if (activeTab === 'wallet') {
      console.log('🔄 [AdminInterface] Refreshing wallet data (mainnet)...');
      loadWalletData();
    } else if (activeTab === 'debug') {
      console.log('🔄 [AdminInterface] Refreshing debug sessions (mainnet)...');
      loadDebugSessions();
    }
    // Other tabs don't have refresh logic yet
  };

  // 🔧 NEW: Sync debug status on mount and when tab changes
  useEffect(() => {
    setDebugEnabled(DebugControl.isEnabled());
    setAssetCanisterId(generationLogger.getAssetCanisterId());
    setProjectPath(generationLogger.getProjectPath());
  }, [activeTab]);

  // Auto-clear messages
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Load data based on active tab (lazy loading)
  useEffect(() => {
    if (activeTab === 'wallet' && mainActor) {
      loadWalletData();
    } else if (activeTab === 'debug') {
      // 🚀 PERFORMANCE: Only load debug sessions when Debug Tools tab is active
      console.log('🐛 [AdminInterface] Debug tab opened, loading debug sessions...');
      loadDebugSessions();
    }
    // Other tabs load their own data via lazy-loaded components
  }, [activeTab, mainActor]);

  return (
    <div className="fixed inset-0 text-white overflow-auto z-50" style={{ background: 'var(--kontext-primary-black)' }}>
      {/* Header - Matching DocumentationInterface Style */}
      <div style={{
        background: 'radial-gradient(ellipse at center, rgba(255, 107, 53, 0.15) 0%, transparent 50%), linear-gradient(135deg, rgb(17, 17, 17) 0%, #1a1a1a 50%, rgb(17, 17, 17) 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: isMobile ? '1rem' : '1rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        flexShrink: 0
      }}>
        {/* Top Row - Logo, Title, Close Button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          width: '100%'
        }}>
          {/* Logo and Title */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem',
            flex: '0 0 auto'
          }}>
            <img 
              src="https://pwi5a-sqaaa-aaaaa-qcfgq-cai.raw.icp0.io/projects/project-mfvtjz8x-hc7uz/KCP_LOGO.png" 
              alt="Kontext Logo" 
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px'
              }}
            />
            <h1 style={{
              margin: 0,
              fontSize: isMobile ? '1.25rem' : '1.5rem',
              fontWeight: 700,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>Kontext</span>
              <span style={{
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.6)',
                marginLeft: '0.5rem'
              }}>Administration</span>
            </h1>
          </div>

          {/* Close Button (always visible) */}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium transition-all duration-300 whitespace-nowrap"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Bottom Row - Action Buttons */}
        <div className="flex gap-2 items-center flex-wrap">
            <button
              onClick={refreshData}
              disabled={isLoading}
              className="px-4 py-2 lg:px-6 lg:py-3 rounded-lg font-medium transition-all duration-300 whitespace-nowrap"
              style={{
                background: 'rgba(255, 107, 53, 0.1)',
                border: '1px solid var(--kontext-border-accent)',
                color: 'var(--kontext-orange)',
                opacity: isLoading ? 0.6 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = 'rgba(255, 107, 53, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
              }}
            >
              {isLoading ? '⏳ Loading...' : '🔄 Refresh'}
            </button>
          </div>
        </div>

      {/* Tab Navigation - Full Width with Wrapping */}
      <div style={{ 
        background: 'rgba(17, 17, 17, 0.8)', 
        borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
        width: '100%',
        padding: '0.5rem 1rem'
      }}>
        {/* Top Row - Full Width */}
        <div className="flex gap-0 justify-between" style={{ width: '100%', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            {[
              { key: 'wallet', label: '💳 Wallet', fullLabel: '💳 Platform Wallet', desc: 'ICP/Cycle management' },
              { key: 'economy', label: '💰 Economy', fullLabel: '💰 Economy Dashboard', desc: 'Platform economy & metrics' },
              { key: 'financials', label: '💰 Financials', fullLabel: '💰 Financial Analytics', desc: 'Treasury, reserves & team revenue' },
              { key: 'debug', label: '🐛 Debug', fullLabel: '🐛 Debug Tools', desc: 'Prompt analysis & quality metrics' },
              { key: 'notifications', label: '📢 Notifs', fullLabel: '📢 Notifications', desc: 'Platform-wide notifications' },
              { key: 'pools', label: '🏊 Pools', fullLabel: '🏊 Server Pools', desc: 'Create & manage server resources' },
              { key: 'userAdmin', label: '🔧 Users', fullLabel: '🔧 User Management', desc: 'User canister administration' },
              { key: 'wasmConfig', label: '⚙️ WASM', fullLabel: '⚙️ WASM Config', desc: 'Configure WASM storage' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className="px-2 py-2 lg:px-4 lg:py-3 font-medium text-sm lg:text-base whitespace-nowrap border-b-2 transition-all duration-300 flex-1"
                style={{
                  borderBottomColor: activeTab === tab.key ? 'var(--kontext-orange)' : 'transparent',
                  background: activeTab === tab.key ? 'rgba(255, 107, 53, 0.1)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--kontext-text-primary)' : 'var(--kontext-text-tertiary)'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.key) {
                    e.currentTarget.style.color = 'var(--kontext-text-primary)';
                    e.currentTarget.style.background = 'var(--kontext-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.key) {
                    e.currentTarget.style.color = 'var(--kontext-text-tertiary)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
                title={tab.desc}
              >
                <span className="lg:hidden">{tab.label}</span>
                <span className="hidden lg:inline">{tab.fullLabel}</span>
              </button>
            ))}
          </div>

          {/* Bottom Row - Centered */}
          <div className="flex gap-0 justify-center" style={{ width: '100%' }}>
            {[
              { key: 'forumCategories', label: '💬 Forum', fullLabel: '💬 Forum Categories', desc: 'Community forum management' },
              { key: 'university', label: '🎓 University', fullLabel: '🎓 University Content', desc: 'Create & manage programs/courses (includes publish/unpublish)' },
              { key: 'marketplace', label: '🛒 Market', fullLabel: '🛒 Marketplace Admin', desc: 'Manage all listings, publish/unpublish, delete' },
              { key: 'subscriptions', label: '💳 Plans', fullLabel: '💳 Subscription Plans', desc: 'Manage pricing & features' },
              { key: 'platformSettings', label: '⚙️ Settings', fullLabel: '⚙️ Platform Settings', desc: 'API keys & platform configuration' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className="px-2 py-2 lg:px-4 lg:py-3 font-medium text-sm lg:text-base whitespace-nowrap border-b-2 transition-all duration-300 min-w-fit"
                style={{
                  borderBottomColor: activeTab === tab.key ? 'var(--kontext-orange)' : 'transparent',
                  background: activeTab === tab.key ? 'rgba(255, 107, 53, 0.1)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--kontext-text-primary)' : 'var(--kontext-text-tertiary)'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.key) {
                    e.currentTarget.style.color = 'var(--kontext-text-primary)';
                    e.currentTarget.style.background = 'var(--kontext-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.key) {
                    e.currentTarget.style.color = 'var(--kontext-text-tertiary)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
                title={tab.desc}
              >
                <span className="lg:hidden">{tab.label}</span>
                <span className="hidden lg:inline">{tab.fullLabel}</span>
              </button>
            ))}
          </div>
      </div>

      {/* Status Messages - Full Width */}
      <div style={{ width: '100%', padding: isMobile ? '1rem' : '2rem 3rem', paddingBottom: '0' }}>
        {error && (
          <div className="bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 rounded-xl p-4 mb-6 text-red-400 text-sm lg:text-base leading-relaxed whitespace-pre-line">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 rounded-xl p-4 mb-6 text-green-400 text-sm lg:text-base leading-relaxed whitespace-pre-line">
            {success}
          </div>
        )}
      </div>

      {/* Main Content - Full Width */}
      <div style={{ width: '100%', padding: isMobile ? '1rem' : '2rem 3rem' }}>
        {/* Tab Content */}
        {activeTab === 'economy' && (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <h2 className="text-xl lg:text-2xl xl:text-3xl font-semibold mb-6 lg:mb-8 text-center lg:text-left" style={{ 
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              💰 Economy Dashboard
            </h2>
            
            <div className="rounded-xl p-6 lg:p-8" style={{
              background: 'rgba(17, 17, 17, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}>
              <Suspense fallback={<div style={{padding: '2rem', textAlign: 'center', color: '#888'}}>Loading Economy Dashboard...</div>}>
                <EconomyDashboard
                  identity={identity}
                  principal={principal}
                  mainActor={mainActor}
                />
              </Suspense>
            </div>
          </div>
        )}

        {activeTab === 'financials' && (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <h2 className="text-xl lg:text-2xl xl:text-3xl font-semibold mb-6 lg:mb-8 text-center lg:text-left" style={{ 
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              💰 Financial Analytics
            </h2>
            
            <div className="rounded-xl p-6 lg:p-8" style={{
              background: 'rgba(17, 17, 17, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}>
              <Suspense fallback={<div style={{padding: '2rem', textAlign: 'center', color: '#888'}}>Loading Financial Analytics...</div>}>
                <FinancialAnalyticsDashboard />
              </Suspense>
            </div>
          </div>
        )}

        {activeTab === 'wallet' && (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <h2 className="text-xl lg:text-2xl xl:text-3xl font-semibold mb-6 lg:mb-8 text-center lg:text-left" style={{ 
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              💳 Platform Wallet (Mainnet)
            </h2>
            
            <div className="rounded-xl p-6 lg:p-8 mb-8" style={{ 
              background: 'rgba(17, 17, 17, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}>

            {isLoading ? (
              <div className="text-center py-12 lg:py-16 text-gray-400">
                <div className="w-10 h-10 lg:w-12 lg:h-12 border-3 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'rgba(255, 107, 53, 0.3)', borderTopColor: 'var(--kontext-orange)' }}></div>
                Loading platform wallet...
              </div>
            ) : !walletId ? (
              <div className="text-center py-12 lg:py-16">
                <p className="mb-6 text-lg" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  No platform wallet found. Create one to manage platform funds.
                </p>
                <button
                  onClick={createWallet}
                  className="px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300"
                  style={{
                    background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                    color: '#ffffff',
                    boxShadow: '0 4px 15px rgba(255, 107, 53, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = 'var(--kontext-shadow-interactive)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--kontext-shadow-primary)';
                  }}
                >
                  Create Platform Wallet
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
                {/* Wallet Details */}
                <div>
                  <h3 className="text-lg lg:text-xl font-semibold mb-6" style={{ 
                    background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    Wallet Details
                  </h3>
                  
                  <div className="rounded-lg p-4 mb-4" style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    <label className="block text-sm mb-2" style={{ color: '#10b981', fontWeight: 600 }}>
                      Account ID
                    </label>
                    <div className="font-mono text-sm break-all leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                      {walletId.accountIdentifier}
                    </div>
                  </div>

                  <button
                    onClick={() => copyToClipboard(walletId.accountIdentifier)}
                    className="px-6 py-3 rounded-lg font-medium transition-all duration-300 mb-6 w-full lg:w-auto"
                    style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      color: '#10b981'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(16, 185, 129, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)';
                    }}
                  >
                    📋 Copy Address
                  </button>

                  {/* Recent Transactions */}
                  <h4 className="text-lg font-semibold mb-4 text-gray-200">
                    Recent Transactions
                  </h4>
                  
                  <div className="max-h-64 lg:max-h-80 overflow-y-auto">
                    {transactions.length > 0 ? (
                      transactions.map((tx, index) => {
                        const txType = Object.keys(tx.transactionType)[0];
                        const isPositive = tx.isPositive;
                        const amount = formatIcpBalance(tx.amount);
                        const timestamp = new Date(Number(tx.timestamp) / 1_000_000);
                        
                        return (
                          <div
                            key={index}
                            className="bg-gray-800 bg-opacity-30 rounded-lg p-4 mb-2 flex justify-between items-center flex-wrap gap-2"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm lg:text-base text-white mb-1">
                                {txType.charAt(0).toUpperCase() + txType.slice(1)}
                              </div>
                              <div className="text-xs lg:text-sm text-gray-400">
                                {timestamp.toLocaleDateString()} {timestamp.toLocaleTimeString()}
                              </div>
                            </div>
                            <div className={`font-semibold text-lg ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                              {isPositive ? '+' : '-'}{amount} ICP
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        No transactions found
                      </div>
                    )}
                  </div>
                </div>

                {/* Balance & Send */}
                <div>
                  {/* Balance Cards */}
                  <div className="mb-8">
                    <div className="rounded-xl p-6 text-center mb-4" style={{ 
                      background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(251, 191, 36, 0.2))',
                      border: '1px solid rgba(255, 107, 53, 0.4)',
                      boxShadow: '0 4px 15px rgba(255, 107, 53, 0.3)'
                    }}>
                      <div className="text-sm mb-2" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                        ICP Balance
                      </div>
                      <div className="text-3xl lg:text-4xl font-bold" style={{ 
                        background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                      }}>
                        {formatIcpBalance(balance)} ICP
                      </div>
                      <div className="text-xs mt-2" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                        ≈ {formatCycles(cycleEquivalent)} cycles (real-time rate)
                      </div>
                    </div>

                    <div className="rounded-xl p-6 text-center" style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)'
                    }}>
                      <div className="text-sm mb-2" style={{ color: '#10b981', fontWeight: 600 }}>
                        Total Available Resources
                      </div>
                      <div className="text-2xl lg:text-3xl font-bold" style={{ color: '#10b981' }}>
                        {formatCycles(cycleBalance + cycleEquivalent)}
                      </div>
                      <div className="text-xs mt-2" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                        Current cycles + ICP convertible to cycles
                      </div>
                    </div>
                  </div>

                  {/* Send ICP Form */}
                  <div className="rounded-xl p-6" style={{
                    background: 'rgba(139, 92, 246, 0.1)',
                    border: '1px solid rgba(139, 92, 246, 0.3)'
                  }}>
                    <h4 className="text-lg font-semibold mb-4" style={{ 
                      background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text'
                    }}>
                      💸 Send ICP
                    </h4>

                    <div className="mb-4">
                      <label className="block text-sm text-gray-400 mb-2">
                        Recipient (Principal ID or Account ID)
                      </label>
                      <input
                        type="text"
                        value={recipientPrincipal}
                        onChange={(e) => setRecipientPrincipal(e.target.value)}
                        placeholder="Enter principal ID or account ID"
                        className="w-full p-3 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm text-gray-400 mb-2">
                        Amount (ICP)
                      </label>
                      <input
                        type="number"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        placeholder="0.00000000"
                        step="0.00000001"
                        className="w-full p-3 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      {sendAmount && (
                        <div className="text-xs text-gray-400 mt-2">
                          ≈ {formatCycles(BigInt(Math.floor(parseFloat(sendAmount) * conversionRate * 1_000_000_000_000)))} cycles
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleSendICP}
                      disabled={isSending || !recipientPrincipal || !sendAmount}
                      className={`w-full px-6 py-4 rounded-lg font-semibold transition-all duration-300 ${
                        isSending || !recipientPrincipal || !sendAmount
                          ? 'cursor-not-allowed opacity-60'
                          : ''
                      }`}
                    >
                      {isSending ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-opacity-30 border-t-white rounded-full animate-spin"></div>
                          Sending...
                        </span>
                      ) : '🚀 Send ICP'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {activeTab === 'debug' && (
          <div className="space-y-4">
            {/* Debug Sub-Navigation */}
            <div className="flex gap-2 flex-wrap p-4 rounded-lg" style={{
              background: 'rgba(17, 17, 17, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              {[
                { key: 'overview', label: '📊 Overview', desc: 'Key metrics and insights' },
                { key: 'sessions', label: '🔍 Sessions', desc: 'Deep session analysis' },
                { key: 'fileanalysis', label: '📁 Files', desc: 'File completeness' },
                { key: 'templates', label: '🎯 Templates', desc: 'Template metrics' },
                { key: 'prompts', label: '📝 Prompts', desc: 'Prompt intelligence' },
                { key: 'quality', label: '⭐ Quality', desc: 'Quality metrics' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveDebugTab(tab.key as any)}
                  className="px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300"
                  style={{
                    background: activeDebugTab === tab.key ? 'var(--kontext-orange)' : 'rgba(255, 255, 255, 0.05)',
                    color: activeDebugTab === tab.key ? 'white' : 'var(--kontext-text-secondary)',
                    border: activeDebugTab === tab.key ? '1px solid var(--kontext-orange)' : '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                  onMouseEnter={(e) => {
                    if (activeDebugTab !== tab.key) {
                      e.currentTarget.style.background = 'rgba(255, 107, 53, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeDebugTab !== tab.key) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }
                  }}
                  title={tab.desc}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'debug' && activeDebugTab === 'overview' && (
          <div className="rounded-2xl p-4 lg:p-8" style={{ 
            background: 'rgba(17, 17, 17, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            maxWidth: '1400px',
            margin: '0 auto'
          }}>
            <h2 className="text-xl lg:text-2xl font-semibold mb-6 text-center lg:text-left" style={{ 
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              📊 Debug Overview (Mainnet) - {debugSessions.length} Sessions Analyzed
            </h2>
            
            {/* 🔧 NEW: Generation Debug Toggle */}
            <div className="rounded-xl p-4 lg:p-6 mb-6" style={{ 
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <h3 className="mb-2 text-lg font-semibold" style={{ color: '#10b981', fontWeight: 600 }}>
                    🐛 Generation Debug Logging
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {debugEnabled 
                      ? 'Debug logging is active. All new project generations will be logged with full details including generated files, AI responses, and extraction data.' 
                      : 'Debug logging is disabled. Enable to capture detailed logs for debugging BigInt serialization and other issues.'}
                  </p>
                  {debugEnabled && (
                    <div className="mt-2 text-xs text-gray-500">
                      Logs are stored at: <code style={{ color: 'var(--kontext-orange)' }}>{projectPath}/debug-logs/</code>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                    debugEnabled 
                      ? 'bg-green-500 bg-opacity-20 text-green-400 border border-green-500 border-opacity-50' 
                      : 'bg-gray-700 bg-opacity-50 text-gray-400 border border-gray-600 border-opacity-50'
                  }`}>
                    {debugEnabled ? '✅ Enabled' : '❌ Disabled'}
                  </div>
                  <button
                    onClick={() => {
                      if (debugEnabled) {
                        DebugControl.disable();
                        setDebugEnabled(false);
                      } else {
                        DebugControl.enable();
                        setDebugEnabled(true);
                      }
                    }}
                    className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300 ${
                      debugEnabled
                        ? 'bg-red-500 bg-opacity-20 hover:bg-red-500 hover:bg-opacity-30 text-red-400 border border-red-500 border-opacity-50'
                        : 'bg-green-500 bg-opacity-20 hover:bg-green-500 hover:bg-opacity-30 text-green-400 border border-green-500 border-opacity-50'
                    }`}
                  >
                    {debugEnabled ? '🔴 Disable' : '🟢 Enable'}
                  </button>
                </div>
              </div>
            </div>

            {/* 🧪 Test Debug Capture Button */}
            <div className="rounded-xl p-4 lg:p-6 mb-6" style={{ 
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <h3 className="mb-2 text-lg font-semibold" style={{ color: '#10b981', fontWeight: 600 }}>
                    🧪 Test Debug Capture System
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Test the debug capture system by creating a simulated project generation session with sample data. This will validate that debug logging is working correctly on mainnet.
                  </p>
                </div>
                <button
                  onClick={testDebugCapture}
                  disabled={isLoading}
                  className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300 whitespace-nowrap ${
                    isLoading 
                      ? 'opacity-60 cursor-not-allowed bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 text-green-400' 
                      : 'bg-green-500 bg-opacity-20 hover:bg-green-500 hover:bg-opacity-30 text-green-400 border border-green-500 border-opacity-50'
                  }`}
                >
                  🧪 Run Test
                </button>
              </div>
            </div>

            {/* 🔧 NEW: Asset Canister & Project Path Configuration */}
            <div className="rounded-xl p-4 lg:p-6 mb-6" style={{ 
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)'
            }}>
              <h3 className="mb-4 text-lg font-semibold" style={{ 
                background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontWeight: 600
              }}>
                ⚙️ Debug Storage Configuration
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">
                    Asset Canister ID
                  </label>
                  <input
                    type="text"
                    value={assetCanisterId}
                    onChange={(e) => setAssetCanisterId(e.target.value)}
                    placeholder="pwi5a-sqaaa-aaaaa-qcfgq-cai"
                    className="w-full px-4 py-2 rounded-lg text-sm font-mono focus:outline-none"
                    style={{
                      background: 'var(--kontext-glass-bg-medium)',
                      border: '1px solid var(--kontext-border-primary)',
                      color: 'var(--kontext-text-primary)'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--kontext-orange)';
                      e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.2)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--kontext-border-primary)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    The canister ID where debug logs are stored
                  </p>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">
                    Project Path
                  </label>
                  <input
                    type="text"
                    value={projectPath}
                    onChange={(e) => setProjectPath(e.target.value)}
                    placeholder="projects/project-mfvtjz8x-hc7uz"
                    className="w-full px-4 py-2 rounded-lg text-sm font-mono focus:outline-none"
                    style={{
                      background: 'var(--kontext-glass-bg-medium)',
                      border: '1px solid var(--kontext-border-primary)',
                      color: 'var(--kontext-text-primary)'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--kontext-orange)';
                      e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.2)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--kontext-border-primary)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    The path prefix for debug logs (e.g., projects/project-xxx)
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <button
                  onClick={() => {
                    setIsSavingConfig(true);
                    try {
                      generationLogger.setAssetCanisterId(assetCanisterId);
                      generationLogger.setProjectPath(projectPath);
                      setSuccess('Configuration saved successfully!');
                      setTimeout(() => setSuccess(null), 3000);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to save configuration');
                      setTimeout(() => setError(null), 5000);
                    } finally {
                      setIsSavingConfig(false);
                    }
                  }}
                  disabled={isSavingConfig}
                  className="px-6 py-2 rounded-lg font-semibold text-sm transition-all duration-300"
                  style={{
                    background: 'rgba(255, 107, 53, 0.2)',
                    border: '1px solid var(--kontext-border-accent)',
                    color: 'var(--kontext-orange)',
                    opacity: isSavingConfig ? 0.5 : 1,
                    cursor: isSavingConfig ? 'not-allowed' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSavingConfig) {
                      e.currentTarget.style.background = 'rgba(255, 107, 53, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 107, 53, 0.2)';
                  }}
                >
                  {isSavingConfig ? '💾 Saving...' : '💾 Save Configuration'}
                </button>
                <button
                  onClick={() => {
                    const stats = generationLogger.getSessionStats();
                    setAssetCanisterId(stats.assetCanisterId);
                    setProjectPath(stats.projectPath);
                  }}
                  className="px-6 py-2 bg-gray-700 bg-opacity-50 hover:bg-gray-700 hover:bg-opacity-70 text-gray-300 border border-gray-600 border-opacity-50 rounded-lg font-semibold text-sm transition-all duration-300"
                >
                  🔄 Reset to Current
                </button>
                <div className="text-xs text-gray-500">
                  <div>Current URL: <code style={{ color: 'var(--kontext-orange)' }}>https://{assetCanisterId}.raw.icp0.io/{projectPath}/debug-logs/</code></div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              
              {/* Enhanced Generation Statistics */}
              <div className="rounded-xl p-4 lg:p-6" style={{
                background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(251, 191, 36, 0.15))',
                border: '1px solid rgba(255, 107, 53, 0.3)'
              }}>
                <h3 className="mb-4 text-lg font-semibold" style={{ 
                  background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  📊 Generation Performance
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Total Sessions:</span>
                    <span className="text-white font-semibold text-sm">{debugSessions.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Success Rate:</span>
                    <span className={`font-semibold text-sm ${
                      debugSessions.length > 0 && (debugSessions.filter(s => s.success).length / debugSessions.length) > 0.8 ? 'text-green-400' : 
                      debugSessions.length > 0 && (debugSessions.filter(s => s.success).length / debugSessions.length) > 0.6 ? 'text-orange-400' : 'text-red-400'
                    }`}>
                      {debugSessions.length > 0 ? Math.round((debugSessions.filter(s => s.success).length / debugSessions.length) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Avg Files Generated:</span>
                    <span className="text-green-400 font-semibold text-sm">
                      {debugSessions.length > 0 ? Math.round(debugSessions.reduce((sum, s) => sum + (s.totalFiles || 0), 0) / debugSessions.length) : 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Avg Duration:</span>
                    <span className="text-white font-semibold text-sm">
                      {debugSessions.length > 0 ? 
                        Math.round(debugSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / debugSessions.length / 1000) : 0}s
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Sessions & Real-time Status */}
              <div className="rounded-xl p-4 lg:p-6" style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                <h3 className="mb-4 text-lg font-semibold" style={{ color: '#10b981', fontWeight: 600 }}>
                  🔄 Real-time Status
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Active Sessions:</span>
                    <span className={`font-semibold text-sm ${
                      generationLogger.getActiveSessions().length > 0 ? 'text-orange-400' : 'text-green-400'
                    }`}>
                      {generationLogger.getActiveSessions().length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Debug Storage:</span>
                    <span className="text-green-400 font-semibold text-sm">✅ Mainnet</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Asset Canister:</span>
                    <span className="text-white font-semibold text-xs font-mono">
                      {assetCanisterId.substring(0, 8)}...
                    </span>
                  </div>
                </div>
              </div>

              {/* Template Usage Analytics */}
              <div className="rounded-xl p-4 lg:p-6" style={{ 
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)'
              }}>
                <h3 className="mb-4 text-lg font-semibold" style={{ 
                  background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  fontWeight: 600
                }}>
                  🎯 Template Intelligence
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Templates Used:</span>
                    <span className="text-white font-semibold text-sm">
                      {templateAnalytics.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Avg Confidence:</span>
                    <span className="text-green-400 font-semibold text-sm">
                      {debugSessions.length > 0 ? 
                        Math.round(debugSessions.reduce((sum, s) => sum + (s.confidence || 0), 0) / debugSessions.length * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Most Used:</span>
                    <span className="font-semibold text-xs text-right" style={{ color: 'var(--kontext-orange)' }}>
                      {templateAnalytics.length > 0 ? 
                        templateAnalytics.sort((a, b) => b.usageCount - a.usageCount)[0].templateName : 'None'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'debug' && activeDebugTab === 'sessions' && (
          <div className="rounded-2xl p-4 lg:p-8" style={{ 
            background: 'rgba(17, 17, 17, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            maxWidth: '1400px',
            margin: '0 auto'
          }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-12 gap-4 lg:gap-8">
              {/* Sessions List */}
              <div className={`overflow-y-auto ${selectedSession ? 'xl:col-span-5' : 'xl:col-span-12'}`} style={{ 
                maxHeight: 'calc(100vh - 300px)'
              }}>
                <h2 className="text-xl lg:text-2xl font-semibold mb-6" style={{ 
                  background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  🔍 Debug Sessions ({debugSessions.length}) - Deep Analysis
                </h2>

              {/* Manual Session Entry */}
              <div className="rounded-lg p-4 mb-6" style={{
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)'
              }}>
                <div className="mb-2 text-gray-400 text-sm">
                  Add Session Manually (from mainnet):
                </div>
                <div className="flex flex-col lg:flex-row gap-2">
                  <input
                    type="text"
                    value={manualSessionId}
                    onChange={(e) => setManualSessionId(e.target.value)}
                    placeholder="Enter session ID (try: gen_1759636281609_x0dtmaurcv)"
                    className="flex-1 p-2 rounded text-sm font-mono focus:outline-none"
                    style={{
                      background: 'var(--kontext-glass-bg-medium)',
                      border: '1px solid var(--kontext-border-primary)',
                      color: 'var(--kontext-text-primary)'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--kontext-orange)';
                      e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.2)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--kontext-border-primary)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addManualSession}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-2 rounded cursor-pointer text-sm font-medium hover:from-green-600 hover:to-emerald-700 transition-all duration-200"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setManualSessionId('gen_1759636281609_x0dtmaurcv')}
                      className="px-3 py-2 rounded cursor-pointer text-sm font-medium transition-all duration-200 whitespace-nowrap"
                      style={{
                        background: 'rgba(255, 107, 53, 0.2)',
                        border: '1px solid var(--kontext-border-accent)',
                        color: 'var(--kontext-orange)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 107, 53, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 107, 53, 0.2)';
                      }}
                      title="Load the recent session from logs"
                    >
                      Load Recent
                    </button>
                  </div>
                </div>
              </div>

              {/* Sessions List */}
              {debugSessions.length === 0 ? (
                <div className="text-center py-8 lg:py-12 rounded-lg" style={{
                  color: 'var(--kontext-text-tertiary)',
                  border: '1px dashed var(--kontext-border-primary)'
                }}>
                  <div className="text-4xl mb-4 opacity-50">🔍</div>
                  <h3 className="text-white mb-2 text-lg">No Debug Sessions Available</h3>
                  <p className="mb-4 text-sm">
                    {isLoading ? 'Searching for debug sessions on mainnet...' : 
                     'Debug sessions will appear here after project generations are completed on mainnet.'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Try manually adding the recent session ID: <code style={{ color: 'var(--kontext-orange)' }}>gen_1759636281609_x0dtmaurcv</code>
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {debugSessions.map(session => (
                    <div
                      key={session.sessionId}
                      onClick={() => loadSessionDetails(session)}
                      className="p-4 rounded-lg cursor-pointer transition-all duration-200 relative"
                      style={{
                        background: selectedSession?.sessionId === session.sessionId 
                          ? 'var(--kontext-glass-bg-strong)' 
                          : 'var(--kontext-glass-bg-medium)',
                        border: selectedSession?.sessionId === session.sessionId 
                          ? '1px solid var(--kontext-border-accent)' 
                          : '1px solid var(--kontext-border-primary)',
                        boxShadow: selectedSession?.sessionId === session.sessionId 
                          ? 'var(--kontext-shadow-primary)' 
                          : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedSession?.sessionId !== session.sessionId) {
                          e.currentTarget.style.background = 'var(--kontext-glass-bg-strong)';
                          e.currentTarget.style.borderColor = 'var(--kontext-border-accent)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedSession?.sessionId !== session.sessionId) {
                          e.currentTarget.style.background = 'var(--kontext-glass-bg-medium)';
                          e.currentTarget.style.borderColor = 'var(--kontext-border-primary)';
                        }
                      }}
                    >
                      {/* Enhanced Session Header */}
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <div className="font-medium text-sm lg:text-base flex-1 min-w-0" style={{ color: 'var(--kontext-text-primary)' }}>
                          {session.userPrompt?.substring(0, 60)}...
                        </div>
                        
                        {/* Health Status Indicator */}
                        <div className={`px-2 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
                          session.success === true ? 'bg-green-500 bg-opacity-20 text-green-400' : 
                          session.success === false ? 'bg-red-500 bg-opacity-20 text-red-400' : 
                          'bg-orange-500 bg-opacity-20 text-orange-400'
                        }`}>
                          {session.success === undefined ? 'ACTIVE' : session.success ? 'SUCCESS' : 'FAILED'}
                        </div>
                      </div>
                      
                      {/* Session Metrics */}
                      <div className="flex justify-between items-center text-xs mb-2 flex-wrap gap-1" style={{ color: 'var(--kontext-text-tertiary)' }}>
                        <span>{session.templateUsed || 'Unknown'}</span>
                        <span>{Math.round((session.confidence || 0) * 100)}% conf.</span>
                      </div>
                      
                      {/* Performance Indicators */}
                      <div className="text-xs flex justify-between flex-wrap gap-1 mb-2" style={{ color: 'var(--kontext-text-tertiary)' }}>
                        <span>📁 {session.totalFiles || 0} files</span>
                        <span>⏱️ {session.duration ? Math.round(session.duration / 1000) : 0}s</span>
                        <span>📅 {new Date(session.timestamp).toLocaleDateString()}</span>
                      </div>

                      {/* Session ID */}
                      <div className="text-xs font-mono opacity-70 break-all mb-2" style={{ color: 'var(--kontext-text-tertiary)' }}>
                        {session.sessionId}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 justify-end mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            loadFileAnalysis(session);
                            setActiveTab('debug');
                            setActiveDebugTab('fileanalysis');
                          }}
                          disabled={fileAnalysisLoading === session.sessionId}
                          className="bg-green-500 bg-opacity-20 border border-green-500 border-opacity-30 text-green-400 p-1 rounded text-xs opacity-70 hover:opacity-100 transition-opacity duration-200"
                          title="Analyze file completeness and deployment readiness"
                        >
                          {fileAnalysisLoading === session.sessionId ? '⏳' : '📁'}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmation(session.sessionId);
                          }}
                          disabled={deletingSessionId === session.sessionId}
                          className="bg-red-500 bg-opacity-20 border border-red-500 border-opacity-30 text-red-400 p-1 rounded text-xs opacity-70 hover:opacity-100 transition-opacity duration-200"
                          title="Delete session from mainnet"
                        >
                          {deletingSessionId === session.sessionId ? '⏳' : '🗑️'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>

              {/* Enhanced Session Details Panel */}
              {selectedSession && (
                <div className="rounded-xl p-4 lg:p-6 overflow-y-auto xl:col-span-7" style={{ 
                background: 'rgba(17, 17, 17, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                maxHeight: 'calc(100vh - 300px)'
              }}>
                {/* Session Header */}
                <div className="flex justify-between items-start mb-8 pb-4 border-b border-gray-600 border-opacity-50 flex-wrap gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl lg:text-2xl font-semibold mb-2 text-white">
                      📊 Session Analysis
                    </h3>
                    <div className="text-xs lg:text-sm font-mono break-all" style={{ color: 'var(--kontext-text-tertiary)' }}>
                      {selectedSession.sessionId}
                    </div>
                    <div className="text-sm mt-2" style={{ color: 'var(--kontext-text-secondary)' }}>
                      {new Date(selectedSession.timestamp).toLocaleString()}
                    </div>
                  </div>
                  
                  {/* Session Health Status */}
                  {sessionAnalysis && (
                    <div className={`px-4 py-2 rounded-lg text-sm font-semibold text-center ${
                      sessionAnalysis.phase === 'healthy' ? 'bg-green-500 bg-opacity-20 text-green-400' : 
                      sessionAnalysis.phase === 'warning' ? 'bg-orange-500 bg-opacity-20 text-orange-400' : 
                      'bg-red-500 bg-opacity-20 text-red-400'
                    }`}>
                      {sessionAnalysis.phase === 'healthy' ? '✅ HEALTHY' : 
                       sessionAnalysis.phase === 'warning' ? '⚠️ WARNING' : 
                       '❌ ERROR'}
                    </div>
                  )}
                </div>

                {/* Debug View Mode Navigation */}
                <div className="flex gap-1 lg:gap-2 mb-8 pb-4 overflow-x-auto" style={{
                  borderBottom: '1px solid var(--kontext-border-primary)'
                }}>
                  {[
                    { key: 'overview', label: '📊 Overview', desc: 'Session summary & analysis' },
                    { key: 'files', label: '📁 Debug Files', desc: 'Individual file inspection' },
                    { key: 'analysis', label: '🔍 Deep Analysis', desc: 'Comprehensive insights' },
                    { key: 'performance', label: '⚡ Performance', desc: 'Timing & metrics' }
                  ].map(mode => (
                    <button
                      key={mode.key}
                      onClick={() => setDebugViewMode(mode.key as any)}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap"
                      style={debugViewMode === mode.key 
                        ? {
                            background: 'var(--kontext-glass-bg-strong)',
                            border: '1px solid var(--kontext-border-accent)',
                            color: 'var(--kontext-text-primary)'
                          }
                        : {
                            background: 'var(--kontext-glass-bg-medium)',
                            border: '1px solid var(--kontext-border-primary)',
                            color: 'var(--kontext-text-tertiary)'
                          }
                      }
                      onMouseEnter={(e) => {
                        if (debugViewMode !== mode.key) {
                          e.currentTarget.style.background = 'var(--kontext-glass-bg-strong)';
                          e.currentTarget.style.borderColor = 'var(--kontext-border-accent)';
                          e.currentTarget.style.color = 'var(--kontext-text-primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (debugViewMode !== mode.key) {
                          e.currentTarget.style.background = 'var(--kontext-glass-bg-medium)';
                          e.currentTarget.style.borderColor = 'var(--kontext-border-primary)';
                          e.currentTarget.style.color = 'var(--kontext-text-tertiary)';
                        }
                      }}
                      title={mode.desc}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {/* Debug View Content */}
                {debugViewMode === 'overview' && sessionAnalysis && (
                  <div>
                    {/* Key Insights */}
                    {sessionAnalysis.insights.length > 0 && (
                      <div className="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 rounded-lg p-4 mb-6">
                        <h4 className="text-green-400 mb-3 text-lg font-semibold">
                          💡 Key Insights
                        </h4>
                        <ul className="space-y-2" style={{ color: 'var(--kontext-text-secondary)' }}>
                          {sessionAnalysis.insights.map((insight, index) => (
                            <li key={index} className="text-sm leading-relaxed">
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Issues & Warnings */}
                    {sessionAnalysis.issues.length > 0 && (
                      <div className="bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 rounded-lg p-4 mb-6">
                        <h4 className="text-red-400 mb-3 text-lg font-semibold">
                          🚨 Issues Detected
                        </h4>
                        <ul className="space-y-2" style={{ color: 'var(--kontext-text-secondary)' }}>
                          {sessionAnalysis.issues.map((issue, index) => (
                            <li key={index} className="text-sm leading-relaxed">
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Performance Overview */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                      <div className="rounded-lg p-4" style={{ background: 'rgba(255, 107, 53, 0.1)', border: '1px solid var(--kontext-border-accent)' }}>
                        <h5 className="mb-3 text-base font-semibold" style={{ color: 'var(--kontext-orange)' }}>
                          ⚡ Performance
                        </h5>
                        <div className="space-y-2 text-sm" style={{ color: 'var(--kontext-text-secondary)' }}>
                          <div>Total Time: {Math.round(sessionAnalysis.performance.totalTime / 1000)}s</div>
                          <div>Routing: {Math.round(sessionAnalysis.performance.routingTime)}ms</div>
                          <div>Backend: {Math.round(sessionAnalysis.performance.backendTime / 1000)}s</div>
                          <div>Frontend: {Math.round(sessionAnalysis.performance.frontendTime / 1000)}s</div>
                        </div>
                      </div>

                      <div className="bg-orange-500 bg-opacity-10 border border-orange-500 border-opacity-30 rounded-lg p-4">
                        <h5 className="text-orange-400 mb-3 text-base font-semibold">
                          📊 Quality Metrics
                        </h5>
                        <div className="space-y-2 text-sm" style={{ color: 'var(--kontext-text-secondary)' }}>
                          <div>Template Match: {Math.round(sessionAnalysis.quality.templateMatch * 100)}%</div>
                          <div>Code Completeness: {Math.round(sessionAnalysis.quality.codeCompleteness * 100)}%</div>
                          <div>Predicted Satisfaction: {sessionAnalysis.quality.userSatisfaction.replace('predicted-', '').toUpperCase()}</div>
                        </div>
                      </div>
                    </div>

                    {/* Session Summary */}
                    <div className="rounded-lg p-4" style={{
                      background: 'var(--kontext-glass-bg-medium)',
                      border: '1px solid var(--kontext-border-primary)'
                    }}>
                      <h5 className="mb-3 text-base font-semibold" style={{ color: 'var(--kontext-text-primary)' }}>
                        📋 Session Summary
                      </h5>
                      <div className="text-sm leading-relaxed space-y-2" style={{ color: 'var(--kontext-text-secondary)' }}>
                        <div><strong>User Prompt:</strong> "{selectedSession.userPrompt}"</div>
                        <div><strong>Template Used:</strong> {selectedSession.templateUsed} ({Math.round((selectedSession.confidence || 0) * 100)}% confidence)</div>
                        <div><strong>Files Generated:</strong> {selectedSession.totalFiles}</div>
                        <div><strong>Duration:</strong> {Math.round((selectedSession.duration || 0) / 1000)}s</div>
                        <div><strong>Success:</strong> {selectedSession.success ? 'Yes' : 'No'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {debugViewMode === 'files' && sessionDetails && (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                      {Object.entries(sessionDetails.files).map(([fileName, fileContent]) => (
                        <button
                          key={fileName}
                          onClick={() => loadDebugFile(fileName, selectedSession.urls[fileName as keyof typeof selectedSession.urls] || '')}
                          className="text-left p-4 rounded-lg transition-all duration-200 border"
                          style={selectedDebugFile === fileName 
                            ? {
                                background: 'var(--kontext-glass-bg-strong)',
                                border: '1px solid var(--kontext-border-accent)'
                              }
                            : {
                                background: 'var(--kontext-glass-bg-medium)',
                                border: '1px solid var(--kontext-border-primary)'
                              }
                          }
                          onMouseEnter={(e) => {
                            if (selectedDebugFile !== fileName) {
                              e.currentTarget.style.background = 'var(--kontext-glass-bg-strong)';
                              e.currentTarget.style.borderColor = 'var(--kontext-border-accent)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedDebugFile !== fileName) {
                              e.currentTarget.style.background = 'var(--kontext-glass-bg-medium)';
                              e.currentTarget.style.borderColor = 'var(--kontext-border-primary)';
                            }
                          }}
                        >
                          <div className="font-semibold mb-2 text-sm lg:text-base" style={{ color: 'var(--kontext-text-primary)' }}>
                            📄 {fileName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </div>
                          <div className="flex justify-between text-xs" style={{ color: 'var(--kontext-text-tertiary)' }}>
                            <span>{getFileSize(fileContent)}</span>
                            <span>{loadingDebugFile === fileName ? '⏳' : '👁️'}</span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* File Content Display */}
                    {selectedDebugFile && debugFileContent && (
                      <div className="rounded-lg p-4" style={{
                        background: 'var(--kontext-glass-bg-medium)',
                        border: '1px solid var(--kontext-border-primary)'
                      }}>
                        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                          <h5 className="text-base lg:text-lg font-semibold" style={{ color: 'var(--kontext-text-primary)' }}>
                            📄 {selectedDebugFile.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </h5>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowRawJson(!showRawJson)}
                              className="px-3 py-1 rounded text-sm transition-all duration-200"
                              style={{
                                background: 'rgba(255, 107, 53, 0.2)',
                                border: '1px solid var(--kontext-border-accent)',
                                color: 'var(--kontext-orange)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 107, 53, 0.3)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 107, 53, 0.2)';
                              }}
                            >
                              {showRawJson ? 'Pretty' : 'Raw JSON'}
                            </button>
                            <button
                              onClick={() => copyToClipboard(formatFileContent(debugFileContent, selectedDebugFile))}
                              className="bg-green-500 bg-opacity-20 border border-green-500 border-opacity-30 text-green-400 px-3 py-1 rounded text-sm hover:bg-green-500 hover:bg-opacity-30 transition-all duration-200"
                            >
                              📋 Copy
                            </button>
                          </div>
                        </div>
                        <pre className="p-4 rounded text-xs lg:text-sm leading-relaxed overflow-auto max-h-96 lg:max-h-120 font-mono" style={{
                          background: 'var(--kontext-primary-black)',
                          color: 'var(--kontext-text-secondary)',
                          border: '1px solid var(--kontext-border-primary)'
                        }}>
                          {showRawJson ? 
                            JSON.stringify(debugFileContent, null, 0) :
                            formatFileContent(debugFileContent, selectedDebugFile)
                          }
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {debugViewMode === 'analysis' && sessionAnalysis && (
                  <div>
                    <div className="rounded-xl p-6 lg:p-8" style={{
                      background: 'var(--kontext-glass-bg-medium)',
                      border: '1px solid var(--kontext-border-primary)'
                    }}>
                      <h4 className="mb-6 text-xl font-semibold" style={{ color: 'var(--kontext-text-primary)' }}>
                        🔬 Comprehensive Analysis
                      </h4>
                      
                      {/* Analysis coming soon placeholder */}
                      <div className="text-center py-12 lg:py-16" style={{ color: 'var(--kontext-text-tertiary)' }}>
                        <div className="text-4xl mb-4 opacity-50">🔬</div>
                        <h3 className="mb-2 text-lg" style={{ color: 'var(--kontext-text-primary)' }}>Deep Analysis Engine</h3>
                        <p className="mb-4 text-sm">
                          Advanced session analysis tools are being developed. This will include:
                        </p>
                        <ul className="text-left inline-block space-y-1 text-sm">
                          <li>AI content quality scoring</li>
                          <li>Code pattern analysis</li>
                          <li>Template adherence validation</li>
                          <li>User satisfaction prediction</li>
                          <li>Performance optimization suggestions</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {debugViewMode === 'performance' && sessionAnalysis && (
                  <div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Timing Breakdown */}
                      <div className="rounded-xl p-6" style={{ background: 'rgba(255, 107, 53, 0.1)', border: '1px solid var(--kontext-border-accent)' }}>
                        <h5 className="mb-4 text-lg font-semibold" style={{ color: 'var(--kontext-orange)' }}>
                          ⏱️ Timing Breakdown
                        </h5>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-300 text-sm">Template Routing:</span>
                            <span className="text-white font-semibold text-sm">
                              {Math.round(sessionAnalysis.performance.routingTime)}ms
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300 text-sm">Backend Generation:</span>
                            <span className="text-white font-semibold text-sm">
                              {Math.round(sessionAnalysis.performance.backendTime / 1000)}s
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300 text-sm">Frontend Generation:</span>
                            <span className="text-white font-semibold text-sm">
                              {Math.round(sessionAnalysis.performance.frontendTime / 1000)}s
                            </span>
                          </div>
                          <div className="flex justify-between pt-3 border-t border-gray-600 border-opacity-50">
                            <span className="font-semibold text-sm" style={{ color: 'var(--kontext-orange)' }}>Total Time:</span>
                            <span className="font-bold text-sm" style={{ color: 'var(--kontext-orange)' }}>
                              {Math.round(sessionAnalysis.performance.totalTime / 1000)}s
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Efficiency Metrics */}
                      <div className="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 rounded-xl p-6">
                        <h5 className="text-green-400 mb-4 text-lg font-semibold">
                          🚀 Efficiency Rating
                        </h5>
                        <div className="text-center py-6">
                          <div className={`text-4xl mb-4 ${
                            sessionAnalysis.performance.efficiency === 'excellent' ? 'text-green-400' : 
                            sessionAnalysis.performance.efficiency === 'good' ? 'text-orange-400' : 'text-red-400'
                          }`}>
                            {sessionAnalysis.performance.efficiency === 'excellent' ? '🌟' : 
                             sessionAnalysis.performance.efficiency === 'good' ? '👍' : '⚠️'}
                          </div>
                          <div className={`text-xl font-bold uppercase ${
                            sessionAnalysis.performance.efficiency === 'excellent' ? 'text-green-400' : 
                            sessionAnalysis.performance.efficiency === 'good' ? 'text-orange-400' : 'text-red-400'
                          }`}>
                            {sessionAnalysis.performance.efficiency}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Performance Recommendations */}
                    <div className="bg-gray-800 bg-opacity-50 border border-gray-600 border-opacity-50 rounded-xl p-6 mt-6">
                      <h5 className="text-white mb-4 text-lg font-semibold">
                        💡 Performance Recommendations
                      </h5>
                      <div className="text-sm text-gray-300 leading-relaxed">
                        {sessionAnalysis.performance.efficiency === 'excellent' && (
                          <p>🎉 Excellent performance! This session represents optimal generation speed and efficiency.</p>
                        )}
                        {sessionAnalysis.performance.efficiency === 'good' && (
                          <p>👍 Good performance with room for minor improvements in template routing or generation speed.</p>
                        )}
                        {sessionAnalysis.performance.efficiency === 'poor' && (
                          <div>
                            <p className="mb-3">⚠️ Performance could be improved. Consider:</p>
                            <ul className="space-y-1 pl-4">
                              <li>• Optimizing user prompts for clearer template matching</li>
                              <li>• Using more specific template requirements</li>
                              <li>• Reducing complexity in generation requests</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {isLoading && (
                  <div className="flex justify-center items-center py-12">
                    <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: 'rgba(255, 107, 53, 0.3)', borderTopColor: 'var(--kontext-orange)' }}></div>
                  </div>
                )}
              </div>
              )}
            </div>
          </div>
        )}

        {/* File Analysis Tab */}
        {activeTab === 'debug' && activeDebugTab === 'fileanalysis' && (
          <div className="rounded-2xl p-4 lg:p-8" style={{ 
            background: 'rgba(17, 17, 17, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            maxWidth: '1400px',
            margin: '0 auto'
          }}>
            <h2 className="text-xl lg:text-2xl font-semibold mb-6 text-white text-center lg:text-left">
              📁 File Completeness Analysis (Mainnet) - Deployment Readiness Assessment
            </h2>
            
            {selectedFileAnalysis ? (
              <div>
                {/* Analysis Header */}
                <div className="flex justify-between items-start mb-8 pb-4 border-b border-gray-600 border-opacity-50 flex-wrap gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white mb-2 text-lg lg:text-xl font-semibold">
                      📊 Analysis Results for Session: {selectedFileAnalysis.sessionId}
                    </h3>
                    <p className="text-gray-400 text-sm lg:text-base">
                      Template: {selectedFileAnalysis.templateName || 'Unknown'} • Generated: {selectedFileAnalysis.generatedFiles.length} files
                    </p>
                  </div>
                  
                  <div className="flex gap-4 flex-wrap">
                    <div className="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 rounded-lg px-4 py-3 text-center">
                      <div className="text-green-400 text-xs font-semibold mb-1">
                        COMPLETENESS
                      </div>
                      <div className="text-white text-2xl lg:text-3xl font-bold">
                        {Math.round(selectedFileAnalysis.completenessScore * 100)}%
                      </div>
                    </div>
                    
                    <div className="rounded-lg px-4 py-3 text-center" style={{ background: 'rgba(255, 107, 53, 0.1)', border: '1px solid var(--kontext-border-accent)' }}>
                      <div className="text-xs font-semibold mb-1" style={{ color: 'var(--kontext-orange)' }}>
                        DEPLOYMENT READY
                      </div>
                      <div className="text-white text-2xl lg:text-3xl font-bold">
                        {Math.round(selectedFileAnalysis.deploymentReadiness * 100)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Issues */}
                {selectedFileAnalysis.issues.length > 0 && (
                  <div className="bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 rounded-lg p-4 lg:p-6 mb-8">
                    <h4 className="text-red-400 mb-4 text-lg font-semibold">
                      🚨 Issues Detected ({selectedFileAnalysis.issues.length})
                    </h4>
                    <div className="space-y-4">
                      {selectedFileAnalysis.issues.map((issue, index) => (
                        <div key={index} className={`bg-black bg-opacity-30 rounded-lg p-4 border ${
                          issue.severity === 'critical' ? 'border-red-500 border-opacity-50' :
                          issue.severity === 'warning' ? 'border-orange-500 border-opacity-50' :
                          ''
                        }`}>
                          <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                            <div className={`font-semibold text-sm ${
                              issue.severity === 'critical' ? 'text-red-400' :
                              issue.severity === 'warning' ? 'var(--kontext-orange)' : 'var(--kontext-orange)'
                            }`}>
                              {issue.severity === 'critical' ? '🔴 CRITICAL' :
                               issue.severity === 'warning' ? '🟡 WARNING' : '🔵 INFO'}
                            </div>
                            <div className="text-gray-400 text-xs">
                              {issue.category}
                            </div>
                          </div>
                          <div className="text-white mb-2 text-sm">
                            {issue.issue}
                          </div>
                          <div className="text-gray-400 mb-2 text-xs">
                            <strong>Impact:</strong> {issue.impact}
                          </div>
                          <div className="text-green-400 text-xs">
                            <strong>Suggestion:</strong> {issue.suggestion}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* File Categories */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
                  {['backend', 'frontend', 'config', 'core'].map(category => {
                    const categoryFiles = selectedFileAnalysis.generatedFiles.filter(f => f.category === category);
                    const categoryRequirements = selectedFileAnalysis.requiredFiles.filter(r => r.category === category && r.required);
                    const categoryScore = categoryRequirements.length > 0 ? 
                      categoryRequirements.filter(req => checkFileRequirement(req, selectedFileAnalysis.generatedFiles)).length / categoryRequirements.length : 1;
                    
                    return (
                      <div key={category} className="bg-gray-800 bg-opacity-50 border border-gray-600 border-opacity-50 rounded-xl p-4 lg:p-6">
                        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                          <h5 className="text-white text-base font-semibold capitalize">
                            {category === 'backend' ? '🏗️' : 
                             category === 'frontend' ? '🎨' :
                             category === 'config' ? '⚙️' : '📄'} {category} Files
                          </h5>
                          <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            categoryScore > 0.8 ? 'bg-green-500 bg-opacity-20 text-green-400' : 
                            categoryScore > 0.5 ? 'bg-orange-500 bg-opacity-20 text-orange-400' : 
                            'bg-red-500 bg-opacity-20 text-red-400'
                          }`}>
                            {Math.round(categoryScore * 100)}%
                          </div>
                        </div>
                        
                        <div className="text-sm text-gray-300 space-y-2">
                          <div>
                            <strong>Generated:</strong> {categoryFiles.length} files
                          </div>
                          <div>
                            <strong>Required:</strong> {categoryRequirements.length} files
                          </div>
                          <div>
                            <strong>Files:</strong> {categoryFiles.map(f => f.fileName).join(', ') || 'None'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Template Adherence */}
                <div className="rounded-xl p-4 lg:p-6 mb-8" style={{ background: 'rgba(255, 107, 53, 0.1)', border: '1px solid var(--kontext-border-accent)' }}>
                  <h4 className="mb-4 text-lg font-semibold" style={{ color: 'var(--kontext-orange)' }}>
                    🎯 Template Adherence Analysis
                  </h4>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-gray-400 text-xs mb-1">
                        Overall Score
                      </div>
                      <div className="text-white text-2xl lg:text-3xl font-bold">
                        {Math.round(selectedFileAnalysis.templateAdherence.overallScore * 100)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400 text-xs mb-1">
                        Backend
                      </div>
                      <div className="text-white text-2xl lg:text-3xl font-bold">
                        {Math.round(selectedFileAnalysis.templateAdherence.backendCompliance * 100)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400 text-xs mb-1">
                        Frontend
                      </div>
                      <div className="text-white text-2xl lg:text-3xl font-bold">
                        {Math.round(selectedFileAnalysis.templateAdherence.frontendCompliance * 100)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400 text-xs mb-1">
                        Structure
                      </div>
                      <div className="text-white text-2xl lg:text-3xl font-bold">
                        {Math.round(selectedFileAnalysis.templateAdherence.structuralCompliance * 100)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                {selectedFileAnalysis.recommendations.length > 0 && (
                  <div className="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 rounded-lg p-4 lg:p-6">
                    <h4 className="text-green-400 mb-4 text-lg font-semibold">
                      💡 Recommendations
                    </h4>
                    <ul className="space-y-2 text-gray-300 pl-4">
                      {selectedFileAnalysis.recommendations.map((recommendation, index) => (
                        <li key={index} className="text-sm leading-relaxed">
                          • {recommendation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 lg:py-16 text-gray-400 border border-dashed border-gray-600 border-opacity-50 rounded-xl">
                <div className="text-4xl mb-4 opacity-50">📁</div>
                <h3 className="text-white mb-2 text-lg">No File Analysis Available</h3>
                <p className="mb-4 text-sm">
                  Select a session from the Debug Sessions tab and click "Analyze Files" to see:
                </p>
                <ul className="text-left inline-block space-y-1 text-sm">
                  <li>• File completeness vs. requirements</li>
                  <li>• Deployment readiness assessment</li>
                  <li>• Template adherence analysis</li>
                  <li>• Missing file identification</li>
                  <li>• Platform integration status</li>
                </ul>
                <p className="mt-4 text-xs text-gray-500">
                  This helps identify if generated projects have all necessary files for successful compilation and deployment.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Template Analytics Tab */}
        {activeTab === 'debug' && activeDebugTab === 'templates' && (
          <div className="rounded-2xl p-4 lg:p-8" style={{ 
            background: 'rgba(17, 17, 17, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            maxWidth: '1400px',
            margin: '0 auto'
          }}>
            <h2 className="text-xl lg:text-2xl font-semibold mb-6 text-white text-center lg:text-left">
              🎯 Template Performance Analysis (Mainnet)
            </h2>
            {templateAnalytics.length === 0 ? (
              <div className="text-center py-12 lg:py-16 text-gray-400 border border-dashed border-gray-600 border-opacity-50 rounded-xl">
                <div className="text-4xl mb-4 opacity-50">🎯</div>
                <h3 className="text-white mb-2 text-lg">No Template Analytics Available</h3>
                <p className="text-sm">
                  Template performance data will appear here after project generations are completed on mainnet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {templateAnalytics.map(template => (
                  <div key={template.templateName} className="bg-black bg-opacity-30 border border-gray-600 border-opacity-50 rounded-xl p-4 lg:p-6">
                    <h4 className="text-orange-400 mb-4 text-lg font-semibold">
                      🎯 {template.templateName}
                    </h4>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Usage Count:</span>
                        <span className="text-white font-semibold text-sm">
                          {template.usageCount}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Success Rate:</span>
                        <span className={`font-semibold text-sm ${
                          template.successRate > 0.8 ? 'text-green-400' : 
                          template.successRate > 0.6 ? 'text-orange-400' : 'text-red-400'
                        }`}>
                          {Math.round(template.successRate * 100)}%
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Avg Confidence:</span>
                        <span className="text-green-400 font-semibold text-sm">
                          {Math.round(template.averageConfidence * 100)}%
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Avg Files:</span>
                        <span className="font-semibold text-sm" style={{ color: 'var(--kontext-orange)' }}>
                          {Math.round(template.averageFiles)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Avg Duration:</span>
                        <span className="text-white font-semibold text-sm">
                          {Math.round(template.averageDuration / 1000)}s
                        </span>
                      </div>
                    </div>

                    {/* Common Prompt Patterns */}
                    {template.commonPromptPatterns.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-600 border-opacity-50">
                        <div className="text-gray-400 text-xs font-medium mb-2">
                          Common Usage Patterns:
                        </div>
                        {template.commonPromptPatterns.slice(0, 2).map((pattern, index) => (
                          <div key={index} className="text-gray-300 text-xs mb-1 italic">
                            "{pattern.substring(0, 60)}..."
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <h2 className="text-xl lg:text-2xl xl:text-3xl font-semibold mb-6 lg:mb-8 text-center lg:text-left" style={{ 
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              📢 Notifications
            </h2>
            
            <div className="rounded-xl p-6 lg:p-8" style={{
              background: 'rgba(17, 17, 17, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}>
              <Suspense fallback={<div style={{padding: '2rem', textAlign: 'center', color: '#888'}}>Loading Notification Sender...</div>}>
                <AdminNotificationSender />
              </Suspense>
            </div>
          </div>
        )}

        {/* Canister Pool Management */}
        {activeTab === 'pools' && (
          <div style={{ maxWidth: '100%', margin: '0 auto' }}>
            <Suspense fallback={<div style={{padding: '2rem', textAlign: 'center', color: '#888'}}>Loading Canister Pool Manager...</div>}>
              <CanisterPoolManager />
            </Suspense>
          </div>
        )}

        {/* User Canister Administration */}
        {activeTab === 'userAdmin' && (
          <div style={{ maxWidth: '100%', margin: '0 auto' }}>
            <Suspense fallback={<div style={{padding: '2rem', textAlign: 'center', color: '#888'}}>Loading User Canister Admin...</div>}>
              <UserCanisterAdmin />
            </Suspense>
          </div>
        )}

        {activeTab === 'wasmConfig' && (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <h2 className="text-xl lg:text-2xl xl:text-3xl font-semibold mb-6 lg:mb-8 text-center lg:text-left" style={{ 
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              ⚙️ WASM Configuration
            </h2>
            
            <div className="rounded-xl p-6 lg:p-8" style={{
              background: 'rgba(17, 17, 17, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}>
              <Suspense fallback={<div style={{padding: '2rem', textAlign: 'center', color: '#888'}}>Loading WASM Config Manager...</div>}>
                <WasmConfigManager />
              </Suspense>
            </div>
          </div>
        )}

        {activeTab === 'forumCategories' && (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <h2 className="text-xl lg:text-2xl xl:text-3xl font-semibold mb-6 lg:mb-8 text-center lg:text-left" style={{ 
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              💬 Forum Categories
            </h2>
            
            <div className="rounded-xl p-6 lg:p-8" style={{
              background: 'rgba(17, 17, 17, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}>
              <Suspense fallback={<div style={{padding: '2rem', textAlign: 'center', color: '#888'}}>Loading Forum Category Manager...</div>}>
                <ForumCategoryManager />
              </Suspense>
            </div>
          </div>
        )}

        {activeTab === 'university' && (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <h2 className="text-xl lg:text-2xl xl:text-3xl font-semibold mb-6 lg:mb-8 text-center lg:text-left" style={{ 
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              🎓 University Content
            </h2>
            
            <div className="rounded-xl p-6 lg:p-8" style={{
              background: 'rgba(17, 17, 17, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}>
              <Suspense fallback={<div style={{padding: '2rem', textAlign: 'center', color: '#888'}}>Loading University Content Manager...</div>}>
                <UniversityContentManager />
              </Suspense>
            </div>
          </div>
        )}

        {activeTab === 'marketplace' && (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <h2 className="text-xl lg:text-2xl xl:text-3xl font-semibold mb-6 lg:mb-8 text-center lg:text-left" style={{ 
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              🛒 Marketplace Admin
            </h2>
            
            <div className="rounded-xl p-6 lg:p-8" style={{
              background: 'rgba(17, 17, 17, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}>
              <Suspense fallback={<div style={{padding: '2rem', textAlign: 'center', color: '#888'}}>Loading Marketplace Admin Manager...</div>}>
                <MarketplaceAdminManager />
              </Suspense>
            </div>
          </div>
        )}

        {activeTab === 'subscriptions' && (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <Suspense fallback={<div style={{padding: '2rem', textAlign: 'center', color: '#888'}}>Loading Subscription Plan Manager...</div>}>
              <SubscriptionPlanManager />
            </Suspense>
          </div>
        )}

        {activeTab === 'platformSettings' && (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <h2 className="text-xl lg:text-2xl xl:text-3xl font-semibold mb-6 lg:mb-8 text-center lg:text-left" style={{ 
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              ⚙️ Platform Settings
            </h2>
            
            <div className="rounded-xl p-6 lg:p-8" style={{
              background: 'rgba(17, 17, 17, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}>
              {/* API Keys Section */}
              <div className="space-y-6">
                <h3 className="text-lg lg:text-xl font-semibold mb-4" style={{ color: '#ff6b35' }}>
                  🔑 AI Model API Keys
                </h3>
                
                <div className="space-y-4">
                  {/* Claude API Key */}
                  <div className="rounded-lg p-4" style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#d1d5db' }}>
                      Claude (Anthropic) API Key
                      <span className="ml-2 text-xs" style={{ color: '#9ca3af' }}>Must start with sk-ant-</span>
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="password"
                        id="claudeApiKey"
                        placeholder="sk-ant-..."
                        className="flex-1 px-4 py-2 rounded-lg border text-sm"
                        style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          color: '#fff'
                        }}
                      />
                      <button
                        onClick={async () => {
                          const input = document.getElementById('claudeApiKey') as HTMLInputElement;
                          const key = input.value.trim();
                          
                          if (!key) {
                            setError('Claude API key cannot be empty');
                            return;
                          }
                          
                          if (!key.startsWith('sk-ant-')) {
                            setError('Invalid Claude API key format. Must start with sk-ant-');
                            return;
                          }
                          
                          try {
                            setLoading(true);
                            setError('');
                            const result = await mainActor.updateClaudeApiKey(key);
                            if ('ok' in result) {
                              setSuccess(result.ok);
                              input.value = '';
                            } else {
                              setError(result.err);
                            }
                          } catch (err) {
                            setError(`Failed to update Claude API key: ${err}`);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading}
                        className="px-6 py-2 rounded-lg font-medium text-sm transition-all"
                        style={{
                          background: 'linear-gradient(135deg, #ff6b35, #f97316)',
                          color: '#fff',
                          opacity: loading ? 0.6 : 1,
                          cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Update
                      </button>
                    </div>
                  </div>

                  {/* OpenAI API Key */}
                  <div className="rounded-lg p-4" style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#d1d5db' }}>
                      OpenAI API Key
                      <span className="ml-2 text-xs" style={{ color: '#9ca3af' }}>Must start with sk-</span>
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="password"
                        id="openaiApiKey"
                        placeholder="sk-..."
                        className="flex-1 px-4 py-2 rounded-lg border text-sm"
                        style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          color: '#fff'
                        }}
                      />
                      <button
                        onClick={async () => {
                          const input = document.getElementById('openaiApiKey') as HTMLInputElement;
                          const key = input.value.trim();
                          
                          if (!key) {
                            setError('OpenAI API key cannot be empty');
                            return;
                          }
                          
                          if (!key.startsWith('sk-')) {
                            setError('Invalid OpenAI API key format. Must start with sk-');
                            return;
                          }
                          
                          try {
                            setLoading(true);
                            setError('');
                            const result = await mainActor.updateOpenAIApiKey(key);
                            if ('ok' in result) {
                              setSuccess(result.ok);
                              input.value = '';
                            } else {
                              setError(result.err);
                            }
                          } catch (err) {
                            setError(`Failed to update OpenAI API key: ${err}`);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading}
                        className="px-6 py-2 rounded-lg font-medium text-sm transition-all"
                        style={{
                          background: 'linear-gradient(135deg, #ff6b35, #f97316)',
                          color: '#fff',
                          opacity: loading ? 0.6 : 1,
                          cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Update
                      </button>
                    </div>
                  </div>

                  {/* Gemini API Key */}
                  <div className="rounded-lg p-4" style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#d1d5db' }}>
                      Google Gemini API Key
                      <span className="ml-2 text-xs" style={{ color: '#9ca3af' }}>Must start with AIza</span>
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="password"
                        id="geminiApiKey"
                        placeholder="AIza..."
                        className="flex-1 px-4 py-2 rounded-lg border text-sm"
                        style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          color: '#fff'
                        }}
                      />
                      <button
                        onClick={async () => {
                          const input = document.getElementById('geminiApiKey') as HTMLInputElement;
                          const key = input.value.trim();
                          
                          if (!key) {
                            setError('Gemini API key cannot be empty');
                            return;
                          }
                          
                          if (!key.startsWith('AIza')) {
                            setError('Invalid Gemini API key format. Must start with AIza');
                            return;
                          }
                          
                          try {
                            setLoading(true);
                            setError('');
                            const result = await mainActor.updateGeminiApiKey(key);
                            if ('ok' in result) {
                              setSuccess(result.ok);
                              input.value = '';
                            } else {
                              setError(result.err);
                            }
                          } catch (err) {
                            setError(`Failed to update Gemini API key: ${err}`);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading}
                        className="px-6 py-2 rounded-lg font-medium text-sm transition-all"
                        style={{
                          background: 'linear-gradient(135deg, #ff6b35, #f97316)',
                          color: '#fff',
                          opacity: loading ? 0.6 : 1,
                          cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Update
                      </button>
                    </div>
                  </div>

                  {/* Kimi API Key */}
                  <div className="rounded-lg p-4" style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#d1d5db' }}>
                      Kimi (Moonshot AI) API Key
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="password"
                        id="kimiApiKey"
                        placeholder="Your Kimi API key"
                        className="flex-1 px-4 py-2 rounded-lg border text-sm"
                        style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          color: '#fff'
                        }}
                      />
                      <button
                        onClick={async () => {
                          const input = document.getElementById('kimiApiKey') as HTMLInputElement;
                          const key = input.value.trim();
                          
                          if (!key) {
                            setError('Kimi API key cannot be empty');
                            return;
                          }
                          
                          try {
                            setLoading(true);
                            setError('');
                            const result = await mainActor.updateKimiApiKey(key);
                            if ('ok' in result) {
                              setSuccess(result.ok);
                              input.value = '';
                            } else {
                              setError(result.err);
                            }
                          } catch (err) {
                            setError(`Failed to update Kimi API key: ${err}`);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading}
                        className="px-6 py-2 rounded-lg font-medium text-sm transition-all"
                        style={{
                          background: 'linear-gradient(135deg, #ff6b35, #f97316)',
                          color: '#fff',
                          opacity: loading ? 0.6 : 1,
                          cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Update
                      </button>
                    </div>
                  </div>
                </div>

                {/* Information Box */}
                <div className="rounded-lg p-4 mt-6" style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  <p className="text-sm" style={{ color: '#93c5fd' }}>
                    <strong>ℹ️ Security Note:</strong> API keys are stored securely in the platform canister and are never exposed to the frontend. 
                    Only admins can update these keys. The keys can be retrieved via backend query methods for platform use.
                  </p>
                </div>

                {/* Stripe Keys Section */}
                <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <h3 className="text-lg lg:text-xl font-semibold mb-4" style={{ color: '#ff6b35' }}>
                    💳 Stripe Configuration
                  </h3>
                  
                  <div className="rounded-lg p-4" style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <p className="text-sm mb-4" style={{ color: '#9ca3af' }}>
                      Update Stripe keys via dfx command line:
                    </p>
                    <pre className="p-3 rounded text-xs overflow-x-auto" style={{
                      background: 'rgba(0, 0, 0, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#10b981'
                    }}>
{`dfx canister call kontext_backend updateStripeKeys \\
  '("sk_live_YOUR_SECRET_KEY", "pk_live_YOUR_PUBLISHABLE_KEY")'`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Prompts and Quality tabs */}
        {activeTab === 'debug' && (activeDebugTab === 'prompts' || activeDebugTab === 'quality') && (
          <div className="rounded-2xl p-4 lg:p-8" style={{ 
            background: 'rgba(17, 17, 17, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            maxWidth: '1400px',
            margin: '0 auto'
          }}>
            <h2 className="text-xl lg:text-2xl font-semibold mb-6 text-white text-center lg:text-left">
              {activeDebugTab === 'prompts' ? '📝 Prompt Intelligence (Mainnet)' : '⭐ Quality Metrics (Mainnet)'}
            </h2>
            
            {promptAnalytics && activeDebugTab === 'prompts' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                <div className="rounded-xl p-4 lg:p-6" style={{ background: 'rgba(255, 107, 53, 0.1)', border: '1px solid var(--kontext-border-accent)' }}>
                  <h3 className="mb-4 text-lg font-semibold" style={{ color: 'var(--kontext-orange)' }}>
                    📊 Prompt Statistics
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-sm">Total Prompts:</span>
                      <span className="text-white font-semibold text-sm">{promptAnalytics.totalPrompts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-sm">Successful:</span>
                      <span className="text-green-400 font-semibold text-sm">{promptAnalytics.successfulPrompts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-sm">Avg Length:</span>
                      <span className="text-white font-semibold text-sm">{Math.round(promptAnalytics.averageLength)} chars</span>
                    </div>
                  </div>
                </div>

                <div className="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 rounded-xl p-4 lg:p-6">
                  <h3 className="text-green-400 mb-4 text-lg font-semibold">
                    🔑 Common Keywords
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {promptAnalytics.commonKeywords.slice(0, 8).map(keyword => (
                      <span key={keyword} className="bg-green-500 bg-opacity-20 text-green-400 px-2 py-1 rounded-full text-xs font-medium">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 lg:py-16 text-gray-400 border border-dashed border-gray-600 border-opacity-50 rounded-xl">
                <div className="text-4xl mb-4 opacity-50">
                  {activeDebugTab === 'prompts' ? '📝' : '⭐'}
                </div>
                <h3 className="text-white mb-2 text-lg">
                  {activeDebugTab === 'prompts' ? 'No Prompt Analytics Available' : 'No Quality Metrics Available'}
                </h3>
                <p className="text-sm">
                  {activeDebugTab === 'prompts' 
                    ? 'Prompt intelligence data will appear here after analyzing user inputs from mainnet debug sessions.'
                    : 'Quality analysis will appear here after processing mainnet debug session data.'
                  }
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-600 border-opacity-50 rounded-xl p-6 max-w-md w-full text-white">
            <h3 className="text-white mb-4 text-lg font-semibold">
              🗑️ Delete Debug Session (Mainnet)
            </h3>
            
            <p className="text-gray-400 mb-6 leading-relaxed text-sm">
              Are you sure you want to permanently delete this debug session and all its associated data files from mainnet?
            </p>

            <div className="bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 rounded-lg p-4 mb-6">
              <div className="text-red-400 text-sm font-medium mb-2">
                Session ID: {deleteConfirmation}
              </div>
              <div className="text-gray-400 text-xs">
                This action cannot be undone. All debug files will be permanently removed from mainnet.
              </div>
            </div>

            <div className="flex gap-3 justify-end flex-col sm:flex-row">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="bg-gray-700 bg-opacity-50 border border-gray-600 border-opacity-50 text-gray-300 px-6 py-2 rounded-lg cursor-pointer text-sm hover:bg-gray-600 hover:bg-opacity-50 transition-all duration-200"
              >
                Cancel
              </button>
              
              <button
                onClick={() => deleteDebugSession(deleteConfirmation)}
                disabled={deletingSessionId === deleteConfirmation}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  deletingSessionId === deleteConfirmation
                    ? 'bg-red-500 bg-opacity-30 cursor-not-allowed opacity-60'
                    : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white'
                }`}
              >
                {deletingSessionId === deleteConfirmation ? '⏳ Deleting...' : '🗑️ Delete Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Command Center */}
    </div>
  );
};