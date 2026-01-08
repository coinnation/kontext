import React from 'react';

interface DatabaseConnectionPanelProps {
    serverPair: {
        pairId: string;
        name: string;
        frontendCanisterId: string;
        backendCanisterId: string;
        createdAt: number;
        creditsAllocated: number;
    };
    isConnected: boolean;
    methodInfo: {
        getters: Array<{ name: string; sectionName: string }>;
        setters: Array<{ name: string; sectionName: string }>;
        queries: Array<{ name: string; sectionName: string }>;
        updates: Array<{ name: string; sectionName: string }>;
    } | null;
    onReconnect: () => void;
}

export const DatabaseConnectionPanel: React.FC<DatabaseConnectionPanelProps> = ({
    serverPair,
    isConnected,
    methodInfo,
    onReconnect
}) => {
    const totalMethods = methodInfo 
        ? methodInfo.getters.length + methodInfo.setters.length + methodInfo.queries.length + methodInfo.updates.length
        : 0;

    return (
        <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {/* Connection Status Indicator */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: isConnected ? 'var(--accent-green)' : '#ef4444',
                        boxShadow: isConnected 
                            ? '0 0 8px rgba(16, 185, 129, 0.4)' 
                            : '0 0 8px rgba(239, 68, 68, 0.4)',
                        animation: isConnected ? 'pulse 2s infinite' : 'none'
                    }} />
                    <span style={{
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: isConnected ? 'var(--accent-green)' : '#ef4444'
                    }}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>

                {/* Server Details */}
                <div style={{
                    borderLeft: '1px solid var(--border-color)',
                    paddingLeft: '1rem'
                }}>
                    <div style={{
                        fontSize: '0.85rem',
                        color: '#ffffff',
                        fontWeight: 500,
                        marginBottom: '0.25rem'
                    }}>
                        Backend: {serverPair.backendCanisterId.substring(0, 8)}...
                    </div>
                    <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-gray)'
                    }}>
                        {serverPair.creditsAllocated} credits allocated
                    </div>
                </div>

                {/* Method Count */}
                {isConnected && methodInfo && (
                    <div style={{
                        borderLeft: '1px solid var(--border-color)',
                        paddingLeft: '1rem'
                    }}>
                        <div style={{
                            fontSize: '0.85rem',
                            color: '#ffffff',
                            fontWeight: 500,
                            marginBottom: '0.25rem'
                        }}>
                            {totalMethods} Methods Discovered
                        </div>
                        <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-gray)',
                            display: 'flex',
                            gap: '0.75rem'
                        }}>
                            <span>📖 {methodInfo.getters.length} getters</span>
                            <span>✏️ {methodInfo.setters.length} setters</span>
                            <span>🔍 {methodInfo.queries.length} queries</span>
                            <span>⚡ {methodInfo.updates.length} updates</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Reconnect Button */}
            {!isConnected && (
                <button
                    onClick={onReconnect}
                    style={{
                        background: 'linear-gradient(135deg, var(--accent-orange), #f59e0b)',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#ffffff',
                        padding: '0.5rem 1rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    🔄 Reconnect
                </button>
            )}
        </div>
    );
};

export default DatabaseConnectionPanel;