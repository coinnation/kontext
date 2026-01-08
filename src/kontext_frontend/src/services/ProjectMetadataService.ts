import { FileExtractor } from '../utils/fileExtractor';

export interface FileMetadata {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  description?: string;
  category: 'backend' | 'frontend' | 'config' | 'core';
  keywords: string[];
  imports: string[];
  exports: string[];
}

export interface ProjectMetadata {
  // ✅ NEW: Added files array in the format expected by classification
  files: Array<{
    name: string;
    type: string;
    description: string;
    category: 'backend' | 'frontend' | 'config' | 'core';
    size: number;
    keywords: string[];
    imports: string[];
    exports: string[];
  }>;
  relationships: {
    [fileName: string]: {
      imports: string[];
      exports: string[];
      dependents: string[];
    };
  };
  featureMap: {
    [feature: string]: string[];
  };
  totalFiles: number;
  lastUpdated: number;
  // ✅ FIXED: Added missing fields that debug console expects
  fileTypes: { [extension: string]: number };
  projectType: string;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedTokens: number;
  keyFiles: string[];
  dependencies: string[];
}

export interface FileSelectionCriteria {
  keywords: string[];
  mentionedFiles: string[];
  requestType: 'CREATE_PROJECT' | 'UPDATE_CODE' | 'CONVERSATIONAL';
  maxFiles: number;
  includeConfig: boolean;
}

export interface ContextSelectionResult {
  primaryFiles: string[];
  supportingFiles: string[];
  configFiles: string[];
  excludedFiles: string[];
  totalFiles: number;
  estimatedTokens: number;
}

export class ProjectMetadataService {
  private static instance: ProjectMetadataService;
  private metadataCache: Map<string, ProjectMetadata> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  static getInstance(): ProjectMetadataService {
    if (!ProjectMetadataService.instance) {
      ProjectMetadataService.instance = new ProjectMetadataService();
    }
    return ProjectMetadataService.instance;
  }

  /**
   * ✅ ENHANCED: Generate comprehensive project metadata with proper structure
   */
  async generateProjectMetadata(
    projectId: string,
    projectFiles: { [fileName: string]: string }
  ): Promise<ProjectMetadata> {
    console.log(`📊 [ProjectMetadata] Generating metadata for project: ${projectId}`);
    console.log(`📁 [ProjectMetadata] Processing ${Object.keys(projectFiles).length} files`);

    const fileMetadataArray: FileMetadata[] = [];
    const relationships: { [fileName: string]: any } = {};
    const fileTypes: { [extension: string]: number } = {};
    const dependencies: Set<string> = new Set();
    let totalEstimatedTokens = 0;

    // 🚀 OPTIMIZATION: Process files in parallel for better performance
    const fileEntries = Object.entries(projectFiles);
    const analysisResults = await Promise.all(
      fileEntries.map(async ([fileName, content]) => {
        try {
          const fileMetadata = this.analyzeFile(fileName, content);
          return {
            success: true,
            fileName,
            fileMetadata,
            content
          };
        } catch (error) {
          console.warn(`⚠️ [ProjectMetadata] Failed to analyze file ${fileName}:`, error);
          const fallbackType = this.getFileType(fileName);
          return {
            success: false,
            fileName,
            fileMetadata: {
              name: fileName,
              type: fallbackType,
              size: content.length,
              lastModified: Date.now(),
              category: this.categorizeFile(fileName),
              keywords: this.extractBasicKeywords(fileName),
              imports: [],
              exports: []
            },
            content
          };
        }
      })
    );

    // Process results and build data structures
    for (const result of analysisResults) {
      const { fileName, fileMetadata, content } = result;
      fileMetadataArray.push(fileMetadata);

      // ✅ FIXED: Count file types for distribution
      const fileExtension = fileMetadata.type;
      fileTypes[fileExtension] = (fileTypes[fileExtension] || 0) + 1;

      // ✅ FIXED: Calculate estimated tokens
      totalEstimatedTokens += Math.ceil(content.length / 4); // Rough estimate: 4 chars per token

      // Extract dependencies from imports
      fileMetadata.imports.forEach(imp => {
        if (!imp.startsWith('.') && !imp.startsWith('/')) {
          // External dependency
          dependencies.add(imp.split('/')[0]); // Get base package name
        }
      });

      relationships[fileName] = {
        imports: fileMetadata.imports,
        exports: fileMetadata.exports,
        dependents: []
      };
    }

    // Build dependency graph
    this.buildDependencyGraph(relationships);

    // Generate feature map
    const featureMap = this.generateFeatureMap(fileMetadataArray);

    // ✅ FIXED: Determine project type based on files and content
    const projectType = this.detectProjectType(fileMetadataArray, Object.values(projectFiles));

    // ✅ FIXED: Determine complexity based on file count and dependencies
    const complexity = this.determineComplexity(fileMetadataArray.length, dependencies.size, featureMap);

    // ✅ FIXED: Identify key files
    const keyFiles = this.identifyKeyFiles(fileMetadataArray, featureMap);

    // ✅ NEW: Convert to expected structure for classification system
    const files = fileMetadataArray.map(file => ({
      name: file.name,
      type: file.type,
      description: file.description || this.generateDescription(file.name, ''),
      category: file.category,
      size: file.size,
      keywords: file.keywords,
      imports: file.imports,
      exports: file.exports
    }));

    const metadata: ProjectMetadata = {
      files, // ✅ NEW: Properly structured files array for classification
      relationships,
      featureMap,
      totalFiles: fileMetadataArray.length,
      lastUpdated: Date.now(),
      // ✅ FIXED: All the missing fields that were showing empty/zero in debug console
      fileTypes,
      projectType,
      complexity,
      estimatedTokens: totalEstimatedTokens,
      keyFiles,
      dependencies: Array.from(dependencies)
    };

    this.metadataCache.set(projectId, metadata);

    console.log(`✅ [ProjectMetadata] Generated complete metadata:`, {
      totalFiles: metadata.totalFiles,
      features: Object.keys(metadata.featureMap).length,
      relationships: Object.keys(metadata.relationships).length,
      fileTypes: Object.keys(metadata.fileTypes).length,
      projectType: metadata.projectType,
      complexity: metadata.complexity,
      estimatedTokens: metadata.estimatedTokens,
      keyFiles: metadata.keyFiles.length,
      dependencies: metadata.dependencies.length
    });

    return metadata;
  }

