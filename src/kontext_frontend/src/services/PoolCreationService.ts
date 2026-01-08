import { Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { PlatformCanisterService } from './PlatformCanisterService';
import { wasmConfigService } from './WasmConfigService';

/**
 * Service for creating pre-deployed canisters/pairs for the pool
 * Handles the full workflow: Create → Deploy WASM → Add to Pool
 */

export type PoolItemType = 'UserCanister' | 'RegularServerPair' | 'AgentServerPair' | 'AgencyWorkflowPair';

interface CreationResult {
    success: boolean;
    canisterId?: string;
    frontendCanisterId?: string;
    backendCanisterId?: string;
    pairId?: string;
    error?: string;
}

export class PoolCreationService {
    constructor(private identity: Identity, private mainActor: any) {}

    /**
     * Create a User Canister and add to pool
     */
    async createUserCanisterForPool(
        name: string,
        memoryGB: number,
        durationDays: number,
        progressCallback?: (status: string) => void
    ): Promise<CreationResult> {
        try {
            progressCallback?.('Creating user canister...');
            
            // Import services
            const { userCanisterService } = await import('./UserCanisterService');
            const platformService = PlatformCanisterService.createWithIdentity(this.identity);

            // Step 1: Create canister with cycles
            progressCallback?.('Allocating resources...');
            const cyclesAmount = this.calculateCyclesNeeded(memoryGB, durationDays);
            
            // Use platform to create canister
            const userPrincipal = this.identity.getPrincipal();
            const createResult = await this.mainActor.createCanisterWithSettings(
                userPrincipal,
                memoryGB,
                0, // computeAllocation
                2592000, // freezingThreshold (30 days)
                durationDays,
                cyclesAmount
            );

            let canisterId: string;
            if ('ok' in createResult) {
                canisterId = createResult.ok;
            } else if ('Ok' in createResult) {
                canisterId = createResult.Ok;
            } else {
                throw new Error('Failed to create canister: ' + JSON.stringify(createResult));
            }

            const canisterPrincipal = Principal.fromText(canisterId);

            // Step 2: Deploy User Canister WASM
            progressCallback?.('Deploying user canister WASM...');
            await this.deployUserCanisterWasm(canisterPrincipal);

            // Step 3: Add to pool
            progressCallback?.('Adding to pool...');
            const addResult = await platformService.addUserCanisterToPool(
                canisterPrincipal,
                memoryGB,
                durationDays,
                [['name', name], ['created_by_admin', 'true']]
            );

            if ('ok' in addResult) {
                return {
                    success: true,
                    canisterId: canisterId
                };
            } else {
                throw new Error('Failed to add to pool: ' + addResult.err);
            }

        } catch (error) {
            console.error('Error creating user canister for pool:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Create a Server Pair and add to pool
     */
    async createServerPairForPool(
        type: 'RegularServerPair' | 'AgentServerPair' | 'AgencyWorkflowPair',
        name: string,
        memoryGB: number,
        durationDays: number,
        progressCallback?: (status: string) => void
    ): Promise<CreationResult> {
        try {
            progressCallback?.('Creating server pair...');
            
            const { userCanisterService } = await import('./UserCanisterService');
            const platformService = PlatformCanisterService.createWithIdentity(this.identity);
            const userPrincipal = this.identity.getPrincipal();

            const cyclesPerCanister = this.calculateCyclesNeeded(memoryGB, durationDays);

            // Step 1: Create Frontend Canister
            progressCallback?.('Creating frontend canister...');
            const frontendResult = await this.mainActor.createCanisterWithSettings(
                userPrincipal,
                memoryGB,
                0,
                2592000,
                durationDays,
                cyclesPerCanister
            );

            let frontendCanisterId: string;
            if ('ok' in frontendResult) {
                frontendCanisterId = frontendResult.ok;
            } else if ('Ok' in frontendResult) {
                frontendCanisterId = frontendResult.Ok;
            } else {
                throw new Error('Failed to create frontend canister');
            }

            // Step 2: Create Backend Canister
            progressCallback?.('Creating backend canister...');
            const backendResult = await this.mainActor.createCanisterWithSettings(
                userPrincipal,
                memoryGB,
                0,
                2592000,
                durationDays,
                cyclesPerCanister
            );

            let backendCanisterId: string;
            if ('ok' in backendResult) {
                backendCanisterId = backendResult.ok;
            } else if ('Ok' in backendResult) {
                backendCanisterId = backendResult.Ok;
            } else {
                throw new Error('Failed to create backend canister');
            }

            const frontendPrincipal = Principal.fromText(frontendCanisterId);
            const backendPrincipal = Principal.fromText(backendCanisterId);

            // Step 3: Deploy WASMs based on type
            progressCallback?.('Deploying WASMs...');
            await this.deployServerPairWasms(type, frontendPrincipal, backendPrincipal);

            // Step 4: Generate pair ID
            const pairId = `${type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Step 5: Add to pool
            progressCallback?.('Adding to pool...');
            const poolTypeVariant = { [type]: null };
            const addResult = await platformService.addServerPairToPool(
                pairId,
                frontendPrincipal,
                backendPrincipal,
                poolTypeVariant,
                [
                    ['name', name],
                    ['type', type],
                    ['created_by_admin', 'true'],
                    ['wasm_deployed', 'true']
                ]
            );

            if ('ok' in addResult) {
                return {
                    success: true,
                    pairId: pairId,
                    frontendCanisterId: frontendCanisterId,
                    backendCanisterId: backendCanisterId
                };
            } else {
                throw new Error('Failed to add to pool: ' + addResult.err);
            }

        } catch (error) {
            console.error('Error creating server pair for pool:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Deploy User Canister WASM
     */
    private async deployUserCanisterWasm(canisterId: Principal): Promise<void> {
        console.log('📥 [PoolCreation] Deploying user canister WASM to:', canisterId.toString());
        
        try {
            // Get WASM URL from configuration
            const wasmUrl = await wasmConfigService.getUserCanisterWasmUrl();
            console.log('📥 [PoolCreation] Fetching user canister WASM from:', wasmUrl);
            
            // Fetch WASM
            const response = await fetch(wasmUrl, {
                headers: {
                    'Accept': 'application/wasm',
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const wasmBytes = Array.from(new Uint8Array(arrayBuffer));
            console.log(`✅ [PoolCreation] User canister WASM downloaded: ${(wasmBytes.length / 1024).toFixed(1)} KB`);

            // Deploy via platform canister
            const { userCanisterService } = await import('./UserCanisterService');
            const userActor = await userCanisterService.getUserActor(this.mainActor.canisterId, this.identity);
            
            const installResult = await userActor.deployToExistingCanister(
                canisterId,
                wasmBytes,
                'backend',
                'user_canister',
                this.identity.getPrincipal(),
                [],
                [],
                ['install']
            );

            if ('Err' in installResult || 'err' in installResult) {
                throw new Error('Failed to install WASM: ' + JSON.stringify(installResult));
            }

            console.log('✅ [PoolCreation] User canister WASM deployed successfully');
        } catch (error) {
            console.error('❌ [PoolCreation] Failed to deploy user canister WASM:', error);
            throw error;
        }
    }

    /**
     * Deploy Server Pair WASMs based on type
     */
    private async deployServerPairWasms(
        type: 'RegularServerPair' | 'AgentServerPair' | 'AgencyWorkflowPair',
        frontendCanisterId: Principal,
        backendCanisterId: Principal
    ): Promise<void> {
        console.log(`Deploying ${type} WASMs to:`, {
            frontend: frontendCanisterId.toString(),
            backend: backendCanisterId.toString()
        });

        switch (type) {
            case 'RegularServerPair':
                // Deploy bare backend + asset storage frontend
                await this.deployRegularPairWasms(frontendCanisterId, backendCanisterId);
                break;
            case 'AgentServerPair':
                // Deploy agent backend + agent frontend
                await this.deployAgentPairWasms(frontendCanisterId, backendCanisterId);
                break;
            case 'AgencyWorkflowPair':
                // Deploy workflow backend + workflow frontend
                await this.deployWorkflowPairWasms(frontendCanisterId, backendCanisterId);
                break;
        }
    }

    private async deployRegularPairWasms(frontendId: Principal, backendId: Principal): Promise<void> {
        console.log('📥 [PoolCreation] Deploying Regular Server Pair WASMs');
        
        try {
            const { userCanisterService } = await import('./UserCanisterService');
            
            // Deploy frontend (Asset Storage)
            console.log('📥 [PoolCreation] Deploying asset storage to frontend:', frontendId.toString());
            const assetWasmUrl = await wasmConfigService.getAssetStorageWasmUrl();
            
            const assetResponse = await fetch(assetWasmUrl, {
                headers: { 'Accept': 'application/octet-stream' }
            });

            if (!assetResponse.ok) {
                throw new Error(`Failed to fetch asset storage WASM: ${assetResponse.status}`);
            }

            const assetArrayBuffer = await assetResponse.arrayBuffer();
            const assetWasmBytes = Array.from(new Uint8Array(assetArrayBuffer));
            console.log(`✅ [PoolCreation] Asset storage WASM downloaded: ${(assetWasmBytes.length / 1024).toFixed(1)} KB`);

            // Deploy to frontend canister
            await userCanisterService.deployWasmToCanister(
                frontendId,
                assetWasmBytes,
                'frontend',
                this.identity,
                this.mainActor.canisterId
            );

            console.log('✅ [PoolCreation] Regular pair WASMs deployed successfully');
            
            // Note: Backend stays empty/bare - gets project-specific WASM during user deployment
        } catch (error) {
            console.error('❌ [PoolCreation] Failed to deploy regular pair WASMs:', error);
            throw error;
        }
    }

    private async deployAgentPairWasms(frontendId: Principal, backendId: Principal): Promise<void> {
        console.log('📥 [PoolCreation] Deploying Agent Server Pair WASMs');
        
        try {
            const { userCanisterService } = await import('./UserCanisterService');
            
            // Deploy backend (Agent Runtime)
            console.log('📥 [PoolCreation] Deploying agent runtime to backend:', backendId.toString());
            const agentWasmUrls = await wasmConfigService.getAgentWasmUrls();
            
            let agentWasmBytes: number[] = [];
            let lastError: Error | null = null;

            // Try each URL (compressed first, then uncompressed)
            for (const url of agentWasmUrls) {
                try {
                    console.log('📥 [PoolCreation] Trying agent WASM URL:', url);
                    const response = await fetch(url, {
                        headers: { 'Accept': 'application/octet-stream' }
                    });

                    if (response.ok) {
                        const arrayBuffer = await response.arrayBuffer();
                        agentWasmBytes = Array.from(new Uint8Array(arrayBuffer));
                        console.log(`✅ [PoolCreation] Agent WASM downloaded: ${(agentWasmBytes.length / 1024).toFixed(1)} KB`);
                        break;
                    }
                } catch (error) {
                    lastError = error instanceof Error ? error : new Error('Unknown error');
                    console.warn('⚠️ [PoolCreation] Failed to fetch from', url);
                }
            }

            if (agentWasmBytes.length === 0) {
                throw lastError || new Error('Failed to fetch agent WASM from any URL');
            }

            // Deploy to backend canister
            await userCanisterService.deployWasmToCanister(
                backendId,
                agentWasmBytes,
                'backend',
                this.identity,
                this.mainActor.canisterId
            );

            // Deploy frontend (Asset Storage)
            console.log('📥 [PoolCreation] Deploying asset storage to frontend:', frontendId.toString());
            const assetWasmUrl = await wasmConfigService.getAssetStorageWasmUrl();
            const assetResponse = await fetch(assetWasmUrl, {
                headers: { 'Accept': 'application/octet-stream' }
            });

            if (!assetResponse.ok) {
                throw new Error(`Failed to fetch asset storage WASM: ${assetResponse.status}`);
            }

            const assetArrayBuffer = await assetResponse.arrayBuffer();
            const assetWasmBytes = Array.from(new Uint8Array(assetArrayBuffer));

            await userCanisterService.deployWasmToCanister(
                frontendId,
                assetWasmBytes,
                'frontend',
                this.identity,
                this.mainActor.canisterId
            );

            console.log('✅ [PoolCreation] Agent pair WASMs deployed successfully');
        } catch (error) {
            console.error('❌ [PoolCreation] Failed to deploy agent pair WASMs:', error);
            throw error;
        }
    }

    private async deployWorkflowPairWasms(frontendId: Principal, backendId: Principal): Promise<void> {
        console.log('📥 [PoolCreation] Deploying Agency Workflow Pair WASMs');
        
        try {
            const { userCanisterService } = await import('./UserCanisterService');
            
            // Deploy backend (Workflow Orchestrator)
            console.log('📥 [PoolCreation] Deploying workflow orchestrator to backend:', backendId.toString());
            const agencyWasmUrls = await wasmConfigService.getAgencyWasmUrls();
            
            let agencyWasmBytes: number[] = [];
            let lastError: Error | null = null;

            // Try each URL (compressed first, then uncompressed)
            for (const url of agencyWasmUrls) {
                try {
                    console.log('📥 [PoolCreation] Trying agency WASM URL:', url);
                    const response = await fetch(url, {
                        headers: { 'Accept': 'application/octet-stream' }
                    });

                    if (response.ok) {
                        const arrayBuffer = await response.arrayBuffer();
                        agencyWasmBytes = Array.from(new Uint8Array(arrayBuffer));
                        console.log(`✅ [PoolCreation] Agency WASM downloaded: ${(agencyWasmBytes.length / 1024).toFixed(1)} KB`);
                        break;
                    }
                } catch (error) {
                    lastError = error instanceof Error ? error : new Error('Unknown error');
                    console.warn('⚠️ [PoolCreation] Failed to fetch from', url);
                }
            }

            if (agencyWasmBytes.length === 0) {
                throw lastError || new Error('Failed to fetch agency WASM from any URL');
            }

            // Deploy to backend canister
            await userCanisterService.deployWasmToCanister(
                backendId,
                agencyWasmBytes,
                'backend',
                this.identity,
                this.mainActor.canisterId
            );

            // Deploy frontend (Asset Storage)
            console.log('📥 [PoolCreation] Deploying asset storage to frontend:', frontendId.toString());
            const assetWasmUrl = await wasmConfigService.getAssetStorageWasmUrl();
            const assetResponse = await fetch(assetWasmUrl, {
                headers: { 'Accept': 'application/octet-stream' }
            });

            if (!assetResponse.ok) {
                throw new Error(`Failed to fetch asset storage WASM: ${assetResponse.status}`);
            }

            const assetArrayBuffer = await assetResponse.arrayBuffer();
            const assetWasmBytes = Array.from(new Uint8Array(assetArrayBuffer));

            await userCanisterService.deployWasmToCanister(
                frontendId,
                assetWasmBytes,
                'frontend',
                this.identity,
                this.mainActor.canisterId
            );

            console.log('✅ [PoolCreation] Workflow pair WASMs deployed successfully');
        } catch (error) {
            console.error('❌ [PoolCreation] Failed to deploy workflow pair WASMs:', error);
            throw error;
        }
    }

    /**
     * Calculate cycles needed for canister
     */
    private calculateCyclesNeeded(memoryGB: number, durationDays: number): number {
        // Base calculation
        const CYCLES_PER_GB_PER_DAY = 127_000_000_000; // ~0.127T cycles per GB per day
        const CREATION_OVERHEAD = 100_000_000_000; // 0.1T for creation
        const SAFETY_BUFFER = 1.2; // 20% buffer

        const runtimeCycles = memoryGB * durationDays * CYCLES_PER_GB_PER_DAY;
        const totalCycles = (runtimeCycles + CREATION_OVERHEAD) * SAFETY_BUFFER;

        return Math.ceil(totalCycles);
    }
}

