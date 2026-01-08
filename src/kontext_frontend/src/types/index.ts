// 🔥 NEW: Message Priority System Types
export enum MessagePriority {
  CRITICAL = 'CRITICAL',    // Current user instruction - highest priority
  HIGH = 'HIGH',           // Recent supporting context
  MEDIUM = 'MEDIUM',       // Background conversation - recent but not critical
  LOW = 'LOW',            // Older conversation history
  CONTEXT = 'CONTEXT'      // System messages, rules, documentation
}

// 🔥 ENHANCED: Priority context for messages with validation flags
export interface MessagePriorityContext {
  priority: MessagePriority;
  priorityReason: string;
  assignedAt: number;
  isCurrentInstruction: boolean;
  // 🔥 NEW: Synchronization and validation flags
  synchronizationState: {
    isAssigned: boolean;           // Priority has been properly assigned
    isVerified: boolean;           // Priority assignment has been verified
    isPropagated: boolean;         // Priority has been propagated to all store arrays
    lastSyncTime: number;          // When synchronization was last completed
    syncAttempts: number;          // Number of sync attempts made
  };
  supportingContext: {
    relatedMessages: string[]; // Message IDs that provide context
    fileReferences: string[];  // Files mentioned or relevant
    topicContinuity: boolean;  // Is this continuing a previous topic
    // 🔥 NEW: Context quality metrics
    contextQuality: {
      relevanceScore: number;      // 0-100 how relevant this context is
      freshnessScore: number;      // 0-100 how recent/fresh this context is
      completenessScore: number;   // 0-100 how complete this context is
    };
  };
  conversationFlow: {
    isResponseTo: string | null;  // Message ID this responds to
    startsNewTopic: boolean;      // Begins a new conversation thread
    closesLoop: boolean;          // Completes a request-response cycle
    // 🔥 NEW: Flow validation
    flowValidation: {
      isValidTransition: boolean;  // Is this a valid conversation flow transition
      expectedNextPriority: MessagePriority | null; // What priority we expect next
      flowConsistency: number;     // 0-100 how consistent the flow is
    };
  };
  // 🔥 NEW: Performance and debugging metadata
  performanceMetrics: {
    assignmentDuration: number;    // Milliseconds to assign priority
    propagationDuration: number;   // Milliseconds to propagate to all arrays
    validationDuration: number;    // Milliseconds to validate assignment
    totalProcessingTime: number;   // Total time for full priority processing
    memoryFootprint: number;       // Bytes used by this priority context
  };
  // 🔥 NEW: Debug and troubleshooting information
  debugInfo: {
    assignmentSource: 'automatic' | 'manual' | 'fallback' | 'correction'; // How priority was assigned
    validationErrors: string[];    // Any validation errors encountered
    warningFlags: string[];        // Non-critical warnings
    lastModifiedBy: string;        // Which function/process last modified this
    revisionHistory: Array<{       // History of priority changes
      timestamp: number;
      oldPriority: MessagePriority;
      newPriority: MessagePriority;
      reason: string;
      source: string;
    }>;
  };
}

// 🔥 ENHANCED: Assembly structure for priority-based message organization with validation
export interface PriorityMessageAssembly {
  currentInstruction: {
    message: ChatInterfaceMessage;
    context: string;
    fileReferences: string[];
    estimatedTokens: number;
    // 🔥 NEW: Validation metadata
    validationState: {
      isValidCurrentInstruction: boolean;
      validationErrors: string[];
      confidenceScore: number;      // 0-100 confidence this is the right current instruction
      alternativeCandidates: string[]; // Other potential current instruction message IDs
    };
  };
  supportingContext: {
    recentMessages: ChatInterfaceMessage[];
    relatedHistory: ChatInterfaceMessage[];
    totalMessages: number;
    estimatedTokens: number;
    // 🔥 NEW: Context organization metadata
    organizationMetadata: {
      relevanceScores: { [messageId: string]: number }; // Relevance of each message
      redundancyDetection: string[];                     // Duplicate/redundant message IDs
      gapAnalysis: {                                     // Missing context analysis
        hasGaps: boolean;
        missingTopics: string[];
        suggestedInclusions: string[];
      };
    };
  };
  systemContext: {
    aiRules: string;
    documentation: string;
    projectContext: string;
    estimatedTokens: number;
    // 🔥 NEW: System context validation
    contextValidation: {
      isRulesContextValid: boolean;
      isDocumentationRelevant: boolean;
      isProjectContextCurrent: boolean;
      lastValidated: number;
      validationWarnings: string[];
    };
  };
  assemblyMetadata: {
    totalTokens: number;
    priorityDistribution: { [key in MessagePriority]: number };
    optimizationApplied: boolean;
    truncationApplied: boolean;
    assemblyTimestamp: number;
    // 🔥 NEW: Assembly quality and performance metrics
    qualityMetrics: {
      assemblyEfficiency: number;        // 0-100 how efficiently assembled
      contextCompleteness: number;       // 0-100 how complete the context is
      priorityAccuracy: number;          // 0-100 accuracy of priority assignments
      tokenOptimization: number;         // 0-100 how well tokens were optimized
    };
    performanceMetrics: {
      assemblyDuration: number;          // Milliseconds to create assembly
      validationDuration: number;       // Milliseconds to validate assembly
      optimizationDuration: number;     // Milliseconds for optimization pass
      totalProcessingTime: number;      // Total assembly processing time
    };
    // 🔥 NEW: Assembly validation and debugging
    validationState: {
      isValidAssembly: boolean;
      criticalErrors: string[];
      warnings: string[];
      suggestedImprovements: string[];
      confidenceLevel: 'high' | 'medium' | 'low';
    };
  };
}

// 🔥 NEW: User Context Types (matches backend Motoko definition)
export interface ReferenceItem {
  id: string;
  title: string;
  content: string;
  category?: string;
  createdAt: number;
}

export interface CodeRule {
  id: string;
  title: string;
  rule: string;
  examples: string[];
  createdAt: number;
}

export interface ColorPalette {
  id: string;
  name: string;
  colors: string[];
  createdAt: number;
}

export interface DesignInspiration {
  id: string;
  title: string;
  url?: string;
  imageUrl?: string;
  notes?: string;
  createdAt: number;
}

export interface DocumentationItem {
  id: string;
  title: string;
  content: string;
  category?: string;
  createdAt: number;
}

export interface GitHubGuideline {
  id: string;
  title: string;
  guideline: string;
  createdAt: number;
}

export interface CodeTemplate {
  id: string;
  name: string;
  language: string;
  code: string;
  description?: string;
  createdAt: number;
}

