import React, { useState } from 'react';
import { Principal } from '@dfinity/principal';
import { PlatformCanisterService } from '../services/PlatformCanisterService';
import { useAppStore } from '../store/appStore';

interface UserCanisterInfo {
    userPrincipal: string;
    userCanisterId: string;
    cycleBalance: bigint;
    memorySize: bigint;
    createdAt: bigint;
    lastTopup?: bigint;
    totalTopups: number;
    controllers: string[];
    status: string;
}

export const UserCanisterAdmin: React.FC = () => {
    const { identity } = useAppStore();
    const [activeTab, setActiveTab] = useState<'lookup' | 'topup' | 'replace' | 'all'>('lookup');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Lookup state
    const [lookupPrincipal, setLookupPrincipal] = useState('');
    const [canisterInfo, setCanisterInfo] = useState<UserCanisterInfo | null>(null);

    // Topup state
    const [topupPrincipal, setTopupPrincipal] = useState('');
    const [topupAmount, setTopupAmount] = useState('1000000000'); // 1T cycles in e8s

    // Replace state
    const [replacePrincipal, setReplacePrincipal] = useState('');
    const [newCanisterId, setNewCanisterId] = useState('');
    const [replaceReason, setReplaceReason] = useState('');

    // All users state
    const [allUserCanisters, setAllUserCanisters] = useState<Array<[string, string]>>([]);

    const handleLookup = async () => {
        if (!identity || !lookupPrincipal) return;

        setLoading(true);
        setError(null);
        setCanisterInfo(null);

        try {
            const service = PlatformCanisterService.createWithIdentity(identity);
            const principal = Principal.fromText(lookupPrincipal);
            
            const result = await service.getUserCanisterInfo(principal);

            if ('ok' in result) {
                setCanisterInfo(result.ok);
            } else {
                setError(result.err);
            }
        } catch (err) {
            console.error('Error looking up canister:', err);
            setError(err instanceof Error ? err.message : 'Failed to lookup canister');
        } finally {
            setLoading(false);
        }
    };

    const handleTopup = async () => {
        if (!identity || !topupPrincipal || !topupAmount) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const service = PlatformCanisterService.createWithIdentity(identity);
            const principal = Principal.fromText(topupPrincipal);
            const icpE8s = BigInt(topupAmount);
            
            const result = await service.adminTopUpUserCanister(principal, icpE8s);

            if ('ok' in result) {
                setSuccess(result.ok);
                setTopupPrincipal('');
                setTopupAmount('1000000000');
            } else {
                setError(result.err);
            }
        } catch (err) {
            console.error('Error topping up canister:', err);
            setError(err instanceof Error ? err.message : 'Failed to top up canister');
        } finally {
            setLoading(false);
        }
    };

    const handleReplace = async () => {
        if (!identity || !replacePrincipal || !newCanisterId || !replaceReason) return;

        if (!confirm('Are you sure you want to replace this user\'s canister? This is a critical operation!')) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const service = PlatformCanisterService.createWithIdentity(identity);
            const userPrincipal = Principal.fromText(replacePrincipal);
            const canisterId = Principal.fromText(newCanisterId);
            
            const result = await service.adminReplaceUserCanister(userPrincipal, canisterId, replaceReason);

            if ('ok' in result) {
                setSuccess(`Canister replaced successfully. New canister: ${result.ok.newCanisterId}`);
                setReplacePrincipal('');
                setNewCanisterId('');
                setReplaceReason('');
            } else {
                setError(result.err);
            }
        } catch (err) {
            console.error('Error replacing canister:', err);
            setError(err instanceof Error ? err.message : 'Failed to replace canister');
        } finally {
            setLoading(false);
        }
    };

    const handleLoadAllUsers = async () => {
        if (!identity) return;

        setLoading(true);
        setError(null);

        try {
            const service = PlatformCanisterService.createWithIdentity(identity);
            
            const result = await service.getAllUserCanisters();

            if ('ok' in result) {
                setAllUserCanisters(result.ok);
            } else {
                setError(result.err);
            }
        } catch (err) {
            console.error('Error loading all users:', err);
            setError(err instanceof Error ? err.message : 'Failed to load all users');
        } finally {
            setLoading(false);
        }
    };

    const formatCycles = (cycles: bigint) => {
        const t = Number(cycles) / 1_000_000_000_000;
        return `${t.toFixed(2)} T`;
    };

    const formatMemory = (bytes: bigint) => {
        const mb = Number(bytes) / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    const formatDate = (timestamp: bigint) => {
        const date = new Date(Number(timestamp) / 1_000_000);
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
                    🔧 User Canister Administration
                </h2>
                <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem' }}>
                    Lookup, top up, replace, and troubleshoot user canisters
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

            {/* Action Tabs */}
            <div style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '20px',
                borderBottom: '1px solid var(--border-color)'
            }}>
                {[
                    { key: 'lookup', label: '🔍 Lookup & Troubleshoot' },
                    { key: 'topup', label: '⛽ Top Up Canister' },
                    { key: 'replace', label: '🔄 Replace Canister' },
                    { key: 'all', label: '📋 All Users' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => {
                            setActiveTab(tab.key as any);
                            if (tab.key === 'all') {
                                handleLoadAllUsers();
                            }
                        }}
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

            {/* Tab Content */}
            {activeTab === 'lookup' && (
                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '20px'
                }}>
                    <h3 style={{ margin: '0 0 15px 0', color: '#ffffff', fontSize: '1.1rem' }}>
                        Lookup User Canister
                    </h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', marginBottom: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                                User Principal
                            </label>
                            <input
                                type="text"
                                value={lookupPrincipal}
                                onChange={(e) => setLookupPrincipal(e.target.value)}
                                placeholder="Enter user principal..."
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
                            onClick={handleLookup}
                            disabled={loading || !lookupPrincipal}
                            style={{
                                padding: '10px 30px',
                                background: '#ff6b35',
                                border: 'none',
                                borderRadius: '6px',
                                color: '#ffffff',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                cursor: loading || !lookupPrincipal ? 'not-allowed' : 'pointer',
                                opacity: loading || !lookupPrincipal ? 0.5 : 1,
                                alignSelf: 'flex-end'
                            }}
                        >
                            Lookup
                        </button>
                    </div>

                    {canisterInfo && (
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '20px',
                            marginTop: '20px'
                        }}>
                            <h4 style={{ margin: '0 0 15px 0', color: '#ffffff', fontSize: '1rem' }}>
                                Canister Information
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                                <div>
                                    <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '3px' }}>User Principal</div>
                                    <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#ffffff', wordBreak: 'break-all' }}>
                                        {canisterInfo.userPrincipal}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '3px' }}>Canister ID</div>
                                    <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#ffffff', wordBreak: 'break-all' }}>
                                        {canisterInfo.userCanisterId}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '3px' }}>Status</div>
                                    <div style={{
                                        display: 'inline-block',
                                        padding: '4px 12px',
                                        borderRadius: '12px',
                                        background: canisterInfo.status === 'running' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                        color: canisterInfo.status === 'running' ? '#10b981' : '#ef4444',
                                        fontSize: '0.85rem',
                                        fontWeight: '500'
                                    }}>
                                        {canisterInfo.status}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '3px' }}>Cycle Balance</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#10b981' }}>
                                        {formatCycles(canisterInfo.cycleBalance)}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '3px' }}>Memory Size</div>
                                    <div style={{ fontSize: '0.9rem', color: '#ffffff' }}>
                                        {formatMemory(canisterInfo.memorySize)}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '3px' }}>Created At</div>
                                    <div style={{ fontSize: '0.85rem', color: '#ffffff' }}>
                                        {formatDate(canisterInfo.createdAt)}
                                    </div>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '3px' }}>Controllers</div>
                                    <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#ffffff' }}>
                                        {canisterInfo.controllers.map((controller, idx) => (
                                            <div key={idx} style={{ marginBottom: '2px' }}>{controller}</div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'topup' && (
                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '20px'
                }}>
                    <h3 style={{ margin: '0 0 15px 0', color: '#ffffff', fontSize: '1.1rem' }}>
                        Top Up User Canister
                    </h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                                User Principal
                            </label>
                            <input
                                type="text"
                                value={topupPrincipal}
                                onChange={(e) => setTopupPrincipal(e.target.value)}
                                placeholder="Enter user principal..."
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
                                ICP Amount (e8s)
                            </label>
                            <input
                                type="text"
                                value={topupAmount}
                                onChange={(e) => setTopupAmount(e.target.value)}
                                placeholder="1000000000 (1T cycles)"
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
                            onClick={handleTopup}
                            disabled={loading || !topupPrincipal || !topupAmount}
                            style={{
                                padding: '10px 30px',
                                background: '#10b981',
                                border: 'none',
                                borderRadius: '6px',
                                color: '#ffffff',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                cursor: loading || !topupPrincipal || !topupAmount ? 'not-allowed' : 'pointer',
                                opacity: loading || !topupPrincipal || !topupAmount ? 0.5 : 1,
                                alignSelf: 'flex-end'
                            }}
                        >
                            Top Up
                        </button>
                    </div>

                    <div style={{
                        marginTop: '15px',
                        padding: '12px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                        <strong>Note:</strong> ICP e8s is the smallest unit of ICP (1 ICP = 100,000,000 e8s).
                        Common values: 1T cycles ≈ 1,000,000,000 e8s
                    </div>
                </div>
            )}

            {activeTab === 'replace' && (
                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '20px'
                }}>
                    <h3 style={{ margin: '0 0 15px 0', color: '#ffffff', fontSize: '1.1rem' }}>
                        Replace User Canister
                    </h3>
                    
                    <div style={{ display: 'grid', gap: '15px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                                User Principal
                            </label>
                            <input
                                type="text"
                                value={replacePrincipal}
                                onChange={(e) => setReplacePrincipal(e.target.value)}
                                placeholder="Enter user principal..."
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
                                New Canister ID
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
                                Reason for Replacement
                            </label>
                            <textarea
                                value={replaceReason}
                                onChange={(e) => setReplaceReason(e.target.value)}
                                placeholder="Explain why this replacement is necessary..."
                                rows={3}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    color: '#ffffff',
                                    fontSize: '0.9rem',
                                    resize: 'vertical'
                                }}
                            />
                        </div>
                        <button
                            onClick={handleReplace}
                            disabled={loading || !replacePrincipal || !newCanisterId || !replaceReason}
                            style={{
                                padding: '12px 30px',
                                background: '#ef4444',
                                border: 'none',
                                borderRadius: '6px',
                                color: '#ffffff',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                cursor: loading || !replacePrincipal || !newCanisterId || !replaceReason ? 'not-allowed' : 'pointer',
                                opacity: loading || !replacePrincipal || !newCanisterId || !replaceReason ? 0.5 : 1
                            }}
                        >
                            ⚠️ Replace Canister (Critical Operation)
                        </button>
                    </div>

                    <div style={{
                        marginTop: '15px',
                        padding: '12px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#ef4444'
                    }}>
                        <strong>Warning:</strong> This operation will update the user's canister mapping. 
                        Data migration logic is not implemented yet - use with extreme caution!
                    </div>
                </div>
            )}

            {activeTab === 'all' && (
                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '20px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.1rem' }}>
                            All User Canisters ({allUserCanisters.length})
                        </h3>
                        <button
                            onClick={handleLoadAllUsers}
                            disabled={loading}
                            style={{
                                padding: '8px 16px',
                                background: 'rgba(255, 107, 53, 0.1)',
                                border: '1px solid rgba(255, 107, 53, 0.3)',
                                borderRadius: '6px',
                                color: '#ff6b35',
                                fontSize: '0.85rem',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.5 : 1
                            }}
                        >
                            🔄 Refresh
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.5)' }}>
                            Loading...
                        </div>
                    ) : allUserCanisters.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.5)' }}>
                            No user canisters found.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '8px', maxHeight: '600px', overflowY: 'auto' }}>
                            {allUserCanisters.map(([userPrincipal, canisterId], idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        padding: '12px 15px',
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr auto',
                                        gap: '15px',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '3px' }}>User Principal</div>
                                        <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#ffffff', wordBreak: 'break-all' }}>
                                            {userPrincipal}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '3px' }}>Canister ID</div>
                                        <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#ffffff', wordBreak: 'break-all' }}>
                                            {canisterId}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setLookupPrincipal(userPrincipal);
                                            setActiveTab('lookup');
                                        }}
                                        style={{
                                            padding: '6px 12px',
                                            background: 'rgba(59, 130, 246, 0.1)',
                                            border: '1px solid rgba(59, 130, 246, 0.3)',
                                            borderRadius: '6px',
                                            color: '#3b82f6',
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        View Details
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


