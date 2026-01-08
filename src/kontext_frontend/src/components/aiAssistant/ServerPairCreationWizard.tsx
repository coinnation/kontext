/**
 * Wizard for creating multiple server pairs needed for workflow agents
 * Each agent requires its own server pair (frontend + backend canister)
 */

import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { useCanister } from '../../useCanister';
import { ProgressDialog } from './ProgressDialog';

interface ServerPairCreationWizardProps {
  requiredCount: number; // How many server pairs are needed
  existingCount: number; // How many server pairs already exist
  projectId: string;
  projectName: string;
  onComplete: (createdServerPairIds: string[]) => void;
  onCancel: () => void;
}

interface ServerPairCreationStatus {
  index: number;
  status: 'pending' | 'creating' | 'success' | 'error';
  pairId?: string;
  error?: string;
  progress?: number;
}

export const ServerPairCreationWizard: React.FC<ServerPairCreationWizardProps> = ({
  requiredCount,
  existingCount,
  projectId,
  projectName,
  onComplete,
  onCancel
}) => {
  const userCanisterId = useAppStore((state) => state.userCanisterId);
  const identity = useAppStore((state) => state.identity);
  const { actor: mainActor } = useCanister();
  
  const [icpPriceData, setIcpPriceData] = useState<any>(null);
  const [creationStatuses, setCreationStatuses] = useState<ServerPairCreationStatus[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [creditsToAllocate, setCreditsToAllocate] = useState<number>(4500); // Default credits per server pair
  const [creditsInput, setCreditsInput] = useState<string>('4500');
  const credits = useAppStore((state) => state.credits);

  const pairsNeeded = Math.max(0, requiredCount - existingCount);

  // Initialize: Fetch ICP price and prepare creation statuses
  useEffect(() => {
    const initialize = async () => {
      setIsInitializing(true);
      
      // Fetch ICP price
      try {
        const response = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=ICP');
        if (response.ok) {
          const data = await response.json();
          const usdPrice = parseFloat(data.data.rates.USD);
          setIcpPriceData({ price: usdPrice });
        } else {
          setIcpPriceData({ price: 10.0 });
        }
      } catch (error) {
        console.warn('Could not fetch ICP price, using fallback:', error);
        setIcpPriceData({ price: 10.0 });
      }

      // Initialize creation statuses for each pair needed
      const statuses: ServerPairCreationStatus[] = Array.from({ length: pairsNeeded }, (_, i) => ({
        index: i + 1,
        status: 'pending'
      }));
      setCreationStatuses(statuses);
      
      setIsInitializing(false);
    };

    initialize();
  }, [pairsNeeded]);

  const createAllServerPairs = async () => {
    if (!userCanisterId || !identity || !mainActor || !icpPriceData) {
      alert('Missing required information. Please ensure you are authenticated.');
      return;
    }

    if (pairsNeeded === 0) {
      onComplete([]);
      return;
    }

    // Validate credits
    const userCredits = credits?.balance || 0;
    if (userCredits < 2500) {
      alert(`Insufficient credits. You need at least 2,500 credits to create a server pair, but you only have ${userCredits.toLocaleString()}.`);
      return;
    }

    if (creditsToAllocate < 2500) {
      alert('Minimum credits per server pair is 2,500. Please increase the amount.');
      return;
    }

    const totalCreditsNeeded = creditsToAllocate * pairsNeeded;
    if (totalCreditsNeeded > userCredits) {
      alert(`Insufficient credits. You need ${totalCreditsNeeded.toLocaleString()} credits to create ${pairsNeeded} server pair(s) (${creditsToAllocate.toLocaleString()} each), but you only have ${userCredits.toLocaleString()}.`);
      return;
    }

    const createdPairIds: string[] = [];
    
    // Create server pairs sequentially (one at a time to avoid overwhelming the system)
    for (let i = 0; i < pairsNeeded; i++) {
      const statusIndex = i;
      
      // Update status to creating
      setCreationStatuses(prev => {
        const updated = [...prev];
        updated[statusIndex] = {
          ...updated[statusIndex],
          status: 'creating',
          progress: 0
        };
        return updated;
      });

      try {
        const { userCanisterService } = await import('../../services/UserCanisterService');
        
        const serverPairName = `${projectName} - Agent ${i + 1}`;
        
        // Validate credits amount
        const finalCredits = Math.max(2500, Math.min(creditsToAllocate, credits?.balance || creditsToAllocate));
        
        const serverPairResult = await userCanisterService.createCompleteServerPairForProject(
          serverPairName,
          finalCredits,
          projectId,
          projectName,
          userCanisterId,
          identity,
          mainActor,
          icpPriceData,
          true, // createHosting
          (status: string, progress: number) => {
            // Update progress for this specific pair
            setCreationStatuses(prev => {
              const updated = [...prev];
              updated[statusIndex] = {
                ...updated[statusIndex],
                progress: Math.min(progress, 95) // Cap at 95% until complete
              };
              return updated;
            });
          },
          'AgentServerPair' // Pool type for AI agents
        );

        if (serverPairResult.success && serverPairResult.serverPairId) {
          createdPairIds.push(serverPairResult.serverPairId);
          
          // Update status to success
          setCreationStatuses(prev => {
            const updated = [...prev];
            updated[statusIndex] = {
              ...updated[statusIndex],
              status: 'success',
              pairId: serverPairResult.serverPairId,
              progress: 100
            };
            return updated;
          });
        } else {
          throw new Error(serverPairResult.error || 'Failed to create server pair');
        }
      } catch (error) {
        console.error(`Failed to create server pair ${i + 1}:`, error);
        
        // Update status to error
        setCreationStatuses(prev => {
          const updated = [...prev];
          updated[statusIndex] = {
            ...updated[statusIndex],
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
          return updated;
        });
        
        // Stop creation on first error
        alert(`Failed to create server pair ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}\n\nCreation stopped. You can retry or create server pairs manually.`);
        return;
      }
    }

    // All pairs created successfully
    if (createdPairIds.length === pairsNeeded) {
      onComplete(createdPairIds);
    }
  };

  const allComplete = creationStatuses.every(s => s.status === 'success');
  const hasErrors = creationStatuses.some(s => s.status === 'error');
  const isCreating = creationStatuses.some(s => s.status === 'creating');
  const userCredits = credits?.balance || 0;
  const totalCreditsNeeded = creditsToAllocate * pairsNeeded;
  const canCreate = !isCreating && !allComplete && !hasErrors && 
                    creditsToAllocate >= 2500 && 
                    userCredits >= 2500 && 
                    totalCreditsNeeded <= userCredits;

  if (isInitializing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ minHeight: 0 }}>
        <div className="animate-spin" style={{
          width: '32px',
          height: '32px',
          border: '3px solid rgba(139, 92, 246, 0.3)',
          borderTopColor: '#8B5CF6',
          borderRadius: '50%'
        }} />
        <p className="text-gray-400 mt-4">Preparing server pair creation...</p>
      </div>
    );
  }

  if (pairsNeeded === 0) {
    return (
      <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
        <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-lg mb-4">
          <p className="text-green-400 text-sm">
            ✓ You have {existingCount} server pair(s), which is sufficient for this workflow.
          </p>
        </div>
        <div className="flex gap-3">
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
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onComplete([])}
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
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0, maxHeight: '100%', overflow: 'hidden' }}>
      <div className="mb-4 flex-shrink-0">
        <h3 className="text-lg font-bold text-white mb-2">
          Create Server Pairs for Workflow
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          This workflow requires <strong>{requiredCount} agent(s)</strong>, which means you need{' '}
          <strong>{requiredCount} server pair(s)</strong> (one per agent). You currently have{' '}
          <strong>{existingCount} server pair(s)</strong>, so we need to create{' '}
          <strong>{pairsNeeded} more</strong>.
        </p>
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-4">
          <p className="text-blue-400 text-xs mb-3">
            💡 <strong>Note:</strong> Each agent requires its own dedicated server pair (frontend + backend canister).
          </p>
          <div>
            <label className="block text-xs font-semibold text-white mb-2">
              Credits per Server Pair (Minimum: 2,500)
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={creditsInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setCreditsInput(value);
                  const numValue = parseInt(value, 10);
                  if (!isNaN(numValue)) {
                    setCreditsToAllocate(Math.max(2500, Math.min(numValue, credits?.balance || numValue)));
                  }
                }}
                onBlur={() => {
                  const numValue = parseInt(creditsInput, 10);
                  if (isNaN(numValue) || numValue < 2500) {
                    setCreditsInput('4500');
                    setCreditsToAllocate(4500);
                  } else {
                    const finalValue = Math.min(numValue, credits?.balance || numValue);
                    setCreditsInput(finalValue.toString());
                    setCreditsToAllocate(finalValue);
                  }
                }}
                min={2500}
                max={credits?.balance || 999999}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '0.875rem'
                }}
              />
              <span className="text-xs text-gray-400 whitespace-nowrap">
                (Available: {credits?.balance?.toLocaleString() || '0'})
              </span>
            </div>
            {creditsToAllocate < 2500 && (
              <p className="text-red-400 text-xs mt-1">Minimum is 2,500 credits</p>
            )}
            {credits?.balance && creditsToAllocate > credits.balance && (
              <p className="text-red-400 text-xs mt-1">Insufficient credits. You have {credits.balance.toLocaleString()} available.</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mb-4" style={{ minHeight: 0 }}>
        <div className="space-y-3">
          {creationStatuses.map((status, index) => (
            <div
              key={index}
              style={{
                padding: '1rem',
                background: status.status === 'success'
                  ? 'rgba(16, 185, 129, 0.1)'
                  : status.status === 'error'
                  ? 'rgba(239, 68, 68, 0.1)'
                  : status.status === 'creating'
                  ? 'rgba(59, 130, 246, 0.1)'
                  : 'rgba(245, 158, 11, 0.1)',
                border: `1px solid ${
                  status.status === 'success'
                    ? 'rgba(16, 185, 129, 0.3)'
                    : status.status === 'error'
                    ? 'rgba(239, 68, 68, 0.3)'
                    : status.status === 'creating'
                    ? 'rgba(59, 130, 246, 0.3)'
                    : 'rgba(245, 158, 11, 0.3)'
                }`,
                borderRadius: '8px'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {status.status === 'success' && (
                    <span className="text-green-400 text-xl">✓</span>
                  )}
                  {status.status === 'error' && (
                    <span className="text-red-400 text-xl">✗</span>
                  )}
                  {status.status === 'creating' && (
                    <div className="animate-spin" style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid rgba(59, 130, 246, 0.3)',
                      borderTopColor: '#3B82F6',
                      borderRadius: '50%'
                    }} />
                  )}
                  {status.status === 'pending' && (
                    <span className="text-yellow-400 text-xl">⏳</span>
                  )}
                  <span className="text-white font-semibold">
                    Server Pair {status.index}
                  </span>
                </div>
                {status.pairId && (
                  <span className="text-xs text-gray-400 font-mono">
                    {status.pairId.slice(0, 8)}...
                  </span>
                )}
              </div>
              
              {status.status === 'creating' && status.progress !== undefined && (
                <div className="mt-2">
                  <div style={{
                    width: '100%',
                    height: '4px',
                    background: 'rgba(59, 130, 246, 0.2)',
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${status.progress}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #3B82F6, #2563EB)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <p className="text-xs text-blue-400 mt-1">{status.progress}%</p>
                </div>
              )}
              
              {status.status === 'error' && status.error && (
                <p className="text-xs text-red-400 mt-2">{status.error}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 flex-shrink-0">
        <button
          onClick={onCancel}
          disabled={isCreating}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            background: 'rgba(107, 114, 128, 0.2)',
            border: '1px solid rgba(107, 114, 128, 0.3)',
            borderRadius: '8px',
            color: '#9CA3AF',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: isCreating ? 'not-allowed' : 'pointer',
            opacity: isCreating ? 0.5 : 1
          }}
        >
          Cancel
        </button>
        <button
          onClick={createAllServerPairs}
          disabled={!canCreate}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            background: allComplete
              ? 'linear-gradient(135deg, #10B981, #059669)'
              : isCreating
              ? 'rgba(59, 130, 246, 0.3)'
              : canCreate
              ? 'linear-gradient(135deg, #3B82F6, #2563EB)'
              : 'rgba(107, 114, 128, 0.3)',
            border: 'none',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: canCreate ? 'pointer' : 'not-allowed',
            opacity: canCreate ? 1 : 0.6
          }}
        >
          {allComplete
            ? `All ${pairsNeeded} Server Pairs Created ✓`
            : isCreating
            ? 'Creating Server Pairs...'
            : !canCreate && creditsToAllocate < 2500
            ? 'Minimum 2,500 Credits Required'
            : !canCreate && totalCreditsNeeded > userCredits
            ? `Need ${totalCreditsNeeded.toLocaleString()} Credits`
            : `Create ${pairsNeeded} Server Pair(s)`}
        </button>
      </div>
    </div>
  );
};

