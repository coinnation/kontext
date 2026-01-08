/**
 * AI Agent Builder - Natural language agent creation
 */

import React, { useState, useCallback, useEffect } from 'react';
import { AIAgentGeneratorService } from '../../services/AIAgentGeneratorService';
import { DependencyAnalyzer } from '../../services/DependencyAnalyzer';
import { SpecToEntityConverter } from '../../services/SpecToEntityConverter';
import { useAppStore } from '../../store/appStore';
import type { AgentSpec, GenerationContext } from '../../types/agentSpec';
import { SpecPreview } from './SpecPreview';
import { DependencyResolutionWizard } from './DependencyResolutionWizard';
import { ProgressDialog } from './ProgressDialog';
import { ServerPairSelection } from './ServerPairSelection';

interface AIAgentBuilderProps {
  onClose: () => void;
  onSuccess: () => void;
  onSwitchToTab?: (tabId: string) => void;
}

export const AIAgentBuilder: React.FC<AIAgentBuilderProps> = ({ onClose, onSuccess, onSwitchToTab }) => {
  const activeProject = useAppStore((state) => state.activeProject);
  const userCanisterId = useAppStore((state) => state.userCanisterId);
  const identity = useAppStore((state) => state.identity);
  const principal = useAppStore((state) => state.principal);
  const [userPrompt, setUserPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSpec, setGeneratedSpec] = useState<AgentSpec | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showDependencyWizard, setShowDependencyWizard] = useState(false);
  const [showServerPairSelection, setShowServerPairSelection] = useState(false);
  const [availableServerPairs, setAvailableServerPairs] = useState<Array<{
    pairId: string;
    name: string;
    frontendCanisterId: string;
    backendCanisterId: string;
  }>>([]);
  const [selectedServerPairId, setSelectedServerPairId] = useState<string>('');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [creationProgress, setCreationProgress] = useState<string>('');
  const [progressDialog, setProgressDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    progress?: number;
    phase: 'generating' | 'creating' | 'success' | 'error';
    error?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    phase: 'generating'
  });

  const generatorService = new AIAgentGeneratorService();
  const dependencyAnalyzer = new DependencyAnalyzer();
  const converter = new SpecToEntityConverter();

  // Load server pairs
  useEffect(() => {
    const loadServerPairs = async () => {
      const projectId = typeof activeProject === 'string' ? activeProject : (activeProject as any)?.id || null;
      if (!projectId || !userCanisterId || !identity) {
        return;
      }

      try {
        const { userCanisterService } = await import('../../services/UserCanisterService');
        const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
        const pairsResult = await userActor.getProjectServerPairs(projectId);
        
        if (pairsResult && 'ok' in pairsResult) {
          const pairs = pairsResult.ok.map((pair: any) => ({
            pairId: pair.pairId,
            name: pair.name,
            createdAt: Number(pair.createdAt) / 1_000_000,
            creditsAllocated: Number(pair.creditsAllocated),
            frontendCanisterId: pair.frontendCanisterId.toText(),
            backendCanisterId: pair.backendCanisterId.toText()
          }));
          setAvailableServerPairs(pairs);
        }
      } catch (error) {
        console.error('Failed to load server pairs:', error);
      }
    };

    loadServerPairs();
  }, [activeProject, userCanisterId, identity]);

  const handleGenerate = async () => {
    if (!userPrompt.trim()) {
      setGenerationError('Please describe what you want your agent to do');
      return;
    }

    const projectId = typeof activeProject === 'string' ? activeProject : (activeProject as any)?.id || null;
    if (!projectId || typeof projectId !== 'string' || !userCanisterId || !identity) {
      setGenerationError('Please ensure you have an active project and are authenticated');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    
    // Show progress dialog immediately for better UX
    setProgressDialog({
      isOpen: true,
      title: 'Generating Agent Specification',
      message: 'Analyzing your requirements and creating the perfect agent configuration...',
      phase: 'generating',
      progress: 0
    });

    try {
      // Simulate progress during generation with smoother animation
      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        currentProgress = Math.min(currentProgress + 8, 85);
        setProgressDialog(prev => ({
          ...prev,
          progress: currentProgress,
          message: currentProgress < 30 
            ? 'Analyzing your requirements...'
            : currentProgress < 60
            ? 'Selecting MCP servers and tools...'
            : currentProgress < 85
            ? 'Creating agent configuration...'
            : 'Finalizing specification...'
        }));
      }, 200);

      // Build context
      const context: GenerationContext = {
        projectId,
        userCanisterId,
        availableServerPairs: 0, // Will be fetched
        existingAgents: [], // Will be fetched
        userMcpAuth: [] // Will be fetched
      };

      // Generate spec
      const result = await generatorService.generateAgentSpec(userPrompt, context);
      
      clearInterval(progressInterval);
      setProgressDialog({
        isOpen: false,
        title: '',
        message: '',
        phase: 'generating'
      });
      
      setGeneratedSpec(result.spec);
      setShowPreview(true);
    } catch (error) {
      console.error('Generation failed:', error);
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate agent specification');
      setProgressDialog({
        isOpen: true,
        title: 'Generation Failed',
        message: error instanceof Error ? error.message : 'Failed to generate agent specification',
        phase: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreate = async () => {
    const projectId = typeof activeProject === 'string' ? activeProject : (activeProject as any)?.id || null;
    if (!generatedSpec || !projectId || typeof projectId !== 'string' || !userCanisterId || !identity || !principal) {
      return;
    }

    // Analyze dependencies
    const context: GenerationContext = {
      projectId,
      userCanisterId,
      availableServerPairs: availableServerPairs.length,
      existingAgents: [],
      userMcpAuth: []
    };

    const analysis = dependencyAnalyzer.analyzeAgentDependencies(generatedSpec, context);

    // If dependencies need resolution, show wizard
    if (analysis.missing.length > 0) {
      setShowDependencyWizard(true);
      return;
    }

    // Show server pair selection before proceeding
    setShowServerPairSelection(true);
  };

  const proceedWithCreation = async (resolvedData?: any, serverPairIdOverride?: string) => {
    // Validate and extract projectId as string
    const projectId = typeof activeProject === 'string' ? activeProject : (activeProject as any)?.id || null;
    
    if (!generatedSpec || !projectId || typeof projectId !== 'string' || !userCanisterId || typeof userCanisterId !== 'string' || !identity || !principal) {
      setProgressDialog({
        isOpen: true,
        title: 'Missing Information',
        message: 'Missing required project or authentication information. Please ensure you are logged in and have selected a project.',
        phase: 'error',
        error: 'Invalid project ID or authentication'
      });
      return;
    }

    setIsCreating(true);
    setShowDependencyWizard(false);
    setShowServerPairSelection(false);
    setShowPreview(false);
    setProgressDialog({
      isOpen: true,
      title: 'Creating Agent',
      message: 'Preparing agent deployment...',
      phase: 'creating',
      progress: 0
    });

    try {
      // Get server pair ID from override, resolved data, or selected server pair
      let serverPairId = '';
      
      if (serverPairIdOverride) {
        serverPairId = serverPairIdOverride;
      } else if (resolvedData?.serverPairId) {
        serverPairId = resolvedData.serverPairId;
      } else if (selectedServerPairId) {
        serverPairId = selectedServerPairId;
      } else {
        throw new Error('No server pair selected. Please select a server pair to continue.');
      }

      setProgressDialog(prev => ({ ...prev, message: 'Deploying agent...', progress: 20 }));

      const conversionContext = {
        projectId,
        userCanisterId,
        identity,
        principal,
        serverPairId,
        mcpAuthValues: resolvedData?.mcpAuthValues || {}
      };

      const result = await converter.createAgentFromSpec(
        generatedSpec, 
        conversionContext,
        (progress) => {
          // Map progress messages to progress percentages
          let progressPercent = 30;
          if (progress.includes('Deploying')) progressPercent = 40;
          if (progress.includes('Initializing')) progressPercent = 70;
          if (progress.includes('complete') || progress.includes('Complete')) progressPercent = 90;
          
          setProgressDialog(prev => ({
            ...prev,
            message: progress,
            progress: progressPercent
          }));
        }
      );

      if (result.success) {
        // Agent is automatically saved to localStorage by SpecToEntityConverter.createAgentFromSpec
        setProgressDialog({
          isOpen: true,
          title: 'Agent Created Successfully!',
          message: `"${result.entityName}" has been created and is ready to use.${result.warnings && result.warnings.length > 0 ? '\n\n' + result.warnings.join('\n') : ''}`,
          phase: 'success',
          progress: 100
        });
        
        // Close dialog and switch tab after delay
        setTimeout(() => {
          setProgressDialog(prev => ({ ...prev, isOpen: false }));
          onSuccess();
          // Switch to single agents tab
          if (onSwitchToTab) {
            onSwitchToTab('single');
          }
        }, 2000);
      } else {
        setProgressDialog({
          isOpen: true,
          title: 'Creation Failed',
          message: result.error || 'Failed to create agent',
          phase: 'error',
          error: result.error
        });
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Creation failed:', error);
      setProgressDialog({
        isOpen: true,
        title: 'Creation Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        phase: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col" style={{ height: '100%', minHeight: 0, maxHeight: '100%', overflow: 'hidden', padding: '1rem' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0" style={{ paddingBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#ffffff',
            margin: '0 0 0.5rem 0'
          }}>
            🤖 Create Agent with AI
          </h2>
          <p style={{
            color: 'var(--text-gray)',
            margin: 0,
            fontSize: '0.95rem',
            lineHeight: 1.4
          }}>
            Describe what you want your agent to do
          </p>
        </div>
        <button 
          onClick={onClose} 
          style={{
            background: 'rgba(107, 114, 128, 0.15)',
            border: '1px solid rgba(107, 114, 128, 0.3)',
            borderRadius: '6px',
            color: '#9CA3AF',
            fontSize: '1.125rem',
            cursor: 'pointer',
            padding: '0.25rem',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            lineHeight: 1
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(107, 114, 128, 0.25)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(107, 114, 128, 0.15)';
            e.currentTarget.style.color = '#9CA3AF';
          }}
        >
          ×
        </button>
      </div>

      {!showPreview ? (
        <div className="flex-1 flex flex-col" style={{ gap: '1rem', overflow: 'hidden', paddingTop: '0.5rem', minHeight: 0 }}>
          {/* Content Card */}
          <div style={{
            width: '100%',
            maxWidth: '900px',
            margin: '0 auto',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            transition: 'all 0.2s ease',
            flex: '1 1 auto',
            minHeight: 0,
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.3)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          >
            <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <label className="block text-sm font-semibold text-white mb-2" style={{ fontSize: '0.875rem', fontWeight: 600, flexShrink: 0 }}>
                Describe your agent
              </label>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="Example: Create an agent that monitors Slack channels and sends email alerts when specific keywords are mentioned..."
                rows={8}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  resize: 'vertical',
                  lineHeight: '1.6',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                  outline: 'none',
                  flex: '1 1 auto',
                  minHeight: '120px',
                  maxHeight: '100%'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.5)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 107, 53, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {generationError && (
              <div style={{
                padding: '0.75rem 1rem',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#fca5a5',
                fontSize: '0.8125rem',
                lineHeight: '1.5',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '1rem' }}>⚠️</span>
                <span>{generationError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3" style={{ marginTop: '0.5rem', flexShrink: 0 }}>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !userPrompt.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: isGenerating || !userPrompt.trim()
                    ? 'rgba(59, 130, 246, 0.3)'
                    : 'linear-gradient(135deg, #3B82F6, #2563EB)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: isGenerating || !userPrompt.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isGenerating || !userPrompt.trim() ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)',
                  minHeight: '44px'
                }}
                onMouseEnter={(e) => {
                  if (!isGenerating && userPrompt.trim()) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = isGenerating || !userPrompt.trim() ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)';
                }}
              >
                {isGenerating ? '⏳ Generating...' : '✨ Generate Agent'}
              </button>
              <button 
                onClick={onClose} 
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minHeight: '44px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : generatedSpec ? (
        <>
          {showDependencyWizard ? (
            <DependencyResolutionWizard
              spec={generatedSpec}
              specType="agent"
              onResolve={async (resolvedData) => {
                // After dependency resolution, show server pair selection
                setShowDependencyWizard(false);
                setShowServerPairSelection(true);
              }}
              onCancel={() => setShowDependencyWizard(false)}
            />
          ) : showServerPairSelection ? (
            <ServerPairSelection
              availableServerPairs={availableServerPairs}
              onSelect={async (serverPairId) => {
                setSelectedServerPairId(serverPairId);
                setShowServerPairSelection(false);
                // Proceed with creation using selected server pair
                await proceedWithCreation(undefined, serverPairId);
              }}
              onCancel={() => {
                setShowServerPairSelection(false);
                setShowPreview(true);
              }}
              onRefreshServerPairs={async () => {
                const projectId = typeof activeProject === 'string' ? activeProject : (activeProject as any)?.id || null;
                if (!projectId || !userCanisterId || !identity) {
                  return;
                }

                try {
                  const { userCanisterService } = await import('../../services/UserCanisterService');
                  const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
                  const pairsResult = await userActor.getProjectServerPairs(projectId);
                  
                  if (pairsResult && 'ok' in pairsResult) {
                    const pairs = pairsResult.ok.map((pair: any) => ({
                      pairId: pair.pairId,
                      name: pair.name,
                      createdAt: Number(pair.createdAt) / 1_000_000,
                      creditsAllocated: Number(pair.creditsAllocated),
                      frontendCanisterId: pair.frontendCanisterId.toText(),
                      backendCanisterId: pair.backendCanisterId.toText()
                    }));
                    setAvailableServerPairs(pairs);
                  }
                } catch (error) {
                  console.error('Failed to refresh server pairs:', error);
                }
              }}
            />
          ) : (
            <SpecPreview
              spec={generatedSpec}
              specType="agent"
              onEdit={() => setShowPreview(false)}
              onCreate={handleCreate}
              onCancel={onClose}
            />
          )}
        </>
      ) : null}

      {/* Progress Dialog */}
      <ProgressDialog
        isOpen={progressDialog.isOpen}
        title={progressDialog.title}
        message={progressDialog.message}
        progress={progressDialog.progress}
        phase={progressDialog.phase}
        error={progressDialog.error}
        onClose={() => {
          setProgressDialog(prev => ({ ...prev, isOpen: false }));
          if (progressDialog.phase === 'error') {
            setIsCreating(false);
            setIsGenerating(false);
          }
        }}
      />
    </div>
  );
};