  /**
   * ✅ NEW: Detect project type based on file analysis
   */
  private detectProjectType(files: FileMetadata[], fileContents: string[]): string {
    const hasReact = files.some(f => f.name.includes('App.tsx') || f.name.includes('index.tsx')) ||
                    fileContents.some(content => content.includes('import React'));
    
    const hasMotoko = files.some(f => f.type === 'mo');
    const hasBackend = files.some(f => f.category === 'backend');
    const hasDatabase = fileContents.some(content => 
      content.toLowerCase().includes('database') || 
      content.toLowerCase().includes('crud') ||
      content.toLowerCase().includes('schema')
    );

    if (hasReact && hasMotoko) {
      return hasDatabase ? 'Full-Stack Web App with Database' : 'Full-Stack Web Application';
    }
    
    if (hasReact) {
      return hasDatabase ? 'Frontend App with Database' : 'React Frontend Application';
    }
    
    if (hasMotoko || hasBackend) {
      return hasDatabase ? 'Backend Service with Database' : 'Backend Service';
    }

    if (files.some(f => f.keywords.includes('api'))) {
      return 'API Service';
    }

    if (files.some(f => f.keywords.includes('component'))) {
      return 'Component Library';
    }

    return files.length > 10 ? 'Multi-Module Application' : 'Simple Application';
  }

  /**
   * ✅ NEW: Determine project complexity
   */
  private determineComplexity(fileCount: number, dependencyCount: number, featureMap: { [key: string]: string[] }): 'simple' | 'medium' | 'complex' {
    const featureCount = Object.keys(featureMap).length;
    
    if (fileCount > 30 || dependencyCount > 15 || featureCount > 8) {
      return 'complex';
    }
    
    if (fileCount > 10 || dependencyCount > 5 || featureCount > 4) {
      return 'medium';
    }
    
    return 'simple';
  }

  /**
   * ✅ NEW: Identify key files in the project
   */
  private identifyKeyFiles(files: FileMetadata[], featureMap: { [key: string]: string[] }): string[] {
    const keyFiles: string[] = [];
    
    // Main application files
    const mainFiles = files.filter(f => 
      f.name.includes('App.') || 
      f.name.includes('main.') || 
      f.name.includes('index.') ||
      f.name.includes('Main.')
    );
    keyFiles.push(...mainFiles.map(f => f.name));

    // Configuration files
    const configFiles = files.filter(f => 
      f.category === 'config' && (
        f.name.includes('package.json') ||
        f.name.includes('tsconfig.json') ||
        f.name.includes('vite.config') ||
        f.name.includes('tailwind.config')
      )
    );
    keyFiles.push(...configFiles.map(f => f.name));

    // Files that are dependencies of many other files
    const popularFiles = files.filter(f => {
      const deps = Object.values(featureMap).flat();
      const appearances = deps.filter(dep => dep === f.name).length;
      return appearances >= 2;
    });
    keyFiles.push(...popularFiles.map(f => f.name));

    return [...new Set(keyFiles)]; // Remove duplicates
  }

