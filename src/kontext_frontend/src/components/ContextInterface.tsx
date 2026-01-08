import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AgentsTab } from './AgentsTab';

// ============================================================================
// TYPES
// ============================================================================

interface ReferenceItem {
  id: string;
  type: 'file' | 'image' | 'website';
  title: string;
  content: string;
  url?: string;
  extractedText?: string;
  fileName?: string;
  fileType?: string;
  addedAt: number;
  size: number;
}

interface CodeRule {
  id: string;
  title: string;
  description: string;
  ruleText: string;
  category: 'architecture' | 'styling' | 'patterns' | 'naming' | 'testing' | 'performance' | 'security' | 'accessibility' | 'general';
  priority: 'low' | 'medium' | 'high' | 'critical';
  isEnabled: boolean;
  addedAt: number;
  tags: string[];
}

// Styling Context Types
interface ColorPalette {
  id: string;
  name: string;
  colors: Array<{
    hex: string;
    role?: 'primary' | 'secondary' | 'accent' | 'background' | 'text' | 'success' | 'warning' | 'error';
    name?: string;
  }>;
  source?: 'coolors' | 'site-extraction' | 'manual' | 'predefined';
  sourceUrl?: string;
  addedAt: number;
}

interface DesignInspiration {
  id: string;
  name: string;
  url: string;
  extractedColors?: string[];
  extractedTypography?: {
    fontFamily?: string;
    fontSize?: string;
    fontWeight?: string;
  };
  notes?: string;
  addedAt: number;
}

// Documentation Context Types
interface DocumentationItem {
  id: string;
  title: string;
  content: string;
  url?: string;
  type: 'snippet' | 'link' | 'guide';
  category?: string;
  addedAt: number;
}

// GitHub Context Types
interface GitHubGuideline {
  id: string;
  title: string;
  content: string;
  category: 'conventions' | 'architecture' | 'patterns' | 'workflow' | 'general';
  addedAt: number;
}

// Code Template Types
interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  code: string;
  language: 'typescript' | 'javascript' | 'python' | 'html' | 'css' | 'json' | 'other';
  category: 'component' | 'hook' | 'utility' | 'config' | 'function' | 'class' | 'other';
  tags: string[];
  addedAt: number;
}

// API Endpoint Types
interface APIEndpoint {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  requestSchema?: string;
  responseSchema?: string;
  exampleRequest?: string;
  exampleResponse?: string;
  addedAt: number;
}

interface ContextInterfaceProps {
  // Props can be added if needed for additional customization
}

