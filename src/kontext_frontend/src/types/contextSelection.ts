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

export interface ProjectMetadata {
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