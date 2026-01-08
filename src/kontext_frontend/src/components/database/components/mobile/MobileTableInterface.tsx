import React, { useState, useMemo } from 'react';

interface DatabaseSchema {
    sections: Array<{
        id: string;
        title: string;
        fields: Record<string, any>;
        type: 'object' | 'array' | 'primitive';
        editable?: boolean;
    }>;
}

interface MobileTableInterfaceProps {
    schema: DatabaseSchema;
    data: Record<string, any>;
    onChange: (data: Record<string, any>) => void;
}

export const MobileTableInterface: React.FC<MobileTableInterfaceProps> = ({
    schema,
    data,
    onChange
}) => {
    const [selectedSection, setSelectedSection] = useState<string | null>(null);
    const [showSectionSelector, setShowSectionSelector] = useState(false);
    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

    // Get current section data
    const currentSection = useMemo(() => {
        return schema.sections.find(section => section.id === selectedSection);
    }, [schema.sections, selectedSection]);

    const currentSectionData = useMemo(() => {
        if (!selectedSection) return null;
        const sectionData = data[selectedSection];
        
        // Convert single objects to arrays for table display
        // This allows table view to display object-type sections
        if (sectionData !== null && sectionData !== undefined && !Array.isArray(sectionData)) {
            if (typeof sectionData === 'object') {
                // Wrap single object in array for table display
                return [sectionData];
            } else {
                // Wrap primitive in array with a 'value' field
                return [{ value: sectionData }];
            }
        }
        
        return sectionData;
    }, [data, selectedSection]);

    // Auto-select first section
    React.useEffect(() => {
        if (!selectedSection && schema.sections.length > 0) {
            setSelectedSection(schema.sections[0].id);
        }
    }, [selectedSection, schema.sections]);

    const toggleCard = (cardId: string) => {
        setExpandedCards(prev => ({
            ...prev,
            [cardId]: !prev[cardId]
        }));
    };

    const handleCellChange = (rowIndex: number, fieldKey: string, value: any) => {
        if (!selectedSection) return;

        const updatedData = { ...data };
        const sectionData = Array.isArray(updatedData[selectedSection]) 
            ? [...updatedData[selectedSection]] 
            : [];
        
        if (sectionData[rowIndex]) {
            sectionData[rowIndex] = {
                ...sectionData[rowIndex],
                [fieldKey]: value
            };
        }

        updatedData[selectedSection] = sectionData;
        onChange(updatedData);
    };

    const handleAddRow = () => {
        if (!selectedSection || !currentSection) return;

        const updatedData = { ...data };
        let sectionData = updatedData[selectedSection];
        
        // Convert to array if it's a single object
        if (!Array.isArray(sectionData)) {
            sectionData = sectionData !== null && sectionData !== undefined ? [sectionData] : [];
        } else {
            sectionData = [...sectionData];
        }

        // Create new row with default values based on field schema
        const newRow: Record<string, any> = {};
        Object.keys(currentSection.fields).forEach(fieldKey => {
            const fieldSchema = currentSection.fields[fieldKey];
            switch (fieldSchema.type) {
                case 'string':
                    newRow[fieldKey] = fieldSchema.default || '';
                    break;
                case 'number':
                case 'integer':
                    newRow[fieldKey] = fieldSchema.default || 0;
                    break;
                case 'boolean':
                    newRow[fieldKey] = fieldSchema.default || false;
                    break;
                default:
                    newRow[fieldKey] = fieldSchema.default || null;
            }
        });

        sectionData.push(newRow);
        updatedData[selectedSection] = sectionData;
        onChange(updatedData);

        // Scroll to new item
        setTimeout(() => {
            window.scrollTo({ 
                top: document.documentElement.scrollHeight, 
                behavior: 'smooth' 
            });
        }, 100);
    };

    const handleDeleteRow = (rowIndex: number) => {
        if (!selectedSection) return;

        const updatedData = { ...data };
        let sectionData = updatedData[selectedSection];
        
        // Convert to array if it's a single object
        if (!Array.isArray(sectionData)) {
            sectionData = sectionData !== null && sectionData !== undefined ? [sectionData] : [];
        } else {
            sectionData = [...sectionData];
        }
        
        sectionData.splice(rowIndex, 1);
        
        // If original was a single object and now empty, set to null
        const originalData = data[selectedSection];
        if (!Array.isArray(originalData) && sectionData.length === 0) {
            updatedData[selectedSection] = null;
        } else {
        updatedData[selectedSection] = sectionData;
        }
        
        onChange(updatedData);
    };

    const renderCell = (value: any, fieldSchema: any, rowIndex: number, fieldKey: string) => {
        const commonInputStyle = {
            width: '100%',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: '#ffffff',
            padding: '0.875rem',
            fontSize: '1rem',
            minHeight: '48px',
            outline: 'none',
            transition: 'all 0.2s ease'
        };

        switch (fieldSchema.type) {
            case 'string':
                if (fieldSchema.format === 'textarea') {
                    return (
                        <textarea
                            value={value || ''}
                            onChange={(e) => handleCellChange(rowIndex, fieldKey, e.target.value)}
                            style={{
                                ...commonInputStyle,
                                minHeight: '100px',
                                resize: 'vertical',
                                fontFamily: 'inherit',
                                lineHeight: 1.4
                            }}
                        />
                    );
                } else {
                    return (
                        <input
                            type="text"
                            value={value || ''}
                            onChange={(e) => handleCellChange(rowIndex, fieldKey, e.target.value)}
                            style={commonInputStyle}
                        />
                    );
                }

            case 'number':
            case 'integer':
                return (
                    <input
                        type="number"
                        inputMode="numeric"
                        value={value || 0}
                        onChange={(e) => handleCellChange(rowIndex, fieldKey, parseFloat(e.target.value) || 0)}
                        style={commonInputStyle}
                    />
                );

            case 'boolean':
                return (
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        minHeight: '48px',
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        transition: 'all 0.2s ease'
                    }}>
                        <input
                            type="checkbox"
                            checked={value || false}
                            onChange={(e) => handleCellChange(rowIndex, fieldKey, e.target.checked)}
                            style={{
                                accentColor: 'var(--accent-orange)',
                                transform: 'scale(1.5)',
                                marginRight: '0.75rem'
                            }}
                        />
                        <span style={{ fontSize: '0.9rem', color: '#ffffff', fontWeight: 500 }}>
                            {value ? 'Yes' : 'No'}
                        </span>
                    </label>
                );

            default:
                return (
                    <div style={{
                        padding: '0.875rem',
                        color: 'var(--text-gray)',
                        fontSize: '0.9rem',
                        textAlign: 'center',
                        minHeight: '48px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
                    }}>
                        {value ? JSON.stringify(value) : '-'}
                    </div>
                );
        }
    };

    const renderMobileCards = () => {
        if (!currentSection || !Array.isArray(currentSectionData) || currentSectionData.length === 0) {
            return null;
        }

        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem'
            }}>
                {currentSectionData.map((row: any, rowIndex: number) => {
                    const cardId = `${selectedSection}-${rowIndex}`;
                    const isExpanded = expandedCards[cardId] !== false; // Default to expanded
                    
                    return (
                        <div key={rowIndex} style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            transition: 'all 0.2s ease'
                        }}>
                            {/* Card Header - Clickable */}
                            <div
                                onClick={() => toggleCard(cardId)}
                                style={{
                                    padding: '1.5rem',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    minHeight: '80px',
                                    transition: 'all 0.2s ease'
                                }}
                                onTouchStart={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                }}
                                onTouchEnd={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h4 style={{
                                        fontSize: '1.1rem',
                                        fontWeight: 600,
                                        color: '#ffffff',
                                        margin: 0,
                                        marginBottom: '0.5rem'
                                    }}>
                                        Record {rowIndex + 1}
                                    </h4>
                                    
                                    {/* Show preview of first few fields */}
                                    <div style={{
                                        fontSize: '0.9rem',
                                        color: 'var(--text-gray)',
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '1rem'
                                    }}>
                                        {Object.entries(currentSection.fields).slice(0, 2).map(([fieldKey, fieldSchema]) => {
                                            const value = row[fieldKey];
                                            const displayValue = typeof value === 'string' && value.length > 20 
                                                ? `${value.substring(0, 20)}...`
                                                : String(value || '—');
                                            
                                            return (
                                                <span key={fieldKey}>
                                                    <strong>{fieldSchema.title || fieldKey}:</strong> {displayValue}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem'
                                }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteRow(rowIndex);
                                        }}
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.8)',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: '#ffffff',
                                            padding: '0.75rem',
                                            fontSize: '1.1rem',
                                            cursor: 'pointer',
                                            minWidth: '44px',
                                            minHeight: '44px',
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
                                        title="Delete record"
                                    >
                                        🗑️
                                    </button>

                                    <span style={{
                                        fontSize: '1.2rem',
                                        color: 'var(--text-gray)',
                                        transition: 'transform 0.2s ease',
                                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                                    }}>
                                        ▶
                                    </span>
                                </div>
                            </div>

                            {/* Card Fields - Expandable */}
                            {isExpanded && (
                                <div style={{
                                    padding: '1.5rem'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '1.5rem'
                                    }}>
                                        {Object.entries(currentSection.fields).map(([fieldKey, fieldSchema]) => (
                                            <div key={fieldKey}>
                                                <label style={{
                                                    display: 'block',
                                                    fontSize: '1rem',
                                                    fontWeight: 600,
                                                    color: '#ffffff',
                                                    marginBottom: '0.75rem'
                                                }}>
                                                    {fieldSchema.title || fieldKey}
                                                    {fieldSchema.description && (
                                                        <span style={{
                                                            fontSize: '0.85rem',
                                                            color: 'var(--text-gray)',
                                                            display: 'block',
                                                            fontWeight: 400,
                                                            marginTop: '0.25rem',
                                                            lineHeight: 1.4
                                                        }}>
                                                            {fieldSchema.description}
                                                        </span>
                                                    )}
                                                </label>
                                                {renderCell(row[fieldKey], fieldSchema, rowIndex, fieldKey)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div>
            {/* Section Selector */}
            <div style={{
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.02)',
                borderBottom: '1px solid var(--border-color)'
            }}>
                <label style={{
                    display: 'block',
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: '#ffffff',
                    marginBottom: '0.75rem'
                }}>
                    📊 Select Data Table
                </label>
                
                <button
                    onClick={() => setShowSectionSelector(true)}
                    style={{
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '12px',
                        color: '#ffffff',
                        padding: '1rem',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        minHeight: '56px',
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
                        {currentSection ? currentSection.title : 'Choose a table...'}
                    </span>
                    <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>▼</span>
                </button>
            </div>

            {/* Section Selector Modal */}
            {showSectionSelector && (
                <>
                    <div
                        onClick={() => setShowSectionSelector(false)}
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
                                📊 Select Table
                            </h3>
                            <button
                                onClick={() => setShowSectionSelector(false)}
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
                            {schema.sections.map(section => {
                                const sectionData = data[section.id];
                                let itemCount = 0;
                                let itemLabel = 'items';
                                
                                if (Array.isArray(sectionData)) {
                                    itemCount = sectionData.length;
                                    itemLabel = itemCount === 1 ? 'record' : 'records';
                                } else if (sectionData !== null && sectionData !== undefined) {
                                    if (typeof sectionData === 'object') {
                                        itemCount = Object.keys(sectionData).length;
                                        itemLabel = itemCount === 1 ? 'property' : 'properties';
                                    } else {
                                        itemCount = 1;
                                        itemLabel = 'value';
                                    }
                                }

                                return (
                                    <button
                                        key={section.id}
                                        onClick={() => {
                                            setSelectedSection(section.id);
                                            setShowSectionSelector(false);
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '1.25rem',
                                            background: selectedSection === section.id
                                                ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(16, 185, 129, 0.1))'
                                                : 'rgba(255, 255, 255, 0.03)',
                                            border: selectedSection === section.id
                                                ? '2px solid rgba(255, 107, 53, 0.4)'
                                                : '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '16px',
                                            color: selectedSection === section.id ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            textAlign: 'left',
                                            fontSize: '1rem',
                                            marginBottom: '1rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.5rem',
                                            minHeight: '72px'
                                        }}
                                        onTouchStart={(e) => {
                                            e.currentTarget.style.transform = 'scale(0.98)';
                                        }}
                                        onTouchEnd={(e) => {
                                            e.currentTarget.style.transform = 'scale(1)';
                                        }}
                                    >
                                        <div style={{ 
                                            fontWeight: 600, 
                                            fontSize: '1rem'
                                        }}>
                                            {section.title}
                                        </div>
                                        <div style={{ 
                                            fontSize: '0.85rem', 
                                            opacity: 0.8
                                        }}>
                                            {itemCount} {itemLabel}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* Table Content */}
            <div style={{
                padding: '1.5rem'
            }}>
                {currentSection && currentSectionData !== null && currentSectionData !== undefined ? (
                    <div>
                        {/* Header with Add Button */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '2rem',
                            flexWrap: 'wrap',
                            gap: '1rem'
                        }}>
                            <div>
                                <h2 style={{
                                    fontSize: '1.3rem',
                                    fontWeight: 700,
                                    color: '#ffffff',
                                    margin: 0,
                                    marginBottom: '0.5rem'
                                }}>
                                    📊 {currentSection.title}
                                </h2>
                                <p style={{
                                    fontSize: '0.9rem',
                                    color: 'var(--text-gray)',
                                    margin: 0
                                }}>
                                    {Array.isArray(currentSectionData) ? `${currentSectionData.length} records` : 'Object data'}
                                </p>
                            </div>

                            {Array.isArray(currentSectionData) && (
                                <button
                                    onClick={handleAddRow}
                                    style={{
                                        background: 'linear-gradient(135deg, var(--accent-green), #059669)',
                                        border: 'none',
                                        borderRadius: '12px',
                                        color: '#ffffff',
                                        padding: '1rem 1.5rem',
                                        fontSize: '1rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        minHeight: '52px',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.2s ease',
                                        boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)'
                                    }}
                                    onTouchStart={(e) => {
                                        e.currentTarget.style.transform = 'scale(0.98)';
                                    }}
                                    onTouchEnd={(e) => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                    }}
                                >
                                    ➕ Add Record
                                </button>
                            )}
                        </div>

                        {/* Data Display */}
                        {Array.isArray(currentSectionData) && currentSectionData.length > 0 ? (
                            renderMobileCards()
                        ) : Array.isArray(currentSectionData) && currentSectionData.length === 0 ? (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: '300px',
                                flexDirection: 'column',
                                gap: '1.5rem',
                                color: 'var(--text-gray)',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '16px',
                                padding: '3rem 1rem',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '3rem', opacity: 0.5 }}>📋</div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#ffffff' }}>
                                    {currentSection.title}
                                </h3>
                                <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6 }}>
                                    No records available. Tap "Add Record" to create the first entry.
                                </p>
                            </div>
                        ) : (
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '16px',
                                padding: '3rem 1rem',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.5 }}>📊</div>
                                <p style={{
                                    color: 'var(--text-gray)',
                                    margin: 0,
                                    fontSize: '1rem',
                                    lineHeight: 1.6
                                }}>
                                    This section contains {currentSection.type} data. Use Forms view for better editing experience.
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '60vh',
                        flexDirection: 'column',
                        gap: '1.5rem',
                        color: 'var(--text-gray)',
                        textAlign: 'center',
                        padding: '2rem 1rem'
                    }}>
                        <div style={{ fontSize: '4rem', opacity: 0.3 }}>☝️</div>
                        <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#ffffff' }}>Select a Table</h3>
                        <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6, maxWidth: '300px' }}>
                            Choose a data table from the menu above to view records in card format
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MobileTableInterface;