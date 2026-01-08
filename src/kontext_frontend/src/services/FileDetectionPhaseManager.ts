import { messageCoordinator, MessageOwner } from './MessageCoordinator';
import { autoRetryCoordinator } from './AutoRetryCoordinator';
import { verboseLog, verboseWarn } from '../utils/verboseLogging';

export type FileDetectionPhase = 'thinking' | 'detecting' | 'generating' | 'completing' | 'complete';

export interface FilePhaseInfo {
    phase: FileDetectionPhase;
    progress: number;
    message: string;
    detectedFiles: string[];
    completeFiles: string[];
    writingFiles: string[];
    totalFiles: number;
}

class FileDetectionPhaseManagerService {
    private currentPhaseInfo: FilePhaseInfo;
    private isActive: boolean = false;
    private lastUpdateTime: number = 0;
    private activationTimeout: NodeJS.Timeout | null = null;
    private currentAppContext: { appName: string; userRequest?: string } | null = null;
    
    // SIMPLIFIED: Removed complex auto-retry workflow state machine - now handled by AutoRetryCoordinator
    private recursionDepth: number = 0;
    private maxRecursionDepth: number = 3;

    constructor() {
        this.currentPhaseInfo = this.getInitialPhaseInfo();
        
        messageCoordinator.subscribeToHandoffs((context) => {
            if (context.toOwner === 'FILE_MANAGER') {
                verboseLog('FileDetectionPhaseManager', 'Activated by MessageCoordinator:', {
                    reason: context.reason,
                    fromOwner: context.fromOwner,
                    hasTransitionContext: !!context.transitionContext,
                    timestamp: new Date().toISOString()
                });
                this.isActive = true;
                
                if (context.transitionContext) {
                    this.currentAppContext = {
                        appName: this.extractAppNameFromContext(
                            context.transitionContext.userRequest, 
                            context.transitionContext.projectType
                        ),
                        userRequest: context.transitionContext.userRequest
                    };
                    verboseLog('FileDetectionPhaseManager', 'App context extracted:', this.currentAppContext);
                }
                
                verboseLog('FileDetectionPhaseManager', 'Activated - maintaining current K animation');
                
            } else if (context.fromOwner === 'FILE_MANAGER') {
                verboseLog('FileDetectionPhaseManager', 'Deactivated by MessageCoordinator:', {
                    reason: context.reason,
                    toOwner: context.toOwner,
                    timestamp: new Date().toISOString()
                });
                this.cleanup();
            }
        });
        
        verboseLog('FileDetectionPhaseManager', 'Initialized with COORDINATOR INTEGRATION');
    }

    private extractAppNameFromContext(userRequest?: string, projectType?: string): string {
        if (!userRequest && !projectType) return 'application';
        
        const input = (userRequest || projectType || '').toLowerCase();
        
        if (input.includes('todo') || input.includes('task')) return 'todo app';
        if (input.includes('calculator') || input.includes('calc')) return 'calculator';
        if (input.includes('blog') || input.includes('post')) return 'blog';
        if (input.includes('portfolio') || input.includes('showcase')) return 'portfolio';
        if (input.includes('dashboard') || input.includes('analytics')) return 'dashboard';
        if (input.includes('gallery') || input.includes('photo')) return 'gallery';
        if (input.includes('chat') || input.includes('message')) return 'chat app';
        if (input.includes('shop') || input.includes('store') || input.includes('ecommerce')) return 'online store';
        if (input.includes('game') || input.includes('quiz')) return 'game';
        if (input.includes('website') || input.includes('site')) return 'website';
        if (input.includes('app')) return 'application';
        
        return 'application';
    }

