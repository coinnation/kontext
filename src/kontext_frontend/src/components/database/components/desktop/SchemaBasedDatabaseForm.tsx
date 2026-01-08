import React, { useState, useEffect, useCallback } from 'react';
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

interface SchemaBasedDatabaseFormProps {
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

// FormField Component - handles individual field rendering
const FormField: React.FC<{
    schema: SchemaProperty;
    path: string;
    value: any;
    onChange: (path: string, value: any) => void;
    readOnly?: boolean;
}> = ({ schema, path, value, onChange, readOnly = false }) => {
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
        background: readOnly ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.05)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        color: readOnly ? 'var(--text-gray)' : '#ffffff',
        padding: '0.75rem',
        fontSize: '0.9rem',
        transition: 'all 0.2s ease',
        outline: 'none',
        cursor: readOnly ? 'not-allowed' : 'text',
        opacity: readOnly ? 0.6 : 1,
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
                padding: '1rem'
            }}>
                <div style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-gray)',
                    marginBottom: '0.75rem',
                    fontWeight: 500
                }}>
                    {isArray ? `Array with ${normalizedValue.length} items` : `Object with ${Object.keys(normalizedValue).length} properties`}
                </div>
                <textarea
                    value={JSON.stringify(normalizedValue, null, 2)}
                    onChange={(e) => {
                        if (!readOnly) {
                        try {
                            const parsed = JSON.parse(e.target.value);
                            handleChange(parsed);
                        } catch (error) {
                            // Keep the raw string value while user is typing
                            }
                        }
                    }}
                    disabled={readOnly}
                    style={{
                        ...getInputStyle(),
                        minHeight: '120px',
                        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
                        fontSize: '0.8rem',
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
                        onChange={(e) => !readOnly && handleChange(e.target.value)}
                        disabled={readOnly}
                        style={{
                            ...getInputStyle(),
                            cursor: readOnly ? 'not-allowed' : 'pointer',
                            backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")',
                            backgroundPosition: 'right 0.75rem center',
                            backgroundRepeat: 'no-repeat',
                            backgroundSize: '1.5em 1.5em',
                            paddingRight: '2.5rem',
                            appearance: 'none'
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
                        onChange={(e) => !readOnly && handleChange(e.target.value)}
                        disabled={readOnly}
                        placeholder={schema.placeholder || ''}
                        rows={schema.rows || 3}
                        style={{
                            ...getInputStyle(),
                            minHeight: '80px',
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
                        onChange={(e) => !readOnly && handleChange(e.target.value)}
                        disabled={readOnly}
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
                    onChange={(e) => !readOnly && handleChange(e.target.value)}
                    disabled={readOnly}
                    style={getInputStyle()}
                />
            );

        case 'boolean':
            return (
                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                >
                    <input
                        type="checkbox"
                        checked={normalizedValue ?? schema.default ?? false}
                        onChange={(e) => !readOnly && handleChange(e.target.checked)}
                        disabled={readOnly}
                        style={{
                            accentColor: 'var(--accent-orange)',
                            transform: 'scale(1.3)',
                            cursor: readOnly ? 'not-allowed' : 'pointer',
                            opacity: readOnly ? 0.5 : 1
                        }}
                    />
                    <span style={{
                        color: '#ffffff',
                        fontSize: '0.9rem',
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
                    padding: '1rem'
                }}>
                    <div style={{
                        fontSize: '0.85rem',
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
                            minHeight: '120px',
                            fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
                            fontSize: '0.8rem',
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
                    padding: '1rem'
                }}>
                    <div style={{
                        fontSize: '0.85rem',
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
                            minHeight: '120px',
                            fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
                            fontSize: '0.8rem',
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
                    padding: '0.75rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    color: '#ef4444',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: 500
                }}>
                    ⚠️ Unsupported field type: {type}
                </div>
            );
    }
};

// ArrayField Component
const ArrayField: React.FC<{
    schema: SchemaProperty;
    path: string;
    data: any[];
    onChange: (path: string, value: any[]) => void;
    readOnly?: boolean;
}> = ({ schema, path, data, onChange, readOnly = false }) => {
    const itemSchema = schema.items || { type: 'string' };

    const addItem = () => {
        if (readOnly) return;
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
    };

    const updateItem = (index: number, value: any) => {
        if (readOnly) return;
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
        if (readOnly) return;
        const newData = [...data];
        newData.splice(index, 1);
        onChange(path, newData);
    };

    const renderItemEditor = (itemValue: any, index: number) => {
        const itemPath = `${path}[${index}]`;

        if (itemSchema.type === 'object' && itemSchema.properties) {
            return (
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '1rem'
                }}>
                    {Object.entries(itemSchema.properties).map(([propKey, propSchema]) => {
                        const propPath = `${itemPath}.${propKey}`;
                        return (
                            <div key={propKey} style={{ marginBottom: '1.25rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    color: '#ffffff',
                                    marginBottom: '0.75rem'
                                }}>
                                    {propSchema.title || propKey}
                                    {propSchema.description && (
                                        <span style={{
                                            fontSize: '0.8rem',
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
                                <FormField
                                    schema={propSchema}
                                    path={propPath}
                                    value={itemValue?.[propKey]}
                                    onChange={(_, newValue) => {
                                        const newItemValue = { ...itemValue, [propKey]: newValue };
                                        updateItem(index, newItemValue);
                                    }}
                                    readOnly={readOnly}
                                />
                            </div>
                        );
                    })}
                </div>
            );
        } else {
            return (
                <FormField
                    schema={itemSchema}
                    path={itemPath}
                    value={itemValue}
                    onChange={(_, newValue) => updateItem(index, newValue)}
                    readOnly={readOnly}
                />
            );
        }
    };

    return (
        <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1rem'
        }}>
            <div style={{ marginBottom: '1.5rem' }}>
                {data.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '2rem',
                        color: 'var(--text-gray)',
                        fontSize: '0.9rem'
                    }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.5 }}>📋</div>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: '#ffffff', fontWeight: 600 }}>No items yet</h4>
                        <p style={{ margin: 0, lineHeight: 1.5 }}>Click "Add Item" below to create the first entry.</p>
                    </div>
                ) : (
                    data.map((item, index) => (
                        <div key={index} style={{
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            marginBottom: '1rem',
                            overflow: 'hidden',
                            background: 'rgba(255, 255, 255, 0.02)'
                        }}>
                            {/* Item Header */}
                            <div style={{
                                padding: '1rem',
                                background: 'rgba(255, 255, 255, 0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid var(--border-color)'
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{
                                        fontSize: '0.9rem',
                                        fontWeight: 600,
                                        color: '#ffffff'
                                    }}>
                                        Item {index + 1}
                                    </span>
                                    {typeof item === 'string' && (
                                        <div style={{
                                            fontSize: '0.8rem',
                                            color: 'var(--text-gray)',
                                            marginTop: '0.25rem',
                                            wordBreak: 'break-word'
                                        }}>
                                            {String(item).length > 30 ?
                                                `${String(item).substring(0, 30)}...` :
                                                String(item)}
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeItem(index);
                                    }}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.8)',
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: '#ffffff',
                                        padding: '0.5rem 0.75rem',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(239, 68, 68, 1)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)';
                                    }}
                                >
                                    🗑️ Remove
                                </button>
                            </div>

                            {/* Item Content */}
                            <div style={{ padding: '1rem' }}>
                                {renderItemEditor(item, index)}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Add Item Button */}
            <button
                type="button"
                onClick={addItem}
                style={{
                    background: 'linear-gradient(135deg, var(--accent-green), #059669)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#ffffff',
                    padding: '0.75rem 1rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
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
                ➕ Add New Item
            </button>
        </div>
    );
};

