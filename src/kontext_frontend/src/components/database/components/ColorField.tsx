import React, { useState, useRef, useEffect } from 'react';

interface ColorFieldProps {
    value: string;
    onChange: (value: string) => void;
}

/**
 * A color picker field component for the database interface
 */
export const ColorField: React.FC<ColorFieldProps> = ({ value, onChange }) => {
    const [showPicker, setShowPicker] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const [popupPosition, setPopupPosition] = useState({ top: false });
    const pickerRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    // Update the input value when the prop value changes
    useEffect(() => {
        setInputValue(value);
    }, [value]);

    // Calculate position to prevent popup from being cut off
    useEffect(() => {
        if (showPicker && pickerRef.current && popupRef.current) {
            const pickerRect = pickerRef.current.getBoundingClientRect();
            const popupRect = popupRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;

            // Check if popup would be cut off at the bottom
            const bottomSpace = viewportHeight - pickerRect.bottom;
            const needsFlip = bottomSpace < popupRect.height + 10;

            setPopupPosition({ top: needsFlip });
        }
    }, [showPicker]);

    // Close picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setShowPicker(false);
            }
        };

        if (showPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showPicker]);

    // Toggle color picker
    const togglePicker = () => {
        setShowPicker(!showPicker);
    };

    // Handle input change with validation
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInputValue(newValue);

        // Only update the actual color value if it's a valid hex color
        if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(newValue)) {
            onChange(newValue);
        }
    };

    // Handle input blur - format and validate hex code
    const handleInputBlur = () => {
        let formattedValue = inputValue.trim();

        // Add # if missing
        if (formattedValue.charAt(0) !== '#' && formattedValue.length > 0) {
            formattedValue = '#' + formattedValue;
        }

        // Validate hex code
        if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(formattedValue)) {
            // For 3-digit hex, expand to 6 digits
            if (formattedValue.length === 4) {
                const r = formattedValue.charAt(1);
                const g = formattedValue.charAt(2);
                const b = formattedValue.charAt(3);
                formattedValue = `#${r}${r}${g}${g}${b}${b}`;
            }
            onChange(formattedValue);
        } else {
            // Reset to the last valid value
            setInputValue(value);
        }
    };

    // Blue presets first (matching the UI)
    const bluePresets = ["#3366CC", "#4285F4", "#1E88E5", "#0D47A1"];

    // Earth tone presets
    const earthPresets = [
        "#4B5320", "#8B4513", "#291e1d", "#F5ECD6",
        "#685c4d", "#3B2C20", "#A0522D", "#CD853F"
    ];

    return (
        <div style={{ position: 'relative' }} ref={pickerRef}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
            }}>
                <div
                    onClick={togglePicker}
                    style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: value,
                        border: '2px solid var(--border-color)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s ease',
                        flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-orange)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                    }}
                />
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    placeholder="#RRGGBB"
                    style={{
                        flex: 1,
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        color: '#ffffff',
                        padding: '0.75rem',
                        fontSize: '0.9rem',
                        fontFamily: 'monospace'
                    }}
                />
            </div>

            {showPicker && (
                <div
                    ref={popupRef}
                    style={{
                        position: 'absolute',
                        left: 0,
                        zIndex: 1000,
                        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '1rem',
                        minWidth: '280px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
                        backdropFilter: 'blur(20px)',
                        ...(popupPosition.top ? {
                            bottom: '100%',
                            marginBottom: '8px'
                        } : {
                            top: '100%',
                            marginTop: '8px'
                        })
                    }}
                >
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '1rem',
                        paddingBottom: '0.5rem',
                        borderBottom: '1px solid var(--border-color)'
                    }}>
                        <span style={{
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            color: '#ffffff'
                        }}>
                            Select a Color
                        </span>
                        <button
                            onClick={() => setShowPicker(false)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-gray)',
                                fontSize: '1.2rem',
                                cursor: 'pointer',
                                padding: '0.25rem',
                                borderRadius: '4px',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#ffffff';
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-gray)';
                                e.currentTarget.style.background = 'none';
                            }}
                        >
                            ×
                        </button>
                    </div>

                    <input
                        type="color"
                        value={value}
                        onChange={(e) => {
                            onChange(e.target.value);
                            setInputValue(e.target.value);
                        }}
                        style={{
                            width: '100%',
                            height: '60px',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            marginBottom: '1rem'
                        }}
                    />

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '0.5rem',
                        marginBottom: '1rem'
                    }}>
                        {bluePresets.map(color => (
                            <button
                                key={color}
                                onClick={() => {
                                    onChange(color);
                                    setInputValue(color);
                                }}
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    backgroundColor: color,
                                    border: '2px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                title={color}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.1)';
                                    e.currentTarget.style.borderColor = 'var(--accent-orange)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                }}
                            />
                        ))}
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '0.5rem'
                    }}>
                        {earthPresets.map(color => (
                            <button
                                key={color}
                                onClick={() => {
                                    onChange(color);
                                    setInputValue(color);
                                }}
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    backgroundColor: color,
                                    border: '2px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                title={color}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.1)';
                                    e.currentTarget.style.borderColor = 'var(--accent-orange)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ColorField;