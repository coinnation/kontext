import { StateCreator } from 'zustand';
import { autoRetryCoordinator } from '../../services/AutoRetryCoordinator';
import { FileExtractor } from '../../utils/fileExtractor';
import { verboseLog } from '../../utils/verboseLogging';

export interface FileGenerationState {
  [fileName: string]: 'detected' | 'writing' | 'complete';
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

export interface FilePhaseInfo {
  phase: string;
  progress: number;
  detectedFiles: string[];
  message?: string;
}

export interface GeneratedFilesSliceState {
  projectGeneratedFiles: { [projectId: string]: { [fileName: string]: string } };
  projectFileGenerationStates: { [projectId: string]: FileGenerationState };
  projectLiveGeneratedFiles: { [projectId: string]: GeneratedFile[] };
  projectTabGroups: { [projectId: string]: TabGroup[] };
  generatedFiles: { [fileName: string]: string };
  fileGenerationStates: FileGenerationState;
  liveGeneratedFiles: GeneratedFile[];
  tabGroups: TabGroup[];
  currentPhaseInfo: FilePhaseInfo | null;
  // ENHANCED: Smart auto-retry coordination with workflow awareness
  autoRetryState: {
    isMonitoringWorkflow: boolean;
    workflowId: string | null;
    workflowStartTime: number | null;
    lastDetectedFiles: string[];
    generationStartTime: number | null;
    completionCheckInterval: NodeJS.Timeout | null;
    lastCompletionCheck: number | null;
    consecutiveNoChangeCount: number;
    fallbackTimeoutId: NodeJS.Timeout | null;
    coordinatorHealthCheckInterval: NodeJS.Timeout | null;
    // 🔧 NEW: Smart completion coordination
    completionOwnership: 'coordinator' | 'generatedFiles' | 'none';
    completionPreference: 'coordinator' | 'generatedFiles';
    completionMessageCreated: boolean;
    lastCompletionNotificationTime: number | null;
    gracePeriodActive: boolean;
    // ENHANCED: File freshness tracking with FIXED logic
    preWorkflowFileStates: { [fileName: string]: 'detected' | 'writing' | 'complete' };
    workflowFileGenerationTimestamps: { [fileName: string]: number };
    // 🔧 NEW: Enhanced file tracking
    preWorkflowFileSnapshots: { [fileName: string]: string };
    workflowFileContentHashes: { [fileName: string]: string };
    lastUpdateTime: number | null;
    workflowRecentWindow: number; // 60 seconds default
  };
}

export interface GeneratedFilesSliceActions {
  updateGeneratedFiles: (files: { [fileName: string]: string }) => void;
  detectAndUpdateProgressiveFiles: (content: string) => void;
  updateProgressiveFileContent: (content: string) => void;
  markFileAsComplete: (fileName: string) => void;
  updateFileGenerationState: (fileName: string, state: 'detected' | 'writing' | 'complete') => void;
  updateTabGroups: () => void;
  handleTabClick: (fileName: string) => void;
  getCurrentPhaseInfo: () => FilePhaseInfo | null;
  resetPhaseTracking: () => void;
  markGenerationComplete: () => void;
  // ENHANCED: Smart auto-retry coordination methods with workflow awareness
  startWorkflowFileMonitoring: (workflowId: string) => void;
  stopWorkflowFileMonitoring: () => void;
  checkFileGenerationCompletion: () => boolean;
  getFileCompletionStatus: () => { total: number; complete: number; writing: number; detected: number };
  notifyCoordinatorOfFileChanges: (files: { [fileName: string]: string }, states: FileGenerationState) => void;
  // ENHANCED: Workflow-aware file detection methods with FIXED logic
  isFileGeneratedForWorkflow: (fileName: string) => boolean;
  getWorkflowSpecificFiles: () => { [fileName: string]: string };
  resetWorkflowFileStates: () => void;
  validateFileCompletionForWorkflow: () => Promise<boolean>;
}

export type GeneratedFilesSlice = GeneratedFilesSliceState & GeneratedFilesSliceActions;

/**
 * 🔥 NEW: Filter out files that are identical to existing versions
 * Only includes files that actually changed
 */
function filterUnchangedFiles(
  files: { [fileName: string]: string },
  activeProject: string,
  storeState: any
): { [fileName: string]: string } {
  // Get all existing files from all sources (canister, generated, current)
  const canisterFiles = storeState.projectFiles?.[activeProject] || {};
  const projectGenFiles = storeState.projectGeneratedFiles?.[activeProject] || {};
  const currentGenFiles = storeState.generatedFiles || {};
  
  // Combine with precedence: current > generated > canister
  const existingFiles = {
    ...canisterFiles,
    ...projectGenFiles,
    ...currentGenFiles
  };
  
  const changed: { [fileName: string]: string } = {};
  
  for (const [fileName, newContent] of Object.entries(files)) {
    const existingContent = existingFiles[fileName];
    
    // Normalize content for comparison (trim whitespace, normalize line endings)
    const normalizedNew = (newContent || '').trim().replace(/\r\n/g, '\n');
    const normalizedExisting = (existingContent || '').trim().replace(/\r\n/g, '\n');
    
    if (normalizedNew === normalizedExisting) {
      // File is identical - skip it
      console.log(`⏭️ [GeneratedFiles] Skipping ${fileName} - identical to existing version`);
      continue;
    }
    
    // File has changes - include it
    changed[fileName] = newContent;
  }
  
  return changed;
}

/**
 * 🔥 NEW: Filter out config files unless explicitly requested by the user
 * Config files include: package.json, vite.config, postcss.config, tailwind.config, candid files
 */
function filterConfigFilesUnlessRequested(
  files: { [fileName: string]: string },
  storeState: any
): { [fileName: string]: string } {
  // Config file patterns to filter
  const configFilePatterns = [
    /package\.json$/i,
    /vite\.config\.(js|ts)$/i,
    /postcss\.config\.(js|ts)$/i,
    /tailwind\.config\.(js|ts)$/i,
    /tsconfig\.json$/i,
    /jsconfig\.json$/i,
    /\.did$/i,  // Candid files
    /\.did\.js$/i,
    /\.did\.d\.ts$/i,
    /\.did\.json$/i
  ];
  
  // Get the current user message from store
  const messages = storeState.currentMessages || storeState.messages || [];
  const lastUserMessage = messages
    .filter((m: any) => m.type === 'user')
    .slice(-1)[0];
  
  const userMessage = lastUserMessage?.content || '';
  const userMessageLower = userMessage.toLowerCase();
  
  // Check if user explicitly mentioned any config files
  const explicitlyMentionedConfigs = new Set<string>();
  
  // Check for explicit mentions
  if (userMessageLower.includes('package.json') || userMessageLower.includes('package.json')) {
    explicitlyMentionedConfigs.add('package.json');
  }
  if (userMessageLower.includes('vite.config') || userMessageLower.includes('vite config')) {
    explicitlyMentionedConfigs.add('vite.config');
  }
  if (userMessageLower.includes('postcss.config') || userMessageLower.includes('postcss config')) {
    explicitlyMentionedConfigs.add('postcss.config');
  }
  if (userMessageLower.includes('tailwind.config') || userMessageLower.includes('tailwind config')) {
    explicitlyMentionedConfigs.add('tailwind.config');
  }
  if (userMessageLower.includes('candid') || userMessageLower.includes('.did')) {
    explicitlyMentionedConfigs.add('candid');
  }
  
  // Also check for negative instructions (e.g., "don't modify package.json")
  const negativePatterns = [
    /don'?t\s+(?:modify|change|alter|update|edit)\s+(?:package\.json|vite|postcss|tailwind|config)/i,
    /(?:do\s+not|never)\s+(?:modify|change|alter|update|edit)\s+(?:package\.json|vite|postcss|tailwind|config)/i
  ];
  
  const hasNegativeInstruction = negativePatterns.some(pattern => pattern.test(userMessage));
  
  // Filter files
  const filtered: { [fileName: string]: string } = {};
  
  for (const [fileName, content] of Object.entries(files)) {
    const isConfigFile = configFilePatterns.some(pattern => pattern.test(fileName));
    
    if (!isConfigFile) {
      // Not a config file, always include
      filtered[fileName] = content;
      continue;
    }
    
    // It's a config file - check if it was explicitly requested
    const fileNameLower = fileName.toLowerCase();
    let isExplicitlyRequested = false;
    
    if (fileNameLower.includes('package.json')) {
      isExplicitlyRequested = explicitlyMentionedConfigs.has('package.json');
    } else if (fileNameLower.includes('vite.config')) {
      isExplicitlyRequested = explicitlyMentionedConfigs.has('vite.config');
    } else if (fileNameLower.includes('postcss.config')) {
      isExplicitlyRequested = explicitlyMentionedConfigs.has('postcss.config');
    } else if (fileNameLower.includes('tailwind.config')) {
      isExplicitlyRequested = explicitlyMentionedConfigs.has('tailwind.config');
    } else if (fileNameLower.includes('.did')) {
      // 🔥 CRITICAL: Candid files are ALWAYS needed for ICP projects, not optional config
      // They're generated artifacts from backend compilation, not user-configurable
      isExplicitlyRequested = true;  // Always include Candid files
    }
    
    // If user said "don't modify", exclude even if mentioned
    if (hasNegativeInstruction && !isExplicitlyRequested) {
      console.log(`🚫 [ConfigFilter] Excluding ${fileName} - user explicitly said not to modify config files`);
      continue;
    }
    
    if (isExplicitlyRequested) {
      // User explicitly requested this config file
      filtered[fileName] = content;
      console.log(`✅ [ConfigFilter] Including ${fileName} - explicitly requested by user`);
    } else {
      // Config file not explicitly requested - exclude it
      console.log(`🚫 [ConfigFilter] Excluding ${fileName} - not explicitly requested (user asked: "${userMessage.substring(0, 100)}...")`);
    }
  }
  
  return filtered;
}

const log = (category: string, message: string, ...args: any[]) => {
  if (['FILE_MONITORING', 'AUTO_RETRY', 'WORKFLOW_COORDINATION', 'WORKFLOW_AWARENESS', 'SMART_COMPLETION', 'FILE_DETECTION_FIX', 'CRITICAL_TRACKING'].includes(category)) {
    verboseLog(category, message, ...args);
  }
};

const mergeFilesWithoutDuplicates = (...fileSources: Array<{ [key: string]: string }>): { [key: string]: string } => {
  const merged: { [key: string]: string } = {};
  
  fileSources.forEach(source => {
    if (source && typeof source === 'object') {
      Object.entries(source).forEach(([fileName, content]) => {
        if (fileName && content !== undefined) {
          merged[fileName] = content;
        }
      });
    }
  });
  
  return merged;
};

// 🔧 NEW: Simple content hash function for change detection
const getContentHash = (content: string): string => {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
};

// 🚨 CRITICAL FIX: Ensure workflow file tracking for ANY file update
const ensureWorkflowFileTracking = (
  fileName: string,
  content: string,
  autoRetryState: any,
  forceTracking: boolean = false
): void => {
  if (!autoRetryState.isMonitoringWorkflow && !forceTracking) {
    return;
  }

  const now = Date.now();
  
  // ALWAYS update timestamp when monitoring workflow OR force tracking
  autoRetryState.workflowFileGenerationTimestamps[fileName] = now;
  autoRetryState.lastUpdateTime = now;
  
  // Track content hash for change detection
  const contentHash = getContentHash(content);
  autoRetryState.workflowFileContentHashes[fileName] = contentHash;
  
  log('CRITICAL_TRACKING', '🚨 ENSURED workflow file tracking:', {
    fileName,
    timestamp: now,
    contentLength: content.length,
    contentHash: contentHash.substring(0, 8) + '...',
    isMonitoring: autoRetryState.isMonitoringWorkflow,
    forceTracking
  });
};

const getFileType = (fileName: string): 'backend' | 'component' | 'style' | 'config' => {
  const lowerFileName = fileName.toLowerCase();
  
  if (lowerFileName.includes('/backend/') || 
      lowerFileName.includes('.mo') || 
      lowerFileName.includes('.did') ||
      lowerFileName.includes('main.mo') ||
      lowerFileName.includes('actor')) {
    return 'backend';
  }
  
  if (lowerFileName.includes('.css') || 
      lowerFileName.includes('.scss') ||
      lowerFileName.includes('styles') ||
      lowerFileName.includes('style.')) {
    return 'style';
  }
  
  if (lowerFileName.includes('package.json') || 
      lowerFileName.includes('config') || 
      lowerFileName.includes('.config.') || 
      lowerFileName.includes('.toml') || 
      lowerFileName.includes('.yml') || 
      lowerFileName.includes('.yaml') ||
      lowerFileName.includes('postcss') ||
      lowerFileName.includes('tailwind') ||
      lowerFileName.endsWith('.json')) {
    return 'config';
  }
  
  return 'component';
};

const getLanguageFromFileName = (fileName: string): string => {
  const lowerFileName = fileName.toLowerCase();
  
  if (lowerFileName.includes('.tsx') || lowerFileName.endsWith('.tsx')) return 'tsx';
  if (lowerFileName.includes('.jsx') || lowerFileName.endsWith('.jsx')) return 'jsx';
  if (lowerFileName.includes('.ts') || lowerFileName.endsWith('.ts')) return 'typescript';
  if (lowerFileName.includes('.js') || lowerFileName.endsWith('.js')) return 'javascript';
  if (lowerFileName.includes('.mo') || lowerFileName.endsWith('.mo')) return 'motoko';
  if (lowerFileName.includes('.css') || lowerFileName.endsWith('.css')) return 'css';
  if (lowerFileName.includes('.scss') || lowerFileName.endsWith('.scss')) return 'scss';
  if (lowerFileName.includes('.json') || lowerFileName.endsWith('.json')) return 'json';
  if (lowerFileName.includes('.html') || lowerFileName.endsWith('.html')) return 'html';
  if (lowerFileName.includes('.md') || lowerFileName.endsWith('.md')) return 'markdown';
  if (lowerFileName.includes('.yml') || lowerFileName.includes('.yaml')) return 'yaml';
  if (lowerFileName.includes('.toml') || lowerFileName.endsWith('.toml')) return 'toml';
  if (lowerFileName.includes('.did') || lowerFileName.endsWith('.did')) return 'candid';
  
  return 'text';
};

const getFileIcon = (fileName: string): string => {
  const lowerFileName = fileName.toLowerCase();
  
  if (lowerFileName.includes('.tsx')) return '⚛️';
  if (lowerFileName.includes('.jsx')) return '⚛️';
  if (lowerFileName.includes('.ts')) return '🔷';
  if (lowerFileName.includes('.js')) return '🟨';
  if (lowerFileName.includes('.mo')) return '🔧';
  if (lowerFileName.includes('.css')) return '🎨';
  if (lowerFileName.includes('.scss')) return '🎨';
  if (lowerFileName.includes('.json')) return '📋';
  if (lowerFileName.includes('.html')) return '🌐';
  if (lowerFileName.includes('.md')) return '📝';
  if (lowerFileName.includes('.yml') || lowerFileName.includes('.yaml')) return '⚙️';
  if (lowerFileName.includes('.toml')) return '⚙️';
  if (lowerFileName.includes('.did')) return '🔗';
  
  const fileType = getFileType(fileName);
  switch (fileType) {
    case 'backend': return '🔧';
    case 'style': return '🎨';
    case 'config': return '⚙️';
    default: return '📄';
  }
};

const createTabGroups = (files: { [fileName: string]: string }, fileStates: FileGenerationState, autoRetryActive: boolean = false): TabGroup[] => {
  const fileEntries = Object.entries(files);
  if (fileEntries.length === 0) return [];

  log('WORKFLOW_COORDINATION', '🔍 Creating tab groups with workflow awareness', {
    totalFiles: fileEntries.length,
    autoRetryActive,
    fileStatesCount: Object.keys(fileStates).length
  });

  const groups: { [key: string]: GeneratedFile[] } = {};

  fileEntries.forEach(([fileName, content]) => {
    const fileType = getFileType(fileName);
    const language = getLanguageFromFileName(fileName);
    const icon = getFileIcon(fileName);
    const state = fileStates[fileName] || 'complete';
    
    const file: GeneratedFile = {
      fileName,
      displayName: fileName.split('/').pop() || fileName,
      language,
      icon,
      isComplete: state === 'complete',
      isWriting: state === 'writing' || state === 'detected'
    };

    if (!groups[fileType]) {
      groups[fileType] = [];
    }
    groups[fileType].push(file);
  });

  const tabGroups = Object.entries(groups).map(([type, files]) => {
    const colors: { [key: string]: string } = {
      backend: 'var(--accent-orange)',
      component: 'var(--accent-green)',
      style: '#8b5cf6',
      config: 'var(--text-gray)'
    };

    const icons: { [key: string]: string } = {
      backend: '⚙️',
      component: '📦',
      style: '🎨',
      config: '⚙️'
    };

    return {
      id: type,
      name: type.charAt(0).toUpperCase() + type.slice(1),
      icon: icons[type] || '📄',
      color: colors[type] || 'var(--text-gray)',
      files: files.sort((a, b) => a.displayName.localeCompare(b.displayName))
    };
  });

  return tabGroups;
};

// 🔧 ENHANCED: Smart workflow-aware file validation with FIXED completion coordination
const performWorkflowAwareFileValidation = (
  files: { [fileName: string]: string }, 
  states: FileGenerationState,
  workflowStartTime: number | null,
  workflowFileTimestamps: { [fileName: string]: number },
  workflowContentHashes: { [fileName: string]: string },
  preWorkflowSnapshots: { [fileName: string]: string },
  completionOwnership: 'coordinator' | 'generatedFiles' | 'none',
  recentWindow: number = 60000 // 60 seconds
): {
  isValid: boolean;
  workflowSpecificCompletion: boolean;
  completionConfidence: number;
  shouldNotifyCoordinator: boolean;
  issues: string[];
  metrics: {
    totalFiles: number;
    completeFiles: number;
    workflowGeneratedFiles: number;
    workflowChangedFiles: number;
    recentFiles: number;
    preWorkflowFiles: number;
    avgFileSize: number;
    hasPlaceholders: boolean;
  };
} => {
  const issues: string[] = [];
  const fileNames = Object.keys(files);
  const totalFiles = fileNames.length;
  const now = Date.now();
  
  if (totalFiles === 0) {
    return {
      isValid: false,
      workflowSpecificCompletion: false,
      completionConfidence: 0,
      shouldNotifyCoordinator: false,
      issues: ['No files detected'],
      metrics: { 
        totalFiles: 0, completeFiles: 0, workflowGeneratedFiles: 0, 
        workflowChangedFiles: 0, recentFiles: 0, preWorkflowFiles: 0, avgFileSize: 0, hasPlaceholders: false 
      }
    };
  }

  let completeFiles = 0;
  let workflowGeneratedFiles = 0;
  let workflowChangedFiles = 0;
  let recentFiles = 0;
  let preWorkflowFiles = 0;
  let totalSize = 0;
  let hasPlaceholders = false;

  fileNames.forEach(fileName => {
    const content = files[fileName];
    const state = states[fileName] || 'complete';
    const fileTimestamp = workflowFileTimestamps[fileName];
    const contentHash = getContentHash(content);
    const preWorkflowContent = preWorkflowSnapshots[fileName];
    
    if (state === 'complete') completeFiles++;
    
    // 🔧 ENHANCED: Multiple ways to detect workflow files
    let isWorkflowFile = false;
    
    // Method 1: Direct timestamp tracking (if available)
    if (workflowStartTime && fileTimestamp && fileTimestamp > workflowStartTime) {
      workflowGeneratedFiles++;
      isWorkflowFile = true;
      log('FILE_DETECTION_FIX', `File ${fileName} detected via timestamp: ${fileTimestamp} > ${workflowStartTime}`);
    } 
    // Method 2: Content change detection
    else if (preWorkflowContent && preWorkflowContent !== content) {
      workflowChangedFiles++;
      isWorkflowFile = true;
      log('FILE_DETECTION_FIX', `File ${fileName} detected via content change (${preWorkflowContent.length} → ${content.length} chars)`);
    }
    // Method 3: Recent update fallback (within last 60 seconds)
    else if (workflowStartTime && (now - workflowStartTime) < recentWindow && fileTimestamp && (now - fileTimestamp) < recentWindow) {
      recentFiles++;
      isWorkflowFile = true;
      log('FILE_DETECTION_FIX', `File ${fileName} detected via recency: updated ${now - fileTimestamp}ms ago`);
    }
    // Method 4: No pre-workflow snapshot means it's new
    else if (workflowStartTime && !preWorkflowContent && content.length > 10) {
      workflowGeneratedFiles++;
      isWorkflowFile = true;
      log('FILE_DETECTION_FIX', `File ${fileName} detected as new (no pre-workflow snapshot)`);
    }
    
    if (!isWorkflowFile && workflowStartTime) {
      preWorkflowFiles++;
    }
    
    totalSize += content.length;
    
    if (content.includes('// File detected - content incoming...') || 
        content.includes('undefined') ||
        content.length < 10) {
      hasPlaceholders = true;
      if (state === 'complete') {
        issues.push(`File ${fileName} marked complete but has placeholder content`);
      }
    }
  });

  const avgFileSize = totalSize / totalFiles;
  const completionRate = completeFiles / totalFiles;
  
  // 🔧 ENHANCED: Calculate workflow-specific completion confidence with FIXED logic
  let completionConfidence = 0;
  let workflowSpecificCompletion = false;
  let shouldNotifyCoordinator = false;
  
  if (workflowStartTime) {
    // For workflow-aware validation, consider multiple detection methods
    const totalWorkflowFiles = workflowGeneratedFiles + workflowChangedFiles + recentFiles;
    
    log('FILE_DETECTION_FIX', '📊 Workflow file detection summary:', {
      totalFiles,
      workflowGeneratedFiles,
      workflowChangedFiles,
      recentFiles,
      totalWorkflowFiles,
      preWorkflowFiles
    });
    
    if (totalWorkflowFiles > 0) {
      const workflowCompletionRate = totalWorkflowFiles / totalFiles;
      completionConfidence = workflowCompletionRate * 0.8; // 80% weight on workflow files
      workflowSpecificCompletion = true;
      
      log('FILE_DETECTION_FIX', '✅ Workflow-specific completion detected!', {
        totalWorkflowFiles,
        workflowCompletionRate: (workflowCompletionRate * 100).toFixed(1) + '%',
        completionConfidence: (completionConfidence * 100).toFixed(1) + '%'
      });
    }
    
    if (!hasPlaceholders && avgFileSize > 50) {
      completionConfidence += 0.2; // 20% weight on content quality
    }

    // 🔧 Smart completion coordination - determine if we should notify coordinator
    if (workflowSpecificCompletion && completionConfidence >= 0.5) { // Further lowered threshold to 0.5 (50%)
      if (completionOwnership === 'none' || completionOwnership === 'generatedFiles') {
        shouldNotifyCoordinator = true;
        log('FILE_DETECTION_FIX', '🚀 Will notify coordinator - ownership allows it', {
          completionOwnership,
          completionConfidence: (completionConfidence * 100).toFixed(1) + '%'
        });
      } else if (completionOwnership === 'coordinator') {
        // Coordinator already owns completion, don't interfere
        shouldNotifyCoordinator = false;
        log('FILE_DETECTION_FIX', '🔒 Coordinator already owns completion, not interfering');
      }
    }
  } else {
    // Fallback to standard completion calculation
    completionConfidence = completionRate * 0.9;
    if (!hasPlaceholders && avgFileSize > 50) {
      completionConfidence += 0.1;
    }
  }

  const isValid = completionConfidence >= 0.5 && completeFiles > 0; // Also lowered from 0.7 to 0.5

  return {
    isValid,
    workflowSpecificCompletion,
    completionConfidence,
    shouldNotifyCoordinator,
    issues,
    metrics: {
      totalFiles,
      completeFiles,
      workflowGeneratedFiles,
      workflowChangedFiles,
      recentFiles,
      preWorkflowFiles,
      avgFileSize,
      hasPlaceholders
    }
  };
};

export const createGeneratedFilesSlice: StateCreator<any, [], [], GeneratedFilesSlice> = (set, get) => ({
  projectGeneratedFiles: {},
  projectFileGenerationStates: {},
  projectLiveGeneratedFiles: {},
  projectTabGroups: {},
  generatedFiles: {},
  fileGenerationStates: {},
  liveGeneratedFiles: [],
  tabGroups: [],
  currentPhaseInfo: null,
  // ENHANCED: Smart auto-retry state with FIXED completion coordination
  autoRetryState: {
    isMonitoringWorkflow: false,
    workflowId: null,
    workflowStartTime: null,
    lastDetectedFiles: [],
    generationStartTime: null,
    completionCheckInterval: null,
    lastCompletionCheck: null,
    consecutiveNoChangeCount: 0,
    fallbackTimeoutId: null,
    coordinatorHealthCheckInterval: null,
    // 🔧 NEW: Smart completion coordination
    completionOwnership: 'none',
    completionPreference: 'coordinator', // Prefer coordinator for auto-retry workflows
    completionMessageCreated: false,
    lastCompletionNotificationTime: null,
    gracePeriodActive: false,
    // ENHANCED: File freshness tracking with FIXED logic
    preWorkflowFileStates: {},
    workflowFileGenerationTimestamps: {},
    // 🔧 NEW: Enhanced file tracking
    preWorkflowFileSnapshots: {},
    workflowFileContentHashes: {},
    lastUpdateTime: null,
    workflowRecentWindow: 60000 // 60 seconds
  },

  // 🚨 CRITICAL FIX: Enhanced update generated files with FORCED workflow tracking
  updateGeneratedFiles: (files: { [fileName: string]: string }) => {
    const { activeProject } = get() as any;
    if (!activeProject) return;

    const now = Date.now();
    
    // 🔥 NEW: Filter out config files unless explicitly requested
    const filteredFiles = filterConfigFilesUnlessRequested(files, get() as any);
    
    if (Object.keys(filteredFiles).length !== Object.keys(files).length) {
      const removedFiles = Object.keys(files).filter(f => !filteredFiles[f]);
      console.warn('🚫 [GeneratedFiles] Filtered out config files that were not explicitly requested:', {
        removedFiles,
        totalRemoved: removedFiles.length,
        totalReceived: Object.keys(files).length,
        totalKept: Object.keys(filteredFiles).length
      });
    }
    
    // 🔥 NEW: Filter out files that haven't actually changed
    const currentState = get() as any;
    const changedFiles = filterUnchangedFiles(filteredFiles, activeProject, currentState);
    
    if (Object.keys(changedFiles).length !== Object.keys(filteredFiles).length) {
      const unchangedFiles = Object.keys(filteredFiles).filter(f => !changedFiles[f]);
      console.warn('🚫 [GeneratedFiles] Filtered out files that are identical to existing versions:', {
        unchangedFiles,
        totalUnchanged: unchangedFiles.length,
        totalAfterConfigFilter: Object.keys(filteredFiles).length,
        totalWithChanges: Object.keys(changedFiles).length
      });
    }
    
    log('CRITICAL_TRACKING', '🚨 CRITICAL: updateGeneratedFiles called with FORCED tracking', {
      fileCount: Object.keys(changedFiles).length,
      fileNames: Object.keys(changedFiles).slice(0, 5),
      activeProject,
      timestamp: now,
      originalFileCount: Object.keys(files).length,
      configFilteredCount: Object.keys(files).length - Object.keys(filteredFiles).length,
      unchangedFilteredCount: Object.keys(filteredFiles).length - Object.keys(changedFiles).length,
      finalFileCount: Object.keys(changedFiles).length
    });
    
    // 🔥 NEW: Capture old files for change detection (before state update)
    const oldFiles: Record<string, string> = {};
    if (currentState.projectGeneratedFiles && currentState.projectGeneratedFiles[activeProject]) {
      Object.keys(changedFiles).forEach(fileName => {
        oldFiles[fileName] = currentState.projectGeneratedFiles[activeProject][fileName] || '';
      });
    }
    
    set((state: any) => {
      if (!state.projectGeneratedFiles[activeProject]) {
        state.projectGeneratedFiles[activeProject] = {};
      }
      if (!state.projectFileGenerationStates[activeProject]) {
        state.projectFileGenerationStates[activeProject] = {};
      }
      
      Object.keys(changedFiles).forEach(fileName => {
        const newContent = changedFiles[fileName];
        const oldContent = state.projectGeneratedFiles[activeProject][fileName];
        
        state.projectGeneratedFiles[activeProject][fileName] = newContent;
        state.projectFileGenerationStates[activeProject][fileName] = 'complete';
        
        state.generatedFiles[fileName] = newContent;
        state.fileGenerationStates[fileName] = 'complete';
        
        // 🚨 CRITICAL FIX: ALWAYS ensure workflow tracking for ANY file update
        ensureWorkflowFileTracking(fileName, newContent, state.autoRetryState, true); // Force tracking = true
        
        log('CRITICAL_TRACKING', '🚨 FORCED workflow tracking for file:', {
          fileName,
          contentLength: newContent.length,
          hasOldContent: !!oldContent,
          contentChanged: oldContent !== newContent,
          timestamp: now
        });
      });
      
      if (state.autoRetryState.isMonitoringWorkflow) {
        state.autoRetryState.consecutiveNoChangeCount = 0;
        // 🔧 Smart completion: Reset grace period on file changes
        state.autoRetryState.gracePeriodActive = false;
      }
    });
    
    // 🔥 NEW: Trigger hot reload if applicable (async, don't block)
    if (Object.keys(changedFiles).length > 0) {
      // Use setTimeout to ensure state is updated before hot reload
      setTimeout(async () => {
        try {
          const { changeDetectionService } = await import('../../services/ChangeDetectionService');
          const { hotReloadService } = await import('../../services/HotReloadService');
          
          const analysis = changeDetectionService.analyzeChanges(oldFiles, changedFiles);
          
          if (analysis.strategy === 'preview-update' || analysis.strategy === 'hot-reload') {
            console.log('[HotReload] 🔥 Triggering hot reload after AI code generation:', {
              strategy: analysis.strategy,
              fileCount: analysis.changes.length
            });
            
            // Get all project files for preview session (after state update)
            // Combine files from all sources: canister, generated, and current session
            const updatedState = get() as any;
            const canisterFiles = updatedState.projectFiles?.[activeProject] || {};
            const projectGenFiles = updatedState.projectGeneratedFiles?.[activeProject] || {};
            const currentGenFiles = updatedState.generatedFiles || {};
            
            // Combine all files with proper precedence (new files > current > generated > canister)
            const allFiles = {
              ...canisterFiles,
              ...projectGenFiles,
              ...currentGenFiles,
              ...files // New files take highest precedence
            };
            
            // Extract package.json if available
            let packageJson: any = null;
            for (const [fileName, content] of Object.entries(allFiles)) {
              if (fileName.includes('package.json')) {
                try {
                  packageJson = JSON.parse(content as string);
                  break;
                } catch {
                  // Not valid JSON, continue
                }
              }
            }
            
            // Ensure we have package.json - it's required for preview session
            if (!packageJson) {
              console.log('[HotReload] ℹ️ No package.json found in project files, using default configuration');
              packageJson = {
                name: 'kontext-project',
                version: '1.0.0',
                type: 'module',
                dependencies: {
                  react: '^18.2.0',
                  'react-dom': '^18.2.0'
                },
                devDependencies: {
                  vite: '^5.1.4',
                  '@vitejs/plugin-react': '^4.2.0'
                }
              };
            }
            
            // Get project name for path normalization
            const projectName = (() => {
              try {
                const state = get() as any;
                const projects = state.projects;
                if (!projects || !activeProject) return null;
                const project = Array.isArray(projects) 
                  ? projects.find((p: any) => p.id === activeProject)
                  : projects[activeProject];
                return project?.name || project?.title || null;
              } catch {
                return null;
              }
            })();
            
            // Normalize file paths for preview (remove project name prefix to match server expectations)
            const { normalizeFilePathForPreview } = await import('../../services/HotReloadService');
            const filesArray = Object.entries(allFiles).map(([name, content]) => ({
              name: normalizeFilePathForPreview(name, projectName),
              content: typeof content === 'string' ? content : String(content)
            }));
            
            // 🔥 CRITICAL: Ensure package.json is included in files array
            // The server needs the actual file, not just the parsed object
            const hasPackageJsonFile = filesArray.some(f => 
              f.name === 'package.json' || 
              f.name === 'src/frontend/package.json' ||
              f.name.endsWith('/package.json')
            );
            
            if (!hasPackageJsonFile && packageJson) {
              // Determine the correct path for package.json (usually src/frontend/package.json for icpstudio)
              const packageJsonPath = filesArray.some(f => f.name.startsWith('src/frontend/'))
                ? 'src/frontend/package.json'
                : 'package.json';
              
              filesArray.push({
                name: packageJsonPath,
                content: JSON.stringify(packageJson, null, 2)
              });
              console.log(`[HotReload] ✅ Added package.json to files array at: ${packageJsonPath}`);
            }
            
            // 🔥 CRITICAL: Generate vite.config.js if not present (like deployment does)
            // This ensures PostCSS/Tailwind are properly configured
            const hasViteConfig = filesArray.some(f => f.name.includes('vite.config'));
            if (!hasViteConfig) {
              console.log('[HotReload] 🔧 Generating vite.config.js for preview session (like deployment)...');
              
              // Try to get backend canister ID from server pairs (optional - preview works without it)
              let backendCanisterId: string | undefined = undefined;
              try {
                const state = get() as any;
                if (state.userCanisterId && state.identity && activeProject) {
                  const { userCanisterService } = await import('../../services/UserCanisterService');
                  const userActor = await userCanisterService.getUserActor(state.userCanisterId, state.identity);
                  const serverPairsResult = await userActor.getProjectServerPairs(activeProject);
                  
                  if (serverPairsResult && 'ok' in serverPairsResult && Array.isArray(serverPairsResult.ok) && serverPairsResult.ok.length > 0) {
                    // Get selected server pair or use first one
                    const selectedPairId = state.getProjectServerPair?.(activeProject);
                    const pair = selectedPairId 
                      ? serverPairsResult.ok.find((p: any) => p.pairId === selectedPairId)
                      : serverPairsResult.ok[0];
                    
                    if (pair && pair.backendCanisterId) {
                      backendCanisterId = typeof pair.backendCanisterId === 'string' 
                        ? pair.backendCanisterId 
                        : pair.backendCanisterId.toText();
                      console.log(`[HotReload] ✅ Found backend canister ID for vite config: ${backendCanisterId}`);
                    }
                  }
                }
              } catch (error) {
                console.warn('[HotReload] ⚠️ Could not get backend canister ID (preview will work without it):', error);
              }
              
              // Generate vite.config.js using the same function as deployment
              const { generateViteConfigForPreview } = await import('../../services/HotReloadService');
              const viteConfigContent = generateViteConfigForPreview(backendCanisterId);
              
              // Determine correct path for vite.config (src/frontend/vite.config.js for icpstudio)
              const viteConfigPath = filesArray.some(f => f.name.startsWith('src/frontend/'))
                ? 'src/frontend/vite.config.js'
                : 'vite.config.js';
              
              filesArray.push({
                name: viteConfigPath,
                content: viteConfigContent
              });
              
              console.log(`[HotReload] ✅ Generated and added vite.config.js at: ${viteConfigPath}`, {
                hasBackendCanisterId: !!backendCanisterId,
                backendCanisterId: backendCanisterId || 'none'
              });
            }
            
            console.log('[HotReload] 📋 Normalized files for preview session:', {
              totalFiles: filesArray.length,
              samplePaths: filesArray.slice(0, 5).map(f => f.name),
              projectName,
              hasPackageJson: hasPackageJsonFile || !!packageJson,
              packageJsonPath: filesArray.find(f => f.name.includes('package.json'))?.name || 'not found',
              viteConfig: filesArray.find(f => f.name.includes('vite.config'))?.name || 'not found'
            });
            
            // Create or update preview session
            await hotReloadService.createPreviewSession(activeProject, filesArray, packageJson);
            
            // Update preview if needed
            if (analysis.strategy === 'preview-update' && analysis.changes.length > 0) {
              await hotReloadService.updatePreviewFiles(
                activeProject,
                analysis.changes.map(c => ({
                  fileName: c.fileName,
                  content: c.newContent
                }))
              );
              
              console.log('[HotReload] ✅ Preview updated successfully');
            }
          } else {
            console.log('[HotReload] ⏭️ Skipping hot reload - requires full deployment:', analysis.strategy);
          }
        } catch (error) {
          console.error('[HotReload] ❌ Failed to trigger hot reload:', error);
          // Don't throw - hot reload is optional
        }
      }, 100);
    }
    
    // ALWAYS try to notify coordinator if any active workflow
    const autoRetryState = (get() as any).autoRetryState;
    if (autoRetryState.isMonitoringWorkflow) {
      try {
        (get() as any).notifyCoordinatorOfFileChanges(files, (get() as any).fileGenerationStates);
      } catch (error) {
        log('CRITICAL_TRACKING', '❌ Coordinator notification failed', { error });
      }
    }
    
    (get() as any).updateTabGroups();
  },

  // 🚨 CRITICAL FIX: Enhanced progressive file detection with FORCED tracking
  detectAndUpdateProgressiveFiles: (content: string) => {
    const { activeProject } = get() as any;
    if (!activeProject) return;
    
    const extractionResult = FileExtractor.detectProgressiveFiles(content, {
      detectPartialFiles: true,
      minInProgressFileLength: 1,
      minCompleteFileLength: 3
    });

    const { detectedFiles, completeFiles, inProgressFiles } = extractionResult;
    const now = Date.now();
    
    log('CRITICAL_TRACKING', '🚨 CRITICAL: Progressive file detection with FORCED tracking', {
      detected: Object.keys(detectedFiles).length,
      complete: Object.keys(completeFiles).length,
      inProgress: Object.keys(inProgressFiles).length,
      activeProject,
      timestamp: now
    });

    const phaseInfo = (window as any).fileDetectionPhaseManager?.updateFileDetection?.(detectedFiles) || null;
    
    set((state: any) => {
      if (!state.projectFileGenerationStates[activeProject]) {
        state.projectFileGenerationStates[activeProject] = {};
      }
      if (!state.projectGeneratedFiles[activeProject]) {
        state.projectGeneratedFiles[activeProject] = {};
      }

      let hasNewFiles = false;
      let hasStateTransitions = false;
      let firstWritingFile: string | null = null;

      Object.entries(detectedFiles).forEach(([fileName, fileState]) => {
        const currentState = state.projectFileGenerationStates[activeProject][fileName];
        const currentContent = state.projectGeneratedFiles[activeProject][fileName];
        
        if (!currentState) {
          hasNewFiles = true;
          log('CRITICAL_TRACKING', `🚨 New file detected with FORCED tracking: ${fileName} (state: ${fileState})`);
        } else if (currentState !== fileState) {
          hasStateTransitions = true;
          log('CRITICAL_TRACKING', `🚨 State transition with FORCED tracking: ${fileName}: ${currentState} → ${fileState}`);
        }
        
        if (fileState === 'writing' && currentState !== 'writing') {
          if (!firstWritingFile) {
            firstWritingFile = fileName;
          }
        }
        
        // Update file content and state
        const realContent = completeFiles[fileName] || inProgressFiles[fileName];
        if (realContent && realContent.length > 0) {
          state.projectGeneratedFiles[activeProject][fileName] = realContent;
          state.generatedFiles[fileName] = realContent;
          
          // 🚨 CRITICAL FIX: ALWAYS ensure workflow tracking for progressive files
          ensureWorkflowFileTracking(fileName, realContent, state.autoRetryState, true); // Force tracking = true
          
          log('CRITICAL_TRACKING', '🚨 FORCED tracking for progressive file update:', {
            fileName,
            state: fileState,
            contentLength: realContent.length,
            timestamp: now
          });
        } else if (fileState === 'detected') {
          if (!state.projectGeneratedFiles[activeProject][fileName]) {
            const placeholderContent = '// File detected - content incoming...';
            state.projectGeneratedFiles[activeProject][fileName] = placeholderContent;
            state.generatedFiles[fileName] = placeholderContent;
            
            // 🚨 Even track placeholder files to ensure workflow awareness
            ensureWorkflowFileTracking(fileName, placeholderContent, state.autoRetryState, true);
          }
        }
        
        state.projectFileGenerationStates[activeProject][fileName] = fileState;
        state.fileGenerationStates[fileName] = fileState;
        
        // UI interaction for non-workflow scenarios
        if (fileState === 'writing' && currentState !== 'writing' && firstWritingFile === fileName && state.ui) {
          state.ui.sidePane.isOpen = true;
          state.ui.sidePane.activeFile = fileName;
        }
      });

      // Process complete files with FORCED tracking
      Object.entries(completeFiles).forEach(([fileName, content]) => {
        const wasIncomplete = state.projectFileGenerationStates[activeProject][fileName] !== 'complete';
        
        state.projectGeneratedFiles[activeProject][fileName] = content;
        state.generatedFiles[fileName] = content;
        state.projectFileGenerationStates[activeProject][fileName] = 'complete';
        state.fileGenerationStates[fileName] = 'complete';
        
        // 🚨 CRITICAL FIX: ALWAYS ensure workflow tracking for completed files
        ensureWorkflowFileTracking(fileName, content, state.autoRetryState, true); // Force tracking = true
        
        log('CRITICAL_TRACKING', '🚨 FORCED tracking for file completion:', {
          fileName,
          contentLength: content.length,
          wasIncomplete,
          timestamp: now
        });
        
        if (wasIncomplete) {
          hasStateTransitions = true;
          log('CRITICAL_TRACKING', `✅ File completed with FORCED tracking: ${fileName} (${content.length} chars)`);
        }
      });

      // Process in-progress files with FORCED tracking
      Object.entries(inProgressFiles).forEach(([fileName, content]) => {
        state.projectGeneratedFiles[activeProject][fileName] = content;
        state.generatedFiles[fileName] = content;
        state.projectFileGenerationStates[activeProject][fileName] = 'writing';
        state.fileGenerationStates[fileName] = 'writing';
        
        // 🚨 CRITICAL FIX: ALWAYS ensure workflow tracking for in-progress files
        ensureWorkflowFileTracking(fileName, content, state.autoRetryState, true); // Force tracking = true
        
        log('CRITICAL_TRACKING', '🚨 FORCED tracking for in-progress file:', {
          fileName,
          contentLength: content.length,
          timestamp: now
        });
      });

      state.currentPhaseInfo = phaseInfo;

      // ENHANCED: Smart auto-retry workflow tracking with FIXED completion coordination
      if (state.autoRetryState.isMonitoringWorkflow) {
        const currentFiles = Object.keys(state.projectGeneratedFiles[activeProject] || {});
        
        if (hasStateTransitions || hasNewFiles) {
          state.autoRetryState.consecutiveNoChangeCount = 0;
          // 🔧 Smart completion: Reset grace period on activity
          state.autoRetryState.gracePeriodActive = false;
        } else {
          state.autoRetryState.consecutiveNoChangeCount++;
        }
        
        state.autoRetryState.lastDetectedFiles = currentFiles;
        state.autoRetryState.lastCompletionCheck = now;
        
        log('CRITICAL_TRACKING', '🚨 CRITICAL workflow file tracking updated with FORCED detection', {
          workflowId: state.autoRetryState.workflowId,
          newFiles: hasNewFiles,
          stateTransitions: hasStateTransitions,
          totalFiles: currentFiles.length,
          workflowFiles: Object.keys(state.autoRetryState.workflowFileGenerationTimestamps).length,
          noChangeCount: state.autoRetryState.consecutiveNoChangeCount,
          completionOwnership: state.autoRetryState.completionOwnership
        });
      }
    });

    // ALWAYS try to notify if we have detected files and monitoring is active
    const autoRetryState = (get() as any).autoRetryState;
    if (autoRetryState.isMonitoringWorkflow && (Object.keys(detectedFiles).length > 0)) {
      try {
        (get() as any).notifyCoordinatorOfFileChanges(detectedFiles, (get() as any).fileGenerationStates);
      } catch (error) {
        log('CRITICAL_TRACKING', '❌ Coordinator notification failed during progressive detection', { error });
      }
    }

    (get() as any).updateTabGroups();
  },

  updateProgressiveFileContent: (content: string) => {
    (get() as any).detectAndUpdateProgressiveFiles(content);
  },

  // 🚨 CRITICAL FIX: Enhanced mark file as complete with FORCED tracking
  markFileAsComplete: (fileName: string) => {
    const { activeProject } = get() as any;
    if (!activeProject) return;
    
    const now = Date.now();
    log('CRITICAL_TRACKING', `🚨 CRITICAL: Marking file as complete with FORCED tracking: ${fileName}`);
    
    set((state: any) => {
      if (state.projectFileGenerationStates[activeProject]) {
        state.projectFileGenerationStates[activeProject][fileName] = 'complete';
      }
      state.fileGenerationStates[fileName] = 'complete';
      
      // 🚨 CRITICAL FIX: ALWAYS ensure workflow tracking for manual completion
      const content = state.projectGeneratedFiles[activeProject]?.[fileName] || '';
      ensureWorkflowFileTracking(fileName, content, state.autoRetryState, true); // Force tracking = true
      
      log('CRITICAL_TRACKING', '🚨 FORCED tracking for manual file completion:', {
        fileName,
        contentLength: content.length,
        timestamp: now
      });
      
      const phaseInfo = (window as any).fileDetectionPhaseManager?.updateFileDetection?.(state.projectFileGenerationStates[activeProject]) || null;
      state.currentPhaseInfo = phaseInfo;
    });
    
    const autoRetryState = (get() as any).autoRetryState;
    if (autoRetryState.isMonitoringWorkflow) {
      setTimeout(() => {
        try {
          const isComplete = (get() as any).checkFileGenerationCompletion();
          if (isComplete) {
            log('CRITICAL_TRACKING', '🎉 CRITICAL workflow-aware completion detected via manual marking with FORCED tracking!');
            (get() as any).notifyCoordinatorOfFileChanges((get() as any).generatedFiles, (get() as any).fileGenerationStates);
          }
        } catch (error) {
          log('CRITICAL_TRACKING', '❌ Completion check failed after manual marking', { error });
        }
      }, 500);
    }
    
    (get() as any).updateTabGroups();
  },

  // 🚨 CRITICAL FIX: Enhanced file generation state update with FORCED tracking
  updateFileGenerationState: (fileName: string, state: 'detected' | 'writing' | 'complete') => {
    const { activeProject } = get() as any;
    if (!activeProject) return;
    
    const now = Date.now();
    log('CRITICAL_TRACKING', `🚨 CRITICAL: Updating file generation state with FORCED tracking: ${fileName} → ${state}`);
    
    set((stateObj: any) => {
      if (!stateObj.projectFileGenerationStates[activeProject]) {
        stateObj.projectFileGenerationStates[activeProject] = {};
      }
      stateObj.projectFileGenerationStates[activeProject][fileName] = state;
      stateObj.fileGenerationStates[fileName] = state;
      
      // 🚨 CRITICAL FIX: ALWAYS ensure workflow tracking for state changes
      const content = stateObj.projectGeneratedFiles[activeProject]?.[fileName] || '';
      ensureWorkflowFileTracking(fileName, content, stateObj.autoRetryState, true); // Force tracking = true
      
      log('CRITICAL_TRACKING', '🚨 FORCED tracking for file state change:', {
        fileName,
        newState: state,
        contentLength: content.length,
        timestamp: now
      });
      
      if (state === 'writing' && stateObj.ui) {
        stateObj.ui.sidePane.isOpen = true;
        stateObj.ui.sidePane.activeFile = fileName;
      }
      
      const phaseInfo = (window as any).fileDetectionPhaseManager?.updateFileDetection?.(stateObj.projectFileGenerationStates[activeProject]) || null;
      stateObj.currentPhaseInfo = phaseInfo;
    });
    
    const autoRetryState = (get() as any).autoRetryState;
    if (autoRetryState.isMonitoringWorkflow && state === 'complete') {
      setTimeout(() => {
        try {
          const isComplete = (get() as any).checkFileGenerationCompletion();
          if (isComplete) {
            log('CRITICAL_TRACKING', '🎉 CRITICAL workflow-aware completion detected via state update with FORCED tracking!');
            (get() as any).notifyCoordinatorOfFileChanges((get() as any).generatedFiles, (get() as any).fileGenerationStates);
          }
        } catch (error) {
          log('CRITICAL_TRACKING', '❌ Completion check failed after state update', { error });
        }
      }, 500);
    }
    
    (get() as any).updateTabGroups();
  },

  updateTabGroups: () => {
    const { activeProject, projectFiles, projectGeneratedFiles, projectFileGenerationStates, autoRetryState } = get() as any;
    
    if (!activeProject) {
      set((state: any) => {
        state.tabGroups = [];
        state.liveGeneratedFiles = [];
      });
      return;
    }
    
    const canisterFiles = projectFiles[activeProject] || {};
    const generatedFiles = projectGeneratedFiles[activeProject] || {};
    const fileStates = projectFileGenerationStates[activeProject] || {};
    
    const existingFiles = (get() as any).generatedFiles || {};
    
    const allProjectFiles = mergeFilesWithoutDuplicates(
      canisterFiles,
      existingFiles,
      generatedFiles
    );

    const enhancedFileStates = { ...fileStates };
    Object.keys(allProjectFiles).forEach(fileName => {
      if (!enhancedFileStates[fileName]) {
        enhancedFileStates[fileName] = 'complete';
      }
    });
    
    const tabGroups = createTabGroups(allProjectFiles, enhancedFileStates, autoRetryState.isMonitoringWorkflow);
    
    set((state: any) => {
      state.tabGroups = tabGroups;
      
      const seenFiles = new Set<string>();
      state.liveGeneratedFiles = [];
      
      tabGroups.forEach(group => {
        group.files.forEach(file => {
          if (!seenFiles.has(file.fileName)) {
            seenFiles.add(file.fileName);
            state.liveGeneratedFiles.push(file);
          }
        });
      });
      
      if (activeProject) {
        state.projectLiveGeneratedFiles[activeProject] = [...state.liveGeneratedFiles];
        state.projectTabGroups[activeProject] = [...tabGroups];
        state.generatedFiles = { ...allProjectFiles };
        state.fileGenerationStates = { ...enhancedFileStates };
      }
    });
  },

  handleTabClick: (fileName: string) => {
    (get() as any).toggleSidePane?.(fileName);
  },

  getCurrentPhaseInfo: (): FilePhaseInfo | null => {
    const state = get() as any;
    return state.currentPhaseInfo || (window as any).fileDetectionPhaseManager?.getCurrentPhaseInfo?.() || null;
  },

  resetPhaseTracking: () => {
    log('WORKFLOW_AWARENESS', '🔄 Resetting phase tracking with FIXED workflow cleanup');
    if ((window as any).fileDetectionPhaseManager?.reset) {
      (window as any).fileDetectionPhaseManager.reset();
    }
    
    set((state: any) => {
      state.currentPhaseInfo = null;
      (get() as any).cleanupMonitoringResources();
    });
  },

  markGenerationComplete: () => {
    log('WORKFLOW_AWARENESS', '✅ Marking generation complete with FIXED smart coordination');
    const phaseInfo = (window as any).fileDetectionPhaseManager?.markComplete?.() || null;
    set((state: any) => {
      state.currentPhaseInfo = phaseInfo;
    });
  },

  // 🔧 ENHANCED: Smart workflow-aware file monitoring with FIXED completion coordination
  startWorkflowFileMonitoring: (workflowId: string) => {
    const { activeProject } = get() as any;
    if (!activeProject) {
      log('WORKFLOW_AWARENESS', '❌ Cannot start workflow monitoring - no active project');
      return;
    }

    (get() as any).cleanupMonitoringResources();

    // 🔧 Determine completion ownership preference based on coordinator status
    const shouldCoordinatorHandle = autoRetryCoordinator.shouldCoordinatorHandleCompletion(workflowId, activeProject);

    log('WORKFLOW_AWARENESS', '👀 Starting FIXED workflow-aware file monitoring with completion coordination', { 
      workflowId, 
      activeProject,
      shouldCoordinatorHandle: shouldCoordinatorHandle.shouldHandle,
      preferredOwner: shouldCoordinatorHandle.preferredOwner,
      reason: shouldCoordinatorHandle.reason
    });

    set((state: any) => {
      const currentProjectFiles = state.projectGeneratedFiles[activeProject] || {};
      const currentFileStates = state.projectFileGenerationStates[activeProject] || {};
      const now = Date.now();
      
      // 🔧 ENHANCED: Capture pre-workflow state with FIXED completion coordination
      state.autoRetryState = {
        isMonitoringWorkflow: true,
        workflowId,
        workflowStartTime: now,
        lastDetectedFiles: Object.keys(currentProjectFiles),
        generationStartTime: now,
        completionCheckInterval: null,
        lastCompletionCheck: now,
        consecutiveNoChangeCount: 0,
        fallbackTimeoutId: null,
        coordinatorHealthCheckInterval: null,
        // 🔧 NEW: Smart completion coordination
        completionOwnership: shouldCoordinatorHandle.shouldHandle ? 'coordinator' : 'none',
        completionPreference: shouldCoordinatorHandle.preferredOwner as 'coordinator' | 'generatedFiles',
        completionMessageCreated: false,
        lastCompletionNotificationTime: null,
        gracePeriodActive: false,
        // 🔧 ENHANCED: Capture pre-workflow file states with FIXED tracking
        preWorkflowFileStates: { ...currentFileStates },
        workflowFileGenerationTimestamps: {},
        // 🔧 NEW: Enhanced file tracking with content snapshots
        preWorkflowFileSnapshots: { ...currentProjectFiles },
        workflowFileContentHashes: {},
        lastUpdateTime: null,
        workflowRecentWindow: 60000 // 60 seconds
      };
      
      log('FILE_DETECTION_FIX', '📸 Captured pre-workflow state:', {
        fileCount: Object.keys(currentProjectFiles).length,
        stateCount: Object.keys(currentFileStates).length,
        workflowStartTime: now
      });
    });

    // Enhanced completion monitoring with FIXED smart coordination
    const completionCheckInterval = setInterval(() => {
      const currentState = get() as any;
      if (!currentState.autoRetryState.isMonitoringWorkflow || 
          currentState.autoRetryState.workflowId !== workflowId) {
        clearInterval(completionCheckInterval);
        return;
      }

      try {
        const isComplete = (get() as any).checkFileGenerationCompletion();
        
        if (isComplete) {
          log('WORKFLOW_AWARENESS', '🎉 FIXED workflow-aware periodic check detected completion!');
          (get() as any).notifyCoordinatorOfFileChanges(
            currentState.generatedFiles, 
            currentState.fileGenerationStates
          );
        } else {
          const timeSinceStart = Date.now() - currentState.autoRetryState.workflowStartTime;
          const noChangeCount = currentState.autoRetryState.consecutiveNoChangeCount;
          
          if (timeSinceStart > 120000 && noChangeCount > 60) {
            log('WORKFLOW_AWARENESS', '⚠️ FIXED workflow file generation appears stalled, considering fallback');
          }
        }
      } catch (error) {
        log('WORKFLOW_AWARENESS', '❌ FIXED workflow-aware completion check failed', { error });
      }
    }, 2000);

    const healthCheckInterval = setInterval(() => {
      const currentState = get() as any;
      if (!currentState.autoRetryState.isMonitoringWorkflow) {
        clearInterval(healthCheckInterval);
        return;
      }

      // Health check implementation
    }, 10000);

    const fallbackTimeout = setTimeout(() => {
      const currentState = get() as any;
      if (currentState.autoRetryState.isMonitoringWorkflow && 
          currentState.autoRetryState.workflowId === workflowId) {
        log('WORKFLOW_AWARENESS', '⏰ Maximum FIXED workflow monitoring time exceeded');
      }
    }, 300000);

    set((state: any) => {
      state.autoRetryState.completionCheckInterval = completionCheckInterval;
      state.autoRetryState.coordinatorHealthCheckInterval = healthCheckInterval;
      state.autoRetryState.fallbackTimeoutId = fallbackTimeout;
    });
  },

  stopWorkflowFileMonitoring: () => {
    log('WORKFLOW_AWARENESS', '🛑 Stopping FIXED workflow-aware file monitoring');
    (get() as any).cleanupMonitoringResources();
  },

  // 🚨 CRITICAL FIX: Enhanced workflow-aware completion checking with AGGRESSIVE file detection
  checkFileGenerationCompletion: (): boolean => {
    const { activeProject, projectFileGenerationStates, projectGeneratedFiles, autoRetryState } = get() as any;
    
    if (!activeProject) {
      return false;
    }

    const fileStates = projectFileGenerationStates[activeProject] || {};
    const files = projectGeneratedFiles[activeProject] || {};
    const fileNames = Object.keys(fileStates);
    const now = Date.now();
    
    if (fileNames.length === 0) {
      log('CRITICAL_TRACKING', '⚠️ No files detected yet for CRITICAL workflow completion check');
      return false;
    }

    // 🚨 CRITICAL FIX: AGGRESSIVE file detection for workflow files
    let workflowFiles: string[] = [];
    
    if (autoRetryState.isMonitoringWorkflow && autoRetryState.workflowStartTime) {
      // Method 1: Files with timestamps after workflow start
      const timestampFiles = fileNames.filter(fileName => {
        const timestamp = autoRetryState.workflowFileGenerationTimestamps[fileName];
        return timestamp && timestamp > autoRetryState.workflowStartTime;
      });
      
      // Method 2: Files with content changes from pre-workflow snapshots
      const changedFiles = fileNames.filter(fileName => {
        const currentContent = files[fileName];
        const preWorkflowContent = autoRetryState.preWorkflowFileSnapshots[fileName];
        return currentContent && preWorkflowContent && currentContent !== preWorkflowContent;
      });
      
      // Method 3: New files not in pre-workflow snapshots
      const newFiles = fileNames.filter(fileName => {
        const preWorkflowContent = autoRetryState.preWorkflowFileSnapshots[fileName];
        const currentContent = files[fileName];
        return !preWorkflowContent && currentContent && currentContent.length > 10;
      });
      
      // Method 4: Recently updated files (within last 60 seconds)
      const recentFiles = fileNames.filter(fileName => {
        const timestamp = autoRetryState.workflowFileGenerationTimestamps[fileName];
        return timestamp && (now - timestamp) < autoRetryState.workflowRecentWindow;
      });

      // 🚨 CRITICAL FIX: Also include files that were marked complete recently
      const recentlyCompletedFiles = fileNames.filter(fileName => {
        const fileState = fileStates[fileName];
        const timestamp = autoRetryState.workflowFileGenerationTimestamps[fileName];
        const timeSinceWorkflowStart = now - autoRetryState.workflowStartTime;
        
        // If file is complete and we're still in the workflow window (5 minutes), include it
        return fileState === 'complete' && timeSinceWorkflowStart < 300000 && timestamp;
      });

      // Combine all methods (remove duplicates)
      workflowFiles = [...new Set([
        ...timestampFiles,
        ...changedFiles,
        ...newFiles,
        ...recentFiles,
        ...recentlyCompletedFiles
      ])];

      log('CRITICAL_TRACKING', '🚨 CRITICAL workflow file detection analysis:', {
        totalFiles: fileNames.length,
        timestampFiles: timestampFiles.length,
        changedFiles: changedFiles.length,
        newFiles: newFiles.length,
        recentFiles: recentFiles.length,
        recentlyCompletedFiles: recentlyCompletedFiles.length,
        workflowFiles: workflowFiles.length,
        workflowStartTime: autoRetryState.workflowStartTime,
        timeSinceStart: now - autoRetryState.workflowStartTime,
        completionOwnership: autoRetryState.completionOwnership
      });
    } else {
      // Fallback: treat all files as potential workflow files if no monitoring
      workflowFiles = fileNames;
      log('CRITICAL_TRACKING', '🚨 FALLBACK: No workflow monitoring, treating all files as workflow files', {
        totalFiles: fileNames.length
      });
    }

    if (workflowFiles.length === 0) {
      log('CRITICAL_TRACKING', '⚠️ No workflow-specific files detected yet in CRITICAL system', {
        totalFiles: fileNames.length,
        workflowStartTime: autoRetryState.workflowStartTime,
        timestampedFiles: Object.keys(autoRetryState.workflowFileGenerationTimestamps).length,
        completionOwnership: autoRetryState.completionOwnership,
        preWorkflowSnapshots: Object.keys(autoRetryState.preWorkflowFileSnapshots).length
      });
      return false;
    }

    const completeWorkflowFiles = workflowFiles.filter(name => fileStates[name] === 'complete');
    const writingWorkflowFiles = workflowFiles.filter(name => fileStates[name] === 'writing');
    const detectedWorkflowFiles = workflowFiles.filter(name => fileStates[name] === 'detected');

    // 🚨 CRITICAL FIX: More lenient completion criteria
    const isComplete = completeWorkflowFiles.length > 0 && writingWorkflowFiles.length === 0;
    
    if (isComplete) {
      log('CRITICAL_TRACKING', '✅ CRITICAL workflow-aware file generation complete!', {
        workflowFiles: workflowFiles.length,
        complete: completeWorkflowFiles.length,
        writing: writingWorkflowFiles.length,
        detected: detectedWorkflowFiles.length,
        completionOwnership: autoRetryState.completionOwnership,
        detectionMethods: {
          timestamp: fileNames.filter(fn => {
            const ts = autoRetryState.workflowFileGenerationTimestamps[fn];
            return ts && ts > autoRetryState.workflowStartTime;
          }).length,
          changed: fileNames.filter(fn => {
            const cur = files[fn], pre = autoRetryState.preWorkflowFileSnapshots[fn];
            return cur && pre && cur !== pre;
          }).length,
          new: fileNames.filter(fn => {
            const pre = autoRetryState.preWorkflowFileSnapshots[fn], cur = files[fn];
            return !pre && cur && cur.length > 10;
          }).length,
          recent: fileNames.filter(fn => {
            const ts = autoRetryState.workflowFileGenerationTimestamps[fn];
            return ts && (now - ts) < autoRetryState.workflowRecentWindow;
          }).length
        }
      });
    } else {
      log('CRITICAL_TRACKING', '⚠️ CRITICAL workflow not yet complete:', {
        workflowFiles: workflowFiles.length,
        complete: completeWorkflowFiles.length,
        writing: writingWorkflowFiles.length,
        detected: detectedWorkflowFiles.length
      });
    }

    return isComplete;
  },

  getFileCompletionStatus: () => {
    const { activeProject, projectFileGenerationStates, projectGeneratedFiles, autoRetryState } = get() as any;
    
    if (!activeProject) {
      return { total: 0, complete: 0, writing: 0, detected: 0 };
    }

    const fileStates = projectFileGenerationStates[activeProject] || {};
    const files = projectGeneratedFiles[activeProject] || {};
    const fileNames = Object.keys(fileStates);
    const now = Date.now();
    
    // 🔧 ENHANCED: For auto-retry workflows, only report workflow-specific files with FIXED logic
    let relevantFiles = fileNames;
    if (autoRetryState.isMonitoringWorkflow && autoRetryState.workflowStartTime) {
      // Use same detection logic as checkFileGenerationCompletion
      const timestampFiles = fileNames.filter(fileName => {
        const timestamp = autoRetryState.workflowFileGenerationTimestamps[fileName];
        return timestamp && timestamp > autoRetryState.workflowStartTime;
      });
      
      const changedFiles = fileNames.filter(fileName => {
        const currentContent = files[fileName];
        const preWorkflowContent = autoRetryState.preWorkflowFileSnapshots[fileName];
        return currentContent && preWorkflowContent && currentContent !== preWorkflowContent;
      });
      
      const newFiles = fileNames.filter(fileName => {
        const preWorkflowContent = autoRetryState.preWorkflowFileSnapshots[fileName];
        const currentContent = files[fileName];
        return !preWorkflowContent && currentContent && currentContent.length > 10;
      });
      
      const recentFiles = fileNames.filter(fileName => {
        const timestamp = autoRetryState.workflowFileGenerationTimestamps[fileName];
        return timestamp && (now - timestamp) < autoRetryState.workflowRecentWindow;
      });
      
      relevantFiles = [...new Set([
        ...timestampFiles,
        ...changedFiles,
        ...newFiles,
        ...recentFiles
      ])];
    }
    
    const complete = relevantFiles.filter(name => fileStates[name] === 'complete').length;
    const writing = relevantFiles.filter(name => fileStates[name] === 'writing').length;
    const detected = relevantFiles.filter(name => fileStates[name] === 'detected').length;

    return {
      total: relevantFiles.length,
      complete,
      writing,
      detected
    };
  },

  // 🔧 ENHANCED: Smart coordinator notification with FIXED completion coordination
  notifyCoordinatorOfFileChanges: (files: { [fileName: string]: string }, states: FileGenerationState) => {
    const { autoRetryState, activeProject, projectGeneratedFiles } = get() as any;
    
    if (!autoRetryState.isMonitoringWorkflow || !autoRetryState.workflowId || !activeProject) {
      return;
    }

    const completionStatus = (get() as any).getFileCompletionStatus();
    const isComplete = (get() as any).checkFileGenerationCompletion();

    log('SMART_COMPLETION', '🔍 FIXED coordinator notification check:', {
      isComplete,
      completionStatus,
      completionOwnership: autoRetryState.completionOwnership,
      completionMessageCreated: autoRetryState.completionMessageCreated,
      fileCount: Object.keys(files).length
    });

    // 🔧 Smart completion coordination logic with FIXED detection
    if (isComplete) {
      const shouldNotify = (() => {
        // Check coordinator's preference for handling this completion
        const coordinatorHandling = autoRetryCoordinator.shouldCoordinatorHandleCompletion(autoRetryState.workflowId, activeProject);
        
        if (coordinatorHandling.shouldHandle && coordinatorHandling.preferredOwner === 'coordinator') {
          // Coordinator wants to handle this - let it
          if (autoRetryState.completionOwnership === 'coordinator') {
            log('SMART_COMPLETION', '🎯 Coordinator already owns completion, skipping notification');
            return false;
          }
          
          // Transfer ownership to coordinator
          set((state: any) => {
            state.autoRetryState.completionOwnership = 'coordinator';
          });
          
          return true;
        }

        // Check if we already handled completion
        if (autoRetryState.completionMessageCreated) {
          log('SMART_COMPLETION', '🔒 Completion message already created by generatedFiles, skipping');
          return false;
        }

        // Check recent notification timing
        const now = Date.now();
        const COMPLETION_DEDUPE_WINDOW = 3000; // 3 seconds
        if (autoRetryState.lastCompletionNotificationTime && 
            (now - autoRetryState.lastCompletionNotificationTime) < COMPLETION_DEDUPE_WINDOW) {
          log('SMART_COMPLETION', '🔒 Completion notification sent too recently, skipping', {
            workflowId: autoRetryState.workflowId,
            timeSinceLastNotification: now - autoRetryState.lastCompletionNotificationTime
          });
          return false;
        }

        // We can handle this completion
        return true;
      })();

      if (!shouldNotify) {
        return;
      }

      // Get all workflow files for notification
      const allProjectFiles = projectGeneratedFiles[activeProject] || {};
      const workflowSpecificFiles = (get() as any).getWorkflowSpecificFiles();
      const filesToNotify = Object.keys(workflowSpecificFiles).length > 0 ? workflowSpecificFiles : allProjectFiles;

      // Mark completion as being processed to prevent duplicates
      const now = Date.now();
      set((state: any) => {
        state.autoRetryState.completionMessageCreated = true;
        state.autoRetryState.lastCompletionNotificationTime = now;
        if (state.autoRetryState.completionOwnership === 'none') {
          state.autoRetryState.completionOwnership = 'generatedFiles';
        }
      });

      log('WORKFLOW_AWARENESS', '📞 FIXED notifying coordinator of workflow-aware file changes', {
        workflowId: autoRetryState.workflowId,
        filesDetected: Object.keys(filesToNotify).length,
        completionStatus,
        isComplete,
        workflowFiles: Object.keys(autoRetryState.workflowFileGenerationTimestamps).length,
        completionOwnership: autoRetryState.completionOwnership,
        completionMessageCreated: autoRetryState.completionMessageCreated
      });

      try {
        // Call coordinator's file generation completion handler
        autoRetryCoordinator.onFileGenerationComplete(autoRetryState.workflowId, filesToNotify);
        log('WORKFLOW_AWARENESS', '✅ FIXED coordinator notified of workflow file generation completion');
      } catch (error) {
        log('WORKFLOW_AWARENESS', '❌ Failed to notify FIXED coordinator of completion', { error });
        
        // Reset completion flags on error to allow retry
        set((state: any) => {
          state.autoRetryState.completionMessageCreated = false;
          state.autoRetryState.lastCompletionNotificationTime = null;
          state.autoRetryState.completionOwnership = 'none';
        });
      }
    }
  },

  // 🔧 ENHANCED: Smart workflow-aware helper methods with FIXED logic
  isFileGeneratedForWorkflow: (fileName: string) => {
    const { autoRetryState, projectGeneratedFiles, activeProject } = get() as any;
    
    if (!autoRetryState.isMonitoringWorkflow || !autoRetryState.workflowStartTime || !activeProject) {
      return false;
    }
    
    const now = Date.now();
    const files = projectGeneratedFiles[activeProject] || {};
    
    // Method 1: Direct timestamp tracking
    const timestamp = autoRetryState.workflowFileGenerationTimestamps[fileName];
    if (timestamp && timestamp > autoRetryState.workflowStartTime) {
      return true;
    }
    
    // Method 2: Content change detection
    const currentContent = files[fileName];
    const preWorkflowContent = autoRetryState.preWorkflowFileSnapshots[fileName];
    if (currentContent && preWorkflowContent && currentContent !== preWorkflowContent) {
      return true;
    }
    
    // Method 3: New file detection
    if (!preWorkflowContent && currentContent && currentContent.length > 10) {
      return true;
    }
    
    // Method 4: Recent update fallback
    if (timestamp && (now - timestamp) < autoRetryState.workflowRecentWindow) {
      return true;
    }
    
    return false;
  },

  getWorkflowSpecificFiles: () => {
    const { activeProject, projectGeneratedFiles, autoRetryState } = get() as any;
    
    if (!activeProject || !autoRetryState.isMonitoringWorkflow) {
      return {};
    }
    
    const allFiles = projectGeneratedFiles[activeProject] || {};
    const workflowFiles: { [fileName: string]: string } = {};
    
    Object.keys(allFiles).forEach(fileName => {
      if ((get() as any).isFileGeneratedForWorkflow(fileName)) {
        workflowFiles[fileName] = allFiles[fileName];
      }
    });
    
    log('FILE_DETECTION_FIX', '📊 Retrieved workflow-specific files:', {
      totalFiles: Object.keys(allFiles).length,
      workflowFiles: Object.keys(workflowFiles).length,
      fileNames: Object.keys(workflowFiles).slice(0, 5)
    });
    
    return workflowFiles;
  },

  resetWorkflowFileStates: () => {
    log('WORKFLOW_AWARENESS', '🔄 Resetting FIXED workflow file states');
    
    set((state: any) => {
      state.autoRetryState.workflowFileGenerationTimestamps = {};
      state.autoRetryState.preWorkflowFileStates = {};
      state.autoRetryState.preWorkflowFileSnapshots = {};
      state.autoRetryState.workflowFileContentHashes = {};
      state.autoRetryState.completionMessageCreated = false;
      state.autoRetryState.lastCompletionNotificationTime = null;
      state.autoRetryState.completionOwnership = 'none';
      state.autoRetryState.gracePeriodActive = false;
      state.autoRetryState.lastUpdateTime = null;
    });
  },

  validateFileCompletionForWorkflow: async (): Promise<boolean> => {
    const { activeProject, projectGeneratedFiles, projectFileGenerationStates, autoRetryState } = get() as any;
    
    if (!activeProject || !autoRetryState.isMonitoringWorkflow) {
      return false;
    }

    const files = projectGeneratedFiles[activeProject] || {};
    const states = projectFileGenerationStates[activeProject] || {};

    try {
      const validation = performWorkflowAwareFileValidation(
        files, 
        states, 
        autoRetryState.workflowStartTime, 
        autoRetryState.workflowFileGenerationTimestamps,
        autoRetryState.workflowFileContentHashes,
        autoRetryState.preWorkflowFileSnapshots,
        autoRetryState.completionOwnership,
        autoRetryState.workflowRecentWindow
      );
      
      log('WORKFLOW_AWARENESS', '🔍 FIXED workflow-aware file validation results', {
        isValid: validation.isValid,
        workflowSpecific: validation.workflowSpecificCompletion,
        confidence: (validation.completionConfidence * 100).toFixed(1) + '%',
        shouldNotifyCoordinator: validation.shouldNotifyCoordinator,
        completionOwnership: autoRetryState.completionOwnership,
        issues: validation.issues.length,
        metrics: validation.metrics
      });

      return validation.workflowSpecificCompletion && validation.isValid;
    } catch (error) {
      log('WORKFLOW_AWARENESS', '❌ FIXED workflow-aware file validation failed', { error });
      return false;
    }
  },

  cleanupMonitoringResources: () => {
    set((state: any) => {
      if (state.autoRetryState.completionCheckInterval) {
        clearInterval(state.autoRetryState.completionCheckInterval);
      }
      if (state.autoRetryState.coordinatorHealthCheckInterval) {
        clearInterval(state.autoRetryState.coordinatorHealthCheckInterval);
      }
      if (state.autoRetryState.fallbackTimeoutId) {
        clearTimeout(state.autoRetryState.fallbackTimeoutId);
      }
      
      state.autoRetryState = {
        isMonitoringWorkflow: false,
        workflowId: null,
        workflowStartTime: null,
        lastDetectedFiles: [],
        generationStartTime: null,
        completionCheckInterval: null,
        lastCompletionCheck: null,
        consecutiveNoChangeCount: 0,
        fallbackTimeoutId: null,
        coordinatorHealthCheckInterval: null,
        // 🔧 Reset smart completion coordination
        completionOwnership: 'none',
        completionPreference: 'coordinator',
        completionMessageCreated: false,
        lastCompletionNotificationTime: null,
        gracePeriodActive: false,
        preWorkflowFileStates: {},
        workflowFileGenerationTimestamps: {},
        // 🔧 NEW: Reset enhanced tracking
        preWorkflowFileSnapshots: {},
        workflowFileContentHashes: {},
        lastUpdateTime: null,
        workflowRecentWindow: 60000
      };
    });
    
    log('WORKFLOW_AWARENESS', '🧹 All FIXED workflow monitoring resources cleaned up with completion coordination reset');
  }
});