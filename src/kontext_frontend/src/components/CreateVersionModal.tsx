import React, { useState, useEffect } from 'react';
import { X, Package, AlertCircle, Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { userCanisterService } from '../services/UserCanisterService';

interface CreateVersionModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onVersionCreated: (versionId: string) => void;
}

export const CreateVersionModal: React.FC<CreateVersionModalProps> = ({
  projectId,
  isOpen,
  onClose,
  onVersionCreated,
}) => {
  const [major, setMajor] = useState('1');
  const [minor, setMinor] = useState('0');
  const [patch, setPatch] = useState('0');
  const [description, setDescription] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [deployAfterCreate, setDeployAfterCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedVersion, setSuggestedVersion] = useState<string | null>(null);

  // Load latest version to suggest next version
  useEffect(() => {
    if (isOpen && projectId) {
      loadLatestVersion();
    }
  }, [isOpen, projectId]);

  const loadLatestVersion = async () => {
    try {
      const result = await userCanisterService.getLatestProjectVersion(projectId);
      
      if ('ok' in result && result.ok) {
        const version = result.ok;
        // Extract semantic version
        const semVer = version.semanticVersion;
        const maj = String(semVer.major);
        const min = String(semVer.minor);
        const pat = String(semVer.patch);
        
        // Suggest incrementing patch version
        setMajor(maj);
        setMinor(min);
        setPatch(String(Number(pat) + 1));
        setSuggestedVersion(`${maj}.${min}.${Number(pat) + 1}`);
      } else if ('err' in result && result.err.includes('not found')) {
        // No versions exist yet - this shouldn't happen as version 1.0.0 is auto-created,
        // but if it does, suggest 1.0.0
        setMajor('1');
        setMinor('0');
        setPatch('0');
        setSuggestedVersion('1.0.0');
      } else {
        // Default case - assume 1.0.0 exists, suggest 1.0.1
        setMajor('1');
        setMinor('0');
        setPatch('1');
        setSuggestedVersion('1.0.1');
      }
    } catch (error) {
      console.error('Failed to load latest version:', error);
      // Default to 1.0.1 (assuming 1.0.0 was auto-created)
      setMajor('1');
      setMinor('0');
      setPatch('1');
      setSuggestedVersion('1.0.1');
    }
  };

  const handleCreate = async () => {
    setError(null);
    setLoading(true);

    try {
      // Validate version numbers
      const majorNum = parseInt(major);
      const minorNum = parseInt(minor);
      const patchNum = parseInt(patch);

      if (isNaN(majorNum) || isNaN(minorNum) || isNaN(patchNum)) {
        setError('Version numbers must be valid integers');
        setLoading(false);
        return;
      }

      if (majorNum < 0 || minorNum < 0 || patchNum < 0) {
        setError('Version numbers cannot be negative');
        setLoading(false);
        return;
      }

      // Create version
      const semanticVersion = {
        major: majorNum,
        minor: minorNum,
        patch: patchNum,
        prerelease: null,
        build: null,
      };

      const result = await userCanisterService.createProjectVersion(
        projectId,
        semanticVersion,
        description || null,
        releaseNotes || null,
        null // parentVersionId
      );

      if ('ok' in result) {
        console.log('✅ Version created:', result.ok);
        
        // Call success callback
        onVersionCreated(result.ok.id);
        
        // Reset form
        resetForm();
        
        // Close modal
        onClose();
      } else {
        setError(result.err || 'Failed to create version');
      }
    } catch (err: any) {
      console.error('Error creating version:', err);
      setError(err.message || 'An error occurred while creating the version');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDescription('');
    setReleaseNotes('');
    setDeployAfterCreate(false);
    setError(null);
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  const versionString = `v${major}.${minor}.${patch}`;

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(0, 0, 0, 0.85)', 
        backdropFilter: 'blur(12px)',
        zIndex: 100000,
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden"
        style={{
          background: '#1a1a1a',
          border: '1px solid rgba(255, 107, 53, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(255, 107, 53, 0.15)',
          animation: 'modalSlideUp 0.3s ease-out',
          position: 'relative',
          transform: 'translateZ(0)',
          willChange: 'transform, opacity',
          margin: '0 auto',
          maxWidth: '42rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{
            background: '#0a0a0a',
            borderBottom: '1px solid rgba(255, 107, 53, 0.2)',
          }}
        >
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3" style={{ 
              color: '#ff6b35',
            }}>
              📦 Create New Version
            </h2>
            <p className="text-sm mt-1" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
              Save a snapshot of your current project state
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg transition-all"
            style={{ 
              background: 'transparent',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              color: '#EF4444',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-lg"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Version Number */}
          <div>
            <label className="block text-base font-semibold mb-3" style={{ color: '#ff6b35' }}>
              🔢 Version Number *
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--kontext-text-tertiary)' }}>
                    Major
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-center"
                    style={{
                      background: 'var(--kontext-surface-secondary)',
                      border: '1px solid var(--kontext-border)',
                      color: 'var(--kontext-text-primary)',
                    }}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--kontext-text-tertiary)' }}>
                    Minor
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minor}
                    onChange={(e) => setMinor(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-center"
                    style={{
                      background: 'var(--kontext-surface-secondary)',
                      border: '1px solid var(--kontext-border)',
                      color: 'var(--kontext-text-primary)',
                    }}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--kontext-text-tertiary)' }}>
                    Patch
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={patch}
                    onChange={(e) => setPatch(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-center"
                    style={{
                      background: 'var(--kontext-surface-secondary)',
                      border: '1px solid var(--kontext-border)',
                      color: 'var(--kontext-text-primary)',
                    }}
                    disabled={loading}
                  />
                </div>
              </div>
              <div
                className="px-4 py-2 rounded-lg font-mono text-lg"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(245, 158, 11, 0.15))',
                  border: '1px solid rgba(255, 107, 53, 0.3)',
                  color: '#ff6b35',
                  fontWeight: '600'
                }}
              >
                {versionString}
              </div>
            </div>
            {suggestedVersion && (
              <p className="text-xs mt-2" style={{ color: 'var(--kontext-text-tertiary)' }}>
                Suggested next version: {suggestedVersion}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-base font-semibold mb-3" style={{ color: '#ff6b35' }}>
              📝 Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of changes"
              className="w-full px-3 py-2 rounded-lg"
              style={{
                background: 'var(--kontext-surface-secondary)',
                border: '1px solid var(--kontext-border)',
                color: 'var(--kontext-text-primary)',
              }}
              disabled={loading}
            />
          </div>

          {/* Release Notes */}
          <div>
            <label className="block text-base font-semibold mb-3" style={{ color: '#ff6b35' }}>
              📋 Release Notes (optional)
            </label>
            <textarea
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              placeholder="- Added feature X&#10;- Fixed bug Y&#10;- Updated component Z"
              rows={4}
              className="w-full px-3 py-2 rounded-lg resize-none"
              style={{
                background: 'var(--kontext-surface-secondary)',
                border: '1px solid var(--kontext-border)',
                color: 'var(--kontext-text-primary)',
              }}
              disabled={loading}
            />
          </div>

          {/* Deploy After Create */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={deployAfterCreate}
              onChange={(e) => setDeployAfterCreate(e.target.checked)}
              className="w-4 h-4 rounded"
              disabled={loading}
            />
            <span className="text-sm" style={{ color: 'var(--kontext-text-primary)' }}>
              Deploy this version after creating
            </span>
          </label>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            borderTop: '1px solid var(--kontext-border)',
          }}
        >
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg transition-colors"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--kontext-text-primary)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-6 py-2 rounded-lg transition-all flex items-center gap-2"
            style={{
              background: loading 
                ? 'rgba(255, 107, 53, 0.5)' 
                : 'linear-gradient(135deg, #ff6b35, #f59e0b)',
              color: 'white',
              fontWeight: '600',
              boxShadow: loading ? 'none' : '0 4px 15px rgba(255, 107, 53, 0.3)',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 107, 53, 0.3)';
            }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Create Version
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Add animations
if (typeof document !== 'undefined') {
  const styleElement = document.getElementById('create-version-modal-styles');
  if (!styleElement) {
    const style = document.createElement('style');
    style.id = 'create-version-modal-styles';
    style.textContent = `
      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      
      @keyframes modalSlideUp {
        from {
          opacity: 0;
          transform: translateY(20px) scale(0.95) translateZ(0);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1) translateZ(0);
        }
      }
    `;
    document.head.appendChild(style);
  }
}

export default CreateVersionModal;



