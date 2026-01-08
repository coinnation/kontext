export interface DeploymentContext {
  messageId: string;
  projectId: string;
  projectName: string;
  generatedFiles: { [fileName: string]: string };
  timestamp: number;
  serverPairId?: string;
}

export interface DeploymentButtonState {
  status: 'ready' | 'deploying' | 'success' | 'error';
  progress?: number;
  error?: string;
  deployedUrl?: string;
  duration?: number;
  livePreviewActivated?: boolean;
  // NEW: Add retry tracking to button state
  retryAttempt?: number;
  maxRetryAttempts?: number;
  isAutoRetrying?: boolean;
}

export interface ExtractedError {
  type: 'motoko' | 'frontend';
  originalError: string;
  extractedMessage: string;
  file?: string;
  line?: number;
  column?: number;
  codeContext?: string;
  contextLines?: {
    before: string[];
    errorLine: string;
    after: string[];
  };
}

export interface DeploymentCoordinationState {
  activeDeployments: { [messageId: string]: DeploymentContext };
  deploymentStates: { [messageId: string]: DeploymentButtonState };
  isCoordinating: boolean;
  currentDeploymentMessageId: string | null;
  // NEW: Add retry tracking to coordination state
  retryAttempts: { [messageId: string]: number };
  maxRetryAttempts: number;
  isAutoRetrying: { [messageId: string]: boolean };
}

// Live preview integration types
export interface LivePreviewActivationData {
  deployedUrl: string;
  projectId: string;
  serverPairId?: string;
  activationTime: number;
}

export interface DeploymentCompletionContext {
  messageId: string;
  deployedUrl: string;
  duration: number;
  activationData: LivePreviewActivationData;
}

// NEW: Auto-retry specific types
export interface AutoRetryContext {
  messageId: string;
  currentAttempt: number;
  maxAttempts: number;
  lastError: string;
  isActive: boolean;
}

export interface DeploymentRetryState {
  canRetry: boolean;
  currentAttempt: number;
  maxAttempts: number;
  isAutoRetrying: boolean;
  lastAttemptTime: number;
}