export interface APIEndpoint {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Array<[string, string]>;
  body?: string;
  description?: string;
  createdAt: number;
}

export interface UserContext {
  references: ReferenceItem[];
  codeRules: CodeRule[];
  colorPalettes: ColorPalette[];
  designInspirations: DesignInspiration[];
  documentationItems: DocumentationItem[];
  gitHubGuidelines: GitHubGuideline[];
  codeTemplates: CodeTemplate[];
  apiEndpoints: APIEndpoint[];
}

// 🔐 NEW: Agent Credentials & Security Types
export type CredentialType = 
  | 'APIKey'
  | 'OAuth2'
  | 'JWT'
  | 'BasicAuth'
  | 'Certificate'
  | 'SSHKey'
  | { Custom: string };

export interface RateLimit {
  requestsPerMinute: number;
  requestsPerDay: number;
  tokensPerMinute?: number;
  tokensPerDay?: number;
}

export interface LLMCredentials {
  apiKey: string;              // Encrypted
  organizationId?: string;
  projectId?: string;          // Provider's project ID
  model?: string;              // Default model
  maxTokens?: number;
  temperature?: number;
  rateLimit?: RateLimit;
  endpoint?: string;           // Custom endpoint URL
}

export interface AgentCredentials {
  agentId: string;
  projectId?: string;
  openai?: LLMCredentials;      // OpenAI (GPT-4, etc.)
  anthropic?: LLMCredentials;   // Anthropic (Claude)
  gemini?: LLMCredentials;      // Google Gemini
  kimi?: LLMCredentials;        // Moonshot AI Kimi
  databases: DatabaseCredential[];
  customAPIs: APICredential[];
  environmentVariables: Array<[string, string]>; // Encrypted
  createdAt: number;
  updatedAt: number;
}

export interface APICredential {
  id: string;
  name: string;
  service: string;             // "openai", "anthropic", "gemini", "kimi", etc.
  credentialType: CredentialType;
  encryptedToken: string;
  tokenExpiry?: number;
  scopes: string[];
  metadata: Array<[string, string]>;
  createdAt: number;
  lastUsed?: number;
  usageCount: number;
  isActive: boolean;
  projectIds: string[];
}

export interface DatabaseCredential {
  id: string;
  name: string;
  dbType: string;              // "mongodb", "postgres", "mysql", etc.
  host: string;
  port: number;
  database: string;
  username: string;
  encryptedPassword: string;
  connectionString?: string;   // Encrypted
  sslEnabled: boolean;
  sslCertificate?: string;
  isReadOnly: boolean;
  allowedOperations: string[];
  createdAt: number;
}

export type Environment = 
  | 'Development'
  | 'Staging'
  | 'Production'
  | 'Testing'
  | { Custom: string };

export interface EnvVariable {
  key: string;
  encryptedValue: string;
  description?: string;
  isSecret: boolean;
  isRequired: boolean;
  category?: string;
  createdAt: number;
}

export interface EnvironmentConfig {
  id: string;
  name: string;
  projectId?: string;
  agentId?: string;
  environment: Environment;
  variables: EnvVariable[];
  createdAt: number;
  updatedAt: number;
}

export type SecurityAction =
  | 'CredentialCreated'
  | 'CredentialAccessed'
  | 'CredentialUpdated'
  | 'CredentialDeleted'
  | 'CredentialRotated'
  | 'UnauthorizedAccess'
  | 'PermissionChanged'
  | 'APIKeyUsed'
  | 'TokenRefreshed'
  | 'EnvironmentVariableAccessed'
  | { Custom: string };

export type SecurityResult =
  | 'Success'
  | { Failure: string }
  | { Blocked: string };

export interface SecurityAuditLog {
  timestamp: number;
  userId: string;              // Principal as string
  action: SecurityAction;
  resourceType: string;
  resourceId: string;
  result: SecurityResult;
  metadata: Array<[string, string]>;
}

// 🔥 NEW: Deployed Agent Type (matches backend Motoko definition)
export interface DeployedAgent {
  id: string;
  name: string;
  description?: string;
  backendCanisterId?: string;  // Principal as string
  frontendCanisterId?: string; // Principal as string
  status: 'active' | 'inactive' | 'error';
  agentType?: 'workflow' | 'standalone' | 'assistant' | 'agency';
  createdAt: number;           // Nat64 as number
  lastDeployedAt?: number;     // Nat64 as number
  // Legacy fields for backwards compatibility
  serverPairId?: string;
  serverPairName?: string;
  backendUrl?: string;
  frontendUrl?: string;
  deployedAt?: number;
  error?: string;
}

export interface Project {
  id: string;
  name: string;
  title?: string;
  preview?: string;
  icon?: string;
  iconType?: string;
  time?: string;
  isTemplate?: boolean;
  unreadCount?: number;
  description?: string;
  projectType: {
    name: string;
    subType: string;
  };
  canisters: string[];
  created: number;
  updated: number;
  visibility: string;
  status: string;
  collaborators?: string[];
  // Deployment tracking flags
  hasBackendChanged?: boolean;
  hasFrontendChanged?: boolean;
  templateId?: string;
  npmPackages?: NPMPackageInfo[];
  motokoPackages?: PackageInfo[];
  workingCopyBaseVersion?: string;
  lastMessageTime?: number;
  messageCount?: number;
  messages: ChatInterfaceMessage[];
  metadata?: ProjectMetadata;
  files?: { [key: string]: string };
  deployedAgents?: DeployedAgent[]; // 🔥 NEW: Deployed agents stored in project
  customColor?: string;
  isBookmarked?: boolean;
  priority?: string;
  category?: string;
  tags?: string[];
  // 🔥 NEW: Project-level priority system metadata
  prioritySystemMetadata?: {
    currentInstructionId: string | null;
    totalPriorityAssignments: number;
    averagePriorityProcessingTime: number;
    prioritySystemVersion: string;
    lastPriorityOptimization: number;
    priorityHealthScore: number;        // 0-100 overall health of priority system for this project
    commonIssues: string[];            // Recurring priority system issues
    performanceHistory: Array<{        // Historical performance tracking
      timestamp: number;
      processingTime: number;
      tokenOptimization: number;
      successRate: number;
    }>;
  };
}

// 🔥 ENHANCED: ChatInterfaceMessage with comprehensive priority system fields and validation
export interface ChatInterfaceMessage {
  id: string;
  type: 'user' | 'system';
  content: string;
  timestamp: Date;
  isGenerating?: boolean;
  extractedFiles?: { [key: string]: string };
  metadata?: any;
  isProjectGeneration?: boolean;
  
