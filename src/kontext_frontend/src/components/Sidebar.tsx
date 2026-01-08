import React, { useState, useCallback, useMemo } from 'react';
import { Project } from '../types';
import { useAppStore, useServerPairDialog, useProjectImport } from '../store/appStore';
import { Plus, Edit3, Trash2, X } from 'lucide-react';
import { VersionBadge } from './VersionBadge';

interface SidebarProps {
    projects: Project[];
    activeProject: string;
    searchQuery: string;
    sidebarOpen: boolean;
    isMobile: boolean;
    onSetSearchQuery: (query: string) => void;
    onSelectProject: (project: Project) => void;
    onCreateNewProject: () => void;
    onSetSidebarOpen: (open: boolean) => void;
    onDeleteProject?: (projectId: string) => void;
    onUpdateProject?: (project: Project) => void;
    isDeleting?: boolean;
    style?: React.CSSProperties;
    // New props for sidebar state management
    isCollapsed?: boolean;
}

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
    isDangerous?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
    isLoading = false,
    isDangerous = false
}) => {
    if (!isOpen) return null;

    return (
        <>
            <div
                onClick={onCancel}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 9000,
                    animation: 'fadeIn 0.2s ease-out'
                }}
            />
            <div style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'linear-gradient(135deg, var(--secondary-black), var(--primary-black))',
                border: `1px solid ${isDangerous ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)'}`,
                borderRadius: '16px',
                padding: '2rem',
                maxWidth: '400px',
                width: '90%',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                animation: 'slideUp 0.3s ease-out',
                zIndex: 9001,
                isolation: 'isolate'
            }}>
                {isDangerous && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: 'linear-gradient(90deg, #ef4444, #dc2626)',
                        borderRadius: '16px 16px 0 0',
                        animation: 'pulse 2s ease-in-out infinite'
                    }} />
                )}

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '1.5rem'
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: isDangerous 
                            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.1))'
                            : 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(16, 185, 129, 0.1))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        flexShrink: 0
                    }}>
                        {isDangerous ? '⚠️' : '❓'}
                    </div>
                    <h3 style={{
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        color: '#ffffff',
                        margin: 0
                    }}>
                        {title}
                    </h3>
                </div>

                <p style={{
                    color: 'var(--text-gray)',
                    lineHeight: 1.6,
                    marginBottom: '2rem',
                    fontSize: '0.95rem'
                }}>
                    {message}
                </p>

                <div style={{
                    display: 'flex',
                    gap: '1rem',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-gray)',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '8px',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s ease',
                            fontWeight: 500,
                            fontSize: '0.9rem',
                            opacity: isLoading ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                            if (!isLoading) {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isLoading) {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                            }
                        }}
                    >
                        {cancelText}
                    </button>
                    
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        style={{
                            background: isDangerous 
                                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                                : 'linear-gradient(135deg, var(--accent-orange), #f59e0b)',
                            color: '#ffffff',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s ease',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            opacity: isLoading ? 0.7 : 1,
                            boxShadow: isDangerous 
                                ? '0 4px 15px rgba(239, 68, 68, 0.3)'
                                : '0 4px 15px rgba(255, 107, 53, 0.3)'
                        }}
                        onMouseEnter={(e) => {
                            if (!isLoading) {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = isDangerous 
                                    ? '0 8px 25px rgba(239, 68, 68, 0.4)'
                                    : '0 8px 25px rgba(255, 107, 53, 0.4)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isLoading) {
                                e.currentTarget.style.transform = '';
                                e.currentTarget.style.boxShadow = isDangerous 
                                    ? '0 4px 15px rgba(239, 68, 68, 0.3)'
                                    : '0 4px 15px rgba(255, 107, 53, 0.3)';
                            }
                        }}
                    >
                        {isLoading && (
                            <div style={{
                                width: '16px',
                                height: '16px',
                                border: '2px solid rgba(255, 255, 255, 0.3)',
                                borderTopColor: '#ffffff',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }} />
                        )}
                        {confirmText}
                    </button>
                </div>
            </div>
        </>
    );
};

