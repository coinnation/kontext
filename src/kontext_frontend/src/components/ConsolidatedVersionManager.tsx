import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Package, Edit3, Clock, Save, Plus, RotateCcw, Eye, AlertTriangle } from 'lucide-react';
import { userCanisterService } from '../services/UserCanisterService';
import { createPortal } from 'react-dom';
import { CreateVersionModal } from './CreateVersionModal';
import { useAppStore } from '../store/appStore';

interface Version {
  id: string;
  versionString: string;
  description?: string;
  releaseNotes?: string;
  createdAt: number;
  fileCount?: number;
  isLatest?: boolean;
}

interface ConsolidatedVersionManagerProps {
  projectId: string;
  selectedVersion: string | null;
  onVersionChange: (versionId: string | null) => void;
  className?: string;
}

export const ConsolidatedVersionManager: React.FC<ConsolidatedVersionManagerProps> = ({
  projectId,
  selectedVersion,
  onVersionChange,
  className = '',
}) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [restoreConfirmVersion, setRestoreConfirmVersion] = useState<Version | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const setVersionString = useAppStore(state => state.setVersionString);
  const getSelectedVersionString = useAppStore(state => state.getSelectedVersionString);
  const { principal, identity } = useAppStore(state => ({
    principal: state.principal,
    identity: state.identity
  }));

  // Load versions when component mounts, projectId changes, or selectedVersion changes
  useEffect(() => {
    if (projectId) {
      loadVersions();
    }
  }, [projectId]);

  // Also reload when a version is selected to ensure we have the data
  useEffect(() => {
    if (projectId && selectedVersion && versions.length === 0) {
      loadVersions();
    }
  }, [selectedVersion]);

  // Calculate dropdown position when opened
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // Check if click is inside the portal dropdown
        const portalDropdown = document.getElementById('version-manager-portal');
        if (!portalDropdown || !portalDropdown.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const result = await userCanisterService.getProjectVersions(projectId);
      
      if ('ok' in result) {
        // Convert backend version format to frontend format
        const convertedVersions = result.ok.map((v: any) => {
          // Generate version string from semantic version
          const semVer = v.semanticVersion;
          let versionString = `${semVer.major}.${semVer.minor}.${semVer.patch}`;
          if (semVer.prerelease && semVer.prerelease.length > 0) {
            versionString += `-${semVer.prerelease[0]}`;
          }
          if (semVer.build && semVer.build.length > 0) {
            versionString += `+${semVer.build[0]}`;
          }

          return {
            id: v.id,
            versionString,
            description: v.description?.[0],
            releaseNotes: v.releaseNotes?.[0],
            createdAt: Number(v.created), // Backend uses 'created' not 'createdAt'
            fileCount: v.artifactSnapshot ? 1 : 0,
            isLatest: false, // Will be set below
          };
        });

        // Sort by creation date (newest first)
        const sortedVersions = convertedVersions.sort((a, b) => 
          b.createdAt - a.createdAt
        );

        // Mark the latest version
        if (sortedVersions.length > 0) {
          sortedVersions[0].isLatest = true;
        }

        // Cache version strings in the store
        console.log('📦 [ConsolidatedVersionManager] Caching version strings:', sortedVersions.map(v => ({
          id: v.id,
          versionString: v.versionString,
          isLatest: v.isLatest
        })));
        
        sortedVersions.forEach(v => {
          console.log(`💾 [ConsolidatedVersionManager] Caching: ${v.id} -> ${v.versionString}${v.isLatest ? ' (Latest)' : ''}`);
          setVersionString(v.id, v.versionString);
        });

        setVersions(sortedVersions);
        console.log('✅ [ConsolidatedVersionManager] Versions loaded and cached:', sortedVersions.length);
      }
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(Number(timestamp) / 1_000_000); // Convert from nanoseconds
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getCurrentLabel = () => {
    if (!selectedVersion) {
      return (
        <>
          <div style={{
            width: '28px',
            height: '28px',
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: '#ffffff',
            boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
          }}>
            ✏️
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem' }}>
            <div style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#ff6b35',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              lineHeight: 1.2
            }}>
              <span>Sandbox</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255, 107, 53, 0.7)', opacity: 0.9, lineHeight: 1 }}>
              Current
            </div>
          </div>
        </>
      );
    }

    // First try to get version string from cache (more reliable)
    const cachedVersionString = getSelectedVersionString();
    const version = versions.find(v => v.id === selectedVersion);
    const versionString = cachedVersionString || version?.versionString;
    
    if (versionString) {
      return (
        <>
          <div style={{
            width: '28px',
            height: '28px',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: '#ffffff',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
          }}>
            📦
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem' }}>
            <div style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#ff6b35',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              lineHeight: 1.2
            }}>
              <span>{versionString}</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255, 107, 53, 0.7)', opacity: 0.9, lineHeight: 1 }}>
              {version?.isLatest ? 'Latest' : 'Version'}
            </div>
          </div>
        </>
      );
    }

    // If we have a selectedVersion but no data, show loading
    return (
      <>
        <div style={{
          width: '28px',
          height: '28px',
          background: 'linear-gradient(135deg, #6b7280, #4b5563)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.85rem',
          fontWeight: 700,
          color: '#ffffff',
          boxShadow: '0 2px 8px rgba(107, 114, 128, 0.3)',
        }}>
          ⏳
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem' }}>
          <div style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            color: '#ff6b35',
            lineHeight: 1.2
          }}>
            Loading...
          </div>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255, 107, 53, 0.7)', opacity: 0.9, lineHeight: 1 }}>
            Version
          </div>
        </div>
      </>
    );
  };

  const handleVersionSelect = (versionId: string | null) => {
    const version = versionId ? versions.find(v => v.id === versionId) : null;
    console.log('🎯 [ConsolidatedVersionManager] Version selected:', {
      versionId,
      versionString: version?.versionString,
      isLatest: version?.isLatest,
      currentSelectedVersion: selectedVersion
    });
    
    // Verify version exists in cache before selecting
    if (versionId) {
      const cachedString = getSelectedVersionString();
      console.log('🔍 [ConsolidatedVersionManager] Cache lookup result:', {
        versionId,
        cachedString,
        expectedString: version?.versionString,
        match: cachedString === version?.versionString
      });
      
      if (!cachedString && version) {
        console.warn('⚠️ [ConsolidatedVersionManager] Version not in cache, re-caching:', versionId, version.versionString);
        setVersionString(versionId, version.versionString);
      }
    }
    
    onVersionChange(versionId);
    setIsOpen(false);
  };

  const handleCreateVersion = () => {
    setIsOpen(false);
    setIsCreateModalOpen(true);
  };

  const handleVersionCreated = (versionId: string) => {
    console.log('✅ Version created:', versionId);
    loadVersions(); // Reload versions list
    onVersionChange(versionId); // Switch to new version
  };

  const handleRestoreClick = (version: Version, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent version selection
    setRestoreConfirmVersion(version);
    setRestoreError(null);
  };

  const handleRestoreConfirm = async (overwrite: boolean) => {
    if (!restoreConfirmVersion || !principal || !identity) return;

    setIsRestoring(true);
    setRestoreError(null);

    try {
      console.log('🔄 [VersionManager] Restoring version:', restoreConfirmVersion.versionString);
      
      const result = await userCanisterService.promoteVersionToWorkingCopy(
        principal,
        projectId,
        restoreConfirmVersion.id,
        overwrite
      );

      if ('ok' in result) {
        console.log('✅ [VersionManager] Version restored:', result.ok);
        setRestoreConfirmVersion(null);
        setIsOpen(false);
        
        // Switch to sandbox to see the restored files
        onVersionChange(null);
        
        // Show success message (could be improved with a toast)
        alert(`✅ Restored ${restoreConfirmVersion.versionString} to sandbox!`);
      } else {
        const errorMsg = result.err || 'Failed to restore version';
        console.error('❌ [VersionManager] Restore failed:', errorMsg);
        setRestoreError(errorMsg);
      }
    } catch (error) {
      console.error('❌ [VersionManager] Restore error:', error);
      setRestoreError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <>
      <div className={`relative ${className}`} ref={dropdownRef}>
        {/* Selector Button - Unified Kontext Design with Orange Accent */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.3)';
            e.currentTarget.style.background = 'rgba(255, 107, 53, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = isOpen ? '0 4px 12px rgba(255, 107, 53, 0.25)' : '0 2px 8px rgba(255, 107, 53, 0.15)';
            e.currentTarget.style.background = isOpen ? 'rgba(255, 107, 53, 0.15)' : 'rgba(255, 107, 53, 0.1)';
          }}
          style={{
            background: isOpen ? 'rgba(255, 107, 53, 0.15)' : 'rgba(255, 107, 53, 0.1)',
            border: '1px solid rgba(255, 107, 53, 0.3)',
            borderRadius: '12px',
            padding: '0.4rem 0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            color: '#ff6b35',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            backdropFilter: 'blur(10px)',
            fontWeight: '600',
            fontSize: '0.9rem',
            boxShadow: isOpen ? '0 4px 12px rgba(255, 107, 53, 0.25)' : '0 2px 8px rgba(255, 107, 53, 0.15)',
            minWidth: '160px',
            position: 'relative' as const
          }}
        >
          {getCurrentLabel()}
          <div style={{
            fontSize: '0.7rem',
            color: '#ff6b35',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }}>
            ▼
          </div>
        </button>
      </div>

      {/* Portal Dropdown Menu with Backdrop */}
      {isOpen && createPortal(
        <>
          {/* Backdrop - invisible but closes dropdown */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
            }}
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Content */}
          <div
            id="version-manager-portal"
            className="fixed rounded-lg shadow-2xl overflow-hidden"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              minWidth: '320px',
              maxWidth: '400px',
              zIndex: 100000,
              background: '#1a1a1a',
              border: '2px solid rgba(255, 107, 53, 0.3)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 107, 53, 0.2)',
              animation: 'slideDown 0.2s ease-out',
            }}
          >
            {/* Save New Version Button */}
          <button
            onClick={handleCreateVersion}
            className="w-full px-4 py-3 text-left transition-all duration-150 hover:bg-opacity-50 flex items-center gap-3"
            style={{
              background: 'rgba(59, 130, 246, 0.15)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div className="p-1.5 rounded-lg" style={{ background: 'rgba(59, 130, 246, 0.2)' }}>
              <Save className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-blue-400">
                  Save New Version
                </span>
                <Plus className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                Create a snapshot of current state
              </p>
            </div>
          </button>

          {/* Sandbox Option */}
          <button
            onClick={() => handleVersionSelect(null)}
            className="w-full px-4 py-3 text-left transition-all duration-150 hover:bg-opacity-50"
            style={{
              background: !selectedVersion 
                ? 'rgba(249, 115, 22, 0.15)' 
                : 'transparent',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div className="flex items-start gap-3">
              <Edit3 className="w-5 h-5 mt-0.5 text-orange-500" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium" style={{ color: '#ffffff' }}>
                    Sandbox
                  </span>
                  {!selectedVersion && (
                    <span className="text-xs px-2 py-0.5 rounded bg-orange-500 bg-opacity-20 text-orange-400">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-sm mt-1" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                  Unsaved changes and current state
                </p>
              </div>
            </div>
          </button>

          {/* Version List */}
          {loading ? (
            <div className="px-4 py-8 text-center" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
              Loading versions...
            </div>
          ) : versions.length === 0 ? (
            <div className="px-4 py-8 text-center" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No versions saved yet</p>
              <p className="text-xs mt-1">Click "Save New Version" above</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="w-full px-4 py-3 transition-all duration-150"
                  style={{
                    background: selectedVersion === version.id 
                      ? 'rgba(59, 130, 246, 0.15)' 
                      : 'transparent',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <Package className="w-5 h-5 mt-0.5 text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium" style={{ color: '#ffffff' }}>
                          {version.versionString}
                        </span>
                        {version.isLatest && (
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-500 bg-opacity-20 text-blue-400">
                            Latest
                          </span>
                        )}
                      </div>
                      
                      {version.description && (
                        <p 
                          className="text-sm mb-1 truncate" 
                          style={{ color: 'rgba(255, 255, 255, 0.7)' }}
                        >
                          {version.description}
                        </p>
                      )}
                      
                      <div 
                        className="flex items-center gap-3 text-xs mb-2" 
                        style={{ color: 'rgba(255, 255, 255, 0.5)' }}
                      >
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(version.createdAt)}
                        </span>
                        {version.fileCount && version.fileCount > 0 && (
                          <span>
                            {version.fileCount} {version.fileCount === 1 ? 'file' : 'files'}
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleRestoreClick(version, e)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{
                            background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(245, 158, 11, 0.15))',
                            border: '1px solid rgba(255, 107, 53, 0.3)',
                            color: '#ff6b35'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 107, 53, 0.25), rgba(245, 158, 11, 0.25))';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(245, 158, 11, 0.15))';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          <RotateCcw className="w-3 h-3" />
                          Restore
                        </button>
                        
                        <button
                          onClick={() => handleVersionSelect(version.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: 'rgba(255, 255, 255, 0.7)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.color = '#ffffff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                          }}
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </>,
        document.body
      )}

      {/* Create Version Modal - Also uses portal */}
      <CreateVersionModal
        projectId={projectId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onVersionCreated={handleVersionCreated}
      />

      {/* Restore Confirmation Dialog */}
      {restoreConfirmVersion && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100001,
            animation: 'fadeIn 0.2s ease-out',
            padding: '1rem'
          }}
          onClick={() => !isRestoring && setRestoreConfirmVersion(null)}
        >
          <div
            style={{
              background: '#1a1a1a',
              border: '1px solid rgba(255, 107, 53, 0.3)',
              borderRadius: '12px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(255, 107, 53, 0.15)',
              animation: 'modalSlideUp 0.3s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid rgba(255, 107, 53, 0.2)'
            }}>
              <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: '#ff6b35' }}>
                <AlertTriangle className="w-5 h-5" />
                Restore Version {restoreConfirmVersion.versionString}?
              </h3>
              <p className="text-sm mt-2" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                This will restore files from this version to your sandbox
              </p>
            </div>

            {/* Body */}
            <div style={{ padding: '1.5rem' }}>
              {restoreError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  color: '#EF4444',
                  fontSize: '0.875rem'
                }}>
                  {restoreError}
                </div>
              )}

              <p style={{ color: 'rgba(255, 255, 255, 0.9)', marginBottom: '1rem' }}>
                Choose how to restore this version:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  onClick={() => handleRestoreConfirm(true)}
                  disabled={isRestoring}
                  className="px-4 py-3 rounded-lg text-left transition-all"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(245, 158, 11, 0.15))',
                    border: '1px solid rgba(255, 107, 53, 0.3)',
                  }}
                  onMouseEnter={(e) => !isRestoring && (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 107, 53, 0.25), rgba(245, 158, 11, 0.25))')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(245, 158, 11, 0.15))')}
                >
                  <div style={{ fontWeight: '600', color: '#ff6b35', marginBottom: '0.25rem' }}>
                    🔄 Replace All Files
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                    Overwrites your current sandbox completely
                  </div>
                </button>

                <button
                  onClick={() => handleRestoreConfirm(false)}
                  disabled={isRestoring}
                  className="px-4 py-3 rounded-lg text-left transition-all"
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                  onMouseEnter={(e) => !isRestoring && (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)')}
                >
                  <div style={{ fontWeight: '600', color: '#10b981', marginBottom: '0.25rem' }}>
                    ➕ Merge Files
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                    Keeps your changes, only adds missing files
                  </div>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setRestoreConfirmVersion(null)}
                disabled={isRestoring}
                className="px-4 py-2 rounded-lg transition-all"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontWeight: '500'
                }}
                onMouseEnter={(e) => !isRestoring && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
              >
                Cancel
              </button>
            </div>

            {isRestoring && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '12px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <div style={{ color: '#ff6b35', fontWeight: '600' }}>Restoring...</div>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

// Add animations
if (typeof document !== 'undefined') {
  const styleElement = document.getElementById('version-manager-animations');
  if (!styleElement) {
    const style = document.createElement('style');
    style.id = 'version-manager-animations';
    style.textContent = `
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
  }
}

export default ConsolidatedVersionManager;

