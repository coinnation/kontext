import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { PortalDropdown } from './PortalDropdown';
import { ClassificationDebugModal } from './ClassificationDebugModal';
import TransactionTrackingModal from './TransactionTrackingModal';
import { ProjectMetadataEditor } from './ProjectMetadataEditor';
import { MarketplaceModal } from './MarketplaceModal';
import { useAppStore, useFiles } from '../store/appStore';
import { userCanisterService } from '../services/UserCanisterService';
import { useServerPairState } from '../hooks/useServerPairState';
import JSZip from 'jszip';

export interface ProjectTab {
  id: string;
  label: string;
  icon: string;
  disabled?: boolean;
  hidden?: boolean;  // NEW: Support for hiding tabs
}

export interface ProjectTabsProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  isMobile?: boolean;
}

// UPDATED: Hide overview and inspector tabs temporarily, agents tab reactivated
export const PROJECT_TABS: ProjectTab[] = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'overview', label: 'Overview', icon: '📊', hidden: true },  // TEMPORARILY HIDDEN
  { id: 'context', label: 'Context', icon: '🧠' },
  { id: 'database', label: 'Database', icon: '🗄️' },
  { id: 'inspector', label: 'Inspector', icon: '🔍', hidden: true },  // TEMPORARILY HIDDEN
  { id: 'hosting', label: 'Hosting', icon: '🏗️' },
  { id: 'deploy', label: 'Deploy', icon: '🚀' },
  { id: 'preview', label: 'Live Preview', icon: '👁️' },
  { id: 'agents', label: 'Agents', icon: '🤖' },  // REACTIVATED
  { id: 'domains', label: 'Domains', icon: '🌐' }  // NEW: Domain registration tab
];

interface ServerPair {
  pairId: string;
  name: string;
  frontendCanisterId: string;
  backendCanisterId: string;
  createdAt: number;
  creditsAllocated: number;
}

