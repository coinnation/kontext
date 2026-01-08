import React, { useState, useEffect } from 'react';
import type { WorkflowTemplate, AgentTemplate, WorkflowNode, WorkflowEdge } from './types';

interface TemplateLibraryProps {
  onSelectTemplate: (template: WorkflowTemplate) => void;
  onClose: () => void;
  isOpen: boolean;
  activeProject?: string;
}

export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  onSelectTemplate,
  onClose,
  isOpen,
  activeProject
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<WorkflowTemplate[]>([]);

  // Load saved templates from localStorage
  useEffect(() => {
    if (activeProject) {
      try {
        const storageKey = `workflow-templates-${activeProject}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const templates = JSON.parse(stored);
          setSavedTemplates(templates);
        }
      } catch (error) {
        console.warn('Failed to load saved templates:', error);
      }
    }
  }, [activeProject, isOpen]); // Reload when dialog opens

  // Only use saved templates (real workflows) - no built-in templates
  const allTemplates = savedTemplates;

  // Filter templates based on search and category
  const filteredTemplates = allTemplates.filter(template => {
    const isSaved = template.id.startsWith('saved-');
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory || isSaved;
    const matchesSearch = !searchTerm || 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (template.tags && template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())));
    
    return matchesCategory && matchesSearch;
  });

  // Delete saved template
  const handleDeleteTemplate = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        if (activeProject) {
          const storageKey = `workflow-templates-${activeProject}`;
          const stored = localStorage.getItem(storageKey);
          if (stored) {
            const templates = JSON.parse(stored);
            const updated = templates.filter((t: WorkflowTemplate) => t.id !== templateId);
            localStorage.setItem(storageKey, JSON.stringify(updated));
            setSavedTemplates(updated);
          }
        }
      } catch (error) {
        console.error('Failed to delete template:', error);
        alert('Failed to delete template');
      }
    }
  };

  // Simplified categories - only "All" since we only show saved templates
  const categories = [
    { id: 'all', name: 'All Saved Templates', icon: '📋' }
  ];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-400 bg-green-900 bg-opacity-30 border-green-500';
      case 'intermediate': return 'text-yellow-400 bg-yellow-900 bg-opacity-30 border-yellow-500';
      case 'advanced': return 'text-red-400 bg-red-900 bg-opacity-30 border-red-500';
      default: return 'text-gray-400 bg-gray-700 border-gray-600';
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(10, 10, 10, 0.9)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        background: 'rgba(17, 17, 17, 0.95)',
        border: '1px solid rgba(255, 107, 53, 0.2)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '1400px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(20px)'
      }}>
        {/* Header */}
        <div style={{
          padding: '2rem 2.5rem 1.5rem',
          borderBottom: '1px solid rgba(255, 107, 53, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div className="flex items-center gap-4">
            <div style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              boxShadow: '0 8px 20px rgba(255, 107, 53, 0.3)'
            }}>
              📋
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white mb-1">Saved Workflow Templates</h2>
              <p className="text-gray-400">Your saved workflows based on real agent configurations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(107, 114, 128, 0.2)',
              border: '1px solid rgba(107, 114, 128, 0.3)',
              borderRadius: '12px',
              color: '#9CA3AF',
              padding: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
              e.currentTarget.style.color = '#EF4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(107, 114, 128, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.3)';
              e.currentTarget.style.color = '#9CA3AF';
            }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search and Filter */}
        <div style={{
          padding: '1.5rem 2.5rem',
          borderBottom: '1px solid rgba(255, 107, 53, 0.1)'
        }}>
          <div className="flex gap-6 mb-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search templates..."
                style={{
                  width: '100%',
                  background: 'rgba(31, 31, 31, 0.8)',
                  border: '1px solid rgba(75, 85, 99, 0.5)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  padding: '1rem 1.25rem',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent-orange)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(255, 107, 53, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(75, 85, 99, 0.5)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Categories */}
          <div className="flex gap-2 flex-wrap">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.25rem',
                  borderRadius: '10px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: selectedCategory === category.id
                    ? 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))'
                    : 'rgba(31, 31, 31, 0.8)',
                  border: selectedCategory === category.id 
                    ? '1px solid rgba(255, 107, 53, 0.3)' 
                    : '1px solid rgba(75, 85, 99, 0.3)',
                  color: selectedCategory === category.id ? '#ffffff' : '#9CA3AF',
                  boxShadow: selectedCategory === category.id ? '0 4px 15px rgba(255, 107, 53, 0.2)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (selectedCategory !== category.id) {
                    e.currentTarget.style.background = 'rgba(75, 85, 99, 0.3)';
                    e.currentTarget.style.color = '#ffffff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCategory !== category.id) {
                    e.currentTarget.style.background = 'rgba(31, 31, 31, 0.8)';
                    e.currentTarget.style.color = '#9CA3AF';
                  }
                }}
              >
                <span className="text-sm">{category.icon}</span>
                <span>{category.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="flex-1 p-6 overflow-auto">
          {filteredTemplates.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredTemplates.map(template => {
                const isSaved = template.id.startsWith('saved-');
                const hasRealAgents = template.nodes.some(node => 
                  node.type === 'agent' && node.data.agentCanisterId && node.data.agentCanisterId.trim() !== ''
                );
                
                return (
                <div key={template.id} style={{
                  background: isSaved 
                    ? 'rgba(16, 185, 129, 0.1)' 
                    : 'rgba(31, 31, 31, 0.8)',
                  border: isSaved 
                    ? '1px solid rgba(16, 185, 129, 0.3)' 
                    : '1px solid rgba(75, 85, 99, 0.3)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                className="group"
                onClick={() => {
                  onSelectTemplate(template);
                  onClose();
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = isSaved 
                    ? 'rgba(16, 185, 129, 0.5)' 
                    : 'rgba(255, 107, 53, 0.5)';
                  e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = isSaved 
                    ? 'rgba(16, 185, 129, 0.3)' 
                    : 'rgba(75, 85, 99, 0.3)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                >
                  {/* Delete button for saved templates */}
                  {isSaved && (
                    <button
                      onClick={(e) => handleDeleteTemplate(template.id, e)}
                      style={{
                        position: 'absolute',
                        top: '0.75rem',
                        right: '0.75rem',
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '6px',
                        color: '#ef4444',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        zIndex: 10
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                      }}
                    >
                      ✕
                    </button>
                  )}

                  {/* Template Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div style={{
                        width: '48px',
                        height: '48px',
                        background: isSaved
                          ? 'linear-gradient(135deg, var(--accent-green), #059669)'
                          : 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        boxShadow: isSaved
                          ? '0 4px 12px rgba(16, 185, 129, 0.3)'
                          : '0 4px 12px rgba(255, 107, 53, 0.3)'
                      }}>
                        {template.nodes.length > 0 ? template.nodes[0].data.icon : '⚙️'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-semibold text-white mb-1 group-hover:text-orange-400 transition-colors">
                            {template.name}
                          </h4>
                          {isSaved && (
                            <span style={{
                              padding: '0.125rem 0.5rem',
                              borderRadius: '8px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              background: 'rgba(16, 185, 129, 0.2)',
                              color: '#10B981',
                              border: '1px solid rgba(16, 185, 129, 0.3)'
                            }}>
                              SAVED
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 capitalize">{template.category}</p>
                      </div>
                    </div>
                    <div style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      textTransform: 'uppercase'
                    }}
                    className={getDifficultyColor(template.difficulty)}
                    >
                      {template.difficulty}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-gray-400 text-sm line-clamp-3 mb-4 leading-relaxed">
                    {template.description}
                  </p>

                  {/* Template Stats */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '1rem',
                    marginBottom: '1rem',
                    padding: '1rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">{template.nodes.length}</div>
                      <div className="text-xs text-gray-400">Agents</div>
                      {hasRealAgents && (
                        <div className="text-xs text-green-400 mt-1">✓ Real IDs</div>
                      )}
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">{template.estimatedTime || 'N/A'}</div>
                      <div className="text-xs text-gray-400">Est. Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-orange-400 capitalize">{template.executionMode}</div>
                      <div className="text-xs text-gray-400">Mode</div>
                    </div>
                  </div>

                  {/* Real Agents Info for saved templates */}
                  {isSaved && hasRealAgents && (
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      marginBottom: '1rem',
                      fontSize: '0.85rem',
                      color: '#10B981'
                    }}>
                      <p className="font-medium mb-1">✓ Contains Real Agents</p>
                      <p className="text-xs opacity-75">
                        {template.nodes.filter((n: any) => n.data.agentCanisterId).length} of {template.nodes.length} agents have configured canister IDs
                      </p>
                    </div>
                  )}

                  {/* Tags */}
                  {template.tags && template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {template.tags.slice(0, 3).map(tag => (
                      <span key={tag} style={{
                        background: 'rgba(75, 85, 99, 0.3)',
                        color: '#9CA3AF',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.7rem',
                        fontWeight: 500
                      }}>
                        {tag}
                      </span>
                    ))}
                    {template.tags.length > 3 && (
                      <span style={{
                        background: 'rgba(255, 107, 53, 0.2)',
                        color: 'var(--accent-orange)',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.7rem',
                        fontWeight: 600
                      }}>
                        +{template.tags.length - 3}
                      </span>
                    )}
                  </div>
                  )}

                  {/* Use Template Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTemplate(template);
                      onClose();
                    }}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      padding: '0.75rem 1rem',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 15px rgba(255, 107, 53, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 25px rgba(255, 107, 53, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 107, 53, 0.3)';
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Use Template
                  </button>
                </div>
                  );
                })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div style={{
                width: '120px',
                height: '120px',
                background: 'rgba(107, 114, 128, 0.1)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 2rem',
                border: '1px solid rgba(107, 114, 128, 0.2)'
              }}>
                <svg className="w-16 h-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">No Saved Templates</h3>
              <p className="text-gray-400 mb-8 leading-relaxed">
                {searchTerm 
                  ? 'No saved templates match your search. Try adjusting your search terms.' 
                  : 'You haven\'t saved any workflow templates yet. Create a workflow with real agents and save it as a template to get started.'}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{
                    background: 'rgba(107, 114, 128, 0.2)',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                    borderRadius: '8px',
                    color: '#9CA3AF',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Clear Search
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1.5rem 2.5rem',
          borderTop: '1px solid rgba(255, 107, 53, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'between'
        }}>
          <div className="flex items-center gap-6">
            <p className="text-gray-400 text-sm">
              {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
            </p>
            <div className="flex items-center gap-2">
              <div style={{
                width: '8px',
                height: '8px',
                background: '#10B981',
                borderRadius: '50%'
              }} />
              <span className="text-xs text-gray-500">Ready to use</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(107, 114, 128, 0.2)',
              border: '1px solid rgba(107, 114, 128, 0.3)',
              borderRadius: '8px',
              color: '#9CA3AF',
              padding: '0.75rem 1.5rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};