// Main Component
export const SchemaBasedDatabaseForm: React.FC<SchemaBasedDatabaseFormProps> = ({
    schema,
    data,
    onChange,
    selectedSection,
    onSectionChange,
    savingStatus
}) => {
    const [changedSections, setChangedSections] = useState<Record<string, boolean>>({});
    const [originalData, setOriginalData] = useState<Record<string, any>>({});

    useEffect(() => {
        setOriginalData(JSON.parse(JSON.stringify(data || {})));
    }, []);

    useEffect(() => {
        if (!originalData || !data) return;

        const detectChanges = () => {
            const changedSectionsMap: Record<string, boolean> = {};
            schema.sections.forEach(section => {
                const sectionId = section.id;
                const currentValue = data[sectionId];
                const originalValue = originalData[sectionId];
                changedSectionsMap[sectionId] = !isEqual(currentValue, originalValue);
            });
            return changedSectionsMap;
        };

        setChangedSections(detectChanges());
    }, [data, originalData, schema]);

    const isEqual = useCallback((obj1: any, obj2: any): boolean => {
        if (obj1 === obj2) return true;
        if (obj1 == null || obj2 == null) return obj1 === obj2;
        if (typeof obj1 !== typeof obj2) return false;

        if (Array.isArray(obj1) && Array.isArray(obj2)) {
            if (obj1.length !== obj2.length) return false;
            for (let i = 0; i < obj1.length; i++) {
                if (!isEqual(obj1[i], obj2[i])) return false;
            }
            return true;
        }

        if (typeof obj1 === 'object' && typeof obj2 === 'object') {
            const keys1 = Object.keys(obj1);
            const keys2 = Object.keys(obj2);
            if (keys1.length !== keys2.length) return false;
            return keys1.every(key =>
                obj2.hasOwnProperty(key) && isEqual(obj1[key], obj2[key])
            );
        }

        return false;
    }, []);

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
                        📝 Form View
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

                        const hasChanged = changedSections[section.id] || false;
                        const isSaving = savingStatus[section.id] || false;

                        return (
                            <button
                                key={section.id}
                                onClick={() => onSectionChange(section.id)}
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
                                    opacity: 0.8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    flexWrap: 'wrap'
                                }}>
                                    <span>{itemCount} {itemLabel}</span>
                                    {section.editable === false && (
                                        <span style={{
                                            background: 'rgba(156, 163, 175, 0.2)',
                                            color: 'var(--text-gray)',
                                            fontSize: '0.7rem',
                                            padding: '0.15rem 0.4rem',
                                            borderRadius: '10px',
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem'
                                        }}>
                                            🔒 Read-only
                                        </span>
                                    )}
                                    {hasChanged && (
                                        <span style={{
                                            background: 'var(--accent-orange)',
                                            color: '#ffffff',
                                            fontSize: '0.7rem',
                                            padding: '0.15rem 0.4rem',
                                            borderRadius: '10px',
                                            fontWeight: 600
                                        }}>
                                            CHANGED
                                        </span>
                                    )}
                                    {isSaving && (
                                        <span style={{
                                            background: 'var(--accent-green)',
                                            color: '#ffffff',
                                            fontSize: '0.7rem',
                                            padding: '0.15rem 0.4rem',
                                            borderRadius: '10px',
                                            fontWeight: 600
                                        }}>
                                            SAVING...
                                        </span>
                                    )}
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
                    width: '100%',
                    maxWidth: '1200px',
                    margin: '0 auto'
                }}>
                    {selectedSection ? (() => {
                        const section = schema.sections.find(s => s.id === selectedSection);
                        const sectionData = data[selectedSection];

                        if (!section) {
                            return (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '3rem',
                                    color: 'var(--text-gray)'
                                }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>❓</div>
                                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#ffffff' }}>Section not found</h3>
                                    <p style={{ margin: 0 }}>The selected section could not be found.</p>
                                </div>
                            );
                        }

                        return (
                            <div style={{ width: '100%' }}>
                                {/* Section Header */}
                                <div style={{ marginBottom: '2rem' }}>
                                    <h2 style={{
                                        fontSize: '1.5rem',
                                        fontWeight: 700,
                                        color: '#ffffff',
                                        margin: 0,
                                        marginBottom: '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem'
                                    }}>
                                        📝 {section.title}
                                        {section.editable === false && (
                                            <span style={{
                                                background: 'rgba(156, 163, 175, 0.2)',
                                                color: 'var(--text-gray)',
                                                fontSize: '0.75rem',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '6px',
                                                fontWeight: 500,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.25rem'
                                            }}>
                                                🔒 Read-only
                                            </span>
                                        )}
                                    </h2>
                                    {section.editable === false && (
                                        <div style={{
                                            background: 'rgba(156, 163, 175, 0.1)',
                                            border: '1px solid rgba(156, 163, 175, 0.2)',
                                            borderRadius: '8px',
                                            padding: '0.75rem',
                                            color: 'var(--text-gray)',
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            fontWeight: 500,
                                            marginBottom: '1rem'
                                        }}>
                                            ℹ️ This section is read-only. No setter method is available to save changes.
                                        </div>
                                    )}
                                    {changedSections[selectedSection] && section.editable !== false && (
                                        <div style={{
                                            background: 'rgba(255, 107, 53, 0.1)',
                                            border: '1px solid rgba(255, 107, 53, 0.3)',
                                            borderRadius: '8px',
                                            padding: '0.75rem',
                                            color: 'var(--accent-orange)',
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            fontWeight: 500
                                        }}>
                                            ⚠️ This section has unsaved changes
                                        </div>
                                    )}
                                </div>

                                {/* Array Section */}
                                {section.type === 'array' && Array.isArray(sectionData) && (
                                    <ArrayField
                                        schema={{
                                            type: 'array',
                                            title: section.title,
                                            items: {
                                                type: 'object',
                                                properties: section.fields
                                            }
                                        }}
                                        path={selectedSection}
                                        data={sectionData}
                                        onChange={handleChange}
                                        readOnly={section.editable === false}
                                    />
                                )}

                                {/* Empty Array Section */}
                                {section.type === 'array' && (!sectionData || (Array.isArray(sectionData) && sectionData.length === 0)) && (
                                    <div>
                                        <div style={{
                                            textAlign: 'center',
                                            padding: '3rem',
                                            color: 'var(--text-gray)',
                                            background: 'rgba(255, 255, 255, 0.03)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '16px',
                                            marginBottom: '2rem'
                                        }}>
                                            <div style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.5 }}>📋</div>
                                            <h3 style={{ margin: 0, fontSize: '1.2rem', marginBottom: '0.75rem', color: '#ffffff' }}>
                                                {section.title}
                                            </h3>
                                            <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6, maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                                                No records yet. Create your first entry to get started with this section.
                                            </p>
                                        </div>
                                        
                                        <ArrayField
                                            schema={{
                                                type: 'array',
                                                title: section.title,
                                                items: {
                                                    type: 'object',
                                                    properties: section.fields
                                                }
                                            }}
                                            path={selectedSection}
                                            data={[]}
                                            onChange={handleChange}
                                        />
                                    </div>
                                )}

                                {/* Primitive Section */}
                                {section.type === 'primitive' && (
                                    <div style={{
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '16px',
                                        padding: '1.5rem'
                                    }}>
                                        <label style={{
                                            display: 'block',
                                            fontSize: '0.9rem',
                                            fontWeight: 600,
                                            color: '#ffffff',
                                            marginBottom: '1rem'
                                        }}>
                                            Value
                                        </label>
                                        <FormField
                                            schema={section.fields.value || { type: 'string', title: 'Value' }}
                                            path={`${selectedSection}.value`}
                                            value={sectionData}
                                            onChange={handleChange}
                                            readOnly={section.editable === false}
                                        />
                                    </div>
                                )}

                                {/* Object Section */}
                                {section.type === 'object' && sectionData && typeof sectionData === 'object' && !Array.isArray(sectionData) && Object.keys(section.fields).length > 0 && (
                                    <div style={{
                                        display: 'grid',
                                        gap: '1.5rem'
                                    }}>
                                        {Object.entries(section.fields).map(([fieldId, fieldSchema]: [string, any]) => {
                                            const fullPath = `${selectedSection}.${fieldId}`;
                                            return (
                                                <div key={fieldId} style={{
                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '16px',
                                                    padding: '1.5rem'
                                                }}>
                                                    <label style={{
                                                        display: 'block',
                                                        fontSize: '0.9rem',
                                                        fontWeight: 600,
                                                        color: '#ffffff',
                                                        marginBottom: '1rem'
                                                    }}>
                                                        {fieldSchema.title || formatFieldLabel(fieldId)}
                                                        {fieldSchema.description && (
                                                            <span style={{
                                                                fontSize: '0.8rem',
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
                                                    <FormField
                                                        schema={fieldSchema}
                                                        path={fullPath}
                                                        value={sectionData?.[fieldId]}
                                                        onChange={handleChange}
                                                        readOnly={section.editable === false}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Empty Object Section */}
                                {section.type === 'object' && (!sectionData || (typeof sectionData === 'object' && Object.keys(sectionData).length === 0)) && (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: '3rem',
                                        color: 'var(--text-gray)',
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '16px'
                                    }}>
                                        <div style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.5 }}>📭</div>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem', marginBottom: '0.75rem', color: '#ffffff' }}>
                                            {section.title}
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
                            minHeight: '50vh',
                            flexDirection: 'column',
                            gap: '1.5rem',
                            color: 'var(--text-gray)',
                            textAlign: 'center',
                            padding: '3rem'
                        }}>
                            <div style={{ fontSize: '3rem', opacity: 0.3 }}>👈</div>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#ffffff' }}>Select a Section</h3>
                            <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6, maxWidth: '400px' }}>
                                Choose a section from the sidebar to start editing your data
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SchemaBasedDatabaseForm;