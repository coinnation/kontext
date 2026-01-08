import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth, useProjects } from '../store/appStore';
import { userCanisterService } from '../services/UserCanisterService';
import { Project, ProjectMetadata } from '../types';

interface ProjectMetadataEditorProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export function ProjectMetadataEditor({ isOpen, onClose, project }: ProjectMetadataEditorProps) {
  const { identity, userCanisterId } = useAuth();
  const { updateProject: updateProjectInStore } = useProjects();
  
  // Basic Info
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [visibility, setVisibility] = useState(project.visibility || 'Private');
  const [status, setStatus] = useState(project.status || 'active');
  
  // Metadata
  const [category, setCategory] = useState(project.metadata?.category || project.category || '');
  const [priority, setPriority] = useState(project.metadata?.priority || project.priority || 'Medium');
  const [tags, setTags] = useState<string[]>(project.metadata?.tags || project.tags || []);
  const [newTag, setNewTag] = useState('');
  const [notes, setNotes] = useState(project.metadata?.notes || '');
  const [difficultyLevel, setDifficultyLevel] = useState(project.metadata?.difficultyLevel || '');
  const [completionStatus, setCompletionStatus] = useState(project.metadata?.completionStatus || '');
  const [customIcon, setCustomIcon] = useState(project.metadata?.customIcon || project.icon || '');
  const [customColor, setCustomColor] = useState(project.metadata?.customColor || project.customColor || '');
  const [isBookmarked, setIsBookmarked] = useState(project.metadata?.isBookmarked || project.isBookmarked || false);
  
  // UI State
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [renameOption, setRenameOption] = useState<'quick' | 'full'>('quick');
  const [showRenameOptions, setShowRenameOptions] = useState(false);

