// Domain Status Storage Utilities
// Manages localStorage for domain purchase and DNS propagation status

export interface DomainStatus {
  domain: string;
  projectId: string;
  canisterId?: string;
  purchaseDate: string;
  orderId?: string;
  status: 'purchased' | 'dns_waiting' | 'dns_propagated' | 'icp_registering' | 'icp_registered' | 'complete' | 'instant_access' | 'switching_to_icp' | 'icp_direct';
  registrar?: string; // Store which registrar was used (e.g., 'namesilo', 'namecheap')
  dnsConfiguration?: {
    success: boolean;
    records?: Array<{ type: string; name: string; value: string; note?: string }>;
    expectedIP?: string; // For A/AAAA records (used by NameSilo and other registrars that don't support apex CNAME)
    expectedCNAME?: string; // For CNAME records (ICP Custom Domains - preferred for most registrars)
    recordType?: 'A' | 'CNAME'; // Which record type is expected for this registrar
    proxyMode?: 'cloudflare' | 'direct'; // NEW: Current routing mode
    cloudflareHostnameId?: string; // NEW: Cloudflare custom hostname ID
  };
  lastChecked?: string;
  icpRegistrationId?: string;
}

const STORAGE_KEY = 'domain_statuses';

export const domainStorage = {
  // Save domain status
  saveDomainStatus(status: DomainStatus): void {
    try {
      const allStatuses = domainStorage.getAllDomainStatuses();
      const existingIndex = allStatuses.findIndex(s => s.domain === status.domain && s.projectId === status.projectId);
      
      if (existingIndex >= 0) {
        allStatuses[existingIndex] = { ...allStatuses[existingIndex], ...status };
      } else {
        allStatuses.push(status);
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allStatuses));
    } catch (error) {
      console.error('Failed to save domain status:', error);
    }
  },

  // Get domain status
  getDomainStatus(domain: string, projectId: string): DomainStatus | null {
    try {
      const allStatuses = domainStorage.getAllDomainStatuses();
      return allStatuses.find(s => s.domain === domain && s.projectId === projectId) || null;
    } catch (error) {
      console.error('Failed to get domain status:', error);
      return null;
    }
  },

  // Get all domain statuses
  getAllDomainStatuses(): DomainStatus[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get all domain statuses:', error);
      return [];
    }
  },

  // Get domain statuses for a project
  getProjectDomainStatuses(projectId: string): DomainStatus[] {
    try {
      const allStatuses = domainStorage.getAllDomainStatuses();
      return allStatuses.filter(s => s.projectId === projectId);
    } catch (error) {
      console.error('Failed to get project domain statuses:', error);
      return [];
    }
  },

  // Update domain status
  updateDomainStatus(domain: string, projectId: string, updates: Partial<DomainStatus>): void {
    try {
      const status = domainStorage.getDomainStatus(domain, projectId);
      if (status) {
        domainStorage.saveDomainStatus({ ...status, ...updates });
      }
    } catch (error) {
      console.error('Failed to update domain status:', error);
    }
  },

  // Remove domain status
  removeDomainStatus(domain: string, projectId: string): void {
    try {
      const allStatuses = domainStorage.getAllDomainStatuses();
      const filtered = allStatuses.filter(s => !(s.domain === domain && s.projectId === projectId));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to remove domain status:', error);
    }
  }
};
