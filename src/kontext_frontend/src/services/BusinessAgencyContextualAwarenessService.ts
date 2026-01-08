import { Identity } from '@dfinity/agent';
import type { BusinessAgency, AgencyGoal, AgencyMetrics } from '../types/businessAgency';
import { BusinessAgencyStorageService } from './BusinessAgencyStorageService';

export interface BusinessAgencyCapabilities {
  agencyId: string;
  name: string;
  description: string;
  category: 'marketing' | 'sales' | 'support' | 'operations' | 'custom';
  icon: string;
  color?: string;
  agentIds: string[];
  workflowIds: string[];
  goals: Array<{
    goalId: string;
    name: string;
    description: string;
    target: string;
    currentValue?: string;
    status: 'active' | 'completed' | 'paused';
  }>;
  metrics: {
    totalExecutions: number;
    successRate: number;
    businessImpact?: Record<string, number>;
    costMetrics?: any;
  };
  capabilities: string[];
}

export interface BusinessAgencyDocumentation {
  agencyId: string;
  name: string;
  description: string;
  category: string;
  displayComponents: Array<{
    component: 'dashboard' | 'metrics' | 'goals' | 'cost-tracker';
    description: string;
    props: Array<{ name: string; type: string; required: boolean }>;
  }>;
  externalIntegrationPoints: Array<{
    service: string;
    metric: string;
    description: string;
  }>;
}

export class BusinessAgencyContextualAwarenessService {
  /**
   * Discover business agency capabilities
   */
  static async discoverBusinessAgencyCapabilities(
    agencyId: string,
    userCanisterId: string,
    projectId: string
  ): Promise<BusinessAgencyCapabilities> {
    console.log(`🔍 [BusinessAgencyAwareness] Discovering capabilities for agency: ${agencyId}`);
    
    try {
      // Load business agency from storage
      const agencies = BusinessAgencyStorageService.loadBusinessAgencies(
        userCanisterId,
        projectId
      );
      
      const agency = agencies.find(a => a.id === agencyId);
      
      if (!agency) {
        throw new Error(`Business Agency ${agencyId} not found`);
      }
      
      // Extract capabilities
      const capabilities = this.extractCapabilities(agency);
      
      return {
        agencyId,
        name: agency.name,
        description: agency.description,
        category: agency.category,
        icon: agency.icon,
        color: agency.color,
        agentIds: agency.agentIds,
        workflowIds: agency.workflowIds,
        goals: agency.goals.map(goal => ({
          goalId: goal.id,
          name: goal.name,
          description: goal.description,
          target: goal.target,
          currentValue: goal.currentValue,
          status: goal.status
        })),
        metrics: {
          totalExecutions: agency.metrics.totalExecutions,
          successRate: agency.metrics.successRate,
          businessImpact: agency.metrics.businessImpact,
          costMetrics: agency.metrics.costMetrics
        },
        capabilities
      };
    } catch (error) {
      console.error('❌ [BusinessAgencyAwareness] Failed to discover capabilities:', error);
      throw error;
    }
  }
  
  /**
   * Discover all business agencies in a project
   */
  static async discoverProjectBusinessAgencies(
    userCanisterId: string,
    projectId: string
  ): Promise<BusinessAgencyCapabilities[]> {
    console.log(`🔍 [BusinessAgencyAwareness] Discovering all business agencies for project: ${projectId}`);
    
    try {
      const agencies = BusinessAgencyStorageService.loadBusinessAgencies(
        userCanisterId,
        projectId
      );
      
      return agencies.map(agency => ({
        agencyId: agency.id,
        name: agency.name,
        description: agency.description,
        category: agency.category,
        icon: agency.icon,
        color: agency.color,
        agentIds: agency.agentIds,
        workflowIds: agency.workflowIds,
        goals: agency.goals.map(goal => ({
          goalId: goal.id,
          name: goal.name,
          description: goal.description,
          target: goal.target,
          currentValue: goal.currentValue,
          status: goal.status
        })),
        metrics: {
          totalExecutions: agency.metrics.totalExecutions,
          successRate: agency.metrics.successRate,
          businessImpact: agency.metrics.businessImpact,
          costMetrics: agency.metrics.costMetrics
        },
        capabilities: this.extractCapabilities(agency)
      }));
    } catch (error) {
      console.error('❌ [BusinessAgencyAwareness] Failed to discover business agencies:', error);
      return [];
    }
  }
  
