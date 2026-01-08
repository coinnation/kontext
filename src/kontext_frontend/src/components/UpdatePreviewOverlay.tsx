import React from 'react';
import { useUpdatePreview } from '../store/appStore';

export const UpdatePreviewOverlay: React.FC = () => {
  const { updatePreview, hideUpdatePreview, applyAllUpdates } = useUpdatePreview();

  if (!updatePreview.isVisible) return null;

  const { pendingUpdates, totalFiles, requestMessage, isApplying, progress } = updatePreview;
  const updateEntries = Object.entries(pendingUpdates);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '2rem'
    }}>
      <div style={{
        backgroundColor: 'var(--secondary-black)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '1.5rem 2rem',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(255, 107, 53, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{
              margin: '0 0 0.5rem 0',
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              🔧 Code Updates Ready
              <span style={{
                fontSize: '0.9rem',
                backgroundColor: 'var(--accent-orange)',
                color: '#ffffff',
                padding: '0.25rem 0.75rem',
                borderRadius: '12px',
                fontWeight: 600
              }}>
                {totalFiles} files
              </span>
            </h2>
            <p style={{
              margin: 0,
              color: 'var(--text-gray)',
              fontSize: '0.95rem'
            }}>
              Review the proposed changes and apply when ready
            </p>
          </div>

          {!isApplying && (
            <button
              onClick={hideUpdatePreview}
              style={{
                width: '32px',
                height: '32px',
                background: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-gray)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
                e.currentTarget.style.borderColor = 'var(--accent-orange)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text-gray)';
              }}
            >
              ⨯
            </button>
          )}
        </div>

        {/* Request Context */}
        <div style={{
          padding: '1rem 2rem',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'rgba(16, 185, 129, 0.05)'
        }}>
          <h3 style={{
            margin: '0 0 0.5rem 0',
            fontSize: '0.9rem',
            fontWeight: 600,
            color: 'var(--accent-green)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            📝 Your Request
          </h3>
          <p style={{
            margin: 0,
            color: 'var(--text-light-gray)',
            fontSize: '0.95rem',
            fontStyle: 'italic',
            lineHeight: 1.5,
            padding: '0.75rem',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '8px',
            borderLeft: '3px solid var(--accent-green)'
          }}>
            "{requestMessage}"
          </p>
        </div>

        {/* File Updates List */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '0',
          minHeight: 0
        }}>
          <div style={{
            padding: '1.5rem 2rem 0.5rem',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)'
          }}>
            <h3 style={{
              margin: '0 0 1rem 0',
              fontSize: '1.1rem',
              fontWeight: 600,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              📋 Proposed Changes
              <span style={{
                fontSize: '0.8rem',
                color: 'var(--text-gray)',
                fontWeight: 400
              }}>
                ({totalFiles} files will be updated)
              </span>
            </h3>
          </div>

          <div style={{
            padding: '0 2rem 1rem',
            maxHeight: '400px',
            overflow: 'auto'
          }}>
            {updateEntries.map(([fileName, update], index) => (
              <div
                key={fileName}
                style={{
                  marginBottom: '1rem',
                  padding: '1rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.75rem'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <span style={{
                      width: '24px',
                      height: '24px',
                      backgroundColor: 'var(--accent-orange)',
                      color: '#ffffff',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 600
                    }}>
                      {index + 1}
                    </span>
                    <div>
                      <h4 style={{
                        margin: 0,
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: '#ffffff'
                      }}>
                        {fileName.split('/').pop()}
                      </h4>
                      {fileName.includes('/') && (
                        <p style={{
                          margin: '0.25rem 0 0 0',
                          fontSize: '0.8rem',
                          color: 'var(--text-gray)',
                          fontFamily: 'monospace'
                        }}>
                          {fileName.substring(0, fileName.lastIndexOf('/'))}
                        </p>
                      )}
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    {update.isComplete && (
                      <span style={{
                        fontSize: '0.75rem',
                        backgroundColor: 'var(--accent-green)',
                        color: '#ffffff',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '6px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Complete
                      </span>
                    )}
                    <span style={{
                      fontSize: '1.2rem'
                    }}>
                      {fileName.endsWith('.tsx') ? '⚛️' :
                       fileName.endsWith('.css') ? '🎨' :
                       fileName.endsWith('.mo') ? '🔺' :
                       fileName.endsWith('.json') ? '📋' : '📄'}
                    </span>
                  </div>
                </div>

                <div style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  color: 'var(--accent-green)',
                  fontWeight: 500
                }}>
                  ✓ {update.changeDescription}
                </div>

                {/* Show content preview if it's a new file */}
                {!update.currentContent && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    backgroundColor: 'rgba(255, 107, 53, 0.05)',
                    border: '1px solid rgba(255, 107, 53, 0.2)',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    color: 'var(--accent-orange)'
                  }}>
                    🆕 New file ({update.newContent.split('\n').length} lines)
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Progress Bar (when applying) */}
        {isApplying && progress.percent > 0 && (
          <div style={{
            padding: '1rem 2rem',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'rgba(16, 185, 129, 0.05)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.75rem'
            }}>
              <span style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: 'var(--accent-green)'
              }}>
                {progress.message}
              </span>
              <span style={{
                fontSize: '0.8rem',
                color: 'var(--accent-green)',
                fontWeight: 600
              }}>
                {Math.round(progress.percent)}%
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progress.percent}%`,
                height: '100%',
                backgroundColor: 'var(--accent-green)',
                borderRadius: '3px',
                transition: 'width 0.3s ease'
              }}/>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          padding: '1.5rem 2rem',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <div style={{
            fontSize: '0.85rem',
            color: 'var(--text-gray)'
          }}>
            💡 These changes will be applied to your project files and saved to your canister
          </div>

          <div style={{
            display: 'flex',
            gap: '1rem'
          }}>
            {!isApplying && (
              <button
                onClick={hideUpdatePreview}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-gray)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'var(--text-gray)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                Cancel
              </button>
            )}

            <button
              onClick={applyAllUpdates}
              disabled={isApplying}
              style={{
                padding: '0.75rem 2rem',
                backgroundColor: isApplying ? 'var(--text-gray)' : 'var(--accent-orange)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                cursor: isApplying ? 'not-allowed' : 'pointer',
                fontSize: '0.95rem',
                fontWeight: 600,
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: isApplying ? 'none' : '0 4px 15px rgba(255, 107, 53, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (!isApplying) {
                  e.currentTarget.style.backgroundColor = 'var(--accent-orange-light)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isApplying) {
                  e.currentTarget.style.backgroundColor = 'var(--accent-orange)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {isApplying ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}/>
                  Applying Changes...
                </>
              ) : (
                <>
                  🔧 Apply All Files ({totalFiles})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};