/**
 * AI Business Agency Builder - Natural language agency creation
 */

import React, { useState } from 'react';
import { AIAgentGeneratorService } from '../../services/AIAgentGeneratorService';
import { DependencyAnalyzer } from '../../services/DependencyAnalyzer';
import { SpecToEntityConverter } from '../../services/SpecToEntityConverter';
import { useAppStore } from '../../store/appStore';
import type { BusinessAgencySpec, GenerationContext } from '../../types/agentSpec';
import { SpecPreview } from './SpecPreview';
import { DependencyResolutionWizard } from './DependencyResolutionWizard';
import { AgencyResourceSelection } from './AgencyResourceSelection';
import { ProgressDialog } from './ProgressDialog';

interface AIAgencyBuilderProps {
  onClose: () => void;
  onSuccess: () => void;
  onSwitchToTab?: (tabId: string) => void;
}

export const AIAgencyBuilder: React.FC<AIAgencyBuilderProps> = ({ onClose, onSuccess, onSwitchToTab }) => {
  const activeProject = useAppStore((state) => state.activeProject);
  const userCanisterId = useAppStore((state) => state.userCanisterId);
  const identity = useAppStore((state) => state.identity);
  const principal = useAppStore((state) => state.principal);
  const [userPrompt, setUserPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSpec, setGeneratedSpec] = useState<BusinessAgencySpec | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showResourceSelection, setShowResourceSelection] = useState(false);
  const [showDependencyWizard, setShowDependencyWizard] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
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
      setGenerationError('Please describe what you want your business agency to do');
      return;
    }

    if (!activeProject || !userCanisterId || !identity) {
      setGenerationError('Please ensure you have an active project and are authenticated');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    
    // Show progress dialog immediately for better UX
    setProgressDialog({
      isOpen: true,
      title: 'Generating Business Agency Specification',
      message: 'Analyzing your requirements and creating the perfect agency configuration...',
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
            ? 'Analyzing business requirements...'
            : currentProgress < 50
            ? 'Designing agency structure...'
            : currentProgress < 70
            ? 'Configuring agents and workflows...'
            : 'Finalizing agency specification...'
        }));
      }, 200);

      const projectId = typeof activeProject === 'string' ? activeProject : (activeProject as any)?.id || '';
      const context = {
        projectId,
        userCanisterId,
        availableServerPairs: 0,
        existingAgents: [],
        existingWorkflows: []
      };

      const result = await generatorService.generateBusinessAgencySpec(userPrompt, context);
      
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
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate agency specification');
      setProgressDialog({
        isOpen: true,
        title: 'Generation Failed',
        message: error instanceof Error ? error.message : 'Failed to generate agency specification',
        phase: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreate = async () => {
    if (!generatedSpec) return;
    
    // Check if agency has agents or workflows that need configuration
    const agentsNeedingConfig = generatedSpec.agents.filter(agent => 
      !agent.agentCanisterId && agent.agentSpec
    );
    const workflowsNeedingConfig = generatedSpec.workflows.filter(workflow => 
      !workflow.workflowId && workflow.workflowSpec
    );

    if (agentsNeedingConfig.length > 0 || workflowsNeedingConfig.length > 0) {
      // Show resource selection UI
      setShowResourceSelection(true);
      return;
    }

    // If all resources are already configured, check dependencies
    const projectId = typeof activeProject === 'string' ? activeProject : (activeProject as any)?.id || '';
    const context: GenerationContext = {
      projectId,
      userCanisterId: userCanisterId || '',
      availableServerPairs: 0,
      existingAgents: [],
      existingWorkflows: []
    };

    const analysis = dependencyAnalyzer.analyzeAgencyDependencies(generatedSpec, context);

    if (analysis.missing.length > 0) {
      setShowDependencyWizard(true);
      return;
    }

    // Proceed with agency creation
    await proceedWithAgencyCreation(generatedSpec);
  };

  const handleResourceSelectionComplete = async (updatedSpec: BusinessAgencySpec) => {
    setGeneratedSpec(updatedSpec);
    setShowResourceSelection(false);

    // Check dependencies after resource selection
    const projectId = typeof activeProject === 'string' ? activeProject : (activeProject as any)?.id || '';
    const context: GenerationContext = {
      projectId,
      userCanisterId: userCanisterId || '',
      availableServerPairs: 0,
      existingAgents: [],
      existingWorkflows: []
    };

    const analysis = dependencyAnalyzer.analyzeAgencyDependencies(updatedSpec, context);

    if (analysis.missing.length > 0) {
      setShowDependencyWizard(true);
      return;
    }

    // Proceed with agency creation
    await proceedWithAgencyCreation(updatedSpec);
  };

  const proceedWithAgencyCreation = async (spec: BusinessAgencySpec) => {
    // Validate and extract projectId as string
    const projectId = typeof activeProject === 'string' ? activeProject : (activeProject as any)?.id || null;
    
    if (!spec || !projectId || typeof projectId !== 'string' || !userCanisterId || typeof userCanisterId !== 'string' || !identity || !principal) {
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
      title: 'Creating Business Agency',
      message: 'Preparing agency deployment...',
      phase: 'creating',
      progress: 0
    });

    try {
      setProgressDialog(prev => ({ ...prev, message: 'Fetching server pairs...', progress: 10 }));
      
      // Get server pair
      const { userCanisterService } = await import('../../services/UserCanisterService');
      const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
      const pairsResult = await userActor.getProjectServerPairs(projectId);
      
      if (!pairsResult || !('ok' in pairsResult) || pairsResult.ok.length === 0) {
        throw new Error('No server pair available. Please create one first.');
      }

      const serverPairId = pairsResult.ok[0].pairId;

      setProgressDialog(prev => ({ ...prev, message: 'Creating business agency...', progress: 30 }));

      const conversionContext = {
        projectId,
        userCanisterId,
        identity,
        principal,
        serverPairId
      };

      const result = await converter.createBusinessAgencyFromSpec(spec, conversionContext);

      if (result.success) {
        setProgressDialog({
          isOpen: true,
          title: 'Business Agency Created Successfully!',
          message: `"${result.entityName}" has been created and is ready to use.`,
          phase: 'success',
          progress: 100
        });
        
        setTimeout(() => {
          setProgressDialog(prev => ({ ...prev, isOpen: false }));
          onSuccess();
          // Switch to business agencies tab
          if (onSwitchToTab) {
            onSwitchToTab('business-agencies');
          }
        }, 2000);
      } else {
        setProgressDialog({
          isOpen: true,
          title: 'Creation Failed',
          message: result.error || 'Failed to create business agency',
          phase: 'error',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Agency creation failed:', error);
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
            🏢 Create Business Agency with AI
          </h2>
          <p style={{
            color: 'var(--text-gray)',
            margin: 0,
            fontSize: '0.95rem',
            lineHeight: 1.4
          }}>
            Describe your business agency with goals and metrics
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
                Describe your business agency
              </label>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="Example: Create a marketing agency that manages social media, creates content, and tracks engagement metrics. Goal: 50 posts per month with 10% engagement rate..."
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
                    ? 'rgba(16, 185, 129, 0.3)'
                    : 'linear-gradient(135deg, #10B981, #059669)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: isGenerating || !userPrompt.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isGenerating || !userPrompt.trim() ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)',
                  minHeight: '44px'
                }}
                onMouseEnter={(e) => {
                  if (!isGenerating && userPrompt.trim()) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = isGenerating || !userPrompt.trim() ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)';
                }}
              >
                {isGenerating ? '⏳ Generating...' : '✨ Generate Agency'}
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
          {showResourceSelection ? (
            <AgencyResourceSelection
              spec={generatedSpec}
              onComplete={handleResourceSelectionComplete}
              onCancel={() => setShowResourceSelection(false)}
            />
          ) : showDependencyWizard ? (
            <DependencyResolutionWizard
              spec={generatedSpec}
              specType="agency"
              onResolve={async (resolvedData) => {
                setShowDependencyWizard(false);
                await proceedWithAgencyCreation(generatedSpec);
              }}
              onCancel={() => setShowDependencyWizard(false)}
            />
          ) : (
            <SpecPreview
              spec={generatedSpec}
              specType="agency"
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

