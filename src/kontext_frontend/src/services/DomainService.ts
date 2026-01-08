// ============================================================================
// DomainService.ts - Domain Registration Service
// ============================================================================

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

export interface DomainRegistrarConfig {
    provider: 'namecheap' | 'godaddy' | 'cloudflare' | 'namecom' | 'porkbun' | 'namesilo' | 'custom';
    apiKey: string;
    apiSecret?: string;
    username?: string;
    apiUrl?: string;
    sandbox?: boolean;
}

export interface DomainAvailabilityResult {
    domain: string;
    available: boolean;
    price?: number;
    currency?: string;
    message?: string;
    error?: string;
}

export interface DomainPricingResult {
    domain: string;
    price: number;
    currency: string;
    renewalPrice?: number;
    error?: string;
}

export interface DomainPurchaseRequest {
    domain: string;
    years?: number;
    contactInfo: {
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
        organization?: string;
        address?: string;
        city?: string;
        state?: string;
        zip?: string;
        country?: string;
    };
    privacyProtection?: boolean;
    autoRenew?: boolean;
    canisterId?: string; // Optional: if provided with configureIC, will auto-configure DNS and ICP registration
    configureIC?: boolean; // Optional: flag to enable automatic IC configuration
}

export interface DomainPurchaseResult {
    success: boolean;
    domain: string;
    orderId?: string;
    status?: string;
    expiresAt?: string;
    years?: number;
    executionTimeMs?: number;
    dnsConfiguration?: {
        success: boolean;
        message?: string;
        records?: Array<{
            type: string;
            name: string;
            value: string;
            note?: string; // NEW: Indicates proxy status (e.g., "Cloudflare proxy (will switch to ICP when ready)")
        }>;
        dnsPropagated?: boolean;
        proxyMode?: 'cloudflare' | 'direct'; // NEW: Current routing mode
        cloudflareHostnameId?: string; // NEW: Cloudflare custom hostname ID
        error?: string;
    };
    icpRegistration?: {
        id: string;
        state: string;
    };
    error?: string;
    details?: string;
}

export interface DomainStatusResult {
    success: boolean;
    domain: string;
    status?: {
        registered: boolean;
        expiresAt?: string;
        registrar?: string;
        status?: string;
    };
    executionTimeMs?: number;
    error?: string;
    details?: string;
}

export interface DomainSearchResponse {
    success: boolean;
    domains: DomainAvailabilityResult[];
    count: number;
    executionTimeMs: number;
    error?: string;
}

export interface DomainPricingResponse {
    success: boolean;
    pricing: DomainPricingResult[];
    years: number;
    executionTimeMs: number;
    error?: string;
}

// ============================================================================
// DOMAIN SERVICE CLASS
// ============================================================================

