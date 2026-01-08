/**
 * AI Workflow Builder - Natural language workflow creation
 */

import React, { useState } from 'react';
import { AIAgentGeneratorService } from '../../services/AIAgentGeneratorService';
import { DependencyAnalyzer } from '../../services/DependencyAnalyzer';
import { SpecToEntityConverter } from '../../services/SpecToEntityConverter';
import { useAppStore } from '../../store/appStore';
import type { WorkflowSpec, GenerationContext } from '../../types/agentSpec';
import { SpecPreview } from './SpecPreview';
import { DependencyResolutionWizard } from './DependencyResolutionWizard';
import { WorkflowAgentSelection } from './WorkflowAgentSelection';
import { ServerPairCreationWizard } from './ServerPairCreationWizard';
import { ProgressDialog } from './ProgressDialog';

interface AIWorkflowBuilderProps {
  onClose: () => void;
  onSuccess: () => void;
  onSwitchToTab?: (tabId: string) => void;
}

export const AIWorkflowBuilder: React.FC<AIWorkflowBuilderProps> = ({ onClose, onSuccess, onSwitchToTab }) => {
  const activeProject = useAppStore((state) => state.activeProject);
  const userCanisterId = useAppStore((state) => state.userCanisterId);
  const identity = useAppStore((state) => state.identity);
  const principal = useAppStore((state) => state.principal);
  const [userPrompt, setUserPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSpec, setGeneratedSpec] = useState<WorkflowSpec | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showAgentSelection, setShowAgentSelection] = useState(false);
  const [showDependencyWizard, setShowDependencyWizard] = useState(false);
  const [showServerPairWizard, setShowServerPairWizard] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [existingAgents, setExistingAgents] = useState<any[]>([]);
  const [existingServerPairs, setExistingServerPairs] = useState<any[]>([]);
  const [projectName, setProjectName] = useState<string>('');
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

  const handleGenerate = async () => {
    if (!userPrompt.trim()) {
      setGenerationError('Please describe what you want your workflow to do');
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
      title: 'Generating Workflow Specification',
      message: 'Analyzing your requirements and creating the perfect workflow configuration...',
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
          message: currentProgress < 20
            ? 'Loading existing resources...'
            : currentProgress < 40
            ? 'Analyzing workflow requirements...'
            : currentProgress < 60
            ? 'Designing workflow steps...'
            : currentProgress < 80
            ? 'Configuring agent connections...'
            : 'Finalizing workflow specification...'
        }));
      }, 200);

      // Load existing agents and server pairs for better AI context
      setProgressDialog(prev => ({ ...prev, message: 'Loading existing resources...', progress: 5 }));
      
      const { userCanisterService } = await import('../../services/UserCanisterService');
      const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
      
      // Load server pairs
      const pairsResult = await userActor.getProjectServerPairs(projectId);
      const serverPairs: any[] = [];
      if (pairsResult && 'ok' in pairsResult) {
        const pairs = pairsResult.ok.map((pair: any) => ({
          pairId: pair.pairId,
          name: pair.name,
          createdAt: Number(pair.createdAt) / 1_000_000,
          creditsAllocated: Number(pair.creditsAllocated),
          frontendCanisterId: pair.frontendCanisterId.toText(),
          backendCanisterId: pair.backendCanisterId.toText()
        }));
        serverPairs.push(...pairs);
        setExistingServerPairs(pairs);
      }
      
      // Load existing agents from localStorage
      const storedAgents = localStorage.getItem(`deployed-agents-${projectId}`);
      const agents: any[] = [];
      if (storedAgents) {
        try {
          const parsed = JSON.parse(storedAgents);
          agents.push(...parsed.filter((a: any) => a.status === 'active'));
          setExistingAgents(agents);
        } catch (error) {
          console.warn('Failed to parse stored agents:', error);
        }
      }
      
      // Get project name for server pair creation
      const store = useAppStore.getState();
      const projects = store.projects || [];
      const project = projects.find((p: any) => p.id === projectId);
      setProjectName(project?.name || 'AI Agent Project');

      const context: GenerationContext = {
        projectId,
        userCanisterId,
        availableServerPairs: serverPairs.length,
        existingAgents: agents.map(a => ({
          id: a.backendCanisterId,
          name: a.name,
          description: a.description || '',
          capabilities: []
        })),
        existingWorkflows: []
      };

      const result = await generatorService.generateWorkflowSpec(userPrompt, context);
      
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
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate workflow specification');
      setProgressDialog({
        isOpen: true,
        title: 'Generation Failed',
        message: error instanceof Error ? error.message : 'Failed to generate workflow specification',
        phase: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreate = async () => {
    if (!generatedSpec) return;
    
    const projectId = typeof activeProject === 'string' ? activeProject : (activeProject as any)?.id || '';
    if (!projectId) return;

    // Calculate how many agents are needed (one per step that needs an agent)
    const stepsNeedingAgents = generatedSpec.steps.filter(step => 
      !step.agentCanisterId && step.agentSpec
    );
    const agentsNeeded = stepsNeedingAgents.length;
    
    // Each agent needs its own server pair
    const serverPairsNeeded = agentsNeeded;
    const serverPairsAvailable = existingServerPairs.length;
    const serverPairsToCreate = Math.max(0, serverPairsNeeded - serverPairsAvailable);

    // If we need server pairs, show the creation wizard first
    if (serverPairsToCreate > 0) {
      setShowServerPairWizard(true);
      return;
    }

    // If we have enough server pairs, check if agents need configuration
    if (stepsNeedingAgents.length > 0) {
      // Show agent selection UI
      setShowAgentSelection(true);
      return;
    }

    // If all agents are already configured, check dependencies
    const context: GenerationContext = {
      projectId,
      userCanisterId: userCanisterId || '',
      availableServerPairs: serverPairsAvailable,
      existingAgents: existingAgents.map(a => ({
        id: a.backendCanisterId,
        name: a.name,
        description: a.description || '',
        capabilities: []
      })),
      existingWorkflows: []
    };

    const analysis = dependencyAnalyzer.analyzeWorkflowDependencies(generatedSpec, context);

    if (analysis.missing.length > 0) {
      setShowDependencyWizard(true);
      return;
    }

    // Proceed with workflow creation
    await proceedWithWorkflowCreation(generatedSpec);
  };

  const handleServerPairCreationComplete = async (createdPairIds: string[]) => {
    setShowServerPairWizard(false);
    
    // Refresh server pairs list
    const projectId = typeof activeProject === 'string' ? activeProject : (activeProject as any)?.id || '';
    if (projectId && userCanisterId && identity) {
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
          setExistingServerPairs(pairs);
        }
      } catch (error) {
        console.error('Failed to refresh server pairs:', error);
      }
    }
    
    // Now proceed to agent selection
    if (generatedSpec) {
      const stepsNeedingAgents = generatedSpec.steps.filter(step => 
        !step.agentCanisterId && step.agentSpec
      );
      if (stepsNeedingAgents.length > 0) {
        setShowAgentSelection(true);
      } else {
        await handleCreate();
      }
    }
  };

  const handleAgentSelectionComplete = async (updatedSpec: WorkflowSpec) => {
    setGeneratedSpec(updatedSpec);
    setShowAgentSelection(false);

    // Check dependencies after agent selection
    const projectId = typeof activeProject === 'string' ? activeProject : (activeProject as any)?.id || '';
    const context: GenerationContext = {
      projectId,
      userCanisterId: userCanisterId || '',
      availableServerPairs: 0,
      existingAgents: [],
      existingWorkflows: []
    };

    const analysis = dependencyAnalyzer.analyzeWorkflowDependencies(updatedSpec, context);

    if (analysis.missing.length > 0) {
      setShowDependencyWizard(true);
      return;
    }

    // Proceed with workflow creation
    await proceedWithWorkflowCreation(updatedSpec);
  };

  const proceedWithWorkflowCreation = async (spec: WorkflowSpec, resolvedData?: any) => {
    // Validate and extract projectId as string
    let projectId: string | null = null;
    
    if (typeof activeProject === 'string') {
      projectId = activeProject;
    } else if (activeProject && typeof activeProject === 'object') {
      // Handle object case - try to extract id
      const obj = activeProject as any;
      if (typeof obj.id === 'string') {
        projectId = obj.id;
      } else if (typeof obj.projectId === 'string') {
        projectId = obj.projectId;
      }
    }
    
    // Debug logging
    console.log('🔍 [AIWorkflowBuilder] proceedWithWorkflowCreation:', {
      activeProject,
      projectId,
      userCanisterId,
      hasIdentity: !!identity,
      hasPrincipal: !!principal
    });
    
    if (!spec || !projectId || typeof projectId !== 'string' || !userCanisterId || typeof userCanisterId !== 'string' || !identity || !principal) {
      console.error('❌ [AIWorkflowBuilder] Validation failed:', {
        hasSpec: !!spec,
        projectId,
        projectIdType: typeof projectId,
        userCanisterId,
        userCanisterIdType: typeof userCanisterId,
        hasIdentity: !!identity,
        hasPrincipal: !!principal
      });
      setProgressDialog({
        isOpen: true,
        title: 'Missing Information',
        message: 'Missing required project or authentication information. Please ensure you are logged in and have selected a project.',
        phase: 'error',
        error: 'Invalid project ID or authentication'
      });
      return;
    }

    setProgressDialog({
      isOpen: true,
      title: 'Creating Workflow',
      message: 'Preparing workflow deployment...',
      phase: 'creating',
      progress: 0
    });

    try {
      setProgressDialog(prev => ({ ...prev, message: 'Validating workflow configuration...', progress: 10 }));
      
      // Validate that all steps have agents assigned
      const stepsWithoutAgents = spec.steps.filter(step => !step.agentCanisterId);
      if (stepsWithoutAgents.length > 0) {
        throw new Error(`Some workflow steps are missing agents: ${stepsWithoutAgents.map(s => s.agentName).join(', ')}`);
      }

      setProgressDialog(prev => ({ ...prev, message: 'Creating workflow...', progress: 30 }));

      // Final validation and type coercion before passing to converter
      const validatedProjectId = String(projectId).trim();
      const validatedUserCanisterId = String(userCanisterId).trim();
      
      if (!validatedProjectId || validatedProjectId === 'null' || validatedProjectId === 'undefined' || validatedProjectId === '[object Object]') {
        throw new Error(`Invalid projectId: "${validatedProjectId}" (original: ${JSON.stringify(activeProject)})`);
      }
      if (!validatedUserCanisterId || validatedUserCanisterId === 'null' || validatedUserCanisterId === 'undefined') {
        throw new Error(`Invalid userCanisterId: "${validatedUserCanisterId}"`);
      }

      console.log('✅ [AIWorkflowBuilder] Creating workflow with validated context:', {
        projectId: validatedProjectId,
        projectIdType: typeof validatedProjectId,
        userCanisterId: validatedUserCanisterId,
        userCanisterIdType: typeof validatedUserCanisterId,
        hasIdentity: !!identity,
        hasPrincipal: !!principal,
        stepsCount: spec.steps.length
      });

      // Workflow creation doesn't need a server pair - each agent has its own
      // The serverPairId is only used if creating agents during workflow creation
      // But we've already assigned server pairs to agents in the selection phase
      const conversionContext = {
        projectId: validatedProjectId,
        userCanisterId: validatedUserCanisterId,
        identity,
        principal,
        serverPairId: '' // Not needed for workflow creation, agents have their own pairs
      };

      const result = await converter.createWorkflowFromSpec(spec, conversionContext);

      if (result.success) {
        setProgressDialog({
          isOpen: true,
          title: 'Workflow Created Successfully!',
          message: `"${result.entityName}" has been created and is ready to use.`,
          phase: 'success',
          progress: 100
        });
        
        setTimeout(() => {
          setProgressDialog(prev => ({ ...prev, isOpen: false }));
          onSuccess();
          // Switch to workflows tab
          if (onSwitchToTab) {
            onSwitchToTab('agencies');
          }
        }, 2000);
      } else {
        setProgressDialog({
          isOpen: true,
          title: 'Creation Failed',
          message: result.error || 'Failed to create workflow',
          phase: 'error',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Workflow creation failed:', error);
      setProgressDialog({
        isOpen: true,
        title: 'Creation Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        phase: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
            🔄 Create Workflow with AI
          </h2>
          <p style={{
            color: 'var(--text-gray)',
            margin: 0,
            fontSize: '0.95rem',
            lineHeight: 1.4
          }}>
            Describe your multi-agent workflow
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
                Describe your workflow
              </label>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="Example: Create a workflow that monitors Slack, analyzes sentiment, and posts summaries to Twitter..."
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
                    ? 'rgba(139, 92, 246, 0.3)'
                    : 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: isGenerating || !userPrompt.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isGenerating || !userPrompt.trim() ? 'none' : '0 4px 12px rgba(139, 92, 246, 0.3)',
                  minHeight: '44px'
                }}
                onMouseEnter={(e) => {
                  if (!isGenerating && userPrompt.trim()) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = isGenerating || !userPrompt.trim() ? 'none' : '0 4px 12px rgba(139, 92, 246, 0.3)';
                }}
              >
                {isGenerating ? '⏳ Generating...' : '✨ Generate Workflow'}
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
          {showServerPairWizard ? (
            <ServerPairCreationWizard
              requiredCount={generatedSpec.steps.filter(s => !s.agentCanisterId && s.agentSpec).length}
              existingCount={existingServerPairs.length}
              projectId={typeof activeProject === 'string' ? activeProject : (activeProject as any)?.id || ''}
              projectName={projectName}
              onComplete={handleServerPairCreationComplete}
              onCancel={() => setShowServerPairWizard(false)}
            />
          ) : showAgentSelection ? (
            <WorkflowAgentSelection
              spec={generatedSpec}
              availableServerPairs={existingServerPairs}
              onComplete={handleAgentSelectionComplete}
              onCancel={() => setShowAgentSelection(false)}
              onRefreshServerPairs={async () => {
                // Refresh server pairs list
                const projectId = typeof activeProject === 'string' ? activeProject : (activeProject as any)?.id || '';
                if (projectId && userCanisterId && identity) {
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
                      setExistingServerPairs(pairs);
                    }
                  } catch (error) {
                    console.error('Failed to refresh server pairs:', error);
                  }
                }
              }}
            />
          ) : showDependencyWizard ? (
            <DependencyResolutionWizard
              spec={generatedSpec}
              specType="workflow"
              onResolve={async (resolvedData) => {
                setShowDependencyWizard(false);
                await proceedWithWorkflowCreation(generatedSpec, resolvedData);
              }}
              onCancel={() => setShowDependencyWizard(false)}
            />
          ) : (
            <SpecPreview
              spec={generatedSpec}
              specType="workflow"
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
            setIsGenerating(false);
          }
        }}
      />
    </div>
  );
};

