import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { DynamicCanisterService } from '../../shared/services/DynamicCanisterService';

interface CanisterMethodInfo {
    getters: Array<{ name: string; sectionName: string }>;
    setters: Array<{ name: string; sectionName: string }>;
    queries: Array<{ name: string; sectionName: string }>;
    updates: Array<{ name: string; sectionName: string }>;
}

interface MobileQueryInterfaceProps {
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

export const MobileQueryInterface: React.FC<MobileQueryInterfaceProps> = ({
    methodInfo,
    canisterActor,
    candidContent,
    isDidJs
}) => {
    const [selectedMethod, setSelectedMethod] = useState<string>('');
    const [queryHistory, setQueryHistory] = useState<QueryResult[]>([]);
    const [isExecuting, setIsExecuting] = useState(false);
    const [showMethodSelector, setShowMethodSelector] = useState(false);
    const [mobileTab, setMobileTab] = useState<'builder' | 'results'>('builder');
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
                    const requirements = await DynamicCanisterService.getMethodParameterRequirements(candidContent, isDidJs);
                    setMethodParameterRequirements(requirements);

                    // If we have .did.js, extract parameter types using real IDL types
                    if (isDidJs && candidContent) {
                        try {
                            const { AgentContextualAwarenessService } = await import('../../../../services/AgentContextualAwarenessService');
                            const parsed = AgentContextualAwarenessService.parseDidJsFile(candidContent);
                            
                            const paramTypesMap = new Map<string, Array<{ name: string; type: string; candidType: string }>>();
                            parsed.methodDocs.forEach(doc => {
                                paramTypesMap.set(doc.name, doc.parameters);
                            });
                            setMethodParameterTypes(paramTypesMap);
                            console.log(`✅ [MobileQueryInterface] Loaded parameter types for ${paramTypesMap.size} methods`);
                        } catch (error) {
                            console.error('❌ [MobileQueryInterface] Failed to parse parameter types:', error);
                        }
                    }
                } catch (error) {
                    console.error('❌ [MobileQueryInterface] Failed to load method requirements:', error);
                }
            };
            
            loadRequirements();
        }
    }, [candidContent, isDidJs]);

    // Reset parameters when method changes
    useEffect(() => {
        setMethodParameters(prev => {
            const newParams = { ...prev };
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

        // Auto-switch to results tab after executing
        setMobileTab('results');

        try {
            console.log(`🔍 [MobileQueryInterface] Executing ${method.type}: ${selectedMethod}`);

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
                                if (value === 'null' || value === null) {
                                    value = null;
                                }
                            }
                            
                            params.push(value);
                        } else {
                            params.push(undefined);
                        }
                    });
                    
                    console.log(`📤 [MobileQueryInterface] Calling ${selectedMethod} with parameters:`, params);
                    result = await canisterActor[selectedMethod](...params);
                } else {
                    // No parameters required
                result = await canisterActor[selectedMethod]();
                }
            } else {
                throw new Error(`Method ${selectedMethod} not found on canister`);
            }

            console.log(`✅ [MobileQueryInterface] ${selectedMethod} result:`, result);

            setQueryHistory(prev => prev.map(item => 
                item === loadingResult
                    ? { ...item, status: 'success', result }
                    : item
            ));

        } catch (error) {
            console.error(`❌ [MobileQueryInterface] ${selectedMethod} failed:`, error);

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

    // Mobile tabs
    const renderMobileTabs = () => (
        <div style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '1rem',
            background: 'rgba(0, 0, 0, 0.2)'
        }}>
            <button
                onClick={() => setMobileTab('builder')}
                style={{
                    flex: 1,
                    background: mobileTab === 'builder'
                        ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.3), rgba(16, 185, 129, 0.2))'
                        : 'rgba(255, 255, 255, 0.05)',
                    border: mobileTab === 'builder'
                        ? '2px solid rgba(255, 107, 53, 0.5)'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: mobileTab === 'builder' ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                    padding: '1rem',
                    fontSize: '1rem',
                    fontWeight: mobileTab === 'builder' ? 600 : 500,
                    cursor: 'pointer',
                    minHeight: '56px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    transition: 'all 0.2s ease'
                }}
                onTouchStart={(e) => {
                    e.currentTarget.style.transform = 'scale(0.98)';
                }}
                onTouchEnd={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                }}
            >
                🔧 Builder
            </button>
            <button
                onClick={() => setMobileTab('results')}
                style={{
                    flex: 1,
                    background: mobileTab === 'results'
                        ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.3), rgba(16, 185, 129, 0.2))'
                        : 'rgba(255, 255, 255, 0.05)',
                    border: mobileTab === 'results'
                        ? '2px solid rgba(255, 107, 53, 0.5)'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: mobileTab === 'results' ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                    padding: '1rem',
                    fontSize: '1rem',
                    fontWeight: mobileTab === 'results' ? 600 : 500,
                    cursor: 'pointer',
                    minHeight: '56px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    position: 'relative',
                    transition: 'all 0.2s ease'
                }}
                onTouchStart={(e) => {
                    e.currentTarget.style.transform = 'scale(0.98)';
                }}
                onTouchEnd={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                }}
            >
                📊 Results
                {queryHistory.length > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '0.75rem',
                        right: '0.75rem',
                        background: 'var(--accent-orange)',
                        color: '#ffffff',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.25rem 0.5rem',
                        borderRadius: '10px',
                        minWidth: '24px',
                        textAlign: 'center'
                    }}>
                        {queryHistory.length}
                    </span>
                )}
            </button>
        </div>
    );

    return (
        <div>
            {/* Mobile Method Selector Modal */}
            {showMethodSelector && (
                <>
                    <div
                        onClick={() => setShowMethodSelector(false)}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.7)',
                            zIndex: 1000,
                            backdropFilter: 'blur(4px)'
                        }}
                    />
                    <div style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '90%',
                        maxWidth: '420px',
                        maxHeight: '70vh',
                        background: '#1a1a2e',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '20px',
                        zIndex: 1001,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 25px 80px rgba(0, 0, 0, 0.6)'
                    }}>
                        <div style={{
                            padding: '1.5rem',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <h3 style={{
                                fontSize: '1.2rem',
                                fontWeight: 600,
                                color: '#ffffff',
                                margin: 0
                            }}>
                                🔍 Select Method
                            </h3>
                            <button
                                onClick={() => setShowMethodSelector(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: 'none',
                                    borderRadius: '10px',
                                    color: '#ffffff',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    width: '44px',
                                    height: '44px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s ease'
                                }}
                                onTouchStart={(e) => {
                                    e.currentTarget.style.transform = 'scale(0.9)';
                                }}
                                onTouchEnd={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                }}
                            >
                                ×
                            </button>
                        </div>
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '1rem',
                            WebkitOverflowScrolling: 'touch'
                        }}>
                            {allMethods.map(method => (
                                <button
                                    key={method.name}
                                    onClick={() => {
                                        setSelectedMethod(method.name);
                                        setShowMethodSelector(false);
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '1.25rem',
                                        background: selectedMethod === method.name
                                            ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(16, 185, 129, 0.1))'
                                            : 'rgba(255, 255, 255, 0.03)',
                                        border: selectedMethod === method.name
                                            ? '2px solid rgba(255, 107, 53, 0.4)'
                                            : '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '16px',
                                        color: selectedMethod === method.name ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        textAlign: 'left',
                                        fontSize: '1rem',
                                        marginBottom: '1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        minHeight: '72px'
                                    }}
                                    onTouchStart={(e) => {
                                        e.currentTarget.style.transform = 'scale(0.98)';
                                    }}
                                    onTouchEnd={(e) => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                    }}
                                >
                                    <span style={{ 
                                        fontSize: '1.8rem',
                                        flexShrink: 0
                                    }}>
                                        {getMethodTypeIcon(method.type)}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ 
                                            fontWeight: 600, 
                                            marginBottom: '0.5rem',
                                            fontSize: '1rem'
                                        }}>
                                            {method.name}
                                        </div>
                                        <div style={{ 
                                            fontSize: '0.85rem', 
                                            opacity: 0.8,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem'
                                        }}>
                                            <span style={{
                                                background: getMethodTypeColor(method.type),
                                                color: '#ffffff',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '6px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                textTransform: 'uppercase'
                                            }}>
                                                {method.type}
                                            </span>
                                            <span>{method.sectionName}</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Mobile Tabs */}
            {renderMobileTabs()}

            {/* BUILDER TAB */}
            {mobileTab === 'builder' && (
                <div style={{
                    padding: '1.5rem'
                }}>
                    {/* Method Selection */}
                    <div style={{
                        marginBottom: '2rem'
                    }}>
                        <label style={{
                            display: 'block',
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: '#ffffff',
                            marginBottom: '1rem'
                        }}>
                            🔍 Select Method
                        </label>
                        
                        <button
                            onClick={() => setShowMethodSelector(true)}
                            style={{
                                width: '100%',
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '16px',
                                color: '#ffffff',
                                padding: '1.25rem',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                minHeight: '72px',
                                transition: 'all 0.2s ease'
                            }}
                            onTouchStart={(e) => {
                                e.currentTarget.style.transform = 'scale(0.98)';
                            }}
                            onTouchEnd={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            <span>
                                {selectedMethod ? (
                                    <>
                                        {(() => {
                                            const method = allMethods.find(m => m.name === selectedMethod);
                                            return method ? `${getMethodTypeIcon(method.type)} ${method.name}` : selectedMethod;
                                        })()}
                                    </>
                                ) : 'Choose a method...'}
                            </span>
                            <span style={{ fontSize: '1.5rem', opacity: 0.5 }}>▼</span>
                        </button>
                    </div>

                    {/* Method Details and Parameters */}
                    {selectedMethod && (
                        <div style={{
                            marginBottom: '2rem'
                        }}>
                            {(() => {
                                const method = allMethods.find(m => m.name === selectedMethod);
                                if (!method) return null;

                                const requirements = methodParameterRequirements.get(selectedMethod);
                                const paramTypes = methodParameterTypes.get(selectedMethod) || [];
                                const hasParameters = requirements?.hasParameters || false;
                                const currentParams = methodParameters[selectedMethod] || {};

                                return (
                                    <div style={{
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '16px',
                                        padding: '1.5rem'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '1rem',
                                            marginBottom: '1rem',
                                            flexWrap: 'wrap'
                                        }}>
                                            <span style={{ fontSize: '2rem' }}>
                                                {getMethodTypeIcon(method.type)}
                                            </span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{
                                                    fontSize: '1.2rem',
                                                    fontWeight: 600,
                                                    color: '#ffffff',
                                                    display: 'block',
                                                    marginBottom: '0.5rem'
                                                }}>
                                                    {method.name}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.85rem',
                                                    background: getMethodTypeColor(method.type),
                                                    color: '#ffffff',
                                                    padding: '0.25rem 0.75rem',
                                                    borderRadius: '12px',
                                                    fontWeight: 600,
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {method.type}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{
                                            fontSize: '0.9rem',
                                            color: 'rgba(255, 255, 255, 0.6)',
                                            marginBottom: hasParameters ? '1rem' : 0
                                        }}>
                                            <strong>Section:</strong> {method.sectionName}
                                        </div>

                                        {/* Parameter Input Fields */}
                                        {hasParameters && paramTypes.length > 0 && (
                                            <div style={{
                                                marginTop: '1.5rem',
                                                paddingTop: '1.5rem',
                                                borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                                            }}>
                                                <div style={{
                                                    fontSize: '1rem',
                                                    fontWeight: 600,
                                                    color: '#ffffff',
                                                    marginBottom: '1rem'
                                                }}>
                                                    Parameters ({paramTypes.length} required):
                                                </div>
                                                {paramTypes.map((param, index) => {
                                                    const paramKey = `param${index}`;
                                                    const value = currentParams[paramKey] || '';
                                                    
                                                    return (
                                                        <div key={index} style={{ marginBottom: '1.5rem' }}>
                                                            <label style={{
                                                                display: 'block',
                                                                fontSize: '0.9rem',
                                                                fontWeight: 500,
                                                                color: '#ffffff',
                                                                marginBottom: '0.75rem'
                                                            }}>
                                                                {param.name} <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.8rem' }}>({param.candidType})</span>
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
                                                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                                                    borderRadius: '12px',
                                                                    color: '#ffffff',
                                                                    padding: '1rem',
                                                                    fontSize: '1rem',
                                                                    outline: 'none'
                                                                }}
                                                            />
                                                            <div style={{
                                                                fontSize: '0.75rem',
                                                                color: 'rgba(255, 255, 255, 0.5)',
                                                                marginTop: '0.5rem'
                                                            }}>
                                                                Type: {param.type} | Candid: {param.candidType}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {!hasParameters && (
                                            <div style={{
                                                fontSize: '0.85rem',
                                                color: 'rgba(255, 255, 255, 0.5)',
                                                marginTop: '1rem',
                                                fontStyle: 'italic'
                                            }}>
                                                No parameters required
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Execute Button */}
                    <button
                        onClick={executeQuery}
                        disabled={!selectedMethod || isExecuting}
                        style={{
                            width: '100%',
                            background: (!selectedMethod || isExecuting)
                                ? 'rgba(16, 185, 129, 0.4)'
                                : 'linear-gradient(135deg, #10B981, #059669)',
                            border: 'none',
                            borderRadius: '16px',
                            color: '#ffffff',
                            padding: '1.25rem',
                            fontSize: '1.1rem',
                            fontWeight: 600,
                            cursor: (!selectedMethod || isExecuting) ? 'not-allowed' : 'pointer',
                            opacity: (!selectedMethod || isExecuting) ? 0.7 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '1rem',
                            minHeight: '72px',
                            boxShadow: (!selectedMethod || isExecuting) ? 'none' : '0 8px 30px rgba(16, 185, 129, 0.4)',
                            transition: 'all 0.2s ease'
                        }}
                        onTouchStart={(!selectedMethod || isExecuting) ? undefined : (e) => {
                            e.currentTarget.style.transform = 'scale(0.98)';
                        }}
                        onTouchEnd={(!selectedMethod || isExecuting) ? undefined : (e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        {isExecuting ? (
                            <>
                                <div style={{
                                    width: '24px',
                                    height: '24px',
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
            )}

            {/* RESULTS TAB */}
            {mobileTab === 'results' && (
                <div style={{
                    padding: '1.5rem'
                }}>
                    {/* Results Header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '2rem'
                    }}>
                        <div>
                            <h3 style={{
                                fontSize: '1.3rem',
                                fontWeight: 700,
                                color: '#ffffff',
                                margin: 0,
                                marginBottom: '0.5rem'
                            }}>
                                📊 Query Results
                            </h3>
                            <p style={{
                                fontSize: '0.9rem',
                                color: 'rgba(255, 255, 255, 0.6)',
                                margin: 0
                            }}>
                                {queryHistory.length} queries executed
                            </p>
                        </div>

                        {queryHistory.length > 0 && (
                            <button
                                onClick={clearHistory}
                                style={{
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: '10px',
                                    color: '#ef4444',
                                    padding: '0.875rem 1rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    minHeight: '48px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.2s ease'
                                }}
                                onTouchStart={(e) => {
                                    e.currentTarget.style.transform = 'scale(0.95)';
                                }}
                                onTouchEnd={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                }}
                            >
                                🗑️ Clear
                            </button>
                        )}
                    </div>

                    {/* Results List */}
                    <div>
                        {queryHistory.length === 0 ? (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: '40vh',
                                flexDirection: 'column',
                                gap: '1.5rem',
                                color: 'rgba(255, 255, 255, 0.4)',
                                textAlign: 'center',
                                padding: '3rem 1rem'
                            }}>
                                <div style={{ fontSize: '4rem', opacity: 0.5 }}>🔍</div>
                                <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#ffffff' }}>No Results Yet</h3>
                                <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6 }}>
                                    Execute a query to see results here
                                </p>
                            </div>
                        ) : (
                            <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '1.5rem'
                            }}>
                                {queryHistory.map((query, index) => (
                                    <div
                                        key={`${query.method}-${query.timestamp}`}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: `1px solid ${
                                                query.status === 'success' ? 'rgba(16, 185, 129, 0.3)' :
                                                query.status === 'error' ? 'rgba(239, 68, 68, 0.3)' :
                                                'rgba(255, 255, 255, 0.1)'
                                            }`,
                                            borderRadius: '16px',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {/* Query Header */}
                                        <div style={{
                                            padding: '1.5rem',
                                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '1rem'
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '1rem',
                                                flex: 1,
                                                minWidth: 0
                                            }}>
                                                <span style={{ fontSize: '1.8rem', flexShrink: 0 }}>
                                                    {query.status === 'loading' ? '⏳' :
                                                     query.status === 'success' ? '✅' : '❌'}
                                                </span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <span style={{
                                                        fontSize: '1.1rem',
                                                        fontWeight: 600,
                                                        color: '#ffffff',
                                                        display: 'block',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        marginBottom: '0.25rem'
                                                    }}>
                                                        {query.method}
                                                    </span>
                                                    <div style={{
                                                        fontSize: '0.85rem',
                                                        color: 'rgba(255, 255, 255, 0.6)'
                                                    }}>
                                                        {new Date(query.timestamp).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Query Result */}
                                        <div style={{ padding: '1.5rem' }}>
                                            {query.status === 'loading' ? (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '1rem',
                                                    color: 'rgba(255, 255, 255, 0.6)'
                                                }}>
                                                    <div style={{
                                                        width: '20px',
                                                        height: '20px',
                                                        border: '2px solid rgba(255, 255, 255, 0.3)',
                                                        borderTop: '2px solid rgba(255, 255, 255, 0.8)',
                                                        borderRadius: '50%',
                                                        animation: 'spin 1s linear infinite'
                                                    }} />
                                                    Executing query...
                                                </div>
                                            ) : query.status === 'error' ? (
                                                <div style={{
                                                    color: '#ef4444',
                                                    fontSize: '0.95rem',
                                                    fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    padding: '1rem',
                                                    borderRadius: '10px',
                                                    wordBreak: 'break-word',
                                                    lineHeight: 1.5
                                                }}>
                                                    {query.error}
                                                </div>
                                            ) : (
                                                <pre style={{
                                                    color: '#ffffff',
                                                    fontSize: '0.85rem',
                                                    fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
                                                    background: 'rgba(0, 0, 0, 0.3)',
                                                    padding: '1.25rem',
                                                    borderRadius: '10px',
                                                    margin: 0,
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                    maxHeight: '400px',
                                                    overflow: 'auto',
                                                    lineHeight: 1.5,
                                                    WebkitOverflowScrolling: 'touch'
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
            )}

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default MobileQueryInterface;