// Hook for mobile detection
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ContextInterface: React.FC<ContextInterfaceProps> = () => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'reference' | 'rules' | 'agents' | 'styling' | 'documentation' | 'github' | 'templates' | 'api'>('reference');
  
  const [referenceItems, setReferenceItems] = useState<ReferenceItem[]>([]);
  const [newReferenceType, setNewReferenceType] = useState<'file' | 'image' | 'website'>('file');
  const [newReferenceTitle, setNewReferenceTitle] = useState('');
  const [newReferenceContent, setNewReferenceContent] = useState('');
  const [newReferenceExtractedText, setNewReferenceExtractedText] = useState('');
  const [newReferenceUrl, setNewReferenceUrl] = useState('');
  const [isProcessingReference, setIsProcessingReference] = useState(false);
  
  const [codeRules, setCodeRules] = useState<CodeRule[]>([]);
  const [newRuleTitle, setNewRuleTitle] = useState('');
  const [newRuleDescription, setNewRuleDescription] = useState('');
  const [newRuleText, setNewRuleText] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState<CodeRule['category']>('general');
  const [newRulePriority, setNewRulePriority] = useState<CodeRule['priority']>('medium');
  const [newRuleTags, setNewRuleTags] = useState('');
  const [selectedRuleCategory, setSelectedRuleCategory] = useState<string>('all');

  // Styling Context State
  const [colorPalettes, setColorPalettes] = useState<ColorPalette[]>([]);
  const [designInspirations, setDesignInspirations] = useState<DesignInspiration[]>([]);
  const [newCoolorsUrl, setNewCoolorsUrl] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');

  // Documentation Context State
  const [documentationItems, setDocumentationItems] = useState<DocumentationItem[]>([]);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocContent, setNewDocContent] = useState('');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [newDocType, setNewDocType] = useState<'snippet' | 'link' | 'guide'>('snippet');

  // GitHub Context State
  const [githubGuidelines, setGithubGuidelines] = useState<GitHubGuideline[]>([]);
  const [newGitHubTitle, setNewGitHubTitle] = useState('');
  const [newGitHubContent, setNewGitHubContent] = useState('');
  const [newGitHubCategory, setNewGitHubCategory] = useState<GitHubGuideline['category']>('general');

  // Code Templates State
  const [codeTemplates, setCodeTemplates] = useState<CodeTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [newTemplateCode, setNewTemplateCode] = useState('');
  const [newTemplateLanguage, setNewTemplateLanguage] = useState<CodeTemplate['language']>('typescript');
  const [newTemplateCategory, setNewTemplateCategory] = useState<CodeTemplate['category']>('component');
  const [newTemplateTags, setNewTemplateTags] = useState('');

  // API Endpoints State
  const [apiEndpoints, setApiEndpoints] = useState<APIEndpoint[]>([]);
  const [newApiName, setNewApiName] = useState('');
  const [newApiMethod, setNewApiMethod] = useState<APIEndpoint['method']>('GET');
  const [newApiPath, setNewApiPath] = useState('');
  const [newApiDescription, setNewApiDescription] = useState('');
  const [newApiRequestSchema, setNewApiRequestSchema] = useState('');
  const [newApiResponseSchema, setNewApiResponseSchema] = useState('');

  // MOBILE-SPECIFIC STATE
  const [showMobileTabSelector, setShowMobileTabSelector] = useState(false);
  const [expandedMobileCards, setExpandedMobileCards] = useState<Record<string, boolean>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage
  useEffect(() => {
    const savedReferences = localStorage.getItem('kontext_reference_items');
    if (savedReferences) {
      try {
        const parsed = JSON.parse(savedReferences);
        setReferenceItems(parsed);
      } catch (error) {
        console.error('Error loading references:', error);
      }
    }

    const savedRules = localStorage.getItem('kontext_code_rules');
    if (savedRules) {
      try {
        const parsed = JSON.parse(savedRules);
        setCodeRules(parsed);
      } catch (error) {
        console.error('Error loading code rules:', error);
      }
    }

    // Load styling context
    const savedPalettes = localStorage.getItem('kontext_color_palettes');
    if (savedPalettes) {
      try {
        setColorPalettes(JSON.parse(savedPalettes));
      } catch (error) {
        console.error('Error loading color palettes:', error);
      }
    }
    const savedInspirations = localStorage.getItem('kontext_design_inspirations');
    if (savedInspirations) {
      try {
        setDesignInspirations(JSON.parse(savedInspirations));
      } catch (error) {
        console.error('Error loading design inspirations:', error);
      }
    }

    // Load documentation
    const savedDocs = localStorage.getItem('kontext_documentation_items');
    if (savedDocs) {
      try {
        setDocumentationItems(JSON.parse(savedDocs));
      } catch (error) {
        console.error('Error loading documentation:', error);
      }
    }

    // Load GitHub guidelines
    const savedGitHub = localStorage.getItem('kontext_github_guidelines');
    if (savedGitHub) {
      try {
        setGithubGuidelines(JSON.parse(savedGitHub));
      } catch (error) {
        console.error('Error loading GitHub guidelines:', error);
      }
    }

    // Load code templates
    const savedTemplates = localStorage.getItem('kontext_code_templates');
    if (savedTemplates) {
      try {
        setCodeTemplates(JSON.parse(savedTemplates));
      } catch (error) {
        console.error('Error loading code templates:', error);
      }
    }

    // Load API endpoints
    const savedApiEndpoints = localStorage.getItem('kontext_api_endpoints');
    if (savedApiEndpoints) {
      try {
        setApiEndpoints(JSON.parse(savedApiEndpoints));
      } catch (error) {
        console.error('Error loading API endpoints:', error);
      }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('kontext_reference_items', JSON.stringify(referenceItems));
  }, [referenceItems]);

  useEffect(() => {
    localStorage.setItem('kontext_code_rules', JSON.stringify(codeRules));
  }, [codeRules]);

  useEffect(() => {
    localStorage.setItem('kontext_color_palettes', JSON.stringify(colorPalettes));
  }, [colorPalettes]);

  useEffect(() => {
    localStorage.setItem('kontext_design_inspirations', JSON.stringify(designInspirations));
  }, [designInspirations]);

  useEffect(() => {
    localStorage.setItem('kontext_documentation_items', JSON.stringify(documentationItems));
  }, [documentationItems]);

  useEffect(() => {
    localStorage.setItem('kontext_github_guidelines', JSON.stringify(githubGuidelines));
  }, [githubGuidelines]);

  useEffect(() => {
    localStorage.setItem('kontext_code_templates', JSON.stringify(codeTemplates));
  }, [codeTemplates]);

  useEffect(() => {
    localStorage.setItem('kontext_api_endpoints', JSON.stringify(apiEndpoints));
  }, [apiEndpoints]);

  // Reference Management
  const processWebsite = async (url: string): Promise<string> => {
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = data.contents;
      
      const scripts = tempDiv.querySelectorAll('script, style');
      scripts.forEach(el => el.remove());
      
      return tempDiv.textContent || tempDiv.innerText || '';
    } catch (error) {
      console.error('Error processing website:', error);
      throw new Error('Failed to extract content from website');
    }
  };


  const addReferenceItem = async () => {
    if (!newReferenceTitle.trim()) {
      if (newReferenceType === 'website' && !newReferenceUrl.trim()) {
        alert('Please enter a website URL');
        return;
      }
      if ((newReferenceType === 'file' || newReferenceType === 'image') && !newReferenceContent) {
        alert('Please select a file or image');
        return;
      }
      return;
    }

    setIsProcessingReference(true);
    try {
      let content = newReferenceContent;
      let extractedText = newReferenceExtractedText;

      if (newReferenceType === 'website' && newReferenceUrl) {
        extractedText = await processWebsite(newReferenceUrl);
        content = extractedText.substring(0, 2000) + (extractedText.length > 2000 ? '...' : '');
      }

      const newItem: ReferenceItem = {
        id: Date.now().toString(),
        type: newReferenceType,
        title: newReferenceTitle,
        content: content,
        url: newReferenceUrl || undefined,
        extractedText: extractedText || undefined,
        fileName: newReferenceType === 'file' ? newReferenceTitle : undefined,
        fileType: newReferenceType === 'file' ? 'document' : undefined,
        addedAt: Date.now(),
        size: content.length
      };

      setReferenceItems(prev => [newItem, ...prev]);
      
      setNewReferenceTitle('');
      setNewReferenceContent('');
      setNewReferenceExtractedText('');
      setNewReferenceUrl('');
    } catch (error) {
      console.error('Error adding reference:', error);
      alert('Failed to process reference item. Please try again.');
    } finally {
      setIsProcessingReference(false);
    }
  };

  const removeReferenceItem = (itemId: string) => {
    setReferenceItems(prev => prev.filter(i => i.id !== itemId));
  };

  // File processing functions (same as ChatInput)
  const isValidFileType = (type: string, fileName?: string): boolean => {
    const allowedTypes = [
      // Office Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // OpenDocument formats
      'application/vnd.oasis.opendocument.text',
      'application/vnd.oasis.opendocument.spreadsheet',
      'application/vnd.oasis.opendocument.presentation',
      // Text-based files
      'text/plain',
      'text/markdown',
      'text/csv',
      'text/html',
      'text/css',
      'text/javascript',
      'application/javascript',
      'application/json',
      'application/xml',
      'text/xml',
      // Rich text
      'application/rtf',
      'text/rtf'
    ];
    
    if (allowedTypes.includes(type)) {
      return true;
    }
    
    if ((!type || type === 'application/octet-stream' || type.startsWith('text/') || type === 'application/json') && fileName) {
      const extension = fileName.toLowerCase().split('.').pop();
      const allowedExtensions = [
        // Office documents
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
        // OpenDocument
        'odt', 'ods', 'odp',
        // Text and code files
        'txt', 'md', 'csv', 'json', 'json5',
        // Code files
        'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
        'py', 'java', 'cpp', 'c', 'cc', 'cxx', 'h', 'hpp',
        'go', 'rs', 'rb', 'php', 'swift', 'kt', 'scala',
        'sh', 'bash', 'zsh', 'fish', 'ps1',
        'r', 'm', 'sql', 'pl', 'lua', 'vim', 'clj', 'hs',
        // Web files
        'html', 'htm', 'xhtml', 'css', 'scss', 'sass', 'less',
        // Configuration files
        'yml', 'yaml', 'toml', 'ini', 'conf', 'config',
        'env', 'properties', 'xml',
        // Other text formats
        'rtf', 'log', 'diff', 'patch'
      ];
      if (extension && allowedExtensions.includes(extension)) {
        return true;
      }
    }
    
    return false;
  };

  const extractTextFromDocx = async (file: File): Promise<string> => {
    try {
      // @ts-ignore - Dynamic import that may not be available
      const JSZip = (await import(/* @vite-ignore */ 'jszip')).default;
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const documentXml = await zip.file('word/document.xml')?.async('string');
      if (!documentXml) {
        throw new Error('Could not find document.xml in .docx file');
      }
      const text = documentXml
        .replace(/<[^>]+>/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
      return text || `[Word document: ${file.name} - text extraction completed but no readable text found]`;
    } catch (error) {
      console.error(`❌ [ContextInterface] Error extracting text from .docx:`, error);
      return `[Word document: ${file.name} - text extraction failed]`;
    }
  };

  const extractTextFromExcel = async (file: File): Promise<string> => {
    try {
      try {
        // @ts-ignore - Dynamic import that may not be available
        const XLSX = (await import(/* @vite-ignore */ 'xlsx')).default;
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        let allText = '';
        workbook.SheetNames.forEach((sheetName, index) => {
          const worksheet = workbook.Sheets[sheetName];
          const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          if (index > 0) allText += `\n\n--- Sheet: ${sheetName} ---\n`;
          sheetData.forEach((row: any) => {
            if (Array.isArray(row)) {
              const rowText = row.filter(cell => cell !== '').join(' | ');
              if (rowText.trim()) {
                allText += rowText + '\n';
              }
            }
          });
        });
        return allText.trim() || `[Excel spreadsheet: ${file.name} - extracted but appears to be empty]`;
      } catch (importError) {
        console.warn(`⚠️ [ContextInterface] xlsx library not available for ${file.name}`);
        return `[Excel spreadsheet: ${file.name} - text extraction requires the 'xlsx' library]`;
      }
    } catch (error) {
      console.error(`❌ [ContextInterface] Error extracting text from Excel:`, error);
      return `[Excel spreadsheet: ${file.name} - text extraction failed]`;
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      try {
        // @ts-ignore - Dynamic import that may not be available
        const pdfjsLib = await import(/* @vite-ignore */ 'pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let allText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          allText += `\n\n--- Page ${i} ---\n${pageText}`;
        }
        return allText.trim() || `[PDF document: ${file.name} - extracted but appears to be empty or image-only]`;
      } catch (importError) {
        console.warn(`⚠️ [ContextInterface] pdf.js library not available for ${file.name}`);
        return `[PDF document: ${file.name} - text extraction requires the 'pdfjs-dist' library]`;
      }
    } catch (error) {
      console.error(`❌ [ContextInterface] Error extracting text from PDF:`, error);
      return `[PDF document: ${file.name} - text extraction failed]`;
    }
  };

  const extractTextFromPowerPoint = async (file: File): Promise<string> => {
    try {
      // @ts-ignore - Dynamic import that may not be available
      const JSZip = (await import(/* @vite-ignore */ 'jszip')).default;
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      let allText = '';
      const slideFiles = zip.file(/ppt\/slides\/slide\d+\.xml/);
      if (slideFiles && slideFiles.length > 0) {
        for (const slideFile of slideFiles) {
          const slideXml = await slideFile.async('string');
          const slideText = slideXml
            .replace(/<[^>]+>/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
          if (slideText) {
            allText += `\n\n--- Slide ${slideFile.name.match(/slide(\d+)\.xml/)?.[1] || '?'} ---\n${slideText}`;
          }
        }
      }
      return allText.trim() || `[PowerPoint presentation: ${file.name} - text extraction completed but no readable text found]`;
    } catch (error) {
      console.error(`❌ [ContextInterface] Error extracting text from PowerPoint:`, error);
      return `[PowerPoint presentation: ${file.name} - text extraction failed]`;
    }
  };

  const processFileForContext = async (file: File): Promise<{ base64Content: string; extractedText: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Data = e.target?.result as string;
          const fileName = file.name.toLowerCase();
          const fileType = file.type.toLowerCase();
          let extractedText = '';

          if (fileType === 'text/plain' || fileType === 'text/markdown' || fileType === 'text/csv' ||
              fileType === 'text/html' || fileType === 'text/css' || fileType === 'text/javascript' ||
              fileType === 'application/javascript' || fileType === 'application/json' ||
              fileType === 'application/xml' || fileType === 'text/xml' ||
              fileName.endsWith('.js') || fileName.endsWith('.jsx') || fileName.endsWith('.ts') ||
              fileName.endsWith('.tsx') || fileName.endsWith('.json') || fileName.endsWith('.html') ||
              fileName.endsWith('.css') || fileName.endsWith('.scss') || fileName.endsWith('.sass') ||
              fileName.endsWith('.less') || fileName.endsWith('.py') || fileName.endsWith('.java') ||
              fileName.endsWith('.cpp') || fileName.endsWith('.c') || fileName.endsWith('.go') ||
              fileName.endsWith('.rs') || fileName.endsWith('.rb') || fileName.endsWith('.php') ||
              fileName.endsWith('.swift') || fileName.endsWith('.kt') || fileName.endsWith('.sh') ||
              fileName.endsWith('.bash') || fileName.endsWith('.yml') || fileName.endsWith('.yaml') ||
              fileName.endsWith('.toml') || fileName.endsWith('.ini') || fileName.endsWith('.env') ||
              fileName.endsWith('.xml') || fileName.endsWith('.log') || fileName.endsWith('.sql') ||
              fileName.endsWith('.r') || fileName.endsWith('.m') || fileName.endsWith('.pl') ||
              fileName.endsWith('.lua') || fileName.endsWith('.vim') || fileName.endsWith('.clj') ||
              fileName.endsWith('.hs') || fileName.endsWith('.diff') || fileName.endsWith('.patch') ||
              fileName.endsWith('.rtf') || fileName.endsWith('.conf') || fileName.endsWith('.config')) {
            // Plain text and code files - direct extraction
            extractedText = base64Data.split(',')[1] ? atob(base64Data.split(',')[1]) : '';
          } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                     fileName.endsWith('.docx')) {
            extractedText = await extractTextFromDocx(file);
          } else if (fileType === 'application/msword' || fileName.endsWith('.doc')) {
            extractedText = `[Word document (.doc format): ${file.name}. This format requires specialized processing.]`;
          } else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
            extractedText = await extractTextFromPDF(file);
          } else if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                     fileType === 'application/vnd.ms-excel' ||
                     fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            extractedText = await extractTextFromExcel(file);
          } else if (fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
                     fileType === 'application/vnd.ms-powerpoint' ||
                     fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
            extractedText = await extractTextFromPowerPoint(file);
          }

          resolve({ base64Content: base64Data, extractedText });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

      if (!isValidFileType(file.type, file.name)) {
      alert(`Unsupported file type: ${file.type || 'unknown'}. Supported: PDF, Word, Excel, PowerPoint, Text, Markdown, CSV, JSON, Code files (.js, .ts, .py, etc.), HTML, CSS, Config files (.yml, .toml, etc.)`);
      return;
    }

    setIsProcessingReference(true);
    try {
      const { base64Content, extractedText } = await processFileForContext(file);
      setNewReferenceContent(base64Content);
      setNewReferenceExtractedText(extractedText || '');
      if (!newReferenceTitle.trim()) {
        setNewReferenceTitle(file.name);
      }
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Failed to process file. Please try again.');
    } finally {
      setIsProcessingReference(false);
      // Reset input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setNewReferenceContent(content);
      if (!newReferenceTitle.trim()) {
        setNewReferenceTitle(file.name);
      }
    };

    reader.readAsDataURL(file);
  };

  // Code Rules Management
  const addCodeRule = () => {
    if (!newRuleTitle.trim() || !newRuleText.trim()) return;

    const newRule: CodeRule = {
      id: Date.now().toString(),
      title: newRuleTitle.trim(),
      description: newRuleDescription.trim(),
      ruleText: newRuleText.trim(),
      category: newRuleCategory,
      priority: newRulePriority,
      isEnabled: true,
      addedAt: Date.now(),
      tags: newRuleTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
    };

    setCodeRules(prev => [newRule, ...prev]);
    
    // Clear form
    setNewRuleTitle('');
    setNewRuleDescription('');
    setNewRuleText('');
    setNewRuleCategory('general');
    setNewRulePriority('medium');
    setNewRuleTags('');
  };

  const removeCodeRule = (ruleId: string) => {
    setCodeRules(prev => prev.filter(r => r.id !== ruleId));
  };

  const toggleCodeRule = (ruleId: string) => {
    setCodeRules(prev => 
      prev.map(r => r.id === ruleId ? { ...r, isEnabled: !r.isEnabled } : r)
    );
  };

  const duplicateCodeRule = (rule: CodeRule) => {
    const duplicatedRule: CodeRule = {
      ...rule,
      id: Date.now().toString(),
      title: `${rule.title} (Copy)`,
      addedAt: Date.now()
    };
    setCodeRules(prev => [duplicatedRule, ...prev]);
  };

  // Documentation Management
  const addDocumentationItem = () => {
    if (!newDocTitle.trim()) {
      if (newDocType === 'link' && !newDocUrl.trim()) {
        alert('Please enter a URL');
        return;
      }
      if ((newDocType === 'snippet' || newDocType === 'guide') && !newDocContent.trim()) {
        alert('Please enter content');
        return;
      }
      return;
    }

    const newItem: DocumentationItem = {
      id: Date.now().toString(),
      title: newDocTitle.trim(),
      content: newDocContent.trim(),
      url: newDocUrl.trim() || undefined,
      type: newDocType,
      addedAt: Date.now()
    };

    setDocumentationItems(prev => [newItem, ...prev]);
    setNewDocTitle('');
    setNewDocContent('');
    setNewDocUrl('');
  };

  const removeDocumentationItem = (itemId: string) => {
    setDocumentationItems(prev => prev.filter(i => i.id !== itemId));
  };

  // GitHub Guidelines Management
  const addGitHubGuideline = () => {
    if (!newGitHubTitle.trim() || !newGitHubContent.trim()) return;

    const newGuideline: GitHubGuideline = {
      id: Date.now().toString(),
      title: newGitHubTitle.trim(),
      content: newGitHubContent.trim(),
      category: newGitHubCategory,
      addedAt: Date.now()
    };

    setGithubGuidelines(prev => [newGuideline, ...prev]);
    setNewGitHubTitle('');
    setNewGitHubContent('');
  };

  const removeGitHubGuideline = (guidelineId: string) => {
    setGithubGuidelines(prev => prev.filter(g => g.id !== guidelineId));
  };

  // Code Templates Management
  const addCodeTemplate = () => {
    if (!newTemplateName.trim() || !newTemplateCode.trim()) return;

    const newTemplate: CodeTemplate = {
      id: Date.now().toString(),
      name: newTemplateName.trim(),
      description: newTemplateDescription.trim(),
      code: newTemplateCode.trim(),
      language: newTemplateLanguage,
      category: newTemplateCategory,
      tags: newTemplateTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
      addedAt: Date.now()
    };

    setCodeTemplates(prev => [newTemplate, ...prev]);
    setNewTemplateName('');
    setNewTemplateDescription('');
    setNewTemplateCode('');
    setNewTemplateTags('');
  };

  const removeCodeTemplate = (templateId: string) => {
    setCodeTemplates(prev => prev.filter(t => t.id !== templateId));
  };

  // API Endpoints Management
  const addApiEndpoint = () => {
    if (!newApiName.trim() || !newApiPath.trim() || !newApiDescription.trim()) return;

    const newEndpoint: APIEndpoint = {
      id: Date.now().toString(),
      name: newApiName.trim(),
      method: newApiMethod,
      path: newApiPath.trim(),
      description: newApiDescription.trim(),
      requestSchema: newApiRequestSchema.trim() || undefined,
      responseSchema: newApiResponseSchema.trim() || undefined,
      exampleRequest: undefined,
      exampleResponse: undefined,
      addedAt: Date.now()
    };

    setApiEndpoints(prev => [newEndpoint, ...prev]);
    setNewApiName('');
    setNewApiPath('');
    setNewApiDescription('');
    setNewApiRequestSchema('');
    setNewApiResponseSchema('');
  };

  const removeApiEndpoint = (endpointId: string) => {
    setApiEndpoints(prev => prev.filter(e => e.id !== endpointId));
  };

  // Filter rules by category
  const filteredRules = selectedRuleCategory === 'all' 
    ? codeRules 
    : codeRules.filter(rule => rule.category === selectedRuleCategory);

  const ruleCategories = Array.from(new Set(codeRules.map(rule => rule.category)));

  // MOBILE: Toggle card expansion
  const toggleMobileCard = (cardId: string) => {
    setExpandedMobileCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  return (
    <div style={{
      height: '100%',
      width: '100%',
      background: 'var(--bg-dark)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* MOBILE: Tab Selector Modal */}
      {isMobile && showMobileTabSelector && (
        <>
          <div
            onClick={() => setShowMobileTabSelector(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
              backdropFilter: 'blur(2px)'
            }}
          />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: '400px',
            background: 'var(--primary-black)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            zIndex: 1001,
            padding: '1rem'
          }}>
            <h3 style={{
              fontSize: '1.2rem',
              fontWeight: 700,
              color: '#ffffff',
              margin: '0 0 1rem 0',
              textAlign: 'center'
            }}>
              Select Context Type
            </h3>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              {[
                { id: 'reference', icon: '📚', label: 'Reference Materials', count: referenceItems.length },
                { id: 'rules', icon: '📋', label: 'Coding Rules', count: codeRules.filter(r => r.isEnabled).length },
                { id: 'styling', icon: '🎨', label: 'Styling', count: colorPalettes.length + designInspirations.length },
                { id: 'documentation', icon: '📖', label: 'Documentation', count: documentationItems.length },
                { id: 'github', icon: '🐙', label: 'GitHub Guidelines', count: githubGuidelines.length },
                { id: 'templates', icon: '📝', label: 'Code Templates', count: codeTemplates.length },
                { id: 'api', icon: '🔌', label: 'API Endpoints', count: apiEndpoints.length },
                { id: 'agents', icon: '🤖', label: 'Agents', count: 0 }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setShowMobileTabSelector(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    background: activeTab === tab.id
                      ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(16, 185, 129, 0.15))'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: activeTab === tab.id
                      ? '1px solid rgba(255, 107, 53, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: '60px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </div>
                  {tab.count > 0 && (
                    <span style={{
                      background: 'linear-gradient(135deg, #ff6b35, #10b981)',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      borderRadius: '12px',
                      padding: '0.25rem 0.5rem',
                      minWidth: '24px',
                      textAlign: 'center'
                    }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* MAIN PROJECT TAB HEADER - MOBILE RESPONSIVE - UPDATED SIZING */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
        padding: isMobile ? '0.75rem' : '1.5rem',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '0.75rem' : '1rem',
          marginBottom: isMobile ? '0.75rem' : '1rem'
        }}>
          <div style={{
            width: isMobile ? '50px' : '60px',
            height: isMobile ? '50px' : '60px',
            background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isMobile ? '1.5rem' : '1.8rem',
            flexShrink: 0
          }}>
            🧠
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{
              fontSize: isMobile ? '1.25rem' : '1.8rem',
              fontWeight: 700,
              color: '#ffffff',
              margin: 0,
              marginBottom: '0.5rem',
              wordWrap: 'break-word'
            }}>
              Context Management
            </h1>
            <p style={{
              fontSize: isMobile ? '0.8rem' : '0.9rem',
              color: 'var(--text-gray)',
              margin: 0,
              lineHeight: 1.4,
              wordWrap: 'break-word'
            }}>
              Configure reference materials and coding rules to enhance your development workflow
            </p>
          </div>
        </div>

        {/* TAB NAVIGATION - MOBILE RESPONSIVE */}
        {isMobile ? (
          /* MOBILE: Single button to show tab selector */
          <button
            onClick={() => setShowMobileTabSelector(true)}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(16, 185, 129, 0.15))',
              border: '1px solid rgba(255, 107, 53, 0.4)',
              borderRadius: '12px',
              padding: '1rem',
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: '56px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.2rem' }}>
                {activeTab === 'reference' ? '📚' : activeTab === 'rules' ? '📋' : activeTab === 'styling' ? '🎨' : activeTab === 'documentation' ? '📖' : activeTab === 'github' ? '🐙' : activeTab === 'templates' ? '📝' : activeTab === 'api' ? '🔌' : '🤖'}
              </span>
              <span>
                {activeTab === 'reference' ? 'Reference Materials' : activeTab === 'rules' ? 'Coding Rules' : activeTab === 'styling' ? 'Styling' : activeTab === 'documentation' ? 'Documentation' : activeTab === 'github' ? 'GitHub Guidelines' : activeTab === 'templates' ? 'Code Templates' : activeTab === 'api' ? 'API Endpoints' : 'Agents'}
              </span>
            </div>
            <span style={{ fontSize: '1.2rem' }}>▼</span>
          </button>
        ) : (
          /* DESKTOP: Traditional tab buttons */
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '12px',
            padding: '0.5rem',
            display: 'flex',
            gap: '0.5rem',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)'
          }}>
            <SubTabButton
              active={activeTab === 'reference'}
              onClick={() => setActiveTab('reference')}
              icon="📚"
              label="Reference"
              badge={referenceItems.length > 0 ? referenceItems.length : undefined}
            />
            <SubTabButton
              active={activeTab === 'rules'}
              onClick={() => setActiveTab('rules')}
              icon="📋"
              label="Rules"
              badge={codeRules.filter(r => r.isEnabled).length > 0 ? codeRules.filter(r => r.isEnabled).length : undefined}
            />
            <SubTabButton
              active={activeTab === 'styling'}
              onClick={() => setActiveTab('styling')}
              icon="🎨"
              label="Styling"
              badge={colorPalettes.length + designInspirations.length > 0 ? colorPalettes.length + designInspirations.length : undefined}
            />
            <SubTabButton
              active={activeTab === 'documentation'}
              onClick={() => setActiveTab('documentation')}
              icon="📖"
              label="Docs"
              badge={documentationItems.length > 0 ? documentationItems.length : undefined}
            />
            <SubTabButton
              active={activeTab === 'github'}
              onClick={() => setActiveTab('github')}
              icon="🐙"
              label="GitHub"
              badge={githubGuidelines.length > 0 ? githubGuidelines.length : undefined}
            />
            <SubTabButton
              active={activeTab === 'templates'}
              onClick={() => setActiveTab('templates')}
              icon="📝"
              label="Templates"
              badge={codeTemplates.length > 0 ? codeTemplates.length : undefined}
            />
            <SubTabButton
              active={activeTab === 'api'}
              onClick={() => setActiveTab('api')}
              icon="🔌"
              label="API"
              badge={apiEndpoints.length > 0 ? apiEndpoints.length : undefined}
            />
            <SubTabButton
              active={activeTab === 'agents'}
              onClick={() => setActiveTab('agents')}
              icon="🤖"
              label="Agents"
              badge={undefined}
            />
          </div>
        )}
      </div>

      {/* CONTENT AREA - MOBILE RESPONSIVE */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        background: 'rgba(0, 0, 0, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderTop: 'none',
        padding: isMobile ? '1rem' : '2rem'
      }}>
        {activeTab === 'reference' ? (
          <ReferenceTab
            items={referenceItems}
            newType={newReferenceType}
            setNewType={setNewReferenceType}
            newTitle={newReferenceTitle}
            setNewTitle={setNewReferenceTitle}
            newContent={newReferenceContent}
            setNewContent={setNewReferenceContent}
            newUrl={newReferenceUrl}
            setNewUrl={setNewReferenceUrl}
            isProcessing={isProcessingReference}
            onAddItem={addReferenceItem}
            onRemoveItem={removeReferenceItem}
            onFileUpload={handleFileUpload}
            onImageUpload={handleImageUpload}
            fileInputRef={fileInputRef}
            imageInputRef={imageInputRef}
            isMobile={isMobile}
            expandedCards={expandedMobileCards}
            onToggleCard={toggleMobileCard}
          />
        ) : activeTab === 'rules' ? (
          <RulesTab
            rules={filteredRules}
            newTitle={newRuleTitle}
            setNewTitle={setNewRuleTitle}
            newDescription={newRuleDescription}
            setNewDescription={setNewRuleDescription}
            newRuleText={newRuleText}
            setNewRuleText={setNewRuleText}
            newCategory={newRuleCategory}
            setNewCategory={setNewRuleCategory}
            newPriority={newRulePriority}
            setNewPriority={setNewRulePriority}
            newTags={newRuleTags}
            setNewTags={setNewRuleTags}
            categories={ruleCategories}
            selectedCategory={selectedRuleCategory}
            onCategoryChange={setSelectedRuleCategory}
            onAddRule={addCodeRule}
            onRemoveRule={removeCodeRule}
            onToggleRule={toggleCodeRule}
            onDuplicateRule={duplicateCodeRule}
            isMobile={isMobile}
            expandedCards={expandedMobileCards}
            onToggleCard={toggleMobileCard}
          />
        ) : activeTab === 'styling' ? (
          <StylingTab
            colorPalettes={colorPalettes}
            setColorPalettes={setColorPalettes}
            designInspirations={designInspirations}
            setDesignInspirations={setDesignInspirations}
            newCoolorsUrl={newCoolorsUrl}
            setNewCoolorsUrl={setNewCoolorsUrl}
            newSiteUrl={newSiteUrl}
            setNewSiteUrl={setNewSiteUrl}
            isMobile={isMobile}
            expandedCards={expandedMobileCards}
            onToggleCard={toggleMobileCard}
          />
        ) : activeTab === 'documentation' ? (
          <DocumentationTab
            items={documentationItems}
            newTitle={newDocTitle}
            setNewTitle={setNewDocTitle}
            newContent={newDocContent}
            setNewContent={setNewDocContent}
            newUrl={newDocUrl}
            setNewUrl={setNewDocUrl}
            newType={newDocType}
            setNewType={setNewDocType}
            onAddItem={addDocumentationItem}
            onRemoveItem={removeDocumentationItem}
            isMobile={isMobile}
            expandedCards={expandedMobileCards}
            onToggleCard={toggleMobileCard}
          />
        ) : activeTab === 'github' ? (
          <GitHubTab
            guidelines={githubGuidelines}
            newTitle={newGitHubTitle}
            setNewTitle={setNewGitHubTitle}
            newContent={newGitHubContent}
            setNewContent={setNewGitHubContent}
            newCategory={newGitHubCategory}
            setNewCategory={setNewGitHubCategory}
            onAddGuideline={addGitHubGuideline}
            onRemoveGuideline={removeGitHubGuideline}
            isMobile={isMobile}
            expandedCards={expandedMobileCards}
            onToggleCard={toggleMobileCard}
          />
        ) : activeTab === 'templates' ? (
          <TemplatesTab
            templates={codeTemplates}
            newName={newTemplateName}
            setNewName={setNewTemplateName}
            newDescription={newTemplateDescription}
            setNewDescription={setNewTemplateDescription}
            newCode={newTemplateCode}
            setNewCode={setNewTemplateCode}
            newLanguage={newTemplateLanguage}
            setNewLanguage={setNewTemplateLanguage}
            newCategory={newTemplateCategory}
            setNewCategory={setNewTemplateCategory}
            newTags={newTemplateTags}
            setNewTags={setNewTemplateTags}
            onAddTemplate={addCodeTemplate}
            onRemoveTemplate={removeCodeTemplate}
            isMobile={isMobile}
            expandedCards={expandedMobileCards}
            onToggleCard={toggleMobileCard}
          />
        ) : activeTab === 'api' ? (
          <ApiEndpointsTab
            endpoints={apiEndpoints}
            newName={newApiName}
            setNewName={setNewApiName}
            newMethod={newApiMethod}
            setNewMethod={setNewApiMethod}
            newPath={newApiPath}
            setNewPath={setNewApiPath}
            newDescription={newApiDescription}
            setNewDescription={setNewApiDescription}
            newRequestSchema={newApiRequestSchema}
            setNewRequestSchema={setNewApiRequestSchema}
            newResponseSchema={newApiResponseSchema}
            setNewResponseSchema={setNewApiResponseSchema}
            onAddEndpoint={addApiEndpoint}
            onRemoveEndpoint={removeApiEndpoint}
            isMobile={isMobile}
            expandedCards={expandedMobileCards}
            onToggleCard={toggleMobileCard}
          />
        ) : (
          <AgentsTab isMobile={isMobile} />
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// SUB-TAB BUTTON - Distinct from main project tabs
// ============================================================================

const SubTabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  badge?: number;
}> = ({ active, onClick, icon, label, badge }) => (
  <button
    onClick={onClick}
    style={{
      flex: 1,
      padding: '0.75rem 1.25rem',
      background: active 
        ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(16, 185, 129, 0.15))'
        : 'rgba(255, 255, 255, 0.05)',
      border: active 
        ? '1px solid rgba(255, 107, 53, 0.4)'
        : '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      color: active ? '#ffffff' : '#9ca3af',
      fontSize: '0.9rem',
      fontWeight: active ? 700 : 500,
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      position: 'relative',
      boxShadow: active 
        ? '0 4px 12px rgba(255, 107, 53, 0.15), inset 0 1px 2px rgba(255, 255, 255, 0.1)'
        : 'none'
    }}
    onMouseEnter={(e) => {
      if (!active) {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        e.currentTarget.style.color = '#cccccc';
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        e.currentTarget.style.color = '#9ca3af';
      }
    }}
  >
    <span style={{ 
      fontSize: '1.1rem',
      filter: active ? 'drop-shadow(0 2px 4px rgba(255, 107, 53, 0.4))' : 'none'
    }}>{icon}</span>
    <span>{label}</span>
    {badge && (
      <span style={{
        position: 'absolute',
        top: '-6px',
        right: '-6px',
        background: 'linear-gradient(135deg, #ff6b35, #10b981)',
        color: '#ffffff',
        fontSize: '0.7rem',
        fontWeight: 700,
        borderRadius: '10px',
        padding: '0.15rem 0.4rem',
        minWidth: '18px',
        height: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)'
      }}>
        {badge}
      </span>
    )}
  </button>
);