  /**
   * Get cached metadata or generate if needed
   */
  async getProjectMetadata(
    projectId: string,
    projectFiles: { [fileName: string]: string }
  ): Promise<ProjectMetadata> {
    const cached = this.metadataCache.get(projectId);
    
    if (cached && (Date.now() - cached.lastUpdated) < this.CACHE_TTL) {
      console.log(`📋 [ProjectMetadata] Using cached metadata for project: ${projectId}`);
      return cached;
    }

    console.log(`🔄 [ProjectMetadata] Cache miss or expired, generating fresh metadata for: ${projectId}`);
    return this.generateProjectMetadata(projectId, projectFiles);
  }

  /**
   * Filter metadata based on request criteria
   */
  filterRelevantFiles(
    metadata: ProjectMetadata,
    criteria: FileSelectionCriteria
  ): ContextSelectionResult {
    console.log(`🔍 [ProjectMetadata] Filtering files with criteria:`, {
      keywords: criteria.keywords,
      mentionedFiles: criteria.mentionedFiles,
      requestType: criteria.requestType,
      maxFiles: criteria.maxFiles
    });

    const primaryFiles: string[] = [];
    const supportingFiles: string[] = [];
    const configFiles: string[] = [];
    const excludedFiles: string[] = [];

    // Score files based on relevance
    const fileScores = new Map<string, number>();

    for (const file of metadata.files) {
      let score = 0;

      // Direct file mentions get highest score
      if (criteria.mentionedFiles.some(mentioned => 
        file.name.toLowerCase().includes(mentioned.toLowerCase()) ||
        mentioned.toLowerCase().includes(file.name.toLowerCase())
      )) {
        score += 100;
      }

      // Keyword matching
      for (const keyword of criteria.keywords) {
        const keywordLower = keyword.toLowerCase();
        
        if (file.name.toLowerCase().includes(keywordLower)) {
          score += 50;
        }
        
        if (file.keywords.some(k => k.toLowerCase().includes(keywordLower))) {
          score += 30;
        }
        
        for (const [feature, featureFiles] of Object.entries(metadata.featureMap)) {
          if (feature.toLowerCase().includes(keywordLower) && featureFiles.includes(file.name)) {
            score += 40;
          }
        }
      }

      // Category-based scoring
      if (criteria.requestType === 'UPDATE_CODE') {
        if (file.category === 'frontend' || file.category === 'backend') {
          score += 10;
        }
      }

      fileScores.set(file.name, score);
    }

    // Sort files by score
    const sortedFiles = Array.from(fileScores.entries())
      .sort(([,a], [,b]) => b - a);

    // Categorize files
    for (const [fileName, score] of sortedFiles) {
      const file = metadata.files.find(f => f.name === fileName);
      if (!file) continue;

      if (score >= 50) {
        primaryFiles.push(fileName);
      } else if (score >= 20) {
        supportingFiles.push(fileName);
      } else if (file.category === 'config' && criteria.includeConfig && score > 0) {
        configFiles.push(fileName);
      } else {
        excludedFiles.push(fileName);
      }

      const totalSelected = primaryFiles.length + supportingFiles.length + configFiles.length;
      if (totalSelected >= criteria.maxFiles) {
        for (const [remainingFile] of sortedFiles.slice(sortedFiles.findIndex(([f]) => f === fileName) + 1)) {
          if (!excludedFiles.includes(remainingFile)) {
            excludedFiles.push(remainingFile);
          }
        }
        break;
      }
    }

    // Include dependencies of primary files
    const enhancedSupportingFiles = [...supportingFiles];
    for (const primaryFile of primaryFiles) {
      const deps = metadata.relationships[primaryFile];
      if (deps) {
        for (const importedFile of deps.imports) {
          if (!primaryFiles.includes(importedFile) && 
              !enhancedSupportingFiles.includes(importedFile) &&
              !excludedFiles.includes(importedFile)) {
            enhancedSupportingFiles.push(importedFile);
          }
        }
      }
    }

    const totalFiles = primaryFiles.length + enhancedSupportingFiles.length + configFiles.length;
    const estimatedTokens = this.estimateTokens(metadata, [...primaryFiles, ...enhancedSupportingFiles, ...configFiles]);

    console.log(`✅ [ProjectMetadata] File selection complete:`, {
      primary: primaryFiles.length,
      supporting: enhancedSupportingFiles.length,
      config: configFiles.length,
      excluded: excludedFiles.length,
      estimatedTokens
    });

    return {
      primaryFiles,
      supportingFiles: enhancedSupportingFiles,
      configFiles,
      excludedFiles,
      totalFiles,
      estimatedTokens
    };
  }

