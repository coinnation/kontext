import React, { useState, useEffect, useRef } from 'react';
import { Principal } from '@dfinity/principal';
import type { WorkflowNode, AgentTemplate } from './types';

interface NodeConfigPanelProps {
  node: WorkflowNode | null;
  onUpdateNode: (nodeId: string, updates: Partial<WorkflowNode['data']>) => void;
  onClose: () => void;
  availableAgents?: string[] | Array<{ canisterId: string; name: string }>; // Available agents (canister IDs or objects with name)
  className?: string;
}

export const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({
  node,
  onUpdateNode,
  onClose,
  availableAgents = [],
  className = ''
}) => {
  const [formData, setFormData] = useState({
    agentName: '',
    agentCanisterId: '',
    inputTemplate: '',
    requiresApproval: false,
    retryOnFailure: true,
    timeout: 60,
    description: '',
    // NEW: Loop and nested workflow support
    stepTargetType: 'agent' as 'agent' | 'agency',
    nestedWorkflowId: '',
    nestedWorkflowInputMapping: '',
    loopType: 'none' as 'none' | 'for_each' | 'while_loop' | 'repeat',
    forEachArraySource: '',
    forEachItemVariable: 'item',
    forEachIndexVariable: 'index',
    forEachMaxIterations: 1000,
    whileLoopCondition: '',
    whileLoopMaxIterations: 100,
    repeatCount: 1,
    repeatIndexVariable: 'iteration',
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  
  // Autocomplete state for Input Template
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  
  // Valid template variables - Enhanced with all available variables
  const templateVariables = [
    { value: 'input', description: 'Main input to the workflow' },
    { value: 'previous_output', description: 'Output from previous step in sequence' },
    { value: 'workflow_input', description: 'Original workflow input' },
    { value: 'step_1_output', description: 'Output from step 1 (index 0)' },
    { value: 'step_2_output', description: 'Output from step 2 (index 1)' },
    { value: 'step_3_output', description: 'Output from step 3 (index 2)' },
    { value: 'step_4_output', description: 'Output from step 4 (index 3)' },
    { value: 'step_5_output', description: 'Output from step 5 (index 4)' },
    { value: 'step_6_output', description: 'Output from step 6 (index 5)' },
    { value: 'step_7_output', description: 'Output from step 7 (index 6)' },
    { value: 'step_8_output', description: 'Output from step 8 (index 7)' },
    { value: 'step_9_output', description: 'Output from step 9 (index 8)' },
    { value: 'step_10_output', description: 'Output from step 10 (index 9)' },
  ];

  // Handle input template change with autocomplete detection
  const handleInputTemplateChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setCursorPosition(cursorPos);
    setFormData(prev => ({ ...prev, inputTemplate: value }));

    // Check if user just typed "{"
    const charBeforeCursor = value[cursorPos - 1];
    if (charBeforeCursor === '{') {
      // Show autocomplete dropdown
      if (textareaRef.current) {
        const rect = textareaRef.current.getBoundingClientRect();
        setAutocompletePosition({
          top: rect.top + rect.height,
          left: rect.left
        });
      }
      setShowAutocomplete(true);
      setSelectedAutocompleteIndex(0);
    } else {
      // Hide autocomplete if user types something else or closes the brace
      setShowAutocomplete(false);
    }
  };

  // Handle keyboard navigation in autocomplete
  const handleAutocompleteKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showAutocomplete) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedAutocompleteIndex(prev => 
        prev < templateVariables.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedAutocompleteIndex(prev => 
        prev > 0 ? prev - 1 : templateVariables.length - 1
      );
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertTemplateVariable(templateVariables[selectedAutocompleteIndex].value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowAutocomplete(false);
    }
  };

  // Insert template variable at cursor position
  const insertTemplateVariable = (variable: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const currentValue = formData.inputTemplate;
    const beforeCursor = currentValue.substring(0, cursorPosition);
    const afterCursor = currentValue.substring(cursorPosition);
    
    // Find the opening brace before cursor
    const lastBraceIndex = beforeCursor.lastIndexOf('{');
    if (lastBraceIndex !== -1) {
      // Replace from { to cursor with {variable}
      const newValue = 
        currentValue.substring(0, lastBraceIndex) + 
        `{${variable}}` + 
        afterCursor;
      
      setFormData(prev => ({ ...prev, inputTemplate: newValue }));
      
      // Set cursor position after the inserted variable
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = lastBraceIndex + variable.length + 2; // +2 for { and }
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          textareaRef.current.focus();
        }
      }, 0);
    }
    
    setShowAutocomplete(false);
  };

  // Update form when node changes
  useEffect(() => {
    if (node) {
      // Determine step target type
      let stepTargetType: 'agent' | 'agency' = 'agent';
      let nestedWorkflowId = '';
      let nestedWorkflowInputMapping = '';
      
      if (node.data.stepTarget) {
        if ('agency' in node.data.stepTarget) {
          stepTargetType = 'agency';
          nestedWorkflowId = node.data.stepTarget.agency.agencyId;
          nestedWorkflowInputMapping = node.data.stepTarget.agency.inputMapping;
        }
      }
      
      // Determine loop type and extract config
      let loopType: 'none' | 'for_each' | 'while_loop' | 'repeat' = 'none';
      let forEachArraySource = '';
      let forEachItemVariable = 'item';
      let forEachIndexVariable = 'index';
      let forEachMaxIterations = 1000;
      let whileLoopCondition = '';
      let whileLoopMaxIterations = 100;
      let repeatCount = 1;
      let repeatIndexVariable = 'iteration';
      
      if (node.data.loopConfig) {
        if ('forEach' in node.data.loopConfig) {
          loopType = 'for_each';
          forEachArraySource = node.data.loopConfig.forEach.arraySource;
          forEachItemVariable = node.data.loopConfig.forEach.itemVariable;
          forEachIndexVariable = node.data.loopConfig.forEach.indexVariable;
          forEachMaxIterations = node.data.loopConfig.forEach.maxIterations || 1000;
        } else if ('whileLoop' in node.data.loopConfig) {
          loopType = 'while_loop';
          whileLoopCondition = node.data.loopConfig.whileLoop.condition;
          whileLoopMaxIterations = node.data.loopConfig.whileLoop.maxIterations || 100;
        } else if ('repeat' in node.data.loopConfig) {
          loopType = 'repeat';
          repeatCount = node.data.loopConfig.repeat.count;
          repeatIndexVariable = node.data.loopConfig.repeat.indexVariable || 'iteration';
        }
      }
      
      setFormData({
        agentName: node.data.agentName || '',
        agentCanisterId: node.data.agentCanisterId || '',
        inputTemplate: node.data.inputTemplate || '{input}',
        requiresApproval: node.data.requiresApproval || false,
        retryOnFailure: node.data.retryOnFailure !== false,
        timeout: node.data.timeout || 60,
        description: node.data.description || '',
        // NEW: Loop and nested workflow
        stepTargetType,
        nestedWorkflowId,
        nestedWorkflowInputMapping,
        loopType,
        forEachArraySource,
        forEachItemVariable,
        forEachIndexVariable,
        forEachMaxIterations,
        whileLoopCondition,
        whileLoopMaxIterations,
        repeatCount,
        repeatIndexVariable,
      });
    }
  }, [node]);

  // Validate form data
  const validateForm = async () => {
    const errors: string[] = [];
    setIsValidating(true);

    try {
      // Validate agent name
      if (!formData.agentName.trim()) {
        errors.push('Agent name is required');
      }

      // Validate canister ID
      if (!formData.agentCanisterId.trim()) {
        errors.push('Agent canister ID is required');
      } else {
        try {
          Principal.fromText(formData.agentCanisterId);
          
          // CRITICAL: Validate that this is not an agency workflow canister ID
          // This should be passed as a prop, but for now we'll check if it's in availableAgents
          // If availableAgents is provided and this canister ID is not in it, it might be invalid
          if (availableAgents.length > 0) {
            const isValidAgent = availableAgents.some(agent => {
              const agentCanisterId = typeof agent === 'string' ? agent : agent.canisterId;
              return agentCanisterId === formData.agentCanisterId;
            });
            
            if (!isValidAgent) {
              console.warn(`⚠️ [NodeConfig] Canister ID "${formData.agentCanisterId}" is not in the list of available agents`);
              // Don't add as error - allow manual entry, but log warning
            }
          }
        } catch {
          errors.push('Invalid canister ID format');
        }
      }

      // Validate input template
      if (!formData.inputTemplate.trim()) {
        errors.push('Input template is required');
      }

      // Validate timeout
      if (formData.timeout <= 0) {
        errors.push('Timeout must be greater than 0');
      } else if (formData.timeout > 3600) {
        errors.push('Timeout cannot exceed 3600 seconds (1 hour)');
      }

      setValidationErrors(errors);
      return errors.length === 0;
    } finally {
      setIsValidating(false);
    }
  };

  // Handle form submission
  const handleSave = async () => {
    if (!node) return;

    const isValid = await validateForm();
    if (!isValid) return;

    // Build stepTarget if nested workflow
    let stepTarget: any = undefined;
    if (formData.stepTargetType === 'agency' && formData.nestedWorkflowId) {
      stepTarget = {
        agency: {
          agencyId: formData.nestedWorkflowId,
          inputMapping: formData.nestedWorkflowInputMapping || formData.inputTemplate
        }
      };
    } else if (formData.stepTargetType === 'agent' && formData.agentCanisterId) {
      stepTarget = {
        agent: {
          agentCanisterId: formData.agentCanisterId,
          agentConfig: undefined
        }
      };
    }
    
    // Build loopConfig
    let loopConfig: any = undefined;
    if (formData.loopType === 'for_each') {
      loopConfig = {
        forEach: {
          arraySource: formData.forEachArraySource,
          itemVariable: formData.forEachItemVariable,
          indexVariable: formData.forEachIndexVariable,
          maxIterations: formData.forEachMaxIterations
        }
      };
    } else if (formData.loopType === 'while_loop') {
      loopConfig = {
        whileLoop: {
          condition: formData.whileLoopCondition,
          maxIterations: formData.whileLoopMaxIterations
        }
      };
    } else if (formData.loopType === 'repeat') {
      loopConfig = {
        repeat: {
          count: formData.repeatCount,
          indexVariable: formData.repeatIndexVariable
        }
      };
    }

    // Update node with new data
    onUpdateNode(node.id, {
      agentName: formData.agentName,
      agentCanisterId: formData.agentCanisterId,
      inputTemplate: formData.inputTemplate,
      requiresApproval: formData.requiresApproval,
      retryOnFailure: formData.retryOnFailure,
      timeout: formData.timeout,
      description: formData.description,
      status: 'configured',
      validationErrors: [],
      // NEW: Include stepTarget and loopConfig
      stepTarget: stepTarget,
      loopConfig: loopConfig,
    });

    onClose();
  };

  // Handle canister ID change
  const handleCanisterIdChange = (value: string) => {
    setFormData(prev => ({ ...prev, agentCanisterId: value }));
    
    // Auto-update agent name if it's empty or generic
    if (!formData.agentName || formData.agentName === 'New Agent') {
      const shortId = value.slice(0, 8);
      setFormData(prev => ({ ...prev, agentName: `Agent ${shortId}` }));
    }
  };

  // Predefined templates for common patterns
  const inputTemplates = [
    { name: 'Basic Processing', template: 'Process this input: {input}' },
    { name: 'Data Validation', template: 'Validate this data: {input}' },
    { name: 'Content Analysis', template: 'Analyze this content: {input}' },
    { name: 'API Request', template: 'Make API request with: {input}' },
    { name: 'Notification', template: 'Send notification: {input}' },
    { name: 'Report Generation', template: 'Generate report for: {input}' },
    { name: 'Custom Processing', template: 'Execute custom task: {input}' },
  ];

  if (!node) return null;

  return (
    <div 
      className={`rounded-lg ${className}`}
      style={{
        background: 'var(--primary-black, #0a0a0a)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100vh',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4"
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          flexShrink: 0
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">{node.data.icon || '⚙️'}</span>
          <h3 className="text-lg font-semibold text-white">Configure Agent</h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1 rounded transition-colors duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Form Content */}
      <div 
        className="p-4"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          // Fix for clunky scrolling
          overscrollBehavior: 'contain',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        {/* Agent Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Agent Name *
          </label>
          <input
            type="text"
            value={formData.agentName}
            onChange={(e) => setFormData(prev => ({ ...prev, agentName: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            style={{
              background: 'var(--secondary-black, rgba(255, 255, 255, 0.02))',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
            placeholder="Enter agent name"
          />
        </div>

        {/* Step Target Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Step Type
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, stepTargetType: 'agent' }))}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                formData.stepTargetType === 'agent'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              🤖 Agent
            </button>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, stepTargetType: 'agency' }))}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                formData.stepTargetType === 'agency'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              🔄 Nested Workflow
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {formData.stepTargetType === 'agent' 
              ? 'Execute an agent task'
              : 'Execute another workflow as a sub-workflow'}
          </p>
        </div>

        {/* Agent Canister ID (only show if agent type) */}
        {formData.stepTargetType === 'agent' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Agent Canister ID *
          </label>
          <div className="space-y-2">
            {availableAgents.length > 0 ? (
              <select
                value={formData.agentCanisterId}
                onChange={(e) => handleCanisterIdChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              style={{
                background: 'var(--secondary-black, rgba(255, 255, 255, 0.02))',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
              >
                <option value="">Select a deployed agent</option>
                {availableAgents.map((agent, index) => {
                  // Handle both string (legacy) and object formats
                  const canisterId = typeof agent === 'string' ? agent : agent.canisterId;
                  const name = typeof agent === 'string' ? undefined : agent.name;
                  const displayName = name || `${canisterId.slice(0, 8)}...${canisterId.slice(-4)}`;
                  
                  return (
                    <option key={canisterId || index} value={canisterId}>
                      {name ? `${name} (${canisterId.slice(0, 8)}...${canisterId.slice(-4)})` : displayName}
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                type="text"
                value={formData.agentCanisterId}
                onChange={(e) => handleCanisterIdChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            style={{
              background: 'var(--secondary-black, rgba(255, 255, 255, 0.02))',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
                placeholder="rdmx6-jaaaa-aaaah-qcaiq-cai"
              />
            )}
            <p className="text-xs text-gray-500">
              {availableAgents.length > 0 
                ? 'Select from your deployed agents or enter a canister ID manually'
                : 'The Internet Computer Principal ID of the agent canister'}
            </p>
          </div>
        </div>
        )}

        {/* Nested Workflow Configuration (only show if agency type) */}
        {formData.stepTargetType === 'agency' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Workflow ID *
            </label>
            <input
              type="text"
              value={formData.nestedWorkflowId}
              onChange={(e) => setFormData(prev => ({ ...prev, nestedWorkflowId: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              style={{
                background: 'var(--secondary-black, rgba(255, 255, 255, 0.02))',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
              placeholder="agency_0"
            />
            <p className="text-xs text-gray-500 mt-1">
              ID of the workflow to execute (must exist)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Input Mapping
            </label>
            <textarea
              value={formData.nestedWorkflowInputMapping}
              onChange={(e) => setFormData(prev => ({ ...prev, nestedWorkflowInputMapping: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              style={{
                background: 'var(--secondary-black, rgba(255, 255, 255, 0.02))',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
              placeholder="{step_1_output}"
            />
            <p className="text-xs text-gray-500 mt-1">
              How to map current context to sub-workflow input (use template variables)
            </p>
          </div>
        </div>
        )}

        {/* Input Template */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Input Template *
          </label>
          <div className="space-y-2">
            <div style={{ position: 'relative' }}>
              <textarea
                ref={textareaRef}
                value={formData.inputTemplate}
                onChange={handleInputTemplateChange}
                onKeyDown={handleAutocompleteKeyDown}
                onBlur={() => {
                  // Delay hiding to allow click on autocomplete
                  setTimeout(() => setShowAutocomplete(false), 200);
                }}
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                style={{
                  background: 'var(--secondary-black, rgba(255, 255, 255, 0.02))',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
                placeholder="Enter input template (type '{' to see available variables)"
              />
              
              {/* Autocomplete Dropdown */}
              {showAutocomplete && (
                <div
                  ref={autocompleteRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '0.25rem',
                    background: 'var(--secondary-black)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                    zIndex: 1000,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    minWidth: '250px'
                  }}
                >
                  {templateVariables.map((variable, index) => (
                    <div
                      key={variable.value}
                      onClick={() => insertTemplateVariable(variable.value)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        background: index === selectedAutocompleteIndex 
                          ? 'rgba(255, 107, 53, 0.2)' 
                          : 'transparent',
                        borderLeft: index === selectedAutocompleteIndex 
                          ? '3px solid var(--accent-orange)' 
                          : '3px solid transparent',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={() => setSelectedAutocompleteIndex(index)}
                    >
                      <div style={{ 
                        color: '#ffffff', 
                        fontWeight: 600, 
                        fontSize: '0.875rem',
                        marginBottom: '0.25rem'
                      }}>
                        {'{'}{variable.value}{'}'}
                      </div>
                      <div style={{ 
                        color: '#9CA3AF', 
                        fontSize: '0.75rem' 
                      }}>
                        {variable.description}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {inputTemplates.map(template => (
                <button
                  key={template.name}
                  onClick={() => setFormData(prev => ({ ...prev, inputTemplate: template.template }))}
                  className="px-2 py-1 text-gray-300 text-xs rounded transition-colors duration-200"
                  style={{
                    background: 'var(--secondary-black, rgba(255, 255, 255, 0.02))',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--secondary-black, rgba(255, 255, 255, 0.02))';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                >
                  {template.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              Use {'{input}'} as a placeholder for data from previous agents
            </p>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
            placeholder="Optional description of what this agent does"
          />
        </div>

        {/* Configuration Options */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-300">Configuration Options</h4>
          
          {/* Requires Approval */}
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={formData.requiresApproval}
              onChange={(e) => setFormData(prev => ({ ...prev, requiresApproval: e.target.checked }))}
              className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500 focus:ring-2 mt-0.5"
              style={{
                background: 'var(--secondary-black, rgba(255, 255, 255, 0.02))',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            />
            <div>
              <span className="text-sm text-white">Requires approval</span>
              <p className="text-xs text-gray-400">Pause execution and wait for human approval before running this agent</p>
            </div>
          </label>

          {/* Retry on Failure */}
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={formData.retryOnFailure}
              onChange={(e) => setFormData(prev => ({ ...prev, retryOnFailure: e.target.checked }))}
              className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500 focus:ring-2 mt-0.5"
              style={{
                background: 'var(--secondary-black, rgba(255, 255, 255, 0.02))',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            />
            <div>
              <span className="text-sm text-white">Retry on failure</span>
              <p className="text-xs text-gray-400">Automatically retry this agent if it fails (up to 3 times)</p>
            </div>
          </label>

        {/* Loop Configuration */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Loop Configuration
          </label>
          <select
            value={formData.loopType}
            onChange={(e) => setFormData(prev => ({ ...prev, loopType: e.target.value as any }))}
            className="w-full px-3 py-2 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-3"
            style={{
              background: 'var(--secondary-black, rgba(255, 255, 255, 0.02))',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <option value="none">No Loop (Execute Once)</option>
            <option value="for_each">For Each (Iterate Array)</option>
            <option value="while_loop">While Loop (Conditional)</option>
            <option value="repeat">Repeat N Times</option>
          </select>

          {formData.loopType === 'for_each' && (
            <div className="space-y-3 p-3 rounded-lg" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Array Source *
                </label>
                <input
                  type="text"
                  value={formData.forEachArraySource}
                  onChange={(e) => setFormData(prev => ({ ...prev, forEachArraySource: e.target.value }))}
                  className="w-full px-2 py-1 rounded text-white text-sm"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                  placeholder="{step_1_output}.emails"
                />
                <p className="text-xs text-gray-400 mt-1">e.g., {`{step_1_output}.emails`} or {`{input}`}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Item Variable
                  </label>
                  <input
                    type="text"
                    value={formData.forEachItemVariable}
                    onChange={(e) => setFormData(prev => ({ ...prev, forEachItemVariable: e.target.value }))}
                    className="w-full px-2 py-1 rounded text-white text-sm"
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                    placeholder="item"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Index Variable
                  </label>
                  <input
                    type="text"
                    value={formData.forEachIndexVariable}
                    onChange={(e) => setFormData(prev => ({ ...prev, forEachIndexVariable: e.target.value }))}
                    className="w-full px-2 py-1 rounded text-white text-sm"
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                    placeholder="index"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Max Iterations (Safety Limit)
                </label>
                <input
                  type="number"
                  value={formData.forEachMaxIterations}
                  onChange={(e) => setFormData(prev => ({ ...prev, forEachMaxIterations: parseInt(e.target.value) || 1000 }))}
                  min={1}
                  max={10000}
                  className="w-full px-2 py-1 rounded text-white text-sm"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                />
              </div>
            </div>
          )}

          {formData.loopType === 'while_loop' && (
            <div className="space-y-3 p-3 rounded-lg" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Condition *
                </label>
                <textarea
                  value={formData.whileLoopCondition}
                  onChange={(e) => setFormData(prev => ({ ...prev, whileLoopCondition: e.target.value }))}
                  rows={2}
                  className="w-full px-2 py-1 rounded text-white text-sm"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                  placeholder="{step_1_output}.length > 0"
                />
                <p className="text-xs text-gray-400 mt-1">Expression to evaluate (e.g., {`{step_1_output}.length > 0`})</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Max Iterations (Safety Limit)
                </label>
                <input
                  type="number"
                  value={formData.whileLoopMaxIterations}
                  onChange={(e) => setFormData(prev => ({ ...prev, whileLoopMaxIterations: parseInt(e.target.value) || 100 }))}
                  min={1}
                  max={1000}
                  className="w-full px-2 py-1 rounded text-white text-sm"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                />
              </div>
            </div>
          )}

          {formData.loopType === 'repeat' && (
            <div className="space-y-3 p-3 rounded-lg" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Repeat Count *
                </label>
                <input
                  type="number"
                  value={formData.repeatCount}
                  onChange={(e) => setFormData(prev => ({ ...prev, repeatCount: parseInt(e.target.value) || 1 }))}
                  min={1}
                  max={1000}
                  className="w-full px-2 py-1 rounded text-white text-sm"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                />
                <p className="text-xs text-gray-400 mt-1">Number of times to execute this step</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Index Variable (Optional)
                </label>
                <input
                  type="text"
                  value={formData.repeatIndexVariable}
                  onChange={(e) => setFormData(prev => ({ ...prev, repeatIndexVariable: e.target.value }))}
                  className="w-full px-2 py-1 rounded text-white text-sm"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                  placeholder="iteration"
                />
                <p className="text-xs text-gray-400 mt-1">Variable name for iteration number (accessible in templates)</p>
              </div>
            </div>
          )}
        </div>

          {/* Timeout */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Timeout (seconds)
            </label>
            <input
              type="number"
              min="1"
              max="3600"
              value={formData.timeout}
              onChange={(e) => setFormData(prev => ({ ...prev, timeout: parseInt(e.target.value) || 60 }))}
              className="w-full px-3 py-2 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            style={{
              background: 'var(--secondary-black, rgba(255, 255, 255, 0.02))',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
            />
            <p className="text-xs text-gray-400 mt-1">
              Maximum time to wait for agent response (1-3600 seconds)
            </p>
          </div>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div 
            className="rounded-lg p-3"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}
          >
            <h4 className="text-red-400 font-medium text-sm mb-2">Please fix these issues:</h4>
            <ul className="space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index} className="text-red-300 text-sm flex items-center gap-2">
                  <span className="text-red-400">•</span>
                  {error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Preview */}
        <div 
          className="rounded-lg p-3"
          style={{
            background: 'var(--secondary-black, rgba(255, 255, 255, 0.02))',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            margin: '0 -0.25rem', // Match form padding
            padding: '0.75rem 1rem' // Consistent with form padding
          }}
        >
          <h4 className="text-sm font-medium text-gray-300 mb-2">Preview</h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Name:</span>
              <span className="text-white">{formData.agentName || 'Unnamed Agent'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Canister:</span>
              <span className="text-white font-mono">
                {formData.agentCanisterId ? 
                  `${formData.agentCanisterId.slice(0, 8)}...${formData.agentCanisterId.slice(-4)}` :
                  'Not configured'
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Approval:</span>
              <span className={formData.requiresApproval ? 'text-yellow-400' : 'text-green-400'}>
                {formData.requiresApproval ? 'Required' : 'Automatic'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Retry:</span>
              <span className={formData.retryOnFailure ? 'text-green-400' : 'text-gray-400'}>
                {formData.retryOnFailure ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Timeout:</span>
              <span className="text-white">{formData.timeout}s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div 
        className="flex items-center justify-end gap-3 p-4"
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          flexShrink: 0,
          background: 'var(--primary-black, #0a0a0a)'
        }}
      >
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-300 rounded-lg transition-colors duration-200"
          style={{
            background: 'var(--secondary-black, rgba(255, 255, 255, 0.02))',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--secondary-black, rgba(255, 255, 255, 0.02))';
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isValidating}
          className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isValidating && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          )}
          Save Configuration
        </button>
      </div>
    </div>
  );
};