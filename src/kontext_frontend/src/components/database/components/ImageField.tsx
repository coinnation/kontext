import React, { useState } from 'react';

interface ImageFieldProps {
    value: string;
    onChange: (value: string) => void;
}

/**
 * An image upload field component for the database interface
 */
export const ImageField: React.FC<ImageFieldProps> = ({ value, onChange }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [previewError, setPreviewError] = useState(false);

    // Handle file selection
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsUploading(true);
            setUploadError(null);

            // Check file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                throw new Error('File size exceeds 5MB limit');
            }

            // Read file as data URL
            const reader = new FileReader();

            const dataUrlPromise = new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error('Failed to read file'));
            });

            reader.readAsDataURL(file);
            const dataUrl = await dataUrlPromise;

            // Pass data URL to parent
            onChange(dataUrl);
            setPreviewError(false);
        } catch (error) {
            console.error('Image upload error:', error);
            setUploadError((error as Error).message);
        } finally {
            setIsUploading(false);
        }
    };

    // Remove current image
    const handleRemoveImage = () => {
        onChange(""); // Use empty string for removed images
        setUploadError(null);
        setPreviewError(false);
    };

    // Handle image load error
    const handleImageError = () => {
        setPreviewError(true);
    };

    // Check if value is empty or only whitespace
    const hasValue = value && value.trim() !== '';

    // Determine if this is a URL or data URL
    const isUrl = hasValue && (value.startsWith('http://') || value.startsWith('https://'));
    const isDataUrl = hasValue && value.startsWith('data:image');

    return (
        <div style={{
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            overflow: 'hidden'
        }}>
            {hasValue && !previewError ? (
                <div style={{
                    position: 'relative'
                }}>
                    <img
                        src={value}
                        alt="Preview"
                        onError={handleImageError}
                        style={{
                            width: '100%',
                            maxWidth: '300px',
                            height: 'auto',
                            maxHeight: '200px',
                            objectFit: 'contain',
                            display: 'block',
                            margin: '0 auto',
                            background: 'rgba(255, 255, 255, 0.05)'
                        }}
                    />

                    <div style={{
                        padding: '1rem',
                        background: 'rgba(0, 0, 0, 0.3)',
                        display: 'flex',
                        justifyContent: 'center'
                    }}>
                        <button
                            type="button"
                            onClick={handleRemoveImage}
                            style={{
                                background: 'rgba(239, 68, 68, 0.8)',
                                border: 'none',
                                borderRadius: '6px',
                                color: '#ffffff',
                                padding: '0.5rem 1rem',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 1)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            🗑️ Remove
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{
                    padding: '2rem',
                    textAlign: 'center'
                }}>
                    {previewError && (
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '6px',
                            padding: '1rem',
                            marginBottom: '1rem'
                        }}>
                            <p style={{
                                color: '#ef4444',
                                fontSize: '0.9rem',
                                margin: '0 0 0.5rem 0'
                            }}>
                                Failed to load image from URL:
                            </p>
                            <p style={{
                                color: 'var(--text-gray)',
                                fontSize: '0.8rem',
                                fontFamily: 'monospace',
                                wordBreak: 'break-all',
                                margin: 0
                            }}>
                                {value}
                            </p>
                        </div>
                    )}

                    <label style={{
                        display: 'block',
                        cursor: isUploading ? 'not-allowed' : 'pointer',
                        opacity: isUploading ? 0.6 : 1,
                        transition: 'opacity 0.2s ease'
                    }}>
                        {isUploading ? (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '1rem'
                            }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    border: '3px solid rgba(255, 107, 53, 0.3)',
                                    borderTop: '3px solid var(--accent-orange)',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }} />
                                <span style={{
                                    color: 'var(--text-gray)',
                                    fontSize: '0.9rem'
                                }}>
                                    Uploading...
                                </span>
                            </div>
                        ) : (
                            <>
                                <div style={{
                                    fontSize: '3rem',
                                    color: 'var(--text-gray)',
                                    marginBottom: '1rem',
                                    opacity: 0.5
                                }}>
                                    📷
                                </div>
                                <div style={{
                                    color: '#ffffff',
                                    fontSize: '1.1rem',
                                    fontWeight: 600,
                                    marginBottom: '0.5rem'
                                }}>
                                    Upload Image
                                </div>
                                <div style={{
                                    color: 'var(--text-gray)',
                                    fontSize: '0.9rem',
                                    marginBottom: '1rem'
                                }}>
                                    Click or drag file here
                                </div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    style={{
                                        position: 'absolute',
                                        width: '1px',
                                        height: '1px',
                                        padding: 0,
                                        margin: '-1px',
                                        overflow: 'hidden',
                                        clip: 'rect(0, 0, 0, 0)',
                                        whiteSpace: 'nowrap',
                                        border: 0
                                    }}
                                />
                            </>
                        )}
                    </label>

                    {uploadError && (
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '6px',
                            padding: '1rem',
                            marginTop: '1rem',
                            color: '#ef4444',
                            fontSize: '0.9rem'
                        }}>
                            {uploadError}
                        </div>
                    )}
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

export default ImageField;