import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/appStore';
import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory as agentIdlFactory } from '../../../candid/agent.did.js';
import type { _SERVICE as AgentService, AgentIdentity } from '../../../candid/agent.did.d.ts';
import type { AgentTemplate } from './types';
import { generateId } from './utils';

interface DeployedAgent {
  id: string;
  name: string;
  backendCanisterId: string;
  status: 'deploying' | 'active' | 'error';
  // MCP info if available
  mcpServers?: string[];
  mcpToolsCount?: number;
}

interface AgentPaletteProps {
  onDragStart: (event: React.DragEvent, agentTemplate: AgentTemplate) => void;
  className?: string;
  isHorizontal?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  deployedAgents?: Array<{ canisterId: string; name: string }>; // From parent component
}

export const AgentPalette: React.FC<AgentPaletteProps> = ({
  onDragStart,
  className = '',
  isHorizontal = false,
  isCollapsed = false,
  onToggleCollapse,
  deployedAgents = []
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [deployedAgentsData, setDeployedAgentsData] = useState<DeployedAgent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const activeProject = useAppStore(state => state.activeProject);
  const identity = useAppStore(state => state.identity);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Helper function to get agent identity from canister
  const getAgentIdentity = async (canisterId: string): Promise<AgentIdentity | null> => {
    if (!identity) return null;
    
    try {
      const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://127.0.0.1:4943'
        : 'https://icp0.io';
      
      const agent = new HttpAgent({ identity, host });
      
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        await agent.fetchRootKey();
      }
      
      const actor = Actor.createActor<AgentService>(agentIdlFactory, {
        agent,
        canisterId,
      });
      
      const identityResult = await actor.getAgentIdentity();
      
      // Convert optional result
      if (Array.isArray(identityResult) && identityResult.length > 0) {
        const agentIdentity = identityResult[0];
        // Return the identity with converted values (but keep owner as Principal for type compatibility)
        return agentIdentity as AgentIdentity;
      }
      
      return null;
    } catch (error: any) {
      // Silently skip if this is a "method not found" error - it's likely an agency workflow canister, not an agent canister
      const errorMessage = error?.message || String(error);
      const isMethodNotFound = errorMessage.includes('no query method') || 
                               errorMessage.includes('method not found') ||
                               errorMessage.includes('getAgentIdentity');
      
      if (!isMethodNotFound) {
        // Only log non-method-not-found errors (actual agent canister errors)
        console.warn(`Failed to get agent identity for ${canisterId}:`, error);
      }
      // Silently return null for method-not-found errors (agency workflow canisters)
      return null;
    }
  };

  // Load deployed agents and query canisters for real MCP data
  useEffect(() => {
    if (!activeProject || !identity) return;

    const loadAgents = async () => {
      setIsLoadingAgents(true);
      try {
        // Get basic agent info from localStorage (just for the list)
        const stored = localStorage.getItem(`deployed-agents-${activeProject}`);
        if (!stored) {
          setIsLoadingAgents(false);
          return;
        }

        const agents = JSON.parse(stored);
        const activeAgents = agents.filter((a: any) => a.status === 'active');
        
        // Query each agent canister for real identity data (including MCP config)
        // CRITICAL: Filter out any canisters that are agency workflow canisters (they won't have getAgentIdentity)
        const agentsWithData = await Promise.all(
          activeAgents.map(async (agent: any) => {
            try {
              // Skip if this looks like it might not be an agent canister
              // (getAgentIdentity will handle the validation, but we can add basic checks here)
              const agentIdentity = await getAgentIdentity(agent.backendCanisterId);
              
              // CRITICAL: If getAgentIdentity returned null (method not found), this is an agency workflow canister
              // DO NOT include it in the agent list - return null to filter it out
              if (!agentIdentity) {
                console.warn(`⚠️ [AgentPalette] Skipping canister ${agent.backendCanisterId} - no getAgentIdentity method (likely agency workflow canister)`);
                return null;
              }
              
              return {
                id: agent.id,
                name: agent.name,
                backendCanisterId: agent.backendCanisterId,
                status: agent.status,
                mcpServers: (agentIdentity && agentIdentity.defaultMcpServers) ? agentIdentity.defaultMcpServers : [],
                mcpToolsCount: (agentIdentity && agentIdentity.defaultMcpServers) ? agentIdentity.defaultMcpServers.length : 0
              };
            } catch (error: any) {
              // Only log if it's not a method-not-found error (already handled in getAgentIdentity)
              const errorMessage = error?.message || String(error);
              const isMethodNotFound = errorMessage.includes('no query method') || 
                                       errorMessage.includes('method not found');
              
              if (isMethodNotFound) {
                // This is an agency workflow canister - filter it out
                console.warn(`⚠️ [AgentPalette] Skipping canister ${agent.backendCanisterId} - method not found (likely agency workflow canister)`);
                return null;
              }
              
              // For other errors, log but still include the agent (might be a temporary issue)
              console.warn(`Failed to load identity for agent ${agent.id}:`, error);
              
              return {
                id: agent.id,
                name: agent.name,
                backendCanisterId: agent.backendCanisterId,
                status: agent.status,
                mcpServers: [],
                mcpToolsCount: 0
              };
            }
          })
        );
        
        // Filter out null values (agency workflow canisters)
        const validAgents = agentsWithData.filter((agent): agent is NonNullable<typeof agent> => agent !== null);
        
        console.log(`✅ [AgentPalette] Loaded ${validAgents.length} valid agents (filtered out ${agentsWithData.length - validAgents.length} agency workflow canisters)`);
        
        setDeployedAgentsData(validAgents);
      } catch (error) {
        console.warn('Failed to load deployed agents for palette:', error);
      } finally {
        setIsLoadingAgents(false);
      }
    };

    loadAgents();
  }, [activeProject, identity, deployedAgents]);

  // Convert deployed agents to AgentTemplate format
  const deployedAgentTemplates: AgentTemplate[] = deployedAgentsData.map(agent => ({
    id: `deployed-${agent.id}`,
    name: agent.name,
    description: agent.mcpServers && agent.mcpServers.length > 0
      ? `MCP Tools: ${agent.mcpServers.join(', ')}`
      : 'Deployed agent (configure MCP tools in agent settings)',
    category: 'ai-assistant' as const,
    canisterId: agent.backendCanisterId,
    icon: '🧠',
    color: 'var(--accent-green)',
    defaultConfig: {
      inputTemplate: 'Process: {input}',
      requiresApproval: false,
      retryOnFailure: true,
      timeout: 60,
    },
    configSchema: []
  }));

  // Predefined agent templates
  const agentTemplates: AgentTemplate[] = [
    {
      id: 'ai-assistant',
      name: 'AI Assistant',
      description: 'General purpose AI assistant for various tasks',
      category: 'ai-assistant',
      icon: '🤖',
      color: 'var(--accent-orange)',
      defaultConfig: {
        inputTemplate: 'Process this request: {input}',
        requiresApproval: false,
        retryOnFailure: true,
        timeout: 60,
      },
      configSchema: [
        { key: 'model', label: 'AI Model', type: 'select', required: true, options: ['claude-3', 'gpt-4', 'gemini-pro'] },
        { key: 'temperature', label: 'Temperature', type: 'number', required: false, placeholder: '0.7' },
        { key: 'maxTokens', label: 'Max Tokens', type: 'number', required: false, placeholder: '4000' },
      ]
    },
    {
      id: 'data-validator',
      name: 'Data Validator',
      description: 'Validates data structure and content',
      category: 'validator',
      icon: '✅',
      color: 'var(--accent-green)',
      defaultConfig: {
        inputTemplate: 'Validate this data: {input}',
        requiresApproval: false,
        retryOnFailure: true,
        timeout: 30,
      },
      configSchema: [
        { key: 'schema', label: 'Validation Schema', type: 'textarea', required: true, placeholder: 'JSON Schema or validation rules' },
        { key: 'strict', label: 'Strict Mode', type: 'boolean', required: false },
      ]
    },
    {
      id: 'email-notifier',
      name: 'Email Notifier',
      description: 'Sends email notifications',
      category: 'notifier',
      icon: '📧',
      color: '#f59e0b',
      defaultConfig: {
        inputTemplate: 'Send email notification: {input}',
        requiresApproval: true,
        retryOnFailure: true,
        timeout: 45,
      },
      configSchema: [
        { key: 'smtpServer', label: 'SMTP Server', type: 'text', required: true, placeholder: 'smtp.gmail.com' },
        { key: 'fromEmail', label: 'From Email', type: 'text', required: true, placeholder: 'noreply@company.com' },
        { key: 'template', label: 'Email Template', type: 'textarea', required: false, placeholder: 'HTML email template' },
      ]
    },
    {
      id: 'data-processor',
      name: 'Data Processor',
      description: 'Processes and transforms data',
      category: 'data-processor',
      icon: '📊',
      color: '#8b5cf6',
      defaultConfig: {
        inputTemplate: 'Process this data: {input}',
        requiresApproval: false,
        retryOnFailure: true,
        timeout: 120,
      },
      configSchema: [
        { key: 'transformation', label: 'Transformation Rules', type: 'textarea', required: true, placeholder: 'Data transformation logic' },
        { key: 'outputFormat', label: 'Output Format', type: 'select', required: true, options: ['JSON', 'CSV', 'XML'] },
      ]
    },
    {
      id: 'api-integrator',
      name: 'API Integrator',
      description: 'Integrates with external APIs',
      category: 'integration',
      icon: '🔗',
      color: '#06b6d4',
      defaultConfig: {
        inputTemplate: 'Make API call with: {input}',
        requiresApproval: false,
        retryOnFailure: true,
        timeout: 90,
      },
      configSchema: [
        { key: 'apiUrl', label: 'API URL', type: 'text', required: true, placeholder: 'https://api.example.com/endpoint' },
        { key: 'method', label: 'HTTP Method', type: 'select', required: true, options: ['GET', 'POST', 'PUT', 'DELETE'] },
        { key: 'headers', label: 'Headers', type: 'textarea', required: false, placeholder: 'JSON headers object' },
        { key: 'authToken', label: 'Auth Token', type: 'text', required: false, placeholder: 'Bearer token' },
      ]
    },
    {
      id: 'content-moderator',
      name: 'Content Moderator',
      description: 'Moderates and filters content',
      category: 'ai-assistant',
      icon: '🛡️',
      color: '#ef4444',
      defaultConfig: {
        inputTemplate: 'Moderate this content: {input}',
        requiresApproval: true,
        retryOnFailure: false,
        timeout: 60,
      },
      configSchema: [
        { key: 'sensitivity', label: 'Sensitivity Level', type: 'select', required: true, options: ['low', 'medium', 'high'] },
        { key: 'categories', label: 'Moderation Categories', type: 'textarea', required: false, placeholder: 'Comma-separated categories to check' },
      ]
    },
    {
      id: 'report-generator',
      name: 'Report Generator',
      description: 'Generates reports and analytics',
      category: 'data-processor',
      icon: '📈',
      color: '#84cc16',
      defaultConfig: {
        inputTemplate: 'Generate report for: {input}',
        requiresApproval: true,
        retryOnFailure: true,
        timeout: 180,
      },
      configSchema: [
        { key: 'reportType', label: 'Report Type', type: 'select', required: true, options: ['summary', 'detailed', 'analytics'] },
        { key: 'format', label: 'Output Format', type: 'select', required: true, options: ['PDF', 'Excel', 'HTML'] },
        { key: 'template', label: 'Report Template', type: 'text', required: false, placeholder: 'Template ID or path' },
      ]
    },
    {
      id: 'workflow-orchestrator',
      name: 'Workflow Orchestrator',
      description: 'Orchestrates complex workflows',
      category: 'integration',
      icon: '🎭',
      color: '#d946ef',
      defaultConfig: {
        inputTemplate: 'Orchestrate workflow: {input}',
        requiresApproval: false,
        retryOnFailure: true,
        timeout: 300,
      },
      configSchema: [
        { key: 'workflow', label: 'Workflow Definition', type: 'textarea', required: true, placeholder: 'Workflow steps and conditions' },
        { key: 'parallelism', label: 'Max Parallel Tasks', type: 'number', required: false, placeholder: '5' },
      ]
    }
  ];

  const categories = [
    { id: 'all', name: 'All', icon: '📋' },
    { id: 'ai-assistant', name: 'AI Assistant', icon: '🤖' },
    { id: 'data-processor', name: 'Data Processor', icon: '📊' },
    { id: 'integration', name: 'Integration', icon: '🔗' },
    { id: 'validator', name: 'Validator', icon: '✅' },
    { id: 'notifier', name: 'Notifier', icon: '📧' }
  ];

  // Only show real deployed agents - no generic templates
  const allAgents = deployedAgentTemplates;
  
  const filteredAgents = allAgents.filter(agent => {
    const matchesCategory = selectedCategory === 'all' || agent.category === selectedCategory;
    const matchesSearch = !searchTerm || 
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

  // Scroll to top when agents are loaded or filtered - ensure card is visible at top on initial load
  // Use double requestAnimationFrame for reliable timing after layout
  useEffect(() => {
    if (scrollContainerRef.current && filteredAgents.length > 0 && !isLoadingAgents) {
      // Double RAF ensures layout is complete
      const frameId1 = requestAnimationFrame(() => {
        const frameId2 = requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
          }
        });
        return () => cancelAnimationFrame(frameId2);
      });
      return () => cancelAnimationFrame(frameId1);
    }
  }, [filteredAgents.length, isLoadingAgents]);
  
  // Also ensure scroll is at top on initial mount and after agents finish loading
  useEffect(() => {
    if (scrollContainerRef.current && !isLoadingAgents) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isLoadingAgents]); // Run when loading completes

  // Horizontal layout for space optimization
  if (isHorizontal) {
    return (
      <div className={`border flex flex-col ${className}`} style={{
        background: 'var(--secondary-black)',
        borderColor: 'var(--border-color)',
        overflow: 'hidden',
        height: '100%',
        minHeight: 0
      }}>
        {/* Collapsible Header - Ultra Compact */}
        <div className="flex items-center justify-between px-2 py-0.5 border-b flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-1.5">
            <h3 className="text-[10px] font-semibold text-white">Agent Palette</h3>
            <span className="text-[10px] text-gray-400">({filteredAgents.length})</span>
          </div>
          <button
            onClick={onToggleCollapse}
            className="text-gray-400 hover:text-white p-0.5 rounded transition-colors duration-200"
          >
            <svg className={`w-2.5 h-2.5 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {!isCollapsed && (
          <>
            {/* Horizontal Controls - Ultra Compact */}
            <div className="px-2 py-0.5 border-b flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex gap-1.5 items-center">
                {/* Compact Search */}
                <div className="flex-1 max-w-[200px]">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search..."
                    className="w-full px-1.5 py-1 border rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs"
                    style={{
                      background: 'var(--tertiary-black)',
                      borderColor: 'var(--border-color)',
                      height: '28px' // Reduced height to match smaller buttons
                    }}
                  />
                </div>

                {/* Horizontal Categories - Compact */}
                <div className="flex gap-1 overflow-x-auto">
                  {categories.map(category => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className="px-2 py-1 rounded text-xs font-medium transition-all duration-200 flex items-center gap-1 whitespace-nowrap"
                      style={{
                        background: selectedCategory === category.id
                          ? 'linear-gradient(135deg, var(--accent-orange), var(--accent-orange-light))'
                          : 'rgba(255, 255, 255, 0.05)',
                        color: selectedCategory === category.id ? 'white' : 'var(--text-gray)',
                        border: selectedCategory === category.id 
                          ? '1px solid var(--accent-orange)' 
                          : '1px solid var(--border-color)'
                      }}
                    >
                      <span className="text-xs">{category.icon}</span>
                      <span className="text-xs">{category.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Agent Grid - Responsive to height with proper padding */}
            <div 
              ref={scrollContainerRef}
              className="overflow-y-auto" 
              style={{ 
                flex: '1 1 0%',
                minHeight: '0', // Let it shrink naturally
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div 
                className="grid gap-2 px-4"
                style={{
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', // Wider columns for rectangular cards
                  gridAutoRows: 'min-content', // Allow rows to expand to fit content
                  alignItems: 'start',
                  width: '100%',
                  paddingTop: '0.25rem', // Minimal top padding - just enough for visual clearance
                  paddingBottom: '0.25rem' // Minimal bottom padding - just enough for visual clearance
                }}
              >
                {filteredAgents.map(agent => {
                  const isDeployed = agent.id.startsWith('deployed-');
                  const deployedAgent = isDeployed ? deployedAgentsData.find(a => `deployed-${a.id}` === agent.id) : null;
                  
                  return <div
                      key={agent.id}
                      draggable
                      onDragStart={(event) => onDragStart(event, agent)}
                      className="border rounded cursor-move transition-all duration-200 group"
                      style={{
                        background: isDeployed 
                          ? 'rgba(16, 185, 129, 0.1)' 
                          : 'rgba(255, 255, 255, 0.05)',
                        borderColor: isDeployed 
                          ? 'rgba(16, 185, 129, 0.3)' 
                          : 'var(--border-color)',
                        minWidth: '140px', // Wider for rectangular shape
                        maxWidth: '180px', // Constrain max width
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '0.5rem 0.5rem', // Adequate padding for all content
                        overflow: 'hidden' // Keep content contained within card bounds
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = isDeployed ? 'var(--accent-green)' : 'var(--accent-orange)';
                        e.currentTarget.style.background = isDeployed 
                          ? 'rgba(16, 185, 129, 0.2)' 
                          : 'rgba(255, 107, 53, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isDeployed 
                          ? 'rgba(16, 185, 129, 0.3)' 
                          : 'var(--border-color)';
                        e.currentTarget.style.background = isDeployed 
                          ? 'rgba(16, 185, 129, 0.1)' 
                          : 'rgba(255, 255, 255, 0.05)';
                      }}
                    >
                    <div className="flex flex-col gap-0.5 w-full">
                      <div className="flex items-center gap-1">
                        <div 
                          className="w-4 h-4 rounded flex items-center justify-center text-[10px] flex-shrink-0"
                          style={{ 
                            backgroundColor: agent.color + '20', 
                            border: `1px solid ${agent.color}50` 
                          }}
                        >
                        {agent.icon}
                        </div>
                        <h4 className="text-white font-medium text-[10px] group-hover:text-orange-400 transition-colors truncate flex-1">
                          {agent.name}
                          {isDeployed && (
                            <span className="ml-0.5 text-[8px] text-green-400">●</span>
                          )}
                        </h4>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-400 text-[9px] truncate leading-tight" style={{ lineHeight: '1.2', marginBottom: '0.25rem' }}>
                          {agent.description}
                        </p>
                        
                        {/* MCP Tools for deployed agents */}
                        {isDeployed && deployedAgent && deployedAgent.mcpServers && deployedAgent.mcpServers.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {deployedAgent.mcpServers.slice(0, 2).map((server, idx) => (
                              <span
                                key={idx}
                                className="text-[9px] px-1 py-0.5 rounded"
                                style={{
                                  background: 'rgba(16, 185, 129, 0.2)',
                                  color: '#10B981',
                                  border: '1px solid rgba(16, 185, 129, 0.3)'
                                }}
                                title={server}
                              >
                                {server.length > 8 ? server.slice(0, 8) + '...' : server}
                              </span>
                            ))}
                            {deployedAgent.mcpServers.length > 2 && (
                              <span className="text-[9px] text-gray-400">
                                +{deployedAgent.mcpServers.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Config indicators - Ultra Compact */}
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {agent.defaultConfig.requiresApproval && (
                            <span className="w-2.5 h-2.5 bg-opacity-50 rounded border flex items-center justify-center text-[8px]" 
                                  style={{
                                    backgroundColor: 'rgba(255, 107, 53, 0.2)',
                                    color: 'var(--accent-orange)',
                                    borderColor: 'var(--accent-orange)'
                                  }} 
                                  title="Requires approval">
                              👤
                            </span>
                          )}
                          {agent.defaultConfig.retryOnFailure && (
                            <span className="w-2.5 h-2.5 bg-opacity-50 rounded border flex items-center justify-center text-[8px]" 
                                  style={{
                                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                    color: 'var(--accent-green)',
                                    borderColor: 'var(--accent-green)'
                                  }}
                                  title="Auto-retry enabled">
                              🔄
                            </span>
                          )}
                          <span className="text-[9px] text-gray-500">
                            {agent.defaultConfig.timeout}s
                          </span>
                        </div>
                      </div>

                      {/* Drag Indicator - Minimal */}
                      <div className="text-gray-600 group-hover:text-gray-400 transition-colors self-end">
                        <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                      </div>
                      </div>
                    </div>
                })}
              </div>

              {filteredAgents.length === 0 && !isLoadingAgents && (
                <div className="text-center py-2">
                  <p className="text-gray-400 text-xs">
                    {searchTerm ? 'No agents match your search' : 'No agents in this category'}
                  </p>
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="mt-1 text-orange-400 hover:text-orange-300 text-[10px] underline"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // Original vertical layout for backwards compatibility
  return (
    <div className={`border rounded-lg flex flex-col ${className}`} style={{
      background: 'var(--secondary-black)',
      borderColor: 'var(--border-color)'
    }}>
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Agent Palette</h3>
          <button
            onClick={onToggleCollapse}
            className="text-gray-400 hover:text-white p-1 rounded transition-colors duration-200"
          >
            <svg className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        
        {!isCollapsed && (
          <>
            {/* Search */}
            <div className="mt-3">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search agents..."
                className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                style={{
                  background: 'var(--tertiary-black)',
                  borderColor: 'var(--border-color)'
                }}
              />
            </div>

            {/* Categories */}
            <div className="mt-3">
              <div className="flex flex-wrap gap-1">
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className="px-2 py-1 rounded text-xs font-medium transition-all duration-200 flex items-center gap-1"
                    style={{
                      background: selectedCategory === category.id
                        ? 'linear-gradient(135deg, var(--accent-orange), var(--accent-orange-light))'
                        : 'rgba(255, 255, 255, 0.05)',
                      color: selectedCategory === category.id ? 'white' : 'var(--text-gray)',
                      border: selectedCategory === category.id 
                        ? '1px solid var(--accent-orange)' 
                        : '1px solid var(--border-color)'
                    }}
                  >
                    <span className="text-xs">{category.icon}</span>
                    <span className="hidden sm:inline">{category.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Agent List */}
      {!isCollapsed && (
        <div className="flex-1 p-2 overflow-y-auto">
          <div className="space-y-2">
            {filteredAgents.map(agent => (
              <div
                key={agent.id}
                draggable
                onDragStart={(event) => onDragStart(event, agent)}
                className="border rounded-lg p-3 cursor-move transition-all duration-200 group"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'var(--border-color)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-orange)';
                  e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
              >
                <div className="flex items-start gap-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                    style={{ 
                      backgroundColor: agent.color + '20', 
                      border: `1px solid ${agent.color}50` 
                    }}
                  >
                    {agent.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium text-sm group-hover:text-orange-400 transition-colors truncate">
                      {agent.name}
                    </h4>
                    <p className="text-gray-400 text-xs mt-1 line-clamp-2">
                      {agent.description}
                    </p>
                    
                    {/* Configuration Preview */}
                    <div className="flex items-center gap-2 mt-2">
                      {agent.defaultConfig.requiresApproval && (
                        <span className="px-1.5 py-0.5 rounded border text-xs" 
                              style={{
                                backgroundColor: 'rgba(255, 107, 53, 0.2)',
                                color: 'var(--accent-orange)',
                                borderColor: 'var(--accent-orange)'
                              }}
                              title="Requires approval">
                          👤
                        </span>
                      )}
                      {agent.defaultConfig.retryOnFailure && (
                        <span className="px-1.5 py-0.5 rounded border text-xs" 
                              style={{
                                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                color: 'var(--accent-green)',
                                borderColor: 'var(--accent-green)'
                              }}
                              title="Auto-retry enabled">
                          🔄
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 bg-gray-700 text-gray-300 text-xs rounded" title={`Timeout: ${agent.defaultConfig.timeout}s`}>
                        ⏱️ {agent.defaultConfig.timeout}s
                      </span>
                    </div>
                  </div>
                </div>

                {/* Drag Indicator */}
                <div className="absolute top-2 right-2 text-gray-600 group-hover:text-gray-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
              </div>
            ))}
          </div>

          {filteredAgents.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-2">
                <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm">
                {searchTerm ? 'No agents match your search' : 'No agents in this category'}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-2 text-orange-400 hover:text-orange-300 text-sm underline"
                >
                  Clear search
                </button>
              )}
            </div>
          )}

          {/* Drag Instructions */}
          <div className="mt-4 p-3 border rounded-lg" style={{
            background: 'var(--kontext-glass-bg-medium)',
            borderColor: 'var(--border-color)'
          }}>
            <p className="text-gray-400 text-xs text-center">
              💡 Drag agents onto the canvas to build your workflow
            </p>
          </div>
        </div>
      )}
    </div>
  );
};