  // 🔥 ENHANCED: Priority system fields with validation
  priorityContext?: MessagePriorityContext;
  conversationGroup?: string; // Groups related messages together
  isCurrentInstruction?: boolean; // Quick flag for current user instruction
  
  // 🔥 NEW: Message validation and integrity fields
  validationState?: {
    isValidMessage: boolean;
    hasValidPriorityContext: boolean;
    priorityConsistencyCheck: boolean;  // Priority is consistent across all store arrays
    lastValidationTime: number;
    validationErrors: string[];
    integrityHash: string;              // Hash to detect message tampering
  };
  
  // 🔥 NEW: Performance tracking for this message
  processingMetrics?: {
    createdAt: number;
    priorityAssignedAt?: number;
    lastUpdatedAt?: number;
    processingSteps: Array<{
      step: string;
      timestamp: number;
      duration: number;
      success: boolean;
      error?: string;
    }>;
    totalLifecycleTime?: number;        // Total time from creation to final state
  };
  
  // 🔥 NEW: Context and relationship tracking
  relationshipMetadata?: {
    parentMessageId?: string;           // Message this is responding to
    childMessageIds: string[];          // Messages responding to this one
    relatedMessageIds: string[];        // Messages related by topic/context
    topicSignature: string;             // Fingerprint of the topic/theme
    contextWindow: {                    // Which messages were in context when this was processed
      includedMessageIds: string[];
      excludedMessageIds: string[];
      contextStrategy: string;
      totalTokens: number;
    };
  };
  
  // Existing deployment coordination fields
  deploymentContext?: {
    projectId: string;
    projectName: string;
    generatedFiles: { [fileName: string]: string };
    canDeploy: boolean;
  };
  deploymentState?: {
    status: 'ready' | 'deploying' | 'success' | 'error';
    progress?: number;
    error?: string;
    deployedUrl?: string;
    duration?: number;
  };
}

export interface CodeArtifact {
  id: string;
  projectId: string;
  fileName: string;
  content: string;
  path: string;
  mimeType: string;
  language: string;
  lastModified: number;
  version: number;
  size: number;
}

export interface NPMPackageInfo {
  name: string;
  version: string;
  dependencyType: string;
}

export interface PackageInfo {
  name: string;
  version: string;
  repo: string;
  dir?: string[];
  homepage?: string[];
}

export interface GeneratedFile {
  fileName: string;
  displayName: string;
  language: string;
  icon: string;
  isComplete: boolean;
  isWriting: boolean;
}

export interface TabGroup {
  id: string;
  name: string;
  icon: string;
  color: string;
  files: GeneratedFile[];
}

export interface ProjectMetadata {
  difficultyLevel?: string;
  externalLinks?: { [key: string]: string };
  thumbnailUrl?: string;
  completionStatus?: string;
  lastAccessed?: number;
  fileCount?: number;
  tags: string[];
  learningObjectives?: string[];
  notes?: string;
  customIcon?: string;
  category?: string;
  priority?: string;
  isBookmarked?: boolean;
  estimatedSize?: number;
  customColor?: string;
}

// 🔥 ENHANCED: StreamingState with priority system integration
export interface StreamingState {
  isStreaming: boolean;
  streamingContent: string;
  streamingMessageId: string | null;
  accumulatedLength: number;
  // 🔥 NEW: Priority context for streaming
  priorityContext?: {
    streamingPriority: MessagePriority;
    expectedFinalPriority: MessagePriority;
    priorityLocked: boolean;              // Whether priority can still change during streaming
    contextPreservation: {               // How to preserve priority context during streaming
      preserveCurrentInstruction: boolean;
      maintainPriorityOrdering: boolean;
      updatePriorityAssignments: boolean;
    };
  };
}

// NEW: Subscription System Types
export enum SubscriptionTier {
  FREE = 'FREE',
  STARTER = 'STARTER',
  DEVELOPER = 'DEVELOPER', 
  PRO = 'PRO',
  STUDIO = 'STUDIO'
}

// Backend-synced subscription plan feature
export interface PlanFeature {
  description: string;
  enabled: boolean;
  order: number;
}

// Backend-synced subscription plan
export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  description: string;
  monthlyPrice: number; // In cents
  originalPrice: number | null;
  discountPercentage: number | null;
  monthlyCredits: number;
  hostingCredits: number;
  maxProjects: number | null; // null = unlimited
  features: PlanFeature[];
  badges: string[]; // e.g., ["Most Popular", "LAUNCH SPECIAL"]
  ctaText: string; // Call-to-action button text
  isActive: boolean;
  order: number; // Display order
  stripeProductId: string | null;
  stripePriceId: string | null;
  createdAt: number;
  updatedAt: number;
}

// Input type for creating/updating subscription plans
export interface SubscriptionPlanInput {
  tier: SubscriptionTier;
  name: string;
  description: string;
  monthlyPrice: number;
  originalPrice: number | null;
  discountPercentage: number | null;
  monthlyCredits: number;
  hostingCredits: number;
  maxProjects: number | null;
  features: PlanFeature[];
  badges: string[];
  ctaText: string;
  isActive: boolean;
  order: number;
  stripeProductId: string | null;
  stripePriceId: string | null;
}

export interface SubscriptionState {
  currentTier: SubscriptionTier;
  isActive: boolean;
  customerId: string | null;
  subscriptionId: string | null;
  billingCycleStart: number | null;
  billingCycleEnd: number | null;
  monthlyCredits: number;
  usedCredits: number;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  paymentStatus: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing';
  cancelAtPeriodEnd: boolean;
}

export interface StripeProductMapping {
  [key: string]: {
    productId: string;
    priceId: string;
    yearlyPriceId?: string;
  };
}

export interface SubscriptionCheckoutSession {
  sessionId: string;
  url: string;
  tier: SubscriptionTier;
  isYearly: boolean;
}

// Enhanced initialization stages for subscription flow - UPDATED with optimization stages
export type InitializationStageWithSubscription = 
  | 'IDLE'
  | 'AUTHENTICATING'
  | 'AUTH_COMPLETE'
  | 'CHECKING_CANISTER'
  | 'SUBSCRIPTION_SELECTION'
  | 'PROCESSING_PAYMENT_RETURN'
  | 'PROCESSING_PAYMENT'
  | 'SUBSCRIPTION_VERIFICATION'
  | 'SUBSCRIPTION_COMPLETE'
  | 'CREATING_CANISTER'
  | 'DOWNLOADING_WASM'
  | 'UPLOADING_WASM'
  | 'DEPLOYING_WASM'
  | 'FINALIZING_WASM'
  | 'CANISTER_READY'
  | 'CHECKING_WALLET'
  | 'CREATING_WALLET'
  | 'LOADING_PROJECTS'
  | 'SYNCING_SUBSCRIPTION'
  // NEW: Optimization-specific stages
  | 'USING_CACHED_DATA'
  | 'BACKGROUND_SYNC'
  | 'READY'
  | 'ERROR';

