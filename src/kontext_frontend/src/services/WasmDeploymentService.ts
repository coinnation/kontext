import { Principal } from '@dfinity/principal';
import { Actor, HttpAgent } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import { idlFactory } from '../../candid/kontext_backend.did.js';
import { _SERVICE } from '../../candid/kontext_backend.did';
import { icpData } from '../icpData';
import { getSharedAuthClient } from './SharedAuthClient';
import { wasmConfigService } from './WasmConfigService';

export interface WasmDeploymentProgress {
  percent: number;
  message: string;
  stage: 'DOWNLOADING' | 'UPLOADING' | 'DEPLOYING' | 'FINALIZING' | 'COMPLETE' | 'ERROR';
}

export type ProgressCallback = (progress: WasmDeploymentProgress) => void;

export interface WasmDeploymentResult {
  success: boolean;
  error?: string;
}

export interface UploadSession {
  sessionId: string;
  fileName: string;
  totalChunks: number;
  totalSize: number;
}

export class WasmDeploymentService {
  private actor: any = null;
  private authClient: AuthClient | null = null;
  private readonly canisterId = 'pkmhr-fqaaa-aaaaa-qcfeq-cai';
  private readonly CHUNK_SIZE = 1.9 * 1024 * 1024; // 1.9MB chunks
  private readonly SIZE_THRESHOLD = 1.5 * 1024 * 1024; // 1.5MB threshold

  constructor() {
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      // 🔥 FIX: Use shared AuthClient to prevent session logout issues
      const authClient = await getSharedAuthClient();

      // Determine host
      const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://127.0.0.1:4943'
        : 'https://icp0.io';

      // Get identity if authenticated
      let identity = null;
      if (await authClient.isAuthenticated()) {
        identity = authClient.getIdentity();
      }

      // Create agent
      const agentOptions: any = { host };
      if (identity) {
        agentOptions.identity = identity;
      }

      const agent = new HttpAgent(agentOptions);

      // Fetch root key for local development
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        await agent.fetchRootKey();
      }

      // Create actor
      const canisterActor = Actor.createActor<_SERVICE>(idlFactory, {
        agent,
        canisterId: this.canisterId,
      });

