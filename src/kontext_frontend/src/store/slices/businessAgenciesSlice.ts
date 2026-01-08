import { StateCreator } from 'zustand';
import { BusinessAgencyStorageService } from '../../services/BusinessAgencyStorageService';
import type { BusinessAgency, AgencyGoal, AgencyMetrics } from '../../types/businessAgency';

export interface BusinessAgenciesSlice {
  businessAgencies: BusinessAgency[];
  activeAgency: string | null;
  businessAgenciesLoading: boolean;
  businessAgenciesError: string | null;
  
  // Actions
  loadBusinessAgencies: () => Promise<void>;
  createBusinessAgency: (agency: Omit<BusinessAgency, 'id' | 'created' | 'updated' | 'owner'>) => Promise<boolean>;
  updateBusinessAgency: (agencyId: string, updates: Partial<BusinessAgency>) => Promise<boolean>;
  deleteBusinessAgency: (agencyId: string) => Promise<boolean>;
  setActiveAgency: (agencyId: string | null) => void;
  
  // Computed
  getAgencyById: (agencyId: string) => BusinessAgency | undefined;
  getAgenciesByCategory: (category: string) => BusinessAgency[];
  getAgencyMetrics: (agencyId: string) => AgencyMetrics | null;
  
  // Goals management
  addAgencyGoal: (agencyId: string, goal: Omit<AgencyGoal, 'id'>) => Promise<boolean>;
  updateAgencyGoal: (agencyId: string, goalId: string, updates: Partial<AgencyGoal>) => Promise<boolean>;
  deleteAgencyGoal: (agencyId: string, goalId: string) => Promise<boolean>;
}

export const createBusinessAgenciesSlice: StateCreator<any, [], [], BusinessAgenciesSlice> = (set, get) => ({
  businessAgencies: [],
  activeAgency: null,
  businessAgenciesLoading: false,
  businessAgenciesError: null,
  
  loadBusinessAgencies: async () => {
    const state = get() as any;
    const { userCanisterId, activeProject, identity } = state;
    
    if (!userCanisterId || !identity) {
      console.warn('Cannot load business agencies: missing userCanisterId or identity');
      return;
    }
    
    set((state: any) => {
      state.businessAgenciesLoading = true;
      state.businessAgenciesError = null;
    });
    
    try {
      const agencies = BusinessAgencyStorageService.loadBusinessAgencies(
        userCanisterId,
        activeProject
      );
      
      set((state: any) => {
        state.businessAgencies = agencies;
        state.businessAgenciesLoading = false;
      });
      
      console.log(`✅ Loaded ${agencies.length} business agencies from localStorage`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      set((state: any) => {
        state.businessAgenciesError = errorMsg;
        state.businessAgenciesLoading = false;
      });
      console.error('Failed to load business agencies:', error);
    }
  },
  
  createBusinessAgency: async (agencyData) => {
    const state = get() as any;
    const { userCanisterId, activeProject, identity } = state;
    
    if (!userCanisterId || !identity) {
      console.error('Cannot create business agency: missing userCanisterId or identity');
      return false;
    }
    
    try {
      const newAgency: BusinessAgency = {
        ...agencyData,
        id: `business-agency-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        created: Date.now(),
        updated: Date.now(),
        owner: identity.getPrincipal().toString(),
        projectId: activeProject || undefined,
      };
      
      const success = BusinessAgencyStorageService.saveBusinessAgency(
        newAgency,
        userCanisterId,
        activeProject
      );
      
      if (success) {
        set((state: any) => {
          state.businessAgencies.push(newAgency);
        });
        
        console.log(`✅ Created business agency: ${newAgency.name}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to create business agency:', error);
      return false;
    }
  },
  
  updateBusinessAgency: async (agencyId, updates) => {
    const state = get() as any;
    const { userCanisterId, activeProject } = state;
    
    if (!userCanisterId) {
      return false;
    }
    
    try {
      const existing = state.businessAgencies.find(
        (a: BusinessAgency) => a.id === agencyId
      );
      
      if (!existing) {
        console.error(`Agency ${agencyId} not found`);
        return false;
      }
      
      const updated: BusinessAgency = {
        ...existing,
        ...updates,
        updated: Date.now(),
      };
      
      const success = BusinessAgencyStorageService.saveBusinessAgency(
        updated,
        userCanisterId,
        activeProject
      );
      
      if (success) {
        set((state: any) => {
          const index = state.businessAgencies.findIndex(
            (a: BusinessAgency) => a.id === agencyId
          );
          if (index >= 0) {
            state.businessAgencies[index] = updated;
          }
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to update business agency:', error);
      return false;
    }
  },
  
  deleteBusinessAgency: async (agencyId) => {
    const state = get() as any;
    const { userCanisterId, activeProject } = state;
    
    if (!userCanisterId) {
      return false;
    }
    
    try {
      const success = BusinessAgencyStorageService.deleteBusinessAgency(
        agencyId,
        userCanisterId,
        activeProject
      );
      
      if (success) {
        set((state: any) => {
          state.businessAgencies = state.businessAgencies.filter(
            (a: BusinessAgency) => a.id !== agencyId
          );
          if (state.activeAgency === agencyId) {
            state.activeAgency = null;
          }
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to delete business agency:', error);
      return false;
    }
  },
  
  setActiveAgency: (agencyId) => {
    set((state: any) => {
      state.activeAgency = agencyId;
    });
  },
  
  getAgencyById: (agencyId) => {
    const state = get() as any;
    return state.businessAgencies.find(
      (a: BusinessAgency) => a.id === agencyId
    );
  },
  
  getAgenciesByCategory: (category) => {
    const state = get() as any;
    return state.businessAgencies.filter(
      (a: BusinessAgency) => a.category === category
    );
  },
  
  getAgencyMetrics: (agencyId) => {
    const state = get() as any;
    const agency = state.businessAgencies.find(
      (a: BusinessAgency) => a.id === agencyId
    );
    return agency?.metrics || null;
  },
  
  addAgencyGoal: async (agencyId, goalData) => {
    const state = get() as any;
    const agency = state.businessAgencies.find(
      (a: BusinessAgency) => a.id === agencyId
    );
    
    if (!agency) {
      return false;
    }
    
    const newGoal: AgencyGoal = {
      ...goalData,
      id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    
    return get().updateBusinessAgency(agencyId, {
      goals: [...(agency.goals || []), newGoal],
    });
  },
  
  updateAgencyGoal: async (agencyId, goalId, updates) => {
    const state = get() as any;
    const agency = state.businessAgencies.find(
      (a: BusinessAgency) => a.id === agencyId
    );
    
    if (!agency) {
      return false;
    }
    
    const updatedGoals = (agency.goals || []).map((goal: AgencyGoal) =>
      goal.id === goalId ? { ...goal, ...updates } : goal
    );
    
    return get().updateBusinessAgency(agencyId, { goals: updatedGoals });
  },
  
  deleteAgencyGoal: async (agencyId, goalId) => {
    const state = get() as any;
    const agency = state.businessAgencies.find(
      (a: BusinessAgency) => a.id === agencyId
    );
    
    if (!agency) {
      return false;
    }
    
    const filteredGoals = (agency.goals || []).filter(
      (goal: AgencyGoal) => goal.id !== goalId
    );
    
    return get().updateBusinessAgency(agencyId, { goals: filteredGoals });
  },
});

