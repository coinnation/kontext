import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Package, Edit3, Clock } from 'lucide-react';
import { userCanisterService } from '../services/UserCanisterService';

interface Version {
  id: string;
  versionString: string;
  description?: string;
  releaseNotes?: string;
  createdAt: number;
  fileCount?: number;
  isLatest?: boolean;
}

interface VersionSelectorProps {
  projectId: string;
  selectedVersion: string | null;
  onVersionChange: (versionId: string | null) => void;
  className?: string;
}

export const VersionSelector: React.FC<VersionSelectorProps> = ({
  projectId,
  selectedVersion,
  onVersionChange,
  className = '',
}) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load versions when component mounts or projectId changes
  useEffect(() => {
    if (projectId) {
      loadVersions();
    }
  }, [projectId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
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
        // Sort by creation date (newest first)
        const sortedVersions = result.ok.sort((a: any, b: any) => 
          Number(b.createdAt) - Number(a.createdAt)
        );

        // Mark the latest version
        if (sortedVersions.length > 0) {
          sortedVersions[0].isLatest = true;
        }

        setVersions(sortedVersions.map((v: any) => ({
          id: v.id,
          versionString: v.versionString,
          description: v.description?.[0],
          releaseNotes: v.releaseNotes?.[0],
          createdAt: Number(v.createdAt),
          fileCount: v.artifacts?.length || 0,
          isLatest: v.isLatest,
        })));
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
              color: '#f97316',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              lineHeight: 1.2
            }}>
              <span>Sandbox</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(249, 115, 22, 0.7)', opacity: 0.9, lineHeight: 1 }}>
              Current
            </div>
          </div>
        </>
      );
    }

    const version = versions.find(v => v.id === selectedVersion);
    if (version) {
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
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              lineHeight: 1.2
            }}>
              <span>{version.versionString}</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(59, 130, 246, 0.7)', opacity: 0.9, lineHeight: 1 }}>
              {version.isLatest ? 'Latest' : 'Version'}
            </div>
          </div>
        </>
      );
    }

    return 'Select Version';
  };

  const handleVersionSelect = (versionId: string | null) => {
    onVersionChange(versionId);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: isOpen 
            ? (selectedVersion ? 'rgba(59, 130, 246, 0.15)' : 'rgba(249, 115, 22, 0.15)')
            : (selectedVersion ? 'rgba(59, 130, 246, 0.1)' : 'rgba(249, 115, 22, 0.1)'),
          border: selectedVersion 
            ? '1px solid rgba(59, 130, 246, 0.3)' 
            : '1px solid rgba(249, 115, 22, 0.3)',
          borderRadius: '12px',
          padding: '0.4rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          color: selectedVersion ? '#3b82f6' : '#f97316',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          fontSize: '0.9rem',
          fontWeight: '600',
          minWidth: '160px',
          position: 'relative',
          backdropFilter: 'blur(10px)',
          boxShadow: isOpen 
            ? (selectedVersion ? '0 4px 12px rgba(59, 130, 246, 0.25)' : '0 4px 12px rgba(249, 115, 22, 0.25)')
            : (selectedVersion ? '0 2px 8px rgba(59, 130, 246, 0.15)' : '0 2px 8px rgba(249, 115, 22, 0.15)'),
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.background = selectedVersion ? 'rgba(59, 130, 246, 0.15)' : 'rgba(249, 115, 22, 0.15)';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = selectedVersion ? '0 6px 20px rgba(59, 130, 246, 0.3)' : '0 6px 20px rgba(249, 115, 22, 0.3)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.background = selectedVersion ? 'rgba(59, 130, 246, 0.1)' : 'rgba(249, 115, 22, 0.1)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = selectedVersion ? '0 2px 8px rgba(59, 130, 246, 0.15)' : '0 2px 8px rgba(249, 115, 22, 0.15)';
          }
        }}
      >
        {getCurrentLabel()}
        
        <div style={{
          fontSize: '0.7rem',
          color: selectedVersion ? '#3b82f6' : '#f97316',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease'
        }}>
          ▼
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute top-full mt-2 w-80 rounded-lg shadow-2xl overflow-hidden z-50"
          style={{
            background: 'var(--kontext-surface-primary)',
            border: '1px solid var(--kontext-border)',
          }}
        >
          {/* Sandbox Option */}
          <button
            onClick={() => handleVersionSelect(null)}
            className="w-full px-4 py-3 text-left transition-all duration-150 hover:bg-opacity-50"
            style={{
              background: !selectedVersion 
                ? 'rgba(249, 115, 22, 0.15)' 
                : 'transparent',
              borderBottom: '1px solid var(--kontext-border)',
            }}
          >
            <div className="flex items-start gap-3">
              <Edit3 className="w-5 h-5 mt-0.5 text-orange-500" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium" style={{ color: 'var(--kontext-text-primary)' }}>
                    Sandbox
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-orange-500 bg-opacity-20 text-orange-400">
                    Current
                  </span>
                </div>
                <p className="text-sm mt-1" style={{ color: 'var(--kontext-text-tertiary)' }}>
                  Unsaved changes and current state
                </p>
              </div>
            </div>
          </button>

          {/* Version List */}
          {loading ? (
            <div className="px-4 py-8 text-center" style={{ color: 'var(--kontext-text-tertiary)' }}>
              Loading versions...
            </div>
          ) : versions.length === 0 ? (
            <div className="px-4 py-8 text-center" style={{ color: 'var(--kontext-text-tertiary)' }}>
              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No versions saved yet</p>
              <p className="text-xs mt-1">Click "Save Version" to create your first version</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {versions.map((version) => (
                <button
                  key={version.id}
                  onClick={() => handleVersionSelect(version.id)}
                  className="w-full px-4 py-3 text-left transition-all duration-150 hover:bg-opacity-50"
                  style={{
                    background: selectedVersion === version.id 
                      ? 'rgba(59, 130, 246, 0.15)' 
                      : 'transparent',
                    borderBottom: '1px solid var(--kontext-border)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <Package className="w-5 h-5 mt-0.5 text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium" style={{ color: 'var(--kontext-text-primary)' }}>
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
                          style={{ color: 'var(--kontext-text-secondary)' }}
                        >
                          {version.description}
                        </p>
                      )}
                      
                      <div 
                        className="flex items-center gap-3 text-xs" 
                        style={{ color: 'var(--kontext-text-tertiary)' }}
                      >
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(version.createdAt)}
                        </span>
                        {version.fileCount > 0 && (
                          <span>
                            {version.fileCount} {version.fileCount === 1 ? 'file' : 'files'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VersionSelector;