      // Auto-converting proxy for BigInt handling
      this.actor = new Proxy(canisterActor, {
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

    } catch (error) {
      console.error('WasmDeploymentService initialization failed:', error);
      throw new Error(`Service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async ensureActorReady(): Promise<void> {
    if (!this.actor) {
      await this.initializeService();
    }
    
    if (!this.actor) {
      throw new Error('Failed to initialize actor');
    }
  }

  private async fetchWasmBytes(onProgress: ProgressCallback): Promise<Uint8Array> {
    try {
      onProgress({
        percent: 25,
        message: 'Downloading user canister code...',
        stage: 'DOWNLOADING'
      });

      // Get WASM URL from configuration
      const WASM_URL = await wasmConfigService.getUserCanisterWasmUrl();
      console.log('📥 [WasmDeployment] Fetching user canister WASM from:', WASM_URL);

      const response = await fetch(WASM_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/wasm',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const wasmBytes = new Uint8Array(arrayBuffer);

      onProgress({
        percent: 35,
        message: `Downloaded ${(wasmBytes.length / (1024 * 1024)).toFixed(1)}MB of code`,
        stage: 'DOWNLOADING'
      });

      return wasmBytes;
    } catch (error) {
      onProgress({
        percent: 0,
        message: `Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'ERROR'
      });
      throw error;
    }
  }

  // Helper function to check Result type with case-insensitive matching
  private isResultOk(result: any): { isOk: boolean; value: any; error?: string } {
    if (!result || typeof result !== 'object') {
      return { isOk: false, value: null, error: 'Invalid result format' };
    }

    // Check for both uppercase and lowercase variants
    if ('Ok' in result) {
      return { isOk: true, value: result.Ok };
    }
    if ('ok' in result) {
      return { isOk: true, value: result.ok };
    }
    if ('Err' in result) {
      return { isOk: false, value: null, error: result.Err };
    }
    if ('err' in result) {
      return { isOk: false, value: null, error: result.err };
    }

    return { isOk: false, value: null, error: 'Unknown result format' };
  }

  private async deployDirectly(
    canisterId: string,
    wasmBytes: Uint8Array,
    onProgress: ProgressCallback
  ): Promise<WasmDeploymentResult> {
    try {
      onProgress({
        percent: 85,
        message: 'Deploying directly to your canister...',
        stage: 'DEPLOYING'
      });

      const canisterPrincipal = Principal.fromText(canisterId);
      const wasmArray = Array.from(wasmBytes);

      const result = await this.actor.deployToExistingCanister(canisterPrincipal, wasmArray);

      const resultCheck = this.isResultOk(result);
      if (resultCheck.isOk) {
        onProgress({
          percent: 100,
          message: 'Deployment complete!',
          stage: 'COMPLETE'
        });
        return { success: true };
      } else {
        const errorMsg = resultCheck.error || 'Unknown deployment error';
        onProgress({
          percent: 0,
          message: `Deployment failed: ${errorMsg}`,
          stage: 'ERROR'
        });
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      onProgress({
        percent: 0,
        message: `Deployment failed: ${errorMsg}`,
        stage: 'ERROR'
      });
      return { success: false, error: errorMsg };
    }
  }

  private async deployWithChunking(
    canisterId: string,
    wasmBytes: Uint8Array,
    userPrincipal: Principal,
    onProgress: ProgressCallback
  ): Promise<WasmDeploymentResult> {
    try {
      // Calculate chunking parameters
      const totalChunks = Math.ceil(wasmBytes.length / this.CHUNK_SIZE);
      const fileName = `user-${Date.now()}.wasm`;

      onProgress({
        percent: 40,
        message: `Preparing ${totalChunks} chunks for upload...`,
        stage: 'UPLOADING'
      });

      // Start upload session
      console.log('🚀 [WasmDeploymentService] Starting upload session...');
      const sessionResult = await this.actor.startWasmUploadSession(fileName, totalChunks, wasmBytes.length);
      console.log('📤 [WasmDeploymentService] Session result:', sessionResult);
      
      const sessionCheck = this.isResultOk(sessionResult);
      if (!sessionCheck.isOk) {
        const errorMsg = sessionCheck.error || 'Failed to start upload session';
        console.error('❌ [WasmDeploymentService] Session start failed:', errorMsg);
        throw new Error(errorMsg);
      }

      const sessionId = sessionCheck.value;
      console.log('✅ [WasmDeploymentService] Session ID:', sessionId);

      // Upload chunks with progress tracking
      for (let i = 0; i < totalChunks; i++) {
        const start = i * this.CHUNK_SIZE;
        const end = Math.min(start + this.CHUNK_SIZE, wasmBytes.length);
        const chunk = wasmBytes.slice(start, end);

        console.log(`📦 [WasmDeploymentService] Uploading chunk ${i + 1}/${totalChunks} (${chunk.length} bytes)`);
        const chunkResult = await this.actor.uploadWasmChunk(sessionId, i, Array.from(chunk));
        console.log(`📤 [WasmDeploymentService] Chunk ${i + 1} result:`, chunkResult);
        
        const chunkCheck = this.isResultOk(chunkResult);
        if (!chunkCheck.isOk) {
          const errorMsg = chunkCheck.error || `Failed to upload chunk ${i + 1}`;
          console.error(`❌ [WasmDeploymentService] Chunk ${i + 1} failed:`, errorMsg);
          throw new Error(errorMsg);
        }

        // Progress calculation: 40% + (40% * (i + 1) / totalChunks)
        const uploadProgress = 40 + Math.floor(40 * (i + 1) / totalChunks);
        onProgress({
          percent: uploadProgress,
          message: `Uploaded chunk ${i + 1} of ${totalChunks} (${((i + 1) / totalChunks * 100).toFixed(0)}%)`,
          stage: 'UPLOADING'
        });
      }

      // Finalize upload
      onProgress({
        percent: 82,
        message: 'Finalizing upload...',
        stage: 'FINALIZING'
      });

      console.log('🏁 [WasmDeploymentService] Finalizing upload session...');
      const finalizeResult = await this.actor.finalizeWasmUpload(sessionId);
      console.log('📤 [WasmDeploymentService] Finalize result:', finalizeResult);
      
      const finalizeCheck = this.isResultOk(finalizeResult);
      if (!finalizeCheck.isOk) {
        const errorMsg = finalizeCheck.error || 'Failed to finalize upload';
        console.error('❌ [WasmDeploymentService] Finalize failed:', errorMsg);
        throw new Error(errorMsg);
      }

      // Deploy stored WASM
      onProgress({
        percent: 90,
        message: 'Deploying to your canister...',
        stage: 'DEPLOYING'
      });

      const canisterPrincipal = Principal.fromText(canisterId);
      console.log('🚀 [WasmDeploymentService] Deploying stored WASM...');
      const deployResult = await this.actor.deployStoredWasm(fileName, canisterPrincipal, userPrincipal);
      console.log('📤 [WasmDeploymentService] Deploy result:', deployResult);
      
      const deployCheck = this.isResultOk(deployResult);
      if (deployCheck.isOk) {
        onProgress({
          percent: 100,
          message: 'Deployment complete!',
          stage: 'COMPLETE'
        });
        console.log('✅ [WasmDeploymentService] Deployment successful!');
        return { success: true };
      } else {
        const errorMsg = deployCheck.error || 'Deployment failed';
        console.error('❌ [WasmDeploymentService] Deploy failed:', errorMsg);
        throw new Error(errorMsg);
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [WasmDeploymentService] Chunked deployment failed:', error);
      onProgress({
        percent: 0,
        message: `Chunked deployment failed: ${errorMsg}`,
        stage: 'ERROR'
      });
      return { success: false, error: errorMsg };
    }
  }

  async deployWasm(
    canisterId: string,
    userPrincipal: Principal,
    onProgress: ProgressCallback
  ): Promise<WasmDeploymentResult> {
    try {
      await this.ensureActorReady();

      // Step 1: Download WASM
      const wasmBytes = await this.fetchWasmBytes(onProgress);

      // Step 2: Choose deployment method based on size
      if (wasmBytes.length <= this.SIZE_THRESHOLD) {
        console.log('📦 [WasmDeploymentService] Using direct deployment (small file)');
        return await this.deployDirectly(canisterId, wasmBytes, onProgress);
      } else {
        console.log('📦 [WasmDeploymentService] Using chunked deployment (large file)');
        return await this.deployWithChunking(canisterId, wasmBytes, userPrincipal, onProgress);
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [WasmDeploymentService] WASM deployment failed:', error);
      onProgress({
        percent: 0,
        message: `WASM deployment failed: ${errorMsg}`,
        stage: 'ERROR'
      });
      return { success: false, error: errorMsg };
    }
  }

  // Method to refresh actor with new identity (after re-authentication)
  // 🔥 FIX: No longer needed since we use shared AuthClient, but keeping for compatibility
  async refreshActor(authClient?: AuthClient): Promise<void> {
    // Shared auth client is always up to date, just reinitialize the service
    await this.initializeService();
  }
}

// Singleton instance
export const wasmDeploymentService = new WasmDeploymentService();