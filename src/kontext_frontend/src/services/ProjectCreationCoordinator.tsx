import React from 'react';
import { DeploymentContext, DeploymentButtonState, ExtractedError } from '../types/deploymentCoordination';
import { ChatInterfaceMessage } from '../types';
import { ErrorExtractionService } from './ErrorExtractionService';

export interface ProjectCreationCoordinatorState {
  activeDeployments: Map<string, DeploymentContext>;
  deploymentStates: Map<string, DeploymentButtonState>;
  isCoordinating: boolean;
  currentDeploymentMessageId: string | null;
}

export class ProjectCreationCoordinator {
  private static instance: ProjectCreationCoordinator;
  private state: ProjectCreationCoordinatorState;
  private subscribers: Set<(state: ProjectCreationCoordinatorState) => void> = new Set();

  private constructor() {
    this.state = {
      activeDeployments: new Map(),
      deploymentStates: new Map(),
      isCoordinating: false,
      currentDeploymentMessageId: null
    };
  }

  static getInstance(): ProjectCreationCoordinator {
    if (!ProjectCreationCoordinator.instance) {
      ProjectCreationCoordinator.instance = new ProjectCreationCoordinator();
    }
    return ProjectCreationCoordinator.instance;
  }

  subscribe(callback: (state: ProjectCreationCoordinatorState) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers() {
    this.subscribers.forEach(callback => callback(this.state));
  }

  private updateState(updates: Partial<ProjectCreationCoordinatorState>) {
    this.state = { ...this.state, ...updates };
    this.notifySubscribers();
  }

  private updateDeploymentState(messageId: string, updates: Partial<DeploymentButtonState>) {
    const newStates = new Map(this.state.deploymentStates);
    const currentState = newStates.get(messageId) || { status: 'ready' };
    newStates.set(messageId, { ...currentState, ...updates });
    
    this.updateState({ deploymentStates: newStates });
  }

  // ENHANCED: Create deployment context with better logging
  createDeploymentContext(
    messageId: string,
    projectId: string,
    projectName: string,
    generatedFiles: { [fileName: string]: string }
  ): DeploymentContext {
    console.log('🎬 [COORDINATOR] Creating deployment context:', {
      messageId,
      projectId,
      projectName,
      fileCount: Object.keys(generatedFiles).length
    });

    const context: DeploymentContext = {
      messageId,
      projectId,
      projectName,
      generatedFiles,
      timestamp: Date.now()
    };

    const newDeployments = new Map(this.state.activeDeployments);
    const newStates = new Map(this.state.deploymentStates);
    
    newDeployments.set(messageId, context);
    newStates.set(messageId, { status: 'ready' });

    this.updateState({
      activeDeployments: newDeployments,
      deploymentStates: newStates
    });

    console.log('✅ [COORDINATOR] Deployment context created and stored');
    return context;
  }

  // Get deployment context for a message
  getDeploymentContext(messageId: string): DeploymentContext | null {
    return this.state.activeDeployments.get(messageId) || null;
  }

  // Get deployment state for a message
  getDeploymentState(messageId: string): DeploymentButtonState {
    return this.state.deploymentStates.get(messageId) || { status: 'ready' };
  }

  // FIXED: Start deployment with proper error recovery handling
  async startDeployment(
    messageId: string,
    onTabSwitch: (tab: string) => void,
    onAutoStartDeployment: (context: DeploymentContext) => Promise<void>,
    onSubmitFixMessage?: (fixPrompt: string) => Promise<void>
  ): Promise<void> {
    const context = this.state.activeDeployments.get(messageId);
    if (!context) {
      console.error('❌ [COORDINATOR] No deployment context found for message:', messageId);
      return;
    }

    console.log('🚀 [COORDINATOR] Starting deployment for message:', messageId);

    this.updateDeploymentState(messageId, { 
      status: 'deploying', 
      progress: 0 
    });

    // ENHANCED: Set coordination state properly
    this.updateState({
      isCoordinating: true,
      currentDeploymentMessageId: messageId
    });

    try {
      // Switch to deploy tab
      console.log('🚀 [COORDINATOR] Switching to deploy tab for deployment...');
      onTabSwitch('deploy');

      // REDUCED wait time for faster response
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log('🤖 [COORDINATOR] Starting automatic deployment with context...');
      
      // Start automatic deployment immediately
      await onAutoStartDeployment(context);

      console.log('✅ [COORDINATOR] Auto-deployment initiated successfully');

    } catch (error) {
      console.error('❌ [COORDINATOR] Deployment coordination failed:', error);
      
      // CRITICAL FIX: Call handleDeploymentError instead of just updating state
      if (onSubmitFixMessage) {
        console.log('🔧 [COORDINATOR] Triggering error recovery flow...');
        await this.handleDeploymentError(messageId, error instanceof Error ? error.message : 'Deployment failed', onTabSwitch, onSubmitFixMessage);
      } else {
        // Fallback if no fix message handler provided
        console.warn('⚠️ [COORDINATOR] No fix message handler provided, doing basic error handling...');
        this.updateDeploymentState(messageId, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Deployment failed'
        });

        // Reset coordination state
        this.updateState({
          isCoordinating: false,
          currentDeploymentMessageId: null
        });
      }
    }
  }