  const portalRoot = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isStreamingActive, setIsStreamingActive] = useState(false);
  const streamingCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Flicker immunity - check if AI is streaming
  useEffect(() => {
    const checkStreamingState = () => {
      try {
        const streamingState = (window as any).__KONTEXT_STREAMING_STATE__;
        setIsStreamingActive(!!streamingState?.isStreaming);
      } catch (e) {
        setIsStreamingActive(false);
      }
    };

    if (isOpen) {
      checkStreamingState();
      streamingCheckInterval.current = setInterval(checkStreamingState, 100);
    }

    return () => {
      if (streamingCheckInterval.current) {
        clearInterval(streamingCheckInterval.current);
      }
    };
  }, [isOpen]);

  // Ensure portal root exists
  useEffect(() => {
    if (!portalRoot.current) {
      let existingPortalRoot = document.getElementById('project-editor-portal-root') as HTMLDivElement;
      if (!existingPortalRoot) {
        existingPortalRoot = document.createElement('div');
        existingPortalRoot.id = 'project-editor-portal-root';
        existingPortalRoot.style.position = 'fixed';
        existingPortalRoot.style.top = '0';
        existingPortalRoot.style.left = '0';
        existingPortalRoot.style.width = '100%';
        existingPortalRoot.style.height = '100%';
        existingPortalRoot.style.pointerEvents = 'none';
        existingPortalRoot.style.zIndex = '100002';
        document.body.appendChild(existingPortalRoot);
      }
      portalRoot.current = existingPortalRoot;
    }
    if (isOpen) {
      setMounted(true);
    }
  }, [isOpen]);

  // Reset form when project changes
  useEffect(() => {
    if (isOpen) {
      setName(project.name);
      setDescription(project.description || '');
      setVisibility(project.visibility || 'Private');
      setStatus(project.status || 'active');
      setCategory(project.metadata?.category || project.category || '');
      setPriority(project.metadata?.priority || project.priority || 'Medium');
      setTags(project.metadata?.tags || project.tags || []);
      setNotes(project.metadata?.notes || '');
      setDifficultyLevel(project.metadata?.difficultyLevel || '');
      setCompletionStatus(project.metadata?.completionStatus || '');
      setCustomIcon(project.metadata?.customIcon || project.icon || '');
      setCustomColor(project.metadata?.customColor || project.customColor || '');
      setIsBookmarked(project.metadata?.isBookmarked || project.isBookmarked || false);
      setShowRenameOptions(false);
      setMessage(null);
    }
  }, [isOpen, project]);

  // Check if name changed
  useEffect(() => {
    setShowRenameOptions(name !== project.name && name.trim() !== '');
  }, [name, project.name]);

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = async () => {
    if (!userCanisterId || !identity) {
      setMessage({ type: 'error', text: 'Not authenticated' });
      return;
    }

    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Project name is required' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      console.log('💾 [ProjectMetadataEditor] Saving project metadata...');

      // Build updated metadata
      const updatedMetadata: ProjectMetadata = {
        category: category || undefined,
        priority: priority,
        tags: tags,
        notes: notes || undefined,
        difficultyLevel: difficultyLevel || undefined,
        completionStatus: completionStatus || undefined,
        customIcon: customIcon || undefined,
        customColor: customColor || undefined,
        isBookmarked: isBookmarked,
        lastAccessed: project.metadata?.lastAccessed,
        fileCount: project.metadata?.fileCount,
        estimatedSize: project.metadata?.estimatedSize,
        thumbnailUrl: project.metadata?.thumbnailUrl,
        learningObjectives: project.metadata?.learningObjectives,
        externalLinks: project.metadata?.externalLinks
      };

      // Build updated project
      const updatedProject: Project = {
        ...project,
        name: name.trim(),
        description: description.trim() || undefined,
        visibility: visibility,
        status: status,
        metadata: updatedMetadata,
        category: category || undefined,
        priority: priority,
        tags: tags,
        customColor: customColor || undefined,
        isBookmarked: isBookmarked
      };

      // Handle rename if name changed
      if (name !== project.name && renameOption === 'full') {
        console.log('🔄 [ProjectMetadataEditor] Full rename requested - migrating files...');
        setMessage({ type: 'success', text: 'Migrating files... This may take a while.' });

        const migrationResult = await userCanisterService.migrateProjectFiles(
          project.id,
          project.name,
          name.trim(),
          userCanisterId,
          identity,
          (progress) => {
            setMessage({ 
              type: 'success', 
              text: `${progress.phase}: ${progress.message} (${progress.percent}%)` 
            });
          }
        );

        if (!migrationResult.success) {
          throw new Error(migrationResult.error || 'File migration failed');
        }

        console.log('✅ [ProjectMetadataEditor] File migration complete');
      }

      // Save project to backend
      console.log('📤 [ProjectMetadataEditor] Updating project in backend...');
      const result = await userCanisterService.saveProject(updatedProject, userCanisterId, identity);

      if (result.success) {
        console.log('✅ [ProjectMetadataEditor] Project saved successfully');
        
        // Update local store
        updateProjectInStore(updatedProject);
        
        setMessage({ 
          type: 'success', 
          text: showRenameOptions && renameOption === 'full' 
            ? 'Project renamed and all files updated!' 
            : 'Project updated successfully!' 
        });
        
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        throw new Error(result.error || 'Failed to save project');
      }
    } catch (error) {
      console.error('❌ [ProjectMetadataEditor] Error saving project:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to save project' 
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) {
    if (mounted) {
      setTimeout(() => setMounted(false), 300);
    }
    return null;
  }
  
  if (!mounted || !portalRoot.current) {
    if (isOpen && !mounted) {
      setMounted(true);
    }
    return null;
  }

  const dialogContent = (
    <>
      {/* Invisible backdrop for flicker immunity */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'transparent',
          pointerEvents: isStreamingActive ? 'none' : 'auto'
        }}
        onClick={onClose}
      />
      
      {/* Main modal */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
        padding: '1rem',
        pointerEvents: 'auto',
        overflowY: 'auto'
      }} onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}>
        <div style={{
          background: '#1a1a1a',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '20px',
          padding: '2rem',
          maxWidth: '700px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.9), 0 0 50px rgba(59, 130, 246, 0.2)'
        }} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
            paddingBottom: '1rem',
            borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <h2 style={{
              fontSize: 'clamp(1.25rem, 4vw, 1.5rem)',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0
            }}>
              ⚙️ Edit Project
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: '0.9rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              }}
            >
              ✕ Close
            </button>
          </div>

          {/* Message Banner */}
          {message && (
            <div style={{
              background: message.type === 'success' 
                ? 'rgba(34, 197, 94, 0.1)' 
                : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${message.type === 'success' 
                ? 'rgba(34, 197, 94, 0.3)' 
                : 'rgba(239, 68, 68, 0.3)'}`,
              color: message.type === 'success' ? '#22c55e' : '#ef4444',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.5rem',
              fontSize: '0.9rem',
              fontWeight: 500,
              textAlign: 'center'
            }}>
              {message.type === 'success' ? '✅' : '❌'} {message.text}
            </div>
          )}

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Project Name */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#ffffff',
                marginBottom: '0.5rem'
              }}>
                📝 Project Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter project name"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  background: 'rgba(26, 26, 26, 0.8)',
                  color: '#ffffff',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            {/* Rename Options (shown when name changes) */}
            {showRenameOptions && (
              <div style={{
                background: 'rgba(255, 107, 53, 0.1)',
                border: '1px solid rgba(255, 107, 53, 0.3)',
                borderRadius: '12px',
                padding: '1rem'
              }}>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: '#ff6b35',
                  marginBottom: '0.75rem'
                }}>
                  🔄 Rename Option:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    background: renameOption === 'quick' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${renameOption === 'quick' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (renameOption !== 'quick') {
                      e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (renameOption !== 'quick') {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    }
                  }}>
                    <input
                      type="radio"
                      name="renameOption"
                      checked={renameOption === 'quick'}
                      onChange={() => setRenameOption('quick')}
                      style={{
                        marginTop: '0.2rem',
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        accentColor: '#22c55e'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#e5e7eb', fontSize: '0.9rem', fontWeight: 600 }}>
                        🚀 Quick Update (Instant)
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        Updates project name only. File paths keep old name (cosmetic mismatch).
                      </div>
                    </div>
                  </label>
                  
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    background: renameOption === 'full' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${renameOption === 'full' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (renameOption !== 'full') {
                      e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (renameOption !== 'full') {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    }
                  }}>
                    <input
                      type="radio"
                      name="renameOption"
                      checked={renameOption === 'full'}
                      onChange={() => setRenameOption('full')}
                      style={{
                        marginTop: '0.2rem',
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        accentColor: '#22c55e'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#e5e7eb', fontSize: '0.9rem', fontWeight: 600 }}>
                        🐌 Full Rename (Updates Paths)
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        Updates name + all file paths. Takes 10-30s with many files.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#ffffff',
                marginBottom: '0.5rem'
              }}>
                📄 Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter project description"
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  background: 'rgba(26, 26, 26, 0.8)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Two Column Layout */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              {/* Visibility */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  marginBottom: '0.5rem'
                }}>
                  👁️ Visibility
                </label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    background: 'rgba(26, 26, 26, 0.8)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Public">🌐 Public</option>
                  <option value="Private">🔒 Private</option>
                  <option value="Team">👥 Team</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  marginBottom: '0.5rem'
                }}>
                  📊 Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    background: 'rgba(26, 26, 26, 0.8)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="active">✅ Active</option>
                  <option value="development">🚧 Development</option>
                  <option value="archived">📦 Archived</option>
                  <option value="paused">⏸️ Paused</option>
                </select>
              </div>

              {/* Category */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  marginBottom: '0.5rem'
                }}>
                  🏷️ Category
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., Web App"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    background: 'rgba(26, 26, 26, 0.8)',
                    color: '#ffffff',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              {/* Priority */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  marginBottom: '0.5rem'
                }}>
                  ⭐ Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    background: 'rgba(26, 26, 26, 0.8)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Low">🟢 Low</option>
                  <option value="Medium">🟡 Medium</option>
                  <option value="High">🟠 High</option>
                  <option value="Critical">🔴 Critical</option>
                </select>
              </div>

              {/* Difficulty */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  marginBottom: '0.5rem'
                }}>
                  🎯 Difficulty
                </label>
                <select
                  value={difficultyLevel}
                  onChange={(e) => setDifficultyLevel(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    background: 'rgba(26, 26, 26, 0.8)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">None</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>

              {/* Completion */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  marginBottom: '0.5rem'
                }}>
                  ✔️ Completion
                </label>
                <select
                  value={completionStatus}
                  onChange={(e) => setCompletionStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    background: 'rgba(26, 26, 26, 0.8)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">Not Started</option>
                  <option value="0">0%</option>
                  <option value="25">25%</option>
                  <option value="50">50%</option>
                  <option value="75">75%</option>
                  <option value="100">100% Complete</option>
                </select>
              </div>
            </div>

            {/* Custom Icon & Color */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  marginBottom: '0.5rem'
                }}>
                  🎨 Custom Icon (Emoji)
                </label>
                <input
                  type="text"
                  value={customIcon}
                  onChange={(e) => setCustomIcon(e.target.value)}
                  placeholder="e.g., 🚀"
                  maxLength={2}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    background: 'rgba(26, 26, 26, 0.8)',
                    color: '#ffffff',
                    fontSize: '1.5rem',
                    textAlign: 'center'
                  }}
                />
              </div>
              
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  marginBottom: '0.5rem'
                }}>
                  🌈 Custom Color
                </label>
                <input
                  type="color"
                  value={customColor || '#3b82f6'}
                  onChange={(e) => setCustomColor(e.target.value)}
                  style={{
                    width: '100%',
                    height: '46px',
                    padding: '0.25rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    background: 'rgba(26, 26, 26, 0.8)',
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#ffffff',
                marginBottom: '0.5rem'
              }}>
                🏷️ Tags
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Add a tag..."
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    background: 'rgba(26, 26, 26, 0.8)',
                    color: '#ffffff',
                    fontSize: '0.9rem'
                  }}
                />
                <button
                  onClick={handleAddTag}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(34, 197, 94, 0.2)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    color: '#22c55e',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(34, 197, 94, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(34, 197, 94, 0.2)';
                  }}
                >
                  + Add
                </button>
              </div>
              {tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {tags.map((tag, idx) => (
                    <span
                      key={idx}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(59, 130, 246, 0.2)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '20px',
                        color: '#60a5fa',
                        fontSize: '0.85rem',
                        fontWeight: 500
                      }}
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          lineHeight: 1,
                          padding: 0
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#ffffff',
                marginBottom: '0.5rem'
              }}>
                📝 Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes or documentation"
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  background: 'rgba(26, 26, 26, 0.8)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Bookmark */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
            }}>
              <input
                type="checkbox"
                checked={isBookmarked}
                onChange={(e) => setIsBookmarked(e.target.checked)}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer',
                  accentColor: '#3b82f6'
                }}
              />
              <span style={{ color: '#e5e7eb', fontSize: '0.9rem', fontWeight: 500 }}>
                ⭐ Bookmark this project
              </span>
            </label>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: '12px',
                background: saving 
                  ? 'rgba(59, 130, 246, 0.3)' 
                  : 'linear-gradient(135deg, #3b82f6, #60a5fa)',
                border: 'none',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: saving 
                  ? 'none' 
                  : '0 4px 20px rgba(59, 130, 246, 0.4)',
                opacity: saving ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (!saving) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 30px rgba(59, 130, 246, 0.6)';
                }
              }}
              onMouseLeave={(e) => {
                if (!saving) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(59, 130, 246, 0.4)';
                }
              }}
            >
              {saving ? '⏳ Saving...' : '💾 Save Project'}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(dialogContent, portalRoot.current!);
}

