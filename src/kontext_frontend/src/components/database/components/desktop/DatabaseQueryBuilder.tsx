import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { DynamicCanisterService } from '../../shared/services/DynamicCanisterService';

interface CanisterMethodInfo {
    getters: Array<{ name: string; sectionName: string }>;
    setters: Array<{ name: string; sectionName: string }>;
    queries: Array<{ name: string; sectionName: string }>;
    updates: Array<{ name: string; sectionName: string }>;
}

interface DatabaseQueryBuilderProps {
    methodInfo: CanisterMethodInfo;
    canisterActor: any;
    candidContent?: string;
    isDidJs?: boolean;
}

interface QueryResult {
    method: string;
    timestamp: number;
    status: 'success' | 'error' | 'loading';
    result?: any;
    error?: string;
}

export const DatabaseQueryBuilder: React.FC<DatabaseQueryBuilderProps> = ({
    methodInfo,
    canisterActor,
    candidContent,
    isDidJs
}) => {
    const [selectedMethod, setSelectedMethod] = useState<string>('');
    const [queryHistory, setQueryHistory] = useState<QueryResult[]>([]);
    const [isExecuting, setIsExecuting] = useState(false);
    const [methodParameters, setMethodParameters] = useState<Record<string, any>>({});
    const [methodParameterRequirements, setMethodParameterRequirements] = useState<Map<string, { hasParameters: boolean; parameterCount: number }>>(new Map());
    const [methodParameterTypes, setMethodParameterTypes] = useState<Map<string, Array<{ name: string; type: string; candidType: string }>>>(new Map());

    // Get all available methods
    const allMethods = useMemo(() => {
        return [
            ...methodInfo.getters.map(m => ({ ...m, type: 'getter' })),
            ...methodInfo.queries.map(m => ({ ...m, type: 'query' })),
            ...methodInfo.setters.map(m => ({ ...m, type: 'setter' })),
            ...methodInfo.updates.map(m => ({ ...m, type: 'update' }))
        ];
    }, [methodInfo]);

    // Load method parameter requirements and types when candidContent is available
    useEffect(() => {
        if (candidContent) {
            const loadRequirements = async () => {
                try {
                    console.log(`🔍 [DatabaseQueryBuilder] Loading parameter requirements (isDidJs: ${isDidJs})`);
                    const requirements = await DynamicCanisterService.getMethodParameterRequirements(candidContent, isDidJs);
                    console.log(`📊 [DatabaseQueryBuilder] Loaded requirements for ${requirements.size} methods:`, Array.from(requirements.keys()));
                    setMethodParameterRequirements(requirements);

                    // If we have .did.js, extract parameter types using real IDL types
                    if (isDidJs && candidContent) {
                        try {
                            const { AgentContextualAwarenessService } = await import('../../../../services/AgentContextualAwarenessService');
                            const parsed = AgentContextualAwarenessService.parseDidJsFile(candidContent);
                            
                            const paramTypesMap = new Map<string, Array<{ name: string; type: string; candidType: string }>>();
                            parsed.methodDocs.forEach(doc => {
                                paramTypesMap.set(doc.name, doc.parameters);
                                console.log(`📝 [DatabaseQueryBuilder] Method "${doc.name}": ${doc.parameters.length} parameters`);
                            });
                            setMethodParameterTypes(paramTypesMap);
                            console.log(`✅ [DatabaseQueryBuilder] Loaded parameter types for ${paramTypesMap.size} methods`);
                        } catch (error) {
                            console.error('❌ [DatabaseQueryBuilder] Failed to parse parameter types:', error);
                        }
                    }
                } catch (error) {
                    console.error('❌ [DatabaseQueryBuilder] Failed to load method requirements:', error);
                }
            };
            
            loadRequirements();
        }
    }, [candidContent, isDidJs]);

    // Reset parameters when method changes
    useEffect(() => {
        setMethodParameters(prev => {
            const newParams = { ...prev };
            // Keep existing params but ensure selectedMethod has an entry
            if (selectedMethod && !newParams[selectedMethod]) {
                newParams[selectedMethod] = {};
            }
            return newParams;
        });
    }, [selectedMethod]);

    const executeQuery = useCallback(async () => {
        if (!selectedMethod || !canisterActor || isExecuting) return;

        const method = allMethods.find(m => m.name === selectedMethod);
        if (!method) return;

        // Check if method requires parameters
        const requirements = methodParameterRequirements.get(selectedMethod);
        if (requirements && requirements.hasParameters) {
            // Validate that we have the required parameters
            const paramTypes = methodParameterTypes.get(selectedMethod) || [];
            const providedParams = methodParameters[selectedMethod] || {};
            
            // Check if all required parameters are provided
            const missingParams = paramTypes.filter((p, index) => {
                const paramKey = `param${index}`;
                return !(paramKey in providedParams) || providedParams[paramKey] === undefined || providedParams[paramKey] === '';
            });
            
            if (missingParams.length > 0) {
                alert(`Missing required parameters: ${missingParams.map(p => p.name).join(', ')}`);
                return;
            }
        }

        setIsExecuting(true);

        const loadingResult: QueryResult = {
            method: selectedMethod,
            timestamp: Date.now(),
            status: 'loading'
        };
        setQueryHistory(prev => [loadingResult, ...prev]);

        try {
            console.log(`🔍 [DatabaseQueryBuilder] Executing ${method.type}: ${selectedMethod}`);

            let result;
            if (typeof canisterActor[selectedMethod] === 'function') {
                const requirements = methodParameterRequirements.get(selectedMethod);
                
                if (requirements && requirements.hasParameters) {
                    // Build parameter array from methodParameters
                    const paramTypes = methodParameterTypes.get(selectedMethod) || [];
                    const params: any[] = [];
                    
                    paramTypes.forEach((param, index) => {
                        const paramKey = `param${index}`;
                        let value = methodParameters[selectedMethod]?.[paramKey];
                        
                        // Convert value based on Candid type
                        if (value !== undefined && value !== null && value !== '') {
                            // Handle BigInt types
                            if (param.candidType.includes('nat') || param.candidType.includes('int')) {
                                if (typeof value === 'string') {
                                    value = BigInt(value);
                                } else if (typeof value === 'number') {
                                    value = BigInt(value);
                                }
                            }
                            // Handle arrays (vec)
                            else if (param.candidType.includes('vec')) {
                                if (typeof value === 'string') {
                                    try {
                                        value = JSON.parse(value);
                                    } catch {
                                        value = [value];
                                    }
                                }
                                if (!Array.isArray(value)) {
                                    value = [value];
                                }
                            }
                            // Handle optional types
                            else if (param.candidType.includes('opt')) {
                                // opt types can be null or the value
                                if (value === 'null' || value === null) {
                                    value = null;
                                }
                            }
                            
                            params.push(value);
                        } else {
                            params.push(undefined);
                        }
                    });
                    
                    console.log(`📤 [DatabaseQueryBuilder] Calling ${selectedMethod} with parameters:`, params);
                    result = await canisterActor[selectedMethod](...params);
                } else {
                    // No parameters required
                result = await canisterActor[selectedMethod]();
                }
            } else {
                throw new Error(`Method ${selectedMethod} not found on canister`);
            }

            console.log(`✅ [DatabaseQueryBuilder] ${selectedMethod} result:`, result);

            setQueryHistory(prev => prev.map(item => 
                item === loadingResult
                    ? { ...item, status: 'success', result }
                    : item
            ));

        } catch (error) {
            console.error(`❌ [DatabaseQueryBuilder] ${selectedMethod} failed:`, error);

            setQueryHistory(prev => prev.map(item => 
                item === loadingResult
                    ? { 
                        ...item, 
                        status: 'error', 
                        error: error instanceof Error ? error.message : 'Unknown error' 
                    }
                    : item
            ));
        } finally {
            setIsExecuting(false);
        }
    }, [selectedMethod, canisterActor, isExecuting, allMethods, methodParameters, methodParameterRequirements, methodParameterTypes]);

    const clearHistory = useCallback(() => {
        setQueryHistory([]);
    }, []);

    const formatResult = useCallback((result: any) => {
        try {
            if (result === null || result === undefined) {
                return 'null';
            }

            if (typeof result === 'bigint') {
                return result.toString();
            }

            if (typeof result === 'object') {
                return JSON.stringify(result, (key, value) => {
                    if (typeof value === 'bigint') {
                        return value.toString();
                    }
                    return value;
                }, 2);
            }

            return String(result);
        } catch (error) {
            return 'Error formatting result';
        }
    }, []);

    const getMethodTypeColor = useCallback((type: string) => {
        switch (type) {
            case 'getter':
            case 'query':
                return 'var(--accent-green)';
            case 'setter':
            case 'update':
                return 'var(--accent-orange)';
            default:
                return 'var(--text-gray)';
        }
    }, []);

    const getMethodTypeIcon = useCallback((type: string) => {
        switch (type) {
            case 'getter':
                return '📖';
            case 'query':
                return '🔍';
            case 'setter':
                return '✏️';
            case 'update':
                return '⚡';
            default:
                return '🔧';
        }
    }, []);

    // DESKTOP VERSION - Fixed vertical scrolling
    return (
        <div style={{
            display: 'flex',
            minHeight: '100%',
            width: '100%',
            background: 'var(--bg-dark)'
        }}>
            {/* Left Sidebar - Query Builder Controls */}
            <div style={{
                width: '320px',
                borderRight: '1px solid var(--border-color)',
                background: 'rgba(255, 255, 255, 0.02)',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                marginLeft: '25px',
                overflowY: 'auto'
            }}>
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid var(--border-color)'
                }}>
                    <h3 style={{
                        fontSize: '1.2rem',
                        fontWeight: 700,
                        color: '#ffffff',
                        margin: 0,
                        marginBottom: '0.5rem'
                    }}>
                        🔍 Query Builder
                    </h3>
                    <p style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-gray)',
                        margin: 0
                    }}>
                        Execute canister methods directly
                    </p>
                </div>

                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid var(--border-color)'
                }}>
                    <label style={{
                        display: 'block',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: '#ffffff',
                        marginBottom: '0.75rem'
                    }}>
                        Select Method
                    </label>
                    
                    <select
                        value={selectedMethod}
                        onChange={(e) => setSelectedMethod(e.target.value)}
                        style={{
                            width: '100%',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            padding: '0.75rem',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            outline: 'none'
                        }}
                    >
                        <option value="">Choose a method...</option>
                        {allMethods.map(method => (
                            <option key={method.name} value={method.name} style={{ background: '#1a1a2e' }}>
                                {getMethodTypeIcon(method.type)} {method.name} ({method.type})
                            </option>
                        ))}
                    </select>
                </div>

                {selectedMethod && (
                    <div style={{
                        padding: '1.5rem',
                        borderBottom: '1px solid var(--border-color)'
                    }}>
                        {(() => {
                            const method = allMethods.find(m => m.name === selectedMethod);
                            if (!method) return null;

                            return (
                                <div style={{
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    padding: '1rem'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        marginBottom: '0.5rem',
                                        flexWrap: 'wrap'
                                    }}>
                                        <span style={{ fontSize: '1.2rem' }}>
                                            {getMethodTypeIcon(method.type)}
                                        </span>
                                        <span style={{
                                            fontSize: '1rem',
                                            fontWeight: 600,
                                            color: '#ffffff'
                                        }}>
                                            {method.name}
                                        </span>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            background: getMethodTypeColor(method.type),
                                            color: '#ffffff',
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '12px',
                                            fontWeight: 600,
                                            textTransform: 'uppercase'
                                        }}>
                                            {method.type}
                                        </span>
                                    </div>
                                    <div style={{
                                        fontSize: '0.8rem',
                                        color: 'var(--text-gray)',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Section: {method.sectionName}
                                    </div>

                                    {/* Parameter Input Fields */}
                                    {(() => {
                                        const requirements = methodParameterRequirements.get(selectedMethod);
                                        const paramTypes = methodParameterTypes.get(selectedMethod) || [];
                                        const hasParameters = requirements?.hasParameters || false;
                                        const currentParams = methodParameters[selectedMethod] || {};

                                        if (!hasParameters) {
                                            return (
                                                <div style={{
                                                    fontSize: '0.75rem',
                                                    color: 'var(--text-gray)',
                                                    marginTop: '0.5rem',
                                                    fontStyle: 'italic'
                                                }}>
                                                    No parameters required
                                                </div>
                                            );
                                        }

                                        return (
                                            <div style={{
                                                marginTop: '1rem',
                                                paddingTop: '1rem',
                                                borderTop: '1px solid var(--border-color)'
                                            }}>
                                                <div style={{
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600,
                                                    color: '#ffffff',
                                                    marginBottom: '0.75rem'
                                                }}>
                                                    Parameters ({paramTypes.length} required):
                                                </div>
                                                {paramTypes.map((param, index) => {
                                                    const paramKey = `param${index}`;
                                                    const value = currentParams[paramKey] || '';
                                                    
                                                    return (
                                                        <div key={index} style={{ marginBottom: '1rem' }}>
                                                            <label style={{
                                                                display: 'block',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 500,
                                                                color: '#ffffff',
                                                                marginBottom: '0.5rem'
                                                            }}>
                                                                {param.name} <span style={{ color: 'var(--text-gray)', fontSize: '0.75rem' }}>({param.candidType})</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                                onChange={(e) => {
                                                                    const newValue = e.target.value;
                                                                    setMethodParameters(prev => ({
                                                                        ...prev,
                                                                        [selectedMethod]: {
                                                                            ...prev[selectedMethod],
                                                                            [paramKey]: newValue
                                                                        }
                                                                    }));
                                                                }}
                                                                placeholder={`Enter ${param.candidType} value${param.candidType.includes('vec') ? ' (JSON array)' : param.candidType.includes('nat') || param.candidType.includes('int') ? ' (number)' : ''}`}
                                                                style={{
                                                                    width: '100%',
                                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                                    border: '1px solid var(--border-color)',
                                                                    borderRadius: '6px',
                                                                    color: '#ffffff',
                                                                    padding: '0.6rem',
                                                                    fontSize: '0.85rem',
                                                                    outline: 'none'
                                                                }}
                                                            />
                                                            <div style={{
                                                                fontSize: '0.7rem',
                                                                color: 'var(--text-gray)',
                                                                marginTop: '0.25rem'
                                                            }}>
                                                                Type: {param.type} | Candid: {param.candidType}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        })()}
                    </div>
                )}

                <div style={{ padding: '1.5rem' }}>
                    <button
                        onClick={executeQuery}
                        disabled={!selectedMethod || isExecuting}
                        style={{
                            width: '100%',
                            background: (!selectedMethod || isExecuting)
                                ? 'rgba(16, 185, 129, 0.4)'
                                : 'linear-gradient(135deg, var(--accent-green), #059669)',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#ffffff',
                            padding: '1rem',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            cursor: (!selectedMethod || isExecuting) ? 'not-allowed' : 'pointer',
                            opacity: (!selectedMethod || isExecuting) ? 0.7 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(!selectedMethod || isExecuting) ? undefined : (e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.3)';
                        }}
                        onMouseLeave={(!selectedMethod || isExecuting) ? undefined : (e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        {isExecuting ? (
                            <>
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    border: '2px solid rgba(255, 255, 255, 0.3)',
                                    borderTop: '2px solid #ffffff',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }} />
                                Executing...
                            </>
                        ) : (
                            <>
                                🚀 Execute Query
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Main Content Area - FIXED SCROLLING */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                maxWidth: '100%',
                overflowY: 'auto' // This enables proper vertical scrolling
            }}>
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <h3 style={{
                            fontSize: '1.2rem',
                            fontWeight: 700,
                            color: '#ffffff',
                            margin: 0,
                            marginBottom: '0.25rem'
                        }}>
                            📊 Query Results
                        </h3>
                        <p style={{
                            fontSize: '0.85rem',
                            color: 'var(--text-gray)',
                            margin: 0
                        }}>
                            {queryHistory.length} queries executed
                        </p>
                    </div>

                    {queryHistory.length > 0 && (
                        <button
                            onClick={clearHistory}
                            style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '6px',
                                color: '#ef4444',
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                            }}
                        >
                            🗑️ Clear History
                        </button>
                    )}
                </div>

                <div style={{
                    flex: 1,
                    padding: '1rem',
                    width: '100%'
                }}>
                    {queryHistory.length === 0 ? (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            flexDirection: 'column',
                            gap: '1rem',
                            color: 'var(--text-gray)',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '3rem', opacity: 0.3 }}>🔍</div>
                            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>No Queries Yet</h3>
                            <p style={{ margin: 0, fontSize: '1rem' }}>
                                Select a method and click "Execute Query" to see results here
                            </p>
                        </div>
                    ) : (
                        <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '1rem',
                            width: '100%'
                        }}>
                            {queryHistory.map((query) => (
                                <div
                                    key={`${query.method}-${query.timestamp}`}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: `1px solid ${
                                            query.status === 'success' ? 'rgba(16, 185, 129, 0.3)' :
                                            query.status === 'error' ? 'rgba(239, 68, 68, 0.3)' :
                                            'var(--border-color)'
                                        }`,
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                        width: '100%'
                                    }}
                                >
                                    <div style={{
                                        padding: '1rem',
                                        borderBottom: '1px solid var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem'
                                        }}>
                                            <span style={{ fontSize: '1.2rem' }}>
                                                {query.status === 'loading' ? '⏳' :
                                                 query.status === 'success' ? '✅' : '❌'}
                                            </span>
                                            <span style={{
                                                fontSize: '1rem',
                                                fontWeight: 600,
                                                color: '#ffffff'
                                            }}>
                                                {query.method}
                                            </span>
                                        </div>
                                        <div style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--text-gray)'
                                        }}>
                                            {new Date(query.timestamp).toLocaleTimeString()}
                                        </div>
                                    </div>

                                    <div style={{ padding: '1rem' }}>
                                        {query.status === 'loading' ? (
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                color: 'var(--text-gray)'
                                            }}>
                                                <div style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    border: '2px solid rgba(255, 255, 255, 0.3)',
                                                    borderTop: '2px solid var(--text-gray)',
                                                    borderRadius: '50%',
                                                    animation: 'spin 1s linear infinite'
                                                }} />
                                                Executing query...
                                            </div>
                                        ) : query.status === 'error' ? (
                                            <div style={{
                                                color: '#ef4444',
                                                fontSize: '0.9rem',
                                                fontFamily: 'monospace',
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                padding: '0.75rem',
                                                borderRadius: '6px',
                                                wordBreak: 'break-word'
                                            }}>
                                                {query.error}
                                            </div>
                                        ) : (
                                            <pre style={{
                                                color: '#ffffff',
                                                fontSize: '0.85rem',
                                                fontFamily: 'monospace',
                                                background: 'rgba(0, 0, 0, 0.3)',
                                                padding: '1rem',
                                                borderRadius: '6px',
                                                margin: 0,
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                                maxHeight: '300px',
                                                overflow: 'auto',
                                                lineHeight: 1.4
                                            }}>
                                                {formatResult(query.result)}
                                            </pre>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default DatabaseQueryBuilder;