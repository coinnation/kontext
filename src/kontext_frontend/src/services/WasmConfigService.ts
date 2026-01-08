import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory } from '../../candid/kontext_backend.did.js';
import { _SERVICE } from '../../candid/kontext_backend.did';

/**
 * Centralized Remote Files Configuration Service
 * Fetches remote file storage configuration from platform canister
 * Includes WASMs, prompts, rules, and other remotely stored files
 * Eliminates hardcoded asset canister URLs
 */

interface RemoteFilesConfig {
    assetCanisterId: string;
    basePath: string;
    userCanisterWasm: string;
    assetStorageWasm: string;
    agentWasm: string;
    agentWasmGz: string;
    agencyWasm: string;
    agencyWasmGz: string;
    backendPrompt: string;
    frontendPrompt: string;
    backendRules: string;
    frontendRules: string;
}

class WasmConfigServiceClass {
    private config: RemoteFilesConfig | null = null;
    private configPromise: Promise<RemoteFilesConfig> | null = null;
    private platformActor: _SERVICE | null = null;

    /**
     * Initialize platform actor
     */
    private async getPlatformActor(): Promise<_SERVICE> {
        if (this.platformActor) {
            return this.platformActor;
        }

        const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://127.0.0.1:4943'
            : 'https://icp0.io';

        const agent = new HttpAgent({ host });

        if (host.includes('localhost') || host.includes('127.0.0.1')) {
            await agent.fetchRootKey();
        }

        this.platformActor = Actor.createActor<_SERVICE>(idlFactory, {
            agent,
            canisterId: 'pkmhr-fqaaa-aaaaa-qcfeq-cai' // Platform canister
        });

        return this.platformActor;
    }

    /**
     * Fetch remote files configuration from platform canister
     */
    private async fetchConfig(): Promise<RemoteFilesConfig> {
        console.log('🔧 [RemoteFilesConfig] Fetching remote files configuration from platform...');
        
        const actor = await this.getPlatformActor();
        const config = await actor.getRemoteFilesConfig();

        const remoteConfig: RemoteFilesConfig = {
            assetCanisterId: config.assetCanisterId,
            basePath: config.basePath,
            userCanisterWasm: config.userCanisterWasm,
            assetStorageWasm: config.assetStorageWasm,
            agentWasm: config.agentWasm,
            agentWasmGz: config.agentWasmGz,
            agencyWasm: config.agencyWasm,
            agencyWasmGz: config.agencyWasmGz,
            backendPrompt: config.backendPrompt,
            frontendPrompt: config.frontendPrompt,
            backendRules: config.backendRules,
            frontendRules: config.frontendRules
        };

        console.log('✅ [RemoteFilesConfig] Configuration loaded:', remoteConfig);
        this.config = remoteConfig;
        return remoteConfig;
    }

    /**
     * Get remote files configuration (with caching)
     */
    public async getConfig(): Promise<RemoteFilesConfig> {
        if (this.config) {
            return this.config;
        }

        // If already fetching, return existing promise
        if (this.configPromise) {
            return this.configPromise;
        }

        // Start fetching
        this.configPromise = this.fetchConfig();
        
        try {
            const config = await this.configPromise;
            return config;
        } finally {
            this.configPromise = null;
        }
    }

    /**
     * Construct full file URL
     */
    private buildFileUrl(assetCanisterId: string, basePath: string, filePath: string): string {
        return `https://${assetCanisterId}.raw.icp0.io/${basePath}/${filePath}`;
    }

    /**
     * Get User Canister WASM URL
     */
    public async getUserCanisterWasmUrl(): Promise<string> {
        const config = await this.getConfig();
        return this.buildFileUrl(config.assetCanisterId, config.basePath, config.userCanisterWasm);
    }

    /**
     * Get Asset Storage WASM URL
     */
    public async getAssetStorageWasmUrl(): Promise<string> {
        const config = await this.getConfig();
        return this.buildFileUrl(config.assetCanisterId, config.basePath, config.assetStorageWasm);
    }

    /**
     * Get Agent WASM URLs (both compressed and uncompressed)
     */
    public async getAgentWasmUrls(): Promise<string[]> {
        const config = await this.getConfig();
        return [
            this.buildFileUrl(config.assetCanisterId, config.basePath, config.agentWasmGz),
            this.buildFileUrl(config.assetCanisterId, config.basePath, config.agentWasm)
        ];
    }

    /**
     * Get Agency Workflow WASM URLs (both compressed and uncompressed)
     */
    public async getAgencyWasmUrls(): Promise<string[]> {
        const config = await this.getConfig();
        return [
            this.buildFileUrl(config.assetCanisterId, config.basePath, config.agencyWasmGz),
            this.buildFileUrl(config.assetCanisterId, config.basePath, config.agencyWasm)
        ];
    }

    /**
     * Get Backend Prompt URL
     */
    public async getBackendPromptUrl(): Promise<string> {
        const config = await this.getConfig();
        return this.buildFileUrl(config.assetCanisterId, config.basePath, config.backendPrompt);
    }

    /**
     * Get Frontend Prompt URL
     */
    public async getFrontendPromptUrl(): Promise<string> {
        const config = await this.getConfig();
        return this.buildFileUrl(config.assetCanisterId, config.basePath, config.frontendPrompt);
    }

    /**
     * Get Backend Rules URL
     */
    public async getBackendRulesUrl(): Promise<string> {
        const config = await this.getConfig();
        return this.buildFileUrl(config.assetCanisterId, config.basePath, config.backendRules);
    }

    /**
     * Get Frontend Rules URL
     */
    public async getFrontendRulesUrl(): Promise<string> {
        const config = await this.getConfig();
        return this.buildFileUrl(config.assetCanisterId, config.basePath, config.frontendRules);
    }

    /**
     * Get asset canister ID (for direct uploads)
     */
    public async getAssetCanisterId(): Promise<string> {
        const config = await this.getConfig();
        return config.assetCanisterId;
    }

    /**
     * Get base path for WASM files
     */
    public async getBasePath(): Promise<string> {
        const config = await this.getConfig();
        return config.basePath;
    }

    /**
     * Clear cached configuration (force reload)
     */
    public clearCache(): void {
        this.config = null;
        console.log('🔄 [RemoteFilesConfig] Cache cleared, will reload on next request');
    }
}

// Export singleton instance
export const wasmConfigService = new WasmConfigServiceClass();