  /**
   * Generate documentation for a business agency
   */
  static generateBusinessAgencyDocumentation(
    capabilities: BusinessAgencyCapabilities
  ): BusinessAgencyDocumentation {
    const       displayComponents = [
      {
        component: 'dashboard' as const,
        description: 'Full KontextAgency dashboard with metrics, goals, and insights',
        props: [
          { name: 'agencyId', type: 'string', required: true },
          { name: 'showMetrics', type: 'boolean', required: false },
          { name: 'showGoals', type: 'boolean', required: false }
        ]
      },
      {
        component: 'metrics' as const,
        description: 'Business impact metrics widget',
        props: [
          { name: 'agencyId', type: 'string', required: true },
          { name: 'metricType', type: 'string', required: false }
        ]
      },
      {
        component: 'goals' as const,
        description: 'Goals tracker component',
        props: [
          { name: 'agencyId', type: 'string', required: true },
          { name: 'showProgress', type: 'boolean', required: false }
        ]
      }
    ];
    
    // Add cost tracker if cost metrics available
    if (capabilities.metrics.costMetrics) {
      displayComponents.push({
        component: 'cost-tracker' as const,
        description: 'Cost and ROI tracking component',
        props: [
          { name: 'agencyId', type: 'string', required: true },
          { name: 'showROI', type: 'boolean', required: false }
        ]
      });
    }
    
    // Generate external integration points based on category
    const externalIntegrationPoints = this.generateExternalIntegrationPoints(capabilities);
    
    return {
      agencyId: capabilities.agencyId,
      name: capabilities.name,
      description: capabilities.description,
      category: capabilities.category,
      displayComponents,
      externalIntegrationPoints
    };
  }
  
  /**
   * Extract capabilities from business agency
   */
  private static extractCapabilities(agency: BusinessAgency): string[] {
    const capabilities: string[] = [];
    
    // Category-based capabilities
    capabilities.push(`${agency.category}-tracking`);
    
    // Resource-based capabilities
    if (agency.agentIds.length > 0) {
      capabilities.push('agent-aggregation');
    }
    
    if (agency.workflowIds.length > 0) {
      capabilities.push('workflow-aggregation');
    }
    
    // Goal-based capabilities
    if (agency.goals.length > 0) {
      capabilities.push('goal-tracking');
      
      const activeGoals = agency.goals.filter(g => g.status === 'active');
      if (activeGoals.length > 0) {
        capabilities.push('active-goals');
      }
    }
    
    // Metrics-based capabilities
    if (agency.metrics.businessImpact) {
      const impactKeys = Object.keys(agency.metrics.businessImpact);
      impactKeys.forEach(key => {
        capabilities.push(`${key}-tracking`);
      });
    }
    
    if (agency.metrics.costMetrics) {
      capabilities.push('cost-tracking');
      capabilities.push('roi-calculation');
    }
    
    return capabilities.length > 0 ? capabilities : ['business-tracking'];
  }
  
  /**
   * Generate external integration points based on category
   */
  private static generateExternalIntegrationPoints(
    capabilities: BusinessAgencyCapabilities
  ): Array<{ service: string; metric: string; description: string }> {
    const points: Array<{ service: string; metric: string; description: string }> = [];
    
    switch (capabilities.category) {
      case 'marketing':
        points.push(
          {
            service: 'Google Analytics',
            metric: 'conversions',
            description: 'Track real conversions from marketing campaigns'
          },
          {
            service: 'Facebook Ads',
            metric: 'campaign-performance',
            description: 'Monitor ad campaign metrics and ROI'
          },
          {
            service: 'Mailchimp',
            metric: 'email-engagement',
            description: 'Track email campaign engagement rates'
          }
        );
        break;
        
      case 'sales':
        points.push(
          {
            service: 'Salesforce',
            metric: 'leads',
            description: 'Track actual leads generated from sales activities'
          },
          {
            service: 'HubSpot',
            metric: 'deals',
            description: 'Monitor deal pipeline and revenue'
          },
          {
            service: 'Stripe',
            metric: 'revenue',
            description: 'Track actual revenue from sales efforts'
          }
        );
        break;
        
      case 'support':
        points.push(
          {
            service: 'Zendesk',
            metric: 'tickets-resolved',
            description: 'Track actual ticket resolution metrics'
          },
          {
            service: 'Intercom',
            metric: 'response-time',
            description: 'Monitor real customer response times'
          }
        );
        break;
        
      case 'operations':
        points.push(
          {
            service: 'Jira',
            metric: 'tasks-completed',
            description: 'Track actual task completion from project management'
          },
          {
            service: 'Asana',
            metric: 'automation-impact',
            description: 'Measure automation impact on operations'
          }
        );
        break;
    }
    
    return points;
  }
}

