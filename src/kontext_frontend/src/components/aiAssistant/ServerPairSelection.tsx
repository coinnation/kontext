/**
 * Component for selecting or creating a server pair for agent deployment
 */

import React, { useState, useEffect } from 'react';
import { useAppStore, useServerPairDialog, useCredits } from '../../store/appStore';
import { useCanister } from '../../useCanister';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ProgressDialog } from './ProgressDialog';
import { icpPriceService, IcpPriceData } from '../../services/IcpPriceService';

interface ServerPairSelectionProps {
  availableServerPairs: Array<{
    pairId: string;
    name: string;
    frontendCanisterId: string;
    backendCanisterId: string;
  }>;
  onSelect: (serverPairId: string) => void;
  onCancel: () => void;
  onRefreshServerPairs?: () => Promise<void>;
}

export const ServerPairSelection: React.FC<ServerPairSelectionProps> = ({
  availableServerPairs,
  onSelect,
  onCancel,
  onRefreshServerPairs
}) => {
  const { activeProject, userCanisterId, identity, principal } = useAppStore();
  const { actor: mainActor } = useCanister();
  const { createServerPairForExistingProject, calculateServerConfigFromCredits, getMinimumCreditsRequired } = useServerPairDialog();
  const { credits } = useCredits();
  const [selectedServerPairId, setSelectedServerPairId] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [creationProgress, setCreationProgress] = useState<string>('');
  const [localServerPairs, setLocalServerPairs] = useState(availableServerPairs);
  const [icpPriceData, setIcpPriceData] = useState<IcpPriceData | null>(null);
  const [isLoadingIcpPrice, setIsLoadingIcpPrice] = useState(true);

  // Update local server pairs when prop changes
  useEffect(() => {
    setLocalServerPairs(availableServerPairs);
  }, [availableServerPairs]);

  // Initialize ICP price service (consistent with new project flow)
  useEffect(() => {
    const initializeIcpPricing = async () => {
      setIsLoadingIcpPrice(true);
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
      } finally {
        setIsLoadingIcpPrice(false);
      }
    };

    initializeIcpPricing();
  }, []);

  const handleCreateServerPair = async () => {
    if (!activeProject || !userCanisterId || !identity || !principal) {
      alert('Missing required project or authentication information');
      return;
    }

    if (!mainActor) {
      alert('Platform wallet not connected. Please ensure you are authenticated.');
      return;
    }

    if (!icpPriceData) {
      alert('ICP pricing data is loading. Please wait a moment and try again.');
      return;
    }

    setIsCreating(true);
    setCreationProgress('Initializing server pair creation...');

    try {
      // Get project name
      const store = useAppStore.getState();
      const projects = store.projects || [];
      const project = projects.find((p: any) => p.id === activeProject);
      const projectName = project?.name || 'AI Agent Project';

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

      setCreationProgress('Creating server pair...');

      // Use slice method for consistent server pair creation
      const serverPairName = `${projectName} - Agent Server`;
      
      const result = await createServerPairForExistingProject(
        activeProject,
        projectName,
        serverPairName,
        finalCredits,
        mainActor,
        icpPriceData,
        (status: string, progress: number) => {
          setCreationProgress(`${status} (${progress}%)`);
        },
        'AgentServerPair' // Pool type for AI agents
      );

      if (!result.success || !result.serverPairId) {
        throw new Error(result.error || 'Failed to create server pair');
      }

      setCreationProgress('Refreshing server pairs list...');

      // Refresh server pairs list
      if (onRefreshServerPairs) {
        await onRefreshServerPairs();
      } else {
        // Fallback: manually refresh
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
          setLocalServerPairs(pairs);
        }
      }

      // Select the newly created server pair
      setSelectedServerPairId(result.serverPairId);
      setIsCreating(false);
      setShowCreateDialog(false);
    } catch (error) {
      console.error('Server pair creation failed:', error);
      alert(`Failed to create server pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsCreating(false);
    }
  };

  const handleProceed = () => {
    if (!selectedServerPairId) {
      alert('Please select a server pair or create a new one');
      return;
    }
    onSelect(selectedServerPairId);
  };

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0, maxHeight: '100%', overflow: 'hidden', padding: '1rem' }}>
      {/* Header */}
      <div className="flex-shrink-0 mb-4" style={{ paddingBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <h3 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: '#ffffff',
          margin: '0 0 0.5rem 0'
        }}>
          Select Server Pair
        </h3>
        <p style={{
          color: 'var(--text-gray)',
          margin: 0,
          fontSize: '0.95rem',
          lineHeight: 1.4
        }}>
          Choose a server pair to deploy your agent to, or create a new one.
        </p>
      </div>

      {/* Server Pairs List */}
      <div className="flex-1 overflow-y-auto mb-4" style={{ minHeight: 0, paddingRight: '0.5rem' }}>
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {localServerPairs.length > 0 ? (
            localServerPairs.map((pair) => (
              <div
                key={pair.pairId}
                onClick={() => setSelectedServerPairId(pair.pairId)}
                style={{
                  padding: '1.5rem',
                  background: selectedServerPairId === pair.pairId
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${selectedServerPairId === pair.pairId
                    ? 'rgba(255, 107, 53, 0.5)'
                    : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: selectedServerPairId === pair.pairId ? '0 4px 12px rgba(255, 107, 53, 0.2)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (selectedServerPairId !== pair.pairId) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedServerPairId !== pair.pairId) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        background: selectedServerPairId === pair.pairId
                          ? 'rgba(255, 107, 53, 0.2)'
                          : 'rgba(59, 130, 246, 0.15)',
                        border: `1px solid ${selectedServerPairId === pair.pairId
                          ? 'rgba(255, 107, 53, 0.4)'
                          : 'rgba(59, 130, 246, 0.3)'}`,
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        flexShrink: 0
                      }}>
                        🖥️
                      </div>
                      <h4 style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: '#ffffff',
                        margin: 0
                      }}>
                        {pair.name}
                      </h4>
                    </div>
                    <div style={{
                      marginLeft: '2.75rem',
                      fontSize: '0.8125rem',
                      color: 'rgba(255, 255, 255, 0.5)',
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'
                    }}>
                      Backend: {pair.backendCanisterId.slice(0, 20)}...
                    </div>
                  </div>
                  {selectedServerPairId === pair.pairId && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#10B981',
                      flexShrink: 0
                    }}>
                      <span>✓</span>
                      <span>Selected</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div style={{
              padding: '2rem',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              textAlign: 'center',
              color: 'var(--text-gray)'
            }}>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.95rem' }}>
                No server pairs available. Create a new one to continue.
              </p>
            </div>
          )}

          {/* Create New Server Pair Button */}
          <button
            onClick={() => setShowCreateDialog(true)}
            disabled={isCreating}
            style={{
              padding: '1.5rem',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '2px dashed rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              color: '#3B82F6',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: isCreating ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              opacity: isCreating ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!isCreating) {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isCreating) {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
              }
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>➕</span>
            <span>Create New Server Pair</span>
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 flex-shrink-0" style={{ paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
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
        <button
          onClick={handleProceed}
          disabled={!selectedServerPairId}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            background: selectedServerPairId
              ? 'linear-gradient(135deg, #10B981, #059669)'
              : 'rgba(16, 185, 129, 0.3)',
            border: 'none',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: selectedServerPairId ? 'pointer' : 'not-allowed',
            opacity: selectedServerPairId ? 1 : 0.5,
            transition: 'all 0.2s ease',
            boxShadow: selectedServerPairId ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none',
            minHeight: '44px'
          }}
          onMouseEnter={(e) => {
            if (selectedServerPairId) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = selectedServerPairId ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none';
          }}
        >
          Continue
        </button>
      </div>

      {/* Create Server Pair Dialog */}
      {showCreateDialog && (
        <ConfirmationDialog
          isOpen={showCreateDialog}
          title="Create New Server Pair"
          message="Create a new server pair for this agent? This will allocate credits (default: 4,500, minimum: 2,500)."
          type="info"
          onConfirm={handleCreateServerPair}
          onCancel={() => {
            setShowCreateDialog(false);
          }}
          confirmLabel="Create Server Pair"
          cancelLabel="Cancel"
        />
      )}

      {/* Server Pair Creation Progress */}
      {isCreating && (
        <ProgressDialog
          isOpen={isCreating}
          title="Creating Server Pair"
          message={creationProgress || "Creating server pair..."}
          phase="creating"
          progress={0}
          onClose={() => {
            // Don't allow closing during creation
          }}
        />
      )}
    </div>
  );
};

