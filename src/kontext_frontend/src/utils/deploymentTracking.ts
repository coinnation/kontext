/**
 * Deployment Tracking Utilities
 * Smart deployment system that tracks backend/frontend changes
 * to avoid unnecessary redeployments
 * 
 * Backend-Persisted System:
 * - Flags are stored on user canister (survives refresh, synced across devices)
 * - File saves mark flags via backend calls
 * - Deployments check flags from backend
 * - Successful deployments clear flags via backend
 */

import { userCanisterService } from '../services/UserCanisterService';
import { Identity } from '@dfinity/agent';

/**
 * File type detection
 */
export type DeploymentFileType = 'backend' | 'frontend' | 'both' | 'neither';

/**
 * Determine if a file is part of the backend
 */
export function isBackendFile(filePath: string): boolean {
  const normalizedPath = filePath.toLowerCase();
  
  // Motoko files are always backend
  if (normalizedPath.endsWith('.mo')) {
    return true;
  }
  
  // DFX config and dfx.json are backend
  if (normalizedPath.includes('dfx.json') || normalizedPath.includes('.dfx')) {
    return true;
  }
  
  // Files in backend directories
  if (normalizedPath.includes('/backend/') || normalizedPath.includes('/src/backend/')) {
    return true;
  }
  
  // Candid interface files
  if (normalizedPath.endsWith('.did')) {
    return true;
  }
  
  return false;
}

/**
 * Determine if a file is part of the frontend
 */
export function isFrontendFile(filePath: string): boolean {
  const normalizedPath = filePath.toLowerCase();
  
  // TypeScript/JavaScript files (excluding config files)
  if ((normalizedPath.endsWith('.ts') || 
       normalizedPath.endsWith('.tsx') || 
       normalizedPath.endsWith('.js') || 
       normalizedPath.endsWith('.jsx')) && 
      !normalizedPath.includes('dfx') && 
      !normalizedPath.includes('.dfx')) {
    return true;
  }
  
  // CSS, SCSS, SASS files
  if (normalizedPath.endsWith('.css') || 
      normalizedPath.endsWith('.scss') || 
      normalizedPath.endsWith('.sass')) {
    return true;
  }
  
  // HTML files
  if (normalizedPath.endsWith('.html')) {
    return true;
  }
  
  // Frontend config files
  if (normalizedPath.includes('vite.config') || 
      normalizedPath.includes('tsconfig') || 
      normalizedPath.includes('package.json') ||
      normalizedPath.includes('.gitignore')) {
    return true;
  }
  
  // Files in frontend directories
  if (normalizedPath.includes('/frontend/') || normalizedPath.includes('/src/frontend/')) {
    return true;
  }
  
  // Asset files
  if (normalizedPath.match(/\.(svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot)$/)) {
    return true;
  }
  
  return false;
}

/**
 * Get the deployment file type
 */
export function getDeploymentFileType(filePath: string): DeploymentFileType {
  const isBackend = isBackendFile(filePath);
  const isFrontend = isFrontendFile(filePath);
  
  if (isBackend && isFrontend) return 'both';
  if (isBackend) return 'backend';
  if (isFrontend) return 'frontend';
  return 'neither';
}

/**
 * Mark deployment flags changed based on file type
 * Calls backend to persist flags
 */
export async function markDeploymentFlagsChanged(
  userCanisterId: string,
  identity: Identity,
  projectId: string,
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  const fileType = getDeploymentFileType(filePath);
  
  if (fileType === 'neither') {
    // No deployment impact
    return { success: true };
  }
  
  try {
    if (fileType === 'backend' || fileType === 'both') {
      const backendResult = await userCanisterService.markBackendChanged(
        userCanisterId,
        identity,
        projectId
      );
      if (!backendResult.success) {
        return backendResult;
      }
    }
    
    if (fileType === 'frontend' || fileType === 'both') {
      const frontendResult = await userCanisterService.markFrontendChanged(
        userCanisterId,
        identity,
        projectId
      );
      if (!frontendResult.success) {
        return frontendResult;
      }
    }
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error marking deployment flags'
    };
  }
}

/**
 * Clear deployment flags after successful deployment
 * Calls backend to persist state
 */
export async function clearDeploymentFlags(
  userCanisterId: string,
  identity: Identity,
  projectId: string,
  clearBackend: boolean,
  clearFrontend: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    if (clearBackend) {
      const backendResult = await userCanisterService.clearBackendChangedFlag(
        userCanisterId,
        identity,
        projectId
      );
      if (!backendResult.success) {
        return backendResult;
      }
    }
    
    if (clearFrontend) {
      const frontendResult = await userCanisterService.clearFrontendChangedFlag(
        userCanisterId,
        identity,
        projectId
      );
      if (!frontendResult.success) {
        return frontendResult;
      }
    }
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error clearing deployment flags'
    };
  }
}

/**
 * Smart deployment decision based on flags from backend
 */
export function shouldDeploy(
  hasBackendChanged: boolean | undefined,
  hasFrontendChanged: boolean | undefined
): {
  shouldDeployBackend: boolean;
  shouldDeployFrontend: boolean;
  reason: string;
} {
  // If flags are undefined (old project or first deploy), deploy both (conservative approach)
  if (hasBackendChanged === undefined || hasFrontendChanged === undefined) {
    return {
      shouldDeployBackend: true,
      shouldDeployFrontend: true,
      reason: 'First deployment or legacy project - deploying both'
    };
  }
  
  // Deploy only changed parts
  return {
    shouldDeployBackend: hasBackendChanged,
    shouldDeployFrontend: hasFrontendChanged,
    reason: hasBackendChanged && hasFrontendChanged 
      ? 'Both backend and frontend have changes'
      : hasBackendChanged 
        ? 'Only backend has changes'
        : hasFrontendChanged
          ? 'Only frontend has changes'
          : 'No changes detected - skip deployment'
  };
}