    public activateForStreaming(): void {
        verboseLog('FileDetectionPhaseManager', 'Requesting SEAMLESS control for streaming:', {
            hasAppContext: !!this.currentAppContext,
            appName: this.currentAppContext?.appName || 'application'
        });
        
        const appName = this.currentAppContext?.appName || 'application';
        const initialMessage = `Preparing files...`;
        
        this.forceHandoffToFileManager(initialMessage);
        
        this.activationTimeout = setTimeout(() => {
            if (this.isActive && this.currentPhaseInfo.detectedFiles.length === 0) {
                const appName = this.currentAppContext?.appName || 'application';
                const fallbackMessage = `Preparing file structure...`;
                verboseLog('FileDetectionPhaseManager', 'Showing fallback message after 1.5s timeout:', fallbackMessage);
                
                this.currentPhaseInfo.message = fallbackMessage;
                this.updateMessageIfPossible(fallbackMessage);
            }
        }, 1500);
    }

    private forceHandoffToFileManager(initialMessage: string): void {
        verboseLog('FileDetectionPhaseManager', 'FORCING seamless handoff to FILE_MANAGER:', {
            initialMessage,
            currentOwner: messageCoordinator.getCurrentState().currentOwner
        });
        
        messageCoordinator.handoffToFileManager(initialMessage);
        
        this.isActive = true;
        this.currentPhaseInfo.message = initialMessage;
        
        verboseLog('FileDetectionPhaseManager', 'Forced handoff complete');
    }

    private updateMessageIfPossible(message: string): void {
        if (!this.isActive) {
            verboseLog('FileDetectionPhaseManager', 'Not active, skipping message update:', {
                message,
                isActive: this.isActive
            });
            return;
        }

        const canSend = messageCoordinator.canSendMessage('FILE_MANAGER');
        
        verboseLog('FileDetectionPhaseManager', 'Updating message:', {
            message,
            canSend,
            currentOwner: messageCoordinator.getCurrentState().currentOwner
        });

        if (canSend) {
            messageCoordinator.updateMessage(message, 'FILE_MANAGER');
        } else {
            verboseWarn('FileDetectionPhaseManager', 'Cannot send message - ownership check failed, forcing handoff');
            this.forceHandoffToFileManager(message);
        }
    }

    public updateFileDetection(detectedFiles: { [fileName: string]: 'detected' | 'writing' | 'complete' }): FilePhaseInfo {
        const allFiles = Object.keys(detectedFiles);
        const completeFiles = allFiles.filter(f => detectedFiles[f] === 'complete');
        const writingFiles = allFiles.filter(f => detectedFiles[f] === 'writing');
        const detectedOnlyFiles = allFiles.filter(f => detectedFiles[f] === 'detected');

        verboseLog('FileDetectionPhaseManager', 'File detection update:', {
            totalFiles: allFiles.length,
            completeFiles: completeFiles.length,
            writingFiles: writingFiles.length,
            detectedOnlyFiles: detectedOnlyFiles.length,
            recursionDepth: this.recursionDepth,
            timestamp: new Date().toISOString()
        });

        // SIMPLIFIED: Basic recursion protection
        this.recursionDepth++;

        if (this.recursionDepth > this.maxRecursionDepth) {
            console.error('🚨 [FileDetectionPhaseManager] RECURSION DETECTED - CIRCUIT BREAKER ACTIVATED', {
                recursionDepth: this.recursionDepth,
                maxDepth: this.maxRecursionDepth
            });
            
            this.recursionDepth = 0;
            return this.currentPhaseInfo;
        }

        this.lastUpdateTime = Date.now();

        if (this.activationTimeout) {
            clearTimeout(this.activationTimeout);
            this.activationTimeout = null;
            verboseLog('FileDetectionPhaseManager', 'Cleared activation timeout');
        }

        const newPhase = this.determinePhase(allFiles, completeFiles, writingFiles);
        const progress = this.calculateProgress(allFiles, completeFiles, writingFiles);

        verboseLog('FileDetectionPhaseManager', 'Phase determination:', {
            newPhase,
            progress,
            previousPhase: this.currentPhaseInfo.phase
        });

        let message = '';
        if (this.isActive) {
            message = this.generateUserFriendlyFileMessage(newPhase, allFiles, completeFiles, writingFiles);
            this.updateMessageIfPossible(message);
        } else {
            const coordinatorState = messageCoordinator.getCurrentState();
            message = coordinatorState.currentMessage || this.generateUserFriendlyFileMessage(newPhase, allFiles, completeFiles, writingFiles);
        }

        this.currentPhaseInfo = {
            phase: newPhase,
            progress,
            message,
            detectedFiles: allFiles,
            completeFiles,
            writingFiles,
            totalFiles: allFiles.length
        };

        // SIMPLIFIED: Decrement recursion depth
        this.recursionDepth = Math.max(0, this.recursionDepth - 1);

        return this.currentPhaseInfo;
    }