// ============================================================================
// REFERENCE TAB - MOBILE RESPONSIVE
// ============================================================================

const ReferenceTab: React.FC<{
  items: ReferenceItem[];
  newType: 'file' | 'image' | 'website';
  setNewType: (type: 'file' | 'image' | 'website') => void;
  newTitle: string;
  setNewTitle: (title: string) => void;
  newContent: string;
  setNewContent: (content: string) => void;
  newUrl: string;
  setNewUrl: (url: string) => void;
  isProcessing: boolean;
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  imageInputRef: React.RefObject<HTMLInputElement>;
  isMobile: boolean;
  expandedCards: Record<string, boolean>;
  onToggleCard: (cardId: string) => void;
}> = ({
  items,
  newType,
  setNewType,
  newTitle,
  setNewTitle,
  newContent,
  setNewContent,
  newUrl,
  setNewUrl,
  isProcessing,
  onAddItem,
  onRemoveItem,
  onFileUpload,
  onImageUpload,
  fileInputRef,
  imageInputRef,
  isMobile,
  expandedCards,
  onToggleCard
}) => (
  <>
    {/* Add Reference Form - MOBILE RESPONSIVE */}
    <div style={{
      marginBottom: isMobile ? '1.5rem' : '2rem',
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      maxWidth: '1400px',
      marginLeft: 'auto',
      marginRight: 'auto'
    }}>
      <h3 style={{
        color: '#ffffff',
        fontSize: isMobile ? '1rem' : '1.1rem',
        fontWeight: 700,
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <span style={{ fontSize: isMobile ? '1.1rem' : '1.2rem' }}>➕</span>
        Add Reference Material
      </h3>

      {/* Type Selector - MOBILE: Stack vertically */}
      <div style={{
        display: isMobile ? 'grid' : 'flex',
        gap: '0.4rem',
        marginBottom: '0.75rem',
        gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : undefined,
      }}>
        {([
          { type: 'file' as const, icon: '📎', label: 'Files' },
          { type: 'image' as const, icon: '🖼️', label: 'Images' },
          { type: 'website' as const, icon: '🌐', label: 'Websites' }
        ]).map(({ type, icon, label }) => (
          <button
            key={type}
            onClick={() => setNewType(type)}
            style={{
              padding: isMobile ? '0.75rem' : '0.5rem 0.75rem',
              background: newType === type 
                ? 'linear-gradient(135deg, #ff6b35, #10b981)'
                : 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: isMobile ? '0.9rem' : '0.85rem',
              fontWeight: 500,
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              minHeight: isMobile ? '48px' : 'auto'
            }}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Title Input */}
      <input
        type="text"
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        placeholder="Enter a title for this reference..."
        style={{
          width: '100%',
          padding: isMobile ? '0.875rem' : '0.75rem',
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '10px',
          color: '#ffffff',
          fontSize: isMobile ? '1rem' : '0.9rem',
          outline: 'none',
          marginBottom: '0.75rem',
          minHeight: isMobile ? '48px' : 'auto'
        }}
      />

      {/* Content Input Based on Type */}
      {newType === 'file' && (
        <div style={{
          border: '2px dashed rgba(255, 255, 255, 0.3)',
            borderRadius: '10px',
          padding: isMobile ? '2rem 1rem' : '1.5rem',
          textAlign: 'center',
            marginBottom: '0.75rem',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          minHeight: isMobile ? '120px' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={() => fileInputRef.current?.click()}
        onMouseEnter={(e) => {
          if (!isMobile) {
            e.currentTarget.style.borderColor = '#ff6b35';
            e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isMobile) {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            e.currentTarget.style.background = 'transparent';
          }
        }}
        >
          <div style={{ fontSize: isMobile ? '3rem' : '2.5rem', marginBottom: '0.75rem' }}>📎</div>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '1rem' : '0.9rem', margin: 0, marginBottom: '0.5rem' }}>
            {isMobile ? 'Tap to select file' : 'Click to select a file'}
          </p>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.75rem', margin: 0 }}>
            PDF, Word, Excel, PowerPoint, Text, Markdown, CSV
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.ppt,.pptx,.json,.js,.jsx,.ts,.tsx,.html,.css,.scss,.sass,.less,.py,.java,.cpp,.c,.go,.rs,.rb,.php,.swift,.kt,.sh,.bash,.yml,.yaml,.toml,.ini,.env,.xml,.log,.sql,.rtf,.odt,.ods,.odp"
            onChange={onFileUpload}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {newType === 'image' && (
        <div style={{
          border: '2px dashed rgba(255, 255, 255, 0.3)',
          borderRadius: '10px',
          padding: isMobile ? '2rem 1rem' : '1.5rem',
          textAlign: 'center',
          marginBottom: '0.75rem',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          minHeight: isMobile ? '120px' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={() => imageInputRef.current?.click()}
        onMouseEnter={(e) => {
          if (!isMobile) {
            e.currentTarget.style.borderColor = '#ff6b35';
            e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isMobile) {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            e.currentTarget.style.background = 'transparent';
          }
        }}
        >
          <div style={{ fontSize: isMobile ? '3rem' : '2.5rem', marginBottom: '0.75rem' }}>🖼️</div>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '1rem' : '0.9rem', margin: 0, marginBottom: '0.5rem' }}>
            {isMobile ? 'Tap to select image' : 'Click to select an image'}
          </p>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.75rem', margin: 0 }}>
            JPEG, PNG, GIF, WebP
          </p>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={onImageUpload}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {newType === 'website' && (
        <input
          type="url"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="Enter website URL (e.g., https://docs.example.com)"
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '0.9rem',
            outline: 'none',
            marginBottom: '0.75rem',
            minHeight: isMobile ? '48px' : 'auto'
          }}
        />
      )}

      {/* Add Button */}
      <button
        onClick={onAddItem}
        disabled={!newTitle.trim() || isProcessing || 
          ((newType === 'file' || newType === 'image') && !newContent.trim()) ||
          (newType === 'website' && !newUrl.trim())}
        style={{
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#ffffff',
          padding: isMobile ? '0.875rem 1.5rem' : '0.75rem 1.5rem',
          borderRadius: '10px',
          border: 'none',
          fontSize: isMobile ? '1rem' : '0.9rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          opacity: (!newTitle.trim() || isProcessing) ? 0.6 : 1,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          minHeight: isMobile ? '48px' : 'auto',
          width: isMobile ? '100%' : 'auto',
          justifyContent: 'center'
        }}
        onMouseEnter={(e) => {
          if (!e.currentTarget.disabled && !isMobile) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.3)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isMobile) {
            e.currentTarget.style.transform = '';
            e.currentTarget.style.boxShadow = '';
          }
        }}
      >
        {isProcessing ? <>⏳ Processing...</> : <>➕ Add Reference</>}
      </button>
    </div>

    {/* Reference Items List - MOBILE RESPONSIVE */}
    {items.length > 0 && (
      <div style={{
        maxWidth: '1400px',
        marginLeft: 'auto',
        marginRight: 'auto'
      }}>
        <h3 style={{
          color: '#ffffff',
          fontSize: isMobile ? '1rem' : '1.1rem',
          fontWeight: 700,
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: isMobile ? '1.1rem' : '1.2rem' }}>📚</span>
          Reference Library ({items.length})
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '0.75rem'
        }}>
          {items.map((item) => (
            <ReferenceItemCard
              key={item.id}
              item={item}
              onRemove={onRemoveItem}
              isMobile={isMobile}
              isExpanded={expandedCards[`ref-${item.id}`]}
              onToggle={() => onToggleCard(`ref-${item.id}`)}
            />
          ))}
        </div>
      </div>
    )}

    {/* Empty State */}
    {items.length === 0 && (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1rem',
        padding: isMobile ? '3rem 1rem' : '3rem',
        color: 'var(--text-gray)',
        textAlign: 'center',
        maxWidth: '1400px',
        marginLeft: 'auto',
        marginRight: 'auto'
      }}>
        <div style={{ fontSize: isMobile ? '2.5rem' : '3rem', opacity: 0.5 }}>📚</div>
        <h3 style={{ fontSize: isMobile ? '1.2rem' : '1.5rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
          No Reference Materials
        </h3>
        <p style={{ fontSize: isMobile ? '1rem' : '1rem', lineHeight: 1.6, margin: 0, opacity: 0.8 }}>
          Add files, images, or websites to provide context for AI assistance.
        </p>
      </div>
    )}
  </>
);

// ============================================================================
// REFERENCE ITEM CARD - MOBILE RESPONSIVE
// ============================================================================

const ReferenceItemCard: React.FC<{
  item: ReferenceItem;
  onRemove: (itemId: string) => void;
  isMobile: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}> = ({ item, onRemove, isMobile, isExpanded = false, onToggle }) => {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'file': return '📎';
      case 'image': return '🖼️';
      case 'website': return '🌐';
      default: return '📄';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'file': return '#10b981';
      case 'image': return '#8b5cf6';
      case 'website': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
      transition: 'all 0.3s ease'
    }}
    onMouseEnter={(e) => {
      if (!isMobile) {
        e.currentTarget.style.borderColor = getTypeColor(item.type);
        e.currentTarget.style.background = `${getTypeColor(item.type)}15`;
      }
    }}
    onMouseLeave={(e) => {
      if (!isMobile) {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
      }
    }}
    >
      {/* MOBILE: Collapsible header */}
      {isMobile ? (
        <div
          onClick={onToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            marginBottom: isExpanded ? '1rem' : '0'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: `linear-gradient(135deg, ${getTypeColor(item.type)}, ${getTypeColor(item.type)}CC)`,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              flexShrink: 0
            }}>
              {getTypeIcon(item.type)}
            </div>
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: 600,
                margin: 0,
                lineHeight: 1.2
              }}>
                {item.title}
              </h4>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '0.25rem',
                fontSize: '0.8rem'
              }}>
                <span style={{
                  background: `${getTypeColor(item.type)}30`,
                  color: getTypeColor(item.type),
                  padding: '0.2rem 0.4rem',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  textTransform: 'capitalize'
                }}>
                  {item.type === 'file' ? 'File' : item.type === 'image' ? 'Image' : 'Website'}
                </span>
                <span style={{ color: '#9ca3af' }}>
                  {formatSize(item.size)}
                </span>
              </div>
            </div>
          </div>

          <span style={{
            fontSize: '1rem',
            color: 'var(--text-gray)',
            transition: 'transform 0.2s ease',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
          }}>
            ▶
          </span>
        </div>
      ) : (
        /* DESKTOP: Always expanded header */
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          marginBottom: '0.75rem'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            background: `linear-gradient(135deg, ${getTypeColor(item.type)}, ${getTypeColor(item.type)}CC)`,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            flexShrink: 0
          }}>
            {getTypeIcon(item.type)}
          </div>
          
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{
              color: '#ffffff',
              fontSize: '0.95rem',
              fontWeight: 600,
              margin: 0,
              marginBottom: '0.25rem'
            }}>
              {item.title}
            </h4>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.5rem',
              flexWrap: 'wrap'
            }}>
              <span style={{
                background: `${getTypeColor(item.type)}30`,
                color: getTypeColor(item.type),
                padding: '0.2rem 0.4rem',
                borderRadius: '6px',
                fontSize: '0.7rem',
                fontWeight: 500,
                textTransform: 'capitalize'
              }}>
                {item.type === 'file' ? 'File' : item.type === 'image' ? 'Image' : 'Website'}
              </span>
              
              <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                {formatSize(item.size)}
              </span>
              
              <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                {new Date(item.addedAt).toLocaleDateString()}
              </span>
            </div>
            
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: getTypeColor(item.type),
                  fontSize: '0.8rem',
                  textDecoration: 'none'
                }}
              >
                🔗 {item.url}
              </a>
            )}
          </div>

          <button
            onClick={() => onRemove(item.id)}
            style={{
              width: '32px',
              height: '32px',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              color: '#ef4444',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              transition: 'all 0.2s ease',
              flexShrink: 0
            }}
            title="Remove reference"
          >
            🗑️
          </button>
        </div>
      )}

      {/* Expandable content */}
      {(!isMobile || isExpanded) && (
        <>
          {/* Mobile: Show metadata when expanded */}
          {isMobile && (
            <>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: getTypeColor(item.type),
                    fontSize: '0.9rem',
                    textDecoration: 'none',
                    display: 'block',
                    marginBottom: '1rem',
                    wordBreak: 'break-all'
                  }}
                >
                  🔗 {item.url}
                </a>
              )}
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                color: '#9ca3af'
              }}>
                <span>{new Date(item.addedAt).toLocaleDateString()}</span>
                <span>•</span>
                <span>{formatSize(item.size)}</span>
              </div>
            </>
          )}

          {/* Preview */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '8px',
            padding: isMobile ? '0.75rem' : '0.6rem',
            fontSize: isMobile ? '0.85rem' : '0.8rem',
            color: '#9ca3af',
            maxHeight: isMobile ? '120px' : '80px',
            overflow: 'hidden',
            position: 'relative',
            marginBottom: isMobile ? '1rem' : '0'
          }}>
            {item.type === 'image' ? (
              <img 
                src={item.content} 
                alt={item.title}
                style={{
                  maxWidth: '100%',
                  maxHeight: isMobile ? '100px' : '65px',
                  borderRadius: '4px'
                }}
              />
            ) : (
              <pre style={{
                fontFamily: 'inherit',
                fontSize: 'inherit',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word'
              }}>
                {item.extractedText || item.content}
              </pre>
            )}
            
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '15px',
              background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.8))',
              pointerEvents: 'none'
            }} />
          </div>

          {/* Mobile: Remove button */}
          {isMobile && (
            <button
              onClick={() => onRemove(item.id)}
              style={{
                width: '100%',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                color: '#ef4444',
                cursor: 'pointer',
                padding: '0.75rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                minHeight: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              🗑️ Remove Reference
            </button>
          )}
        </>
      )}
    </div>
  );
};

