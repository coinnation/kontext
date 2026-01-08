import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../store/appStore';
import { AgencyService, type Execution, type Agency } from '../services/AgencyService';
import { ExecutionGraphVisualizationWrapper } from '../components/agency/ExecutionGraphVisualization';

// ==================== TYPES ====================

interface ExecutionStep {
  stepIndex: number;
  agentName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: string;
  output?: string;
  duration?: number;
  error?: string;
  startTime?: number;
  endTime?: number;
}

interface ExecutionProgress {
  currentStep: number;
  totalSteps: number;
  percentage: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'triggered' | 'scheduled' | 'waiting_approval' | 'paused';
  estimatedTimeRemaining?: number;
}

interface MonitorConfig {
  autoRefresh: boolean;
  refreshInterval: number;
  showDetailedLogs: boolean;
  showPerformanceMetrics: boolean;
}

// Mobile responsiveness helper
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return isMobile;
};

// ==================== MAIN COMPONENT ====================

export const WorkflowExecutionMonitor: React.FC<{
  execution: Execution;
  agency?: Agency;
  onClose: () => void;
  onRerun?: () => void;
}> = ({ execution, agency, onClose, onRerun }) => {
  const isMobile = useIsMobile();
  const portalRootRef = useRef<HTMLDivElement | null>(null);

  // Ensure portal root exists with proper z-index
  useEffect(() => {
    if (!portalRootRef.current) {
      let existingPortalRoot = document.getElementById('workflow-execution-monitor-root') as HTMLDivElement;
      if (!existingPortalRoot) {
        existingPortalRoot = document.createElement('div');
        existingPortalRoot.id = 'workflow-execution-monitor-root';
        existingPortalRoot.style.position = 'fixed';
        existingPortalRoot.style.top = '0';
        existingPortalRoot.style.left = '0';
        existingPortalRoot.style.width = '100%';
        existingPortalRoot.style.height = '100%';
        existingPortalRoot.style.pointerEvents = 'none';
        existingPortalRoot.style.zIndex = '100000'; // Higher than sidebar toggle (999)
        document.body.appendChild(existingPortalRoot);
      }
      portalRootRef.current = existingPortalRoot;
    }
  }, []);

  const {
    activeProject,
    userCanisterId,
    identity,
  } = useAppStore(state => ({
    activeProject: state.activeProject,
    userCanisterId: state.userCanisterId,
    identity: state.identity,
  }));

  // State management
  const [currentExecution, setCurrentExecution] = useState<Execution>(execution);
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [progress, setProgress] = useState<ExecutionProgress>({
    currentStep: 0,
    totalSteps: 0,
    percentage: 0,
    status: 'pending'
  });
  const [config, setConfig] = useState<MonitorConfig>({
    autoRefresh: true,
    refreshInterval: 2000,
    showDetailedLogs: true,
    showPerformanceMetrics: true
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [showRawData, setShowRawData] = useState(false);
  const [showGraphView, setShowGraphView] = useState(false); // NEW: Toggle graph visualization

  // Auto-refresh execution status
  useEffect(() => {
    if (!config.autoRefresh || !activeProject || !userCanisterId || !identity) return;
    if (['completed', 'failed'].includes(currentExecution.status)) return;

    const interval = setInterval(async () => {
      try {
        setIsRefreshing(true);
        const result = await AgencyService.getExecutionStatus(
          currentExecution.id,
          activeProject,
          userCanisterId,
          identity
        );

        if (result.success && result.execution) {
          setCurrentExecution(result.execution);
        }
      } catch (error) {
        console.error('Failed to refresh execution status:', error);
      } finally {
        setIsRefreshing(false);
      }
    }, config.refreshInterval);

    return () => clearInterval(interval);
  }, [config.autoRefresh, config.refreshInterval, currentExecution.id, currentExecution.status, activeProject, userCanisterId, identity]);

  // Update execution steps and progress when execution changes
  useEffect(() => {
    const steps: ExecutionStep[] = [];
    const totalSteps = agency?.steps.length || currentExecution.totalAgents;

    // Create steps based on agency configuration and execution results
    for (let i = 0; i < totalSteps; i++) {
      const stepResult = currentExecution.results.find(r => r.stepIndex === i);
      const agentStep = agency?.steps[i];

      const step: ExecutionStep = {
        stepIndex: i,
        agentName: stepResult?.agentName || agentStep?.agentName || `Agent ${i + 1}`,
        status: stepResult ? 
          (stepResult.success ? 'completed' : 'failed') :
          (i < currentExecution.currentStep ? 'completed' :
           i === currentExecution.currentStep ? 'running' : 'pending'),
        input: stepResult?.input || agentStep?.inputTemplate || '',
        output: stepResult?.output,
        duration: stepResult?.duration,
        error: stepResult?.error,
        startTime: stepResult ? currentExecution.startTime + (i * 1000) : undefined,
        endTime: stepResult && stepResult.duration ? 
          currentExecution.startTime + (i * 1000) + stepResult.duration : undefined
      };

      steps.push(step);
    }

    setExecutionSteps(steps);

    // Update progress
    const completedSteps = steps.filter(s => s.status === 'completed').length;
    const percentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    setProgress({
      currentStep: currentExecution.currentStep,
      totalSteps,
      percentage,
      status: currentExecution.status,
      estimatedTimeRemaining: calculateEstimatedTime(steps, currentExecution)
    });
  }, [currentExecution, agency]);

  // Calculate estimated time remaining
  const calculateEstimatedTime = (steps: ExecutionStep[], execution: Execution): number | undefined => {
    if (execution.status !== 'running') return undefined;

    const completedSteps = steps.filter(s => s.status === 'completed' && s.duration);
    if (completedSteps.length === 0) return undefined;

    const avgDuration = completedSteps.reduce((sum, s) => sum + (s.duration || 0), 0) / completedSteps.length;
    const remainingSteps = steps.length - completedSteps.length;

    return remainingSteps * avgDuration;
  };

  // Manual refresh
  const handleRefresh = useCallback(async () => {
    if (!activeProject || !userCanisterId || !identity) return;

    try {
      setIsRefreshing(true);
      const result = await AgencyService.getExecutionStatus(
        currentExecution.id,
        activeProject,
        userCanisterId,
        identity
      );

      if (result.success && result.execution) {
        setCurrentExecution(result.execution);
      }
    } catch (error) {
      console.error('Failed to refresh execution:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [currentExecution.id, activeProject, userCanisterId, identity]);

  // Format duration
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return '#10B981';
      case 'running': return '#F59E0B';
      case 'failed': return '#EF4444';
      case 'pending': return '#6B7280';
      case 'triggered': return '#8B5CF6';
      case 'scheduled': return '#06B6D4';
      default: return '#6B7280';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'completed': return '✅';
      case 'running': return '⚡';
      case 'failed': return '❌';
      case 'pending': return '⏳';
      case 'triggered': return '🎯';
      case 'scheduled': return '📅';
      default: return '📊';
    }
  };

  // ==================== RENDER ====================

  // Render using portal to ensure proper stacking above sidebar toggle
  const monitorContent = (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 1)', // Fully opaque background (was 0.95)
      zIndex: 100000, // Much higher than sidebar toggle (999) to ensure it's on top
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      isolation: 'isolate', // Create new stacking context
      pointerEvents: 'auto' // Enable interactions (scrolling, clicking) on the monitor content
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: isMobile ? '1rem' : '1.5rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <h1 style={{
            color: '#ffffff',
            fontSize: isMobile ? '1.25rem' : '1.5rem',
            fontWeight: 700,
            margin: '0 0 0.5rem 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            {getStatusIcon(currentExecution.status)} Workflow Execution
          </h1>
          <div style={{ color: '#888', fontSize: '0.9rem' }}>
            {currentExecution.agencyName} • {currentExecution.executionMode} • 
            {currentExecution.triggerSource && ` Triggered by ${currentExecution.triggerSource}`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: isMobile ? '0.5rem' : '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Graph view toggle */}
          <button
            onClick={() => setShowGraphView(!showGraphView)}
            style={{
              background: showGraphView ? 'rgba(255, 107, 53, 0.2)' : 'rgba(107, 114, 128, 0.2)',
              border: `1px solid ${showGraphView ? '#ff6b35' : '#6B7280'}`,
              color: showGraphView ? '#ff6b35' : '#6B7280',
              padding: isMobile ? '0.6rem 0.75rem' : '0.5rem 1rem',
              borderRadius: '6px',
              fontSize: isMobile ? '0.8rem' : '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              minHeight: isMobile ? '44px' : 'auto'
            }}
          >
            {showGraphView ? '📋' : '📊'} {showGraphView ? 'Timeline' : 'Graph'}
          </button>

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setConfig(prev => ({ ...prev, autoRefresh: !prev.autoRefresh }))}
            style={{
              background: config.autoRefresh ? 'rgba(16, 185, 129, 0.2)' : 'rgba(107, 114, 128, 0.2)',
              border: `1px solid ${config.autoRefresh ? '#10B981' : '#6B7280'}`,
              color: config.autoRefresh ? '#10B981' : '#6B7280',
              padding: isMobile ? '0.6rem 0.75rem' : '0.5rem 1rem',
              borderRadius: '6px',
              fontSize: isMobile ? '0.8rem' : '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              minHeight: isMobile ? '44px' : 'auto'
            }}
          >
            {config.autoRefresh ? '🔄' : '⏸️'} Auto-refresh
          </button>

          {/* Manual refresh */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid #3B82F6',
              color: '#3B82F6',
              padding: isMobile ? '0.6rem 0.75rem' : '0.5rem 1rem',
              borderRadius: '6px',
              fontSize: isMobile ? '0.8rem' : '0.85rem',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              opacity: isRefreshing ? 0.6 : 1,
              minHeight: isMobile ? '44px' : 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {isRefreshing ? '⏳' : '🔄'} Refresh
          </button>

          {/* Rerun button */}
          {onRerun && ['completed', 'failed'].includes(currentExecution.status) && (
            <button
              onClick={onRerun}
              style={{
                background: 'linear-gradient(135deg, #ff6b35, #10B981)',
                border: 'none',
                color: '#ffffff',
                padding: isMobile ? '0.6rem 0.75rem' : '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: isMobile ? '0.8rem' : '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: isMobile ? '44px' : 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              🔄 Rerun
            </button>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #EF4444',
              color: '#EF4444',
              padding: isMobile ? '0.6rem 0.75rem' : '0.5rem 1rem',
              borderRadius: '6px',
              fontSize: isMobile ? '0.8rem' : '0.85rem',
              cursor: 'pointer',
              minHeight: isMobile ? '44px' : 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Progress overview */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: isMobile ? '1rem' : '1.5rem 2rem'
      }}>
        {/* Status and progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{
            background: `${getStatusColor(progress.status)}20`,
            border: `1px solid ${getStatusColor(progress.status)}`,
            color: getStatusColor(progress.status),
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            fontSize: '0.9rem',
            fontWeight: 600,
            textTransform: 'uppercase'
          }}>
            {getStatusIcon(progress.status)} {progress.status}
          </div>

          <div style={{ color: '#ffffff', fontSize: '0.9rem' }}>
            Step {progress.currentStep + 1} of {progress.totalSteps}
          </div>

          {progress.estimatedTimeRemaining && (
            <div style={{ color: '#888', fontSize: '0.9rem' }}>
              ~{formatDuration(progress.estimatedTimeRemaining)} remaining
            </div>
          )}

          {currentExecution.endTime && (
            <div style={{ color: '#888', fontSize: '0.9rem' }}>
              Total: {formatDuration(currentExecution.endTime - currentExecution.startTime)}
            </div>
          )}
        </div>

        {/* Error details in status bar */}
        {(currentExecution.error || currentExecution.results.some(r => r.error)) && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            fontSize: '0.85rem'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              marginBottom: '0.5rem',
              color: '#EF4444',
              fontWeight: 600
            }}>
              <span>🚨</span>
              <span>Error Details:</span>
            </div>
            {currentExecution.error && (
              <div style={{
                color: '#FCA5A5',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.5,
                marginBottom: currentExecution.results.some(r => r.error) ? '0.5rem' : 0
              }}>
                <strong>Main Error:</strong> {currentExecution.error}
              </div>
            )}
            {currentExecution.results.filter(r => r.error).length > 0 && (
              <div style={{ color: '#FCA5A5', fontSize: '0.8rem' }}>
                <strong>Step Errors ({currentExecution.results.filter(r => r.error).length}):</strong>{' '}
                {currentExecution.results
                  .filter(r => r.error)
                  .map((r, idx) => `Step ${r.stepIndex + 1} (${r.agentName}): ${r.error?.substring(0, 80)}${r.error && r.error.length > 80 ? '...' : ''}`)
                  .join(' | ')}
              </div>
            )}
          </div>
        )}

        {/* Progress bar */}
        <div style={{
          width: '100%',
          height: '8px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${progress.percentage}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${getStatusColor(progress.status)}, ${getStatusColor(progress.status)}80)`,
            transition: 'width 0.3s ease',
            borderRadius: '4px'
          }} />
        </div>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        minHeight: 0 // Allow flex children to shrink below content size
      }}>
        {/* Graph Visualization View */}
        {showGraphView && agency ? (
          <div style={{
            width: '100%',
            height: '100%',
            position: 'relative'
          }}>
            <ExecutionGraphVisualizationWrapper
              execution={currentExecution}
              agency={agency}
              className="h-full"
            />
          </div>
        ) : (
          <>
            {/* Steps timeline */}
            <div style={{
              width: isMobile ? '100%' : '60%',
              padding: isMobile ? '1rem' : '2rem',
              overflowY: 'auto',
              overflowX: 'hidden',
              borderRight: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
              minHeight: 0, // Allow flex child to shrink
              WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
            }}>
          <h2 style={{ color: '#ffffff', fontSize: '1.2rem', marginBottom: '1.5rem' }}>
            🔄 Execution Timeline
          </h2>

          <div style={{ position: 'relative' }}>
            {/* Timeline line */}
            <div style={{
              position: 'absolute',
              left: '20px',
              top: '0',
              bottom: '0',
              width: '2px',
              background: 'rgba(255, 255, 255, 0.2)'
            }} />

            {/* Steps */}
            {executionSteps.map((step, index) => (
              <div
                key={step.stepIndex}
                style={{
                  position: 'relative',
                  marginBottom: '2rem',
                  paddingLeft: '60px',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedStep(selectedStep === index ? null : index)}
              >
                {/* Timeline marker */}
                <div style={{
                  position: 'absolute',
                  left: '12px',
                  top: '0',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: getStatusColor(step.status),
                  border: '3px solid #0a0a0a',
                  zIndex: 1
                }} />

                {/* Step card */}
                <div style={{
                  background: selectedStep === index ? 
                    'rgba(255, 107, 53, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                  border: selectedStep === index ?
                    '1px solid rgba(255, 107, 53, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  transition: 'all 0.2s ease'
                }}>
                  {/* Step header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1rem'
                  }}>
                    <div>
                      <h3 style={{ color: '#ffffff', fontSize: '1rem', margin: '0 0 0.25rem 0' }}>
                        {getStatusIcon(step.status)} {step.agentName}
                      </h3>
                      <div style={{ fontSize: '0.8rem', color: '#888' }}>
                        Step {step.stepIndex + 1} • {step.status}
                        {step.duration && ` • ${formatDuration(step.duration)}`}
                      </div>
                    </div>

                    <div style={{
                      background: `${getStatusColor(step.status)}20`,
                      color: getStatusColor(step.status),
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      fontWeight: 600
                    }}>
                      {step.status}
                    </div>
                  </div>

                  {/* Step content */}
                  {selectedStep === index && (
                    <div style={{ fontSize: '0.85rem' }}>
                      {/* Input */}
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ color: '#10B981', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                          📥 Input:
                        </div>
                        <div style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          padding: '0.75rem',
                          borderRadius: '6px',
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          color: '#ccc',
                          wordBreak: 'break-all'
                        }}>
                          {step.input || 'No input data'}
                        </div>
                      </div>

                      {/* Output */}
                      {step.output && (
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ color: '#3B82F6', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                            📤 Output:
                          </div>
                          <div style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            padding: '0.75rem',
                            borderRadius: '6px',
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            color: '#ccc',
                            wordBreak: 'break-all'
                          }}>
                            {step.output}
                          </div>
                        </div>
                      )}

                      {/* Error */}
                      {step.error && (
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ color: '#EF4444', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                            🚨 Error:
                          </div>
                          <div style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            padding: '0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            color: '#EF4444'
                          }}>
                            {step.error}
                          </div>
                        </div>
                      )}

                      {/* Timing info */}
                      {step.startTime && (
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#888' }}>
                          <div>Started: {new Date(step.startTime).toLocaleTimeString()}</div>
                          {step.endTime && (
                            <div>Ended: {new Date(step.endTime).toLocaleTimeString()}</div>
                          )}
                          {step.duration && (
                            <div>Duration: {formatDuration(step.duration)}</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Execution details sidebar */}
        {!isMobile && (
          <div style={{
            width: '40%',
            padding: '2rem',
            overflowY: 'auto',
            overflowX: 'hidden',
            background: 'rgba(255, 255, 255, 0.02)',
            minHeight: 0, // Allow flex child to shrink
            WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ color: '#ffffff', fontSize: '1.2rem', margin: 0 }}>
                📊 Execution Details
              </h2>
              <button
                onClick={() => setShowRawData(!showRawData)}
                style={{
                  background: 'rgba(107, 114, 128, 0.2)',
                  border: '1px solid #6B7280',
                  color: '#6B7280',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                {showRawData ? 'Hide' : 'Show'} Raw
              </button>
            </div>

            {showRawData ? (
              <div style={{
                background: 'rgba(0, 0, 0, 0.5)',
                padding: '1rem',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: '#ccc',
                overflow: 'auto',
                maxHeight: '500px'
              }}>
                <pre>{JSON.stringify(currentExecution, null, 2)}</pre>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Execution metadata */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '1rem',
                  borderRadius: '8px'
                }}>
                  <h3 style={{ color: '#ffffff', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                    📋 Metadata
                  </h3>
                  <div className="space-y-2" style={{ fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#888' }}>Execution ID:</span>
                      <span style={{ color: '#ccc', fontFamily: 'monospace' }}>
                        {currentExecution.id.slice(0, 8)}...
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#888' }}>Agency:</span>
                      <span style={{ color: '#ccc' }}>{currentExecution.agencyName}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#888' }}>Mode:</span>
                      <span style={{ color: '#ccc' }}>{currentExecution.executionMode}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#888' }}>Started:</span>
                      <span style={{ color: '#ccc' }}>
                        {new Date(currentExecution.startTime).toLocaleString()}
                      </span>
                    </div>
                    {currentExecution.endTime && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#888' }}>Ended:</span>
                        <span style={{ color: '#ccc' }}>
                          {new Date(currentExecution.endTime).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Performance metrics */}
                {config.showPerformanceMetrics && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '1rem',
                    borderRadius: '8px'
                  }}>
                    <h3 style={{ color: '#ffffff', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                      ⚡ Performance
                    </h3>
                    <div className="space-y-2" style={{ fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#888' }}>Total Agents:</span>
                        <span style={{ color: '#ccc' }}>{currentExecution.totalAgents}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#888' }}>Failures:</span>
                        <span style={{ color: currentExecution.agentFailures > 0 ? '#EF4444' : '#10B981' }}>
                          {currentExecution.agentFailures}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#888' }}>Success Rate:</span>
                        <span style={{ color: '#10B981' }}>
                          {Math.round(((currentExecution.totalAgents - currentExecution.agentFailures) / currentExecution.totalAgents) * 100)}%
                        </span>
                      </div>
                      {currentExecution.endTime && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#888' }}>Avg per Agent:</span>
                          <span style={{ color: '#ccc' }}>
                            {formatDuration((currentExecution.endTime - currentExecution.startTime) / currentExecution.totalAgents)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Input data */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '1rem',
                  borderRadius: '8px'
                }}>
                  <h3 style={{ color: '#ffffff', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                    📥 Initial Input
                  </h3>
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    color: '#ccc',
                    wordBreak: 'break-all',
                    maxHeight: '150px',
                    overflow: 'auto'
                  }}>
                    {currentExecution.input}
                  </div>
                </div>

                {/* Final output */}
                {currentExecution.status === 'completed' && currentExecution.results.length > 0 && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '1rem',
                    borderRadius: '8px'
                  }}>
                    <h3 style={{ color: '#ffffff', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                      📤 Final Output
                    </h3>
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      color: '#10B981',
                      wordBreak: 'break-all',
                      maxHeight: '150px',
                      overflow: 'auto'
                    }}>
                      {currentExecution.results[currentExecution.results.length - 1]?.output || 'No final output'}
                    </div>
                  </div>
                )}

                {/* Error information */}
                {(currentExecution.error || currentExecution.results.some(r => r.error)) && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '1rem',
                    borderRadius: '8px'
                  }}>
                    <h3 style={{ color: '#EF4444', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                      🚨 Execution Error
                    </h3>
                    
                    {/* Main execution error */}
                    {currentExecution.error && (
                      <div style={{
                        fontSize: '0.8rem',
                        color: '#EF4444',
                        lineHeight: 1.5,
                        marginBottom: currentExecution.results.some(r => r.error) ? '1rem' : 0,
                        padding: '0.75rem',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}>
                        <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Main Error:</strong>
                        {currentExecution.error}
                      </div>
                    )}

                    {/* Step-level errors */}
                    {currentExecution.results.filter(r => r.error).length > 0 && (
                      <div style={{ marginTop: currentExecution.error ? '1rem' : 0 }}>
                        <strong style={{ 
                          display: 'block', 
                          marginBottom: '0.75rem',
                          color: '#EF4444',
                          fontSize: '0.85rem'
                        }}>
                          Step Errors ({currentExecution.results.filter(r => r.error).length}):
                        </strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {currentExecution.results
                            .filter(r => r.error)
                            .map((result, index) => (
                              <details 
                                key={index}
                                style={{
                                  marginBottom: '0.75rem',
                                  background: 'rgba(0, 0, 0, 0.2)',
                                  borderRadius: '4px',
                                  padding: '0.75rem'
                                }}
                              >
                                <summary style={{
                                  color: '#EF4444',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  marginBottom: '0.5rem'
                                }}>
                                  Step {result.stepIndex + 1}: {result.agentName} - {result.error?.substring(0, 60)}...
                                </summary>
                                <div style={{
                                  marginTop: '0.5rem',
                                  fontSize: '0.75rem',
                                  color: '#FCA5A5',
                                  fontFamily: 'monospace',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  lineHeight: 1.6
                                }}>
                                  <div style={{ marginBottom: '0.5rem' }}>
                                    <strong>Input:</strong> {result.input}
                                  </div>
                                  <div style={{ marginBottom: '0.5rem' }}>
                                    <strong>Error:</strong> {result.error}
                                  </div>
                                  {result.duration > 0 && (
                                    <div style={{ marginBottom: '0.5rem', color: '#9CA3AF' }}>
                                      <strong>Duration:</strong> {result.duration}ms
                                    </div>
                                  )}
                                  {result.retryCount > 0 && (
                                    <div style={{ color: '#9CA3AF' }}>
                                      <strong>Retry Count:</strong> {result.retryCount}
                                    </div>
                                  )}
                                </div>
                              </details>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Additional execution metadata */}
                    {(currentExecution.agentFailures > 0 || currentExecution.cyclesUsed > 0) && (
                      <div style={{
                        marginTop: '1rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid rgba(239, 68, 68, 0.3)',
                        fontSize: '0.75rem',
                        color: '#FCA5A5'
                      }}>
                        {currentExecution.agentFailures > 0 && (
                          <div style={{ marginBottom: '0.25rem' }}>
                            <strong>Agent Failures:</strong> {currentExecution.agentFailures} / {currentExecution.totalAgents}
                          </div>
                        )}
                        {currentExecution.cyclesUsed > 0 && (
                          <div>
                            <strong>Cycles Used:</strong> {currentExecution.cyclesUsed.toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );

  // Render using portal to ensure proper stacking above sidebar toggle
  if (typeof document === 'undefined' || !portalRootRef.current) {
    return null; // SSR safety or portal not ready
  }

  return createPortal(monitorContent, portalRootRef.current);
};