    public getCurrentPhaseInfo(): FilePhaseInfo {
        return { ...this.currentPhaseInfo };
    }

    public reset(): void {
        verboseLog('FileDetectionPhaseManager', 'Resetting phase manager:', {
            wasActive: this.isActive,
            timestamp: new Date().toISOString()
        });
        this.cleanup();
        this.currentPhaseInfo = this.getInitialPhaseInfo();
    }

    public markComplete(): FilePhaseInfo {
        verboseLog('FileDetectionPhaseManager', 'Marking complete:', {
            timestamp: new Date().toISOString()
        });
        
        const appName = this.currentAppContext?.appName || 'application';
        // Don't say "files are ready" - this is just a phase, not the entire project
        const completionMessage = `This phase is complete!`;
        
        this.currentPhaseInfo = {
            ...this.currentPhaseInfo,
            phase: 'complete',
            progress: 100,
            message: completionMessage
        };
        
        this.updateMessageIfPossible(completionMessage);
        
        return this.currentPhaseInfo;
    }

    // SIMPLIFIED: Force complete without complex auto-retry logic
    public forceComplete(): void {
        verboseLog('FileDetectionPhaseManager', 'FORCE COMPLETE - immediate shutdown:', {
            timestamp: new Date().toISOString()
        });
        
        // Force cleanup immediately
        this.cleanup();
        
        // Reset to initial state
        this.currentPhaseInfo = this.getInitialPhaseInfo();
        
        verboseLog('FileDetectionPhaseManager', 'Force completion successful - fully shut down');
    }

    // SIMPLIFIED: Basic cleanup method
    private cleanup(): void {
        verboseLog('FileDetectionPhaseManager', 'Cleaning up all resources:', {
            wasActive: this.isActive,
            hadActivationTimeout: !!this.activationTimeout,
            timestamp: new Date().toISOString()
        });
        
        // Clear all timeouts
        if (this.activationTimeout) {
            clearTimeout(this.activationTimeout);
            this.activationTimeout = null;
        }
        
        // Reset all state
        this.isActive = false;
        this.currentAppContext = null;
        this.recursionDepth = 0;
        
        verboseLog('FileDetectionPhaseManager', 'Cleanup complete - all resources released');
    }

    private determinePhase(allFiles: string[], completeFiles: string[], writingFiles: string[]): FileDetectionPhase {
        if (allFiles.length === 0) {
            return 'thinking';
        }

        if (writingFiles.length === 0 && completeFiles.length === 0) {
            return 'detecting';
        }

        if (writingFiles.length > 0) {
            return 'generating';
        }

        if (completeFiles.length === allFiles.length && allFiles.length > 0) {
            return 'complete';
        }

        if (completeFiles.length > writingFiles.length) {
            return 'completing';
        }

        return 'generating';
    }

    private calculateProgress(allFiles: string[], completeFiles: string[], writingFiles: string[]): number {
        if (allFiles.length === 0) return 0;

        const completeWeight = 1.0;
        const writingWeight = 0.3;

        const weightedComplete = completeFiles.length * completeWeight;
        const weightedWriting = writingFiles.length * writingWeight;
        const totalWeighted = weightedComplete + weightedWriting;

        const maxPossible = allFiles.length * completeWeight;
        
        return Math.min(100, Math.round((totalWeighted / maxPossible) * 100));
    }

