import { Identity } from '@dfinity/agent';
import { WorkflowContextualAwarenessService, WorkflowCapabilities, WorkflowDocumentation } from './WorkflowContextualAwarenessService';
import { AgencyService } from './AgencyService';
import { userCanisterService } from './UserCanisterService';

export interface IntegratedWorkflow {
  id: string;
  workflowId: string;
  workflowName: string;
  workflowDescription: string;
  isEnabled: boolean;
  integrationLevel: 'execution' | 'monitoring' | 'full';
  integratedAt: number;
  executionMethods: Array<{
    method: 'manual' | 'trigger' | 'webhook';
    description: string;
  }>;
}

export interface WorkflowIntegrationResult {
  workflow: IntegratedWorkflow;
  implementationResult?: {
    filesCreated: string[];
    componentsAdded: string[];
    hooksAdded: string[];
  };
}

export class WorkflowIntegrationService {
  /**
   * Integrate workflow with app
   */
  static async integrateWorkflowWithApp(
    workflowId: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity,
    options?: {
      integrationLevel?: 'execution' | 'monitoring' | 'full';
      autoImplement?: boolean;
    }
  ): Promise<WorkflowIntegrationResult> {
    console.log(`🔗 [WorkflowIntegration] Starting workflow integration...`);
    
    try {
      // Discover workflow capabilities
      const capabilities = await WorkflowContextualAwarenessService
        .discoverWorkflowCapabilities(
          workflowId,
          projectId,
          userCanisterId,
          identity
        );
      
      console.log(`✅ [WorkflowIntegration] Workflow capabilities discovered`);
      
      // Generate documentation
      const documentation = WorkflowContextualAwarenessService
        .generateWorkflowDocumentation(capabilities);
      
      // Implement integration (if auto-implement enabled)
      let implementationResult;
      if (options?.autoImplement !== false) {
        implementationResult = await this.implementWorkflowIntegration(
          capabilities,
          documentation,
          projectId,
          identity
        );
        console.log(`✅ [WorkflowIntegration] Integration implemented`);
      }
      
      // Store integration metadata
      const integration: IntegratedWorkflow = {
        id: `workflow_integration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workflowId,
        workflowName: capabilities.name,
        workflowDescription: capabilities.description,
        isEnabled: true,
        integrationLevel: options?.integrationLevel || 'full',
        integratedAt: Date.now(),
        executionMethods: documentation.executionMethods.map(m => ({
          method: m.method,
          description: m.description
        }))
      };
      
      await this.storeIntegrationMetadata(projectId, integration);
      
      return {
        workflow: integration,
        implementationResult
      };
    } catch (error) {
      console.error('❌ [WorkflowIntegration] Integration failed:', error);
      throw error;
    }
  }
  
  /**
   * Implement workflow integration
   */
  private static async implementWorkflowIntegration(
    capabilities: WorkflowCapabilities,
    documentation: WorkflowDocumentation,
    projectId: string,
    identity: Identity
  ): Promise<any> {
    const filesCreated: string[] = [];
    
    // Generate workflow execution component
    const componentCode = this.generateWorkflowComponent(
      capabilities,
      documentation
    );
    
    try {
      await userCanisterService.createCodeArtifact(
        projectId,
        `src/components/KontextWorkflow.tsx`,
        componentCode,
        identity
      );
      filesCreated.push(`src/components/KontextWorkflow.tsx`);
    } catch (error) {
      console.warn(`⚠️ [WorkflowIntegration] Failed to create component:`, error);
    }
    
    // Generate workflow execution hook
    const hookCode = this.generateWorkflowHook(capabilities);
    
    try {
      await userCanisterService.createCodeArtifact(
        projectId,
        `src/hooks/useWorkflowExecution.ts`,
        hookCode,
        identity
      );
      filesCreated.push(`src/hooks/useWorkflowExecution.ts`);
    } catch (error) {
      console.warn(`⚠️ [WorkflowIntegration] Failed to create hook:`, error);
    }
    
    return {
      filesCreated,
      componentsAdded: ['KontextWorkflow'],
      hooksAdded: ['useWorkflowExecution']
    };
  }
  
  /**
   * Generate workflow component
   */
  private static generateWorkflowComponent(
    capabilities: WorkflowCapabilities,
    documentation: WorkflowDocumentation
  ): string {
    return `import React, { useState } from 'react';
import { useWorkflowExecution } from '../hooks/useWorkflowExecution';

interface KontextWorkflowProps {
  workflowId: string;
  onExecute?: (result: any) => void;
  showTriggers?: boolean;
}

export const KontextWorkflow: React.FC<KontextWorkflowProps> = ({
  workflowId,
  onExecute,
  showTriggers = false
}) => {
  const { executeWorkflow, isExecuting, lastResult } = useWorkflowExecution(workflowId);
  const [input, setInput] = useState('');
  
  const handleExecute = async () => {
    const result = await executeWorkflow(input);
    if (onExecute) {
      onExecute(result);
    }
  };
  
  return (
    <div style={{
      padding: '1rem',
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <h3 style={{ color: '#ffffff', marginBottom: '1rem' }}>
        ${capabilities.name}
      </h3>
      <p style={{ color: 'var(--text-gray)', marginBottom: '1rem', fontSize: '0.9rem' }}>
        ${capabilities.description}
      </p>
      
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter workflow input..."
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '1rem'
          }}
        />
      </div>
      
      <button
        onClick={handleExecute}
        disabled={isExecuting || !input.trim()}
        style={{
          width: '100%',
          padding: '0.75rem',
          background: isExecuting || !input.trim()
            ? 'rgba(255, 255, 255, 0.1)'
            : 'linear-gradient(135deg, #ff6b35, #10b981)',
          border: 'none',
          borderRadius: '8px',
          color: '#ffffff',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: isExecuting || !input.trim() ? 'not-allowed' : 'pointer',
          opacity: isExecuting || !input.trim() ? 0.5 : 1
        }}
      >
        {isExecuting ? 'Executing...' : 'Execute Workflow'}
      </button>
      
      {lastResult && (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: 'rgba(16, 185, 129, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(16, 185, 129, 0.3)'
        }}>
          <strong style={{ color: '#10b981' }}>Last Result:</strong>
          <pre style={{ color: '#ffffff', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};`;
  }
  
  /**
   * Generate workflow hook
   */
  private static generateWorkflowHook(capabilities: WorkflowCapabilities): string {
    return `import { useState, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { AgencyService } from '../services/AgencyService';

export const useWorkflowExecution = (workflowId: string) => {
  const activeProject = useAppStore(state => state.activeProject);
  const userCanisterId = useAppStore(state => state.userCanisterId);
  const identity = useAppStore(state => state.identity);
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const executeWorkflow = useCallback(async (input: string) => {
    if (!activeProject || !userCanisterId || !identity) {
      throw new Error('Missing project context');
    }
    
    setIsExecuting(true);
    setError(null);
    
    try {
      const result = await AgencyService.executeAgency(
        workflowId,
        input,
        activeProject,
        userCanisterId,
        identity
      );
      
      if (result.success) {
        setLastResult({ executionId: result.executionId, success: true });
        return result;
      } else {
        throw new Error(result.error || 'Workflow execution failed');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      setLastResult({ success: false, error: errorMsg });
      throw err;
    } finally {
      setIsExecuting(false);
    }
  }, [workflowId, activeProject, userCanisterId, identity]);
  
  return {
    executeWorkflow,
    isExecuting,
    lastResult,
    error
  };
};`;
  }
  
  /**
   * Store integration metadata
   */
  private static async storeIntegrationMetadata(
    projectId: string,
    integration: IntegratedWorkflow
  ): Promise<void> {
    const key = `workflow-integrations-${projectId}`;
    const existing = localStorage.getItem(key);
    const integrations = existing ? JSON.parse(existing) : [];
    
    integrations.push(integration);
    localStorage.setItem(key, JSON.stringify(integrations));
  }
  
  /**
   * Get all workflow integrations for a project
   */
  static getProjectWorkflowIntegrations(projectId: string): IntegratedWorkflow[] {
    const key = `workflow-integrations-${projectId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    
    try {
      return JSON.parse(stored) as IntegratedWorkflow[];
    } catch (error) {
      console.error('Failed to load workflow integrations:', error);
      return [];
    }
  }
  
  /**
   * Remove workflow integration
   */
  static removeWorkflowIntegration(projectId: string, integrationId: string): void {
    const key = `workflow-integrations-${projectId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return;
    
    try {
      const integrations = JSON.parse(stored) as IntegratedWorkflow[];
      const filtered = integrations.filter(i => i.id !== integrationId);
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to remove workflow integration:', error);
    }
  }
  
  /**
   * Update workflow integration
   */
  static updateWorkflowIntegration(
    projectId: string,
    integrationId: string,
    updates: Partial<IntegratedWorkflow>
  ): void {
    const key = `workflow-integrations-${projectId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return;
    
    try {
      const integrations = JSON.parse(stored) as IntegratedWorkflow[];
      const updated = integrations.map(i =>
        i.id === integrationId ? { ...i, ...updates } : i
      );
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to update workflow integration:', error);
    }
  }
}

