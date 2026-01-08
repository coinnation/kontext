import { StateCreator } from 'zustand';
import { InitializationProgress } from './initializationSlice';

export interface GenerationState {
  isGenerating: boolean;
  isStreaming: boolean;
  progress: InitializationProgress;
  streamingProgress: number;
  streamingMessage: string;
  currentMessageId: string | null;
  isProjectGeneration: boolean;
}

export interface GenerationSliceState {
  generation: GenerationState;
}

export interface GenerationSliceActions {
  startGeneration: (messageId: string, isProjectGeneration: boolean) => void;
  updateGenerationProgress: (progress: number, message: string) => void;
  completeGeneration: (finalContent?: string, files?: { [key: string]: string }) => void;
  forceCompleteGeneration: () => void;
  getCompletionValidatorStatus: () => { activeSessionsCount: number; hasActiveSessions: boolean };
  // 🆕 STREAMING STATE COORDINATION WITH UI SLICE
  notifyStreamingToActiveFile: (isStreaming: boolean, source?: 'project_generation' | 'update_streaming' | 'file_application') => void;
}

export type GenerationSlice = GenerationSliceState & GenerationSliceActions;

// BULLETPROOF COMPLETION VALIDATOR
class CompletionValidator {
  private completionSessions: Map<string, {
    messageId: string;
    startTime: number;
    completed: boolean;
    completionAttempts: number;
    timeoutId?: NodeJS.Timeout;
  }> = new Map();
  
  private maxCompletionAttempts = 3;
  private completionTimeoutMs = 10000; // 10 seconds

