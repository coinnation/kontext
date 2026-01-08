import React, { useState, useEffect } from 'react';
import { elementSelectionService } from '../services/ElementSelectionService';
import { visualStyleGenerator } from '../services/VisualStyleGenerator';
import { hotReloadService } from '../services/HotReloadService';
import { useAppStore } from '../store/appStore';

interface PropertyEditorProps {
  onClose: () => void;
}

interface StyleProperty {
  label: string;
  key: string;
  type: 'color' | 'text' | 'number' | 'select';
  unit?: string;
  options?: string[];
}

const COMMON_PROPERTIES: StyleProperty[] = [
  { label: 'Color', key: 'color', type: 'color' },
  { label: 'Background', key: 'backgroundColor', type: 'color' },
  { label: 'Font Size', key: 'fontSize', type: 'number', unit: 'px' },
  { label: 'Font Weight', key: 'fontWeight', type: 'select', options: ['normal', 'bold', '300', '400', '500', '600', '700'] },
  { label: 'Padding', key: 'padding', type: 'number', unit: 'px' },
  { label: 'Margin', key: 'margin', type: 'number', unit: 'px' },
  { label: 'Width', key: 'width', type: 'number', unit: 'px' },
  { label: 'Height', key: 'height', type: 'number', unit: 'px' },
  { label: 'Border Radius', key: 'borderRadius', type: 'number', unit: 'px' },
];

// Helper function to convert RGB/RGBA to hex
const rgbToHex = (rgb: string): string => {
  // Handle rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return `#${[r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('')}`;
  }
  // If already hex or other format, return as-is
  if (rgb.startsWith('#')) {
    return rgb;
  }
  // Default fallback
  return '#000000';
};

import { normalizeFilePathForPreview } from '../services/HotReloadService';

