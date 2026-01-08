import React, { useState } from 'react';
import { useProjectImport } from '../store/appStore';

const ProjectImportDialog: React.FC = () => {
  const {
    isImportDialogOpen,
    importStep,
    selectedFile,
    isDragOver,
    validationResult,
    isValidating,
    importProgress,
    isImporting,
    importResult,
    importedProjectData,
    error,
    warnings,
    closeImportDialog,
    setImportStep,
    setDragOver,
    handleFileSelect,
    importProject,
    retryImport,
    startNewImport
  } = useProjectImport();

  const [newProjectName, setNewProjectName] = useState('');

  if (!isImportDialogOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.toLowerCase().endsWith('.zip')) {
        handleFileSelect(file);
      } else {
        alert('Please select a ZIP file');
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleImportConfirm = () => {
    if (importedProjectData) {
      importProject(importedProjectData, newProjectName.trim() || undefined);
    }
  };

  const renderStepContent = () => {
    switch (importStep) {
      case 'choice':
      case 'upload':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mb-4">
                <div style={{
                  width: '64px',
                  height: '64px',
                  background: 'linear-gradient(135deg, var(--accent-orange), #f59e0b)',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  boxShadow: '0 8px 30px rgba(255, 107, 53, 0.3)'
                }}>
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                </div>
              </div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#ffffff',
                margin: '0 0 0.5rem 0'
              }}>Import Project</h2>
              <p style={{
                color: 'var(--text-gray)',
                fontSize: '0.9rem'
              }}>Upload a project export file to restore your project</p>
            </div>

            {/* File Upload Area */}
            <div
              style={{
                border: `2px dashed ${
                  isDragOver
                    ? 'var(--accent-orange)'
                    : selectedFile
                    ? 'var(--accent-green)'
                    : 'var(--border-color)'
                }`,
                borderRadius: '12px',
                padding: '2rem',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                background: isDragOver
                  ? 'rgba(255, 107, 53, 0.05)'
                  : selectedFile
                  ? 'rgba(16, 185, 129, 0.05)'
                  : 'rgba(255, 255, 255, 0.03)'
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isValidating ? (
                <div className="space-y-4">
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      border: '3px solid rgba(255, 107, 53, 0.3)',
                      borderTopColor: 'var(--accent-orange)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                  </div>
                  <p style={{
                    color: 'var(--accent-orange)',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                  }}>Validating project...</p>
                  {importProgress && (
                    <div className="space-y-3">
                      <p style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-gray)'
                      }}>{importProgress.message}</p>
                      <div style={{
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '4px',
                        height: '8px',
                        overflow: 'hidden'
                      }}>
                        <div
                          style={{
                            background: 'linear-gradient(90deg, var(--accent-orange), #f59e0b)',
                            height: '100%',
                            borderRadius: '4px',
                            transition: 'width 0.3s ease',
                            width: `${importProgress.percent}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              ) : selectedFile ? (
                <div className="space-y-4">
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: 'linear-gradient(135deg, var(--accent-green), #059669)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                  }}>
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: '#ffffff',
                      margin: '0 0 0.25rem 0'
                    }}>{selectedFile.name}</p>
                    <p style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-gray)'
                    }}>
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto'
                  }}>
                    <svg className="h-6 w-6 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <label htmlFor="file-upload" style={{ cursor: 'pointer' }}>
                      <span style={{
                        color: 'var(--accent-orange)',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        transition: 'color 0.2s ease'
                      }}>Upload a file</span>
                      <span style={{
                        color: 'var(--text-gray)',
                        fontSize: '0.9rem'
                      }}> or drag and drop</span>
                    </label>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      accept=".zip"
                      style={{ display: 'none' }}
                      onChange={handleFileInputChange}
                    />
                  </div>
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-gray)',
                    opacity: 0.7
                  }}>ZIP files up to 50MB</p>
                </div>
              )}
            </div>

            {warnings.length > 0 && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    background: '#f59e0b',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '0.75rem',
                    flexShrink: 0
                  }}>
                    <span style={{ color: '#ffffff', fontSize: '0.75rem' }}>⚠</span>
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#f59e0b',
                      margin: '0 0 0.5rem 0'
                    }}>Warnings</h3>
                    <div style={{
                      fontSize: '0.8rem',
                      color: '#fbbf24',
                      lineHeight: 1.5
                    }}>
                      {warnings.map((warning, index) => (
                        <div key={index} style={{ marginBottom: '0.25rem' }}>
                          • {warning}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'preview':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mb-4">
                <div style={{
                  width: '64px',
                  height: '64px',
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  boxShadow: '0 8px 30px rgba(59, 130, 246, 0.3)'
                }}>
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              </div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#ffffff',
                margin: '0 0 0.5rem 0'
              }}>Project Preview</h2>
              <p style={{
                color: 'var(--text-gray)',
                fontSize: '0.9rem'
              }}>Review the project details before importing</p>
            </div>

            {importedProjectData && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(8px)',
                borderRadius: '12px',
                padding: '1.5rem',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem'
                }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-gray)',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Original Name</label>
                    <div style={{
                      color: '#ffffff',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      fontSize: '0.9rem'
                    }}>{importedProjectData.project.name}</div>
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-gray)',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Files</label>
                    <div style={{
                      color: '#ffffff',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      fontSize: '0.9rem'
                    }}>{Object.keys(importedProjectData.files).length}</div>
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-gray)',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Project Type</label>
                    <div style={{
                      color: '#ffffff',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      fontSize: '0.9rem'
                    }}>
                      {importedProjectData.project.projectType?.name || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-gray)',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Export Date</label>
                    <div style={{
                      color: '#ffffff',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      fontSize: '0.9rem'
                    }}>
                      {new Date(importedProjectData.metadata.exportDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {importedProjectData.project.description && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-gray)',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Description</label>
                    <div style={{
                      color: '#ffffff',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      fontSize: '0.9rem',
                      lineHeight: 1.5
                    }}>{importedProjectData.project.description}</div>
                  </div>
                )}

                <div>
                  <label htmlFor="new-project-name" style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-gray)',
                    marginBottom: '0.5rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    New Project Name <span style={{ color: 'var(--text-gray)', opacity: 0.7 }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    id="new-project-name"
                    placeholder={`${importedProjectData.project.name} (Imported)`}
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      color: '#ffffff',
                      fontSize: '0.9rem',
                      transition: 'border-color 0.2s ease'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--accent-orange)';
                      e.target.style.outline = 'none';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--border-color)';
                    }}
                  />
                  <p style={{
                    marginTop: '0.5rem',
                    fontSize: '0.75rem',
                    color: 'var(--text-gray)',
                    opacity: 0.7
                  }}>
                    Leave empty to use "{importedProjectData.project.name} (Imported)"
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      case 'importing':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mb-4">
                <div style={{
                  width: '64px',
                  height: '64px',
                  background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  boxShadow: '0 8px 30px rgba(139, 92, 246, 0.3)'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    border: '3px solid rgba(255, 255, 255, 0.3)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                </div>
              </div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#ffffff',
                margin: '0 0 0.5rem 0'
              }}>Importing Project</h2>
              <p style={{
                color: 'var(--text-gray)',
                fontSize: '0.9rem'
              }}>Please wait while your project is being imported</p>
            </div>

            {importProgress && (
              <div className="space-y-4">
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.85rem'
                }}>
                  <span style={{ color: 'var(--text-gray)' }}>{importProgress.message}</span>
                  <span style={{
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                  }}>{importProgress.percent}%</span>
                </div>
                <div style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  height: '12px',
                  overflow: 'hidden'
                }}>
                  <div
                    style={{
                      background: 'linear-gradient(90deg, var(--accent-orange), #8b5cf6)',
                      height: '100%',
                      borderRadius: '6px',
                      transition: 'width 0.3s ease',
                      width: `${importProgress.percent}%`
                    }}
                  ></div>
                </div>
                {importProgress.filesProcessed !== undefined && importProgress.totalFiles !== undefined && (
                  <p style={{
                    textAlign: 'center',
                    fontSize: '0.8rem',
                    color: 'var(--text-gray)'
                  }}>
                    {importProgress.filesProcessed} of {importProgress.totalFiles} files processed
                  </p>
                )}
              </div>
            )}
          </div>
        );

      case 'complete':
        return (
          <div className="space-y-6 text-center">
            <div>
              <div style={{
                width: '64px',
                height: '64px',
                background: 'linear-gradient(135deg, var(--accent-green), #059669)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                boxShadow: '0 8px 30px rgba(16, 185, 129, 0.3)'
              }}>
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#ffffff',
                margin: '0 0 0.5rem 0'
              }}>Import Complete!</h2>
              <p style={{
                color: 'var(--text-gray)',
                fontSize: '0.9rem'
              }}>
                Your project has been successfully imported and is ready to use.
              </p>
            </div>

            {/* Enhanced warning display with failed files list */}
            {(warnings.length > 0 || (importResult && importResult.warnings && importResult.warnings.length > 0)) && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '1rem',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    background: '#f59e0b',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '0.75rem',
                    flexShrink: 0
                  }}>
                    <span style={{ color: '#ffffff', fontSize: '0.75rem' }}>⚠</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#f59e0b',
                      margin: '0 0 0.75rem 0'
                    }}>Import completed with warnings:</h3>
                    <div style={{
                      fontSize: '0.8rem',
                      color: '#fbbf24',
                      lineHeight: 1.5
                    }}>
                      {/* Display general warnings */}
                      {warnings.map((warning, index) => (
                        <div key={index} style={{ marginBottom: '0.25rem' }}>
                          • {warning}
                        </div>
                      ))}
                      
                      {/* Display import result warnings (including failed files) */}
                      {importResult && importResult.warnings && importResult.warnings.map((warning, index) => (
                        <div key={`result-${index}`} style={{ marginBottom: '0.25rem' }}>
                          • {warning}
                        </div>
                      ))}
                      
                      {/* Enhanced: Display specific failed files if available */}
                      {importResult && importResult.warnings && 
                       importResult.warnings.some(w => w.includes('failed to import')) && (
                        <div style={{
                          marginTop: '0.75rem',
                          padding: '0.75rem',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          borderRadius: '6px'
                        }}>
                          <div style={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#ef4444',
                            marginBottom: '0.5rem'
                          }}>Failed Files:</div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#fca5a5',
                            fontFamily: 'monospace'
                          }}>
                            {importResult.warnings
                              .filter(w => w.includes('Failed to upload'))
                              .map((warning, index) => {
                                // Extract filename from warning message
                                const match = warning.match(/Failed to upload file: (.+?)(?:\s|$)/);
                                const filename = match ? match[1] : warning;
                                return (
                                  <div key={`failed-${index}`} style={{ marginBottom: '0.25rem' }}>
                                    ❌ {filename}
                                  </div>
                                );
                              })}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#fbbf24',
                            marginTop: '0.5rem',
                            fontStyle: 'italic'
                          }}>
                            You can manually recreate these files using the chat interface.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'error':
        return (
          <div className="space-y-6 text-center">
            <div>
              <div style={{
                width: '64px',
                height: '64px',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                boxShadow: '0 8px 30px rgba(239, 68, 68, 0.3)'
              }}>
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#ffffff',
                margin: '0 0 0.5rem 0'
              }}>Import Failed</h2>
              <p style={{
                color: 'var(--text-gray)',
                fontSize: '0.9rem',
                marginBottom: '1rem'
              }}>
                There was an error importing your project. Please check the details below and try again.
              </p>
              
              {error && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  padding: '1rem',
                  textAlign: 'left'
                }}>
                  <h3 style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#ef4444',
                    margin: '0 0 0.5rem 0'
                  }}>Error Details:</h3>
                  <p style={{
                    fontSize: '0.8rem',
                    color: '#fca5a5',
                    lineHeight: 1.5,
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    margin: 0
                  }}>{error}</p>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderFooter = () => {
    switch (importStep) {
      case 'choice':
      case 'upload':
        return (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem'
          }}>
            <button
              onClick={closeImportDialog}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-gray)',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
            >
              Cancel
            </button>
          </div>
        );

      case 'preview':
        return (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <button
              onClick={() => setImportStep('upload')}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-gray)',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
            >
              ← Back
            </button>
            <div style={{
              display: 'flex',
              gap: '0.75rem'
            }}>
              <button
                onClick={closeImportDialog}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-gray)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleImportConfirm}
                style={{
                  padding: '0.75rem 2rem',
                  background: 'linear-gradient(135deg, var(--accent-orange), #f59e0b)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 15px rgba(255, 107, 53, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 107, 53, 0.3)';
                }}
              >
                Import Project
              </button>
            </div>
          </div>
        );

      case 'importing':
        return (
          <div style={{
            display: 'flex',
            justifyContent: 'center'
          }}>
            <button
              onClick={closeImportDialog}
              disabled={isImporting}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-gray)',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: 'not-allowed',
                opacity: 0.5
              }}
            >
              Please wait...
            </button>
          </div>
        );

      case 'complete':
        return (
          <div style={{
            display: 'flex',
            justifyContent: 'center'
          }}>
            <button
              onClick={closeImportDialog}
              style={{
                padding: '0.75rem 2rem',
                background: 'linear-gradient(135deg, var(--accent-green), #059669)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.3)';
              }}
            >
              Close
            </button>
          </div>
        );

      case 'error':
        return (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem'
          }}>
            <button
              onClick={closeImportDialog}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-gray)',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
            >
              Close
            </button>
            <button
              onClick={() => startNewImport()}
              style={{
                padding: '0.75rem 2rem',
                background: 'linear-gradient(135deg, var(--accent-orange), #f59e0b)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 15px rgba(255, 107, 53, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 107, 53, 0.3)';
              }}
            >
              Try Again
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        animation: 'fadeIn 0.2s ease-out'
      }} />

      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'linear-gradient(135deg, var(--secondary-black), var(--primary-black))',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        maxWidth: '90vw',
        width: '600px',
        maxHeight: '90vh',
        overflow: 'hidden',
        zIndex: 100000,
        animation: 'slideUp 0.3s ease-out'
      }}>
        <div style={{
          padding: '2rem',
          maxHeight: 'calc(90vh - 80px)',
          overflowY: 'auto'
        }}>
          {renderStepContent()}
        </div>
        
        <div style={{
          padding: '1.5rem 2rem',
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid var(--border-color)'
        }}>
          {renderFooter()}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { 
            opacity: 0; 
            transform: translate(-50%, -40%) scale(0.95); 
          }
          to { 
            opacity: 1; 
            transform: translate(-50%, -50%) scale(1); 
          }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default ProjectImportDialog;