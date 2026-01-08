/**
 * Wizard for resolving dependencies before entity creation
 */

import React, { useState, useEffect } from 'react';
import type { AgentSpec, WorkflowSpec, BusinessAgencySpec, DependencyAnalysis } from '../../types/agentSpec';
import { useAppStore, useServerPairDialog, useCredits } from '../../store/appStore';
import { useCanister } from '../../useCanister';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ProgressDialog } from './ProgressDialog';
import { icpPriceService, IcpPriceData } from '../../services/IcpPriceService';

interface DependencyResolutionWizardProps {
  spec: AgentSpec | WorkflowSpec | BusinessAgencySpec;
  specType: 'agent' | 'workflow' | 'agency';
  onResolve: (resolved: any) => void;
  onCancel: () => void;
}

export const DependencyResolutionWizard: React.FC<DependencyResolutionWizardProps> = ({
  spec,
  specType,
  onResolve,
  onCancel
}) => {
  const { activeProject, userCanisterId, identity } = useAppStore();
  const { actor: mainActor } = useCanister();
  const { createServerPairForExistingProject, calculateServerConfigFromCredits, getMinimumCreditsRequired } = useServerPairDialog();
  const { credits } = useCredits();
  const [currentStep, setCurrentStep] = useState(0);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [serverPairs, setServerPairs] = useState<any[]>([]);
  const [mcpAuthValues, setMcpAuthValues] = useState<Record<string, string>>({});
  const [showAuthModal, setShowAuthModal] = useState<string | null>(null);
  const [authInput, setAuthInput] = useState('');
  const [icpPriceData, setIcpPriceData] = useState<IcpPriceData | null>(null);
  const [createdServerPairId, setCreatedServerPairId] = useState<string | null>(null);
  const [showCreateServerPairConfirm, setShowCreateServerPairConfirm] = useState(false);
  const [showExternalSetupConfirm, setShowExternalSetupConfirm] = useState<{ index: number; setup: any } | null>(null);
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  // Extract dependencies from spec (handle different spec types)
  const dependencies = spec.dependencies || {
    requiresServerPair: false,
    requiresServerPairs: 0,
    requiresAgents: [],
    requiresWorkflows: [],
    requiresMcpAuth: [],
    requiresExternalSetup: []
  };

  // Type-safe accessors for different dependency structures
  const needsServerPair = (dependencies as any).requiresServerPair === true || 
                         ((dependencies as any).requiresServerPairs && (dependencies as any).requiresServerPairs > 0);
  const serverPairCount = (dependencies as any).requiresServerPairs || 
                         ((dependencies as any).requiresServerPair ? 1 : 0);
  const mcpAuth = (dependencies as any).requiresMcpAuth || [];
  const externalSetup = (dependencies as any).requiresExternalSetup || [];

  // Initialize ICP price service (consistent with new project flow)
  useEffect(() => {
    const initializeIcpPricing = async () => {
      try {
        const priceData = await icpPriceService.getCurrentPrice();
        setIcpPriceData(priceData);
      } catch (error) {
        console.error('Failed to initialize ICP pricing:', error);
        // Fallback to default price
        setIcpPriceData({ 
          price: 10.0, 
          timestamp: Date.now(),
          source: 'cryptocompare' as const,
          cacheAge: 0 
        });
      }
    };

    initializeIcpPricing();
  }, []);

  // Check for existing server pairs on mount
  useEffect(() => {
    const checkServerPairs = async () => {
      if (!activeProject || !userCanisterId || !identity) {
        setIsCheckingServerPairs(false);
        return;
      }
      
      setIsCheckingServerPairs(true);
      
      try {
        const { userCanisterService } = await import('../../services/UserCanisterService');
        const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
        const pairsResult = await userActor.getProjectServerPairs(activeProject);
        
        if (pairsResult && 'ok' in pairsResult) {
          const pairs = pairsResult.ok.map((pair: any) => ({
            pairId: pair.pairId,
            name: pair.name,
            createdAt: Number(pair.createdAt) / 1_000_000,
            creditsAllocated: Number(pair.creditsAllocated),
            frontendCanisterId: pair.frontendCanisterId.toText(),
            backendCanisterId: pair.backendCanisterId.toText()
          }));
          setServerPairs(pairs);
          // Auto-resolve if server pairs exist
          if (pairs.length > 0 && needsServerPair) {
            setResolved(prev => new Set([...prev, 'server_pair']));
          }
        }
      } catch (error) {
        console.error('Failed to check server pairs:', error);
      } finally {
        setIsCheckingServerPairs(false);
      }
    };
    checkServerPairs();
  }, [activeProject, userCanisterId, identity]);

  const [isCreatingServerPair, setIsCreatingServerPair] = useState(false);
  const [serverPairProgress, setServerPairProgress] = useState<string>('');
  const [isCheckingServerPairs, setIsCheckingServerPairs] = useState(true);

  const handleResolveServerPair = async () => {
    if (serverPairs.length > 0) {
      // Server pair exists, mark as resolved
      setResolved(prev => new Set([...prev, 'server_pair']));
      return;
    }

    // No server pair - show confirmation dialog
    setShowCreateServerPairConfirm(true);
  };

  const handleConfirmCreateServerPair = async () => {
    setShowCreateServerPairConfirm(false);

    // Create server pair automatically
    setIsCreatingServerPair(true);
    setServerPairProgress('Initializing server pair creation...');

    try {
      if (!activeProject || !userCanisterId || !identity) {
        throw new Error('Missing required project or authentication information');
      }

      // Get project name
      const store = useAppStore.getState();
      const projects = store.projects || [];
      const project = projects.find((p: any) => p.id === activeProject);
      const projectName = project?.name || 'AI Agent Project';

      // Validate we have required dependencies
      if (!mainActor) {
        throw new Error('Platform wallet not connected. Please ensure you are authenticated and try again.');
      }

      if (!icpPriceData || !icpPriceData.price) {
        throw new Error('ICP pricing data unavailable. Please check your connection and try again.');
      }

      // Use consistent credits calculation (same as new project flow)
      const defaultCredits = 4400; // Same default as new project flow
      const minimumCredits = getMinimumCreditsRequired();
      const userCredits = credits?.balance || 0;
      
      if (userCredits < minimumCredits) {
        throw new Error(`Insufficient credits. You need at least ${minimumCredits.toLocaleString()} credits to create a server pair, but you only have ${userCredits.toLocaleString()}.`);
      }

      // Use same credits calculation as new project flow
      const finalCredits = Math.max(minimumCredits, Math.min(defaultCredits, userCredits));

      // Validate server config
      const serverConfig = calculateServerConfigFromCredits(finalCredits);
      if (!serverConfig.canCreateServers) {
        throw new Error(serverConfig.message);
      }

      setServerPairProgress('Creating canisters and allocating credits...');

      // Use slice method for consistent server pair creation
      const result = await createServerPairForExistingProject(
        activeProject,
        projectName,
        'AI Agent Server Pair',
        finalCredits,
        mainActor,
        icpPriceData,
        (status: string, progress: number) => {
          setServerPairProgress(`${status} (${progress}%)`);
        }
      );

      if (!result.success || !result.serverPairId) {
        throw new Error(result.error || 'Failed to create server pair');
      }

      const serverPairResult = { success: true, serverPairId: result.serverPairId };

      // Refresh server pairs list
      const { userCanisterService } = await import('../../services/UserCanisterService');
      const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
      const pairsResult = await userActor.getProjectServerPairs(activeProject);
      
      if (pairsResult && 'ok' in pairsResult) {
        const pairs = pairsResult.ok.map((pair: any) => ({
          pairId: pair.pairId,
          name: pair.name,
          createdAt: Number(pair.createdAt) / 1_000_000,
          creditsAllocated: Number(pair.creditsAllocated),
          frontendCanisterId: pair.frontendCanisterId.toText(),
          backendCanisterId: pair.backendCanisterId.toText()
        }));
        setServerPairs(pairs);
      }

      // Mark as resolved (store server pair ID for later use)
      const newResolved = new Set([...resolved, 'server_pair']);
      setResolved(newResolved);
      
      // Store server pair ID for when user clicks "Proceed"
      if (serverPairResult.serverPairId) {
        setCreatedServerPairId(serverPairResult.serverPairId);
      }
      
      setServerPairProgress('Server pair created successfully!');
      
      // Show success message
      setTimeout(() => {
        setServerPairProgress('');
        setAlertDialog({
          isOpen: true,
          title: 'Server Pair Created',
          message: 'Server pair created successfully! Infrastructure is ready for agent deployment.',
          type: 'success'
        });
      }, 500);

    } catch (error) {
      console.error('Failed to create server pair:', error);
      setServerPairProgress('');
      setAlertDialog({
        isOpen: true,
        title: 'Creation Failed',
        message: `Failed to create server pair: ${error instanceof Error ? error.message : 'Unknown error'}\n\nYou can create one manually in the Deploy tab.`,
        type: 'error'
      });
    } finally {
      setIsCreatingServerPair(false);
    }
  };

  const handleResolveMcpAuth = (authIndex: number, auth: any) => {
    setShowAuthModal(`mcp_auth_${authIndex}`);
    setAuthInput('');
  };

  const handleSaveAuth = async (authIndex: number, auth: any) => {
    if (!authInput.trim()) {
      setAlertDialog({
        isOpen: true,
        title: 'Input Required',
        message: 'Please enter an API key or token',
        type: 'error'
      });
      return;
    }
    
    // Fetch MCP server configuration to get the correct authTokenKey
    let authTokenKey = auth.serverId; // Default to serverId
    
    try {
      // Try to fetch MCP server details from backend to get authTokenKey
      const response = await fetch(`https://ai.coinnation.io/api/mcp/mcp-servers/${auth.serverId}`);
      if (response.ok) {
        const serverConfig = await response.json();
        if (serverConfig.authTokenKey) {
          authTokenKey = serverConfig.authTokenKey;
        }
      }
    } catch (error) {
      console.warn('Could not fetch MCP server config, using serverId as key:', error);
      // Fallback: try to construct the token key from serverId
      // Common pattern: ZAPIER_AUTH_TOKEN, RUBE_AUTH_TOKEN, etc.
      const serverIdUpper = auth.serverId.toUpperCase();
      authTokenKey = `${serverIdUpper}_AUTH_TOKEN`;
    }
    
    // Store the auth value with the correct token key name
    setMcpAuthValues(prev => ({
      ...prev,
      [authTokenKey]: authInput,
      // Also store with serverId for backward compatibility
      [auth.serverId]: authInput
    }));
    
    // Mark as resolved
    setResolved(prev => new Set([...prev, `mcp_auth_${authIndex}`]));
    setShowAuthModal(null);
    setAuthInput('');
    
    setAlertDialog({
      isOpen: true,
      title: 'Authentication Configured',
      message: `Authentication configured for ${auth.serverId} (${authTokenKey}).\n\nNote: In production, this would be stored securely.`,
      type: 'success'
    });
    
    // Auto-close after 2 seconds to allow user to continue
    setTimeout(() => {
      setAlertDialog(prev => ({ ...prev, isOpen: false }));
    }, 2000);
  };

  const handleResolveExternal = (index: number, setup: any) => {
    // For external setup, we just mark it as acknowledged
    // The user needs to do this manually
    setShowExternalSetupConfirm({ index, setup });
  };

  const handleConfirmExternalSetup = (index: number) => {
    setResolved(prev => new Set([...prev, `external_${index}`]));
    setShowExternalSetupConfirm(null);
  };

  const allResolved = () => {
    const totalDeps = 
      (needsServerPair ? 1 : 0) +
      (mcpAuth.length || 0) +
      (externalSetup.length || 0);
    
    const isResolved = resolved.size === totalDeps && totalDeps > 0;
    
    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log('Dependency Resolution Check:', {
        totalDeps,
        resolvedCount: resolved.size,
        resolved: Array.from(resolved),
        isResolved,
        needsServerPair,
        mcpAuthCount: mcpAuth.length,
        externalSetupCount: externalSetup.length
      });
    }
    
    return isResolved;
  };

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0, maxHeight: '100%', overflow: 'hidden' }}>
      <h3 className="text-lg font-bold text-white mb-4 flex-shrink-0">Resolve Dependencies</h3>
      
      <div className="flex-1 overflow-y-auto mb-4" style={{ minHeight: 0 }}>
        {/* Dependency list - centered with max-width like project creation dialog */}
        <div className="space-y-3" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          {/* Server Pair */}
          {needsServerPair && (
            <>
              <DependencyItem
                id="server_pair"
                type="server_pair"
                message={`Need ${serverPairCount} server pair(s) for deployment`}
                resolved={resolved.has('server_pair')}
                onResolve={handleResolveServerPair}
                serverPairs={serverPairs}
                isCreating={isCreatingServerPair}
                isLoading={isCheckingServerPairs}
              />
              {isCreatingServerPair && serverPairProgress && (
                <div style={{
                  padding: '0.75rem',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '8px',
                  marginTop: '0.5rem'
                }}>
                  <div className="flex items-center gap-2">
                    <div className="animate-spin" style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(59, 130, 246, 0.3)',
                      borderTopColor: '#3B82F6',
                      borderRadius: '50%'
                    }} />
                    <span className="text-blue-400 text-sm">{serverPairProgress}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* MCP Auth */}
          {dependencies.requiresMcpAuth && dependencies.requiresMcpAuth.map((auth, idx) => (
            <DependencyItem
              key={`mcp_auth_${idx}`}
              id={`mcp_auth_${idx}`}
              type="mcp_auth"
              message={`Configure ${auth.authType} authentication for ${auth.serverId}`}
              resolved={resolved.has(`mcp_auth_${idx}`)}
              onResolve={() => handleResolveMcpAuth(idx, auth)}
              authInfo={auth}
            />
          ))}

          {/* External Setup */}
          {externalSetup && externalSetup.map((setup: any, idx: number) => (
            <DependencyItem
              key={`external_${idx}`}
              id={`external_${idx}`}
              type="external_setup"
              message={`${setup.service}: ${setup.action}`}
              resolved={resolved.has(`external_${idx}`)}
              onResolve={() => handleResolveExternal(idx, setup)}
              setupInfo={setup}
            />
          ))}
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 10001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--primary-black)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1.5rem',
            maxWidth: '500px',
            width: '100%'
          }}>
            <h4 className="text-lg font-bold text-white mb-2">
              Configure Authentication
            </h4>
            {dependencies.requiresMcpAuth && (() => {
              const authIndex = parseInt(showAuthModal.split('_')[2]);
              const auth = dependencies.requiresMcpAuth[authIndex];
              return (
                <>
                  <p className="text-gray-400 text-sm mb-4">
                    {auth.instructions || `Enter your ${auth.authType} for ${auth.serverId}`}
                  </p>
                  <input
                    type="password"
                    value={authInput}
                    onChange={(e) => setAuthInput(e.target.value)}
                    placeholder={`Enter ${auth.authType}...`}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.875rem',
                      marginBottom: '1rem'
                    }}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowAuthModal(null);
                        setAuthInput('');
                      }}
                      style={{
                        flex: 1,
                        padding: '0.75rem 1.5rem',
                        background: 'rgba(107, 114, 128, 0.2)',
                        border: '1px solid rgba(107, 114, 128, 0.3)',
                        borderRadius: '8px',
                        color: '#9CA3AF',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveAuth(authIndex, auth)}
                      style={{
                        flex: 1,
                        padding: '0.75rem 1.5rem',
                        background: 'linear-gradient(135deg, #10B981, #059669)',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Save
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-shrink-0" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            background: 'rgba(107, 114, 128, 0.2)',
            border: '1px solid rgba(107, 114, 128, 0.3)',
            borderRadius: '8px',
            color: '#9CA3AF',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(107, 114, 128, 0.3)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(107, 114, 128, 0.2)';
            e.currentTarget.style.color = '#9CA3AF';
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => {
            const serverPairId = createdServerPairId || 
              (serverPairs.length > 0 ? serverPairs[0].pairId : '');
            onResolve({ 
              resolved: Array.from(resolved), 
              mcpAuthValues,
              serverPairId 
            });
          }}
          disabled={!allResolved()}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            background: allResolved()
              ? 'linear-gradient(135deg, #10B981, #059669)'
              : 'rgba(16, 185, 129, 0.3)',
            border: 'none',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: allResolved() ? 'pointer' : 'not-allowed',
            opacity: allResolved() ? 1 : 0.5,
            transition: 'all 0.2s ease',
            boxShadow: allResolved() ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
          }}
          onMouseEnter={(e) => {
            if (allResolved()) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            if (allResolved()) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
            }
          }}
        >
          {allResolved() ? 'Proceed' : `Resolve ${Array.from(resolved).length}/${(needsServerPair ? 1 : 0) + (mcpAuth.length || 0) + (externalSetup.length || 0)} Dependencies`}
        </button>
      </div>

      {/* Confirmation Dialog for Server Pair Creation */}
      <ConfirmationDialog
        isOpen={showCreateServerPairConfirm}
        title="Create Server Pair?"
        message="No server pair found. Would you like to create one automatically?\n\nThis will:\n1. Create frontend and backend canisters\n2. Allocate credits\n3. Set up the server pair infrastructure\n\nClick Confirm to proceed, or Cancel to create manually later."
        confirmLabel="Create Server Pair"
        cancelLabel="Cancel"
        type="info"
        onConfirm={handleConfirmCreateServerPair}
        onCancel={() => setShowCreateServerPairConfirm(false)}
      />

      {/* Confirmation Dialog for External Setup */}
      {showExternalSetupConfirm && (
        <ConfirmationDialog
          isOpen={!!showExternalSetupConfirm}
          title="External Setup Required"
          message={`Service: ${showExternalSetupConfirm.setup.service}\nAction: ${showExternalSetupConfirm.setup.action}\nReason: ${showExternalSetupConfirm.setup.reason}\n\nHave you completed this setup?`}
          confirmLabel="Yes, Completed"
          cancelLabel="Not Yet"
          type="warning"
          onConfirm={() => handleConfirmExternalSetup(showExternalSetupConfirm.index)}
          onCancel={() => setShowExternalSetupConfirm(null)}
        />
      )}

      {/* Alert Dialog for Success/Error Messages */}
      <ProgressDialog
        isOpen={alertDialog.isOpen}
        title={alertDialog.title}
        message={alertDialog.message}
        phase={alertDialog.type === 'success' ? 'success' : alertDialog.type === 'error' ? 'error' : 'generating'}
        onClose={() => {
          setAlertDialog(prev => ({ ...prev, isOpen: false }));
          // Force a re-render to update the Proceed button state
          setTimeout(() => {
            // Trigger a state update to ensure button is enabled
            setResolved(prev => new Set(prev));
          }, 100);
        }}
      />
    </div>
  );
};

