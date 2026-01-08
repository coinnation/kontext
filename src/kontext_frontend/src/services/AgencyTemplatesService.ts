import type { BusinessAgencyTemplate, BusinessAgency, AgencyGoal } from '../types/businessAgency';

export const AGENCY_TEMPLATES: BusinessAgencyTemplate[] = [
  {
    id: 'marketing-agency',
    name: 'Marketing Agency',
    description: 'Content creation, social media management, and campaign automation',
    category: 'marketing',
    icon: '📢',
    color: '#FF6B35',
    suggestedAgents: [
      { name: 'Content Creator', role: 'content-generation' },
      { name: 'Social Media Manager', role: 'social-posting' },
      { name: 'SEO Analyst', role: 'seo-optimization' },
    ],
    suggestedWorkflows: [
      { name: 'Content Pipeline', type: 'sequential' },
      { name: 'Social Posting Schedule', type: 'scheduled' },
    ],
    defaultGoals: [
      { name: 'Content Production', target: '10 pieces/month' },
      { name: 'Engagement Rate', target: '5% increase' },
    ],
  },
  {
    id: 'customer-service-agency',
    name: 'Customer Service Agency',
    description: 'Ticket routing, automated responses, and escalation management',
    category: 'support',
    icon: '👥',
    color: '#10B981',
    suggestedAgents: [
      { name: 'Ticket Classifier', role: 'ticket-routing' },
      { name: 'Response Generator', role: 'response-generation' },
      { name: 'Escalation Handler', role: 'escalation-management' },
    ],
    suggestedWorkflows: [
      { name: 'Support Ticket Pipeline', type: 'sequential' },
      { name: 'Auto-Response System', type: 'conditional' },
    ],
    defaultGoals: [
      { name: 'Response Time', target: '<2 hours' },
      { name: 'Resolution Rate', target: '90%' },
    ],
  },
  {
    id: 'sales-agency',
    name: 'Sales Agency',
    description: 'Lead qualification, follow-up automation, and CRM management',
    category: 'sales',
    icon: '💼',
    color: '#3B82F6',
    suggestedAgents: [
      { name: 'Lead Qualifier', role: 'lead-qualification' },
      { name: 'Follow-up Assistant', role: 'follow-up-automation' },
      { name: 'CRM Updater', role: 'crm-management' },
    ],
    suggestedWorkflows: [
      { name: 'Lead Nurturing Sequence', type: 'sequential' },
      { name: 'Deal Progression', type: 'conditional' },
    ],
    defaultGoals: [
      { name: 'Leads Qualified', target: '50/month' },
      { name: 'Conversion Rate', target: '15%' },
    ],
  },
  {
    id: 'operations-agency',
    name: 'Operations Agency',
    description: 'Data processing, reporting, and business process automation',
    category: 'operations',
    icon: '⚙️',
    color: '#8B5CF6',
    suggestedAgents: [
      { name: 'Data Processor', role: 'data-processing' },
      { name: 'Report Generator', role: 'reporting' },
      { name: 'Process Automator', role: 'automation' },
    ],
    suggestedWorkflows: [
      { name: 'Data Pipeline', type: 'sequential' },
      { name: 'Scheduled Reports', type: 'scheduled' },
    ],
    defaultGoals: [
      { name: 'Tasks Automated', target: '100/week' },
      { name: 'Process Efficiency', target: '30% improvement' },
    ],
  },
];

export class AgencyTemplatesService {
  /**
   * Create a business agency from a template
   */
  static createAgencyFromTemplate(
    templateId: string,
    customizations?: {
      name?: string;
      description?: string;
      agentIds?: string[];
      workflowIds?: string[];
    }
  ): Omit<BusinessAgency, 'id' | 'created' | 'updated' | 'owner'> {
    const template = AGENCY_TEMPLATES.find(t => t.id === templateId);
    
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }
    
    return {
      name: customizations?.name || template.name,
      description: customizations?.description || template.description,
      category: template.category,
      icon: template.icon,
      color: template.color,
      agentIds: customizations?.agentIds || [],
      workflowIds: customizations?.workflowIds || [],
      goals: template.defaultGoals.map(goal => ({
        id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: goal.name,
        description: '',
        target: goal.target,
        status: 'active' as const,
      })),
      metrics: {
        totalExecutions: 0,
        successRate: 0,
        averageResponseTime: 0,
        lastUpdated: Date.now(),
      },
    };
  }
  
  static getTemplateById(templateId: string): BusinessAgencyTemplate | undefined {
    return AGENCY_TEMPLATES.find(t => t.id === templateId);
  }
  
  static getTemplatesByCategory(category: string): BusinessAgencyTemplate[] {
    return AGENCY_TEMPLATES.filter(t => t.category === category);
  }
}

