import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../../../store/appStore';
import { DynamicCanisterService } from '../../shared/services/DynamicCanisterService';
import { CanisterMethodDiscovery } from '../../shared/services/CanisterMethodDiscovery';
import { SchemaBasedDatabaseForm } from './SchemaBasedDatabaseForm';
import { DatabaseTableView } from './DatabaseTableView';
import { DatabaseQueryBuilder } from './DatabaseQueryBuilder';
import { JsonEditor } from '../shared/JsonEditor';

interface DatabaseInterfaceProps {
    projectId: string;
    projectName: string;
    selectedServerPair: ServerPair | null;
}

interface ServerPair {
    pairId: string;
    name: string;
    frontendCanisterId: string;
    backendCanisterId: string;
    createdAt: number;
    creditsAllocated: number;
}

interface CanisterMethodInfo {
    getters: Array<{ name: string; sectionName: string }>;
    setters: Array<{ name: string; sectionName: string }>;
    queries: Array<{ name: string; sectionName: string }>;
    updates: Array<{ name: string; sectionName: string }>;
}

interface DatabaseSchema {
    sections: Array<{
        id: string;
        title: string;
        fields: Record<string, any>;
        type: 'object' | 'array' | 'primitive';
        editable?: boolean;
    }>;
}

interface DatabaseState {
    isConnected: boolean;
    isLoading: boolean;
    error: string | null;
    schema: DatabaseSchema | null;
    data: Record<string, any>;
    originalData: Record<string, any>;
    methodInfo: CanisterMethodInfo | null;
    canisterActor: any | null;
    candidContent?: string;
    isDidJs?: boolean;
    isKontextOwner?: boolean; // 🔥 NEW: Track if current user is Kontext owner (for admin access)
}

