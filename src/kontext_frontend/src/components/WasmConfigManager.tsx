import React, { useState, useEffect } from 'react';
import { wasmConfigService } from '../services/WasmConfigService';
import { PlatformCanisterService } from '../services/PlatformCanisterService';
import { useAppStore } from '../store/appStore';

export const WasmConfigManager: React.FC = () => {
    const { identity } = useAppStore();
    
    // Current configuration
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [assetCanisterId, setAssetCanisterId] = useState('');
    const [basePath, setBasePath] = useState('');
    const [userCanisterWasm, setUserCanisterWasm] = useState('');
    const [assetStorageWasm, setAssetStorageWasm] = useState('');
    const [agentWasm, setAgentWasm] = useState('');
    const [agentWasmGz, setAgentWasmGz] = useState('');
    const [agencyWasm, setAgencyWasm] = useState('');
    const [agencyWasmGz, setAgencyWasmGz] = useState('');
    
    const [updateStatus, setUpdateStatus] = useState('');
    const [updateSuccess, setUpdateSuccess] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setLoading(true);
            const cfg = await wasmConfigService.getConfig();
            setConfig(cfg);
            
            // Populate edit fields
            setAssetCanisterId(cfg.assetCanisterId);
            setBasePath(cfg.basePath);
            setUserCanisterWasm(cfg.userCanisterWasm);
            setAssetStorageWasm(cfg.assetStorageWasm);
            setAgentWasm(cfg.agentWasm);
            setAgentWasmGz(cfg.agentWasmGz);
            setAgencyWasm(cfg.agencyWasm);
            setAgencyWasmGz(cfg.agencyWasmGz);
        } catch (error) {
            console.error('Failed to load WASM config:', error);
            setUpdateStatus('Failed to load configuration');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!identity) {
            setUpdateStatus('Not authenticated');
            return;
        }

        try {
            setUpdateStatus('Saving configuration...');
            setUpdateSuccess(false);

            const platformService = PlatformCanisterService.createWithIdentity(identity);
            const result = await platformService.updateWasmConfig({
                assetCanisterId,
                basePath,
                userCanisterWasm,
                assetStorageWasm,
                agentWasm,
                agentWasmGz,
                agencyWasm,
                agencyWasmGz
            });

            if ('ok' in result) {
                setUpdateStatus('✅ Configuration updated successfully!');
                setUpdateSuccess(true);
                setIsEditing(false);
                
                // Clear cache and reload
                wasmConfigService.clearCache();
                setTimeout(() => loadConfig(), 500);
            } else {
                setUpdateStatus(`❌ Failed: ${result.err}`);
                setUpdateSuccess(false);
            }
        } catch (error) {
            console.error('Failed to update WASM config:', error);
            setUpdateStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setUpdateSuccess(false);
        }
    };

    const handleCancel = () => {
        if (config) {
            // Reset to current config
            setAssetCanisterId(config.assetCanisterId);
            setBasePath(config.basePath);
            setUserCanisterWasm(config.userCanisterWasm);
            setAssetStorageWasm(config.assetStorageWasm);
            setAgentWasm(config.agentWasm);
            setAgentWasmGz(config.agentWasmGz);
            setAgencyWasm(config.agencyWasm);
            setAgencyWasmGz(config.agencyWasmGz);
        }
        setIsEditing(false);
        setUpdateStatus('');
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                color: 'rgba(255, 255, 255, 0.7)'
            }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    border: '3px solid rgba(255, 107, 53, 0.3)',
                    borderTopColor: 'var(--kontext-orange)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginBottom: '20px'
                }} />
                <p>Loading WASM configuration...</p>
            </div>
        );
    }

    return (
        <div style={{
            background: 'rgb(17, 17, 17)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '900px',
            margin: '0 auto',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}>
            {/* Header */}
            <div style={{
                marginBottom: '2rem',
                paddingBottom: '1rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    margin: '0 0 0.5rem 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <span>⚙️</span>
                    <span>WASM Storage Configuration</span>
                </h2>
                <p style={{
                    margin: 0,
                    fontSize: '0.875rem',
                    color: 'rgba(255, 255, 255, 0.6)'
                }}>
                    Configure where WASM files are stored and accessed system-wide
                </p>
            </div>

            {/* Status Messages */}
            {updateStatus && (
                <div style={{
                    padding: '1rem',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                    background: updateSuccess 
                        ? 'rgba(34, 197, 94, 0.1)' 
                        : updateStatus.includes('Saving')
                        ? 'rgba(251, 191, 36, 0.1)'
                        : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${
                        updateSuccess 
                        ? 'rgba(34, 197, 94, 0.3)' 
                        : updateStatus.includes('Saving')
                        ? 'rgba(251, 191, 36, 0.3)'
                        : 'rgba(239, 68, 68, 0.3)'
                    }`,
                    color: updateSuccess 
                        ? 'rgb(134, 239, 172)' 
                        : updateStatus.includes('Saving')
                        ? 'rgb(253, 224, 71)'
                        : 'rgb(252, 165, 165)'
                }}>
                    {updateStatus}
                </div>
            )}

            {/* Asset Canister Section */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '1.5rem'
            }}>
                <h3 style={{
                    margin: '0 0 1.25rem 0',
                    fontSize: '1rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: 'rgba(255, 255, 255, 0.9)'
                }}>
                    <span>🗄️</span>
                    <span>Asset Canister Storage</span>
                </h3>
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                    gap: '1.25rem' 
                }}>
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontSize: '0.813rem',
                            fontWeight: 500,
                            color: 'rgba(255, 255, 255, 0.7)'
                        }}>
                            Canister ID
                        </label>
                        <input
                            type="text"
                            value={assetCanisterId}
                            onChange={(e) => setAssetCanisterId(e.target.value)}
                            disabled={!isEditing}
                            placeholder="pwi5a-sqaaa-aaaaa-qcfgq-cai"
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: isEditing 
                                    ? '1px solid var(--kontext-orange)' 
                                    : '1px solid rgba(255, 255, 255, 0.1)',
                                background: isEditing 
                                    ? 'rgba(255, 255, 255, 0.05)' 
                                    : 'rgba(0, 0, 0, 0.3)',
                                color: 'rgba(255, 255, 255, 0.9)',
                                fontFamily: 'monospace',
                                fontSize: '0.813rem',
                                outline: 'none',
                                transition: 'all 0.2s ease',
                                cursor: isEditing ? 'text' : 'not-allowed'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontSize: '0.813rem',
                            fontWeight: 500,
                            color: 'rgba(255, 255, 255, 0.7)'
                        }}>
                            Base Path
                        </label>
                        <input
                            type="text"
                            value={basePath}
                            onChange={(e) => setBasePath(e.target.value)}
                            disabled={!isEditing}
                            placeholder="projects/project-xyz/wasms"
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: isEditing 
                                    ? '1px solid var(--kontext-orange)' 
                                    : '1px solid rgba(255, 255, 255, 0.1)',
                                background: isEditing 
                                    ? 'rgba(255, 255, 255, 0.05)' 
                                    : 'rgba(0, 0, 0, 0.3)',
                                color: 'rgba(255, 255, 255, 0.9)',
                                fontFamily: 'monospace',
                                fontSize: '0.813rem',
                                outline: 'none',
                                transition: 'all 0.2s ease',
                                cursor: isEditing ? 'text' : 'not-allowed'
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* WASM Files Section */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '1.5rem'
            }}>
                <h3 style={{
                    margin: '0 0 1.25rem 0',
                    fontSize: '1rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: 'rgba(255, 255, 255, 0.9)'
                }}>
                    <span>📦</span>
                    <span>WASM Files</span>
                </h3>
                <div style={{ 
                    display: 'grid', 
                    gap: '1.25rem' 
                }}>
                    {/* User Canister WASM */}
                    <div style={{
                        background: 'rgba(99, 102, 241, 0.05)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        borderRadius: '8px',
                        padding: '1rem'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.75rem'
                        }}>
                            <span>👤</span>
                            <label style={{
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                color: 'rgba(255, 255, 255, 0.9)'
                            }}>
                                User Canister WASM
                            </label>
                        </div>
                        <input
                            type="text"
                            value={userCanisterWasm}
                            onChange={(e) => setUserCanisterWasm(e.target.value)}
                            disabled={!isEditing}
                            placeholder="wasms/user.wasm"
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '6px',
                                border: isEditing 
                                    ? '1px solid var(--kontext-orange)' 
                                    : '1px solid rgba(255, 255, 255, 0.1)',
                                background: isEditing 
                                    ? 'rgba(255, 255, 255, 0.05)' 
                                    : 'rgba(0, 0, 0, 0.3)',
                                color: 'rgba(255, 255, 255, 0.9)',
                                fontFamily: 'monospace',
                                fontSize: '0.813rem',
                                outline: 'none',
                                cursor: isEditing ? 'text' : 'not-allowed'
                            }}
                        />
                    </div>

                    {/* Asset Storage WASM */}
                    <div style={{
                        background: 'rgba(34, 197, 94, 0.05)',
                        border: '1px solid rgba(34, 197, 94, 0.2)',
                        borderRadius: '8px',
                        padding: '1rem'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.75rem'
                        }}>
                            <span>💾</span>
                            <label style={{
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                color: 'rgba(255, 255, 255, 0.9)'
                            }}>
                                Asset Storage WASM
                            </label>
                        </div>
                        <input
                            type="text"
                            value={assetStorageWasm}
                            onChange={(e) => setAssetStorageWasm(e.target.value)}
                            disabled={!isEditing}
                            placeholder="wasms/assetstorage.wasm.gz"
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '6px',
                                border: isEditing 
                                    ? '1px solid var(--kontext-orange)' 
                                    : '1px solid rgba(255, 255, 255, 0.1)',
                                background: isEditing 
                                    ? 'rgba(255, 255, 255, 0.05)' 
                                    : 'rgba(0, 0, 0, 0.3)',
                                color: 'rgba(255, 255, 255, 0.9)',
                                fontFamily: 'monospace',
                                fontSize: '0.813rem',
                                outline: 'none',
                                cursor: isEditing ? 'text' : 'not-allowed'
                            }}
                        />
                    </div>

                    {/* Agent WASMs */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: '1rem'
                    }}>
                        <div style={{
                            background: 'rgba(168, 85, 247, 0.05)',
                            border: '1px solid rgba(168, 85, 247, 0.2)',
                            borderRadius: '8px',
                            padding: '1rem'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginBottom: '0.75rem'
                            }}>
                                <span>🤖</span>
                                <label style={{
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    color: 'rgba(255, 255, 255, 0.9)'
                                }}>
                                    Agent WASM
                                </label>
                            </div>
                            <input
                                type="text"
                                value={agentWasm}
                                onChange={(e) => setAgentWasm(e.target.value)}
                                disabled={!isEditing}
                                placeholder="wasms/agent.wasm"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: '6px',
                                    border: isEditing 
                                        ? '1px solid var(--kontext-orange)' 
                                        : '1px solid rgba(255, 255, 255, 0.1)',
                                    background: isEditing 
                                        ? 'rgba(255, 255, 255, 0.05)' 
                                        : 'rgba(0, 0, 0, 0.3)',
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    fontFamily: 'monospace',
                                    fontSize: '0.813rem',
                                    outline: 'none',
                                    cursor: isEditing ? 'text' : 'not-allowed'
                                }}
                            />
                        </div>

                        <div style={{
                            background: 'rgba(168, 85, 247, 0.05)',
                            border: '1px solid rgba(168, 85, 247, 0.2)',
                            borderRadius: '8px',
                            padding: '1rem'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginBottom: '0.75rem'
                            }}>
                                <span>📦</span>
                                <label style={{
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    color: 'rgba(255, 255, 255, 0.9)'
                                }}>
                                    Agent WASM (Compressed)
                                </label>
                            </div>
                            <input
                                type="text"
                                value={agentWasmGz}
                                onChange={(e) => setAgentWasmGz(e.target.value)}
                                disabled={!isEditing}
                                placeholder="wasms/agent.wasm.gz"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: '6px',
                                    border: isEditing 
                                        ? '1px solid var(--kontext-orange)' 
                                        : '1px solid rgba(255, 255, 255, 0.1)',
                                    background: isEditing 
                                        ? 'rgba(255, 255, 255, 0.05)' 
                                        : 'rgba(0, 0, 0, 0.3)',
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    fontFamily: 'monospace',
                                    fontSize: '0.813rem',
                                    outline: 'none',
                                    cursor: isEditing ? 'text' : 'not-allowed'
                                }}
                            />
                        </div>
                    </div>

                    {/* Agency WASMs */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: '1rem'
                    }}>
                        <div style={{
                            background: 'rgba(236, 72, 153, 0.05)',
                            border: '1px solid rgba(236, 72, 153, 0.2)',
                            borderRadius: '8px',
                            padding: '1rem'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginBottom: '0.75rem'
                            }}>
                                <span>🏢</span>
                                <label style={{
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    color: 'rgba(255, 255, 255, 0.9)'
                                }}>
                                    Agency WASM
                                </label>
                            </div>
                            <input
                                type="text"
                                value={agencyWasm}
                                onChange={(e) => setAgencyWasm(e.target.value)}
                                disabled={!isEditing}
                                placeholder="wasms/agency.wasm"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: '6px',
                                    border: isEditing 
                                        ? '1px solid var(--kontext-orange)' 
                                        : '1px solid rgba(255, 255, 255, 0.1)',
                                    background: isEditing 
                                        ? 'rgba(255, 255, 255, 0.05)' 
                                        : 'rgba(0, 0, 0, 0.3)',
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    fontFamily: 'monospace',
                                    fontSize: '0.813rem',
                                    outline: 'none',
                                    cursor: isEditing ? 'text' : 'not-allowed'
                                }}
                            />
                        </div>

                        <div style={{
                            background: 'rgba(236, 72, 153, 0.05)',
                            border: '1px solid rgba(236, 72, 153, 0.2)',
                            borderRadius: '8px',
                            padding: '1rem'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginBottom: '0.75rem'
                            }}>
                                <span>📦</span>
                                <label style={{
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    color: 'rgba(255, 255, 255, 0.9)'
                                }}>
                                    Agency WASM (Compressed)
                                </label>
                            </div>
                            <input
                                type="text"
                                value={agencyWasmGz}
                                onChange={(e) => setAgencyWasmGz(e.target.value)}
                                disabled={!isEditing}
                                placeholder="wasms/agency.wasm.gz"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: '6px',
                                    border: isEditing 
                                        ? '1px solid var(--kontext-orange)' 
                                        : '1px solid rgba(255, 255, 255, 0.1)',
                                    background: isEditing 
                                        ? 'rgba(255, 255, 255, 0.05)' 
                                        : 'rgba(0, 0, 0, 0.3)',
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    fontFamily: 'monospace',
                                    fontSize: '0.813rem',
                                    outline: 'none',
                                    cursor: isEditing ? 'text' : 'not-allowed'
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end',
                paddingTop: '1rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                {isEditing ? (
                    <>
                        <button
                            onClick={handleCancel}
                            style={{
                                padding: '0.75rem 1.5rem',
                                borderRadius: '8px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'rgba(255, 255, 255, 0.9)',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            }}
                        >
                            ✕ Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={updateStatus.includes('Saving')}
                            style={{
                                padding: '0.75rem 1.5rem',
                                borderRadius: '8px',
                                border: 'none',
                                background: updateStatus.includes('Saving')
                                    ? 'rgba(255, 107, 53, 0.5)'
                                    : 'linear-gradient(135deg, #f97316, #fbbf24)',
                                color: 'white',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                cursor: updateStatus.includes('Saving') ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 4px 12px rgba(249, 115, 22, 0.4)'
                            }}
                            onMouseEnter={(e) => {
                                if (!updateStatus.includes('Saving')) {
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(249, 115, 22, 0.5)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.4)';
                            }}
                        >
                            {updateStatus.includes('Saving') ? '⏳ Saving...' : '💾 Save Configuration'}
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => setIsEditing(true)}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                            color: 'white',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 12px rgba(249, 115, 22, 0.4)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(249, 115, 22, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.4)';
                        }}
                    >
                        ✏️ Edit Configuration
                    </button>
                )}
            </div>
        </div>
    );
};