  /**
   * Extract keywords from user request
   */
  extractRequestKeywords(message: string): string[] {
    const keywords: string[] = [];
    const text = message.toLowerCase();

    // Technical keywords
    const technicalTerms = [
      'component', 'service', 'hook', 'util', 'helper', 'config',
      'auth', 'login', 'signup', 'user', 'profile',
      'database', 'api', 'backend', 'frontend',
      'style', 'css', 'ui', 'interface',
      'route', 'navigation', 'menu',
      'form', 'input', 'button', 'modal',
      'data', 'state', 'store', 'context'
    ];

    for (const term of technicalTerms) {
      if (text.includes(term)) {
        keywords.push(term);
      }
    }

    // Extract file names mentioned
    const filePattern = /(\w+\.(tsx?|jsx?|css|mo|json|html))/gi;
    const fileMatches = message.match(filePattern);
    if (fileMatches) {
      keywords.push(...fileMatches.map(f => f.toLowerCase()));
    }

    // Extract component names (capitalized words)
    const componentPattern = /\b[A-Z][a-zA-Z]+(?:Component|Service|Hook|Utils?|Helper|Interface|Modal|Form|Button|Input|Menu|Navigation|Router|Context|Store|Provider)\b/g;
    const componentMatches = message.match(componentPattern);
    if (componentMatches) {
      keywords.push(...componentMatches.map(c => c.toLowerCase()));
    }

    return [...new Set(keywords)];
  }

  /**
   * Extract mentioned file names from request
   */
  extractMentionedFiles(message: string): string[] {
    const files: string[] = [];
    
    // Direct file name pattern
    const filePattern = /(\w+\.(tsx?|jsx?|css|mo|json|html))/gi;
    const fileMatches = message.match(filePattern);
    if (fileMatches) {
      files.push(...fileMatches);
    }

    // Component references that map to files
    const componentPattern = /\b([A-Z][a-zA-Z]+(?:Component|Service|Hook|Utils?|Helper|Interface|Modal|Form|Button|Input|Menu|Navigation|Router|Context|Store|Provider))\b/g;
    const componentMatches = message.match(componentPattern);
    if (componentMatches) {
      // Convert component names to potential file names
      files.push(...componentMatches.map(c => `${c}.tsx`));
      files.push(...componentMatches.map(c => `${c}.ts`));
    }

    return [...new Set(files)];
  }