const DependencyItem: React.FC<{
  id: string;
  type: string;
  message: string;
  resolved: boolean;
  onResolve: () => void;
  serverPairs?: any[];
  authInfo?: any;
  setupInfo?: any;
  isCreating?: boolean;
  isLoading?: boolean;
}> = ({ id, type, message, resolved, onResolve, serverPairs, authInfo, setupInfo, isCreating, isLoading = false }) => {
  const getActionLabel = () => {
    if (isLoading) return 'Checking...';
    if (resolved) return 'Resolved';
    if (type === 'server_pair') {
      return serverPairs && serverPairs.length > 0 ? 'Verify' : 'Create';
    }
    if (type === 'mcp_auth') {
      return 'Configure';
    }
    if (type === 'external_setup') {
      return 'Acknowledge';
    }
    return 'Resolve';
  };

  return (
    <div style={{
      padding: '1.25rem',
      background: resolved 
        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05))' 
        : isLoading
        ? 'rgba(59, 130, 246, 0.05)'
        : 'rgba(255, 255, 255, 0.03)',
      border: `1px solid ${resolved 
        ? 'rgba(16, 185, 129, 0.3)' 
        : isLoading
        ? 'rgba(59, 130, 246, 0.3)'
        : 'var(--border-color)'}`,
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      transition: 'all 0.2s ease',
      boxShadow: resolved ? '0 4px 12px rgba(16, 185, 129, 0.1)' : 'none'
    }}>
      <div className="flex items-center gap-3 flex-1">
        {isLoading ? (
          <div className="animate-spin" style={{
            width: '20px',
            height: '20px',
            border: '2px solid rgba(59, 130, 246, 0.3)',
            borderTopColor: '#3B82F6',
            borderRadius: '50%'
          }} />
        ) : resolved ? (
          <span className="text-green-400" style={{ fontSize: '1.25rem' }}>✓</span>
        ) : (
          <span className="text-yellow-400" style={{ fontSize: '1.25rem' }}>⚠</span>
        )}
        <span className="text-white text-sm">
          {isLoading && type === 'server_pair' ? 'Checking for existing server pairs...' : message}
        </span>
      </div>
      <button
        onClick={onResolve}
        disabled={resolved || isCreating || isLoading}
        style={{
          padding: '0.5rem 1rem',
          background: resolved 
            ? 'rgba(16, 185, 129, 0.2)' 
            : isCreating || isLoading
            ? 'rgba(107, 114, 128, 0.2)'
            : 'rgba(59, 130, 246, 0.15)',
          border: `1px solid ${resolved 
            ? 'rgba(16, 185, 129, 0.3)' 
            : isCreating || isLoading
            ? 'rgba(107, 114, 128, 0.3)'
            : 'rgba(59, 130, 246, 0.3)'}`,
          borderRadius: '6px',
          color: resolved ? '#10B981' : (isCreating || isLoading) ? '#9CA3AF' : '#3B82F6',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: (resolved || isCreating || isLoading) ? 'not-allowed' : 'pointer',
          opacity: (resolved || isCreating || isLoading) ? 0.7 : 1
        }}
      >
        {isCreating ? 'Creating...' : getActionLabel()}
      </button>
    </div>
  );
};

const OverviewStep: React.FC = () => {
  return <div>Overview</div>;
};

