import React, { useState, useEffect } from 'react';
import { Principal } from '@dfinity/principal';
import { PlatformCanisterService } from '../services/PlatformCanisterService';
import { PoolCreationService } from '../services/PoolCreationService';
import { useAppStore } from '../store/appStore';

// Types matching backend
type PoolCanisterStatus = 'Available' | 'Assigned' | 'Creating' | 'Maintenance' | 'Failed';
type CanisterPoolType = 'UserCanister' | 'RegularServerPair' | 'AgentServerPair' | 'AgencyWorkflowPair';

interface PooledCanister {
    canisterId: string;
    poolType: CanisterPoolType;
    status: PoolCanisterStatus;
    createdAt: bigint;
    assignedTo?: string;
    assignedAt?: bigint;
    cycleBalance?: bigint;
    memoryGB: number;
    durationDays: number;
    metadata?: Array<[string, string]>;
}

interface PooledServerPair {
    pairId: string;
    frontendCanisterId: string;
    backendCanisterId: string;
    poolType: CanisterPoolType;
    status: PoolCanisterStatus;
    createdAt: bigint;
    assignedTo?: string;
    assignedAt?: bigint;
    frontendCycles?: bigint;
    backendCycles?: bigint;
    metadata?: Array<[string, string]>;
}

interface PoolStats {
    poolType: { [key: string]: null };
    totalCount: number;
    availableCount: number;
    assignedCount: number;
    creatingCount: number;
    maintenanceCount: number;
    failedCount: number;
    totalCyclesAllocated: bigint;
}