export const Sidebar: React.FC<SidebarProps> = ({
    projects,
    activeProject,
    searchQuery,
    sidebarOpen,
    isMobile,
    onSetSearchQuery,
    onSelectProject,
    onCreateNewProject,
    onSetSidebarOpen,
    onDeleteProject,
    onUpdateProject,
    isDeleting = false,
    style = {},
    isCollapsed = false
}) => {
    const projectSwitchStatus = useAppStore(state => state.projectSwitchStatus);
    const projectRenameStatus = useAppStore(state => state.projectRenameStatus);
    const getSelectedVersion = useAppStore(state => state.getSelectedVersion);
    const getSelectedVersionString = useAppStore(state => state.getSelectedVersionString);
    
    // NEW: Get reactive projects data directly from store for real-time updates
    const reactiveProjects = useAppStore(state => state.projects);
    
    // NEW: Server pair dialog integration (no longer needed since dialog moved to ChatInterface)
    // const { serverPairDialog, openServerPairSelectionDialog } = useServerPairDialog();
    
    // NEW: Project import integration
    const { openImportDialog } = useProjectImport();
    
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        projectId?: string;
        projectName?: string;
    }>({ isOpen: false });
    
    const [editingProject, setEditingProject] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [hoveredProject, setHoveredProject] = useState<string | null>(null);

    // FIXED: Defensive rendering with deduplication and useMemo for stable list
    const filteredProjects = useMemo(() => {
        // FIXED: Add null/undefined checks for projects
        if (!Array.isArray(reactiveProjects)) {
            console.warn('[Sidebar] Reactive projects is not an array:', reactiveProjects);
            return [];
        }

        // Create a Map to deduplicate projects by ID (latest entry wins)
        const projectsMap = new Map<string, Project>();
        
        // Add all projects to map (this automatically handles deduplication)
        reactiveProjects.forEach(project => {
            // FIXED: Add null checks for individual project objects
            if (!project || typeof project !== 'object' || !project.id) {
                console.warn('[Sidebar] Skipping invalid project:', project);
                return;
            }
            projectsMap.set(project.id, project);
        });
        
        // Convert back to array and apply search filter
        const uniqueProjects = Array.from(projectsMap.values());
        
        return uniqueProjects.filter(project => {
            // FIXED: Add defensive null checks for searchable properties
            if (!project || typeof project !== 'object') {
                return false;
            }

            const title = project.title || project.name || '';
            const preview = project.preview || project.description || '';
            
            try {
                return (
                    title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    preview.toLowerCase().includes(searchQuery.toLowerCase())
                );
            } catch (error) {
                console.warn('[Sidebar] Error filtering project:', project, error);
                return false;
            }
        });
    }, [reactiveProjects, searchQuery]);

    // FIXED: Stable recent projects with deduplication
    const recentProjects = useMemo(() => {
        return filteredProjects.filter(p => !p.isTemplate);
    }, [filteredProjects]);

    const handleDeleteClick = (e: React.MouseEvent, project: Project) => {
        e.stopPropagation();
        setConfirmModal({
            isOpen: true,
            projectId: project.id,
            projectName: project.title || project.name || 'Unnamed Project'
        });
    };

    const handleConfirmDelete = () => {
        if (confirmModal.projectId && onDeleteProject) {
            onDeleteProject(confirmModal.projectId);
            setConfirmModal({ isOpen: false });
        }
    };

    const handleCancelDelete = () => {
        setConfirmModal({ isOpen: false });
    };

    const handleEditClick = (e: React.MouseEvent, project: Project) => {
        e.stopPropagation();
        setEditingProject(project.id);
        setEditingTitle(project.title || project.name || '');
    };

    const handleSaveEdit = (project: Project) => {
        if (editingTitle.trim() && editingTitle !== (project.title || project.name) && onUpdateProject) {
            const updatedProject = {
                ...project,
                title: editingTitle.trim(),
                name: editingTitle.trim()
            };
            onUpdateProject(updatedProject);
        }
        setEditingProject(null);
        setEditingTitle('');
    };

    const handleCancelEdit = () => {
        setEditingProject(null);
        setEditingTitle('');
    };

    const handleKeyDown = (e: React.KeyboardEvent, project: Project) => {
        if (e.key === 'Enter') {
            handleSaveEdit(project);
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };

    const handleProjectClick = async (project: Project) => {
        if (editingProject || !project || !project.id) {
            return;
        }

        if (isMobile && navigator.vibrate) {
            navigator.vibrate(50);
        }

        try {
            await onSelectProject(project);  
        } catch (error) {
            console.error('Project selection failed:', error);
        }
    };

    const sidebarWidth = isMobile ? '100vw' : (isCollapsed ? '80px' : '320px');

    // Helper function to safely get project display name
    const getProjectDisplayName = useCallback((project: Project): string => {
        if (!project || typeof project !== 'object') {
            return 'Invalid Project';
        }
        return project.title || project.name || 'Unnamed Project';
    }, []);

    // Helper function to safely get project preview
    const getProjectPreview = useCallback((project: Project): string => {
        if (!project || typeof project !== 'object') {
            return '';
        }
        return project.preview || project.description || '';
    }, []);

    // Helper function to safely get project time
    const getProjectTime = useCallback((project: Project): string => {
        if (!project || typeof project !== 'object') {
            return '';
        }
        return project.time || 'Unknown';
    }, []);

    return (
        <>
            {/* Mobile backdrop */}
            {isMobile && sidebarOpen && (
                <div 
                    onClick={() => onSetSidebarOpen(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 1999,
                        backdropFilter: 'blur(2px)'
                    }}
                />
            )}

            <div 
                className={`sidebar-container ${isMobile ? 'sidebar-mobile' : ''} ${sidebarOpen ? 'open' : ''}`} 
                style={{
                    width: sidebarWidth,
                    maxWidth: isMobile ? '100vw' : (isCollapsed ? '80px' : '320px'),
                    background: 'var(--primary-black)',
                    borderRight: isMobile ? 'none' : '3px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    position: isMobile ? 'fixed' : 'relative',
                    transform: isMobile 
                        ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)')
                        : 'translateX(0)',
                    transition: 'all 0.3s var(--smooth-easing)',
                    zIndex: isMobile ? 2000 : 10,
                    height: isMobile ? '100dvh' : '100vh',
                    maxHeight: isMobile ? '100dvh' : '100vh',
                    top: 0,
                    left: 0,
                    overflow: 'hidden',
                    isolation: 'isolate',
                    ...style
                }}
            >
                {/* Mobile close button */}
                {isMobile && (
                    <button
                        onClick={() => onSetSidebarOpen(false)}
                        style={{
                            position: 'absolute',
                            top: 'max(1rem, env(safe-area-inset-top))',
                            right: '1rem',
                            width: '32px',
                            height: '32px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            zIndex: 1
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        }}
                    >
                        <X size={16} color="var(--text-gray)" />
                    </button>
                )}

                {/* Header - Fixed size */}
                <div style={{
                    padding: isMobile ? '1rem' : (isCollapsed ? '1rem 0.5rem' : '1.5rem'),
                    paddingTop: isMobile ? 'max(1rem, env(safe-area-inset-top))' : (isCollapsed ? '1rem' : '1.5rem'),
                    borderBottom: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    flexShrink: 0
                }}>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem', 
                        marginBottom: (isCollapsed && !isMobile) ? '0' : '1rem',
                        justifyContent: (isCollapsed && !isMobile) ? 'center' : 'flex-start',
                        marginRight: isMobile ? '2rem' : '0'
                    }}>
                        <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                            boxShadow: '0 4px 15px rgba(255, 107, 53, 0.3)',
                            flexShrink: 0
                        }}>
                            <img 
                                src="https://pwi5a-sqaaa-aaaaa-qcfgq-cai.raw.icp0.io/projects/project-mfvtjz8x-hc7uz/KCP_LOGO.png" 
                                alt="Kontext Logo"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    borderRadius: '10px'
                                }}
                            />
                            <div style={{
                                position: 'absolute',
                                top: '-50%',
                                left: '-50%',
                                width: '200%',
                                height: '200%',
                                background: 'linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                                animation: 'logoShine 3s ease-in-out infinite',
                                zIndex: 1,
                                pointerEvents: 'none'
                            }} />
                        </div>
                        {(!isCollapsed || isMobile) && (
                            <div style={{
                                fontSize: '1.6rem',
                                fontWeight: 800,
                                background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}>
                                Kontext
                            </div>
                        )}
                    </div>

                    {/* Search - Only show when expanded or on mobile */}
                    {(!isCollapsed || isMobile) && (
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => onSetSearchQuery(e.target.value)}
                                placeholder="Search projects..."
                                style={{
                                    width: '100%',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    padding: '0.75rem 1rem 0.75rem 2.5rem',
                                    color: '#ffffff',
                                    fontSize: '0.85rem',
                                    transition: 'all 0.3s var(--smooth-easing)',
                                    fontFamily: 'inherit'
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = 'var(--accent-orange)';
                                    e.target.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.1)';
                                    e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = 'var(--border-color)';
                                    e.target.style.boxShadow = '';
                                    e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                                }}
                            />
                            <span style={{
                                position: 'absolute',
                                left: '0.75rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-gray)',
                                fontSize: '1rem'
                            }}>
                                🔍
                            </span>
                        </div>
                    )}
                </div>

                {/* Project List Container with proper scroll constraints */}
                <div style={{ 
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    position: 'relative'
                }}>
                    {/* Scrollable Project List */}
                    <div style={{ 
                        flex: 1,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        padding: isMobile ? '1rem' : (isCollapsed ? '0.5rem' : '0.5rem'),
                        paddingBottom: isMobile ? 'calc(80px + env(safe-area-inset-bottom))' : '80px',
                        WebkitOverflowScrolling: 'touch',
                        height: '100%'
                    }} className="chat-sidebar-scrollbar">
                        
                        {reactiveProjects.length === 0 ? (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                                padding: '2rem 1rem',
                                minHeight: '200px'
                            }}>
                                <div style={{
                                    width: '60px',
                                    height: '60px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.5rem',
                                    color: '#ffffff',
                                    boxShadow: '0 8px 30px rgba(255, 107, 53, 0.3)',
                                    marginBottom: '1rem'
                                }}>
                                    K
                                </div>
                                
                                {(!isCollapsed || isMobile) && (
                                    <>
                                        <div style={{
                                            fontSize: '1.1rem',
                                            fontWeight: 600,
                                            color: '#ffffff',
                                            marginBottom: '0.5rem'
                                        }}>
                                            Welcome to Kontext
                                        </div>
                                        <div style={{
                                            fontSize: '0.85rem',
                                            color: 'var(--text-gray)',
                                            lineHeight: 1.4
                                        }}>
                                            Start by creating your first project
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* General Chat - Special Section Above Projects */}
                                <div style={{
                                    marginBottom: isMobile ? '1rem' : '0.75rem'
                                }}>
                                    {/* General Chat Button */}
                                    {(() => {
                                        const isGeneralChatLoading = projectSwitchStatus.isLoading && projectSwitchStatus.targetProjectId === 'general-chat';
                                        const isCurrentlySelected = activeProject === 'general-chat';
                                        
                                        return (
                                            <div
                                                onClick={() => !isGeneralChatLoading ? onSelectProject({ id: 'general-chat', name: 'General Chat', title: 'General Chat' } as any) : undefined}
                                                onMouseEnter={() => setHoveredProject('general-chat')}
                                                onMouseLeave={() => setHoveredProject(null)}
                                                style={{
                                                    padding: isMobile ? '1rem' : (isCollapsed ? '0.75rem 0.5rem' : '0.75rem'),
                                                    borderRadius: '8px',
                                                    cursor: isGeneralChatLoading ? 'default' : 'pointer',
                                                    transition: 'all 0.2s var(--smooth-easing)',
                                                    position: 'relative',
                                                    border: '1px solid transparent',
                                                    background: isCurrentlySelected ? 
                                                        'rgba(255, 107, 53, 0.1)' : 
                                                        (hoveredProject === 'general-chat' ? 'rgba(255, 255, 255, 0.03)' : 'transparent'),
                                                    borderColor: isCurrentlySelected ? 'rgba(255, 107, 53, 0.3)' : 'transparent',
                                                    opacity: isGeneralChatLoading ? 0.7 : 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.75rem',
                                                    ...(isGeneralChatLoading && isMobile && {
                                                        background: 'linear-gradient(90deg, rgba(255, 107, 53, 0.1), rgba(255, 107, 53, 0.2), rgba(255, 107, 53, 0.1))',
                                                        backgroundSize: '200% 100%',
                                                        animation: 'shimmer 1.5s ease-in-out infinite',
                                                        borderColor: 'rgba(255, 107, 53, 0.4)'
                                                    })
                                                }}
                                            >
                                                {/* Kontext Logo - SAME SIZE as project icons */}
                                                <div style={{
                                                    width: (isCollapsed && !isMobile) ? '40px' : (isMobile ? '48px' : '48px'),
                                                    height: (isCollapsed && !isMobile) ? '40px' : (isMobile ? '48px' : '48px'),
                                                    flexShrink: 0,
                                                    borderRadius: '12px',  // Rounded square like projects
                                                    overflow: 'hidden',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: 'rgba(255, 107, 53, 0.1)',
                                                    border: '1px solid rgba(255, 107, 53, 0.2)',
                                                    position: 'relative'
                                                }}>
                                                    {/* Loading Spinner Overlay */}
                                                    {isGeneralChatLoading && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: 0,
                                                            left: 0,
                                                            right: 0,
                                                            bottom: 0,
                                                            background: 'rgba(0, 0, 0, 0.6)',
                                                            borderRadius: '12px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            zIndex: 1
                                                        }}>
                                                            <div style={{
                                                                width: isMobile ? '24px' : '22px',
                                                                height: isMobile ? '24px' : '22px',
                                                                border: `2px solid rgba(255, 255, 255, 0.3)`,
                                                                borderTopColor: '#ffffff',
                                                                borderRadius: '50%',
                                                                animation: 'spin 1s linear infinite'
                                                            }} />
                                                        </div>
                                                    )}
                                                    <img 
                                                        src="https://pwi5a-sqaaa-aaaaa-qcfgq-cai.raw.icp0.io/projects/project-mfvtjz8x-hc7uz/KCP_LOGO.png"
                                                        alt="Kontext"
                                                        style={{
                                                            width: '85%',
                                                            height: '85%',
                                                            objectFit: 'contain'
                                                        }}
                                                    />
                                                </div>
                                                
                                                {(!isCollapsed || isMobile) && (
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{
                                                            fontWeight: 600,
                                                            color: isCurrentlySelected ? '#ffffff' : 'var(--text-primary)',
                                                            fontSize: isMobile ? '1rem' : '0.9rem',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.5rem'
                                                        }}>
                                                            General Chat
                                                            {/* Badge to indicate it's special */}
                                                            {!isGeneralChatLoading && (
                                                                <span style={{
                                                                    fontSize: '0.65rem',
                                                                    padding: '0.15rem 0.4rem',
                                                                    background: 'rgba(255, 107, 53, 0.15)',
                                                                    border: '1px solid rgba(255, 107, 53, 0.3)',
                                                                    borderRadius: '4px',
                                                                    color: '#ff6b35',
                                                                    fontWeight: 500
                                                                }}>
                                                                    AI Help
                                                                </span>
                                                            )}
                                                            {isGeneralChatLoading && (
                                                                <span style={{
                                                                    fontSize: '0.7rem',
                                                                    color: 'var(--text-gray)'
                                                                }}>
                                                                    Loading...
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{
                                                            fontSize: '0.75rem',
                                                            color: 'var(--text-gray)',
                                                            marginTop: '0.15rem',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap'
                                                        }}>
                                                            Ask questions about Kontext
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    
                                    
                                    {/* Divider Line - Separates General Chat from Projects */}
                                    <div style={{
                                        height: '1px',
                                        background: 'linear-gradient(to right, transparent, rgba(255, 107, 53, 0.3), transparent)',
                                        marginTop: '0.75rem',
                                        marginBottom: isMobile ? '1rem' : '0.75rem'
                                    }} />
                                </div>

                                {/* Recent Projects Section Header */}
                                {(!isCollapsed || isMobile) && recentProjects.length > 0 && (
                                    <div style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        color: 'var(--text-gray)',
                                        marginBottom: '0.5rem',
                                        padding: '0 0.5rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        Recent Projects ({recentProjects.length})
                                    </div>
                                )}
                                
                                {/* Projects List */}
                                <div style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: isMobile ? '0.75rem' : '0.25rem'
                                }}>
                                    {recentProjects.map(project => {
                                    // FIXED: Additional safety check for project object
                                    if (!project || typeof project !== 'object' || !project.id) {
                                        console.warn('[Sidebar] Skipping invalid project:', project);
                                        return null;
                                    }

                                    const isCurrentlySelected = activeProject === project.id;
                                    const isSwitchLoading = projectSwitchStatus.isLoading && projectSwitchStatus.targetProjectId === project.id;
                                    const isRenameLoading = projectRenameStatus.isRenaming && projectRenameStatus.targetProjectId === project.id;
                                    const isLoading = isSwitchLoading || isRenameLoading;
                                    const showLoadingSpinner = isLoading || (isDeleting && confirmModal.projectId === project.id);
                                    const showActions = hoveredProject === project.id && (!isCollapsed || isMobile);
                                    
                                    return (
                                        <div
                                            key={`${project.id}-${project.updated}`} // NEW: Include updated timestamp to force re-render
                                            onClick={() => !editingProject && !isLoading ? handleProjectClick(project) : undefined}
                                            onMouseEnter={() => setHoveredProject(project.id)}
                                            onMouseLeave={() => setHoveredProject(null)}
                                            style={{
                                                padding: isMobile ? '1rem' : (isCollapsed ? '0.75rem 0.5rem' : '0.75rem'),
                                                borderRadius: '8px',
                                                cursor: (editingProject || isLoading) ? 'default' : 'pointer',
                                                transition: 'all 0.2s var(--smooth-easing)',
                                                position: 'relative',
                                                border: '1px solid transparent',
                                                background: isCurrentlySelected ? 
                                                    'rgba(255, 107, 53, 0.1)' : 
                                                    (hoveredProject === project.id ? 'rgba(255, 255, 255, 0.03)' : 'transparent'),
                                                borderColor: isCurrentlySelected ? 'rgba(255, 107, 53, 0.3)' : 'transparent',
                                                opacity: showLoadingSpinner ? 0.7 : 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: isMobile ? '1rem' : (isCollapsed ? '0' : '0.75rem'),
                                                justifyContent: (isCollapsed && !isMobile) ? 'center' : 'flex-start',
                                                minHeight: isMobile ? '60px' : 'auto',
                                                ...(isLoading && isMobile && {
                                                    background: 'linear-gradient(90deg, rgba(255, 107, 53, 0.1), rgba(255, 107, 53, 0.2), rgba(255, 107, 53, 0.1))',
                                                    backgroundSize: '200% 100%',
                                                    animation: 'shimmer 1.5s ease-in-out infinite',
                                                    borderColor: 'rgba(255, 107, 53, 0.4)'
                                                })
                                            }}
                                        >
                                            {/* Active indicator */}
                                            {isCurrentlySelected && (
                                                <div style={{
                                                    position: 'absolute',
                                                    left: 0,
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    width: '3px',
                                                    height: '60%',
                                                    background: 'linear-gradient(180deg, var(--accent-orange), var(--accent-green))',
                                                    borderRadius: '0 2px 2px 0'
                                                }} />
                                            )}

                                            {/* Loading indicator bar for mobile */}
                                            {isLoading && isMobile && (
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: 0,
                                                    left: 0,
                                                    right: 0,
                                                    height: '2px',
                                                    background: 'linear-gradient(90deg, transparent, var(--accent-orange), transparent)',
                                                    backgroundSize: '200% 100%',
                                                    animation: 'loadingBar 1s ease-in-out infinite',
                                                    borderRadius: '0 0 8px 8px'
                                                }} />
                                            )}

                                            {/* Project Icon - ROUNDED SQUARE */}
                                            <div
                                                style={{
                                                    width: (isCollapsed && !isMobile) ? '40px' : (isMobile ? '48px' : '48px'),
                                                    height: (isCollapsed && !isMobile) ? '40px' : (isMobile ? '48px' : '48px'),
                                                    borderRadius: '12px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: (isCollapsed && !isMobile) ? '1.4rem' : (isMobile ? '1.6rem' : '1.5rem'),
                                                    color: '#ffffff',
                                                    fontWeight: 600,
                                                    position: 'relative',
                                                    transition: 'all 0.3s var(--smooth-easing)',
                                                    flexShrink: 0,
                                                    background: (() => {
                                                        const index = recentProjects.findIndex(p => p.id === project.id);
                                                        const backgrounds = [
                                                            'linear-gradient(135deg, #10b981, #059669)',
                                                            'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                                            'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                                            'linear-gradient(135deg, #f59e0b, #d97706)',
                                                            'linear-gradient(135deg, #ef4444, #dc2626)',
                                                            'linear-gradient(135deg, #06b6d4, #0891b2)',
                                                        ];
                                                        return backgrounds[index % backgrounds.length];
                                                    })(),
                                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 2px rgba(255, 255, 255, 0.1)',
                                                    textShadow: '0 1px 3px rgba(0, 0, 0, 0.5), 0 0 8px rgba(0, 0, 0, 0.3)',
                                                    ...(isLoading && isMobile && {
                                                        transform: 'scale(1.05)',
                                                        boxShadow: '0 0 20px rgba(255, 107, 53, 0.4)'
                                                    })
                                                }}
                                            >
                                                {showLoadingSpinner && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        right: 0,
                                                        bottom: 0,
                                                        background: 'rgba(0, 0, 0, 0.6)',
                                                        borderRadius: '12px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        zIndex: 1
                                                    }}>
                                                        <div style={{
                                                            width: isMobile ? '24px' : '22px',
                                                            height: isMobile ? '24px' : '22px',
                                                            border: `2px solid rgba(255, 255, 255, 0.3)`,
                                                            borderTopColor: '#ffffff',
                                                            borderRadius: '50%',
                                                            animation: 'spin 1s linear infinite'
                                                        }} />
                                                    </div>
                                                )}
                                                {project.icon || '📁'}
                                            </div>
                                            
                                            {/* Project Info - Only show when expanded or on mobile */}
                                            {(!isCollapsed || isMobile) && (
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    {editingProject === project.id ? (
                                                        <input
                                                            type="text"
                                                            value={editingTitle}
                                                            onChange={(e) => setEditingTitle(e.target.value)}
                                                            onBlur={() => handleSaveEdit(project)}
                                                            onKeyDown={(e) => handleKeyDown(e, project)}
                                                            autoFocus
                                                            style={{
                                                                background: 'rgba(255, 255, 255, 0.1)',
                                                                border: '1px solid var(--accent-orange)',
                                                                borderRadius: '4px',
                                                                padding: '0.25rem 0.5rem',
                                                                color: '#ffffff',
                                                                fontSize: '0.9rem',
                                                                fontWeight: 600,
                                                                width: '100%',
                                                                fontFamily: 'inherit'
                                                            }}
                                                        />
                                                    ) : (
                                                        <>
                                                            <div style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem',
                                                                marginBottom: '0.25rem'
                                                            }}>
                                                                <div style={{
                                                                    fontSize: '0.9rem',
                                                                    fontWeight: 600,
                                                                    color: isLoading ? 'rgba(255, 255, 255, 0.8)' : '#ffffff',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                    flex: 1,
                                                                    transition: 'color 0.2s ease'
                                                                }}>
                                                                    {getProjectDisplayName(project)}
                                                                </div>
                                                                
                                                                {/* Status indicators */}
                                                                {isLoading && isMobile && (
                                                                    <div style={{
                                                                        fontSize: '0.65rem',
                                                                        background: 'rgba(255, 107, 53, 0.2)',
                                                                        color: 'var(--accent-orange)',
                                                                        padding: '0.15rem 0.3rem',
                                                                        borderRadius: '3px',
                                                                        fontWeight: 600,
                                                                        textTransform: 'uppercase',
                                                                        letterSpacing: '0.3px',
                                                                        flexShrink: 0,
                                                                        animation: 'pulse 1.5s ease-in-out infinite'
                                                                    }}>
                                                                        {isRenameLoading ? 'Renaming' : 'Loading'}
                                                                    </div>
                                                                )}
                                                                
                                                                {isCurrentlySelected && !isLoading && (
                                                                    <>
                                                                        <div style={{
                                                                            fontSize: '0.65rem',
                                                                            background: 'rgba(16, 185, 129, 0.2)',
                                                                            color: 'var(--accent-green)',
                                                                            padding: '0.15rem 0.3rem',
                                                                            borderRadius: '3px',
                                                                            fontWeight: 600,
                                                                            textTransform: 'uppercase',
                                                                            letterSpacing: '0.3px',
                                                                            flexShrink: 0
                                                                        }}>
                                                                            Active
                                                                        </div>
                                                                        
                                                                        {/* Show version badge - shows "SB" if sandbox, or version number if selected */}
                                                                        <VersionBadge 
                                                                            versionString={getSelectedVersionString && getSelectedVersionString()}
                                                                            variant="inline"
                                                                        />
                                                                    </>
                                                                )}
                                                            </div>
                                                            
                                                            <div style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                gap: '0.5rem'
                                                            }}>
                                                                <div style={{
                                                                    fontSize: '0.75rem',
                                                                    color: isLoading ? 'rgba(156, 163, 175, 0.7)' : 'var(--text-gray)',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                    flex: 1,
                                                                    transition: 'color 0.2s ease'
                                                                }}>
                                                                    {isLoading && isMobile ? 
                                                                        (isRenameLoading ? 'Renaming and migrating files...' : 'Switching to project...') :
                                                                        getProjectPreview(project)
                                                                    }
                                                                </div>
                                                                
                                                                <span style={{
                                                                    fontSize: '0.7rem',
                                                                    color: isLoading ? 'rgba(156, 163, 175, 0.7)' : 'var(--text-gray)',
                                                                    flexShrink: 0,
                                                                    transition: 'color 0.2s ease'
                                                                }}>
                                                                    {getProjectTime(project)}
                                                                </span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {/* Action Buttons - Only show when expanded and on hover */}
                                            {showActions && !editingProject && (
                                                <div style={{
                                                    display: 'flex',
                                                    gap: '0.25rem',
                                                    alignItems: 'center',
                                                    opacity: showActions ? 1 : 0,
                                                    transition: 'opacity 0.2s ease',
                                                    flexShrink: 0
                                                }}>
                                                    <button
                                                        onClick={(e) => handleEditClick(e, project)}
                                                        disabled={isLoading}
                                                        style={{
                                                            width: '24px',
                                                            height: '24px',
                                                            background: 'rgba(255, 107, 53, 0.2)',
                                                            border: '1px solid rgba(255, 107, 53, 0.3)',
                                                            borderRadius: '4px',
                                                            cursor: isLoading ? 'not-allowed' : 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.2s ease',
                                                            opacity: isLoading ? 0.5 : 1
                                                        }}
                                                        title="Rename project"
                                                    >
                                                        <Edit3 size={12} color="var(--accent-orange)" />
                                                    </button>
                                                    
                                                    {onDeleteProject && (
                                                        <button
                                                            onClick={(e) => handleDeleteClick(e, project)}
                                                            disabled={isDeleting || isLoading}
                                                            style={{
                                                                width: '24px',
                                                                height: '24px',
                                                                background: 'rgba(239, 68, 68, 0.2)',
                                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                                borderRadius: '4px',
                                                                cursor: (isDeleting || isLoading) ? 'not-allowed' : 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transition: 'all 0.2s ease',
                                                                opacity: (isDeleting || isLoading) ? 0.5 : 1
                                                            }}
                                                            title="Delete project"
                                                        >
                                                            {showLoadingSpinner && confirmModal.projectId === project.id ? (
                                                                <div style={{
                                                                    width: '10px',
                                                                    height: '10px',
                                                                    border: '2px solid rgba(239, 68, 68, 0.3)',
                                                                    borderTopColor: '#ef4444',
                                                                    borderRadius: '50%',
                                                                    animation: 'spin 1s linear infinite'
                                                                }} />
                                                            ) : (
                                                                <Trash2 size={12} color="#ef4444" />
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Edit mode buttons */}
                                            {editingProject === project.id && (!isCollapsed || isMobile) && (
                                                <div style={{
                                                    display: 'flex',
                                                    gap: '0.25rem',
                                                    alignItems: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSaveEdit(project);
                                                        }}
                                                        style={{
                                                            width: '24px',
                                                            height: '24px',
                                                            background: 'rgba(16, 185, 129, 0.2)',
                                                            border: '1px solid rgba(16, 185, 129, 0.3)',
                                                            borderRadius: '4px',
                                                            color: 'var(--accent-green)',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '0.75rem',
                                                            transition: 'all 0.2s ease'
                                                        }}
                                                        title="Save changes"
                                                    >
                                                        ✓
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCancelEdit();
                                                        }}
                                                        style={{
                                                            width: '24px',
                                                            height: '24px',
                                                            background: 'rgba(239, 68, 68, 0.2)',
                                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                                            borderRadius: '4px',
                                                            color: '#ef4444',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '0.75rem',
                                                            transition: 'all 0.2s ease'
                                                        }}
                                                        title="Cancel editing"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            )}

                                            {/* Show project switch error if any */}
                                            {projectSwitchStatus.error && projectSwitchStatus.targetProjectId === project.id && (!isCollapsed || isMobile) && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '100%',
                                                    left: '0.75rem',
                                                    right: '0.75rem',
                                                    marginTop: '0.25rem',
                                                    padding: '0.4rem',
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                                    borderRadius: '4px',
                                                    fontSize: '0.7rem',
                                                    color: '#ef4444',
                                                    zIndex: 1
                                                }}>
                                                    {projectSwitchStatus.error}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }).filter(Boolean)} {/* FIXED: Filter out null entries */}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Fixed New Project Button Container */}
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: isMobile ? '1rem' : (isCollapsed ? '1rem 0.5rem' : '1rem'),
                        paddingBottom: isMobile 
                            ? `max(1rem, calc(1rem + env(safe-area-inset-bottom)))` 
                            : '1rem',
                        borderTop: '1px solid var(--border-color)',
                        background: 'linear-gradient(180deg, transparent 0%, var(--primary-black) 20%, var(--primary-black) 100%)',
                        zIndex: 1
                    }}>
                        <button
                            onClick={onCreateNewProject}
                            style={{
                                width: '100%',
                                height: (isCollapsed && !isMobile) ? '40px' : '44px',
                                background: 'linear-gradient(135deg, var(--accent-orange), #f59e0b)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                transition: 'all 0.3s var(--smooth-easing)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: (isCollapsed && !isMobile) ? '0' : '0.5rem',
                                boxShadow: '0 4px 15px rgba(255, 107, 53, 0.3)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 8px 25px rgba(255, 107, 53, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = '';
                                e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 107, 53, 0.3)';
                            }}
                        >
                            <Plus size={(isCollapsed && !isMobile) ? 20 : 18} />
                            {(!isCollapsed || isMobile) && 'New Project'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title="Delete Project"
                message={`Are you sure you want to delete "${confirmModal.projectName}"? This action cannot be undone and will permanently remove all project files, chat history, and generated code.`}
                confirmText="Delete Project"
                cancelText="Cancel"
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
                isLoading={isDeleting}
                isDangerous={true}
            />

            <style jsx>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                
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
                
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                
                @keyframes loadingBar {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }

                @keyframes logoShine {
                    0%, 100% { transform: rotate(0deg) translate(-50%, -50%); }
                    50% { transform: rotate(180deg) translate(-50%, -50%); }
                }
                
                /* Mobile viewport fix */
                @supports (height: 100dvh) {
                    .sidebar-mobile {
                        height: 100dvh !important;
                        max-height: 100dvh !important;
                    }
                }
                
                /* Fallback for older browsers */
                @media screen and (max-width: 768px) {
                    .sidebar-mobile {
                        height: calc(100vh - env(safe-area-inset-top));
                        max-height: calc(100vh - env(safe-area-inset-top));
                    }
                }
                
                /* Custom scrollbar styles */
                .chat-sidebar-scrollbar {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255, 107, 53, 0.3) transparent;
                }
                
                .chat-sidebar-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                
                .chat-sidebar-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                
                .chat-sidebar-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(255, 107, 53, 0.3);
                    border-radius: 3px;
                    transition: background-color 0.2s ease;
                }
                
                .chat-sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(255, 107, 53, 0.5);
                }
            `}</style>
        </>
    );
};