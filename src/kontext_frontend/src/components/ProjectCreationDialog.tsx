import React, { useState } from 'react';
import { useProjectImport, useServerPairDialog } from '../store/appStore';
import ProjectImportDialog from './ProjectImportDialog';

interface ProjectCreationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBlank: () => void;
}

const ProjectCreationDialog: React.FC<ProjectCreationDialogProps> = ({
  isOpen,
  onClose,
  onCreateBlank
}) => {
  const { openImportDialog } = useProjectImport();
  const { openServerPairSelectionDialog } = useServerPairDialog();
  
  if (!isOpen) return null;

  const handleImportClick = () => {
    openImportDialog();
    onClose(); // Close the choice dialog
  };

  const handleCreateBlankClick = () => {
    // FIXED: Create project data with raw JavaScript values that prepareProjectForCanister expects
    const now = Date.now(); // Use milliseconds - prepareProjectForCanister will convert to nanoseconds
    
    const newProjectData = {
      id: `project_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      status: 'active',
      created: now,
      updated: now,
      lastMessageTime: null, // prepareProjectForCanister will convert null to []
      projectType: {
        name: 'Custom',
        subType: 'React' // This matches the expected structure
      },
      messages: null, // prepareProjectForCanister will convert null to []
      templateId: null, // prepareProjectForCanister will convert null to []
      metadata: null, // prepareProjectForCanister will convert null to []
      name: 'New Project',
      description: 'A new project created with Kontext',
      npmPackages: null, // prepareProjectForCanister will convert null to []
      collaborators: null, // prepareProjectForCanister will convert null to []
      canisters: [], // Required array field - empty but not null
      messageCount: null, // prepareProjectForCanister will convert null to []
      workingCopyBaseVersion: null, // prepareProjectForCanister will convert null to []
      motokoPackages: null, // prepareProjectForCanister will convert null to []
      visibility: 'private'
    };

    // Close this dialog first
    onClose();
    
    // Open the server pair selection dialog with the new project data
    openServerPairSelectionDialog(newProjectData);
  };

  return (
    <>
      {/* FIXED: Higher z-index backdrop to ensure proper coverage of sidebar toggle */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 100001, // FIXED: Higher than import dialog backdrop (99999)
        animation: 'fadeIn 0.2s ease-out'
      }} />
      
      {/* FIXED: Higher z-index container to match the increased backdrop */}
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
        width: '500px',
        zIndex: 100002, // FIXED: Higher than import dialog container (100000)
        animation: 'slideUp 0.3s ease-out'
      }}>
        <div style={{ padding: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
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
              <svg style={{
                width: '32px',
                height: '32px',
                color: '#ffffff'
              }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#ffffff',
              margin: '0 0 0.5rem 0'
            }}>Create New Project</h2>
            <p style={{
              color: 'var(--text-gray)',
              fontSize: '0.9rem'
            }}>Choose how you'd like to start your new project</p>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            {/* Import Project Option */}
            <button
              onClick={handleImportClick}
              style={{
                width: '100%',
                padding: '1.5rem',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.transform = '';
              }}
            >
              <div style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
              }}>
                <svg style={{
                  width: '24px',
                  height: '24px',
                  color: '#ffffff'
                }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  margin: '0 0 0.25rem 0'
                }}>Import Project</h3>
                <p style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-gray)',
                  margin: 0,
                  lineHeight: 1.4
                }}>Upload and restore from a project export file</p>
              </div>
            </button>

            {/* Create Blank Option - FIXED: Now opens server pair dialog */}
            <button
              onClick={handleCreateBlankClick}
              style={{
                width: '100%',
                padding: '1.5rem',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.05)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.transform = '';
              }}
            >
              <div style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, var(--accent-green), #059669)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
              }}>
                <svg style={{
                  width: '24px',
                  height: '24px',
                  color: '#ffffff'
                }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  margin: '0 0 0.25rem 0'
                }}>Create Blank Project</h3>
                <p style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-gray)',
                  margin: 0,
                  lineHeight: 1.4
                }}>Start with an empty project and configure hosting options</p>
              </div>
            </button>
          </div>
        </div>

        <div style={{
          padding: '1.5rem 2rem',
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid var(--border-color)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={onClose}
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
        </div>
      </div>

      {/* Import Dialog - This will be rendered globally when openImportDialog() is called */}
      <ProjectImportDialog />

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
      `}</style>
    </>
  );
};

export default ProjectCreationDialog;