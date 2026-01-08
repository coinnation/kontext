import React, { useState, useEffect, useRef } from 'react';
import { Principal } from '@dfinity/principal';
import { HttpAgent } from '@dfinity/agent';
import { AssetManager } from '@dfinity/assets';
import { domainService, DomainAvailabilityResult, DomainPurchaseRequest, DomainPurchaseResult } from '../services/DomainService';
import { userCanisterService } from '../services/UserCanisterService';
import { useAppStore } from '../store/appStore';
import { useCredits } from '../store/appStore';
import { domainStorage, DomainStatus } from '../utils/domainStorage';
import { REGISTRAR_INSTRUCTIONS, getRegistrarInstruction } from '../utils/registrarInstructions';

interface DomainInterfaceProps {
  projectId: string;
  projectName: string;
  userCanisterId?: string | null;
}

type TabType = 'new' | 'existing';

const DomainInterface: React.FC<DomainInterfaceProps> = ({
  projectId,
  projectName,
  userCanisterId
}) => {
  // Ref for scrollable content area
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const { identity } = useAppStore(state => ({ identity: state.identity }));
  const { credits, deductUnitsFromBalance, getUserUnitsBalance, fetchCreditsBalance } = useCredits();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('new');
  
  // Search state
  const [searchDomain, setSearchDomain] = useState('');
  const [searchResults, setSearchResults] = useState<DomainAvailabilityResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // Purchase state
  const [selectedDomain, setSelectedDomain] = useState<DomainAvailabilityResult | null>(null);
  const [purchaseYears, setPurchaseYears] = useState(1);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  
  // Domain status tracking
  const [domainStatuses, setDomainStatuses] = useState<DomainStatus[]>([]);
  const [checkingDNS, setCheckingDNS] = useState<string | null>(null);
  const [registeringICP, setRegisteringICP] = useState<string | null>(null);
  const [dnsCheckResults, setDnsCheckResults] = useState<{
    domain: string;
    propagated: boolean;
    currentIP?: string;
    expectedIP?: string;
    message: string;
  } | null>(null);
  
  // Progress feedback for long-running operations
  const [operationProgress, setOperationProgress] = useState<{
    domain: string;
    operation: 'dns_check' | 'register' | 'purchase' | 'configure';
    step: string;
    message: string;
  } | null>(null);
  
  // Server pair check state
  const [hasServerPair, setHasServerPair] = useState<boolean | null>(null);
  const [showNoServerPairModal, setShowNoServerPairModal] = useState(false);
  const [checkingServerPair, setCheckingServerPair] = useState(false);
  
  // Success/Error modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalContent, setSuccessModalContent] = useState<{
    title: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalContent, setErrorModalContent] = useState<{
    title: string;
    message: string;
  } | null>(null);
  
  // Contact info state
  const [contactInfo, setContactInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    organization: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'US'
  });
  
  // Registrar config state
  const [showRegistrarConfig, setShowRegistrarConfig] = useState(false);
  const [registrarConfig, setRegistrarConfig] = useState({
    provider: 'namesilo' as 'namecheap' | 'godaddy' | 'cloudflare' | 'namecom' | 'porkbun' | 'namesilo' | 'custom',
    apiKey: '',
    apiSecret: '',
    username: '',
    apiUrl: '',
    sandbox: false
  });
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState(false);
  
  // Pricing state
  const [domainPricing, setDomainPricing] = useState<{ [domain: string]: number }>({});
  const [isLoadingPricing, setIsLoadingPricing] = useState(false);

  // Existing domain state
  const [existingDomain, setExistingDomain] = useState('');
  const [selectedRegistrar, setSelectedRegistrar] = useState<string>('namesilo');
  const [existingCanisterId, setExistingCanisterId] = useState('');
  const [isConfiguringExisting, setIsConfiguringExisting] = useState(false);

  // Cloudflare status state - DISABLED (requires enterprise plan)
  // const [cloudflareStatus, setCloudflareStatus] = useState<{
  //   configured: boolean;
  //   enabled: boolean;
  // } | null>(null);

  // Check for server pairs on mount and when project/user changes
  useEffect(() => {
    let isMounted = true;
    
    const checkServerPairs = async () => {
      if (!userCanisterId || !identity) {
        if (isMounted) {
          setHasServerPair(false);
          setCheckingServerPair(false);
        }
        return;
      }
      
      if (isMounted) {
        setCheckingServerPair(true);
        setPurchaseError(null); // Clear any previous errors
      }
      
      try {
        const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
        const serverPairsResult = await userActor.getProjectServerPairs(projectId);
        
        if (!isMounted) return;
        
        if (serverPairsResult && 'ok' in serverPairsResult && serverPairsResult.ok.length > 0) {
          setHasServerPair(true);
        } else {
          setHasServerPair(false);
        }
      } catch (error) {
        console.warn('⚠️ [DomainInterface] Could not check server pairs:', error);
        if (isMounted) {
          setHasServerPair(false);
        }
      } finally {
        if (isMounted) {
          setCheckingServerPair(false);
          setPurchaseError(null); // Clear error when check completes
        }
      }
    };
    
    checkServerPairs();
    
    return () => {
      isMounted = false;
    };
  }, [userCanisterId, identity, projectId]);

  // Load user balance, domain statuses, and Cloudflare status
  useEffect(() => {
    if (userCanisterId && identity) {
      getUserUnitsBalance();
      fetchCreditsBalance();
    }
    loadDomainStatuses();
    
    // Cloudflare check disabled - requires enterprise plan
    // domainService.getCloudflareStatus().then(result => {
    //   if (result.success) {
    //     setCloudflareStatus({
    //       configured: result.configured || false,
    //       enabled: result.enabled || false
    //     });
    //   }
    // }).catch(err => {
    //   console.warn('Failed to check Cloudflare status:', err);
    // });
  }, [userCanisterId, identity, projectId]);

  // Poll for status updates (Cloudflare instant_access disabled)
  useEffect(() => {
    const domainsToPoll = domainStatuses.filter(
      status => status.status === 'dns_waiting' || status.status === 'icp_registering'
    );

    if (domainsToPoll.length === 0) {
      return;
    }

    const pollInterval = setInterval(async () => {
      for (const domainStatus of domainsToPoll) {
        try {
          // Check ICP registration status
          const icpStatusResult = await domainService.getICPRegistrationStatus(domainStatus.domain);
          
          if (icpStatusResult.success && icpStatusResult.registrationStatus) {
            const currentStatus = domainStorage.getDomainStatus(domainStatus.domain, projectId);
            const dnsConfig = currentStatus?.dnsConfiguration;
            
            // Re-map status based on current state
            const newStatus = mapDomainStatus(dnsConfig, icpStatusResult.registrationStatus);
            
            // Update if status changed
            if (newStatus !== currentStatus?.status) {
              domainStorage.updateDomainStatus(domainStatus.domain, projectId, {
                status: newStatus,
                lastChecked: new Date().toISOString()
              });
              loadDomainStatuses();
            }
          }
        } catch (error) {
          console.warn(`Failed to poll status for ${domainStatus.domain}:`, error);
        }
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(pollInterval);
  }, [domainStatuses, projectId]);

  // Load domain statuses from localStorage
  const loadDomainStatuses = () => {
    const statuses = domainStorage.getProjectDomainStatuses(projectId);
    setDomainStatuses(statuses);
  };

  // Map domain status based on DNS configuration and ICP registration status
  // Cloudflare proxy mode disabled - using direct ICP routing only
  const mapDomainStatus = (
    dnsConfig: DomainPurchaseResult['dnsConfiguration'] | undefined,
    icpStatus: string | undefined
  ): DomainStatus['status'] => {
    // Direct ICP routing only (Cloudflare disabled)
    if (dnsConfig?.dnsPropagated) {
      return icpStatus === 'registered' ? 'icp_registered' : 'dns_propagated';
    }
    
    return 'dns_waiting';
  };

  // Handle domain search
  const handleSearch = async () => {
    if (!searchDomain.trim()) {
      setSearchError('Please enter a domain name');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);
    setDomainPricing({});

    try {
      const response = await domainService.searchDomains(searchDomain.trim());
      
      if (response.success && response.domains.length > 0) {
        setSearchResults(response.domains);
        
        // Get pricing for available domains
        const availableDomains = response.domains
          .filter(d => d.available)
          .map(d => d.domain);
        
        if (availableDomains.length > 0) {
          setIsLoadingPricing(true);
          const pricingResponse = await domainService.getDomainPricing(availableDomains, purchaseYears);
          
          if (pricingResponse.success) {
            const pricingMap: { [domain: string]: number } = {};
            pricingResponse.pricing.forEach(p => {
              if (p.price) {
                pricingMap[p.domain] = p.price;
              }
            });
            setDomainPricing(pricingMap);
          }
          setIsLoadingPricing(false);
        }
      } else {
        setSearchError(response.error || 'No domains found');
      }
    } catch (error) {
      console.error('Domain search error:', error);
      setSearchError(error instanceof Error ? error.message : 'Failed to search domains');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle domain purchase - UPDATED for non-blocking DNS
  const handlePurchase = async () => {
    if (!selectedDomain || !selectedDomain.available) {
      setPurchaseError('Please select an available domain');
      return;
    }

    if (!contactInfo.firstName || !contactInfo.lastName || !contactInfo.email) {
      setPurchaseError('Please fill in required contact information (First Name, Last Name, Email)');
      return;
    }

    // If still checking, don't allow purchase yet - button should be disabled anyway
    if (hasServerPair === null || checkingServerPair) {
      // Don't show error, just return - button is already disabled
      return;
    }
    
    // Check if server pair exists BEFORE allowing purchase
    if (hasServerPair === false) {
      setShowNoServerPairModal(true);
      setPurchaseError(null); // Clear any previous errors
      return;
    }

    const domainPrice = domainPricing[selectedDomain.domain] || selectedDomain.price || 0;
    
    if (domainPrice <= 0) {
      setPurchaseError('Invalid domain price. Please try searching again.');
      return;
    }

    // Convert USD to units: $1 = 10 units
    const unitsToDeduct = Math.round(domainPrice * 10);
    
    // Check balance
    const currentBalance = credits.unitsBalance || 0;
    if (currentBalance < unitsToDeduct) {
      setPurchaseError(`Insufficient balance. Required: ${unitsToDeduct} units, Available: ${currentBalance} units`);
      return;
    }

    setIsPurchasing(true);
    setPurchaseError(null);
    
    // Scroll to top to show progress banner
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Fallback to window scroll if ref not available
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    setOperationProgress({ domain: selectedDomain.domain, operation: 'purchase', step: 'deducting', message: `Deducting ${unitsToDeduct} units from your balance...` });

    try {
      // First, deduct credits
      const deductionSuccess = await deductUnitsFromBalance(
        unitsToDeduct,
        projectId,
        `Domain purchase: ${selectedDomain.domain} ($${domainPrice.toFixed(2)})`
      );

      if (!deductionSuccess) {
        throw new Error('Failed to deduct credits from your balance');
      }

      // Refresh balance
      setOperationProgress({ domain: selectedDomain.domain, operation: 'purchase', step: 'refreshing', message: 'Refreshing balance...' });
      await Promise.all([
        getUserUnitsBalance(),
        fetchCreditsBalance()
      ]);

      // Get frontend server ID for IC configuration
      let frontendCanisterId: string | undefined;
      if (userCanisterId && identity) {
        try {
          setOperationProgress({ domain: selectedDomain.domain, operation: 'purchase', step: 'finding', message: 'Finding your app ID...' });
          const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
          const serverPairsResult = await userActor.getProjectServerPairs(projectId);
          
          if (serverPairsResult && 'ok' in serverPairsResult && serverPairsResult.ok.length > 0) {
            const firstPair = serverPairsResult.ok[0];
            frontendCanisterId = firstPair.frontendCanisterId.toText();
            console.log(`📋 [DomainInterface] Found frontend server for IC configuration: ${frontendCanisterId}`);
          }
        } catch (error) {
          console.warn('⚠️ [DomainInterface] Could not get frontend server ID:', error);
        }
      }

      // Enable configureIC ONLY if we have a server ID
      // Using direct ICP routing only (Cloudflare disabled - requires enterprise plan)
      const shouldConfigureIC = !!frontendCanisterId;

      // Purchase the domain with IC configuration only if server ID is available
          setOperationProgress({ domain: selectedDomain.domain, operation: 'purchase', step: 'purchasing', message: shouldConfigureIC ? 'Purchasing domain and connecting to your website...' : 'Purchasing domain...' });
      const purchaseRequest: DomainPurchaseRequest = {
        domain: selectedDomain.domain,
        years: purchaseYears,
        contactInfo: {
          firstName: contactInfo.firstName,
          lastName: contactInfo.lastName,
          email: contactInfo.email,
          phone: contactInfo.phone || undefined,
          organization: contactInfo.organization || undefined,
          address: contactInfo.address || undefined,
          city: contactInfo.city || undefined,
          state: contactInfo.state || undefined,
          zip: contactInfo.zip || undefined,
          country: contactInfo.country || 'US'
        },
        privacyProtection: true,
        autoRenew: true,
        canisterId: frontendCanisterId, // Required for DNS configuration
        configureIC: shouldConfigureIC // Only enable if we have a canister ID
      };

      setOperationProgress({ domain: selectedDomain.domain, operation: 'purchase', step: 'processing', message: 'Processing purchase with registrar (this may take 30-60 seconds)...' });
      const purchaseResult = await domainService.purchaseDomain(purchaseRequest);

      if (purchaseResult.success) {
        setOperationProgress({ domain: selectedDomain.domain, operation: 'purchase', step: 'configuring', message: 'Purchase successful! Connecting your domain...' });
        
        // Determine status using new Cloudflare-aware status mapping
        const icpStatus = purchaseResult.icpRegistration?.state;
        const status = mapDomainStatus(purchaseResult.dnsConfiguration, icpStatus);

        // Save domain status to localStorage with up-to-date DNS configuration
        const dnsRecords = purchaseResult.dnsConfiguration?.records || [];
        const rootCNAME = dnsRecords.find((r: any) => r.type === 'CNAME' && (!r.name || r.name === '@' || r.name === ''));
        const rootA = dnsRecords.find((r: any) => r.type === 'A' && (!r.name || r.name === '@' || r.name === ''));
        
        // Determine registrar and expected record type
        // Default to namesilo if not specified (based on current registrar config)
        const registrar = registrarConfig.provider || 'namesilo';
        const isNameSilo = registrar.toLowerCase() === 'namesilo';
        const expectedRecordType: 'A' | 'CNAME' = isNameSilo ? 'A' : 'CNAME';
        
        const domainStatus: DomainStatus = {
          domain: selectedDomain.domain,
          projectId,
          canisterId: frontendCanisterId,
          purchaseDate: new Date().toISOString(),
          orderId: purchaseResult.orderId,
          status,
          registrar: registrar, // Store registrar for future reference
          dnsConfiguration: purchaseResult.dnsConfiguration ? {
            success: purchaseResult.dnsConfiguration.success || false,
            records: dnsRecords, // Store all records as-is from backend (includes note field)
            // Store both expected values - backend will set the correct one based on registrar
            expectedCNAME: rootCNAME?.value || (expectedRecordType === 'CNAME' ? `${selectedDomain.domain}.icp1.io` : undefined),
            expectedIP: rootA?.value || (expectedRecordType === 'A' ? undefined : undefined), // Will be set by backend for NameSilo
            recordType: expectedRecordType,
            // Cloudflare proxy information disabled
            // proxyMode: purchaseResult.dnsConfiguration.proxyMode,
            // cloudflareHostnameId: purchaseResult.dnsConfiguration.cloudflareHostnameId
          } : undefined,
          icpRegistrationId: purchaseResult.icpRegistration?.id
        };

        domainStorage.saveDomainStatus(domainStatus);
        loadDomainStatuses();

        // Generate and store ic-domains file (still needed even if DNS was configured)
        if (frontendCanisterId && identity) {
          try {
            setOperationProgress({ domain: selectedDomain.domain, operation: 'purchase', step: 'uploading', message: 'Verifying your domain with the network...' });
            console.log('🌐 [DomainInterface] Generating IC domains file after domain purchase...');
            
            const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
              ? 'http://127.0.0.1:4943'
              : 'https://icp0.io';
            
            const agent = new HttpAgent({
              identity: identity,
              host: host
            });
            
            if (host.includes('localhost') || host.includes('127.0.0.1')) {
              await agent.fetchRootKey();
            }
            
            // Get existing domains for this server
            const icConfigsResult = await domainService.listICDomainConfigs();
            const existingDomains = icConfigsResult.success && icConfigsResult.configs
              ? icConfigsResult.configs
                  .filter(c => c.canisterId === frontendCanisterId)
                  .map(c => c.domain)
              : [];
            
            const allDomains = [...new Set([...existingDomains, selectedDomain.domain])];
            const combinedContent = allDomains.join('\n');
            
            const assetManager = new AssetManager({
              canisterId: Principal.fromText(frontendCanisterId),
              agent: agent,
            });
            
            await assetManager.store(
              new TextEncoder().encode(combinedContent),
              {
                fileName: '.well-known/ic-domains',
                contentType: 'text/plain'
              }
            );
            
            console.log(`✅ [DomainInterface] IC domains file stored on server: ${frontendCanisterId}`);
            
            // Configure the domain with the backend service
            await domainService.generateICDomainsFile(
              selectedDomain.domain,
              frontendCanisterId,
              existingDomains
            );
          } catch (icDomainError) {
            console.error('⚠️ [DomainInterface] Failed to generate IC domains file (non-critical):', icDomainError);
          }
        }
        
        // Show success modal based on purchase result
        setOperationProgress({ domain: selectedDomain.domain, operation: 'purchase', step: 'complete', message: 'Purchase complete! Finalizing...' });
        
        if (!frontendCanisterId) {
          setSuccessModalContent({
            title: '✅ Domain Purchased Successfully',
            message: `Domain ${selectedDomain.domain} has been purchased!\n\n⚠️ Note: No app ID was found, so your domain wasn't automatically connected to your website.\n\nTo connect your domain:\n1. Deploy your website/app for this project\n2. Go to the "Existing Domain" tab\n3. Enter your app ID to connect the domain\n\nYour domain will be ready to use once it's connected (typically 5-60 minutes).`,
            actionLabel: 'Got it'
          });
          setShowSuccessModal(true);
        } else {
          // DNS configured - direct ICP routing
          setSuccessModalContent({
            title: '✅ Domain Purchased Successfully',
            message: `Domain ${selectedDomain.domain} has been purchased!\n\n✅ Your domain has been automatically connected to your website.\n\nYour domain will be ready to use shortly (typically 5-60 minutes). Check the status below for updates.`,
            actionLabel: 'Got it'
          });
          setShowSuccessModal(true);
        }
        
        // Reset form
        setSelectedDomain(null);
        setSearchDomain('');
        setSearchResults([]);
        setDomainPricing({});
        setContactInfo({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          organization: '',
          address: '',
          city: '',
          state: '',
          zip: '',
          country: 'US'
        });
      } else {
        console.error('Purchase failed, credits were deducted but domain purchase failed:', purchaseResult.error);
        throw new Error(purchaseResult.error || purchaseResult.details || 'Domain purchase failed');
      }
    } catch (error) {
      console.error('Domain purchase error:', error);
      setPurchaseError(error instanceof Error ? error.message : 'Failed to purchase domain');
    } finally {
      setIsPurchasing(false);
      setOperationProgress(null);
    }
  };

  // Check DNS propagation status (for ICP Custom Domains)
  // Note: NameSilo doesn't support CNAME at apex, so A/AAAA records are valid for NameSilo
  const handleCheckDNS = async (domain: string) => {
    setCheckingDNS(domain);
    setDnsCheckResults(null);
      setOperationProgress({ domain, operation: 'dns_check', step: 'checking', message: 'Checking domain connection...' });
    
    try {
      const domainStatus = domainStorage.getDomainStatus(domain, projectId);
      const registrar = domainStatus?.registrar || 'namesilo';
      
      // Determine expected record type based on registrar
      const isNameSilo = registrar.toLowerCase() === 'namesilo';
      const expectedRecordType = isNameSilo ? 'A' : 'CNAME';
      
      // Get expected values
      const expectedCNAME = !isNameSilo ? (domainStatus?.dnsConfiguration?.expectedCNAME || `${domain}.icp1.io`) : undefined;
      const expectedIP = isNameSilo ? domainStatus?.dnsConfiguration?.expectedIP : undefined;
      
      // CRITICAL: Always validate with ICP first - this is the REAL check
      // ICP validation is what actually matters, not public DNS propagation
      const canisterId = domainStatus?.canisterId;
      
      if (canisterId && identity) {
        setOperationProgress({ domain, operation: 'dns_check', step: 'uploading', message: 'Preparing domain verification...' });
        const fileEnsured = await ensureICDomainsFile(domain, canisterId);
        
        if (fileEnsured) {
          setOperationProgress({ domain, operation: 'dns_check', step: 'waiting', message: 'Verification prepared. Waiting for network sync (3 seconds)...' });
          // Wait a moment for IC boundary nodes to see the file
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      // Validate with ICP - this is the authoritative check
      setOperationProgress({ domain, operation: 'dns_check', step: 'validating', message: 'Verifying your domain is properly connected...' });
      const validation = await domainService.validateWithICP(domain);
      
      if (validation.success && validation.validated) {
        // ICP validation passed - domain is ready regardless of public DNS status!
        // Also check public DNS for informational purposes
        setOperationProgress({ domain, operation: 'dns_check', step: 'querying', message: 'Domain verified! Checking connection status...' });
        const dnsResult = await domainService.checkDNSPropagation(domain, expectedCNAME, expectedIP);
        
        // Update status to ready for registration
        domainStorage.updateDomainStatus(domain, projectId, {
          status: 'dns_propagated',
          lastChecked: new Date().toISOString()
        });
        loadDomainStatuses();
        
        // Show success message with DNS info
        const dnsInfo = dnsResult.success && dnsResult.propagated
          ? `Public DNS has also propagated.`
          : dnsResult.success && dnsResult.currentIP
          ? `Public DNS: ${dnsResult.currentIP} (may still be propagating)`
          : `Public DNS may still be propagating (this is normal and doesn't affect functionality).`;
        
        setDnsCheckResults({
          domain,
          propagated: true,
          currentIP: dnsResult.currentIP || dnsResult.currentCNAME,
          expectedIP: expectedIP || expectedCNAME,
          message: `✅ Domain is ready! Your domain is properly connected. ${dnsInfo} You can now make it live.`
        });
      } else {
        // ICP validation failed - check DNS to see what's wrong
        setOperationProgress({ domain, operation: 'dns_check', step: 'querying', message: 'Domain verification failed. Checking connection settings...' });
        const dnsResult = await domainService.checkDNSPropagation(domain, expectedCNAME, expectedIP);
        
        let message: string;
        
        if (dnsResult.success && dnsResult.propagated) {
          // DNS is propagated but ICP validation failed
          message = `⚠️ Domain settings look correct, but verification failed: ${validation.error || validation.errors?.join(', ') || 'Unknown error'}. Make sure your website is properly deployed.`;
        } else if (dnsResult.success && dnsResult.dnsStatus === 3) {
          // No DNS records found
          message = `📋 No domain connection found for ${domain}. Please configure your domain settings first. ${expectedRecordType === 'A' ? `You need to point your domain to ${expectedIP || 'the network gateway'}.` : `You need to point your domain to ${expectedCNAME || `${domain}.icp1.io`}.`}`;
        } else if (dnsResult.success) {
          // DNS not yet propagated
          message = `⏳ DNS records not yet propagated publicly. Expected ${expectedRecordType} record${expectedIP ? `: ${expectedIP}` : expectedCNAME ? `: ${expectedCNAME}` : ''}. Current: ${dnsResult.currentIP || dnsResult.currentCNAME || 'Not found'}. Also ensure .well-known/ic-domains file is deployed.`;
        } else {
          // DNS check failed
          message = `❌ Domain check failed: ${dnsResult.error || 'Unknown error'}. Domain verification also failed: ${validation.error || validation.errors?.join(', ') || 'Unknown error'}.`;
        }
        
        setDnsCheckResults({
          domain,
          propagated: false,
          currentIP: dnsResult.currentIP || dnsResult.currentCNAME,
          expectedIP: expectedIP || expectedCNAME,
          message
        });
      }
    } catch (error) {
      console.error('DNS check error:', error);
      setDnsCheckResults({
        domain,
        propagated: false,
        message: `❌ DNS check error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setCheckingDNS(null);
      setOperationProgress(null);
    }
  };

  // Helper function to ensure ic-domains file is on server
  const ensureICDomainsFile = async (domain: string, canisterId: string): Promise<boolean> => {
    if (!identity || !canisterId) {
      console.warn('⚠️ [DomainInterface] Cannot ensure ic-domains file: missing identity or server ID', {
        hasIdentity: !!identity,
        canisterId
      });
      return false;
    }

    try {
      console.log(`📝 [ensureICDomainsFile] Starting file upload to server: ${canisterId} for domain: ${domain}`);
      
      const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://127.0.0.1:4943'
        : 'https://icp0.io';
      
      console.log(`📝 [ensureICDomainsFile] Using host: ${host}`);
      
      const agent = new HttpAgent({
        identity: identity,
        host: host
      });
      
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        await agent.fetchRootKey();
      }
      
      // Get existing domains for this canister
      console.log(`📝 [ensureICDomainsFile] Fetching existing domain configs...`);
      const icConfigsResult = await domainService.listICDomainConfigs();
      const existingDomains = icConfigsResult.success && icConfigsResult.configs
        ? icConfigsResult.configs
            .filter(c => c.canisterId === canisterId)
            .map(c => c.domain)
        : [];
      
      console.log(`📝 [ensureICDomainsFile] Existing domains for server:`, existingDomains);
      
      // Ensure current domain is included
      const allDomains = [...new Set([...existingDomains, domain])];
      const combinedContent = allDomains.join('\n');
      
      console.log(`📝 [ensureICDomainsFile] File content to upload:`, {
        domains: allDomains,
        content: combinedContent,
        contentLength: combinedContent.length
      });
      
      const assetManager = new AssetManager({
        canisterId: Principal.fromText(canisterId),
        agent: agent,
      });
      
      console.log(`📤 [ensureICDomainsFile] Uploading file to server...`);
      await assetManager.store(
        new TextEncoder().encode(combinedContent),
        {
          fileName: '.well-known/ic-domains',
          contentType: 'text/plain'
        }
      );
      
      console.log(`✅ [ensureICDomainsFile] File uploaded successfully to server: ${canisterId}`);
      
      // Also update backend service (for record keeping, but file is already on server)
      try {
        await domainService.generateICDomainsFile(
          domain,
          canisterId,
          existingDomains
        );
        console.log(`✅ [ensureICDomainsFile] Backend service updated`);
      } catch (backendError) {
        // Non-critical - file is already on server
        console.warn('⚠️ [ensureICDomainsFile] Failed to update backend service (non-critical):', backendError);
      }
      
      return true;
    } catch (error) {
      console.error('❌ [ensureICDomainsFile] Failed to ensure ic-domains file:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ [ensureICDomainsFile] Error details:', {
        domain,
        canisterId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  };

  // Register domain with ICP Custom Domains API
  const handleRegisterWithICP = async (domain: string) => {
    setRegisteringICP(domain);
    setOperationProgress({ domain, operation: 'register', step: 'preparing', message: 'Preparing registration...' });
    
    try {
      const status = domainStorage.getDomainStatus(domain, projectId);
      const canisterId = status?.canisterId;
      
      // CRITICAL: Ensure .well-known/ic-domains file is on server BEFORE validation
      if (!canisterId) {
        throw new Error('App ID not found. Please connect your domain to your app first.');
      }
      
      if (!identity) {
        throw new Error('Identity not available. Please ensure you are authenticated.');
      }
      
      // CRITICAL: Upload the file to the canister FIRST
      setOperationProgress({ domain, operation: 'register', step: 'uploading', message: 'Preparing domain for activation...' });
      const fileEnsured = await ensureICDomainsFile(domain, canisterId);
      
      if (!fileEnsured) {
        throw new Error('Failed to prepare domain verification. Please try again.');
      }
      
      // Wait for file to be available and propagated
      setOperationProgress({ domain, operation: 'register', step: 'waiting', message: 'File uploaded. Waiting for IC boundary nodes to sync (5 seconds)...' });
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Step 1: Final validation (this will check if the file is accessible)
      setOperationProgress({ domain, operation: 'register', step: 'validating', message: 'Verifying your domain is ready...' });
      const validation = await domainService.validateWithICP(domain);
      
      if (!validation.success || !validation.validated) {
        throw new Error(
          validation.error || 
          validation.errors?.join(', ') || 
          'Domain validation failed. Ensure DNS records are correct and .well-known/ic-domains file is deployed.'
        );
      }
      
      // Step 2: Register with ICP
      setOperationProgress({ domain, operation: 'register', step: 'registering', message: 'Activating your domain (this may take 1-5 minutes)...' });
      const result = await domainService.registerWithICP(domain);
      
      if (result.success) {
        // Update status
        const registrationStatus = result.registrationStatus || 'registering';
        
        domainStorage.updateDomainStatus(domain, projectId, {
          status: registrationStatus === 'registered' ? 'icp_registered' : 'icp_registering',
          lastChecked: new Date().toISOString(),
          icpRegistrationId: (result as any).icpRegistration?.id
        });
        loadDomainStatuses();
        
        // Show appropriate success modal
        if (registrationStatus === 'registered') {
          setSuccessModalContent({
            title: '✅ Domain Registered Successfully',
            message: `Your domain ${domain} is now live and accessible via HTTPS!\n\nYou can visit your site at:\nhttps://${domain}`,
            actionLabel: 'Visit Domain',
            onAction: () => {
              window.open(`https://${domain}`, '_blank');
            }
          });
          setShowSuccessModal(true);
        } else {
          setSuccessModalContent({
            title: '⏳ Registration Initiated',
            message: `Registration for ${domain} has been initiated.\n\nStatus: ${registrationStatus}\n\nThis may take a few minutes. Check the domain status below for updates.`,
            actionLabel: 'Got it'
          });
          setShowSuccessModal(true);
        }
      } else {
        throw new Error(result.error || 'ICP registration failed');
      }
      
    } catch (error) {
      console.error('ICP registration error:', error);
      
      // Provide helpful error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      let userMessage = `Registration failed: ${errorMessage}`;
      
      if (errorMessage.includes('ic-domains')) {
        userMessage += '\n\nMake sure your website is properly deployed and connected.';
      } else if (errorMessage.includes('DNS')) {
        userMessage += '\n\nCheck that all DNS records are correctly configured and propagated.';
      }
      
      setErrorModalContent({
        title: '❌ Registration Failed',
        message: userMessage
      });
      setShowErrorModal(true);
    } finally {
      setRegisteringICP(null);
      setOperationProgress(null);
    }
  };

  // Handle registrar configuration
  const handleConfigureRegistrar = async () => {
    if (!registrarConfig.apiKey) {
      setConfigError('API Key is required');
      return;
    }

    setIsConfiguring(true);
    setConfigError(null);
    setConfigSuccess(false);

    try {
      const result = await domainService.configureRegistrar(registrarConfig);
      
      if (result.success) {
        setConfigSuccess(true);
        setShowRegistrarConfig(false);
        setTimeout(() => {
          setRegistrarConfig({
            provider: 'namesilo',
            apiKey: '',
            apiSecret: '',
            username: '',
            apiUrl: '',
            sandbox: false
          });
          setConfigSuccess(false);
        }, 2000);
      } else {
        setConfigError(result.error || 'Failed to configure registrar');
      }
    } catch (error) {
      console.error('Registrar configuration error:', error);
      setConfigError(error instanceof Error ? error.message : 'Failed to configure registrar');
    } finally {
      setIsConfiguring(false);
    }
  };

  // Configure existing domain DNS
  const handleConfigureExistingDomain = async () => {
    if (!existingDomain.trim() || !existingCanisterId.trim()) {
      setErrorModalContent({
        title: 'Missing Information',
        message: 'Please enter both domain and canister ID to configure DNS.'
      });
      setShowErrorModal(true);
      return;
    }

    setIsConfiguringExisting(true);
    setOperationProgress({ domain: existingDomain.trim(), operation: 'configure', step: 'configuring', message: 'Configuring DNS records...' });
    try {
      const result = await domainService.configureDNS(existingDomain.trim(), existingCanisterId.trim());
      
      if (result.success) {
        // Use new status mapping logic
        const dnsConfig = result.dnsRecords;
        const status = mapDomainStatus(dnsConfig, undefined);
        
        // Save status
        const domainStatus: DomainStatus = {
          domain: existingDomain.trim(),
          projectId,
          canisterId: existingCanisterId.trim(),
          purchaseDate: new Date().toISOString(),
          status,
          dnsConfiguration: {
            success: dnsConfig?.success || true,
            records: dnsConfig?.records,
            expectedIP: dnsConfig?.records?.find((r: any) => r.type === 'A')?.value, // Legacy
            expectedCNAME: dnsConfig?.records?.find((r: any) => r.type === 'CNAME')?.value || `${existingDomain.trim()}.icp1.io`,
            proxyMode: dnsConfig?.proxyMode,
            cloudflareHostnameId: dnsConfig?.cloudflareHostnameId
          }
        };
        
        domainStorage.saveDomainStatus(domainStatus);
        loadDomainStatuses();
        
        // Generate ic-domains file
        if (identity) {
          try {
            setOperationProgress({ domain: existingDomain.trim(), operation: 'configure', step: 'uploading', message: 'Uploading verification file to server...' });
            const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
              ? 'http://127.0.0.1:4943'
              : 'https://icp0.io';
            
            const agent = new HttpAgent({
              identity: identity,
              host: host
            });
            
            if (host.includes('localhost') || host.includes('127.0.0.1')) {
              await agent.fetchRootKey();
            }
            
            const icConfigsResult = await domainService.listICDomainConfigs();
            const existingDomains = icConfigsResult.success && icConfigsResult.configs
              ? icConfigsResult.configs
                  .filter(c => c.canisterId === existingCanisterId.trim())
                  .map(c => c.domain)
              : [];
            
            const allDomains = [...new Set([...existingDomains, existingDomain.trim()])];
            const combinedContent = allDomains.join('\n');
            
            const assetManager = new AssetManager({
              canisterId: Principal.fromText(existingCanisterId.trim()),
              agent: agent,
            });
            
            await assetManager.store(
              new TextEncoder().encode(combinedContent),
              {
                fileName: '.well-known/ic-domains',
                contentType: 'text/plain'
              }
            );
            
            await domainService.generateICDomainsFile(
              existingDomain.trim(),
              existingCanisterId.trim(),
              existingDomains
            );
          } catch (icError) {
            console.error('Failed to generate IC domains file:', icError);
          }
        }
        
        setSuccessModalContent({
          title: '✅ Domain Connection Started',
          message: `Your domain ${existingDomain.trim()} is being connected to your website!\n\nPlease check the connection status below.`,
          actionLabel: 'Got it'
        });
        setShowSuccessModal(true);
        setExistingDomain('');
        setExistingCanisterId('');
      } else {
        throw new Error(result.error || 'DNS configuration failed');
      }
    } catch (error) {
      console.error('Existing domain configuration error:', error);
        setErrorModalContent({
          title: '❌ Connection Failed',
          message: error instanceof Error ? error.message : 'Failed to connect your domain'
        });
      setShowErrorModal(true);
    } finally {
      setIsConfiguringExisting(false);
      setOperationProgress(null);
    }
  };

  // Check ICP registration status
  const handleCheckICPStatus = async (domain: string) => {
      setOperationProgress({ domain, operation: 'register', step: 'checking', message: 'Checking domain activation status...' });
    try {
      console.log(`[DomainInterface] Checking ICP registration status for ${domain}...`);
      
      const result = await domainService.getICPRegistrationStatus(domain);
      
      if (result.success) {
        const registrationStatus = result.registrationStatus;
        
        // Get current domain status to access DNS config
        const currentStatus = domainStorage.getDomainStatus(domain, projectId);
        const dnsConfig = currentStatus?.dnsConfiguration;
        
        // Use new status mapping logic
        const newStatus = mapDomainStatus(dnsConfig, registrationStatus);
        
        // Update local storage
        domainStorage.updateDomainStatus(domain, projectId, {
          status: newStatus,
          lastChecked: new Date().toISOString()
        });
        loadDomainStatuses();
        
        if (registrationStatus === 'registered') {
          setSuccessModalContent({
            title: '✅ Your Domain is Live!',
            message: `${domain} is now active and ready to use!\n\nVisit your website at:\nhttps://${domain}`,
            actionLabel: 'Visit Website',
            onAction: () => {
              window.open(`https://${domain}`, '_blank');
            }
          });
          setShowSuccessModal(true);
        } else if (registrationStatus === 'failed') {
          setErrorModalContent({
            title: '❌ Activation Failed',
            message: 'Domain activation failed. Please try again.'
          });
          setShowErrorModal(true);
        } else {
          setSuccessModalContent({
            title: '⏳ Activation In Progress',
            message: `Your domain is being activated...\n\nThis may take a few minutes. Check again shortly.`,
            actionLabel: 'Got it'
          });
          setShowSuccessModal(true);
        }
      } else {
          setErrorModalContent({
            title: '❌ Status Check Failed',
            message: `Unable to check activation status: ${result.error}`
          });
        setShowErrorModal(true);
      }
      
    } catch (error) {
      console.error('Error checking ICP status:', error);
      setErrorModalContent({
        title: '❌ Error',
        message: `Error checking status: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      setShowErrorModal(true);
    } finally {
      setOperationProgress(null);
    }
  };

  // Get status badge color
  const getStatusColor = (status: DomainStatus['status']) => {
    switch (status) {
      case 'purchased':
        return '#3b82f6'; // blue
      case 'dns_waiting':
        return '#f59e0b'; // amber
      case 'dns_propagated':
        return '#10b981'; // green
      case 'icp_registering':
        return '#8b5cf6'; // purple
      case 'icp_registered':
        return '#8b5cf6'; // purple
      case 'complete':
        return '#10b981'; // green
      // Cloudflare statuses disabled
      // case 'instant_access':
      // case 'switching_to_icp':
        return '#3b82f6'; // blue - optimizing
      case 'icp_direct':
        return '#10b981'; // green - direct ICP routing
      default:
        return '#6b7280'; // gray
    }
  };

  // Get status label
  const getStatusLabel = (status: DomainStatus['status']) => {
    switch (status) {
      case 'purchased':
        return 'Purchased';
      case 'dns_waiting':
        return 'Connecting';
      case 'dns_propagated':
        return 'Connected';
      case 'icp_registering':
        return 'Activating';
      case 'icp_registered':
        return 'Live';
      case 'complete':
        return 'Complete';
      // Cloudflare statuses disabled
      // case 'instant_access':
      // case 'switching_to_icp':
      case 'icp_direct':
        return 'Active';
      default:
        return 'Unknown';
    }
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--primary-black)',
      color: '#ffffff'
    }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem',
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(255, 255, 255, 0.02)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>🌐</span>
            <span>Domain Registration</span>
          </h2>
          <button
            onClick={() => setShowRegistrarConfig(!showRegistrarConfig)}
            style={{
              padding: '0.5rem 1rem',
              background: showRegistrarConfig ? 'var(--accent-orange)' : 'rgba(255, 255, 255, 0.1)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            {showRegistrarConfig ? 'Hide' : 'Configure'} Registrar
          </button>
        </div>
        
        {/* Registrar Configuration */}
        {showRegistrarConfig && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Registrar Configuration</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  Provider
                </label>
                <select
                  value={registrarConfig.provider}
                  onChange={(e) => setRegistrarConfig({
                    ...registrarConfig,
                    provider: e.target.value as any
                  })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="namesilo">NameSilo</option>
                  <option value="namecheap">Namecheap</option>
                  <option value="godaddy">GoDaddy</option>
                  <option value="cloudflare">Cloudflare</option>
                  <option value="namecom">Name.com</option>
                  <option value="porkbun">Porkbun</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  API Key *
                </label>
                <input
                  type="text"
                  value={registrarConfig.apiKey}
                  onChange={(e) => setRegistrarConfig({ ...registrarConfig, apiKey: e.target.value })}
                  placeholder="Enter API Key"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
              
              {(registrarConfig.provider === 'porkbun' || registrarConfig.provider === 'custom') && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                    API Secret {registrarConfig.provider === 'porkbun' && '*'}
                  </label>
                  <input
                    type="password"
                    value={registrarConfig.apiSecret}
                    onChange={(e) => setRegistrarConfig({ ...registrarConfig, apiSecret: e.target.value })}
                    placeholder="Enter API Secret"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
              )}
              
              {configError && (
                <div style={{
                  padding: '0.75rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '6px',
                  color: '#ef4444',
                  fontSize: '0.875rem'
                }}>
                  {configError}
                </div>
              )}
              
              {configSuccess && (
                <div style={{
                  padding: '0.75rem',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '6px',
                  color: '#10b981',
                  fontSize: '0.875rem'
                }}>
                  Registrar configured successfully!
                </div>
              )}
              
              <button
                onClick={handleConfigureRegistrar}
                disabled={isConfiguring}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: isConfiguring ? 'rgba(255, 107, 53, 0.5)' : 'var(--accent-orange)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  cursor: isConfiguring ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600
                }}
              >
                {isConfiguring ? 'Configuring...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginTop: '1rem',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <button
            onClick={() => setActiveTab('new')}
            style={{
              padding: '0.75rem 1.5rem',
              background: activeTab === 'new' ? 'var(--accent-orange)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'new' ? '2px solid var(--accent-orange)' : '2px solid transparent',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            🆕 New Domain
          </button>
          <button
            onClick={() => setActiveTab('existing')}
            style={{
              padding: '0.75rem 1.5rem',
              background: activeTab === 'existing' ? 'var(--accent-orange)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'existing' ? '2px solid var(--accent-orange)' : '2px solid transparent',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            📋 Existing Domain
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div 
        ref={contentScrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }} 
        className="chat-scrollbar"
      >
        
        {/* Operation Progress Indicator */}
        {operationProgress && (
          <div style={{
            padding: '1rem',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              borderTop: '2px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              flexShrink: 0
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem', color: '#3b82f6' }}>
                {operationProgress.operation === 'dns_check' && '🔍 Checking DNS'}
                {operationProgress.operation === 'register' && '🌐 Registering Domain'}
                {operationProgress.operation === 'purchase' && '🛒 Purchasing Domain'}
                {operationProgress.operation === 'configure' && '⚙️ Configuring Domain'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                {operationProgress.message}
              </div>
            </div>
          </div>
        )}
        
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        
        {/* Domain Statuses (shown for both tabs) */}
        {domainStatuses.length > 0 && (
          <div>
            <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Domain Status</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {domainStatuses.map((status, index) => (
                <div
                  key={index}
                  style={{
                    padding: '1rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                        {status.domain}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: getStatusColor(status.status),
                        fontWeight: 500
                      }}>
                        {getStatusLabel(status.status)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column', alignItems: 'flex-end' }}>
                      {/* Cloudflare instant_access status disabled */}
                      {false && status.status === 'instant_access' && (
                        <button
                          onClick={() => window.open(`https://${status.domain}`, '_blank')}
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'rgba(16, 185, 129, 0.2)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '6px',
                            color: '#10b981',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Visit Your Site
                        </button>
                      )}
                      {status.status === 'dns_waiting' && (
                        <>
                          <button
                            onClick={() => handleCheckDNS(status.domain)}
                            disabled={checkingDNS === status.domain}
                            style={{
                              padding: '0.5rem 1rem',
                              background: checkingDNS === status.domain ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.2)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              borderRadius: '6px',
                              color: '#3b82f6',
                              cursor: checkingDNS === status.domain ? 'not-allowed' : 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {checkingDNS === status.domain ? 'Checking...' : 'Check DNS'}
                          </button>
                        </>
                      )}
                      {status.status === 'dns_propagated' && (
                        <button
                          onClick={() => handleRegisterWithICP(status.domain)}
                          disabled={registeringICP === status.domain}
                          style={{
                            padding: '0.5rem 1rem',
                            background: registeringICP === status.domain
                              ? 'rgba(139, 92, 246, 0.5)'
                              : 'rgba(139, 92, 246, 0.2)',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            borderRadius: '6px',
                            color: '#8b5cf6',
                            cursor: registeringICP === status.domain
                              ? 'not-allowed'
                              : 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {registeringICP === status.domain ? 'Activating...' : 'Make Domain Live'}
                        </button>
                      )}
                      {status.status === 'icp_registering' && (
                        <button
                          onClick={() => handleCheckICPStatus(status.domain)}
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'rgba(139, 92, 246, 0.2)',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            borderRadius: '6px',
                            color: '#8b5cf6',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Check Status
                        </button>
                      )}
                      {status.status === 'icp_direct' && (
                        <button
                          onClick={() => window.open(`https://${status.domain}`, '_blank')}
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'rgba(16, 185, 129, 0.2)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '6px',
                            color: '#10b981',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Visit Your Site
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Cloudflare instant_access and switching_to_icp statuses disabled */}
                  
                  {status.status === 'dns_waiting' && (
                    <div style={{
                      padding: '0.75rem',
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      color: '#f59e0b',
                      marginTop: '0.5rem'
                    }}>
                      ⏳ Waiting for DNS propagation for: <strong>{status.domain}</strong>
                      <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.8 }}>
                        DNS propagation typically takes 5-60 minutes. Click "Check DNS" to verify when ready.
                        <br />
                        {(() => {
                          const isNameSilo = (status.registrar || '').toLowerCase() === 'namesilo';
                          if (isNameSilo) {
                            return (
                              <>
                                <strong>Required DNS records:</strong> A/AAAA records pointing to IPs that {status.domain}.icp1.io resolves to, TXT _server-id record, and CNAME _acme-challenge record.
                                <br />
                                <span style={{ fontSize: '0.7rem', fontStyle: 'italic' }}>
                                  Note: NameSilo doesn't support CNAME at apex, so A/AAAA records are used instead.
                                </span>
                              </>
                            );
                          } else {
                            return (
                              <>
                                <strong>Required DNS records:</strong> CNAME to {status.domain}.icp1.io, TXT _server-id record, and CNAME _acme-challenge record.
                              </>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  )}
                  
                  {status.status === 'dns_propagated' && (
                    <div style={{
                      padding: '0.75rem',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      color: '#10b981',
                      marginTop: '0.5rem'
                    }}>
                      ✅ Your domain <strong>{status.domain}</strong> is connected!
                      <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.8 }}>
                        Your domain is ready! Click "Make Domain Live" to activate it.
                      </div>
                    </div>
                  )}
                  
                  {/* DNS Check Results */}
                  {dnsCheckResults && dnsCheckResults.domain === status.domain && (
                    <div style={{
                      padding: '0.75rem',
                      background: dnsCheckResults.propagated 
                        ? 'rgba(16, 185, 129, 0.1)'
                        : dnsCheckResults.currentIP
                        ? 'rgba(245, 158, 11, 0.1)'
                        : 'rgba(107, 114, 128, 0.1)',
                      border: `1px solid ${dnsCheckResults.propagated 
                        ? 'rgba(16, 185, 129, 0.3)'
                        : dnsCheckResults.currentIP
                        ? 'rgba(245, 158, 11, 0.3)'
                        : 'rgba(107, 114, 128, 0.3)'}`,
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      color: dnsCheckResults.propagated 
                        ? '#10b981'
                        : dnsCheckResults.currentIP
                        ? '#f59e0b'
                        : '#6b7280',
                      marginTop: '0.5rem'
                    }}>
                      {dnsCheckResults.message}
                      {dnsCheckResults.currentIP && (
                        <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.8, fontFamily: 'monospace' }}>
                          {dnsCheckResults.currentIP.includes('.icp1.io') || dnsCheckResults.currentIP.includes('.icp') 
                            ? `Current CNAME: ${dnsCheckResults.currentIP}`
                            : `Current IP: ${dnsCheckResults.currentIP}`}
                        </div>
                      )}
                      {dnsCheckResults.expectedIP && (
                        <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.8, fontFamily: 'monospace' }}>
                          {dnsCheckResults.expectedIP.includes('.icp1.io') || dnsCheckResults.expectedIP.includes('.icp')
                            ? `Expected CNAME: ${dnsCheckResults.expectedIP}`
                            : `Expected IP: ${dnsCheckResults.expectedIP}`}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {status.dnsConfiguration?.records && status.dnsConfiguration.records.length > 0 && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                      <div style={{ 
                        fontWeight: 600, 
                        marginBottom: '0.5rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem' 
                      }}>
                        Domain Settings ({status.registrar || 'Unknown Provider'}):
                        <button
                          onClick={() => handleCheckDNS(status.domain)}
                          disabled={checkingDNS === status.domain}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: checkingDNS === status.domain 
                              ? 'rgba(59, 130, 246, 0.5)' 
                              : 'rgba(59, 130, 246, 0.2)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '4px',
                            color: '#3b82f6',
                            cursor: checkingDNS === status.domain ? 'not-allowed' : 'pointer',
                            fontSize: '0.65rem',
                            fontWeight: 500
                          }}
                          title="Check domain connection status"
                        >
                          {checkingDNS === status.domain ? 'Checking...' : 'Check Status'}
                        </button>
                      </div>
                      
                      {status.dnsConfiguration.records.map((record, idx) => {
                        const isRootRecord = !record.name || record.name === '@' || record.name === '';
                        const isNameSilo = (status.registrar || '').toLowerCase() === 'namesilo';
                        
                        // For NameSilo: A/AAAA at root is correct
                        // For others: CNAME at root is correct
                        const isCorrect = isRootRecord 
                          ? (isNameSilo ? (record.type === 'A' || record.type === 'AAAA') : record.type === 'CNAME')
                          : (record.type === 'TXT' || record.type === 'CNAME');
                        
                        const isWrong = isRootRecord && !isCorrect;
                        
                        return (
                          <div 
                            key={idx} 
                            style={{ 
                              fontFamily: 'monospace', 
                              marginLeft: '0.5rem', 
                              marginBottom: '0.25rem',
                              color: isWrong ? '#f59e0b' : isCorrect ? '#10b981' : 'var(--text-gray)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>
                                {record.type} {record.name || '@'} → {record.value}
                              </span>
                              {isCorrect && isRootRecord && (
                                <span style={{ fontSize: '0.65rem', color: '#10b981' }}>
                                  ✓ {isNameSilo ? 'Correct for NameSilo' : 'Correct'}
                                </span>
                              )}
                              {isWrong && (
                                <span style={{ fontSize: '0.65rem', color: '#f59e0b' }}>
                                  ⚠️ {isNameSilo ? 'Should be A/AAAA' : 'Should be CNAME'}
                                </span>
                              )}
                            </div>
                            {record.note && (
                              <div style={{ 
                                fontSize: '0.7rem', 
                                color: 'var(--text-gray)', 
                                fontStyle: 'italic',
                                marginLeft: '0.5rem'
                              }}>
                                ℹ️ {record.note}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {/* Expected Configuration Info */}
                      {status.dnsConfiguration.expectedIP && (
                        <div style={{ 
                          fontSize: '0.7rem', 
                          marginTop: '0.5rem', 
                          padding: '0.5rem',
                          background: 'rgba(16, 185, 129, 0.1)',
                          borderRadius: '4px',
                          color: '#10b981'
                        }}>
                          ✓ Expected A record: <strong>{status.dnsConfiguration.expectedIP}</strong>
                          <br />
                          <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                            NameSilo doesn't support CNAME at apex - A/AAAA records are correct
                          </span>
                        </div>
                      )}
                      
                      {status.dnsConfiguration.expectedCNAME && (
                        <div style={{ 
                          fontSize: '0.7rem', 
                          marginTop: '0.5rem', 
                          padding: '0.5rem',
                          background: 'rgba(16, 185, 129, 0.1)',
                          borderRadius: '4px',
                          color: '#10b981'
                        }}>
                          ✓ Expected CNAME: <strong>{status.dnsConfiguration.expectedCNAME}</strong>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Registration Status Display */}
                  {status.status === 'icp_registering' && (
                    <div style={{
                      padding: '0.75rem',
                      background: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      color: '#8b5cf6',
                      marginTop: '0.5rem'
                    }}>
                        <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>
                        🔄 Activating your domain...
                      </div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                        Your domain is being activated. This typically takes 1-5 minutes.
                        <br />
                        Check status again in a moment.
                      </div>
                      <button
                        onClick={() => handleCheckICPStatus(status.domain)}
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.5rem 1rem',
                          background: 'rgba(139, 92, 246, 0.2)',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          borderRadius: '6px',
                          color: '#8b5cf6',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 500
                        }}
                      >
                        Check Activation Status
                      </button>
                    </div>
                  )}

                  {status.status === 'icp_registered' && (
                    <div style={{
                      padding: '0.75rem',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      color: '#10b981',
                      marginTop: '0.5rem'
                    }}>
                      <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>
                        ✅ Your domain is live!
                      </div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                        Your website is now accessible at this domain.
                      </div>
                      <a
                        href={`https://${status.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block',
                          marginTop: '0.5rem',
                          padding: '0.5rem 1rem',
                          background: 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: '6px',
                          color: '#10b981',
                          textDecoration: 'none',
                          fontSize: '0.75rem',
                          fontWeight: 500
                        }}
                      >
                        Visit Your Site →
                      </a>
                    </div>
                  )}

                  {status.status === 'icp_direct' && (
                    <div style={{
                      padding: '0.75rem',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      color: '#10b981',
                      marginTop: '0.5rem'
                    }}>
                      <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>
                        ✅ Your domain is live!
                      </div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                        Your website is now accessible and running at optimal performance.
                      </div>
                      <a
                        href={`https://${status.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block',
                          marginTop: '0.5rem',
                          padding: '0.5rem 1rem',
                          background: 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: '6px',
                          color: '#10b981',
                          textDecoration: 'none',
                          fontSize: '0.75rem',
                          fontWeight: 500
                        }}
                      >
                        Visit Your Site →
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New Domain Tab */}
        {activeTab === 'new' && (
          <>
            {/* Domain Search */}
            <div>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Search Domain</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={searchDomain}
                  onChange={(e) => setSearchDomain(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter domain name (e.g., example)"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.875rem'
                  }}
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: isSearching ? 'rgba(255, 107, 53, 0.5)' : 'var(--accent-orange)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    cursor: isSearching ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </div>
              
              {searchError && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '6px',
                  color: '#ef4444',
                  fontSize: '0.875rem'
                }}>
                  {searchError}
                </div>
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div>
                <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Available Domains</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {searchResults.map((result, index) => {
                    const price = domainPricing[result.domain] || result.price || 0;
                    const unitsCost = Math.round(price * 10);
                    
                    return (
                      <div
                        key={index}
                        onClick={() => result.available && setSelectedDomain(result)}
                        style={{
                          padding: '1rem',
                          background: selectedDomain?.domain === result.domain
                            ? 'rgba(255, 107, 53, 0.15)'
                            : result.available
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(107, 114, 128, 0.1)',
                          border: selectedDomain?.domain === result.domain
                            ? '2px solid var(--accent-orange)'
                            : '1px solid var(--border-color)',
                          borderRadius: '8px',
                          cursor: result.available ? 'pointer' : 'not-allowed',
                          opacity: result.available ? 1 : 0.6
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                              {result.domain}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: result.available ? '#10b981' : '#ef4444' }}>
                              {result.available ? '✓ Available' : '✗ Not Available'}
                            </div>
                          </div>
                          {result.available && price > 0 && (
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                                ${price.toFixed(2)}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                                {unitsCost} units
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Purchase Form */}
            {selectedDomain && selectedDomain.available && (
              <div style={{
                padding: '1.5rem',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)'
              }}>
                <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>
                  Purchase: {selectedDomain.domain}
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                      Registration Period (Years)
                    </label>
                    <select
                      value={purchaseYears}
                      onChange={(e) => {
                        const years = parseInt(e.target.value);
                        setPurchaseYears(years);
                        if (selectedDomain) {
                          domainService.getDomainPricing([selectedDomain.domain], years).then(response => {
                            if (response.success && response.pricing.length > 0) {
                              const newPrice = response.pricing[0].price;
                              setDomainPricing({
                                ...domainPricing,
                                [selectedDomain.domain]: newPrice
                              });
                            }
                          });
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        color: '#ffffff',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="1">1 Year</option>
                      <option value="2">2 Years</option>
                      <option value="3">3 Years</option>
                      <option value="5">5 Years</option>
                      <option value="10">10 Years</option>
                    </select>
                  </div>

                  <div style={{
                    padding: '1rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-gray)' }}>
                      Total Cost
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                      ${(domainPricing[selectedDomain.domain] || selectedDomain.price || 0).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: '0.25rem' }}>
                      {(Math.round((domainPricing[selectedDomain.domain] || selectedDomain.price || 0) * 10))} units
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: '0.5rem' }}>
                      Your balance: {credits.unitsBalance || 0} units
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem' }}>
                    <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Contact Information</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                          First Name *
                        </label>
                        <input
                          type="text"
                          value={contactInfo.firstName}
                          onChange={(e) => setContactInfo({ ...contactInfo, firstName: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: '#ffffff',
                            fontSize: '0.875rem'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                          Last Name *
                        </label>
                        <input
                          type="text"
                          value={contactInfo.lastName}
                          onChange={(e) => setContactInfo({ ...contactInfo, lastName: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: '#ffffff',
                            fontSize: '0.875rem'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                          Email *
                        </label>
                        <input
                          type="email"
                          value={contactInfo.email}
                          onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: '#ffffff',
                            fontSize: '0.875rem'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={contactInfo.phone}
                          onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: '#ffffff',
                            fontSize: '0.875rem'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {purchaseError && (
                    <div style={{
                      padding: '0.75rem',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '6px',
                      color: '#ef4444',
                      fontSize: '0.875rem'
                    }}>
                      {purchaseError}
                    </div>
                  )}

                  <button
                    onClick={handlePurchase}
                    disabled={
                      isPurchasing || 
                      !contactInfo.firstName || 
                      !contactInfo.lastName || 
                      !contactInfo.email ||
                      hasServerPair === false ||
                      checkingServerPair
                    }
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: (
                        isPurchasing || 
                        !contactInfo.firstName || 
                        !contactInfo.lastName || 
                        !contactInfo.email ||
                        hasServerPair === false ||
                        checkingServerPair
                      )
                        ? 'rgba(255, 107, 53, 0.5)'
                        : 'var(--accent-orange)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      cursor: (
                        isPurchasing || 
                        !contactInfo.firstName || 
                        !contactInfo.lastName || 
                        !contactInfo.email ||
                        hasServerPair === false ||
                        checkingServerPair
                      )
                        ? 'not-allowed'
                        : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600
                    }}
                    title={
                      hasServerPair === false
                        ? 'Server pair required - Deploy a frontend server first'
                        : checkingServerPair
                        ? 'Checking server configuration...'
                        : undefined
                    }
                  >
                    {isPurchasing 
                      ? 'Purchasing...' 
                      : checkingServerPair
                      ? 'Checking...'
                      : hasServerPair === false
                      ? 'Server Pair Required'
                      : 'Purchase Domain'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Existing Domain Tab */}
        {activeTab === 'existing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Configure Existing Domain</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                    Domain Name
                  </label>
                  <input
                    type="text"
                    value={existingDomain}
                    onChange={(e) => setExistingDomain(e.target.value)}
                    placeholder="example.com"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                    App ID
                  </label>
                  <input
                    type="text"
                    value={existingCanisterId}
                    onChange={(e) => setExistingCanisterId(e.target.value)}
                    placeholder="Enter your app ID (found in your project settings)"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
                <button
                  onClick={handleConfigureExistingDomain}
                  disabled={isConfiguringExisting || !existingDomain.trim() || !existingCanisterId.trim()}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: isConfiguringExisting || !existingDomain.trim() || !existingCanisterId.trim()
                      ? 'rgba(255, 107, 53, 0.5)'
                      : 'var(--accent-orange)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    cursor: isConfiguringExisting || !existingDomain.trim() || !existingCanisterId.trim()
                      ? 'not-allowed'
                      : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600
                  }}
                >
                  {isConfiguringExisting ? 'Configuring...' : 'Configure DNS'}
                </button>
              </div>
            </div>

            {/* Registrar Instructions */}
            <div>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>DNS Configuration Instructions</h3>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  Select Your Registrar
                </label>
                <select
                  value={selectedRegistrar}
                  onChange={(e) => setSelectedRegistrar(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.875rem'
                  }}
                >
                  {Object.keys(REGISTRAR_INSTRUCTIONS).map(key => (
                    <option key={key} value={key}>
                      {REGISTRAR_INSTRUCTIONS[key].icon} {REGISTRAR_INSTRUCTIONS[key].name}
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const instruction = REGISTRAR_INSTRUCTIONS[selectedRegistrar];
                if (!instruction) return null;

                return (
                  <div style={{
                    padding: '1.5rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '1rem',
                      fontSize: '1.125rem',
                      fontWeight: 600
                    }}>
                      <span>{instruction.icon}</span>
                      <span>{instruction.name}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {instruction.steps.map((step) => (
                        <div key={step.number} style={{
                          padding: '1rem',
                          background: 'rgba(0, 0, 0, 0.2)',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '1rem'
                          }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: 'var(--accent-orange)',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              flexShrink: 0
                            }}>
                              {step.number}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                marginBottom: '0.5rem'
                              }}>
                                {step.title}
                              </div>
                              <div style={{
                                fontSize: '0.875rem',
                                color: 'var(--text-gray)',
                                lineHeight: 1.6
                              }}>
                                {step.description}
                              </div>
                              {step.details && step.details.length > 0 && (
                                <div style={{
                                  marginTop: '0.75rem',
                                  padding: '0.75rem',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontFamily: 'monospace',
                                  color: '#ffffff'
                                }}>
                                  {step.details.map((detail, idx) => (
                                    <div key={idx} style={{ marginBottom: idx < step.details!.length - 1 ? '0.5rem' : 0 }}>
                                      {detail}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {(instruction.dnsSettingsUrl || instruction.supportUrl) && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '0.75rem',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '6px',
                        display: 'flex',
                        gap: '1rem',
                        flexWrap: 'wrap'
                      }}>
                        {instruction.dnsSettingsUrl && (
                          <a
                            href={instruction.dnsSettingsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#3b82f6',
                              textDecoration: 'none',
                              fontSize: '0.875rem',
                              fontWeight: 500
                            }}
                          >
                            🔗 DNS Settings →
                          </a>
                        )}
                        {instruction.supportUrl && (
                          <a
                            href={instruction.supportUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#3b82f6',
                              textDecoration: 'none',
                              fontSize: '0.875rem',
                              fontWeight: 500
                            }}
                          >
                            📚 Support →
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Manual DNS Check */}
            <div>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Check Domain Connection</h3>
              <div style={{
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                    Domain to Check
                  </label>
                  <input
                    type="text"
                    value={existingDomain}
                    onChange={(e) => setExistingDomain(e.target.value)}
                    placeholder="example.com"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.875rem',
                      marginBottom: '0.75rem'
                    }}
                  />
                  <button
                    onClick={() => existingDomain && handleCheckDNS(existingDomain)}
                    disabled={!existingDomain.trim() || checkingDNS === existingDomain}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: !existingDomain.trim() || checkingDNS === existingDomain
                        ? 'rgba(59, 130, 246, 0.5)'
                        : 'rgba(59, 130, 246, 0.2)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '8px',
                      color: '#3b82f6',
                      cursor: !existingDomain.trim() || checkingDNS === existingDomain ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      width: '100%'
                    }}
                  >
                    {checkingDNS === existingDomain ? 'Checking...' : 'Check Domain Connection'}
                  </button>
                </div>
                
                {/* DNS Check Results */}
                {dnsCheckResults && dnsCheckResults.domain === existingDomain && (
                  <div style={{
                    padding: '0.75rem',
                    background: dnsCheckResults.propagated 
                      ? 'rgba(16, 185, 129, 0.1)'
                      : dnsCheckResults.currentIP
                      ? 'rgba(245, 158, 11, 0.1)'
                      : 'rgba(107, 114, 128, 0.1)',
                    border: `1px solid ${dnsCheckResults.propagated 
                      ? 'rgba(16, 185, 129, 0.3)'
                      : dnsCheckResults.currentIP
                      ? 'rgba(245, 158, 11, 0.3)'
                      : 'rgba(107, 114, 128, 0.3)'}`,
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    color: dnsCheckResults.propagated 
                      ? '#10b981'
                      : dnsCheckResults.currentIP
                      ? '#f59e0b'
                      : '#6b7280',
                    marginTop: '0.75rem'
                  }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>
                      {dnsCheckResults.message}
                    </div>
                    {dnsCheckResults.currentIP && (
                      <div style={{ 
                        fontSize: '0.75rem', 
                        marginTop: '0.5rem', 
                        opacity: 0.8, 
                        fontFamily: 'monospace',
                        padding: '0.5rem',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '4px'
                      }}>
                        {dnsCheckResults.currentIP.includes('.icp1.io') || dnsCheckResults.currentIP.includes('.icp')
                          ? <>Current CNAME: <strong>{dnsCheckResults.currentIP}</strong></>
                          : <>Current IP: <strong>{dnsCheckResults.currentIP}</strong></>}
                      </div>
                    )}
                    {dnsCheckResults.expectedIP && (
                      <div style={{ 
                        fontSize: '0.75rem', 
                        marginTop: '0.5rem', 
                        opacity: 0.8, 
                        fontFamily: 'monospace',
                        padding: '0.5rem',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '4px'
                      }}>
                        {dnsCheckResults.expectedIP.includes('.icp1.io') || dnsCheckResults.expectedIP.includes('.icp')
                          ? <>Expected CNAME: <strong>{dnsCheckResults.expectedIP}</strong></>
                          : <>Expected IP: <strong>{dnsCheckResults.expectedIP}</strong></>}
                      </div>
                    )}
                    {dnsCheckResults.propagated && (
                      <div style={{ 
                        fontSize: '0.75rem', 
                        marginTop: '0.75rem', 
                        padding: '0.5rem',
                        background: 'rgba(16, 185, 129, 0.1)',
                        borderRadius: '4px',
                        fontWeight: 500
                      }}>
                        ✅ Your domain is connected! You can now make it live.
                      </div>
                    )}
                  </div>
                )}
                
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-gray)',
                  lineHeight: 1.6,
                  marginTop: '0.75rem'
                }}>
                  After updating your domain settings, use this tool to check if your domain is connected. 
                  Once connected, you can activate your domain to make it live.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* No Server Pair Modal */}
      {showNoServerPairModal && (
        <>
          <div
            onClick={() => setShowNoServerPairModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(8px)',
              zIndex: 9000,
              animation: 'fadeIn 0.2s ease-out'
            }}
          />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'linear-gradient(135deg, var(--secondary-black), var(--primary-black))',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            animation: 'slideUp 0.3s ease-out',
            zIndex: 9001,
            isolation: 'isolate'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.1))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                flexShrink: 0
              }}>
                ⚠️
              </div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#ffffff',
                margin: 0
              }}>
                App Deployment Required
              </h3>
            </div>

            <p style={{
              color: 'var(--text-gray)',
              lineHeight: 1.6,
              marginBottom: '1.5rem',
              fontSize: '0.95rem'
            }}>
              To connect your domain to your website, you need to deploy your app for this project first.
            </p>

            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <h4 style={{
                color: '#f59e0b',
                fontSize: '0.875rem',
                fontWeight: 600,
                marginBottom: '0.75rem',
                marginTop: 0
              }}>
                What you need to do:
              </h4>
              <ol style={{
                color: 'var(--text-gray)',
                fontSize: '0.875rem',
                lineHeight: 1.8,
                paddingLeft: '1.5rem',
                margin: 0
              }}>
                <li>Deploy a frontend server for this project</li>
                <li>Ensure the server pair is active and running</li>
                <li>Return here to purchase your domain</li>
              </ol>
            </div>

            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowNoServerPairModal(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
      
      {/* Success Modal */}
      {showSuccessModal && successModalContent && (
        <>
          <div
            onClick={() => {
              setShowSuccessModal(false);
              setSuccessModalContent(null);
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(8px)',
              zIndex: 9000,
              animation: 'fadeIn 0.2s ease-out'
            }}
          />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'linear-gradient(135deg, var(--secondary-black), var(--primary-black))',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '550px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            animation: 'slideUp 0.3s ease-out',
            zIndex: 9001,
            isolation: 'isolate'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                flexShrink: 0
              }}>
                ✅
              </div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#ffffff',
                margin: 0
              }}>
                {successModalContent.title}
              </h3>
            </div>

            <p style={{
              color: 'var(--text-gray)',
              lineHeight: 1.8,
              marginBottom: '2rem',
              fontSize: '0.95rem',
              whiteSpace: 'pre-line'
            }}>
              {successModalContent.message}
            </p>

            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setSuccessModalContent(null);
                  if (successModalContent.onAction) {
                    successModalContent.onAction();
                  }
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--accent-orange)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 107, 53, 0.9)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'var(--accent-orange)';
                }}
              >
                {successModalContent.actionLabel || 'Got it'}
              </button>
            </div>
          </div>
        </>
      )}
      
      {/* Error Modal */}
      {showErrorModal && errorModalContent && (
        <>
          <div
            onClick={() => {
              setShowErrorModal(false);
              setErrorModalContent(null);
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(8px)',
              zIndex: 9000,
              animation: 'fadeIn 0.2s ease-out'
            }}
          />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'linear-gradient(135deg, var(--secondary-black), var(--primary-black))',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            animation: 'slideUp 0.3s ease-out',
            zIndex: 9001,
            isolation: 'isolate'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.1))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                flexShrink: 0
              }}>
                ❌
              </div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#ffffff',
                margin: 0
              }}>
                {errorModalContent.title}
              </h3>
            </div>

            <p style={{
              color: 'var(--text-gray)',
              lineHeight: 1.8,
              marginBottom: '2rem',
              fontSize: '0.95rem',
              whiteSpace: 'pre-line'
            }}>
              {errorModalContent.message}
            </p>

            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowErrorModal(false);
                  setErrorModalContent(null);
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DomainInterface;
