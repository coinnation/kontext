// useUserCanister.ts - OPTIMIZED ERROR #310 PREVENTION VERSION
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import { Principal } from '@dfinity/principal';

import { idlFactory } from '../candid/user.did.js';
import { _USER_SERVICE } from '../candid/user';
import { icpData } from './icpData';
import { getSharedAuthClient } from './services/SharedAuthClient';

type UseCanisterOptions = {
  requireAuth?: boolean;
};

export function useUserCanister({ requireAuth = false }: UseCanisterOptions = {}) {
  const [actor, setActor] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [principal, setPrincipal] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  
  const identityRef = useRef<Identity | null>(null);
  const mountedRef = useRef(true);
  
  const actualHost = useMemo(() => {
    return 'https://icp0.io' || (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1'
        ? 'http://127.0.0.1:4943' 
        : 'https://icp0.io'
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        // 🔥 FIX: Use shared AuthClient to prevent session logout issues
        const globalAuthClient = await getSharedAuthClient();

        if (cancelled) return;

        if (requireAuth) {
          const isAuth = await globalAuthClient.isAuthenticated();
          if (isAuth && !cancelled) {
            const userIdentity = globalAuthClient.getIdentity();
            const userPrincipal = userIdentity.getPrincipal().toString();
            
            identityRef.current = userIdentity;
            setIsAuthenticated(true);
            setPrincipal(userPrincipal);
          }
        }

        if (cancelled) return;

        const agentOptions: any = { host: actualHost };
        if (requireAuth && identityRef.current) {
          agentOptions.identity = identityRef.current;
        }

        const agent = new HttpAgent(agentOptions);
        
        if (actualHost.includes('localhost') || actualHost.includes('127.0.0.1')) {
          await agent.fetchRootKey();
        }

        if (cancelled) return;

        const canisterActor = Actor.createActor<_USER_SERVICE>(idlFactory, {
          agent,
          canisterId: 'pkmhr-fqaaa-aaaaa-qcfeq-cai',
        });

        const convertingActor = new Proxy(canisterActor, {
          get(target, prop) {
            if (typeof target[prop] === 'function') {
              return async (...args: any[]) => {
                try {
                  const result = await target[prop](...args);
                  return icpData.fromCanister(result);
                } catch (error) {
                  console.error(`Error in ${String(prop)}:`, error);
                  throw error;
                }
              };
            }
            return target[prop];
          }
        });

        if (!cancelled) {
          setActor(convertingActor);
          setIsLoading(false);
        }

      } catch (err) {
        if (!cancelled) {
          console.error('useUserCanister initialization failed:', err);
          setError(err instanceof Error ? err : new Error('Initialization failed'));
          setIsLoading(false);
        }
      }
    };

    initialize();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  const login = useCallback(async () => {
    if (authLoading) return false;

    try {
      setAuthLoading(true);
      // 🔥 FIX: Use shared AuthClient to prevent session logout issues
      const globalAuthClient = await getSharedAuthClient();
      
      const identityProviderUrl = actualHost.includes('localhost') 
        ? 'http://uxrrr-q7777-77774-qaaaq-cai.localhost:4943'
        : 'https://identity.ic0.app/#authorize';

      await new Promise<void>((resolve, reject) => {
        globalAuthClient.login({
          identityProvider: identityProviderUrl,
          maxTimeToLive: BigInt(7 * 24 * 60 * 60 * 1000 * 1000 * 1000),
          onSuccess: resolve,
          onError: reject
        });
      });

      const userIdentity = globalAuthClient.getIdentity();
      const userPrincipal = userIdentity.getPrincipal().toString();
      
      identityRef.current = userIdentity;
      setIsAuthenticated(true);
      setPrincipal(userPrincipal);
      
      return true;
    } catch (err) {
      console.error('Login failed:', err);
      setError(err instanceof Error ? err : new Error('Login failed'));
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, [actualHost]);

  const logout = useCallback(async () => {
    try {
      // 🔥 FIX: Use shared AuthClient to prevent session logout issues
      const globalAuthClient = await getSharedAuthClient();
      await globalAuthClient.logout();
      identityRef.current = null;
      setIsAuthenticated(false);
      setPrincipal(null);
      setActor(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }, []);

  return { 
    actor, 
    isLoading, 
    error,
    isAuthenticated,
    principal,
    authLoading,
    login,
    logout
  };
}