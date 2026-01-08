import { Identity } from '@dfinity/agent';
import { BusinessAgencyContextualAwarenessService, BusinessAgencyCapabilities, BusinessAgencyDocumentation } from './BusinessAgencyContextualAwarenessService';
import { userCanisterService } from './UserCanisterService';

export interface IntegratedBusinessAgency {
  id: string;
  agencyId: string;
  agencyName: string;
  agencyDescription: string;
  category: string;
  isEnabled: boolean;
  integrationType: 'dashboard' | 'metrics' | 'goals' | 'full';
  integratedAt: number;
  externalServices?: Array<{
    serviceId: string;
    metric: string;
    enabled: boolean;
  }>;
}

export interface BusinessAgencyIntegrationResult {
  agency: IntegratedBusinessAgency;
  implementationResult?: {
    filesCreated: string[];
    componentsAdded: string[];
  };
}

export class BusinessAgencyIntegrationService {
  /**
   * Integrate business agency with app
   */
  static async integrateBusinessAgencyWithApp(
    agencyId: string,
    userCanisterId: string,
    projectId: string,
    identity: Identity,
    options?: {
      integrationType?: 'dashboard' | 'metrics' | 'goals' | 'full';
      externalServices?: Array<{ serviceId: string; metric: string }>;
      autoImplement?: boolean;
    }
  ): Promise<BusinessAgencyIntegrationResult> {
    console.log(`🔗 [BusinessAgencyIntegration] Starting business agency integration...`);
    
    try {
      // Discover business agency capabilities
      const capabilities = await BusinessAgencyContextualAwarenessService
        .discoverBusinessAgencyCapabilities(
          agencyId,
          userCanisterId,
          projectId
        );
      
      console.log(`✅ [BusinessAgencyIntegration] Business agency capabilities discovered`);
      
      // Generate documentation
      const documentation = BusinessAgencyContextualAwarenessService
        .generateBusinessAgencyDocumentation(capabilities);
      
      // Implement integration (if auto-implement enabled)
      let implementationResult;
      if (options?.autoImplement !== false) {
        implementationResult = await this.implementBusinessAgencyIntegration(
          capabilities,
          documentation,
          projectId,
          identity,
          options?.externalServices
        );
        console.log(`✅ [BusinessAgencyIntegration] Integration implemented`);
      }
      
      // Store integration metadata
      const integration: IntegratedBusinessAgency = {
        id: `business_agency_integration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        agencyId,
        agencyName: capabilities.name,
        agencyDescription: capabilities.description,
        category: capabilities.category,
        isEnabled: true,
        integrationType: options?.integrationType || 'full',
        integratedAt: Date.now(),
        externalServices: options?.externalServices?.map(s => ({
          ...s,
          enabled: true
        }))
      };
      
      await this.storeIntegrationMetadata(projectId, integration);
      
      return {
        agency: integration,
        implementationResult
      };
    } catch (error) {
      console.error('❌ [BusinessAgencyIntegration] Integration failed:', error);
      throw error;
    }
  }
  
  /**
   * Implement business agency integration
   */
  private static async implementBusinessAgencyIntegration(
    capabilities: BusinessAgencyCapabilities,
    documentation: BusinessAgencyDocumentation,
    projectId: string,
    identity: Identity,
    externalServices?: Array<{ serviceId: string; metric: string }>
  ): Promise<any> {
    const filesCreated: string[] = [];
    
    // Generate KontextAgency component
    const dashboardCode = this.generateKontextAgency(
      capabilities,
      documentation,
      externalServices
    );
    
    try {
      await userCanisterService.createCodeArtifact(
        projectId,
        `src/components/KontextAgency.tsx`,
        dashboardCode,
        identity
      );
      filesCreated.push(`src/components/KontextAgency.tsx`);
    } catch (error) {
      console.warn(`⚠️ [BusinessAgencyIntegration] Failed to create KontextAgency component:`, error);
    }
    
    // Generate metrics widget if needed
    if (capabilities.metrics.businessImpact) {
      const metricsCode = this.generateMetricsWidget(capabilities);
      
      try {
        await userCanisterService.createCodeArtifact(
          projectId,
          `src/components/AgencyMetricsWidget.tsx`,
          metricsCode,
          identity
        );
        filesCreated.push(`src/components/AgencyMetricsWidget.tsx`);
      } catch (error) {
        console.warn(`⚠️ [BusinessAgencyIntegration] Failed to create metrics widget:`, error);
      }
    }
    
    return {
      filesCreated,
      componentsAdded: ['KontextAgency', 'AgencyMetricsWidget']
    };
  }
  
  /**
   * Generate KontextAgency component
   */
  private static generateKontextAgency(
    capabilities: BusinessAgencyCapabilities,
    documentation: BusinessAgencyDocumentation,
    externalServices?: Array<{ serviceId: string; metric: string }>
  ): string {
    return `import React from 'react';
import { useBusinessAgency } from '../hooks/useBusinessAgency';

interface KontextAgencyProps {
  agencyId: string;
  showMetrics?: boolean;
  showGoals?: boolean;
  showCosts?: boolean;
}

export const KontextAgency: React.FC<KontextAgencyProps> = ({
  agencyId,
  showMetrics = true,
  showGoals = true,
  showCosts = false
}) => {
  const { agency, metrics, goals, isLoading } = useBusinessAgency(agencyId);
  
  if (isLoading) {
    return <div style={{ color: 'var(--text-gray)' }}>Loading agency data...</div>;
  }
  
  if (!agency) {
    return <div style={{ color: 'var(--text-gray)' }}>Agency not found</div>;
  }
  
  return (
    <div style={{
      padding: '1.5rem',
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          background: agency.color || 'linear-gradient(135deg, #ff6b35, #10b981)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem'
        }}>
          {agency.icon}
        </div>
        <div>
          <h2 style={{ color: '#ffffff', margin: 0, fontSize: '1.5rem' }}>
            {agency.name}
          </h2>
          <p style={{ color: 'var(--text-gray)', margin: 0, fontSize: '0.9rem' }}>
            {agency.description}
          </p>
        </div>
      </div>
      
      {showMetrics && metrics && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#ffffff', marginBottom: '1rem' }}>Metrics</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{
              padding: '1rem',
              background: 'rgba(16, 185, 129, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              <div style={{ color: 'var(--text-gray)', fontSize: '0.9rem' }}>Total Executions</div>
              <div style={{ color: '#10b981', fontSize: '1.5rem', fontWeight: 700 }}>
                {metrics.totalExecutions}
              </div>
            </div>
            <div style={{
              padding: '1rem',
              background: 'rgba(255, 107, 53, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 107, 53, 0.3)'
            }}>
              <div style={{ color: 'var(--text-gray)', fontSize: '0.9rem' }}>Success Rate</div>
              <div style={{ color: '#ff6b35', fontSize: '1.5rem', fontWeight: 700 }}>
                {metrics.successRate.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}
      
      {showGoals && goals && goals.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#ffffff', marginBottom: '1rem' }}>Goals</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {goals.map(goal => (
              <div
                key={goal.goalId}
                style={{
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <div style={{ color: '#ffffff', fontWeight: 600 }}>
                    {goal.name}
                  </div>
                  <div style={{
                    padding: '0.25rem 0.75rem',
                    background: goal.status === 'completed'
                      ? 'rgba(16, 185, 129, 0.2)'
                      : goal.status === 'active'
                      ? 'rgba(255, 107, 53, 0.2)'
                      : 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    color: goal.status === 'completed' ? '#10b981' : '#ffffff',
                    textTransform: 'capitalize'
                  }}>
                    {goal.status}
                  </div>
                </div>
                <div style={{ color: 'var(--text-gray)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  {goal.description}
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.9rem'
                }}>
                  <span style={{ color: 'var(--text-gray)' }}>
                    {goal.currentValue || '0'} / {goal.target}
                  </span>
                  <div style={{
                    width: '100px',
                    height: '4px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: goal.currentValue && goal.target
                        ? \`\${Math.min((parseFloat(goal.currentValue) / parseFloat(goal.target.match(/\\d+/)?.[0] || '1')) * 100, 100)}%\`
                        : '0%',
                      height: '100%',
                      background: 'linear-gradient(90deg, #ff6b35, #10b981)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {showCosts && metrics.costMetrics && (
        <div>
          <h3 style={{ color: '#ffffff', marginBottom: '1rem' }}>Costs & ROI</h3>
          <div style={{
            padding: '1rem',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ color: 'var(--text-gray)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Total Cost
            </div>
            <div style={{ color: '#ffffff', fontSize: '1.25rem', fontWeight: 700 }}>
              $\${metrics.costMetrics.totalUsd.toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};`;
  }
  
  /**
   * Generate metrics widget component
   */
  private static generateMetricsWidget(capabilities: BusinessAgencyCapabilities): string {
    return `import React from 'react';
import { useBusinessAgency } from '../hooks/useBusinessAgency';

interface AgencyMetricsWidgetProps {
  agencyId: string;
  metricType?: string;
}

export const AgencyMetricsWidget: React.FC<AgencyMetricsWidgetProps> = ({
  agencyId,
  metricType
}) => {
  const { metrics, isLoading } = useBusinessAgency(agencyId);
  
  if (isLoading || !metrics) {
    return <div style={{ color: 'var(--text-gray)' }}>Loading metrics...</div>;
  }
  
  const businessImpact = metrics.businessImpact || {};
  
  return (
    <div style={{
      padding: '1rem',
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <h3 style={{ color: '#ffffff', marginBottom: '1rem' }}>Business Impact</h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '0.75rem'
      }}>
        {Object.entries(businessImpact).map(([key, value]) => (
          <div
            key={key}
            style={{
              padding: '0.75rem',
              background: 'rgba(16, 185, 129, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}
          >
            <div style={{ color: 'var(--text-gray)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </div>
            <div style={{ color: '#10b981', fontSize: '1.25rem', fontWeight: 700 }}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};`;
  }
  
  /**
   * Store integration metadata
   */
  private static async storeIntegrationMetadata(
    projectId: string,
    integration: IntegratedBusinessAgency
  ): Promise<void> {
    const key = `business-agency-integrations-${projectId}`;
    const existing = localStorage.getItem(key);
    const integrations = existing ? JSON.parse(existing) : [];
    
    integrations.push(integration);
    localStorage.setItem(key, JSON.stringify(integrations));
  }
  
  /**
   * Get all business agency integrations for a project
   */
  static getProjectBusinessAgencyIntegrations(projectId: string): IntegratedBusinessAgency[] {
    const key = `business-agency-integrations-${projectId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    
    try {
      return JSON.parse(stored) as IntegratedBusinessAgency[];
    } catch (error) {
      console.error('Failed to load business agency integrations:', error);
      return [];
    }
  }
  
  /**
   * Remove business agency integration
   */
  static removeBusinessAgencyIntegration(projectId: string, integrationId: string): void {
    const key = `business-agency-integrations-${projectId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return;
    
    try {
      const integrations = JSON.parse(stored) as IntegratedBusinessAgency[];
      const filtered = integrations.filter(i => i.id !== integrationId);
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to remove business agency integration:', error);
    }
  }
  
  /**
   * Update business agency integration
   */
  static updateBusinessAgencyIntegration(
    projectId: string,
    integrationId: string,
    updates: Partial<IntegratedBusinessAgency>
  ): void {
    const key = `business-agency-integrations-${projectId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return;
    
    try {
      const integrations = JSON.parse(stored) as IntegratedBusinessAgency[];
      const updated = integrations.map(i =>
        i.id === integrationId ? { ...i, ...updates } : i
      );
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to update business agency integration:', error);
    }
  }
}

