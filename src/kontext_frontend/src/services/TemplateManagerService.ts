export type TemplateName = 
  | 'CRM'
  | 'Ecommerce'
  | 'HRManagement'
  | 'HttpOutcallAuth'
  | 'HttpOutcallPublic'
  | 'MultiEntityAnalytics'
  | 'MultiEntityRelationships'
  | 'SimpleCrudAuth'
  | 'SimpleCrudPublic'
  | 'StatelessQuery'
  | 'WorkflowApproval'
  | 'Game';

export interface TemplateContent {
  name: TemplateName;
  backendTemplate: string;
  frontendTemplate: string;
  backendInstructions: string;
  frontendInstructions: string;
  backendRules: string;
  frontendRules: string;
  fetchedAt: number;
}

export interface TemplateUrls {
  backendTemplate: string;
  frontendTemplate: string;
  backendInstructions: string;
  frontendInstructions: string;
  backendRules: string;
  frontendRules: string;
}

export interface TemplateFetchResult {
  success: boolean;
  content?: TemplateContent;
  error?: string;
  cached?: boolean;
}

// 🔧 NEW: Asset metadata for cache invalidation
interface AssetMetadata {
  lastModified?: string; // Last-Modified header value
  etag?: string; // ETag header value
  url: string; // URL of the asset
  cachedAt: number; // When we cached this
}

export class TemplateManagerService {
  private static instance: TemplateManagerService;
  private templateCache: Map<TemplateName, TemplateContent> = new Map();
  private instructionCache: { 
    backend?: string; 
    frontend?: string; 
    backendRules?: string; 
    frontendRules?: string; 
    fetchedAt?: number;
    // 🔧 NEW: Asset metadata for cache invalidation
    metadata?: {
      backend?: AssetMetadata;
      frontend?: AssetMetadata;
      backendRules?: AssetMetadata;
      frontendRules?: AssetMetadata;
    }
  } = {};
  private readonly cacheTimeout = 30 * 60 * 1000; // 30 minutes
  
  // Template base URLs - matches your existing pattern
  private static readonly BASE_URL = 'https://pwi5a-sqaaa-aaaaa-qcfgq-cai.raw.icp0.io/projects/project-mfvtjz8x-hc7uz';
  
  // Force template override - set to true to always fetch MotokoReactBible
  private readonly forceMotokoReactBible = true;
  
  private constructor() {}

  public static getInstance(): TemplateManagerService {
    if (!TemplateManagerService.instance) {
      TemplateManagerService.instance = new TemplateManagerService();
    }
    return TemplateManagerService.instance;
  }