// NEW: Payment processing state interface
export interface PaymentProcessingState {
  isProcessing: boolean;
  stage: 'VERIFYING_PAYMENT' | 'CREATING_CANISTER' | 'DEPLOYING_CODE' | 'FINALIZING_SETUP' | null;
  progress: number;
  message: string;
  error: string | null;
  sessionId: string | null;
}

// NEW: Payment processing error types
export interface PaymentProcessingError {
  type: 'STRIPE_VERIFICATION_FAILED' | 'CANISTER_CREATION_FAILED' | 'WASM_DEPLOYMENT_FAILED' | 'SETUP_TIMEOUT' | 'UNKNOWN_ERROR';
  message: string;
  details?: any;
  canRetry: boolean;
  contactSupport: boolean;
}

export interface PaymentIntentResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
  amount?: number;
  currency?: string;
}

export interface SubscriptionCreationResult {
  success: boolean;
  subscriptionId?: string;
  customerId?: string;
  checkoutUrl?: string;
  error?: string;
}

export interface BillingPortalResult {
  success: boolean;
  url?: string;
  error?: string;
}

// NEW: Subscription sync types
export interface SubscriptionSyncResult {
  success: boolean;
  statusChanged: boolean;
  oldStatus: StripeSubscriptionStatus | null;
  newStatus: StripeSubscriptionStatus | null;
  requiresAction: boolean;
  actionType: 'renewal_needed' | 'payment_failed' | 'expired' | 'cancelled' | null;
  error?: string;
}

export interface StripeSubscriptionStatus {
  id: string;
  status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'trialing';
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  customer: string;
}

export interface SubscriptionSyncState {
  isSyncing: boolean;
  lastSyncTime: number | null;
  syncError: string | null;
  requiresRenewal: boolean;
  renewalActionType: 'renewal_needed' | 'payment_failed' | 'expired' | 'cancelled' | null;
}

// NEW: Cache management types for optimization
export interface CacheValidationResult {
  isValid: boolean;
  reason?: 'expired' | 'wrong_user' | 'wrong_version' | 'corrupted';
  age?: number;
}

export interface InitializationCacheStats {
  userInit: { exists: boolean; age?: number };
  subscription: { exists: boolean; age?: number };
  wallet: { exists: boolean; age?: number };
  balance: { exists: boolean; age?: number };
  projects: { exists: boolean; age?: number };
}

// NEW: Optimization service interfaces
export interface OptimizationMetrics {
  cacheHitRate: number;
  averageInitTime: number;
  backgroundSyncSuccess: number;
  fallbackRate: number;
  lastOptimizationTime: number;
}

// NEW: Intelligent Context Selection Types
export interface FileMetadata {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  description?: string;
  category: 'backend' | 'frontend' | 'config' | 'core';
  keywords: string[];
  imports: string[];
  exports: string[];
}

export interface ProjectFilesMetadata {
  files: FileMetadata[];
  relationships: {
    [fileName: string]: {
      imports: string[];
      exports: string[];
      dependents: string[];
    };
  };
  featureMap: {
    [feature: string]: string[];
  };
  totalFiles: number;
  lastUpdated: number;
}

export interface ContextSelectionResult {
  primaryFiles: string[];
  supportingFiles: string[];
  configFiles: string[];
  excludedFiles: string[];
  totalFiles: number;
  estimatedTokens: number;
}

export interface FileSelectionReasoning {
  primaryFiles: string;
  supportingFiles: string;
  exclusions: string;
}

export interface EnhancedClassificationRequest {
  apiKey: string;
  message: string;
  context: {
    hasExistingFiles: boolean;
    fileCount: number;
    isEmpty: boolean;
    projectType?: string;
    recentMessages?: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
  };
  projectMetadata?: {
    files: Array<{
      name: string;
      type: string;
      size: number;
      lastModified: number;
      description?: string;
      category: string;
      keywords: string[];
    }>;
    relationships?: {
      [fileName: string]: {
        imports: string[];
        exports: string[];
        dependents: string[];
      };
    };
    featureMap?: {
      [feature: string]: string[];
    };
  };
}

export interface EnhancedClassificationResponse {
  classification: 'CREATE_PROJECT' | 'UPDATE_MESSAGE' | 'REGULAR_CHAT';
  confidence: number;
  reasoning: string;
  contextSelection: ContextSelectionResult;
  selectionReasoning: FileSelectionReasoning;
  sessionId: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  model?: string;
}

export interface SmartContextSelectionConfig {
  maxFiles: number;
  includeConfig: boolean;
  includeDependencies: boolean;
  tokenBudget: number;
  fallbackToAll: boolean;
}

