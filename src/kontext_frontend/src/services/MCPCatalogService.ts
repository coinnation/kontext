/**
 * Service for fetching and managing MCP server catalog information
 * Used by AI generation to understand available tools
 */

import { ClaudeService } from '../claudeService';
import type { MCPTool, MCPSearchResult } from '../claudeService';

export interface MCPServerCatalog {
  servers: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    tools: Array<{
      name: string;
      description: string;
      useCases: string[];
      requiresAuth: boolean;
      authType?: string;
    }>;
    requiresExternalAccount: boolean;
    externalService?: string; // "Zapier", "Rube", etc.
    documentation?: string;
  }>;
  categories: string[];
  totalServers: number;
  totalTools: number;
}

export class MCPCatalogService {
  private static instance: MCPCatalogService;
  private claudeService: ClaudeService;
  private catalogCache: MCPServerCatalog | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.claudeService = new ClaudeService();
  }

  static getInstance(): MCPCatalogService {
    if (!MCPCatalogService.instance) {
      MCPCatalogService.instance = new MCPCatalogService();
    }
    return MCPCatalogService.instance;
  }

  /**
   * Get the full MCP server catalog
   */
  async getCatalog(): Promise<MCPServerCatalog> {
    // Check cache
    const now = Date.now();
    if (this.catalogCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.catalogCache;
    }

    try {
      console.log('📚 [MCPCatalogService] Fetching MCP server catalog...');
      
      // Fetch all tools from ClaudeService
      const searchResult: MCPSearchResult = await this.claudeService.searchMCPTools(
        undefined, // No query - get all
        1000 // Large limit to get all tools
      );

      // Organize tools by server
      const serverMap = new Map<string, {
        id: string;
        name: string;
        description: string;
        category: string;
        tools: Array<{
          name: string;
          description: string;
          useCases: string[];
          requiresAuth: boolean;
          authType?: string;
        }>;
        requiresExternalAccount: boolean;
        externalService?: string;
      }>();

      const categories = new Set<string>();

      // Process tools and group by server
      for (const tool of searchResult.tools) {
        // Extract server ID from tool (assuming format like "zapier/gmail" or "github/issues")
        const serverId = tool.name.split('/')[0] || tool.category || 'unknown';
        const serverName = this.getServerName(serverId);
        const category = tool.category || 'general';
        categories.add(category);

        if (!serverMap.has(serverId)) {
          serverMap.set(serverId, {
            id: serverId,
            name: serverName,
            description: this.getServerDescription(serverId),
            category: category,
            tools: [],
            requiresExternalAccount: this.isExternalService(serverId),
            externalService: this.getExternalService(serverId)
          });
        }

        const server = serverMap.get(serverId)!;
        server.tools.push({
          name: tool.name,
          description: tool.description,
          useCases: tool.useCases || [],
          requiresAuth: tool.requiresAuth || false,
          authType: tool.authType
        });
      }

      // Build catalog
      const catalog: MCPServerCatalog = {
        servers: Array.from(serverMap.values()),
        categories: Array.from(categories),
        totalServers: serverMap.size,
        totalTools: searchResult.tools.length
      };

      // Cache the result
      this.catalogCache = catalog;
      this.cacheTimestamp = now;

      console.log(`✅ [MCPCatalogService] Catalog loaded: ${catalog.totalServers} servers, ${catalog.totalTools} tools`);
      
      return catalog;
    } catch (error) {
      console.error('❌ [MCPCatalogService] Failed to load catalog:', error);
      
      // Return a minimal catalog with common servers
      return this.getDefaultCatalog();
    }
  }

  /**
   * Get a simplified catalog for AI generation (reduces token usage)
   */
  async getSimplifiedCatalog(): Promise<MCPServerCatalog> {
    const fullCatalog = await this.getCatalog();
    
    // Simplify tool descriptions and limit use cases
    return {
      ...fullCatalog,
      servers: fullCatalog.servers.map(server => ({
        ...server,
        tools: server.tools.map(tool => ({
          ...tool,
          description: tool.description.substring(0, 200), // Truncate long descriptions
          useCases: tool.useCases.slice(0, 3) // Limit use cases
        }))
      }))
    };
  }

  /**
   * Search for servers/tools matching a query
   */
  async search(query: string): Promise<MCPServerCatalog> {
    const catalog = await this.getCatalog();
    const lowerQuery = query.toLowerCase();

    const matchingServers = catalog.servers.filter(server => {
      // Match server name, description, or category
      if (
        server.name.toLowerCase().includes(lowerQuery) ||
        server.description.toLowerCase().includes(lowerQuery) ||
        server.category.toLowerCase().includes(lowerQuery)
      ) {
        return true;
      }

      // Match any tool in the server
      return server.tools.some(tool =>
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description.toLowerCase().includes(lowerQuery) ||
        tool.useCases.some(uc => uc.toLowerCase().includes(lowerQuery))
      );
    });

    return {
      ...catalog,
      servers: matchingServers,
      totalServers: matchingServers.length
    };
  }

  /**
   * Get server name from ID
   */
  private getServerName(serverId: string): string {
    const nameMap: Record<string, string> = {
      'zapier': 'Zapier',
      'rube': 'Rube',
      'github': 'GitHub',
      'slack': 'Slack',
      'discord': 'Discord',
      'filesystem': 'File System',
      'database': 'Database',
      'web': 'Web Search',
      'email': 'Email',
      'calendar': 'Calendar',
      'aws': 'AWS',
      'gcp': 'Google Cloud',
      'azure': 'Azure',
      'notion': 'Notion',
      'airtable': 'Airtable',
      'trello': 'Trello',
      'linear': 'Linear'
    };

    return nameMap[serverId.toLowerCase()] || serverId.charAt(0).toUpperCase() + serverId.slice(1);
  }

  /**
   * Get server description
   */
  private getServerDescription(serverId: string): string {
    const descMap: Record<string, string> = {
      'zapier': 'Connect to 6,000+ apps and services through Zapier integrations',
      'rube': 'Access comprehensive library of MCP tools and integrations',
      'github': 'Manage repositories, issues, pull requests, and code',
      'slack': 'Send messages, manage channels, respond to team communications',
      'discord': 'Interact with Discord servers, channels, and messages',
      'filesystem': 'Read/write files, manage directories, manipulate content',
      'database': 'Query databases, update records, manage schemas',
      'web': 'Search the web, gather real-time information',
      'email': 'Send and receive emails, manage inboxes',
      'calendar': 'Create events, manage schedules, coordinate meetings'
    };

    return descMap[serverId.toLowerCase()] || `Access ${this.getServerName(serverId)} tools and capabilities`;
  }

  /**
   * Check if server requires external account
   */
  private isExternalService(serverId: string): boolean {
    const externalServices = ['zapier', 'rube', 'slack', 'discord', 'github', 'notion', 'airtable', 'trello', 'linear'];
    return externalServices.includes(serverId.toLowerCase());
  }

  /**
   * Get external service name
   */
  private getExternalService(serverId: string): string | undefined {
    if (serverId.toLowerCase() === 'zapier') return 'Zapier';
    if (serverId.toLowerCase() === 'rube') return 'Rube';
    return undefined;
  }

  /**
   * Get default catalog (fallback)
   */
  private getDefaultCatalog(): MCPServerCatalog {
    return {
      servers: [
        {
          id: 'zapier',
          name: 'Zapier',
          description: 'Connect to 6,000+ apps and services',
          category: 'integration',
          tools: [
            {
              name: 'zapier/trigger',
              description: 'Trigger Zapier workflows',
              useCases: ['Automate workflows', 'Connect apps'],
              requiresAuth: true,
              authType: 'api_key'
            }
          ],
          requiresExternalAccount: true,
          externalService: 'Zapier'
        },
        {
          id: 'github',
          name: 'GitHub',
          description: 'Manage repositories, issues, and pull requests',
          category: 'development',
          tools: [
            {
              name: 'github/issues',
              description: 'Create and manage GitHub issues',
              useCases: ['Issue tracking', 'Project management'],
              requiresAuth: true,
              authType: 'token'
            }
          ],
          requiresExternalAccount: true
        },
        {
          id: 'filesystem',
          name: 'File System',
          description: 'Read and write files',
          category: 'system',
          tools: [
            {
              name: 'filesystem/read',
              description: 'Read files from disk',
              useCases: ['File processing', 'Data access'],
              requiresAuth: false
            }
          ],
          requiresExternalAccount: false
        }
      ],
      categories: ['integration', 'development', 'system'],
      totalServers: 3,
      totalTools: 3
    };
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.catalogCache = null;
    this.cacheTimestamp = 0;
  }
}