export const ProjectTabs: React.FC<ProjectTabsProps> = ({
  activeTab: controlledActiveTab,
  onTabChange,
  isMobile = false
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState('chat');
  // 🔥 NEW: Use centralized server pair state management
  const {
    selectedServerPairId,
    setServerPair: setServerPairId,
    isLoading: serverPairStateLoading,
    error: serverPairStateError
  } = useServerPairState();

  const [showControlPanel, setShowControlPanel] = useState(false);
  const [serverPairs, setServerPairs] = useState<ServerPair[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isLoadingServers, setIsLoadingServers] = useState(false);
  const [deployStatus, setDeployStatus] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [isDownloadingWasm, setIsDownloadingWasm] = useState(false);
  const [wasmDownloadStatus, setWasmDownloadStatus] = useState<string>('');
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showProjectEditor, setShowProjectEditor] = useState(false);
  const [showMarketplaceModal, setShowMarketplaceModal] = useState(false);
  
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlButtonRef = useRef<HTMLButtonElement>(null);
  
  // 🚨 STREAMING DETECTION - Same mechanism as ChatHeader and UserCreditsDropdown
  const { tabGroups } = useFiles();
  const [isStreamingActive, setIsStreamingActive] = useState(false);
  const streamingCheckTimeoutRef = useRef<NodeJS.Timeout>();
  
  // 🔧 FIX: Refs to prevent infinite loops and debounce server pair loading
  const lastProcessedAssignmentRef = useRef<number | null>(null);
  const isLoadingServerPairsRef = useRef<boolean>(false);
  const lastLoadTimeRef = useRef<number>(0);
  
  const { 
    activeProject, 
    userCanisterId, 
    identity,
    principal,
    projects,
    projectFiles,
    projectGeneratedFiles,
    generatedFiles,
    getProjectServerPair,
    setProjectServerPair,
    syncWithLocalStorage,
    projectServerPairs,
    getSelectedVersion
  } = useAppStore(state => ({
    activeProject: state.activeProject,
    userCanisterId: state.userCanisterId,
    identity: state.identity,
    principal: state.principal,
    projects: state.projects,
    projectFiles: state.projectFiles,
    projectGeneratedFiles: state.projectGeneratedFiles,
    generatedFiles: state.generatedFiles,
    getProjectServerPair: state.getProjectServerPair,
    setProjectServerPair: state.setProjectServerPair,
    syncWithLocalStorage: state.syncWithLocalStorage,
    projectServerPairs: state.projectServerPairs,
    getSelectedVersion: state.getSelectedVersion
  }));
  
  const activeTab = controlledActiveTab || internalActiveTab;
  const currentProject = projects.find(p => p.id === activeProject);

  // Filter out hidden tabs - memoized to prevent infinite loops
  const visibleTabs = useMemo(() => {
    return PROJECT_TABS.filter(tab => !tab.hidden);
  }, []); // Empty deps since PROJECT_TABS is constant
  
  // Debug: Log visible tabs to verify agents tab is included (only once on mount)
  useEffect(() => {
    console.log('🔍 [ProjectTabs] Visible tabs:', visibleTabs.map(t => t.id));
    console.log('🔍 [ProjectTabs] Agents tab included:', visibleTabs.some(t => t.id === 'agents'));
  }, []); // Only log once on mount
  
  // 🚨 STREAMING DETECTION SYSTEM - Same as ChatHeader to prevent dropdown paralysis
  useEffect(() => {
    try {
      const hasWritingFiles = tabGroups.some(group => 
        group.files.some(file => file.isWriting && !file.isComplete)
      );
      
      // Clear existing timeout
      if (streamingCheckTimeoutRef.current) {
        clearTimeout(streamingCheckTimeoutRef.current);
      }

      if (hasWritingFiles && !isStreamingActive) {
        // Start streaming - immediate update
        setIsStreamingActive(true);
      } else if (!hasWritingFiles && isStreamingActive) {
        // Stop streaming - debounced update
        streamingCheckTimeoutRef.current = setTimeout(() => {
          setIsStreamingActive(false);
        }, 1000); // Wait 1 second after streaming stops before unfreezing
      }
    } catch (e) {
      console.error('Error in streaming detection:', e);
    }

    return () => {
      if (streamingCheckTimeoutRef.current) {
        clearTimeout(streamingCheckTimeoutRef.current);
      }
    };
  }, [tabGroups.length, isStreamingActive]); // Only depend on length to minimize updates
  
  const handleTabClick = (tabId: string) => {
    const tab = PROJECT_TABS.find(tab => tab.id === tabId);
    if (tab?.disabled || tab?.hidden) {
      return;
    }
    
    if (!controlledActiveTab) {
      setInternalActiveTab(tabId);
    }
    onTabChange?.(tabId);
  };

  // Enhanced server pair loading with direct state coordination
  useEffect(() => {
    if (!activeProject) {
      setServerPairId(null);
      return;
    }

    console.log('🎯 [ProjectTabs] ENHANCED: Loading server pair for project:', activeProject);
    
    // First, try to get from coordinated state
    const coordinated = getProjectServerPair(activeProject);
    
    if (coordinated) {
      console.log('✅ [ProjectTabs] Found server pair in coordinated state:', coordinated);
      setServerPairId(coordinated);
      return;
    }

    // No fallback to localStorage - if not in state, fetch from backend
    const afterCheck = getProjectServerPair(activeProject);
    if (afterCheck) {
      console.log('✅ [ProjectTabs] Found server pair in state:', afterCheck);
      setServerPairId(afterCheck);
    } else {
      console.log('ℹ️ [ProjectTabs] No server pair found for project:', activeProject);
      setServerPairId(null);
    }
  }, [activeProject, getProjectServerPair, setServerPairId]);

  // Enhanced save function with state coordination
  const saveSelectedServerPair = useCallback((pairId: string) => {
    if (!activeProject) return;
    
    console.log('💾 [ProjectTabs] ENHANCED: Saving server pair with state coordination:', {
      projectId: activeProject,
      serverPairId: pairId
    });
    
    // 🔥 UPDATED: Use centralized server pair state management
    setServerPairId(pairId);
    
    // Use the coordinated state management instead of direct localStorage
    setProjectServerPair(activeProject, pairId);
  }, [activeProject, setProjectServerPair]);
  
  // Store saveSelectedServerPair in a ref so loadServerPairs can access it without dependency
  const saveSelectedServerPairRef = useRef(saveSelectedServerPair);
  useEffect(() => {
    saveSelectedServerPairRef.current = saveSelectedServerPair;
  }, [saveSelectedServerPair]);

  // Load server pairs for the current project
  const LOAD_DEBOUNCE_MS = 1000; // 1 second debounce
  const loadServerPairs = useCallback(async (forceRefresh = false) => {
    if (!userCanisterId || !identity || !activeProject) {
      return;
    }

    // 🔧 FIX: Prevent concurrent calls
    if (isLoadingServerPairsRef.current && !forceRefresh) {
      console.log('⚠️ [ProjectTabs] Server pairs already loading, skipping duplicate call');
      return;
    }

    // 🔧 FIX: Debounce rapid successive calls
    const now = Date.now();
    if (!forceRefresh && (now - lastLoadTimeRef.current) < LOAD_DEBOUNCE_MS) {
      console.log('⚠️ [ProjectTabs] Debouncing server pairs load (too soon after last call)');
      return;
    }

    try {
      isLoadingServerPairsRef.current = true;
      lastLoadTimeRef.current = now;
      if (projectServerPairs?.lastAssignmentUpdate) {
        lastProcessedAssignmentRef.current = projectServerPairs.lastAssignmentUpdate;
      }
      setIsLoadingServers(true);
      console.log('🔄 [ProjectTabs] Loading server pairs for project:', activeProject);
      
      const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
      const serverPairsResult = await userActor.getProjectServerPairs(activeProject);

      if (serverPairsResult && 'ok' in serverPairsResult) {
        const serverPairsData = serverPairsResult.ok;
        
        if (Array.isArray(serverPairsData)) {
          const pairs = serverPairsData.map((pair: any) => ({
            pairId: pair.pairId,
            name: pair.name,
            createdAt: Number(pair.createdAt) / 1_000_000,
            creditsAllocated: Number(pair.creditsAllocated),
            frontendCanisterId: pair.frontendCanisterId.toText(),
            backendCanisterId: pair.backendCanisterId.toText()
          }));
          
          console.log('✅ [ProjectTabs] Loaded server pairs:', pairs.length);
          setServerPairs(pairs);
          
          // 🔥 REMOVED: Server pair selection now managed by centralized ServerPairStateService
          // The selectedServerPairId from the hook is the single source of truth
        }
      }
    } catch (error) {
      console.error('❌ [ProjectTabs] Failed to load server pairs:', error);
    } finally {
      setIsLoadingServers(false);
      isLoadingServerPairsRef.current = false;
    }
  }, [userCanisterId, identity, activeProject, getProjectServerPair]);

  // Track last processed update to prevent loops
  const lastProcessedUpdateRef = useRef<number>(0);
  const lastProjectRef = useRef<string | null>(null);

  // Store loadServerPairs in a ref so it can be called without causing dependency loops
  const loadServerPairsRef = useRef(loadServerPairs);
  useEffect(() => {
    loadServerPairsRef.current = loadServerPairs;
  }, [loadServerPairs]);

  // Load server pairs when project changes
  useEffect(() => {
    if (activeProject !== lastProjectRef.current) {
      lastProjectRef.current = activeProject;
      lastProcessedUpdateRef.current = 0; // Reset on project change
      loadServerPairsRef.current(true); // Force refresh on project change
    }
  }, [activeProject, userCanisterId, identity]);

  // Listen for server pair assignment updates and refresh the list
  useEffect(() => {
    if (!activeProject) return;

    // Check if we need to refresh based on assignment update
    const lastUpdate = projectServerPairs?.lastAssignmentUpdate || 0;
    if (lastUpdate > 0 && lastUpdate !== lastProcessedUpdateRef.current && lastUpdate !== lastProcessedAssignmentRef.current) {
      console.log('🔄 [ProjectTabs] Assignment update detected, refreshing server pairs list');
      lastProcessedUpdateRef.current = lastUpdate;
      lastProcessedAssignmentRef.current = lastUpdate;
      
      // Use a small delay to debounce rapid updates
      const timeoutId = setTimeout(() => {
        loadServerPairsRef.current(true);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [projectServerPairs?.lastAssignmentUpdate, activeProject]); // Removed loadServerPairs from deps

  // Listen for server pair creation/update events
  useEffect(() => {
    if (!activeProject) return;

    const handleServerPairUpdate = (event: CustomEvent) => {
      const { projectId, serverPairId } = event.detail;
      
      if (projectId === activeProject) {
        console.log('📢 [ProjectTabs] Received server pair update event, refreshing list:', { projectId, serverPairId });
        // Refresh the server pairs list
        loadServerPairsRef.current(true);
        // 🔥 UPDATED: Use centralized server pair state management
        if (serverPairId) {
          setServerPairId(serverPairId);
          saveSelectedServerPairRef.current(serverPairId);
        }
      }
    };

    const handleServerPairsUpdated = (event: CustomEvent) => {
      const { userCanisterId: eventUserCanisterId } = event.detail;
      if (eventUserCanisterId === userCanisterId && activeProject) {
        console.log('📢 [ProjectTabs] Received server pairs updated event, refreshing list');
        loadServerPairsRef.current(true);
      }
    };

    window.addEventListener('serverPairAssignmentChange', handleServerPairUpdate as EventListener);
    window.addEventListener('serverPairsUpdated', handleServerPairsUpdated as EventListener);

    return () => {
      window.removeEventListener('serverPairAssignmentChange', handleServerPairUpdate as EventListener);
      window.removeEventListener('serverPairsUpdated', handleServerPairsUpdated as EventListener);
    };
  }, [activeProject, userCanisterId]); // Removed loadServerPairs and saveSelectedServerPair from deps

  // Listen for coordinated state updates - only update selection, don't trigger loads
  useEffect(() => {
    if (!activeProject) return;

    const currentAssignment = getProjectServerPair(activeProject);
    
    // Only update selected server pair if coordinated state has changed
    // Don't trigger loadServerPairs here to avoid loops
    if (currentAssignment && currentAssignment !== selectedServerPairId) {
      // Check if the assigned pair exists in our current list
      const pairExists = serverPairs.some(p => p.pairId === currentAssignment);
      
      if (pairExists) {
        // Pair exists, just update selection
        console.log('🔄 [ProjectTabs] Updating selectedServerPair from coordinated state:', {
          previous: selectedServerPairId,
          current: currentAssignment
        });
        // 🔥 UPDATED: Use centralized server pair state management
        setServerPairId(currentAssignment);
      }
      // If pair doesn't exist, we'll wait for the assignment update effect to refresh
    } else if (!currentAssignment && selectedServerPairId) {
      // Coordinated state says no assignment, clear selection
      console.log('🔄 [ProjectTabs] Coordinated state cleared, clearing selection');
      setServerPairId(null);
    }
  }, [activeProject, projectServerPairs.lastAssignmentUpdate, getProjectServerPair, selectedServerPairId, serverPairs, setServerPairId]); // Removed loadServerPairs from deps

  // Check if files are ready for deployment
  const hasRequiredFiles = () => {
    if (!activeProject) return false;
    
    const canisterFiles = projectFiles[activeProject] || {};
    const projectGenFiles = projectGeneratedFiles[activeProject] || {};
    const currentGeneratedFiles = generatedFiles || {};
    
    const allFiles = {
      ...canisterFiles,
      ...projectGenFiles,
      ...currentGeneratedFiles
    };
    
    const files = Object.keys(allFiles);
    const hasMotokoFiles = files.some(f => f.endsWith('.mo'));
    const hasFrontendFiles = files.some(f => f.endsWith('.tsx') || f.endsWith('.jsx') || f.endsWith('.ts') || f.endsWith('.js'));
    const hasPackageJson = files.some(f => f.endsWith('package.json'));
    
    return hasMotokoFiles && hasFrontendFiles && hasPackageJson;
  };

  // Deploy logic
  const handleDeploy = async () => {
    if (!selectedServerPairId || isDeploying || !hasRequiredFiles()) {
      return;
    }

    const serverPair = serverPairs.find(p => p.pairId === selectedServerPairId);
    if (!serverPair) {
      return;
    }

    // 🆕 VERSION-AWARE: Get selected version for deployment
    const selectedVersion = getSelectedVersion ? getSelectedVersion() : null;

    try {
      setIsDeploying(true);
      setDeployStatus(selectedVersion 
        ? `Preparing deployment from version ${selectedVersion}...`
        : 'Preparing deployment from working copy...'
      );
      
      const { DeploymentService } = await import('../services/DeploymentService');
      
      await DeploymentService.executeFullDeployment({
        selectedServerPair: serverPair,
        projectId: activeProject!,
        projectName: currentProject?.name || 'Project',
        userCanisterId: userCanisterId!,
        identity: identity!,
        principal: principal!,
        projectFiles,
        projectGeneratedFiles,
        generatedFiles,
        selectedVersion, // 🆕 Pass selected version
        onStatusUpdate: setDeployStatus,
        onError: (error: string) => {
          console.error('Deployment failed:', error);
          setDeployStatus(`Deployment failed: ${error}`);
        }
      });
      
      setDeployStatus(selectedVersion
        ? `✅ Version ${selectedVersion} deployed successfully!`
        : '✅ Working copy deployed successfully!'
      );
      
      setTimeout(() => {
        setDeployStatus('');
      }, 3000);
      
    } catch (error) {
      console.error('❌ Deployment failed:', error);
      setDeployStatus(`Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      setTimeout(() => {
        setDeployStatus('');
      }, 5000);
    } finally {
      setIsDeploying(false);
    }
  };

  // Export project functionality
  const handleExportProject = async () => {
    if (!currentProject || !userCanisterId || !identity || !principal) {
      return;
    }

    console.log("Exporting project:", currentProject.name);

    try {
      setIsExporting(true);
      setExportStatus('Starting export...');

      const userActor = await userCanisterService.getUserActor(userCanisterId, identity);

      let filesResult;

      try {
        setExportStatus('Fetching project files...');
        
        // Try direct download first
        filesResult = await userActor.getProjectFiles(
          principal,
          currentProject.id,
          []
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // If it's a payload size error, use batch download
        if (errorMessage.includes('payload size') &&
            errorMessage.includes('cannot be larger than')) {

          console.log('[Export] Project too large, using batch download');
          setExportStatus('Project is large, using batch download...');

          // Implement batch download
          const sessionResult = await userActor.startProjectFilesDownloadSession(
            principal,
            currentProject.id,
            []
          );

          if (!('ok' in sessionResult)) {
            throw new Error(`Failed to start download session: ${sessionResult.err}`);
          }

          const session = sessionResult.ok;
          console.log(`[Export] Download session started: ${session.totalFiles} files in ${session.totalBatches} batches`);

          let allFiles = [];

          for (let batchIndex = 0; batchIndex < session.totalBatches; batchIndex++) {
            setExportStatus(`Downloading batch ${batchIndex + 1}/${session.totalBatches}...`);
            console.log(`[Export] Downloading batch ${batchIndex + 1}/${session.totalBatches}`);

            const batchResult = await userActor.downloadProjectFilesBatch(
              session.sessionId,
              BigInt(batchIndex)
            );

            if (!('ok' in batchResult)) {
              throw new Error(`Failed to download batch ${batchIndex}: ${batchResult.err}`);
            }

            const batch = batchResult.ok;
            allFiles = allFiles.concat(batch.files);

            if (batch.isLastBatch) {
              break;
            }
          }

          // Cleanup
          try {
            await userActor.cleanupProjectFilesDownloadSession(session.sessionId);
          } catch (cleanupError) {
            console.warn('[Export] Failed to cleanup session:', cleanupError);
          }

          filesResult = { ok: allFiles };
        } else {
          throw error;
        }
      }

      if (!('ok' in filesResult)) {
        throw new Error(`Failed to fetch project files: ${filesResult.err}`);
      }

      setExportStatus('Processing files...');

      // Process files
      const files = filesResult.ok.map((file: any) => {
        const normalizedPath = file.path || '';
        return {
          name: normalizedPath
            ? `${normalizedPath}/${file.fileName}`
            : file.fileName,
          content: file.content?.[0]?.Text || ''
        };
      });

      // Filter out .keep files AND .wasm files
      const validFiles = files.filter((file: any) =>
        !file.name.includes('.keep') &&
        !file.name.endsWith('.wasm')
      );

      setExportStatus('Creating ZIP archive...');

      // Create zip
      const zip = new JSZip();

      const projectData = {
        id: currentProject.id,
        status: currentProject.status,
        created: currentProject.created.toString(),
        projectType: currentProject.projectType,
        templateId: currentProject.templateId,
        name: currentProject.name,
        description: currentProject.description,
        npmPackages: currentProject.npmPackages,
        collaborators: currentProject.collaborators,
        canisters: currentProject.canisters,
        updated: currentProject.updated.toString(),
        motokoPackages: currentProject.motokoPackages,
        visibility: currentProject.visibility,
        workingCopyBaseVersion: currentProject.workingCopyBaseVersion
      };

      zip.file('project.json', JSON.stringify(projectData, null, 2));

      validFiles.forEach((file: any) => {
        zip.file(`code/${file.name}`, file.content);
      });

      setExportStatus('Generating download...');

      const zipBlob = await zip.generateAsync({type: 'blob'});
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentProject.name}-export.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportStatus('Export completed successfully!');

      setTimeout(() => {
        setExportStatus('');
      }, 3000);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[Export] Error:', error);
      setExportStatus(`Export failed: ${errorMessage}`);
      
      setTimeout(() => {
        setExportStatus('');
      }, 5000);
    } finally {
      setIsExporting(false);
    }
  };

  // Download backend WASM files functionality
  const handleDownloadBackendWasm = async () => {
    if (!currentProject || !userCanisterId || !identity || !principal) {
      return;
    }

    console.log("Downloading backend WASM for project:", currentProject.name);

    try {
      setIsDownloadingWasm(true);
      setWasmDownloadStatus('Finding WASM files...');

      const result = await userCanisterService.downloadProjectWasmFiles(
        currentProject.id,
        userCanisterId,
        identity,
        principal
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to download WASM files');
      }

      if (!result.files || result.files.length === 0) {
        throw new Error('No WASM files found to download');
      }

      setWasmDownloadStatus(`Downloading ${result.files.length} WASM file(s)...`);

      // Download each WASM file
      for (const file of result.files) {
        const blob = new Blob([file.bytes], { type: 'application/wasm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setWasmDownloadStatus(`✅ Successfully downloaded ${result.files.length} WASM file(s)!`);

      setTimeout(() => {
        setWasmDownloadStatus('');
      }, 3000);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[WASM Download] Error:', error);
      setWasmDownloadStatus(`❌ Download failed: ${errorMessage}`);
      
      setTimeout(() => {
        setWasmDownloadStatus('');
      }, 5000);
    } finally {
      setIsDownloadingWasm(false);
    }
  };

  const selectedServerPairData = serverPairs.find(p => p.pairId === selectedServerPairId);

  // Compact Project Controls Dropdown Content - optimized for space
  // 🚨 STREAMING-SAFE: Respects isStreamingActive to prevent dropdown paralysis during code generation
  const ProjectControlsContent = () => (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      borderRadius: '8px',
      padding: isMobile ? '0.75rem' : '1rem',
      minWidth: isMobile ? '240px' : '280px',
      maxWidth: isMobile ? '85vw' : '320px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
      isolation: 'isolate'
    }}>
      {/* Compact Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <h3 style={{
          fontSize: isMobile ? '0.85rem' : '0.9rem',
          fontWeight: '600',
          color: '#ffffff',
          margin: 0
        }}>
          ⚙️ Project Controls
        </h3>
        <button
          onClick={() => setShowControlPanel(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#999',
            fontSize: '1rem',
            cursor: 'pointer',
            padding: '0.25rem',
            borderRadius: '4px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = '#999';
          }}
        >
          ✕
        </button>
      </div>

      {/* Compact Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* Edit Project Button */}
        <button
          onClick={() => {
            if (isStreamingActive) return;
            setShowControlPanel(false);
            setShowProjectEditor(true);
          }}
          disabled={isStreamingActive}
          style={{
            width: '100%',
            background: isStreamingActive 
              ? 'rgba(34, 197, 94, 0.05)' 
              : 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '6px',
            color: isStreamingActive ? 'rgba(34, 197, 94, 0.5)' : '#22c55e',
            padding: isMobile ? '0.6rem' : '0.75rem',
            fontSize: '0.8rem',
            fontWeight: '500',
            cursor: isStreamingActive ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            transition: 'all 0.2s ease',
            opacity: isStreamingActive ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!isStreamingActive) {
              e.currentTarget.style.background = 'rgba(34, 197, 94, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isStreamingActive) {
              e.currentTarget.style.background = 'rgba(34, 197, 94, 0.1)';
            }
          }}
        >
          ✏️ {isStreamingActive ? 'Edit Project (After Generation)' : 'Edit Project'}
        </button>

        {/* Transaction Tracking Button */}
        <button
          onClick={() => {
            if (isStreamingActive) return; // Prevent action during streaming
            setShowControlPanel(false);
            setShowTransactionModal(true);
          }}
          disabled={isStreamingActive}
          style={{
            width: '100%',
            background: isStreamingActive 
              ? 'rgba(255, 107, 53, 0.05)' 
              : 'rgba(255, 107, 53, 0.1)',
            border: '1px solid rgba(255, 107, 53, 0.3)',
            borderRadius: '6px',
            color: isStreamingActive ? 'rgba(255, 107, 53, 0.5)' : '#ff6b35',
            padding: isMobile ? '0.6rem' : '0.75rem',
            fontSize: '0.8rem',
            fontWeight: '500',
            cursor: isStreamingActive ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            transition: 'all 0.2s ease',
            opacity: isStreamingActive ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!isStreamingActive) {
              e.currentTarget.style.background = 'rgba(255, 107, 53, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isStreamingActive) {
              e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
            }
          }}
        >
          📊 {isStreamingActive ? 'Value Flow Tracker (After Generation)' : 'Value Flow Tracker'}
        </button>

        {/* Debug Button */}
        <button
          onClick={() => {
            if (isStreamingActive) return; // Prevent action during streaming
            setShowControlPanel(false);
            setShowDebugModal(true);
          }}
          disabled={isStreamingActive}
          style={{
            width: '100%',
            background: isStreamingActive 
              ? 'rgba(59, 130, 246, 0.05)' 
              : 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '6px',
            color: isStreamingActive ? 'rgba(59, 130, 246, 0.5)' : '#3b82f6',
            padding: isMobile ? '0.6rem' : '0.75rem',
            fontSize: '0.8rem',
            fontWeight: '500',
            cursor: isStreamingActive ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            transition: 'all 0.2s ease',
            opacity: isStreamingActive ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!isStreamingActive) {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isStreamingActive) {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
            }
          }}
        >
          🔍 {isStreamingActive ? 'Debug Console (After Generation)' : 'Debug Console'}
        </button>

        {/* List on Marketplace Button */}
        <button
          onClick={() => {
            if (isStreamingActive) return; // Prevent action during streaming
            setShowControlPanel(false);
            setShowMarketplaceModal(true);
          }}
          disabled={isStreamingActive || !activeProject}
          style={{
            width: '100%',
            background: (isStreamingActive || !activeProject)
              ? 'rgba(249, 115, 22, 0.05)' 
              : 'rgba(249, 115, 22, 0.1)',
            border: '1px solid rgba(249, 115, 22, 0.3)',
            borderRadius: '6px',
            color: (isStreamingActive || !activeProject) ? 'rgba(249, 115, 22, 0.5)' : '#f97316',
            padding: isMobile ? '0.6rem' : '0.75rem',
            fontSize: '0.8rem',
            fontWeight: '500',
            cursor: (isStreamingActive || !activeProject) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            transition: 'all 0.2s ease',
            opacity: (isStreamingActive || !activeProject) ? 0.6 : 1,
            marginTop: '0.5rem'
          }}
          onMouseEnter={(e) => {
            if (!isStreamingActive && activeProject) {
              e.currentTarget.style.background = 'rgba(249, 115, 22, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isStreamingActive && activeProject) {
              e.currentTarget.style.background = 'rgba(249, 115, 22, 0.1)';
            }
          }}
        >
          🛒 {isStreamingActive ? 'List on Marketplace (After Generation)' : 'List on Marketplace'}
        </button>

        {/* Clear Chat Button */}
        <button
          onClick={async () => {
            if (isStreamingActive) return;
            setShowControlPanel(false);
            
            if (!activeProject) {
              console.warn('⚠️ [ProjectControls] No active project');
              return;
            }
            
            if (confirm('Are you sure you want to clear all chat messages for this project? This action cannot be undone.')) {
              try {
                const { clearProjectMessages, loadProjectMessages } = useAppStore.getState();
                if (clearProjectMessages) {
                  const success = await clearProjectMessages(activeProject);
                  if (success) {
                    console.log('✅ [ProjectControls] Chat history cleared successfully');
                    // Reload messages to show empty state
                    if (loadProjectMessages) {
                      await loadProjectMessages(activeProject);
                    }
                  } else {
                    alert('Failed to clear chat history. Please try again.');
                  }
                }
              } catch (error) {
                console.error('❌ [ProjectControls] Error clearing chat:', error);
                alert('Failed to clear chat history. Please try again.');
              }
            }
          }}
          disabled={isStreamingActive}
          style={{
            width: '100%',
            background: isStreamingActive 
              ? 'rgba(251, 146, 60, 0.05)' 
              : 'rgba(251, 146, 60, 0.1)',
            border: '1px solid rgba(251, 146, 60, 0.3)',
            borderRadius: '6px',
            color: isStreamingActive ? 'rgba(251, 146, 60, 0.5)' : '#fb923c',
            padding: isMobile ? '0.6rem' : '0.75rem',
            fontSize: '0.8rem',
            fontWeight: '500',
            cursor: isStreamingActive ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            transition: 'all 0.2s ease',
            opacity: isStreamingActive ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!isStreamingActive) {
              e.currentTarget.style.background = 'rgba(251, 146, 60, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isStreamingActive) {
              e.currentTarget.style.background = 'rgba(251, 146, 60, 0.1)';
            }
          }}
        >
          🗑️ {isStreamingActive ? 'Clear Chat (After Generation)' : 'Clear Chat History'}
        </button>

        {/* Export Button */}
        <button
          onClick={handleExportProject}
          disabled={isExporting || isStreamingActive}
          style={{
            width: '100%',
            background: (isExporting || isStreamingActive)
              ? 'rgba(16, 185, 129, 0.05)' 
              : 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '6px',
            color: (isExporting || isStreamingActive) ? 'rgba(16, 185, 129, 0.6)' : '#10b981',
            padding: isMobile ? '0.6rem' : '0.75rem',
            fontSize: '0.8rem',
            fontWeight: '500',
            cursor: (isExporting || isStreamingActive) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            transition: 'all 0.2s ease',
            opacity: (isExporting || isStreamingActive) ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!isExporting && !isStreamingActive) {
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isExporting && !isStreamingActive) {
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
            }
          }}
        >
          {isExporting ? (
            <>
              <div style={{
                width: '12px',
                height: '12px',
                border: '2px solid rgba(16, 185, 129, 0.3)',
                borderTop: '2px solid #10b981',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              Exporting...
            </>
          ) : isStreamingActive ? (
            <>📦 Export Project (After Generation)</>
          ) : (
            <>📦 Export Project</>
          )}
        </button>

        {/* Download Backend WASM Button */}
        <button
          onClick={handleDownloadBackendWasm}
          disabled={isDownloadingWasm || isStreamingActive}
          style={{
            width: '100%',
            background: (isDownloadingWasm || isStreamingActive)
              ? 'rgba(139, 92, 246, 0.05)' 
              : 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '6px',
            color: (isDownloadingWasm || isStreamingActive) ? 'rgba(139, 92, 246, 0.6)' : '#8b5cf6',
            padding: isMobile ? '0.6rem' : '0.75rem',
            fontSize: '0.8rem',
            fontWeight: '500',
            cursor: (isDownloadingWasm || isStreamingActive) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            transition: 'all 0.2s ease',
            opacity: (isDownloadingWasm || isStreamingActive) ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!isDownloadingWasm && !isStreamingActive) {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isDownloadingWasm && !isStreamingActive) {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
            }
          }}
        >
          {isDownloadingWasm ? (
            <>
              <div style={{
                width: '12px',
                height: '12px',
                border: '2px solid rgba(139, 92, 246, 0.3)',
                borderTop: '2px solid #8b5cf6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              {wasmDownloadStatus || 'Downloading...'}
            </>
          ) : isStreamingActive ? (
            <>📦 Download Backend WASM (After Generation)</>
          ) : (
            <>📦 Download Backend WASM</>
          )}
        </button>

        {/* Server Pair Selection - Compact */}
        <div style={{
          background: 'rgba(255, 107, 53, 0.05)',
          border: '1px solid rgba(255, 107, 53, 0.2)',
          borderRadius: '6px',
          padding: isMobile ? '0.6rem' : '0.75rem'
        }}>
          <div style={{
            fontSize: '0.75rem',
            color: '#ff6b35',
            marginBottom: '0.4rem',
            fontWeight: '500'
          }}>
            🏗️ Deployment
          </div>
          
          <select
            value={selectedServerPairId || ''}
            onChange={(e) => {
              if (isStreamingActive) return; // Prevent action during streaming
              saveSelectedServerPair(e.target.value);
            }}
            disabled={isLoadingServers || serverPairs.length === 0 || isStreamingActive}
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              color: '#ffffff',
              padding: '0.5rem',
              fontSize: '0.75rem',
              marginBottom: '0.5rem',
              cursor: (serverPairs.length > 0 && !isStreamingActive) ? 'pointer' : 'not-allowed',
              opacity: (serverPairs.length > 0 && !isStreamingActive) ? 1 : 0.6
            }}
          >
            {isLoadingServers ? (
              <option>Loading...</option>
            ) : isStreamingActive ? (
              <option>Generation Active - Select After Generation</option>
            ) : serverPairs.length === 0 ? (
              <option>No servers - Create in Hosting</option>
            ) : (
              <>
                <option value="">Select server pair...</option>
                {serverPairs.map(pair => (
                  <option key={pair.pairId} value={pair.pairId}>
                    {pair.name} ({pair.creditsAllocated}c)
                  </option>
                ))}
              </>
            )}
          </select>

          <button
            onClick={handleDeploy}
            disabled={!selectedServerPairId || isDeploying || !hasRequiredFiles() || isStreamingActive}
            style={{
              width: '100%',
              background: (!selectedServerPairId || isDeploying || !hasRequiredFiles() || isStreamingActive) 
                ? 'rgba(16, 185, 129, 0.05)' 
                : 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '4px',
              color: (!selectedServerPairId || isDeploying || !hasRequiredFiles() || isStreamingActive)
                ? 'rgba(16, 185, 129, 0.5)'
                : '#10b981',
              padding: '0.5rem',
              fontSize: '0.75rem',
              fontWeight: '500',
              cursor: (!selectedServerPairId || isDeploying || !hasRequiredFiles() || isStreamingActive) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.3rem',
              transition: 'all 0.2s ease',
              opacity: (!selectedServerPairId || isDeploying || !hasRequiredFiles() || isStreamingActive) ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (selectedServerPairId && !isDeploying && hasRequiredFiles() && !isStreamingActive) {
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedServerPairId && !isDeploying && hasRequiredFiles() && !isStreamingActive) {
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
              }
            }}
          >
            {isDeploying ? (
              <>
                <div style={{
                  width: '10px',
                  height: '10px',
                  border: '2px solid rgba(16, 185, 129, 0.3)',
                  borderTop: '2px solid #10b981',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                Deploying...
              </>
            ) : isStreamingActive ? (
              '🚀 Deploy (After Generation)'
            ) : !hasRequiredFiles() ? (
              'Generate Files First'
            ) : !selectedServerPairId ? (
              'Select Server'
            ) : (
              '🚀 Deploy'
            )}
          </button>
        </div>

        {/* Status Messages - Compact */}
        {(exportStatus || deployStatus || isStreamingActive) && (
          <div style={{
            padding: '0.4rem',
            background: (exportStatus?.includes('failed') || deployStatus?.includes('failed')) 
              ? 'rgba(239, 68, 68, 0.1)' 
              : isStreamingActive
              ? 'rgba(255, 107, 53, 0.1)'
              : 'rgba(16, 185, 129, 0.1)',
            border: `1px solid ${(exportStatus?.includes('failed') || deployStatus?.includes('failed')) 
              ? 'rgba(239, 68, 68, 0.3)' 
              : isStreamingActive
              ? 'rgba(255, 107, 53, 0.3)'
              : 'rgba(16, 185, 129, 0.3)'}`,
            borderRadius: '4px',
            fontSize: '0.7rem',
            color: (exportStatus?.includes('failed') || deployStatus?.includes('failed')) 
              ? '#ef4444' 
              : isStreamingActive
              ? '#ff6b35'
              : '#10b981',
            textAlign: 'center'
          }}>
            {isStreamingActive && !exportStatus && !deployStatus 
              ? '⏳ Generation Active - Controls Available After Generation'
              : (exportStatus || deployStatus)}
          </div>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    // Mobile layout with gear icon integrated into tabs
    return (
      <div style={{ width: '100%' }}>
        {/* Tabs including gear icon - Mobile */}
        <div 
          ref={containerRef}
          style={{
            display: 'flex',
            gap: '0.35rem',
            alignItems: 'center',
            width: '100%',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            padding: '0.15rem'
          }}
        >
          {visibleTabs.map((tab, index) => {
            const isActive = activeTab === tab.id;
            const isDisabled = tab.disabled;
            
            return (
              <button
                key={tab.id}
                ref={(el) => tabRefs.current[index] = el}
                onClick={() => handleTabClick(tab.id)}
                disabled={isDisabled}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 0.75rem',
                  background: isActive 
                    ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(16, 185, 129, 0.1))'
                    : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  color: isDisabled ? 'rgba(156, 163, 175, 0.5)' : 
                         isActive ? '#ffffff' : 'var(--text-gray)',
                  fontSize: '0.75rem',
                  fontWeight: isActive ? 600 : 500,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.25s ease',
                  whiteSpace: 'nowrap',
                  minWidth: 'fit-content',
                  textTransform: 'none',
                  fontFamily: 'inherit',
                  flex: '0 0 auto',
                  boxShadow: isActive ? '0 2px 8px rgba(255, 107, 53, 0.15)' : 'none',
                  opacity: isDisabled ? 0.5 : 1
                }}
                onTouchStart={(e) => {
                  if (!isActive && !isDisabled) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }
                }}
                onTouchEnd={(e) => {
                  if (!isActive && !isDisabled) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
                aria-pressed={isActive}
                role="tab"
              >
                <span 
                  style={{
                    fontSize: '1rem',
                    opacity: isDisabled ? 0.5 : isActive ? 1 : 0.7,
                    transition: 'all 0.25s ease',
                    transform: isActive && !isDisabled ? 'scale(1.1)' : 'scale(1)',
                    filter: isActive && !isDisabled ? 'drop-shadow(0 2px 4px rgba(255, 107, 53, 0.3))' : 'none'
                  }}
                >
                  {tab.icon}
                </span>
                <span style={{
                  transition: 'all 0.25s ease',
                  opacity: isDisabled ? 0.5 : isActive ? 1 : 0.8
                }}>
                  {tab.label}
                </span>
                
                {/* Underline indicator */}
                {isActive && !isDisabled && (
                  <div 
                    style={{
                      position: 'absolute',
                      bottom: '2px',
                      left: '8px',
                      right: '8px',
                      height: '2px',
                      background: 'linear-gradient(90deg, var(--accent-orange), var(--accent-green))',
                      borderRadius: '1px',
                      animation: 'slideIn 0.25s ease-out'
                    }}
                  />
                )}
              </button>
            );
          })}

          {/* Project Controls Gear Icon - Same styling as tabs */}
          {activeProject && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                ref={controlButtonRef}
                onClick={() => setShowControlPanel(!showControlPanel)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem',
                  background: showControlPanel 
                    ? 'rgba(59, 130, 246, 0.2)' 
                    : 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '8px',
                  color: '#3b82f6',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  whiteSpace: 'nowrap',
                  minWidth: '80px', // 🔥 FIX: Match Credits dropdown width
                  textTransform: 'none',
                  fontFamily: 'inherit',
                  flex: '0 0 auto',
                  boxShadow: showControlPanel ? '0 2px 8px rgba(59, 130, 246, 0.25)' : '0 1px 4px rgba(59, 130, 246, 0.15)',
                  marginLeft: '0.25rem',
                  justifyContent: 'center' // Center content within fixed width
                }}
                onTouchStart={(e) => {
                  if (!showControlPanel) {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)';
                    e.currentTarget.style.transform = 'scale(0.98)';
                  }
                }}
                onTouchEnd={(e) => {
                  if (!showControlPanel) {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                }}
              >
                <span 
                  style={{
                    fontSize: '1rem',
                    opacity: showControlPanel ? 1 : 0.8,
                    transition: 'all 0.25s ease',
                    transform: showControlPanel ? 'scale(1.1) rotate(45deg)' : 'scale(1)',
                    filter: showControlPanel ? 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.4))' : 'none'
                  }}
                >
                  ⚙️
                </span>
                <span style={{
                  transition: 'all 0.25s ease',
                  opacity: showControlPanel ? 1 : 0.9
                }}>
                  Controls
                </span>
                
                {/* Active indicator matching tabs */}
                {showControlPanel && (
                  <div 
                    style={{
                      position: 'absolute',
                      bottom: '2px',
                      left: '8px',
                      right: '8px',
                      height: '2px',
                      background: 'linear-gradient(90deg, #3b82f6, #1e40af)',
                      borderRadius: '1px',
                      animation: 'slideIn 0.25s ease-out'
                    }}
                  />
                )}
              </button>
              
              <PortalDropdown
                isOpen={showControlPanel}
                onClose={() => setShowControlPanel(false)}
                triggerRef={controlButtonRef}
                placement={isMobile ? "auto" : "bottom-center"}
                offset={{ x: 0, y: 8 }}
                backdrop={false} // No background dimming
                zIndex={999999}
              >
                <ProjectControlsContent />
              </PortalDropdown>
            </div>
          )}
          
          <style>{`
            @keyframes slideIn {
              from {
                transform: scaleX(0);
                opacity: 0;
              }
              to {
                transform: scaleX(1);
                opacity: 1;
              }
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>

        {/* Debug Modal */}
        {activeProject && (
          <ClassificationDebugModal
            isOpen={showDebugModal}
            onClose={() => setShowDebugModal(false)}
            projectId={activeProject}
          />
        )}


        {/* Transaction Tracking Modal */}
        <TransactionTrackingModal
          isOpen={showTransactionModal}
          onClose={() => setShowTransactionModal(false)}
        />

        {activeProject && projects.find(p => p.id === activeProject) && (
          <ProjectMetadataEditor
            isOpen={showProjectEditor}
            onClose={() => setShowProjectEditor(false)}
            project={projects.find(p => p.id === activeProject)!}
          />
        )}

        {/* Marketplace Modal */}
        {activeProject && projects.find(p => p.id === activeProject) && userCanisterId && identity && principal && (
          <MarketplaceModal
            isOpen={showMarketplaceModal}
            onClose={() => setShowMarketplaceModal(false)}
            project={projects.find(p => p.id === activeProject)!}
            userCanisterId={userCanisterId}
            identity={identity}
            principal={principal}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <div 
        ref={containerRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          position: 'relative'
        }}
      >
        {/* Tabs - Desktop */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          flex: 1,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}>
          {visibleTabs.map((tab, index) => {
            const isActive = activeTab === tab.id;
            const isDisabled = tab.disabled;
            
            return (
              <button
                key={tab.id}
                ref={(el) => tabRefs.current[index] = el}
                onClick={() => handleTabClick(tab.id)}
                disabled={isDisabled}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '1rem 1.25rem',
                  background: isActive 
                    ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(16, 185, 129, 0.05))'
                    : 'transparent',
                  border: 'none',
                  color: isDisabled ? 'rgba(156, 163, 175, 0.5)' : 
                         isActive ? '#ffffff' : 'var(--text-gray)',
                  fontSize: '0.9rem',
                  fontWeight: isActive ? 600 : 500,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.25s ease',
                  whiteSpace: 'nowrap',
                  minWidth: 'fit-content',
                  textTransform: 'none',
                  fontFamily: 'inherit',
                  borderRadius: 0,
                  opacity: isDisabled ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isActive && !isDisabled) {
                    e.currentTarget.style.color = '#ccc';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive && !isDisabled) {
                    e.currentTarget.style.color = 'var(--text-gray)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
                aria-pressed={isActive}
                role="tab"
              >
                <span 
                  style={{
                    fontSize: '1rem',
                    opacity: isDisabled ? 0.5 : isActive ? 1 : 0.7,
                    transition: 'all 0.25s ease',
                    transform: isActive && !isDisabled ? 'scale(1.1)' : 'scale(1)',
                    filter: isActive && !isDisabled ? 'drop-shadow(0 2px 4px rgba(255, 107, 53, 0.3))' : 'none'
                  }}
                >
                  {tab.icon}
                </span>
                <span style={{
                  transition: 'all 0.25s ease',
                  opacity: isDisabled ? 0.5 : isActive ? 1 : 0.8
                }}>
                  {tab.label}
                </span>
                
                {/* Gradient underline indicator */}
                {isActive && !isDisabled && (
                  <div 
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '2px',
                      background: 'linear-gradient(90deg, var(--accent-orange), var(--accent-green))',
                      animation: 'slideIn 0.25s ease-out',
                      boxShadow: '0 0 8px rgba(255, 107, 53, 0.4)'
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Project Controls Gear Icon - Desktop (Right-justified with Portal) */}
        {activeProject && (
          <div style={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1000
          }}>
            <button
              ref={controlButtonRef}
              onClick={() => setShowControlPanel(!showControlPanel)}
              style={{
                background: showControlPanel 
                  ? 'rgba(59, 130, 246, 0.15)' 
                  : 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '12px',
                color: '#3b82f6',
                padding: '0.6rem 0.85rem',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(10px)',
                boxShadow: showControlPanel 
                  ? '0 4px 12px rgba(59, 130, 246, 0.25)' 
                  : '0 2px 8px rgba(59, 130, 246, 0.15)',
                position: 'relative',
                width: '160px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.3)';
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = showControlPanel 
                  ? '0 4px 12px rgba(59, 130, 246, 0.25)' 
                  : '0 2px 8px rgba(59, 130, 246, 0.15)';
                e.currentTarget.style.background = showControlPanel 
                  ? 'rgba(59, 130, 246, 0.15)' 
                  : 'rgba(59, 130, 246, 0.1)';
              }}
            >
              <span 
                style={{
                  fontSize: '0.9rem',
                  transition: 'all 0.2s ease',
                  transform: showControlPanel ? 'rotate(45deg)' : 'rotate(0deg)',
                  flexShrink: 0
                }}
              >
                ⚙️
              </span>
              <span style={{
                fontSize: '0.82rem',
                fontWeight: '700',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                minWidth: 0,
                letterSpacing: '-0.01em'
              }}>
                Project Controls
              </span>
              <span style={{
                fontSize: '0.7rem',
                color: '#3b82f6',
                transform: showControlPanel ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                flexShrink: 0
              }}>
                ▼
              </span>
            </button>
            
            <PortalDropdown
              isOpen={showControlPanel}
              onClose={() => setShowControlPanel(false)}
              triggerRef={controlButtonRef}
              placement="bottom-right"
              offset={{ x: 0, y: 8 }}
              backdrop={false} // No background dimming
              zIndex={999999}
            >
              <ProjectControlsContent />
            </PortalDropdown>
          </div>
        )}
      </div>

      {/* Debug Modal */}
      {activeProject && (
        <ClassificationDebugModal
          isOpen={showDebugModal}
          onClose={() => setShowDebugModal(false)}
          projectId={activeProject}
        />
      )}


      {/* Transaction Tracking Modal */}
      <TransactionTrackingModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
      />

      {/* Project Metadata Editor */}
      {activeProject && projects.find(p => p.id === activeProject) && (
        <ProjectMetadataEditor
          isOpen={showProjectEditor}
          onClose={() => setShowProjectEditor(false)}
          project={projects.find(p => p.id === activeProject)!}
        />
      )}

      {/* Marketplace Modal */}
      {activeProject && projects.find(p => p.id === activeProject) && userCanisterId && identity && principal && (
        <MarketplaceModal
          isOpen={showMarketplaceModal}
          onClose={() => setShowMarketplaceModal(false)}
          project={projects.find(p => p.id === activeProject)!}
          userCanisterId={userCanisterId}
          identity={identity}
          principal={principal}
        />
      )}
      
      <style>{`
        @keyframes slideIn {
          from {
            transform: scaleX(0);
            opacity: 0;
          }
          to {
            transform: scaleX(1);
            opacity: 1;
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ProjectTabs;