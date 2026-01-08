import { Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { AgentAppCapabilityDiscoveryService, AgentCapabilities, AppCapabilities, IntegrationStrategy } from './AgentAppCapabilityDiscoveryService';
import { AgentContextualAwarenessService } from './AgentContextualAwarenessService';
import { userCanisterService } from './UserCanisterService';
import { useAppStore } from '../store/appStore';

// Import agent service methods - we'll need to access agent data
// The AgentServiceClass is in AgentManagementInterface, so we'll need to create a helper

export interface IntegratedAgent {
  id: string;
  agentCanisterId: string;
  agentName: string;
  agentDescription: string;
  isEnabled: boolean;
  integrationLevel: 'minimal' | 'moderate' | 'deep' | 'autonomous';
  integrationStrategy?: IntegrationStrategy;
  integratedAt: number;
  backendCanisterId?: string;
  capabilities: string[];
  originalInstructions?: string; // Store original to revert if disabled
}

export interface IntegrationResult {
  strategy: IntegrationStrategy | null;
  implementationResult?: {
    filesCreated: string[];
    instructionsUpdated: boolean;
    componentsAdded: string[];
  };
}

export class AgentIntegrationService {
  /**
   * One-click agent-app integration
   */
  static async integrateAgentWithApp(
    agentCanisterId: string,
    projectId: string,
    backendCanisterId: string,
    identity: Identity,
    agentIdentity: any, // AgentIdentity from canister
    options?: {
      integrationLevel?: 'minimal' | 'moderate' | 'deep' | 'autonomous';
      autoImplement?: boolean;
    }
  ): Promise<IntegrationResult> {
    console.log(`🔗 [AgentIntegration] Starting one-click integration...`);
    
    try {
      // Skip AI strategy generation - just do the essential steps directly
      // 1. Update agent instructions with backend method knowledge
      // 2. Add kontext-canister-bridge MCP server
      // 3. Create standard KontextAgent component
      // 4. Create standard useAgentIntegration hook
      // 5. Store integration metadata
      
      let implementationResult;
      if (options?.autoImplement !== false) {
        implementationResult = await this.implementDirectIntegration(
          agentCanisterId,
          projectId,
          backendCanisterId,
          identity,
          agentIdentity
        );
        console.log(`✅ [AgentIntegration] Integration implemented`);
      }
      
      // Store integration metadata
      await this.storeIntegrationMetadata(
        projectId,
        {
          agentCanisterId,
          projectId,
          strategy: null, // No AI strategy needed
          implementedAt: Date.now(),
          agentName: agentIdentity.name || 'Agent',
          agentDescription: agentIdentity.description || '',
          integrationLevel: options?.integrationLevel || 'moderate'
        }
      );
      
      return {
        strategy: null, // No AI strategy
        implementationResult
      };
    } catch (error) {
      console.error('❌ [AgentIntegration] Integration failed:', error);
      throw error;
    }
  }
  
  /**
   * Direct integration without AI strategy generation
   * Performs essential steps: update instructions, add MCP server, create components
   */
  private static async implementDirectIntegration(
    agentCanisterId: string,
    projectId: string,
    backendCanisterId: string,
    identity: Identity,
    agentIdentity: any
  ): Promise<any> {
    const filesCreated: string[] = [];
    
    // 1. Update agent instructions with backend method knowledge AND add Kontext Canister Bridge
    try {
      // Create agent actor directly to update instructions
      const { HttpAgent, Actor } = await import('@dfinity/agent');
      const { idlFactory: agentIdlFactory } = await import('../../candid/agent.did');
      type AgentConfig = import('../../candid/agent.did.d.ts').AgentConfig;
      
      const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://127.0.0.1:4943'
        : 'https://icp0.io';
      
      const agent = new HttpAgent({ identity, host });
      
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        await agent.fetchRootKey();
      }
      
      const agentActor = Actor.createActor(agentIdlFactory, {
        agent,
        canisterId: agentCanisterId,
      });
      
      // Get current agent identity
      const identityResult = await agentActor.getAgentIdentity();
      if (!identityResult || (Array.isArray(identityResult) && identityResult.length === 0)) {
        throw new Error('Could not retrieve agent identity');
      }
      
      const currentIdentity = Array.isArray(identityResult) ? identityResult[0] : identityResult;
      
      // Get Candid interface for the backend canister (needed for instructions)
      let candidContent = '';
      let methodDocs: any[] = [];
      try {
        const candidDiscovery = await AgentContextualAwarenessService.discoverProjectCanisterMethods(
          projectId,
          backendCanisterId,
          identity
        );
        candidContent = candidDiscovery.candidContent;
        methodDocs = candidDiscovery.methodDocs;
        console.log(`✅ [AgentIntegration] Loaded Candid interface (${candidContent.length} chars, ${methodDocs.length} methods)`);
      } catch (error) {
        console.warn('⚠️ [AgentIntegration] Could not load Candid interface, continuing without it:', error);
      }
      
      // Generate enhanced instructions with backend method knowledge
      let enhancedInstructions = currentIdentity.instructions || '';
      if (candidContent && methodDocs.length > 0) {
        enhancedInstructions = AgentContextualAwarenessService.generateEnhancedInstructions(
          currentIdentity.instructions || '',
          methodDocs,
          backendCanisterId,
          candidContent // Pass the .did.js content
        );
        console.log(`✅ [AgentIntegration] Generated enhanced instructions with backend method knowledge`);
      }
      
      // Add kontext-canister-bridge to MCP servers if not already present
      const mcpServers = [...(currentIdentity.defaultMcpServers || [])];
      if (!mcpServers.includes('kontext-canister-bridge')) {
        mcpServers.push('kontext-canister-bridge');
        console.log(`✅ [AgentIntegration] Adding kontext-canister-bridge to MCP servers`);
      }
      
      // Build updated config with enhanced instructions AND MCP server
      const updatedConfig: AgentConfig = {
        name: currentIdentity.name,
        description: currentIdentity.description,
        instructions: enhancedInstructions,
        mcpClientEndpoint: currentIdentity.mcpClientEndpoint || '',
        claudeApiKey: currentIdentity.claudeApiKey || '',
        defaultMcpServers: mcpServers, // Include kontext-canister-bridge
        mcpTokens: currentIdentity.mcpTokens || [],
        requireApproval: currentIdentity.requireApproval || false,
        confidenceThreshold: currentIdentity.confidenceThreshold || 0.7,
        maxTokens: typeof currentIdentity.maxTokens === 'bigint' 
          ? currentIdentity.maxTokens 
          : BigInt(currentIdentity.maxTokens || 4000),
        temperature: currentIdentity.temperature || 0.7,
      };
      
      // Update agent config
      const updateResult = await agentActor.updateAgentConfig(updatedConfig) as { ok?: any; err?: string };
      
      if (updateResult && 'ok' in updateResult) {
        console.log(`✅ [AgentIntegration] Agent instructions updated successfully with backend method knowledge`);
        console.log(`✅ [AgentIntegration] Added kontext-canister-bridge MCP server`);
      } else {
        const errMsg = updateResult && 'err' in updateResult ? updateResult.err : 'Unknown error';
        console.warn(`⚠️ [AgentIntegration] Failed to update agent instructions:`, errMsg);
        // Don't throw - continue with integration even if instruction update fails
      }
    } catch (error) {
      console.error('❌ [AgentIntegration] Error updating agent instructions:', error);
      // Don't throw - continue with integration even if instruction update fails
    }
    
    // 2. Create standard KontextAgent component and useAgentIntegration hook
    const store = useAppStore.getState();
    const userCanisterId = store.userCanisterId;
    const principal = identity.getPrincipal();
    
    if (!userCanisterId) {
      throw new Error('User canister ID not found. Please ensure you are logged in.');
    }
    
    // Generate standard component code
    const componentCode = this.generateComponentCode(
      'KontextAgent',
      null, // No strategy needed
      agentCanisterId,
      backendCanisterId
    );
    
    // Generate standard hook code
    const hookCode = this.generateHookCode(
      'useAgentIntegration',
      null, // No strategy needed
      agentCanisterId,
      backendCanisterId
    );
    
    // Create/update component
    try {
      const componentFileName = 'KontextAgent.tsx';
      const componentFilePath = 'src/components';
      const componentFullPath = `${componentFilePath}/${componentFileName}`;
      
      const existingComponent = await userCanisterService.readCodeArtifactForEditing(
        userCanisterId,
        identity,
        projectId,
        componentFileName,
        componentFilePath
      );
      
      if (existingComponent.success && existingComponent.artifact?.content) {
        await userCanisterService.updateCodeArtifactFromSidePane(
          principal,
          projectId,
          componentFileName,
          componentCode,
          componentFilePath,
          userCanisterId,
          identity
        );
        filesCreated.push(componentFullPath);
        console.log(`✅ [AgentIntegration] Updated component: ${componentFullPath}`);
      } else {
        await userCanisterService.createCodeArtifactFromSidePane(
          principal,
          projectId,
          componentFileName,
          componentCode,
          componentFilePath,
          userCanisterId,
          identity
        );
        filesCreated.push(componentFullPath);
        console.log(`✅ [AgentIntegration] Created component: ${componentFullPath}`);
      }
    } catch (error) {
      console.error('❌ [AgentIntegration] Error creating component:', error);
      throw error;
    }
    
    // Create/update hook
    try {
      const hookFileName = 'useAgentIntegration.ts';
      const hookFilePath = 'src/hooks';
      const hookFullPath = `${hookFilePath}/${hookFileName}`;
      
      const existingHook = await userCanisterService.readCodeArtifactForEditing(
        userCanisterId,
        identity,
        projectId,
        hookFileName,
        hookFilePath
      );
      
      if (existingHook.success && existingHook.artifact?.content) {
        await userCanisterService.updateCodeArtifactFromSidePane(
          principal,
          projectId,
          hookFileName,
          hookCode,
          hookFilePath,
          userCanisterId,
          identity
        );
        filesCreated.push(hookFullPath);
        console.log(`✅ [AgentIntegration] Updated hook: ${hookFullPath}`);
      } else {
        await userCanisterService.createCodeArtifactFromSidePane(
          principal,
          projectId,
          hookFileName,
          hookCode,
          hookFilePath,
          userCanisterId,
          identity
        );
        filesCreated.push(hookFullPath);
        console.log(`✅ [AgentIntegration] Created hook: ${hookFullPath}`);
      }
    } catch (error) {
      console.error('❌ [AgentIntegration] Error creating hook:', error);
      throw error;
    }
    
    return {
      filesCreated,
      instructionsUpdated: true,
      componentsAdded: filesCreated
    };
  }

  /**
   * Implement the generated strategy (kept for backward compatibility, but prefer implementDirectIntegration)
   */
  private static async implementStrategy(
    strategy: IntegrationStrategy,
    agentCanisterId: string,
    projectId: string,
    backendCanisterId: string,
    identity: Identity,
    agentIdentity: any
  ): Promise<any> {
    const filesCreated: string[] = [];
    
    // 1. Update agent instructions with backend method knowledge AND add Kontext Canister Bridge
    if (strategy.agentEnhancements.newInstructions) {
      try {
        // Create agent actor directly to update instructions
        const { HttpAgent, Actor } = await import('@dfinity/agent');
        const { idlFactory: agentIdlFactory } = await import('../../candid/agent.did');
        type AgentConfig = import('../../candid/agent.did.d.ts').AgentConfig;
        
        const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? 'http://127.0.0.1:4943'
          : 'https://icp0.io';
        
        const agent = new HttpAgent({ identity, host });
        
        if (host.includes('localhost') || host.includes('127.0.0.1')) {
          await agent.fetchRootKey();
        }
        
        const agentActor = Actor.createActor(agentIdlFactory, {
          agent,
          canisterId: agentCanisterId,
        });
        
        // Get current agent identity
        const identityResult = await agentActor.getAgentIdentity();
        if (!identityResult || (Array.isArray(identityResult) && identityResult.length === 0)) {
          throw new Error('Could not retrieve agent identity');
        }
        
        const currentIdentity = Array.isArray(identityResult) ? identityResult[0] : identityResult;
        
        // Get Candid interface for the backend canister (needed for instructions)
        let candidContent = '';
        let methodDocs: any[] = [];
        try {
          const candidDiscovery = await AgentContextualAwarenessService.discoverProjectCanisterMethods(
            projectId,
            backendCanisterId,
            identity
          );
          candidContent = candidDiscovery.candidContent;
          methodDocs = candidDiscovery.methodDocs;
          console.log(`✅ [AgentIntegration] Loaded Candid interface (${candidContent.length} chars, ${methodDocs.length} methods)`);
        } catch (error) {
          console.warn('⚠️ [AgentIntegration] Could not load Candid interface, continuing without it:', error);
        }
        
        // Regenerate instructions with candidContent embedded (so agent has .did.js content)
        let enhancedInstructions = strategy.agentEnhancements.newInstructions;
        if (candidContent && methodDocs.length > 0) {
          // Regenerate with candidContent included
          // Note: generateEnhancedInstructions now accepts candidContent as optional 4th parameter
          enhancedInstructions = AgentContextualAwarenessService.generateEnhancedInstructions(
            currentIdentity.instructions || strategy.agentEnhancements.newInstructions,
            methodDocs,
            backendCanisterId,
            candidContent // Pass the .did.js content (optional 4th parameter)
          );
          console.log(`✅ [AgentIntegration] Regenerated instructions with .did.js content embedded`);
        }
        
        // Add kontext-canister-bridge to MCP servers if not already present
        const mcpServers = [...(currentIdentity.defaultMcpServers || [])];
        if (!mcpServers.includes('kontext-canister-bridge')) {
          mcpServers.push('kontext-canister-bridge');
          console.log(`✅ [AgentIntegration] Adding kontext-canister-bridge to MCP servers`);
        }
        
        // Build updated config with enhanced instructions AND MCP server
        const updatedConfig: AgentConfig = {
          name: currentIdentity.name,
          description: currentIdentity.description,
          instructions: enhancedInstructions, // Use regenerated instructions with candidContent
          mcpClientEndpoint: currentIdentity.mcpClientEndpoint || '',
          claudeApiKey: currentIdentity.claudeApiKey || '',
          defaultMcpServers: mcpServers, // Include kontext-canister-bridge
          mcpTokens: currentIdentity.mcpTokens || [],
          requireApproval: currentIdentity.requireApproval || false,
          confidenceThreshold: currentIdentity.confidenceThreshold || 0.7,
          maxTokens: typeof currentIdentity.maxTokens === 'bigint' 
            ? currentIdentity.maxTokens 
            : BigInt(currentIdentity.maxTokens || 4000),
          temperature: currentIdentity.temperature || 0.7,
        };
        
        // Update agent config
        const updateResult = await agentActor.updateAgentConfig(updatedConfig) as { ok?: any; err?: string };
        
        if (updateResult && 'ok' in updateResult) {
          console.log(`✅ [AgentIntegration] Agent instructions updated successfully with backend method knowledge`);
          console.log(`✅ [AgentIntegration] Added kontext-canister-bridge MCP server`);
        } else {
          const errMsg = updateResult && 'err' in updateResult ? updateResult.err : 'Unknown error';
          console.warn(`⚠️ [AgentIntegration] Failed to update agent instructions:`, errMsg);
          // Don't throw - continue with integration even if instruction update fails
        }
      } catch (error) {
        console.error('❌ [AgentIntegration] Error updating agent instructions:', error);
        // Don't throw - continue with integration even if instruction update fails
      }
    }
    
    // Get userCanisterId and principal for file creation
    const store = useAppStore.getState();
    const userCanisterId = store.userCanisterId;
    const principal = identity.getPrincipal();
    
    if (!userCanisterId) {
      throw new Error('User canister ID not found. Please ensure you are logged in.');
    }
    
    // 2. Generate app components (if specified in strategy)
    for (const component of strategy.appEnhancements.newComponents || []) {
      const componentCode = this.generateComponentCode(
        component,
        strategy,
        agentCanisterId,
        backendCanisterId
      );
      
      try {
        const fileName = `${component}.tsx`;
        const filePath = `src/components`;
        const fullPath = `${filePath}/${fileName}`;
        
        // Check if file already exists
        const existingFile = await userCanisterService.readCodeArtifactForEditing(
          userCanisterId,
          identity,
          projectId,
          fileName,
          filePath
        );
        
        if (existingFile.success && existingFile.artifact?.content) {
          // File exists, update it instead
          console.log(`📝 [AgentIntegration] File exists, updating: ${fullPath}`);
          const updateResult = await userCanisterService.updateCodeArtifactFromSidePane(
            principal,
            projectId,
            fileName,
            componentCode,
            filePath,
            userCanisterId,
            identity
          );
          
          if (updateResult.success) {
            filesCreated.push(fullPath);
            console.log(`✅ [AgentIntegration] Updated component: ${fullPath}`);
          } else {
            throw new Error(updateResult.error || 'Failed to update component');
          }
        } else {
          // File doesn't exist, create it
          console.log(`🆕 [AgentIntegration] Creating new component: ${fullPath}`);
          const result = await userCanisterService.createCodeArtifactFromSidePane(
            principal,
            projectId,
            fileName,
            componentCode,
            filePath,
            userCanisterId,
            identity
          );
          
          if (result.success) {
            filesCreated.push(fullPath);
            console.log(`✅ [AgentIntegration] Created component: ${fullPath}`);
          } else {
            throw new Error(result.error || 'Failed to create component');
          }
        }
      } catch (error) {
        console.warn(`⚠️ [AgentIntegration] Failed to create/update component ${component}:`, error);
      }
    }
    
    // 3. Generate hooks (if specified)
    for (const hook of strategy.appEnhancements.newHooks || []) {
      const hookCode = this.generateHookCode(
        hook,
        strategy,
        agentCanisterId,
        backendCanisterId
      );
      
      try {
        const fileName = `${hook}.ts`;
        const filePath = `src/hooks`;
        const fullPath = `${filePath}/${fileName}`;
        
        // Check if file already exists
        const existingFile = await userCanisterService.readCodeArtifactForEditing(
          userCanisterId,
          identity,
          projectId,
          fileName,
          filePath
        );
        
        if (existingFile.success && existingFile.artifact?.content) {
          // File exists, update it instead
          console.log(`📝 [AgentIntegration] File exists, updating: ${fullPath}`);
          const updateResult = await userCanisterService.updateCodeArtifactFromSidePane(
            principal,
            projectId,
            fileName,
            hookCode,
            filePath,
            userCanisterId,
            identity
          );
          
          if (updateResult.success) {
            filesCreated.push(fullPath);
            console.log(`✅ [AgentIntegration] Updated hook: ${fullPath}`);
          } else {
            throw new Error(updateResult.error || 'Failed to update hook');
          }
        } else {
          // File doesn't exist, create it
          console.log(`🆕 [AgentIntegration] Creating new hook: ${fullPath}`);
          const result = await userCanisterService.createCodeArtifactFromSidePane(
            principal,
            projectId,
            fileName,
            hookCode,
            filePath,
            userCanisterId,
            identity
          );
          
          if (result.success) {
            filesCreated.push(fullPath);
            console.log(`✅ [AgentIntegration] Created hook: ${fullPath}`);
          } else {
            throw new Error(result.error || 'Failed to create hook');
          }
        }
      } catch (error) {
        console.warn(`⚠️ [AgentIntegration] Failed to create/update hook ${hook}:`, error);
      }
    }
    
    return {
      filesCreated,
      instructionsUpdated: !!strategy.agentEnhancements.newInstructions,
      componentsAdded: strategy.appEnhancements.newComponents || []
    };
  }
  
  /**
   * Generate component code
   */
  private static generateComponentCode(
    componentName: string,
    strategy: IntegrationStrategy | null,
    agentCanisterId: string,
    backendCanisterId: string
  ): string {
    if (componentName === 'KontextAgent') {
      return `import React, { useState } from 'react';
import { useAgentIntegration } from '../hooks/useAgentIntegration';

interface KontextAgentProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'inline';
  mode?: 'chatbot' | 'inline';
  welcomeMessage?: string;
  className?: string;
}

export const KontextAgent: React.FC<KontextAgentProps> = ({
  position = 'bottom-right',
  mode = 'chatbot',
  welcomeMessage = 'Hi! I can help you interact with this app.',
  className = ''
}) => {
  const { executeTask, isExecuting, lastResult, error, agentState } = useAgentIntegration('${agentCanisterId}');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [isOpen, setIsOpen] = useState(mode === 'inline');

  const handleSend = async () => {
    if (!input.trim() || isExecuting) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    try {
      const result = await executeTask(userMessage);
      if (result && 'ok' in result) {
        const response = typeof result.ok === 'string' ? result.ok : JSON.stringify(result.ok);
        setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      } else if (result && 'err' in result) {
        const errorMsg = typeof result.err === 'string' ? result.err : JSON.stringify(result.err);
        setMessages(prev => [...prev, { role: 'assistant', content: \`Error: \${errorMsg}\` }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: \`Error: \${err instanceof Error ? err.message : 'Unknown error'}\` }]);
    }
  };

  const chatInterface = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      maxHeight: '600px',
      backgroundColor: '#fff',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
    }}>
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Agent Assistant</h3>
        {mode === 'chatbot' && (
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: 0,
              width: '24px',
              height: '24px'
            }}
          >
            ×
          </button>
        )}
      </div>
      
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {messages.length === 0 && (
          <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>
            {welcomeMessage}
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: msg.role === 'user' ? '#3b82f6' : '#f3f4f6',
              color: msg.role === 'user' ? '#fff' : '#111827'
            }}
          >
            {msg.content}
          </div>
        ))}
        {isExecuting && (
          <div style={{ alignSelf: 'flex-start', color: '#6b7280', fontStyle: 'italic' }}>
            Thinking...
          </div>
        )}
      </div>
      
      <div style={{
        padding: '16px',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        gap: '8px'
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type your message..."
          disabled={isExecuting}
          style={{
            flex: 1,
            padding: '10px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px'
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isExecuting}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: isExecuting || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: isExecuting || !input.trim() ? 0.5 : 1
          }}
        >
          Send
        </button>
      </div>
    </div>
  );

  if (mode === 'inline') {
    return <div className={className}>{chatInterface}</div>;
  }

  // Floating chatbot mode
  const positionStyles: Record<string, React.CSSProperties> = {
    'bottom-right': { bottom: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'top-right': { top: '20px', right: '20px' },
    'top-left': { top: '20px', left: '20px' }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            ...positionStyles[position],
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: '#3b82f6',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: '24px',
            zIndex: 1000
          }}
        >
          💬
        </button>
      )}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            ...positionStyles[position],
            width: '400px',
            height: '600px',
            zIndex: 1000
          }}
        >
          {chatInterface}
        </div>
      )}
    </>
  );
};`;
    }
    
    // Default component template - generate based on component name
    const componentDescription = componentName.replace(/([A-Z])/g, ' $1').trim();
    
    return `import React, { useState, useEffect } from 'react';
import { useAgentIntegration } from '../hooks/useAgentIntegration';

interface ${componentName}Props {
  className?: string;
}

export const ${componentName}: React.FC<${componentName}Props> = ({ className = '' }) => {
  const { executeTask, isExecuting, lastResult, error, agentState } = useAgentIntegration('${agentCanisterId}');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    // Initialize component data
    // You can call executeTask here if needed for initial data loading
  }, []);

  return (
    <div className={className} style={{ padding: '16px' }}>
      <h3>${componentDescription}</h3>
      {error && (
        <div style={{ color: 'red', marginBottom: '12px' }}>
          Error: {error}
        </div>
      )}
      {isExecuting && (
        <div>Loading...</div>
      )}
      {lastResult && (
        <div>
          <pre>{JSON.stringify(lastResult, null, 2)}</pre>
        </div>
      )}
      {/* Add your component UI here */}
    </div>
  );
};`;
  }
  
  /**
   * Generate hook code
   */
  private static generateHookCode(
    hookName: string,
    strategy: IntegrationStrategy | null,
    agentCanisterId: string,
    backendCanisterId: string
  ): string {
    if (hookName === 'useAgentIntegration') {
      return `import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/appStore';

// Import AgentServiceClass from AgentManagementInterface
// We need to access the agent canister methods
// Note: This requires the AgentServiceClass to be exported or accessible
// For now, we'll create a simplified version that uses the agent canister directly

interface AgentTaskResult {
  ok?: any;
  err?: string;
}

export const useAgentIntegration = (agentCanisterId: string) => {
  const identity = useAppStore(state => state.identity);
  const [agentState, setAgentState] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<AgentTaskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);

  // Execute a task with the agent
  const executeTask = useCallback(async (
    input: string,
    metadata: [string, string][] = []
  ): Promise<AgentTaskResult> => {
    if (!identity) {
      const err = 'Identity not available. Please ensure you are logged in.';
      setError(err);
      return { err };
    }

    setIsExecuting(true);
    setError(null);
    setLastResult(null);

      try {
        // Create agent actor directly
        const { HttpAgent, Actor } = await import('@dfinity/agent');
        const { idlFactory as agentIdlFactory } = await import('../candid/agent.did');
        
        const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? 'http://127.0.0.1:4943'
          : 'https://icp0.io';
        
        const agent = new HttpAgent({ identity, host });
        
        if (host.includes('localhost') || host.includes('127.0.0.1')) {
          await agent.fetchRootKey();
        }
        
        const agentActor = Actor.createActor(agentIdlFactory, {
          agent,
          canisterId: agentCanisterId,
        });
        
        const result = await agentActor.executeTask(input, [], metadata, []);

      if ('ok' in result) {
        setLastResult({ ok: result.ok });
        // Refresh agent state after successful task
        setTimeout(() => {
          loadAgentState();
        }, 1000);
        return { ok: result.ok };
      } else {
        const errMsg = typeof result.err === 'string' ? result.err : JSON.stringify(result.err);
        setError(errMsg);
        setLastResult({ err: errMsg });
        return { err: errMsg };
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errMsg);
      setLastResult({ err: errMsg });
      return { err: errMsg };
    } finally {
      setIsExecuting(false);
    }
  }, [agentCanisterId, identity]);

  // Load agent state (tasks, metrics, etc.)
  const loadAgentState = useCallback(async () => {
    if (!identity) return;

    try {
      // Create agent actor directly
      const { HttpAgent, Actor } = await import('@dfinity/agent');
      const { idlFactory as agentIdlFactory } = await import('../candid/agent.did');
      
      const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://127.0.0.1:4943'
        : 'https://icp0.io';
      
      const agent = new HttpAgent({ identity, host });
      
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        await agent.fetchRootKey();
      }
      
      const agentActor = Actor.createActor(agentIdlFactory, {
        agent,
        canisterId: agentCanisterId,
      });
      
      // Get agent tasks and metrics
      const [tasksResult, metricsResult] = await Promise.allSettled([
        agentActor.getAllTasks(BigInt(20)),
        agentActor.getMetrics()
      ]);
      
      if (tasksResult.status === 'fulfilled' && tasksResult.value) {
        setTasks(Array.isArray(tasksResult.value) ? tasksResult.value : []);
      }
      
      if (metricsResult.status === 'fulfilled' && metricsResult.value) {
        setAgentState({
          metrics: metricsResult.value,
          tasks: Array.isArray(tasksResult.value) ? tasksResult.value : []
        });
      }
    } catch (err) {
      console.error('Failed to load agent state:', err);
    }
  }, [agentCanisterId, identity]);

  useEffect(() => {
    if (agentCanisterId && identity) {
      loadAgentState();
      
      // Poll for updates every 5 seconds
      const interval = setInterval(() => {
        loadAgentState();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [agentCanisterId, identity, loadAgentState]);

  return {
    agentState,
    isExecuting,
    lastResult,
    error,
    tasks,
    executeTask,
    refreshAgentState: loadAgentState
  };
};`;
    }
    
    return `import { useState, useEffect } from 'react';

export const ${hookName} = () => {
  const [state, setState] = useState<any>(null);
  
  useEffect(() => {
    // Initialize hook
  }, []);
  
  return {
    state,
    // Add hook methods here
  };
};`;
  }
  
  /**
   * Store integration metadata in project context
   */
  private static async storeIntegrationMetadata(
    projectId: string,
    metadata: {
      agentCanisterId: string;
      projectId: string;
      strategy: IntegrationStrategy | null;
      implementedAt: number;
      agentName: string;
      agentDescription: string;
      integrationLevel: 'minimal' | 'moderate' | 'deep' | 'autonomous';
    }
  ): Promise<void> {
    // Store in localStorage for now (can be moved to user canister later)
    const key = `agent-integrations-${projectId}`;
    const existing = localStorage.getItem(key);
    const integrations = existing ? JSON.parse(existing) : [];
    
    const integration: IntegratedAgent = {
      id: `integration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentCanisterId: metadata.agentCanisterId,
      agentName: metadata.agentName,
      agentDescription: metadata.agentDescription,
      isEnabled: true,
      integrationLevel: metadata.integrationLevel,
      integrationStrategy: metadata.strategy || undefined, // Convert null to undefined
      integratedAt: metadata.implementedAt,
      capabilities: []
    };
    
    integrations.push(integration);
    localStorage.setItem(key, JSON.stringify(integrations));
  }
  
  /**
   * Get all integrations for a project
   */
  static getProjectIntegrations(projectId: string): IntegratedAgent[] {
    const key = `agent-integrations-${projectId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    
    try {
      return JSON.parse(stored) as IntegratedAgent[];
    } catch (error) {
      console.error('Failed to load integrations:', error);
      return [];
    }
  }
  
  /**
   * Remove integration
   */
  static removeIntegration(projectId: string, integrationId: string): void {
    const key = `agent-integrations-${projectId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return;
    
    try {
      const integrations = JSON.parse(stored);
      const filtered = integrations.filter((i: IntegratedAgent) => i.id !== integrationId);
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to remove integration:', error);
    }
  }
  
  /**
   * Update integration (e.g., toggle enabled state)
   */
  static updateIntegration(
    projectId: string,
    integrationId: string,
    updates: Partial<IntegratedAgent>
  ): void {
    const key = `agent-integrations-${projectId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return;
    
    try {
      const integrations = JSON.parse(stored) as IntegratedAgent[];
      const updated = integrations.map(i =>
        i.id === integrationId ? { ...i, ...updates } : i
      );
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to update integration:', error);
    }
  }
}