// ============================================================================
// RULES TAB - MOBILE RESPONSIVE
// ============================================================================

const RulesTab: React.FC<{
  rules: CodeRule[];
  newTitle: string;
  setNewTitle: (title: string) => void;
  newDescription: string;
  setNewDescription: (description: string) => void;
  newRuleText: string;
  setNewRuleText: (text: string) => void;
  newCategory: CodeRule['category'];
  setNewCategory: (category: CodeRule['category']) => void;
  newPriority: CodeRule['priority'];
  setNewPriority: (priority: CodeRule['priority']) => void;
  newTags: string;
  setNewTags: (tags: string) => void;
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  onAddRule: () => void;
  onRemoveRule: (ruleId: string) => void;
  onToggleRule: (ruleId: string) => void;
  onDuplicateRule: (rule: CodeRule) => void;
  isMobile: boolean;
  expandedCards: Record<string, boolean>;
  onToggleCard: (cardId: string) => void;
}> = ({
  rules,
  newTitle,
  setNewTitle,
  newDescription,
  setNewDescription,
  newRuleText,
  setNewRuleText,
  newCategory,
  setNewCategory,
  newPriority,
  setNewPriority,
  newTags,
  setNewTags,
  categories,
  selectedCategory,
  onCategoryChange,
  onAddRule,
  onRemoveRule,
  onToggleRule,
  onDuplicateRule,
  isMobile,
  expandedCards,
  onToggleCard
}) => {
  const ruleCategories = [
    { value: 'architecture' as const, label: 'Architecture', icon: '🏗️', color: '#3b82f6' },
    { value: 'styling' as const, label: 'Styling', icon: '🎨', color: '#8b5cf6' },
    { value: 'patterns' as const, label: 'Patterns', icon: '🔄', color: '#10b981' },
    { value: 'naming' as const, label: 'Naming', icon: '🏷️', color: '#f59e0b' },
    { value: 'testing' as const, label: 'Testing', icon: '🧪', color: '#06b6d4' },
    { value: 'performance' as const, label: 'Performance', icon: '⚡', color: '#84cc16' },
    { value: 'security' as const, label: 'Security', icon: '🔐', color: '#ef4444' },
    { value: 'accessibility' as const, label: 'Accessibility', icon: '♿', color: '#6366f1' },
    { value: 'general' as const, label: 'General', icon: '📋', color: '#6b7280' }
  ];

  const priorityLevels = [
    { value: 'low' as const, label: 'Low', color: '#6b7280' },
    { value: 'medium' as const, label: 'Medium', color: '#f59e0b' },
    { value: 'high' as const, label: 'High', color: '#ef4444' },
    { value: 'critical' as const, label: 'Critical', color: '#dc2626' }
  ];

  return (
    <>
      {/* Add Rule Form - MOBILE RESPONSIVE */}
      <div style={{
        marginBottom: isMobile ? '1.5rem' : '2rem',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.5rem',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        maxWidth: '1400px',
        marginLeft: 'auto',
        marginRight: 'auto'
      }}>
        <h3 style={{
          color: '#ffffff',
          fontSize: isMobile ? '1rem' : '1.1rem',
          fontWeight: 700,
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: isMobile ? '1.1rem' : '1.2rem' }}>➕</span>
          Add Coding Rule
        </h3>

        {/* Title Input */}
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Rule title (e.g., 'Always use TypeScript interfaces for props')"
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '0.9rem',
            outline: 'none',
            marginBottom: '0.75rem',
            minHeight: isMobile ? '48px' : 'auto'
          }}
        />

        {/* Description Input */}
        <input
          type="text"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="Brief description of when and why this rule applies (optional)"
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '0.9rem',
            outline: 'none',
            marginBottom: '0.75rem',
            minHeight: isMobile ? '48px' : 'auto'
          }}
        />

        {/* Rule Text */}
        <textarea
          value={newRuleText}
          onChange={(e) => setNewRuleText(e.target.value)}
          placeholder="Detailed rule description and guidelines..."
          rows={isMobile ? 3 : 4}
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '0.9rem',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
            marginBottom: '0.75rem',
            minHeight: isMobile ? '100px' : 'auto'
          }}
        />

        {/* Category and Priority Selection - MOBILE: Stack vertically */}
        <div style={{
          display: isMobile ? 'flex' : 'grid',
          flexDirection: isMobile ? 'column' : undefined,
          gridTemplateColumns: isMobile ? undefined : 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
          marginBottom: '0.75rem'
        }}>
          {/* Category Selector */}
          <div>
            <label style={{
              display: 'block',
              color: '#ffffff',
              fontSize: isMobile ? '0.9rem' : '0.85rem',
              fontWeight: 600,
              marginBottom: '0.5rem'
            }}>
              Category
            </label>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.4rem'
            }}>
              {ruleCategories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setNewCategory(cat.value)}
                  style={{
                    padding: isMobile ? '0.75rem 1rem' : '0.4rem 0.75rem',
                    background: newCategory === cat.value
                      ? `linear-gradient(135deg, ${cat.color}, ${cat.color}CC)`
                      : 'rgba(255, 255, 255, 0.1)',
                    border: `1px solid ${newCategory === cat.value ? cat.color : 'rgba(255, 255, 255, 0.2)'}`,
                    borderRadius: '8px',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: isMobile ? '0.9rem' : '0.8rem',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    minHeight: isMobile ? '44px' : 'auto'
                  }}
                >
                  <span style={{ fontSize: isMobile ? '1rem' : '0.85rem' }}>{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority Selector */}
          <div>
            <label style={{
              display: 'block',
              color: '#ffffff',
              fontSize: isMobile ? '0.9rem' : '0.85rem',
              fontWeight: 600,
              marginBottom: '0.5rem'
            }}>
              Priority
            </label>
            <div style={{
              display: 'flex',
              gap: '0.4rem',
              flexWrap: 'wrap'
            }}>
              {priorityLevels.map((priority) => (
                <button
                  key={priority.value}
                  onClick={() => setNewPriority(priority.value)}
                  style={{
                    padding: isMobile ? '0.75rem 1rem' : '0.4rem 0.75rem',
                    background: newPriority === priority.value
                      ? `linear-gradient(135deg, ${priority.color}, ${priority.color}CC)`
                      : 'rgba(255, 255, 255, 0.1)',
                    border: `1px solid ${newPriority === priority.value ? priority.color : 'rgba(255, 255, 255, 0.2)'}`,
                    borderRadius: '8px',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: isMobile ? '0.9rem' : '0.8rem',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                    textTransform: 'capitalize',
                    minHeight: isMobile ? '44px' : 'auto'
                  }}
                >
                  {priority.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tags Input */}
        <input
          type="text"
          value={newTags}
          onChange={(e) => setNewTags(e.target.value)}
          placeholder="Tags (comma-separated, e.g., 'react, typescript, props')"
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '0.9rem',
            outline: 'none',
            marginBottom: '1rem',
            minHeight: isMobile ? '48px' : 'auto'
          }}
        />

        {/* Add Button */}
        <button
          onClick={onAddRule}
          disabled={!newTitle.trim() || !newRuleText.trim()}
          style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#ffffff',
            padding: isMobile ? '0.875rem 1.5rem' : '0.75rem 1.5rem',
            borderRadius: '10px',
            border: 'none',
            fontSize: isMobile ? '1rem' : '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            opacity: (!newTitle.trim() || !newRuleText.trim()) ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            minHeight: isMobile ? '48px' : 'auto',
            width: isMobile ? '100%' : 'auto',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled && !isMobile) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.3)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isMobile) {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = '';
            }
          }}
        >
          ➕ Add Rule
        </button>
      </div>

      {/* Category Filter - MOBILE: Horizontal scroll */}
      {categories.length > 0 && (
        <div style={{
          marginBottom: '1.5rem',
          maxWidth: '1400px',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          <div style={{
            display: 'flex',
            gap: '0.4rem',
            ...(isMobile && {
              overflowX: 'auto',
              paddingBottom: '0.5rem'
            })
          }}>
            <CategoryButton
              active={selectedCategory === 'all'}
              onClick={() => onCategoryChange('all')}
              label="All Rules"
              isMobile={isMobile}
            />
            {categories.map((category) => {
              const categoryData = ruleCategories.find(c => c.value === category);
              return (
                <button
                  key={category}
                  onClick={() => onCategoryChange(category)}
                  style={{
                    padding: isMobile ? '0.75rem 1rem' : '0.4rem 0.75rem',
                    background: selectedCategory === category
                      ? `linear-gradient(135deg, ${categoryData?.color || '#6b7280'}, ${categoryData?.color || '#6b7280'}CC)`
                      : 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: isMobile ? '0.9rem' : '0.8rem',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                    textTransform: 'capitalize',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    whiteSpace: 'nowrap',
                    minHeight: isMobile ? '44px' : 'auto'
                  }}
                >
                  <span style={{ fontSize: isMobile ? '1rem' : '0.85rem' }}>{categoryData?.icon || '📋'}</span>
                  {categoryData?.label || category}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Rules List - MOBILE RESPONSIVE */}
      {rules.length > 0 && (
        <div style={{
          maxWidth: '1400px',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          <h3 style={{
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '1.1rem',
            fontWeight: 700,
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: isMobile ? '1.1rem' : '1.2rem' }}>📋</span>
            Coding Rules ({rules.length}) - {rules.filter(r => r.isEnabled).length} Active
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '1rem'
          }}>
            {rules.map((rule) => (
              <CodeRuleCard
                key={rule.id}
                rule={rule}
                onToggleActive={onToggleRule}
                onRemove={onRemoveRule}
                onDuplicate={onDuplicateRule}
                categoryData={ruleCategories.find(c => c.value === rule.category)}
                priorityData={priorityLevels.find(p => p.value === rule.priority)}
                isMobile={isMobile}
                isExpanded={expandedCards[`rule-${rule.id}`]}
                onToggle={() => onToggleCard(`rule-${rule.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {rules.length === 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '1rem',
          padding: isMobile ? '3rem 1rem' : '3rem',
          color: '#9ca3af',
          textAlign: 'center',
          maxWidth: '1400px',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          <div style={{ fontSize: isMobile ? '2.5rem' : '3rem', opacity: 0.5 }}>📋</div>
          <h3 style={{ fontSize: isMobile ? '1.2rem' : '1.5rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
            No Coding Rules Yet
          </h3>
          <p style={{ fontSize: isMobile ? '1rem' : '1rem', lineHeight: 1.6, maxWidth: '500px', margin: 0, opacity: 0.8 }}>
            Create coding rules to guide AI code generation. Rules help ensure consistent style, patterns, and best practices across your project.
          </p>
          <div style={{
            background: 'rgba(255, 107, 53, 0.1)',
            border: '1px solid rgba(255, 107, 53, 0.3)',
            borderRadius: '8px',
            padding: '1rem',
            marginTop: '1rem',
            maxWidth: isMobile ? '100%' : '600px'
          }}>
            <h4 style={{ color: '#ff6b35', fontSize: isMobile ? '1rem' : '0.9rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
              💡 Example Rules:
            </h4>
            <ul style={{ 
              color: '#9ca3af', 
              fontSize: isMobile ? '0.9rem' : '0.85rem', 
              margin: 0, 
              paddingLeft: '1.5rem', 
              lineHeight: 1.5,
              textAlign: 'left'
            }}>
              <li>"Always use TypeScript interfaces instead of types for component props"</li>
              <li>"Components should be functional with hooks, avoid class components"</li>
              <li>"Use semantic HTML elements for better accessibility"</li>
              <li>"Follow BEM naming convention for CSS classes"</li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
};

// ============================================================================
// CATEGORY BUTTON - MOBILE RESPONSIVE
// ============================================================================

const CategoryButton: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  isMobile: boolean;
}> = ({ active, onClick, label, isMobile }) => (
  <button
    onClick={onClick}
    style={{
      padding: isMobile ? '0.75rem 1rem' : '0.4rem 0.75rem',
      background: active
        ? 'linear-gradient(135deg, #ff6b35, #10b981)'
        : 'rgba(255, 255, 255, 0.1)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      color: '#ffffff',
      cursor: 'pointer',
      fontSize: isMobile ? '0.9rem' : '0.8rem',
      fontWeight: 500,
      transition: 'all 0.2s ease',
      textTransform: 'capitalize',
      whiteSpace: 'nowrap',
      minHeight: isMobile ? '48px' : 'auto'
    }}
  >
    {label}
  </button>
);

// ============================================================================
// CODE RULE CARD - MOBILE RESPONSIVE
// ============================================================================

const CodeRuleCard: React.FC<{
  rule: CodeRule;
  onToggleActive: (ruleId: string) => void;
  onRemove: (ruleId: string) => void;
  onDuplicate: (rule: CodeRule) => void;
  categoryData?: { value: string; label: string; icon: string; color: string };
  priorityData?: { value: string; label: string; color: string };
  isMobile: boolean;
  isExpanded?: boolean;
  onToggle: () => void;
}> = ({ rule, onToggleActive: onToggleRule, onRemove, onDuplicate, categoryData, priorityData, isMobile, isExpanded = false, onToggle }) => (
  <div style={{
    background: rule.isEnabled 
      ? 'rgba(16, 185, 129, 0.1)' 
      : 'rgba(255, 255, 255, 0.05)',
    border: `1px solid ${rule.isEnabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
    borderRadius: '12px',
    padding: isMobile ? '1rem' : '1.25rem',
    transition: 'all 0.3s ease',
    opacity: rule.isEnabled ? 1 : 0.7
  }}>
    {/* MOBILE: Collapsible header */}
    {isMobile ? (
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          marginBottom: isExpanded ? '1rem' : '0'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: rule.isEnabled 
              ? `linear-gradient(135deg, ${categoryData?.color || '#6b7280'}, ${categoryData?.color || '#6b7280'}CC)`
              : 'rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            flexShrink: 0
          }}>
            {rule.isEnabled ? (categoryData?.icon || '📋') : '💤'}
          </div>
          
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: 600,
              margin: 0,
              lineHeight: 1.3
            }}>
              {rule.title}
            </h4>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '0.25rem'
            }}>
              <span style={{
                background: `${categoryData?.color || '#6b7280'}30`,
                color: categoryData?.color || '#6b7280',
                padding: '0.2rem 0.4rem',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: 500
              }}>
                {categoryData?.label || rule.category}
              </span>
              <span style={{
                background: `${priorityData?.color || '#6b7280'}30`,
                color: priorityData?.color || '#6b7280',
                padding: '0.2rem 0.4rem',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: 600,
                textTransform: 'uppercase'
              }}>
                {rule.priority}
              </span>
            </div>
          </div>
        </div>

        <span style={{
          fontSize: '1rem',
          color: 'var(--text-gray)',
          transition: 'transform 0.2s ease',
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
        }}>
          ▶
        </span>
      </div>
    ) : (
      /* DESKTOP: Always expanded header */
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        marginBottom: '1rem'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          background: rule.isEnabled 
            ? `linear-gradient(135deg, ${categoryData?.color || '#6b7280'}, ${categoryData?.color || '#6b7280'}CC)`
            : 'rgba(255, 255, 255, 0.2)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem',
          flexShrink: 0
        }}>
          {rule.isEnabled ? (categoryData?.icon || '📋') : '💤'}
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{
            color: '#ffffff',
            fontSize: '1rem',
            fontWeight: 600,
            margin: 0,
            marginBottom: '0.25rem',
            lineHeight: 1.3
          }}>
            {rule.title}
          </h4>
          
          {rule.description && (
            <p style={{
              color: '#9ca3af',
              fontSize: '0.85rem',
              margin: 0,
              lineHeight: 1.4
            }}>
              {rule.description}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem'
        }}>
          <button
            onClick={() => onToggleRule(rule.id)}
            style={{
              width: '32px',
              height: '32px',
              background: rule.isEnabled 
                ? 'rgba(255, 107, 53, 0.2)'
                : 'rgba(16, 185, 129, 0.2)',
              border: `1px solid ${rule.isEnabled ? '#ff6b35' : '#10b981'}`,
              borderRadius: '8px',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              transition: 'all 0.2s ease'
            }}
            title={rule.isEnabled ? 'Disable rule' : 'Enable rule'}
          >
            {rule.isEnabled ? '⏸️' : '▶️'}
          </button>

          <button
            onClick={() => onDuplicate(rule)}
            style={{
              width: '32px',
              height: '32px',
              background: 'rgba(139, 92, 246, 0.2)',
              border: '1px solid #8b5cf6',
              borderRadius: '8px',
              color: '#a78bfa',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              transition: 'all 0.2s ease'
            }}
            title="Duplicate rule"
          >
            📄
          </button>

          <button
            onClick={() => onRemove(rule.id)}
            style={{
              width: '32px',
              height: '32px',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              color: '#ef4444',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              transition: 'all 0.2s ease'
            }}
            title="Remove rule"
          >
            🗑️
          </button>
        </div>
      </div>
    )}

    {/* Expandable content */}
    {(!isMobile || isExpanded) && (
      <>
        {/* Mobile: Show description when expanded */}
        {isMobile && rule.description && (
          <p style={{
            color: '#9ca3af',
            fontSize: '0.9rem',
            margin: '0 0 1rem 0',
            lineHeight: 1.4
          }}>
            {rule.description}
          </p>
        )}

        {/* Metadata - Desktop always shows, Mobile when expanded */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1rem',
          flexWrap: 'wrap'
        }}>
          {!isMobile && (
            <>
              {/* Category Badge */}
              <span style={{
                background: `${categoryData?.color || '#6b7280'}30`,
                color: categoryData?.color || '#6b7280',
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                <span style={{ fontSize: '0.8rem' }}>{categoryData?.icon || '📋'}</span>
                {categoryData?.label || rule.category}
              </span>

              {/* Priority Badge */}
              <span style={{
                background: `${priorityData?.color || '#6b7280'}30`,
                color: priorityData?.color || '#6b7280',
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase'
              }}>
                {rule.priority}
              </span>
            </>
          )}

          {/* Date Added */}
          <span style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.75rem' }}>
            Added {new Date(rule.addedAt).toLocaleDateString()}
          </span>
        </div>

        {/* Rule Text */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '8px',
          padding: isMobile ? '0.875rem' : '0.75rem',
          fontSize: isMobile ? '0.9rem' : '0.85rem',
          color: '#d1d5db',
          lineHeight: 1.5,
          marginBottom: rule.tags.length > 0 ? '0.75rem' : (isMobile ? '1rem' : '0')
        }}>
          <pre style={{
            fontFamily: 'inherit',
            fontSize: 'inherit',
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word'
          }}>
            {rule.ruleText}
          </pre>
        </div>

        {/* Tags */}
        {rule.tags.length > 0 && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.4rem',
            marginBottom: isMobile ? '1rem' : '0'
          }}>
            {rule.tags.map((tag, index) => (
              <span
                key={index}
                style={{
                  background: 'rgba(107, 114, 128, 0.3)',
                  color: '#9ca3af',
                  padding: isMobile ? '0.4rem 0.6rem' : '0.2rem 0.4rem',
                  borderRadius: '4px',
                  fontSize: isMobile ? '0.8rem' : '0.7rem',
                  fontWeight: 500
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Mobile: Action buttons */}
        {isMobile && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr auto',
            gap: '0.75rem'
          }}>
            <button
              onClick={() => onToggleRule(rule.id)}
              style={{
                background: rule.isEnabled 
                  ? 'rgba(255, 107, 53, 0.2)'
                  : 'rgba(16, 185, 129, 0.2)',
                border: `1px solid ${rule.isEnabled ? '#ff6b35' : '#10b981'}`,
                borderRadius: '8px',
                color: '#ffffff',
                cursor: 'pointer',
                padding: '0.75rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                minHeight: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {rule.isEnabled ? '⏸️ Disable' : '▶️ Enable'}
            </button>

            <button
              onClick={() => onDuplicate(rule)}
              style={{
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid #8b5cf6',
                borderRadius: '8px',
                color: '#a78bfa',
                cursor: 'pointer',
                padding: '0.75rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                minHeight: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              📄 Copy
            </button>

            <button
              onClick={() => onRemove(rule.id)}
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                color: '#ef4444',
                cursor: 'pointer',
                padding: '0.75rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                minHeight: '48px',
                minWidth: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              🗑️
            </button>
          </div>
        )}
      </>
    )}
  </div>
);

// ============================================================================
// STYLING TAB - Color Palettes & Design Inspiration
// ============================================================================

const StylingTab: React.FC<{
  colorPalettes: ColorPalette[];
  setColorPalettes: React.Dispatch<React.SetStateAction<ColorPalette[]>>;
  designInspirations: DesignInspiration[];
  setDesignInspirations: React.Dispatch<React.SetStateAction<DesignInspiration[]>>;
  newCoolorsUrl: string;
  setNewCoolorsUrl: (url: string) => void;
  newSiteUrl: string;
  setNewSiteUrl: (url: string) => void;
  isMobile: boolean;
  expandedCards: Record<string, boolean>;
  onToggleCard: (cardId: string) => void;
}> = ({
  colorPalettes,
  setColorPalettes,
  designInspirations,
  setDesignInspirations,
  newCoolorsUrl,
  setNewCoolorsUrl,
  newSiteUrl,
  setNewSiteUrl,
  isMobile,
  expandedCards,
  onToggleCard
}) => {
  const [isProcessingCoolors, setIsProcessingCoolors] = useState(false);
  const [isProcessingSite, setIsProcessingSite] = useState(false);

  // Parse Coolors.co URL and extract colors
  const parseCoolorsUrl = (url: string): string[] => {
    // Support formats:
    // https://coolors.co/palette/264653-2a9d8f-e9c46a-f4a261-e76f51
    // https://coolors.co/264653-2a9d8f-e9c46a-f4a261-e76f51
    const hexPattern = /([0-9a-fA-F]{6})/g;
    const matches = url.match(hexPattern);
    return matches || [];
  };

  const handleImportCoolors = () => {
    if (!newCoolorsUrl.trim()) {
      alert('Please enter a Coolors.co URL');
      return;
    }

    setIsProcessingCoolors(true);
    try {
      const colors = parseCoolorsUrl(newCoolorsUrl);
      if (colors.length === 0) {
        alert('Could not extract colors from URL. Please check the format.');
        setIsProcessingCoolors(false);
        return;
      }

      const newPalette: ColorPalette = {
        id: Date.now().toString(),
        name: `Coolors Palette ${colorPalettes.length + 1}`,
        colors: colors.map((hex, index) => ({
          hex: `#${hex}`,
          role: index === 0 ? 'primary' : index === 1 ? 'secondary' : index === 2 ? 'accent' : undefined
        })),
        source: 'coolors',
        sourceUrl: newCoolorsUrl,
        addedAt: Date.now()
      };

      setColorPalettes(prev => [newPalette, ...prev]);
      setNewCoolorsUrl('');
      alert(`✅ Imported ${colors.length} colors from Coolors!`);
    } catch (error) {
      console.error('Error importing Coolors palette:', error);
      alert('Failed to import palette. Please check the URL format.');
    } finally {
      setIsProcessingCoolors(false);
    }
  };

  const handleExtractSiteDesign = async () => {
    if (!newSiteUrl.trim()) {
      alert('Please enter a website URL');
      return;
    }

    setIsProcessingSite(true);
    try {
      // Normalize URL (add https if missing)
      let normalizedUrl = newSiteUrl.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      // Call backend endpoint to extract design
      console.log('🔍 [ContextInterface] Attempting to extract design from:', normalizedUrl);
      
      const baseUrl = 'https://ai.coinnation.io';
      const response = await fetch(`${baseUrl}/api/design/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: normalizedUrl })
      });

      console.log('📡 [ContextInterface] Response status:', response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        // Handle 404 specifically (endpoint not implemented)
        if (response.status === 404) {
          errorMessage = 'Design extraction endpoint not yet implemented. Please check BACKEND_ENDPOINT_REQUIREMENTS.md for implementation details.';
        } else {
          // Try to parse error response
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            // If JSON parsing fails, use status text
            const text = await response.text().catch(() => '');
            errorMessage = text || errorMessage;
          }
        }
        
        console.error('❌ [ContextInterface] Design extraction failed:', errorMessage);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ [ContextInterface] Design extraction result:', result);

      if (!result.success) {
        throw new Error(result.error || 'Extraction failed');
      }

      // Create DesignInspiration with extracted data
      const newInspiration: DesignInspiration = {
        id: Date.now().toString(),
        name: result.data?.siteName || new URL(normalizedUrl).hostname,
        url: normalizedUrl,
        extractedColors: result.data?.colors || [],
        extractedTypography: result.data?.typography,
        notes: result.data?.description || `Design extracted from ${new URL(normalizedUrl).hostname}`,
        addedAt: Date.now()
      };

      setDesignInspirations(prev => [newInspiration, ...prev]);
      setNewSiteUrl('');
      
      // If colors were extracted, optionally create a palette too
      if (result.data?.colors && result.data.colors.length > 0) {
        const extractedPalette: ColorPalette = {
          id: Date.now().toString() + '-extracted',
          name: `${result.data.siteName || 'Extracted'} Palette`,
          colors: result.data.colors.map((hex: string, index: number) => ({
            hex: hex.startsWith('#') ? hex : `#${hex}`,
            role: index === 0 ? 'primary' : index === 1 ? 'secondary' : index === 2 ? 'accent' : undefined
          })),
          source: 'site-extraction',
          sourceUrl: normalizedUrl,
          addedAt: Date.now()
        };
        setColorPalettes(prev => [extractedPalette, ...prev]);
      }

      alert(`✅ Successfully extracted design from ${result.data?.siteName || normalizedUrl}!`);
    } catch (error) {
      console.error('❌ [ContextInterface] Error extracting site design:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to extract site design';
      
      // Show more detailed error message
      let userMessage = errorMessage;
      if (errorMessage.includes('404') || errorMessage.includes('not yet implemented')) {
        userMessage = '⚠️ Design extraction feature is not yet available. The backend endpoint needs to be implemented. See BACKEND_ENDPOINT_REQUIREMENTS.md for details.';
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        userMessage = '❌ Network error: Could not connect to the server. Please check your connection and try again.';
      }
      
      alert(userMessage);
    } finally {
      setIsProcessingSite(false);
    }
  };

  return (
    <>
      {/* Coolors Import Section */}
      <div style={{
        marginBottom: isMobile ? '1.5rem' : '2rem',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.5rem',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <h3 style={{
          color: '#ffffff',
          fontSize: isMobile ? '1rem' : '1.1rem',
          fontWeight: 700,
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>🎨</span>
          Import from Coolors.co
        </h3>
        <p style={{
          color: '#9ca3af',
          fontSize: isMobile ? '0.85rem' : '0.9rem',
          marginBottom: '1rem'
        }}>
          Paste a Coolors.co palette URL to instantly import colors
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexDirection: isMobile ? 'column' : 'row' }}>
          <input
            type="text"
            value={newCoolorsUrl}
            onChange={(e) => setNewCoolorsUrl(e.target.value)}
            placeholder="https://coolors.co/palette/264653-2a9d8f-e9c46a..."
            style={{
              flex: 1,
              padding: isMobile ? '0.875rem' : '0.75rem',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: isMobile ? '1rem' : '0.9rem',
              outline: 'none'
            }}
          />
          <button
            onClick={handleImportCoolors}
            disabled={isProcessingCoolors}
            style={{
              padding: isMobile ? '0.875rem 1.5rem' : '0.75rem 1.5rem',
              background: isProcessingCoolors 
                ? 'rgba(255, 255, 255, 0.1)' 
                : 'linear-gradient(135deg, #ff6b35, #10b981)',
              border: 'none',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: isMobile ? '1rem' : '0.9rem',
              fontWeight: 600,
              cursor: isProcessingCoolors ? 'not-allowed' : 'pointer',
              minWidth: isMobile ? 'auto' : '120px'
            }}
          >
            {isProcessingCoolors ? '⏳ Importing...' : '✨ Import'}
          </button>
        </div>
      </div>

      {/* Site Design Extraction Section */}
      <div style={{
        marginBottom: isMobile ? '1.5rem' : '2rem',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.5rem',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <h3 style={{
          color: '#ffffff',
          fontSize: isMobile ? '1rem' : '1.1rem',
          fontWeight: 700,
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>🌐</span>
          Extract Design from Website
        </h3>
        <p style={{
          color: '#9ca3af',
          fontSize: isMobile ? '0.85rem' : '0.9rem',
          marginBottom: '1rem'
        }}>
          Enter a website URL (e.g., medium.com, jira.com) to extract colors, typography, and design patterns
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexDirection: isMobile ? 'column' : 'row' }}>
          <input
            type="text"
            value={newSiteUrl}
            onChange={(e) => setNewSiteUrl(e.target.value)}
            placeholder="https://medium.com or https://jira.com..."
            style={{
              flex: 1,
              padding: isMobile ? '0.875rem' : '0.75rem',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: isMobile ? '1rem' : '0.9rem',
              outline: 'none'
            }}
          />
          <button
            onClick={handleExtractSiteDesign}
            disabled={isProcessingSite}
            style={{
              padding: isMobile ? '0.875rem 1.5rem' : '0.75rem 1.5rem',
              background: isProcessingSite 
                ? 'rgba(255, 255, 255, 0.1)' 
                : 'linear-gradient(135deg, #ff6b35, #10b981)',
              border: 'none',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: isMobile ? '1rem' : '0.9rem',
              fontWeight: 600,
              cursor: isProcessingSite ? 'not-allowed' : 'pointer',
              minWidth: isMobile ? 'auto' : '120px'
            }}
          >
            {isProcessingSite ? '⏳ Extracting...' : '🔍 Extract'}
          </button>
        </div>
      </div>

      {/* Color Palettes Display */}
      {colorPalettes.length > 0 && (
        <div style={{ marginBottom: isMobile ? '1.5rem' : '2rem' }}>
          <h3 style={{
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '1.1rem',
            fontWeight: 700,
            marginBottom: '1rem'
          }}>
            Color Palettes ({colorPalettes.length})
          </h3>
          {colorPalettes.map(palette => (
            <div
              key={palette.id}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: isMobile ? '1rem' : '1.5rem',
                marginBottom: '1rem',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ color: '#ffffff', margin: 0, fontSize: isMobile ? '1rem' : '1.1rem' }}>
                  {palette.name}
                </h4>
                <button
                  onClick={() => setColorPalettes(prev => prev.filter(p => p.id !== palette.id))}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    color: '#ef4444',
                    padding: '0.5rem',
                    cursor: 'pointer'
                  }}
                >
                  🗑️
                </button>
              </div>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                {palette.colors.map((color, index) => (
                  <div
                    key={index}
                    style={{
                      background: color.hex,
                      width: isMobile ? '60px' : '80px',
                      height: isMobile ? '60px' : '80px',
                      borderRadius: '8px',
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                    title={color.hex}
                    onClick={() => {
                      navigator.clipboard.writeText(color.hex);
                      alert(`Copied ${color.hex} to clipboard!`);
                    }}
                  >
                    <span style={{
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                    }}>
                      {color.hex}
                    </span>
                    {color.role && (
                      <span style={{
                        color: '#ffffff',
                        fontSize: '0.6rem',
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                        marginTop: '0.25rem'
                      }}>
                        {color.role}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Design Inspirations Display */}
      {designInspirations.length > 0 && (
        <div>
          <h3 style={{
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '1.1rem',
            fontWeight: 700,
            marginBottom: '1rem'
          }}>
            Design Inspirations ({designInspirations.length})
          </h3>
          {designInspirations.map(inspiration => (
            <div
              key={inspiration.id}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: isMobile ? '1rem' : '1.5rem',
                marginBottom: '1rem',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h4 style={{ color: '#ffffff', margin: 0, fontSize: isMobile ? '1rem' : '1.1rem' }}>
                  {inspiration.name}
                </h4>
                <button
                  onClick={() => setDesignInspirations(prev => prev.filter(i => i.id !== inspiration.id))}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    color: '#ef4444',
                    padding: '0.5rem',
                    cursor: 'pointer'
                  }}
                >
                  🗑️
                </button>
              </div>
              <a
                href={inspiration.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#10b981',
                  textDecoration: 'none',
                  fontSize: isMobile ? '0.85rem' : '0.9rem'
                }}
              >
                {inspiration.url} ↗
              </a>
              {inspiration.notes && (
                <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: '0.5rem', marginBottom: 0 }}>
                  {inspiration.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {colorPalettes.length === 0 && designInspirations.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '3rem 1rem',
          color: '#9ca3af'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎨</div>
          <p style={{ fontSize: isMobile ? '1rem' : '1.1rem', marginBottom: '0.5rem' }}>
            No styling context yet
          </p>
          <p style={{ fontSize: isMobile ? '0.85rem' : '0.9rem' }}>
            Import color palettes from Coolors.co or extract design from websites to get started
          </p>
        </div>
      )}
    </>
  );
};

// ============================================================================
// DOCUMENTATION TAB
// ============================================================================

const DocumentationTab: React.FC<{
  items: DocumentationItem[];
  newTitle: string;
  setNewTitle: (title: string) => void;
  newContent: string;
  setNewContent: (content: string) => void;
  newUrl: string;
  setNewUrl: (url: string) => void;
  newType: 'snippet' | 'link' | 'guide';
  setNewType: (type: 'snippet' | 'link' | 'guide') => void;
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => void;
  isMobile: boolean;
  expandedCards: Record<string, boolean>;
  onToggleCard: (cardId: string) => void;
}> = ({
  items,
  newTitle,
  setNewTitle,
  newContent,
  setNewContent,
  newUrl,
  setNewUrl,
  newType,
  setNewType,
  onAddItem,
  onRemoveItem,
  isMobile,
  expandedCards,
  onToggleCard
}) => {
  return (
    <>
      {/* Add Documentation Form */}
      <div style={{
        marginBottom: isMobile ? '1.5rem' : '2rem',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.5rem',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <h3 style={{
          color: '#ffffff',
          fontSize: isMobile ? '1rem' : '1.1rem',
          fontWeight: 700,
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>➕</span>
          Add Documentation
        </h3>

        {/* Type Selector */}
        <div style={{
          display: 'flex',
          gap: '0.4rem',
          marginBottom: '0.75rem',
          flexWrap: 'wrap'
        }}>
          {([
            { type: 'snippet' as const, icon: '📄', label: 'Snippet' },
            { type: 'link' as const, icon: '🔗', label: 'Link' },
            { type: 'guide' as const, icon: '📖', label: 'Guide' }
          ]).map(({ type, icon, label }) => (
            <button
              key={type}
              onClick={() => setNewType(type)}
              style={{
                padding: isMobile ? '0.75rem' : '0.5rem 0.75rem',
                background: newType === type 
                  ? 'linear-gradient(135deg, #ff6b35, #10b981)'
                  : 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: isMobile ? '0.9rem' : '0.85rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Title Input */}
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Documentation title..."
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '0.9rem',
            outline: 'none',
            marginBottom: '0.75rem'
          }}
        />

        {/* Content/URL based on type */}
        {newType === 'link' ? (
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://example.com/docs..."
            style={{
              width: '100%',
              padding: isMobile ? '0.875rem' : '0.75rem',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: isMobile ? '1rem' : '0.9rem',
              outline: 'none',
              marginBottom: '0.75rem'
            }}
          />
        ) : (
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder={newType === 'guide' ? 'Documentation guide content...' : 'Documentation snippet...'}
            rows={isMobile ? 4 : 6}
            style={{
              width: '100%',
              padding: isMobile ? '0.875rem' : '0.75rem',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: isMobile ? '1rem' : '0.9rem',
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
              marginBottom: '0.75rem'
            }}
          />
        )}

        <button
          onClick={onAddItem}
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'linear-gradient(135deg, #ff6b35, #10b981)',
            border: 'none',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '0.9rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          ➕ Add Documentation
        </button>
      </div>

      {/* Documentation Items */}
      {items.length > 0 ? (
        <div>
          <h3 style={{
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '1.1rem',
            fontWeight: 700,
            marginBottom: '1rem'
          }}>
            Documentation ({items.length})
          </h3>
          {items.map(item => (
            <div
              key={item.id}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: isMobile ? '1rem' : '1.5rem',
                marginBottom: '1rem',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h4 style={{ color: '#ffffff', margin: 0, fontSize: isMobile ? '1rem' : '1.1rem' }}>
                  {item.type === 'snippet' ? '📄' : item.type === 'link' ? '🔗' : '📖'} {item.title}
                </h4>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    color: '#ef4444',
                    padding: '0.5rem',
                    cursor: 'pointer'
                  }}
                >
                  🗑️
                </button>
              </div>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#10b981',
                    textDecoration: 'none',
                    fontSize: isMobile ? '0.85rem' : '0.9rem',
                    display: 'block',
                    marginBottom: '0.5rem'
                  }}
                >
                  {item.url} ↗
                </a>
              )}
              {item.content && (
                <div style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  color: '#d1d5db',
                  fontSize: isMobile ? '0.9rem' : '0.85rem',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word'
                }}>
                  {item.content}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '3rem 1rem',
          color: '#9ca3af'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📖</div>
          <p style={{ fontSize: isMobile ? '1rem' : '1.1rem', marginBottom: '0.5rem' }}>
            No documentation yet
          </p>
          <p style={{ fontSize: isMobile ? '0.85rem' : '0.9rem' }}>
            Add documentation snippets, guides, or links to help the AI understand your project
          </p>
        </div>
      )}
    </>
  );
};

// ============================================================================
// GITHUB TAB
// ============================================================================

const GitHubTab: React.FC<{
  guidelines: GitHubGuideline[];
  newTitle: string;
  setNewTitle: (title: string) => void;
  newContent: string;
  setNewContent: (content: string) => void;
  newCategory: GitHubGuideline['category'];
  setNewCategory: (category: GitHubGuideline['category']) => void;
  onAddGuideline: () => void;
  onRemoveGuideline: (guidelineId: string) => void;
  isMobile: boolean;
  expandedCards: Record<string, boolean>;
  onToggleCard: (cardId: string) => void;
}> = ({
  guidelines,
  newTitle,
  setNewTitle,
  newContent,
  setNewContent,
  newCategory,
  setNewCategory,
  onAddGuideline,
  onRemoveGuideline,
  isMobile,
  expandedCards,
  onToggleCard
}) => {
  const categories = [
    { value: 'conventions' as const, label: 'Conventions', icon: '📝' },
    { value: 'architecture' as const, label: 'Architecture', icon: '🏗️' },
    { value: 'patterns' as const, label: 'Patterns', icon: '🔄' },
    { value: 'workflow' as const, label: 'Workflow', icon: '⚡' },
    { value: 'general' as const, label: 'General', icon: '📋' }
  ];

  return (
    <>
      {/* Add Guideline Form */}
      <div style={{
        marginBottom: isMobile ? '1.5rem' : '2rem',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.5rem',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <h3 style={{
          color: '#ffffff',
          fontSize: isMobile ? '1rem' : '1.1rem',
          fontWeight: 700,
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>➕</span>
          Add GitHub Guideline
        </h3>

        {/* Category Selector */}
        <div style={{
          display: 'flex',
          gap: '0.4rem',
          marginBottom: '0.75rem',
          flexWrap: 'wrap'
        }}>
          {categories.map(({ value, label, icon }) => (
            <button
              key={value}
              onClick={() => setNewCategory(value)}
              style={{
                padding: isMobile ? '0.75rem' : '0.5rem 0.75rem',
                background: newCategory === value 
                  ? 'linear-gradient(135deg, #ff6b35, #10b981)'
                  : 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: isMobile ? '0.9rem' : '0.85rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Title Input */}
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Guideline title..."
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '0.9rem',
            outline: 'none',
            marginBottom: '0.75rem'
          }}
        />

        {/* Content Textarea */}
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Guideline content and instructions..."
          rows={isMobile ? 4 : 6}
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '0.9rem',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
            marginBottom: '0.75rem'
          }}
        />

        <button
          onClick={onAddGuideline}
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'linear-gradient(135deg, #ff6b35, #10b981)',
            border: 'none',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '0.9rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          ➕ Add Guideline
        </button>
      </div>

      {/* Guidelines Display */}
      {guidelines.length > 0 ? (
        <div>
          <h3 style={{
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '1.1rem',
            fontWeight: 700,
            marginBottom: '1rem'
          }}>
            Guidelines ({guidelines.length})
          </h3>
          {guidelines.map(guideline => {
            const categoryData = categories.find(c => c.value === guideline.category);
            return (
              <div
                key={guideline.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  padding: isMobile ? '1rem' : '1.5rem',
                  marginBottom: '1rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span>{categoryData?.icon || '📋'}</span>
                    <h4 style={{ color: '#ffffff', margin: 0, fontSize: isMobile ? '1rem' : '1.1rem' }}>
                      {guideline.title}
                    </h4>
                    <span style={{
                      background: 'rgba(139, 92, 246, 0.2)',
                      color: '#a78bfa',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>
                      {categoryData?.label || guideline.category}
                    </span>
                  </div>
                  <button
                    onClick={() => onRemoveGuideline(guideline.id)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid #ef4444',
                      borderRadius: '8px',
                      color: '#ef4444',
                      padding: '0.5rem',
                      cursor: 'pointer'
                    }}
                  >
                    🗑️
                  </button>
                </div>
                <div style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  color: '#d1d5db',
                  fontSize: isMobile ? '0.9rem' : '0.85rem',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word'
                }}>
                  {guideline.content}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '3rem 1rem',
          color: '#9ca3af'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🐙</div>
          <p style={{ fontSize: isMobile ? '1rem' : '1.1rem', marginBottom: '0.5rem' }}>
            No GitHub guidelines yet
          </p>
          <p style={{ fontSize: isMobile ? '0.85rem' : '0.9rem' }}>
            Add repository guidelines, coding conventions, and architecture decisions
          </p>
        </div>
      )}
    </>
  );
};

// ============================================================================
// TEMPLATES TAB
// ============================================================================

const TemplatesTab: React.FC<{
  templates: CodeTemplate[];
  newName: string;
  setNewName: (name: string) => void;
  newDescription: string;
  setNewDescription: (description: string) => void;
  newCode: string;
  setNewCode: (code: string) => void;
  newLanguage: CodeTemplate['language'];
  setNewLanguage: (language: CodeTemplate['language']) => void;
  newCategory: CodeTemplate['category'];
  setNewCategory: (category: CodeTemplate['category']) => void;
  newTags: string;
  setNewTags: (tags: string) => void;
  onAddTemplate: () => void;
  onRemoveTemplate: (templateId: string) => void;
  isMobile: boolean;
  expandedCards: Record<string, boolean>;
  onToggleCard: (cardId: string) => void;
}> = ({
  templates,
  newName,
  setNewName,
  newDescription,
  setNewDescription,
  newCode,
  setNewCode,
  newLanguage,
  setNewLanguage,
  newCategory,
  setNewCategory,
  newTags,
  setNewTags,
  onAddTemplate,
  onRemoveTemplate,
  isMobile,
  expandedCards,
  onToggleCard
}) => {
  const languages = [
    { value: 'typescript' as const, label: 'TypeScript' },
    { value: 'javascript' as const, label: 'JavaScript' },
    { value: 'python' as const, label: 'Python' },
    { value: 'html' as const, label: 'HTML' },
    { value: 'css' as const, label: 'CSS' },
    { value: 'json' as const, label: 'JSON' },
    { value: 'other' as const, label: 'Other' }
  ];

  const categories = [
    { value: 'component' as const, label: 'Component', icon: '⚛️' },
    { value: 'hook' as const, label: 'Hook', icon: '🪝' },
    { value: 'utility' as const, label: 'Utility', icon: '🔧' },
    { value: 'config' as const, label: 'Config', icon: '⚙️' },
    { value: 'function' as const, label: 'Function', icon: '📦' },
    { value: 'class' as const, label: 'Class', icon: '🏛️' },
    { value: 'other' as const, label: 'Other', icon: '📝' }
  ];

  return (
    <>
      {/* Add Template Form */}
      <div style={{
        marginBottom: isMobile ? '1.5rem' : '2rem',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.5rem',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <h3 style={{
          color: '#ffffff',
          fontSize: isMobile ? '1rem' : '1.1rem',
          fontWeight: 700,
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>➕</span>
          Add Code Template
        </h3>

        {/* Name Input */}
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Template name..."
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '0.9rem',
            outline: 'none',
            marginBottom: '0.75rem'
          }}
        />

        {/* Description Input */}
        <input
          type="text"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="Template description (optional)..."
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '0.9rem',
            outline: 'none',
            marginBottom: '0.75rem'
          }}
        />

        {/* Language and Category Selectors */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: '0.75rem',
          marginBottom: '0.75rem'
        }}>
          <div>
            <label style={{
              display: 'block',
              color: '#9ca3af',
              fontSize: '0.85rem',
              marginBottom: '0.5rem'
            }}>
              Language
            </label>
            <select
              value={newLanguage}
              onChange={(e) => setNewLanguage(e.target.value as CodeTemplate['language'])}
              style={{
                width: '100%',
                padding: isMobile ? '0.875rem' : '0.75rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                color: '#ffffff',
                fontSize: isMobile ? '1rem' : '0.9rem',
                outline: 'none'
              }}
            >
              {languages.map(({ value, label }) => (
                <option key={value} value={value} style={{ background: '#1a1a1a' }}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{
              display: 'block',
              color: '#9ca3af',
              fontSize: '0.85rem',
              marginBottom: '0.5rem'
            }}>
              Category
            </label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as CodeTemplate['category'])}
              style={{
                width: '100%',
                padding: isMobile ? '0.875rem' : '0.75rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                color: '#ffffff',
                fontSize: isMobile ? '1rem' : '0.9rem',
                outline: 'none'
              }}
            >
              {categories.map(({ value, label }) => (
                <option key={value} value={value} style={{ background: '#1a1a1a' }}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Code Textarea */}
        <textarea
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          placeholder="Paste your code template here..."
          rows={isMobile ? 8 : 12}
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '0.9rem' : '0.85rem',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'monospace',
            marginBottom: '0.75rem',
            lineHeight: 1.5
          }}
        />

        {/* Tags Input */}
        <input
          type="text"
          value={newTags}
          onChange={(e) => setNewTags(e.target.value)}
          placeholder="Tags (comma-separated, optional)..."
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '0.9rem',
            outline: 'none',
            marginBottom: '0.75rem'
          }}
        />

        <button
          onClick={onAddTemplate}
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'linear-gradient(135deg, #ff6b35, #10b981)',
            border: 'none',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '0.9rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          ➕ Add Template
        </button>
      </div>

      {/* Templates Display */}
      {templates.length > 0 ? (
        <div>
          <h3 style={{
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '1.1rem',
            fontWeight: 700,
            marginBottom: '1rem'
          }}>
            Code Templates ({templates.length})
          </h3>
          {templates.map(template => {
            const categoryData = categories.find(c => c.value === template.category);
            const languageData = languages.find(l => l.value === template.language);
            return (
              <div
                key={template.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  padding: isMobile ? '1rem' : '1.5rem',
                  marginBottom: '1rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span>{categoryData?.icon || '📝'}</span>
                    <h4 style={{ color: '#ffffff', margin: 0, fontSize: isMobile ? '1rem' : '1.1rem' }}>
                      {template.name}
                    </h4>
                    <span style={{
                      background: 'rgba(59, 130, 246, 0.2)',
                      color: '#93c5fd',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>
                      {languageData?.label || template.language}
                    </span>
                    <span style={{
                      background: 'rgba(139, 92, 246, 0.2)',
                      color: '#a78bfa',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>
                      {categoryData?.label || template.category}
                    </span>
                  </div>
                  <button
                    onClick={() => onRemoveTemplate(template.id)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid #ef4444',
                      borderRadius: '8px',
                      color: '#ef4444',
                      padding: '0.5rem',
                      cursor: 'pointer'
                    }}
                  >
                    🗑️
                  </button>
                </div>
                {template.description && (
                  <p style={{
                    color: '#9ca3af',
                    fontSize: '0.85rem',
                    marginBottom: '0.5rem'
                  }}>
                    {template.description}
                  </p>
                )}
                {template.tags.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.4rem',
                    marginBottom: '0.5rem'
                  }}>
                    {template.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: 'rgba(107, 114, 128, 0.3)',
                          color: '#9ca3af',
                          padding: '0.2rem 0.4rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 500
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  overflowX: 'auto',
                  marginTop: '0.5rem'
                }}>
                  <pre style={{
                    margin: 0,
                    color: '#d1d5db',
                    fontSize: isMobile ? '0.8rem' : '0.85rem',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word'
                  }}>
                    {template.code}
                  </pre>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '3rem 1rem',
          color: '#9ca3af'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
          <p style={{ fontSize: isMobile ? '1rem' : '1.1rem', marginBottom: '0.5rem' }}>
            No code templates yet
          </p>
          <p style={{ fontSize: isMobile ? '0.85rem' : '0.9rem' }}>
            Add reusable code snippets, component templates, and boilerplate patterns
          </p>
        </div>
      )}
    </>
  );
};

// ============================================================================
// API ENDPOINTS TAB
// ============================================================================

const ApiEndpointsTab: React.FC<{
  endpoints: APIEndpoint[];
  newName: string;
  setNewName: (name: string) => void;
  newMethod: APIEndpoint['method'];
  setNewMethod: (method: APIEndpoint['method']) => void;
  newPath: string;
  setNewPath: (path: string) => void;
  newDescription: string;
  setNewDescription: (description: string) => void;
  newRequestSchema: string;
  setNewRequestSchema: (schema: string) => void;
  newResponseSchema: string;
  setNewResponseSchema: (schema: string) => void;
  onAddEndpoint: () => void;
  onRemoveEndpoint: (endpointId: string) => void;
  isMobile: boolean;
  expandedCards: Record<string, boolean>;
  onToggleCard: (cardId: string) => void;
}> = ({
  endpoints,
  newName,
  setNewName,
  newMethod,
  setNewMethod,
  newPath,
  setNewPath,
  newDescription,
  setNewDescription,
  newRequestSchema,
  setNewRequestSchema,
  newResponseSchema,
  setNewResponseSchema,
  onAddEndpoint,
  onRemoveEndpoint,
  isMobile,
  expandedCards,
  onToggleCard
}) => {
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
  const methodColors: Record<string, string> = {
    GET: '#10b981',
    POST: '#3b82f6',
    PUT: '#f59e0b',
    DELETE: '#ef4444',
    PATCH: '#8b5cf6'
  };

  return (
    <>
      {/* Add Endpoint Form */}
      <div style={{
        marginBottom: isMobile ? '1.5rem' : '2rem',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.5rem',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <h3 style={{
          color: '#ffffff',
          fontSize: isMobile ? '1rem' : '1.1rem',
          fontWeight: 700,
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>➕</span>
          Add API Endpoint
        </h3>

        {/* Name Input */}
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Endpoint name..."
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '0.9rem',
            outline: 'none',
            marginBottom: '0.75rem'
          }}
        />

        {/* Method and Path */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '120px 1fr',
          gap: '0.75rem',
          marginBottom: '0.75rem'
        }}>
          <select
            value={newMethod}
            onChange={(e) => setNewMethod(e.target.value as APIEndpoint['method'])}
            style={{
              padding: isMobile ? '0.875rem' : '0.75rem',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: isMobile ? '1rem' : '0.9rem',
              outline: 'none',
              fontWeight: 600
            }}
          >
            {methods.map(method => (
              <option key={method} value={method} style={{ background: '#1a1a1a' }}>
                {method}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            placeholder="/api/v1/users"
            style={{
              padding: isMobile ? '0.875rem' : '0.75rem',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: isMobile ? '1rem' : '0.9rem',
              outline: 'none',
              fontFamily: 'monospace'
            }}
          />
        </div>

        {/* Description */}
        <textarea
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="Endpoint description..."
          rows={2}
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '0.9rem',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
            marginBottom: '0.75rem'
          }}
        />

        {/* Request Schema */}
        <textarea
          value={newRequestSchema}
          onChange={(e) => setNewRequestSchema(e.target.value)}
          placeholder="Request schema (JSON, optional)..."
          rows={3}
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '0.9rem' : '0.85rem',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'monospace',
            marginBottom: '0.75rem'
          }}
        />

        {/* Response Schema */}
        <textarea
          value={newResponseSchema}
          onChange={(e) => setNewResponseSchema(e.target.value)}
          placeholder="Response schema (JSON, optional)..."
          rows={3}
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '0.9rem' : '0.85rem',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'monospace',
            marginBottom: '0.75rem'
          }}
        />

        <button
          onClick={onAddEndpoint}
          style={{
            width: '100%',
            padding: isMobile ? '0.875rem' : '0.75rem',
            background: 'linear-gradient(135deg, #ff6b35, #10b981)',
            border: 'none',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '0.9rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          ➕ Add Endpoint
        </button>
      </div>

      {/* Endpoints Display */}
      {endpoints.length > 0 ? (
        <div>
          <h3 style={{
            color: '#ffffff',
            fontSize: isMobile ? '1rem' : '1.1rem',
            fontWeight: 700,
            marginBottom: '1rem'
          }}>
            API Endpoints ({endpoints.length})
          </h3>
          {endpoints.map(endpoint => (
            <div
              key={endpoint.id}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: isMobile ? '1rem' : '1.5rem',
                marginBottom: '1rem',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{
                    background: methodColors[endpoint.method] || '#6b7280',
                    color: '#ffffff',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}>
                    {endpoint.method}
                  </span>
                  <code style={{
                    color: '#10b981',
                    fontSize: isMobile ? '0.9rem' : '1rem',
                    fontFamily: 'monospace',
                    background: 'rgba(16, 185, 129, 0.1)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px'
                  }}>
                    {endpoint.path}
                  </code>
                  <h4 style={{ color: '#ffffff', margin: 0, fontSize: isMobile ? '1rem' : '1.1rem' }}>
                    {endpoint.name}
                  </h4>
                </div>
                <button
                  onClick={() => onRemoveEndpoint(endpoint.id)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    color: '#ef4444',
                    padding: '0.5rem',
                    cursor: 'pointer'
                  }}
                >
                  🗑️
                </button>
              </div>
              <p style={{
                color: '#9ca3af',
                fontSize: '0.85rem',
                marginBottom: '0.75rem'
              }}>
                {endpoint.description}
              </p>
              {endpoint.requestSchema && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{
                    display: 'block',
                    color: '#9ca3af',
                    fontSize: '0.75rem',
                    marginBottom: '0.25rem',
                    fontWeight: 600
                  }}>
                    Request Schema:
                  </label>
                  <pre style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    margin: 0,
                    color: '#d1d5db',
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word'
                  }}>
                    {endpoint.requestSchema}
                  </pre>
                </div>
              )}
              {endpoint.responseSchema && (
                <div>
                  <label style={{
                    display: 'block',
                    color: '#9ca3af',
                    fontSize: '0.75rem',
                    marginBottom: '0.25rem',
                    fontWeight: 600
                  }}>
                    Response Schema:
                  </label>
                  <pre style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    margin: 0,
                    color: '#d1d5db',
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word'
                  }}>
                    {endpoint.responseSchema}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '3rem 1rem',
          color: '#9ca3af'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔌</div>
          <p style={{ fontSize: isMobile ? '1rem' : '1.1rem', marginBottom: '0.5rem' }}>
            No API endpoints yet
          </p>
          <p style={{ fontSize: isMobile ? '0.85rem' : '0.9rem' }}>
            Document your API endpoints with schemas and examples
          </p>
        </div>
      )}
    </>
  );
};