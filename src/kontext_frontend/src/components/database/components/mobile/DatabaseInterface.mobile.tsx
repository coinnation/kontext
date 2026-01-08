import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../../../store/appStore';
import { DynamicCanisterService } from '../../shared/services/DynamicCanisterService';
import { CanisterMethodDiscovery } from '../../shared/services/CanisterMethodDiscovery';
import { MobileFormInterface } from './MobileFormInterface';
import { MobileTableInterface } from './MobileTableInterface';
import { MobileQueryInterface } from './MobileQueryInterface';
import { JsonEditor } from '../shared/JsonEditor';

interface DatabaseInterfaceMobileProps {
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
    isKontextOwner?: boolean; // 🔥 NEW: Track if current user is Kontext owner
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

export const DatabaseInterfaceMobile: React.FC<DatabaseInterfaceMobileProps> = ({
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

            // 🔥 NEW: Check if this user is the Kontext owner
            let isKontextOwner = false;
            try {
                if (typeof canisterActor.isKontextOwnerQuery === 'function') {
                    isKontextOwner = await canisterActor.isKontextOwnerQuery();
                    console.log(`🔐 [DatabaseInterface] Kontext owner: ${isKontextOwner}`);
                }
            } catch (ownerCheckError) {
                console.warn('⚠️ [DatabaseInterface] Could not check Kontext owner status:', ownerCheckError);
            }

            const initialData = await DynamicCanisterService.loadCanisterData(
                canisterActor, 
                methodInfo, 
                didJsFile ? didJsFile[1] : (didDtsFile ? didDtsFile[1] : undefined),
                !!didJsFile,
                isKontextOwner // 🔥 NEW: Pass Kontext owner status
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
                padding: '1.5rem',
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1.5rem',
                textAlign: 'center',
                background: 'var(--bg-dark)'
            }}>
                <div style={{ fontSize: '3rem', opacity: 0.3 }}>🗄️</div>
                <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    color: '#ffffff',
                    margin: 0,
                    marginBottom: '0.5rem'
                }}>
                    No Server Pair Selected
                </h2>
                <p style={{
                    fontSize: '0.9rem',
                    color: 'var(--text-gray)',
                    lineHeight: 1.6,
                    margin: 0,
                    maxWidth: '90%'
                }}>
                    Please select a server pair from the <strong>Hosting</strong> tab to access your backend canister's database interface.
                </p>
                <div style={{
                    background: 'rgba(255, 107, 53, 0.1)',
                    border: '1px solid rgba(255, 107, 53, 0.3)',
                    borderRadius: '12px',
                    padding: '1rem',
                    width: '100%',
                    maxWidth: '400px'
                }}>
                    <h3 style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: 'var(--accent-orange)',
                        margin: '0 0 1rem 0'
                    }}>
                        💡 Quick Start:
                    </h3>
                    <ol style={{
                        color: 'var(--text-gray)',
                        textAlign: 'left',
                        lineHeight: 1.6,
                        paddingLeft: '1.2rem',
                        fontSize: '0.9rem',
                        margin: 0
                    }}>
                        <li>Go to <strong>Hosting</strong></li>
                        <li>Create server pair</li>
                        <li>Deploy project</li>
                        <li>Return to Database</li>
                    </ol>
                </div>
            </div>
        );
    }

    if (databaseState.isLoading) {
        return (
            <div style={{
                padding: '2rem 1.5rem',
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2rem',
                background: 'var(--bg-dark)'
            }}>
                <LoadingSpinner size="large" />
                <div style={{
                    textAlign: 'center',
                    color: 'var(--text-gray)'
                }}>
                    <h3 style={{
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        color: '#ffffff',
                        margin: '0 0 0.5rem 0'
                    }}>
                        Connecting to Database
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>
                        Analyzing canister interface and loading data...
                    </p>
                </div>
            </div>
        );
    }

    if (databaseState.error && !databaseState.isConnected) {
        return (
            <div style={{
                padding: '1.5rem',
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2rem',
                textAlign: 'center',
                background: 'var(--bg-dark)'
            }}>
                <div style={{ fontSize: '3rem', opacity: 0.3 }}>⚠️</div>
                <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    color: '#ffffff',
                    margin: 0,
                    marginBottom: '0.5rem'
                }}>
                    Connection Failed
                </h2>
                <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                    padding: '1rem',
                    width: '100%',
                    maxWidth: '400px'
                }}>
                    <p style={{
                        fontSize: '0.9rem',
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
                            padding: '0.875rem 1.5rem',
                            fontSize: '1rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            width: '100%',
                            minHeight: '48px',
                            transition: 'all 0.2s ease'
                        }}
                        onTouchStart={(e) => {
                            e.currentTarget.style.transform = 'scale(0.98)';
                        }}
                        onTouchEnd={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
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
            minHeight: '100vh',
            background: 'var(--bg-dark)',
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            ...(isFullscreen && {
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 10000,
                isolation: 'isolate'
            })
        }}>
            {/* Mobile Header - Sticky */}
            <div style={{
                position: 'sticky',
                top: 0,
                zIndex: 100,
                background: 'rgba(0, 0, 0, 0.9)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid var(--border-color)'
            }}>
                {/* Title and Status */}
                <div style={{
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h1 style={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            color: '#ffffff',
                            margin: 0,
                            marginBottom: '0.25rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>
                            🗄️ {projectName}
                        </h1>
                        
                        {/* Compact Status Line */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.75rem',
                            color: 'var(--text-gray)',
                            flexWrap: 'wrap'
                        }}>
                            {/* Connection Status */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem'
                            }}>
                                <div style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: databaseState.isConnected ? 'var(--accent-green)' : '#ef4444'
                                }} />
                                <span style={{
                                    color: databaseState.isConnected ? 'var(--accent-green)' : '#ef4444',
                                    fontWeight: 600
                                }}>
                                    {databaseState.isConnected ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                            
                            {databaseState.isConnected && databaseState.methodInfo && (
                                <>
                                    <span style={{ opacity: 0.5 }}>•</span>
                                    <span>{totalMethods} methods</span>
                                </>
                            )}
                            
                            <span style={{ opacity: 0.5 }}>•</span>
                            <span>{selectedServerPair.backendCanisterId.substring(0, 6)}...</span>
                        </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {/* Fullscreen Toggle */}
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '6px',
                                color: 'var(--text-gray)',
                                padding: '0.5rem',
                                fontSize: '1.25rem',
                                cursor: 'pointer',
                                minWidth: '40px',
                                height: '40px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                        >
                            {isFullscreen ? '⤓' : '⤢'}
                        </button>
                        
                        {/* Save Button */}
                        {isDirty && (
                            <button
                                onClick={handleSaveChanges}
                                disabled={!!savingStatus.saving}
                                style={{
                                    background: 'linear-gradient(135deg, var(--accent-green), #059669)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#ffffff',
                                padding: '0.75rem 1rem',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                cursor: savingStatus.saving ? 'not-allowed' : 'pointer',
                                opacity: savingStatus.saving ? 0.7 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                minHeight: '40px',
                                flexShrink: 0,
                                marginLeft: '0.75rem'
                            }}
                            onTouchStart={savingStatus.saving ? undefined : (e) => {
                                e.currentTarget.style.transform = 'scale(0.95)';
                            }}
                            onTouchEnd={savingStatus.saving ? undefined : (e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            {savingStatus.saving ? (
                                <>
                                    <div style={{
                                        width: '12px',
                                        height: '12px',
                                        border: '2px solid rgba(255, 255, 255, 0.3)',
                                        borderTop: '2px solid #ffffff',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }} />
                                    Saving
                                </>
                            ) : (
                                <>💾 Save</>
                            )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Tab Bar */}
                <div style={{
                    display: 'flex',
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    padding: '0 1rem 1rem 1rem',
                    gap: '0.5rem',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                }}>
                    {[
                        { id: 'form', label: 'Forms', icon: '📝' },
                        { id: 'table', label: 'Tables', icon: '📊' },
                        { id: 'query', label: 'Queries', icon: '🔍' },
                        { id: 'json', label: 'JSON', icon: '📄' }
                    ].map(view => (
                        <button
                            key={view.id}
                            onClick={() => setActiveView(view.id as any)}
                            style={{
                                background: activeView === view.id
                                    ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.3), rgba(16, 185, 129, 0.2))'
                                    : 'rgba(255, 255, 255, 0.05)',
                                border: activeView === view.id
                                    ? '2px solid rgba(255, 107, 53, 0.5)'
                                    : '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                color: activeView === view.id ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                                padding: '0.75rem 1rem',
                                fontSize: '0.9rem',
                                fontWeight: activeView === view.id ? 600 : 500,
                                cursor: 'pointer',
                                minHeight: '48px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                transition: 'all 0.2s ease'
                            }}
                            onTouchStart={(e) => {
                                e.currentTarget.style.transform = 'scale(0.98)';
                            }}
                            onTouchEnd={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            <span>{view.icon}</span>
                            {view.label}
                        </button>
                    ))}
                </div>
                
                <style>{`
                    div::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>
            </div>

            {/* Main Content */}
            <div>
                {activeView === 'form' && databaseState.schema && (
                    <MobileFormInterface
                        schema={databaseState.schema}
                        data={databaseState.data}
                        onChange={handleDataChange}
                        selectedSection={selectedSection}
                        onSectionChange={setSelectedSection}
                        savingStatus={savingStatus}
                    />
                )}

                {activeView === 'table' && databaseState.schema && (
                    <MobileTableInterface
                        schema={databaseState.schema}
                        data={databaseState.data}
                        onChange={handleDataChange}
                    />
                )}

                {activeView === 'query' && databaseState.methodInfo && (
                    <MobileQueryInterface
                        methodInfo={databaseState.methodInfo}
                        canisterActor={databaseState.canisterActor}
                        candidContent={databaseState.candidContent}
                        isDidJs={databaseState.isDidJs}
                    />
                )}

                {activeView === 'json' && (
                    <div style={{
                        height: 'calc(100vh - 200px)',
                        minHeight: '400px'
                    }}>
                        <JsonEditor
                            value={databaseState.data}
                            onChange={handleDataChange}
                            readOnly={false}
                        />
                    </div>
                )}
            </div>

            {/* Error Toast */}
            {databaseState.error && databaseState.isConnected && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    left: '1rem',
                    right: '1rem',
                    background: 'rgba(239, 68, 68, 0.95)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                    padding: '1rem',
                    color: '#ffffff',
                    zIndex: 1000,
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem'
                    }}>
                        <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>⚠️</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
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
                                minHeight: '32px',
                                flexShrink: 0
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
            `}</style>
        </div>
    );
    
    // Render fullscreen via portal or embedded
    if (isFullscreen) {
        return createPortal(databaseContent, document.body);
    }
    
    return databaseContent;
};

export default DatabaseInterfaceMobile;