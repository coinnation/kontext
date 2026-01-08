import { StateCreator } from 'zustand';
import { autoRetryCoordinator } from '../../services/AutoRetryCoordinator';

export interface FileApplyState {
  isApplying: boolean;
  progress: { percent: number; message: string };
  pendingFiles: { [fileName: string]: string };
  totalFiles: number;
}

export interface FileApplicationSliceState {
  fileApplyState: FileApplyState;
}

export interface FileApplicationSliceActions {
  startFileApplication: (files: { [fileName: string]: string }, options?: { autoRetryWorkflowId?: string }) => Promise<void>;
  updateGeneratedFilesSilent: (files: { [fileName: string]: string }) => void;
}

export type FileApplicationSlice = FileApplicationSliceState & FileApplicationSliceActions;

const log = (category: string, message: string, ...args: any[]) => {
  const categories = ['FILE-APPLICATION', 'AUTO_RETRY', 'WORKFLOW_COORDINATION', 'AUTO_APPLICATION', 'AUTOMATED_DEPLOYMENT', 'LIFECYCLE_TRACKING', 'DEPLOYMENT_CONTEXT_FIX'];
  if (categories.includes(category)) {
    console.log(`[${category}] ${message}`, ...args);
  }
};

const executeWithRetry = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      log('AUTO_RETRY', `${operationName} attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (attempt === maxRetries) {
        throw new Error(`${operationName} failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`${operationName} failed - should not reach here`);
};