  // Update deployment progress
  updateDeploymentProgress(messageId: string, progress: number, message?: string): void {
    this.updateDeploymentState(messageId, { 
      progress,
      ...(message && { error: message })
    });
  }

  // ENHANCED: Handle successful deployment with proper state reset
  handleDeploymentSuccess(
    messageId: string, 
    deployedUrl: string, 
    duration: number,
    onTabSwitch: (tab: string) => void
  ): void {
    console.log('✅ [COORDINATOR] Deployment successful:', { messageId, deployedUrl, duration });

    this.updateDeploymentState(messageId, {
      status: 'success',
      deployedUrl,
      duration,
      progress: 100
    });

    // ENHANCED: Always reset coordination state on success
    this.updateState({
      isCoordinating: false,
      currentDeploymentMessageId: null
    });

    // Automatically switch to Live Preview tab to show the deployed app
    console.log('✅ [COORDINATOR] Deployment successful! Switching to Live Preview tab...');
    setTimeout(() => {
      onTabSwitch('preview');
    }, 1500); // Slightly longer delay to show success state
  }

  // ENHANCED: Handle deployment failure with improved error extraction and proper state reset
  async handleDeploymentError(
    messageId: string,
    error: string,
    onTabSwitch: (tab: string) => void,
    onSubmitFixMessage: (fixPrompt: string) => Promise<void>
  ): Promise<void> {
    const context = this.state.activeDeployments.get(messageId);
    if (!context) {
      console.error('❌ [COORDINATOR] No deployment context found for error handling');
      // ENHANCED: Always reset state even if context is missing
      this.updateState({
        isCoordinating: false,
        currentDeploymentMessageId: null
      });
      return;
    }

    console.log('❌ [COORDINATOR] Handling deployment error:', { messageId, error: error.substring(0, 100) });

    this.updateDeploymentState(messageId, {
      status: 'error',
      error: error.length > 100 ? `${error.substring(0, 100)}...` : error
    });

    try {
      // Extract meaningful error information
      let extractedError: ExtractedError;
      
      if (error.toLowerCase().includes('motoko') || 
          error.toLowerCase().includes('moc') ||
          error.toLowerCase().includes('.mo:')) {
        console.log('🔍 [COORDINATOR] Extracting Motoko error...');
        extractedError = ErrorExtractionService.extractMotokoError(error, context.generatedFiles);
      } else {
        console.log('🔍 [COORDINATOR] Extracting frontend error...');
        extractedError = ErrorExtractionService.extractFrontendError(error, context.generatedFiles);
      }

      // Generate fix prompt
      const fixPrompt = ErrorExtractionService.generateFixPrompt(extractedError, context.projectName);

      console.log('🔄 [COORDINATOR] Deployment failed, switching back to chat for AI fix...');
      
      // Switch back to chat tab
      onTabSwitch('chat');

      // REDUCED wait time for faster response
      await new Promise(resolve => setTimeout(resolve, 300));

      console.log('🤖 [COORDINATOR] Submitting fix request automatically...');
      
      // Submit fix request automatically
      await onSubmitFixMessage(fixPrompt);

      console.log('✅ [COORDINATOR] Fix prompt submitted, AI will regenerate corrected code');

      // ENHANCED: Create a new deployment context for the fix attempt
      // This enables automatic re-deployment after the fix is generated
      const fixContext: DeploymentContext = {
        messageId: `${messageId}_fix_${Date.now()}`,
        projectId: context.projectId,
        projectName: context.projectName,
        generatedFiles: context.generatedFiles, // Will be updated when fix is generated
        timestamp: Date.now()
      };

      // Store the fix context for potential retry
      const newDeployments = new Map(this.state.activeDeployments);
      const newStates = new Map(this.state.deploymentStates);
      
      newDeployments.set(fixContext.messageId, fixContext);
      newStates.set(fixContext.messageId, { status: 'ready' });

      this.updateState({
        activeDeployments: newDeployments,
        deploymentStates: newStates
      });

      console.log('✅ [COORDINATOR] Fix context prepared for auto-retry after AI regeneration');

    } catch (extractionError) {
      console.error('❌ [COORDINATOR] Error extraction failed:', extractionError);
      
      // Fallback to basic error message
      const basicFixPrompt = `The deployment failed with the following error. Please fix the issue and regenerate the code:\n\n**Error:** ${error}`;
      
      onTabSwitch('chat');
      await new Promise(resolve => setTimeout(resolve, 300));
      await onSubmitFixMessage(basicFixPrompt);
    } finally {
      // ENHANCED: Always reset coordination state in finally block
      this.updateState({
        isCoordinating: false,
        currentDeploymentMessageId: null
      });
    }
  }