// 🔥 ENHANCED: ChatContext with comprehensive priority system metadata
export interface ChatContext {
  activeFile: string;
  fileContent: string;
  selectedFiles: string[];
  selectedFileContents?: { [fileName: string]: string };
  fileContents?: { [fileName: string]: string };
  projectStructure: Array<{name: string; type: string}>;
  projectInfo: {
    id: string;
    name: string;
    type: string;
  };
  aiRulesContext?: string;
  documentationContext?: string;
  githubContext?: string;
  stylingContext?: {
    colorPalettes?: Array<{
      name: string;
      colors: Array<{ hex: string; role?: string }>;
      source?: string;
    }>;
    designInspirations?: Array<{
      name: string;
      url: string;
      extractedColors?: string[];
      extractedTypography?: any;
    }>;
  };
  codeTemplatesContext?: string;
  apiEndpointsContext?: string;
  mcpContext?: string;
  workflowContext?: {
    availableWorkflows: Array<{ id: string; name: string; description: string }>;
    integratedWorkflows: Array<{ id: string; workflowId: string; workflowName: string; isEnabled: boolean }>;
  };
  businessAgencyContext?: {
    availableBusinessAgencies: Array<{ id: string; name: string; description: string; category: string }>;
    integratedBusinessAgencies: Array<{ id: string; agencyId: string; agencyName: string; isEnabled: boolean; category: string }>;
  };
  agentContext?: {
    availableAgents: Array<{ canisterId: string; name: string; description?: string }>;
    integratedAgents: Array<{ id: string; agentCanisterId: string; agentName: string; isEnabled: boolean }>;
  };
  // NEW: Intelligent context selection metadata
  contextMetadata?: {
    selectionReasoning?: FileSelectionReasoning;
    estimatedTokens?: number;
    optimizationApplied?: boolean;
  };
  // 🔥 ENHANCED: Priority system metadata with validation
  priorityMetadata?: {
    currentInstructionTokens: number;
    supportingContextTokens: number;
    systemContextTokens: number;
    totalPriorityTokens: number;
    priorityStructureApplied: boolean;
    truncationApplied: boolean;
    // 🔥 NEW: Advanced priority context validation
    validationMetadata: {
      priorityConsistencyScore: number;    // 0-100 how consistent priorities are
      contextRelevanceScore: number;       // 0-100 how relevant the context is
      instructionClarityScore: number;     // 0-100 how clear the current instruction is
      optimizationEfficiency: number;     // 0-100 how well context was optimized
      lastValidated: number;
      validationWarnings: string[];
      criticalIssues: string[];
    };
    // 🔥 NEW: Performance and debugging metadata
    performanceData: {
      contextBuildingTime: number;         // Milliseconds to build context
      priorityAssignmentTime: number;      // Milliseconds to assign priorities
      optimizationTime: number;           // Milliseconds for optimization pass
      totalProcessingTime: number;        // Total context processing time
      memoryUsage: number;                // Bytes used for context
    };
    // 🔥 NEW: Context quality and completeness tracking
    qualityMetrics: {
      completenessScore: number;          // 0-100 how complete the context is
      relevanceScore: number;             // 0-100 how relevant to current instruction
      diversityScore: number;             // 0-100 how diverse the context sources are
      freshnessScore: number;             // 0-100 how recent/fresh the context is
      confidenceLevel: 'high' | 'medium' | 'low';
      recommendedImprovements: string[];
    };
  };
}

// 🔥 ENHANCED: ChatMessage interface for priority system with validation
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  // 🔥 ENHANCED: Priority system fields with validation
  priority?: MessagePriority;
  priorityReason?: string;
  tokenWeight?: number;
  // 🔥 NEW: Message validation and quality tracking
  messageValidation?: {
    isPriorityValid: boolean;
    isContentAppropriate: boolean;
    hasValidStructure: boolean;
    qualityScore: number;                 // 0-100 overall message quality
    validationErrors: string[];
    contentWarnings: string[];
  };
  // 🔥 NEW: Processing and performance metadata
  processingMetadata?: {
    processedAt: number;
    processingDuration: number;
    tokenCount: number;
    priorityAssignmentDuration: number;
    validationDuration: number;
    totalHandlingTime: number;
  };
}

// Workflow and automation types for enhanced context
export interface AutoRetryWorkflow {
  workflowId: string;
  projectId: string;
  phase: string;
  fileApplicationTriggered?: boolean;
  deploymentTriggered?: boolean;
}

// Enhanced classification context types
export interface ClassificationContext {
  currentRequest: {
    message: string;
      intentAnalysis: {
      primaryIntent: 'CREATE_PROJECT' | 'UPDATE_CODE' | 'CONVERSATIONAL';
      confidence: number;
      reasoning: string;
      intentSignals: string[];
      contextSelection?: ContextSelectionResult;
      selectionReasoning?: FileSelectionReasoning;
    };
    timestamp: number;
  };
  projectState: {
    id: string;
    name: string;
    type: string;
    isEmpty: boolean;
    hasExistingFiles: boolean;
    fileCount: number;
    fileTypes: string[];
  };
  conversationFlow: {
    recentMessages: Array<{
      type: string;
      content: string;
      isGeneration: boolean;
    }>;
    lastUserIntent: string;
    conversationLength: number;
  };
  selectedContext: {
    selectedFiles: string[];
    activeFile: string;
    hasSelections: boolean;
  };
  aiRulesContext: string;
}

// File selection criteria for intelligent context
export interface FileSelectionCriteria {
  keywords: string[];
  mentionedFiles: string[];
  requestType: 'CREATE_PROJECT' | 'UPDATE_CODE' | 'CONVERSATIONAL';
  maxFiles: number;
  includeConfig: boolean;
}

// 🔥 NEW: Priority System Validation and Health Types

export interface PrioritySystemValidationResult {
  isValid: boolean;
  validationScore: number;                    // 0-100 overall validation score
  criticalErrors: string[];                  // Must-fix issues
  warnings: string[];                        // Should-fix issues
  suggestions: string[];                     // Nice-to-fix improvements
  
  // Detailed validation breakdown
  componentValidation: {
    messageValidation: {
      totalMessages: number;
      validMessages: number;
      invalidMessages: number;
      missingPriorityContext: number;
      inconsistentPriorities: number;
      detailsByPriority: { [key in MessagePriority]: number };
    };
    storeValidation: {
      arrayConsistency: boolean;              // All message arrays have same messages
      priorityAssignmentsSync: boolean;       // priorityAssignments map is in sync
      currentInstructionConsistency: boolean; // currentInstructionId is consistent
      stateIntegrity: number;                // 0-100 overall state integrity score
    };
    performanceValidation: {
      averageProcessingTime: number;         // Average priority assignment time
      memoryEfficiency: number;              // 0-100 memory efficiency score
      errorRate: number;                     // Percentage of priority assignment errors
      recommendedOptimizations: string[];
    };
  };
  
  // Actionable recommendations
  recommendations: {
    immediate: string[];                      // Fix these right now
    shortTerm: string[];                     // Fix these soon
    longTerm: string[];                      // Consider for future
    preventive: string[];                    // Prevent future issues
  };
  
  lastValidation: number;
  nextValidationRecommended: number;
}

export interface PrioritySystemHealthMetrics {
  overallHealth: number;                      // 0-100 overall system health
  
  // Core metrics
  assignmentSuccessRate: number;             // Percentage of successful priority assignments
  synchronizationConsistency: number;       // How consistent priority sync is across store
  processingEfficiency: number;             // How efficiently priorities are processed
  memoryUtilization: number;               // Memory usage efficiency
  
  // Trend analysis
  trends: {
    assignmentTrend: 'improving' | 'stable' | 'declining';
    performanceTrend: 'improving' | 'stable' | 'declining';
    errorTrend: 'improving' | 'stable' | 'declining';
    trendConfidence: number;               // 0-100 confidence in trend analysis
  };
  