const validateFileContent = (files: { [fileName: string]: string }): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileStats: { totalSize: number; fileCount: number; largestFile: string; largestFileSize: number };
} => {
  const errors: string[] = [];
  const warnings: string[] = [];
  let totalSize = 0;
  let largestFile = '';
  let largestFileSize = 0;

  Object.entries(files).forEach(([fileName, content]) => {
    if (!fileName || fileName.trim().length === 0) {
      errors.push('Empty file name detected');
      return;
    }
    
    if (fileName.length > 255) {
      errors.push(`File name too long: ${fileName.substring(0, 50)}...`);
    }
    
    if (content === undefined || content === null) {
      errors.push(`File ${fileName} has null/undefined content`);
      return;
    }
    
    const fileSize = new Blob([content]).size;
    totalSize += fileSize;
    
    if (fileSize > largestFileSize) {
      largestFileSize = fileSize;
      largestFile = fileName;
    }
    
    if (fileSize > 1024 * 1024) {
      warnings.push(`Large file detected: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);
    }
    
    if (fileSize === 0) {
      warnings.push(`Empty file: ${fileName}`);
    }
    
    if (content.includes('// File detected - content incoming...')) {
      warnings.push(`File ${fileName} appears to be a placeholder`);
    }
    
    if (content.includes('undefined') && fileName.endsWith('.mo')) {
      warnings.push(`Motoko file ${fileName} contains 'undefined' which may cause compilation errors`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    fileStats: {
      totalSize,
      fileCount: Object.keys(files).length,
      largestFile,
      largestFileSize
    }
  };
};

const verifyContentStability = async (
  files: { [fileName: string]: string },
  stabilityCheckDuration: number = 1000
): Promise<boolean> => {
  log('AUTO_APPLICATION', '🔍 Starting content stability verification', {
    fileCount: Object.keys(files).length,
    checkDuration: stabilityCheckDuration
  });
  
  const initialSnapshot = JSON.stringify(files);
  await new Promise(resolve => setTimeout(resolve, stabilityCheckDuration));
  const finalSnapshot = JSON.stringify(files);
  const isStable = initialSnapshot === finalSnapshot;
  
  log('AUTO_APPLICATION', `${isStable ? '✅' : '❌'} Content stability verification ${isStable ? 'passed' : 'failed'}`, {
    initialLength: initialSnapshot.length,
    finalLength: finalSnapshot.length,
    isStable
  });
  
  return isStable;
};

const performStateCleanup = (
  set: any, 
  activeProject: string, 
  isAutomationWorkflow: boolean,
  wasSuccessful: boolean,
  cleanupDelay: number = 3000
) => {
  if (!isAutomationWorkflow) {
    log('WORKFLOW_COORDINATION', '🧹 Scheduling manual workflow cleanup', {
      delay: cleanupDelay,
      wasSuccessful
    });
    
    setTimeout(() => {
      set((state: any) => {
        state.fileApplyState = {
          isApplying: false,
          progress: { 
            percent: 0, 
            message: wasSuccessful ? '' : 'Ready for next application' 
          },
          pendingFiles: {},
          totalFiles: 0
        };
      });
    }, cleanupDelay);
  }
};

export const createFileApplicationSlice: StateCreator<any, [], [], FileApplicationSlice> = (set, get) => ({
  fileApplyState: {
    isApplying: false,
    progress: { percent: 0, message: '' },
    pendingFiles: {},
    totalFiles: 0
  },

  updateGeneratedFilesSilent: (files: { [fileName: string]: string }) => {
    log('FILE-APPLICATION', '🔇 Starting silent file update', {
      fileCount: Object.keys(files).length,
      fileNames: Object.keys(files).slice(0, 5)
    });
    
    try {
      const validation = validateFileContent(files);
      
      if (!validation.isValid) {
        log('AUTO_RETRY', '❌ Silent update file validation failed', validation.errors);
      }
      
      if (validation.warnings.length > 0) {
        log('AUTO_RETRY', '⚠️ Silent update file validation warnings', validation.warnings);
      }
      
      set((state: any) => {
        const { activeProject } = state;
        
        if (activeProject) {
          if (!state.projectGeneratedFiles) {
            state.projectGeneratedFiles = {};
          }
          if (!state.projectGeneratedFiles[activeProject]) {
            state.projectGeneratedFiles[activeProject] = {};
          }
          
          Object.entries(files).forEach(([fileName, content]) => {
            if (fileName && content !== undefined) {
              state.projectGeneratedFiles[activeProject][fileName] = content;
            }
          });
        }
        
        if (!state.generatedFiles) {
          state.generatedFiles = {};
        }
        
        const validFiles = Object.fromEntries(
          Object.entries(files).filter(([fileName, content]) => 
            fileName && fileName.trim().length > 0 && content !== undefined
          )
        );
        
        state.generatedFiles = { ...state.generatedFiles, ...validFiles };
      });
      
      log('FILE-APPLICATION', '✅ Silent file update completed successfully', {
        validFilesCount: Object.keys(files).length
      });
      
    } catch (error) {
      log('AUTO_RETRY', '❌ Silent file update failed', error);
      throw new Error(`Silent file update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // ENHANCED: File application with comprehensive workflow lifecycle integration
  startFileApplication: async (files: { [fileName: string]: string }, options?: { autoRetryWorkflowId?: string }) => {
    const { activeProject } = get() as any;
    
    if (!activeProject || Object.keys(files).length === 0) {
      log('FILE-APPLICATION', '🚫 File application validation failed', {
        hasActiveProject: !!activeProject,
        fileCount: Object.keys(files).length
      });
      return;
    }

    // ENHANCED: Detect auto-retry workflow context with comprehensive tracking
    const autoRetryWorkflowId = options?.autoRetryWorkflowId;
    const isAutoRetryWorkflow = !!autoRetryWorkflowId;
    
    // CRITICAL: Mark file application as triggered in the coordinator
    if (isAutoRetryWorkflow) {
      log('LIFECYCLE_TRACKING', '🚀 Marking file application as triggered in workflow', { 
        workflowId: autoRetryWorkflowId 
      });
      autoRetryCoordinator.markFileApplicationTriggered(autoRetryWorkflowId);
    }
    
    // Comprehensive file validation
    const validation = validateFileContent(files);
    const fileCount = Object.keys(files).length;
    
    log('AUTO_APPLICATION', '🚀 Starting enhanced file application with comprehensive workflow integration', {
      projectId: activeProject,
      fileCount,
      totalSize: `${(validation.fileStats.totalSize / 1024).toFixed(2)}KB`,
      isAutoRetryWorkflow,
      autoRetryWorkflowId,
      isValid: validation.isValid,
      warningCount: validation.warnings.length
    });

    if (!validation.isValid) {
      const errorMessage = `File validation failed: ${validation.errors.join(', ')}`;
      log('AUTO_APPLICATION', '❌ File validation errors prevent application', validation.errors);
      
      // CRITICAL: Mark workflow as failed if validation fails
      if (isAutoRetryWorkflow && autoRetryWorkflowId) {
        autoRetryCoordinator.markWorkflowComplete(autoRetryWorkflowId, false, 'file_validation_failed');
      }
      
      throw new Error(errorMessage);
    }

    if (validation.warnings.length > 0) {
      log('AUTO_APPLICATION', '⚠️ File validation warnings (proceeding)', validation.warnings);
    }

    // Content stability verification for auto-retry workflows
    if (isAutoRetryWorkflow) {
      log('AUTO_APPLICATION', '🔍 Performing content stability verification for auto-retry workflow');
      
      try {
        const isStable = await verifyContentStability(files, 1000);
        if (!isStable) {
          throw new Error('File content is not stable - deferring application');
        }
        log('AUTO_APPLICATION', '✅ Content stability verified for auto-retry workflow');
      } catch (stabilityError) {
        log('AUTO_APPLICATION', '❌ Content stability verification failed', { error: stabilityError });
        
        // CRITICAL: Mark workflow as failed if stability check fails
        if (autoRetryWorkflowId) {
          autoRetryCoordinator.markWorkflowComplete(autoRetryWorkflowId, false, 'content_stability_failed');
        }
        
        throw new Error(`Content stability check failed: ${stabilityError}`);
      }
    }

    // UI state management (reduced for auto-retry workflows)
    if (!isAutoRetryWorkflow) {
      set((state: any) => {
        state.fileApplyState = {
          isApplying: true,
          progress: { 
            percent: 10, 
            message: `Analyzing ${fileCount} files for application...`
          },
          pendingFiles: files,
          totalFiles: fileCount
        };
      });
      log('AUTO_APPLICATION', '🎨 Full UI feedback enabled for manual workflow');
    } else {
      set((state: any) => {
        state.fileApplyState = {
          isApplying: true,
          progress: { 
            percent: 20, 
            message: `🤖 Auto-applying ${fileCount} files from AI fixes...`
          },
          pendingFiles: files,
          totalFiles: fileCount
        };
      });
      log('AUTO_APPLICATION', '🤖 Automated UI feedback for auto-retry workflow');
    }

    const workflowStartTime = Date.now();
    let wasSuccessful = false;

    try {
      log('AUTO_APPLICATION', '📝 Starting file state update');
      
      // File state update with retry logic
      await executeWithRetry(
        async () => {
          if (isAutoRetryWorkflow) {
            log('AUTO_APPLICATION', '🔇 Using silent update for auto-retry workflow');
            (get() as any).updateGeneratedFilesSilent?.(files) || (get() as any).updateGeneratedFiles(files);
          } else {
            log('AUTO_APPLICATION', '📢 Using full update for manual workflow');
            (get() as any).updateGeneratedFiles(files);
          }
        },
        'Generated Files State Update',
        2,
        1000
      );
      
      log('AUTO_APPLICATION', '✅ File state updated successfully');

      if (!isAutoRetryWorkflow) {
        set((state: any) => {
          state.fileApplyState.progress = { 
            percent: 25, 
            message: 'Preparing backend save operation...'
          };
        });
      } else {
        set((state: any) => {
          state.fileApplyState.progress = { 
            percent: 40, 
            message: '🤖 Preparing automated backend save...'
          };
        });
      }

      // Backend persistence operation
      const { userCanisterId, identity } = get() as any;
      
      if (!userCanisterId || !identity) {
        const error = 'User canister or identity not available for file application';
        
        // CRITICAL: Mark workflow as failed if backend not available
        if (isAutoRetryWorkflow && autoRetryWorkflowId) {
          autoRetryCoordinator.markWorkflowComplete(autoRetryWorkflowId, false, 'backend_not_available');
        }
        
        throw new Error(error);
      }

      log('AUTO_APPLICATION', '💾 Starting backend save operation', {
        userCanisterId: userCanisterId.substring(0, 8) + '...',
        hasIdentity: !!identity,
        fileCount,
        isAutoRetryWorkflow
      });

      // 🆕 VERSION-AWARE: Get selected version ID from store
      const state = get() as any;
      const selectedVersionId = state.selectedVersionId || null; // null = sandbox/working copy
      log('AUTO_APPLICATION', '📌 [VERSION-AWARE] Selected version for AI-generated files save:', selectedVersionId || 'Sandbox (working copy)');

      const { userCanisterService } = await import('../../services/UserCanisterService');
      
      const saveStartTime = Date.now();
      let progressUpdateCount = 0;
      
      const result = await userCanisterService.saveCodeArtifacts(
        files, 
        activeProject, 
        userCanisterId, 
        identity,
        selectedVersionId, // 🆕 VERSION-AWARE: Pass selected version ID
        (progress: any) => {
          progressUpdateCount++;
          log('AUTO_APPLICATION', `📊 Backend save progress update #${progressUpdateCount}`, {
            percent: progress.percent,
            message: progress.message,
            duration: Date.now() - saveStartTime
          });
          
          if (!isAutoRetryWorkflow) {
            set((state: any) => {
              state.fileApplyState.progress = {
                percent: Math.min(85, 25 + (progress.percent * 0.6)),
                message: progress.message
              };
            });
          } else {
            set((state: any) => {
              state.fileApplyState.progress = {
                percent: Math.min(70, 40 + (progress.percent * 0.3)),
                message: `🤖 ${progress.message} (automated)`
              };
            });
          }
        }
      );
      
      const saveDuration = Date.now() - saveStartTime;
      log('AUTO_APPLICATION', '💾 Backend save operation completed', {
        duration: `${saveDuration}ms`,
        success: result.success,
        filesUploaded: result.filesUploaded || 0,
        filesUpdated: result.filesUpdated || 0,
        isAutoRetryWorkflow,
        progressUpdates: progressUpdateCount
      });

      if (!result.success) {
        const error = result.error || 'Backend save operation failed';
        
        // CRITICAL: Mark workflow as failed if backend save fails
        if (isAutoRetryWorkflow && autoRetryWorkflowId) {
          autoRetryCoordinator.markWorkflowComplete(autoRetryWorkflowId, false, 'backend_save_failed');
        }
        
        throw new Error(error);
      }

      // Success handling with comprehensive state management
      const totalFilesProcessed = (result.filesUploaded || 0) + (result.filesUpdated || 0);
      const successMessage = isAutoRetryWorkflow ? 
        `🤖 Automated file application successful! Applied ${totalFilesProcessed} files.` :
        `✅ Successfully applied ${totalFilesProcessed} files! (${result.filesUploaded || 0} created, ${result.filesUpdated || 0} updated)`;
      
      log('AUTO_APPLICATION', '✅ Files saved to backend successfully', {
        filesUploaded: result.filesUploaded || 0,
        filesUpdated: result.filesUpdated || 0,
        totalProcessed: totalFilesProcessed,
        workflowType: isAutoRetryWorkflow ? 'AUTO_RETRY' : 'MANUAL',
        totalDuration: Date.now() - workflowStartTime
      });
      
      // State updates with validation
      set((state: any) => {
        if (!state.projectFiles) {
          state.projectFiles = {};
        }
        state.projectFiles[activeProject] = files;
        
        if (!isAutoRetryWorkflow) {
          state.fileApplyState.progress = { 
            percent: 100,
            message: successMessage
          };
        } else {
          state.fileApplyState.progress = { 
            percent: 80,
            message: successMessage
          };
        }
      });

      wasSuccessful = true;

      // 🔥 FIX 1: Mark conversation as resolved when files are successfully applied
      // 🔥 GAP 3 FIX: Track ALL pending AI responses, not just the last one
      try {
        const stateForResolution = get() as any;
        const projectMessages = stateForResolution.projectMessages?.[activeProject] || [];
        
        // 🔥 STRATEGY: Find all unresolved AI responses that contributed to the current file set
        // Look back through messages to find all file generation responses that haven't been deployed yet
        const unresolvedResponses: Array<{ userMsg: any; aiMsg: any }> = [];
        
        for (let i = projectMessages.length - 1; i >= 0 && unresolvedResponses.length < 10; i--) {
          const msg = projectMessages[i];
          
          // Skip already resolved messages
          if (msg.domainContext?.resolved) {
            continue;
          }
          
          // Look for AI responses with extractedFiles
          if (msg.type === 'system' && msg.extractedFiles && Object.keys(msg.extractedFiles).length > 0) {
            // Check if any of the extracted files match the files being applied
            // 🔥 GAP 12 FIX: Use exact filename match, not endsWith (prevents false positives)
            const extractedFileNames = Object.keys(msg.extractedFiles);
            const appliedFileNames = Object.keys(files);
            
            // Normalize paths by extracting just the filename for comparison
            const normalizedExtracted = extractedFileNames.map(f => ({
              original: f,
              normalized: f.split('/').pop() || f
            }));
            const normalizedApplied = appliedFileNames.map(f => ({
              original: f,
              normalized: f.split('/').pop() || f
            }));
            
            const hasMatchingFiles = normalizedExtracted.some(extracted => 
              normalizedApplied.some(applied => 
                extracted.normalized === applied.normalized // Exact filename match
              )
            );
            
            if (hasMatchingFiles) {
              // Find the user message that triggered this AI response
              for (let j = i - 1; j >= 0; j--) {
                const userMsg = projectMessages[j];
                if (userMsg.type === 'user' && !userMsg.domainContext?.resolved) {
                  unresolvedResponses.push({ userMsg, aiMsg: msg });
                  break;
                }
              }
            }
          }
        }
        
        // Mark all identified user-AI pairs as resolved
        if (unresolvedResponses.length > 0 && stateForResolution.markConversationResolved) {
          console.log(`🎯 [RESOLUTION] Marking ${unresolvedResponses.length} conversation pair(s) as resolved`);
          console.log(`🎯 [RESOLUTION] Pairs being marked:`, unresolvedResponses.map(p => ({
            userMsgId: p.userMsg.id,
            userContent: p.userMsg.content.substring(0, 50),
            aiMsgId: p.aiMsg.id,
            files: Object.keys(p.aiMsg.extractedFiles || {})
          })));
          
          unresolvedResponses.forEach(({ userMsg, aiMsg }) => {
            console.log(`🎯 [RESOLUTION] Calling markConversationResolved for user:${userMsg.id}, ai:${aiMsg.id}`);
            stateForResolution.markConversationResolved(
              activeProject,
              userMsg.id,
              aiMsg.id,
              `Files applied successfully (${fileCount} files)`
            );
            
            // 🔥 DEBUG: Verify resolution was applied
            setTimeout(() => {
              const verifyMsg = projectMessages.find((m: any) => m.id === userMsg.id);
              if (verifyMsg) {
                console.log(`🔍 [RESOLUTION VERIFY] Message ${userMsg.id} resolved status:`, verifyMsg.domainContext?.resolved);
              }
            }, 100);
          });
        } else if (unresolvedResponses.length === 0) {
          // Fallback: Mark just the most recent user message if no matches found
          console.warn('⚠️ [RESOLUTION] No file matches found, marking last user message as resolved');
          const recentUserMessages = projectMessages
            .filter((m: any) => m.type === 'user' && !m.domainContext?.resolved)
            .slice(-1);
          
          if (recentUserMessages.length > 0 && stateForResolution.markConversationResolved) {
            stateForResolution.markConversationResolved(
              activeProject,
              recentUserMessages[0].id,
              undefined,
              `Files applied successfully (${fileCount} files)`
            );
          }
        }
      } catch (resolutionError) {
        console.warn('⚠️ [FileApplication] Failed to mark conversation resolved:', resolutionError);
        // Don't throw - this is a nice-to-have feature, shouldn't block file application
      }

      // AUTOMATION: Auto-trigger deployment for auto-retry workflows
      if (isAutoRetryWorkflow && autoRetryWorkflowId && fileCount > 0) {
        log('AUTOMATED_DEPLOYMENT', '🚀 Auto-triggering deployment for auto-retry workflow...', {
          workflowId: autoRetryWorkflowId,
          filesProcessed: totalFilesProcessed
        });
        
        try {
          // CRITICAL: Mark deployment as triggered in the coordinator
          log('LIFECYCLE_TRACKING', '🚀 Marking deployment as triggered in workflow', { 
            workflowId: autoRetryWorkflowId 
          });
          autoRetryCoordinator.markDeploymentTriggered(autoRetryWorkflowId);
          
          // Update UI to show deployment preparation
          set((state: any) => {
            state.fileApplyState.progress = { 
              percent: 90,
              message: '🚀 Preparing automated deployment...'
            };
          });

          // Small delay to ensure UI updates
          await new Promise(resolve => setTimeout(resolve, 500));

          // Create deployment context and auto-trigger deployment
          const currentProject = (get() as any).getProjectById(activeProject);
          const projectName = currentProject?.name || 'Auto-Fixed Project';
          
          log('AUTOMATED_DEPLOYMENT', '🏗️ Creating deployment context for automation...', {
            workflowId: autoRetryWorkflowId,
            projectId: activeProject,
            projectName,
            fileCount
          });

          // Create deployment context
          const deploymentMessageId = `auto_deploy_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          
          // 🔧 FIXED: Ensure deployment context creation is properly registered in store
          const createDeploymentContext = (get() as any).createDeploymentContext;
          if (createDeploymentContext && typeof createDeploymentContext === 'function') {
            log('DEPLOYMENT_CONTEXT_FIX', '🚀 Creating deployment context via store action...', {
              deploymentMessageId,
              activeProject,
              projectName
            });
            
            const deploymentContext = createDeploymentContext(deploymentMessageId, activeProject, projectName, files);
            
            log('DEPLOYMENT_CONTEXT_FIX', '✅ Deployment context created successfully!', {
              contextId: deploymentContext.messageId,
              projectId: deploymentContext.projectId,
              fileCount: Object.keys(deploymentContext.generatedFiles).length
            });
            
            // 🔧 FIXED: Force store update propagation with small delay
            setTimeout(() => {
              log('DEPLOYMENT_CONTEXT_FIX', '🔄 Store update propagation delay completed - ChatInterface should detect deployment context now');
            }, 100);
            
          } else {
            log('DEPLOYMENT_CONTEXT_FIX', '❌ createDeploymentContext function not available in store');
            throw new Error('Deployment context creation function not available');
          }

          // Update UI to show deployment starting
          set((state: any) => {
            state.fileApplyState.progress = { 
              percent: 95,
              message: '🚀 Starting automated deployment...'
            };
          });

          log('AUTOMATED_DEPLOYMENT', '✅ Deployment context created - automation will handle deployment', {
            deploymentMessageId,
            workflowId: autoRetryWorkflowId
          });

          // Update UI to show automation handoff
          set((state: any) => {
            state.fileApplyState.progress = { 
              percent: 100,
              message: '🤖 Files applied - automated deployment in progress...'
            };
          });

          // CRITICAL: Don't mark workflow as complete yet - let deployment handle that
          log('LIFECYCLE_TRACKING', '🎯 File application complete - workflow continues with deployment automation');
          
        } catch (deploymentError) {
          log('AUTOMATED_DEPLOYMENT', '❌ Auto-deployment setup failed', { error: deploymentError });
          
          // CRITICAL: Mark workflow as failed if deployment setup fails
          if (autoRetryWorkflowId) {
            autoRetryCoordinator.markWorkflowComplete(autoRetryWorkflowId, false, 'deployment_setup_failed');
          }
          
          // Update UI to show deployment failure but file success
          set((state: any) => {
            state.fileApplyState.progress = { 
              percent: 100,
              message: '✅ Files applied successfully - ❌ Automated deployment failed (manual deployment required)'
            };
          });
        }
        
      } else if (!isAutoRetryWorkflow) {
        // Manual workflow completion
        log('AUTO_APPLICATION', '📝 Creating deployment-ready message for manual workflow');
        
        try {
          const createDeploymentReadyMessage = (get() as any).createDeploymentReadyMessage;
          if (createDeploymentReadyMessage && typeof createDeploymentReadyMessage === 'function') {
            const messageId = await createDeploymentReadyMessage(activeProject, files, result);
            log('AUTO_APPLICATION', '✅ Deployment-ready message created', { messageId });
          }
        } catch (messageError) {
          log('AUTO_APPLICATION', '⚠️ Failed to create deployment-ready message (non-critical)', { error: messageError });
        }
        
        // 🔥 CRITICAL FIX: Clear deployment state after file application
        // This ensures the next deployment can start without requiring manual "Clear State"
        try {
          log('AUTO_APPLICATION', '🧹 Clearing deployment state to allow fresh deployment');
          
          // Clear ALL cached deployment data for this project from localStorage
          const deploymentCacheKey = `deployment_${activeProject}`;
          const configCacheKey = `deployment_config_${activeProject}`;
          const urlCacheKey = `deploymentUrl_${activeProject}`;
          
          localStorage.removeItem(deploymentCacheKey);
          localStorage.removeItem(configCacheKey);
          localStorage.removeItem(urlCacheKey);
          
          // Also clear any deployment contexts from the deployment coordination slice
          // This removes stale deployment contexts that might block new deployments
          const findDeploymentByProject = (get() as any).findDeploymentByProject;
          if (findDeploymentByProject && typeof findDeploymentByProject === 'function') {
            const existingDeployment = findDeploymentByProject(activeProject);
            if (existingDeployment) {
              log('AUTO_APPLICATION', '🧹 Clearing stale deployment context', {
                messageId: existingDeployment.messageId,
                projectId: activeProject
              });
              
              // Clear the deployment states for this project's messages
              set((state: any) => {
                // Remove from deployment coordination
                if (state.deploymentCoordination?.deploymentStates) {
                  delete state.deploymentCoordination.deploymentStates[existingDeployment.messageId];
                }
                if (state.deploymentCoordination?.activeDeployments) {
                  delete state.deploymentCoordination.activeDeployments[existingDeployment.messageId];
                }
                if (state.deploymentCoordination?.retryAttempts) {
                  delete state.deploymentCoordination.retryAttempts[existingDeployment.messageId];
                }
                
                state.deploymentCoordination.lastUpdateTime = Date.now();
              });
            }
          }
          
          log('AUTO_APPLICATION', '✅ Deployment state cleared - ready for fresh deployment', {
            clearedKeys: [deploymentCacheKey, configCacheKey, urlCacheKey]
          });
        } catch (clearError) {
          log('AUTO_APPLICATION', '⚠️ Failed to clear deployment state (non-critical)', { error: clearError });
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'File application failed';
      const fullError = {
        message: errorMessage,
        workflowDuration: Date.now() - workflowStartTime,
        isAutoRetryWorkflow,
        autoRetryWorkflowId,
        fileCount
      };
      
      log('AUTO_APPLICATION', '❌ File application failed', fullError);
      
      // CRITICAL: Mark workflow as failed if not already marked
      if (isAutoRetryWorkflow && autoRetryWorkflowId) {
        // Only mark as failed if not already marked by a specific error above
        if (!errorMessage.includes('content_stability_failed') && 
            !errorMessage.includes('backend_save_failed') &&
            !errorMessage.includes('backend_not_available') &&
            !errorMessage.includes('file_validation_failed')) {
          autoRetryCoordinator.markWorkflowComplete(autoRetryWorkflowId, false, 'file_application_general_failure');
        }
      }
      
      // Error handling based on workflow type
      if (!isAutoRetryWorkflow) {
        set((state: any) => {
          state.fileApplyState.progress = {
            percent: 0,
            message: `❌ Error: ${errorMessage}`
          };
        });
      } else {
        set((state: any) => {
          state.fileApplyState.progress = {
            percent: 0,
            message: `🤖❌ Automated application failed: ${errorMessage}`
          };
        });
      }
      
      throw new Error(`File application failed: ${errorMessage}`);
      
    } finally {
      // Comprehensive cleanup
      const finalDuration = Date.now() - workflowStartTime;
      
      log('AUTO_APPLICATION', '🧹 Performing final cleanup', {
        wasSuccessful,
        isAutoRetryWorkflow,
        totalDuration: finalDuration,
        workflowType: isAutoRetryWorkflow ? 'AUTO_RETRY' : 'MANUAL'
      });
      
      // 🆕 CRITICAL FIX: Always reset isApplying, even for auto-retry workflows
      // This prevents the UI from getting stuck on "Applying..."
      set((state: any) => {
        state.fileApplyState.isApplying = false;
        if (!wasSuccessful) {
          state.fileApplyState.progress = {
            percent: 0,
            message: wasSuccessful ? '' : 'Ready for next application'
          };
        }
      });
      
      performStateCleanup(set, activeProject, isAutoRetryWorkflow, wasSuccessful);
      
      if (!wasSuccessful) {
        setTimeout(() => {
          set((state: any) => {
            if (state.fileApplyState.pendingFiles) {
              state.fileApplyState.pendingFiles = {};
            }
          });
        }, 5000);
      }
      
      log('AUTO_APPLICATION', '✅ File application workflow completed', {
        success: wasSuccessful,
        duration: `${finalDuration}ms`,
        workflowType: isAutoRetryWorkflow ? 'AUTO_RETRY' : 'MANUAL'
      });
    }
  }
});