// Simple loading spinner component
const LoadingSpinner: React.FC<{ size?: 'small' | 'medium' | 'large' }> = ({ size = 'medium' }) => {
    const sizeMap = {
        small: '16px',
        medium: '32px',
        large: '48px'
    };

    return (
        <div style={{
            width: sizeMap[size],
            height: sizeMap[size],
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderTop: '2px solid var(--accent-orange)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
        }}>
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export const DatabaseInterface: React.FC<DatabaseInterfaceProps> = ({
    projectId,
    projectName,
    selectedServerPair
}) => {
    const { 
        identity, 
        userCanisterId, 
        projectFiles, 
        projectGeneratedFiles, 
        generatedFiles
    } = useAppStore(state => ({
        identity: state.identity,
        userCanisterId: state.userCanisterId,
        projectFiles: state.projectFiles,
        projectGeneratedFiles: state.projectGeneratedFiles,
        generatedFiles: state.generatedFiles
    }));

    const [databaseState, setDatabaseState] = useState<DatabaseState>({
        isConnected: false,
        isLoading: false,
        error: null,
        schema: null,
        data: {},
        originalData: {},
        methodInfo: null,
        canisterActor: null
    });

    const [activeView, setActiveView] = useState<'form' | 'table' | 'query' | 'json'>('form');
    const [selectedSection, setSelectedSection] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({});
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

    // Get all available project files with filtering
    const allProjectFiles = useMemo(() => {
        const canisterFiles = projectFiles[projectId] || {};
        const projectGenFiles = projectGeneratedFiles[projectId] || {};
        const currentGenFiles = generatedFiles || {};
        
        const combinedFiles = {
            ...canisterFiles,
            ...projectGenFiles,
            ...currentGenFiles
        };

        // Filter out files that start with "backend" to avoid using wrong Candid files
        const filteredFiles: Record<string, any> = {};
        
        Object.entries(combinedFiles).forEach(([fileName, fileContent]) => {
            const baseFileName = fileName.split('/').pop() || fileName;
            
            if (baseFileName.toLowerCase().startsWith('backend')) {
                console.log(`🗄️ [DatabaseInterface] Filtering out generic backend file: ${fileName}`);
                return;
            }
            
            if (baseFileName.toLowerCase().includes('template') || 
                baseFileName.toLowerCase().includes('example') ||
                baseFileName.toLowerCase().includes('sample')) {
                console.log(`🗄️ [DatabaseInterface] Filtering out template file: ${fileName}`);
                return;
            }
            
            filteredFiles[fileName] = fileContent;
        });

        console.log(`🗄️ [DatabaseInterface] File filtering complete:`, {
            totalFiles: Object.keys(combinedFiles).length,
            filteredFiles: Object.keys(filteredFiles).length,
            removedFiles: Object.keys(combinedFiles).length - Object.keys(filteredFiles).length,
            candidFiles: Object.keys(filteredFiles).filter(f => 
                f.endsWith('.did.js') || f.endsWith('.did.d.ts') || f.endsWith('.did')
            )
        });
        
        return filteredFiles;
    }, [projectFiles, projectGeneratedFiles, generatedFiles, projectId]);

    // Initialize database connection
    const initializeDatabase = useCallback(async () => {
        if (!selectedServerPair || !identity || !userCanisterId) {
            setDatabaseState(prev => ({
                ...prev,
                error: 'Please select a server pair and ensure you are authenticated',
                isConnected: false
            }));
            return;
        }

        setDatabaseState(prev => ({
            ...prev,
            isLoading: true,
            error: null
        }));

        try {
            console.log('🗄️ [DatabaseInterface] Initializing connection to:', selectedServerPair.backendCanisterId);

            const didJsFile = Object.entries(allProjectFiles).find(([fileName, fileContent]) => 
                fileName.endsWith('.did.js') && typeof fileContent === 'string'
            );

            const didDtsFile = Object.entries(allProjectFiles).find(([fileName, fileContent]) => 
                fileName.endsWith('.did.d.ts') && typeof fileContent === 'string'
            );

            console.log('🗄️ [DatabaseInterface] Candid file discovery results:', {
                didJsFile: didJsFile ? didJsFile[0] : 'Not found',
                didDtsFile: didDtsFile ? didDtsFile[0] : 'Not found',
                availableFiles: Object.keys(allProjectFiles).filter(f => 
                    f.endsWith('.did.js') || f.endsWith('.did.d.ts') || f.endsWith('.did')
                )
            });

            if (!didJsFile && !didDtsFile) {
                throw new Error(
                    'No valid Candid interface files found after filtering. ' +
                    'Please ensure your backend canister has been properly deployed and generated interface files are available. ' +
                    'Note: Generic "backend.*" files are ignored - the system needs canister-specific interface files.'
                );
            }

            console.log('🗄️ [DatabaseInterface] Found valid Candid files:', {
                didJs: !!didJsFile,
                didDts: !!didDtsFile,
                didJsFileName: didJsFile?.[0],
                didDtsFileName: didDtsFile?.[0]
            });

            // PRIORITIZE .did.js for method discovery (like AgentContextualAwarenessService)
            // .did.js files contain executable idlFactory with REAL IDL types
            const candidContent = didJsFile ? didJsFile[1] : (didDtsFile ? didDtsFile[1] : '');
            const isDidJs = !!didJsFile;
            
            let methodInfo: CanisterMethodInfo;
            if (isDidJs && didJsFile) {
                // Use AgentContextualAwarenessService to parse .did.js with real IDL types
                console.log('✅ [DatabaseInterface] Using .did.js idlFactory execution for method discovery');
                try {
                    const { AgentContextualAwarenessService } = await import('../../../../services/AgentContextualAwarenessService');
                    const parsed = AgentContextualAwarenessService.parseDidJsFile(didJsFile[1]);
                    methodInfo = parsed.methodInfo;
                    console.log(`✅ [DatabaseInterface] Discovered ${parsed.methodDocs.length} methods using REAL IDL types`);
                } catch (error) {
                    console.warn('⚠️ [DatabaseInterface] Failed to use .did.js parsing, falling back to regex:', error);
                    methodInfo = CanisterMethodDiscovery.parseCanisterMethods(candidContent);
                }
            } else {
                // Fallback to regex parsing for .did.d.ts
                console.log('⚠️ [DatabaseInterface] Using regex parser for .did.d.ts file');
                methodInfo = CanisterMethodDiscovery.parseCanisterMethods(candidContent);
            }
            
            console.log('🗄️ [DatabaseInterface] Discovered methods:', methodInfo);

            const totalMethods = methodInfo.getters.length + methodInfo.setters.length + 
                               methodInfo.queries.length + methodInfo.updates.length;
            
            if (totalMethods === 0) {
                throw new Error(
                    'No methods found in the Candid interface. This could mean:\n' +
                    '• The interface file is malformed or incomplete\n' +
                    '• The canister has no public methods exposed\n' +
                    '• The wrong interface file was used\n\n' +
                    `Using interface from: ${didDtsFile?.[0] || didJsFile?.[0]}`
                );
            }

            const canisterActor = await DynamicCanisterService.createActor({
                canisterId: selectedServerPair.backendCanisterId,
                identity,
                candidContent: didJsFile ? didJsFile[1] : undefined,
                didDtsContent: didDtsFile ? didDtsFile[1] : undefined
            });

            if (!canisterActor) {
                throw new Error('Failed to create canister actor');
            }

            // 🔥 NEW: Check if this user is the Kontext owner (for full database access)
            let isKontextOwner = false;
            try {
                if (typeof canisterActor.isKontextOwnerQuery === 'function') {
                    console.log('🔐 [DatabaseInterface] Checking Kontext owner status...');
                    isKontextOwner = await canisterActor.isKontextOwnerQuery();
                    console.log(`🔐 [DatabaseInterface] Kontext owner: ${isKontextOwner}`);
                    
                    if (isKontextOwner) {
                        console.log('✅ [DatabaseInterface] Full admin access granted - can view all user data');
                    } else {
                        console.log('ℹ️ [DatabaseInterface] Standard user access - viewing own data only');
                    }
                } else {
                    console.log('ℹ️ [DatabaseInterface] Backend does not have Kontext owner pattern - using standard access');
                }
            } catch (ownerCheckError) {
                console.warn('⚠️ [DatabaseInterface] Could not check Kontext owner status:', ownerCheckError);
                // Continue with standard access
            }

            const initialData = await DynamicCanisterService.loadCanisterData(
                canisterActor, 
                methodInfo, 
                didJsFile ? didJsFile[1] : (didDtsFile ? didDtsFile[1] : undefined), // Prioritize .did.js
                !!didJsFile, // isDidJs flag
                isKontextOwner // 🔥 NEW: Pass Kontext owner status for admin data access
            );
            
            const schema = DynamicCanisterService.generateSchemaFromMethods(methodInfo, initialData);
            
            setDatabaseState(prev => ({
                ...prev,
                isConnected: true,
                isLoading: false,
                schema,
                data: initialData,
                originalData: JSON.parse(JSON.stringify(initialData)),
                methodInfo,
                canisterActor,
                candidContent: didJsFile ? didJsFile[1] : (didDtsFile ? didDtsFile[1] : undefined),
                isDidJs: !!didJsFile,
                isKontextOwner, // 🔥 NEW: Store Kontext owner status
                error: null
            }));

            if (schema.sections.length > 0) {
                setSelectedSection(schema.sections[0].id);
            }

            console.log('🗄️ [DatabaseInterface] Database initialized successfully');

        } catch (error) {
            console.error('🗄️ [DatabaseInterface] Database initialization failed:', error);
            setDatabaseState(prev => ({
                ...prev,
                isLoading: false,
                isConnected: false,
                error: error instanceof Error ? error.message : 'Failed to initialize database connection'
            }));
        }
    }, [selectedServerPair, identity, userCanisterId, allProjectFiles]);

    useEffect(() => {
        if (selectedServerPair) {
            initializeDatabase();
        } else {
            setDatabaseState(prev => ({
                ...prev,
                isConnected: false,
                error: null
            }));
        }
    }, [initializeDatabase]);

    const handleDataChange = useCallback((newData: Record<string, any>) => {
        setDatabaseState(prev => ({
            ...prev,
            data: newData
        }));
        
        const dataChanged = JSON.stringify(newData) !== JSON.stringify(databaseState.originalData);
        setIsDirty(dataChanged);
    }, [databaseState.originalData]);

    const handleSaveChanges = useCallback(async () => {
        if (!databaseState.canisterActor || !databaseState.methodInfo) {
            return;
        }

        try {
            setSavingStatus({ saving: true });
            
            await DynamicCanisterService.saveCanisterData(
                databaseState.canisterActor,
                databaseState.methodInfo,
                databaseState.data,
                databaseState.originalData
            );

            setDatabaseState(prev => ({
                ...prev,
                originalData: JSON.parse(JSON.stringify(prev.data))
            }));
            
            setIsDirty(false);
            setSavingStatus({});

        } catch (error) {
            console.error('🗄️ [DatabaseInterface] Save failed:', error);
            setDatabaseState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Failed to save changes'
            }));
            setSavingStatus({});
        }
    }, [databaseState.canisterActor, databaseState.methodInfo, databaseState.data, databaseState.originalData]);

    const handleRetryConnection = useCallback(() => {
        initializeDatabase();
    }, [initializeDatabase]);

    if (!selectedServerPair) {
        return (
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '1.5rem',
                padding: '3rem',
                textAlign: 'center',
                minHeight: '100%'
            }}>
                <div style={{ fontSize: '4rem', opacity: 0.3 }}>🗄️</div>
                <h2 style={{
                    fontSize: '1.8rem',
                    fontWeight: 600,
                    color: '#ffffff',
                    margin: 0,
                    marginBottom: '0.5rem'
                }}>
                    No Server Pair Selected
                </h2>
                <p style={{
                    fontSize: '1rem',
                    color: 'var(--text-gray)',
                    lineHeight: 1.6,
                    maxWidth: '500px',
                    margin: 0
                }}>
                    Please select a server pair from the <strong>Hosting</strong> tab or the project controls to access your backend canister's database interface.
                </p>
                <div style={{
                    background: 'rgba(255, 107, 53, 0.1)',
                    border: '1px solid rgba(255, 107, 53, 0.3)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    maxWidth: '600px',
                    width: '100%'
                }}>
                    <h3 style={{
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        color: 'var(--accent-orange)',
                        margin: '0 0 1rem 0'
                    }}>
                        💡 How to get started:
                    </h3>
                    <ol style={{
                        color: 'var(--text-gray)',
                        textAlign: 'left',
                        lineHeight: 1.6,
                        paddingLeft: '1.2rem',
                        fontSize: '1rem'
                    }}>
                        <li>Go to the <strong>Hosting</strong> tab</li>
                        <li>Create a new server pair with both frontend and backend canisters</li>
                        <li>Deploy your project to the server pair</li>
                        <li>Return here to interact with your backend database</li>
                    </ol>
                </div>
            </div>
        );
    }

    if (databaseState.isLoading) {
        return (
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '2rem',
                padding: '3rem',
                minHeight: '100%'
            }}>
                <LoadingSpinner size="large" />
                <div style={{
                    textAlign: 'center',
                    color: 'var(--text-gray)'
                }}>
                    <h3 style={{
                        fontSize: '1.2rem',
                        fontWeight: 600,
                        color: '#ffffff',
                        margin: '0 0 0.5rem 0'
                    }}>
                        Connecting to Database
                    </h3>
                    <p style={{ margin: 0, fontSize: '1rem' }}>
                        {databaseState.isKontextOwner 
                            ? 'Loading all user data with admin access...'
                            : 'Analyzing canister interface and loading data...'}
                    </p>
                </div>
            </div>
        );
    }

    if (databaseState.error && !databaseState.isConnected) {
        return (
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '2rem',
                padding: '3rem',
                textAlign: 'center',
                minHeight: '100%'
            }}>
                <div style={{ fontSize: '4rem', opacity: 0.3 }}>⚠️</div>
                <h2 style={{
                    fontSize: '1.8rem',
                    fontWeight: 600,
                    color: '#ffffff',
                    margin: 0,
                    marginBottom: '0.5rem'
                }}>
                    Database Connection Failed
                </h2>
                <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    maxWidth: '600px',
                    width: '100%'
                }}>
                    <p style={{
                        fontSize: '1rem',
                        color: '#ef4444',
                        lineHeight: 1.6,
                        margin: 0,
                        marginBottom: '1rem'
                    }}>
                        {databaseState.error}
                    </p>
                    <button
                        onClick={handleRetryConnection}
                        style={{
                            background: 'linear-gradient(135deg, var(--accent-orange), #f59e0b)',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#ffffff',
                            padding: '0.75rem 1.5rem',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        🔄 Retry Connection
                    </button>
                </div>
            </div>
        );
    }

    const totalMethods = databaseState.methodInfo 
        ? databaseState.methodInfo.getters.length + 
          databaseState.methodInfo.setters.length + 
          databaseState.methodInfo.queries.length + 
          databaseState.methodInfo.updates.length
        : 0;

    // Main content component
    const databaseContent = (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            ...(isFullscreen && {
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 10000,
                background: 'var(--primary-black)',
                isolation: 'isolate'
            })
        }}>
            {/* FIXED HEADER */}
            <div style={{
                padding: '1.5rem 2rem',
                borderBottom: '1px solid var(--border-color)',
                background: 'rgba(0, 0, 0, 0.4)',
                flexShrink: 0,
                position: 'sticky',
                top: 0,
                zIndex: 100,
                backdropFilter: 'blur(10px)'
            }}>
                {/* Main Title Line */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <h1 style={{
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: '#ffffff',
                            margin: 0
                        }}>
                            🗄️ Database Interface
                        </h1>
                        
                        {/* 🔥 NEW: Kontext Owner Badge */}
                        {databaseState.isKontextOwner && (
                            <div style={{
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                border: '1px solid rgba(16, 185, 129, 0.5)',
                                borderRadius: '6px',
                                padding: '0.375rem 0.75rem',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                            }}>
                                <span style={{ fontSize: '0.875rem' }}>🔐</span>
                                <span>ADMIN ACCESS</span>
                            </div>
                        )}
                    </div>
                    
                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {/* Fullscreen Toggle */}
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                color: 'var(--text-gray)',
                                padding: '0.625rem 1rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.color = '#ffffff';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                e.currentTarget.style.color = 'var(--text-gray)';
                            }}
                            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                        >
                            <span style={{ fontSize: '1rem' }}>{isFullscreen ? '⤓' : '⤢'}</span>
                            <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
                        </button>
                        
                        {/* Apply/Save button */}
                        {isDirty && (
                            <button
                                onClick={handleSaveChanges}
                                disabled={!!savingStatus.saving}
                                style={{
                                    background: 'linear-gradient(135deg, var(--accent-green), #059669)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#ffffff',
                                    padding: '0.75rem 1.5rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    cursor: savingStatus.saving ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.3s ease',
                                    opacity: savingStatus.saving ? 0.7 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                                }}
                            >
                                {savingStatus.saving ? (
                                    <>
                                        <div style={{
                                            width: '16px',
                                            height: '16px',
                                            border: '2px solid rgba(255, 255, 255, 0.3)',
                                            borderTop: '2px solid #ffffff',
                                            borderRadius: '50%',
                                            animation: 'spin 1s linear infinite'
                                        }} />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        💾 Apply Changes
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Compact Status Line */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontSize: '0.9rem',
                    color: 'var(--text-gray)',
                    flexWrap: 'wrap',
                    lineHeight: 1.4
                }}>
                    {/* Project Name */}
                    <span style={{ color: '#ffffff', fontWeight: 500 }}>
                        {projectName}
                    </span>
                    
                    <span style={{ opacity: 0.5 }}>•</span>
                    
                    {/* Server Pair Name */}
                    <span style={{ color: 'var(--text-gray)' }}>
                        {selectedServerPair.name}
                    </span>
                    
                    <span style={{ opacity: 0.5 }}>•</span>
                    
                    {/* Connection Status */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                    }}>
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: databaseState.isConnected ? 'var(--accent-green)' : '#ef4444',
                            boxShadow: databaseState.isConnected 
                                ? '0 0 6px rgba(16, 185, 129, 0.4)' 
                                : '0 0 6px rgba(239, 68, 68, 0.4)',
                            animation: databaseState.isConnected ? 'pulse 2s infinite' : 'none'
                        }} />
                        <span style={{
                            color: databaseState.isConnected ? 'var(--accent-green)' : '#ef4444',
                            fontWeight: 600,
                            fontSize: '0.85rem'
                        }}>
                            {databaseState.isConnected ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>

                    {/* Method Count and Breakdown */}
                    {databaseState.isConnected && databaseState.methodInfo && (
                        <>
                            <span style={{ opacity: 0.5 }}>•</span>
                            
                            <span style={{ 
                                color: '#ffffff', 
                                fontWeight: 600,
                                fontSize: '0.85rem'
                            }}>
                                {totalMethods} methods
                            </span>
                            
                            <span style={{ opacity: 0.3, fontSize: '0.7rem' }}>
                                (📖 {databaseState.methodInfo.getters.length} getters, ✏️ {databaseState.methodInfo.setters.length} setters, 🔍 {databaseState.methodInfo.queries.length} queries, ⚡ {databaseState.methodInfo.updates.length} updates)
                            </span>
                            <span style={{ opacity: 0.5 }}>•</span>
                            <span style={{ 
                                fontFamily: 'monospace', 
                                fontSize: '0.8rem',
                                color: 'var(--text-gray)'
                            }}>
                                Backend: {selectedServerPair.backendCanisterId.substring(0, 8)}...
                            </span>
                        </>
                    )}

                    {/* Reconnect button for failed connections */}
                    {!databaseState.isConnected && (
                        <>
                            <span style={{ opacity: 0.5 }}>•</span>
                            <button
                                onClick={handleRetryConnection}
                                style={{
                                    background: 'rgba(255, 107, 53, 0.2)',
                                    border: '1px solid rgba(255, 107, 53, 0.4)',
                                    borderRadius: '4px',
                                    color: 'var(--accent-orange)',
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                🔄 Retry
                            </button>
                        </>
                    )}
                </div>

                {/* View Mode Selector */}
                <div style={{
                    marginTop: '1rem',
                    display: 'flex',
                    gap: '0.5rem'
                }}>
                    {[
                        { id: 'form', label: 'Form View', icon: '📝' },
                        { id: 'table', label: 'Table View', icon: '📊' },
                        { id: 'query', label: 'Query Builder', icon: '🔍' },
                        { id: 'json', label: 'JSON Editor', icon: '📄' }
                    ].map(view => (
                        <button
                            key={view.id}
                            onClick={() => setActiveView(view.id as any)}
                            style={{
                                background: activeView === view.id
                                    ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(16, 185, 129, 0.1))'
                                    : 'transparent',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: activeView === view.id ? '#ffffff' : 'var(--text-gray)',
                                padding: '0.5rem 1rem',
                                fontSize: '0.85rem',
                                fontWeight: activeView === view.id ? 600 : 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <span>{view.icon}</span>
                            {view.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content - FIXED VERTICAL SCROLLING */}
            <div style={{
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                height: '100%',
                width: '100%'
            }}>
                {activeView === 'form' && databaseState.schema && (
                    <SchemaBasedDatabaseForm
                        schema={databaseState.schema}
                        data={databaseState.data}
                        onChange={handleDataChange}
                        selectedSection={selectedSection}
                        onSectionChange={setSelectedSection}
                        savingStatus={savingStatus}
                    />
                )}

                {activeView === 'table' && databaseState.schema && (
                    <DatabaseTableView
                        schema={databaseState.schema}
                        data={databaseState.data}
                        onChange={handleDataChange}
                    />
                )}

                {activeView === 'query' && databaseState.methodInfo && (
                    <DatabaseQueryBuilder
                        methodInfo={databaseState.methodInfo}
                        canisterActor={databaseState.canisterActor}
                        candidContent={databaseState.candidContent}
                        isDidJs={databaseState.isDidJs}
                    />
                )}

                {activeView === 'json' && (
                    <JsonEditor
                        value={databaseState.data}
                        onChange={handleDataChange}
                        readOnly={false}
                    />
                )}
            </div>

            {/* Error Toast */}
            {databaseState.error && databaseState.isConnected && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    background: 'rgba(239, 68, 68, 0.95)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                    padding: '1rem',
                    color: '#ffffff',
                    maxWidth: '400px',
                    zIndex: 1000,
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem'
                    }}>
                        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                        <div style={{ flex: 1 }}>
                            <strong>Database Error</strong>
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
                                {databaseState.error}
                            </p>
                        </div>
                        <button
                            onClick={() => setDatabaseState(prev => ({ ...prev, error: null }))}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#ffffff',
                                cursor: 'pointer',
                                fontSize: '1.2rem',
                                padding: '0.25rem',
                                minWidth: '32px',
                                minHeight: '32px'
                            }}
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
    
    // Render fullscreen via portal or embedded
    if (isFullscreen) {
        return createPortal(databaseContent, document.body);
    }
    
    return databaseContent;
};

export default DatabaseInterface;