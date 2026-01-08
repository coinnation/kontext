import { Principal } from '@dfinity/principal';
import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { createAgent } from '@dfinity/utils';
import { idlFactory } from '../../candid/kontext_backend.did.js';
import { _SERVICE } from '../../candid/kontext_backend.did';
import { idlFactory as userIdlFactory } from '../../candid/user.did.js';
import { _USER_SERVICE } from '../../candid/user';
import { icpData } from '../icpData';
import { Project, CodeArtifact, NPMPackageInfo, PackageInfo, ChatInterfaceMessage, ProjectMetadata, SubscriptionTier, DeployedAgent, ReferenceItem, CodeRule, ColorPalette, DesignInspiration, DocumentationItem, GitHubGuideline, CodeTemplate, APIEndpoint, UserContext, AgentCredentials, LLMCredentials, APICredential, DatabaseCredential, EnvironmentConfig, EnvVariable, SecurityAuditLog, Environment } from '../types';
import { useAppStore } from '../store/appStore';


interface CyclesMintingCanister {
  notify_top_up: (args: {
    block_index: bigint;
    canister_id: Principal;
  }) => Promise<null>;
}


export interface CanisterCreationConfig {
  memoryGB: number;
  computeAllocation: number;
  freezingThreshold: number[];
  durationInDays: number;
  cyclesAmount: number;
}

export interface CanisterError {
  type: 'NETWORK' | 'UNAUTHORIZED' | 'INSUFFICIENT_CYCLES' | 'CANISTER_EXISTS' | 'VALIDATION' | 'UNKNOWN';
  message: string;
  retryable: boolean;
  code?: string;
}

export interface CanisterCreationResult {
  success: boolean;
  canisterId?: string;
  error?: CanisterError;
}

interface ProjectSaveResult {
  success: boolean;
  projectId?: string;
  updatedProject?: Project;
  error?: string;
  metadata?: {
    filesUploaded: number;
    totalSize: number;
    uploadTime: number;
  };
}

export interface ProjectLoadResult {
  success: boolean;
  projects?: Project[];
  error?: string;
  metadata?: {
    totalProjects: number;
    loadTime: number;
  };
}

export interface FileUploadResult {
  success: boolean;
  filesUploaded?: number;
  filesUpdated?: number;
  filesFailed?: number;
  error?: string;
  details?: {
    created: string[];
    updated: string[];
    failed: Array<{ fileName: string; error: string }>;
  };
}

export interface DeductionResult {
  success: boolean;
  unitsDeducted: number;
  dollarCost: number;
  remainingBalance: number;
  error?: string;
}

export interface DeployedAgentResult {
  success: boolean;
  agents?: DeployedAgent[];
  error?: string;
}

export interface ContextResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}


// ENHANCED: File migration result interface with detailed phase tracking
export interface FileMigrationResult {
  success: boolean;
  filesMigrated: number;
  filesDeleted: number;
  migrationErrors: Array<{ fileName: string; error: string; operation: 'migrate' | 'delete' }>;
  error?: string;
  phaseResults?: {
    phase1Success: boolean;
    phase1Created: number;
    phase1Failed: number;
    phase2Success: boolean;
    phase2Deleted: number;
    phase2Failed: number;
  };
}

export interface CodeArtifactsResult {
  success: boolean;
  artifacts?: CodeArtifact[];
  error?: string;
}

export interface MessagesResult {
  success: boolean;
  messages?: ChatInterfaceMessage[];
  error?: string;
  metadata?: {
    totalMessages: number;
    loadTime: number;
  };
}

export interface MessageSaveResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface MetadataResult {
  success: boolean;
  metadata?: ProjectMetadata;
  error?: string;
}

// ENHANCED: CodeArtifact CRUD interfaces for SidePane file editing
export interface CodeArtifactReadResult {
  success: boolean;
  artifact?: CodeArtifact;
  error?: string;
}

export interface CodeArtifactCreateResult {
  success: boolean;
  artifactId?: string;
  artifact?: CodeArtifact;
  error?: string;
}

export interface CodeArtifactUpdateResult {
  success: boolean;
  artifact?: CodeArtifact;
  error?: string;
}

export interface CodeArtifactDeleteResult {
  success: boolean;
  error?: string;
}

// FIXED: Wallet and Balance specific interfaces
export interface UserWalletInfo {
  principal: string;
  subaccount: string;
  accountIdentifier: string;
}

export interface UserStateMetadata {
  balance: number;
  cycleBalance: bigint;
  moduleHash?: Uint8Array;
  lastUpdated: number;
  totalKeys: number;
  memoryUsage: number;
  version: string;
  uptime: number;
  totalUsers: number;
  idleCyclesBurnedPerDay: number;
  stableStateSize: number;
  stableMemoryUsage: number;
  heapMemoryUsage: number;
  memorySize: number;
}

// NEW: Server pair interface for backend integration
export interface ServerPairResult {
  success: boolean;
  serverPairs?: any[];
  pairId?: string;
  error?: string;
}

// NEW: Interface for server creation with project context
export interface ServerCreationContext {
  projectId: string;
  projectName: string;
}

// UPDATED: Server pair selection dialog specific interfaces with reassignment support
export interface ServerPairWithAssignment {
  pairId: string;
  name: string;
  frontendCanisterId: string;
  backendCanisterId: string;
  createdAt: number;
  creditsAllocated: number;
  currentProjectId?: string; // Current project assignment
  currentProjectName?: string; // Current project name for display
  canReassign: boolean; // Whether this pair can be reassigned
}

export interface AllServerPairsResult {
  success: boolean;
  serverPairs?: ServerPairWithAssignment[];
  error?: string;
}

export interface ServerPairCreationResult {
  success: boolean;
  serverPairId?: string;
  frontendCanisterId?: string;
  backendCanisterId?: string;
  hostingConfigured?: boolean;
  message?: string;
  error?: string;
  fromPool?: boolean; // Indicates if server pair was assigned from pool
}

export interface ProjectWithServerPairResult {
  success: boolean;
  projectId?: string;
  serverPairId?: string;
  error?: string;
}

// ENHANCED: Subscription management interfaces with default subscription support
export interface SubscriptionInfo {
  tier: SubscriptionTier;
  isActive: boolean;
  customerId: string | null;
  subscriptionId: string | null;
  billingCycleStart: number | null;
  billingCycleEnd: number | null;
  monthlyCredits: number;
}

export interface SubscriptionUpdateResult {
  success: boolean;
  error?: string;
}

export interface SubscriptionUpdateData {
  customerId: string | null;
  subscriptionId: string | null;
  billingCycleStart: number | null;
  billingCycleEnd: number | null;
}

// ENHANCED: Minimal Stripe data interfaces for new backend methods
export interface MinimalStripeData {
  customerId: string;
  subscriptionActive: boolean;
  billingCycleEnd: number | null;
}

export interface StripeDataResult {
  success: boolean;
  data?: MinimalStripeData;
  error?: string;
}

export interface StripeCustomerResult {
  success: boolean;
  customerId?: string;
  error?: string;
}

export interface SubscriptionStatusResult {
  success: boolean;
  isActive?: boolean;
  error?: string;
}

// NEW: Account initialization interfaces
export interface UserProfile {
  username: string;
  displayName?: string;
  email?: string;
  bio?: string;
  avatar?: string;
  coverPhoto?: string;
  website?: string;
  github?: string;
  socials?: UserSocials;
  metadata?: Array<[string, string]>;
  avatarAsset?: ImageAsset;
  coverPhotoAsset?: ImageAsset;
}

export interface UserSocials {
  twitter?: string;
  discord?: string;
  telegram?: string;
  openchat?: string;
}

export interface ImageAsset {
  name: string;
  data: Uint8Array;
  mimeType: string;
  sizeBytes: bigint;
  uploadedAt: bigint;
  width?: bigint;
  height?: bigint;
}

export interface User {
  id: Principal;
  primaryAccountId?: Principal;
  created: bigint;
  preferences?: UserPreferences;
  linkedAccounts: Principal[];
  lastActive: bigint;
  profile: UserProfile;
}

export interface UserPreferences {
  theme?: string;
  notifications: NotificationPreferences;
  customPreferences?: Array<[string, string]>;
  defaultProjectPreferences?: any;
  visibility: VisibilityPreferences;
}

export interface NotificationPreferences {
  channelPreferences: {
    email: boolean;
    discord: boolean;
    inApp: boolean;
    telegram: boolean;
  };
  notificationTypes?: Array<[string, boolean]>;
  digestFrequency?: string;
}

export interface VisibilityPreferences {
  projects: 'Public' | 'Private' | 'Contacts';
  stats: 'Public' | 'Private' | 'Contacts';
  activity: 'Public' | 'Private' | 'Contacts';
  profile: 'Public' | 'Private' | 'Contacts';
}

// ENHANCED: User initialization result with subscription info
export interface UserInitializationResult {
  success: boolean;
  user?: User;
  subscriptionInfo?: SubscriptionInfo;
  error?: string;
}

export interface OnboardingStatus {
  hasCompletedOnboarding: boolean;
  firstLoginAt?: bigint;
  accountCreatedAt?: bigint;
}

export interface AIUsageRecord {
  model: string;
  tokensUsed: bigint;
  creditsDeducted: bigint;
  inputTokens: bigint;
  projectId: string;
  outputTokens: bigint;
  operation: string;
  timestamp: bigint;
}

export interface Transaction {
  transactionType: 'sent' | 'received' | 'canister';
  isPositive: boolean;
  memo?: string;
  counterparty: string;
  timestamp: bigint;
  amount: bigint;
}

// NEW: Enhanced canister metadata interface
export interface CanisterMetadata {
  canisterType: string;
  name: string;
  project?: string;
  subType?: string;
  didInterface?: string;
  stableInterface?: string;
}

// NEW: User canister with metadata interface
export interface UserCanisterWithMetadata {
  principal: Principal;
  canisterType: string;
  name: string;
  metadata?: CanisterMetadata;
}

// ENHANCED: ULTRA-PARALLEL Server Pair Move Interfaces
export interface ParallelMoveResult {
  success: boolean;
  error?: string;
  phases?: {
    dataLoad: { success: boolean; timeMs: number; error?: string };
    validation: { success: boolean; timeMs: number; error?: string };
    canisterMetadataUpdate: { success: boolean; timeMs: number; canisters: number; error?: string };
    serverPairUpdate: { success: boolean; timeMs: number; error?: string };
    cacheInvalidation: { success: boolean; timeMs: number; error?: string };
  };
  totalTimeMs?: number;
  performanceMetrics?: {
    parallelOperations: number;
    concurrencyLevel: number;
    averageOperationTime: number;
  };
}

export interface ServerPairMoveContext {
  pairId: string;
  currentProjectId?: string;
  targetProjectId: string;
  frontendCanisterId: string;
  backendCanisterId: string;
  serverPairData: any;
}

export class UserCanisterService {
  private actor: any = null;
  private userActors: Map<string, any> = new Map();
  private readonly canisterId = 'pkmhr-fqaaa-aaaaa-qcfeq-cai';
  private readonly defaultConfig: CanisterCreationConfig = {
    memoryGB: 1,
    computeAllocation: 0,
    freezingThreshold: [],
    durationInDays: 30,
    cyclesAmount: 2_000_000_000_000 // 2T cycles
  };

  // File upload constants
  private readonly MAX_FILE_SIZE = 1.8 * 1024 * 1024; // 1.8MB per file
  private readonly CHUNK_SIZE = 512 * 1024; // 512KB per chunk
  private readonly MAX_BATCH_SIZE = 10; // Max files per batch

  // ENHANCED: Ultra-high parallel operations for massive server pair moves
  private readonly MAX_PARALLEL_OPERATIONS = 30; // Increased for ultra-parallel processing
  private readonly METADATA_BATCH_SIZE = 25; // Process metadata in larger batches
  private readonly MAX_CONCURRENT_METADATA_CALLS = 40; // Maximum concurrent metadata operations
  private readonly SERVER_PAIR_MOVE_CONCURRENCY = 15; // Concurrent server pair move operations

  // ENHANCED: Parallel operation caching for optimization
  private serverPairMoveCache: Map<string, ServerPairMoveContext> = new Map();
  private lastParallelCacheUpdate: number = 0;
  private readonly PARALLEL_CACHE_TTL = 30000; // 30 seconds

  private userBalanceCache: Map<string, { balance: number; timestamp: number; ttl: number }> = new Map();
  private readonly BALANCE_CACHE_TTL = 30000; // 30 seconds
  private readonly MAX_CACHE_ENTRIES = 100;



  // ==================== NEW: PUBLIC STATIC UI GENERATION METHODS ====================

  /**
   * PUBLIC: Generate project icon based on project purpose and name
   */
  public static generateProjectIcon(projectType: any, projectName?: string, projectId?: string): string {
    // 🔥 CRITICAL: Project names come from AI spec - should be clean
    // Use project name (root cause fixed - names come clean from AI spec)
    const cleanName = projectName || '';
    
    // First check for default "New Project" name and return stars icon
    if (cleanName && cleanName.toLowerCase().trim() === 'new project') {
      return '✨';
    }
    
    if (!cleanName) {
      // Fallback to hash-based selection if no name or corrupted name
      const seedString = projectId || 'default';
      const hash = seedString.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const fallbackIcons = ['📁', '🛠️', '⚡', '🎯', '⭐', '🚀', '💡', '🎨'];
      return fallbackIcons[hash % fallbackIcons.length];
    }
    
    const nameLower = cleanName.toLowerCase();
    
    // Business & E-commerce
    if (nameLower.includes('shop') || nameLower.includes('store') || nameLower.includes('ecommerce') || nameLower.includes('marketplace')) return '🛒';
    if (nameLower.includes('payment') || nameLower.includes('billing') || nameLower.includes('invoice')) return '💳';
    if (nameLower.includes('business') || nameLower.includes('company') || nameLower.includes('corporate')) return '🏢';
    
    // Social & Communication
    if (nameLower.includes('chat') || nameLower.includes('message') || nameLower.includes('messenger')) return '💬';
    if (nameLower.includes('social') || nameLower.includes('network') || nameLower.includes('community')) return '👥';
    if (nameLower.includes('forum') || nameLower.includes('discussion')) return '🗣️';
    
    // Entertainment & Media
    if (nameLower.includes('game') || nameLower.includes('gaming') || nameLower.includes('play')) return '🎮';
    if (nameLower.includes('music') || nameLower.includes('audio') || nameLower.includes('sound')) return '🎵';
    if (nameLower.includes('video') || nameLower.includes('movie') || nameLower.includes('film')) return '🎬';
    if (nameLower.includes('photo') || nameLower.includes('gallery') || nameLower.includes('image')) return '📸';
    
    // Productivity & Tools
    if (nameLower.includes('todo') || nameLower.includes('task') || nameLower.includes('reminder')) return '✅';
    if (nameLower.includes('note') || nameLower.includes('journal') || nameLower.includes('diary')) return '📝';
    if (nameLower.includes('calendar') || nameLower.includes('schedule') || nameLower.includes('event')) return '📅';
    if (nameLower.includes('dashboard') || nameLower.includes('admin') || nameLower.includes('control')) return '📊';
    
    // Educational & Learning
    if (nameLower.includes('learn') || nameLower.includes('course') || nameLower.includes('tutorial')) return '📚';
    if (nameLower.includes('quiz') || nameLower.includes('test') || nameLower.includes('exam')) return '🧠';
    if (nameLower.includes('school') || nameLower.includes('university') || nameLower.includes('education')) return '🎓';
    
    // Health & Fitness
    if (nameLower.includes('health') || nameLower.includes('medical') || nameLower.includes('doctor')) return '🏥';
    if (nameLower.includes('fitness') || nameLower.includes('workout') || nameLower.includes('exercise')) return '💪';
    if (nameLower.includes('food') || nameLower.includes('recipe') || nameLower.includes('cooking')) return '🍳';
    
    // Travel & Location
    if (nameLower.includes('travel') || nameLower.includes('trip') || nameLower.includes('vacation')) return '✈️';
    if (nameLower.includes('map') || nameLower.includes('location') || nameLower.includes('navigation')) return '🗺️';
    if (nameLower.includes('weather') || nameLower.includes('forecast')) return '🌤️';
    
    // Finance & Analytics
    if (nameLower.includes('finance') || nameLower.includes('money') || nameLower.includes('budget')) return '💰';
    if (nameLower.includes('analytics') || nameLower.includes('stats') || nameLower.includes('report')) return '📈';
    if (nameLower.includes('crypto') || nameLower.includes('blockchain') || nameLower.includes('wallet')) return '🔗';
    
    // Creative & Design
    if (nameLower.includes('design') || nameLower.includes('creative') || nameLower.includes('art')) return '🎨';
    if (nameLower.includes('blog') || nameLower.includes('news') || nameLower.includes('article')) return '📰';
    if (nameLower.includes('portfolio') || nameLower.includes('showcase')) return '🖼️';
    
    // Generic project types
    if (nameLower.includes('api') || nameLower.includes('service') || nameLower.includes('backend')) return '🔧';
    if (nameLower.includes('website') || nameLower.includes('landing') || nameLower.includes('homepage')) return '🌐';
    if (nameLower.includes('app') || nameLower.includes('application')) return '📱';
    
    // Hello World specific check
    if (nameLower.includes('hello') || nameLower.includes('world')) return '👋';
    
    // Fallback to hash-based selection for unique but consistent icons
    const hash = cleanName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const genericIcons = ['🚀', '⚡', '🎯', '🛠️', '💡', '⭐', '🔥', '💫'];
    return genericIcons[hash % genericIcons.length];
  }

  /**
   * PUBLIC: Generate icon type based on project purpose
   */
  public static generateIconType(projectType: any, projectName?: string): string {
    if (!projectName) return 'generic';
    
    const nameLower = projectName.toLowerCase();
    
    // Map to broader categories for CSS styling
    if (nameLower.includes('business') || nameLower.includes('shop') || nameLower.includes('ecommerce')) return 'business';
    if (nameLower.includes('social') || nameLower.includes('chat') || nameLower.includes('community')) return 'social';
    if (nameLower.includes('game') || nameLower.includes('entertainment') || nameLower.includes('media')) return 'entertainment';
    if (nameLower.includes('learn') || nameLower.includes('education') || nameLower.includes('course')) return 'education';
    if (nameLower.includes('health') || nameLower.includes('fitness') || nameLower.includes('medical')) return 'health';
    if (nameLower.includes('finance') || nameLower.includes('analytics') || nameLower.includes('crypto')) return 'finance';
    if (nameLower.includes('creative') || nameLower.includes('design') || nameLower.includes('art')) return 'creative';
    if (nameLower.includes('productivity') || nameLower.includes('todo') || nameLower.includes('task')) return 'productivity';
    
    return 'generic';
  }

  /**
   * PUBLIC: Generate project preview text
   */
  public static generateProjectPreview(description: string | undefined, projectType: any): string {
    // First try description
    if (description && description.trim()) {
      const cleaned = description.trim();
      return cleaned.length > 100 ? cleaned.substring(0, 100) + '...' : cleaned;
    }
    
    // Fallback to project type description
    if (projectType) {
      const { name, subType } = projectType;
      if (name && subType) {
        return `A ${name.toLowerCase()} project using ${subType}`;
      } else if (name) {
        return `A ${name.toLowerCase()} project`;
      }
    }
    
    return 'A new project in Kontext';
  }

  /**
   * PUBLIC: Format relative time
   */
  public static formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diffMs = now - timestamp;
    
    // Handle future dates (shouldn't happen but just in case)
    if (diffMs < 0) return 'Just now';
    
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);
    
    if (diffYears > 0) return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
    if (diffMonths > 0) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    if (diffWeeks > 0) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    if (diffSeconds > 30) return `${diffSeconds} seconds ago`;
    
    return 'Just now';
  }

  /**
   * PUBLIC: Generate complete UI fields for a project
   */
  public static generateCompleteUIFields(project: Project, metadata?: ProjectMetadata): Partial<Project> {
    console.log('🎨 [UserCanisterService] Generating complete UI fields for project:', project.name);
    
    // Use current timestamp for relative time calculation
    const updatedMs = project.updated;
    
    // 1. Title: Use project name (root cause fixed - names come clean from AI spec)
    const originalName = project.name || '';
    const title = originalName.trim().length > 0 
      ? originalName.substring(0, 100).trim()
      : 'Untitled Project';

    // 2. Preview: from description with truncation
    const preview = this.generateProjectPreview(project.description, project.projectType);

    // 3. Icon: metadata customIcon > generated from project purpose > fallback
    const icon = metadata?.customIcon || this.generateProjectIcon(project.projectType, title, project.id) || '📁';

    // 4. Icon Type: based on project purpose or custom
    const iconType = metadata?.customIcon ? 'custom' : this.generateIconType(project.projectType, title);

    // 5. Time: formatted relative timestamp
    const time = this.formatRelativeTime(updatedMs);

    // 6. Template status: check if templateId exists
    const isTemplate = !!project.templateId || false;

    // 7. Unread count: would need message analysis (default to 0 for now)
    const unreadCount = 0; // TODO: Calculate based on messages and last read time

    // 8. Additional metadata-driven fields
    const customColor = metadata?.customColor;
    const isBookmarked = metadata?.isBookmarked || false;
    const priority = metadata?.priority;
    const category = metadata?.category;
    const tags = metadata?.tags || [];

    const uiFields = {
      title,
      preview,
      icon,
      iconType,
      time,
      isTemplate,
      unreadCount,
      // Include relevant metadata fields for UI use
      customColor,
      isBookmarked,
      priority,
      category,
      tags
    };

    console.log('✅ [UserCanisterService] Generated UI fields:', uiFields);
    return uiFields;
  }

  // ==================== EXISTING PRIVATE METHODS (NOW CALLING PUBLIC ONES) ====================

  // Initialize service with identity from auth context
  public async initializeWithIdentity(identity: Identity): Promise<void> {
    try {
      console.log('🔧 [UserCanisterService] Initializing with identity...');
      
      const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://127.0.0.1:4943'
        : 'https://icp0.io';
      
      console.log('🌐 [UserCanisterService] Using host:', host);

      const agentOptions: any = { 
        host,
        identity 
      };

      const agent = new HttpAgent(agentOptions);
      console.log('🔗 [UserCanisterService] HttpAgent created with identity');

      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        console.log('🔑 [UserCanisterService] Fetching root key for local development...');
        await agent.fetchRootKey();
        console.log('✅ [UserCanisterService] Root key fetched');
      }

      console.log('🎭 [UserCanisterService] Creating main actor for canister:', this.canisterId);
      const canisterActor = Actor.createActor<_SERVICE>(idlFactory, {
        agent,
        canisterId: this.canisterId,
      });
      console.log('✅ [UserCanisterService] Raw main actor created');

      this.actor = new Proxy(canisterActor, {
        get(target, prop) {
          if (typeof target[prop] === 'function') {
            return async (...args: any[]) => {
              try {
                const result = await target[prop](...args);
                const convertedResult = icpData.fromCanister(result);
                return convertedResult;
              } catch (error) {
                console.error(`❌ [UserCanisterService] Error in ${String(prop)}:`, error);
                throw error;
              }
            };
          }
          return target[prop];
        }
      });

      console.log('✅ [UserCanisterService] Service initialization completed successfully');

    } catch (error) {
      console.error('❌ [UserCanisterService] Service initialization failed:', error);
      throw new Error(`Service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private cleanFileName(fileName: string): string {
    let cleanFileName = fileName;
    cleanFileName = cleanFileName.replace(/^.*?Complete file:\s*/i, '');
    cleanFileName = cleanFileName.replace(/^.*?\/\/\s*/, '');
    cleanFileName = cleanFileName.replace(/^.*?\/\*.*?\*\/\s*/s, '');
    return cleanFileName.trim();
  }

  // File type detection logic
  private getFileTypeAndLanguage(extension: string): { fileType: string; languageType: string } {
    switch (extension.toLowerCase()) {
      case '.css':
        return { fileType: 'text/css', languageType: 'css' };
      case '.tsx':
      case '.ts':
      case '.js':
      case '.jsx':
        return { fileType: 'text/typescript', languageType: 'typescript' };
      case '.mo':
        return { fileType: 'text/x-motoko', languageType: 'motoko' };
      case '.json':
        return { fileType: 'application/json', languageType: 'json' };
      case '.html':  // Add this case
        return { fileType: 'text/html', languageType: 'html' };
      default:
        return { fileType: 'text/plain', languageType: 'text' };
    }
  }

  // Path resolution logic from working project
  private resolveFilePath(cleanFileName: string, projectName: string): { finalFileName: string; filePath: string } {
    let filePath = '';
    let finalFileName = cleanFileName;

    if (cleanFileName.includes('/')) {
      const pathParts = cleanFileName.split('/');
      finalFileName = pathParts.pop() || cleanFileName;
      filePath = pathParts.join('/');

      // Only add project name if the path doesn't already start with the project structure
      if (!filePath.startsWith('src/') && !filePath.startsWith(projectName)) {
        filePath = `${projectName}/${filePath}`;
      } else if (filePath.startsWith('src/')) {
        // Path already starts with src/, so just prepend project name
        filePath = `${projectName}/${filePath}`;
      }
    } else {
      // File without path - use default locations
      const extension = cleanFileName.substring(cleanFileName.lastIndexOf('.')).toLowerCase();
      
      if (['.tsx', '.ts', '.css', '.js', '.jsx'].includes(extension)) {
        filePath = `${projectName}/src/frontend/src`;
      } else if (extension === '.mo') {
        filePath = `${projectName}/src/backend/src`;
      } else if (['.json'].includes(extension)) {
        // Config files go in frontend root
        filePath = `${projectName}/src/frontend`;
      } else {
        filePath = projectName;
      }
    }

    return { finalFileName, filePath };
  }

  private async initializeUserActor(userCanisterId: string, identity: Identity): Promise<void> {
    if (this.userActors.has(userCanisterId)) {
      return; // Already initialized for this canister
    }

    try {
      console.log('🎭 [UserCanisterService] Creating user actor for canister:', userCanisterId);

      const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://127.0.0.1:4943'
        : 'https://icp0.io';

      const agentOptions: any = { 
        host,
        identity 
      };

      const agent = new HttpAgent(agentOptions);

      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        await agent.fetchRootKey();
      }

      const userCanisterActor = Actor.createActor<_USER_SERVICE>(userIdlFactory, {
        agent,
        canisterId: userCanisterId,
      });

      const userActor = new Proxy(userCanisterActor, {
        get(target, prop) {
          if (typeof target[prop] === 'function') {
            return async (...args: any[]) => {
              try {
                // console.log(`📞 [UserCanisterService] Calling user method: ${String(prop)} with args:`, args);
                const result = await target[prop](...args);
                // console.log(`📤 [UserCanisterService] Raw result from user ${String(prop)}:`, result);
                return icpData.fromCanister(result);
              } catch (error) {
                console.error(`❌ [UserCanisterService] Error in user ${String(prop)}:`, error);
                throw error;
              }
            };
          }
          return target[prop];
        }
      });

      this.userActors.set(userCanisterId, userActor);
      console.log('✅ [UserCanisterService] User actor initialized successfully');

    } catch (error) {
      console.error('❌ [UserCanisterService] User actor initialization failed:', error);
      throw error;
    }
  }

  private createCanisterError(error: any): CanisterError {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    console.log('🔍 [UserCanisterService] Creating canister error from:', errorMessage);
    
    // Parse specific error types
    if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('timeout')) {
      return { type: 'NETWORK', message: errorMessage, retryable: true };
    }
    
    if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication') || errorMessage.includes('identity')) {
      return { type: 'UNAUTHORIZED', message: errorMessage, retryable: false };
    }
    
    if (errorMessage.includes('cycles') || errorMessage.includes('insufficient')) {
      return { type: 'INSUFFICIENT_CYCLES', message: errorMessage, retryable: false };
    }
    
    if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
      return { type: 'CANISTER_EXISTS', message: errorMessage, retryable: false };
    }

    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return { type: 'VALIDATION', message: errorMessage, retryable: false };
    }
    
    return { type: 'UNKNOWN', message: errorMessage, retryable: true };
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error;
        console.error(`❌ [UserCanisterService] Attempt ${attempt} failed:`, error);
        
        const canisterError = this.createCanisterError(error);
        
        if (!canisterError.retryable || attempt === maxRetries) {
          console.log(`🛑 [UserCanisterService] Operation failed permanently. Retryable: ${canisterError.retryable}, Attempt: ${attempt}/${maxRetries}`);
          throw error;
        }
        
        const retryDelay = delay * Math.pow(2, attempt - 1); // Exponential backoff
        console.warn(`⏰ [UserCanisterService] Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    throw lastError;
  }

  private convertPrincipalToCanisterId(principalData: any): string | null {
    console.log('🔄 [UserCanisterService] Converting Principal data:', principalData);

    try {
      if (typeof principalData === 'string') {
        console.log('🔄 [UserCanisterService] Already a string, returning:', principalData);
        return principalData;
      }

      if (principalData && typeof principalData === 'object' && principalData._isPrincipal && principalData._arr) {
        console.log('🔄 [UserCanisterService] Converting Principal object with _arr:', principalData._arr);
        
        let uint8Array;
        if (principalData._arr instanceof Uint8Array) {
          uint8Array = principalData._arr;
        } else if (typeof principalData._arr === 'object') {
          const arrayKeys = Object.keys(principalData._arr).sort((a, b) => parseInt(a) - parseInt(b));
          const arrayValues = arrayKeys.map(key => principalData._arr[key]);
          uint8Array = new Uint8Array(arrayValues);
        } else {
          console.error('🔄 [UserCanisterService] Unexpected _arr format:', principalData._arr);
          return null;
        }

        const principal = Principal.fromUint8Array(uint8Array);
        const canisterIdText = principal.toText();
        
        console.log('🔄 [UserCanisterService] Converted to canister ID:', canisterIdText);
        return canisterIdText;
      }

      if (principalData && typeof principalData.toText === 'function') {
        const canisterIdText = principalData.toText();
        console.log('🔄 [UserCanisterService] Converted to canister ID:', canisterIdText);
        return canisterIdText;
      }

      if (principalData) {
        const principal = Principal.from(principalData);
        const canisterIdText = principal.toText();
        console.log('🔄 [UserCanisterService] Converted to canister ID:', canisterIdText);
        return canisterIdText;
      }

      console.error('🔄 [UserCanisterService] Unable to convert Principal data:', principalData);
      return null;

    } catch (error) {
      console.error('🔄 [UserCanisterService] Error converting Principal:', error);
      return null;
    }
  }

  // ENHANCED: Extract values from Motoko optional arrays
  private extractOptionalValue<T>(optionalArray: any): T | undefined {
    if (Array.isArray(optionalArray) && optionalArray.length > 0) {
      return optionalArray[0];
    }
    return undefined;
  }

  // ENHANCED: Extract multiple values from Motoko optional arrays
  private extractOptionalArray<T>(optionalArray: any): T[] {
    if (Array.isArray(optionalArray) && optionalArray.length > 0 && Array.isArray(optionalArray[0])) {
      return optionalArray[0];
    }
    return [];
  }

  private async setCanisterMetadata(
    userCanisterId: string,
    identity: Identity,
    canisterId: string,
    metadata: {
      name: string;
      canisterType: string;
      subType?: string;
      projectId: string;
    }
  ): Promise<void> {
    console.log('Setting canister metadata with project ID:', metadata.projectId);

    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) {
      throw new Error('User actor not initialized for metadata setting');
    }

    const canisterPrincipal = Principal.fromText(canisterId);
    
    const canisterMetadata = {
      subType: metadata.subType ? [metadata.subType] : [],
      canisterType: metadata.canisterType,
      name: metadata.name,
      didInterface: [],
      stableInterface: [],
      project: [metadata.projectId]
    };

    try {
      await userActor.updateCanisterMetadata(canisterPrincipal, canisterMetadata);
      console.log('Canister metadata updated successfully for project ID:', metadata.projectId);
      
      // Verify metadata was actually set
      const verification = await userActor.getCanisterMetadata(canisterPrincipal);
      if (!verification || verification.length === 0) {
        throw new Error('Metadata verification failed - metadata was not stored');
      }
      
      console.log('Metadata verification successful');
      
    } catch (error) {
      console.error('Failed to set canister metadata:', error);
      throw new Error(`Metadata setting failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Project handling with complete metadata mapping
  private prepareProjectForCanister(project: Project): any {
    console.log('🔄 [UserCanisterService] Preparing project for canister:', project.id);
    
    // Convert only the essential data type differences
    // CRITICAL: Include ALL fields expected by the canister IDL, even if optional
    const canisterProject: any = {
      id: project.id,
      name: project.name,
      status: project.status || 'active',
      visibility: project.visibility || 'private',
      projectType: project.projectType,
      // Convert timestamps to nanoseconds
      created: BigInt(Math.floor(project.created) * 1_000_000),
      updated: BigInt(Math.floor(project.updated) * 1_000_000),
      // Convert canisters to Principals (required field)
      canisters: (project.canisters || []).map(id => Principal.fromText(id)),
      // Optional fields - use [] for absent, [value] for present
      description: project.description ? [project.description] : [],
      templateId: project.templateId ? [project.templateId] : [],
      workingCopyBaseVersion: project.workingCopyBaseVersion ? [project.workingCopyBaseVersion] : [],
      collaborators: project.collaborators ? [project.collaborators.map(id => Principal.fromText(id))] : [],
      npmPackages: project.npmPackages ? [project.npmPackages] : [],
      motokoPackages: project.motokoPackages ? [project.motokoPackages] : [],
      lastMessageTime: project.lastMessageTime ? [BigInt(Math.floor(project.lastMessageTime) * 1_000_000)] : [],
      messageCount: project.messageCount ? [BigInt(project.messageCount)] : [],
      // ENHANCED: Prepare metadata for canister
      metadata: project.metadata ? [this.prepareProjectMetadataForCanister(project.metadata)] : [],
      // Messages handling
      messages: project.messages ? [project.messages.map(msg => this.prepareMessageForCanister(msg))] : [],
      // CRITICAL FIX: deployedAgents is required by deployed canister IDL
      // Format: opt vec DeployedAgent - use [] for absent/empty
      deployedAgents: project.deployedAgents && project.deployedAgents.length > 0 
        ? [project.deployedAgents.map((agent: any) => ({
            id: agent.id,
            name: agent.name,
            description: agent.description ? [agent.description] : [],
            backendCanisterId: agent.backendCanisterId ? [Principal.fromText(agent.backendCanisterId)] : [],
            frontendCanisterId: agent.frontendCanisterId ? [Principal.fromText(agent.frontendCanisterId)] : [],
            status: agent.status || 'inactive',
            agentType: agent.agentType ? [agent.agentType] : [],
            createdAt: BigInt(Math.floor((agent.createdAt || Date.now()) * 1_000_000)),
            lastDeployedAt: agent.lastDeployedAt ? [BigInt(Math.floor(agent.lastDeployedAt * 1_000_000))] : []
          }))]
        : [], // Empty array for no deployed agents (opt vec = [] when absent)
      // CRITICAL: Smart deployment tracking fields - all required by IDL
      hasBackendChanged: project.hasBackendChanged !== undefined ? [project.hasBackendChanged] : [],
      hasFrontendChanged: project.hasFrontendChanged !== undefined ? [project.hasFrontendChanged] : [],
      lastBackendDeployment: project.lastBackendDeployment ? [BigInt(Math.floor(project.lastBackendDeployment * 1_000_000))] : [],
      lastFrontendDeployment: project.lastFrontendDeployment ? [BigInt(Math.floor(project.lastFrontendDeployment * 1_000_000))] : [],
      lastDeploymentServerPairId: project.lastDeploymentServerPairId ? [project.lastDeploymentServerPairId] : []
    };

    console.log('🔄 [UserCanisterService] Prepared project for canister with complete metadata mapping');
    return canisterProject;
  }

  // ENHANCED: Complete project conversion with proper metadata integration - NOW USES PUBLIC METHODS
  private convertProjectFromCanister(canisterProject: any): Project {
    console.log('🔄 [UserCanisterService] Converting project from canister:', canisterProject.id);
    console.log('🔍 [UserCanisterService] Raw canister project structure:', canisterProject);
    
    // Extract metadata first (this drives UI field resolution)
    const rawMetadata = this.extractOptionalValue(canisterProject.metadata);
    const projectMetadata = rawMetadata ? this.convertProjectMetadataFromCanister(rawMetadata) : undefined;
    
    console.log('📊 [UserCanisterService] Extracted metadata:', projectMetadata);

    // Extract core optional fields properly
    const description = this.extractOptionalValue(canisterProject.description);
    const templateId = this.extractOptionalValue(canisterProject.templateId);
    const collaborators = this.extractOptionalArray(canisterProject.collaborators);
    const npmPackages = this.extractOptionalValue(canisterProject.npmPackages);
    const motokoPackages = this.extractOptionalValue(canisterProject.motokoPackages);
    const workingCopyBaseVersion = this.extractOptionalValue(canisterProject.workingCopyBaseVersion);
    const messages = this.extractOptionalArray(canisterProject.messages);
    const lastMessageTime = this.extractOptionalValue(canisterProject.lastMessageTime);
    const messageCount = this.extractOptionalValue(canisterProject.messageCount);

    // Convert timestamps back to milliseconds
    const createdMs = Number(canisterProject.created) / 1_000_000;
    const updatedMs = Number(canisterProject.updated) / 1_000_000;
    const lastMessageTimeMs = lastMessageTime ? Number(lastMessageTime) / 1_000_000 : undefined;

    // Build complete project with all fields
    const project: Project = {
      // Core canister fields
      id: canisterProject.id,
      name: canisterProject.name,
      description: description,
      projectType: canisterProject.projectType,
      canisters: canisterProject.canisters.map((p: any) => p.toText ? p.toText() : p.toString()),
      created: createdMs,
      updated: updatedMs,
      visibility: canisterProject.visibility,
      status: canisterProject.status,
      
      // Optional fields with proper extraction
      collaborators: collaborators.length > 0 ? collaborators.map((p: any) => p.toText ? p.toText() : p.toString()) : undefined,
      templateId: templateId,
      npmPackages: npmPackages,
      motokoPackages: motokoPackages,
      workingCopyBaseVersion: workingCopyBaseVersion,
      lastMessageTime: lastMessageTimeMs,
      messageCount: messageCount ? Number(messageCount) : undefined,
      
      // Messages with conversion
      messages: messages.map((msg: any) => this.convertMessageFromCanister(msg)),
      
      // Metadata
      metadata: projectMetadata,
      
      // Default files to empty object if not present
      files: canisterProject.files || {},
    };

    // ENHANCED: Generate all UI fields using the new public methods
    const uiFields = UserCanisterService.generateCompleteUIFields(project, projectMetadata);
    
    console.log('🎨 [UserCanisterService] Generated UI fields using public methods:', uiFields);

    // Merge UI fields into project
    const finalProject = {
      ...project,
      ...uiFields
    };

    console.log('✅ [UserCanisterService] Converted complete project from canister:', finalProject);
    return finalProject;
  }

  // Message conversion methods
  private prepareMessageForCanister(message: ChatInterfaceMessage): any {
    const messageType = message.type === 'user' ? { 'User': null } : 
                      message.type === 'system' ? { 'Assistant': null } : 
                      { 'System': null };
    
    return {
      ...message,
      timestamp: BigInt(message.timestamp.getTime() * 1_000_000), // Convert to nanoseconds
      messageType: messageType,
      isGenerating: message.isGenerating ? [message.isGenerating] : [],
      metadata: message.metadata ? [message.metadata.map(([k, v]) => [k, v])] : []
    };
  }

  private convertMessageFromCanister(canisterMessage: any): ChatInterfaceMessage {
    const messageType = 'User' in canisterMessage.messageType ? 'user' as const :
                       'Assistant' in canisterMessage.messageType ? 'system' as const :
                       'system' as const;
    
    // 🔥 FIX: Restore extractedFiles from localStorage (primary source) or metadata (fallback)
    const rawMetadata = this.extractOptionalValue(canisterMessage.metadata);
    let parsedMetadata: any = null;
    let extractedFiles: { [key: string]: string } = {};
    let deploymentReady = false;
    let isProjectGeneration = false;
    
    // First, try to restore from localStorage (most reliable)
    const messageId = canisterMessage.id;
    if (messageId) {
      try {
        const storageKey = `message_extractedFiles_${messageId}`;
        const storedData = localStorage.getItem(storageKey);
        if (storedData) {
          const parsed = JSON.parse(storedData);
          extractedFiles = parsed.extractedFiles || {};
          deploymentReady = parsed.deploymentReady || false;
          isProjectGeneration = parsed.isProjectGeneration || false;
          
          if (Object.keys(extractedFiles).length > 0) {
            console.log('📥 [UserCanisterService] Restored extractedFiles from localStorage:', {
              messageId,
              fileCount: Object.keys(extractedFiles).length,
              fileNames: Object.keys(extractedFiles).slice(0, 5)
            });
          }
        }
      } catch (storageError) {
        console.warn('⚠️ [UserCanisterService] Failed to restore from localStorage:', storageError);
      }
    }
    
    // Fallback: Try to restore from metadata if not found in localStorage
    if (Object.keys(extractedFiles).length === 0 && rawMetadata) {
      try {
        // Metadata might be a string (JSON) or already an object
        parsedMetadata = typeof rawMetadata === 'string' ? JSON.parse(rawMetadata) : rawMetadata;
        
        // Restore extractedFiles from metadata
        if (parsedMetadata.extractedFiles) {
          extractedFiles = parsedMetadata.extractedFiles;
          deploymentReady = parsedMetadata.deploymentReady || false;
          isProjectGeneration = parsedMetadata.isProjectGeneration || false;
          
          console.log('📥 [UserCanisterService] Restored extractedFiles from metadata:', {
            fileCount: Object.keys(extractedFiles).length,
            fileNames: Object.keys(extractedFiles).slice(0, 5)
          });
          
          // Remove extractedFiles from metadata to avoid duplication
          const { extractedFiles: _, deploymentReady: __, isProjectGeneration: ___, ...cleanMetadata } = parsedMetadata;
          parsedMetadata = Object.keys(cleanMetadata).length > 0 ? cleanMetadata : null;
        }
      } catch (error) {
        console.warn('⚠️ [UserCanisterService] Failed to parse message metadata:', error);
      }
    } else if (rawMetadata) {
      // If we got files from localStorage, still parse metadata for other fields
      try {
        parsedMetadata = typeof rawMetadata === 'string' ? JSON.parse(rawMetadata) : rawMetadata;
      } catch (error) {
        console.warn('⚠️ [UserCanisterService] Failed to parse message metadata:', error);
      }
    }
    
    const restoredMessage: ChatInterfaceMessage = {
      ...canisterMessage,
      type: messageType,
      timestamp: new Date(Number(canisterMessage.timestamp) / 1_000_000), // Convert from nanoseconds
      isGenerating: this.extractOptionalValue(canisterMessage.isGenerating) || false,
      metadata: parsedMetadata,
      extractedFiles: extractedFiles,
      isProjectGeneration: isProjectGeneration
    };
    
    // Add deploymentReady as a runtime property (not in type definition but used in code)
    if (deploymentReady) {
      (restoredMessage as any).deploymentReady = deploymentReady;
    }
    
    return restoredMessage;
  }

  // ENHANCED: Project metadata conversion methods with complete field mapping
  private prepareProjectMetadataForCanister(metadata: ProjectMetadata): any {
    console.log('🔄 [UserCanisterService] Preparing metadata for canister:', metadata);
    
    // Convert to Motoko optional field pattern: [] for None, [value] for Some(value)
    const canisterMetadata = {
      difficultyLevel: metadata.difficultyLevel ? [metadata.difficultyLevel] : [],
      externalLinks: metadata.externalLinks ? [Object.entries(metadata.externalLinks)] : [],
      thumbnailUrl: metadata.thumbnailUrl ? [metadata.thumbnailUrl] : [],
      completionStatus: metadata.completionStatus ? [metadata.completionStatus] : [],
      lastAccessed: metadata.lastAccessed ? [BigInt(metadata.lastAccessed * 1_000_000)] : [], // Convert to nanoseconds
      fileCount: metadata.fileCount ? [BigInt(metadata.fileCount)] : [],
      tags: metadata.tags || [], // Required field
      learningObjectives: metadata.learningObjectives ? [metadata.learningObjectives] : [],
      notes: metadata.notes ? [metadata.notes] : [],
      customIcon: metadata.customIcon ? [metadata.customIcon] : [],
      category: metadata.category ? [metadata.category] : [],
      priority: metadata.priority ? [metadata.priority] : [],
      isBookmarked: metadata.isBookmarked !== undefined ? [metadata.isBookmarked] : [],
      estimatedSize: metadata.estimatedSize ? [BigInt(metadata.estimatedSize)] : [],
      customColor: metadata.customColor ? [metadata.customColor] : []
    };

    console.log('🔄 [UserCanisterService] Prepared complete metadata for canister');
    return canisterMetadata;
  }

  private convertProjectMetadataFromCanister(canisterMetadata: any): ProjectMetadata {
    console.log('🔄 [UserCanisterService] Converting metadata from canister:', canisterMetadata);
    
    // Convert from Motoko optional field pattern with enhanced extraction
    const metadata: ProjectMetadata = {
      difficultyLevel: this.extractOptionalValue(canisterMetadata.difficultyLevel),
      externalLinks: this.extractOptionalValue(canisterMetadata.externalLinks)
        ? Object.fromEntries(this.extractOptionalValue(canisterMetadata.externalLinks))
        : undefined,
      thumbnailUrl: this.extractOptionalValue(canisterMetadata.thumbnailUrl),
      completionStatus: this.extractOptionalValue(canisterMetadata.completionStatus),
      lastAccessed: this.extractOptionalValue(canisterMetadata.lastAccessed)
        ? Number(this.extractOptionalValue(canisterMetadata.lastAccessed)) / 1_000_000 // Convert from nanoseconds
        : undefined,
      fileCount: this.extractOptionalValue(canisterMetadata.fileCount)
        ? Number(this.extractOptionalValue(canisterMetadata.fileCount))
        : undefined,
      tags: canisterMetadata.tags || [], // Required field
      learningObjectives: this.extractOptionalValue(canisterMetadata.learningObjectives),
      notes: this.extractOptionalValue(canisterMetadata.notes),
      customIcon: this.extractOptionalValue(canisterMetadata.customIcon),
      category: this.extractOptionalValue(canisterMetadata.category),
      priority: this.extractOptionalValue(canisterMetadata.priority),
      isBookmarked: this.extractOptionalValue(canisterMetadata.isBookmarked),
      estimatedSize: this.extractOptionalValue(canisterMetadata.estimatedSize)
        ? Number(this.extractOptionalValue(canisterMetadata.estimatedSize))
        : undefined,
      customColor: this.extractOptionalValue(canisterMetadata.customColor)
    };

    console.log('✅ [UserCanisterService] Converted complete metadata from canister');
    return metadata;
  }

  private async ensureActorReady(): Promise<void> {
    console.log('🔧 [UserCanisterService] Ensuring actor is ready...');
    
    if (!this.actor) {
      console.error('❌ [UserCanisterService] Actor not initialized - call initializeWithIdentity first');
      throw new Error('Service not initialized - call initializeWithIdentity first');
    }
    
    console.log('✅ [UserCanisterService] Actor is ready');
  }

  // NEW: Get user actor helper method for external access
  public async getUserActor(userCanisterId: string, identity: Identity): Promise<any> {
    await this.initializeUserActor(userCanisterId, identity);
    const actor = this.userActors.get(userCanisterId);
    if (!actor) {
      throw new Error(`Failed to get user actor for canister: ${userCanisterId}`);
    }
    return actor;
  }

  // ==================== ENHANCED: ULTRA-PARALLEL FILE OPERATIONS ====================

  // ENHANCED: Ultra-parallel file processing with advanced concurrency control
  private async processFilesInParallel<T>(
    items: T[],
    processor: (item: T, index: number) => Promise<any>,
    maxConcurrency: number = this.MAX_PARALLEL_OPERATIONS
  ): Promise<any[]> {
    const results: any[] = [];
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

  // ==================== ULTRA-OPTIMIZED: PARALLEL METADATA PROCESSING ====================

  /**
   * ULTRA-OPTIMIZED: Parallel metadata fetching with intelligent batching
   * This is the KEY PERFORMANCE FIX for your slow canister metadata loading
   */
  public async fetchCanisterMetadataParallel(
    canisters: Array<{ principal: any; canisterType: string; name: string }>,
    userActor: any
  ): Promise<UserCanisterWithMetadata[]> {
    const startTime = Date.now();
    console.log(`🚀 [UserCanisterService] ULTRA-PARALLEL: Starting metadata fetch for ${canisters.length} canisters with max concurrency: ${this.MAX_CONCURRENT_METADATA_CALLS}`);

    const canistersWithMetadata: UserCanisterWithMetadata[] = [];
    let successCount = 0;
    let failureCount = 0;

    // ULTRA-PARALLEL: Process metadata calls with advanced concurrency control
    const processMetadata = async (canister: any, index: number) => {
      try {
        const metadataStartTime = Date.now();
        console.log(`🔍 [UserCanisterService] ULTRA-PARALLEL: Fetching metadata for canister ${index + 1}/${canisters.length}: ${canister.name}`);

        const metadataResult = await this.retryOperation(async () => {
          return await userActor.getCanisterMetadata(canister.principal);
        }, 2, 500); // Reduced retries for speed

        const metadataTime = Date.now() - metadataStartTime;
        
        let metadata: CanisterMetadata | undefined;
        if (metadataResult && Array.isArray(metadataResult) && metadataResult.length > 0) {
          const rawMetadata = metadataResult[0];
          metadata = {
            canisterType: rawMetadata.canisterType,
            name: rawMetadata.name,
            project: this.extractOptionalValue(rawMetadata.project),
            subType: this.extractOptionalValue(rawMetadata.subType),
            didInterface: this.extractOptionalValue(rawMetadata.didInterface),
            stableInterface: this.extractOptionalValue(rawMetadata.stableInterface)
          };
        }

        canistersWithMetadata[index] = {
          principal: canister.principal,
          canisterType: canister.canisterType,
          name: canister.name,
          metadata: metadata
        };

        successCount++;
        console.log(`✅ [UserCanisterService] ULTRA-PARALLEL: Metadata fetched for ${canister.name} in ${metadataTime}ms (${index + 1}/${canisters.length})`);

      } catch (metadataError) {
        failureCount++;
        console.warn(`⚠️ [UserCanisterService] ULTRA-PARALLEL: Failed to get metadata for canister ${index + 1} (${canister.name}):`, metadataError);
        
        // Add canister without metadata
        canistersWithMetadata[index] = {
          principal: canister.principal,
          canisterType: canister.canisterType,
          name: canister.name,
          metadata: undefined
        };
      }
    };

    // Execute all metadata fetches in ultra-parallel with intelligent batching
    await this.processFilesInParallel(canisters, processMetadata, this.MAX_CONCURRENT_METADATA_CALLS);

    // Filter out any undefined entries and maintain order
    const finalResults = canistersWithMetadata.filter(Boolean);

    const totalTime = Date.now() - startTime;
    console.log(`🎉 [UserCanisterService] ULTRA-PARALLEL: Metadata processing completed in ${totalTime}ms:`);
    console.log(`   📊 Total canisters: ${canisters.length}`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failures: ${failureCount}`);
    console.log(`   ⚡ Average time per canister: ${Math.round(totalTime / canisters.length)}ms`);
    console.log(`   🚀 Speed improvement: ~${Math.round(canisters.length / (totalTime / 1000))} canisters/second`);

    return finalResults;
  }

  // ==================== ENHANCED: TWO-PHASE PARALLEL FILE MIGRATION WITH CLEANUP ====================

  /**
   * ENHANCED: Two-phase parallel file migration with complete cleanup optimization
   * Phase 1: Create all new files in parallel
   * Phase 2: Delete all old files in parallel (only if Phase 1 fully succeeds)
   */
  async migrateProjectFiles(
    projectId: string,
    oldProjectName: string,
    newProjectName: string,
    userCanisterId: string,
    identity: Identity,
    progressCallback?: (progress: { 
      percent: number; 
      message: string; 
      phase: 'loading' | 'migrating' | 'cleaning' | 'complete';
      migrated: number;
      deleted: number;
    }) => void
  ): Promise<FileMigrationResult> {
    const startTime = Date.now();
    console.log(`🚀 [UserCanisterService] TWO-PHASE MIGRATION: Starting optimized parallel migration from "${oldProjectName}" to "${newProjectName}"`);

    try {
      // Phase 0: Load existing files
      if (progressCallback) {
        progressCallback({
          percent: 5,
          message: 'Loading existing project files...',
          phase: 'loading',
          migrated: 0,
          deleted: 0
        });
      }

      const existingFiles = await this.loadCodeArtifacts(projectId, userCanisterId, identity);
      
      if (!existingFiles.success || !existingFiles.artifacts) {
        return {
          success: false,
          filesMigrated: 0,
          filesDeleted: 0,
          migrationErrors: [],
          error: 'Failed to load existing project files'
        };
      }

      const artifacts = existingFiles.artifacts;
      console.log(`📁 [UserCanisterService] TWO-PHASE: Found ${artifacts.length} files to analyze`);

      if (artifacts.length === 0) {
        return {
          success: true,
          filesMigrated: 0,
          filesDeleted: 0,
          migrationErrors: []
        };
      }

      // Filter files that actually need migration (have old project name in path)
      const filesToMigrate = artifacts.filter(artifact => 
        artifact.path.startsWith(oldProjectName)
      );

      console.log(`📁 [UserCanisterService] TWO-PHASE: ${filesToMigrate.length} files need migration`);

      if (filesToMigrate.length === 0) {
        return {
          success: true,
          filesMigrated: 0,
          filesDeleted: 0,
          migrationErrors: []
        };
      }

      await this.initializeUserActor(userCanisterId, identity);
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('User canister actor not initialized');
      }

      const callerPrincipal = identity.getPrincipal();

      // ==== PHASE 1: PARALLEL FILE CREATION ====
      if (progressCallback) {
        progressCallback({
          percent: 10,
          message: `Phase 1: Creating ${filesToMigrate.length} files in parallel...`,
          phase: 'migrating',
          migrated: 0,
          deleted: 0
        });
      }

      console.log(`🚀 [UserCanisterService] TWO-PHASE: Starting Phase 1 - Parallel file creation with max concurrency: ${this.MAX_PARALLEL_OPERATIONS}`);
      
      let phase1CreatedCount = 0;
      let phase1FailedCount = 0;
      const phase1Errors: Array<{ fileName: string; error: string; operation: 'migrate' | 'delete' }> = [];
      const successfullyCreatedFiles: Array<{ artifact: CodeArtifact; newPath: string }> = [];

      const phase1StartTime = Date.now();

      // PHASE 1: Process all file creations in parallel
      const createFile = async (artifact: CodeArtifact, index: number) => {
        try {
          const oldPath = artifact.path;
          const newPath = oldPath.replace(new RegExp(`^${oldProjectName}`), newProjectName);
          
          console.log(`🏗️ [UserCanisterService] TWO-PHASE Phase 1: Creating file ${index + 1}/${filesToMigrate.length}: ${oldPath} -> ${newPath}`);

          // Get file type and language for the new file
          const extension = artifact.fileName.substring(artifact.fileName.lastIndexOf('.')).toLowerCase();
          const { fileType, languageType } = this.getFileTypeAndLanguage(extension);

          // Create file at new location
          const createResult = await this.retryOperation(async () => {
            return await userActor.createCodeArtifact(
              callerPrincipal,
              projectId,
              artifact.fileName,
              { Text: artifact.content || '' },
              fileType,
              languageType,
              newPath,
              []
            );
          });

          if (createResult && typeof createResult === 'object' && ('ok' in createResult || 'Ok' in createResult)) {
            phase1CreatedCount++;
            successfullyCreatedFiles.push({ artifact, newPath });
            console.log(`✅ [UserCanisterService] TWO-PHASE Phase 1: Created file ${index + 1}: ${newPath}/${artifact.fileName}`);
          } else {
            throw new Error('Failed to create file at new location');
          }

          // Update progress for Phase 1
          if (progressCallback) {
            const progressPercent = 10 + Math.round(((phase1CreatedCount + phase1FailedCount) / filesToMigrate.length) * 40); // Phase 1 takes 40% of progress (10-50%)
            progressCallback({
              percent: progressPercent,
              message: `Phase 1: Created ${phase1CreatedCount}/${filesToMigrate.length} files...`,
              phase: 'migrating',
              migrated: phase1CreatedCount,
              deleted: 0
            });
          }

        } catch (error) {
          phase1FailedCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          phase1Errors.push({
            fileName: artifact.fileName,
            error: errorMessage,
            operation: 'migrate'
          });
          console.error(`❌ [UserCanisterService] TWO-PHASE Phase 1: Failed to create file ${index + 1} ${artifact.fileName}:`, error);
        }
      };

      // Execute Phase 1 in parallel
      await this.processFilesInParallel(filesToMigrate, createFile, this.MAX_PARALLEL_OPERATIONS);
      
      const phase1Time = Date.now() - phase1StartTime;
      console.log(`✅ [UserCanisterService] TWO-PHASE Phase 1 completed in ${phase1Time}ms: ${phase1CreatedCount} created, ${phase1FailedCount} failed`);

      // Check if Phase 1 was completely successful
      const phase1Success = phase1FailedCount === 0 && phase1CreatedCount === filesToMigrate.length;
      
      if (!phase1Success) {
        console.warn(`⚠️ [UserCanisterService] TWO-PHASE: Phase 1 had failures (${phase1FailedCount}/${filesToMigrate.length}), aborting Phase 2 for safety`);
        
        return {
          success: phase1CreatedCount > 0,
          filesMigrated: phase1CreatedCount,
          filesDeleted: 0,
          migrationErrors: phase1Errors,
          error: phase1FailedCount > 0 ? `Phase 1 incomplete: ${phase1FailedCount} files failed to create` : undefined,
          phaseResults: {
            phase1Success: false,
            phase1Created: phase1CreatedCount,
            phase1Failed: phase1FailedCount,
            phase2Success: false,
            phase2Deleted: 0,
            phase2Failed: 0
          }
        };
      }

      // ==== PHASE 2: PARALLEL FILE DELETION ====
      if (progressCallback) {
        progressCallback({
          percent: 55,
          message: `Phase 2: Cleaning up ${successfullyCreatedFiles.length} old files in parallel...`,
          phase: 'cleaning',
          migrated: phase1CreatedCount,
          deleted: 0
        });
      }

      console.log(`🧹 [UserCanisterService] TWO-PHASE: Starting Phase 2 - Parallel file deletion for ${successfullyCreatedFiles.length} files`);
      
      let phase2DeletedCount = 0;
      let phase2FailedCount = 0;
      const phase2Errors: Array<{ fileName: string; error: string; operation: 'migrate' | 'delete' }> = [];

      const phase2StartTime = Date.now();

      // PHASE 2: Process all file deletions in parallel
      const deleteFile = async (fileInfo: { artifact: CodeArtifact; newPath: string }, index: number) => {
        const { artifact } = fileInfo;
        
        try {
          console.log(`🗑️ [UserCanisterService] TWO-PHASE Phase 2: Deleting old file ${index + 1}/${successfullyCreatedFiles.length}: ${artifact.path}/${artifact.fileName}`);

          const deleteResult = await this.retryOperation(async () => {
            return await userActor.deleteCodeArtifact(
              callerPrincipal,
              projectId,
              artifact.path,
              artifact.fileName,
              []
            );
          });

          if (deleteResult && typeof deleteResult === 'object' && ('ok' in deleteResult || 'Ok' in deleteResult)) {
            phase2DeletedCount++;
            console.log(`✅ [UserCanisterService] TWO-PHASE Phase 2: Deleted old file ${index + 1}: ${artifact.path}/${artifact.fileName}`);
          } else {
            throw new Error('Failed to delete old file');
          }

          // Update progress for Phase 2
          if (progressCallback) {
            const progressPercent = 55 + Math.round(((phase2DeletedCount + phase2FailedCount) / successfullyCreatedFiles.length) * 40); // Phase 2 takes 40% of progress (55-95%)
            progressCallback({
              percent: progressPercent,
              message: `Phase 2: Cleaned up ${phase2DeletedCount}/${successfullyCreatedFiles.length} old files...`,
              phase: 'cleaning',
              migrated: phase1CreatedCount,
              deleted: phase2DeletedCount
            });
          }

        } catch (error) {
          phase2FailedCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          phase2Errors.push({
            fileName: artifact.fileName,
            error: errorMessage,
            operation: 'delete'
          });
          console.error(`❌ [UserCanisterService] TWO-PHASE Phase 2: Failed to delete old file ${index + 1} ${artifact.fileName}:`, error);
        }
      };

      // Execute Phase 2 in parallel
      await this.processFilesInParallel(successfullyCreatedFiles, deleteFile, this.MAX_PARALLEL_OPERATIONS);
      
      const phase2Time = Date.now() - phase2StartTime;
      console.log(`🧹 [UserCanisterService] TWO-PHASE Phase 2 completed in ${phase2Time}ms: ${phase2DeletedCount} deleted, ${phase2FailedCount} failed`);

      // Final results
      const totalTime = Date.now() - startTime;
      const allErrors = [...phase1Errors, ...phase2Errors];
      const phase2Success = phase2FailedCount === 0;

      console.log(`🎉 [UserCanisterService] TWO-PHASE MIGRATION completed in ${totalTime}ms:`);
      console.log(`   Phase 1: ${phase1CreatedCount} files created in ${phase1Time}ms`);
      console.log(`   Phase 2: ${phase2DeletedCount} files deleted in ${phase2Time}ms`);
      console.log(`   Total errors: ${allErrors.length}`);

      // Phase 3: Complete
      if (progressCallback) {
        progressCallback({
          percent: 100,
          message: `Migration complete! ${phase1CreatedCount} files migrated, ${phase2DeletedCount} old files cleaned up.`,
          phase: 'complete',
          migrated: phase1CreatedCount,
          deleted: phase2DeletedCount
        });
      }

      return {
        success: phase1CreatedCount > 0,
        filesMigrated: phase1CreatedCount,
        filesDeleted: phase2DeletedCount,
        migrationErrors: allErrors,
        phaseResults: {
          phase1Success: phase1Success,
          phase1Created: phase1CreatedCount,
          phase1Failed: phase1FailedCount,
          phase2Success: phase2Success,
          phase2Deleted: phase2DeletedCount,
          phase2Failed: phase2FailedCount
        }
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] TWO-PHASE MIGRATION: Complete migration failed:', error);
      return {
        success: false,
        filesMigrated: 0,
        filesDeleted: 0,
        migrationErrors: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // ==================== ENHANCED: CODEARTIFACT CRUD METHODS FOR SIDEPANE ====================

  /**
   * FIXED: Read a specific CodeArtifact for SidePane editing with correct parameter order
   */
  async readCodeArtifactForEditing(
    userCanisterId: string,
    identity: Identity,
    projectId: string,
    fileName: string,
    filePath: string
  ): Promise<CodeArtifactReadResult> {
    try {
      console.log('📖 [UserCanisterService] FIXED: Reading CodeArtifact with correct parameter order:', { 
        projectId, 
        fileName, 
        filePath,
        userCanisterId: userCanisterId.substring(0, 8) + '...'
      });
      
      await this.initializeUserActor(userCanisterId, identity);
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('User canister actor not initialized');
      }

      const callerPrincipal = identity.getPrincipal();

      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] FIXED: Calling readCodeArtifact with correct parameter order...');
        console.log('📋 [UserCanisterService] FIXED: Parameters being sent:', {
          position1: 'callerPrincipal',
          position2: projectId,
          position3_path: filePath,        // FIXED: Directory path in position 3
          position4_fileName: fileName,    // FIXED: Filename in position 4
          position5: 'empty versionId'
        });
        
        return await userActor.readCodeArtifact(
          callerPrincipal,     // Position 1: userPrincipal
          projectId,           // Position 2: projectId
          filePath,            // Position 3: path (FIXED - was fileName before)
          fileName,            // Position 4: fileName (FIXED - was filePath before)
          []                   // Position 5: versionId (empty for working copy)
        );
      });

      console.log('📤 [UserCanisterService] FIXED: readCodeArtifact result with correct parameters:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        const artifactData = result.ok || result.Ok;
        
        const artifact: CodeArtifact = {
          id: artifactData.id,
          projectId: artifactData.projectId,
          fileName: artifactData.fileName,
          content: this.extractContentFromArtifact(artifactData.content),
          path: artifactData.path,
          mimeType: artifactData.mimeType,
          language: artifactData.language,
          lastModified: Number(artifactData.lastModified) / 1_000_000,
          version: Number(artifactData.version),
          size: Number(artifactData.size)
        };
        
        console.log('✅ [UserCanisterService] FIXED: CodeArtifact read successfully with correct parameters');
        console.log('📊 [UserCanisterService] FIXED: Retrieved artifact details:', {
          id: artifact.id,
          path: artifact.path,
          fileName: artifact.fileName,
          contentLength: artifact.content?.length || 0
        });
        
        return {
          success: true,
          artifact: artifact
        };
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        const errorStr = typeof error === 'string' ? error : JSON.stringify(error);
        
        // "Artifact not found" is expected when checking if a file exists - log as info, not error
        if (errorStr.includes('Artifact not found') || errorStr.includes('not found')) {
          console.log(`ℹ️ [UserCanisterService] File does not exist (expected for new files): ${filePath}/${fileName}`);
        } else {
          // Real errors should be logged as errors
        console.error('❌ [UserCanisterService] FIXED: Failed to read CodeArtifact with correct parameters:', error);
        console.error('📋 [UserCanisterService] FIXED: Parameters that were sent:', {
          projectId,
          path: filePath,
          fileName: fileName,
          expectedArtifactId: `${projectId}:${filePath}/${fileName}`
        });
        }
        
        return {
          success: false,
          error: errorStr
        };
      }

      return {
        success: false,
        error: 'Invalid response from readCodeArtifact'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] FIXED: Error reading CodeArtifact with correct parameters:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }


  /**
   * FIXED: Create a new CodeArtifact from SidePane with correct backend parameter matching
   */
  async createCodeArtifactFromSidePane(
    principal: Principal,
    projectId: string,
    fileName: string,
    content: string,
    filePath: string,
    userCanisterId: string,
    identity: Identity,
    versionId: string | null = null // 🆕 VERSION-AWARE: Optional version ID (null = working copy)
  ): Promise<CodeArtifactCreateResult> {
    try {
      console.log('🏗️ [UserCanisterService] VERSION-AWARE: Creating CodeArtifact with correct backend parameters:', { 
        projectId, 
        fileName, 
        filePath,
        contentLength: content.length,
        versionId: versionId || 'Sandbox (working copy)',
        userCanisterId: userCanisterId.substring(0, 8) + '...'
      });
      
      await this.initializeUserActor(userCanisterId, identity);
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('User canister actor not initialized');
      }
      
      // FIXED: Detect EXACT mimeType and language that backend expects
      const { mimeType, language } = this.getBackendExpectedTypes(fileName);
      
      console.log('📋 [UserCanisterService] VERSION-AWARE: Using backend-expected types:', {
        fileName,
        mimeType,
        language,
        filePath,
        versionId: versionId || 'Sandbox'
      });

      // 🆕 VERSION-AWARE: Format versionId for backend (?Text = [] for null, [value] for present)
      const versionIdOpt: [] | [string] = versionId ? [versionId] : [];

      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] VERSION-AWARE: Calling createCodeArtifact with version:', versionId || 'Sandbox');
        return await userActor.createCodeArtifact(
          principal,           // Position 1: userPrincipal
          projectId,          // Position 2: projectId
          fileName,           // Position 3: fileName
          { Text: content },  // Position 4: content
          mimeType,           // Position 5: mimeType
          language,           // Position 6: language
          filePath,           // Position 7: path
          versionIdOpt        // Position 8: versionId ([] = working copy, [versionId] = specific version)
        );
      });

      console.log('📤 [UserCanisterService] FIXED: createCodeArtifact result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        const artifactData = result.ok || result.Ok;
        
        const artifact: CodeArtifact = {
          id: artifactData.id,
          projectId: artifactData.projectId,
          fileName: artifactData.fileName,
          content: this.extractContentFromArtifact(artifactData.content),
          path: artifactData.path,
          mimeType: artifactData.mimeType,
          language: artifactData.language,
          lastModified: Number(artifactData.lastModified) / 1_000_000,
          version: Number(artifactData.version),
          size: Number(artifactData.size)
        };
        
        console.log('✅ [UserCanisterService] FIXED: CodeArtifact created successfully with correct backend parameters');
        return {
          success: true,
          artifactId: artifactData.id,
          artifact: artifact
        };
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.error('❌ [UserCanisterService] FIXED: Failed to create CodeArtifact:', error);
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      return {
        success: false,
        error: 'Invalid response from createCodeArtifact'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] FIXED: Error creating CodeArtifact:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * FIXED: Update an existing CodeArtifact from SidePane with correct backend parameter matching
   */
  async updateCodeArtifactFromSidePane(
    principal: Principal,
    projectId: string,
    fileName: string,
    content: string,
    filePath: string,
    userCanisterId: string,
    identity: Identity,
    versionId: string | null = null // 🆕 VERSION-AWARE: Optional version ID (null = working copy)
  ): Promise<CodeArtifactUpdateResult> {
    try {
      console.log('🔄 [UserCanisterService] VERSION-AWARE: Updating CodeArtifact with correct backend parameters:', { 
        projectId, 
        fileName, 
        filePath,
        contentLength: content.length,
        versionId: versionId || 'Sandbox (working copy)',
        userCanisterId: userCanisterId.substring(0, 8) + '...'
      });
      
      await this.initializeUserActor(userCanisterId, identity);
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('User canister actor not initialized');
      }

      // 🆕 VERSION-AWARE: Format versionId for backend (?Text = [] for null, [value] for present)
      const versionIdOpt: [] | [string] = versionId ? [versionId] : [];

      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] VERSION-AWARE: Calling updateCodeArtifact with version:', versionId || 'Sandbox');
        return await userActor.updateCodeArtifact(
          principal,           // Position 1: userPrincipal
          projectId,          // Position 2: projectId
          fileName,           // Position 3: fileName
          { Text: content },  // Position 4: content
          filePath,           // Position 5: path
          versionIdOpt        // Position 6: versionId ([] = working copy, [versionId] = specific version)
        );
      });

      console.log('📤 [UserCanisterService] FIXED: updateCodeArtifact result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        const artifactData = result.ok || result.Ok;
        
        const artifact: CodeArtifact = {
          id: artifactData.id,
          projectId: artifactData.projectId,
          fileName: artifactData.fileName,
          content: this.extractContentFromArtifact(artifactData.content),
          path: artifactData.path,
          mimeType: artifactData.mimeType,
          language: artifactData.language,
          lastModified: Number(artifactData.lastModified) / 1_000_000,
          version: Number(artifactData.version),
          size: Number(artifactData.size)
        };
        
        console.log('✅ [UserCanisterService] FIXED: CodeArtifact updated successfully with correct backend parameters');
        return {
          success: true,
          artifact: artifact
        };
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.error('❌ [UserCanisterService] FIXED: Failed to update CodeArtifact:', error);
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      return {
        success: false,
        error: 'Invalid response from updateCodeArtifact'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] FIXED: Error updating CodeArtifact:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * FIXED: Delete a CodeArtifact from SidePane with correct backend parameter order
   */
  async deleteCodeArtifactFromSidePane(
    principal: Principal,
    projectId: string,
    fileName: string,
    filePath: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<CodeArtifactDeleteResult> {
    try {
      console.log('🗑️ [UserCanisterService] FIXED: Deleting CodeArtifact with correct backend parameters:', { 
        projectId, 
        fileName,
        filePath,
        userCanisterId: userCanisterId.substring(0, 8) + '...'
      });
      
      await this.initializeUserActor(userCanisterId, identity);
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('User canister actor not initialized');
      }

      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] FIXED: Calling deleteCodeArtifact with correct parameter order...');
        return await userActor.deleteCodeArtifact(
          principal,           // Position 1: userPrincipal
          projectId,          // Position 2: projectId
          filePath,           // Position 3: path (FIXED - path comes before fileName)
          fileName,           // Position 4: fileName (FIXED - fileName comes after path)
          []                  // Position 5: versionId (null for SidePane operations)
        );
      });

      console.log('📤 [UserCanisterService] FIXED: deleteCodeArtifact result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        console.log('✅ [UserCanisterService] FIXED: CodeArtifact deleted successfully with correct backend parameters');
        return {
          success: true
        };
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.error('❌ [UserCanisterService] FIXED: Failed to delete CodeArtifact:', error);
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      return {
        success: false,
        error: 'Invalid response from deleteCodeArtifact'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] FIXED: Error deleting CodeArtifact:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * NEW: Helper method to get exact mimeType and language that backend expects
   * This replaces the getFileTypeAndLanguage method for backend compatibility
   */
  private getBackendExpectedTypes(fileName: string): { mimeType: string; language: string } {
    const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    
    switch (extension) {
      case '.mo':
        return { mimeType: 'text/x-motoko', language: 'motoko' };
      case '.tsx':
        return { mimeType: 'text/typescript', language: 'typescript' };
      case '.ts':
        return { mimeType: 'text/typescript', language: 'typescript' };
      case '.js':
        return { mimeType: 'text/javascript', language: 'javascript' };
      case '.jsx':
        return { mimeType: 'text/javascript', language: 'javascript' };
      case '.css':
        return { mimeType: 'text/css', language: 'css' };
      case '.html':
        return { mimeType: 'text/html', language: 'html' };
      case '.json':
        return { mimeType: 'application/json', language: 'json' };
      case '.md':
        return { mimeType: 'text/markdown', language: 'markdown' };
      case '.txt':
        return { mimeType: 'text/plain', language: 'text' };
      case '.toml':
        return { mimeType: 'text/plain', language: 'toml' };
      case '.yaml':
      case '.yml':
        return { mimeType: 'text/plain', language: 'yaml' };
      default:
        return { mimeType: 'text/plain', language: 'text' };
    }
  }



  // ==================== UPDATED: SERVER PAIR SELECTION DIALOG SUPPORT METHODS ====================

  /**
   * UPDATED: Get ALL user server pairs with assignment information (supports reassignment)
   * This method now returns ALL server pairs owned by the user with their current project assignments
   */
  async getAllUserServerPairsWithAssignments(
    userCanisterId: string,
    identity: Identity
  ): Promise<AllServerPairsResult> {
    try {
      console.log('🖥️ [UserCanisterService] UPDATED: Getting ALL user server pairs with assignment information...');
      
      await this.initializeUserActor(userCanisterId, identity);
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('User actor not initialized');
      }

      // Get all server pairs and all canisters in parallel
      const [allServerPairsResult, allCanistersResult] = await Promise.all([
        this.retryOperation(() => userActor.getUserServerPairs()),
        this.retryOperation(() => userActor.getUserCanisters())
      ]);

      console.log('📊 [UserCanisterService] UPDATED: Loaded data for ALL server pairs with assignments:', {
        serverPairs: allServerPairsResult?.length || 0,
        canisters: allCanistersResult?.length || 0
      });

      if (!Array.isArray(allServerPairsResult)) {
        console.log('⚠️ [UserCanisterService] UPDATED: No server pairs found');
        return {
          success: true,
          serverPairs: []
        };
      }

      if (!Array.isArray(allCanistersResult)) {
        console.log('⚠️ [UserCanisterService] UPDATED: No canisters found');
        return {
          success: true,
          serverPairs: []
        };
      }

      // Build a map of canister ID to project assignment (with project names)
      const canisterToProjectMap = new Map<string, { projectId: string; projectName: string }>();
      
      // Get all projects to map project IDs to names
      const allProjectsResult = await this.retryOperation(() => userActor.getUserProjects());
      const projectIdToNameMap = new Map<string, string>();
      
      if (Array.isArray(allProjectsResult)) {
        allProjectsResult.forEach(project => {
          projectIdToNameMap.set(project.id, project.name || project.id);
        });
      }
      
      // OPTIMIZATION: Batch metadata calls in parallel instead of sequentially
      // This significantly speeds up loading when there are many canisters
      const metadataPromises = allCanistersResult.map(async (canister) => {
        try {
          // Get canister metadata to check project assignment
          const metadataResult = await userActor.getCanisterMetadata(canister.principal);
          
          if (metadataResult && Array.isArray(metadataResult) && metadataResult.length > 0) {
            const metadata = metadataResult[0];
            const projectId = this.extractOptionalValue(metadata.project);
            
            if (projectId) {
              const canisterId = this.convertPrincipalToCanisterId(canister.principal);
              const projectName = projectIdToNameMap.get(projectId) || projectId;
              
              if (canisterId) {
                return { canisterId, projectId, projectName };
              }
            }
          }
        } catch (metadataError) {
          console.warn('⚠️ [UserCanisterService] UPDATED: Failed to get metadata for canister:', canister.name, metadataError);
        }
        return null;
      });
      
      // Wait for all metadata calls to complete in parallel
      const metadataResults = await Promise.all(metadataPromises);
      
      // Build the map from parallel results
      metadataResults.forEach(result => {
        if (result) {
          canisterToProjectMap.set(result.canisterId, { projectId: result.projectId, projectName: result.projectName });
        }
      });

      console.log(`📋 [UserCanisterService] UPDATED: Built project assignment map for ${canisterToProjectMap.size} canisters`);

      // Process ALL server pairs with assignment information
      const allServerPairsWithAssignments: ServerPairWithAssignment[] = [];
      
      for (const serverPair of allServerPairsResult) {
        const frontendCanisterId = this.convertPrincipalToCanisterId(serverPair.frontendCanisterId);
        const backendCanisterId = this.convertPrincipalToCanisterId(serverPair.backendCanisterId);
        
        if (!frontendCanisterId || !backendCanisterId) {
          console.warn('⚠️ [UserCanisterService] UPDATED: Failed to convert canister IDs for server pair:', serverPair.pairId);
          continue;
        }

        // Check project assignments for both canisters
        const frontendAssignment = canisterToProjectMap.get(frontendCanisterId);
        const backendAssignment = canisterToProjectMap.get(backendCanisterId);
        
        // Use frontend assignment as the authoritative source (they should be the same)
        const currentAssignment = frontendAssignment || backendAssignment;
        
        allServerPairsWithAssignments.push({
          pairId: serverPair.pairId,
          name: serverPair.name,
          frontendCanisterId: frontendCanisterId,
          backendCanisterId: backendCanisterId,
          createdAt: Number(serverPair.createdAt) / 1_000_000, // Convert from nanoseconds
          creditsAllocated: Number(serverPair.creditsAllocated),
          currentProjectId: currentAssignment?.projectId,
          currentProjectName: currentAssignment?.projectName,
          canReassign: true // All server pairs can be reassigned
        });
        
        const status = currentAssignment 
          ? `assigned to "${currentAssignment.projectName}"` 
          : 'unassigned';
        console.log(`📌 [UserCanisterService] UPDATED: Server pair "${serverPair.name}" is ${status}`);
      }

      console.log(`✅ [UserCanisterService] UPDATED: Processed ${allServerPairsWithAssignments.length} server pairs with assignment information`);

      return {
        success: true,
        serverPairs: allServerPairsWithAssignments
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] UPDATED: Failed to get all server pairs with assignments:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }



  private async calculateIcpConversion(usdAmount: number): Promise<{
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
      const { icpPriceService } = await import('./IcpPriceService');
      const priceData = await icpPriceService.getCurrentPrice();
      const realIcpPrice = priceData.price;
      
      console.log(`📈 [IcpConversion] REAL ICP market price: $${realIcpPrice.toFixed(4)} (${Math.round(priceData.cacheAge / 1000)}s old)`);
      
      // Calculate ICP tokens needed using REAL market price
      // 🔥 FIX: Use Math.ceil to ensure platform wallet receives enough ICP to cover all costs
      // Rounding down causes losses when the platform wallet needs to provision resources
      const icpTokens = usdAmount / realIcpPrice;
      const icpE8s = BigInt(Math.ceil(icpTokens * 100_000_000)); // Convert to e8s (round UP to ensure enough)
      
      console.log(`💰 [IcpConversion] Real price calculation: $${usdAmount.toFixed(4)} ÷ $${realIcpPrice.toFixed(4)} = ${icpTokens.toFixed(6)} ICP`);
      
      // Get real cycles conversion from XDR system
      const { getIcpXdrConversionRate, icpToCycles } = await import('../utils/icpUtils');
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

  /**
   * Create CMC (Cycles Minting Canister) actor for payment processing
   * Duplicated from HostingInterface to avoid import dependencies
   */
  private async createCMCActor(identity: Identity): Promise<CyclesMintingCanister> {
    const host = UserCanisterService.getICPHost();

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
        canisterId: UserCanisterService.CMC_CANISTER_ID,
      }
    );
  }

  /**
   * Helper to get the ICP network host
   * Duplicated from HostingInterface to avoid import dependencies
   */
  private static getICPHost(): string {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://127.0.0.1:4943'
      : 'https://icp0.io';
  }

  /**
   * CMC Principal ID constant (lazy-initialized to avoid bundling issues)
   */
  private static get CMC_CANISTER_ID() {
    return Principal.fromText("rkp4c-7iaaa-aaaaa-aaaca-cai");
  }

  /**
   * Deploy WASM to a canister (for pool creation and admin operations)
   */
  async deployWasmToCanister(
    canisterId: Principal,
    wasmBytes: number[],
    canisterType: 'frontend' | 'backend',
    identity: Identity,
    userCanisterId: string
  ): Promise<void> {
    try {
      console.log(`📥 [UserCanisterService] Deploying ${canisterType} WASM to:`, canisterId.toString());
      
      const userActor = await this.getUserActor(userCanisterId, identity);
      const userPrincipal = identity.getPrincipal();

      const deployResult = await userActor.deployToExistingCanister(
        canisterId,
        wasmBytes,
        canisterType,
        canisterType === 'frontend' ? 'assetstorage' : 'backend',
        userPrincipal,
        [],
        [],
        ['install']
      );

      if ('Err' in deployResult || 'err' in deployResult) {
        throw new Error(`Failed to deploy ${canisterType} WASM: ` + JSON.stringify(deployResult));
      }

      console.log(`✅ [UserCanisterService] ${canisterType} WASM deployed successfully`);
    } catch (error) {
      console.error(`❌ [UserCanisterService] Failed to deploy ${canisterType} WASM:`, error);
      throw error;
    }
  }

  async fetchAndConfigureHostingForServer(
    frontendServerId: string,
    userPrincipal: Principal,
    userCanisterId: string,
    identity: Identity,
    progressCallback?: (status: string, progress: number) => void
  ): Promise<void> {
    try {
      progressCallback?.('Downloading hosting infrastructure...', 10);
      console.log('🎭 [UserCanisterService] Starting hosting configuration for:', frontendServerId);
      
      // Get WASM URL from configuration
      const { wasmConfigService } = await import('./WasmConfigService');
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

      progressCallback?.('Preparing hosting setup...', 25);

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      progressCallback?.('Processing hosting configuration...', 40);

      const compressed = new Uint8Array(arrayBuffer);
      const assetsWasmBytes = Array.from(compressed);

      progressCallback?.('Configuring hosting infrastructure...', 60);

      const userActor = await this.getUserActor(userCanisterId, identity);
      const frontendPrincipal = Principal.fromText(frontendServerId);

      progressCallback?.('Configuring hosting...', 80);

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

      if (!setupResult || ('Err' in setupResult)) {
        const errorMsg = setupResult?.Err || 'Unknown setup error';
        throw new Error(`Hosting setup failed: ${JSON.stringify(errorMsg)}`);
      }

      progressCallback?.('Hosting configured successfully!', 100);
      console.log('🎭 [UserCanisterService] Hosting configuration completed successfully');

    } catch (error) {
      console.error('🎭 [UserCanisterService] Hosting configuration failed:', error);
      throw error;
    }
  }

  /**
   * REALISTIC_COSTS constants (duplicated from HostingInterface)
   */
  private static readonly REALISTIC_COSTS = {
    CYCLES_PER_SERVER_RUNTIME_1GB_30DAYS: 2_000_000_000_000n,
    CANISTER_CREATION_FEE: 100_000_000_000n,
    WASM_INSTALLATION_OVERHEAD: 300_000_000_000n,
    MEMORY_INITIALIZATION: 100_000_000_000n,
    CONTROLLER_SETUP: 50_000_000_000n,
    HOSTING_DEPLOYMENT_COST: 200_000_000_000n,
    SAFETY_BUFFER_PERCENTAGE: 0.10,
    MINIMUM_MEMORY_GB: 1
  };

  /**
   * FinancialLogger class (duplicated from HostingInterface)
   */
  private static FinancialLogger = {
    logGroup: (title: string, callback: () => void) => {
      console.group(`🏗️ ${title}`);
      try {
        callback();
      } finally {
        console.groupEnd();
      }
    },
    logConversionRateAnalysis: (details: {
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
    }) => {
      UserCanisterService.FinancialLogger.logGroup('📊 CLOUD INFRASTRUCTURE CONVERSION ANALYSIS', () => {
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
    },
    logConversionComparison: (comparison: {
      estimatedCycles: bigint;
      actualCyclesReceived: bigint;
      realIcpPrice: number;
      actualIcpCyclesRate: number;
      blockIndex: bigint;
      conversionEfficiency: number;
      marketVariance: number;
    }) => {
      UserCanisterService.FinancialLogger.logGroup('🔍 CLOUD RESOURCE ALLOCATION COMPARISON', () => {
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
    },
    logCostAnalysis: (config: {
      memoryGB: number;
      durationDays: number;
      runtimeCyclesPerServer: bigint;
      creationOverheadPerServer: bigint;
      totalCyclesPerServer: bigint;
      creditsRequested: number;
      usdEquivalent: number;
      realIcpPrice: number;
    }) => {
      UserCanisterService.FinancialLogger.logGroup('💰 COMPREHENSIVE COST ANALYSIS', () => {
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
    },
    logBalanceSnapshot: (title: string, balances: {
      userWalletCredits?: number;
      userServerCredits?: number;
      userServerCycles?: bigint;
      platformStatus?: string;
      cloudStatus?: string;
    }) => {
      UserCanisterService.FinancialLogger.logGroup(`🏦 ${title}`, () => {
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
    },
    logPlatformResourceProvision: (details: {
      fromBalance: number;
      creditsDeducted: number;
      targetServer: string;
      blockIndex?: bigint;
      platformSource: string;
      realIcpPrice: number;
      icpAmount: number;
    }) => {
      UserCanisterService.FinancialLogger.logGroup('📤 PLATFORM RESOURCE PROVISION', () => {
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
    },
    logPaymentOperation: (details: {
      serverId: string;
      blockIndex?: bigint;
      success: boolean;
      error?: string;
      sourceType: 'platform_wallet' | 'user_wallet';
      realIcpPrice?: number;
    }) => {
      UserCanisterService.FinancialLogger.logGroup('🔄 RESOURCE PROVISIONING', () => {
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
    },
    logResourcePolling: async (
      userServerId: string,
      identity: Identity,
      initialBalance: bigint,
      expectedAmount: bigint,
      maxWaitSeconds: number = 60,
      serviceInstance?: UserCanisterService
    ): Promise<{ success: boolean; finalBalance: bigint; resourcesAdded: bigint; waitTime: number }> => {
      return new Promise(async (resolve) => {
        UserCanisterService.FinancialLogger.logGroup('⏳ RESOURCE ALLOCATION VERIFICATION', async () => {
          console.log(`🎯 Monitoring server: ${userServerId}`);
          console.log(`📊 Initial balance: ${initialBalance.toString()} (${Number(initialBalance)/1_000_000_000_000}T)`);
          console.log(`🎯 Expected addition: ${expectedAmount.toString()} (${Number(expectedAmount)/1_000_000_000_000}T)`);
          console.log(`⏱️ Max wait time: ${maxWaitSeconds} seconds`);
          console.log(`🌐 Resource Source: Platform Cloud Infrastructure`);
          
          const startTime = Date.now();
          let pollCount = 0;
          
          // Use provided service instance or create new one
          const service = serviceInstance || new UserCanisterService();
          
          const pollBalance = async (): Promise<void> => {
            try {
              pollCount++;
              const elapsed = Math.round((Date.now() - startTime) / 1000);
              
              const metadata = await service.getUserStateMetadata(userServerId, identity);
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
    },
    logServerCreation: (details: {
      serverType: string;
      serverId?: string;
      resourcesAllocated: bigint;
      success: boolean;
      error?: string;
    }) => {
      UserCanisterService.FinancialLogger.logGroup(`🏗️ ${details.serverType.toUpperCase()} SERVER CREATION`, () => {
        console.log(`⚡ Resources allocated: ${details.resourcesAllocated.toString()} (${Number(details.resourcesAllocated)/1_000_000_000_000}T)`);
        console.log(`🌐 Resource Source: Platform Cloud Infrastructure`);
        if (details.success && details.serverId) {
          console.log(`✅ SUCCESS: ${details.serverId}`);
        } else {
          console.log(`❌ FAILED: ${details.error}`);
        }
      });
    },
    logOperationSummary: (summary: {
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
    }) => {
      UserCanisterService.FinancialLogger.logGroup('📋 OPERATION SUMMARY (CLOUD INFRASTRUCTURE PLATFORM)', () => {
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
  };

  /**
   * 🔥 NEW: Calculate ICP from actual cycles needed (cycles → ICP)
   * This ensures platform wallet receives enough ICP to cover ALL costs
   */
  private async calculateIcpFromCycles(targetCycles: bigint): Promise<{
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
      const { icpPriceService } = await import('./IcpPriceService');
      const { getIcpXdrConversionRate } = await import('../utils/icpUtils');
      
      // Get real-time ICP cycles rate
      const cyclesPerIcp = await getIcpXdrConversionRate();
      const icpCyclesRate = Number(cyclesPerIcp) / 1_000_000_000_000; // Convert to T cycles
      
      console.log(`⚡ [IcpFromCycles] Real-time ICP cycles rate: ${icpCyclesRate.toFixed(2)}T cycles per ICP`);
      
      // Calculate ICP needed: cycles ÷ cyclesPerICP (round UP to ensure enough)
      const icpTokens = Number(targetCycles) / Number(cyclesPerIcp);
      const icpE8s = BigInt(Math.ceil(icpTokens * 100_000_000)); // Round UP to ensure enough
      
      // Get ICP price for logging
      const priceData = await icpPriceService.getCurrentPrice();
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

  /**
   * Calculate cloud resource conversion (duplicated from HostingInterface)
   */
  private async calculateCloudResourceConversion(usdAmount: number): Promise<{
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
      const { icpPriceService } = await import('./IcpPriceService');
      const { getIcpXdrConversionRate, icpToCycles } = await import('../utils/icpUtils');
      
      const priceData = await icpPriceService.getCurrentPrice();
      const realIcpPrice = priceData.price;
      
      console.log(`📈 [CloudResourceConversion] Cloud infrastructure rate: $${realIcpPrice.toFixed(4)} (${Math.round(priceData.cacheAge / 1000)}s old)`);
      
      // 🔥 FIX: Use Math.ceil to ensure platform wallet receives enough ICP to cover all costs
      // Rounding down causes losses when the platform wallet needs to provision resources
      const icpTokens = usdAmount / realIcpPrice;
      const icpE8s = BigInt(Math.ceil(icpTokens * 100_000_000)); // Round UP to ensure enough
      
      console.log(`💰 [CloudResourceConversion] Cloud pricing calculation: $${usdAmount.toFixed(4)} ÷ $${realIcpPrice.toFixed(4)} = ${icpTokens.toFixed(6)} tokens`);
      
      const cyclesPerIcp = await getIcpXdrConversionRate();
      const icpCyclesRate = Number(cyclesPerIcp) / 1_000_000_000_000;
      
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
      throw new Error(`Cannot proceed without current cloud infrastructure pricing: ${error instanceof Error ? error.message : 'Unknown pricing error'}`);
    }
  }

  /**
   * Helper functions duplicated from HostingInterface to match exactly
   */
  private static calculateComprehensiveServerResources(
    memoryGB: number,
    durationDays: number
  ): {
    runtimeCycles: bigint;
    creationOverhead: bigint;
    totalWithSafetyBuffer: bigint;
    description: string;
  } {
    const REALISTIC_COSTS = {
      CYCLES_PER_SERVER_RUNTIME_1GB_30DAYS: 2_000_000_000_000n,
      CANISTER_CREATION_FEE: 100_000_000_000n,
      WASM_INSTALLATION_OVERHEAD: 300_000_000_000n,
      MEMORY_INITIALIZATION: 100_000_000_000n,
      CONTROLLER_SETUP: 50_000_000_000n,
      SAFETY_BUFFER_PERCENTAGE: 0.10,
      MINIMUM_MEMORY_GB: 1
    };

    const actualMemoryGB = Math.max(REALISTIC_COSTS.MINIMUM_MEMORY_GB, Math.floor(memoryGB));
    const baseRate = REALISTIC_COSTS.CYCLES_PER_SERVER_RUNTIME_1GB_30DAYS;
    const memoryFactor = actualMemoryGB;
    const durationFactor = durationDays / 30.0;
    const runtimeCycles = BigInt(Math.floor(Number(baseRate) * memoryFactor * durationFactor));
    
    const creationOverhead = (
      REALISTIC_COSTS.CANISTER_CREATION_FEE +
      REALISTIC_COSTS.WASM_INSTALLATION_OVERHEAD +
      REALISTIC_COSTS.MEMORY_INITIALIZATION +
      REALISTIC_COSTS.CONTROLLER_SETUP
    );
    
    const totalPerServer = runtimeCycles + creationOverhead;
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

  private static resourcesToCredits(resources: bigint): number {
    const tbResources = Number(resources) / 1_000_000_000_000;
    return Math.ceil(tbResources * 1000);
  }

  private static calculateOptimalServerConfig(availableCredits: number): {
    canCreateServers: boolean;
    perServerCredits: number;
    perServerResources: bigint;
    memoryGB: number;
    durationDays: number;
    totalResourcesNeeded: bigint;
    message: string;
  } {
    const REALISTIC_COSTS = {
      HOSTING_DEPLOYMENT_COST: 200_000_000_000n,
      SAFETY_BUFFER_PERCENTAGE: 0.10,
      MINIMUM_MEMORY_GB: 1
    };

    const halfCredits = Math.floor(availableCredits / 2);
    
    const configs = [
      { memoryGB: 1, durationDays: 30 },
      { memoryGB: 1, durationDays: 21 },
      { memoryGB: 1, durationDays: 14 },
      { memoryGB: 1, durationDays: 7 },
      { memoryGB: 2, durationDays: 30 },
    ];
    
    for (const config of configs) {
      const calculation = this.calculateComprehensiveServerResources(config.memoryGB, config.durationDays);
      const creditsNeeded = this.resourcesToCredits(calculation.totalWithSafetyBuffer);
      
      if (halfCredits >= creditsNeeded) {
        const hostingCostCredits = this.resourcesToCredits(REALISTIC_COSTS.HOSTING_DEPLOYMENT_COST);
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
    
    const standardCalculation = this.calculateComprehensiveServerResources(1, 30);
    const standardCreditsNeeded = this.resourcesToCredits(standardCalculation.totalWithSafetyBuffer) * 2;
    const hostingCostCredits = this.resourcesToCredits(REALISTIC_COSTS.HOSTING_DEPLOYMENT_COST);
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

  /**
   * ENHANCED: Create complete server pair with hosting configuration
   * MATCHES HostingInterface.createServerPair EXACTLY
   */
  async createCompleteServerPairForProject(
    serverPairName: string,
    creditsAllocated: number,
    projectId: string,
    projectName: string,
    userCanisterId: string,
    identity: Identity,
    mainActor: any,
    icpPriceData: any,
    configureHosting: boolean = true,
    progressCallback?: (status: string, progress: number) => void,
    poolType?: 'RegularServerPair' | 'AgentServerPair' | 'AgencyWorkflowPair'
  ): Promise<ServerPairCreationResult> {
    
    try {
      progressCallback?.('Starting server pair creation...', 5);
      console.group('🚀 SERVER PAIR CREATION WITH CLOUD INFRASTRUCTURE');
      console.log('🏗️ [UserCanisterService] Creating server pair with hosting configuration:', {
        serverPairName,
        creditsAllocated,
        projectId,
        projectName,
        configureHosting,
        poolType: poolType || 'RegularServerPair'
      });

      // ============================================================
      // POOL CHECK: Try to get pre-deployed server pair from pool
      // ============================================================
      const userPrincipal = identity.getPrincipal();
      
      try {
        progressCallback?.('Checking canister pool...', 3);
        const { PlatformCanisterService } = await import('./PlatformCanisterService');
        const platformService = PlatformCanisterService.createWithIdentity(identity);
        
        // Determine pool type (default to RegularServerPair if not specified)
        const selectedPoolType = poolType || 'RegularServerPair';
        const poolTypeVariant = { [selectedPoolType]: null };
        
        console.log(`🏊 [Pool] Checking ${selectedPoolType} pool for available server pair...`);
        
        const availablePair = await platformService.getAvailableServerPairFromPool(poolTypeVariant);
        
        if (availablePair) {
          console.log(`✅ [Pool] Found available server pair in pool!`, availablePair);
          progressCallback?.('Assigning server pair from pool...', 8);
          
          // Assign the pooled server pair to this user
          const assignResult = await platformService.assignServerPairFromPool(
            availablePair.pairId,
            userPrincipal
          );
          
          if ('ok' in assignResult && assignResult.ok) {
            console.log(`✅ [Pool] Server pair assigned successfully from pool`);
            
            // Return the pooled server pair information
            // We still need to create the project-specific server pair record in user canister
            progressCallback?.('Configuring assigned server pair...', 15);
            
            await this.initializeUserActor(userCanisterId, identity);
            const userActor = this.userActors.get(userCanisterId);
            
            if (userActor) {
              const frontendPrincipal = Principal.fromText(availablePair.frontendCanisterId);
              const backendPrincipal = Principal.fromText(availablePair.backendCanisterId);
              
              // Create server pair record in user canister
              const createResult = await userActor.createServerPair(
                projectId,
                serverPairName,
                frontendPrincipal,
                backendPrincipal,
                creditsAllocated
              );
              
              if ('ok' in createResult) {
                const serverPairId = createResult.ok;
                console.log(`✅ [Pool] Server pair configured with ID: ${serverPairId}`);
                
                progressCallback?.('Server pair ready!', 100);
                console.groupEnd();
                
                return {
                  success: true,
                  serverPairId: serverPairId,
                  frontendCanisterId: availablePair.frontendCanisterId,
                  backendCanisterId: availablePair.backendCanisterId,
                  hostingConfigured: configureHosting,
                  fromPool: true // Flag to indicate this came from pool
                };
              }
            }
          }
        } else {
          console.log(`ℹ️ [Pool] No available server pairs in ${selectedPoolType} pool, proceeding with normal creation...`);
        }
      } catch (poolError) {
        console.warn(`⚠️ [Pool] Error checking pool, proceeding with normal creation:`, poolError);
        // Continue with normal creation flow
      }
      
      // ============================================================
      // NORMAL CREATION FLOW: Create new server pair
      // ============================================================
      progressCallback?.('Starting server pair creation...', 5);

      // Validate required parameters
      if (!mainActor) {
        throw new Error('Platform wallet actor is required for server pair creation');
      }

      if (!icpPriceData || !icpPriceData.price || icpPriceData.price <= 0) {
        throw new Error('Real ICP pricing data is required for server pair creation');
      }

      const operationStartTime = Date.now();

      // Step 1: Calculate optimal server configuration from credits (EXACTLY like HostingInterface)
      progressCallback?.('Calculating server configuration...', 10);
      
      // Calculate server config from credits (same as HostingInterface)
      const serverConfig = UserCanisterService.calculateOptimalServerConfig(creditsAllocated);
      if (!serverConfig.canCreateServers) {
        throw new Error(serverConfig.message);
      }

      // Step 2: Credits validation and USD conversion (for user billing)
      progressCallback?.('Validating credits...', 15);
      const { CreditsService } = await import('./CreditsService');
      const conversionUtils = CreditsService.getConversionUtils();
      const usdEquivalent = await conversionUtils.creditsToUsd(creditsAllocated);

      // Step 3: Calculate ICP from ACTUAL cycles needed (EXACTLY like HostingInterface)
      // 🔥 CRITICAL FIX: Calculate ICP from actual cycles needed, not from credits
      // This ensures platform wallet receives enough ICP to cover ALL costs including hosting
      progressCallback?.('Calculating cloud infrastructure costs...', 20);
      const actualCyclesNeeded = serverConfig.totalResourcesNeeded;
      console.log(`💰 [ServerCreation] Actual cycles needed: ${actualCyclesNeeded.toString()} (${Number(actualCyclesNeeded)/1_000_000_000_000}T cycles)`);
      
      const cloudConversion = await this.calculateIcpFromCycles(actualCyclesNeeded);

      // Step 4: Get initial balances and log comprehensive analysis (EXACTLY like HostingInterface)
      const initialMetadata = await this.getUserStateMetadata(userCanisterId, identity);
      const initialServerResources = initialMetadata?.cycleBalance || 0n;

      // Use FinancialLogger (duplicated from HostingInterface)
      const FinancialLogger = UserCanisterService.FinancialLogger;
      const { storeTransactionData } = await import('../components/TransactionTrackingModal');
      const REALISTIC_COSTS = UserCanisterService.REALISTIC_COSTS;

      // Log comprehensive cloud infrastructure analysis (EXACTLY like HostingInterface)
      UserCanisterService.FinancialLogger.logConversionRateAnalysis({
        creditsRequested: creditsAllocated,
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

      // Log detailed cost analysis (EXACTLY like HostingInterface)
      const serverCalculation = UserCanisterService.calculateComprehensiveServerResources(serverConfig.memoryGB, serverConfig.durationDays);
      UserCanisterService.FinancialLogger.logCostAnalysis({
        memoryGB: serverConfig.memoryGB,
        durationDays: serverConfig.durationDays,
        runtimeCyclesPerServer: serverCalculation.runtimeCycles,
        creationOverheadPerServer: serverCalculation.creationOverhead,
        totalCyclesPerServer: serverCalculation.totalWithSafetyBuffer,
        creditsRequested: creditsAllocated,
        usdEquivalent: usdEquivalent,
        realIcpPrice: cloudConversion.realIcpPrice
      });

      // Log comprehensive pre-operation snapshot (EXACTLY like HostingInterface)
      UserCanisterService.FinancialLogger.logBalanceSnapshot('PRE-OPERATION BALANCES', {
        userServerCycles: initialServerResources,
        platformStatus: 'Cloud infrastructure platform will provide resources',
        cloudStatus: `Current rate: $${cloudConversion.realIcpPrice.toFixed(4)} from ${cloudConversion.priceSource} (${Math.round(cloudConversion.priceAge/1000)}s old)`
      });

      // Step 5: Deduct credits from user's balance (EXACTLY like HostingInterface)
      progressCallback?.('Processing payment...', 25);
      const unitsToDeduct = Math.round(usdEquivalent * 100); // $1 = 100 units (NOT 10 units - that's for domains)
      const deductionSuccess = await this.deductUnitsFromBalance(
        userCanisterId,
        identity,
        unitsToDeduct,
        projectId,
        `Server pair creation: ${serverPairName} (${creditsAllocated} credits)`
      );

      if (!deductionSuccess) {
        throw new Error('Failed to deduct credits from user balance');
      }

      // Step 6: Platform wallet provisions ICP (EXACTLY like HostingInterface)
      progressCallback?.('Provisioning resources...', 30);
      const serverPrincipal = Principal.fromText(userCanisterId);
      const icpE8sNeeded = cloudConversion.icpE8s;
      
      console.log(`💰 [CloudInfrastructure] Using current infrastructure-based amount for server creation: ${icpE8sNeeded.toString()} e8s (${cloudConversion.icpTokens.toFixed(6)} tokens at $${cloudConversion.realIcpPrice.toFixed(4)})`);
      
      const transferResult = await mainActor.topUpCanisterCMC(
        serverPrincipal,
        icpE8sNeeded
      );

      if (!transferResult || (typeof transferResult === 'object' && 'err' in transferResult)) {
        // Restore user credits if platform provisioning fails (EXACTLY like HostingInterface)
        const { useAppStore } = await import('../store/appStore');
        const restoreUnits = await useAppStore.getState().addUnitsToBalance(unitsToDeduct);
        if (restoreUnits) {
          console.log('✅ User credits restored after platform provisioning failure');
        }
        
        const errorMessage = transferResult?.err || 'Platform provisioning failed';
        
        if (typeof errorMessage === 'string' && errorMessage.includes('insufficient')) {
          throw new Error('Platform is temporarily unable to provision server resources. Please try again shortly or contact support if this persists.');
        }
        
        throw new Error(`Platform error: ${JSON.stringify(errorMessage)}`);
      }

      // Extract block index (EXACTLY like HostingInterface)
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

      // Log platform resource provision (EXACTLY like HostingInterface)
      UserCanisterService.FinancialLogger.logPlatformResourceProvision({
        fromBalance: creditsAllocated, // Show original credits
        creditsDeducted: creditsAllocated,
        targetServer: userCanisterId,
        blockIndex: blockIndex,
        platformSource: 'Main Platform (Cloud Infrastructure)',
        realIcpPrice: cloudConversion.realIcpPrice,
        icpAmount: cloudConversion.icpTokens
      });

      // Step 7: CMC converts ICP to cycles (EXACTLY like HostingInterface)
      progressCallback?.('Converting resources...', 35);
      const cmcActor = await this.createCMCActor(identity);
      
      try {
        await cmcActor.notify_top_up({
          block_index: blockIndex,
          canister_id: serverPrincipal
        });

        UserCanisterService.FinancialLogger.logPaymentOperation({
          serverId: userCanisterId,
          blockIndex: blockIndex,
          success: true,
          sourceType: 'platform_wallet',
          realIcpPrice: cloudConversion.realIcpPrice
        });
        
      } catch (cmcError: any) {
        UserCanisterService.FinancialLogger.logPaymentOperation({
          serverId: userCanisterId,
          blockIndex: blockIndex,
          success: false,
          error: cmcError.message,
          sourceType: 'platform_wallet',
          realIcpPrice: cloudConversion.realIcpPrice
        });
        throw cmcError;
      }

      // Step 8: Wait for resources before server creation (EXACTLY like HostingInterface)
      progressCallback?.('Waiting for resource allocation...', 40);
      // Pass this service instance to logResourcePolling
      const resourceVerification = await UserCanisterService.FinancialLogger.logResourcePolling(
        userCanisterId,
        identity,
        initialServerResources,
        cloudConversion.estimatedCycles,
        90,
        this // Pass service instance
      );

      if (!resourceVerification.success) {
        throw new Error(`Failed to receive expected platform resources before server creation. Expected: ${cloudConversion.estimatedCycles.toString()}, Received: ${resourceVerification.resourcesAdded.toString()}`);
      }

      // Calculate conversion efficiency (EXACTLY like HostingInterface)
      const conversionEfficiency = Number(resourceVerification.resourcesAdded) / Number(cloudConversion.estimatedCycles);
      
      UserCanisterService.FinancialLogger.logConversionComparison({
        estimatedCycles: cloudConversion.estimatedCycles,
        actualCyclesReceived: resourceVerification.resourcesAdded,
        realIcpPrice: cloudConversion.realIcpPrice,
        actualIcpCyclesRate: cloudConversion.icpCyclesRate,
        blockIndex: blockIndex,
        conversionEfficiency: conversionEfficiency,
        marketVariance: conversionEfficiency - 1
      });

      // Step 9: Create frontend server with calculated resources (EXACTLY like HostingInterface)
      progressCallback?.('Creating frontend server...', 50);
      let frontendResult: any;
      try {
        frontendResult = await this.createServerFromUserCanister(
          userCanisterId,
          identity,
          identity.getPrincipal(),
          `${serverPairName} Frontend`,
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

        UserCanisterService.FinancialLogger.logServerCreation({
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
        UserCanisterService.FinancialLogger.logServerCreation({
          serverType: 'frontend',
          resourcesAllocated: serverConfig.perServerResources,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }

      // Step 10: Create backend server with calculated resources (EXACTLY like HostingInterface)
      progressCallback?.('Creating backend server...', 70);
      let backendResult: any;
      try {
        backendResult = await this.createServerFromUserCanister(
          userCanisterId,
          identity,
          identity.getPrincipal(),
          `${serverPairName} Backend`,
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

        UserCanisterService.FinancialLogger.logServerCreation({
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
        UserCanisterService.FinancialLogger.logServerCreation({
          serverType: 'backend',
          resourcesAllocated: serverConfig.perServerResources,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }

      // Step 11: Configure Hosting for Frontend Server (EXACTLY like HostingInterface)
      progressCallback?.('Configuring website hosting...', 85);
      let hostingConfigured = false;
      try {
        await this.fetchAndConfigureHostingForServer(
          frontendResult.canisterId,
          identity.getPrincipal(),
          userCanisterId,
          identity,
          (status, progress) => {
            const mappedProgress = 85 + ((progress / 100) * 10);
            progressCallback?.(status, mappedProgress);
          }
        );
        hostingConfigured = true;
      } catch (hostingError) {
        console.error('❌ Hosting configuration failed:', hostingError);
        // Don't fail the entire operation
      }

      // Step 12: Create server pair record (EXACTLY like HostingInterface)
      progressCallback?.('Finalizing server pair...', 95);
      const frontendPrincipal = Principal.fromText(frontendResult.canisterId);
      const backendPrincipal = Principal.fromText(backendResult.canisterId);
      
      const userActor = await this.getUserActor(userCanisterId, identity);
      const serverPairResult = await userActor.createServerPair(
        projectId,
        serverPairName,
        frontendPrincipal,
        backendPrincipal,
        creditsAllocated
      );

      // Extract the actual pair ID from the result
      let actualPairId: string | undefined;
      const pairCreated = serverPairResult && !(typeof serverPairResult === 'object' && 'err' in serverPairResult);
      
      if (pairCreated && serverPairResult && typeof serverPairResult === 'object') {
        // The result can be { ok: pairId } or { Ok: pairId } or just the pairId string
        if ('ok' in serverPairResult) {
          actualPairId = serverPairResult.ok;
        } else if ('Ok' in serverPairResult) {
          actualPairId = serverPairResult.Ok;
        } else if (typeof serverPairResult === 'string') {
          actualPairId = serverPairResult;
        }
      }
      
      if (!pairCreated || !actualPairId) {
        console.warn('Server pair record creation failed or pair ID not found:', serverPairResult);
      } else {
        console.log('✅ [UserCanisterService] Server pair created with ID:', actualPairId);
      }

      // Step 13: Store comprehensive transaction data (EXACTLY like HostingInterface)
      const operationTime = Math.round((Date.now() - operationStartTime) / 1000);
      
      console.log('📊 [TransactionTracking] Storing server creation transaction data...');
      
      try {
        storeTransactionData({
          projectId: projectId,
          projectName: projectName,
          operationType: 'server_creation',
          source: 'server_pair_dialog',
          
          // Input data
          creditsRequested: creditsAllocated,
          serverPairName: serverPairName,
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

      // Step 14: Final operation summary (EXACTLY like HostingInterface)
      UserCanisterService.FinancialLogger.logOperationSummary({
        operationType: 'server_creation',
        totalCreditsRequested: creditsAllocated,
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

      const efficiencyMessage = conversionEfficiency > 1.1 
        ? ` Bonus: Cloud conditions were ${((conversionEfficiency - 1) * 100).toFixed(1)}% more favorable than estimated!`
        : conversionEfficiency < 0.9
        ? ` Note: Cloud conditions resulted in ${((1 - conversionEfficiency) * 100).toFixed(1)}% fewer resources than estimated.`
        : ' Cloud infrastructure conversion was highly accurate.';

      const enhancedMessage = hostingConfigured 
        ? `Server pair "${serverPairName}" created successfully using cloud infrastructure with hosting configured! Frontend: ${frontendResult.canisterId}, Backend: ${backendResult.canisterId}. Ready for your website!${efficiencyMessage}`
        : `Server pair "${serverPairName}" created successfully using cloud infrastructure! Frontend: ${frontendResult.canisterId}, Backend: ${backendResult.canisterId}. Hosting configuration failed but can be retried.${efficiencyMessage}`;

      // 🔥 NEW: Track cycle consumption in economy metrics
      try {
        const { economyMetricsService } = await import('./EconomyMetricsService');
        economyMetricsService.trackCycleConsumption({
          userId: userCanisterId,
          userPrincipal: identity.getPrincipal().toString(),
          canisterId: frontendResult.canisterId,
          canisterType: 'server_pair_frontend',
          cyclesConsumed: resourceVerification.resourcesAdded / BigInt(2), // Split between frontend and backend
          timestamp: Date.now()
        });
        economyMetricsService.trackCycleConsumption({
          userId: userCanisterId,
          userPrincipal: identity.getPrincipal().toString(),
          canisterId: backendResult.canisterId,
          canisterType: 'server_pair_backend',
          cyclesConsumed: resourceVerification.resourcesAdded / BigInt(2),
          timestamp: Date.now()
        });
        console.log('📊 [UserCanisterService] Cycle consumption tracked in economy metrics');
      } catch (trackingError) {
        console.warn('⚠️ [UserCanisterService] Failed to track cycle consumption:', trackingError);
      }

      progressCallback?.('Server pair creation complete!', 100);
      console.log(`🎉 [UserCanisterService] Complete server pair creation with hosting successful in ${operationTime}s!`);

      return {
        success: true,
        serverPairId: actualPairId,
        frontendCanisterId: frontendResult.canisterId,
        backendCanisterId: backendResult.canisterId,
        hostingConfigured: hostingConfigured,
        message: enhancedMessage
      };

    } catch (error) {
      console.groupEnd();
      progressCallback?.('Server pair creation failed', 0);
      console.error('❌ [UserCanisterService] Server pair creation with hosting failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        hostingConfigured: false
      };
    }
  }


  async createProjectWithNewServerPair(
    project: Project,
    serverPairName: string,
    creditsAllocated: number,
    userCanisterId: string,
    identity: Identity,
    mainActor: any, // REQUIRED - platform wallet actor
    icpPriceData: any // REQUIRED - real ICP pricing data
  ): Promise<ProjectWithServerPairResult> {
    try {
      console.log('🚀 [UserCanisterService] ENHANCED: Creating project with new server pair using platform wallet:', {
        projectId: project.id,
        projectName: project.name,
        serverPairName,
        creditsAllocated
      });

      // Validate required parameters
      if (!mainActor) {
        throw new Error('Platform wallet actor is required for project with server pair creation');
      }

      if (!icpPriceData || !icpPriceData.price || icpPriceData.price <= 0) {
        throw new Error('Real ICP pricing data is required for project with server pair creation');
      }

      // Step 1: Create the project first
      const projectResult = await this.saveProject(project, userCanisterId, identity);
      
      if (!projectResult.success) {
        throw new Error(`Failed to create project: ${projectResult.error || 'Unknown error'}`);
      }

      console.log('✅ [UserCanisterService] ENHANCED: Project created successfully:', project.id);

      // Step 2: Create complete server pair with platform wallet provisioning
      const serverPairResult = await this.createCompleteServerPairForProject(
        serverPairName,
        creditsAllocated,
        project.id,
        project.name,
        userCanisterId,
        identity,
        mainActor,
        icpPriceData
      );

      if (!serverPairResult.success) {
        throw new Error(`Failed to create server pair with platform wallet: ${serverPairResult.error || 'Unknown error'}`);
      }

      console.log('✅ [UserCanisterService] ENHANCED: Server pair created and provisioned with platform wallet successfully');

      return {
        success: true,
        projectId: project.id,
        serverPairId: serverPairResult.serverPairId
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] ENHANCED: Failed to create project with new server pair using platform wallet:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async createProjectWithExistingServerPair(
    project: Project,
    serverPairId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<ProjectWithServerPairResult> {
    try {
      console.log('🎯 [UserCanisterService] Creating project with existing server pair:', {
        projectId: project.id,
        projectName: project.name,
        serverPairId
      });

      // Step 1: Create the project
      const projectResult = await this.saveProject(project, userCanisterId, identity);
      
      if (!projectResult.success) {
        throw new Error(`Failed to create project: ${projectResult.error || 'Unknown error'}`);
      }

      console.log('✅ [UserCanisterService] Project created successfully:', project.id);

      // Step 2: Move server pair to the new project (from unassigned '' to new project)
      const moveResult = await this.moveServerPairToProject(
        serverPairId,
        '', // fromProjectId - empty string for unassigned pairs
        project.id, // toProjectId
        userCanisterId,
        identity
      );

      if (!moveResult.success) {
        throw new Error(`Failed to assign server pair to project: ${moveResult.error || 'Unknown error'}`);
      }

      console.log('✅ [UserCanisterService] Server pair assigned to project successfully');

      return {
        success: true,
        projectId: project.id,
        serverPairId: serverPairId
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to create project with existing server pair:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async createServerWithPlatformProvisioning(
    userCanisterId: string,
    identity: Identity,
    userPrincipal: Principal,
    serverName: string,
    serverType: string,
    config: CanisterCreationConfig,
    projectContext: ServerCreationContext,
    mainActor: any,
    icpE8sAmount: bigint
  ): Promise<CanisterCreationResult> {
    try {
      console.log('🌐 [UserCanisterService] ENHANCED: Creating server with platform provisioning:', {
        serverName,
        serverType,
        icpE8sAmount: icpE8sAmount.toString(),
        projectId: projectContext.projectId
      });

      await this.initializeUserActor(userCanisterId, identity);
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('User canister actor not initialized');
      }

      // Step 1: Create the canister first (with minimal cycles)
      console.log('🏗️ [UserCanisterService] ENHANCED: Creating canister structure...');
      const createResult = await this.retryOperation(async () => {
        return await userActor.createCanisterWithSettings(
          userPrincipal,
          BigInt(Math.max(1, Math.floor(config.memoryGB))),
          BigInt(config.computeAllocation),
          config.freezingThreshold.length > 0 ? [BigInt(config.freezingThreshold[0])] : [],
          BigInt(config.durationInDays),
          BigInt(1_000_000_000), // Minimal cycles for creation
          serverName,
          serverType.toLowerCase()
        );
      });

      if (!createResult || typeof createResult !== 'string') {
        throw new Error('Failed to create canister structure');
      }

      const canisterId = createResult;
      const serverPrincipal = Principal.fromText(canisterId);

      console.log('✅ [UserCanisterService] ENHANCED: Canister structure created:', canisterId);

      // Step 2: Platform wallet provisions the canister with real ICP
      console.log('💰 [UserCanisterService] ENHANCED: Platform provisioning with ICP...');
      
      const provisionResult = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] ENHANCED: Calling platform topUpCanisterCMC...');
        return await mainActor.topUpCanisterCMC(serverPrincipal, icpE8sAmount);
      });

      if (!provisionResult || typeof provisionResult !== 'object' || !('ok' in provisionResult || 'Ok' in provisionResult)) {
        throw new Error('Platform wallet provisioning failed');
      }

      const blockIndex = provisionResult.ok || provisionResult.Ok;
      console.log('✅ [UserCanisterService] ENHANCED: Platform provisioning successful, block:', blockIndex);

      // Step 3: Convert ICP to cycles via CMC
      console.log('🔄 [UserCanisterService] ENHANCED: Converting ICP to cycles...');
      
      const cmcActor = await this.createCMCActor(identity);
      
      try {
        await cmcActor.notify_top_up({
          block_index: blockIndex,
          canister_id: serverPrincipal
        });

        console.log('✅ [UserCanisterService] ENHANCED: CMC notification successful');
        
      } catch (notifyError: any) {
        console.error('❌ [UserCanisterService] ENHANCED: CMC notification failed:', notifyError);
        throw new Error(`CMC notification failed - cycles conversion unsuccessful: ${notifyError.message}`);
      }

      // Step 4: Set canister metadata for project tracking
      console.log('📝 [UserCanisterService] ENHANCED: Setting canister metadata...');
      await this.setCanisterMetadata(
        userCanisterId,
        identity,
        canisterId,
        {
          name: serverName,
          canisterType: serverType.toLowerCase(),
          subType: serverType.toLowerCase(),
          projectId: projectContext.projectId  
        }
      );

      console.log('🎉 [UserCanisterService] ENHANCED: Server creation with platform provisioning complete:', {
        canisterId,
        serverName,
        serverType,
        estimatedCycles: config.cyclesAmount.toString(),
        projectId: projectContext.projectId
      });

      return {
        success: true,
        canisterId: canisterId
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] ENHANCED: Server creation with platform provisioning failed:', error);
      
      return {
        success: false,
        error: this.createCanisterError(error)
      };
    }
  }


  // ==================== PUBLIC METHODS ====================

  async checkExistingCanister(userPrincipal: Principal): Promise<string | null> {
    try {
      console.log('🔍 [UserCanisterService] Checking existing canister for principal:', userPrincipal.toString());
      await this.ensureActorReady();
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling getUserPlatformCanister...');
        return await this.actor.getUserPlatformCanister(userPrincipal);
      });

      console.log('📤 [UserCanisterService] getUserPlatformCanister result:', result);

      if (result && Array.isArray(result) && result.length > 0) {
        const canisterData = result[0];
        console.log('🎯 [UserCanisterService] Found existing canister data:', canisterData);
        
        const canisterIdString = this.convertPrincipalToCanisterId(canisterData);
        
        if (canisterIdString) {
          console.log('🎯 [UserCanisterService] Successfully converted canister ID:', canisterIdString);
          return canisterIdString;
        } else {
          console.error('🎯 [UserCanisterService] Failed to convert canister ID from:', canisterData);
          return null;
        }
      }
      
      console.log('🔍 [UserCanisterService] No existing canister found');
      return null;
    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to check existing canister:', error);
      throw this.createCanisterError(error);
    }
  }

  // RENAMED: Main canister creates user canisters for new users
  async createUserCanisterFromMainCanister(
    userPrincipal: Principal, 
    config: Partial<CanisterCreationConfig> = {}
  ): Promise<CanisterCreationResult> {
    try {
      console.log('🏗️ [UserCanisterService] Creating user canister from MAIN canister for principal:', userPrincipal.toString());
      await this.ensureActorReady();
      
      const finalConfig = { ...this.defaultConfig, ...config };
      console.log('🏗️ [UserCanisterService] Using config:', finalConfig);
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling main canister createCanisterWithSettings...');
        return await this.actor.createCanisterWithSettings(
          userPrincipal,
          finalConfig.memoryGB,
          finalConfig.computeAllocation,
          finalConfig.freezingThreshold,
          finalConfig.durationInDays,
          finalConfig.cyclesAmount
        );
      });

      console.log('📤 [UserCanisterService] Main canister createCanisterWithSettings result:', result);

      if (result && typeof result === 'object') {
        if ('Ok' in result || 'ok' in result) {
          const canisterId = result.Ok || result.ok;
          return {
            success: true,
            canisterId: canisterId
          };
        } else if ('Err' in result || 'err' in result) {
          const error = result.Err || result.err;
          return {
            success: false,
            error: this.createCanisterError(new Error(error))
          };
        }
      }

      if (typeof result === 'string' && result.length > 0) {
        return {
          success: true,
          canisterId: result
        };
      }

      return {
        success: false,
        error: this.createCanisterError(new Error(`Invalid response from main canister creation. Got: ${typeof result}`))
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to create user canister from main canister:', error);
      return {
        success: false,
        error: this.createCanisterError(error)
      };
    }
  }

  // FIXED: User canister creates servers with proper metadata setting
  async createServerFromUserCanister(
    userCanisterId: string,
    identity: Identity,
    userPrincipal: Principal,
    serverName: string,
    serverType: string,
    config: Partial<CanisterCreationConfig> = {},
    projectContext?: ServerCreationContext
  ): Promise<CanisterCreationResult> {
    try {
      // ENHANCED: Comprehensive environment and configuration logging
      console.log('🌐 [createServerFromUserCanister] ENHANCED DEBUG - Environment check:', {
        hostname: window.location.hostname,
        origin: window.location.origin,
        isKontextBuild: window.location.hostname === 'kontext.build',
        isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
        userCanisterId: userCanisterId.substring(0, 10) + '...',
        identityPrincipal: identity.getPrincipal().toText(),
        userPrincipal: userPrincipal.toText(),
        serverName,
        serverType,
        hasProjectContext: !!projectContext
      });

      // Initialize user actor with enhanced logging
      console.log('🎭 [createServerFromUserCanister] Initializing user actor...');
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }
      
      // ENHANCED: Verify actor capabilities
      console.log('🔍 [createServerFromUserCanister] User actor verification:', {
        hasActor: !!userActor,
        actorMethods: typeof userActor === 'object' ? Object.keys(userActor).filter(k => typeof userActor[k] === 'function').slice(0, 10) : [],
        hasCreateMethod: userActor && typeof userActor.createCanisterWithSettings === 'function'
      });

      // Prepare configuration
      const finalConfig = { ...this.defaultConfig, ...config };
      const memoryGBWhole = Math.max(1, Math.floor(finalConfig.memoryGB));
      
      console.log('📊 [createServerFromUserCanister] Server creation configuration:', {
        serverName,
        serverType: serverType.toLowerCase(),
        memoryGB: memoryGBWhole,
        computeAllocation: finalConfig.computeAllocation,
        freezingThreshold: finalConfig.freezingThreshold,
        durationInDays: finalConfig.durationInDays,
        cyclesAmount: finalConfig.cyclesAmount.toString(),
        cyclesAmountInT: Number(finalConfig.cyclesAmount) / 1_000_000_000_000,
        projectId: projectContext?.projectId,
        projectName: projectContext?.projectName
      });
      
      // Execute canister creation with comprehensive error handling
      console.log('📞 [createServerFromUserCanister] Calling createCanisterWithSettings...');
      const callStartTime = Date.now();
      
      const result = await this.retryOperation(async () => {
        return await userActor.createCanisterWithSettings(
          userPrincipal,
          BigInt(memoryGBWhole),
          BigInt(finalConfig.computeAllocation),
          finalConfig.freezingThreshold.length > 0 ? [BigInt(finalConfig.freezingThreshold[0])] : [],
          BigInt(finalConfig.durationInDays),
          BigInt(finalConfig.cyclesAmount),
          serverName,
          serverType.toLowerCase()
        );
      });
      
      const callDuration = Date.now() - callStartTime;

      // ENHANCED: Comprehensive response analysis
      console.log('📤 [createServerFromUserCanister] DETAILED RESPONSE ANALYSIS:', {
        callDuration: `${callDuration}ms`,
        rawResult: result,
        resultType: typeof result,
        isNull: result === null,
        isUndefined: result === undefined,
        isString: typeof result === 'string',
        isObject: typeof result === 'object',
        isArray: Array.isArray(result),
        resultKeys: result && typeof result === 'object' && !Array.isArray(result) ? Object.keys(result) : [],
        hasOk: result && typeof result === 'object' && ('ok' in result || 'Ok' in result),
        hasErr: result && typeof result === 'object' && ('err' in result || 'Err' in result),
        resultStringified: JSON.stringify(result, null, 2)
      });

      let canisterId: string | null = null;
      let extractionMethod = 'none';
      
      // STRATEGY 1: Check for Ok/ok property (standard Motoko Result type)
      if (result && typeof result === 'object' && ('Ok' in result || 'ok' in result)) {
        const okValue = result.Ok || result.ok;
        console.log('✅ [createServerFromUserCanister] Strategy 1: Found Ok/ok property:', {
          okValue,
          okType: typeof okValue,
          okStringValue: typeof okValue === 'object' ? JSON.stringify(okValue) : okValue
        });
        
        if (typeof okValue === 'string') {
          canisterId = okValue;
          extractionMethod = 'ok-property-string';
        } else if (okValue && typeof okValue === 'object' && 'toText' in okValue && typeof okValue.toText === 'function') {
          canisterId = okValue.toText();
          extractionMethod = 'ok-property-principal';
        } else if (okValue && typeof okValue === 'object') {
          // Try to find canister ID in nested object
          const nestedId = this.extractCanisterIdFromObject(okValue);
          if (nestedId) {
            canisterId = nestedId;
            extractionMethod = 'ok-property-nested';
          }
        }
      }
      
      // STRATEGY 2: Direct string result
      if (!canisterId && typeof result === 'string' && result.length > 0) {
        console.log('✅ [createServerFromUserCanister] Strategy 2: Found direct string result:', result);
        canisterId = result;
        extractionMethod = 'direct-string';
      }
      
      // STRATEGY 3: Search for canister ID pattern in object properties
      if (!canisterId && result && typeof result === 'object' && !Array.isArray(result)) {
        console.log('🔍 [createServerFromUserCanister] Strategy 3: Searching object properties for canister ID...');
        
        for (const [key, value] of Object.entries(result)) {
          console.log(`   Checking property "${key}":`, value, typeof value);
          
          if (typeof value === 'string' && this.looksLikeCanisterId(value)) {
            console.log(`✅ [createServerFromUserCanister] Found canister ID in property "${key}":`, value);
            canisterId = value;
            extractionMethod = `property-${key}`;
            break;
          }
          
          if (value && typeof value === 'object' && 'toText' in value && typeof value.toText === 'function') {
            try {
              const textValue = value.toText();
              if (this.looksLikeCanisterId(textValue)) {
                console.log(`✅ [createServerFromUserCanister] Found Principal in property "${key}":`, textValue);
                canisterId = textValue;
                extractionMethod = `property-${key}-principal`;
                break;
              }
            } catch (e) {
              console.warn(`⚠️ [createServerFromUserCanister] Failed to call toText on property "${key}":`, e);
            }
          }
        }
      }
      
      // STRATEGY 4: Array response (some endpoints return arrays)
      if (!canisterId && Array.isArray(result) && result.length > 0) {
        console.log('🔍 [createServerFromUserCanister] Strategy 4: Checking array result...');
        const firstItem = result[0];
        
        if (typeof firstItem === 'string' && this.looksLikeCanisterId(firstItem)) {
          console.log('✅ [createServerFromUserCanister] Found canister ID in array:', firstItem);
          canisterId = firstItem;
          extractionMethod = 'array-first-element';
        }
      }

      // Final validation
      if (!canisterId) {
        console.error('❌ [createServerFromUserCanister] FAILED TO EXTRACT CANISTER ID');
        console.error('   Result dump:', JSON.stringify(result, null, 2));
        console.error('   Environment:', {
          hostname: window.location.hostname,
          origin: window.location.origin
        });
        
        return {
          success: false,
          error: this.createCanisterError(new Error(
            `Invalid response from canister creation. Could not extract canister ID. ` +
            `Result type: ${typeof result}. ` +
            `Result keys: ${result && typeof result === 'object' ? Object.keys(result).join(', ') : 'none'}. ` +
            `Raw result: ${JSON.stringify(result)}`
          ))
        };
      }

      console.log('🎉 [createServerFromUserCanister] Successfully extracted canister ID:', {
        canisterId,
        extractionMethod,
        verifyIsValid: this.looksLikeCanisterId(canisterId)
      });

      // CRITICAL: Metadata setting is mandatory for server creation
      if (!projectContext) {
        console.error('❌ [createServerFromUserCanister] Missing project context - metadata cannot be set');
        return {
          success: false,
          error: this.createCanisterError(new Error('Project context is required for server creation'))
        };
      }

      console.log('📝 [createServerFromUserCanister] Setting canister metadata...');
      try {
        await this.setCanisterMetadata(
          userCanisterId,
          identity,
          canisterId,
          {
            name: serverName,
            canisterType: serverType.toLowerCase(),
            subType: serverType.toLowerCase(),
            projectId: projectContext.projectId  
          }
        );
        console.log('✅ [createServerFromUserCanister] Metadata set successfully');
      } catch (metadataError) {
        console.error('❌ [createServerFromUserCanister] Metadata setting failed:', metadataError);
        // Still return success with the canister ID, but note the metadata failure
        return {
          success: true,
          canisterId: canisterId,
          error: this.createCanisterError(new Error(
            `Server created but metadata setting failed: ${metadataError instanceof Error ? metadataError.message : 'Unknown error'}`
          ))
        };
      }

      console.log('🎉 [createServerFromUserCanister] Server creation complete:', {
        canisterId,
        serverName,
        serverType,
        projectId: projectContext.projectId,
        extractionMethod
      });

      return {
        success: true,
        canisterId: canisterId
      };

    } catch (error) {
      console.error('❌ [createServerFromUserCanister] Server creation failed:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        hostname: window.location.hostname,
        origin: window.location.origin
      });
      
      return {
        success: false,
        error: this.createCanisterError(error)
      };
    }
  }

// HELPER: Check if a string looks like a valid canister ID
private looksLikeCanisterId(value: string): boolean {
  // IC canister IDs are typically in format: xxxxx-xxxxx-xxxxx-xxxxx-xxx
  // They contain lowercase letters and numbers, separated by hyphens
  const canisterIdPattern = /^[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{3}$/;
  return canisterIdPattern.test(value) || value.includes('-cai');
}

// HELPER: Extract canister ID from nested object structure
private extractCanisterIdFromObject(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null;
  
  // Recursively search for canister ID patterns
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && this.looksLikeCanisterId(value)) {
      return value;
    }
    
    if (value && typeof value === 'object') {
      const nestedResult = this.extractCanisterIdFromObject(value);
      if (nestedResult) return nestedResult;
    }
  }
  
  return null;
}

  // LEGACY: Keep original method name for backward compatibility (now calls main canister method)
  async createNewCanister(
    userPrincipal: Principal, 
    config: Partial<CanisterCreationConfig> = {}
  ): Promise<CanisterCreationResult> {
    console.log('⚠️ [UserCanisterService] DEPRECATED: createNewCanister called - redirecting to createUserCanisterFromMainCanister');
    return this.createUserCanisterFromMainCanister(userPrincipal, config);
  }

  async deleteCanister(canisterId: string, userPrincipal: Principal): Promise<void> {
    try {
      console.log('🗑️ [UserCanisterService] Deleting canister:', canisterId);
      await this.ensureActorReady();
      
      await this.retryOperation(async () => {
        const canisterPrincipal = Principal.fromText(canisterId);
        return await this.actor.deleteCanister(canisterPrincipal);
      });

      console.log('✅ [UserCanisterService] Canister deleted successfully');
    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to delete canister:', error);
      throw this.createCanisterError(error);
    }
  }

  // ==================== ENHANCED: MINIMAL STRIPE DATA METHODS ====================

  /**
   * NEW: Store customer ID immediately after successful Stripe checkout
   * This is the foundation of the minimal Stripe data approach
   */
  async setStripeCustomerId(
    userCanisterId: string,
    identity: Identity,
    customerId: string
  ): Promise<StripeCustomerResult> {
    try {
      console.log('💳 [UserCanisterService] Setting Stripe customer ID:', customerId);
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for customer ID storage');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling setStripeCustomerId on USER actor...');
        return await userActor.setStripeCustomerId(customerId);
      });

      console.log('📤 [UserCanisterService] setStripeCustomerId result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        console.log('✅ [UserCanisterService] Stripe customer ID stored successfully');
        
        return {
          success: true,
          customerId: customerId
        };
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.error('❌ [UserCanisterService] Failed to store customer ID:', error);
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      return {
        success: false,
        error: 'Invalid response from customer ID storage'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Error storing customer ID:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * NEW: Get stored customer ID for direct Stripe operations
   * Eliminates all customer lookup issues
   */
  async getStripeCustomerId(
    userCanisterId: string,
    identity: Identity
  ): Promise<StripeCustomerResult> {
    try {
      console.log('💳 [UserCanisterService] Getting stored Stripe customer ID');
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for customer ID retrieval');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling getStripeCustomerId on USER actor...');
        return await userActor.getStripeCustomerId();
      });

      console.log('📤 [UserCanisterService] getStripeCustomerId result:', result);

      if (result && Array.isArray(result) && result.length > 0) {
        const customerId = result[0];
        console.log('✅ [UserCanisterService] Retrieved customer ID:', customerId);
        
        return {
          success: true,
          customerId: customerId
        };
      }

      console.log('ℹ️ [UserCanisterService] No customer ID found - user needs migration or initial setup');
      return {
        success: false,
        error: 'No customer ID stored - needs initial setup or migration'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Error retrieving customer ID:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * NEW: Update subscription active status from webhook events
   * Enables instant local feature access checks
   */
  async updateSubscriptionActiveStatus(
    userCanisterId: string,
    identity: Identity,
    isActive: boolean
  ): Promise<SubscriptionStatusResult> {
    try {
      console.log('💳 [UserCanisterService] Updating subscription active status:', isActive);
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for status update');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling updateStripeSubscriptionStatus on USER actor...');
        return await userActor.updateStripeSubscriptionStatus(isActive);
      });

      console.log('📤 [UserCanisterService] updateStripeSubscriptionStatus result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        console.log('✅ [UserCanisterService] Subscription status updated successfully');
        
        return {
          success: true,
          isActive: isActive
        };
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.error('❌ [UserCanisterService] Failed to update subscription status:', error);
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      return {
        success: false,
        error: 'Invalid response from subscription status update'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Error updating subscription status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * NEW: Update billing cycle end date for renewal warnings
   * Enables local renewal calculations without API calls
   */
  async updateBillingCycleEnd(
    userCanisterId: string,
    identity: Identity,
    billingCycleEnd: number
  ): Promise<SubscriptionUpdateResult> {
    try {
      console.log('💳 [UserCanisterService] Updating billing cycle end date:', new Date(billingCycleEnd).toISOString());
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for billing cycle update');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling updateBillingCycleEnd on USER actor...');
        return await userActor.updateBillingCycleEnd(BigInt(billingCycleEnd));
      });

      console.log('📤 [UserCanisterService] updateBillingCycleEnd result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        console.log('✅ [UserCanisterService] Billing cycle end updated successfully');
        
        return {
          success: true
        };
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.error('❌ [UserCanisterService] Failed to update billing cycle end:', error);
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      return {
        success: false,
        error: 'Invalid response from billing cycle end update'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Error updating billing cycle end:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * NEW: Store all minimal Stripe data in one operation
   * Used during successful subscription setup
   */
  async storeMinimalStripeData(
    userCanisterId: string,
    identity: Identity,
    stripeData: MinimalStripeData
  ): Promise<StripeDataResult> {
    try {
      console.log('💳 [UserCanisterService] Storing minimal Stripe data:', {
        customerId: stripeData.customerId,
        subscriptionActive: stripeData.subscriptionActive,
        billingCycleEnd: stripeData.billingCycleEnd ? new Date(stripeData.billingCycleEnd).toISOString() : null
      });
      
      // Store customer ID first - this is the most critical
      const customerResult = await this.setStripeCustomerId(userCanisterId, identity, stripeData.customerId);
      
      if (!customerResult.success) {
        throw new Error(`Failed to store customer ID: ${customerResult.error}`);
      }

      // Update subscription status
      const statusResult = await this.updateSubscriptionActiveStatus(
        userCanisterId, 
        identity, 
        stripeData.subscriptionActive
      );
      
      if (!statusResult.success) {
        console.warn('⚠️ [UserCanisterService] Failed to store subscription status but continuing:', statusResult.error);
      }

      // Update billing cycle end if provided
      if (stripeData.billingCycleEnd) {
        const billingResult = await this.updateBillingCycleEnd(
          userCanisterId,
          identity,
          stripeData.billingCycleEnd
        );
        
        if (!billingResult.success) {
          console.warn('⚠️ [UserCanisterService] Failed to store billing cycle end but continuing:', billingResult.error);
        }
      }

      console.log('✅ [UserCanisterService] Minimal Stripe data stored successfully');
      
      return {
        success: true,
        data: stripeData
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Error storing minimal Stripe data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * NEW: Get all stored minimal Stripe data for frontend use
   * Fast local retrieval without API calls
   */
  async getMinimalStripeData(
    userCanisterId: string,
    identity: Identity
  ): Promise<StripeDataResult> {
    try {
      console.log('💳 [UserCanisterService] Retrieving minimal Stripe data');
      
      // Get customer ID
      const customerResult = await this.getStripeCustomerId(userCanisterId, identity);
      
      if (!customerResult.success) {
        return {
          success: false,
          error: customerResult.error
        };
      }

      // Get subscription info (includes active status and billing cycle)
      const subscriptionInfo = await this.getSubscriptionInfo(userCanisterId, identity);
      
      if (!subscriptionInfo) {
        return {
          success: false,
          error: 'Failed to retrieve subscription information'
        };
      }

      const minimalData: MinimalStripeData = {
        customerId: customerResult.customerId!,
        subscriptionActive: subscriptionInfo.isActive,
        billingCycleEnd: subscriptionInfo.billingCycleEnd
      };

      console.log('✅ [UserCanisterService] Retrieved minimal Stripe data:', minimalData);
      
      return {
        success: true,
        data: minimalData
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Error retrieving minimal Stripe data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * ENHANCED: Check if subscription is locally active for instant feature access
   * No API calls needed - pure local check
   */
  async isSubscriptionActiveLocal(
    userCanisterId: string,
    identity: Identity
  ): Promise<boolean> {
    try {
      console.log('💳 [UserCanisterService] Checking local subscription status');
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for local status check');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling isSubscriptionActiveLocal on USER actor...');
        return await userActor.isSubscriptionActiveLocal();
      });

      console.log('📤 [UserCanisterService] isSubscriptionActiveLocal result:', result);

      return Boolean(result);

    } catch (error) {
      console.error('❌ [UserCanisterService] Error checking local subscription status:', error);
      // Default to false for security - don't allow access on error
      return false;
    }
  }

  // ==================== ENHANCED: ACCOUNT INITIALIZATION METHODS ====================

  /**
   * Check if this is a first-time user
   */
  async isFirstTimeUser(userCanisterId: string, identity: Identity): Promise<boolean> {
    try {
      console.log('🔍 [UserCanisterService] Checking if first-time user for canister:', userCanisterId);
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for first-time check');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling isFirstTimeUser on USER actor...');
        return await userActor.isFirstTimeUser();
      });

      console.log('📤 [UserCanisterService] isFirstTimeUser result:', result);
      
      return Boolean(result);

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to check if first-time user:', error);
      // Default to true if we can't determine - safer for initialization
      return true;
    }
  }

  /**
   * ENHANCED: Initialize user account with profile and automatically sync subscription
   */
  async initializeUserAccount(
    userCanisterId: string, 
    identity: Identity, 
    userProfile: UserProfile
  ): Promise<UserInitializationResult> {
    try {
      console.log('🏗️ [UserCanisterService] ENHANCED: Initializing user account with subscription sync for canister:', userCanisterId);
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for account initialization');
      }

      // Prepare user profile for canister (convert to Motoko optional field pattern)
      const canisterProfile = {
        username: userProfile.username,
        displayName: userProfile.displayName ? [userProfile.displayName] : [],
        email: userProfile.email ? [userProfile.email] : [],
        bio: userProfile.bio ? [userProfile.bio] : [],
        avatar: userProfile.avatar ? [userProfile.avatar] : [],
        coverPhoto: userProfile.coverPhoto ? [userProfile.coverPhoto] : [],
        website: userProfile.website ? [userProfile.website] : [],
        github: userProfile.github ? [userProfile.github] : [],
        socials: userProfile.socials ? [{
          twitter: userProfile.socials.twitter ? [userProfile.socials.twitter] : [],
          discord: userProfile.socials.discord ? [userProfile.socials.discord] : [],
          telegram: userProfile.socials.telegram ? [userProfile.socials.telegram] : [],
          openchat: userProfile.socials.openchat ? [userProfile.socials.openchat] : []
        }] : [],
        metadata: userProfile.metadata ? [userProfile.metadata] : [],
        avatarAsset: [], // Empty for now
        coverPhotoAsset: [] // Empty for now
      };
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] ENHANCED: Calling initializeUserAccount on USER actor...');
        return await userActor.initializeUserAccount(canisterProfile);
      });

      console.log('📤 [UserCanisterService] ENHANCED: initializeUserAccount result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        const userData = result.ok || result.Ok;
        console.log('✅ [UserCanisterService] ENHANCED: User account initialized successfully');
        
        // ENHANCED: The backend automatically calls initializeDefaultSubscription
        // Now we need to fetch the subscription info that was created
        let subscriptionInfo: SubscriptionInfo | null = null;
        
        try {
          console.log('📊 [UserCanisterService] ENHANCED: Fetching subscription info after account initialization...');
          subscriptionInfo = await this.getSubscriptionInfo(userCanisterId, identity);
          console.log('💳 [UserCanisterService] ENHANCED: Post-initialization subscription info:', subscriptionInfo);
        } catch (subscriptionError) {
          console.warn('⚠️ [UserCanisterService] ENHANCED: Failed to fetch subscription info after initialization:', subscriptionError);
          // Don't fail the whole operation, but we'll return null subscription info
        }
        
        return {
          success: true,
          user: this.convertUserFromCanister(userData),
          subscriptionInfo: subscriptionInfo
        };
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.error('❌ [UserCanisterService] ENHANCED: User account initialization failed:', error);
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      return {
        success: false,
        error: 'Invalid response from user account initialization'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] ENHANCED: Failed to initialize user account:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Initialize default subscription
   */
  async initializeDefaultSubscription(
    userCanisterId: string, 
    identity: Identity
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('💳 [UserCanisterService] Initializing default subscription in canister:', userCanisterId);
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for default subscription');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling initializeDefaultSubscription on USER actor...');
        return await userActor.initializeDefaultSubscription();
      });

      console.log('📤 [UserCanisterService] initializeDefaultSubscription result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        const success = result.ok || result.Ok;
        if (success) {
          console.log('✅ [UserCanisterService] Default subscription initialized successfully');
          return { success: true };
        }
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.error('❌ [UserCanisterService] Default subscription initialization failed:', error);
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      return {
        success: false,
        error: 'Invalid response from default subscription initialization'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to initialize default subscription:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Mark first login
   */
  async markFirstLogin(userCanisterId: string, identity: Identity): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('👋 [UserCanisterService] Marking first login for canister:', userCanisterId);
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for first login');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling markFirstLogin on USER actor...');
        return await userActor.markFirstLogin();
      });

      console.log('📤 [UserCanisterService] markFirstLogin result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        const success = result.ok || result.Ok;
        if (success) {
          console.log('✅ [UserCanisterService] First login marked successfully');
          return { success: true };
        }
      }

      return { success: false, error: 'Failed to mark first login' };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to mark first login:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Complete onboarding process
   */
  async completeOnboarding(userCanisterId: string, identity: Identity): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🎓 [UserCanisterService] Completing onboarding for canister:', userCanisterId);
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for onboarding completion');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling completeOnboarding on USER actor...');
        return await userActor.completeOnboarding();
      });

      console.log('📤 [UserCanisterService] completeOnboarding result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        const success = result.ok || result.Ok;
        if (success) {
          console.log('✅ [UserCanisterService] Onboarding completed successfully');
          return { success: true };
        }
      }

      return { success: false, error: 'Failed to complete onboarding' };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to complete onboarding:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get onboarding status
   */
  async getOnboardingStatus(userCanisterId: string, identity: Identity): Promise<OnboardingStatus | null> {
    try {
      console.log('📊 [UserCanisterService] Getting onboarding status for canister:', userCanisterId);
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for onboarding status');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling getOnboardingStatus on USER actor...');
        return await userActor.getOnboardingStatus();
      });

      console.log('📤 [UserCanisterService] getOnboardingStatus result:', result);

      if (result && typeof result === 'object') {
        return {
          hasCompletedOnboarding: Boolean(result.hasCompletedOnboarding),
          firstLoginAt: this.extractOptionalValue(result.firstLoginAt),
          accountCreatedAt: this.extractOptionalValue(result.accountCreatedAt)
        };
      }

      return null;

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to get onboarding status:', error);
      return null;
    }
  }

  /**
   * Get user account info
   */
  async getUserAccountInfo(userCanisterId: string, identity: Identity): Promise<User | null> {
    try {
      console.log('👤 [UserCanisterService] Getting user account info for canister:', userCanisterId);
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for account info');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling getUserAccountInfo on USER actor...');
        return await userActor.getUserAccountInfo();
      });

      console.log('📤 [UserCanisterService] getUserAccountInfo result:', result);

      if (result && Array.isArray(result) && result.length > 0) {
        const userData = result[0];
        return this.convertUserFromCanister(userData);
      }

      return null;

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to get user account info:', error);
      return null;
    }
  }

  /**
   * Helper method to create dummy user profile
   */
  public createDummyUserProfile(identity: Identity): UserProfile {
    const principal = identity.getPrincipal().toString();
    const shortPrincipal = principal.substring(0, 8);
    
    return {
      username: `user_${shortPrincipal}`,
      displayName: `User ${shortPrincipal}`,
      email: undefined,
      bio: undefined,
      avatar: undefined,
      coverPhoto: undefined,
      website: undefined,
      github: undefined,
      socials: undefined,
      metadata: []
    };
  }

  // ==================== UTILITY CONVERSION METHODS ====================

  private convertUserFromCanister(canisterUser: any): User {
    return {
      id: canisterUser.id,
      primaryAccountId: this.extractOptionalValue(canisterUser.primaryAccountId),
      created: canisterUser.created,
      preferences: this.extractOptionalValue(canisterUser.preferences),
      linkedAccounts: canisterUser.linkedAccounts || [],
      lastActive: canisterUser.lastActive,
      profile: this.convertUserProfileFromCanister(canisterUser.profile)
    };
  }

  private convertUserProfileFromCanister(canisterProfile: any): UserProfile {
    return {
      username: canisterProfile.username,
      displayName: this.extractOptionalValue(canisterProfile.displayName),
      email: this.extractOptionalValue(canisterProfile.email),
      bio: this.extractOptionalValue(canisterProfile.bio),
      avatar: this.extractOptionalValue(canisterProfile.avatar),
      coverPhoto: this.extractOptionalValue(canisterProfile.coverPhoto),
      website: this.extractOptionalValue(canisterProfile.website),
      github: this.extractOptionalValue(canisterProfile.github),
      socials: this.extractOptionalValue(canisterProfile.socials),
      metadata: this.extractOptionalValue(canisterProfile.metadata),
      avatarAsset: this.extractOptionalValue(canisterProfile.avatarAsset),
      coverPhotoAsset: this.extractOptionalValue(canisterProfile.coverPhotoAsset)
    };
  }

  // ==================== FIXED: CREDITS SYSTEM METHODS ====================

  /**
   * FIXED: Get user state metadata including cycle balance - NOW USES USER ACTOR
   */
  async getUserStateMetadata(userCanisterId: string, identity: Identity): Promise<UserStateMetadata | null> {
    try {
      console.log('💰 [UserCanisterService] FIXED: Fetching user state metadata from USER canister:', userCanisterId);
      
      // Initialize user actor for the specific canister
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for metadata');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] FIXED: Calling getUserStateMetadata on USER actor...');
        return await userActor.getUserStateMetadata();
      });

      console.log('📤 [UserCanisterService] FIXED: getUserStateMetadata raw result from USER canister:', result);

      if (result) {
        // Convert the canister response to our expected format
        const metadata: UserStateMetadata = {
          balance: Number(result.balance || 0),
          cycleBalance: BigInt(result.cycleBalance || 0),
          moduleHash: result.moduleHash,
          lastUpdated: Number(result.lastUpdated || 0),
          totalKeys: Number(result.totalKeys || 0),
          memoryUsage: Number(result.memoryUsage || 0),
          version: result.version || 'unknown',
          uptime: Number(result.uptime || 0),
          totalUsers: Number(result.totalUsers || 0),
          idleCyclesBurnedPerDay: Number(result.idleCyclesBurnedPerDay || 0),
          stableStateSize: Number(result.stableStateSize || 0),
          stableMemoryUsage: Number(result.stableMemoryUsage || 0),
          heapMemoryUsage: Number(result.heapMemoryUsage || 0),
          memorySize: Number(result.memorySize || 0)
        };

        console.log('✅ [UserCanisterService] FIXED: Converted user state metadata from USER canister:', {
          cycleBalance: metadata.cycleBalance.toString(),
          balance: metadata.balance,
          lastUpdated: new Date(metadata.lastUpdated).toISOString()
        });

        return metadata;
      }

      console.warn('⚠️ [UserCanisterService] FIXED: No metadata returned from USER canister');
      return null;

    } catch (error) {
      console.error('❌ [UserCanisterService] FIXED: Failed to get user state metadata from USER canister:', error);
      return null;
    }
  }

  /**
   * FIXED: Get user ICP balance - NEW METHOD THAT ACTUALLY FETCHES ICP BALANCE
   */
  async getUserBalance(userCanisterId: string, identity: Identity): Promise<number | null> {
    try {
      // console.log('💰 [UserCanisterService] FIXED: Fetching user ICP balance from USER canister:', userCanisterId);
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for balance');
      }
      
      const result = await this.retryOperation(async () => {
        // console.log('📞 [UserCanisterService] FIXED: Calling getUserBalance on USER actor...');
        return await userActor.getUserBalance();
      });

      if (result !== null && result !== undefined) {
        const icpBalance = Number(result);
        return icpBalance;
      }

      return 0;

    } catch (error) {
      console.error('❌ [UserCanisterService] FIXED: Failed to get ICP balance from USER canister:', error);
      return null;
    }
  }


  /**
   * Get user's units balance from AI credits field in canister
   */
  async getUserUnitsBalance(userCanisterId: string, identity: Identity): Promise<number> {
    try {
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for units balance');
      }
      
      const result = await this.retryOperation(async () => {
        return await userActor.getAICreditsBalance();
      });

      if (result !== null && result !== undefined) {
        const unitsBalance = Number(result);
        return unitsBalance;
      }

      return 0;
    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to get units balance:', error);
      return 0;
    }
  }

  /**
   * Add units to user's balance (called after successful payment)
   */
  async addUnitsToBalance(userCanisterId: string, identity: Identity, units: number): Promise<boolean> {
    try {
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for adding units');
      }
      
      // Use existing refundAICredits method to add units
      const result = await this.retryOperation(async () => {
        return await userActor.refundAICredits(
          'payment_success', // projectId - using identifier for payment
          BigInt(units),     // amount - the units to add
          'Units purchase payment' // reason
        );
      });

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        console.log('✅ [UserCanisterService] Units added successfully:', units);
        
        // Clear balance cache to force refresh
        this.clearUserBalanceCache(userCanisterId);
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to add units:', error);
      return false;
    }
  }

  /**
   * Deduct units from user's balance (called during compute consumption)
   */
  async deductUnitsFromBalance(
    userCanisterId: string, 
    identity: Identity, 
    units: number,  // Exact credits to deduct
    projectId: string,
    operation: string
  ): Promise<boolean> {
    try {
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for deducting units');
      }
      
      // ✅ Convert credits to output tokens for claude-sonnet-4
      // Pricing: 15 credits per 1,000 output tokens
      // Formula: outputTokens = (units × 1000) / 15
      const outputTokensNeeded = Math.ceil((units * 1000) / 15);
      
      console.log(`📊 [UserCanisterService] Converting ${units} credits → ${outputTokensNeeded} output tokens`);
      
      // Use existing deductAICredits method with calculated tokens
      const result = await this.retryOperation(async () => {
        return await userActor.deductAICredits(
          projectId,
          BigInt(0),                    // inputTokens (not used)
          BigInt(outputTokensNeeded),   // ✅ Calculated output tokens
          'claude-sonnet-4',            // ✅ Use actual model for correct pricing
          operation                      // operation description
        );
      });

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        console.log('✅ [UserCanisterService] Units deducted successfully:', units);
        
        // Clear balance cache to force refresh
        this.clearUserBalanceCache(userCanisterId);
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to deduct units:', error);
      return false;
    }
  }

/**
 * Deduct units from balance based on Claude API usage
 * 
 * Economic Model:
 * - $1 = 10 units (storage layer)
 * - 1000 credits = 1T cycles (display layer)
 * 
 * This method:
 * 1. Calculates TRUE cost in USD from actual token usage
 * 2. Converts USD to units ($1 = 10 units)
 * 3. Uses token-hack to deduct from backend (which only has token-based deduction)
 */
async deductUnitsFromClaudeAPIUsage(
    userCanisterId: string,
    identity: Identity,
    projectId: string,
    inputTokens: number,
    outputTokens: number,
    model: string,
    operation: string
): Promise<DeductionResult> {
    try {
        console.log('💳 [UserCanisterService] Starting Claude API usage deduction...');
        console.log('📊 [UserCanisterService] Token usage:', {
            inputTokens: inputTokens.toLocaleString(),
            outputTokens: outputTokens.toLocaleString(),
            model: model,
            projectId: projectId
        });

        await this.initializeUserActor(userCanisterId, identity);
        
        const userActor = this.userActors.get(userCanisterId);
        if (!userActor) {
            throw new Error('Failed to initialize user canister actor for deduction');
        }

        // Get current balance before deduction
        const currentBalance = await this.retryOperation(async () => {
            return await userActor.getAICreditsBalance();
        });
        const currentBalanceNum = Number(currentBalance || 0);
        
        console.log('💰 [UserCanisterService] Current balance before deduction:', currentBalanceNum, 'units');

        // Normalize model name to match our pricing table
        const normalizedModel = this.normalizeModelName(model);
        console.log('📊 [UserCanisterService] Normalized model:', model, '→', normalizedModel);

        // ✅ STEP 1: Calculate TRUE cost in USD from REAL token usage
        const pricing = this.getModelPricing(normalizedModel);
        const inputCost = (inputTokens / 1_000_000) * pricing.inputCostPerMillion;
        const outputCost = (outputTokens / 1_000_000) * pricing.outputCostPerMillion;
        const totalCostUSD = inputCost + outputCost;
        
        // ✅ STEP 2: Convert USD to units ($1 = 10 units)
        const unitsToDeduct = totalCostUSD * 10;
        
        console.log('💰 [UserCanisterService] Cost calculation:', {
            model: normalizedModel,
            inputTokens: inputTokens.toLocaleString(),
            outputTokens: outputTokens.toLocaleString(),
            inputCost: `$${inputCost.toFixed(6)}`,
            outputCost: `$${outputCost.toFixed(6)}`,
            totalCostUSD: `$${totalCostUSD.toFixed(6)}`,
            unitsToDeduct: unitsToDeduct.toFixed(2),
            formula: `$${totalCostUSD.toFixed(6)} × 10 = ${unitsToDeduct.toFixed(2)} units`
        });
        
        console.log('💡 [UserCanisterService] Economic model: $1 = 10 units, 1000 credits = 1T cycles');
        
        // Check if user has sufficient balance
        if (currentBalanceNum < unitsToDeduct) {
            const shortfall = unitsToDeduct - currentBalanceNum;
            console.warn('⚠️ [UserCanisterService] Insufficient balance:', {
                needed: unitsToDeduct.toFixed(2),
                available: currentBalanceNum,
                shortfall: shortfall.toFixed(2)
            });
        }

        // ✅ STEP 3: Convert units to fake output tokens using Sonnet pricing (15 credits per 1K)
        // Backend only has token-based deduction, so we convert units to equivalent fake tokens
        const outputTokensNeeded = Math.ceil((unitsToDeduct * 1000) / 15);
        
        console.log('🔧 [UserCanisterService] Converting units to fake tokens (backend hack):', {
            unitsToDeduct: unitsToDeduct.toFixed(2),
            fakeOutputTokens: outputTokensNeeded.toLocaleString(),
            formula: `(${unitsToDeduct.toFixed(2)} × 1000) ÷ 15 = ${outputTokensNeeded}`,
            reasoning: 'Backend only has deductAICredits (token-based), so we convert units to tokens'
        });
        
        console.log('⚠️ [UserCanisterService] Backend deduction strategy:');
        console.log('   - Input tokens: 0 (we do NOT pass real token counts)');
        console.log('   - Output tokens:', outputTokensNeeded, '(fake tokens representing', unitsToDeduct.toFixed(2), 'units)');
        console.log('   - Model: claude-sonnet-4 (fixed for consistent 15 credits/1K pricing)');
        console.log('   - Backend will calculate: (0 × 15)/1000 + (' + outputTokensNeeded + ' × 15)/1000 =', unitsToDeduct.toFixed(2), 'units ✅');

        // ✅ STEP 4: Call backend with ZERO input tokens and ALL deduction as fake output tokens
        const result = await this.retryOperation(async () => {
            return await userActor.deductAICredits(
                projectId,
                BigInt(0),                     // ✅ ZERO input tokens (do NOT pass real tokens!)
                BigInt(outputTokensNeeded),    // ✅ ALL deduction as fake output tokens
                'claude-sonnet-4',             // ✅ Fixed model for consistent 15/1K pricing
                `Claude API usage: ${operation} (actual model: ${normalizedModel}, ${inputTokens.toLocaleString()} input + ${outputTokens.toLocaleString()} output tokens)`
            );
        });

        console.log('📤 [UserCanisterService] Backend deductAICredits response:', result);

        // Check if deduction was successful
        if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
            const remainingBalance = Number('ok' in result ? result.ok : result.Ok);
            const actualDeducted = currentBalanceNum - remainingBalance;
            
            console.log('✅ [UserCanisterService] Deduction successful!');
            console.log('💰 [UserCanisterService] Balance summary:', {
                balanceBefore: currentBalanceNum.toFixed(2) + ' units',
                unitsDeducted: actualDeducted.toFixed(2) + ' units',
                expectedDeduction: unitsToDeduct.toFixed(2) + ' units',
                balanceAfter: remainingBalance.toFixed(2) + ' units',
                variance: Math.abs(actualDeducted - unitsToDeduct).toFixed(2) + ' units',
                dollarCost: '$' + totalCostUSD.toFixed(6)
            });
            
            // Verify deduction accuracy
            if (Math.abs(actualDeducted - unitsToDeduct) > 0.5) {
                console.warn('⚠️ [UserCanisterService] Deduction variance detected:', {
                    expected: unitsToDeduct.toFixed(2),
                    actual: actualDeducted.toFixed(2),
                    difference: (actualDeducted - unitsToDeduct).toFixed(2)
                });
            }

            // Clear cache to force refresh
            this.clearUserBalanceCache(userCanisterId);

            return {
                success: true,
                unitsDeducted: unitsToDeduct,
                dollarCost: totalCostUSD,
                remainingBalance: remainingBalance
            };
        }

        // Handle error response
        const errorMsg = result && typeof result === 'object' && 'err' in result 
            ? result.err 
            : 'Unknown error from backend';
            
        console.error('❌ [UserCanisterService] Failed to deduct units:', errorMsg);
        console.error('   Context:', {
            userCanisterId: userCanisterId.substring(0, 10) + '...',
            projectId,
            attemptedDeduction: unitsToDeduct.toFixed(2) + ' units',
            currentBalance: currentBalanceNum.toFixed(2) + ' units'
        });
        
        return {
            success: false,
            error: errorMsg,
            unitsDeducted: 0,
            dollarCost: totalCostUSD,
            remainingBalance: currentBalanceNum
        };

    } catch (error) {
        console.error('❌ [UserCanisterService] Error in deductUnitsFromClaudeAPIUsage:', error);
        console.error('   Details:', {
            userCanisterId: userCanisterId.substring(0, 10) + '...',
            projectId,
            inputTokens,
            outputTokens,
            model,
            operation
        });
        
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            unitsDeducted: 0,
            dollarCost: 0,
            remainingBalance: 0
        };
    }
}

  /**
   * Get pricing information for a specific model
   */
  private getModelPricing(model: string): {
      inputCostPerMillion: number;
      outputCostPerMillion: number;
  } {
      // Model pricing in USD per 1 million tokens
      const pricingTable: { [key: string]: { inputCostPerMillion: number; outputCostPerMillion: number } } = {
          'claude-opus-4': {
              inputCostPerMillion: 15.00,
              outputCostPerMillion: 75.00
          },
          'claude-sonnet-4': {
              inputCostPerMillion: 3.00,
              outputCostPerMillion: 15.00
          },
          'claude-haiku-3.5': {
              inputCostPerMillion: 1.00,
              outputCostPerMillion: 5.00
          },
          'claude-sonnet-3.5': {
              inputCostPerMillion: 3.00,
              outputCostPerMillion: 15.00
          },
          'claude-haiku-4': {
              inputCostPerMillion: 1.00,
              outputCostPerMillion: 5.00
          }
      };

      // Return pricing for the model, or default to Sonnet if not found
      const pricing = pricingTable[model] || pricingTable['claude-sonnet-4'];
      
      console.log('💰 [UserCanisterService] Model pricing:', {
          model,
          inputCost: `$${pricing.inputCostPerMillion}/1M tokens`,
          outputCost: `$${pricing.outputCostPerMillion}/1M tokens`
      });
      
      return pricing;
  }

  /**
   * Normalize model name to match pricing table keys
   */
  private normalizeModelName(model: string): string {
      // Remove version suffixes and dates
      const normalized = model
          .toLowerCase()
          .replace(/-(v?\d+\.?\d*|2024\d{4}|2025\d{4})$/, '') // Remove version numbers and dates
          .trim();
      
      // Map common variations to standard names
      const modelMap: { [key: string]: string } = {
          'opus-4': 'claude-opus-4',
          'sonnet-4': 'claude-sonnet-4',
          'haiku-4': 'claude-haiku-4',
          'sonnet-3.5': 'claude-sonnet-3.5',
          'haiku-3.5': 'claude-haiku-3.5',
          'claude-opus-4-20250514': 'claude-opus-4',
          'claude-sonnet-4-20250514': 'claude-sonnet-4',
          'claude-haiku-4-20250514': 'claude-haiku-4'
      };
      
      return modelMap[normalized] || normalized;
  }

  /**
   * Calculate dollar cost based on Anthropic's real pricing
   * This is used for logging and verification purposes
   */
  private calculateAnthropicDollarCost(
    inputTokens: number, 
    outputTokens: number, 
    model: string
  ): number {
    const pricing = this.getAnthropicPricing(model);
    
    // Calculate cost: (tokens / 1,000,000) × price_per_million
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillion;
    
    return inputCost + outputCost;
  }

  /**
   * Get Anthropic's official pricing per 1M tokens
   * Reference: https://www.anthropic.com/api
   */
  private getAnthropicPricing(model: string): { 
    inputPricePerMillion: number; 
    outputPricePerMillion: number 
  } {
    switch (model) {
      case 'claude-sonnet-4':
        return { 
          inputPricePerMillion: 3.00,   // $3.00 per 1M input tokens
          outputPricePerMillion: 15.00  // $15.00 per 1M output tokens
        };
      case 'claude-opus-4':
        return { 
          inputPricePerMillion: 15.00,  // $15.00 per 1M input tokens
          outputPricePerMillion: 75.00  // $75.00 per 1M output tokens
        };
      case 'claude-haiku-3.5':
        return { 
          inputPricePerMillion: 0.80,   // $0.80 per 1M input tokens
          outputPricePerMillion: 4.00   // $4.00 per 1M output tokens
        };
      default:
        // Default to Sonnet pricing
        return { 
          inputPricePerMillion: 3.00, 
          outputPricePerMillion: 15.00 
        };
    }
  }


  /**
   * Set user units balance to a specific amount by deducting excess
   * Used for zeroing out auto-allocated credits in subscription setup
   */
  async setUnitsBalance(userCanisterId: string, identity: Identity, targetBalance: number): Promise<boolean> {
      try {
          console.log(`🔧 [UserCanisterService] Setting units balance to ${targetBalance}`);
          
          await this.initializeUserActor(userCanisterId, identity);
          
          const userActor = this.userActors.get(userCanisterId);
          if (!userActor) {
              throw new Error('Failed to initialize user canister actor');
          }
          
          // Get current balance
          const currentBalance = await this.retryOperation(async () => {
              return await userActor.getAICreditsBalance();
          });
          
          const currentBalanceNum = Number(currentBalance || 0);
          console.log(`💰 [UserCanisterService] Current balance: ${currentBalanceNum}, target: ${targetBalance}`);
          
          // Check if already at target
          if (currentBalanceNum === targetBalance) {
              console.log('✅ [UserCanisterService] Balance already at target');
              return true;
          }
          
          // ✅ Handle BOTH increase and decrease
          if (currentBalanceNum < targetBalance) {
              // Need to INCREASE balance
              const unitsToAdd = targetBalance - currentBalanceNum;
              console.log(`📈 [UserCanisterService] Increasing balance by ${unitsToAdd} units`);
              
              return await this.addUnitsToBalance(userCanisterId, identity, unitsToAdd);
              
          } else {
              // Need to DECREASE balance
              const unitsToDeduct = currentBalanceNum - targetBalance;
              console.log(`📉 [UserCanisterService] Decreasing balance by ${unitsToDeduct} units`);
              
              // ✅ FIXED: Account for 20% platform commission that backend adds
              // Backend formula: totalCost = baseCost * 1.2 (base + 20% commission)
              // For Sonnet output tokens: baseCost = (outputTokens * 15) / 1000
              // So: totalCost = (outputTokens * 15 / 1000) * 1.2 = (outputTokens * 18) / 1000
              // We want: totalCost = unitsToDeduct
              // Therefore: outputTokens = (unitsToDeduct * 1000) / 18
              const outputTokensNeeded = Math.ceil((unitsToDeduct * 1000) / 18);
              
              console.log(`🔧 [UserCanisterService] Converting ${unitsToDeduct} units → ${outputTokensNeeded} output tokens (with 20% commission)`);
              
              const result = await this.retryOperation(async () => {
                  return await userActor.deductAICredits(
                      'dev_balance_reset', // Valid project ID format
                      BigInt(0),           // No input tokens
                      BigInt(outputTokensNeeded), // Output tokens to achieve desired deduction
                      'claude-sonnet-4',   // Model (affects pricing)
                      `Dev reset: ${currentBalanceNum} → ${targetBalance} units` // Operation description
                  );
              });
              
              if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
                  const newBalance = Number('ok' in result ? result.ok : result.Ok);
                  
                  console.log(`✅ [UserCanisterService] Balance adjusted: ${currentBalanceNum} → ${newBalance} (target: ${targetBalance})`);
                  
                  this.clearUserBalanceCache(userCanisterId);
                  
                  // Allow small margin of error due to rounding
                  return Math.abs(newBalance - targetBalance) <= 2;
              }
              
              return false;
          }
          
      } catch (error) {
          console.error('❌ [UserCanisterService] Error setting balance:', error);
          return false;
      }
  }

  /**
   * Get cached balance if valid
   */
  private getUserBalanceFromCache(userCanisterId: string): number | null {
    const cached = this.userBalanceCache.get(userCanisterId);
    
    if (!cached) {
      return null;
    }
    
    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      // Cache expired, remove it
      this.userBalanceCache.delete(userCanisterId);
      return null;
    }
    
    console.log(`💰 [UserCanisterService] Cache hit for balance: ${userCanisterId}`);
    return cached.balance;
  }

  /**
   * Store balance in cache with timestamp
   */
  private setUserBalanceCache(userCanisterId: string, balance: number): void {
    // Cleanup old entries if cache is getting too large
    if (this.userBalanceCache.size >= this.MAX_CACHE_ENTRIES) {
      this.cleanupExpiredBalanceCache();
    }
    
    this.userBalanceCache.set(userCanisterId, {
      balance,
      timestamp: Date.now(),
      ttl: this.BALANCE_CACHE_TTL
    });
    
    console.log(`💰 [UserCanisterService] Cached balance for: ${userCanisterId} = ${balance}`);
  }

  /**
   * Clear balance cache for specific user
   */
  private clearUserBalanceCache(userCanisterId: string): void {
    const wasPresent = this.userBalanceCache.delete(userCanisterId);
    if (wasPresent) {
      console.log(`🧹 [UserCanisterService] Cleared balance cache for: ${userCanisterId}`);
    }
  }

  /**
   * Check if cached balance is still valid
   */
  private isBalanceCacheValid(userCanisterId: string): boolean {
    const cached = this.userBalanceCache.get(userCanisterId);
    
    if (!cached) {
      return false;
    }
    
    const now = Date.now();
    return (now - cached.timestamp) <= cached.ttl;
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupExpiredBalanceCache(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [userCanisterId, cached] of this.userBalanceCache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.userBalanceCache.delete(userCanisterId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 [UserCanisterService] Cleaned up ${cleanedCount} expired balance cache entries`);
    }
  }

  /**
   * Clear all balance caches
   */
  public clearAllBalanceCaches(): void {
    const size = this.userBalanceCache.size;
    this.userBalanceCache.clear();
    console.log(`🧹 [UserCanisterService] Cleared all ${size} balance cache entries`);
  }

  /**
   * Get cache statistics for debugging
   */
  public getBalanceCacheStats(): { size: number; validEntries: number; expiredEntries: number } {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    
    for (const cached of this.userBalanceCache.values()) {
      if (now - cached.timestamp <= cached.ttl) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }
    
    return {
      size: this.userBalanceCache.size,
      validEntries,
      expiredEntries
    };
  }

  /**
   * FIXED: Get user wallet information - NOW USES USER ACTOR
   */
  async getUserWalletId(userCanisterId: string, identity: Identity): Promise<UserWalletInfo | null> {
    try {
      console.log('🏦 [UserCanisterService] FIXED: Fetching user wallet information from USER canister:', userCanisterId);
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for wallet');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] FIXED: Calling getUserWalletId on USER actor...');
        return await userActor.getUserWalletId();
      });

      console.log('📤 [UserCanisterService] FIXED: getUserWalletId raw result from USER canister:', result);

      if (result && Array.isArray(result) && result.length > 0) {
        const walletData = result[0];
        console.log('🏦 [UserCanisterService] FIXED: Found wallet data from USER canister:', walletData);
        
        const walletInfo: UserWalletInfo = {
          principal: walletData.principal || '',
          subaccount: walletData.subaccount || '',
          accountIdentifier: walletData.accountIdentifier || ''
        };

        console.log('✅ [UserCanisterService] FIXED: Converted wallet info from USER canister:', {
          hasPrincipal: !!walletInfo.principal,
          hasSubaccount: !!walletInfo.subaccount,
          hasAccountId: !!walletInfo.accountIdentifier
        });

        return walletInfo;
      }

      console.log('ℹ️ [UserCanisterService] FIXED: No wallet found for user in USER canister');
      return null;

    } catch (error) {
      console.error('❌ [UserCanisterService] FIXED: Failed to get wallet info from USER canister:', error);
      return null;
    }
  }

  /**
   * FIXED: Create user wallet - NOW USES USER ACTOR
   */
  async createUserWallet(userCanisterId: string, identity: Identity): Promise<string | null> {
    try {
      console.log('🏗️ [UserCanisterService] FIXED: Creating user wallet in USER canister:', userCanisterId);
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for wallet creation');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] FIXED: Calling createUserWallet on USER actor...');
        return await userActor.createUserWallet();
      });

      console.log('📤 [UserCanisterService] FIXED: createUserWallet raw result from USER canister:', result);

      if (typeof result === 'string' && result.length > 0) {
        console.log('✅ [UserCanisterService] FIXED: Wallet created successfully in USER canister:', result);
        return result;
      }

      // Handle result object format
      if (result && typeof result === 'object') {
        if ('Ok' in result || 'ok' in result) {
          const walletId = result.Ok || result.ok;
          console.log('✅ [UserCanisterService] FIXED: Wallet created from result object in USER canister:', walletId);
          return walletId;
        } else if ('Err' in result || 'err' in result) {
          const error = result.Err || result.err;
          console.error('❌ [UserCanisterService] FIXED: Wallet creation failed in USER canister:', error);
          return null;
        }
      }

      console.warn('⚠️ [UserCanisterService] FIXED: Unexpected wallet creation response format from USER canister');
      return null;

    } catch (error) {
      console.error('❌ [UserCanisterService] FIXED: Failed to create wallet in USER canister:', error);
      return null;
    }
  }

  // NEW: ULTRA-OPTIMIZED getUserCanisters with MASSIVE PARALLEL METADATA PROCESSING
  async getUserCanisters(userCanisterId: string, identity: Identity): Promise<UserCanisterWithMetadata[]> {
    try {
      console.log('📋 [UserCanisterService] ULTRA-OPTIMIZED: Getting user canisters WITH PARALLEL METADATA from USER canister:', userCanisterId);
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }
      
      const startTime = Date.now();
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] ULTRA-OPTIMIZED: Calling getUserCanisters on USER actor...');
        return await userActor.getUserCanisters();
      });

      const canisterLoadTime = Date.now() - startTime;
      console.log(`📤 [UserCanisterService] ULTRA-OPTIMIZED: getUserCanisters result from USER canister loaded in ${canisterLoadTime}ms:`, result?.length || 0, 'canisters');

      if (Array.isArray(result)) {
        console.log(`📋 [UserCanisterService] ULTRA-OPTIMIZED: Found ${result.length} user canisters`);

        if (result.length === 0) {
          return [];
        }

        // ULTRA-PARALLEL: Fetch metadata for ALL canisters simultaneously
        const metadataStartTime = Date.now();
        console.log(`🚀 [UserCanisterService] ULTRA-OPTIMIZED: Starting MASSIVE PARALLEL metadata processing for ${result.length} canisters...`);
        
        const canistersWithMetadata = await this.fetchCanisterMetadataParallel(result, userActor);
        
        const metadataTime = Date.now() - metadataStartTime;
        const totalTime = Date.now() - startTime;
        
        console.log(`🎉 [UserCanisterService] ULTRA-OPTIMIZED: COMPLETE parallel processing finished in ${totalTime}ms:`);
        console.log(`   📊 Total canisters: ${result.length}`);
        console.log(`   ⚡ Canister load time: ${canisterLoadTime}ms`);
        console.log(`   🚀 Metadata processing time: ${metadataTime}ms`);
        console.log(`   📈 Average metadata per canister: ${Math.round(metadataTime / result.length)}ms`);
        console.log(`   💥 PERFORMANCE IMPROVEMENT: ~${Math.round((result.length * 300) / metadataTime)}x faster than sequential!`);

        return canistersWithMetadata;
      }

      console.log('⚠️ [UserCanisterService] ULTRA-OPTIMIZED: No canisters found or invalid response');
      return [];

    } catch (error) {
      console.error('❌ [UserCanisterService] ULTRA-OPTIMIZED: Failed to get user canisters with parallel metadata:', error);
      return [];
    }
  }

  async debugCanisterMetadata(userCanisterId: string, identity: Identity): Promise<void> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    
    if (!userActor) {
      throw new Error('User actor not initialized');
    }
    
    console.log('=== DEBUG: ALL USER CANISTERS WITH METADATA ===');
    
    try {
      // Get all canisters
      const canisters = await userActor.getUserCanisters();
      console.log(`Found ${canisters.length} total canisters`);
      
      let canistersWithMetadata = 0;
      let canistersWithoutMetadata = 0;
      
      for (let i = 0; i < canisters.length; i++) {
        const canister = canisters[i];
        console.log(`\n--- Canister ${i + 1} ---`);
        
        const principalString = this.convertPrincipalToCanisterId(canister.principal);
        
        console.log(`Principal: ${principalString}`);
        console.log(`Name: ${canister.name}`);  
        console.log(`Type: ${canister.canisterType}`);
        
        try {
          const metadataResult = await userActor.getCanisterMetadata(canister.principal);
          
          console.log('Raw metadata result:', metadataResult);
          console.log('Is array:', Array.isArray(metadataResult));
          console.log('Length if array:', Array.isArray(metadataResult) ? metadataResult.length : 'N/A');
          
          // Handle Motoko optional properly - it becomes an array in JS
          if (Array.isArray(metadataResult) && metadataResult.length > 0) {
            const metadata = metadataResult[0];
            canistersWithMetadata++;
            
            console.log('✅ Metadata FOUND:');
            console.log(`   canisterType: "${metadata.canisterType}"`);
            console.log(`   name: "${metadata.name}"`);
            console.log(`   project:`, metadata.project);
            console.log(`   subType:`, metadata.subType);
            console.log(`   didInterface:`, metadata.didInterface);
            console.log(`   stableInterface:`, metadata.stableInterface);
            
            // Check if project field has a value
            if (Array.isArray(metadata.project) && metadata.project.length > 0) {
              console.log(`   🎯 PROJECT VALUE: "${metadata.project[0]}"`);
            } else {
              console.log(`   ❌ Project field is empty/undefined`);
            }
            
          } else {
            canistersWithoutMetadata++;
            console.log('❌ NO METADATA - empty array or null result');
          }
          
        } catch (metadataError) {
          canistersWithoutMetadata++;
          console.log('💥 ERROR getting metadata:', metadataError);
        }
      }
      
      console.log('\n=== SUMMARY ===');
      console.log(`Total canisters: ${canisters.length}`);
      console.log(`With metadata: ${canistersWithMetadata}`);
      console.log(`Without metadata: ${canistersWithoutMetadata}`);
      console.log('=== END DEBUG ===');
      
    } catch (error) {
      console.error('💥 Failed to debug canister metadata:', error);
      throw error;
    }
  }

  // NEW: Server pair backend methods
  async getProjectServerPairs(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<ServerPairResult> {
    try {
      console.log('📋 [UserCanisterService] Getting server pairs for project from backend:', projectId);
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling getProjectServerPairs on USER actor...');
        return await userActor.getProjectServerPairs(projectId);
      });

      console.log('📤 [UserCanisterService] getProjectServerPairs result from backend:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        const serverPairs = result.ok || result.Ok;
        console.log(`✅ [UserCanisterService] Found ${serverPairs.length} server pairs in backend for project:`, projectId);
        return {
          success: true,
          serverPairs: serverPairs
        };
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.log('⚠️ [UserCanisterService] Server pairs query error from backend:', error);
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      console.log('⚠️ [UserCanisterService] No server pairs found in backend for project:', projectId);
      return {
        success: true,
        serverPairs: []
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to get server pairs from backend:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async createServerPair(
    projectId: string,
    name: string,
    frontendCanisterId: string,
    backendCanisterId: string,
    creditsAllocated: number,
    userCanisterId: string,
    identity: Identity
  ): Promise<ServerPairResult> {
    try {
      console.log('🏗️ [UserCanisterService] Creating server pair in backend:', {
        projectId,
        name,
        frontendCanisterId,
        backendCanisterId,
        creditsAllocated
      });
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling createServerPair on USER actor...');
        return await userActor.createServerPair(
          projectId,
          name,
          Principal.fromText(frontendCanisterId),
          Principal.fromText(backendCanisterId),
          creditsAllocated
        );
      });

      console.log('📤 [UserCanisterService] createServerPair result from backend:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        const pairId = result.ok || result.Ok;
        console.log('✅ [UserCanisterService] Server pair created successfully in backend:', pairId);
        return {
          success: true,
          pairId: pairId
        };
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.error('❌ [UserCanisterService] Server pair creation failed in backend:', error);
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      return {
        success: false,
        error: 'Invalid response from server pair creation'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to create server pair in backend:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async moveServerPairToProject(
    pairId: string,
    fromProjectId: string,
    toProjectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<ServerPairResult> {
    try {
      console.log('🔄 [UserCanisterService] Moving server pair between projects:', {
        pairId,
        fromProjectId,
        toProjectId
      });
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling moveServerPairToProject on USER actor...');
        return await userActor.moveServerPairToProject(pairId, fromProjectId, toProjectId);
      });

      console.log('📤 [UserCanisterService] moveServerPairToProject result from backend:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        console.log('✅ [UserCanisterService] Server pair moved successfully:', pairId);
        return {
          success: true
        };
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.error('❌ [UserCanisterService] Server pair move failed:', error);
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      console.error('❌ [UserCanisterService] Unexpected response from moveServerPairToProject:', result);
      return {
        success: false,
        error: 'Invalid response from server pair move operation'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to move server pair:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async deleteServerPair(
    pairId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<ServerPairResult> {
    try {
      console.log('🗑️ [UserCanisterService] Deleting server pair from backend:', pairId);
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling deleteServerPair on USER actor...');
        return await userActor.deleteServerPair(pairId);
      });

      console.log('📤 [UserCanisterService] deleteServerPair result from backend:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        console.log('✅ [UserCanisterService] Server pair deleted successfully from backend:', pairId);
        return {
          success: true
        };
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.error('❌ [UserCanisterService] Server pair deletion failed in backend:', error);
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      return {
        success: false,
        error: 'Invalid response from server pair deletion'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to delete server pair in backend:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // ==================== DEPLOYED AGENTS MANAGEMENT ====================

  /**
   * Add a deployed agent to a project
   */
  async addDeployedAgent(
    projectId: string,
    agent: DeployedAgent,
    userCanisterId: string,
    identity: Identity
  ): Promise<DeployedAgentResult> {
    try {
      console.log('🤖 [UserCanisterService] Adding deployed agent to project:', {
        projectId,
        agentId: agent.id,
        agentName: agent.name
      });

      await this.initializeUserActor(userCanisterId, identity);

      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }

      // Convert agent to backend format
      const backendAgent = {
        id: agent.id,
        name: agent.name,
        description: agent.description ? [agent.description] : [],
        backendCanisterId: agent.backendCanisterId ? [Principal.fromText(agent.backendCanisterId)] : [],
        frontendCanisterId: agent.frontendCanisterId ? [Principal.fromText(agent.frontendCanisterId)] : [],
        status: agent.status,
        agentType: agent.agentType ? [agent.agentType] : [],
        createdAt: BigInt(agent.createdAt),
        lastDeployedAt: agent.lastDeployedAt ? [BigInt(agent.lastDeployedAt)] : [],
      };

      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling addDeployedAgentToProject on USER actor...');
        return await userActor.addDeployedAgentToProject(projectId, backendAgent);
      });

      console.log('📤 [UserCanisterService] addDeployedAgent result from backend:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        console.log('✅ [UserCanisterService] Deployed agent added successfully:', agent.id);
        return { success: true };
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.error('❌ [UserCanisterService] Failed to add deployed agent:', error);
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      return {
        success: false,
        error: 'Invalid response from addDeployedAgent'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to add deployed agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Remove a deployed agent from a project
   */
  async removeDeployedAgent(
    projectId: string,
    agentId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<DeployedAgentResult> {
    try {
      console.log('🗑️ [UserCanisterService] Removing deployed agent from project:', {
        projectId,
        agentId
      });

      await this.initializeUserActor(userCanisterId, identity);

      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }

      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling removeDeployedAgentFromProject on USER actor...');
        return await userActor.removeDeployedAgentFromProject(projectId, agentId);
      });

      console.log('📤 [UserCanisterService] removeDeployedAgent result from backend:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        console.log('✅ [UserCanisterService] Deployed agent removed successfully:', agentId);
        return { success: true };
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.error('❌ [UserCanisterService] Failed to remove deployed agent:', error);
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      return {
        success: false,
        error: 'Invalid response from removeDeployedAgent'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to remove deployed agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get all deployed agents for a project
   */
  async getProjectDeployedAgents(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<DeployedAgentResult> {
    try {
      console.log('📋 [UserCanisterService] Getting deployed agents for project:', projectId);

      await this.initializeUserActor(userCanisterId, identity);

      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }

      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling getProjectDeployedAgents on USER actor...');
        return await userActor.getProjectDeployedAgents(projectId);
      });

      console.log('📤 [UserCanisterService] getProjectDeployedAgents result from backend:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        const agents = result.ok || result.Ok;
        console.log('✅ [UserCanisterService] Found deployed agents:', agents.length);

        // Convert backend agents to frontend format
        const frontendAgents: DeployedAgent[] = agents.map((agent: any) => ({
          id: agent.id,
          name: agent.name,
          description: agent.description && agent.description.length > 0 ? agent.description[0] : undefined,
          backendCanisterId: agent.backendCanisterId && agent.backendCanisterId.length > 0 
            ? agent.backendCanisterId[0].toText() 
            : undefined,
          frontendCanisterId: agent.frontendCanisterId && agent.frontendCanisterId.length > 0 
            ? agent.frontendCanisterId[0].toText() 
            : undefined,
          status: agent.status as 'active' | 'inactive' | 'error',
          agentType: agent.agentType && agent.agentType.length > 0 
            ? agent.agentType[0] as 'workflow' | 'standalone' | 'assistant' | 'agency'
            : undefined,
          createdAt: Number(agent.createdAt),
          lastDeployedAt: agent.lastDeployedAt && agent.lastDeployedAt.length > 0 
            ? Number(agent.lastDeployedAt[0]) 
            : undefined,
        }));

        return {
          success: true,
          agents: frontendAgents
        };
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.error('❌ [UserCanisterService] Failed to get deployed agents:', error);
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      return {
        success: false,
        error: 'Invalid response from getProjectDeployedAgents'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to get deployed agents:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Update a deployed agent in a project
   */
  async updateDeployedAgent(
    projectId: string,
    agent: DeployedAgent,
    userCanisterId: string,
    identity: Identity
  ): Promise<DeployedAgentResult> {
    try {
      console.log('🔄 [UserCanisterService] Updating deployed agent in project:', {
        projectId,
        agentId: agent.id,
        agentName: agent.name
      });

      await this.initializeUserActor(userCanisterId, identity);

      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }

      // Convert agent to backend format
      const backendAgent = {
        id: agent.id,
        name: agent.name,
        description: agent.description ? [agent.description] : [],
        backendCanisterId: agent.backendCanisterId ? [Principal.fromText(agent.backendCanisterId)] : [],
        frontendCanisterId: agent.frontendCanisterId ? [Principal.fromText(agent.frontendCanisterId)] : [],
        status: agent.status,
        agentType: agent.agentType ? [agent.agentType] : [],
        createdAt: BigInt(agent.createdAt),
        lastDeployedAt: agent.lastDeployedAt ? [BigInt(agent.lastDeployedAt)] : [],
      };

      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling updateDeployedAgentInProject on USER actor...');
        return await userActor.updateDeployedAgentInProject(projectId, backendAgent);
      });

      console.log('📤 [UserCanisterService] updateDeployedAgent result from backend:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        console.log('✅ [UserCanisterService] Deployed agent updated successfully:', agent.id);
        return { success: true };
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.error('❌ [UserCanisterService] Failed to update deployed agent:', error);
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      return {
        success: false,
        error: 'Invalid response from updateDeployedAgent'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to update deployed agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // ==================== USER CONTEXT MANAGEMENT ====================

  /**
   * Generic helper for context CRUD operations
   */
  private async contextOperation<T>(
    operation: string,
    operationFn: () => Promise<any>,
    successMessage: string
  ): Promise<ContextResult<T>> {
    try {
      const result = await this.retryOperation(operationFn);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        const data = result.ok || result.Ok;
        console.log(`✅ [UserCanisterService] ${successMessage}`);
        return { success: true, data };
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.error(`❌ [UserCanisterService] ${operation} failed:`, error);
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      return {
        success: false,
        error: `Invalid response from ${operation}`
      };
    } catch (error) {
      console.error(`❌ [UserCanisterService] ${operation} error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // -------- REFERENCE ITEMS --------

  async addReferenceItem(
    item: ReferenceItem,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendItem = {
      id: item.id,
      title: item.title,
      content: item.content,
      category: item.category ? [item.category] : [],
      createdAt: BigInt(item.createdAt),
    };

    return this.contextOperation(
      'addReferenceItem',
      () => userActor.addReferenceItem(backendItem),
      'Reference item added'
    );
  }

  async updateReferenceItem(
    item: ReferenceItem,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendItem = {
      id: item.id,
      title: item.title,
      content: item.content,
      category: item.category ? [item.category] : [],
      createdAt: BigInt(item.createdAt),
    };

    return this.contextOperation(
      'updateReferenceItem',
      () => userActor.updateReferenceItem(backendItem),
      'Reference item updated'
    );
  }

  async deleteReferenceItem(
    id: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    return this.contextOperation(
      'deleteReferenceItem',
      () => userActor.deleteReferenceItem(id),
      'Reference item deleted'
    );
  }

  async getReferenceItems(
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<ReferenceItem[]>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const result = await this.contextOperation<any[]>(
      'getReferenceItems',
      () => userActor.getReferenceItems(),
      'Retrieved reference items'
    );

    if (result.success && result.data) {
      const items: ReferenceItem[] = result.data.map((item: any) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        category: item.category && item.category.length > 0 ? item.category[0] : undefined,
        createdAt: Number(item.createdAt),
      }));
      return { success: true, data: items };
    }

    return result;
  }

  // -------- CODE RULES --------

  async addCodeRule(
    rule: CodeRule,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendRule = {
      id: rule.id,
      title: rule.title,
      rule: rule.rule,
      examples: rule.examples,
      createdAt: BigInt(rule.createdAt),
    };

    return this.contextOperation(
      'addCodeRule',
      () => userActor.addCodeRule(backendRule),
      'Code rule added'
    );
  }

  async updateCodeRule(
    rule: CodeRule,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendRule = {
      id: rule.id,
      title: rule.title,
      rule: rule.rule,
      examples: rule.examples,
      createdAt: BigInt(rule.createdAt),
    };

    return this.contextOperation(
      'updateCodeRule',
      () => userActor.updateCodeRule(backendRule),
      'Code rule updated'
    );
  }

  async deleteCodeRule(
    id: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    return this.contextOperation(
      'deleteCodeRule',
      () => userActor.deleteCodeRule(id),
      'Code rule deleted'
    );
  }

  async getCodeRules(
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<CodeRule[]>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const result = await this.contextOperation<any[]>(
      'getCodeRules',
      () => userActor.getCodeRules(),
      'Retrieved code rules'
    );

    if (result.success && result.data) {
      const rules: CodeRule[] = result.data.map((rule: any) => ({
        id: rule.id,
        title: rule.title,
        rule: rule.rule,
        examples: rule.examples,
        createdAt: Number(rule.createdAt),
      }));
      return { success: true, data: rules };
    }

    return result;
  }

  // -------- COLOR PALETTES --------

  async addColorPalette(
    palette: ColorPalette,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendPalette = {
      id: palette.id,
      name: palette.name,
      colors: palette.colors,
      createdAt: BigInt(palette.createdAt),
    };

    return this.contextOperation(
      'addColorPalette',
      () => userActor.addColorPalette(backendPalette),
      'Color palette added'
    );
  }

  async updateColorPalette(
    palette: ColorPalette,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendPalette = {
      id: palette.id,
      name: palette.name,
      colors: palette.colors,
      createdAt: BigInt(palette.createdAt),
    };

    return this.contextOperation(
      'updateColorPalette',
      () => userActor.updateColorPalette(backendPalette),
      'Color palette updated'
    );
  }

  async deleteColorPalette(
    id: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    return this.contextOperation(
      'deleteColorPalette',
      () => userActor.deleteColorPalette(id),
      'Color palette deleted'
    );
  }

  async getColorPalettes(
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<ColorPalette[]>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const result = await this.contextOperation<any[]>(
      'getColorPalettes',
      () => userActor.getColorPalettes(),
      'Retrieved color palettes'
    );

    if (result.success && result.data) {
      const palettes: ColorPalette[] = result.data.map((palette: any) => ({
        id: palette.id,
        name: palette.name,
        colors: palette.colors,
        createdAt: Number(palette.createdAt),
      }));
      return { success: true, data: palettes };
    }

    return result;
  }

  // -------- DESIGN INSPIRATIONS --------

  async addDesignInspiration(
    inspiration: DesignInspiration,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendInspiration = {
      id: inspiration.id,
      title: inspiration.title,
      url: inspiration.url ? [inspiration.url] : [],
      imageUrl: inspiration.imageUrl ? [inspiration.imageUrl] : [],
      notes: inspiration.notes ? [inspiration.notes] : [],
      createdAt: BigInt(inspiration.createdAt),
    };

    return this.contextOperation(
      'addDesignInspiration',
      () => userActor.addDesignInspiration(backendInspiration),
      'Design inspiration added'
    );
  }

  async updateDesignInspiration(
    inspiration: DesignInspiration,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendInspiration = {
      id: inspiration.id,
      title: inspiration.title,
      url: inspiration.url ? [inspiration.url] : [],
      imageUrl: inspiration.imageUrl ? [inspiration.imageUrl] : [],
      notes: inspiration.notes ? [inspiration.notes] : [],
      createdAt: BigInt(inspiration.createdAt),
    };

    return this.contextOperation(
      'updateDesignInspiration',
      () => userActor.updateDesignInspiration(backendInspiration),
      'Design inspiration updated'
    );
  }

  async deleteDesignInspiration(
    id: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    return this.contextOperation(
      'deleteDesignInspiration',
      () => userActor.deleteDesignInspiration(id),
      'Design inspiration deleted'
    );
  }

  async getDesignInspirations(
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<DesignInspiration[]>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const result = await this.contextOperation<any[]>(
      'getDesignInspirations',
      () => userActor.getDesignInspirations(),
      'Retrieved design inspirations'
    );

    if (result.success && result.data) {
      const inspirations: DesignInspiration[] = result.data.map((inspiration: any) => ({
        id: inspiration.id,
        title: inspiration.title,
        url: inspiration.url && inspiration.url.length > 0 ? inspiration.url[0] : undefined,
        imageUrl: inspiration.imageUrl && inspiration.imageUrl.length > 0 ? inspiration.imageUrl[0] : undefined,
        notes: inspiration.notes && inspiration.notes.length > 0 ? inspiration.notes[0] : undefined,
        createdAt: Number(inspiration.createdAt),
      }));
      return { success: true, data: inspirations };
    }

    return result;
  }

  // -------- DOCUMENTATION ITEMS --------

  async addDocumentationItem(
    doc: DocumentationItem,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendDoc = {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      category: doc.category ? [doc.category] : [],
      createdAt: BigInt(doc.createdAt),
    };

    return this.contextOperation(
      'addDocumentationItem',
      () => userActor.addDocumentationItem(backendDoc),
      'Documentation item added'
    );
  }

  async updateDocumentationItem(
    doc: DocumentationItem,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendDoc = {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      category: doc.category ? [doc.category] : [],
      createdAt: BigInt(doc.createdAt),
    };

    return this.contextOperation(
      'updateDocumentationItem',
      () => userActor.updateDocumentationItem(backendDoc),
      'Documentation item updated'
    );
  }

  async deleteDocumentationItem(
    id: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    return this.contextOperation(
      'deleteDocumentationItem',
      () => userActor.deleteDocumentationItem(id),
      'Documentation item deleted'
    );
  }

  async getDocumentationItems(
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<DocumentationItem[]>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const result = await this.contextOperation<any[]>(
      'getDocumentationItems',
      () => userActor.getDocumentationItems(),
      'Retrieved documentation items'
    );

    if (result.success && result.data) {
      const items: DocumentationItem[] = result.data.map((item: any) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        category: item.category && item.category.length > 0 ? item.category[0] : undefined,
        createdAt: Number(item.createdAt),
      }));
      return { success: true, data: items };
    }

    return result;
  }

  // -------- GITHUB GUIDELINES --------

  async addGitHubGuideline(
    guideline: GitHubGuideline,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendGuideline = {
      id: guideline.id,
      title: guideline.title,
      guideline: guideline.guideline,
      createdAt: BigInt(guideline.createdAt),
    };

    return this.contextOperation(
      'addGitHubGuideline',
      () => userActor.addGitHubGuideline(backendGuideline),
      'GitHub guideline added'
    );
  }

  async updateGitHubGuideline(
    guideline: GitHubGuideline,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendGuideline = {
      id: guideline.id,
      title: guideline.title,
      guideline: guideline.guideline,
      createdAt: BigInt(guideline.createdAt),
    };

    return this.contextOperation(
      'updateGitHubGuideline',
      () => userActor.updateGitHubGuideline(backendGuideline),
      'GitHub guideline updated'
    );
  }

  async deleteGitHubGuideline(
    id: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    return this.contextOperation(
      'deleteGitHubGuideline',
      () => userActor.deleteGitHubGuideline(id),
      'GitHub guideline deleted'
    );
  }

  async getGitHubGuidelines(
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<GitHubGuideline[]>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const result = await this.contextOperation<any[]>(
      'getGitHubGuidelines',
      () => userActor.getGitHubGuidelines(),
      'Retrieved GitHub guidelines'
    );

    if (result.success && result.data) {
      const guidelines: GitHubGuideline[] = result.data.map((guideline: any) => ({
        id: guideline.id,
        title: guideline.title,
        guideline: guideline.guideline,
        createdAt: Number(guideline.createdAt),
      }));
      return { success: true, data: guidelines };
    }

    return result;
  }

  // -------- CODE TEMPLATES --------

  async addCodeTemplate(
    template: CodeTemplate,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendTemplate = {
      id: template.id,
      name: template.name,
      language: template.language,
      code: template.code,
      description: template.description ? [template.description] : [],
      createdAt: BigInt(template.createdAt),
    };

    return this.contextOperation(
      'addCodeTemplate',
      () => userActor.addCodeTemplate(backendTemplate),
      'Code template added'
    );
  }

  async updateCodeTemplate(
    template: CodeTemplate,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendTemplate = {
      id: template.id,
      name: template.name,
      language: template.language,
      code: template.code,
      description: template.description ? [template.description] : [],
      createdAt: BigInt(template.createdAt),
    };

    return this.contextOperation(
      'updateCodeTemplate',
      () => userActor.updateCodeTemplate(backendTemplate),
      'Code template updated'
    );
  }

  async deleteCodeTemplate(
    id: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    return this.contextOperation(
      'deleteCodeTemplate',
      () => userActor.deleteCodeTemplate(id),
      'Code template deleted'
    );
  }

  async getCodeTemplates(
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<CodeTemplate[]>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const result = await this.contextOperation<any[]>(
      'getCodeTemplates',
      () => userActor.getCodeTemplates(),
      'Retrieved code templates'
    );

    if (result.success && result.data) {
      const templates: CodeTemplate[] = result.data.map((template: any) => ({
        id: template.id,
        name: template.name,
        language: template.language,
        code: template.code,
        description: template.description && template.description.length > 0 ? template.description[0] : undefined,
        createdAt: Number(template.createdAt),
      }));
      return { success: true, data: templates };
    }

    return result;
  }

  // -------- API ENDPOINTS --------

  async addAPIEndpoint(
    endpoint: APIEndpoint,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendEndpoint = {
      id: endpoint.id,
      name: endpoint.name,
      method: endpoint.method,
      url: endpoint.url,
      headers: endpoint.headers,
      body: endpoint.body ? [endpoint.body] : [],
      description: endpoint.description ? [endpoint.description] : [],
      createdAt: BigInt(endpoint.createdAt),
    };

    return this.contextOperation(
      'addAPIEndpoint',
      () => userActor.addAPIEndpoint(backendEndpoint),
      'API endpoint added'
    );
  }

  async updateAPIEndpoint(
    endpoint: APIEndpoint,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendEndpoint = {
      id: endpoint.id,
      name: endpoint.name,
      method: endpoint.method,
      url: endpoint.url,
      headers: endpoint.headers,
      body: endpoint.body ? [endpoint.body] : [],
      description: endpoint.description ? [endpoint.description] : [],
      createdAt: BigInt(endpoint.createdAt),
    };

    return this.contextOperation(
      'updateAPIEndpoint',
      () => userActor.updateAPIEndpoint(backendEndpoint),
      'API endpoint updated'
    );
  }

  async deleteAPIEndpoint(
    id: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    return this.contextOperation(
      'deleteAPIEndpoint',
      () => userActor.deleteAPIEndpoint(id),
      'API endpoint deleted'
    );
  }

  async getAPIEndpoints(
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<APIEndpoint[]>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const result = await this.contextOperation<any[]>(
      'getAPIEndpoints',
      () => userActor.getAPIEndpoints(),
      'Retrieved API endpoints'
    );

    if (result.success && result.data) {
      const endpoints: APIEndpoint[] = result.data.map((endpoint: any) => ({
        id: endpoint.id,
        name: endpoint.name,
        method: endpoint.method,
        url: endpoint.url,
        headers: endpoint.headers,
        body: endpoint.body && endpoint.body.length > 0 ? endpoint.body[0] : undefined,
        description: endpoint.description && endpoint.description.length > 0 ? endpoint.description[0] : undefined,
        createdAt: Number(endpoint.createdAt),
      }));
      return { success: true, data: endpoints };
    }

    return result;
  }

  // -------- BULK OPERATIONS --------

  async getAllUserContext(
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<UserContext>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const result = await this.contextOperation<any>(
      'getAllUserContext',
      () => userActor.getAllUserContext(),
      'Retrieved all user context'
    );

    if (result.success && result.data) {
      const context: UserContext = {
        references: result.data.references.map((item: any) => ({
          id: item.id,
          title: item.title,
          content: item.content,
          category: item.category && item.category.length > 0 ? item.category[0] : undefined,
          createdAt: Number(item.createdAt),
        })),
        codeRules: result.data.codeRules.map((rule: any) => ({
          id: rule.id,
          title: rule.title,
          rule: rule.rule,
          examples: rule.examples,
          createdAt: Number(rule.createdAt),
        })),
        colorPalettes: result.data.colorPalettes.map((palette: any) => ({
          id: palette.id,
          name: palette.name,
          colors: palette.colors,
          createdAt: Number(palette.createdAt),
        })),
        designInspirations: result.data.designInspirations.map((inspiration: any) => ({
          id: inspiration.id,
          title: inspiration.title,
          url: inspiration.url && inspiration.url.length > 0 ? inspiration.url[0] : undefined,
          imageUrl: inspiration.imageUrl && inspiration.imageUrl.length > 0 ? inspiration.imageUrl[0] : undefined,
          notes: inspiration.notes && inspiration.notes.length > 0 ? inspiration.notes[0] : undefined,
          createdAt: Number(inspiration.createdAt),
        })),
        documentationItems: result.data.documentationItems.map((item: any) => ({
          id: item.id,
          title: item.title,
          content: item.content,
          category: item.category && item.category.length > 0 ? item.category[0] : undefined,
          createdAt: Number(item.createdAt),
        })),
        gitHubGuidelines: result.data.gitHubGuidelines.map((guideline: any) => ({
          id: guideline.id,
          title: guideline.title,
          guideline: guideline.guideline,
          createdAt: Number(guideline.createdAt),
        })),
        codeTemplates: result.data.codeTemplates.map((template: any) => ({
          id: template.id,
          name: template.name,
          language: template.language,
          code: template.code,
          description: template.description && template.description.length > 0 ? template.description[0] : undefined,
          createdAt: Number(template.createdAt),
        })),
        apiEndpoints: result.data.apiEndpoints.map((endpoint: any) => ({
          id: endpoint.id,
          name: endpoint.name,
          method: endpoint.method,
          url: endpoint.url,
          headers: endpoint.headers,
          body: endpoint.body && endpoint.body.length > 0 ? endpoint.body[0] : undefined,
          description: endpoint.description && endpoint.description.length > 0 ? endpoint.description[0] : undefined,
          createdAt: Number(endpoint.createdAt),
        })),
      };
      return { success: true, data: context };
    }

    return result;
  }

  // ==================== AGENT CREDENTIALS & SECURITY ====================

  // Helper to convert frontend LLMCredentials to backend format
  private convertLLMCredentials(creds?: LLMCredentials): any {
    if (!creds) return [];
    return [{
      apiKey: creds.apiKey,
      organizationId: creds.organizationId ? [creds.organizationId] : [],
      projectId: creds.projectId ? [creds.projectId] : [],
      model: creds.model ? [creds.model] : [],
      maxTokens: creds.maxTokens ? [creds.maxTokens] : [],
      temperature: creds.temperature ? [creds.temperature] : [],
      rateLimit: creds.rateLimit ? [{
        requestsPerMinute: creds.rateLimit.requestsPerMinute,
        requestsPerDay: creds.rateLimit.requestsPerDay,
        tokensPerMinute: creds.rateLimit.tokensPerMinute ? [creds.rateLimit.tokensPerMinute] : [],
        tokensPerDay: creds.rateLimit.tokensPerDay ? [creds.rateLimit.tokensPerDay] : [],
      }] : [],
      endpoint: creds.endpoint ? [creds.endpoint] : [],
    }];
  }

  // Helper to convert backend LLMCredentials to frontend format
  private parseLLMCredentials(backendCreds: any): LLMCredentials | undefined {
    if (!backendCreds || backendCreds.length === 0) return undefined;
    const creds = backendCreds[0];
    return {
      apiKey: creds.apiKey,
      organizationId: creds.organizationId && creds.organizationId.length > 0 ? creds.organizationId[0] : undefined,
      projectId: creds.projectId && creds.projectId.length > 0 ? creds.projectId[0] : undefined,
      model: creds.model && creds.model.length > 0 ? creds.model[0] : undefined,
      maxTokens: creds.maxTokens && creds.maxTokens.length > 0 ? creds.maxTokens[0] : undefined,
      temperature: creds.temperature && creds.temperature.length > 0 ? creds.temperature[0] : undefined,
      rateLimit: creds.rateLimit && creds.rateLimit.length > 0 ? {
        requestsPerMinute: creds.rateLimit[0].requestsPerMinute,
        requestsPerDay: creds.rateLimit[0].requestsPerDay,
        tokensPerMinute: creds.rateLimit[0].tokensPerMinute && creds.rateLimit[0].tokensPerMinute.length > 0 
          ? creds.rateLimit[0].tokensPerMinute[0] : undefined,
        tokensPerDay: creds.rateLimit[0].tokensPerDay && creds.rateLimit[0].tokensPerDay.length > 0
          ? creds.rateLimit[0].tokensPerDay[0] : undefined,
      } : undefined,
      endpoint: creds.endpoint && creds.endpoint.length > 0 ? creds.endpoint[0] : undefined,
    };
  }

  async addAgentCredentials(
    credentials: AgentCredentials,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendCreds = {
      agentId: credentials.agentId,
      projectId: credentials.projectId ? [credentials.projectId] : [],
      openai: this.convertLLMCredentials(credentials.openai),
      anthropic: this.convertLLMCredentials(credentials.anthropic),
      gemini: this.convertLLMCredentials(credentials.gemini),
      kimi: this.convertLLMCredentials(credentials.kimi),
      databases: credentials.databases.map(db => ({
        id: db.id,
        name: db.name,
        dbType: db.dbType,
        host: db.host,
        port: db.port,
        database: db.database,
        username: db.username,
        encryptedPassword: db.encryptedPassword,
        connectionString: db.connectionString ? [db.connectionString] : [],
        sslEnabled: db.sslEnabled,
        sslCertificate: db.sslCertificate ? [db.sslCertificate] : [],
        isReadOnly: db.isReadOnly,
        allowedOperations: db.allowedOperations,
        createdAt: BigInt(db.createdAt),
      })),
      customAPIs: credentials.customAPIs.map(api => ({
        id: api.id,
        name: api.name,
        service: api.service,
        credentialType: api.credentialType,
        encryptedToken: api.encryptedToken,
        tokenExpiry: api.tokenExpiry ? [BigInt(api.tokenExpiry)] : [],
        scopes: api.scopes,
        metadata: api.metadata,
        createdAt: BigInt(api.createdAt),
        lastUsed: api.lastUsed ? [BigInt(api.lastUsed)] : [],
        usageCount: api.usageCount,
        isActive: api.isActive,
        projectIds: api.projectIds,
      })),
      environmentVariables: credentials.environmentVariables,
      createdAt: BigInt(credentials.createdAt),
      updatedAt: BigInt(credentials.updatedAt),
    };

    return this.contextOperation(
      'addAgentCredentials',
      () => userActor.addAgentCredentials(backendCreds),
      'Agent credentials added'
    );
  }

  async updateAgentCredentials(
    credentials: AgentCredentials,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendCreds = {
      agentId: credentials.agentId,
      projectId: credentials.projectId ? [credentials.projectId] : [],
      openai: this.convertLLMCredentials(credentials.openai),
      anthropic: this.convertLLMCredentials(credentials.anthropic),
      gemini: this.convertLLMCredentials(credentials.gemini),
      kimi: this.convertLLMCredentials(credentials.kimi),
      databases: credentials.databases.map(db => ({
        id: db.id,
        name: db.name,
        dbType: db.dbType,
        host: db.host,
        port: db.port,
        database: db.database,
        username: db.username,
        encryptedPassword: db.encryptedPassword,
        connectionString: db.connectionString ? [db.connectionString] : [],
        sslEnabled: db.sslEnabled,
        sslCertificate: db.sslCertificate ? [db.sslCertificate] : [],
        isReadOnly: db.isReadOnly,
        allowedOperations: db.allowedOperations,
        createdAt: BigInt(db.createdAt),
      })),
      customAPIs: credentials.customAPIs.map(api => ({
        id: api.id,
        name: api.name,
        service: api.service,
        credentialType: api.credentialType,
        encryptedToken: api.encryptedToken,
        tokenExpiry: api.tokenExpiry ? [BigInt(api.tokenExpiry)] : [],
        scopes: api.scopes,
        metadata: api.metadata,
        createdAt: BigInt(api.createdAt),
        lastUsed: api.lastUsed ? [BigInt(api.lastUsed)] : [],
        usageCount: api.usageCount,
        isActive: api.isActive,
        projectIds: api.projectIds,
      })),
      environmentVariables: credentials.environmentVariables,
      createdAt: BigInt(credentials.createdAt),
      updatedAt: BigInt(credentials.updatedAt),
    };

    return this.contextOperation(
      'updateAgentCredentials',
      () => userActor.updateAgentCredentials(backendCreds),
      'Agent credentials updated'
    );
  }

  async deleteAgentCredentials(
    agentId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    return this.contextOperation(
      'deleteAgentCredentials',
      () => userActor.deleteAgentCredentials(agentId),
      'Agent credentials deleted'
    );
  }

  async getAgentCredentials(
    agentId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<AgentCredentials>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const result = await this.contextOperation<any>(
      'getAgentCredentials',
      () => userActor.getAgentCredentials(agentId),
      'Retrieved agent credentials'
    );

    if (result.success && result.data) {
      const creds: AgentCredentials = {
        agentId: result.data.agentId,
        projectId: result.data.projectId && result.data.projectId.length > 0 ? result.data.projectId[0] : undefined,
        openai: this.parseLLMCredentials(result.data.openai),
        anthropic: this.parseLLMCredentials(result.data.anthropic),
        gemini: this.parseLLMCredentials(result.data.gemini),
        kimi: this.parseLLMCredentials(result.data.kimi),
        databases: result.data.databases.map((db: any) => ({
          id: db.id,
          name: db.name,
          dbType: db.dbType,
          host: db.host,
          port: db.port,
          database: db.database,
          username: db.username,
          encryptedPassword: db.encryptedPassword,
          connectionString: db.connectionString && db.connectionString.length > 0 ? db.connectionString[0] : undefined,
          sslEnabled: db.sslEnabled,
          sslCertificate: db.sslCertificate && db.sslCertificate.length > 0 ? db.sslCertificate[0] : undefined,
          isReadOnly: db.isReadOnly,
          allowedOperations: db.allowedOperations,
          createdAt: Number(db.createdAt),
        })),
        customAPIs: result.data.customAPIs.map((api: any) => ({
          id: api.id,
          name: api.name,
          service: api.service,
          credentialType: api.credentialType,
          encryptedToken: api.encryptedToken,
          tokenExpiry: api.tokenExpiry && api.tokenExpiry.length > 0 ? Number(api.tokenExpiry[0]) : undefined,
          scopes: api.scopes,
          metadata: api.metadata,
          createdAt: Number(api.createdAt),
          lastUsed: api.lastUsed && api.lastUsed.length > 0 ? Number(api.lastUsed[0]) : undefined,
          usageCount: api.usageCount,
          isActive: api.isActive,
          projectIds: api.projectIds,
        })),
        environmentVariables: result.data.environmentVariables,
        createdAt: Number(result.data.createdAt),
        updatedAt: Number(result.data.updatedAt),
      };
      return { success: true, data: creds };
    }

    return result;
  }

  async getAllAgentCredentials(
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<AgentCredentials[]>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const result = await this.contextOperation<any[]>(
      'getAllAgentCredentials',
      () => userActor.getAllAgentCredentials(),
      'Retrieved all agent credentials'
    );

    if (result.success && result.data) {
      const credentials: AgentCredentials[] = result.data.map((creds: any) => ({
        agentId: creds.agentId,
        projectId: creds.projectId && creds.projectId.length > 0 ? creds.projectId[0] : undefined,
        openai: this.parseLLMCredentials(creds.openai),
        anthropic: this.parseLLMCredentials(creds.anthropic),
        gemini: this.parseLLMCredentials(creds.gemini),
        kimi: this.parseLLMCredentials(creds.kimi),
        databases: creds.databases.map((db: any) => ({
          id: db.id,
          name: db.name,
          dbType: db.dbType,
          host: db.host,
          port: db.port,
          database: db.database,
          username: db.username,
          encryptedPassword: db.encryptedPassword,
          connectionString: db.connectionString && db.connectionString.length > 0 ? db.connectionString[0] : undefined,
          sslEnabled: db.sslEnabled,
          sslCertificate: db.sslCertificate && db.sslCertificate.length > 0 ? db.sslCertificate[0] : undefined,
          isReadOnly: db.isReadOnly,
          allowedOperations: db.allowedOperations,
          createdAt: Number(db.createdAt),
        })),
        customAPIs: creds.customAPIs.map((api: any) => ({
          id: api.id,
          name: api.name,
          service: api.service,
          credentialType: api.credentialType,
          encryptedToken: api.encryptedToken,
          tokenExpiry: api.tokenExpiry && api.tokenExpiry.length > 0 ? Number(api.tokenExpiry[0]) : undefined,
          scopes: api.scopes,
          metadata: api.metadata,
          createdAt: Number(api.createdAt),
          lastUsed: api.lastUsed && api.lastUsed.length > 0 ? Number(api.lastUsed[0]) : undefined,
          usageCount: api.usageCount,
          isActive: api.isActive,
          projectIds: api.projectIds,
        })),
        environmentVariables: creds.environmentVariables,
        createdAt: Number(creds.createdAt),
        updatedAt: Number(creds.updatedAt),
      }));
      return { success: true, data: credentials };
    }

    return result;
  }

  // -------- ENVIRONMENT CONFIGS --------

  async addEnvironmentConfig(
    config: EnvironmentConfig,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendConfig = {
      id: config.id,
      name: config.name,
      projectId: config.projectId ? [config.projectId] : [],
      agentId: config.agentId ? [config.agentId] : [],
      environment: config.environment,
      variables: config.variables.map(v => ({
        key: v.key,
        encryptedValue: v.encryptedValue,
        description: v.description ? [v.description] : [],
        isSecret: v.isSecret,
        isRequired: v.isRequired,
        category: v.category ? [v.category] : [],
        createdAt: BigInt(v.createdAt),
      })),
      createdAt: BigInt(config.createdAt),
      updatedAt: BigInt(config.updatedAt),
    };

    return this.contextOperation(
      'addEnvironmentConfig',
      () => userActor.addEnvironmentConfig(backendConfig),
      'Environment config added'
    );
  }

  async updateEnvironmentConfig(
    config: EnvironmentConfig,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const backendConfig = {
      id: config.id,
      name: config.name,
      projectId: config.projectId ? [config.projectId] : [],
      agentId: config.agentId ? [config.agentId] : [],
      environment: config.environment,
      variables: config.variables.map(v => ({
        key: v.key,
        encryptedValue: v.encryptedValue,
        description: v.description ? [v.description] : [],
        isSecret: v.isSecret,
        isRequired: v.isRequired,
        category: v.category ? [v.category] : [],
        createdAt: BigInt(v.createdAt),
      })),
      createdAt: BigInt(config.createdAt),
      updatedAt: BigInt(config.updatedAt),
    };

    return this.contextOperation(
      'updateEnvironmentConfig',
      () => userActor.updateEnvironmentConfig(backendConfig),
      'Environment config updated'
    );
  }

  async deleteEnvironmentConfig(
    configId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    return this.contextOperation(
      'deleteEnvironmentConfig',
      () => userActor.deleteEnvironmentConfig(configId),
      'Environment config deleted'
    );
  }

  async getEnvironmentConfig(
    configId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<EnvironmentConfig>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const result = await this.contextOperation<any>(
      'getEnvironmentConfig',
      () => userActor.getEnvironmentConfig(configId),
      'Retrieved environment config'
    );

    if (result.success && result.data) {
      const config: EnvironmentConfig = {
        id: result.data.id,
        name: result.data.name,
        projectId: result.data.projectId && result.data.projectId.length > 0 ? result.data.projectId[0] : undefined,
        agentId: result.data.agentId && result.data.agentId.length > 0 ? result.data.agentId[0] : undefined,
        environment: result.data.environment,
        variables: result.data.variables.map((v: any) => ({
          key: v.key,
          encryptedValue: v.encryptedValue,
          description: v.description && v.description.length > 0 ? v.description[0] : undefined,
          isSecret: v.isSecret,
          isRequired: v.isRequired,
          category: v.category && v.category.length > 0 ? v.category[0] : undefined,
          createdAt: Number(v.createdAt),
        })),
        createdAt: Number(result.data.createdAt),
        updatedAt: Number(result.data.updatedAt),
      };
      return { success: true, data: config };
    }

    return result;
  }

  async getEnvironmentConfigsByProject(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<EnvironmentConfig[]>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const result = await this.contextOperation<any[]>(
      'getEnvironmentConfigsByProject',
      () => userActor.getEnvironmentConfigsByProject(projectId),
      'Retrieved environment configs'
    );

    if (result.success && result.data) {
      const configs: EnvironmentConfig[] = result.data.map((config: any) => ({
        id: config.id,
        name: config.name,
        projectId: config.projectId && config.projectId.length > 0 ? config.projectId[0] : undefined,
        agentId: config.agentId && config.agentId.length > 0 ? config.agentId[0] : undefined,
        environment: config.environment,
        variables: config.variables.map((v: any) => ({
          key: v.key,
          encryptedValue: v.encryptedValue,
          description: v.description && v.description.length > 0 ? v.description[0] : undefined,
          isSecret: v.isSecret,
          isRequired: v.isRequired,
          category: v.category && v.category.length > 0 ? v.category[0] : undefined,
          createdAt: Number(v.createdAt),
        })),
        createdAt: Number(config.createdAt),
        updatedAt: Number(config.updatedAt),
      }));
      return { success: true, data: configs };
    }

    return result;
  }

  async getAllEnvironmentConfigs(
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<EnvironmentConfig[]>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const result = await this.contextOperation<any[]>(
      'getAllEnvironmentConfigs',
      () => userActor.getAllEnvironmentConfigs(),
      'Retrieved all environment configs'
    );

    if (result.success && result.data) {
      const configs: EnvironmentConfig[] = result.data.map((config: any) => ({
        id: config.id,
        name: config.name,
        projectId: config.projectId && config.projectId.length > 0 ? config.projectId[0] : undefined,
        agentId: config.agentId && config.agentId.length > 0 ? config.agentId[0] : undefined,
        environment: config.environment,
        variables: config.variables.map((v: any) => ({
          key: v.key,
          encryptedValue: v.encryptedValue,
          description: v.description && v.description.length > 0 ? v.description[0] : undefined,
          isSecret: v.isSecret,
          isRequired: v.isRequired,
          category: v.category && v.category.length > 0 ? v.category[0] : undefined,
          createdAt: Number(v.createdAt),
        })),
        createdAt: Number(config.createdAt),
        updatedAt: Number(config.updatedAt),
      }));
      return { success: true, data: configs };
    }

    return result;
  }

  // -------- SECURITY AUDIT LOGS --------

  async getSecurityAuditLogs(
    limit: number | undefined,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<SecurityAuditLog[]>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    const result = await this.contextOperation<any[]>(
      'getSecurityAuditLogs',
      () => userActor.getSecurityAuditLogs(limit ? [limit] : []),
      'Retrieved security audit logs'
    );

    if (result.success && result.data) {
      const logs: SecurityAuditLog[] = result.data.map((log: any) => ({
        timestamp: Number(log.timestamp),
        userId: log.userId.toText(),
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        result: log.result,
        metadata: log.metadata,
      }));
      return { success: true, data: logs };
    }

    return result;
  }

  // ==================== USER PREFERENCES & UI STATE ====================



  /**
   * Get the currently selected project ID
   */
  async getSelectedProject(
    userCanisterId: string,
    identity: Identity
  ): Promise<string | null> {
    try {
      console.log('📍 [UserCanisterService] Getting selected project');
      
      await this.initializeUserActor(userCanisterId, identity);
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) throw new Error('Failed to initialize user canister actor');

      const result = await userActor.getSelectedProject();
      
      if (result && result.length > 0) {
        console.log('✅ [UserCanisterService] Selected project:', result[0]);
        return result[0];
      }
      
      console.log('📍 [UserCanisterService] No project selected');
      return null;
    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to get selected project:', error);
      return null;
    }
  }

  /**
   * Set the currently selected project ID
   */
  async setSelectedProject(
    projectId: string | null,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    console.log('🔄 [UserCanisterService] Setting selected project:', projectId);

    return this.contextOperation(
      'setSelectedProject',
      () => userActor.setSelectedProject(projectId ? [projectId] : []),
      projectId ? `Selected project: ${projectId}` : 'Cleared project selection'
    );
  }

  /**
   * Get both selected server pair and project (convenience method)
   */
  async getUIState(
    userCanisterId: string,
    identity: Identity
  ): Promise<{
    selectedServerPair: string | null;
    selectedProject: string | null;
  }> {
    try {
      console.log('📍 [UserCanisterService] Getting UI state');
      
      await this.initializeUserActor(userCanisterId, identity);
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) throw new Error('Failed to initialize user canister actor');

      const result = await userActor.getUIState();
      
      return {
        selectedServerPair: result.selectedServerPair && result.selectedServerPair.length > 0 
          ? result.selectedServerPair[0] 
          : null,
        selectedProject: result.selectedProject && result.selectedProject.length > 0 
          ? result.selectedProject[0] 
          : null,
      };
    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to get UI state:', error);
      return {
        selectedServerPair: null,
        selectedProject: null,
      };
    }
  }

  /**
   * Set both selected server pair and project (convenience method)
   */
  async setUIState(
    serverPairId: string | null,
    projectId: string | null,
    userCanisterId: string,
    identity: Identity
  ): Promise<ContextResult<void>> {
    await this.initializeUserActor(userCanisterId, identity);
    const userActor = this.userActors.get(userCanisterId);
    if (!userActor) throw new Error('Failed to initialize user canister actor');

    console.log('🔄 [UserCanisterService] Setting UI state:', { serverPairId, projectId });

    return this.contextOperation(
      'setUIState',
      () => userActor.setUIState(
        serverPairId ? [serverPairId] : [],
        projectId ? [projectId] : []
      ),
      'UI state updated'
    );
  }

  // ==================== ENHANCED: ULTRA-PARALLEL SERVER PAIR MOVE OPERATIONS ====================

  /**
   * ULTRA-PARALLEL: Build cached move context for lightning-fast operations
   */
  private async buildServerPairMoveCache(
    userCanisterId: string,
    identity: Identity,
    forceRefresh: boolean = false
  ): Promise<void> {
    const now = Date.now();
    
    // Check if cache is still valid and we don't need to force refresh
    if (!forceRefresh && now - this.lastParallelCacheUpdate < this.PARALLEL_CACHE_TTL && this.serverPairMoveCache.size > 0) {
      console.log('📋 [UserCanisterService] ULTRA-PARALLEL: Using existing move cache');
      return;
    }

    console.log('🚀 [UserCanisterService] ULTRA-PARALLEL: Building server pair move cache...');
    const startTime = Date.now();

    try {
      await this.initializeUserActor(userCanisterId, identity);
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('User actor not available for cache building');
      }

      // PARALLEL: Load all required data simultaneously
      const [serverPairsResult, canistersResult] = await Promise.all([
        this.retryOperation(() => userActor.getUserServerPairs()),
        this.retryOperation(() => userActor.getUserCanisters())
      ]);

      console.log('📊 [UserCanisterService] ULTRA-PARALLEL: Loaded data in parallel - server pairs:', serverPairsResult?.length, 'canisters:', canistersResult?.length);

      // Build move context cache
      this.serverPairMoveCache.clear();

      if (Array.isArray(serverPairsResult)) {
        for (const serverPair of serverPairsResult) {
          const frontendCanisterId = this.convertPrincipalToCanisterId(serverPair.frontendCanisterId) || '';
          const backendCanisterId = this.convertPrincipalToCanisterId(serverPair.backendCanisterId) || '';

          // Find current project association through canister metadata
          let currentProjectId: string | undefined;
          
          if (Array.isArray(canistersResult)) {
            const frontendCanister = canistersResult.find(c => 
              this.convertPrincipalToCanisterId(c.principal) === frontendCanisterId
            );
            
            if (frontendCanister?.metadata?.project) {
              currentProjectId = this.extractOptionalValue(frontendCanister.metadata.project);
            }
          }

          const moveContext: ServerPairMoveContext = {
            pairId: serverPair.pairId,
            currentProjectId,
            targetProjectId: '', // Will be set when move is requested
            frontendCanisterId,
            backendCanisterId,
            serverPairData: serverPair
          };

          this.serverPairMoveCache.set(serverPair.pairId, moveContext);
        }
      }

      this.lastParallelCacheUpdate = now;
      const cacheTime = Date.now() - startTime;

      console.log(`✅ [UserCanisterService] ULTRA-PARALLEL: Move cache built in ${cacheTime}ms with ${this.serverPairMoveCache.size} server pairs`);

    } catch (error) {
      console.error('❌ [UserCanisterService] ULTRA-PARALLEL: Failed to build move cache:', error);
      // Don't throw - fallback to non-cached operations
    }
  }

  async moveServerPairToProjectUltraParallel(
    pairId: string,
    newProjectId: string,
    userCanisterId: string,
    identity: Identity,
    progressCallback?: (phase: string, message: string, timeMs: number) => void
  ): Promise<ParallelMoveResult> {
    const startTime = Date.now();
    console.log(`🚀 [UserCanisterService] ULTRA-PARALLEL: Starting lightning-fast server pair move: ${pairId} -> ${newProjectId}`);

    const phases: ParallelMoveResult['phases'] = {
      dataLoad: { success: false, timeMs: 0 },
      validation: { success: false, timeMs: 0 },
      canisterMetadataUpdate: { success: false, timeMs: 0, canisters: 0 },
      serverPairUpdate: { success: false, timeMs: 0 },
      cacheInvalidation: { success: false, timeMs: 0 }
    };

    try {
      // PHASE 1: ULTRA-PARALLEL DATA LOADING WITH CACHING
      const phase1Start = Date.now();
      progressCallback?.('dataLoad', 'Loading cached server pair data...', 0);

      await this.buildServerPairMoveCache(userCanisterId, identity);
      
      const moveContext = this.serverPairMoveCache.get(pairId);
      if (!moveContext) {
        throw new Error(`Server pair ${pairId} not found in move cache`);
      }

      moveContext.targetProjectId = newProjectId;
      phases.dataLoad = { success: true, timeMs: Date.now() - phase1Start };
      progressCallback?.('dataLoad', 'Cached data loaded', phases.dataLoad.timeMs);

      // PHASE 2: PARALLEL VALIDATION
      const phase2Start = Date.now();
      progressCallback?.('validation', 'Validating move operation...', 0);

      // Skip validation if moving to same project
      if (moveContext.currentProjectId === newProjectId) {
        console.log('ℹ️ [UserCanisterService] ULTRA-PARALLEL: Server pair already in target project');
        phases.validation = { success: true, timeMs: Date.now() - phase2Start };
        
        return {
          success: true,
          phases,
          totalTimeMs: Date.now() - startTime,
          performanceMetrics: {
            parallelOperations: 1,
            concurrencyLevel: 1,
            averageOperationTime: Date.now() - startTime
          }
        };
      }

      phases.validation = { success: true, timeMs: Date.now() - phase2Start };
      progressCallback?.('validation', 'Validation completed', phases.validation.timeMs);

      await this.initializeUserActor(userCanisterId, identity);
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('User actor not initialized');
      }

      // PHASE 3: ULTRA-PARALLEL CANISTER METADATA UPDATES
      const phase3Start = Date.now();
      progressCallback?.('canisterMetadataUpdate', 'Updating canister metadata in parallel...', 0);

      const metadataUpdatePromises = [];
      let canistersToUpdate = 0;

      // Update frontend canister metadata
      if (moveContext.frontendCanisterId) {
        canistersToUpdate++;
        metadataUpdatePromises.push(
          this.retryOperation(async () => {
            const frontendPrincipal = Principal.fromText(moveContext.frontendCanisterId);
            
            // Get existing metadata first
            const existingMetadata = await userActor.getCanisterMetadata(frontendPrincipal);
            let metadataToUpdate: any = {
              canisterType: 'frontend',
              name: moveContext.serverPairData.name + '_frontend',
              project: [newProjectId],
              subType: ['frontend'],
              didInterface: [],
              stableInterface: []
            };

            if (existingMetadata && Array.isArray(existingMetadata) && existingMetadata.length > 0) {
              const existing = existingMetadata[0];
              metadataToUpdate = {
                ...existing,
                project: [newProjectId] // Update only the project field
              };
            }

            return await userActor.updateCanisterMetadata(frontendPrincipal, metadataToUpdate);
          })
        );
      }

      // Update backend canister metadata
      if (moveContext.backendCanisterId) {
        canistersToUpdate++;
        metadataUpdatePromises.push(
          this.retryOperation(async () => {
            const backendPrincipal = Principal.fromText(moveContext.backendCanisterId);
            
            // Get existing metadata first
            const existingMetadata = await userActor.getCanisterMetadata(backendPrincipal);
            let metadataToUpdate: any = {
              canisterType: 'backend',
              name: moveContext.serverPairData.name + '_backend',
              project: [newProjectId],
              subType: ['backend'],
              didInterface: [],
              stableInterface: []
            };

            if (existingMetadata && Array.isArray(existingMetadata) && existingMetadata.length > 0) {
              const existing = existingMetadata[0];
              metadataToUpdate = {
                ...existing,
                project: [newProjectId] // Update only the project field
              };
            }

            return await userActor.updateCanisterMetadata(backendPrincipal, metadataToUpdate);
          })
        );
      }

      // Execute all metadata updates in parallel
      console.log(`⚡ [UserCanisterService] ULTRA-PARALLEL: Updating ${canistersToUpdate} canister metadata records simultaneously...`);
      
      const metadataResults = await Promise.allSettled(metadataUpdatePromises);
      
      const successfulMetadataUpdates = metadataResults.filter(result => result.status === 'fulfilled').length;
      const failedMetadataUpdates = metadataResults.filter(result => result.status === 'rejected').length;

      console.log(`📊 [UserCanisterService] ULTRA-PARALLEL: Metadata updates completed - ${successfulMetadataUpdates} successful, ${failedMetadataUpdates} failed`);

      if (failedMetadataUpdates > 0) {
        const errors = metadataResults
          .filter(result => result.status === 'rejected')
          .map(result => (result as PromiseRejectedResult).reason);
        
        console.error('❌ [UserCanisterService] ULTRA-PARALLEL: Some metadata updates failed:', errors);
        
        phases.canisterMetadataUpdate = { 
          success: false, 
          timeMs: Date.now() - phase3Start, 
          canisters: canistersToUpdate,
          error: `${failedMetadataUpdates}/${canistersToUpdate} metadata updates failed`
        };
        
        throw new Error(`Metadata updates failed for ${failedMetadataUpdates} out of ${canistersToUpdate} canisters`);
      }

      phases.canisterMetadataUpdate = { 
        success: true, 
        timeMs: Date.now() - phase3Start, 
        canisters: canistersToUpdate 
      };
      progressCallback?.('canisterMetadataUpdate', `Updated ${canistersToUpdate} canisters`, phases.canisterMetadataUpdate.timeMs);

      // PHASE 4: SERVER PAIR UPDATE (if needed)
      const phase4Start = Date.now();
      progressCallback?.('serverPairUpdate', 'Finalizing server pair association...', 0);

      // For metadata-based moves, the server pair itself doesn't need updating
      // The association is now handled through canister metadata
      console.log('✅ [UserCanisterService] ULTRA-PARALLEL: Server pair association updated through metadata');

      phases.serverPairUpdate = { success: true, timeMs: Date.now() - phase4Start };
      progressCallback?.('serverPairUpdate', 'Server pair association finalized', phases.serverPairUpdate.timeMs);

      // PHASE 5: ULTRA-PARALLEL CACHE INVALIDATION
      const phase5Start = Date.now();
      progressCallback?.('cacheInvalidation', 'Clearing caches...', 0);

      // Update the move cache
      moveContext.currentProjectId = newProjectId;
      this.serverPairMoveCache.set(pairId, moveContext);

      // Clear external resolver caches in parallel
      const cacheInvalidationPromises = [];
      
      // Clear ServerPairProjectResolver cache
      try {
        const { serverPairProjectResolver } = await import('./ServerPairProjectResolver');
        cacheInvalidationPromises.push(Promise.resolve(serverPairProjectResolver.clearCaches()));
      } catch (importError) {
        console.warn('⚠️ [UserCanisterService] Could not import ServerPairProjectResolver for cache clearing:', importError);
      }

      await Promise.allSettled(cacheInvalidationPromises);

      phases.cacheInvalidation = { success: true, timeMs: Date.now() - phase5Start };
      progressCallback?.('cacheInvalidation', 'Caches cleared', phases.cacheInvalidation.timeMs);

      const totalTime = Date.now() - startTime;
      const parallelOperations = canistersToUpdate + cacheInvalidationPromises.length;

      console.log(`🎉 [UserCanisterService] ULTRA-PARALLEL: Move completed in ${totalTime}ms with maximum parallelism:`);
      console.log(`   📊 Parallel operations: ${parallelOperations}`);
      console.log(`   ⚡ Average operation time: ${Math.round(totalTime / Math.max(parallelOperations, 1))}ms`);
      console.log(`   🚀 Concurrency level: ${this.SERVER_PAIR_MOVE_CONCURRENCY}`);

      return {
        success: true,
        phases,
        totalTimeMs: totalTime,
        performanceMetrics: {
          parallelOperations,
          concurrencyLevel: this.SERVER_PAIR_MOVE_CONCURRENCY,
          averageOperationTime: Math.round(totalTime / Math.max(parallelOperations, 1))
        }
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] ULTRA-PARALLEL: Move operation failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        phases,
        totalTimeMs: Date.now() - startTime
      };
    }
  }


  async removeServerPairFromProject(
  pairId: string,
  userCanisterId: string,
  identity: Identity,
  progressCallback?: (phase: string, message: string, timeMs: number) => void
  ): Promise<ParallelMoveResult> {
    const startTime = Date.now();
    console.log(`🗑️ [UserCanisterService] ENHANCED: Starting server pair removal from project: ${pairId}`);

    const phases: ParallelMoveResult['phases'] = {
      dataLoad: { success: false, timeMs: 0 },
      validation: { success: false, timeMs: 0 },
      canisterMetadataUpdate: { success: false, timeMs: 0, canisters: 0 },
      serverPairUpdate: { success: false, timeMs: 0 },
      cacheInvalidation: { success: false, timeMs: 0 }
    };

    try {
      // PHASE 1: LOAD SERVER PAIR DATA
      const phase1Start = Date.now();
      progressCallback?.('dataLoad', 'Loading server pair data...', 0);

      await this.buildServerPairMoveCache(userCanisterId, identity);
      
      const moveContext = this.serverPairMoveCache.get(pairId);
      if (!moveContext) {
        throw new Error(`Server pair ${pairId} not found in cache`);
      }

      console.log('📊 [UserCanisterService] ENHANCED: Server pair removal context:', {
        pairId: moveContext.pairId,
        currentProjectId: moveContext.currentProjectId,
        frontendCanisterId: moveContext.frontendCanisterId,
        backendCanisterId: moveContext.backendCanisterId
      });

      phases.dataLoad = { success: true, timeMs: Date.now() - phase1Start };
      progressCallback?.('dataLoad', 'Server pair data loaded', phases.dataLoad.timeMs);

      // PHASE 2: VALIDATION
      const phase2Start = Date.now();
      progressCallback?.('validation', 'Validating removal operation...', 0);

      // Check if server pair is currently assigned to a project
      if (!moveContext.currentProjectId) {
        console.log('ℹ️ [UserCanisterService] ENHANCED: Server pair is already unassigned');
        phases.validation = { success: true, timeMs: Date.now() - phase2Start };
        
        return {
          success: true,
          phases,
          totalTimeMs: Date.now() - startTime,
          performanceMetrics: {
            parallelOperations: 0,
            concurrencyLevel: 0,
            averageOperationTime: Date.now() - startTime
          }
        };
      }

      console.log(`✅ [UserCanisterService] ENHANCED: Server pair is assigned to project: ${moveContext.currentProjectId}`);
      phases.validation = { success: true, timeMs: Date.now() - phase2Start };
      progressCallback?.('validation', 'Validation completed', phases.validation.timeMs);

      await this.initializeUserActor(userCanisterId, identity);
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('User actor not initialized');
      }

      // PHASE 3: ULTRA-PARALLEL CANISTER METADATA CLEARING
      const phase3Start = Date.now();
      progressCallback?.('canisterMetadataUpdate', 'Clearing canister project associations in parallel...', 0);

      const metadataClearingPromises = [];
      let canistersToUpdate = 0;

      // Clear frontend canister project association
      if (moveContext.frontendCanisterId) {
        canistersToUpdate++;
        metadataClearingPromises.push(
          this.retryOperation(async () => {
            const frontendPrincipal = Principal.fromText(moveContext.frontendCanisterId);
            
            console.log(`🧹 [UserCanisterService] ENHANCED: Clearing frontend canister project association: ${moveContext.frontendCanisterId}`);
            
            // Get existing metadata first
            const existingMetadata = await userActor.getCanisterMetadata(frontendPrincipal);
            let metadataToUpdate: any = {
              canisterType: 'frontend',
              name: moveContext.serverPairData.name + '_frontend',
              project: [], // ✅ CLEAR PROJECT ASSOCIATION
              subType: ['frontend'],
              didInterface: [],
              stableInterface: []
            };

            if (existingMetadata && Array.isArray(existingMetadata) && existingMetadata.length > 0) {
              const existing = existingMetadata[0];
              metadataToUpdate = {
                ...existing,
                project: [] // ✅ CLEAR PROJECT ASSOCIATION - empty array for Motoko optional
              };
            }

            console.log(`📝 [UserCanisterService] ENHANCED: Frontend metadata update:`, {
              canisterId: moveContext.frontendCanisterId,
              projectBefore: moveContext.currentProjectId,
              projectAfter: 'UNASSIGNED'
            });

            return await userActor.updateCanisterMetadata(frontendPrincipal, metadataToUpdate);
          })
        );
      }

      // Clear backend canister project association
      if (moveContext.backendCanisterId) {
        canistersToUpdate++;
        metadataClearingPromises.push(
          this.retryOperation(async () => {
            const backendPrincipal = Principal.fromText(moveContext.backendCanisterId);
            
            console.log(`🧹 [UserCanisterService] ENHANCED: Clearing backend canister project association: ${moveContext.backendCanisterId}`);
            
            // Get existing metadata first
            const existingMetadata = await userActor.getCanisterMetadata(backendPrincipal);
            let metadataToUpdate: any = {
              canisterType: 'backend',
              name: moveContext.serverPairData.name + '_backend',
              project: [], // ✅ CLEAR PROJECT ASSOCIATION
              subType: ['backend'],
              didInterface: [],
              stableInterface: []
            };

            if (existingMetadata && Array.isArray(existingMetadata) && existingMetadata.length > 0) {
              const existing = existingMetadata[0];
              metadataToUpdate = {
                ...existing,
                project: [] // ✅ CLEAR PROJECT ASSOCIATION - empty array for Motoko optional
              };
            }

            console.log(`📝 [UserCanisterService] ENHANCED: Backend metadata update:`, {
              canisterId: moveContext.backendCanisterId,
              projectBefore: moveContext.currentProjectId,
              projectAfter: 'UNASSIGNED'
            });

            return await userActor.updateCanisterMetadata(backendPrincipal, metadataToUpdate);
          })
        );
      }

      // Execute all metadata clearing operations in parallel
      console.log(`⚡ [UserCanisterService] ENHANCED: Clearing ${canistersToUpdate} canister project associations simultaneously...`);
      
      const metadataResults = await Promise.allSettled(metadataClearingPromises);
      
      const successfulClears = metadataResults.filter(result => result.status === 'fulfilled').length;
      const failedClears = metadataResults.filter(result => result.status === 'rejected').length;

      console.log(`📊 [UserCanisterService] ENHANCED: Metadata clearing completed - ${successfulClears} successful, ${failedClears} failed`);

      if (failedClears > 0) {
        const errors = metadataResults
          .filter(result => result.status === 'rejected')
          .map(result => (result as PromiseRejectedResult).reason);
        
        console.error('❌ [UserCanisterService] ENHANCED: Some metadata clearing operations failed:', errors);
        
        phases.canisterMetadataUpdate = { 
          success: false, 
          timeMs: Date.now() - phase3Start, 
          canisters: canistersToUpdate,
          error: `${failedClears}/${canistersToUpdate} metadata clearing operations failed`
        };
        
        throw new Error(`Metadata clearing failed for ${failedClears} out of ${canistersToUpdate} canisters`);
      }

      phases.canisterMetadataUpdate = { 
        success: true, 
        timeMs: Date.now() - phase3Start, 
        canisters: canistersToUpdate 
      };
      progressCallback?.('canisterMetadataUpdate', `Cleared project association from ${canistersToUpdate} canisters`, phases.canisterMetadataUpdate.timeMs);

      // PHASE 4: SERVER PAIR RECORD UPDATE (METADATA-BASED SYSTEM)
      const phase4Start = Date.now();
      progressCallback?.('serverPairUpdate', 'Finalizing server pair disassociation...', 0);

      // In metadata-based system, the server pair record itself doesn't need updating
      // The association is now cleared through canister metadata
      console.log('✅ [UserCanisterService] ENHANCED: Server pair disassociated through metadata clearing');

      phases.serverPairUpdate = { success: true, timeMs: Date.now() - phase4Start };
      progressCallback?.('serverPairUpdate', 'Server pair disassociation finalized', phases.serverPairUpdate.timeMs);

      // PHASE 5: ULTRA-PARALLEL CACHE INVALIDATION
      const phase5Start = Date.now();
      progressCallback?.('cacheInvalidation', 'Clearing caches...', 0);

      // Update the move cache to reflect unassigned state
      moveContext.currentProjectId = undefined; // Mark as unassigned
      this.serverPairMoveCache.set(pairId, moveContext);

      // Clear external resolver caches in parallel
      const cacheInvalidationPromises = [];
      
      // Clear ServerPairProjectResolver cache
      try {
        const { serverPairProjectResolver } = await import('./ServerPairProjectResolver');
        cacheInvalidationPromises.push(Promise.resolve(serverPairProjectResolver.clearCaches()));
      } catch (importError) {
        console.warn('⚠️ [UserCanisterService] Could not import ServerPairProjectResolver for cache clearing:', importError);
      }

      await Promise.allSettled(cacheInvalidationPromises);

      phases.cacheInvalidation = { success: true, timeMs: Date.now() - phase5Start };
      progressCallback?.('cacheInvalidation', 'Caches cleared', phases.cacheInvalidation.timeMs);

      const totalTime = Date.now() - startTime;
      const parallelOperations = canistersToUpdate + cacheInvalidationPromises.length;

      console.log(`🎉 [UserCanisterService] ENHANCED: Server pair removal completed in ${totalTime}ms with maximum parallelism:`);
      console.log(`   📊 Server pair "${pairId}" is now UNASSIGNED`);
      console.log(`   ⚡ Parallel operations: ${parallelOperations}`);
      console.log(`   🚀 Average operation time: ${Math.round(totalTime / Math.max(parallelOperations, 1))}ms`);
      console.log(`   📝 Project association cleared from ${canistersToUpdate} canisters`);

      return {
        success: true,
        phases,
        totalTimeMs: totalTime,
        performanceMetrics: {
          parallelOperations,
          concurrencyLevel: this.SERVER_PAIR_MOVE_CONCURRENCY,
          averageOperationTime: Math.round(totalTime / Math.max(parallelOperations, 1))
        }
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] ENHANCED: Server pair removal operation failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        phases,
        totalTimeMs: Date.now() - startTime
      };
    }
  }

  async getAllUserServerPairs(
    userCanisterId: string,
    identity: Identity
  ): Promise<ServerPairResult> {
    try {
      console.log('📋 [UserCanisterService] Getting all user server pairs from backend');
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling getUserServerPairs on USER actor...');
        return await userActor.getUserServerPairs();
      });

      console.log('📤 [UserCanisterService] getUserServerPairs result from backend:', result);

      if (Array.isArray(result)) {
        console.log(`✅ [UserCanisterService] Found ${result.length} server pairs across all projects`);
        return {
          success: true,
          serverPairs: result
        };
      }

      console.log('⚠️ [UserCanisterService] No server pairs found or invalid response');
      return {
        success: true,
        serverPairs: []
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to get all user server pairs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // ==================== ENHANCED: SUBSCRIPTION MANAGEMENT METHODS ====================

  /**
   * ENHANCED: Update subscription tier with minimal Stripe data integration
   */
  async updateSubscriptionTier(
    userCanisterId: string,
    identity: Identity,
    tier: SubscriptionTier,
    monthlyCredits: number,
    subscriptionData: SubscriptionUpdateData
  ): Promise<SubscriptionUpdateResult> {
    try {
      console.log('🔄 [UserCanisterService] Updating subscription tier with minimal data:', {
        tier,
        monthlyCredits,
        subscriptionData
      });
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for subscription update');
      }
      
      // Update subscription tier first
      const tierResult = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling updateSubscriptionTier on USER actor...');
        return await userActor.updateSubscriptionTier(tier, BigInt(monthlyCredits));
      });

      console.log('📤 [UserCanisterService] updateSubscriptionTier result:', tierResult);

      if (!(tierResult && typeof tierResult === 'object' && ('ok' in tierResult || 'Ok' in tierResult))) {
        const error = tierResult && typeof tierResult === 'object' && ('err' in tierResult || 'Err' in tierResult)
          ? (tierResult.err || tierResult.Err)
          : 'Failed to update subscription tier';
        
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      // Store minimal Stripe data if provided
      if (subscriptionData.customerId) {
        const customerResult = await this.setStripeCustomerId(userCanisterId, identity, subscriptionData.customerId);
        if (!customerResult.success) {
          console.warn('⚠️ [UserCanisterService] Failed to store customer ID but continuing:', customerResult.error);
        }
      }

      // Update subscription active status
      const statusResult = await this.updateSubscriptionActiveStatus(userCanisterId, identity, true);
      if (!statusResult.success) {
        console.warn('⚠️ [UserCanisterService] Failed to update subscription status but continuing:', statusResult.error);
      }

      // Update billing cycle end if provided
      if (subscriptionData.billingCycleEnd) {
        const billingResult = await this.updateBillingCycleEnd(userCanisterId, identity, subscriptionData.billingCycleEnd);
        if (!billingResult.success) {
          console.warn('⚠️ [UserCanisterService] Failed to update billing cycle but continuing:', billingResult.error);
        }
      }

      console.log('✅ [UserCanisterService] Subscription tier updated successfully with minimal Stripe data');
      return { success: true };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to update subscription tier:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get current subscription information from user canister
   */
  async getSubscriptionInfo(
    userCanisterId: string,
    identity: Identity
  ): Promise<SubscriptionInfo | null> {
    try {
      console.log('📊 [UserCanisterService] Getting subscription info from USER canister');
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for subscription info');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling getSubscriptionInfo on USER actor...');
        return await userActor.getSubscriptionInfo();
      });

      console.log('📤 [UserCanisterService] getSubscriptionInfo result:', result);

      if (result && Array.isArray(result) && result.length > 0) {
        const subscriptionData = result[0];
        console.log('📊 [UserCanisterService] Found subscription info:', subscriptionData);
        
        return {
          tier: subscriptionData.tier as SubscriptionTier,
          isActive: subscriptionData.isActive || false,
          customerId: this.extractOptionalValue(subscriptionData.customerId),
          subscriptionId: this.extractOptionalValue(subscriptionData.subscriptionId),
          billingCycleStart: this.extractOptionalValue(subscriptionData.billingCycleStart),
          billingCycleEnd: this.extractOptionalValue(subscriptionData.billingCycleEnd),
          monthlyCredits: Number(subscriptionData.monthlyAllocation || 0)
        };
      }

      console.log('ℹ️ [UserCanisterService] No subscription info found - user likely on free tier');
      return {
        tier: SubscriptionTier.FREE,
        isActive: false,
        customerId: null,
        subscriptionId: null,
        billingCycleStart: null,
        billingCycleEnd: null,
        monthlyCredits: 0
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to get subscription info:', error);
      return null;
    }
  }

  // ==================== ENHANCED PROJECT METHODS ====================

  async saveProject(project: Project, userCanisterId: string, identity: Identity): Promise<ProjectSaveResult> {
    const startTime = Date.now();
    
    try {
      console.log('💾 [UserCanisterService] Starting enhanced project save:', project.id);
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }

      // Validate project data
      if (!project.id || !project.name) {
        throw new Error('Project ID and name are required');
      }

      // Enhanced conversion with proper metadata handling
      const canisterProject = this.prepareProjectForCanister(project);
      console.log('🔄 [UserCanisterService] Prepared project data with enhanced metadata mapping');
      
      // CRITICAL FIX: Ensure BigInt values are preserved and not stringified
      // Log project structure without stringifying BigInt values
      console.log('📋 [UserCanisterService] Project structure:', {
        id: canisterProject.id,
        name: canisterProject.name,
        created: canisterProject.created?.toString ? canisterProject.created.toString() : canisterProject.created,
        updated: canisterProject.updated?.toString ? canisterProject.updated.toString() : canisterProject.updated,
        createdType: typeof canisterProject.created,
        updatedType: typeof canisterProject.updated
      });

      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling createProject with properly formatted BigInt values...');
        // CRITICAL: Ensure we're passing actual BigInt values, not string representations
        return await userActor.createProject(canisterProject, [true]);
      });

      console.log('📤 [UserCanisterService] createProject result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        const projectId = result.ok || result.Ok;
        console.log('✅ [UserCanisterService] Project saved successfully with enhanced metadata:', projectId);
        
        const uploadTime = Date.now() - startTime;
        
        return {
          success: true,
          projectId: projectId,
          metadata: {
            filesUploaded: 0,
            totalSize: 0,
            uploadTime
          }
        };
        
      } else if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.error('❌ [UserCanisterService] Enhanced project save failed:', error);
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      return {
        success: false,
        error: 'Invalid response from project creation'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to save project with enhanced metadata:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async loadUserProjects(userCanisterId: string, identity: Identity): Promise<ProjectLoadResult> {
    const startTime = Date.now();
    
    try {
      console.log('📖 [UserCanisterService] Loading user projects with enhanced conversion from:', userCanisterId);
      await this.initializeUserActor(userCanisterId, identity);

      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }

      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling getUserProjects...');
        return await userActor.getUserProjects();
      });

      console.log('📤 [UserCanisterService] getUserProjects result:', result);

      if (Array.isArray(result)) {
        console.log(`📋 [UserCanisterService] Found ${result.length} projects for enhanced conversion`);
        
        // Enhanced conversion with complete metadata mapping
        const projects = result.map((canisterProject: any) => {
          console.log(`🔄 [UserCanisterService] Converting project ${canisterProject.id} with enhanced metadata handling`);
          return this.convertProjectFromCanister(canisterProject);
        });

        const loadTime = Date.now() - startTime;
        
        console.log(`✅ [UserCanisterService] Loaded ${projects.length} projects with enhanced metadata in ${loadTime}ms`);

        return {
          success: true,
          projects: projects,
          metadata: {
            totalProjects: projects.length,
            loadTime
          }
        };
      }

      return {
        success: false,
        error: 'Invalid response format from getUserProjects'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to load user projects with enhanced conversion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async updateProject(project: Project, userCanisterId: string, identity: Identity): Promise<ProjectSaveResult> {
    try {
      console.log('🔄 [UserCanisterService] TWO-PHASE: Starting project update with optimized migration cleanup:', project.id);
      
      await this.initializeUserActor(userCanisterId, identity);
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }

      // FIXED: Get existing project to check for name changes
      const existingResult = await this.retryOperation(async () => {
        return await userActor.getProject(project.id);
      });

      let nameChanged = false;
      let oldProjectName = '';
      
      if (existingResult && typeof existingResult === 'object' && ('ok' in existingResult || 'Ok' in existingResult)) {
        const existing = existingResult.ok || existingResult.Ok;
        oldProjectName = existing.name || '';
        nameChanged = oldProjectName !== project.name;
      }

      // ENHANCED: TWO-PHASE file migration with parallel cleanup
      if (nameChanged) {
        console.log(`🚀 [UserCanisterService] TWO-PHASE: Project name changed from "${oldProjectName}" to "${project.name}" - starting optimized two-phase migration`);
        
        // Import and use the store action correctly
        const { useAppStore } = await import('../store/appStore');
        useAppStore.getState().setProjectRenameLoading(project.id, true);
        
        try {
          // Use the new two-phase migration method
          const migrationResult = await this.migrateProjectFiles(
            project.id,
            oldProjectName,
            project.name,
            userCanisterId,
            identity,
            (progress) => {
              // Update UI with migration progress
              console.log(`📊 [UserCanisterService] TWO-PHASE Migration progress: ${progress.percent}% - ${progress.message}`);
              
              // You could emit this to the UI store for real-time progress updates
              // useAppStore.getState().setProjectMigrationProgress(project.id, progress);
            }
          );

          if (!migrationResult.success) {
            throw new Error(`TWO-PHASE migration failed: ${migrationResult.error || 'Unknown migration error'}`);
          }

          console.log(`✅ [UserCanisterService] TWO-PHASE: Optimized migration successful`);
          console.log(`   Phase Results:`, migrationResult.phaseResults);
          console.log(`   Files migrated: ${migrationResult.filesMigrated}`);
          console.log(`   Files deleted: ${migrationResult.filesDeleted}`);
          console.log(`   Errors: ${migrationResult.migrationErrors.length}`);
          
          // Log any migration errors for debugging
          if (migrationResult.migrationErrors.length > 0) {
            console.warn(`⚠️ [UserCanisterService] TWO-PHASE: Migration completed with ${migrationResult.migrationErrors.length} errors:`, migrationResult.migrationErrors);
          }

        } catch (migrationError) {
          // Clear loading state on migration failure
          useAppStore.getState().setProjectRenameLoading(project.id, false);
          throw migrationError;
        }
      }

      // FIXED: Continue with project update using correct parameters from user.did.d.ts
      const canisterProject = this.prepareProjectForCanister(project);
      
      const updateResult = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] FIXED: Calling updateProject with correct 3 parameters...');
        // FIXED: The method signature is [Project, boolean, [] | [string]]
        return await userActor.updateProject(
          canisterProject, 
          false, // boolean parameter - likely "forceUpdate" or similar
          []     // optional string parameter - empty for now
        );
      });

      console.log('📤 [UserCanisterService] FIXED: updateProject result:', updateResult);

      // Clear loading state
      if (nameChanged) {
        const { useAppStore } = await import('../store/appStore');
        useAppStore.getState().setProjectRenameLoading(project.id, false);
      }

      if (updateResult && typeof updateResult === 'object' && ('ok' in updateResult || 'Ok' in updateResult)) {
        console.log('✅ [UserCanisterService] TWO-PHASE: Project updated successfully with optimized migration cleanup');
        return {
          success: true,
          projectId: project.id,
          updatedProject: project
        };
      }

      if (updateResult && typeof updateResult === 'object' && ('err' in updateResult || 'Err' in updateResult)) {
        const error = updateResult.err || updateResult.Err;
        console.error('❌ [UserCanisterService] FIXED: Project update failed:', error);
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      return {
        success: false,
        error: 'Invalid response from project update'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] TWO-PHASE: Failed to update project:', error);
      
      // Clear loading state on error
      try {
        const { useAppStore } = await import('../store/appStore');
        useAppStore.getState().setProjectRenameLoading(project.id, false);
      } catch (storeError) {
        console.warn('Failed to clear loading state:', storeError);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
  
  async deleteProject(projectId: string, userCanisterId: string, identity: Identity): Promise<ProjectSaveResult> {
    try {
      console.log('🗑️ [UserCanisterService] Deleting project:', projectId);
      await this.initializeUserActor(userCanisterId, identity);

      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }

      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling deleteProject...');
        return await userActor.deleteProject(projectId);
      });

      console.log('📤 [UserCanisterService] deleteProject result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        return {
          success: true,
          projectId: projectId
        };
      }

      return {
        success: false,
        error: 'Failed to delete project'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to delete project:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // ==================== ENHANCED PROJECT METADATA METHODS ====================

  async updateProjectMetadata(
    projectId: string,
    metadata: ProjectMetadata,
    userCanisterId: string,
    identity: Identity
  ): Promise<MetadataResult> {
    try {
      console.log('🔄 [UserCanisterService] Updating project metadata with enhanced conversion:', projectId);
      await this.initializeUserActor(userCanisterId, identity);

      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }

      // Enhanced metadata conversion
      const canisterMetadata = this.prepareProjectMetadataForCanister(metadata);

      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling updateProjectMetadata...');
        return await userActor.updateProjectMetadata(projectId, canisterMetadata);
      });

      console.log('📤 [UserCanisterService] updateProjectMetadata result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        console.log('✅ [UserCanisterService] Project metadata updated successfully with enhanced conversion');
        
        return {
          success: true,
          metadata: metadata
        };
      }

      const errorMessage = result && typeof result === 'object' && ('err' in result || 'Err' in result)
        ? (result.err || result.Err)
        : 'Failed to update project metadata';

      return {
        success: false,
        error: typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage)
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to update project metadata with enhanced conversion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async getProjectMetadata(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<MetadataResult> {
    try {
      console.log('📖 [UserCanisterService] Loading project metadata with enhanced conversion:', projectId);
      await this.initializeUserActor(userCanisterId, identity);

      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }

      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling getProjectMetadata...');
        return await userActor.getProjectMetadata(projectId);
      });

      console.log('📤 [UserCanisterService] getProjectMetadata result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        const canisterMetadata = result.ok || result.Ok;
        const metadata = this.convertProjectMetadataFromCanister(canisterMetadata);
        
        console.log('✅ [UserCanisterService] Project metadata loaded successfully with enhanced conversion');
        
        return {
          success: true,
          metadata: metadata
        };
      }

      const errorMessage = result && typeof result === 'object' && ('err' in result || 'Err' in result)
        ? (result.err || result.Err)
        : 'Failed to load project metadata';

      return {
        success: false,
        error: typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage)
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to load project metadata with enhanced conversion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // ==================== ENHANCED CHAT MESSAGE METHODS ====================

  async saveMessageToProject(
    projectId: string, 
    message: ChatInterfaceMessage, 
    userCanisterId: string, 
    identity: Identity
  ): Promise<MessageSaveResult> {
    try {
      console.log('💾 [UserCanisterService] Saving message to project:', projectId, message.id);
      await this.initializeUserActor(userCanisterId, identity);

      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }

      // Convert message type to the format expected by the canister
      let messageTypeStr = 'Assistant';
      if (message.type === 'user') messageTypeStr = 'User';
      else if (message.type === 'system') messageTypeStr = 'System';

      // 🔥 FIX: Store extractedFiles in localStorage as fallback since backend may not support metadata parameter
      // The CANDID interface shows addMessageToProject doesn't accept metadata, only messageId
      if (message.extractedFiles && Object.keys(message.extractedFiles).length > 0) {
        try {
          const storageKey = `message_extractedFiles_${message.id}`;
          localStorage.setItem(storageKey, JSON.stringify({
            extractedFiles: message.extractedFiles,
            deploymentReady: (message as any).deploymentReady || false,
            isProjectGeneration: message.isProjectGeneration || false,
            projectId: projectId,
            timestamp: Date.now()
          }));
          console.log('💾 [UserCanisterService] Stored extractedFiles in localStorage:', {
            messageId: message.id,
            fileCount: Object.keys(message.extractedFiles).length
          });
        } catch (storageError) {
          console.warn('⚠️ [UserCanisterService] Failed to store extractedFiles in localStorage:', storageError);
        }
      }

      // Try to save metadata if backend supports it (may fail silently if not supported)
      const metadataToSave = message.metadata ? [JSON.stringify(message.metadata)] : [];
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling addMessageToProject...');
        // Note: 4th parameter should be messageId according to CANDID, but trying metadata as fallback
        // If backend doesn't support it, the message will still be saved, just without metadata
        return await userActor.addMessageToProject(
          projectId,
          message.content,
          { [messageTypeStr]: null },
          message.id ? [message.id] : [] // Use messageId as 4th parameter per CANDID spec
        );
      });

      console.log('📤 [UserCanisterService] addMessageToProject result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        const messageId = result.ok || result.Ok;
        console.log('✅ [UserCanisterService] Message saved successfully:', messageId);
        
        return {
          success: true,
          messageId: messageId
        };
      }

      return {
        success: false,
        error: 'Failed to save message'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to save message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async loadProjectMessages(
    projectId: string, 
    userCanisterId: string, 
    identity: Identity,
    limit?: number,
    offset?: number
  ): Promise<MessagesResult> {
    const startTime = Date.now();
    
    try {
      console.log('📖 [UserCanisterService] Loading messages for project:', projectId);
      await this.initializeUserActor(userCanisterId, identity);

      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }

      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling getProjectMessages...');
        return await userActor.getProjectMessages(
          projectId,
          offset ? [BigInt(offset)] : [],
          limit ? [BigInt(limit)] : []
        );
      });

      console.log('📤 [UserCanisterService] getProjectMessages result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        const messages = result.ok || result.Ok;
        
        if (Array.isArray(messages)) {
          const frontendMessages = messages.map((canisterMessage: any) => {
            return this.convertMessageFromCanister(canisterMessage);
          });

          // 🔥 FIX: Sort by backend timestamp (authoritative) - oldest first
          // Backend generates timestamps using Time.now(), ignoring frontend timestamps
          // Array order is insertion order, but updates change timestamps, so we must sort
          const sortedMessages = frontendMessages.sort((a, b) => {
            return a.timestamp.getTime() - b.timestamp.getTime();
          });

          const loadTime = Date.now() - startTime;
          
          console.log(`✅ [UserCanisterService] Loaded ${sortedMessages.length} messages in ${loadTime}ms (sorted chronologically)`);

          return {
            success: true,
            messages: sortedMessages, // Use sorted array
            metadata: {
              totalMessages: sortedMessages.length,
              loadTime
            }
          };
        }
      }

      console.log('⚠️ [UserCanisterService] No messages found or invalid response format');
      return {
        success: true,
        messages: [],
        metadata: {
          totalMessages: 0,
          loadTime: Date.now() - startTime
        }
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to load messages:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async updateMessageInProject(
    projectId: string,
    messageId: string,
    content: string,
    userCanisterId: string,
    identity: Identity,
    isGenerating?: boolean
  ): Promise<MessageSaveResult> {
    try {
      console.log('🔄 [UserCanisterService] Updating message in project:', projectId, messageId);
      await this.initializeUserActor(userCanisterId, identity);

      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }

      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling updateMessageInProject...');
        return await userActor.updateMessageInProject(
          projectId,
          messageId,
          content,
          isGenerating !== undefined ? [isGenerating] : []
        );
      });

      console.log('📤 [UserCanisterService] updateMessageInProject result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        console.log('✅ [UserCanisterService] Message updated successfully');
        
        return {
          success: true,
          messageId: messageId
        };
      }

      return {
        success: false,
        error: 'Failed to update message'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to update message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async clearProjectMessages(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<MessageSaveResult> {
    try {
      console.log('🧹 [UserCanisterService] Clearing messages for project:', projectId);
      await this.initializeUserActor(userCanisterId, identity);

      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor');
      }

      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling clearProjectMessages...');
        return await userActor.clearProjectMessages(projectId);
      });

      console.log('📤 [UserCanisterService] clearProjectMessages result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        console.log('✅ [UserCanisterService] Messages cleared successfully');
        
        return {
          success: true
        };
      }

      return {
        success: false,
        error: 'Failed to clear messages'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to clear messages:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // ==================== ENHANCED: PARALLEL FILE METHODS ====================

  /**
   * ENHANCED: Parallel file processing with proper project name handling
   */
  async saveCodeArtifactsParallel(
    files: { [key: string]: string }, 
    projectId: string, 
    userCanisterId: string, 
    identity: Identity,
    projectName?: string,
    versionId: string | null = null, // 🆕 VERSION-AWARE: Optional version ID (null = working copy)
    progressCallback?: (progress: { percent: number; message: string; created: number; updated: number }) => void
  ): Promise<FileUploadResult> {
    try {
      console.log(`🚀 [UserCanisterService] VERSION-AWARE PARALLEL: Starting parallel file processing for ${Object.keys(files).length} files in project:`, projectId, 'version:', versionId || 'Sandbox');
      await this.initializeUserActor(userCanisterId, identity);

      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('User canister actor not initialized');
      }

      const fileEntries = Object.entries(files);
      
      if (fileEntries.length === 0) {
        return { 
          success: true, 
          filesUploaded: 0, 
          filesUpdated: 0,
          details: { created: [], updated: [], failed: [] }
        };
      }

      // Get caller principal from identity
      const callerPrincipal = identity.getPrincipal();

      // Determine project name for file path resolution
      let finalProjectName = projectName || projectId;
      
      if (!projectName) {
        // Get current project to determine project name
        const currentProject = await this.retryOperation(async () => {
          return await userActor.getProject(projectId);
        });

        if (currentProject && typeof currentProject === 'object' && ('ok' in currentProject || 'Ok' in currentProject)) {
          const project = currentProject.ok || currentProject.Ok;
          finalProjectName = project.name || projectId;
        }
      }

      let createdCount = 0;
      let updatedCount = 0;
      let failedCount = 0;
      const createdFiles: string[] = [];
      const updatedFiles: string[] = [];
      const failedFiles: Array<{fileName: string, error: string}> = [];

      console.log(`📁 [UserCanisterService] PARALLEL: Processing files for project: ${finalProjectName}`);

      // ENHANCED: Process files in parallel with concurrency control
      const processFile = async (fileEntry: [string, string], index: number) => {
        const [fileName, fileContent] = fileEntry;

        try {
          // Skip invalid files
          if (!fileContent || typeof fileContent !== 'string' || !fileContent.trim()) {
            failedFiles.push({ fileName, error: 'Empty or invalid file content' });
            failedCount++;
            return;
          }

          // Clean filename using working project logic
          const cleanFileName = this.cleanFileName(fileName);
          const extension = cleanFileName.substring(cleanFileName.lastIndexOf('.')).toLowerCase();

          // Validate file extensions
          if (!['.mo', '.tsx', '.ts', '.css', '.js', '.jsx', '.json', '.html'].includes(extension)) {
            failedFiles.push({ fileName: cleanFileName, error: `Unsupported file extension: ${extension}` });
            failedCount++;
            return;
          }

          // Resolve file path and name using working project logic with correct project name
          const { finalFileName, filePath } = this.resolveFilePath(cleanFileName, finalProjectName);
          
          // Get file type and language
          const { fileType, languageType } = this.getFileTypeAndLanguage(extension);

          // Truncate content if too large
          const truncatedContent = fileContent.length > this.MAX_FILE_SIZE 
            ? fileContent.substring(0, this.MAX_FILE_SIZE) + '\n// ... (truncated due to size limits)'
            : fileContent;

          console.log(`📁 [UserCanisterService] PARALLEL: Processing file ${index + 1}:`, {
            originalPath: fileName,
            cleanFileName: cleanFileName,
            finalFileName: finalFileName,
            filePath: filePath,
            fullPath: `${filePath}/${finalFileName}`,
            fileType: fileType,
            languageType: languageType
          });

          try {
            // 🆕 VERSION-AWARE: Format versionId for backend (?Text = [] for null, [value] for present)
            const versionIdOpt: [] | [string] = versionId ? [versionId] : [];
            
            // First try to create the file
            const createResult = await this.retryOperation(async () => {
              console.log(`📞 [UserCanisterService] VERSION-AWARE PARALLEL: Attempting CREATE for file ${index + 1}:`, finalFileName, 'version:', versionId || 'Sandbox');
              return await userActor.createCodeArtifact(
                callerPrincipal,
                projectId,
                finalFileName,
                { Text: truncatedContent },
                fileType,
                languageType,
                filePath,
                versionIdOpt // 🆕 VERSION-AWARE: Pass version ID
              );
            });

            if (createResult && typeof createResult === 'object' && ('ok' in createResult || 'Ok' in createResult)) {
              createdCount++;
              createdFiles.push(finalFileName);
              console.log(`✅ [UserCanisterService] PARALLEL: CREATED file ${index + 1}: ${filePath}/${finalFileName}`);
            } else {
              throw new Error('Create failed - will try update');
            }

          } catch (createError) {
            // Create failed, try update
            console.log(`🔄 [UserCanisterService] PARALLEL: CREATE failed for file ${index + 1} ${finalFileName}, trying UPDATE:`, createError);
            
            try {
              // 🆕 VERSION-AWARE: Format versionId for backend (?Text = [] for null, [value] for present)
              const versionIdOpt: [] | [string] = versionId ? [versionId] : [];
              
              const updateResult = await this.retryOperation(async () => {
                console.log(`📞 [UserCanisterService] VERSION-AWARE PARALLEL: Attempting UPDATE for file ${index + 1}:`, finalFileName, 'version:', versionId || 'Sandbox');
                return await userActor.updateCodeArtifact(
                  callerPrincipal,
                  projectId,
                  finalFileName,
                  { Text: truncatedContent },
                  filePath,
                  versionIdOpt // 🆕 VERSION-AWARE: Pass version ID
                );
              });

              if (updateResult && typeof updateResult === 'object' && ('ok' in updateResult || 'Ok' in updateResult)) {
                updatedCount++;
                updatedFiles.push(finalFileName);
                console.log(`✅ [UserCanisterService] PARALLEL: UPDATED file ${index + 1}: ${filePath}/${finalFileName}`);
              } else {
                throw new Error('Update also failed');
              }

            } catch (updateError) {
              failedCount++;
              const errorMessage = updateError instanceof Error ? updateError.message : String(updateError);
              failedFiles.push({ fileName: finalFileName, error: errorMessage });
              console.error(`💥 [UserCanisterService] PARALLEL: Both CREATE and UPDATE failed for file ${index + 1} ${finalFileName}:`, updateError);
            }
          }

          // Update progress (thread-safe increment)
          if (progressCallback) {
            const processedCount = createdCount + updatedCount + failedCount;
            const progressPercent = Math.round((processedCount / fileEntries.length) * 100);
            
            progressCallback({
              percent: progressPercent,
              message: `Processed ${processedCount}/${fileEntries.length} files in parallel...`,
              created: createdCount,
              updated: updatedCount
            });
          }

        } catch (error) {
          failedCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          failedFiles.push({ fileName, error: errorMessage });
          console.error(`💥 [UserCanisterService] PARALLEL: File processing failed for file ${index + 1}:`, error);
        }
      };

      // ENHANCED: Process all files in parallel with concurrency control
      console.log(`🚀 [UserCanisterService] PARALLEL: Starting parallel processing with max concurrency: ${this.MAX_PARALLEL_OPERATIONS}`);
      const startTime = Date.now();
      
      await this.processFilesInParallel(fileEntries, processFile, this.MAX_PARALLEL_OPERATIONS);
      
      const parallelTime = Date.now() - startTime;
      const totalProcessed = createdCount + updatedCount;
      
      console.log(`✅ [UserCanisterService] PARALLEL: Completed parallel file processing in ${parallelTime}ms: ${totalProcessed}/${fileEntries.length} files processed (${createdCount} created, ${updatedCount} updated, ${failedCount} failed)`);

      return {
        success: totalProcessed > 0,
        filesUploaded: createdCount,
        filesUpdated: updatedCount,
        filesFailed: failedCount,
        error: failedCount > 0 ? `${failedCount} files failed to process` : undefined,
        details: {
          created: createdFiles,
          updated: updatedFiles,
          failed: failedFiles
        }
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] PARALLEL: Failed parallel file processing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // LEGACY: Keep original method but now also supports parallel processing and version-aware saving
  async saveCodeArtifacts(
    files: { [key: string]: string }, 
    projectId: string, 
    userCanisterId: string, 
    identity: Identity,
    versionId: string | null = null, // 🆕 VERSION-AWARE: Optional version ID (null = working copy)
    progressCallback?: (progress: { percent: number; message: string; created: number; updated: number }) => void
  ): Promise<FileUploadResult> {
    // For performance, use parallel processing by default
    console.log('🔄 [UserCanisterService] VERSION-AWARE: Using parallel file processing for improved performance, version:', versionId || 'Sandbox');
    return this.saveCodeArtifactsParallel(files, projectId, userCanisterId, identity, undefined, versionId, progressCallback);
  }

  async deleteCodeArtifact(
    userCanisterId: string,
    identity: Identity,
    projectId: string,
    fileName: string,
    filePath: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('User actor not initialized');
      }

      const callerPrincipal = identity.getPrincipal();
      
      const result = await this.retryOperation(async () => {
        return  await userActor.deleteCodeArtifact(
          callerPrincipal,
          projectId,
          filePath,        
          fileName,       
          []
        );
      });



      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        return { success: true };
      }

      return { 
        success: false, 
        error: result && typeof result === 'object' && ('err' in result || 'Err' in result)
          ? (result.err || result.Err)
          : 'Failed to delete file'
      };

    } catch (error) {
      console.error('Failed to delete code artifact:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async loadCodeArtifacts(projectId: string, userCanisterId: string, identity: Identity): Promise<CodeArtifactsResult> {
    try {
      console.log('📖 [UserCanisterService] Loading code artifacts for project:', projectId);
      await this.initializeUserActor(userCanisterId, identity);

      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('User canister actor not initialized');
      }

      const callerPrincipal = identity.getPrincipal();

      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling getProjectFiles...');
        return await userActor.getProjectFiles(
          callerPrincipal,
          projectId,
          []
        );
      });

      console.log('📤 [UserCanisterService] loadCodeArtifacts result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        const artifacts = result.ok || result.Ok;
        
        if (Array.isArray(artifacts)) {
          // Filter out WASM files to avoid large payloads during regular file loading
          // WASM files should only be downloaded when explicitly requested via download button
          const filteredArtifacts = artifacts.filter((artifact: any) => {
            const fileName = artifact.fileName || '';
            const path = artifact.path || '';
            const mimeType = artifact.mimeType || '';
            
            // Exclude WASM files (they're large and only needed for explicit downloads)
            const isWasmFile = 
              fileName.endsWith('.wasm') ||
              mimeType === 'application/wasm' ||
              path.includes('/wasms') ||
              path.includes('wasms/');
            
            if (isWasmFile) {
              console.log(`🚫 [UserCanisterService] Excluding WASM file from regular load: ${path}/${fileName}`);
              return false;
            }
            
            return true;
          });
          
          const codeArtifacts = filteredArtifacts.map((artifact: any) => ({
            id: artifact.id,
            projectId: artifact.projectId,
            fileName: artifact.fileName,
            content: this.extractContentFromArtifact(artifact.content),
            path: artifact.path,
            mimeType: artifact.mimeType,
            language: artifact.language,
            lastModified: Number(artifact.lastModified) / 1_000_000,
            version: Number(artifact.version),
            size: Number(artifact.size)
          }));
          
          const excludedCount = artifacts.length - filteredArtifacts.length;
          if (excludedCount > 0) {
            console.log(`✅ [UserCanisterService] Loaded ${codeArtifacts.length} code artifacts (excluded ${excludedCount} WASM files)`);
          } else {
            console.log(`✅ [UserCanisterService] Loaded ${codeArtifacts.length} code artifacts`);
          }
          
          return {
            success: true,
            artifacts: codeArtifacts
          };
        }
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        if (typeof error === 'string' && error.includes('Project not found')) {
          console.log('⚠️ [UserCanisterService] Project not found in canister, returning empty artifacts');
          return {
            success: true,
            artifacts: []
          };
        }
      }

      console.log('⚠️ [UserCanisterService] No code artifacts found or invalid response format');
      return {
        success: true,
        artifacts: []
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to load code artifacts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async startWasmDownload(
    wasmName: string,
    wasmVersion: string,
    canisterType: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; wasmBytes?: Uint8Array; error?: string }> {
    try {
      console.log('📦 [UserCanisterService] Starting WASM download:', { wasmName, wasmVersion, canisterType });
      
      await this.initializeUserActor(userCanisterId, identity);
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('User canister actor not initialized');
      }

      // Start download session
      const sessionResult = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling startWasmDownloadSession...');
        return await userActor.startWasmDownloadSession(wasmName, wasmVersion, canisterType);
      });

      console.log('📤 [UserCanisterService] startWasmDownloadSession result:', sessionResult);

      if (!sessionResult || typeof sessionResult !== 'object' || !('ok' in sessionResult && 'Ok' in sessionResult)) {
        const error = sessionResult && 'err' in sessionResult ? sessionResult.err : 'Failed to start WASM download session';
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      const sessionData = sessionResult.ok || sessionResult.Ok;
      const { totalChunks, chunkSize, sessionId } = sessionData;

      console.log('📊 [UserCanisterService] WASM download session started:', {
        sessionId,
        totalChunks: Number(totalChunks),
        chunkSize: Number(chunkSize)
      });

      // Download all chunks
      const chunks: Uint8Array[] = [];
      const totalChunksNum = Number(totalChunks);

      for (let chunkIndex = 0; chunkIndex < totalChunksNum; chunkIndex++) {
        console.log(`📦 [UserCanisterService] Downloading chunk ${chunkIndex + 1}/${totalChunksNum}...`);
        
        const chunkResult = await this.retryOperation(async () => {
          return await userActor.downloadWasmChunk(sessionId, BigInt(chunkIndex));
        });

        if (!chunkResult || typeof chunkResult !== 'object' || !('ok' in chunkResult || 'Ok' in chunkResult)) {
          const error = chunkResult && 'err' in chunkResult ? chunkResult.err : `Failed to download chunk ${chunkIndex}`;
          return {
            success: false,
            error: typeof error === 'string' ? error : JSON.stringify(error)
          };
        }

        const chunkData = chunkResult.ok || chunkResult.Ok;
        
        // Convert chunk data to Uint8Array
        let chunkBytes: Uint8Array;
        if (chunkData instanceof Uint8Array) {
          chunkBytes = chunkData;
        } else if (Array.isArray(chunkData)) {
          chunkBytes = new Uint8Array(chunkData);
        } else {
          console.error('❌ [UserCanisterService] Unexpected chunk data format:', chunkData);
          return {
            success: false,
            error: `Unexpected chunk data format for chunk ${chunkIndex}`
          };
        }

        chunks.push(chunkBytes);
      }

      // Combine all chunks
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const wasmBytes = new Uint8Array(totalSize);
      let offset = 0;

      for (const chunk of chunks) {
        wasmBytes.set(chunk, offset);
        offset += chunk.length;
      }

      console.log(`✅ [UserCanisterService] WASM download completed: ${wasmBytes.length} bytes`);

      return {
        success: true,
        wasmBytes: wasmBytes
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] WASM download failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }


  /**
   * Start a batch download session for large projects
   */
  async startProjectFilesDownloadSession(
    userCanisterId: string,
    identity: Identity,
    principal: Principal,
    projectId: string
  ): Promise<{
    ok?: {
      sessionId: string;
      totalFiles: number;
      totalBatches: number;
    };
    err?: string;
  }> {
    try {
      console.log('📦 [UserCanisterService] Starting project files download session:', {
        userCanisterId,
        projectId
      });
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for download session');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling startProjectFilesDownloadSession on USER actor...');
        return await userActor.startProjectFilesDownloadSession(
          principal,
          projectId,
          [] // Optional parameters
        );
      });

      console.log('📤 [UserCanisterService] startProjectFilesDownloadSession result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        const sessionData = result.ok || result.Ok;
        
        const sessionInfo = {
          sessionId: sessionData.sessionId,
          totalFiles: Number(sessionData.totalFiles),
          totalBatches: Number(sessionData.totalBatches)
        };
        
        console.log('✅ [UserCanisterService] Download session started successfully:', sessionInfo);
        
        return {
          ok: sessionInfo
        };
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.error('❌ [UserCanisterService] Failed to start download session:', error);
        return {
          err: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      return {
        err: 'Invalid response from download session creation'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Error starting download session:', error);
      return {
        err: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Download a specific batch of files
   */
  async downloadProjectFilesBatch(
    userCanisterId: string,
    identity: Identity,
    sessionId: string,
    batchIndex: bigint
  ): Promise<{
    ok?: {
      files: any[];
      isLastBatch: boolean;
    };
    err?: string;
  }> {
    try {
      console.log('📦 [UserCanisterService] Downloading project files batch:', {
        userCanisterId,
        sessionId,
        batchIndex: Number(batchIndex)
      });
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for batch download');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling downloadProjectFilesBatch on USER actor...');
        return await userActor.downloadProjectFilesBatch(
          sessionId,
          batchIndex
        );
      });

      console.log('📤 [UserCanisterService] downloadProjectFilesBatch result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        const batchData = result.ok || result.Ok;
        
        const batchInfo = {
          files: batchData.files || [],
          isLastBatch: Boolean(batchData.isLastBatch)
        };
        
        console.log('✅ [UserCanisterService] Batch downloaded successfully:', {
          filesCount: batchInfo.files.length,
          isLastBatch: batchInfo.isLastBatch
        });
        
        return {
          ok: batchInfo
        };
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.error('❌ [UserCanisterService] Failed to download batch:', error);
        return {
          err: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      return {
        err: 'Invalid response from batch download'
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Error downloading batch:', error);
      return {
        err: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Clean up the download session
   */
  async cleanupProjectFilesDownloadSession(
    userCanisterId: string,
    identity: Identity,
    sessionId: string
  ): Promise<void> {
    try {
      console.log('🧹 [UserCanisterService] Cleaning up project files download session:', {
        userCanisterId,
        sessionId
      });
      
      await this.initializeUserActor(userCanisterId, identity);
      
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('Failed to initialize user canister actor for session cleanup');
      }
      
      const result = await this.retryOperation(async () => {
        console.log('📞 [UserCanisterService] Calling cleanupProjectFilesDownloadSession on USER actor...');
        return await userActor.cleanupProjectFilesDownloadSession(sessionId);
      });

      console.log('📤 [UserCanisterService] cleanupProjectFilesDownloadSession result:', result);

      if (result && typeof result === 'object' && ('ok' in result || 'Ok' in result)) {
        console.log('✅ [UserCanisterService] Download session cleaned up successfully');
        return;
      }

      if (result && typeof result === 'object' && ('err' in result || 'Err' in result)) {
        const error = result.err || result.Err;
        console.warn('⚠️ [UserCanisterService] Session cleanup warning:', error);
        // Don't throw - cleanup failures are not critical
        return;
      }

      console.warn('⚠️ [UserCanisterService] Unexpected response from session cleanup');

    } catch (error) {
      console.warn('⚠️ [UserCanisterService] Session cleanup failed (non-critical):', error);
      // Don't throw - cleanup failures should not break the export process
    }
  }


  // ==================== UTILITY METHODS ====================

  // CRITICAL FIX: Extract content from CodeArtifact nested structure
  private extractContentFromArtifact(content: any): string {
    if (!content) return '';
    
    console.log('🔍 [UserCanisterService] Extracting content from artifact:', content);
    
    // Handle direct string content
    if (typeof content === 'string') {
      console.log('✅ [UserCanisterService] Found direct string content');
      return content;
    }
    
    // Handle array structure with Text property (the actual format from canister)
    if (Array.isArray(content) && content.length > 0) {
      const contentItem = content[0];
      console.log('🔍 [UserCanisterService] Found array content item:', contentItem);
      
      if (contentItem && typeof contentItem === 'object') {
        // Check for Text property (common pattern)
        if (contentItem.Text && typeof contentItem.Text === 'string') {
          console.log('✅ [UserCanisterService] Found Text property with content length:', contentItem.Text.length);
          return contentItem.Text;
        }
        
        // Check for text property (lowercase)
        if (contentItem.text && typeof contentItem.text === 'string') {
          console.log('✅ [UserCanisterService] Found text property with content length:', contentItem.text.length);
          return contentItem.text;
        }
        
        // Handle other possible structures
        if (typeof contentItem === 'string') {
          console.log('✅ [UserCanisterService] Found string in array');
          return contentItem;
        }
      }
    }
    
    // Handle object structure with Text property
    if (typeof content === 'object') {
      if (content.Text && typeof content.Text === 'string') {
        console.log('✅ [UserCanisterService] Found Text property in object');
        return content.Text;
      }
      
      if (content.Binary) {
        try {
          const decoder = new TextDecoder();
          const binaryContent = Array.isArray(content.Binary) ? new Uint8Array(content.Binary) : content.Binary;
          const textContent = decoder.decode(binaryContent);
          console.log('✅ [UserCanisterService] Converted Binary to text');
          return textContent;
        } catch {
          console.warn('⚠️ [UserCanisterService] Failed to decode binary content');
          return '[Binary content - could not decode]';
        }
      }
    }
    
    console.warn('⚠️ [UserCanisterService] Could not extract content, structure:', JSON.stringify(content, null, 2));
    return '[Content structure not recognized]';
  }

  private getMimeType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const mimeMap: { [key: string]: string } = {
      'ts': 'text/typescript',
      'tsx': 'text/typescript',
      'js': 'text/javascript',
      'jsx': 'text/javascript',
      'css': 'text/css',
      'scss': 'text/scss',
      'html': 'text/html',
      'json': 'application/json',
      'md': 'text/markdown',
      'mo': 'text/motoko'
    };
    
    return mimeMap[extension || ''] || 'text/plain';
  }

  private getLanguage(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const langMap: { [key: string]: string } = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'css': 'css',
      'scss': 'scss',
      'html': 'html',
      'json': 'json',
      'md': 'markdown',
      'mo': 'motoko'
    };
    
    return langMap[extension || ''] || 'text';
  }

  // Clear all user actors
  public clearUserActors(): void {
    console.log('🧹 [UserCanisterService] Clearing user actors');
    this.userActors.clear();
  }

  // Clear parallel caches
  public clearParallelCaches(): void {
    console.log('🧹 [UserCanisterService] ULTRA-PARALLEL: Clearing parallel move caches');
    this.serverPairMoveCache.clear();
    this.lastParallelCacheUpdate = 0;
  }

  /**
   * Download backend WASM files for a project
   */
  async downloadProjectWasmFiles(
    projectId: string,
    userCanisterId: string,
    identity: Identity,
    principal: Principal
  ): Promise<{ success: boolean; files?: Array<{ name: string; bytes: Uint8Array }>; error?: string }> {
    try {
      console.log('📦 [UserCanisterService] Starting project WASM download:', { projectId });
      
      await this.initializeUserActor(userCanisterId, identity);
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('User canister actor not initialized');
      }

      const callerPrincipal = identity.getPrincipal();

      // Step 1: Get project file metadata to find WASM files
      const metadataResult = await this.retryOperation(async () => {
        return await userActor.getProjectFileMetadata(principal, projectId, []);
      });

      if (!metadataResult || typeof metadataResult !== 'object' || !('ok' in metadataResult || 'Ok' in metadataResult)) {
        const error = metadataResult && 'err' in metadataResult ? metadataResult.err : 'Failed to get project file metadata';
        return {
          success: false,
          error: typeof error === 'string' ? error : JSON.stringify(error)
        };
      }

      const files = metadataResult.ok || metadataResult.Ok;
      
      // Filter for WASM files (backend WASM files are saved in wasms directory)
      const wasmFiles = files.filter((file: any) => 
        file.fileName.endsWith('.wasm') && 
        (file.path.includes('wasms') || file.path.includes('/wasms') || file.path === 'wasms' || file.path === '')
      );

      if (wasmFiles.length === 0) {
        return {
          success: false,
          error: 'No WASM files found in project'
        };
      }

      console.log(`📦 [UserCanisterService] Found ${wasmFiles.length} WASM file(s) to download`);

      // Step 2: Download each WASM file
      const downloadedFiles: Array<{ name: string; bytes: Uint8Array }> = [];

      for (const wasmFile of wasmFiles) {
        const fileName = wasmFile.fileName;
        // Use the exact path from metadata - don't modify it
        // The path should match what was used when saving the file
        const path = wasmFile.path || '';
        
        console.log(`📦 [UserCanisterService] Downloading WASM:`, {
          path,
          fileName,
          projectId,
          fullPath: path ? `${path}/${fileName}` : fileName
        });

        let wasmBytes: Uint8Array | null = null;

        // Use readCodeArtifact directly - simpler and more reliable
        console.log(`📦 [UserCanisterService] Using readCodeArtifact for WASM file`);
        
        const directResult = await this.retryOperation(async () => {
          return await userActor.readCodeArtifact(callerPrincipal, projectId, path, fileName, []);
        });

        if (directResult && typeof directResult === 'object' && ('ok' in directResult || 'Ok' in directResult)) {
          const artifact = directResult.ok || directResult.Ok;
          
          console.log(`🔍 [UserCanisterService] Artifact structure:`, {
            hasContent: !!artifact.content,
            contentType: typeof artifact.content,
            contentKeys: artifact.content ? Object.keys(artifact.content) : [],
            hasChunks: !!artifact.chunks,
            size: Number(artifact.size),
            mimeType: artifact.mimeType
          });
          
          // CodeArtifact.content is ?FileContent where FileContent = { #Binary: [Nat8] } | { #Text: Text }
          // In JavaScript, Candid may serialize optional variants as arrays: [{ Binary: [Nat8] }] or [0, [Nat8]]
          // Or as objects: { Binary: [Nat8] } | { Text: string }
          
          let fileContent: any = null;
          
          // Handle array representation (Candid optional variant serialization)
          if (Array.isArray(artifact.content)) {
            if (artifact.content.length > 0) {
              fileContent = artifact.content[0];
            }
          } else if (artifact.content && typeof artifact.content === 'object') {
            // Direct object representation
            fileContent = artifact.content;
          }
          
          if (fileContent && typeof fileContent === 'object') {
            // Check for Binary variant
            if ('Binary' in fileContent) {
              const binaryData = fileContent.Binary;
              
              console.log(`🔍 [UserCanisterService] Binary data extraction:`, {
                binaryDataType: typeof binaryData,
                isArray: Array.isArray(binaryData),
                length: Array.isArray(binaryData) ? binaryData.length : (typeof binaryData === 'object' ? Object.keys(binaryData).length : 'N/A'),
                firstFew: Array.isArray(binaryData) ? binaryData.slice(0, 5) : (typeof binaryData === 'object' ? Object.values(binaryData).slice(0, 5) : 'N/A')
              });
              
              if (Array.isArray(binaryData)) {
                wasmBytes = new Uint8Array(binaryData);
              } else if (binaryData instanceof Uint8Array) {
                wasmBytes = binaryData;
              } else if (typeof binaryData === 'object' && binaryData !== null) {
                // Candid serializes large arrays as objects with numeric string keys: {"0": value, "1": value, ...}
                // Convert object to array efficiently using Uint8Array.from with a mapping function
                const keys = Object.keys(binaryData);
                const keyCount = keys.length;
                
                if (keyCount === 0) {
                  throw new Error(`No keys found in binary data object`);
                }
                
                // Convert keys to numbers and sort
                const numericKeys: number[] = [];
                for (const k of keys) {
                  const num = parseInt(k, 10);
                  if (!isNaN(num)) {
                    numericKeys.push(num);
                  }
                }
                
                if (numericKeys.length === 0) {
                  throw new Error(`No valid numeric keys found in binary data object`);
                }
                
                numericKeys.sort((a, b) => a - b);
                
                // Build Uint8Array directly using typed array constructor (more memory efficient)
                wasmBytes = new Uint8Array(numericKeys.length);
                for (let i = 0; i < numericKeys.length; i++) {
                  const key = numericKeys[i];
                  wasmBytes[i] = (binaryData as any)[key.toString()];
                }
                
                console.log(`✅ [UserCanisterService] Converted object to Uint8Array: ${wasmBytes.length} bytes (from ${numericKeys.length} keys)`);
              } else {
                throw new Error(`Binary data is not in expected format. Type: ${typeof binaryData}, isArray: ${Array.isArray(binaryData)}, value: ${JSON.stringify(binaryData).substring(0, 100)}`);
              }
              
              // Validate wasmBytes
              if (!wasmBytes) {
                throw new Error(`wasmBytes is null or undefined after extraction`);
              }
              
              if (!(wasmBytes instanceof Uint8Array)) {
                const constructorName = (wasmBytes as any)?.constructor?.name || 'unknown';
                throw new Error(`wasmBytes is not a Uint8Array. Type: ${typeof wasmBytes}, constructor: ${constructorName}`);
              }
              
              if (!wasmBytes.length || wasmBytes.length === 0) {
                throw new Error(`Binary data is empty for ${fileName}. Expected size: ${Number(artifact.size)}, got: ${wasmBytes.length}`);
              }
              
              const actualLength = wasmBytes.length;
              const expectedLength = Number(artifact.size);
              console.log(`✅ [UserCanisterService] Downloaded ${fileName} via readCodeArtifact: ${actualLength} bytes (expected: ${expectedLength})`);
              
              if (actualLength !== expectedLength) {
                console.warn(`⚠️ [UserCanisterService] Size mismatch: got ${actualLength} bytes, expected ${expectedLength} bytes`);
              }
            } else if ('Text' in fileContent) {
              throw new Error(`Expected Binary content but got Text content for ${fileName}`);
            } else {
              // Log the structure for debugging
              console.error(`❌ [UserCanisterService] Unexpected fileContent structure:`, {
                keys: Object.keys(fileContent),
                type: typeof fileContent,
                isArray: Array.isArray(fileContent),
                value: JSON.stringify(fileContent).substring(0, 200)
              });
              throw new Error(`Unexpected content type. Keys: ${Object.keys(fileContent).join(', ')}`);
            }
          } else if (artifact.chunks && Array.isArray(artifact.chunks) && artifact.chunks.length > 0) {
            // File is chunked - need to use chunked download
            console.log(`📦 [UserCanisterService] File is chunked (${artifact.chunks.length} chunks), using chunked download`);
            
            const sessionResult = await this.retryOperation(async () => {
              return await userActor.startWasmDownloadSession(projectId, path, fileName);
            });

            if (sessionResult && typeof sessionResult === 'object' && ('ok' in sessionResult || 'Ok' in sessionResult)) {
              // Chunked download path
              const sessionData = sessionResult.ok || sessionResult.Ok;
              const { totalChunks, sessionId } = sessionData;
              const totalChunksNum = Number(totalChunks);

              console.log(`📦 [UserCanisterService] Using chunked download: ${totalChunksNum} chunks`);

              // Download all chunks
              const chunks: Uint8Array[] = [];
              for (let chunkIndex = 0; chunkIndex < totalChunksNum; chunkIndex++) {
                const chunkResult = await this.retryOperation(async () => {
                  return await userActor.downloadWasmChunk(sessionId, BigInt(chunkIndex));
                });

                if (!chunkResult || typeof chunkResult !== 'object' || !('ok' in chunkResult || 'Ok' in chunkResult)) {
                  throw new Error(`Failed to download chunk ${chunkIndex} for ${fileName}`);
                }

                const chunkData = chunkResult.ok || chunkResult.Ok;
                let chunkBytes: Uint8Array;
                if (chunkData instanceof Uint8Array) {
                  chunkBytes = chunkData;
                } else if (Array.isArray(chunkData)) {
                  chunkBytes = new Uint8Array(chunkData);
                } else {
                  throw new Error(`Unexpected chunk data format for ${fileName}`);
                }

                chunks.push(chunkBytes);
              }

              // Combine all chunks
              const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
              wasmBytes = new Uint8Array(totalSize);
              let offset = 0;
              for (const chunk of chunks) {
                wasmBytes.set(chunk, offset);
                offset += chunk.length;
              }

              console.log(`✅ [UserCanisterService] Downloaded ${fileName} via chunked download: ${wasmBytes.length} bytes`);
            } else {
              const error = sessionResult && ('err' in sessionResult || 'Err' in sessionResult) 
                ? (sessionResult.err || sessionResult.Err) 
                : 'Unknown error';
              const errorStr = typeof error === 'string' ? error : JSON.stringify(error);
              console.error(`❌ [UserCanisterService] Failed to start chunked download for ${fileName}: ${errorStr}`);
              continue;
            }
          } else {
            throw new Error(`No content or chunks found in artifact for ${fileName}`);
          }
        } else {
          const directError = directResult && ('err' in directResult || 'Err' in directResult)
            ? (directResult.err || directResult.Err)
            : 'Unknown error';
          const errorStr = typeof directError === 'string' ? directError : JSON.stringify(directError);
          console.error(`❌ [UserCanisterService] Failed to read artifact for ${fileName}: ${errorStr}`);
          console.error(`   Path used: "${path}", ProjectId: "${projectId}"`);
          continue;
        }

        if (!wasmBytes) {
          console.error(`❌ [UserCanisterService] No WASM bytes retrieved for ${fileName}`);
          continue;
        }

        downloadedFiles.push({
          name: fileName,
          bytes: wasmBytes
        });

        console.log(`✅ [UserCanisterService] Successfully prepared ${fileName} for download: ${wasmBytes.length} bytes`);
      }

      return {
        success: true,
        files: downloadedFiles
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Project WASM download failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Download a single WASM file by path and fileName
   */
  async downloadSingleWasmFile(
    projectId: string,
    userCanisterId: string,
    identity: Identity,
    principal: Principal,
    path: string,
    fileName: string
  ): Promise<{ success: boolean; file?: { name: string; bytes: Uint8Array }; error?: string }> {
    try {
      console.log('📦 [UserCanisterService] Downloading single WASM file:', { projectId, path, fileName });
      
      await this.initializeUserActor(userCanisterId, identity);
      const userActor = this.userActors.get(userCanisterId);
      if (!userActor) {
        throw new Error('User canister actor not initialized');
      }

      const callerPrincipal = identity.getPrincipal();

      // Use readCodeArtifact directly
      const directResult = await this.retryOperation(async () => {
        return await userActor.readCodeArtifact(callerPrincipal, projectId, path, fileName, []);
      });

      if (!directResult || typeof directResult !== 'object' || !('ok' in directResult || 'Ok' in directResult)) {
        const error = directResult && ('err' in directResult || 'Err' in directResult)
          ? (directResult.err || directResult.Err)
          : 'Unknown error';
        const errorStr = typeof error === 'string' ? error : JSON.stringify(error);
        return {
          success: false,
          error: `Failed to read artifact: ${errorStr}`
        };
      }

      const artifact = directResult.ok || directResult.Ok;
      
      // Extract Binary content from variant
      let fileContent: any = null;
      
      if (Array.isArray(artifact.content)) {
        if (artifact.content.length > 0) {
          fileContent = artifact.content[0];
        }
      } else if (artifact.content && typeof artifact.content === 'object') {
        fileContent = artifact.content;
      }
      
      let wasmBytes: Uint8Array | null = null;
      
      if (fileContent && typeof fileContent === 'object') {
        if ('Binary' in fileContent) {
          const binaryData = fileContent.Binary;
          
          if (Array.isArray(binaryData)) {
            wasmBytes = new Uint8Array(binaryData);
          } else if (binaryData instanceof Uint8Array) {
            wasmBytes = binaryData;
          } else if (typeof binaryData === 'object' && binaryData !== null) {
            // Candid serializes large arrays as objects with numeric string keys: {"0": value, "1": value, ...}
            // Convert object to array efficiently using Uint8Array directly
            const keys = Object.keys(binaryData);
            const keyCount = keys.length;
            
            if (keyCount === 0) {
              return {
                success: false,
                error: `No keys found in binary data object`
              };
            }
            
            // Convert keys to numbers and sort
            const numericKeys: number[] = [];
            for (const k of keys) {
              const num = parseInt(k, 10);
              if (!isNaN(num)) {
                numericKeys.push(num);
              }
            }
            
            if (numericKeys.length === 0) {
              return {
                success: false,
                error: `No valid numeric keys found in binary data object`
              };
            }
            
            numericKeys.sort((a, b) => a - b);
            
            // Build Uint8Array directly using typed array constructor (more memory efficient)
            wasmBytes = new Uint8Array(numericKeys.length);
            for (let i = 0; i < numericKeys.length; i++) {
              const key = numericKeys[i];
              wasmBytes[i] = (binaryData as any)[key.toString()];
            }
            
            console.log(`✅ [UserCanisterService] Converted object to Uint8Array: ${wasmBytes.length} bytes`);
          } else {
            return {
              success: false,
              error: `Binary data is not in expected format. Type: ${typeof binaryData}`
            };
          }
          
          if (!wasmBytes || !wasmBytes.length) {
            return {
              success: false,
              error: `Binary data is empty. Expected size: ${Number(artifact.size)}`
            };
          }
        } else if (artifact.chunks && Array.isArray(artifact.chunks) && artifact.chunks.length > 0) {
          // File is chunked - use chunked download
          const sessionResult = await this.retryOperation(async () => {
            return await userActor.startWasmDownloadSession(projectId, path, fileName);
          });

          if (sessionResult && typeof sessionResult === 'object' && ('ok' in sessionResult || 'Ok' in sessionResult)) {
            const sessionData = sessionResult.ok || sessionResult.Ok;
            const { totalChunks, sessionId } = sessionData;
            const totalChunksNum = Number(totalChunks);

            const chunks: Uint8Array[] = [];
            for (let chunkIndex = 0; chunkIndex < totalChunksNum; chunkIndex++) {
              const chunkResult = await this.retryOperation(async () => {
                return await userActor.downloadWasmChunk(sessionId, BigInt(chunkIndex));
              });

              if (!chunkResult || typeof chunkResult !== 'object' || !('ok' in chunkResult || 'Ok' in chunkResult)) {
                return {
                  success: false,
                  error: `Failed to download chunk ${chunkIndex}`
                };
              }

              const chunkData = chunkResult.ok || chunkResult.Ok;
              let chunkBytes: Uint8Array;
              if (chunkData instanceof Uint8Array) {
                chunkBytes = chunkData;
              } else if (Array.isArray(chunkData)) {
                chunkBytes = new Uint8Array(chunkData);
              } else {
                return {
                  success: false,
                  error: `Unexpected chunk data format`
                };
              }

              chunks.push(chunkBytes);
            }

            const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            wasmBytes = new Uint8Array(totalSize);
            let offset = 0;
            for (const chunk of chunks) {
              wasmBytes.set(chunk, offset);
              offset += chunk.length;
            }
          } else {
            return {
              success: false,
              error: 'Failed to start chunked download session'
            };
          }
        } else {
          return {
            success: false,
            error: 'No content or chunks found in artifact'
          };
        }
      } else {
        return {
          success: false,
          error: 'No file content found in artifact'
        };
      }

      if (!wasmBytes) {
        return {
          success: false,
          error: 'Failed to extract WASM bytes'
        };
      }

      return {
        success: true,
        file: {
          name: fileName,
          bytes: wasmBytes
        }
      };

    } catch (error) {
      console.error('❌ [UserCanisterService] Single WASM download failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // ===============================
  // 🚀 PERFORMANCE OPTIMIZATION: NEW METHODS
  // ===============================

  /**
   * Get file metadata without content (5× faster, 99% smaller payload)
   * Works for both regular projects and versions
   */
  public async getProjectFileMetadata(
    projectId: string,
    versionId: string | null
  ): Promise<any[]> {
    console.log('🚀 [UserCanisterService] Getting file metadata (optimized)');
    const startTime = performance.now();

    try {
      const userActor = await this.getActor();
      const userPrincipal = Principal.fromText(this.userPrincipal!);
      
      const result: any = await userActor.getProjectFileMetadata(
        userPrincipal,
        projectId,
        versionId ? [versionId] : []
      );

      if ('err' in result) {
        throw new Error(result.err);
      }

      const duration = performance.now() - startTime;
      console.log(`🚀 [UserCanisterService] Metadata retrieved in ${duration.toFixed(0)}ms (${result.ok.length} files)`);

      return result.ok;
    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to get metadata:', error);
      throw error;
    }
  }

  /**
   * Batch retrieve multiple chunks in a single call (5-10× faster than sequential)
   */
  public async getChunksBatch(chunkIds: number[]): Promise<Array<[number, any | null]>> {
    console.log(`🚀 [UserCanisterService] Batch retrieving ${chunkIds.length} chunks`);
    const startTime = performance.now();

    try {
      const userActor = await this.getActor();
      const result: Array<[bigint, any | null]> = await userActor.getChunksBatch(chunkIds);

      // Convert bigint chunk IDs to numbers for JavaScript
      const converted = result.map(([id, chunk]) => [Number(id), chunk] as [number, any | null]);

      const successCount = converted.filter(([_, chunk]) => chunk !== null).length;
      const duration = performance.now() - startTime;

      console.log(`🚀 [UserCanisterService] Batch retrieved ${successCount}/${chunkIds.length} chunks in ${duration.toFixed(0)}ms`);

      return converted;
    } catch (error) {
      console.error('❌ [UserCanisterService] Batch chunk retrieval failed:', error);
      throw error;
    }
  }

  /**
   * Get a single chunk (kept for backward compatibility)
   */
  public async getChunk(chunkId: number): Promise<any | null> {
    try {
      const userActor = await this.getActor();
      const result = await userActor.getChunk(chunkId);
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('❌ [UserCanisterService] Failed to get chunk:', error);
      return null;
    }
  }

  // ===============================
  // USER PREFERENCES & PROFILE MANAGEMENT
  // ===============================

  /**
   * Get user profile
   */
  public async getUserProfile(
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; profile?: any; error?: string }> {
    try {
      console.log('📋 [UserCanisterService] Getting user profile');
      const userActor = await this.getUserActor(userCanisterId, identity);

      // Use getUserAccountInfo instead of getUserProfile (which doesn't exist)
      const result = await userActor.getUserAccountInfo();

      if (result && result.length > 0) {
        console.log('✅ [UserCanisterService] User profile retrieved');
        return {
          success: true,
          profile: result[0].profile
        };
      } else {
        console.error('❌ [UserCanisterService] User account not found');
        return {
          success: false,
          error: 'User account not found'
        };
      }
    } catch (error) {
      console.error('❌ [UserCanisterService] Error getting user profile:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update user profile
   */
  public async updateUserProfile(
    userCanisterId: string,
    identity: Identity,
    profile: Partial<any>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('📝 [UserCanisterService] Updating user profile');
      const userActor = await this.getUserActor(userCanisterId, identity);
      
      // Get current user profile to merge with updates
      const currentUserResult = await userActor.getUserAccountInfo();
      if (!currentUserResult || currentUserResult.length === 0) {
        throw new Error('User account not found');
      }
      
      const currentUser = currentUserResult[0];
      const currentProfile = currentUser.profile;
      
      // Helper function to normalize optional text (handle both array and direct value formats)
      const normalizeOptText = (value: any): any => {
        if (value === undefined || value === null) return [];
        if (Array.isArray(value)) return value; // Already in correct format
        if (typeof value === 'string' && value.length > 0) return [value];
        return []; // Empty string or falsy value
      };

      // Helper function to normalize socials (handle both array and direct value formats)
      // socials is ?UserSocials, so it should be [] for null or [{...}] for present
      const normalizeSocials = (socials: any): any => {
        if (!socials) return [];
        // If it's already an array (wrong format from previous save), convert it
        if (Array.isArray(socials)) {
          // If it's an array with one element (correct format), return it
          if (socials.length === 1 && typeof socials[0] === 'object') return socials;
          // Otherwise, it's wrong format, return empty
          return [];
        }
        // If it's an object, wrap it in an array (for opt record)
        if (typeof socials === 'object') {
          const normalized = {
            twitter: normalizeOptText(socials.twitter),
            discord: normalizeOptText(socials.discord),
            telegram: normalizeOptText(socials.telegram),
            openchat: normalizeOptText(socials.openchat)
          };
          // Check if all fields are empty
          const hasAnyValue = normalized.twitter.length > 0 || 
                             normalized.discord.length > 0 || 
                             normalized.telegram.length > 0 || 
                             normalized.openchat.length > 0;
          // Return [] for null, or [{...}] for present
          return hasAnyValue ? [normalized] : [];
        }
        return [];
      };

      // Merge current profile with updates, ensuring all required fields are present
      const updatedProfile = {
        username: currentProfile.username, // Required field
        displayName: profile.displayName !== undefined ? normalizeOptText(profile.displayName) : normalizeOptText(currentProfile.displayName),
        bio: profile.bio !== undefined ? normalizeOptText(profile.bio) : normalizeOptText(currentProfile.bio),
        avatar: profile.avatar !== undefined ? normalizeOptText(profile.avatar) : normalizeOptText(currentProfile.avatar),
        coverPhoto: profile.coverPhoto !== undefined ? normalizeOptText(profile.coverPhoto) : normalizeOptText(currentProfile.coverPhoto),
        email: profile.email !== undefined ? normalizeOptText(profile.email) : normalizeOptText(currentProfile.email),
        website: profile.website !== undefined ? normalizeOptText(profile.website) : normalizeOptText(currentProfile.website),
        github: profile.github !== undefined ? normalizeOptText(profile.github) : normalizeOptText(currentProfile.github),
        socials: profile.socials !== undefined ? normalizeSocials(profile.socials) : normalizeSocials(currentProfile.socials),
        avatarAsset: currentProfile.avatarAsset,
        coverPhotoAsset: currentProfile.coverPhotoAsset,
        metadata: profile.metadata || currentProfile.metadata
      };

      const result = await userActor.updateUserProfile(updatedProfile);

      if ('ok' in result) {
        console.log('✅ [UserCanisterService] User profile updated');
        return { success: true };
      } else {
        console.error('❌ [UserCanisterService] Failed to update profile:', result.err);
        return {
          success: false,
          error: result.err
        };
      }
    } catch (error) {
      console.error('❌ [UserCanisterService] Error updating user profile:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get account preferences
   */
  public async getAccountPreferences(
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; preferences?: any; error?: string }> {
    try {
      console.log('⚙️ [UserCanisterService] Getting account preferences');
      const userActor = await this.getUserActor(userCanisterId, identity);

      // Use getAccountDetails instead of getAccountPreferences (which doesn't exist)
      const result = await userActor.getAccountDetails();

      if (result && result.length > 0 && result[0]) {
        console.log('✅ [UserCanisterService] Account preferences retrieved');
        return {
          success: true,
          preferences: result[0].preferences
        };
      } else {
        console.error('❌ [UserCanisterService] Account details not found');
        return {
          success: false,
          error: 'Account details not found'
        };
      }
    } catch (error) {
      console.error('❌ [UserCanisterService] Error getting account preferences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update account preferences
   */
  public async updateAccountPreferences(
    userCanisterId: string,
    identity: Identity,
    preferences: Partial<any>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('⚙️ [UserCanisterService] Updating account preferences');
      const userActor = await this.getUserActor(userCanisterId, identity);

      const result = await userActor.updateAccountPreferences(preferences);

      if ('ok' in result) {
        console.log('✅ [UserCanisterService] Account preferences updated');
        return { success: true };
      } else {
        console.error('❌ [UserCanisterService] Failed to update preferences:', result.err);
        return {
          success: false,
          error: result.err
        };
      }
    } catch (error) {
      console.error('❌ [UserCanisterService] Error updating account preferences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get external service tokens
   */
  public async getExternalServiceTokens(
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; tokens?: any; error?: string }> {
    try {
      console.log('🔑 [UserCanisterService] Getting external service tokens');
      const userActor = await this.getUserActor(userCanisterId, identity);
      
      // Use getExternalServices instead of getExternalServiceTokens (which doesn't exist)
      const result = await userActor.getExternalServices();

      if (result && result.length > 0) {
        console.log('✅ [UserCanisterService] External service tokens retrieved');
        return {
          success: true,
          tokens: result[0]
        };
      } else {
        console.log('ℹ️ [UserCanisterService] No external services configured');
        return {
          success: true,
          tokens: null
        };
      }
    } catch (error) {
      console.error('❌ [UserCanisterService] Error getting external service tokens:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update external service tokens
   */
  public async updateExternalServiceTokens(
    userCanisterId: string,
    identity: Identity,
    tokens: Partial<any>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔑 [UserCanisterService] Updating external service tokens');
      const userActor = await this.getUserActor(userCanisterId, identity);

      const result = await userActor.updateExternalServiceTokens(tokens);

      if ('ok' in result) {
        console.log('✅ [UserCanisterService] External service tokens updated');
        return { success: true };
      } else {
        console.error('❌ [UserCanisterService] Failed to update tokens:', result.err);
        return {
          success: false,
          error: result.err
        };
      }
    } catch (error) {
      console.error('❌ [UserCanisterService] Error updating external service tokens:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get selected server pair from user canister
   */
  public async getSelectedServerPair(
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; serverPairId?: string | null; error?: string }> {
    try {
      console.log('🌐 [UserCanisterService] Getting selected server pair');
      const userActor = await this.getUserActor(userCanisterId, identity);

      // Backend returns ?Text directly (not wrapped in Result)
      const result = await userActor.getSelectedServerPair();
      
      // Result is an optional array: [] means null, [value] means Some(value)
      const serverPairId = result.length > 0 ? result[0] : null;
      console.log('✅ [UserCanisterService] Selected server pair retrieved:', serverPairId);
      
      return {
        success: true,
        serverPairId: serverPairId
      };
    } catch (error) {
      console.error('❌ [UserCanisterService] Error getting selected server pair:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Set selected server pair in user canister
   */
  public async setSelectedServerPair(
    userCanisterId: string,
    identity: Identity,
    serverPairId: string | null
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🌐 [UserCanisterService] Setting selected server pair:', serverPairId);
      const userActor = await this.getUserActor(userCanisterId, identity);

      const result = await userActor.setSelectedServerPair(serverPairId ? [serverPairId] : []);

      if ('ok' in result) {
        console.log('✅ [UserCanisterService] Selected server pair set');
        return { success: true };
      } else {
        console.error('❌ [UserCanisterService] Failed to set selected server pair:', result.err);
        return {
          success: false,
          error: result.err
        };
      }
    } catch (error) {
      console.error('❌ [UserCanisterService] Error setting selected server pair:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ==================== SMART DEPLOYMENT TRACKING ====================

  /**
   * Mark backend files as changed (sets hasBackendChanged flag)
   */
  public async markBackendChanged(
    userCanisterId: string,
    identity: Identity,
    projectId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔧 [UserCanisterService] Marking backend as changed for project:', projectId);
      const userActor = await this.getUserActor(userCanisterId, identity);
      
      const result = await userActor.markBackendChanged(projectId);
      
      if ('ok' in result) {
        console.log('✅ [UserCanisterService] Backend marked as changed');
        return { success: true };
      } else {
        console.error('❌ [UserCanisterService] Failed to mark backend changed:', result.err);
        return {
          success: false,
          error: result.err
        };
      }
    } catch (error) {
      console.error('❌ [UserCanisterService] Error marking backend changed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Mark frontend files as changed (sets hasFrontendChanged flag)
   */
  public async markFrontendChanged(
    userCanisterId: string,
    identity: Identity,
    projectId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔧 [UserCanisterService] Marking frontend as changed for project:', projectId);
      const userActor = await this.getUserActor(userCanisterId, identity);
      
      const result = await userActor.markFrontendChanged(projectId);
      
      if ('ok' in result) {
        console.log('✅ [UserCanisterService] Frontend marked as changed');
        return { success: true };
      } else {
        console.error('❌ [UserCanisterService] Failed to mark frontend changed:', result.err);
        return {
          success: false,
          error: result.err
        };
      }
    } catch (error) {
      console.error('❌ [UserCanisterService] Error marking frontend changed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Clear backend changed flag after successful deployment
   */
  public async clearBackendChangedFlag(
    userCanisterId: string,
    identity: Identity,
    projectId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔧 [UserCanisterService] Clearing backend changed flag for project:', projectId);
      const userActor = await this.getUserActor(userCanisterId, identity);
      
      const result = await userActor.clearBackendChangedFlag(projectId);
      
      if ('ok' in result) {
        console.log('✅ [UserCanisterService] Backend flag cleared');
        return { success: true };
      } else {
        console.error('❌ [UserCanisterService] Failed to clear backend flag:', result.err);
        return {
          success: false,
          error: result.err
        };
      }
    } catch (error) {
      console.error('❌ [UserCanisterService] Error clearing backend flag:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Clear frontend changed flag after successful deployment
   */
  public async clearFrontendChangedFlag(
    userCanisterId: string,
    identity: Identity,
    projectId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔧 [UserCanisterService] Clearing frontend changed flag for project:', projectId);
      const userActor = await this.getUserActor(userCanisterId, identity);
      
      const result = await userActor.clearFrontendChangedFlag(projectId);
      
      if ('ok' in result) {
        console.log('✅ [UserCanisterService] Frontend flag cleared');
        return { success: true };
      } else {
        console.error('❌ [UserCanisterService] Failed to clear frontend flag:', result.err);
        return {
          success: false,
          error: result.err
        };
      }
    } catch (error) {
      console.error('❌ [UserCanisterService] Error clearing frontend flag:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Mark both flags when server pair changes (force full redeploy)
   */
  public async markServerPairChanged(
    userCanisterId: string,
    identity: Identity,
    projectId: string,
    serverPairId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔧 [UserCanisterService] Marking server pair changed for project:', projectId);
      const userActor = await this.getUserActor(userCanisterId, identity);
      
      const result = await userActor.markServerPairChanged(projectId, serverPairId);
      
      if ('ok' in result) {
        console.log('✅ [UserCanisterService] Server pair change marked (full redeploy)');
        return { success: true };
      } else {
        console.error('❌ [UserCanisterService] Failed to mark server pair changed:', result.err);
        return {
          success: false,
          error: result.err
        };
      }
    } catch (error) {
      console.error('❌ [UserCanisterService] Error marking server pair changed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get deployment tracking flags for a project
   */
  public async getDeploymentFlags(
    userCanisterId: string,
    identity: Identity,
    projectId: string
  ): Promise<{
    hasBackendChanged: boolean;
    hasFrontendChanged: boolean;
    lastBackendDeployment?: bigint;
    lastFrontendDeployment?: bigint;
    lastDeploymentServerPairId?: string;
  } | null> {
    try {
      console.log('🔍 [UserCanisterService] Getting deployment flags for project:', projectId);
      const userActor = await this.getUserActor(userCanisterId, identity);
      
      const result = await userActor.getDeploymentFlags(projectId);
      
      if ('ok' in result) {
        const flags = result.ok;
        console.log('✅ [UserCanisterService] Deployment flags retrieved:', flags);
        return {
          hasBackendChanged: flags.hasBackendChanged,
          hasFrontendChanged: flags.hasFrontendChanged,
          lastBackendDeployment: flags.lastBackendDeployment[0],
          lastFrontendDeployment: flags.lastFrontendDeployment[0],
          lastDeploymentServerPairId: flags.lastDeploymentServerPairId[0]
        };
      } else {
        console.error('❌ [UserCanisterService] Failed to get deployment flags:', result.err);
        return null;
      }
    } catch (error) {
      console.error('❌ [UserCanisterService] Error getting deployment flags:', error);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC PROFILE METHODS (User Business Card)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get public profile for a user
   */
  public async getPublicProfile(
    userCanisterId: string,
    identity: Identity
  ): Promise<any | null> {
    try {
      console.log('🎨 [UserCanisterService] Getting public profile');
      const userActor = await this.getUserActor(userCanisterId, identity);
      
      // Check if method exists (IDL might not be up to date)
      if (typeof userActor.getPublicProfile !== 'function') {
        console.warn('⚠️ [UserCanisterService] getPublicProfile method not found in IDL - returning null');
        return null;
      }
      
      const result = await userActor.getPublicProfile();
      
      if (result && result.length > 0) {
        const prof = result[0];
        console.log('✅ [UserCanisterService] Public profile retrieved');
        return {
          displayName: prof.displayName?.[0] || '',
          bio: prof.bio?.[0] || '',
          tagline: prof.tagline?.[0] || '',
          avatarUrl: prof.avatarUrl?.[0] || '',
          bannerUrl: prof.bannerUrl?.[0] || '',
          location: prof.location?.[0] || '',
          timezone: prof.timezone?.[0] || '',
          website: prof.website?.[0] || '',
          email: prof.email?.[0] || '',
          socialLinks: {
            twitter: prof.socialLinks.twitter?.[0] || '',
            github: prof.socialLinks.github?.[0] || '',
            linkedin: prof.socialLinks.linkedin?.[0] || '',
            discord: prof.socialLinks.discord?.[0] || '',
            telegram: prof.socialLinks.telegram?.[0] || '',
            medium: prof.socialLinks.medium?.[0] || '',
            youtube: prof.socialLinks.youtube?.[0] || '',
            custom: prof.socialLinks.custom || []
          },
          title: prof.title?.[0] || '',
          company: prof.company?.[0] || '',
          skills: prof.skills || [],
          interests: prof.interests || [],
          featuredProjects: prof.featuredProjects || [],
          showMarketplace: prof.showMarketplace,
          showStats: prof.showStats,
          customSections: prof.customSections || [],
          isPublic: prof.isPublic,
          theme: prof.theme?.[0] || null,
          createdAt: Number(prof.createdAt),
          updatedAt: Number(prof.updatedAt),
          profileViews: Number(prof.profileViews)
        };
      }
      
      console.log('ℹ️ [UserCanisterService] No public profile found');
      return null;
    } catch (error) {
      console.error('❌ [UserCanisterService] Error getting public profile:', error);
      return null;
    }
  }

  /**
   * Update public profile for a user
   */
  public async updatePublicProfile(
    userCanisterId: string,
    identity: Identity,
    profile: any
  ): Promise<void> {
    console.log('🎨 [UserCanisterService] Updating public profile');
    const userActor = await this.getUserActor(userCanisterId, identity);
    
    // Get current profile to preserve existing values if not provided
    const currentProfile = await this.getPublicProfile(userCanisterId, identity);
    const now = BigInt(Date.now() * 1000000);
    
    const profileData = {
      displayName: profile.displayName !== undefined && profile.displayName !== '' ? [profile.displayName] : (currentProfile?.displayName ? [currentProfile.displayName] : []),
      bio: profile.bio !== undefined && profile.bio !== '' ? [profile.bio] : (currentProfile?.bio ? [currentProfile.bio] : []),
      tagline: profile.tagline !== undefined && profile.tagline !== '' ? [profile.tagline] : (currentProfile?.tagline ? [currentProfile.tagline] : []),
      avatarUrl: profile.avatarUrl !== undefined && profile.avatarUrl !== '' ? [profile.avatarUrl] : (currentProfile?.avatarUrl ? [currentProfile.avatarUrl] : []),
      bannerUrl: profile.bannerUrl !== undefined && profile.bannerUrl !== '' ? [profile.bannerUrl] : (currentProfile?.bannerUrl ? [currentProfile.bannerUrl] : []),
      location: profile.location !== undefined && profile.location !== '' ? [profile.location] : (currentProfile?.location ? [currentProfile.location] : []),
      timezone: profile.timezone !== undefined && profile.timezone !== '' ? [profile.timezone] : (currentProfile?.timezone ? [currentProfile.timezone] : []),
      website: profile.website !== undefined && profile.website !== '' ? [profile.website] : (currentProfile?.website ? [currentProfile.website] : []),
      email: profile.email !== undefined && profile.email !== '' ? [profile.email] : (currentProfile?.email ? [currentProfile.email] : []),
      socialLinks: {
        twitter: profile.socialLinks?.twitter ? [profile.socialLinks.twitter] : (currentProfile?.socialLinks?.twitter ? [currentProfile.socialLinks.twitter] : []),
        github: profile.socialLinks?.github ? [profile.socialLinks.github] : (currentProfile?.socialLinks?.github ? [currentProfile.socialLinks.github] : []),
        linkedin: profile.socialLinks?.linkedin ? [profile.socialLinks.linkedin] : (currentProfile?.socialLinks?.linkedin ? [currentProfile.socialLinks.linkedin] : []),
        discord: profile.socialLinks?.discord ? [profile.socialLinks.discord] : (currentProfile?.socialLinks?.discord ? [currentProfile.socialLinks.discord] : []),
        telegram: profile.socialLinks?.telegram ? [profile.socialLinks.telegram] : (currentProfile?.socialLinks?.telegram ? [currentProfile.socialLinks.telegram] : []),
        medium: profile.socialLinks?.medium ? [profile.socialLinks.medium] : (currentProfile?.socialLinks?.medium ? [currentProfile.socialLinks.medium] : []),
        youtube: profile.socialLinks?.youtube ? [profile.socialLinks.youtube] : (currentProfile?.socialLinks?.youtube ? [currentProfile.socialLinks.youtube] : []),
        custom: profile.socialLinks?.custom || currentProfile?.socialLinks?.custom || []
      },
      title: profile.title !== undefined && profile.title !== '' ? [profile.title] : (currentProfile?.title ? [currentProfile.title] : []),
      company: profile.company !== undefined && profile.company !== '' ? [profile.company] : (currentProfile?.company ? [currentProfile.company] : []),
      skills: profile.skills || currentProfile?.skills || [],
      interests: profile.interests || currentProfile?.interests || [],
      featuredProjects: profile.featuredProjects || currentProfile?.featuredProjects || [],
      showMarketplace: profile.showMarketplace !== undefined ? profile.showMarketplace : (currentProfile?.showMarketplace ?? true),
      showStats: profile.showStats !== undefined ? profile.showStats : (currentProfile?.showStats ?? true),
      customSections: profile.customSections || currentProfile?.customSections || [],
      isPublic: profile.isPublic !== undefined ? profile.isPublic : (currentProfile?.isPublic ?? true),
      theme: profile.theme ? [profile.theme] : (currentProfile?.theme ? [currentProfile.theme] : []),
      createdAt: currentProfile?.createdAt ? BigInt(currentProfile.createdAt) : now,
      updatedAt: now,
      profileViews: currentProfile?.profileViews ? BigInt(currentProfile.profileViews) : BigInt(0)
    };
    
    const result = await userActor.updatePublicProfile(profileData);
    
    if ('err' in result) {
      throw new Error(result.err);
    }
    
    console.log('✅ [UserCanisterService] Public profile updated successfully');
  }

  // ==================== PROJECT VERSION METHODS ====================

  /**
   * Get all versions for a project
   */
  async getProjectVersions(projectId: string): Promise<any> {
    try {
      const userCanisterId = useAppStore.getState().userCanisterId;
      const identity = useAppStore.getState().identity;
      
      if (!userCanisterId || !identity) {
        throw new Error('User canister ID or identity not found');
      }
      
      await this.initializeUserActor(userCanisterId, identity);
      const userActor = this.userActors.get(userCanisterId);
      
      if (!userActor) {
        throw new Error('Failed to initialize user actor');
      }

      console.log(`📦 [UserCanisterService] Getting versions for project: ${projectId}`);
      const result = await userActor.getProjectVersions(projectId);
      
      return result;
    } catch (error) {
      console.error('❌ [UserCanisterService] Error getting project versions:', error);
      return { err: String(error) };
    }
  }

  /**
   * Get the latest version for a project
   */
  async getLatestProjectVersion(projectId: string): Promise<any> {
    try {
      const userCanisterId = useAppStore.getState().userCanisterId;
      const identity = useAppStore.getState().identity;
      
      if (!userCanisterId || !identity) {
        throw new Error('User canister ID or identity not found');
      }
      
      await this.initializeUserActor(userCanisterId, identity);
      const userActor = this.userActors.get(userCanisterId);
      
      if (!userActor) {
        throw new Error('Failed to initialize user actor');
      }

      console.log(`📦 [UserCanisterService] Getting latest version for project: ${projectId}`);
      const result = await userActor.getLatestProjectVersion(projectId);
      
      return result;
    } catch (error) {
      console.error('❌ [UserCanisterService] Error getting latest project version:', error);
      return { err: String(error) };
    }
  }

  /**
   * Create a new project version
   */
  async createProjectVersion(
    projectId: string,
    semanticVersion: { major: number; minor: number; patch: number; prerelease: string | null; build: string | null },
    description: string | null,
    releaseNotes: string | null,
    parentVersionId: string | null
  ): Promise<any> {
    try {
      const userCanisterId = useAppStore.getState().userCanisterId;
      const identity = useAppStore.getState().identity;
      
      if (!userCanisterId || !identity) {
        throw new Error('User canister ID or identity not found');
      }
      
      await this.initializeUserActor(userCanisterId, identity);
      const userActor = this.userActors.get(userCanisterId);
      
      if (!userActor) {
        throw new Error('Failed to initialize user actor');
      }

      console.log(`📦 [UserCanisterService] Creating version for project: ${projectId}`, {
        version: `${semanticVersion.major}.${semanticVersion.minor}.${semanticVersion.patch}`,
        description,
        releaseNotes,
        parentVersionId
      });

      // Backend expects separate parameters, not an object
      const result = await userActor.createProjectVersion(
        projectId,
        semanticVersion.major,
        semanticVersion.minor,
        semanticVersion.patch,
        semanticVersion.prerelease ? [semanticVersion.prerelease] : [],
        semanticVersion.build ? [semanticVersion.build] : [],
        description ? [description] : [],
        releaseNotes ? [releaseNotes] : [],
        parentVersionId ? [parentVersionId] : []
      );
      
      if ('ok' in result) {
        console.log('✅ [UserCanisterService] Version created successfully:', result.ok);
      } else {
        console.error('❌ [UserCanisterService] Version creation failed:', result.err);
      }
      
      return result;
    } catch (error) {
      console.error('❌ [UserCanisterService] Error creating project version:', error);
      return { err: String(error) };
    }
  }
}

// Singleton instance
export const userCanisterService = new UserCanisterService();