  // Check if a message can be deployed
  canDeploy(messageId: string): boolean {
    const context = this.state.activeDeployments.get(messageId);
    const state = this.state.deploymentStates.get(messageId);
    
    return !!(context && 
              context.generatedFiles && 
              Object.keys(context.generatedFiles).length > 0 &&
              state?.status !== 'deploying');
  }

  // Check if currently coordinating a deployment
  isCurrentlyDeploying(): boolean {
    return this.state.isCoordinating && this.state.currentDeploymentMessageId !== null;
  }

  // Get current deployment message ID
  getCurrentDeploymentMessageId(): string | null {
    return this.state.currentDeploymentMessageId;
  }

  // ENHANCED: Detect successful code regeneration and trigger auto-retry
  handleCodeRegeneration(
    projectId: string,
    generatedFiles: { [fileName: string]: string },
    messageId: string
  ): void {
    console.log('🔄 [COORDINATOR] Code regeneration detected:', {
      projectId,
      fileCount: Object.keys(generatedFiles).length,
      messageId
    });

    // Check if this is a fix attempt (look for existing error contexts)
    const errorContexts = Array.from(this.state.activeDeployments.entries())
      .filter(([id, context]) => 
        context.projectId === projectId && 
        this.state.deploymentStates.get(id)?.status === 'error'
      );

    if (errorContexts.length > 0) {
      console.log('🎯 [COORDINATOR] Detected fix regeneration, preparing auto-retry...');
      
      // Create new deployment context for the fix
      const [originalMessageId] = errorContexts[0];
      const retryContext = this.createDeploymentContext(
        `${messageId}_retry_${Date.now()}`,
        projectId,
        `Fixed ${errorContexts[0][1].projectName}`,
        generatedFiles
      );

      console.log('✅ [COORDINATOR] Auto-retry context created:', retryContext.messageId);
    }
  }

  // ENHANCED: Manual state reset method for debugging/recovery
  resetCoordinationState(): void {
    console.log('🔄 [COORDINATOR] Manually resetting coordination state');
    this.updateState({
      isCoordinating: false,
      currentDeploymentMessageId: null
    });
  }

  // Clean up old deployment contexts (memory management)
  cleanupOldDeployments(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    const newDeployments = new Map(this.state.activeDeployments);
    const newStates = new Map(this.state.deploymentStates);

    let cleanedCount = 0;

    for (const [messageId, context] of newDeployments.entries()) {
      if (now - context.timestamp > maxAge) {
        newDeployments.delete(messageId);
        newStates.delete(messageId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 [COORDINATOR] Cleaned up ${cleanedCount} old deployment contexts`);
      this.updateState({
        activeDeployments: newDeployments,
        deploymentStates: newStates
      });
    }
  }

  // Get all active deployments (for debugging)
  getAllActiveDeployments(): Array<{ messageId: string; context: DeploymentContext; state: DeploymentButtonState }> {
    const result: Array<{ messageId: string; context: DeploymentContext; state: DeploymentButtonState }> = [];
    
    for (const [messageId, context] of this.state.activeDeployments.entries()) {
      const state = this.state.deploymentStates.get(messageId) || { status: 'ready' };
      result.push({ messageId, context, state });
    }
    
    return result;
  }

  // Reset coordinator state (for debugging/testing)
  resetState(): void {
    console.log('🔄 [COORDINATOR] Resetting coordinator state');
    this.state = {
      activeDeployments: new Map(),
      deploymentStates: new Map(),
      isCoordinating: false,
      currentDeploymentMessageId: null
    };
    this.notifySubscribers();
  }
}

// Singleton instance
export const projectCreationCoordinator = ProjectCreationCoordinator.getInstance();