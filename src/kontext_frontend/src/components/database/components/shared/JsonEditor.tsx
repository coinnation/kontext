import React, { useState, useEffect } from 'react';

interface JsonEditorProps {
    value: Record<string, any> | null;
    onChange: (data: Record<string, any>) => void;
    readOnly?: boolean;
}

/**
 * A simple JSON editor component for editing database data as JSON
 */
export const JsonEditor: React.FC<JsonEditorProps> = ({ value, onChange, readOnly = false }) => {
    const [text, setText] = useState<string>('{}');
    const [error, setError] = useState<string | null>(null);

    // Update text when value prop changes
    useEffect(() => {
        if (value) {
            try {
                const jsonString = JSON.stringify(value, (key, val) => {
                    // Handle BigInt values
                    if (typeof val === 'bigint') {
                        return val.toString();
                    }
                    return val;
                }, 2);
                setText(jsonString);
                setError(null);
            } catch (err) {
                setError(`Error serializing data: ${(err as Error).message}`);
            }
        } else {
            setText('{}');
        }
    }, [value]);

    // Handle text input change
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (readOnly) return;

        const newText = e.target.value;
        setText(newText);

        try {
            // Validate JSON by parsing it
            const parsed = JSON.parse(newText);
            setError(null);
            onChange(parsed);
        } catch (err) {
            setError(`Invalid JSON: ${(err as Error).message}`);
        }
    };

    // Format JSON with proper indentation
    const formatJson = () => {
        if (readOnly) return;

        try {
            const parsed = JSON.parse(text);
            const formatted = JSON.stringify(parsed, (key, val) => {
                if (typeof val === 'bigint') {
                    return val.toString();
                }
                return val;
            }, 2);
            setText(formatted);
            setError(null);
            onChange(parsed);
        } catch (err) {
            setError(`Cannot format: ${(err as Error).message}`);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
            background: 'var(--bg-dark)'
        }}>
            {/* Toolbar */}
            <div style={{
                padding: '1rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                background: 'rgba(255, 255, 255, 0.02)'
            }}>
                <button
                    type="button"
                    onClick={formatJson}
                    disabled={!!error || readOnly}
                    style={{
                        background: error || readOnly ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 107, 53, 0.2)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: error || readOnly ? 'var(--text-gray)' : '#ffffff',
                        padding: '0.5rem 1rem',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        cursor: error || readOnly ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                    onMouseEnter={(e) => {
                        if (!error && !readOnly) {
                            e.currentTarget.style.background = 'rgba(255, 107, 53, 0.3)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!error && !readOnly) {
                            e.currentTarget.style.background = 'rgba(255, 107, 53, 0.2)';
                        }
                    }}
                >
                    <span>📐</span>
                    Format JSON
                </button>
                
                {readOnly && (
                    <span style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-gray)',
                        fontStyle: 'italic'
                    }}>
                        🔒 Read-only mode
                    </span>
                )}
            </div>

            {/* Editor */}
            <div style={{
                flex: 1,
                position: 'relative',
                overflow: 'hidden'
            }}>
                <textarea
                    value={text}
                    onChange={handleChange}
                    spellCheck={false}
                    readOnly={readOnly}
                    style={{
                        width: '100%',
                        height: '100%',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: 'none',
                        color: error ? '#ef4444' : '#ffffff',
                        padding: '1.5rem',
                        fontSize: '0.9rem',
                        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
                        lineHeight: 1.6,
                        resize: 'none',
                        outline: 'none',
                        cursor: readOnly ? 'not-allowed' : 'text',
                        opacity: readOnly ? 0.6 : 1
                    }}
                    placeholder="Enter valid JSON..."
                />
            </div>

            {/* Error Message */}
            {error && (
                <div style={{
                    padding: '1rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderTop: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <span>⚠️</span>
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

export default JsonEditor;

