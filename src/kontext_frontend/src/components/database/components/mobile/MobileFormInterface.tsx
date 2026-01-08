import React, { useState, useCallback, useMemo } from 'react';
import ColorField from '../ColorField';
import ImageField from '../ImageField';

interface DatabaseSchema {
    sections: Array<{
        id: string;
        title: string;
        fields: Record<string, any>;
        type: 'object' | 'array' | 'primitive';
        editable?: boolean;
    }>;
}

interface MobileFormInterfaceProps {
    schema: DatabaseSchema;
    data: Record<string, any>;
    onChange: (data: Record<string, any>) => void;
    selectedSection: string | null;
    onSectionChange: (sectionId: string) => void;
    savingStatus: Record<string, boolean>;
}

interface SchemaProperty {
    type: string;
    title?: string;
    description?: string;
    format?: string;
    items?: SchemaProperty;
    properties?: Record<string, SchemaProperty>;
    default?: any;
    required?: boolean;
    enum?: string[];
    placeholder?: string;
    rows?: number;
    maxItems?: number;
}

// Mobile-optimized FormField Component
const MobileFormField: React.FC<{
    schema: SchemaProperty;
    path: string;
    value: any;
    onChange: (path: string, value: any) => void;
}> = ({ schema, path, value, onChange }) => {
    const type = schema.type || 'string';
    const format = schema.format || '';

    const normalizedValue = value === null || value === undefined
        ? (type === 'boolean' ? false : type === 'number' || type === 'integer' ? 0 : '')
        : value;

    const handleChange = (newValue: any) => {
        onChange(path, newValue);
    };

    const getInputStyle = (baseStyle = {}) => ({
        width: '100%',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        color: '#ffffff',
        padding: '1rem',
        fontSize: '16px', // Prevent iOS zoom
        minHeight: '52px',
        transition: 'all 0.2s ease',
        outline: 'none',
        ...baseStyle
    });

    // Handle complex object/array values that aren't meant to be objects
    if (normalizedValue !== null && typeof normalizedValue === 'object' && type !== 'object' && type !== 'array') {
        const isArray = Array.isArray(normalizedValue);
        
        return (
            <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.25rem'
            }}>
                <div style={{
                    fontSize: '0.9rem',
                    color: 'var(--text-gray)',
                    marginBottom: '0.75rem',
                    fontWeight: 500
                }}>
                    {isArray ? `Array with ${normalizedValue.length} items` : `Object with ${Object.keys(normalizedValue).length} properties`}
                </div>
                <textarea
                    value={JSON.stringify(normalizedValue, null, 2)}
                    onChange={(e) => {
                        try {
                            const parsed = JSON.parse(e.target.value);
                            handleChange(parsed);
                        } catch (error) {
                            // Keep the raw string value while user is typing
                        }
                    }}
                    style={{
                        ...getInputStyle(),
                        minHeight: '140px',
                        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
                        fontSize: '14px',
                        resize: 'vertical',
                        lineHeight: 1.5
                    }}
                    placeholder="Enter valid JSON..."
                />
            </div>
        );
    }

    if (format === 'image') {
        return (
            <ImageField
                value={normalizedValue || ''}
                onChange={handleChange}
            />
        );
    }

    switch (type) {
        case 'string':
            if (format === 'color') {
                return (
                    <ColorField
                        value={normalizedValue || schema.default || '#FFFFFF'}
                        onChange={handleChange}
                    />
                );
            } else if (schema.enum) {
                return (
                    <select
                        value={normalizedValue || schema.default || ''}
                        onChange={(e) => handleChange(e.target.value)}
                        style={{
                            ...getInputStyle(),
                            cursor: 'pointer',
                            appearance: 'none',
                            backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")',
                            backgroundPosition: 'right 1rem center',
                            backgroundRepeat: 'no-repeat',
                            backgroundSize: '1.5em 1.5em',
                            paddingRight: '3rem'
                        }}
                    >
                        {!schema.required && (
                            <option value="">-- Select --</option>
                        )}
                        {schema.enum.map((option) => (
                            <option key={option} value={option} style={{ background: '#1a1a2e', color: '#ffffff' }}>
                                {option}
                            </option>
                        ))}
                    </select>
                );
            } else if (format === 'textarea') {
                return (
                    <textarea
                        value={normalizedValue || schema.default || ''}
                        onChange={(e) => handleChange(e.target.value)}
                        placeholder={schema.placeholder || ''}
                        rows={4}
                        style={{
                            ...getInputStyle(),
                            minHeight: '120px',
                            resize: 'vertical',
                            fontFamily: 'inherit',
                            lineHeight: 1.5
                        }}
                    />
                );
            } else {
                return (
                    <input
                        type="text"
                        value={normalizedValue || schema.default || ''}
                        onChange={(e) => handleChange(e.target.value)}
                        placeholder={schema.placeholder || ''}
                        style={getInputStyle()}
                    />
                );
            }

        case 'number':
        case 'integer':
            return (
                <input
                    type="number"
                    inputMode="numeric"
                    value={normalizedValue ?? schema.default ?? ''}
                    onChange={(e) => handleChange(e.target.value)}
                    style={getInputStyle()}
                />
            );

        case 'boolean':
            return (
                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    minHeight: '52px',
                    padding: '0.75rem 1rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                }}>
                    <input
                        type="checkbox"
                        checked={normalizedValue ?? schema.default ?? false}
                        onChange={(e) => handleChange(e.target.checked)}
                        style={{
                            accentColor: 'var(--accent-orange)',
                            transform: 'scale(1.5)',
                            cursor: 'pointer'
                        }}
                    />
                    <span style={{
                        color: '#ffffff',
                        fontSize: '1rem',
                        fontWeight: 500,
                        userSelect: 'none'
                    }}>
                        {normalizedValue ? 'Yes' : 'No'} • {schema.title || 'Enabled'}
                    </span>
                </label>
            );

        case 'array':
            const arrayValue = Array.isArray(normalizedValue) ? normalizedValue : [];
            return (
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '1.25rem'
                }}>
                    <div style={{
                        fontSize: '0.9rem',
                        color: 'var(--text-gray)',
                        marginBottom: '0.75rem',
                        fontWeight: 500
                    }}>
                        Array with {arrayValue.length} items
                    </div>
                    <textarea
                        value={JSON.stringify(arrayValue, null, 2)}
                        onChange={(e) => {
                            try {
                                const parsed = JSON.parse(e.target.value);
                                if (Array.isArray(parsed)) {
                                    handleChange(parsed);
                                }
                            } catch (error) {
                                // Keep the raw string value while user is typing
                            }
                        }}
                        style={{
                            ...getInputStyle(),
                            minHeight: '140px',
                            fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
                            fontSize: '14px',
                            resize: 'vertical',
                            lineHeight: 1.5
                        }}
                        placeholder="Enter valid JSON array..."
                    />
                </div>
            );

        case 'object':
            const objectValue = typeof normalizedValue === 'object' && normalizedValue !== null ? normalizedValue : {};
            return (
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '1.25rem'
                }}>
                    <div style={{
                        fontSize: '0.9rem',
                        color: 'var(--text-gray)',
                        marginBottom: '0.75rem',
                        fontWeight: 500
                    }}>
                        Object with {Object.keys(objectValue).length} properties
                    </div>
                    <textarea
                        value={JSON.stringify(objectValue, null, 2)}
                        onChange={(e) => {
                            try {
                                const parsed = JSON.parse(e.target.value);
                                if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                                    handleChange(parsed);
                                }
                            } catch (error) {
                                // Keep the raw string value while user is typing
                            }
                        }}
                        style={{
                            ...getInputStyle(),
                            minHeight: '140px',
                            fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
                            fontSize: '14px',
                            resize: 'vertical',
                            lineHeight: 1.5
                        }}
                        placeholder="Enter valid JSON object..."
                    />
                </div>
            );

        default:
            return (
                <div style={{
                    padding: '1rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                    color: '#ef4444',
                    fontSize: '1rem',
                    minHeight: '52px',
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: 500
                }}>
                    ⚠️ Unsupported field type: {type}
                </div>
            );
    }
};