  // Issue tracking
  recentIssues: Array<{
    timestamp: number;
    type: 'critical' | 'warning' | 'info';
    category: 'assignment' | 'sync' | 'performance' | 'validation';
    message: string;
    resolved: boolean;
    resolution?: string;
  }>;
  
  // Performance history
  performanceHistory: Array<{
    timestamp: number;
    processingTime: number;
    successRate: number;
    memoryUsage: number;
    errorCount: number;
  }>;
  
  // Predictive insights
  predictions: {
    nextLikelyIssue?: string;
    recommendedMaintenance?: string;
    capacityProjection?: {
      currentLoad: number;
      projectedLoad: number;
      timeToCapacity: number;              // Milliseconds until capacity issues
    };
  };
}

// 🔥 NEW: Priority System Configuration and Tuning Types

export interface PrioritySystemConfiguration {
  version: string;
  
  // Assignment behavior
  assignmentPolicy: {
    defaultPriority: MessagePriority;
    autoPromoteUserMessages: boolean;       // Auto-promote user messages to CRITICAL
    allowPriorityOverride: boolean;         // Allow manual priority overrides
    maxPriorityAge: number;                // Milliseconds before priority reassignment
    priorityInheritance: boolean;          // Child messages inherit parent priority
  };
  
  // Synchronization settings
  synchronizationPolicy: {
    maxSyncAttempts: number;               // Maximum sync retry attempts
    syncTimeout: number;                   // Milliseconds before sync timeout
    validateAfterSync: boolean;            // Validate state after sync operations
    autoRepairInconsistencies: boolean;    // Automatically fix detected issues
  };
  
  // Performance settings
  performanceSettings: {
    maxTokenBudget: number;               // Maximum tokens for priority assembly
    enableOptimization: boolean;          // Enable token/context optimization
    cacheAssemblies: boolean;            // Cache assembled contexts
    cacheTTL: number;                    // Cache time-to-live in milliseconds
    enablePerformanceTracking: boolean;   // Track detailed performance metrics
  };
  
  // Validation settings
  validationSettings: {
    enableContinuousValidation: boolean;   // Continuously validate priority state
    validationInterval: number;           // Milliseconds between validations
    strictMode: boolean;                  // Fail fast on validation errors
    enableHealthMonitoring: boolean;      // Monitor overall system health
  };
  
  // Debug and troubleshooting
  debugSettings: {
    enableDetailedLogging: boolean;       // Log detailed priority operations
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    enablePerformanceProfiling: boolean;  // Profile priority system performance
    retainDebugHistory: number;          // Number of debug entries to retain
  };
}

// 🔥 NEW: Priority System Operation Results

export interface PriorityOperationResult {
  success: boolean;
  operation: 'assign' | 'sync' | 'validate' | 'optimize' | 'repair';
  duration: number;
  messageId?: string;
  projectId?: string;
  
  // Operation details
  details: {
    oldPriority?: MessagePriority;
    newPriority?: MessagePriority;
    reason: string;
    affectedMessages: number;
    optimizationsSaved?: number;        // Tokens or processing time saved
  };
  
  // Result validation
  validation: {
    isResultValid: boolean;
    consistencyCheck: boolean;
    performanceImpact: number;          // -100 to +100 performance impact
    validationErrors: string[];
  };
  
  // Recommendations based on operation result
  recommendations: string[];
  
  // Error details if operation failed
  error?: {
    type: string;
    message: string;
    stack?: string;
    recovery?: string;                  // Suggested recovery action
  };
}

// 🔥 NEW: Priority System Utilities and Helpers Types

export interface PriorityUtilities {
  validateMessage: (message: ChatInterfaceMessage) => PriorityOperationResult;
  repairPriorityContext: (messageId: string) => PriorityOperationResult;
  optimizeAssembly: (assembly: PriorityMessageAssembly) => PriorityMessageAssembly;
  analyzePerformance: (projectId: string) => PrioritySystemHealthMetrics;
  generateHealthReport: () => PrioritySystemValidationResult;
  suggestOptimizations: (context: ChatContext) => string[];
}

export interface PrioritySystemEvents {
  onPriorityAssigned?: (result: PriorityOperationResult) => void;
  onSynchronizationComplete?: (result: PriorityOperationResult) => void;
  onValidationFailed?: (result: PriorityOperationResult) => void;
  onPerformanceIssue?: (metrics: PrioritySystemHealthMetrics) => void;
  onHealthCritical?: (issues: string[]) => void;
  onOptimizationComplete?: (result: PriorityOperationResult) => void;
}

// 🔥 NEW: Advanced Priority System Analytics

export interface PrioritySystemAnalytics {
  // Usage analytics
  usage: {
    totalMessages: number;
    messagesWithPriority: number;
    priorityDistribution: { [key in MessagePriority]: number };
    averageMessagesPerProject: number;
    mostActivePriority: MessagePriority;
    utilizationRate: number;            // 0-100 how well priority system is used
  };
  
  // Effectiveness analytics
  effectiveness: {
    responseQuality: number;            // 0-100 average response quality
    contextRelevance: number;           // 0-100 how relevant contexts are
    focusImprovement: number;           // 0-100 improvement in AI focus
    userSatisfactionProxy: number;      // 0-100 estimated user satisfaction
    tokenOptimizationSavings: number;  // Total tokens saved
  };
  
  // Performance analytics
  performance: {
    averageAssignmentTime: number;      // Average priority assignment time
    averageAssemblyTime: number;        // Average assembly building time
    memoryEfficiency: number;           // 0-100 memory usage efficiency
    cacheHitRate: number;              // 0-100 cache effectiveness
    errorRate: number;                 // Percentage of operations with errors
  };
  
  // Trend analysis
  trends: {
    usageGrowth: number;               // Percentage growth in usage
    performanceTrend: number;          // Performance improvement/degradation
    qualityTrend: number;              // Quality improvement/degradation
    userAdoptionRate: number;          // How quickly users adopt priority features
  };
  
  // Predictive insights
  insights: {
    recommendedActions: string[];       // Data-driven recommendations
    predictedIssues: string[];         // Likely future problems
    optimizationOpportunities: string[]; // Areas for improvement
    capacityRecommendations: string[];  // Scaling recommendations
  };
  
  generatedAt: number;
  dataTimeRange: {
    start: number;
    end: number;
    totalProjects: number;
    totalSessions: number;
  };
}

// ===============================
// USER PREFERENCES & PROFILE TYPES
// ===============================

export interface UserProfile {
  username: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  coverPhoto?: string;
  email?: string;
  website?: string;
  github?: string;
  socials?: UserSocials;
  metadata?: Array<[string, string]>;
}