    private generateUserFriendlyFileMessage(
        phase: FileDetectionPhase, 
        allFiles: string[], 
        completeFiles: string[], 
        writingFiles: string[]
    ): string {
        const appName = this.currentAppContext?.appName || 'application';
        
        if (writingFiles.length > 0) {
            const currentFile = writingFiles[0];
            const fileName = currentFile.split('/').pop() || currentFile;
            
            // Show file name but keep message simple and clear it's just a phase
            if (currentFile.endsWith('.mo')) {
                if (fileName === 'main.mo') {
                    return `Building main.mo...`;
                } else {
                    return `Creating ${fileName}...`;
                }
            } else if (currentFile.endsWith('.tsx')) {
                if (fileName === 'App.tsx') {
                    return `Creating App.tsx...`;
                } else {
                    return `Building ${fileName}...`;
                }
            } else if (currentFile.endsWith('.css') || currentFile.endsWith('.scss')) {
                return `Styling ${fileName}...`;
            } else if (currentFile.endsWith('.json')) {
                if (currentFile.includes('package.json')) {
                    return `Setting up package.json...`;
                } else if (currentFile.includes('dfx.json')) {
                    return `Configuring dfx.json...`;
                } else {
                    return `Creating ${fileName}...`;
                }
            } else if (currentFile.endsWith('.md')) {
                return `Writing ${fileName}...`;
            } else if (currentFile.endsWith('.did')) {
                return `Defining ${fileName}...`;
            } else {
                return `Creating ${fileName}...`;
            }
        }

        if (phase === 'detecting' && allFiles.length > 0) {
            const fileTypes = this.analyzeFileTypes(allFiles);
            
            // Don't mention file counts - just say what type of files we're preparing
            if (fileTypes.backend > 0 && fileTypes.frontend === 0) {
                return `Preparing backend files...`;
            } else if (fileTypes.frontend > 0 && fileTypes.backend === 0) {
                return `Preparing interface files...`;
            } else if (fileTypes.backend > 0 && fileTypes.frontend > 0) {
                return `Preparing project files...`;
            } else {
                return `Preparing files...`;
            }
        }

        if (phase === 'completing') {
            const remainingFiles = allFiles.length - completeFiles.length;
            if (remainingFiles === 1) {
                const lastFile = allFiles.find(f => !completeFiles.includes(f));
                const lastFileName = lastFile?.split('/').pop() || 'file';
                return `Finishing ${lastFileName}...`;
            } else {
                // Don't mention file count - just say we're finishing up
                return `Finishing up this phase...`;
            }
        }

        if (phase === 'complete') {
            // Don't say "fully built" - this is just a phase completion, not the entire project
            return `Files for this phase are ready!`;
        }

        if (phase === 'thinking') {
            return `Preparing to build...`;
        }

        return `Working on your project...`;
    }

    private analyzeFileTypes(files: string[]): { backend: number; frontend: number; config: number } {
        return files.reduce((acc, file) => {
            if (file.endsWith('.mo') || file.endsWith('.did')) {
                acc.backend++;
            } else if (file.endsWith('.tsx') || file.endsWith('.jsx') || file.endsWith('.css')) {
                acc.frontend++;
            } else {
                acc.config++;
            }
            return acc;
        }, { backend: 0, frontend: 0, config: 0 });
    }

    private getInitialPhaseInfo(): FilePhaseInfo {
        const message = 'Getting ready to build something amazing...';
        
        return {
            phase: 'thinking',
            progress: 0,
            message,
            detectedFiles: [],
            completeFiles: [],
            writingFiles: [],
            totalFiles: 0
        };
    }
}

export const fileDetectionPhaseManager = new FileDetectionPhaseManagerService();

// Expose to window for external access
(window as any).fileDetectionPhaseManager = fileDetectionPhaseManager;