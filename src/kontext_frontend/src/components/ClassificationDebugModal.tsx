import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { classificationDebugService } from '../services/ClassificationDebugService';

interface ClassificationDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

interface DebugEntry {
  id: string;
  timestamp: number;
  projectId: string;
  projectName: string;
  userMessage: string;
  classification?: {
    classification: string;
    confidence: number;
    reasoning: string;
    contextSelection?: any;
    selectionReasoning?: any;
  };
  // ✅ ENHANCED: Complete message context with priority system
  messageContext?: {
    allMessages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp?: string;
      priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CONTEXT';
      priorityReason?: string;
      messageType?: string;
      tokens?: number;
      tokenWeight?: number;
      isCurrentInstruction?: boolean;
      conversationGroup?: string;
    }>;
    totalMessages: number;
    totalTokens?: number;
    contextStrategy: string;
    messageSelectionReasoning?: string;
    priorityMetrics?: {
      currentInstructionId: string;
      criticalMessages: number;
      highPriorityMessages: number;
      mediumPriorityMessages: number;
      lowPriorityMessages: number;
      contextMessages: number;
      priorityDistribution: { [key: string]: number };
      totalPriorityTokens: number;
      optimizationApplied: boolean;
      truncationApplied: boolean;
    };
  };
  projectMetadata?: {
    totalFiles: number;
    fileTypes: { [extension: string]: number };
    projectStructure: any;
    featureMap: any;
    relationships: any;
    lastModified: number;
    projectType?: string;
    complexity?: string;
    estimatedTokens?: number;
    keyFiles?: string[];
    dependencies?: string[];
  };
  contextBuilding?: {
    selectedFiles: string[];
    totalAvailableFiles: number;
    selectionStrategy: string;
    fileContents?: { [fileName: string]: string };
    aiRulesContext?: string;
    documentationContext?: string;
    githubContext?: string;
    mcpContext?: string;
    fileSelectionBreakdown: {
      primaryFiles: string[];
      supportingFiles: string[];
      configFiles: string[];
      excludedFiles: string[];
    };
    contextSizeAnalysis: {
      totalFiles: number;
      totalCharacters: number;
      estimatedTokens: number;
    };
    priorityContextMetadata?: {
      currentInstructionTokens: number;
      supportingContextTokens: number;
      systemContextTokens: number;
      totalPriorityTokens: number;
      priorityStructureApplied: boolean;
      truncationApplied: boolean;
      optimizationApplied: boolean;
      tokenBudgetUsed: number;
      tokenBudgetLimit: number;
    };
  };
  apiCall?: {
    messages: any[];
    model: string;
    timestamp: number;
    requestPayload: any;
    tokenBudget?: number;
    actualTokenUsage?: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
    };
    priorityEnhanced?: {
      hasPriorityAssembly: boolean;
      priorityPromptStructure: {
        currentInstructionSection: boolean;
        supportingContextSection: boolean;
        systemContextSection: boolean;
        focusInstructions: boolean;
      };
      assemblyMetadata?: {
        totalTokens: number;
        priorityDistribution: { [key: string]: number };
        optimizationApplied: boolean;
        truncationApplied: boolean;
      };
    };
  };
  response?: {
    content: any;
    extractedFiles: { [key: string]: string };
    success: boolean;
    error?: string;
    responseAnalysis: {
      contentLength: number;
      fileCount: number;
      codeBlockCount: number;
      hasValidFileMarkers: boolean;
      responseType: string;
      qualityMetrics?: {
        completeness: number;
        relevance: number;
        accuracy: number;
        priorityAlignment?: number;
        contextUtilization?: number;
        focusConsistency?: number;
      };
    };
  };
  systemState?: {
    activeProject: string;
    selectedFiles: string[];
    activeFile?: string;
    sidebarOpen: boolean;
    currentTab: string;
    messageCount: number;
    generationActive: boolean;
    streamingActive: boolean;
    prioritySystemState?: {
      currentInstructionId: string | null;
      totalPriorityAssignments: number;
      activeConversationGroups: number;
      priorityOrderingLength: number;
    };
  };
  duration?: number;
  errors?: Array<{
    phase: string;
    error: string;
    timestamp: number;
  }>;
  priorityAnalytics?: {
    priorityEffectiveness: number;
    contextReduction: number;
    focusImprovement: number;
    tokenOptimization: number;
    userInstructionClarity: number;
  };
  jsonTargetedMode?: {
    enabled: boolean;
    parsingResults: {
      complete: boolean;
      partialJsonDetected: boolean;
      totalEditsDetected: number;
      totalEditsConverted: number;
      conversionErrors: number;
      fallbackToOldParser: boolean;
      parsingErrors: string[];
      rawJsonResponse?: string | null;
    };
    editOperations: Array<{
      filePath: string;
      targetType: string;
      targetName: string;
      description: string;
      oldCodeLength: number;
      newCodeLength: number;
      status: 'detected' | 'complete' | 'applied' | 'error';
    }>;
    streamingMetrics: {
      firstEditDetectedAt: number | null;
      lastEditDetectedAt: number | null;
      totalStreamingTime: number;
      jsonCompleteAt: number | null;
    };
  };
}

