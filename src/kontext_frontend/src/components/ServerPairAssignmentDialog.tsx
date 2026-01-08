import React, { useState, useEffect } from 'react';
import { Identity } from '@dfinity/agent';
import { userCanisterService } from '../services/UserCanisterService';

interface ServerPairAssignmentDialogProps {
  projectId: string;
  projectName: string;
  userCanisterId?: string | null;
  identity?: Identity | null;
  onClose: () => void;
  onAssignmentComplete: () => void;
}

interface AvailableServerPair {
  pairId: string;
  name: string;
  frontendCanisterId: string;
  backendCanisterId: string;
  createdAt: number;
  creditsAllocated: number;
  currentProjectId?: string;
  currentProjectName?: string;
  canReassign: boolean;
}

// Mobile responsiveness helper
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

export const ServerPairAssignmentDialog: React.FC<ServerPairAssignmentDialogProps> = ({
  projectId,
  projectName,
  userCanisterId,
  identity,
  onClose,
  onAssignmentComplete
}) => {
  const isMobile = useIsMobile();
  
  // State management
  const [availableServerPairs, setAvailableServerPairs] = useState<AvailableServerPair[]>([]);
  const [selectedServerPairId, setSelectedServerPairId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignmentProgress, setAssignmentProgress] = useState<{
    phase: string;
    message: string;
    timeMs: number;
  } | null>(null);

  // Load available server pairs using ultra-parallel loading
  const loadAvailableServerPairs = async () => {
    if (!userCanisterId || !identity) {
      setError('Authentication information not available');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('🔗 [ServerPairAssignmentDialog] Loading available server pairs...');

      // Use the ultra-parallel server pairs loading from UserCanisterService
      const result = await userCanisterService.getAllUserServerPairs(userCanisterId, identity);

      if (!result.success || !result.serverPairs) {
        throw new Error(result.error || 'Failed to load server pairs');
      }

      const serverPairs = result.serverPairs;
      console.log(`📊 [ServerPairAssignmentDialog] Loaded ${serverPairs.length} server pairs`);

      // Load projects to determine current assignments
      const projectsResult = await userCanisterService.loadUserProjects(userCanisterId, identity);
      
      if (!projectsResult.success || !projectsResult.projects) {
        throw new Error(projectsResult.error || 'Failed to load projects');
      }

      const projects = projectsResult.projects;
      const projectIdToNameMap = new Map<string, string>();
      projects.forEach(project => {
        projectIdToNameMap.set(project.id, project.name || project.id);
      });

      // Get canister data for assignment checking
      const canistersResult = await userCanisterService.getUserCanisters(userCanisterId, identity);
      const userActor = await userCanisterService.getUserActor(userCanisterId, identity);

      // Build canister metadata in parallel for assignment detection
      const canisterAssignments = new Map<string, { projectId: string; projectName: string }>();
      
      const metadataPromises = canistersResult.map(async (canister) => {
        try {
          const canisterId = typeof canister.principal === 'string' 
            ? canister.principal 
            : canister.principal.toString();
          
          const metadata = await userActor.getCanisterMetadata(
            typeof canister.principal === 'string' 
              ? { fromText: () => canister.principal as string } as any
              : canister.principal
          );

          if (metadata && Array.isArray(metadata) && metadata.length > 0) {
            const meta = metadata[0];
            if (meta.project && Array.isArray(meta.project) && meta.project.length > 0) {
              const projectId = meta.project[0];
              const projectName = projectIdToNameMap.get(projectId) || projectId;
              canisterAssignments.set(canisterId, { projectId, projectName });
            }
          }
        } catch (error) {
          console.warn(`⚠️ [ServerPairAssignmentDialog] Failed to get metadata for canister:`, error);
        }
      });

      await Promise.allSettled(metadataPromises);

      // Build final available server pairs list
      const finalServerPairs: AvailableServerPair[] = serverPairs.map((serverPair) => {
        const frontendCanisterId = typeof serverPair.frontendCanisterId === 'string'
          ? serverPair.frontendCanisterId
          : serverPair.frontendCanisterId.toString();
        const backendCanisterId = typeof serverPair.backendCanisterId === 'string'
          ? serverPair.backendCanisterId
          : serverPair.backendCanisterId.toString();

        // Check project associations for both canisters
        const frontendAssignment = canisterAssignments.get(frontendCanisterId);
        const backendAssignment = canisterAssignments.get(backendCanisterId);
        
        // Use frontend assignment as the authoritative source
        const currentAssignment = frontendAssignment || backendAssignment;
        
        return {
          pairId: serverPair.pairId,
          name: serverPair.name,
          frontendCanisterId,
          backendCanisterId,
          createdAt: Number(serverPair.createdAt) / 1_000_000,
          creditsAllocated: Number(serverPair.creditsAllocated),
          currentProjectId: currentAssignment?.projectId,
          currentProjectName: currentAssignment?.projectName,
          canReassign: true // All server pairs can be reassigned in the metadata-based system
        };
      });

      // Filter out server pairs already assigned to the current project
      const availablePairs = finalServerPairs.filter(pair => 
        pair.currentProjectId !== projectId
      );

      setAvailableServerPairs(availablePairs);

      console.log(`✅ [ServerPairAssignmentDialog] Found ${availablePairs.length} available server pairs for assignment`);

    } catch (error) {
      console.error('❌ [ServerPairAssignmentDialog] Failed to load available server pairs:', error);
      setError(error instanceof Error ? error.message : 'Failed to load available server pairs');
    } finally {
      setIsLoading(false);
    }
  };

  // Assign server pair to current project
  const assignServerPair = async () => {
    if (!selectedServerPairId || !userCanisterId || !identity) {
      setError('Missing required information for assignment');
      return;
    }

    const selectedPair = availableServerPairs.find(pair => pair.pairId === selectedServerPairId);
    if (!selectedPair) {
      setError('Selected server pair not found');
      return;
    }

    try {
      setIsAssigning(true);
      setError(null);
      setAssignmentProgress({ phase: 'starting', message: 'Preparing server pair assignment...', timeMs: 0 });

      console.log(`🔗 [ServerPairAssignmentDialog] Starting server pair assignment: ${selectedServerPairId} to project: ${projectId}`);

      const operationStartTime = Date.now();

      // Progress callback to update UI
      const progressCallback = (phase: string, message: string, timeMs: number) => {
        console.log(`🔗 [ServerPairAssignmentDialog] ${phase}: ${message} (${timeMs}ms)`);
        setAssignmentProgress({ phase, message, timeMs });
      };

      // 🔧 FIX: Use moveServerPairToProject with correct parameters
      // If server pair has a current project, move from that project to new project
      // If unassigned (no current project), use empty string for fromProjectId
      const fromProjectId = selectedPair.currentProjectId || '';
      
      const result = await userCanisterService.moveServerPairToProject(
        selectedServerPairId,
        fromProjectId, // Current project (or '' if unassigned)
        projectId, // Target project
        userCanisterId,
        identity
      );

      const totalTime = Date.now() - operationStartTime;

      if (result.success) {
        console.log(`✅ [ServerPairAssignmentDialog] Server pair assignment completed successfully in ${totalTime}ms`);

        const message = selectedPair.currentProjectName 
          ? `Server pair "${selectedPair.name}" has been successfully moved from "${selectedPair.currentProjectName}" to "${projectName}".`
          : `Server pair "${selectedPair.name}" has been successfully assigned to "${projectName}".`;

        // Close dialog and notify parent
        onAssignmentComplete();

      } else {
        console.error('❌ [ServerPairAssignmentDialog] Server pair assignment failed:', result.error);
        setError(`Failed to assign server pair: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ [ServerPairAssignmentDialog] Server pair assignment operation failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to assign server pair to project');
    } finally {
      setIsAssigning(false);
      setAssignmentProgress(null);
    }
  };

  // Load data when dialog opens
  useEffect(() => {
    loadAvailableServerPairs();
  }, [userCanisterId, identity, projectId]);

  // Get assignment status display
  const getAssignmentStatusDisplay = (pair: AvailableServerPair) => {
    if (pair.currentProjectName) {
      return {
        text: `Currently assigned to "${pair.currentProjectName}"`,
        color: '#f59e0b',
        icon: '🔗',
        isReassignment: true
      };
    } else {
      return {
        text: 'Unassigned',
        color: '#10b981',
        icon: '✅',
        isReassignment: false
      };
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          animation: 'fadeIn 0.2s ease-out'
        }}
      />

      {/* Assignment Progress Overlay */}
      {assignmentProgress && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.95)',
          backdropFilter: 'blur(12px)',
          zIndex: 100002,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--secondary-black), var(--primary-black))',
            border: '2px solid #8b5cf6',
            borderRadius: '20px',
            padding: '3rem',
            textAlign: 'center',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 25px 70px rgba(139, 92, 246, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)'
          }}>
            {/* Progress Animation */}
            <div style={{
              position: 'relative',
              width: '120px',
              height: '120px',
              margin: '0 auto 2rem',
              background: 'conic-gradient(#8b5cf6 0deg, #8b5cf6 180deg, rgba(255, 255, 255, 0.1) 180deg)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'spin 2s linear infinite'
            }}>
              <div style={{
                width: '90px',
                height: '90px',
                background: 'var(--primary-black)',
                borderRadius: '50%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#8b5cf6'
              }}>
                🔗
              </div>
            </div>
            
            <h3 style={{
              fontSize: '1.4rem',
              fontWeight: 700,
              color: '#ffffff',
              marginBottom: '0.5rem',
              lineHeight: 1.2
            }}>
              🔗 Assigning Server Pair to Project
            </h3>
            
            <p style={{
              color: 'var(--text-gray)',
              fontSize: '0.95rem',
              lineHeight: 1.5,
              marginBottom: '2rem',
              minHeight: '3rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              🔄 Phase: {assignmentProgress.phase} • {assignmentProgress.message}
              {assignmentProgress.timeMs > 0 && ` (${assignmentProgress.timeMs}ms)`}
            </p>

            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'rgba(139, 92, 246, 0.2)',
              border: '1px solid rgba(139, 92, 246, 0.5)',
              borderRadius: '8px',
              fontSize: '0.8rem',
              color: 'var(--text-gray)'
            }}>
              <div style={{ 
                fontWeight: 600, 
                color: '#8b5cf6', 
                marginBottom: '0.5rem'
              }}>
                🌐 Metadata-Based Assignment System
              </div>
              <div>Using ultra-parallel operations for maximum speed and reliability</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Dialog */}
      <div style={{
        position: 'fixed',
        top: isMobile ? '0' : '50%',
        left: isMobile ? '0' : '50%',
        transform: isMobile ? 'none' : 'translate(-50%, -50%)',
        width: isMobile ? '100vw' : 'min(90vw, 800px)',
        height: isMobile ? '100vh' : 'auto',
        maxHeight: isMobile ? '100vh' : '85vh',
        background: 'linear-gradient(135deg, var(--secondary-black), var(--primary-black))',
        border: isMobile ? 'none' : '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: isMobile ? '0' : '16px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        animation: isMobile ? 'slideUpMobile 0.3s ease-out' : 'slideUp 0.3s ease-out',
        zIndex: 100000,
        isolation: 'isolate',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: isMobile ? '1rem' : '2rem',
          paddingBottom: isMobile ? '1rem' : '1.5rem',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(139, 92, 246, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)'
            }}>
              🔗
            </div>
            <div>
              <h2 style={{
                fontSize: isMobile ? '1.25rem' : '1.5rem',
                fontWeight: 700,
                color: '#ffffff',
                margin: 0,
                marginBottom: '0.25rem'
              }}>
                Assign Existing Server Pair
              </h2>
              <p style={{
                fontSize: '0.9rem',
                color: 'var(--text-gray)',
                margin: 0
              }}>
                Move servers to "{projectName}" project
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isAssigning}
            style={{
              width: '40px',
              height: '40px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isAssigning ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: isAssigning ? 0.5 : 1,
              fontSize: '1.25rem',
              color: 'var(--text-gray)'
            }}
            onMouseEnter={(e) => {
              if (!isAssigning) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isAssigning) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          padding: isMobile ? '1rem' : '2rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          {/* Info Section */}
          <div style={{
            padding: '1rem',
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '8px',
            fontSize: '0.85rem',
            color: 'var(--text-gray)',
            lineHeight: 1.5
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <span style={{ color: '#8b5cf6', marginTop: '0.1rem' }}>💡</span>
              <div>
                <strong style={{ color: '#ffffff' }}>Server Pair Assignment</strong> allows you to move existing server pairs between projects instantly.
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                  • <strong>Reassignment:</strong> Move servers from other projects to this one
                  • <strong>Unassigned Servers:</strong> Assign available server pairs to this project
                  • <strong>⚡ Ultra-Fast:</strong> Metadata-based system with parallel operations
                  • <strong>🔄 Reversible:</strong> Server pairs can be moved again later if needed
                </div>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '1rem',
              color: '#ef4444',
              fontSize: '0.9rem',
              lineHeight: 1.4
            }}>
              ❌ {error}
            </div>
          )}

          {/* Server Pairs List */}
          <div style={{ flex: 1 }}>
            <h3 style={{
              fontSize: isMobile ? '1.1rem' : '1.2rem',
              fontWeight: '600',
              color: '#ffffff',
              margin: '0 0 1rem 0'
            }}>
              Available Server Pairs ({availableServerPairs.length})
            </h3>

            {isLoading ? (
              <div style={{
                textAlign: 'center',
                padding: isMobile ? '2rem 1rem' : '3rem',
                color: 'var(--text-gray)'
              }}>
                <div style={{
                  width: isMobile ? '32px' : '40px',
                  height: isMobile ? '32px' : '40px',
                  border: '3px solid rgba(139, 92, 246, 0.3)',
                  borderTop: '3px solid #8b5cf6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 1rem'
                }}></div>
                Loading available server pairs...
              </div>
            ) : availableServerPairs.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: isMobile ? '2rem 1rem' : '3rem',
                color: 'var(--text-gray)'
              }}>
                <div style={{ fontSize: isMobile ? '2rem' : '3rem', marginBottom: '1rem', opacity: 0.5 }}>
                  🔗
                </div>
                <h4 style={{ 
                  fontSize: isMobile ? '1.1rem' : '1.2rem', 
                  fontWeight: '600', 
                  color: '#ffffff', 
                  margin: '0 0 0.5rem 0' 
                }}>
                  No Available Server Pairs
                </h4>
                <p style={{ 
                  margin: 0, 
                  lineHeight: 1.6,
                  fontSize: isMobile ? '0.9rem' : '1rem'
                }}>
                  All your server pairs are either already assigned to this project or you don't have any server pairs yet.
                  <br />
                  Create a new server pair to get started with hosting.
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1rem'
              }}>
                {availableServerPairs.map((serverPair) => {
                  const assignmentStatus = getAssignmentStatusDisplay(serverPair);
                  const isSelected = selectedServerPairId === serverPair.pairId;
                  
                  return (
                    <div
                      key={serverPair.pairId}
                      onClick={() => setSelectedServerPairId(serverPair.pairId)}
                      style={{
                        background: isSelected 
                          ? 'rgba(139, 92, 246, 0.15)' 
                          : 'rgba(255, 255, 255, 0.05)',
                        border: isSelected 
                          ? '2px solid #8b5cf6' 
                          : '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        padding: isMobile ? '1rem' : '1.25rem',
                        cursor: isAssigning ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        opacity: isAssigning ? 0.7 : 1,
                        pointerEvents: isAssigning ? 'none' : 'auto',
                        boxShadow: isSelected ? '0 4px 20px rgba(139, 92, 246, 0.2)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!isMobile && !isAssigning && !isSelected) {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                          e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isMobile && !isAssigning && !isSelected) {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        }
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '1rem'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: isMobile ? '1rem' : '1.1rem',
                            fontWeight: '600',
                            color: isSelected ? '#8b5cf6' : '#ffffff',
                            marginBottom: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            {isSelected && <span style={{ color: '#8b5cf6' }}>✓</span>}
                            🚀 {serverPair.name}
                          </div>
                          
                          <div style={{
                            fontSize: '0.8rem',
                            color: assignmentStatus.color,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            marginBottom: '0.25rem'
                          }}>
                            <span>{assignmentStatus.icon}</span>
                            <span>{assignmentStatus.text}</span>
                            {assignmentStatus.isReassignment && (
                              <span style={{
                                fontSize: '0.7rem',
                                background: 'rgba(245, 158, 11, 0.2)',
                                color: '#f59e0b',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '4px',
                                marginLeft: '0.25rem'
                              }}>
                                MOVE
                              </span>
                            )}
                          </div>
                          
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-gray)',
                            display: 'flex',
                            gap: '1rem'
                          }}>
                            <span>💰 {serverPair.creditsAllocated.toLocaleString()} credits</span>
                            <span>📅 {new Date(serverPair.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        
                        {isSelected && (
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#8b5cf6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontSize: '0.75rem',
                            color: '#ffffff'
                          }}>
                            ✓
                          </div>
                        )}
                      </div>
                      
                      <div style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-gray)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '0.25rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                      }}>
                        <div>🎨 Frontend: {serverPair.frontendCanisterId.substring(0, 8)}...</div>
                        <div>🔧 Backend: {serverPair.backendCanisterId.substring(0, 8)}...</div>
                      </div>

                      {/* Reassignment Warning */}
                      {isSelected && assignmentStatus.isReassignment && (
                        <div style={{
                          marginTop: '0.75rem',
                          padding: '0.75rem',
                          background: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          color: '#f59e0b',
                          lineHeight: 1.4
                        }}>
                          ⚠️ This will move the server pair from "{serverPair.currentProjectName}" to "{projectName}". The previous project will lose access to these servers.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: isMobile ? '1rem' : '2rem',
          paddingTop: isMobile ? '1rem' : '1.5rem',
          borderTop: '1px solid var(--border-color)',
          background: 'rgba(255, 255, 255, 0.02)',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '1rem',
          justifyContent: 'flex-end',
          flexShrink: 0
        }}>
          <button
            onClick={onClose}
            disabled={isAssigning}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-gray)',
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: isAssigning ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: isAssigning ? 0.5 : 1,
              order: isMobile ? 2 : 1,
              minHeight: '44px'
            }}
            onMouseEnter={(e) => {
              if (!isAssigning) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isAssigning) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }
            }}
          >
            Cancel
          </button>

          <button
            onClick={assignServerPair}
            disabled={!selectedServerPairId || isAssigning || availableServerPairs.length === 0}
            style={{
              padding: '0.75rem 2rem',
              background: selectedServerPairId && !isAssigning && availableServerPairs.length > 0
                ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' 
                : 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              color: selectedServerPairId && !isAssigning && availableServerPairs.length > 0 ? '#ffffff' : 'var(--text-gray)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: selectedServerPairId && !isAssigning && availableServerPairs.length > 0 ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: selectedServerPairId && !isAssigning && availableServerPairs.length > 0
                ? '0 4px 15px rgba(139, 92, 246, 0.3)' 
                : 'none',
              order: isMobile ? 1 : 2,
              minHeight: '44px'
            }}
            onMouseEnter={(e) => {
              if (selectedServerPairId && !isAssigning && availableServerPairs.length > 0) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedServerPairId && !isAssigning && availableServerPairs.length > 0) {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(139, 92, 246, 0.3)';
              }
            }}
          >
            {isAssigning && (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderTopColor: '#ffffff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            )}
            {isAssigning ? '⏳ Assigning...' : 
             !selectedServerPairId ? 'Select a Server Pair' :
             availableServerPairs.length === 0 ? 'No Server Pairs Available' :
             (() => {
               const selectedPair = availableServerPairs.find(pair => pair.pairId === selectedServerPairId);
               return selectedPair?.currentProjectName ? '🔄 Move to This Project' : '🔗 Assign to This Project';
             })()
            }
          </button>
        </div>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { 
            opacity: 0; 
            transform: translate(-50%, -40%) scale(0.95); 
          }
          to { 
            opacity: 1; 
            transform: translate(-50%, -50%) scale(1); 
          }
        }
        
        @keyframes slideUpMobile {
          from { 
            opacity: 0; 
            transform: translateY(100%); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};