/**
 * Change Detection Service - Analyzes file changes to determine
 * if hot reload is possible or if full deployment is required
 */

interface FileChange {
  fileName: string;
  oldContent: string;
  newContent: string;
  changeType: 'css' | 'style' | 'content' | 'structure' | 'backend' | 'dependency';
  canHotReload: boolean;
  requiresDeployment: boolean;
}

interface ChangeAnalysis {
  changes: FileChange[];
  strategy: 'hot-reload' | 'preview-update' | 'full-deploy';
  hotReloadableFiles: FileChange[];
  requiresDeploymentFiles: FileChange[];
}

class ChangeDetectionService {
  private static instance: ChangeDetectionService;

  private constructor() {}

  static getInstance(): ChangeDetectionService {
    if (!ChangeDetectionService.instance) {
      ChangeDetectionService.instance = new ChangeDetectionService();
    }
    return ChangeDetectionService.instance;
  }

  /**
   * Analyze changes between old and new files
   */
  analyzeChanges(
    oldFiles: Record<string, string>,
    newFiles: Record<string, string>
  ): ChangeAnalysis {
    const changes: FileChange[] = [];

    // Detect all changes
    for (const [fileName, newContent] of Object.entries(newFiles)) {
      const oldContent = oldFiles[fileName] || '';

      if (oldContent === newContent) continue; // No change

      const changeType = this.detectChangeType(fileName, oldContent, newContent);
      const canHotReload = this.canHotReload(fileName, changeType, oldContent, newContent);
      const requiresDeployment = this.requiresDeployment(fileName, changeType, oldContent, newContent);

      changes.push({
        fileName,
        oldContent,
        newContent,
        changeType,
        canHotReload,
        requiresDeployment
      });
    }

    // Check for deleted files
    for (const fileName of Object.keys(oldFiles)) {
      if (!(fileName in newFiles)) {
        // File was deleted - requires deployment
        changes.push({
          fileName,
          oldContent: oldFiles[fileName],
          newContent: '',
          changeType: 'structure',
          canHotReload: false,
          requiresDeployment: true
        });
      }
    }

    // Categorize changes
    const hotReloadableFiles = changes.filter(c => c.canHotReload);
    const requiresDeploymentFiles = changes.filter(c => c.requiresDeployment);

    // Determine strategy
    const strategy = this.determineStrategy(changes, hotReloadableFiles, requiresDeploymentFiles);

    return {
      changes,
      strategy,
      hotReloadableFiles,
      requiresDeploymentFiles
    };
  }

  /**
   * Detect the type of change
   */
  private detectChangeType(
    fileName: string,
    oldContent: string,
    newContent: string
  ): FileChange['changeType'] {
    // Backend files always require deployment
    if (fileName.endsWith('.mo') || fileName.endsWith('.did')) {
      return 'backend';
    }

    // Dependency changes
    if (fileName === 'package.json' || fileName.includes('package.json')) {
      return 'dependency';
    }

    // CSS files
    if (fileName.endsWith('.css') || fileName.endsWith('.scss') || fileName.endsWith('.less')) {
      return 'css';
    }

    // Component files - check if it's style-only
    if (fileName.match(/\.(tsx|jsx|ts|js)$/)) {
      if (this.isOnlyStyleChange(oldContent, newContent)) {
        return 'style';
      }
      if (this.isOnlyContentChange(oldContent, newContent)) {
        return 'content';
      }
      return 'structure';
    }

    // HTML files
    if (fileName.endsWith('.html')) {
      if (this.isOnlyContentChange(oldContent, newContent)) {
        return 'content';
      }
      return 'structure';
    }

    // Default to structure (requires deployment)
    return 'structure';
  }