  private analyzeFile(fileName: string, content: string): FileMetadata {
    const imports = this.extractImports(content);
    const exports = this.extractExports(content);
    const keywords = this.extractKeywords(fileName, content);
    
    return {
      name: fileName,
      type: this.getFileType(fileName),
      size: content.length,
      lastModified: Date.now(),
      description: this.generateDescription(fileName, content),
      category: this.categorizeFile(fileName),
      keywords,
      imports,
      exports
    };
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import.*?from\s+['"`]([^'"`]+)['"`]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith('.')) {
        // Local import - extract file name
        const fileName = importPath.split('/').pop();
        if (fileName) {
          imports.push(fileName);
        }
      }
    }
    
    return imports;
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];
    
    // Export declarations
    const exportRegex = /export\s+(?:const|function|class|interface|type)\s+(\w+)/g;
    let match;
    
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    
    // Default exports
    if (content.includes('export default')) {
      exports.push('default');
    }
    
    return exports;
  }

  private extractKeywords(fileName: string, content: string): string[] {
    const keywords: string[] = [];
    
    // File name based keywords
    keywords.push(...this.extractBasicKeywords(fileName));
    
    // Content based keywords
    const contentLower = content.toLowerCase();
    const commonPatterns = [
      'react', 'component', 'hook', 'service', 'utility', 'helper',
      'auth', 'login', 'user', 'profile', 'dashboard',
      'api', 'fetch', 'request', 'response',
      'state', 'store', 'context', 'provider',
      'form', 'input', 'button', 'modal',
      'style', 'css', 'theme', 'layout',
      'router', 'route', 'navigation', 'menu',
      'database', 'query', 'crud', 'schema'
    ];
    
    for (const pattern of commonPatterns) {
      if (contentLower.includes(pattern)) {
        keywords.push(pattern);
      }
    }
    
    return [...new Set(keywords)];
  }

  private extractBasicKeywords(fileName: string): string[] {
    const keywords: string[] = [];
    const nameLower = fileName.toLowerCase();
    
    // Extract words from file name
    const words = nameLower
      .replace(/\.(tsx?|jsx?|css|mo|json|html)$/, '')
      .split(/[._-]/)
      .filter(word => word.length > 2);
    
    keywords.push(...words);
    
    return keywords;
  }

  private getFileType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return extension || 'unknown';
  }

  private categorizeFile(fileName: string): 'backend' | 'frontend' | 'config' | 'core' {
    const nameLower = fileName.toLowerCase();
    
    if (nameLower.endsWith('.mo') || nameLower.includes('backend')) {
      return 'backend';
    }
    
    if (nameLower.endsWith('.tsx') || nameLower.endsWith('.jsx') || nameLower.endsWith('.css')) {
      return 'frontend';
    }
    
    if (nameLower.includes('config') || nameLower.endsWith('.json') || nameLower.endsWith('.toml')) {
      return 'config';
    }
    
    return 'core';
  }

  private generateDescription(fileName: string, content: string): string {
    const nameLower = fileName.toLowerCase();
    
    if (nameLower.includes('component')) return 'React component file';
    if (nameLower.includes('service')) return 'Service layer file';
    if (nameLower.includes('hook')) return 'React hook file';
    if (nameLower.includes('util')) return 'Utility functions file';
    if (nameLower.includes('type')) return 'TypeScript type definitions';
    if (nameLower.includes('config')) return 'Configuration file';
    if (nameLower.endsWith('.mo')) return 'Motoko backend file';
    if (nameLower.endsWith('.css')) return 'Stylesheet file';
    
    // Analyze content for description
    if (content.includes('export default function') || content.includes('export const')) {
      return 'React component or function file';
    }
    
    return 'Project file';
  }

  private buildDependencyGraph(relationships: { [fileName: string]: any }): void {
    // Build dependents list (reverse dependencies)
    for (const [fileName, deps] of Object.entries(relationships)) {
      for (const importedFile of deps.imports) {
        if (relationships[importedFile]) {
          if (!relationships[importedFile].dependents.includes(fileName)) {
            relationships[importedFile].dependents.push(fileName);
          }
        }
      }
    }
  }

  private generateFeatureMap(files: FileMetadata[]): { [feature: string]: string[] } {
    const featureMap: { [feature: string]: string[] } = {};
    
    const featurePatterns = {
      auth: ['auth', 'login', 'signup', 'user', 'profile'],
      database: ['database', 'db', 'query', 'crud', 'schema'],
      ui: ['component', 'ui', 'interface', 'layout', 'style'],
      api: ['api', 'service', 'fetch', 'request', 'endpoint'],
      routing: ['route', 'router', 'navigation', 'menu'],
      state: ['state', 'store', 'context', 'provider', 'hook'],
      config: ['config', 'setting', 'env', 'setup']
    };
    
    for (const [feature, patterns] of Object.entries(featurePatterns)) {
      featureMap[feature] = files
        .filter(file => 
          patterns.some(pattern => 
            file.name.toLowerCase().includes(pattern) ||
            file.keywords.some(keyword => keyword.includes(pattern))
          )
        )
        .map(file => file.name);
    }
    
    return featureMap;
  }

  private estimateTokens(metadata: ProjectMetadata, selectedFiles: string[]): number {
    let totalTokens = 0;
    
    for (const fileName of selectedFiles) {
      const file = metadata.files.find(f => f.name === fileName);
      if (file) {
        // Rough estimate: 4 characters per token
        totalTokens += Math.ceil(file.size / 4);
      }
    }
    
    return totalTokens;
  }

  /**
   * Clear cache for a specific project
   */
  clearCache(projectId?: string): void {
    if (projectId) {
      this.metadataCache.delete(projectId);
      console.log(`🧹 [ProjectMetadata] Cleared cache for project: ${projectId}`);
    } else {
      this.metadataCache.clear();
      console.log(`🧹 [ProjectMetadata] Cleared all metadata cache`);
    }
  }
}

export const projectMetadataService = ProjectMetadataService.getInstance();