export interface UserSocials {
  openchat?: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
}

export interface AccountPreferences {
  notificationPreferences: NotificationPreferences;
  defaultVisibility: 'Public' | 'Private' | 'Contacts';
  timezone?: string;
  sessionTimeout?: number;
  customPreferences?: Array<[string, string]>;
}

export interface NotificationPreferences {
  channelPreferences: {
    email: boolean;
    discord: boolean;
    telegram: boolean;
    inApp: boolean;
  };
  digestFrequency?: string; // "daily", "weekly", etc.
  notificationTypes?: Array<[string, boolean]>;
}

export interface ExternalServiceTokens {
  github?: GitHubConfig;
  discord?: DiscordConfig;
  telegram?: TelegramConfig;
}

export interface GitHubConfig {
  accessToken: string;
  tokenExpiry: number;
  connectedRepositories: string[];
}

export interface DiscordConfig {
  webhookUrl: string;
  serverId: string;
  channelId: string;
}

export interface TelegramConfig {
  chatId: string;
  botEnabled: boolean;
}

// ===============================
// NOTIFICATION TYPES
// ===============================

export enum NotificationSeverity {
  CRITICAL = 'Critical',
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low'
}

export enum NotificationCategory {
  SYSTEM = 'System',
  ACCOUNT = 'Account',
  CREDITS = 'Credits',
  SUBSCRIPTION = 'Subscription',
  DEPLOYMENT = 'Deployment',
  SECURITY = 'Security',
  FEATURE = 'Feature',
  ANNOUNCEMENT = 'Announcement'
}

export interface NotificationAction {
  label: string;
  actionType:
    | { NavigateTo: string }
    | { OpenDialog: string }
    | { ExternalLink: string }
    | { Dismiss: null };
}

export interface NotificationEvent {
  id: number;
  timestamp: bigint;
  severity: NotificationSeverity;
  category: NotificationCategory;
  title: string;
  message: string;
  icon?: string;
  metadata?: Array<[string, string]>;
  actions?: NotificationAction[];
  expiresAt?: bigint;
  createdBy: string;
  isPinned: boolean;
  