  /**
   * Fetch complete template content for a given template name
   */
  public async fetchTemplate(templateName: TemplateName | string): Promise<TemplateFetchResult> {
    try {
      console.log(`📥 [Template Manager] Fetching template ${templateName}...`);
      
      // FORCE OVERRIDE: Always fetch MotokoReactBible if flag is enabled
      if (this.forceMotokoReactBible) {
        console.log(`🔄 [Template Manager] FORCING MotokoReactBible instead of requested template: ${templateName}`);
        return await this.fetchMotokoReactBible(templateName);
      }
      
      // Check cache first
      const cached = this.getCachedTemplate(templateName as TemplateName);
      if (cached) {
        console.log(`✅ [Template Manager] Using cached template ${templateName}`);
        return {
          success: true,
          content: cached,
          cached: true
        };
      }

      // Quick and dirty hardcode for MotokoReactBible
      if (templateName === 'MotokoReactBible') {
        return await this.fetchMotokoReactBible(templateName);
      }

      // Original logic for official templates
      const urls = this.generateTemplateUrls(templateName as TemplateName);
      
      // Fetch template files, instructions, and rules in parallel
      const [
        backendTemplateResult,
        frontendTemplateResult,
        backendInstructions,
        frontendInstructions,
        backendRules,
        frontendRules
      ] = await Promise.all([
        this.fetchContent(urls.backendTemplate, `Backend Template ${templateName}`),
        this.fetchContent(urls.frontendTemplate, `Frontend Template ${templateName}`),
        this.fetchCachedInstructions('backend', urls.backendInstructions),
        this.fetchCachedInstructions('frontend', urls.frontendInstructions),
        this.fetchCachedInstructions('backendRules', urls.backendRules),
        this.fetchCachedInstructions('frontendRules', urls.frontendRules)
      ]);

      // Extract content from fetch results
      const backendTemplate = backendTemplateResult.content;
      const frontendTemplate = frontendTemplateResult.content;

      // Validate all components were fetched successfully
      if (!backendTemplate || !frontendTemplate || !backendInstructions || !frontendInstructions || !backendRules || !frontendRules) {
        throw new Error('Failed to fetch one or more template components');
      }

      // Create template content object
      const templateContent: TemplateContent = {
        name: templateName as TemplateName,
        backendTemplate,
        frontendTemplate,
        backendInstructions,
        frontendInstructions,
        backendRules,
        frontendRules,
        fetchedAt: Date.now()
      };

      // Cache the template (instructions and rules are cached separately)
      this.templateCache.set(templateName as TemplateName, templateContent);
      
      console.log(`✅ [Template Manager] Template ${templateName} fetched and cached successfully`);
      console.log(`   Backend template: ${backendTemplate.length} chars`);
      console.log(`   Frontend template: ${frontendTemplate.length} chars`);
      console.log(`   Backend instructions: ${backendInstructions.length} chars (shared)`);
      console.log(`   Frontend instructions: ${frontendInstructions.length} chars (shared)`);
      console.log(`   Backend rules: ${backendRules.length} chars (shared)`);
      console.log(`   Frontend rules: ${frontendRules.length} chars (shared)`);

      return {
        success: true,
        content: templateContent,
        cached: false
      };

    } catch (error) {
      console.error(`❌ [Template Manager] Failed to fetch template ${templateName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown fetch error'
      };
    }
  }

  /**
   * Private method to fetch MotokoReactBible template
   */
  private async fetchMotokoReactBible(originalTemplateName: TemplateName | string): Promise<TemplateFetchResult> {
    const [
      backendTemplateResult,
      frontendTemplateResult,
      backendInstructions,
      frontendInstructions,
      backendRules,
      frontendRules
    ] = await Promise.all([
      this.fetchContent(`${TemplateManagerService.BASE_URL}/templates/MotokoReactBible.mo`, `Backend Template MotokoReactBible`),
      this.fetchContent(`${TemplateManagerService.BASE_URL}/templates/MotokoReactBibleUI.tsx`, `Frontend Template MotokoReactBible`),
      this.fetchCachedInstructions('backend', `${TemplateManagerService.BASE_URL}/backend_prompt.md`),
      this.fetchCachedInstructions('frontend', `${TemplateManagerService.BASE_URL}/frontend_prompt.md`),
      this.fetchCachedInstructions('backendRules', `${TemplateManagerService.BASE_URL}/backend_rules.md`),
      this.fetchCachedInstructions('frontendRules', `${TemplateManagerService.BASE_URL}/frontend_rules.md`)
    ]);

    // Extract content from fetch results
    const backendTemplate = backendTemplateResult.content;
    const frontendTemplate = frontendTemplateResult.content;

    if (!backendTemplate || !frontendTemplate || !backendInstructions || !frontendInstructions || !backendRules || !frontendRules) {
      throw new Error('Failed to fetch one or more MotokoReactBible template components');
    }

    const templateContent: TemplateContent = {
      name: originalTemplateName as TemplateName, // Keep original name for consistency with caller expectations
      backendTemplate,
      frontendTemplate,
      backendInstructions,
      frontendInstructions,
      backendRules,
      frontendRules,
      fetchedAt: Date.now()
    };

    console.log(`✅ [Template Manager] MotokoReactBible template fetched successfully (forced override)`);
    console.log(`   Original request was for: ${originalTemplateName}`);
    console.log(`   Actually fetched: MotokoReactBible`);
    console.log(`   Backend template: ${backendTemplate.length} chars`);
    console.log(`   Frontend template: ${frontendTemplate.length} chars`);

    return {
      success: true,
      content: templateContent,
      cached: false
    };
  }

  
  /**
   * Fetch template content with fallback to generic prompts
   */
  public async fetchTemplateWithFallback(templateName: TemplateName): Promise<TemplateFetchResult> {
    const result = await this.fetchTemplate(templateName);
    
    if (result.success) {
      return result;
    }

    // Fallback: try to fetch generic prompts and rules instead
    console.log(`⚠️ [Template Manager] Template ${templateName} failed, attempting fallback to generic prompts and rules...`);
    
    try {
      const [backendInstructionsResult, frontendInstructionsResult, backendRulesResult, frontendRulesResult] = await Promise.all([
        this.fetchContent(`${TemplateManagerService.BASE_URL}/backend_prompt.md`, 'Generic Backend Instructions'),
        this.fetchContent(`${TemplateManagerService.BASE_URL}/frontend_prompt.md`, 'Generic Frontend Instructions'),
        this.fetchContent(`${TemplateManagerService.BASE_URL}/backend_rules.md`, 'Generic Backend Rules'),
        this.fetchContent(`${TemplateManagerService.BASE_URL}/frontend_rules.md`, 'Generic Frontend Rules')
      ]);

      // Extract content from fetch results
      const backendInstructions = backendInstructionsResult.content;
      const frontendInstructions = frontendInstructionsResult.content;
      const backendRules = backendRulesResult.content;
      const frontendRules = frontendRulesResult.content;

      if (!backendInstructions || !frontendInstructions || !backendRules || !frontendRules) {
        throw new Error('Failed to fetch fallback generic prompts and rules');
      }

      // Create fallback template content (empty templates, generic instructions and rules)
      const fallbackContent: TemplateContent = {
        name: templateName,
        backendTemplate: '', // Empty template means use generic generation
        frontendTemplate: '', // Empty template means use generic generation
        backendInstructions,
        frontendInstructions,
        backendRules,
        frontendRules,
        fetchedAt: Date.now()
      };

      console.log(`✅ [Template Manager] Using generic prompts and rules as fallback for template ${templateName}`);

      return {
        success: true,
        content: fallbackContent,
        cached: false
      };

    } catch (fallbackError) {
      console.error(`❌ [Template Manager] Fallback also failed for template ${templateName}:`, fallbackError);
      return {
        success: false,
        error: `Template fetch failed and fallback failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Generate URLs for template components based on template name
   */
  private generateTemplateUrls(templateName: TemplateName): TemplateUrls {
    const baseUrl = TemplateManagerService.BASE_URL;
    
    return {
      // Backend: templateName.mo
      backendTemplate: `${baseUrl}/templates/${templateName}.mo`,
      // Frontend: templateNameUI.tsx
      frontendTemplate: `${baseUrl}/templates/${templateName}UI.tsx`,
      // Instructions are the same generic files for all templates
      backendInstructions: `${baseUrl}/backend_prompt.md`,
      frontendInstructions: `${baseUrl}/frontend_prompt.md`,
      // Rules are also the same generic files for all templates
      backendRules: `${baseUrl}/backend_rules.md`,
      frontendRules: `${baseUrl}/frontend_rules.md`
    };
  }

  /**
   * Fetch instructions/rules with caching (since they're the same for all templates)
   */
  private async fetchCachedInstructions(type: 'backend' | 'frontend' | 'backendRules' | 'frontendRules', url: string): Promise<string> {
    const cacheKey = type;
    const metadataKey = type as keyof NonNullable<typeof this.instructionCache.metadata>;
    
    // Check if instructions/rules are cached
    if (this.instructionCache[cacheKey] && this.instructionCache.fetchedAt) {
      const age = Date.now() - this.instructionCache.fetchedAt;
      
      // If within timeout, check metadata to see if asset has been updated
      if (age < this.cacheTimeout) {
        const cachedMetadata = this.instructionCache.metadata?.[metadataKey];
        
        // Check if asset metadata has changed
        const metadataCheck = await this.checkAssetMetadata(url, cachedMetadata);
        
        if (!metadataCheck.hasChanged && cachedMetadata) {
          console.log(`✅ [Template Manager] Using cached ${type} (metadata unchanged)`);
          return this.instructionCache[cacheKey]!;
        }
        
        // Metadata changed or not available, need to fetch fresh
        if (metadataCheck.hasChanged) {
          console.log(`🔄 [Template Manager] Asset updated, fetching fresh ${type}`);
        }
      } else {
        console.log(`⏰ [Template Manager] Cache expired for ${type}, fetching fresh`);
      }
    }
    
    // Fetch fresh instructions/rules
    const displayName = type.includes('Rules') ? 
      `${type.replace('Rules', '')} rules` : 
      `${type} instructions`;
    console.log(`📥 [Template Manager] Fetching fresh ${displayName} (shared for all templates)`);
    const { content, metadata } = await this.fetchContent(url, `${displayName}`);
    
    // Cache the content and metadata
    this.instructionCache[cacheKey] = content;
    if (!this.instructionCache.fetchedAt) {
      this.instructionCache.fetchedAt = Date.now();
    }
    
    // Store metadata for future checks
    if (!this.instructionCache.metadata) {
      this.instructionCache.metadata = {};
    }
    this.instructionCache.metadata[metadataKey] = metadata;
    
    return content;
  }

  /**
   * Check if asset has been updated by comparing metadata (Last-Modified or ETag headers)
   * This allows immediate detection of asset updates without waiting for cache timeout
   * 
   * @param url - URL of the asset to check
   * @param cachedMetadata - Previously cached metadata (if any)
   * @returns Object indicating if asset has changed and new metadata if available
   */
  private async checkAssetMetadata(url: string, cachedMetadata?: AssetMetadata): Promise<{ hasChanged: boolean; newMetadata?: AssetMetadata }> {
    try {
      // Make HEAD request to check metadata without downloading content
      const response = await fetch(url, { method: 'HEAD' });
      
      if (!response.ok) {
        // If HEAD fails, assume we need to fetch (could be CORS or server doesn't support HEAD)
        console.log(`⚠️ [Template Manager] HEAD request failed for ${url}, will fetch to check`);
        return { hasChanged: true };
      }
      
      const lastModified = response.headers.get('Last-Modified');
      const etag = response.headers.get('ETag');
      
      // If no metadata available, assume unchanged (fallback to time-based cache)
      if (!lastModified && !etag) {
        console.log(`ℹ️ [Template Manager] No metadata headers available for ${url}, using time-based cache`);
        return { hasChanged: false };
      }
      
      // Check if metadata has changed
      const hasChanged = cachedMetadata ? (
        (lastModified && cachedMetadata.lastModified !== lastModified) ||
        (etag && cachedMetadata.etag !== etag)
      ) : true; // No cached metadata means we need to fetch
      
      const newMetadata: AssetMetadata = {
        lastModified: lastModified || undefined,
        etag: etag || undefined,
        url,
        cachedAt: Date.now()
      };
      
      if (hasChanged) {
        console.log(`🔄 [Template Manager] Asset metadata changed for ${url}`, {
          oldLastModified: cachedMetadata?.lastModified,
          newLastModified: lastModified,
          oldEtag: cachedMetadata?.etag,
          newEtag: etag
        });
      } else {
        console.log(`✅ [Template Manager] Asset metadata unchanged for ${url}`);
      }
      
      return { hasChanged, newMetadata };
      
    } catch (error) {
      // If metadata check fails, assume unchanged (fallback to time-based cache)
      console.warn(`⚠️ [Template Manager] Failed to check metadata for ${url}, using time-based cache:`, error);
      return { hasChanged: false };
    }
  }

  /**
   * Fetch content from URL with error handling and metadata extraction
   */
  private async fetchContent(url: string, description: string): Promise<{ content: string; metadata: AssetMetadata }> {
    try {
      console.log(`📥 [Template Manager] Fetching ${description} from: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const content = await response.text();
      
      if (!content || content.trim().length === 0) {
        throw new Error('Empty content received');
      }
      
      // Extract metadata from response headers
      const metadata: AssetMetadata = {
        lastModified: response.headers.get('Last-Modified') || undefined,
        etag: response.headers.get('ETag') || undefined,
        url,
        cachedAt: Date.now()
      };
      
      console.log(`✅ [Template Manager] ${description} fetched successfully (${content.length} characters)`, {
        lastModified: metadata.lastModified,
        etag: metadata.etag ? metadata.etag.substring(0, 20) + '...' : 'none'
      });
      
      return { content, metadata };
      
    } catch (error) {
      console.error(`❌ [Template Manager] Failed to fetch ${description}:`, error);
      throw error;
    }
  }

  /**
   * Get cached template if available and not expired
   */
  private getCachedTemplate(templateName: TemplateName): TemplateContent | null {
    const cached = this.templateCache.get(templateName);
    
    if (!cached) {
      return null;
    }
    
    // Check if cache is expired
    const age = Date.now() - cached.fetchedAt;
    if (age > this.cacheTimeout) {
      console.log(`⏰ [Template Manager] Template ${templateName} cache expired (${Math.round(age / 60000)}min old)`);
      this.templateCache.delete(templateName);
      return null;
    }
    
    return cached;
  }

  /**
   * Preload templates for better performance
   */
  public async preloadTemplates(templateNames: TemplateName[]): Promise<void> {
    console.log(`🚀 [Template Manager] Preloading ${templateNames.length} templates...`);
    
    const preloadPromises = templateNames.map(async (name) => {
      try {
        await this.fetchTemplate(name);
        console.log(`✅ [Template Manager] Preloaded template ${name}`);
      } catch (error) {
        console.warn(`⚠️ [Template Manager] Failed to preload template ${name}:`, error);
      }
    });
    
    await Promise.allSettled(preloadPromises);
    console.log(`🏁 [Template Manager] Template preloading completed`);
  }

  /**
   * Preload all available templates
   */
  public async preloadAllTemplates(): Promise<void> {
    const allTemplates: TemplateName[] = [
      'CRM',
      'Ecommerce',
      'HRManagement',
      'HttpOutcallAuth',
      'HttpOutcallPublic',
      'MultiEntityAnalytics',
      'MultiEntityRelationships',
      'SimpleCrudAuth',
      'SimpleCrudPublic',
      'StatelessQuery',
      'WorkflowApproval',
      'Game'
    ];
    
    await this.preloadTemplates(allTemplates);
  }

  /**
   * Clear cache (useful for development/testing)
   */
  public clearCache(): void {
    const templateCacheSize = this.templateCache.size;
    this.templateCache.clear();
    this.instructionCache = {};
    console.log(`🧹 [Template Manager] Cache cleared (${templateCacheSize} templates + shared instructions/rules removed)`);
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    templateCount: number;
    templates: TemplateName[];
    instructionsCached: boolean;
    rulesCached: boolean;
  } {
    return {
      templateCount: this.templateCache.size,
      templates: Array.from(this.templateCache.keys()),
      instructionsCached: !!(this.instructionCache.backend && this.instructionCache.frontend),
      rulesCached: !!(this.instructionCache.backendRules && this.instructionCache.frontendRules)
    };
  }

  /**
   * Validate template content for completeness
   */
  public validateTemplate(content: TemplateContent): {valid: boolean, issues: string[]} {
    const issues: string[] = [];
    
    if (!content.backendTemplate || content.backendTemplate.trim().length === 0) {
      issues.push('Backend template is empty');
    }
    
    if (!content.frontendTemplate || content.frontendTemplate.trim().length === 0) {
      issues.push('Frontend template is empty');
    }
    
    if (!content.backendInstructions || content.backendInstructions.trim().length === 0) {
      issues.push('Backend instructions are empty');
    }
    
    if (!content.frontendInstructions || content.frontendInstructions.trim().length === 0) {
      issues.push('Frontend instructions are empty');
    }

    if (!content.backendRules || content.backendRules.trim().length === 0) {
      issues.push('Backend rules are empty');
    }
    
    if (!content.frontendRules || content.frontendRules.trim().length === 0) {
      issues.push('Frontend rules are empty');
    }
    
    // Check for template placeholders or common issues
    if (content.backendTemplate.includes('{{') || content.backendTemplate.includes('}}')) {
      issues.push('Backend template contains unresolved placeholders');
    }
    
    if (content.frontendTemplate.includes('{{') || content.frontendTemplate.includes('}}')) {
      issues.push('Frontend template contains unresolved placeholders');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Get template content size information
   */
  public getTemplateSizes(content: TemplateContent): {
    backendTemplate: number;
    frontendTemplate: number;
    backendInstructions: number;
    frontendInstructions: number;
    backendRules: number;
    frontendRules: number;
    total: number;
  } {
    const sizes = {
      backendTemplate: content.backendTemplate.length,
      frontendTemplate: content.frontendTemplate.length,
      backendInstructions: content.backendInstructions.length,
      frontendInstructions: content.frontendInstructions.length,
      backendRules: content.backendRules.length,
      frontendRules: content.frontendRules.length,
      total: 0
    };
    
    sizes.total = sizes.backendTemplate + sizes.frontendTemplate + 
                  sizes.backendInstructions + sizes.frontendInstructions +
                  sizes.backendRules + sizes.frontendRules;
    
    return sizes;
  }

  /**
   * Check if template exists (without fetching content)
   */
  public async templateExists(templateName: TemplateName): Promise<boolean> {
    try {
      const urls = this.generateTemplateUrls(templateName);
      
      // Check if all required files exist
      const [backendExists, frontendExists, backendRulesExists, frontendRulesExists] = await Promise.all([
        fetch(urls.backendTemplate, { method: 'HEAD' }).then(r => r.ok),
        fetch(urls.frontendTemplate, { method: 'HEAD' }).then(r => r.ok),
        fetch(urls.backendRules, { method: 'HEAD' }).then(r => r.ok),
        fetch(urls.frontendRules, { method: 'HEAD' }).then(r => r.ok)
      ]);
      
      return backendExists && frontendExists && backendRulesExists && frontendRulesExists;
      
    } catch (error) {
      console.warn(`⚠️ [Template Manager] Error checking if template ${templateName} exists:`, error);
      return false;
    }
  }

  /**
   * Get list of all available template names
   */
  public getAllTemplateNames(): TemplateName[] {
    return [
      'CRM',
      'Ecommerce',
      'HRManagement',
      'HttpOutcallAuth',
      'HttpOutcallPublic',
      'MultiEntityAnalytics',
      'MultiEntityRelationships',
      'SimpleCrudAuth',
      'SimpleCrudPublic',
      'StatelessQuery',
      'WorkflowApproval',
      'Game'
    ];
  }

  /**
   * Toggle the MotokoReactBible forcing (useful for development)
   */
  public setForceMotokoReactBible(force: boolean): void {
    (this as any).forceMotokoReactBible = force;
    console.log(`🔧 [Template Manager] MotokoReactBible forcing ${force ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Check if MotokoReactBible forcing is enabled
   */
  public isForcingMotokoReactBible(): boolean {
    return this.forceMotokoReactBible;
  }
}

// Convenience exports
export const templateManager = TemplateManagerService.getInstance();

export async function fetchTemplate(templateName: TemplateName): Promise<TemplateFetchResult> {
  return templateManager.fetchTemplate(templateName);
}

export async function fetchTemplateWithFallback(templateName: TemplateName): Promise<TemplateFetchResult> {
  return templateManager.fetchTemplateWithFallback(templateName);
}