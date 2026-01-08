import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { BusinessAgencyStorageService } from '../services/BusinessAgencyStorageService';
import type { BusinessAgency, AgencyGoal, AgencyMetrics } from '../types/businessAgency';

export const useBusinessAgency = (agencyId: string) => {
  const activeProject = useAppStore(state => state.activeProject);
  const userCanisterId = useAppStore(state => state.userCanisterId);
  
  const [agency, setAgency] = useState<BusinessAgency | null>(null);
  const [metrics, setMetrics] = useState<AgencyMetrics | null>(null);
  const [goals, setGoals] = useState<AgencyGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (!activeProject || !userCanisterId || !agencyId) {
      setIsLoading(false);
      return;
    }
    
    const loadAgency = () => {
      try {
        const agencies = BusinessAgencyStorageService.loadBusinessAgencies(
          userCanisterId,
          activeProject
        );
        
        const foundAgency = agencies.find(a => a.id === agencyId);
        
        if (foundAgency) {
          setAgency(foundAgency);
          setMetrics(foundAgency.metrics);
          setGoals(foundAgency.goals || []);
        }
      } catch (error) {
        console.error('Failed to load business agency:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAgency();
  }, [agencyId, activeProject, userCanisterId]);
  
  return {
    agency,
    metrics,
    goals,
    isLoading
  };
};

