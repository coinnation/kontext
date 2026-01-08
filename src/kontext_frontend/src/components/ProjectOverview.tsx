import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { useProjects, useFiles } from '../store/appStore';
import { ClaudeService } from '../claudeService';

interface TechStackBadge {
  name: string;
  color: string;
  icon: string;
  usage: number;
  category: 'frontend' | 'backend' | 'styling' | 'config' | 'deployment';
  fileTypes: string[];
  confidence: number;
}

interface ProjectStats {
  totalFiles: number;
  components: number;
  hooks: number;
  motokoFunctions: number;
  linesOfCode: number;
  filesByType: { [key: string]: number };
  complexity: 'low' | 'medium' | 'high';
  dependencies: { [key: string]: string[] };
  exports: string[];
  imports: { [key: string]: string[] };
}

interface DynamicFunctionalSpec {
  title: string;
  description: string;
  appType: string;
  mainPurpose: string;
  targetUsers: string[];
  coreFeatures: string[];
  userInterface: {
    description: string;
    keyScreens: string[];
    navigation: string;
  };
  dataHandling: {
    whatDataExists: string[];
    howUsersInteract: string[];
  };
  userWorkflow: string[];
  keyCapabilities: string[];
  accessPattern: string;
  isLoading: boolean;
}

interface ArchitecturalDiagram {
  layers: DiagramLayer[];
  connections: DiagramConnection[];
  isLoading: boolean;
  error?: string;
}

interface DiagramLayer {
  id: string;
  name: string;
  type: 'frontend' | 'backend' | 'data' | 'external';
  components: DiagramComponent[];
  color: string;
  icon: string;
}

interface DiagramComponent {
  id: string;
  name: string;
  type: string;
  description: string;
  technologies: string[];
}

interface DiagramConnection {
  from: string;
  to: string;
  type: 'data-flow' | 'api-call' | 'user-interaction';
  label: string;
}