export class DomainService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = 'https://ai.coinnation.io';
        console.log(`🌐 [DomainService] Initialized with base URL: ${this.baseUrl}`);
    }

    // ========================================================================
    // HEALTH CHECK
    // ========================================================================

    public async healthCheck(): Promise<{success: boolean; error?: string}> {
        try {
            console.log(`🏥 [DomainService] Performing health check...`);
            
            const response = await fetch(`${this.baseUrl}/api/domains/health`, {
                method: 'GET'
            });
            
            if (!response.ok) {
                throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
            }
            
            console.log(`✅ [DomainService] Health check passed`);
            return { success: true };
            
        } catch (error) {
            console.error('❌ [DomainService] Health check failed:', error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown health check error'
            };
        }
    }

    // ========================================================================
    // CONFIGURE REGISTRAR
    // ========================================================================

    public async configureRegistrar(config: DomainRegistrarConfig): Promise<{
        success: boolean;
        message?: string;
        provider?: string;
        sandbox?: boolean;
        paymentNote?: string;
        error?: string;
    }> {
        try {
            console.log(`⚙️ [DomainService] Configuring registrar: ${config.provider}`);

            const response = await fetch(`${this.baseUrl}/api/domains/configure-registrar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to configure registrar: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ [DomainService] Registrar configured successfully: ${config.provider}`);
            return data;

        } catch (error) {
            console.error('❌ [DomainService] Failed to configure registrar:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // ========================================================================
    // SEARCH DOMAIN AVAILABILITY
    // ========================================================================

    public async searchDomains(domain: string, tlds?: string[]): Promise<DomainSearchResponse> {
        try {
            console.log(`🔍 [DomainService] Searching domain availability: ${domain}`);

            const response = await fetch(`${this.baseUrl}/api/domains/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    domain,
                    tlds: tlds || undefined
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Domain search failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ [DomainService] Domain search completed: ${data.count} result(s)`);
            return data;

        } catch (error) {
            console.error('❌ [DomainService] Domain search failed:', error);
            return {
                success: false,
                domains: [],
                count: 0,
                executionTimeMs: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // ========================================================================
    // GET DOMAIN PRICING
    // ========================================================================

    public async getDomainPricing(domains: string[], years: number = 1): Promise<DomainPricingResponse> {
        try {
            console.log(`💰 [DomainService] Getting pricing for ${domains.length} domain(s)`);

            const response = await fetch(`${this.baseUrl}/api/domains/pricing`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    domains,
                    years
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to get pricing: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ [DomainService] Pricing retrieved for ${data.pricing.length} domain(s)`);
            return data;

        } catch (error) {
            console.error('❌ [DomainService] Failed to get pricing:', error);
            return {
                success: false,
                pricing: [],
                years,
                executionTimeMs: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // ========================================================================
    // PURCHASE DOMAIN
    // ========================================================================

    public async purchaseDomain(request: DomainPurchaseRequest): Promise<DomainPurchaseResult> {
        try {
            console.log(`🛒 [DomainService] Purchasing domain: ${request.domain}`);

            const response = await fetch(`${this.baseUrl}/api/domains/purchase`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    domain: request.domain,
                    years: request.years || 1,
                    contactInfo: request.contactInfo,
                    privacyProtection: request.privacyProtection !== undefined ? request.privacyProtection : true,
                    autoRenew: request.autoRenew !== undefined ? request.autoRenew : true,
                    canisterId: request.canisterId,
                    configureIC: request.configureIC !== undefined ? request.configureIC : false
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || `Domain purchase failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ [DomainService] Domain purchase completed: ${request.domain}`);
            return {
                success: true,
                ...data
            };

        } catch (error) {
            console.error('❌ [DomainService] Domain purchase failed:', error);
            return {
                success: false,
                domain: request.domain,
                error: error instanceof Error ? error.message : 'Unknown error',
                details: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // ========================================================================
    // GET IC DOMAIN CONFIGURATION
    // ========================================================================

    public async getICDomainConfig(domain: string): Promise<{
        success: boolean;
        domain?: string;
        canisterId?: string;
        icDomainsFile?: string;
        error?: string;
    }> {
        try {
            console.log(`📋 [DomainService] Getting IC domain config: ${domain}`);

            const encodedDomain = encodeURIComponent(domain);
            const response = await fetch(`${this.baseUrl}/api/domains/ic/config/${encodedDomain}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return { success: false, error: 'IC domain configuration not found' };
                }
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to get IC domain config: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ [DomainService] IC domain config retrieved: ${domain}`);
            return {
                success: true,
                ...data
            };

        } catch (error) {
            console.error('❌ [DomainService] Failed to get IC domain config:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // ========================================================================
    // LIST ALL IC DOMAIN CONFIGURATIONS
    // ========================================================================

    public async listICDomainConfigs(): Promise<{
        success: boolean;
        configs?: Array<{
            domain: string;
            canisterId: string;
            domainsCount: number;
        }>;
        count?: number;
        error?: string;
    }> {
        try {
            console.log(`📋 [DomainService] Listing all IC domain configs`);

            const response = await fetch(`${this.baseUrl}/api/domains/ic/configs`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to list IC domain configs: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ [DomainService] IC domain configs retrieved: ${data.count || 0} config(s)`);
            return {
                success: true,
                ...data
            };

        } catch (error) {
            console.error('❌ [DomainService] Failed to list IC domain configs:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // ========================================================================
    // GENERATE IC-DOMAINS FILE CONTENT
    // ========================================================================

    public async generateICDomainsFile(domain: string, canisterId: string, additionalDomains: string[] = []): Promise<{
        success: boolean;
        domain?: string;
        canisterId?: string;
        filePath?: string;
        fileContent?: string;
        domains?: string[];
        error?: string;
    }> {
        try {
            console.log(`📝 [DomainService] Generating IC domains file for: ${domain} -> ${canisterId}`);

            const response = await fetch(`${this.baseUrl}/api/domains/ic/generate-domains-file`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    domain,
                    canisterId,
                    additionalDomains
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to generate IC domains file: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ [DomainService] IC domains file generated: ${domain}`);
            return {
                success: true,
                ...data
            };

        } catch (error) {
            console.error('❌ [DomainService] Failed to generate IC domains file:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // ========================================================================
    // CONFIGURE DNS FOR IC DOMAIN
    // ========================================================================

    public async configureDNS(domain: string, canisterId: string): Promise<{
        success: boolean;
        domain?: string;
        canisterId?: string;
        dnsRecords?: {
            success: boolean;
            message?: string;
            records?: Array<{
                type: string;
                name: string;
                value: string;
                note?: string;
            }>;
            dnsPropagated?: boolean;
            proxyMode?: 'cloudflare' | 'direct';
            cloudflareHostnameId?: string;
        };
        icBoundaryNodes?: any;
        instructions?: any;
        executionTimeMs?: number;
        error?: string;
    }> {
        try {
            console.log(`🌐 [DomainService] Configuring DNS for IC domain: ${domain} -> ${canisterId}`);

            const response = await fetch(`${this.baseUrl}/api/domains/ic/configure-dns`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    domain,
                    canisterId
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || `Failed to configure DNS: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ [DomainService] DNS configured successfully: ${domain}`);
            return {
                success: true,
                ...data
            };

        } catch (error) {
            console.error('❌ [DomainService] Failed to configure DNS:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // ========================================================================
    // CHECK DOMAIN STATUS
    // ========================================================================

    public async getDomainStatus(domain: string): Promise<DomainStatusResult> {
        try {
            console.log(`📊 [DomainService] Checking domain status: ${domain}`);

            // Encode domain for URL (handle special characters)
            const encodedDomain = encodeURIComponent(domain);
            const response = await fetch(`${this.baseUrl}/api/domains/status/${encodedDomain}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || `Failed to get domain status: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ [DomainService] Domain status retrieved: ${domain}`);
            return {
                success: true,
                ...data
            };

        } catch (error) {
            console.error('❌ [DomainService] Failed to get domain status:', error);
            return {
                success: false,
                domain,
                error: error instanceof Error ? error.message : 'Unknown error',
                details: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // ========================================================================
    // REGISTER DOMAIN WITH ICP CUSTOM DOMAINS API
    // ========================================================================
    // Uses the new ICP Custom Domains API to register a domain.
    // Requires DNS records to be configured correctly:
    // - CNAME: domain → {domain}.icp1.io
    // - TXT: _canister-id.{domain} → canister ID
    // - CNAME: _acme-challenge.{domain} → _acme-challenge.{domain}.icp2.io

    public async registerWithICP(domain: string): Promise<{
        success: boolean;
        message?: string;
        domain?: string;
        registrationStatus?: string;
        executionTimeMs?: number;
        error?: string;
    }> {
        try {
            console.log(`🌐 [DomainService] Registering domain with ICP Custom Domains API: ${domain}`);

            const response = await fetch(`${this.baseUrl}/api/domains/ic/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    domain
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || `ICP registration failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ [DomainService] ICP registration completed: ${domain}`);
            return {
                success: true,
                ...data
            };

        } catch (error) {
            console.error('❌ [DomainService] ICP registration failed:', error);
            return {
                success: false,
                domain,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // ========================================================================
    // GET ICP DOMAIN REGISTRATION STATUS
    // ========================================================================

    public async getICPRegistrationStatus(domain: string): Promise<{
        success: boolean;
        domain?: string;
        canisterId?: string | null;
        registrationStatus?: 'registering' | 'registered' | 'failed' | 'expired' | 'unknown';
        message?: string;
        data?: any;
        error?: string;
    }> {
        try {
            console.log(`📊 [DomainService] Checking ICP registration status: ${domain}`);

            const encodedDomain = encodeURIComponent(domain);
            const response = await fetch(`${this.baseUrl}/api/domains/ic/status/${encodedDomain}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to get registration status: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ [DomainService] Registration status retrieved: ${domain}`);
            return {
                success: true,
                ...data
            };

        } catch (error) {
            console.error('❌ [DomainService] Failed to get registration status:', error);
            return {
                success: false,
                domain,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // ========================================================================
    // VALIDATE DOMAIN WITH ICP (BEFORE REGISTRATION)
    // ========================================================================

    public async validateWithICP(domain: string): Promise<{
        success: boolean;
        validated?: boolean;
        validationStatus?: string;
        errors?: string[];
        error?: string;
    }> {
        try {
            console.log(`🔍 [DomainService] Validating domain with ICP: ${domain}`);

            const response = await fetch(
                `${this.baseUrl}/api/domains/ic/validate/${encodeURIComponent(domain)}`,
                {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Validation failed: ${response.status}`);
            }

            const data = await response.json();
            console.log(`✅ [DomainService] ICP validation result:`, data);
            
            return {
                success: true,
                validated: data.validated || (data.validationStatus === 'valid'),
                validationStatus: data.validationStatus,
                errors: data.errors
            };

        } catch (error) {
            console.error('❌ [DomainService] ICP validation failed:', error);
            return {
                success: false,
                validated: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // ========================================================================
    // CHECK DNS PROPAGATION STATUS (CNAME RECORDS FOR ICP CUSTOM DOMAINS)
    // ========================================================================
    // For ICP Custom Domains API, we check for CNAME records pointing to .icp1.io
    // instead of A/AAAA records pointing to IP addresses.

    public async checkDNSPropagation(domain: string, expectedCNAME?: string, expectedIP?: string): Promise<{
        success: boolean;
        domain?: string;
        propagated?: boolean;
        currentIP?: string;
        currentCNAME?: string;
        expectedIP?: string;
        expectedCNAME?: string;
        error?: string;
        recordType?: 'CNAME' | 'A' | 'NONE';
        dnsStatus?: number; // DNS response status code (0 = success, 3 = NXDOMAIN, etc.)
    }> {
        try {
            console.log(`🔍 [DomainService] Checking DNS propagation for: ${domain} (ICP Custom Domains)`);

            // Check both CNAME and A records to support both old and new approaches
            let cnameData: any = null;
            let aData: any = null;
            
            // First, try to check CNAME record (new ICP Custom Domains approach)
            try {
                const cnameParams = new URLSearchParams({ domain });
                if (expectedCNAME) {
                    cnameParams.append('expectedCNAME', expectedCNAME);
                }
                // Note: Backend may need to support type parameter for CNAME checks
                const cnameResponse = await fetch(`${this.baseUrl}/api/domains/test-dns/${encodeURIComponent(domain)}?${cnameParams.toString()}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (cnameResponse.ok) {
                    cnameData = await cnameResponse.json();
                }
            } catch (e) {
                console.warn('CNAME check failed, will check A record:', e);
            }
            
            // Also check A record (legacy approach)
            try {
                const aParams = new URLSearchParams({ domain });
                if (expectedIP) {
                    aParams.append('expectedIP', expectedIP);
                }
                const aResponse = await fetch(`${this.baseUrl}/api/domains/test-dns/${encodeURIComponent(domain)}?${aParams.toString()}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (aResponse.ok) {
                    aData = await aResponse.json();
                }
            } catch (e) {
                console.warn('A record check failed:', e);
            }

            // Use the data we got (prefer CNAME data if available)
            const data = cnameData || aData;
            if (!data) {
                throw new Error('Failed to check DNS records');
            }
            
            // Parse DNS response
            const dnsStatus = data.test?.status ?? data.parsing?.status ?? data.status;
            const hasAnswer = (data.test?.answerCount ?? data.parsing?.answerCount ?? 0) > 0;
            
            // DNS Status codes:
            // 0 = Success (NOERROR)
            // 3 = NXDOMAIN (domain doesn't exist - no DNS records configured)
            // Other codes = various errors
            
            // Extract CNAME and IP from response
            let currentCNAME: string | null = null;
            let currentIP: string | null = null;
            let recordType: 'CNAME' | 'A' | 'NONE' = 'NONE';
            
            if (hasAnswer && data.test?.firstAnswer) {
                const answer = data.test.firstAnswer;
                if (answer.type === 5) { // CNAME record
                    currentCNAME = answer.data || null;
                    recordType = 'CNAME';
                } else if (answer.type === 1) { // A record
                    currentIP = answer.data || null;
                    recordType = 'A';
                }
            } else if (hasAnswer && data.test?.firstAnswerData) {
                const answerType = data.test?.firstAnswerType;
                if (answerType === 5) {
                    currentCNAME = data.test.firstAnswerData;
                    recordType = 'CNAME';
                } else if (answerType === 1) {
                    currentIP = data.test.firstAnswerData;
                    recordType = 'A';
                } else {
                    // If it looks like a domain (contains dots and no numbers), treat as CNAME
                    // Otherwise treat as IP
                    const dataStr = String(data.test.firstAnswerData);
                    if (dataStr.includes('.') && !/^\d+\.\d+\.\d+\.\d+$/.test(dataStr) && !dataStr.includes(':')) {
                        currentCNAME = dataStr;
                        recordType = 'CNAME';
                    } else {
                        currentIP = dataStr;
                        recordType = 'A';
                    }
                }
            }
            
            // Determine if DNS has propagated
            let propagated = false;
            let dnsError: string | undefined = undefined;
            
            if (dnsStatus === 3) {
                // NXDOMAIN - domain exists but no DNS records configured yet
                dnsError = 'No DNS records found. Please configure DNS records for this domain.';
                propagated = false;
            } else if (dnsStatus === 0 && hasAnswer) {
                // Success - check if records match expected values
                if (expectedCNAME && currentCNAME) {
                    // Check if CNAME matches expected (case-insensitive, remove trailing dots)
                    const normalizedCurrent = currentCNAME.toLowerCase().replace(/\.$/, '');
                    const normalizedExpected = expectedCNAME.toLowerCase().replace(/\.$/, '');
                    propagated = normalizedCurrent === normalizedExpected;
                    if (!propagated) {
                        dnsError = `DNS record found but doesn't match expected value. Current: ${currentCNAME}, Expected: ${expectedCNAME}`;
                    }
                } else if (expectedIP && currentIP) {
                    // Legacy: Compare with expected IP
                    propagated = currentIP === expectedIP;
                    if (!propagated) {
                        dnsError = `DNS record found but doesn't match expected value. Current: ${currentIP}, Expected: ${expectedIP}`;
                    }
                } else if (currentCNAME) {
                    // CNAME exists (even if no expected value to compare)
                    propagated = true;
                } else if (currentIP) {
                    // A record exists (legacy, but still counts as propagated)
                    propagated = true;
                }
            } else if (dnsStatus !== 0) {
                // Other DNS errors
                dnsError = `DNS query failed with status code ${dnsStatus}`;
                propagated = false;
            }
            
            console.log(`✅ [DomainService] DNS check completed: ${domain} - Status: ${dnsStatus}, Type: ${recordType}, CNAME: ${currentCNAME || 'N/A'}, IP: ${currentIP || 'N/A'}, Propagated: ${propagated}${dnsError ? `, Error: ${dnsError}` : ''}`);
            
            return {
                success: true,
                domain,
                propagated,
                currentIP: currentIP || undefined,
                currentCNAME: currentCNAME || undefined,
                expectedIP: expectedIP || data.test?.expectedIP || undefined,
                expectedCNAME: expectedCNAME || undefined,
                recordType,
                error: dnsError,
                dnsStatus: dnsStatus
            };

        } catch (error) {
            console.error('❌ [DomainService] DNS propagation check failed:', error);
            return {
                success: false,
                domain,
                propagated: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // ========================================================================
    // CHECK CLOUDFLARE CONFIGURATION STATUS
    // ========================================================================

    public async getCloudflareStatus(): Promise<{
        success: boolean;
        configured?: boolean;
        enabled?: boolean;
        hasApiToken?: boolean;
        hasZoneId?: boolean;
        hasAccountId?: boolean;
        error?: string;
    }> {
        try {
            console.log(`☁️ [DomainService] Checking Cloudflare configuration status...`);

            const response = await fetch(`${this.baseUrl}/api/domains/cloudflare/status`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to get Cloudflare status: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ [DomainService] Cloudflare status retrieved`);
            return {
                success: true,
                ...data
            };

        } catch (error) {
            console.error('❌ [DomainService] Failed to get Cloudflare status:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // ========================================================================
    // CONFIGURE CLOUDFLARE SETTINGS
    // ========================================================================

    public async configureCloudflare(config: {
        apiToken: string;
        zoneId: string;
        accountId: string;
        enabled?: boolean;
    }): Promise<{
        success: boolean;
        message?: string;
        configured?: boolean;
        enabled?: boolean;
        error?: string;
    }> {
        try {
            console.log(`☁️ [DomainService] Configuring Cloudflare settings...`);

            const response = await fetch(`${this.baseUrl}/api/domains/configure-cloudflare`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to configure Cloudflare: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ [DomainService] Cloudflare configured successfully`);
            return {
                success: true,
                ...data
            };

        } catch (error) {
            console.error('❌ [DomainService] Failed to configure Cloudflare:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const domainService = new DomainService();