const ClassificationDebugModalContent: React.FC<ClassificationDebugModalProps> = ({
  isOpen,
  onClose,
  projectId
}) => {
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'entries' | 'details' | 'messages' | 'context' | 'metadata' | 'priority' | 'assembly' | 'analytics' | 'response' | 'jsonTargeted'>('overview');
  const [selectedEntry, setSelectedEntry] = useState<DebugEntry | null>(null);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    if (isOpen && projectId) {
      loadDebugData();
    }
  }, [isOpen, projectId]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const loadDebugData = async () => {
    try {
      setIsLoading(true);
      const entries = classificationDebugService.getProjectDebugEntries(projectId);
      const projectSummary = classificationDebugService.getProjectDebugSummary(projectId);
      
      setDebugEntries(entries);
      setSummary(projectSummary);
      
      // 🔥 DEBUG: Log entries to verify ASSIGNED priorities are being read
      console.log('🔥 [DEBUG MODAL] Loaded entries with ASSIGNED priorities:');
      entries.forEach((entry, index) => {
        if (entry.messageContext?.allMessages) {
          console.log(`Entry ${index + 1}:`, entry.messageContext.allMessages.map(m => ({
            role: m.role,
            priority: m.priority,
            priorityReason: m.priorityReason,
            isCurrentInstruction: m.isCurrentInstruction
          })));
        }
      });
      
    } catch (error) {
      console.error('Failed to load debug data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    try {
      classificationDebugService.exportDebugData(projectId);
    } catch (error) {
      console.error('Failed to export debug data:', error);
    }
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all debug data for this project?')) {
      classificationDebugService.clearProjectDebugData(projectId);
      loadDebugData();
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTokens = (tokens: number): string => {
    if (tokens < 1000) return `${tokens}`;
    if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}k`;
    return `${(tokens / 1000000).toFixed(1)}M`;
  };

  const formatPercentage = (value: number): string => {
    return `${Math.round(value)}%`;
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return '#10b981';
    if (confidence >= 60) return '#f59e0b';
    return '#ef4444';
  };

  // 🔥 ENHANCED: Priority color mapping to handle both enum and string values
  const getPriorityColor = (priority: string): string => {
    const priorityNormalized = priority?.toUpperCase() || 'MEDIUM';
    switch (priorityNormalized) {
      case 'CRITICAL': return '#dc2626';
      case 'HIGH': return '#ea580c';
      case 'MEDIUM': return '#d97706';
      case 'LOW': return '#65a30d';
      case 'CONTEXT': return '#6366f1';
      // Legacy support for old calculated values
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#6b7280';
      default: return '#9ca3af';
    }
  };

  const getEffectivenessColor = (score: number): string => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    if (score >= 40) return '#f97316';
    return '#ef4444';
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 999999,
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '95vw',
            maxWidth: '1400px',
            height: '85vh',
            maxHeight: '900px',
            backgroundColor: '#1a1a1a',
            border: '2px solid #3b82f6',
            borderRadius: '16px',
            boxShadow: '0 25px 80px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(59, 130, 246, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
            backgroundColor: '#1f1f1f',
            flexShrink: 0
          }}>
            <div>
              <h2 style={{
                fontSize: '1.2rem',
                fontWeight: '700',
                color: '#ffffff',
                margin: 0,
                marginBottom: '4px'
              }}>
                🔥 Priority System Debug Console - PHASE 3 FIXED
              </h2>
              <p style={{
                fontSize: '0.85rem',
                color: '#9ca3af',
                margin: 0
              }}>
                Now reads ASSIGNED priorities instead of calculating them - Race condition fixed!
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={handleExport}
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '8px',
                  color: '#10b981',
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                📤 Export
              </button>
              
              <button
                onClick={handleClear}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#ef4444',
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                🗑️ Clear
              </button>
              
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  padding: '8px 12px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  width: '36px',
                  height: '36px'
                }}
                title="Close (ESC)"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Enhanced Tab Navigation with Priority System Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
            backgroundColor: '#1f1f1f',
            flexShrink: 0,
            overflowX: 'auto'
          }}>
            {[
              { id: 'overview', label: '📊 Overview', icon: '📊' },
              { id: 'entries', label: '📋 Entries', icon: '📋' },
              { id: 'details', label: '🔍 Details', icon: '🔍' },
              { id: 'messages', label: '💬 Messages', icon: '💬' },
              { id: 'context', label: '📁 Context', icon: '📁' },
              { id: 'metadata', label: '🗂️ Metadata', icon: '🗂️' },
              { id: 'priority', label: '🔥 Priority', icon: '🔥' },
              { id: 'assembly', label: '⚙️ Assembly', icon: '⚙️' },
              { id: 'analytics', label: '📈 Analytics', icon: '📈' },
              { id: 'response', label: '📥 Response', icon: '📥' },
              { id: 'jsonTargeted', label: '📝 JSON Mode', icon: '📝' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '12px 16px',
                  background: activeTab === tab.id ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                  color: activeTab === tab.id ? '#3b82f6' : '#9ca3af',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px',
            backgroundColor: '#181818'
          }}>
            {isLoading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: '#9ca3af'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid rgba(59, 130, 246, 0.3)',
                    borderTop: '2px solid #3b82f6',
                    borderRadius: '50%',
                    animation: 'debugModalSpin 1s linear infinite'
                  }} />
                  Loading FIXED Priority System debug data...
                </div>
              </div>
            ) : (
              <>
                {/* Enhanced Overview Tab with Priority Metrics */}
                {activeTab === 'overview' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* 🔥 PHASE 3 FIX STATUS BANNER */}
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '12px',
                      padding: '16px'
                    }}>
                      <div style={{ color: '#10b981', fontSize: '1rem', fontWeight: '600', marginBottom: '8px' }}>
                        🎉 PHASE 3 FIXES APPLIED - Debug System Fixed!
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: '0.85rem', lineHeight: 1.5 }}>
                        ✅ Debug system now reads ASSIGNED priorities from priorityContext instead of calculating them
                        <br />
                        ✅ Race condition between priority assignment and debug capture eliminated
                        <br />
                        ✅ Priority distribution should now show CRITICAL messages correctly
                        <br />
                        ✅ currentInstructionId should be populated properly
                      </div>
                    </div>
                    
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '16px'
                    }}>
                      <div style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <div style={{ color: '#3b82f6', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>
                          Total Classifications
                        </div>
                        <div style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: '700' }}>
                          {summary?.totalClassifications || 0}
                        </div>
                      </div>

                      <div style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <div style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>
                          Avg Confidence
                        </div>
                        <div style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: '700' }}>
                          {summary?.averageConfidence?.toFixed(1) || '0'}%
                        </div>
                      </div>

                      <div style={{
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <div style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>
                          Avg Duration
                        </div>
                        <div style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: '700' }}>
                          {formatDuration(summary?.averageDuration || 0)}
                        </div>
                      </div>

                      <div style={{
                        background: 'rgba(168, 85, 247, 0.1)',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <div style={{ color: '#a855f7', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>
                          Success Rate
                        </div>
                        <div style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: '700' }}>
                          {summary?.successRate?.toFixed(1) || '0'}%
                        </div>
                      </div>
                    </div>

                    {/* 🔥 ENHANCED: Priority System Overview with ASSIGNED priorities */}
                    {summary?.prioritySystemMetrics && (
                      <div style={{
                        background: 'rgba(220, 38, 38, 0.1)',
                        border: '1px solid rgba(220, 38, 38, 0.3)',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <h3 style={{ color: '#dc2626', fontSize: '1rem', fontWeight: '600', marginBottom: '12px' }}>
                          🔥 Message Priority System Performance (ASSIGNED Priorities)
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Priority Effectiveness</span>
                            <span style={{ 
                              color: getEffectivenessColor(summary.prioritySystemMetrics.averagePriorityEffectiveness), 
                              fontSize: '0.85rem', 
                              fontWeight: '600' 
                            }}>
                              {formatPercentage(summary.prioritySystemMetrics.averagePriorityEffectiveness)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Context Reduction</span>
                            <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600' }}>
                              {formatPercentage(summary.prioritySystemMetrics.averageContextReduction)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Focus Improvement</span>
                            <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600' }}>
                              {formatPercentage(summary.prioritySystemMetrics.averageFocusImprovement)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Token Optimization</span>
                            <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600' }}>
                              {formatTokens(summary.prioritySystemMetrics.averageTokenOptimization)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Priority Structure Usage</span>
                            <span style={{ color: '#3b82f6', fontSize: '0.85rem', fontWeight: '600' }}>
                              {formatPercentage(summary.prioritySystemMetrics.priorityStructureUsage)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Total Optimizations</span>
                            <span style={{ color: '#a855f7', fontSize: '0.85rem', fontWeight: '600' }}>
                              {summary.prioritySystemMetrics.totalPriorityOptimizations}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Architecture Health */}
                    {summary?.architectureHealth && (
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <h3 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '600', marginBottom: '12px' }}>
                          🏗️ Architecture Health
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Message Context</span>
                            <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600' }}>
                              {summary.architectureHealth.messageContextConsistency.toFixed(0)}%
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>File Selection</span>
                            <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600' }}>
                              {summary.architectureHealth.fileSelectionAccuracy.toFixed(0)}%
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Response Relevance</span>
                            <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600' }}>
                              {summary.architectureHealth.responseRelevance.toFixed(0)}%
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Performance</span>
                            <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600' }}>
                              {summary.architectureHealth.performanceConsistency.toFixed(0)}%
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Priority System Health</span>
                            <span style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: '600' }}>
                              {summary.architectureHealth.prioritySystemHealth?.toFixed(0) || '0'}%
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Instruction Focus</span>
                            <span style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: '600' }}>
                              {summary.architectureHealth.currentInstructionFocus?.toFixed(0) || '0'}%
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Context Optimization</span>
                            <span style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: '600' }}>
                              {summary.architectureHealth.contextOptimizationEffectiveness?.toFixed(0) || '0'}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Entries Tab */}
                {activeTab === 'entries' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {debugEntries.length === 0 ? (
                      <div style={{
                        textAlign: 'center',
                        padding: '40px',
                        color: '#9ca3af'
                      }}>
                        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔍</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '8px' }}>
                          No Debug Data Available
                        </div>
                        <div style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                          FIXED Priority System debug data will appear here as you interact with the system.
                        </div>
                      </div>
                    ) : (
                      debugEntries.map((entry) => (
                        <div
                          key={entry.id}
                          onClick={() => {
                            setSelectedEntry(entry);
                            setActiveTab('details');
                          }}
                          style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '12px',
                            padding: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '12px'
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{
                                color: '#ffffff',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                marginBottom: '4px'
                              }}>
                                {entry.userMessage.substring(0, 80)}...
                              </div>
                              <div style={{
                                color: '#9ca3af',
                                fontSize: '0.75rem',
                                display: 'flex',
                                gap: '12px',
                                flexWrap: 'wrap'
                              }}>
                                <span>{new Date(entry.timestamp).toLocaleString()}</span>
                                {entry.messageContext && (
                                  <span>💬 {entry.messageContext.totalMessages} msgs</span>
                                )}
                                {entry.contextBuilding && (
                                  <span>📁 {entry.contextBuilding.selectedFiles.length} files</span>
                                )}
                                {entry.projectMetadata && (
                                  <span>🗂️ {entry.projectMetadata.totalFiles} total</span>
                                )}
                                {entry.contextBuilding?.priorityContextMetadata?.priorityStructureApplied && (
                                  <span style={{ color: '#dc2626' }}>🔥 ASSIGNED Priority</span>
                                )}
                                {entry.priorityAnalytics && (
                                  <span style={{ color: '#dc2626' }}>
                                    📈 {formatPercentage(entry.priorityAnalytics.priorityEffectiveness)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                              {entry.classification && (
                                <div style={{
                                  background: `${getConfidenceColor(entry.classification.confidence)}20`,
                                  color: getConfidenceColor(entry.classification.confidence),
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: '600'
                                }}>
                                  {entry.classification.confidence}%
                                </div>
                              )}
                              {entry.errors && entry.errors.length > 0 && (
                                <div style={{
                                  background: 'rgba(239, 68, 68, 0.2)',
                                  color: '#ef4444',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem'
                                }}>
                                  {entry.errors.length} errors
                                </div>
                              )}
                              {entry.priorityAnalytics && (
                                <div style={{
                                  background: 'rgba(220, 38, 38, 0.2)',
                                  color: '#dc2626',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem'
                                }}>
                                  🔥 FIXED {formatPercentage(entry.priorityAnalytics.priorityEffectiveness)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 🔥 NEW: Details Tab Implementation */}
                {activeTab === 'details' && selectedEntry && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '16px'
                    }}>
                      <h3 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '600', marginBottom: '12px' }}>
                        🔍 Entry Details
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Entry ID</div>
                          <div style={{ color: '#ffffff', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                            {selectedEntry.id}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Timestamp</div>
                          <div style={{ color: '#ffffff', fontSize: '0.9rem' }}>
                            {new Date(selectedEntry.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Duration</div>
                          <div style={{ color: '#ffffff', fontSize: '0.9rem' }}>
                            {selectedEntry.duration ? formatDuration(selectedEntry.duration) : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Project</div>
                          <div style={{ color: '#ffffff', fontSize: '0.9rem' }}>
                            {selectedEntry.projectName}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '16px'
                    }}>
                      <h4 style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>
                        User Message
                      </h4>
                      <div style={{
                        background: 'rgba(0, 0, 0, 0.2)',
                        padding: '12px',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        lineHeight: 1.4
                      }}>
                        {selectedEntry.userMessage}
                      </div>
                    </div>

                    {selectedEntry.classification && (
                      <div style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <h4 style={{ color: '#3b82f6', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>
                          Classification Result
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                          <div>
                            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Classification: </span>
                            <span style={{ color: '#3b82f6', fontSize: '0.85rem', fontWeight: '600' }}>
                              {selectedEntry.classification.classification}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Confidence: </span>
                            <span style={{ 
                              color: getConfidenceColor(selectedEntry.classification.confidence), 
                              fontSize: '0.85rem', 
                              fontWeight: '600' 
                            }}>
                              {selectedEntry.classification.confidence}%
                            </span>
                          </div>
                        </div>
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>Reasoning:</div>
                          <div style={{ color: '#ffffff', fontSize: '0.8rem', lineHeight: 1.4 }}>
                            {selectedEntry.classification.reasoning}
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedEntry.errors && selectedEntry.errors.length > 0 && (
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <h4 style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>
                          Errors ({selectedEntry.errors.length})
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {selectedEntry.errors.map((error, index) => (
                            <div key={index} style={{
                              background: 'rgba(0, 0, 0, 0.2)',
                              padding: '8px',
                              borderRadius: '6px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: '600' }}>
                                  {error.phase}
                                </span>
                                <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
                                  {new Date(error.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              <div style={{ color: '#ffffff', fontSize: '0.75rem' }}>
                                {error.error}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Enhanced Messages Tab with ASSIGNED Priority Display */}
                {activeTab === 'messages' && selectedEntry?.messageContext && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* 🔥 PHASE 3 FIX STATUS */}
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '12px',
                      padding: '12px'
                    }}>
                      <div style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: '600', marginBottom: '4px' }}>
                        🔥 PHASE 3 FIX: Now Displaying ASSIGNED Priorities
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                        Priorities below are now read from message.priorityContext.priority instead of being calculated
                      </div>
                    </div>

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '16px'
                    }}>
                      <h3 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '600', marginBottom: '12px' }}>
                        💬 Message Context Summary (ASSIGNED Priorities)
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Total Messages</div>
                          <div style={{ color: '#ffffff', fontSize: '1.2rem', fontWeight: '700' }}>
                            {selectedEntry.messageContext.totalMessages}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Total Tokens</div>
                          <div style={{ color: '#ffffff', fontSize: '1.2rem', fontWeight: '700' }}>
                            {formatTokens(selectedEntry.messageContext.totalTokens || 0)}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Strategy</div>
                          <div style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '600' }}>
                            {selectedEntry.messageContext.contextStrategy}
                          </div>
                        </div>
                      </div>
                      
                      {selectedEntry.messageContext.messageSelectionReasoning && (
                        <div style={{ marginTop: '12px' }}>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>Selection Reasoning</div>
                          <div style={{
                            color: '#ffffff',
                            fontSize: '0.85rem',
                            background: 'rgba(0, 0, 0, 0.2)',
                            padding: '8px 12px',
                            borderRadius: '8px'
                          }}>
                            {selectedEntry.messageContext.messageSelectionReasoning}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 🔥 ENHANCED: Priority Metrics Display with ASSIGNED priorities */}
                    {selectedEntry.messageContext.priorityMetrics && (
                      <div style={{
                        background: 'rgba(220, 38, 38, 0.1)',
                        border: '1px solid rgba(220, 38, 38, 0.3)',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <h3 style={{ color: '#dc2626', fontSize: '1rem', fontWeight: '600', marginBottom: '12px' }}>
                          🔥 Priority System Metrics (ASSIGNED Priorities)
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                          <div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Current Instruction ID</div>
                            <div style={{ color: '#dc2626', fontSize: '1rem', fontWeight: '600' }}>
                              {selectedEntry.messageContext.priorityMetrics.currentInstructionId ? 
                                selectedEntry.messageContext.priorityMetrics.currentInstructionId.substring(0, 12) + '...' : 
                                'None'}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Total Priority Tokens</div>
                            <div style={{ color: '#dc2626', fontSize: '1rem', fontWeight: '600' }}>
                              {formatTokens(selectedEntry.messageContext.priorityMetrics.totalPriorityTokens)}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Optimization Applied</div>
                            <div style={{ 
                              color: selectedEntry.messageContext.priorityMetrics.optimizationApplied ? '#10b981' : '#ef4444',
                              fontSize: '1rem', 
                              fontWeight: '600' 
                            }}>
                              {selectedEntry.messageContext.priorityMetrics.optimizationApplied ? '✅ Yes' : '❌ No'}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Truncation Applied</div>
                            <div style={{ 
                              color: selectedEntry.messageContext.priorityMetrics.truncationApplied ? '#f59e0b' : '#6b7280',
                              fontSize: '1rem', 
                              fontWeight: '600' 
                            }}>
                              {selectedEntry.messageContext.priorityMetrics.truncationApplied ? '⚠️ Yes' : '✅ No'}
                            </div>
                          </div>
                        </div>

                        {/* 🔥 ENHANCED: Priority Distribution with ASSIGNED priorities */}
                        <div style={{ marginTop: '16px' }}>
                          <h4 style={{ color: '#dc2626', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>
                            Message Priority Distribution (ASSIGNED)
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                            {Object.entries(selectedEntry.messageContext.priorityMetrics.priorityDistribution).map(([priority, count]) => (
                              <div key={priority} style={{
                                background: `${getPriorityColor(priority)}20`,
                                color: getPriorityColor(priority),
                                padding: '8px 12px',
                                borderRadius: '8px',
                                textAlign: 'center',
                                fontSize: '0.75rem',
                                fontWeight: '600'
                              }}>
                                {priority}: {count as number}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '16px'
                    }}>
                      <h3 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '600', marginBottom: '12px' }}>
                        📋 All Messages with ASSIGNED Priorities
                      </h3>
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '8px',
                        maxHeight: '400px',
                        overflowY: 'auto'
                      }}>
                        {selectedEntry.messageContext.allMessages.map((message, index) => (
                          <div key={index} style={{
                            background: message.role === 'user' 
                              ? 'rgba(255, 107, 53, 0.1)' 
                              : message.role === 'assistant' 
                                ? 'rgba(59, 130, 246, 0.1)' 
                                : 'rgba(16, 185, 129, 0.1)',
                            border: `1px solid ${message.role === 'user' 
                              ? 'rgba(255, 107, 53, 0.3)' 
                              : message.role === 'assistant' 
                                ? 'rgba(59, 130, 246, 0.3)' 
                                : 'rgba(16, 185, 129, 0.3)'}`,
                            borderRadius: '8px',
                            padding: '12px'
                          }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '8px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  background: message.role === 'user' 
                                    ? 'rgba(255, 107, 53, 0.2)' 
                                    : message.role === 'assistant' 
                                      ? 'rgba(59, 130, 246, 0.2)' 
                                      : 'rgba(16, 185, 129, 0.2)',
                                  color: message.role === 'user' 
                                    ? '#ff6b35' 
                                    : message.role === 'assistant' 
                                      ? '#3b82f6' 
                                      : '#10b981',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: '600'
                                }}>
                                  {message.role.toUpperCase()}
                                </span>
                                {/* 🔥 ENHANCED: ASSIGNED Priority Badge */}
                                {message.priority && (
                                  <span style={{
                                    background: `${getPriorityColor(message.priority)}20`,
                                    color: getPriorityColor(message.priority),
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    fontWeight: '600'
                                  }}>
                                    🔥 {message.priority} (ASSIGNED)
                                  </span>
                                )}
                                {/* Current Instruction Indicator */}
                                {message.isCurrentInstruction && (
                                  <span style={{
                                    background: 'rgba(220, 38, 38, 0.2)',
                                    color: '#dc2626',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    fontWeight: '600'
                                  }}>
                                    ⭐ CURRENT
                                  </span>
                                )}
                                {message.messageType && message.messageType !== 'standard' && (
                                  <span style={{
                                    background: 'rgba(168, 85, 247, 0.2)',
                                    color: '#a855f7',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    fontWeight: '600'
                                  }}>
                                    {message.messageType}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {/* Token Weight */}
                                {message.tokenWeight && message.tokenWeight !== 1.0 && (
                                  <span style={{
                                    color: '#f59e0b',
                                    fontSize: '0.75rem'
                                  }}>
                                    Weight: {message.tokenWeight}x
                                  </span>
                                )}
                                {message.tokens && (
                                  <span style={{
                                    color: '#9ca3af',
                                    fontSize: '0.75rem'
                                  }}>
                                    {formatTokens(message.tokens)}
                                  </span>
                                )}
                                {message.timestamp && (
                                  <span style={{
                                    color: '#9ca3af',
                                    fontSize: '0.7rem'
                                  }}>
                                    {new Date(message.timestamp).toLocaleTimeString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* 🔥 ENHANCED: ASSIGNED Priority Reason */}
                            {message.priorityReason && (
                              <div style={{
                                color: '#9ca3af',
                                fontSize: '0.75rem',
                                marginBottom: '6px',
                                fontStyle: 'italic'
                              }}>
                                ASSIGNED Priority Reason: {message.priorityReason}
                              </div>
                            )}
                            
                            <div style={{
                              color: '#ffffff',
                              fontSize: '0.8rem',
                              lineHeight: 1.4,
                              whiteSpace: 'pre-wrap',
                              maxHeight: '100px',
                              overflow: 'auto',
                              background: 'rgba(0, 0, 0, 0.2)',
                              padding: '8px',
                              borderRadius: '4px'
                            }}>
                              {message.content.length > 500 
                                ? `${message.content.substring(0, 500)}...` 
                                : message.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 🔥 NEW: Context Tab Implementation */}
                {activeTab === 'context' && selectedEntry?.contextBuilding && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '16px'
                    }}>
                      <h3 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '600', marginBottom: '12px' }}>
                        📁 Context Building Summary
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Selected Files</div>
                          <div style={{ color: '#ffffff', fontSize: '1.2rem', fontWeight: '700' }}>
                            {selectedEntry.contextBuilding.selectedFiles.length}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Total Available</div>
                          <div style={{ color: '#ffffff', fontSize: '1.2rem', fontWeight: '700' }}>
                            {selectedEntry.contextBuilding.totalAvailableFiles}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Strategy</div>
                          <div style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '600' }}>
                            {selectedEntry.contextBuilding.selectionStrategy}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Est. Tokens</div>
                          <div style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '600' }}>
                            {formatTokens(selectedEntry.contextBuilding.contextSizeAnalysis.estimatedTokens)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '12px',
                      padding: '16px'
                    }}>
                      <h4 style={{ color: '#f59e0b', fontSize: '0.9rem', fontWeight: '600', marginBottom: '12px' }}>
                        📋 File Selection Breakdown
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>Primary Files</div>
                          <div style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '6px',
                            padding: '6px',
                            fontSize: '0.8rem'
                          }}>
                            {selectedEntry.contextBuilding.fileSelectionBreakdown.primaryFiles.length > 0 ? (
                              selectedEntry.contextBuilding.fileSelectionBreakdown.primaryFiles.map(file => (
                                <div key={file} style={{ color: '#10b981', marginBottom: '2px' }}>{file}</div>
                              ))
                            ) : (
                              <div style={{ color: '#9ca3af' }}>None</div>
                            )}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>Supporting Files</div>
                          <div style={{
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '6px',
                            padding: '6px',
                            fontSize: '0.8rem'
                          }}>
                            {selectedEntry.contextBuilding.fileSelectionBreakdown.supportingFiles.length > 0 ? (
                              selectedEntry.contextBuilding.fileSelectionBreakdown.supportingFiles.slice(0, 5).map(file => (
                                <div key={file} style={{ color: '#3b82f6', marginBottom: '2px' }}>{file}</div>
                              ))
                            ) : (
                              <div style={{ color: '#9ca3af' }}>None</div>
                            )}
                            {selectedEntry.contextBuilding.fileSelectionBreakdown.supportingFiles.length > 5 && (
                              <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
                                +{selectedEntry.contextBuilding.fileSelectionBreakdown.supportingFiles.length - 5} more
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>Config Files</div>
                          <div style={{
                            background: 'rgba(168, 85, 247, 0.1)',
                            border: '1px solid rgba(168, 85, 247, 0.3)',
                            borderRadius: '6px',
                            padding: '6px',
                            fontSize: '0.8rem'
                          }}>
                            {selectedEntry.contextBuilding.fileSelectionBreakdown.configFiles.length > 0 ? (
                              selectedEntry.contextBuilding.fileSelectionBreakdown.configFiles.map(file => (
                                <div key={file} style={{ color: '#a855f7', marginBottom: '2px' }}>{file}</div>
                              ))
                            ) : (
                              <div style={{ color: '#9ca3af' }}>None</div>
                            )}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>Excluded Files</div>
                          <div style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '6px',
                            padding: '6px',
                            fontSize: '0.8rem',
                            maxHeight: '100px',
                            overflowY: 'auto'
                          }}>
                            {selectedEntry.contextBuilding.fileSelectionBreakdown.excludedFiles.length > 0 ? (
                              <div style={{ color: '#ef4444' }}>
                                {selectedEntry.contextBuilding.fileSelectionBreakdown.excludedFiles.length} files excluded
                              </div>
                            ) : (
                              <div style={{ color: '#9ca3af' }}>None</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedEntry.contextBuilding.priorityContextMetadata && (
                      <div style={{
                        background: 'rgba(220, 38, 38, 0.1)',
                        border: '1px solid rgba(220, 38, 38, 0.3)',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <h4 style={{ color: '#dc2626', fontSize: '0.9rem', fontWeight: '600', marginBottom: '12px' }}>
                          🔥 Priority Context Metadata
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Current Instruction</span>
                            <span style={{ color: '#dc2626', fontSize: '0.8rem', fontWeight: '600' }}>
                              {formatTokens(selectedEntry.contextBuilding.priorityContextMetadata.currentInstructionTokens)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Supporting Context</span>
                            <span style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: '600' }}>
                              {formatTokens(selectedEntry.contextBuilding.priorityContextMetadata.supportingContextTokens)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>System Context</span>
                            <span style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: '600' }}>
                              {formatTokens(selectedEntry.contextBuilding.priorityContextMetadata.systemContextTokens)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Priority Structure</span>
                            <span style={{ 
                              color: selectedEntry.contextBuilding.priorityContextMetadata.priorityStructureApplied ? '#10b981' : '#ef4444',
                              fontSize: '0.8rem', 
                              fontWeight: '600' 
                            }}>
                              {selectedEntry.contextBuilding.priorityContextMetadata.priorityStructureApplied ? '✅ Yes' : '❌ No'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Token Budget Used</span>
                            <span style={{ color: '#3b82f6', fontSize: '0.8rem', fontWeight: '600' }}>
                              {formatTokens(selectedEntry.contextBuilding.priorityContextMetadata.tokenBudgetUsed)} / {formatTokens(selectedEntry.contextBuilding.priorityContextMetadata.tokenBudgetLimit)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Optimization</span>
                            <span style={{ 
                              color: selectedEntry.contextBuilding.priorityContextMetadata.optimizationApplied ? '#10b981' : '#6b7280',
                              fontSize: '0.8rem', 
                              fontWeight: '600' 
                            }}>
                              {selectedEntry.contextBuilding.priorityContextMetadata.optimizationApplied ? '✅ Applied' : '⊝ None'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 🔥 NEW: Metadata Tab Implementation */}
                {activeTab === 'metadata' && selectedEntry?.projectMetadata && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '16px'
                    }}>
                      <h3 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '600', marginBottom: '12px' }}>
                        🗂️ Project Metadata Overview
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Total Files</div>
                          <div style={{ color: '#ffffff', fontSize: '1.2rem', fontWeight: '700' }}>
                            {selectedEntry.projectMetadata.totalFiles}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Project Type</div>
                          <div style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '600' }}>
                            {selectedEntry.projectMetadata.projectType || 'Unknown'}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Complexity</div>
                          <div style={{ 
                            color: selectedEntry.projectMetadata.complexity === 'complex' ? '#ef4444' : 
                                  selectedEntry.projectMetadata.complexity === 'medium' ? '#f59e0b' : '#10b981',
                            fontSize: '1rem', 
                            fontWeight: '600' 
                          }}>
                            {selectedEntry.projectMetadata.complexity || 'Medium'}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Est. Tokens</div>
                          <div style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '600' }}>
                            {formatTokens(selectedEntry.projectMetadata.estimatedTokens || 0)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '12px',
                      padding: '16px'
                    }}>
                      <h4 style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: '600', marginBottom: '12px' }}>
                        📁 File Type Distribution
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                        {Object.entries(selectedEntry.projectMetadata.fileTypes).map(([extension, count]) => (
                          <div key={extension} style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            borderRadius: '6px',
                            padding: '8px',
                            textAlign: 'center'
                          }}>
                            <div style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: '600' }}>
                              .{extension}
                            </div>
                            <div style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '700' }}>
                              {count as number}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedEntry.projectMetadata.keyFiles && selectedEntry.projectMetadata.keyFiles.length > 0 && (
                      <div style={{
                        background: 'rgba(168, 85, 247, 0.1)',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <h4 style={{ color: '#a855f7', fontSize: '0.9rem', fontWeight: '600', marginBottom: '12px' }}>
                          🔑 Key Files
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {selectedEntry.projectMetadata.keyFiles.map((file, index) => (
                            <span key={index} style={{
                              background: 'rgba(168, 85, 247, 0.2)',
                              color: '#a855f7',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              fontWeight: '600'
                            }}>
                              {file}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedEntry.projectMetadata.dependencies && selectedEntry.projectMetadata.dependencies.length > 0 && (
                      <div style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <h4 style={{ color: '#3b82f6', fontSize: '0.9rem', fontWeight: '600', marginBottom: '12px' }}>
                          📦 Dependencies
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {selectedEntry.projectMetadata.dependencies.map((dep, index) => (
                            <span key={index} style={{
                              background: 'rgba(59, 130, 246, 0.2)',
                              color: '#3b82f6',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              fontWeight: '600'
                            }}>
                              {dep}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 🔥 NEW: Priority Tab Implementation */}
                {activeTab === 'priority' && selectedEntry && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                      background: 'rgba(220, 38, 38, 0.1)',
                      border: '1px solid rgba(220, 38, 38, 0.3)',
                      borderRadius: '12px',
                      padding: '16px'
                    }}>
                      <h3 style={{ color: '#dc2626', fontSize: '1rem', fontWeight: '600', marginBottom: '12px' }}>
                        🔥 Priority System Analysis
                      </h3>
                      
                      {selectedEntry.priorityAnalytics ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                          <div style={{
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '8px',
                            padding: '12px',
                            textAlign: 'center'
                          }}>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>
                              Priority Effectiveness
                            </div>
                            <div style={{ 
                              color: getEffectivenessColor(selectedEntry.priorityAnalytics.priorityEffectiveness),
                              fontSize: '1.8rem',
                              fontWeight: '700',
                              marginBottom: '4px'
                            }}>
                              {formatPercentage(selectedEntry.priorityAnalytics.priorityEffectiveness)}
                            </div>
                            <div style={{ 
                              color: '#9ca3af',
                              fontSize: '0.7rem'
                            }}>
                              Overall system performance
                            </div>
                          </div>

                          <div style={{
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '8px',
                            padding: '12px',
                            textAlign: 'center'
                          }}>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>
                              Context Reduction
                            </div>
                            <div style={{ 
                              color: '#10b981',
                              fontSize: '1.8rem',
                              fontWeight: '700',
                              marginBottom: '4px'
                            }}>
                              {formatPercentage(selectedEntry.priorityAnalytics.contextReduction)}
                            </div>
                            <div style={{ 
                              color: '#9ca3af',
                              fontSize: '0.7rem'
                            }}>
                              Context size optimization
                            </div>
                          </div>

                          <div style={{
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '8px',
                            padding: '12px',
                            textAlign: 'center'
                          }}>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>
                              Focus Improvement
                            </div>
                            <div style={{ 
                              color: '#3b82f6',
                              fontSize: '1.8rem',
                              fontWeight: '700',
                              marginBottom: '4px'
                            }}>
                              {formatPercentage(selectedEntry.priorityAnalytics.focusImprovement)}
                            </div>
                            <div style={{ 
                              color: '#9ca3af',
                              fontSize: '0.7rem'
                            }}>
                              Current instruction focus
                            </div>
                          </div>

                          <div style={{
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '8px',
                            padding: '12px',
                            textAlign: 'center'
                          }}>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>
                              Token Optimization
                            </div>
                            <div style={{ 
                              color: '#f59e0b',
                              fontSize: '1.4rem',
                              fontWeight: '700',
                              marginBottom: '4px'
                            }}>
                              {formatTokens(selectedEntry.priorityAnalytics.tokenOptimization)}
                            </div>
                            <div style={{ 
                              color: '#9ca3af',
                              fontSize: '0.7rem'
                            }}>
                              Tokens saved through prioritization
                            </div>
                          </div>

                          <div style={{
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '8px',
                            padding: '12px',
                            textAlign: 'center'
                          }}>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>
                              Instruction Clarity
                            </div>
                            <div style={{ 
                              color: getEffectivenessColor(selectedEntry.priorityAnalytics.userInstructionClarity),
                              fontSize: '1.8rem',
                              fontWeight: '700',
                              marginBottom: '4px'
                            }}>
                              {formatPercentage(selectedEntry.priorityAnalytics.userInstructionClarity)}
                            </div>
                            <div style={{ 
                              color: '#9ca3af',
                              fontSize: '0.7rem'
                            }}>
                              User message clarity score
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          textAlign: 'center',
                          padding: '20px',
                          color: '#9ca3af',
                          fontSize: '0.9rem'
                        }}>
                          Priority analytics not available for this entry
                        </div>
                      )}
                    </div>

                    {selectedEntry.messageContext?.priorityMetrics && (
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <h4 style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: '600', marginBottom: '12px' }}>
                          📊 Priority Distribution Analysis
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                          {Object.entries(selectedEntry.messageContext.priorityMetrics.priorityDistribution).map(([priority, count]) => (
                            <div key={priority} style={{
                              background: `${getPriorityColor(priority)}15`,
                              border: `1px solid ${getPriorityColor(priority)}40`,
                              borderRadius: '8px',
                              padding: '12px',
                              textAlign: 'center'
                            }}>
                              <div style={{ 
                                color: getPriorityColor(priority),
                                fontSize: '1.4rem',
                                fontWeight: '700',
                                marginBottom: '4px'
                              }}>
                                {count as number}
                              </div>
                              <div style={{ 
                                color: getPriorityColor(priority),
                                fontSize: '0.75rem',
                                fontWeight: '600'
                              }}>
                                {priority}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 🔥 NEW: Assembly Tab Implementation */}
                {activeTab === 'assembly' && selectedEntry?.apiCall && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '16px'
                    }}>
                      <h3 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '600', marginBottom: '12px' }}>
                        ⚙️ API Call Assembly Details
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Model</div>
                          <div style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '600' }}>
                            {selectedEntry.apiCall.model}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Messages</div>
                          <div style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '600' }}>
                            {selectedEntry.apiCall.messages.length}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Token Budget</div>
                          <div style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '600' }}>
                            {formatTokens(selectedEntry.apiCall.tokenBudget || 0)}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Timestamp</div>
                          <div style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '600' }}>
                            {new Date(selectedEntry.apiCall.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedEntry.apiCall.actualTokenUsage && (
                      <div style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <h4 style={{ color: '#3b82f6', fontSize: '0.9rem', fontWeight: '600', marginBottom: '12px' }}>
                          🔢 Token Usage Statistics
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#3b82f6', fontSize: '1.4rem', fontWeight: '700' }}>
                              {formatTokens(selectedEntry.apiCall.actualTokenUsage.input_tokens)}
                            </div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Input</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#10b981', fontSize: '1.4rem', fontWeight: '700' }}>
                              {formatTokens(selectedEntry.apiCall.actualTokenUsage.output_tokens)}
                            </div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Output</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#f59e0b', fontSize: '1.4rem', fontWeight: '700' }}>
                              {formatTokens(selectedEntry.apiCall.actualTokenUsage.total_tokens)}
                            </div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Total</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedEntry.apiCall.priorityEnhanced && (
                      <div style={{
                        background: 'rgba(220, 38, 38, 0.1)',
                        border: '1px solid rgba(220, 38, 38, 0.3)',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <h4 style={{ color: '#dc2626', fontSize: '0.9rem', fontWeight: '600', marginBottom: '12px' }}>
                          🔥 Priority Assembly Enhancement
                        </h4>
                        
                        <div style={{
                          background: 'rgba(0, 0, 0, 0.2)',
                          borderRadius: '8px',
                          padding: '12px',
                          marginBottom: '12px'
                        }}>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '6px' }}>
                            Priority Assembly Status
                          </div>
                          <div style={{ 
                            color: selectedEntry.apiCall.priorityEnhanced.hasPriorityAssembly ? '#10b981' : '#ef4444',
                            fontSize: '1rem',
                            fontWeight: '600'
                          }}>
                            {selectedEntry.apiCall.priorityEnhanced.hasPriorityAssembly ? '✅ Priority Assembly Applied' : '❌ Standard Assembly'}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <h5 style={{ color: '#dc2626', fontSize: '0.8rem', fontWeight: '600', marginBottom: '8px' }}>
                              Prompt Structure
                            </h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Current Instruction</span>
                                <span style={{ 
                                  color: selectedEntry.apiCall.priorityEnhanced.priorityPromptStructure.currentInstructionSection ? '#10b981' : '#ef4444',
                                  fontSize: '0.75rem'
                                }}>
                                  {selectedEntry.apiCall.priorityEnhanced.priorityPromptStructure.currentInstructionSection ? '✅' : '❌'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Supporting Context</span>
                                <span style={{ 
                                  color: selectedEntry.apiCall.priorityEnhanced.priorityPromptStructure.supportingContextSection ? '#10b981' : '#ef4444',
                                  fontSize: '0.75rem'
                                }}>
                                  {selectedEntry.apiCall.priorityEnhanced.priorityPromptStructure.supportingContextSection ? '✅' : '❌'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>System Context</span>
                                <span style={{ 
                                  color: selectedEntry.apiCall.priorityEnhanced.priorityPromptStructure.systemContextSection ? '#10b981' : '#ef4444',
                                  fontSize: '0.75rem'
                                }}>
                                  {selectedEntry.apiCall.priorityEnhanced.priorityPromptStructure.systemContextSection ? '✅' : '❌'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Focus Instructions</span>
                                <span style={{ 
                                  color: selectedEntry.apiCall.priorityEnhanced.priorityPromptStructure.focusInstructions ? '#10b981' : '#ef4444',
                                  fontSize: '0.75rem'
                                }}>
                                  {selectedEntry.apiCall.priorityEnhanced.priorityPromptStructure.focusInstructions ? '✅' : '❌'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {selectedEntry.apiCall.priorityEnhanced.assemblyMetadata && (
                            <div>
                              <h5 style={{ color: '#dc2626', fontSize: '0.8rem', fontWeight: '600', marginBottom: '8px' }}>
                                Assembly Metadata
                              </h5>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Total Tokens</span>
                                  <span style={{ color: '#ffffff', fontSize: '0.75rem', fontWeight: '600' }}>
                                    {formatTokens(selectedEntry.apiCall.priorityEnhanced.assemblyMetadata.totalTokens)}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Optimization</span>
                                  <span style={{ 
                                    color: selectedEntry.apiCall.priorityEnhanced.assemblyMetadata.optimizationApplied ? '#10b981' : '#6b7280',
                                    fontSize: '0.75rem'
                                  }}>
                                    {selectedEntry.apiCall.priorityEnhanced.assemblyMetadata.optimizationApplied ? '✅' : '⊝'}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Truncation</span>
                                  <span style={{ 
                                    color: selectedEntry.apiCall.priorityEnhanced.assemblyMetadata.truncationApplied ? '#f59e0b' : '#6b7280',
                                    fontSize: '0.75rem'
                                  }}>
                                    {selectedEntry.apiCall.priorityEnhanced.assemblyMetadata.truncationApplied ? '⚠️' : '✅'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 🔥 NEW: Analytics Tab Implementation */}
                {activeTab === 'analytics' && selectedEntry && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {selectedEntry.response?.responseAnalysis && (
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <h3 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '600', marginBottom: '12px' }}>
                          📈 Response Analysis
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                          <div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Content Length</div>
                            <div style={{ color: '#ffffff', fontSize: '1.2rem', fontWeight: '700' }}>
                              {selectedEntry.response.responseAnalysis.contentLength.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Files Generated</div>
                            <div style={{ color: '#ffffff', fontSize: '1.2rem', fontWeight: '700' }}>
                              {selectedEntry.response.responseAnalysis.fileCount}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Code Blocks</div>
                            <div style={{ color: '#ffffff', fontSize: '1.2rem', fontWeight: '700' }}>
                              {selectedEntry.response.responseAnalysis.codeBlockCount}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Response Type</div>
                            <div style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '600' }}>
                              {selectedEntry.response.responseAnalysis.responseType}
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Valid File Markers</span>
                            <span style={{ 
                              color: selectedEntry.response.responseAnalysis.hasValidFileMarkers ? '#10b981' : '#ef4444',
                              fontSize: '0.8rem',
                              fontWeight: '600'
                            }}>
                              {selectedEntry.response.responseAnalysis.hasValidFileMarkers ? '✅ Yes' : '❌ No'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Response Success</span>
                            <span style={{ 
                              color: selectedEntry.response.success ? '#10b981' : '#ef4444',
                              fontSize: '0.8rem',
                              fontWeight: '600'
                            }}>
                              {selectedEntry.response.success ? '✅ Success' : '❌ Failed'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedEntry.response?.responseAnalysis?.qualityMetrics && (
                      <div style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <h4 style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: '600', marginBottom: '12px' }}>
                          🎯 Quality Metrics
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ 
                              color: getEffectivenessColor(selectedEntry.response.responseAnalysis.qualityMetrics.completeness),
                              fontSize: '1.6rem',
                              fontWeight: '700',
                              marginBottom: '4px'
                            }}>
                              {formatPercentage(selectedEntry.response.responseAnalysis.qualityMetrics.completeness)}
                            </div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Completeness</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ 
                              color: getEffectivenessColor(selectedEntry.response.responseAnalysis.qualityMetrics.relevance),
                              fontSize: '1.6rem',
                              fontWeight: '700',
                              marginBottom: '4px'
                            }}>
                              {formatPercentage(selectedEntry.response.responseAnalysis.qualityMetrics.relevance)}
                            </div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Relevance</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ 
                              color: getEffectivenessColor(selectedEntry.response.responseAnalysis.qualityMetrics.accuracy),
                              fontSize: '1.6rem',
                              fontWeight: '700',
                              marginBottom: '4px'
                            }}>
                              {formatPercentage(selectedEntry.response.responseAnalysis.qualityMetrics.accuracy)}
                            </div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Accuracy</div>
                          </div>
                          {selectedEntry.response.responseAnalysis.qualityMetrics.priorityAlignment !== undefined && (
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ 
                                color: getEffectivenessColor(selectedEntry.response.responseAnalysis.qualityMetrics.priorityAlignment),
                                fontSize: '1.6rem',
                                fontWeight: '700',
                                marginBottom: '4px'
                              }}>
                                {formatPercentage(selectedEntry.response.responseAnalysis.qualityMetrics.priorityAlignment)}
                              </div>
                              <div style={{ color: '#dc2626', fontSize: '0.75rem' }}>🔥 Priority Alignment</div>
                            </div>
                          )}
                          {selectedEntry.response.responseAnalysis.qualityMetrics.contextUtilization !== undefined && (
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ 
                                color: getEffectivenessColor(selectedEntry.response.responseAnalysis.qualityMetrics.contextUtilization),
                                fontSize: '1.6rem',
                                fontWeight: '700',
                                marginBottom: '4px'
                              }}>
                                {formatPercentage(selectedEntry.response.responseAnalysis.qualityMetrics.contextUtilization)}
                              </div>
                              <div style={{ color: '#dc2626', fontSize: '0.75rem' }}>🔥 Context Usage</div>
                            </div>
                          )}
                          {selectedEntry.response.responseAnalysis.qualityMetrics.focusConsistency !== undefined && (
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ 
                                color: getEffectivenessColor(selectedEntry.response.responseAnalysis.qualityMetrics.focusConsistency),
                                fontSize: '1.6rem',
                                fontWeight: '700',
                                marginBottom: '4px'
                              }}>
                                {formatPercentage(selectedEntry.response.responseAnalysis.qualityMetrics.focusConsistency)}
                              </div>
                              <div style={{ color: '#dc2626', fontSize: '0.75rem' }}>🔥 Focus Consistency</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedEntry.systemState && (
                      <div style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <h4 style={{ color: '#3b82f6', fontSize: '0.9rem', fontWeight: '600', marginBottom: '12px' }}>
                          🖥️ System State Analysis
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                          <div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Active Tab</div>
                            <div style={{ color: '#3b82f6', fontSize: '0.9rem', fontWeight: '600' }}>
                              {selectedEntry.systemState.currentTab}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Selected Files</div>
                            <div style={{ color: '#3b82f6', fontSize: '0.9rem', fontWeight: '600' }}>
                              {selectedEntry.systemState.selectedFiles.length}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Message Count</div>
                            <div style={{ color: '#3b82f6', fontSize: '0.9rem', fontWeight: '600' }}>
                              {selectedEntry.systemState.messageCount}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Generation Active</div>
                            <div style={{ 
                              color: selectedEntry.systemState.generationActive ? '#10b981' : '#6b7280',
                              fontSize: '0.9rem', 
                              fontWeight: '600' 
                            }}>
                              {selectedEntry.systemState.generationActive ? '✅ Yes' : '⊝ No'}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Streaming Active</div>
                            <div style={{ 
                              color: selectedEntry.systemState.streamingActive ? '#10b981' : '#6b7280',
                              fontSize: '0.9rem', 
                              fontWeight: '600' 
                            }}>
                              {selectedEntry.systemState.streamingActive ? '✅ Yes' : '⊝ No'}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Sidebar Open</div>
                            <div style={{ 
                              color: selectedEntry.systemState.sidebarOpen ? '#10b981' : '#6b7280',
                              fontSize: '0.9rem', 
                              fontWeight: '600' 
                            }}>
                              {selectedEntry.systemState.sidebarOpen ? '✅ Yes' : '⊝ No'}
                            </div>
                          </div>
                        </div>

                        {selectedEntry.systemState.prioritySystemState && (
                          <div style={{ marginTop: '12px' }}>
                            <h5 style={{ color: '#dc2626', fontSize: '0.8rem', fontWeight: '600', marginBottom: '8px' }}>
                              🔥 Priority System State
                            </h5>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Current Instruction</span>
                                <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: '600' }}>
                                  {selectedEntry.systemState.prioritySystemState.currentInstructionId ? '✅ Set' : '❌ None'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Priority Assignments</span>
                                <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: '600' }}>
                                  {selectedEntry.systemState.prioritySystemState.totalPriorityAssignments}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Conversation Groups</span>
                                <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: '600' }}>
                                  {selectedEntry.systemState.prioritySystemState.activeConversationGroups}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Priority Ordering</span>
                                <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: '600' }}>
                                  {selectedEntry.systemState.prioritySystemState.priorityOrderingLength}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Response Tab */}
                {activeTab === 'response' && selectedEntry?.response && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '20px'
                    }}>
                      <div style={{
                        fontSize: '1.1rem',
                        fontWeight: '700',
                        color: '#ffffff',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        📥 AI Response
                      </div>
                      
                      {/* Response Status */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: '12px',
                        marginBottom: '20px'
                      }}>
                        <div style={{
                          background: selectedEntry.response.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          border: `1px solid ${selectedEntry.response.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          borderRadius: '8px',
                          padding: '12px'
                        }}>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>Status</div>
                          <div style={{
                            color: selectedEntry.response.success ? '#10b981' : '#ef4444',
                            fontSize: '0.9rem',
                            fontWeight: '600'
                          }}>
                            {selectedEntry.response.success ? '✅ Success' : '❌ Error'}
                          </div>
                        </div>
                        
                        <div style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          padding: '12px'
                        }}>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>Content Length</div>
                          <div style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: '600' }}>
                            {formatTokens(selectedEntry.response.responseAnalysis.contentLength)}
                          </div>
                        </div>
                        
                        <div style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          padding: '12px'
                        }}>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>Files Extracted</div>
                          <div style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: '600' }}>
                            {selectedEntry.response.responseAnalysis.fileCount}
                          </div>
                        </div>
                        
                        <div style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          padding: '12px'
                        }}>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>Response Type</div>
                          <div style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: '600' }}>
                            {selectedEntry.response.responseAnalysis.responseType}
                          </div>
                        </div>
                      </div>
                      
                      {/* Error Message */}
                      {selectedEntry.response.error && (
                        <div style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '8px',
                          padding: '12px',
                          marginBottom: '20px'
                        }}>
                          <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px' }}>
                            Error
                          </div>
                          <div style={{ color: '#fca5a5', fontSize: '0.8rem' }}>
                            {selectedEntry.response.error}
                          </div>
                        </div>
                      )}
                      
                      {/* Response Content (Abbreviated) */}
                      <div style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '16px'
                      }}>
                        <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '8px' }}>
                          Response Content {selectedEntry.response.responseAnalysis.contentLength > 5000 ? '(abbreviated)' : ''}
                        </div>
                        <pre style={{
                          color: '#e5e7eb',
                          fontSize: '0.8rem',
                          lineHeight: 1.6,
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: '400px',
                          overflow: 'auto',
                          fontFamily: 'Monaco, "Courier New", monospace'
                        }}>
                          {(() => {
                            const content = typeof selectedEntry.response.content === 'string' 
                              ? selectedEntry.response.content 
                              : JSON.stringify(selectedEntry.response.content, null, 2);
                            const MAX_DISPLAY_LENGTH = 10000;
                            if (content.length > MAX_DISPLAY_LENGTH) {
                              return content.substring(0, MAX_DISPLAY_LENGTH) + `\n\n... [${content.length - MAX_DISPLAY_LENGTH} more characters - see export for full content]`;
                            }
                            return content;
                          })()}
                        </pre>
                      </div>
                      
                      {/* Extracted Files */}
                      {selectedEntry.response.extractedFiles && Object.keys(selectedEntry.response.extractedFiles).length > 0 && (
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px' }}>
                            Extracted Files ({Object.keys(selectedEntry.response.extractedFiles).length})
                          </div>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            {Object.entries(selectedEntry.response.extractedFiles).slice(0, 10).map(([fileName, content]) => (
                              <div key={fileName} style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                padding: '12px'
                              }}>
                                <div style={{ color: '#3b82f6', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>
                                  {fileName}
                                </div>
                                <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                                  {typeof content === 'string' 
                                    ? `${content.length} characters${content.length > 500 ? ' (truncated in display)' : ''}`
                                    : 'Binary or object content'}
                                </div>
                              </div>
                            ))}
                            {Object.keys(selectedEntry.response.extractedFiles).length > 10 && (
                              <div style={{ color: '#9ca3af', fontSize: '0.75rem', fontStyle: 'italic', padding: '8px' }}>
                                ... and {Object.keys(selectedEntry.response.extractedFiles).length - 10} more files
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Quality Metrics */}
                      {selectedEntry.response.responseAnalysis.qualityMetrics && (
                        <div style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          padding: '16px'
                        }}>
                          <div style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: '600', marginBottom: '12px' }}>
                            Quality Metrics
                          </div>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                            gap: '12px'
                          }}>
                            {Object.entries(selectedEntry.response.responseAnalysis.qualityMetrics).map(([key, value]) => (
                              <div key={key} style={{
                                background: 'rgba(0, 0, 0, 0.2)',
                                borderRadius: '6px',
                                padding: '8px'
                              }}>
                                <div style={{ color: '#9ca3af', fontSize: '0.7rem', marginBottom: '4px' }}>
                                  {key.replace(/([A-Z])/g, ' $1').trim()}
                                </div>
                                <div style={{
                                  color: typeof value === 'number' && value >= 80 ? '#10b981' : 
                                         typeof value === 'number' && value >= 60 ? '#f59e0b' : '#ef4444',
                                  fontSize: '0.9rem',
                                  fontWeight: '600'
                                }}>
                                  {typeof value === 'number' ? formatPercentage(value) : String(value)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* JSON Targeted Mode Tab */}
                {activeTab === 'jsonTargeted' && selectedEntry?.jsonTargetedMode && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '20px'
                    }}>
                      <div style={{
                        fontSize: '1.1rem',
                        fontWeight: '700',
                        color: '#ffffff',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        📝 JSON Targeted Mode
                      </div>
                      
                      {/* Status Overview */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: '12px',
                        marginBottom: '20px'
                      }}>
                        <div style={{
                          background: selectedEntry.jsonTargetedMode.enabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                          border: `1px solid ${selectedEntry.jsonTargetedMode.enabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(107, 114, 128, 0.3)'}`,
                          borderRadius: '8px',
                          padding: '12px'
                        }}>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>Enabled</div>
                          <div style={{
                            color: selectedEntry.jsonTargetedMode.enabled ? '#10b981' : '#6b7280',
                            fontSize: '0.9rem',
                            fontWeight: '600'
                          }}>
                            {selectedEntry.jsonTargetedMode.enabled ? '✅ Yes' : '❌ No'}
                          </div>
                        </div>
                        
                        <div style={{
                          background: selectedEntry.jsonTargetedMode.parsingResults.complete ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          border: `1px solid ${selectedEntry.jsonTargetedMode.parsingResults.complete ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          borderRadius: '8px',
                          padding: '12px'
                        }}>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>JSON Complete</div>
                          <div style={{
                            color: selectedEntry.jsonTargetedMode.parsingResults.complete ? '#10b981' : '#ef4444',
                            fontSize: '0.9rem',
                            fontWeight: '600'
                          }}>
                            {selectedEntry.jsonTargetedMode.parsingResults.complete ? '✅ Yes' : '❌ No'}
                          </div>
                        </div>
                        
                        <div style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          padding: '12px'
                        }}>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>Edits Detected</div>
                          <div style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: '600' }}>
                            {selectedEntry.jsonTargetedMode.parsingResults.totalEditsDetected}
                          </div>
                        </div>
                        
                        <div style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          padding: '12px'
                        }}>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>Edits Converted</div>
                          <div style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: '600' }}>
                            {selectedEntry.jsonTargetedMode.parsingResults.totalEditsConverted}
                          </div>
                        </div>
                        
                        <div style={{
                          background: selectedEntry.jsonTargetedMode.parsingResults.fallbackToOldParser ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          border: `1px solid ${selectedEntry.jsonTargetedMode.parsingResults.fallbackToOldParser ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                          borderRadius: '8px',
                          padding: '12px'
                        }}>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>Fallback Used</div>
                          <div style={{
                            color: selectedEntry.jsonTargetedMode.parsingResults.fallbackToOldParser ? '#ef4444' : '#10b981',
                            fontSize: '0.9rem',
                            fontWeight: '600'
                          }}>
                            {selectedEntry.jsonTargetedMode.parsingResults.fallbackToOldParser ? '⚠️ Yes' : '✅ No'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Complete JSON Response */}
                      {selectedEntry.jsonTargetedMode.parsingResults.rawJsonResponse && (
                        <div style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          padding: '16px',
                          marginBottom: '16px'
                        }}>
                          <div style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px' }}>
                            Complete JSON Response
                          </div>
                          <pre style={{
                            color: '#e5e7eb',
                            fontSize: '0.75rem',
                            lineHeight: 1.6,
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            maxHeight: '500px',
                            overflow: 'auto',
                            fontFamily: 'Monaco, "Courier New", monospace',
                            background: 'rgba(0, 0, 0, 0.2)',
                            padding: '12px',
                            borderRadius: '6px'
                          }}>
                            {(() => {
                              try {
                                // Try to format JSON if valid
                                const parsed = JSON.parse(selectedEntry.jsonTargetedMode.parsingResults.rawJsonResponse);
                                return JSON.stringify(parsed, null, 2);
                              } catch {
                                // If not valid JSON, show as-is
                                return selectedEntry.jsonTargetedMode.parsingResults.rawJsonResponse;
                              }
                            })()}
                          </pre>
                        </div>
                      )}
                      
                      {/* Parsing Errors */}
                      {selectedEntry.jsonTargetedMode.parsingResults.parsingErrors && 
                       selectedEntry.jsonTargetedMode.parsingResults.parsingErrors.length > 0 && (
                        <div style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '8px',
                          padding: '16px',
                          marginBottom: '16px'
                        }}>
                          <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px' }}>
                            Parsing Errors ({selectedEntry.jsonTargetedMode.parsingResults.parsingErrors.length})
                            {selectedEntry.jsonTargetedMode.parsingResults.parsingErrors.length > 50 && (
                              <span style={{ color: '#9ca3af', fontSize: '0.75rem', marginLeft: '8px' }}>
                                (showing first 50, likely from progressive JSON parsing during streaming)
                              </span>
                            )}
                          </div>
                          <div style={{
                            maxHeight: '300px',
                            overflow: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}>
                            {selectedEntry.jsonTargetedMode.parsingResults.parsingErrors.slice(0, 50).map((error, idx) => (
                              <div key={idx} style={{
                                background: 'rgba(0, 0, 0, 0.2)',
                                borderRadius: '4px',
                                padding: '8px',
                                fontSize: '0.75rem',
                                color: '#fca5a5',
                                fontFamily: 'Monaco, "Courier New", monospace'
                              }}>
                                {error}
                              </div>
                            ))}
                            {selectedEntry.jsonTargetedMode.parsingResults.parsingErrors.length > 50 && (
                              <div style={{ color: '#9ca3af', fontSize: '0.75rem', fontStyle: 'italic', padding: '8px' }}>
                                ... and {selectedEntry.jsonTargetedMode.parsingResults.parsingErrors.length - 50} more errors
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Edit Operations */}
                      {selectedEntry.jsonTargetedMode.editOperations && 
                       selectedEntry.jsonTargetedMode.editOperations.length > 0 && (
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px' }}>
                            Edit Operations ({selectedEntry.jsonTargetedMode.editOperations.length})
                          </div>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            {selectedEntry.jsonTargetedMode.editOperations.map((op, idx) => (
                              <div key={idx} style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                padding: '12px'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                                  <div style={{ color: '#3b82f6', fontSize: '0.8rem', fontWeight: '600' }}>
                                    {op.filePath}
                                  </div>
                                  <div style={{
                                    background: op.status === 'complete' ? 'rgba(16, 185, 129, 0.2)' : 
                                               op.status === 'error' ? 'rgba(239, 68, 68, 0.2)' : 
                                               'rgba(107, 114, 128, 0.2)',
                                    color: op.status === 'complete' ? '#10b981' : 
                                           op.status === 'error' ? '#ef4444' : '#9ca3af',
                                    fontSize: '0.7rem',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontWeight: '600'
                                  }}>
                                    {op.status.toUpperCase()}
                                  </div>
                                </div>
                                <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '4px' }}>
                                  {op.description}
                                </div>
                                <div style={{ display: 'flex', gap: '16px', fontSize: '0.7rem', color: '#6b7280' }}>
                                  <span>Target: {op.targetName} ({op.targetType})</span>
                                  <span>Old: {op.oldCodeLength} chars</span>
                                  <span>New: {op.newCodeLength} chars</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Streaming Metrics */}
                      {selectedEntry.jsonTargetedMode.streamingMetrics && (
                        <div style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          padding: '16px'
                        }}>
                          <div style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: '600', marginBottom: '12px' }}>
                            Streaming Metrics
                          </div>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: '12px'
                          }}>
                            <div>
                              <div style={{ color: '#6b7280', fontSize: '0.7rem', marginBottom: '4px' }}>First Edit Detected</div>
                              <div style={{ color: '#ffffff', fontSize: '0.85rem' }}>
                                {selectedEntry.jsonTargetedMode.streamingMetrics.firstEditDetectedAt 
                                  ? new Date(selectedEntry.jsonTargetedMode.streamingMetrics.firstEditDetectedAt).toLocaleTimeString()
                                  : 'N/A'}
                              </div>
                            </div>
                            <div>
                              <div style={{ color: '#6b7280', fontSize: '0.7rem', marginBottom: '4px' }}>JSON Complete</div>
                              <div style={{ color: '#ffffff', fontSize: '0.85rem' }}>
                                {selectedEntry.jsonTargetedMode.streamingMetrics.jsonCompleteAt 
                                  ? new Date(selectedEntry.jsonTargetedMode.streamingMetrics.jsonCompleteAt).toLocaleTimeString()
                                  : 'N/A'}
                              </div>
                            </div>
                            <div>
                              <div style={{ color: '#6b7280', fontSize: '0.7rem', marginBottom: '4px' }}>Total Streaming Time</div>
                              <div style={{ color: '#ffffff', fontSize: '0.85rem' }}>
                                {formatDuration(selectedEntry.jsonTargetedMode.streamingMetrics.totalStreamingTime)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Show message for tabs without selected entry */}
                {(activeTab === 'details' || activeTab === 'messages' || activeTab === 'context' || activeTab === 'metadata' || activeTab === 'priority' || activeTab === 'assembly' || activeTab === 'analytics' || activeTab === 'response' || activeTab === 'jsonTargeted') && !selectedEntry && (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: '#9ca3af'
                  }}>
                    <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📋</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '8px' }}>
                      Select an Entry
                    </div>
                    <div style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                      Click on an entry in the "Entries" tab to view detailed information here.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes debugModalSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export const ClassificationDebugModal: React.FC<ClassificationDebugModalProps> = (props) => {
  if (!props.isOpen) {
    return null;
  }

  const getPortalContainer = () => {
    let container = document.getElementById('classification-debug-modal-root');
    if (!container) {
      container = document.createElement('div');
      container.id = 'classification-debug-modal-root';
      container.style.position = 'relative';
      container.style.zIndex = '999999';
      document.body.appendChild(container);
    }
    return container;
  };

  return ReactDOM.createPortal(
    <ClassificationDebugModalContent {...props} />,
    getPortalContainer()
  );
};