const ArchitecturalDiagramView: React.FC<{ diagram: ArchitecturalDiagram }> = ({ diagram }) => {
  if (diagram.isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem',
        color: 'var(--text-gray)',
        minHeight: '300px'
      }}>
        <div style={{
          animation: 'spin 1s linear infinite',
          fontSize: '2rem',
          marginRight: '1rem'
        }}>
          🏗️
        </div>
        <span>Generating architectural diagram...</span>
      </div>
    );
  }

  if (diagram.error) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--text-gray)',
        minHeight: '300px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.5 }}>⚠️</div>
        <p>Unable to generate architectural diagram at this time.</p>
        <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>
          {diagram.error}
        </p>
      </div>
    );
  }

  if (!diagram.layers || diagram.layers.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--text-gray)',
        minHeight: '300px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.5 }}>🏗️</div>
        <p>Architectural diagram will appear here once your application is analyzed.</p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.02)',
      borderRadius: '12px',
      padding: '2rem',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      minHeight: '400px',
      overflowX: 'auto'
    }}>
      {/* Diagram Layers */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        minWidth: '600px'
      }}>
        {diagram.layers.map((layer, layerIndex) => (
          <div key={layer.id} style={{
            background: `linear-gradient(135deg, ${layer.color}15, ${layer.color}05)`,
            border: `1px solid ${layer.color}30`,
            borderRadius: '16px',
            padding: '1.5rem',
            position: 'relative'
          }}>
            {/* Layer Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                fontSize: '1.5rem',
                background: `${layer.color}20`,
                padding: '0.5rem',
                borderRadius: '10px',
                border: `1px solid ${layer.color}40`
              }}>
                {layer.icon}
              </div>
              <div>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  margin: 0,
                  marginBottom: '0.25rem'
                }}>
                  {layer.name}
                </h3>
                <div style={{
                  fontSize: '0.8rem',
                  color: layer.color,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  {layer.type} Layer
                </div>
              </div>
            </div>

            {/* Layer Components */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem'
            }}>
              {layer.components.map((component) => (
                <div key={component.id} style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '1rem',
                  transition: 'all 0.3s ease'
                }}>
                  <h4 style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: '#ffffff',
                    margin: 0,
                    marginBottom: '0.5rem'
                  }}>
                    {component.name}
                  </h4>
                  <p style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-light-gray)',
                    margin: 0,
                    marginBottom: '0.75rem',
                    lineHeight: 1.4
                  }}>
                    {component.description}
                  </p>
                  {component.technologies.length > 0 && (
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.25rem'
                    }}>
                      {component.technologies.map((tech, techIndex) => (
                        <span key={techIndex} style={{
                          fontSize: '0.7rem',
                          background: `${layer.color}20`,
                          color: layer.color,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: `1px solid ${layer.color}30`,
                          fontWeight: 500
                        }}>
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Connection Arrows */}
            {layerIndex < diagram.layers.length - 1 && (
              <div style={{
                position: 'absolute',
                bottom: '-1rem',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(0, 0, 0, 0.8)',
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                zIndex: 1
              }}>
                <div style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-gray)',
                  fontWeight: 500
                }}>
                  Data Flow
                </div>
                <div style={{
                  color: 'var(--accent-orange)',
                  fontSize: '1rem',
                  animation: 'bounce 2s infinite'
                }}>
                  ↓
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Data Flow Legend */}
      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <h4 style={{
          fontSize: '0.9rem',
          fontWeight: 600,
          color: '#ffffff',
          margin: 0,
          marginBottom: '0.75rem'
        }}>
          Architecture Flow
        </h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
          fontSize: '0.8rem',
          color: 'var(--text-light-gray)'
        }}>
          {diagram.connections.map((connection, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{
                color: connection.type === 'user-interaction' ? 'var(--accent-green)' :
                       connection.type === 'api-call' ? 'var(--accent-orange)' : 'var(--text-gray)'
              }}>
                {connection.type === 'user-interaction' ? '👤' :
                 connection.type === 'api-call' ? '🔗' : '📊'}
              </span>
              <span>{connection.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const renderMarkdown = useCallback((markdown: string) => {
    let html = markdown;
    
    // Clean up any JSON artifacts before processing markdown
    html = html.replace(new RegExp('```json\\s*\\{[\\s\\S]*?\\}\\s*```', 'g'), '');
    html = html.replace(new RegExp('^\\{[\\s\\S]*?\\}\\s*$', 'gm'), '');
    
    // Headers
    html = html.replace(new RegExp('^### (.*$)', 'gim'), '<h3 style="color: #ffffff; font-weight: 700; font-size: 1.25rem; margin: 1.5rem 0 1rem 0; border-bottom: 2px solid var(--accent-orange); padding-bottom: 0.5rem;">$1</h3>');
    html = html.replace(new RegExp('^## (.*$)', 'gim'), '<h2 style="color: #ffffff; font-weight: 800; font-size: 1.5rem; margin: 2rem 0 1rem 0; background: linear-gradient(135deg, var(--accent-orange), var(--accent-green)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">$1</h2>');
    html = html.replace(new RegExp('^# (.*$)', 'gim'), '<h1 style="color: #ffffff; font-weight: 900; font-size: 2rem; margin: 2rem 0 1.5rem 0;">$1</h1>');
    
    // Bold and italic
    html = html.replace(new RegExp('\\*\\*(.*?)\\*\\*', 'g'), '<strong style="color: var(--accent-orange); font-weight: 700;">$1</strong>');
    html = html.replace(new RegExp('\\*(.*?)\\*', 'g'), '<em style="color: var(--accent-green); font-style: italic;">$1</em>');
    
    // Code blocks
    html = html.replace(new RegExp('```(\\w+)?\\n([\\s\\S]*?)```', 'g'), '<pre style="background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin: 1rem 0; overflow-x: auto; font-family: \'JetBrains Mono\', monospace; font-size: 0.9rem; color: var(--text-light-gray);"><code>$2</code></pre>');
    
    // Inline code
    html = html.replace(new RegExp('`([^`]+)`', 'g'), '<code style="background: rgba(255, 107, 53, 0.15); color: var(--accent-orange); padding: 2px 6px; border-radius: 4px; font-family: \'JetBrains Mono\', monospace; font-size: 0.9em;">$1</code>');
    
    // Lists
    html = html.replace(new RegExp('^\\* (.+)$', 'gm'), '<li style="margin: 0.5rem 0; color: var(--text-light-gray);">$1</li>');
    html = html.replace(new RegExp('(<li.*</li>)', 's'), '<ul style="margin: 1rem 0; padding-left: 1.5rem;">$1</ul>');
    
    // Line breaks
    html = html.replace(new RegExp('\\n', 'g'), '<br>');
    
    return html;
  }, []);

  return (
    <div 
      style={{ 
        color: 'var(--text-light-gray)', 
        lineHeight: 1.7,
        fontSize: '1rem'
      }}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
};

export const ProjectOverview: React.FC = () => {
  const { activeProject, getProjectById } = useProjects();
  const { getProjectFiles } = useFiles();
  const [specCollapsed, setSpecCollapsed] = useState(false);
  const [architecturalDiagram, setArchitecturalDiagram] = useState<ArchitecturalDiagram>({
    layers: [],
    connections: [],
    isLoading: false
  });

  // Get current project
  const currentProject = useMemo(() => {
    return activeProject ? getProjectById(activeProject) : null;
  }, [activeProject, getProjectById]);

  // Get project files
  const projectFiles = useMemo(() => {
    return activeProject ? getProjectFiles(activeProject) : {};
  }, [activeProject, getProjectFiles]);

  // Analyze tech stack from files
  const techStack = useMemo((): TechStackBadge[] => {
    const fileExtensions = Object.keys(projectFiles).map(fileName => {
      const ext = fileName.split('.').pop()?.toLowerCase();
      return ext;
    }).filter(Boolean);

    const techMap = new Map<string, TechStackBadge>();

    fileExtensions.forEach(ext => {
      let badge: TechStackBadge | null = null;

      switch (ext) {
        case 'tsx':
        case 'jsx':
          badge = {
            name: 'React',
            color: '#61DAFB',
            icon: '⚛️',
            category: 'frontend',
            fileTypes: ['tsx', 'jsx'],
            usage: 0,
            confidence: 0.9
          };
          break;
        case 'ts':
          badge = {
            name: 'TypeScript',
            color: '#3178C6',
            icon: '📘',
            category: 'frontend',
            fileTypes: ['ts'],
            usage: 0,
            confidence: 0.9
          };
          break;
        case 'mo':
          badge = {
            name: 'Motoko',
            color: '#FF6B35',
            icon: '🔺',
            category: 'backend',
            fileTypes: ['mo'],
            usage: 0,
            confidence: 0.95
          };
          break;
        case 'css':
          badge = {
            name: 'CSS',
            color: '#1572B6',
            icon: '🎨',
            category: 'styling',
            fileTypes: ['css'],
            usage: 0,
            confidence: 0.8
          };
          break;
        case 'json':
          badge = {
            name: 'JSON Config',
            color: '#FFA500',
            icon: '⚙️',
            category: 'config',
            fileTypes: ['json'],
            usage: 0,
            confidence: 0.7
          };
          break;
      }

      if (badge) {
        const existing = techMap.get(badge.name);
        if (existing) {
          existing.usage++;
        } else {
          badge.usage = 1;
          techMap.set(badge.name, badge);
        }
      }
    });

    return Array.from(techMap.values()).sort((a, b) => b.usage - a.usage);
  }, [projectFiles]);

  // Calculate project statistics
  const projectStats = useMemo((): ProjectStats => {
    const files = Object.entries(projectFiles);
    const stats: ProjectStats = {
      totalFiles: files.length,
      components: 0,
      hooks: 0,
      motokoFunctions: 0,
      linesOfCode: 0,
      filesByType: {},
      complexity: 'low',
      dependencies: {},
      exports: [],
      imports: {}
    };

    files.forEach(([fileName, content]) => {
      const ext = fileName.split('.').pop()?.toLowerCase();
      if (ext) {
        stats.filesByType[ext] = (stats.filesByType[ext] || 0) + 1;
      }

      stats.linesOfCode += content.split('\n').length;

      if (fileName.includes('components/') || content.includes('export const') || content.includes('export function')) {
        stats.components++;
      }

      if (content.includes('use') && (ext === 'ts' || ext === 'tsx')) {
        stats.hooks++;
      }

      if (ext === 'mo' && (content.includes('public func') || content.includes('public query'))) {
        stats.motokoFunctions++;
      }
    });

    if (stats.totalFiles > 20 || stats.linesOfCode > 5000) {
      stats.complexity = 'high';
    } else if (stats.totalFiles > 10 || stats.linesOfCode > 2000) {
      stats.complexity = 'medium';
    }

    return stats;
  }, [projectFiles]);

  // Dynamic functional specification based on AI analysis of actual code
  const [dynamicSpec, setDynamicSpec] = useState<DynamicFunctionalSpec>({
    title: '',
    description: '',
    appType: '',
    mainPurpose: '',
    targetUsers: [],
    coreFeatures: [],
    userInterface: {
      description: '',
      keyScreens: [],
      navigation: ''
    },
    dataHandling: {
      whatDataExists: [],
      howUsersInteract: []
    },
    userWorkflow: [],
    keyCapabilities: [],
    accessPattern: '',
    isLoading: true
  });

  // Generate dynamic functional specification using AI analysis
  useEffect(() => {
    if (!currentProject || Object.keys(projectFiles).length === 0) return;

    const generateDynamicSpec = async () => {
      setDynamicSpec(prev => ({ ...prev, isLoading: true }));

      try {
        const claudeService = new ClaudeService();
        
        // Prepare file contents for analysis
        const fileAnalysis = Object.entries(projectFiles)
          .slice(0, 15) // Limit for token budget
          .map(([fileName, content]) => `FILE: ${fileName}\n${content.substring(0, 1500)}...`)
          .join('\n\n---\n\n');

        const analysisPrompt = `Analyze this application code and generate a functional specification. Focus ONLY on what the application actually does based on the code provided.

Project Name: ${currentProject.name}
${currentProject.description ? `Project Description: ${currentProject.description}` : ''}

CODE TO ANALYZE:
${fileAnalysis}

Based on the actual code provided, generate a JSON response with this exact structure (no markdown, no additional text):

{
  "title": "Actual application name from analysis",
  "description": "What this application actually does based on code analysis",
  "appType": "Type of application based on code analysis",
  "mainPurpose": "Primary purpose based on actual functionality found in code",
  "targetUsers": ["Array of who would use this based on features found"],
  "coreFeatures": ["Array of actual features found in the code"],
  "userInterface": {
    "description": "What the UI actually provides based on components found",
    "keyScreens": ["Array of screens/pages found in code"],
    "navigation": "Navigation pattern found in code"
  },
  "dataHandling": {
    "whatDataExists": ["Types of data actually handled in the code"],
    "howUsersInteract": ["How users actually interact with data based on functions found"]
  },
  "userWorkflow": ["Actual user workflow based on code analysis"],
  "keyCapabilities": ["Key things users can actually do based on functions found"],
  "accessPattern": "How users access and use the application based on code"
}

Analyze the ACTUAL code provided. Do not make assumptions. Only describe functionality that exists in the code. If the code shows a simple "Hello World" app, describe it as such. If it shows a complex data management system, describe that. Base everything on real code analysis.`;

        const response = await claudeService.sendStreamingChat(
          [{ role: 'user', content: analysisPrompt }],
          {
            activeFile: 'analysis.json',
            fileContent: '',
            selectedFiles: Object.keys(projectFiles),
            fileContents: projectFiles,
            projectStructure: Object.keys(projectFiles).map(name => ({ name, type: 'file' })),
            projectInfo: {
              id: currentProject.id,
              name: currentProject.name || 'Project',
              type: currentProject.projectType?.name || 'Unknown'
            }
          },
          () => {}
        );

        if (response.content) {
          try {
            // Try to parse JSON response
            const cleanContent = response.content.replace(/```json|```/g, '').trim();
            const specData = JSON.parse(cleanContent);
            
            setDynamicSpec({
              ...specData,
              isLoading: false
            });
          } catch (parseError) {
            console.error('Failed to parse AI spec response:', parseError);
            // Fallback to basic analysis
            setDynamicSpec({
              title: currentProject.name || 'Application',
              description: currentProject.description || 'Web application',
              appType: 'Web Application',
              mainPurpose: 'Application functionality analysis in progress',
              targetUsers: ['Users'],
              coreFeatures: ['Core functionality'],
              userInterface: {
                description: 'User interface components',
                keyScreens: ['Main interface'],
                navigation: 'Navigation system'
              },
              dataHandling: {
                whatDataExists: ['Application data'],
                howUsersInteract: ['User interactions']
              },
              userWorkflow: ['User accesses application', 'User interacts with features'],
              keyCapabilities: ['Application features'],
              accessPattern: 'Standard web application access',
              isLoading: false
            });
          }
        }
      } catch (error) {
        console.error('Failed to generate dynamic spec:', error);
        setDynamicSpec(prev => ({ ...prev, isLoading: false }));
      }
    };

    generateDynamicSpec();
  }, [currentProject, projectFiles]);

  // Generate architectural diagram based on spec and project files
  useEffect(() => {
    if (!currentProject || Object.keys(projectFiles).length === 0 || dynamicSpec.isLoading) return;

    const generateArchitecturalDiagram = async () => {
      setArchitecturalDiagram(prev => ({ ...prev, isLoading: true }));

      try {
        const claudeService = new ClaudeService();

        const diagramPrompt = `Generate an architectural diagram structure based on this application analysis.

Application: ${dynamicSpec.title}
Type: ${dynamicSpec.appType}
Features: ${dynamicSpec.coreFeatures.join(', ')}
Tech Stack: ${techStack.map(t => t.name).join(', ')}

File Structure Analysis:
${Object.keys(projectFiles).slice(0, 20).map(f => `- ${f}`).join('\n')}

Generate a JSON response representing the architectural layers and components:

{
  "layers": [
    {
      "id": "frontend",
      "name": "User Interface Layer",
      "type": "frontend",
      "color": "#61DAFB",
      "icon": "🌐",
      "components": [
        {
          "id": "ui-components",
          "name": "UI Components",
          "type": "component",
          "description": "React components for user interface",
          "technologies": ["React", "TypeScript"]
        }
      ]
    }
  ],
  "connections": [
    {
      "from": "frontend",
      "to": "backend",
      "type": "api-call",
      "label": "API Requests"
    }
  ]
}

Base the architecture on the actual code analysis. Include appropriate layers (frontend, backend, data, external) based on what exists in the codebase. For each component, describe what it actually does based on the files found.`;

        const response = await claudeService.sendStreamingChat(
          [{ role: 'user', content: diagramPrompt }],
          {
            activeFile: 'architecture.json',
            fileContent: '',
            selectedFiles: [],
            fileContents: {},
            projectStructure: [],
            projectInfo: {
              id: currentProject.id,
              name: currentProject.name || 'Project',
              type: dynamicSpec.appType
            }
          },
          () => {}
        );

        if (response.content) {
          try {
            const cleanContent = response.content.replace(/```json|```/g, '').trim();
            const diagramData = JSON.parse(cleanContent);
            
            setArchitecturalDiagram({
              layers: diagramData.layers || [],
              connections: diagramData.connections || [],
              isLoading: false
            });
          } catch (parseError) {
            console.error('Failed to parse diagram response:', parseError);
            
            // Create a basic fallback diagram based on detected tech stack
            const fallbackLayers: DiagramLayer[] = [];
            
            if (techStack.some(t => t.category === 'frontend')) {
              fallbackLayers.push({
                id: 'frontend',
                name: 'User Interface Layer',
                type: 'frontend',
                color: '#61DAFB',
                icon: '🌐',
                components: [{
                  id: 'ui',
                  name: 'User Interface',
                  type: 'frontend',
                  description: 'React-based user interface components',
                  technologies: techStack.filter(t => t.category === 'frontend').map(t => t.name)
                }]
              });
            }
            
            if (techStack.some(t => t.category === 'backend')) {
              fallbackLayers.push({
                id: 'backend',
                name: 'Application Logic Layer',
                type: 'backend',
                color: '#FF6B35',
                icon: '🔧',
                components: [{
                  id: 'api',
                  name: 'Backend Services',
                  type: 'backend',
                  description: 'Server-side logic and API endpoints',
                  technologies: techStack.filter(t => t.category === 'backend').map(t => t.name)
                }]
              });
            }
            
            setArchitecturalDiagram({
              layers: fallbackLayers,
              connections: fallbackLayers.length > 1 ? [{
                from: 'frontend',
                to: 'backend',
                type: 'api-call',
                label: 'API Communication'
              }] : [],
              isLoading: false
            });
          }
        }
      } catch (error) {
        console.error('Failed to generate architectural diagram:', error);
        setArchitecturalDiagram(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to generate architectural diagram'
        }));
      }
    };

    generateArchitecturalDiagram();
  }, [dynamicSpec, techStack, projectFiles, currentProject]);

  if (!currentProject) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1rem',
        padding: '2rem',
        color: 'var(--text-gray)'
      }}>
        <div style={{ fontSize: '3rem', opacity: 0.5 }}>📊</div>
        <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
          No Project Selected
        </h3>
        <p style={{ fontSize: '1rem', textAlign: 'center', maxWidth: '400px', margin: 0, opacity: 0.8 }}>
          Select a project from the sidebar to view its overview, statistics, and insights.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      padding: '1.5rem',
      overflowY: 'auto',
      overflowX: 'hidden',
      background: '#0a0a0a',
      maxWidth: '100%'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.8rem',
          flexShrink: 0
        }}>
          {currentProject.icon || '📊'}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            color: '#ffffff',
            margin: 0,
            marginBottom: '0.5rem',
            wordWrap: 'break-word'
          }}>
            {dynamicSpec.isLoading ? (currentProject.name || 'Loading...') : dynamicSpec.title}
          </h1>
          <p style={{
            fontSize: '1.1rem',
            color: 'var(--text-gray)',
            margin: 0,
            lineHeight: 1.4,
            wordWrap: 'break-word'
          }}>
            {dynamicSpec.isLoading ? 'Analyzing application...' : dynamicSpec.description}
          </p>
        </div>
      </div>

      {/* Project Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
        maxWidth: '100%'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          minWidth: 0
        }}>
          <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>📁</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff' }}>
              {projectStats.totalFiles}
            </div>
            <div style={{ color: 'var(--text-gray)', fontSize: '0.8rem' }}>
              Files
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          minWidth: 0
        }}>
          <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>⚛️</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff' }}>
              {projectStats.components}
            </div>
            <div style={{ color: 'var(--text-gray)', fontSize: '0.8rem' }}>
              Components
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          minWidth: 0
        }}>
          <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>📝</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff' }}>
              {projectStats.linesOfCode.toLocaleString()}
            </div>
            <div style={{ color: 'var(--text-gray)', fontSize: '0.8rem' }}>
              Lines of Code
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          minWidth: 0
        }}>
          <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>
            {projectStats.complexity === 'high' ? '🔥' : 
             projectStats.complexity === 'medium' ? '⚡' : '🌱'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ 
              fontSize: '1.2rem', 
              fontWeight: 700, 
              color: projectStats.complexity === 'high' ? '#ff6b35' :
                     projectStats.complexity === 'medium' ? '#f59e0b' : '#10b981',
              textTransform: 'capitalize'
            }}>
              {projectStats.complexity}
            </div>
            <div style={{ color: 'var(--text-gray)', fontSize: '0.8rem' }}>
              Complexity
            </div>
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '1.5rem',
        marginBottom: '2rem',
        maxWidth: '100%'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#ffffff',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>🛠️</span>
          Technology Stack
        </h2>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          maxWidth: '100%'
        }}>
          {techStack.map((tech, index) => (
            <div
              key={index}
              style={{
                background: `${tech.color}20`,
                border: `1px solid ${tech.color}40`,
                borderRadius: '12px',
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#ffffff',
                fontSize: '0.9rem',
                fontWeight: 600,
                flexShrink: 0
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{tech.icon}</span>
              <span>{tech.name}</span>
              <span style={{
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                padding: '2px 8px',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>
                {tech.usage}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Architectural Diagram */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '1.5rem',
        marginBottom: '2rem',
        maxWidth: '100%'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#ffffff',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>🏗️</span>
          Architecture Diagram
        </h2>
        <ArchitecturalDiagramView diagram={architecturalDiagram} />
      </div>

      {/* Dynamic Functional Specification - Collapsible */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '1.5rem',
        marginBottom: '2rem',
        maxWidth: '100%'
      }}>
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            marginBottom: specCollapsed ? '0' : '1.5rem'
          }}
          onClick={() => setSpecCollapsed(!specCollapsed)}
        >
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#ffffff',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>📋</span>
            Application Specification
          </h2>
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
            color: 'var(--text-gray)',
            transition: 'all 0.3s ease',
            flexShrink: 0
          }}>
            <span>{specCollapsed ? 'Show' : 'Hide'} Details</span>
            <span style={{
              transform: specCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease'
            }}>
              ▼
            </span>
          </div>
        </div>

        {!specCollapsed && (
          <div style={{ 
            animation: 'fadeIn 0.3s ease',
            maxWidth: '100%',
            overflowX: 'hidden'
          }}>
            {dynamicSpec.isLoading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem',
                color: 'var(--text-gray)'
              }}>
                <div style={{
                  animation: 'spin 1s linear infinite',
                  fontSize: '2rem',
                  marginRight: '1rem'
                }}>
                  🔍
                </div>
                <span>Analyzing your application code...</span>
              </div>
            ) : (
              <>
                {/* Application Purpose */}
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: 'var(--accent-orange)',
                    marginBottom: '1rem'
                  }}>
                    What This Application Does
                  </h3>
                  <p style={{
                    color: 'var(--text-light-gray)',
                    lineHeight: 1.6,
                    fontSize: '1rem',
                    wordWrap: 'break-word'
                  }}>
                    {dynamicSpec.mainPurpose}
                  </p>
                </div>

                {/* Target Users */}
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: 'var(--accent-orange)',
                    marginBottom: '1rem'
                  }}>
                    Who Uses This Application
                  </h3>
                  <ul style={{
                    color: 'var(--text-light-gray)',
                    lineHeight: 1.6,
                    paddingLeft: '1.5rem'
                  }}>
                    {dynamicSpec.targetUsers.map((user, index) => (
                      <li key={index} style={{ marginBottom: '0.5rem', wordWrap: 'break-word' }}>{user}</li>
                    ))}
                  </ul>
                </div>

                {/* Core Features */}
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: 'var(--accent-orange)',
                    marginBottom: '1rem'
                  }}>
                    Core Features
                  </h3>
                  <ul style={{
                    color: 'var(--text-light-gray)',
                    lineHeight: 1.6,
                    paddingLeft: '1.5rem'
                  }}>
                    {dynamicSpec.coreFeatures.map((feature, index) => (
                      <li key={index} style={{ marginBottom: '0.5rem', wordWrap: 'break-word' }}>{feature}</li>
                    ))}
                  </ul>
                </div>

                {/* User Interface */}
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: 'var(--accent-orange)',
                    marginBottom: '1rem'
                  }}>
                    User Interface
                  </h3>
                  <p style={{
                    color: 'var(--text-light-gray)',
                    lineHeight: 1.6,
                    marginBottom: '1rem',
                    wordWrap: 'break-word'
                  }}>
                    {dynamicSpec.userInterface.description}
                  </p>
                  {dynamicSpec.userInterface.keyScreens.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '0.5rem' }}>
                        Key Screens:
                      </h4>
                      <ul style={{
                        color: 'var(--text-light-gray)',
                        lineHeight: 1.6,
                        paddingLeft: '1.5rem',
                        fontSize: '0.95rem'
                      }}>
                        {dynamicSpec.userInterface.keyScreens.map((screen, index) => (
                          <li key={index} style={{ marginBottom: '0.25rem', wordWrap: 'break-word' }}>{screen}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* User Workflow */}
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: 'var(--accent-orange)',
                    marginBottom: '1rem'
                  }}>
                    How Users Interact
                  </h3>
                  <ol style={{
                    color: 'var(--text-light-gray)',
                    lineHeight: 1.6,
                    paddingLeft: '1.5rem'
                  }}>
                    {dynamicSpec.userWorkflow.map((step, index) => (
                      <li key={index} style={{ marginBottom: '0.5rem', wordWrap: 'break-word' }}>{step}</li>
                    ))}
                  </ol>
                </div>

                {/* Data Handling */}
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: 'var(--accent-orange)',
                    marginBottom: '1rem'
                  }}>
                    Data Management
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1.5rem'
                  }}>
                    <div>
                      <h4 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '0.75rem' }}>
                        Data Handled:
                      </h4>
                      <ul style={{
                        color: 'var(--text-light-gray)',
                        lineHeight: 1.6,
                        paddingLeft: '1.5rem',
                        fontSize: '0.95rem'
                      }}>
                        {dynamicSpec.dataHandling.whatDataExists.map((item, index) => (
                          <li key={index} style={{ marginBottom: '0.5rem', wordWrap: 'break-word' }}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '0.75rem' }}>
                        User Interactions:
                      </h4>
                      <ul style={{
                        color: 'var(--text-light-gray)',
                        lineHeight: 1.6,
                        paddingLeft: '1.5rem',
                        fontSize: '0.95rem'
                      }}>
                        {dynamicSpec.dataHandling.howUsersInteract.map((item, index) => (
                          <li key={index} style={{ marginBottom: '0.5rem', wordWrap: 'break-word' }}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Key Capabilities */}
                <div>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: 'var(--accent-orange)',
                    marginBottom: '1rem'
                  }}>
                    Key Capabilities
                  </h3>
                  <ul style={{
                    color: 'var(--text-light-gray)',
                    lineHeight: 1.6,
                    paddingLeft: '1.5rem'
                  }}>
                    {dynamicSpec.keyCapabilities.map((capability, index) => (
                      <li key={index} style={{ marginBottom: '0.5rem', wordWrap: 'break-word' }}>{capability}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes fadeIn {
          from { 
            opacity: 0;
            transform: translateY(-10px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
};