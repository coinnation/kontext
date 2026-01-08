import type { BusinessAgency } from '../types/businessAgency';

export class BusinessAgencyStorageService {
  private static getStorageKey(userCanisterId: string, projectId?: string): string {
    if (projectId) {
      return `business-agencies-${projectId}`;
    }
    return `business-agencies-${userCanisterId}`;
  }

  /**
   * Load all business agencies from localStorage
   */
  static loadBusinessAgencies(
    userCanisterId: string,
    projectId?: string
  ): BusinessAgency[] {
    try {
      const key = this.getStorageKey(userCanisterId, projectId);
      const stored = localStorage.getItem(key);
      
      if (!stored) {
        return [];
      }
      
      const agencies = JSON.parse(stored) as BusinessAgency[];
      return agencies || [];
    } catch (error) {
      console.error('Failed to load business agencies from localStorage:', error);
      return [];
    }
  }

  /**
   * Save business agencies to localStorage
   */
  static saveBusinessAgencies(
    agencies: BusinessAgency[],
    userCanisterId: string,
    projectId?: string
  ): boolean {
    try {
      const key = this.getStorageKey(userCanisterId, projectId);
      localStorage.setItem(key, JSON.stringify(agencies));
      return true;
    } catch (error) {
      console.error('Failed to save business agencies to localStorage:', error);
      return false;
    }
  }

  /**
   * Add or update a single agency
   */
  static saveBusinessAgency(
    agency: BusinessAgency,
    userCanisterId: string,
    projectId?: string
  ): boolean {
    const agencies = this.loadBusinessAgencies(userCanisterId, projectId);
    const existingIndex = agencies.findIndex(a => a.id === agency.id);
    
    if (existingIndex >= 0) {
      agencies[existingIndex] = {
        ...agency,
        updated: Date.now()
      };
    } else {
      agencies.push(agency);
    }
    
    return this.saveBusinessAgencies(agencies, userCanisterId, projectId);
  }

  /**
   * Delete a business agency
   */
  static deleteBusinessAgency(
    agencyId: string,
    userCanisterId: string,
    projectId?: string
  ): boolean {
    const agencies = this.loadBusinessAgencies(userCanisterId, projectId);
    const filtered = agencies.filter(a => a.id !== agencyId);
    return this.saveBusinessAgencies(filtered, userCanisterId, projectId);
  }

  /**
   * Get a single agency by ID
   */
  static getBusinessAgency(
    agencyId: string,
    userCanisterId: string,
    projectId?: string
  ): BusinessAgency | null {
    const agencies = this.loadBusinessAgencies(userCanisterId, projectId);
    return agencies.find(a => a.id === agencyId) || null;
  }
}