  /**
   * Check if change can be hot reloaded
   */
  private canHotReload(
    fileName: string,
    changeType: FileChange['changeType'],
    oldContent: string,
    newContent: string
  ): boolean {
    // Backend changes cannot be hot reloaded
    if (changeType === 'backend') return false;

    // Dependency changes require deployment
    if (changeType === 'dependency') {
      // Check if dependencies actually changed
      if (fileName === 'package.json') {
        const oldDeps = this.extractDependencies(oldContent);
        const newDeps = this.extractDependencies(newContent);
        return JSON.stringify(oldDeps) === JSON.stringify(newDeps);
      }
      return false;
    }

    // CSS files can always be hot reloaded
    if (changeType === 'css') return true;

    // Style-only changes in components can be hot reloaded
    if (changeType === 'style') return true;

    // Simple content changes might be hot reloadable
    if (changeType === 'content') {
      // For now, content changes go through preview update
      // (more reliable than trying to inject HTML)
      return false;
    }

    // Structural changes require full deployment
    return false;
  }

  /**
   * Check if change requires full deployment
   */
  private requiresDeployment(
    fileName: string,
    changeType: FileChange['changeType'],
    oldContent: string,
    newContent: string
  ): boolean {
    // Backend always requires deployment
    if (changeType === 'backend') return true;

    // New dependencies require deployment
    if (changeType === 'dependency') {
      if (fileName === 'package.json') {
        const oldDeps = this.extractDependencies(oldContent);
        const newDeps = this.extractDependencies(newContent);
        return JSON.stringify(oldDeps) !== JSON.stringify(newDeps);
      }
      return true;
    }

    // Structural changes require deployment
    if (changeType === 'structure') return true;

    // CSS and style changes don't require deployment (can use preview)
    return false;
  }

  /**
   * Determine overall strategy
   */
  private determineStrategy(
    allChanges: FileChange[],
    hotReloadable: FileChange[],
    requiresDeploy: FileChange[]
  ): ChangeAnalysis['strategy'] {
    // If any change requires deployment, do full deploy
    if (requiresDeploy.length > 0) {
      return 'full-deploy';
    }

    // If all changes can be hot reloaded, use hot reload
    if (hotReloadable.length === allChanges.length && hotReloadable.length > 0) {
      return 'hot-reload';
    }

    // Mixed changes - use preview update (dev server)
    if (allChanges.length > 0) {
      return 'preview-update';
    }

    // No changes
    return 'full-deploy';
  }

  /**
   * Check if change is only in styles (CSS-in-JS, inline styles)
   */
  private isOnlyStyleChange(oldContent: string, newContent: string): boolean {
    // Remove style-related code and compare
    const removeStyles = (content: string) => {
      // Use RegExp constructor to avoid backtick parsing issues
      const cssTemplateLiteralPattern = new RegExp('css\\s*`[^`]*`', 'g');
      
      return content
        .replace(/style\s*=\s*\{[^}]*\}/g, '') // Inline styles
        .replace(/className\s*=\s*["'][^"']*["']/g, '') // Class names
        .replace(cssTemplateLiteralPattern, '') // CSS template literals (e.g., css`...`)
        .replace(/\.css\s*['"]/g, '') // CSS imports
        .replace(/\s+/g, ' ')
        .trim();
    };

    const oldWithoutStyles = removeStyles(oldContent);
    const newWithoutStyles = removeStyles(newContent);

    return oldWithoutStyles === newWithoutStyles;
  }

  /**
   * Check if change is only in content (text, not structure)
   */
  private isOnlyContentChange(oldContent: string, newContent: string): boolean {
    // Remove text content and compare structure
    const removeContent = (content: string) => {
      return content
        .replace(/>[^<]+</g, '><') // Text between tags
        .replace(/\s+/g, ' ')
        .trim();
    };

    const oldStructure = removeContent(oldContent);
    const newStructure = removeContent(newContent);

    return oldStructure === newStructure;
  }

  /**
   * Extract dependencies from package.json
   */
  private extractDependencies(packageJsonContent: string): Record<string, string> {
    try {
      const pkg = JSON.parse(packageJsonContent);
      return {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {})
      };
    } catch {
      return {};
    }
  }
}

export const changeDetectionService = ChangeDetectionService.getInstance();

