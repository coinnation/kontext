import React, { useState, useCallback, useMemo } from 'react';

interface DatabaseSchema {
    sections: Array<{
        id: string;
        title: string;
        fields: Record<string, any>;
        type: 'object' | 'array' | 'primitive';
        editable?: boolean;
    }>;
}

interface DatabaseTableViewProps {
    schema: DatabaseSchema;
    data: Record<string, any>;
    onChange: (data: Record<string, any>) => void;
}

export const DatabaseTableView: React.FC<DatabaseTableViewProps> = ({
    schema,
    data,
    onChange
}) => {
    const [selectedSection, setSelectedSection] = useState<string | null>(null);

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

    const handleCellChange = useCallback((rowIndex: number, fieldKey: string, value: any) => {
        if (!selectedSection) return;

        const updatedData = { ...data };
        let sectionData = updatedData[selectedSection];
        
        // Handle conversion: if it was a single object wrapped in array, unwrap it back
        // Otherwise, work with the array directly
        if (Array.isArray(sectionData)) {
            sectionData = [...sectionData];
        if (sectionData[rowIndex]) {
            sectionData[rowIndex] = {
                ...sectionData[rowIndex],
                    [fieldKey]: value
                };
            }
            // If original was a single object (now array with 1 item), unwrap it
            const originalData = data[selectedSection];
            if (!Array.isArray(originalData) && sectionData.length === 1) {
                updatedData[selectedSection] = sectionData[0];
            } else {
                updatedData[selectedSection] = sectionData;
            }
        } else {
            // Single object - update it directly
            updatedData[selectedSection] = {
                ...sectionData,
                [fieldKey]: value
            };
        }

        onChange(updatedData);
    }, [data, onChange, selectedSection]);

    const handleAddRow = useCallback(() => {
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
    }, [data, onChange, selectedSection, currentSection]);

    const handleDeleteRow = useCallback((rowIndex: number) => {
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
    }, [data, onChange, selectedSection]);

    const renderCell = useCallback((value: any, fieldSchema: any, rowIndex: number, fieldKey: string) => {
        const commonInputStyle = {
            width: '100%',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: '#ffffff',
            padding: '0.5rem',
            fontSize: '0.85rem',
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
                                minHeight: '80px',
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
                        padding: '0.5rem',
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
                                transform: 'scale(1.2)',
                                marginRight: '0.5rem'
                            }}
                        />
                    </label>
                );

            default:
                return (
                    <div style={{
                        padding: '0.5rem',
                        color: 'var(--text-gray)',
                        fontSize: '0.8rem',
                        textAlign: 'center',
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
    }, [handleCellChange]);

    return (
        <div style={{
            display: 'flex',
            minHeight: '100%',
            background: 'var(--bg-dark)',
            width: '100%'
        }}>
            {/* Section Sidebar */}
            <div style={{
                width: '300px',
                borderRight: '1px solid var(--border-color)',
                background: 'rgba(255, 255, 255, 0.02)',
                overflowY: 'auto',
                flexShrink: 0,
                marginLeft: '25px'
            }}>
                <div style={{
                    padding: '1rem',
                    borderBottom: '1px solid var(--border-color)'
                }}>
                    <h3 style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: '#ffffff',
                        margin: 0
                    }}>
                        📊 Table View
                    </h3>
                    <p style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-gray)',
                        margin: '0.25rem 0 0 0'
                    }}>
                        {schema.sections.length} sections available
                    </p>
                </div>

                <div style={{ padding: '0.5rem' }}>
                    {schema.sections.map(section => {
                        const sectionData = data[section.id];
                        let itemCount = 0;
                        let itemLabel = 'items';
                        
                        if (Array.isArray(sectionData)) {
                            itemCount = sectionData.length;
                            itemLabel = itemCount === 1 ? 'item' : 'items';
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
                                onClick={() => setSelectedSection(section.id)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    minHeight: '72px',
                                    background: selectedSection === section.id
                                        ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(16, 185, 129, 0.1))'
                                        : 'transparent',
                                    border: selectedSection === section.id
                                        ? '1px solid rgba(255, 107, 53, 0.4)'
                                        : '1px solid transparent',
                                    borderRadius: '8px',
                                    color: selectedSection === section.id ? '#ffffff' : 'var(--text-gray)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    textAlign: 'left',
                                    fontSize: '0.9rem',
                                    fontWeight: selectedSection === section.id ? 600 : 500,
                                    marginBottom: '0.25rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.25rem'
                                }}
                                onMouseEnter={(e) => {
                                    if (selectedSection !== section.id) {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (selectedSection !== section.id) {
                                        e.currentTarget.style.background = 'transparent';
                                    }
                                }}
                            >
                                <div>{section.title}</div>
                                <div style={{
                                    fontSize: '0.75rem',
                                    opacity: 0.8
                                }}>
                                    {itemCount} {itemLabel}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content Area - FIXED SCROLLING */}
            <div style={{
                flex: 1,
                overflowY: 'auto', // This enables proper vertical scrolling
                width: '100%',
                minWidth: 0
            }}>
                <div style={{
                    padding: '1.5rem',
                    width: '100%'
                }}>
                    {currentSection && currentSectionData !== null && currentSectionData !== undefined ? (
                        <div style={{ width: '100%' }}>
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
                                        fontSize: '1.5rem',
                                        fontWeight: 700,
                                        color: '#ffffff',
                                        margin: 0,
                                        marginBottom: '0.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem'
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
                                            padding: '0.75rem 1rem',
                                            fontSize: '0.85rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            whiteSpace: 'nowrap',
                                            transition: 'all 0.2s ease',
                                            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.3)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.2)';
                                        }}
                                    >
                                        ➕ Add Row
                                    </button>
                                )}
                            </div>

                            {/* Data Display */}
                            {Array.isArray(currentSectionData) && currentSectionData.length > 0 ? (
                                /* Desktop Table */
                                <div style={{
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '16px',
                                    overflow: 'hidden',
                                    width: '100%'
                                }}>
                                    <div style={{ 
                                        overflowX: 'auto',
                                        WebkitOverflowScrolling: 'touch' 
                                    }}>
                                        <table style={{
                                            width: '100%',
                                            borderCollapse: 'collapse',
                                            minWidth: '600px'
                                        }}>
                                            <thead>
                                                <tr style={{
                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                    borderBottom: '1px solid var(--border-color)'
                                                }}>
                                                    {Object.entries(currentSection.fields).map(([fieldKey, fieldSchema]) => (
                                                        <th
                                                            key={fieldKey}
                                                            style={{
                                                                padding: '1.25rem 1rem',
                                                                textAlign: 'left',
                                                                fontSize: '0.85rem',
                                                                fontWeight: 600,
                                                                color: '#ffffff',
                                                                borderRight: '1px solid var(--border-color)',
                                                                minWidth: '150px'
                                                            }}
                                                        >
                                                            {fieldSchema.title || fieldKey}
                                                        </th>
                                                    ))}
                                                    <th style={{
                                                        padding: '1.25rem 1rem',
                                                        textAlign: 'center',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 600,
                                                        color: '#ffffff',
                                                        width: '100px'
                                                    }}>
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentSectionData.map((row: any, rowIndex: number) => (
                                                    <tr
                                                        key={rowIndex}
                                                        style={{
                                                            borderBottom: '1px solid var(--border-color)',
                                                            transition: 'background 0.2s ease'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = 'transparent';
                                                        }}
                                                    >
                                                        {Object.entries(currentSection.fields).map(([fieldKey, fieldSchema]) => (
                                                            <td
                                                                key={fieldKey}
                                                                style={{
                                                                    padding: '1rem',
                                                                    borderRight: '1px solid var(--border-color)',
                                                                    verticalAlign: 'top'
                                                                }}
                                                            >
                                                                {renderCell(row[fieldKey], fieldSchema, rowIndex, fieldKey)}
                                                            </td>
                                                        ))}
                                                        <td style={{
                                                            padding: '1rem',
                                                            textAlign: 'center',
                                                            verticalAlign: 'middle'
                                                        }}>
                                                            <button
                                                                onClick={() => handleDeleteRow(rowIndex)}
                                                                style={{
                                                                    background: 'rgba(239, 68, 68, 0.8)',
                                                                    border: 'none',
                                                                    borderRadius: '6px',
                                                                    color: '#ffffff',
                                                                    width: '36px',
                                                                    height: '36px',
                                                                    fontSize: '0.9rem',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    margin: '0 auto',
                                                                    transition: 'all 0.2s ease'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.background = 'rgba(239, 68, 68, 1)';
                                                                    e.currentTarget.style.transform = 'scale(1.1)';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)';
                                                                    e.currentTarget.style.transform = 'scale(1)';
                                                                }}
                                                                title="Delete row"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
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
                                    padding: '2rem',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '2rem', opacity: 0.5 }}>📋</div>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#ffffff' }}>
                                        {currentSection.title}
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6 }}>
                                        No data available. Click "Add Row" to create the first record.
                                    </p>
                                </div>
                            ) : (
                                <div style={{
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '16px',
                                    padding: '2rem',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.5 }}>📊</div>
                                    <p style={{
                                        color: 'var(--text-gray)',
                                        margin: 0,
                                        fontSize: '1rem',
                                        lineHeight: 1.6
                                    }}>
                                        This section contains {currentSection.type} data. Use Form View for better editing experience.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '400px',
                            flexDirection: 'column',
                            gap: '1.5rem',
                            color: 'var(--text-gray)',
                            textAlign: 'center',
                            padding: '2rem'
                        }}>
                            <div style={{ fontSize: '3rem', opacity: 0.3 }}>👈</div>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#ffffff' }}>Select a Section</h3>
                            <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6 }}>
                                Choose a section from the sidebar to view data in table format
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DatabaseTableView;