  // Frontend-only fields
  isRead?: boolean;
  isDismissed?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// KONTEXT UNIVERSITY TYPES (Phase 1 & 2)
// ═══════════════════════════════════════════════════════════════════════════

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type DegreeType = 'certificate' | 'associate' | 'bachelor' | 'master' | 'doctorate';
export type EnrollmentStatus = 'active' | 'completed' | 'dropped' | 'paused';
export type Honors = 'summa_cum_laude' | 'magna_cum_laude' | 'cum_laude';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface AcademicProgram {
  programId: string;
  title: string;
  description: string;
  degreeType: DegreeType;
  durationWeeks: number;
  totalCredits: number;
  requiredCourses: string[];
  electiveCourses: string[];
  prerequisites: string[];
  subscriptionTier: string;
  imageUrl: string;
  difficulty: DifficultyLevel;
  enrollmentCount: number;
  completionCount: number;
  averageRating: number;
  createdAt: bigint;
  isActive: boolean;
}

export interface Course {
  courseId: string;
  title: string;
  description: string;
  instructor: string;
  programIds: string[];
  durationWeeks: number;
  credits: number;
  subscriptionTier: string;
  thumbnailUrl: string;
  introVideoUrl?: string;
  difficulty: DifficultyLevel;
  tags: string[];
  prerequisites: string[];
  enrollmentCount: number;
  completionCount: number;
  averageRating: number;
  totalWatchHours: number;
  createdAt: bigint;
  updatedAt: bigint;
  isPublished: boolean;
}

export interface Lesson {
  lessonId: string;
  courseId: string;
  title: string;
  description: string;
  videoUrl: string;
  videoDuration: number;
  orderIndex: number;
  isFree: boolean;
  transcriptUrl?: string;
  resourceUrls: ResourceLink[];
  averageRating: number;
  viewCount: number;
  createdAt: bigint;
  updatedAt: bigint;
}

export interface ResourceLink {
  title: string;
  url: string;
  resourceType: 'pdf' | 'code' | 'link' | 'video' | 'article';
}

export interface ProgramEnrollment {
  enrollmentId: string;
  programId: string;
  student: string;
  enrolledAt: bigint;
  completedAt?: bigint;
  status: EnrollmentStatus;
  creditsEarned: number;
  currentGPA: number;
  completedCourseIds: string[];
}

export interface CourseEnrollment {
  enrollmentId: string;
  courseId: string;
  student: string;
  enrolledAt: bigint;
  completedAt?: bigint;
  lastAccessedAt: bigint;
  status: EnrollmentStatus;
  progress: number;
  currentLessonId?: string;
  certificateUrl?: string;
}

export interface VideoProgress {
  progressId: string;
  lessonId: string;
  student: string;
  watchedDuration: number;
  totalDuration: number;
  percentComplete: number;
  completed: boolean;
  lastWatchedAt: bigint;
  lastPosition: number;
  watchCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: ASSESSMENTS
// ═══════════════════════════════════════════════════════════════════════════

export type AssessmentType = 'quiz' | 'test' | 'midterm' | 'final' | 'project';
export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'code';

export interface Question {
  questionId: string;
  questionType: QuestionType;
  questionText: string;
  points: number;
  options?: string[];
  correctAnswer?: string;
  codeTemplate?: string;
  testCases?: string[];
}

export interface Answer {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  pointsEarned: number;
}

export interface Assessment {
  assessmentId: string;
  courseId: string;
  lessonId?: string;
  title: string;
  description: string;
  assessmentType: AssessmentType;
  questions: Question[];
  passingScore: number;
  timeLimit?: number;
  attemptsAllowed: number;
  isRequired: boolean;
  orderIndex: number;
  createdAt: bigint;
  isPublished: boolean;
}

export interface AssessmentSubmission {
  submissionId: string;
  assessmentId: string;
  student: string;
  answers: Answer[];
  score: number;
  passed: boolean;
  attemptNumber: number;
  startedAt: bigint;
  submittedAt: bigint;
  timeSpent: number;
  feedback?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: REVIEWS
// ═══════════════════════════════════════════════════════════════════════════

export interface CourseReview {
  reviewId: string;
  courseId?: string;
  lessonId?: string;
  programId?: string;
  student: string;
  rating: number;
  title: string;
  comment: string;
  pros: string[];
  cons: string[];
  difficulty?: DifficultyLevel;
  wouldRecommend: boolean;
  isVerifiedCompletion: boolean;
  createdAt: bigint;
  updatedAt: bigint;
  helpfulCount: number;
  instructorResponse?: InstructorResponse;
}

export interface InstructorResponse {
  responseText: string;
  respondedAt: bigint;
  updatedAt: bigint;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: DISCUSSIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface Discussion {
  discussionId: string;
  courseId?: string;
  lessonId?: string;
  programId?: string;
  author: string;
  authorName: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: bigint;
  updatedAt: bigint;
  replyCount: number;
  viewCount: number;
  upvotes: number;
  isPinned: boolean;
  isSolved: boolean;
  solvedBy?: string;
}

export interface Reply {
  replyId: string;
  discussionId: string;
  author: string;
  authorName: string;
  content: string;
  createdAt: bigint;
  updatedAt: bigint;
  upvotes: number;
  isInstructorReply: boolean;
  isAcceptedAnswer: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: DEGREES
// ═══════════════════════════════════════════════════════════════════════════

export interface Degree {
  degreeId: string;
  programId: string;
  student: string;
  degreeType: DegreeType;
  title: string;
  issuedAt: bigint;
  completedAt: bigint;
  creditsEarned: number;
  gpa: number;
  certificateUrl?: string;
  verificationCode: string;
  coursesCompleted: CompletedCourse[];
  honors?: Honors;
}

export interface CompletedCourse {
  courseId: string;
  courseTitle: string;
  completedAt: bigint;
  grade: number;
  credits: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: ACHIEVEMENTS
// ═══════════════════════════════════════════════════════════════════════════

export type AchievementCriteria = 
  | { complete_courses: number }
  | { earn_degrees: number }
  | { maintain_gpa: number }
  | { watch_hours: number }
  | { complete_assessments: number }
  | { first_lesson: null }
  | { first_course: null }
  | { first_program: null }
  | { all_degrees_in_program: string }
  | { complete_learning_path: string };

export interface Achievement {
  achievementId: string;
  title: string;
  description: string;
  badgeImageUrl: string;
  criteria: AchievementCriteria;
  rarity: Rarity;
  isSecret: boolean;
}

export interface UserAchievement {
  achievementId: string;
  student: string;
  earnedAt: bigint;
  progress: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: INSTRUCTORS
// ═══════════════════════════════════════════════════════════════════════════

export interface Instructor {
  instructorId: string;
  name: string;
  bio: string;
  title: string;
  avatarUrl: string;
  expertise: string[];
  socialLinks: SocialLink[];
  coursesCreated: string[];
  totalStudents: number;
  averageRating: number;
  joinedAt: bigint;
  isVerified: boolean;
}

export interface SocialLink {
  platform: 'twitter' | 'linkedin' | 'youtube' | 'website' | 'github';
  url: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: LEARNING PATHS
// ═══════════════════════════════════════════════════════════════════════════

export interface LearningPath {
  pathId: string;
  title: string;
  description: string;
  programIds: string[];
  courseIds: string[];
  estimatedHours: number;
  difficulty: DifficultyLevel;
  forRole: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: STATISTICS
// ═══════════════════════════════════════════════════════════════════════════

export interface UniversityStats {
  totalPrograms: number;
  totalCourses: number;
  totalLessons: number;
  totalStudents: number;
  totalInstructors: number;
  totalDegreesIssued: number;
  totalWatchHours: number;
  averageCourseRating: number;
  courseCompletionRate: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM FORUM TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ForumCategory {
  categoryId: string;
  name: string;
  description: string;
  icon: string;
  slug: string;
  orderIndex: number;
  threadCount: number;
  postCount: number;
  lastActivity: bigint | null;
  lastThreadTitle: string | null;
  lastThreadId: string | null;
  color: string;
  isActive: boolean;
  createdAt: bigint;
  updatedAt: bigint;
}

export interface ForumThread {
  threadId: string;
  categoryId: string;
  categoryName: string;
  author: string;
  authorName: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: bigint;
  updatedAt: bigint;
  viewCount: number;
  replyCount: number;
  upvotes: number;
  downvotes: number;
  isPinned: boolean;
  isLocked: boolean;
  isFeatured: boolean;
  hasAcceptedAnswer: boolean;
  acceptedAnswerId: string | null;
  lastReplyAt: bigint | null;
  lastReplyBy: string | null;
  lastReplyByName: string | null;
}

export interface ForumReply {
  replyId: string;
  threadId: string;
  author: string;
  authorName: string;
  content: string;
  createdAt: bigint;
  updatedAt: bigint;
  upvotes: number;
  downvotes: number;
  isEdited: boolean;
  isDeleted: boolean;
  isAcceptedAnswer: boolean;
  quotedReplyId: string | null;
}

export interface UserForumProfile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: bigint;
  threadCount: number;
  replyCount: number;
  upvotesReceived: number;
  reputation: number;
  badges: string[];
  isModerator: boolean;
  isAdmin: boolean;
}

export interface ForumStats {
  totalCategories: number;
  totalThreads: number;
  totalReplies: number;
  totalUsers: number;
  threadsToday: number;
  repliesToday: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC PROFILE TYPES (User Business Card)
// ═══════════════════════════════════════════════════════════════════════════

export interface PublicProfile {
  // Basic Info
  displayName?: string;
  bio?: string;
  tagline?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  location?: string;
  timezone?: string;
  
  // Contact & Social
  website?: string;
  email?: string;
  socialLinks: SocialLinks;
  
  // Professional Info
  title?: string;
  company?: string;
  skills: string[];
  interests: string[];
  
  // Showcase Settings
  featuredProjects: string[];
  showMarketplace: boolean;
  showStats: boolean;
  customSections: CustomSection[];
  
  // Privacy & Display
  isPublic: boolean;
  theme?: ProfileTheme;
  
  // Metadata
  createdAt: number;
  updatedAt: number;
  profileViews: number;
}

export interface SocialLinks {
  twitter?: string;
  github?: string;
  linkedin?: string;
  discord?: string;
  telegram?: string;
  medium?: string;
  youtube?: string;
  custom: Array<[string, string]>;
}

export interface CustomSection {
  id: string;
  title: string;
  content: string;
  icon: string;
  order: number;
  isVisible: boolean;
}

export interface ProfileTheme {
  primaryColor: string;
  accentColor: string;
  backgroundStyle: 'Solid' | 'Gradient' | 'Image' | 'Default';
  backgroundValue?: string | [string, string];
}

export interface PublicProfileStats {
  totalProjects: number;
  totalDeployments: number;
  marketplaceListings: number;
  profileViews: number;
  joinedDate: number;
}