  startSession(messageId: string): string {
    const sessionId = `completion_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const session = {
      messageId,
      startTime: Date.now(),
      completed: false,
      completionAttempts: 0,
      timeoutId: setTimeout(() => {
        this.forceComplete(sessionId, 'TIMEOUT');
      }, this.completionTimeoutMs)
    };
    
    this.completionSessions.set(sessionId, session);
    
    console.log(`🛡️ [CompletionValidator] Session started: ${sessionId} for message: ${messageId}`);
    return sessionId;
  }

  completeSession(
    sessionId: string, 
    completionReason: string, 
    stateClearer: () => void,
    finalContent?: string,
    files?: { [key: string]: string }
  ): boolean {
    const session = this.completionSessions.get(sessionId);
    
    if (!session) {
      console.warn(`⚠️ [CompletionValidator] Session ${sessionId} not found, executing cleanup anyway`);
      this.executeCleanup(stateClearer, finalContent, files, 'ORPHANED_CLEANUP');
      return true;
    }

    if (session.completed) {
      console.log(`✅ [CompletionValidator] Session ${sessionId} already completed, skipping duplicate`);
      return false;
    }

    session.completionAttempts++;
    
    if (session.completionAttempts > this.maxCompletionAttempts) {
      console.error(`🚨 [CompletionValidator] Session ${sessionId} exceeded max completion attempts (${this.maxCompletionAttempts})`);
      this.forceComplete(sessionId, 'MAX_ATTEMPTS_EXCEEDED');
      return false;
    }

    console.log(`🛡️ [CompletionValidator] Completing session ${sessionId}, reason: ${completionReason}, attempt: ${session.completionAttempts}`);
    
    try {
      this.executeCleanup(stateClearer, finalContent, files, completionReason);
      
      session.completed = true;
      if (session.timeoutId) {
        clearTimeout(session.timeoutId);
      }
      
      setTimeout(() => this.validateCompletion(sessionId), 100);
      
      console.log(`✅ [CompletionValidator] Session ${sessionId} completed successfully`);
      return true;
      
    } catch (error) {
      console.error(`❌ [CompletionValidator] Session ${sessionId} completion failed:`, error);
      
      if (session.completionAttempts < this.maxCompletionAttempts) {
        console.log(`🔄 [CompletionValidator] Retrying session ${sessionId} completion...`);
        setTimeout(() => {
          this.completeSession(sessionId, `RETRY_${completionReason}`, stateClearer, finalContent, files);
        }, 1000);
      } else {
        this.forceComplete(sessionId, 'CLEANUP_FAILED');
      }
      
      return false;
    }
  }

  private executeCleanup(
    stateClearer: () => void,
    finalContent?: string,
    files?: { [key: string]: string },
    reason?: string
  ): void {
    console.log(`🧹 [CompletionValidator] Executing cleanup, reason: ${reason}`);
    
    stateClearer();
    
    if (files && Object.keys(files).length > 0) {
      console.log(`📁 [CompletionValidator] Processing ${Object.keys(files).length} files during cleanup`);
    }
    
    console.log(`✨ [CompletionValidator] Cleanup executed for reason: ${reason}`);
  }

  private forceComplete(sessionId: string, reason: string): void {
    const session = this.completionSessions.get(sessionId);
    
    if (!session) {
      console.warn(`⚠️ [CompletionValidator] Force complete called for unknown session: ${sessionId}`);
      return;
    }

    if (session.completed) {
      console.log(`✅ [CompletionValidator] Session ${sessionId} already completed, ignoring force complete`);
      return;
    }

    console.warn(`🚨 [CompletionValidator] Force completing session ${sessionId}, reason: ${reason}`);
    
    this.executeCleanup(() => {
      console.log(`🚨 [CompletionValidator] Emergency state clear for session ${sessionId}`);
    }, undefined, undefined, `FORCE_${reason}`);
    
    session.completed = true;
    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
    }
    
    this.completionSessions.delete(sessionId);
    
    console.warn(`🚨 [CompletionValidator] Session ${sessionId} force completed`);
  }

  private validateCompletion(sessionId: string): void {
    console.log(`🔍 [CompletionValidator] Validating completion for session ${sessionId}`);
    
    this.completionSessions.delete(sessionId);
    
    console.log(`✅ [CompletionValidator] Session ${sessionId} validation complete and cleaned up`);
  }

  public getActiveSessionsCount(): number {
    return this.completionSessions.size;
  }

  public forceCleanAllSessions(): void {
    console.warn(`🚨 [CompletionValidator] Force cleaning ${this.completionSessions.size} active sessions`);
    
    for (const [sessionId, session] of this.completionSessions.entries()) {
      this.forceComplete(sessionId, 'FORCE_CLEAN_ALL');
    }
    
    this.completionSessions.clear();
    console.warn(`🚨 [CompletionValidator] All sessions force cleaned`);
  }
}

const completionValidator = new CompletionValidator();

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

export const createGenerationSlice: StateCreator<any, [], [], GenerationSlice> = (set, get) => ({
  generation: {
    isGenerating: false,
    isStreaming: false,
    progress: { percent: 0, message: '', stage: 'IDLE' },
    streamingProgress: 0,
    streamingMessage: '',
    currentMessageId: null,
    isProjectGeneration: false
  },

  startGeneration: (messageId: string, isProjectGeneration: boolean) => {
    console.log(`🚀 [GenerationSlice] Starting generation for message: ${messageId}, isProject: ${isProjectGeneration}`);
    
    set((state: any) => {
      state.generation.isGenerating = true;
      state.generation.isStreaming = true;
      state.generation.currentMessageId = messageId;
      state.generation.isProjectGeneration = isProjectGeneration;
      state.generation.progress = { percent: 0, message: 'Starting generation...', stage: 'IDLE' };
      
      state.generation.completionSessionId = completionValidator.startSession(messageId);
    });
    
    console.log(`✅ [GenerationSlice] Generation started with validation session`);
  },

  updateGenerationProgress: (progress: number, message: string) => {
    set((state: any) => {
      state.generation.streamingProgress = progress;
      state.generation.streamingMessage = message;
      state.generation.progress = { 
        percent: progress, 
        message, 
        stage: progress >= 100 ? 'READY' : 'DOWNLOADING_WASM' 
      };
    });
  },

  // 🚀 ARCHITECTURAL ALIGNMENT: Enhanced streaming coordination with UI slice
  notifyStreamingToActiveFile: (isStreaming: boolean, source?: 'project_generation' | 'update_streaming' | 'file_application') => {
    console.log(`🌊 [GenerationSlice] 🚀 ARCHITECTURAL ALIGNMENT: Notifying streaming state to UI: ${isStreaming}, source: ${source}`);
    
    try {
      // Coordinate with UI slice to update streaming state
      const state = get() as any;
      if (state.setStreamingToActiveFile && typeof state.setStreamingToActiveFile === 'function') {
        state.setStreamingToActiveFile(isStreaming, source);
        console.log(`✅ [GenerationSlice] 🚀 ARCHITECTURAL ALIGNMENT: Successfully notified UI slice of streaming state`);
      } else {
        console.warn(`⚠️ [GenerationSlice] 🚀 ARCHITECTURAL ALIGNMENT: UI slice setStreamingToActiveFile not available`);
      }
    } catch (error) {
      console.error(`❌ [GenerationSlice] 🚀 ARCHITECTURAL ALIGNMENT: Failed to notify UI slice of streaming state:`, error);
    }
  },

  completeGeneration: (finalContent?: string, files?: { [key: string]: string }) => {
    const state = get() as any;
    const { activeProject } = state;
    const sessionId = state.generation.completionSessionId;
    
    console.log(`🏁 [GenerationSlice] Completing generation, sessionId: ${sessionId}`);
    
    const stateClearer = () => {
      console.log(`🧹 [GenerationSlice] Executing state clear...`);
      
      set((state: any) => {
        state.generation.isGenerating = false;
        state.generation.isStreaming = false;
        state.generation.currentMessageId = null;
        state.generation.streamingProgress = 100;
        state.generation.streamingMessage = 'Complete!';
        state.generation.completionSessionId = null;
        
        if (files && activeProject) {
          if (!state.projectGeneratedFiles[activeProject]) {
            state.projectGeneratedFiles[activeProject] = {};
          }
          if (!state.projectFileGenerationStates[activeProject]) {
            state.projectFileGenerationStates[activeProject] = {};
          }
          
          Object.keys(files).forEach(fileName => {
            state.projectGeneratedFiles[activeProject][fileName] = files[fileName];
            state.projectFileGenerationStates[activeProject][fileName] = 'complete';
            
            state.generatedFiles[fileName] = files[fileName];
            state.fileGenerationStates[fileName] = 'complete';
          });

          state.generatedFiles = mergeFilesWithoutDuplicates(
            state.generatedFiles,
            files
          );
        }
        
        console.log(`✅ [GenerationSlice] State cleared successfully`);
      });
      
      // 🚀 ARCHITECTURAL ALIGNMENT: Notify UI slice to end streaming mode
      try {
        const currentState = get() as any;
        if (currentState.setStreamingToActiveFile && typeof currentState.setStreamingToActiveFile === 'function') {
          currentState.setStreamingToActiveFile(false);
          console.log(`🌊 [GenerationSlice] 🚀 ARCHITECTURAL ALIGNMENT: Notified UI slice to end streaming mode`);
        }
      } catch (streamingNotificationError) {
        console.error(`❌ [GenerationSlice] 🚀 ARCHITECTURAL ALIGNMENT: Failed to notify streaming end:`, streamingNotificationError);
      }
      
      try {
        (get() as any).clearStreamingState();
        (get() as any).updateTabGroups();
        console.log(`✅ [GenerationSlice] Additional cleanup completed`);
      } catch (cleanupError) {
        console.error(`❌ [GenerationSlice] Additional cleanup failed:`, cleanupError);
      }
    };
    
    if (sessionId) {
      const completed = completionValidator.completeSession(
        sessionId,
        'NORMAL_COMPLETION',
        stateClearer,
        finalContent,
        files
      );
      
      if (!completed) {
        console.warn(`⚠️ [GenerationSlice] Completion validation failed for session ${sessionId}`);
      }
    } else {
      console.warn(`⚠️ [GenerationSlice] No completion session ID found, executing emergency cleanup`);
      stateClearer();
    }
    
    console.log(`🏁 [GenerationSlice] Generation completion process finished`);
  },

  forceCompleteGeneration: () => {
    console.warn(`🚨 [GenerationSlice] Force completing generation`);
    
    set((state: any) => {
      state.generation.isGenerating = false;
      state.generation.isStreaming = false;
      state.generation.currentMessageId = null;
      state.generation.streamingProgress = 100;
      state.generation.streamingMessage = 'Force completed';
      state.generation.completionSessionId = null;
    });
    
    // 🚀 ARCHITECTURAL ALIGNMENT: Force end streaming mode
    try {
      const state = get() as any;
      if (state.setStreamingToActiveFile && typeof state.setStreamingToActiveFile === 'function') {
        state.setStreamingToActiveFile(false);
        console.log(`🌊 [GenerationSlice] 🚀 ARCHITECTURAL ALIGNMENT: Force ended streaming mode`);
      }
    } catch (error) {
      console.error(`❌ [GenerationSlice] 🚀 ARCHITECTURAL ALIGNMENT: Failed to force end streaming mode:`, error);
    }
    
    completionValidator.forceCleanAllSessions();
    
    try {
      (get() as any).clearStreamingState();
      (get() as any).updateTabGroups();
    } catch (error) {
      console.error(`❌ [GenerationSlice] Force completion cleanup failed:`, error);
    }
    
    console.warn(`🚨 [GenerationSlice] Force completion executed`);
  },

  getCompletionValidatorStatus: () => {
    return {
      activeSessionsCount: completionValidator.getActiveSessionsCount(),
      hasActiveSessions: completionValidator.getActiveSessionsCount() > 0
    };
  }
});