export const CanisterPoolManager: React.FC = () => {
    const { identity, mainActor } = useAppStore();
    const [activeTab, setActiveTab] = useState<'userCanisters' | 'regularPairs' | 'agentPairs' | 'workflowPairs'>('userCanisters');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Data states
    const [userCanisters, setUserCanisters] = useState<PooledCanister[]>([]);
    const [serverPairs, setServerPairs] = useState<PooledServerPair[]>([]);
    const [stats, setStats] = useState<PoolStats | null>(null);

    // Creation mode toggle
    const [creationMode, setCreationMode] = useState<'create' | 'add'>('create');
    const [creating, setCreating] = useState(false);
    const [creationProgress, setCreationProgress] = useState<string>('');

    // Form states for CREATING new resources
    const [newResourceName, setNewResourceName] = useState('');
    const [newMemoryGB, setNewMemoryGB] = useState(1);
    const [newDurationDays, setNewDurationDays] = useState(30);

    // Form states for ADDING existing resources
    const [newCanisterId, setNewCanisterId] = useState('');
    const [newPairId, setNewPairId] = useState('');
    const [newFrontendId, setNewFrontendId] = useState('');
    const [newBackendId, setNewBackendId] = useState('');

    useEffect(() => {
        loadPoolData();
    }, [activeTab, identity]);

    const loadPoolData = async () => {
        if (!identity) return;

        setLoading(true);
        setError(null);

        try {
            const service = PlatformCanisterService.createWithIdentity(identity);

            // Load stats for current tab
            const poolType = getPoolTypeFromTab();
            const statsResult = await service.getPoolStats(poolType);
            
            if ('ok' in statsResult) {
                setStats(statsResult.ok);
            }

            // Load user canisters if on that tab
            if (activeTab === 'userCanisters') {
                const canistersResult = await service.getAllPooledUserCanisters();
                if ('ok' in canistersResult) {
                    setUserCanisters(canistersResult.ok);
                }
            } else {
                // Load server pairs for the selected type
                const pairsResult = await service.getAllPooledServerPairs(poolType);
                if ('ok' in pairsResult) {
                    setServerPairs(pairsResult.ok);
                }
            }
        } catch (err) {
            console.error('Error loading pool data:', err);
            setError(err instanceof Error ? err.message : 'Failed to load pool data');
        } finally {
            setLoading(false);
        }
    };

    const getPoolTypeFromTab = (): any => {
        // Convert to Motoko variant format for backend
        switch (activeTab) {
            case 'userCanisters': return { UserCanister: null };
            case 'regularPairs': return { RegularServerPair: null };
            case 'agentPairs': return { AgentServerPair: null };
            case 'workflowPairs': return { AgencyWorkflowPair: null };
        }
    };

    const handleAddUserCanister = async () => {
        if (!identity || !newCanisterId) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const service = PlatformCanisterService.createWithIdentity(identity);
            const canisterId = Principal.fromText(newCanisterId);
            
            const result = await service.addUserCanisterToPool(
                canisterId,
                newMemoryGB,
                newDurationDays,
                null
            );

            if ('ok' in result) {
                setSuccess('User canister added to pool successfully!');
                setNewCanisterId('');
                loadPoolData();
            } else {
                setError(result.err);
            }
        } catch (err) {
            console.error('Error adding user canister:', err);
            setError(err instanceof Error ? err.message : 'Failed to add user canister');
        } finally {
            setLoading(false);
        }
    };

    const handleAddServerPair = async () => {
        if (!identity || !newPairId || !newFrontendId || !newBackendId) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const service = PlatformCanisterService.createWithIdentity(identity);
            const frontendId = Principal.fromText(newFrontendId);
            const backendId = Principal.fromText(newBackendId);
            const poolType = getPoolTypeFromTab();
            
            const result = await service.addServerPairToPool(
                newPairId,
                frontendId,
                backendId,
                poolType,
                null
            );

            if ('ok' in result) {
                setSuccess('Server pair added to pool successfully!');
                setNewPairId('');
                setNewFrontendId('');
                setNewBackendId('');
                loadPoolData();
            } else {
                setError(result.err);
            }
        } catch (err) {
            console.error('Error adding server pair:', err);
            setError(err instanceof Error ? err.message : 'Failed to add server pair');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveUserCanister = async (canisterId: string) => {
        if (!identity) return;
        if (!confirm('Are you sure you want to remove this canister from the pool?')) return;

        setLoading(true);
        setError(null);

        try {
            const service = PlatformCanisterService.createWithIdentity(identity);
            const principal = Principal.fromText(canisterId);
            
            const result = await service.removeUserCanisterFromPool(principal);

            if ('ok' in result) {
                setSuccess('User canister removed from pool');
                loadPoolData();
            } else {
                setError(result.err);
            }
        } catch (err) {
            console.error('Error removing user canister:', err);
            setError(err instanceof Error ? err.message : 'Failed to remove user canister');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveServerPair = async (pairId: string) => {
        if (!identity) return;
        if (!confirm('Are you sure you want to remove this server pair from the pool?')) return;

        setLoading(true);
        setError(null);

        try {
            const service = PlatformCanisterService.createWithIdentity(identity);
            
            const result = await service.removeServerPairFromPool(pairId);

            if ('ok' in result) {
                setSuccess('Server pair removed from pool');
                loadPoolData();
            } else {
                setError(result.err);
            }
        } catch (err) {
            console.error('Error removing server pair:', err);
            setError(err instanceof Error ? err.message : 'Failed to remove server pair');
        } finally {
            setLoading(false);
        }
    };

    // ===== NEW CREATION HANDLERS =====

    const handleCreateUserCanister = async () => {
        if (!identity || !mainActor || !newResourceName.trim()) {
            setError('Please provide a name for the user canister');
            return;
        }

        setCreating(true);
        setError(null);
        setSuccess(null);
        setCreationProgress('Starting...');

        try {
            const creationService = new PoolCreationService(identity, mainActor);
            
            const result = await creationService.createUserCanisterForPool(
                newResourceName,
                newMemoryGB,
                newDurationDays,
                (status) => setCreationProgress(status)
            );

            if (result.success) {
                setSuccess(`✅ User canister created successfully! ID: ${result.canisterId}`);
                setNewResourceName('');
                loadPoolData();
            } else {
                setError(result.error || 'Failed to create user canister');
            }
        } catch (err) {
            console.error('Error creating user canister:', err);
            setError(err instanceof Error ? err.message : 'Failed to create user canister');
        } finally {
            setCreating(false);
            setCreationProgress('');
        }
    };

    const handleCreateServerPair = async () => {
        if (!identity || !mainActor || !newResourceName.trim()) {
            setError('Please provide a name for the server pair');
            return;
        }

        const pairType = activeTab === 'regularPairs' ? 'RegularServerPair' :
                         activeTab === 'agentPairs' ? 'AgentServerPair' :
                         'AgencyWorkflowPair';

        setCreating(true);
        setError(null);
        setSuccess(null);
        setCreationProgress('Starting...');

        try {
            const creationService = new PoolCreationService(identity, mainActor);
            
            const result = await creationService.createServerPairForPool(
                pairType,
                newResourceName,
                newMemoryGB,
                newDurationDays,
                (status) => setCreationProgress(status)
            );

            if (result.success) {
                setSuccess(`✅ Server pair created successfully!\nPair ID: ${result.pairId}\nFrontend: ${result.frontendCanisterId}\nBackend: ${result.backendCanisterId}`);
                setNewResourceName('');
                loadPoolData();
            } else {
                setError(result.error || 'Failed to create server pair');
            }
        } catch (err) {
            console.error('Error creating server pair:', err);
            setError(err instanceof Error ? err.message : 'Failed to create server pair');
        } finally {
            setCreating(false);
            setCreationProgress('');
        }
    };

    const getStatusColor = (status: PoolCanisterStatus) => {
        switch (status) {
            case 'Available': return '#10b981';
            case 'Assigned': return '#3b82f6';
            case 'Creating': return '#f59e0b';
            case 'Maintenance': return '#8b5cf6';
            case 'Failed': return '#ef4444';
            default: return '#6b7280';
        }
    };

    const formatCycles = (cycles?: bigint) => {
        if (!cycles) return 'N/A';
        const t = Number(cycles) / 1_000_000_000_000;
        return `${t.toFixed(2)} T`;
    };

    const formatDate = (timestamp: bigint) => {
        const date = new Date(Number(timestamp) / 1_000_000); // Convert from nanoseconds
        return date.toLocaleString();
    };

    return (
        <div style={{
            padding: '5px 20px 20px 20px',
            maxWidth: '1600px',
            margin: '0 auto'
        }}>
            {/* Header */}
            <div style={{ marginBottom: '30px', marginTop: '0' }}>
                <h2 style={{ margin: '0 0 10px 0', color: '#ffffff', fontSize: '1.75rem' }}>
                    🏊 Server Pool Management
                </h2>
                <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem' }}>
                    Create new resources or add existing ones to the pool for automatic assignment
                </p>
            </div>

            {/* Error/Success Messages */}
            {error && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '20px',
                    color: '#ef4444'
                }}>
                    ❌ {error}
                </div>
            )}

            {success && (
                <div style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '20px',
                    color: '#10b981'
                }}>
                    ✅ {success}
                </div>
            )}

            {/* Pool Type Tabs */}
            <div style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '20px',
                borderBottom: '1px solid var(--border-color)'
            }}>
                {[
                    { key: 'userCanisters', label: '👤 User Canisters' },
                    { key: 'regularPairs', label: '🔧 Regular Server Pairs' },
                    { key: 'agentPairs', label: '🤖 Agent Server Pairs' },
                    { key: 'workflowPairs', label: '🔄 Workflow Pairs' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        style={{
                            background: activeTab === tab.key ? 'rgba(255, 107, 53, 0.1)' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === tab.key ? '2px solid #ff6b35' : '2px solid transparent',
                            padding: '12px 20px',
                            color: activeTab === tab.key ? '#ff6b35' : 'rgba(255, 255, 255, 0.6)',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            fontWeight: activeTab === tab.key ? '600' : '400',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Statistics Card */}
            {stats && (
                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '20px'
                }}>
                    <h3 style={{ margin: '0 0 15px 0', color: '#ffffff', fontSize: '1.1rem' }}>
                        📊 Pool Statistics
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '5px' }}>Total</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffffff' }}>{stats.totalCount}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '5px' }}>Available</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>{stats.availableCount}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '5px' }}>Assigned</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>{stats.assignedCount}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '5px' }}>Creating</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>{stats.creatingCount}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '5px' }}>Maintenance</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>{stats.maintenanceCount}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '5px' }}>Failed</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ef4444' }}>{stats.failedCount}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '5px' }}>Total Cycles</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ffffff' }}>{formatCycles(stats.totalCyclesAllocated)}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add New Item Form */}
            {/* Create/Add Interface */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(16, 185, 129, 0.05))',
                border: '2px solid rgba(255, 107, 53, 0.3)',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '20px',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Top gradient bar */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(90deg, #ff6b35, #10b981, #a855f7)',
                }}></div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.25rem', fontWeight: '700' }}>
                        {creationMode === 'create' ? '🚀 Create New Resource' : '➕ Add Existing Resource'}
                    </h3>

                    {/* Mode Toggle */}
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '8px',
                        padding: '4px'
                    }}>
                        <button
                            onClick={() => setCreationMode('create')}
                            style={{
                                padding: '8px 16px',
                                background: creationMode === 'create' ? '#ff6b35' : 'transparent',
                                border: 'none',
                                borderRadius: '6px',
                                color: '#ffffff',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            🚀 Create New
                        </button>
                        <button
                            onClick={() => setCreationMode('add')}
                            style={{
                                padding: '8px 16px',
                                background: creationMode === 'add' ? '#ff6b35' : 'transparent',
                                border: 'none',
                                borderRadius: '6px',
                                color: '#ffffff',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            ➕ Add Existing
                        </button>
                    </div>
                </div>

                {/* Progress Indicator */}
                {creating && creationProgress && (
                    <div style={{
                        background: 'rgba(255, 107, 53, 0.1)',
                        border: '1px solid rgba(255, 107, 53, 0.3)',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        marginBottom: '16px',
                        color: '#ff6b35',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <div style={{
                            width: '20px',
                            height: '20px',
                            border: '3px solid rgba(255, 107, 53, 0.3)',
                            borderTopColor: '#ff6b35',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }}></div>
                        <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{creationProgress}</span>
                    </div>
                )}

                {/* Create Mode - New Forms */}
                {creationMode === 'create' ? (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '700' }}>
                                    {activeTab === 'userCanisters' ? 'Resource Name' : 'Server Pair Name'}
                                </label>
                                <input
                                    type="text"
                                    value={newResourceName}
                                    onChange={(e) => setNewResourceName(e.target.value)}
                                    placeholder={activeTab === 'userCanisters' ? 'e.g. User Canister #1' : 'e.g. Server Pair #1'}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        border: '2px solid rgba(255, 107, 53, 0.3)',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '700' }}>
                                    Memory (GB)
                                </label>
                                <input
                                    type="number"
                                    value={newMemoryGB}
                                    onChange={(e) => setNewMemoryGB(Number(e.target.value))}
                                    min="1"
                                    max="8"
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        border: '2px solid rgba(255, 107, 53, 0.3)',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '700' }}>
                                    Duration (Days)
                                </label>
                                <input
                                    type="number"
                                    value={newDurationDays}
                                    onChange={(e) => setNewDurationDays(Number(e.target.value))}
                                    min="1"
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        border: '2px solid rgba(255, 107, 53, 0.3)',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>
                            <button
                                onClick={activeTab === 'userCanisters' ? handleCreateUserCanister : handleCreateServerPair}
                                disabled={creating || !newResourceName.trim()}
                                style={{
                                    padding: '12px 24px',
                                    background: creating || !newResourceName.trim() ? 'rgba(107, 114, 128, 0.5)' : 'linear-gradient(135deg, #ff6b35, #f59e0b)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#ffffff',
                                    fontSize: '0.95rem',
                                    fontWeight: '700',
                                    cursor: creating || !newResourceName.trim() ? 'not-allowed' : 'pointer',
                                    opacity: creating || !newResourceName.trim() ? 0.5 : 1,
                                    boxShadow: creating || !newResourceName.trim() ? 'none' : '0 4px 12px rgba(255, 107, 53, 0.3)',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {creating ? '⏳ Creating...' : '🚀 Create'}
                            </button>
                        </div>

                        {/* Creation Info */}
                        <div style={{
                            marginTop: '16px',
                            padding: '12px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '8px',
                            color: 'rgba(255, 255, 255, 0.7)',
                            fontSize: '0.85rem'
                        }}>
                            ℹ️ This will create a new {activeTab === 'userCanisters' ? 'user canister' : 'server pair'} with WASM deployed and add it to the pool ready for assignment.
                        </div>
                    </div>
                ) : (
                    /* Add Mode - Existing Forms */
                    <div>

                {activeTab === 'userCanisters' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                                Canister ID
                            </label>
                            <input
                                type="text"
                                value={newCanisterId}
                                onChange={(e) => setNewCanisterId(e.target.value)}
                                placeholder="rrkah-fqaaa-aaaaa-aaaaq-cai"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    color: '#ffffff',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                                Memory (GB)
                            </label>
                            <input
                                type="number"
                                value={newMemoryGB}
                                onChange={(e) => setNewMemoryGB(Number(e.target.value))}
                                min="1"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    color: '#ffffff',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                                Duration (Days)
                            </label>
                            <input
                                type="number"
                                value={newDurationDays}
                                onChange={(e) => setNewDurationDays(Number(e.target.value))}
                                min="1"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    color: '#ffffff',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>
                        <button
                            onClick={handleAddUserCanister}
                            disabled={loading || !newCanisterId}
                            style={{
                                padding: '10px 20px',
                                background: '#ff6b35',
                                border: 'none',
                                borderRadius: '6px',
                                color: '#ffffff',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                cursor: loading || !newCanisterId ? 'not-allowed' : 'pointer',
                                opacity: loading || !newCanisterId ? 0.5 : 1
                            }}
                        >
                            Add Canister
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                                Pair ID
                            </label>
                            <input
                                type="text"
                                value={newPairId}
                                onChange={(e) => setNewPairId(e.target.value)}
                                placeholder="pair_unique_id"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    color: '#ffffff',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                                Frontend Canister ID
                            </label>
                            <input
                                type="text"
                                value={newFrontendId}
                                onChange={(e) => setNewFrontendId(e.target.value)}
                                placeholder="rrkah-fqaaa-aaaaa-aaaaq-cai"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    color: '#ffffff',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                                Backend Canister ID
                            </label>
                            <input
                                type="text"
                                value={newBackendId}
                                onChange={(e) => setNewBackendId(e.target.value)}
                                placeholder="ryjl3-tyaaa-aaaaa-aaaba-cai"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    color: '#ffffff',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>
                        <button
                            onClick={handleAddServerPair}
                            disabled={loading || !newPairId || !newFrontendId || !newBackendId}
                            style={{
                                padding: '10px 20px',
                                background: '#ff6b35',
                                border: 'none',
                                borderRadius: '6px',
                                color: '#ffffff',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                cursor: (loading || !newPairId || !newFrontendId || !newBackendId) ? 'not-allowed' : 'pointer',
                                opacity: (loading || !newPairId || !newFrontendId || !newBackendId) ? 0.5 : 1
                            }}
                        >
                            Add Pair
                        </button>
                    </div>
                )}
                </div>
                )}

                <style>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>

            {/* Items List */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '20px'
            }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#ffffff', fontSize: '1.1rem' }}>
                    📋 Pool Items
                </h3>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.5)' }}>
                        Loading...
                    </div>
                ) : activeTab === 'userCanisters' ? (
                    userCanisters.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.5)' }}>
                            No user canisters in pool. Add one above.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {userCanisters.map(canister => (
                                <div
                                    key={canister.canisterId}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        padding: '15px',
                                        display: 'grid',
                                        gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                                        gap: '15px',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '3px' }}>Canister ID</div>
                                        <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#ffffff' }}>{canister.canisterId}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '3px' }}>Status</div>
                                        <div style={{ 
                                            display: 'inline-block',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            background: `${getStatusColor(canister.status)}20`,
                                            color: getStatusColor(canister.status),
                                            fontSize: '0.85rem',
                                            fontWeight: '500'
                                        }}>
                                            {canister.status}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '3px' }}>Cycles</div>
                                        <div style={{ fontSize: '0.9rem', color: '#ffffff' }}>{formatCycles(canister.cycleBalance)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '3px' }}>Created</div>
                                        <div style={{ fontSize: '0.85rem', color: '#ffffff' }}>{formatDate(canister.createdAt)}</div>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveUserCanister(canister.canisterId)}
                                        style={{
                                            padding: '8px 16px',
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            borderRadius: '6px',
                                            color: '#ef4444',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    serverPairs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.5)' }}>
                            No server pairs in pool. Add one above.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {serverPairs.map(pair => (
                                <div
                                    key={pair.pairId}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        padding: '15px'
                                    }}
                                >
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '15px', marginBottom: '10px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '3px' }}>Pair ID</div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: '500', color: '#ffffff' }}>{pair.pairId}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '3px' }}>Status</div>
                                            <div style={{ 
                                                display: 'inline-block',
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                background: `${getStatusColor(pair.status)}20`,
                                                color: getStatusColor(pair.status),
                                                fontSize: '0.85rem',
                                                fontWeight: '500'
                                            }}>
                                                {pair.status}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveServerPair(pair.pairId)}
                                            style={{
                                                padding: '8px 16px',
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                borderRadius: '6px',
                                                color: '#ef4444',
                                                fontSize: '0.85rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '3px' }}>Frontend</div>
                                            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#ffffff' }}>{pair.frontendCanisterId}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '3px' }}>
                                                Cycles: {formatCycles(pair.frontendCycles)}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '3px' }}>Backend</div>
                                            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#ffffff' }}>{pair.backendCanisterId}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '3px' }}>
                                                Cycles: {formatCycles(pair.backendCycles)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
};