export const PropertyEditor: React.FC<PropertyEditorProps> = ({ onClose }) => {
  const { activeProject, projectFiles, projectGeneratedFiles, generatedFiles, projects } = useAppStore(state => ({
    activeProject: state.activeProject,
    projectFiles: state.projectFiles,
    projectGeneratedFiles: state.projectGeneratedFiles,
    generatedFiles: state.generatedFiles,
    projects: state.projects
  }));
  
  // Get project name for path normalization
  const projectName = React.useMemo(() => {
    if (!activeProject || !projects) return null;
    const project = Array.isArray(projects) 
      ? projects.find((p: any) => p.id === activeProject)
      : projects[activeProject];
    return project?.name || project?.title || null;
  }, [activeProject, projects]);

  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [styles, setStyles] = useState<Record<string, string>>({});
  const [textContent, setTextContent] = useState<string>('');
  const [originalTextContent, setOriginalTextContent] = useState<string>(''); // Store original text when element is selected
  const [originalElementSelector, setOriginalElementSelector] = useState<string>(''); // Track which element the original text belongs to
  const [textSourceLocation, setTextSourceLocation] = useState<{ filePath: string; exactMatch: string; matchIndex: number } | null>(null); // Store where the text was found in source
  const [cssRuleLocation, setCssRuleLocation] = useState<{ cssFilePath: string; existingRule: string | null; ruleIndex: number } | null>(null); // Store where the CSS rule is located
  const [isApplying, setIsApplying] = useState(false);
  
  // Use ref to track selector synchronously (avoids stale state issue)
  const originalSelectorRef = React.useRef<string>('');

  useEffect(() => {
    const unsubscribe = elementSelectionService.onSelectionChange(async (element) => {
      if (element) {
        setSelectedElement(element);
        // Convert computed styles to editable format
        const editableStyles: Record<string, string> = {};
        
        // Extract numeric values (remove units for editing)
        Object.entries(element.computedStyles || {}).forEach(([key, value]) => {
          if (value && value !== 'none' && value !== 'auto') {
            const prop = COMMON_PROPERTIES.find(p => p.key === key);
            
            if (prop?.type === 'number') {
              // Remove units for number inputs
              const numericMatch = value.match(/^(\d+(?:\.\d+)?)/);
              if (numericMatch) {
                editableStyles[key] = numericMatch[1];
              }
            } else if (prop?.type === 'color') {
              // Convert RGB/RGBA to hex for color inputs
              editableStyles[key] = rgbToHex(value);
            } else {
              editableStyles[key] = value;
            }
          }
        });
        
        setStyles(editableStyles);
        const initialText = element.textContent || '';
        
        // Check if this is the same element (re-selection from text/style update) or a new element
        // Use ref to check synchronously (avoids stale state issue)
        const isSameElement = element.selector === originalSelectorRef.current;
        const isNewElement = !originalSelectorRef.current || !isSameElement;
        
        console.log('[PropertyEditor] 🎯 Element selected:', {
          selector: element.selector,
          textContent: initialText,
          textContentLength: initialText.length,
          hasText: !!initialText,
          isSameElement,
          isNewElement,
          currentOriginalText: originalTextContent,
          originalSelector: originalSelectorRef.current,
          originalSelectorState: originalElementSelector,
          willStoreOriginal: isNewElement,
          elementInfo: {
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            innerHTML: element.innerHTML?.substring(0, 100)
          }
        });
        
        setTextContent(initialText);
        
        // Only store original text and find source location on NEW element selection
        if (isNewElement && initialText.trim() && activeProject) {
          setOriginalTextContent(initialText);
          setOriginalElementSelector(element.selector);
          originalSelectorRef.current = element.selector; // Update ref synchronously
          
          // 🔥 NEW: Find the text in source files and store the location
          const currentProjectFiles = projectFiles[activeProject] || {};
          const projectGenFiles = projectGeneratedFiles[activeProject] || {};
          const currentGenFiles = generatedFiles || {};
          
          const allProjectFiles = {
            ...currentProjectFiles,
            ...projectGenFiles,
            ...currentGenFiles
          };
          
          // 🔥 NEW: Find the text in source files and store the location
          // Pass the selector to help locate the element in source
          const textLocation = visualStyleGenerator.findTextInSourceFiles(initialText, allProjectFiles, element.selector);
          
          if (textLocation) {
            setTextSourceLocation(textLocation);
            console.log('[PropertyEditor] ✅ Text source location found and stored:', textLocation);
          } else {
            setTextSourceLocation(null);
            // 🔥 NEW: Detect if this is a derived value (can't find literal text in source)
            console.warn('[PropertyEditor] ⚠️ Could not find text in source files - likely a derived/calculated value:', initialText);
            console.warn('[PropertyEditor] 💡 This value appears to be computed from state/props, not a hardcoded string. Direct editing is not supported.');
          }
          
          // 🔥 NEW: Find the CSS rule location and store it
          const cssLocation = visualStyleGenerator.findCSSRuleLocation(element.selector, allProjectFiles);
          
          if (cssLocation) {
            setCssRuleLocation(cssLocation);
            console.log('[PropertyEditor] ✅ CSS rule location found and stored:', cssLocation);
          } else {
            setCssRuleLocation(null);
            console.warn('[PropertyEditor] ⚠️ Could not find CSS rule location for selector:', element.selector);
          }
          
          console.log('[PropertyEditor] ✅ Original text stored (new element):', initialText);
        } else {
          console.log('[PropertyEditor] ⏭️ Skipping original text update (re-selection from text/style update)');
        }
      } else {
        setSelectedElement(null);
        setStyles({});
        setTextContent('');
        setOriginalTextContent('');
        setOriginalElementSelector('');
        originalSelectorRef.current = ''; // Clear ref
        setTextSourceLocation(null);
        setCssRuleLocation(null);
      }
    });

    return unsubscribe;
  }, [activeProject, projectFiles, projectGeneratedFiles, generatedFiles]);

  const handleStyleChange = (property: string, value: string) => {
    const newStyles = { ...styles, [property]: value };
    setStyles(newStyles);

    // Update element in preview (live preview)
    const cssValue = COMMON_PROPERTIES.find(p => p.key === property)?.unit
      ? value + (COMMON_PROPERTIES.find(p => p.key === property)?.unit || '')
      : value;

    elementSelectionService.updateElementStyles({
      [property]: cssValue
    });
  };

  const handleTextChange = (value: string) => {
    console.log('[PropertyEditor] ✏️ Text changed in input:', {
      oldValue: textContent,
      newValue: value,
      originalText: originalTextContent
    });
    setTextContent(value);
    // Update element in preview (live preview)
    elementSelectionService.updateElementText(value);
  };

  const handleApply = async () => {
    if (!selectedElement || !activeProject) return;

    setIsApplying(true);

    try {
      // Get all project files from all sources (canister, generated, current session)
      const canisterFiles = projectFiles[activeProject] || {};
      const projectGenFiles = projectGeneratedFiles[activeProject] || {};
      const currentGenFiles = generatedFiles || {};
      
      // Combine all files with proper precedence (current > generated > canister)
      const allProjectFiles = {
        ...canisterFiles,
        ...projectGenFiles,
        ...currentGenFiles
      };
      
      const updatedFiles: Record<string, string> = { ...allProjectFiles };
      
      // Use stored original text (from when element was first selected)
      // NOT selectedElement.textContent which may have been updated in preview
      const originalText = originalTextContent;
      
      console.log('[PropertyEditor] 🔍 Text comparison:', {
        originalText,
        currentText: textContent,
        elementTextContent: selectedElement.textContent,
        areDifferent: textContent !== originalText
      });
      
      // Generate CSS from style changes - use stored location for precise update
      const generated = visualStyleGenerator.generateCSS(
        selectedElement.selector,
        styles,
        allProjectFiles,
        cssRuleLocation // 🔥 Pass stored location for precise update
      );
      updatedFiles[generated.filePath] = generated.css;

      // Update text content if changed - use stored source location for precise update
      // 🔥 NEW: Skip text updates for derived values (no source location found)
      if (textContent !== originalText && textContent.trim()) {
        if (textSourceLocation) {
          // 🔥 Use stored location for precise update
          console.log('[PropertyEditor] 🔍 Updating text using stored location:', {
            filePath: textSourceLocation.filePath,
            exactMatch: textSourceLocation.exactMatch,
            originalText,
            newText: textContent
          });
          
          const fileContent = allProjectFiles[textSourceLocation.filePath];
          if (fileContent) {
            // Replace the exact match with new text, preserving format
            let newMatch = textSourceLocation.exactMatch;
            
            // Replace the text while preserving surrounding format
            if (textSourceLocation.exactMatch.includes('>') && textSourceLocation.exactMatch.includes('<')) {
              // JSX text: >$543< -> >$555<
              newMatch = textSourceLocation.exactMatch.replace(originalText, textContent);
            } else if (textSourceLocation.exactMatch.startsWith('"') && textSourceLocation.exactMatch.endsWith('"')) {
              // String literal: "$543" -> "$555"
              newMatch = `"${textContent}"`;
            } else if (textSourceLocation.exactMatch.startsWith("'") && textSourceLocation.exactMatch.endsWith("'")) {
              // String literal: '$543' -> '$555'
              newMatch = `'${textContent}'`;
            } else if (textSourceLocation.exactMatch.startsWith('`') && textSourceLocation.exactMatch.endsWith('`')) {
              // Template literal: `$543` -> `$555`
              newMatch = `\`${textContent}\``;
            } else if (textSourceLocation.exactMatch.startsWith('{') && textSourceLocation.exactMatch.endsWith('}')) {
              // JSX expression: {$543} or {"$543"} -> {$555} or {"$555"}
              newMatch = textSourceLocation.exactMatch.replace(originalText, textContent);
            } else {
              // Plain text - direct replacement
              newMatch = textContent;
            }
            
            const updatedContent = fileContent.replace(textSourceLocation.exactMatch, newMatch);
            
            updatedFiles[textSourceLocation.filePath] = updatedContent;
            console.log('[PropertyEditor] ✅ Text content updated using stored location:', textSourceLocation.filePath);
          } else {
            console.warn('[PropertyEditor] ⚠️ File not found in project files:', textSourceLocation.filePath);
          }
        } else {
          // Derived value - cannot update directly
          console.warn('[PropertyEditor] ⚠️ Cannot update text - this is a derived/calculated value. Edit the source code that generates it instead.');
        }
      }

      // Update in store
      const store = useAppStore.getState();
      if (store.updateGeneratedFiles && typeof store.updateGeneratedFiles === 'function') {
        const filesToUpdate: Record<string, string> = {
          [generated.filePath]: generated.css
        };
        
        // Add text update if available (only for non-derived values)
        if (textContent !== originalText && textContent.trim() && textSourceLocation) {
          // Only update if we have a source location (not a derived value)
          if (updatedFiles[textSourceLocation.filePath]) {
            filesToUpdate[textSourceLocation.filePath] = updatedFiles[textSourceLocation.filePath];
          }
        }
        
        store.updateGeneratedFiles(filesToUpdate);
      }

      // Extract package.json from project files (not just updated files)
      let packageJson: any = null;
      let packageJsonSource = 'not found';
      for (const [fileName, content] of Object.entries(allProjectFiles)) {
        if (fileName.includes('package.json')) {
          try {
            packageJson = JSON.parse(typeof content === 'string' ? content : String(content));
            packageJsonSource = fileName;
            console.log(`[PropertyEditor] ✅ Found package.json in project files: ${fileName}`, {
              dependencies: Object.keys(packageJson.dependencies || {}).length,
              devDependencies: Object.keys(packageJson.devDependencies || {}).length,
              hasReact: !!packageJson.dependencies?.react,
              hasDfinity: Object.keys(packageJson.dependencies || {}).some(d => d.startsWith('@dfinity/'))
            });
            break;
          } catch (err) {
            console.warn(`[PropertyEditor] ⚠️ Failed to parse package.json from ${fileName}:`, err);
          }
        }
      }

      // If still not found, check updatedFiles as fallback
      if (!packageJson) {
        for (const [fileName, content] of Object.entries(updatedFiles)) {
          if (fileName.includes('package.json')) {
            try {
              packageJson = JSON.parse(content as string);
              break;
            } catch {
              // Not valid JSON
            }
          }
        }
      }

      // Ensure we have package.json - it's required for preview session
      if (!packageJson) {
        console.warn('[PropertyEditor] ⚠️ No package.json found in project files, using minimal default configuration');
        console.warn('[PropertyEditor] ⚠️ This may cause missing dependencies! Check that package.json is in project files.');
        packageJson = {
          name: 'kontext-project',
          version: '1.0.0',
          type: 'module',
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0'
          },
          devDependencies: {
            vite: '^5.1.4',
            '@vitejs/plugin-react': '^4.2.0'
          }
        };
      } else {
        console.log(`[PropertyEditor] ✅ Using package.json from: ${packageJsonSource}`);
      }

      // Prepare files to update (only the changed files, not all files)
      const filesToReload = [
        {
          fileName: generated.filePath,
          content: generated.css
        }
      ];
      
      // Add text update file if available - use stored location for precise update
      // 🔥 NEW: Only add text updates if we have a source location (not derived)
      if (textContent !== originalText && textContent.trim() && textSourceLocation) {
        if (updatedFiles[textSourceLocation.filePath]) {
          // Use the already-updated file from updatedFiles
          console.log('[PropertyEditor] ✅ Adding text update to filesToReload (using stored location):', textSourceLocation.filePath);
          filesToReload.push({
            fileName: textSourceLocation.filePath,
            content: updatedFiles[textSourceLocation.filePath]
          });
          } else {
            // Derived value - cannot update
            console.warn('[PropertyEditor] ⚠️ Cannot add text update to filesToReload - this is a derived value');
          const textUpdate = visualStyleGenerator.updateTextContent(
            selectedElement.selector,
            originalText,
            textContent,
            allProjectFiles
          );
          
          if (textUpdate) {
            console.log('[PropertyEditor] ✅ Adding text update to filesToReload (fallback):', textUpdate.filePath);
            filesToReload.push({
              fileName: textUpdate.filePath,
              content: textUpdate.content
            });
          } else {
            console.warn('[PropertyEditor] ❌ Text update returned null - file will NOT be sent to server!', {
              originalText,
              newText: textContent,
              selector: selectedElement.selector,
              hasStoredLocation: !!textSourceLocation
            });
          }
        }
      }
      
      console.log('[PropertyEditor] 📦 Final filesToReload array:', {
        count: filesToReload.length,
        files: filesToReload.map(f => f.fileName)
      });
      
      // Try to update existing session first
      try {
        await hotReloadService.updatePreviewFiles(activeProject, filesToReload);
      } catch (error: any) {
        // If update fails (no session exists), create one with all project files
        if (error.message?.includes('No active preview session') || error.message?.includes('expired')) {
          console.log('[PropertyEditor] No active session found, creating new one...');
          
          // Normalize file paths for preview (remove project name prefix to match server expectations)
          const filesArray = Object.entries(allProjectFiles).map(([name, content]) => ({
            name: normalizeFilePathForPreview(name, projectName),
            content: typeof content === 'string' ? content : String(content)
          }));
          
          // 🔥 CRITICAL: Ensure package.json is included in files array
          // The server needs the actual file, not just the parsed object
          const hasPackageJsonFile = filesArray.some(f => 
            f.name === 'package.json' || 
            f.name === 'src/frontend/package.json' ||
            f.name.endsWith('/package.json')
          );
          
          if (!hasPackageJsonFile && packageJson) {
            // Determine the correct path for package.json (usually src/frontend/package.json for icpstudio)
            const packageJsonPath = filesArray.some(f => f.name.startsWith('src/frontend/'))
              ? 'src/frontend/package.json'
              : 'package.json';
            
            filesArray.push({
              name: packageJsonPath,
              content: JSON.stringify(packageJson, null, 2)
            });
            console.log(`[PropertyEditor] ✅ Added package.json to files array at: ${packageJsonPath}`);
          }
          
          // Verify critical files for Tailwind/PostCSS
          const hasTailwindConfig = filesArray.some(f => 
            f.name.includes('tailwind.config')
          );
          const hasPostCSSConfig = filesArray.some(f => 
            f.name.includes('postcss.config')
          );
          const hasViteConfig = filesArray.some(f => 
            f.name.includes('vite.config')
          );
          const hasStylesCSS = filesArray.some(f => 
            f.name.includes('styles.css')
          );
          
          console.log('[PropertyEditor] 📋 Normalized files for preview session:', {
            totalFiles: filesArray.length,
            samplePaths: filesArray.slice(0, 5).map(f => f.name),
            projectName,
            hasPackageJson: hasPackageJsonFile || !!packageJson,
            packageJsonPath: filesArray.find(f => f.name.includes('package.json'))?.name || 'not found',
            tailwindConfig: hasTailwindConfig ? filesArray.find(f => f.name.includes('tailwind.config'))?.name : 'missing',
            postcssConfig: hasPostCSSConfig ? filesArray.find(f => f.name.includes('postcss.config'))?.name : 'missing',
            viteConfig: hasViteConfig ? filesArray.find(f => f.name.includes('vite.config'))?.name : 'missing (server will create default)',
            stylesCSS: hasStylesCSS ? filesArray.find(f => f.name.includes('styles.css'))?.name : 'missing'
          });
          
          // Verify we have index.html or entry point - server will create defaults if missing
          const hasIndexHtml = filesArray.some(f => 
            f.name === 'index.html' || 
            f.name.endsWith('/index.html') ||
            f.name.includes('index.html')
          );
          const hasEntryPoint = filesArray.some(f => 
            f.name.includes('index.tsx') || 
            f.name.includes('index.jsx') ||
            f.name.includes('main.tsx') ||
            f.name.includes('main.jsx')
          );
          
          if (!hasIndexHtml || !hasEntryPoint) {
            console.log('[PropertyEditor] ⚠️ Missing index.html or entry point - server will create defaults');
          }
          
          // 🔥 CRITICAL: Generate vite.config.js if not present (like deployment does)
          // This ensures PostCSS/Tailwind are properly configured
          if (!hasViteConfig) {
            console.log('[PropertyEditor] 🔧 Generating vite.config.js for preview session (like deployment)...');
            
            // Try to get backend canister ID from server pairs (optional - preview works without it)
            let backendCanisterId: string | undefined = undefined;
            try {
              const store = useAppStore.getState();
              if (store.userCanisterId && store.identity && activeProject) {
                const { userCanisterService } = await import('../services/UserCanisterService');
                const userActor = await userCanisterService.getUserActor(store.userCanisterId, store.identity);
                const serverPairsResult = await userActor.getProjectServerPairs(activeProject);
                
                if (serverPairsResult && 'ok' in serverPairsResult && Array.isArray(serverPairsResult.ok) && serverPairsResult.ok.length > 0) {
                  // Get selected server pair or use first one
                  const selectedPairId = store.getProjectServerPair?.(activeProject);
                  const pair = selectedPairId 
                    ? serverPairsResult.ok.find((p: any) => p.pairId === selectedPairId)
                    : serverPairsResult.ok[0];
                  
                  if (pair && pair.backendCanisterId) {
                    backendCanisterId = typeof pair.backendCanisterId === 'string' 
                      ? pair.backendCanisterId 
                      : pair.backendCanisterId.toText();
                    console.log(`[PropertyEditor] ✅ Found backend canister ID for vite config: ${backendCanisterId}`);
                  }
                }
              }
            } catch (error) {
              console.warn('[PropertyEditor] ⚠️ Could not get backend canister ID (preview will work without it):', error);
            }
            
            // Generate vite.config.js using the same function as deployment
            const { generateViteConfigForPreview } = await import('../services/HotReloadService');
            const viteConfigContent = generateViteConfigForPreview(backendCanisterId);
            
            // Determine correct path for vite.config (src/frontend/vite.config.js for icpstudio)
            const viteConfigPath = filesArray.some(f => f.name.startsWith('src/frontend/'))
              ? 'src/frontend/vite.config.js'
              : 'vite.config.js';
            
            filesArray.push({
              name: viteConfigPath,
              content: viteConfigContent
            });
            
            console.log(`[PropertyEditor] ✅ Generated and added vite.config.js at: ${viteConfigPath}`, {
              hasBackendCanisterId: !!backendCanisterId,
              backendCanisterId: backendCanisterId || 'none'
            });
          } else {
            console.log('[PropertyEditor] ✅ Existing vite.config.js found, using it');
          }
          
          // Warn if Tailwind files are present but vite.config might not process them
          if (hasTailwindConfig && hasPostCSSConfig && !hasViteConfig) {
            console.warn('[PropertyEditor] ⚠️ Tailwind/PostCSS configs found but no vite.config.js - generated one should fix this');
          }
          
          await hotReloadService.createPreviewSession(activeProject, filesArray, packageJson);
          // After creating session, update with the changed files
          await hotReloadService.updatePreviewFiles(activeProject, filesToReload);
        } else {
          throw error; // Re-throw if it's a different error
        }
      }

      console.log('[PropertyEditor] ✅ Styles and text applied and hot reloaded');
      
      // 🔥 NEW: Persist changes to canister after successful preview update
      const filesToPersist: Record<string, string> = {};
      
      // Add CSS file if it was updated
      if (generated && generated.filePath) {
        filesToPersist[generated.filePath] = generated.css;
      }
      
      // Add text update file if it was updated (only for non-derived values)
      if (textContent !== originalText && textContent.trim() && textSourceLocation) {
        if (updatedFiles[textSourceLocation.filePath]) {
          filesToPersist[textSourceLocation.filePath] = updatedFiles[textSourceLocation.filePath];
        }
      }
      
      // Persist to canister if there are files to save
      if (Object.keys(filesToPersist).length > 0) {
        console.log('[PropertyEditor] 💾 Persisting changes to canister:', Object.keys(filesToPersist));
        
        try {
          const store = useAppStore.getState();
          if (store.saveProjectFiles && typeof store.saveProjectFiles === 'function') {
            const saveSuccess = await store.saveProjectFiles(activeProject, filesToPersist);
            if (saveSuccess) {
              console.log('[PropertyEditor] ✅ Changes persisted to canister successfully');
            } else {
              console.warn('[PropertyEditor] ⚠️ Failed to persist changes to canister (non-critical)');
            }
          } else {
            console.warn('[PropertyEditor] ⚠️ saveProjectFiles method not available');
          }
        } catch (persistError) {
          console.error('[PropertyEditor] ❌ Error persisting to canister (non-critical):', persistError);
          // Don't fail the whole operation if persistence fails
        }
      }
    } catch (error) {
      console.error('[PropertyEditor] ❌ Failed to apply changes:', error);
    } finally {
      setIsApplying(false);
    }
  };

  if (!selectedElement) {
    return (
      <div style={{
        width: '300px',
        padding: '1.5rem',
        background: 'rgba(17, 17, 17, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        color: '#ffffff'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem'
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
            Property Editor
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '0.25rem 0.5rem'
            }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>
          Click on an element in the preview to edit its properties
        </p>
      </div>
    );
  }

  return (
    <div style={{
      width: '320px',
      height: 'calc(100vh - 140px)', // Fixed height: viewport minus top bar space
      maxHeight: '700px', // Cap at reasonable maximum
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(17, 17, 17, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.5rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#ffffff' }}>
            {selectedElement.tagName.toLowerCase()}
            {selectedElement.id && `#${selectedElement.id}`}
            {selectedElement.className && `.${selectedElement.className.split(' ')[0]}`}
          </h3>
          <p style={{
            margin: '0.25rem 0 0 0',
            fontSize: '0.75rem',
            color: 'rgba(255, 255, 255, 0.5)',
            fontFamily: 'monospace'
          }}>
            {selectedElement.selector}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.6)',
            cursor: 'pointer',
            fontSize: '1.5rem',
            padding: '0.25rem 0.5rem',
            lineHeight: 1
          }}
        >
          ×
        </button>
      </div>

      {/* Properties - Scrollable area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '1rem 1.5rem',
        paddingBottom: '0.5rem',
        minHeight: 0 // Critical: allows flex child to shrink below content size
      }}>
        {/* Text Content Editor */}
        {selectedElement.textContent !== undefined && (
          <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <label style={{
              display: 'block',
              fontSize: '0.85rem',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '0.5rem',
              fontWeight: '500'
            }}>
              Text Content
            </label>
            {!textSourceLocation ? (
              // 🔥 NEW: Show warning for derived values
              <div style={{
                padding: '0.75rem',
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: '0.375rem',
                color: 'rgba(251, 191, 36, 0.9)',
                fontSize: '0.85rem',
                lineHeight: '1.5'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span>⚠️</span>
                  <strong>Derived Value</strong>
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.9 }}>
                  This value is calculated from other values (e.g., <code style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '0.25rem' }}>formatCurrency(balance)</code> or <code style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '0.25rem' }}>total * 1.1</code>).
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.9 }}>
                  To change this value, edit the source code that calculates it, not the displayed result.
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', opacity: '0.8', fontStyle: 'italic' }}>
                  Current value: <code style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '0.25rem' }}>{textContent}</code>
                </div>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={textContent}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="Edit text content..."
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    color: '#ffffff',
                    fontSize: '0.85rem'
                  }}
                />
                <p style={{
                  margin: '0.5rem 0 0 0',
                  fontSize: '0.75rem',
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontStyle: 'italic'
                }}>
                  Changes appear instantly in preview
                </p>
              </>
            )}
          </div>
        )}

        {COMMON_PROPERTIES.map(prop => {
          const value = styles[prop.key] || '';

          return (
            <div key={prop.key} style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.85rem',
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '0.5rem',
                fontWeight: '500'
              }}>
                {prop.label}
              </label>

              {prop.type === 'color' && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={value || '#000000'}
                    onChange={(e) => handleStyleChange(prop.key, e.target.value)}
                    style={{
                      width: '50px',
                      height: '36px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  />
                  <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => handleStyleChange(prop.key, e.target.value)}
                    placeholder="e.g. #ff0000"
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '4px',
                      color: '#ffffff',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              )}

              {prop.type === 'number' && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={value || ''}
                    onChange={(e) => handleStyleChange(prop.key, e.target.value)}
                    placeholder="0"
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '4px',
                      color: '#ffffff',
                      fontSize: '0.85rem'
                    }}
                  />
                  {prop.unit && (
                    <span style={{
                      fontSize: '0.85rem',
                      color: 'rgba(255, 255, 255, 0.5)',
                      minWidth: '30px'
                    }}>
                      {prop.unit}
                    </span>
                  )}
                </div>
              )}

              {prop.type === 'select' && (
                <select
                  value={value || ''}
                  onChange={(e) => handleStyleChange(prop.key, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  {prop.options?.map(opt => (
                    <option key={opt} value={opt} style={{ background: '#111111' }}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}

              {prop.type === 'text' && (
                <input
                  type="text"
                  value={value || ''}
                  onChange={(e) => handleStyleChange(prop.key, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    color: '#ffffff',
                    fontSize: '0.85rem'
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer - Always visible at bottom */}
      <div style={{
        padding: '1rem 1.5rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        gap: '0.5rem',
        flexShrink: 0, // Prevent footer from shrinking
        background: 'rgba(17, 17, 17, 0.95)' // Match container background
      }}>
        <button
          onClick={() => elementSelectionService.clearSelection()}
          style={{
            flex: 1,
            padding: '0.75rem',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            color: '#ffffff',
            fontSize: '0.85rem',
            fontWeight: '500',
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
          Clear
        </button>
        <button
          onClick={handleApply}
          disabled={isApplying}
          style={{
            flex: 1,
            padding: '0.75rem',
            background: isApplying
              ? 'rgba(139, 92, 246, 0.5)'
              : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            border: 'none',
            borderRadius: '6px',
            color: '#ffffff',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: isApplying ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: isApplying ? 0.7 : 1
          }}
          onMouseEnter={(e) => {
            if (!isApplying) {
              e.currentTarget.style.opacity = '0.9';
            }
          }}
          onMouseLeave={(e) => {
            if (!isApplying) {
              e.currentTarget.style.opacity = '1';
            }
          }}
        >
          {isApplying ? 'Applying...' : 'Apply'}
        </button>
      </div>
    </div>
  );
};