// Mobile-optimized ArrayField Component
const MobileArrayField: React.FC<{
    schema: SchemaProperty;
    path: string;
    data: any[];
    onChange: (path: string, value: any[]) => void;
}> = ({ schema, path, data, onChange }) => {
    const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
    const itemSchema = schema.items || { type: 'string' };

    const toggleItem = (index: number) => {
        setExpandedItems(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    const addItem = () => {
        let defaultValue: any;
        switch (itemSchema.type) {
            case 'string':
                defaultValue = itemSchema.default || '';
                break;
            case 'number':
            case 'integer':
                defaultValue = itemSchema.default ?? 0;
                break;
            case 'boolean':
                defaultValue = itemSchema.default ?? false;
                break;
            case 'object':
                defaultValue = itemSchema.default || {};
                break;
            case 'array':
                defaultValue = itemSchema.default || [];
                break;
            default:
                defaultValue = '';
        }

        const newData = [...data, defaultValue];
        onChange(path, newData);
        setExpandedItems(prev => ({
            ...prev,
            [newData.length - 1]: true
        }));

        // Mobile: Scroll to new item after a brief delay
        setTimeout(() => {
            window.scrollTo({ 
                top: document.documentElement.scrollHeight, 
                behavior: 'smooth' 
            });
        }, 100);
    };

    const updateItem = (index: number, value: any) => {
        let processedValue = value;
        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'number') {
            if (typeof value === 'string' && value.trim() !== '') {
                processedValue = Number(value);
            } else if (value === '' || value === null) {
                processedValue = 0;
            }
        }

        const newData = [...data];
        newData[index] = processedValue;
        onChange(path, newData);
    };

    const removeItem = (index: number) => {
        const newData = [...data];
        newData.splice(index, 1);
        onChange(path, newData);
        
        // Clean up expanded state
        const newExpanded = { ...expandedItems };
        delete newExpanded[index];
        // Shift remaining items
        for (let i = index + 1; i < data.length; i++) {
            if (newExpanded[i]) {
                newExpanded[i - 1] = newExpanded[i];
                delete newExpanded[i];
            }
        }
        setExpandedItems(newExpanded);
    };

    const renderItemEditor = (itemValue: any, index: number) => {
        const itemPath = `${path}[${index}]`;

        if (itemSchema.type === 'object' && itemSchema.properties) {
            return (
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '1.25rem'
                }}>
                    {Object.entries(itemSchema.properties).map(([propKey, propSchema]) => {
                        const propPath = `${itemPath}.${propKey}`;
                        return (
                            <div key={propKey} style={{ marginBottom: '1.5rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    color: '#ffffff',
                                    marginBottom: '0.75rem'
                                }}>
                                    {propSchema.title || propKey}
                                    {propSchema.description && (
                                        <span style={{
                                            fontSize: '0.9rem',
                                            color: 'var(--text-gray)',
                                            display: 'block',
                                            fontWeight: 400,
                                            marginTop: '0.25rem',
                                            lineHeight: 1.4
                                        }}>
                                            {propSchema.description}
                                        </span>
                                    )}
                                </label>
                                <MobileFormField
                                    schema={propSchema}
                                    path={propPath}
                                    value={itemValue?.[propKey]}
                                    onChange={(_, newValue) => {
                                        const newItemValue = { ...itemValue, [propKey]: newValue };
                                        updateItem(index, newItemValue);
                                    }}
                                />
                            </div>
                        );
                    })}
                </div>
            );
        } else {
            return (
                <MobileFormField
                    schema={itemSchema}
                    path={itemPath}
                    value={itemValue}
                    onChange={(_, newValue) => updateItem(index, newValue)}
                />
            );
        }
    };

    return (
        <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '1.25rem'
        }}>
            <div style={{ marginBottom: '1.5rem' }}>
                {data.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '3rem 1rem',
                        color: 'var(--text-gray)',
                        fontSize: '1rem'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📋</div>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: '#ffffff', fontWeight: 600 }}>No items yet</h4>
                        <p style={{ margin: 0, lineHeight: 1.5 }}>Tap "Add Item" below to create the first entry.</p>
                    </div>
                ) : (
                    data.map((item, index) => {
                        const isExpanded = expandedItems[index] !== false; // Default to expanded
                        return (
                            <div key={index} style={{
                                border: '1px solid var(--border-color)',
                                borderRadius: '16px',
                                marginBottom: '1rem',
                                overflow: 'hidden',
                                background: 'rgba(255, 255, 255, 0.02)'
                            }}>
                                {/* Item Header - Clickable */}
                                <div
                                    onClick={() => toggleItem(index)}
                                    style={{
                                        padding: '1.25rem',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
                                        minHeight: '72px',
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
                                        <span style={{
                                            fontSize: '1.1rem',
                                            fontWeight: 600,
                                            color: '#ffffff'
                                        }}>
                                            Item {index + 1}
                                        </span>
                                        {typeof item === 'string' && (
                                            <div style={{
                                                fontSize: '0.9rem',
                                                color: 'var(--text-gray)',
                                                marginTop: '0.25rem',
                                                wordBreak: 'break-word'
                                            }}>
                                                {String(item).length > 40 ?
                                                    `${String(item).substring(0, 40)}...` :
                                                    String(item)}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeItem(index);
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
                                            title="Delete item"
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

                                {/* Item Content - Expandable */}
                                {isExpanded && (
                                    <div style={{
                                        padding: '1.25rem'
                                    }}>
                                        {renderItemEditor(item, index)}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Add Item Button */}
            <button
                type="button"
                onClick={addItem}
                style={{
                    background: 'linear-gradient(135deg, var(--accent-green), #059669)',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#ffffff',
                    padding: '1rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    width: '100%',
                    minHeight: '56px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
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
                ➕ Add New Item
            </button>
        </div>
    );
};

export const MobileFormInterface: React.FC<MobileFormInterfaceProps> = ({
    schema,
    data,
    onChange,
    selectedSection,
    onSectionChange,
    savingStatus
}) => {
    const [showSectionSelector, setShowSectionSelector] = useState(false);

    const formatFieldLabel = (key: string): string => {
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    };

    const handleChange = (path: string, value: any) => {
        const newData = JSON.parse(JSON.stringify(data || {}));
        const pathParts = path.split('.');
        
        if (path.includes('[') && path.includes(']')) {
            const arrayMatch = path.match(/^(\w+)\[(\d+)\](?:\.(\w+))?$/);
            if (arrayMatch) {
                const [_, arrayName, indexStr, propertyName] = arrayMatch;
                const index = parseInt(indexStr, 10);

                if (!newData[arrayName]) {
                    newData[arrayName] = [];
                }

                while (newData[arrayName].length <= index) {
                    newData[arrayName].push({});
                }

                if (propertyName) {
                    newData[arrayName][index][propertyName] = value;
                } else {
                    newData[arrayName][index] = value;
                }

                onChange(newData);
                return;
            }
        }

        if (path.includes('.value')) {
            const sectionName = path.split('.')[0];
            newData[sectionName] = value;
            onChange(newData);
            return;
        }

        let current = newData;
        for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            if (!(part in current)) {
                current[part] = {};
            }
            current = current[part];
        }

        const lastPart = pathParts[pathParts.length - 1];
        current[lastPart] = value;
        onChange(newData);
    };

    // Get current section
    const currentSection = useMemo(() => {
        return schema.sections.find(section => section.id === selectedSection);
    }, [schema.sections, selectedSection]);

    // Auto-select first section
    React.useEffect(() => {
        if (!selectedSection && schema.sections.length > 0) {
            onSectionChange(schema.sections[0].id);
        }
    }, [selectedSection, schema.sections, onSectionChange]);

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
                    📝 Select Data Section
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
                        {currentSection ? currentSection.title : 'Choose a section...'}
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
                                📝 Select Section
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
                                        onClick={() => {
                                            onSectionChange(section.id);
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

            {/* Form Content */}
            <div style={{
                padding: '1.5rem'
            }}>
                {selectedSection && currentSection ? (() => {
                    const sectionData = data[selectedSection];

                    return (
                        <div>
                            {/* Section Header */}
                            <div style={{ marginBottom: '2rem' }}>
                                <h2 style={{
                                    fontSize: '1.3rem',
                                    fontWeight: 700,
                                    color: '#ffffff',
                                    margin: 0,
                                    marginBottom: '0.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem'
                                }}>
                                    📝 {currentSection.title}
                                </h2>
                            </div>

                            {/* Array Section */}
                            {currentSection.type === 'array' && Array.isArray(sectionData) && (
                                <MobileArrayField
                                    schema={{
                                        type: 'array',
                                        title: currentSection.title,
                                        items: {
                                            type: 'object',
                                            properties: currentSection.fields
                                        }
                                    }}
                                    path={selectedSection}
                                    data={sectionData}
                                    onChange={handleChange}
                                />
                            )}

                            {/* Empty Array Section */}
                            {currentSection.type === 'array' && (!sectionData || (Array.isArray(sectionData) && sectionData.length === 0)) && (
                                <div>
                                    <div style={{
                                        textAlign: 'center',
                                        padding: '3rem 1rem',
                                        color: 'var(--text-gray)',
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '16px',
                                        marginBottom: '2rem'
                                    }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📋</div>
                                        <h3 style={{ margin: 0, fontSize: '1.25rem', marginBottom: '0.75rem', color: '#ffffff' }}>
                                            {currentSection.title}
                                        </h3>
                                        <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6 }}>
                                            No records yet. Create your first entry to get started.
                                        </p>
                                    </div>
                                    
                                    <MobileArrayField
                                        schema={{
                                            type: 'array',
                                            title: currentSection.title,
                                            items: {
                                                type: 'object',
                                                properties: currentSection.fields
                                            }
                                        }}
                                        path={selectedSection}
                                        data={[]}
                                        onChange={handleChange}
                                    />
                                </div>
                            )}

                            {/* Primitive Section */}
                            {currentSection.type === 'primitive' && (
                                <div style={{
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '16px',
                                    padding: '2rem'
                                }}>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '1.1rem',
                                        fontWeight: 600,
                                        color: '#ffffff',
                                        marginBottom: '1rem'
                                    }}>
                                        Value
                                    </label>
                                    <MobileFormField
                                        schema={currentSection.fields.value || { type: 'string', title: 'Value' }}
                                        path={`${selectedSection}.value`}
                                        value={sectionData}
                                        onChange={handleChange}
                                    />
                                </div>
                            )}

                            {/* Object Section */}
                            {currentSection.type === 'object' && sectionData && typeof sectionData === 'object' && !Array.isArray(sectionData) && Object.keys(currentSection.fields).length > 0 && (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2rem'
                                }}>
                                    {Object.entries(currentSection.fields).map(([fieldId, fieldSchema]: [string, any]) => {
                                        const fullPath = `${selectedSection}.${fieldId}`;
                                        return (
                                            <div key={fieldId} style={{
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '16px',
                                                padding: '2rem'
                                            }}>
                                                <label style={{
                                                    display: 'block',
                                                    fontSize: '1.1rem',
                                                    fontWeight: 600,
                                                    color: '#ffffff',
                                                    marginBottom: '1rem'
                                                }}>
                                                    {fieldSchema.title || formatFieldLabel(fieldId)}
                                                    {fieldSchema.description && (
                                                        <span style={{
                                                            fontSize: '0.95rem',
                                                            color: 'var(--text-gray)',
                                                            display: 'block',
                                                            fontWeight: 400,
                                                            marginTop: '0.5rem',
                                                            lineHeight: 1.5
                                                        }}>
                                                            {fieldSchema.description}
                                                        </span>
                                                    )}
                                                </label>
                                                <MobileFormField
                                                    schema={fieldSchema}
                                                    path={fullPath}
                                                    value={sectionData?.[fieldId]}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Empty Object Section */}
                            {currentSection.type === 'object' && (!sectionData || (typeof sectionData === 'object' && Object.keys(sectionData).length === 0)) && (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '3rem 1rem',
                                    color: 'var(--text-gray)',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '16px'
                                }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📭</div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', marginBottom: '0.75rem', color: '#ffffff' }}>
                                        {currentSection.title}
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6 }}>No data available for this section.</p>
                                </div>
                            )}
                        </div>
                    );
                })() : (
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
                        <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#ffffff' }}>Select a Section</h3>
                        <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6, maxWidth: '300px' }}>
                            Choose a data section from the menu above to start editing your forms
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MobileFormInterface;