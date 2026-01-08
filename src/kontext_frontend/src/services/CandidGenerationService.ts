export interface CandidGenerationRequest {
  files: Array<{ name: string; content: string }>;
  packages: Array<{ name: string; repo: string; version: string; }>;
  mainFile: string;
}

export interface CandidGenerationResponse {
  success: boolean;
  candid?: string;
  typescript?: string;
  didJs?: string;
  jsonSchema?: string;
  wasm?: string; // 🚀 NEW: Base64-encoded WASM from /compile endpoint
  error?: string;
}

export interface CandidMethodSignature {
  name: string;
  signature: string;
}

class CandidGenerationServiceClass {
  private readonly DFXUTILS_BASE_URL = 'https://dfxutils.coinnation.io';
  private readonly COMPILE_ENDPOINT = '/compile'; // 🚀 Changed to /compile for more reliable extraction

  async generateCandidArtifacts(request: CandidGenerationRequest): Promise<CandidGenerationResponse> {
    try {
      // 🚀 PERFORMANCE: Use /compile endpoint for more reliable Candid extraction
      // This compiles to WASM first, then extracts Candid from compiled metadata
      // More reliable than /generateCandidAndArtifacts which falls back to regex parsing
      
      const response = await fetch(`${this.DFXUTILS_BASE_URL}${this.COMPILE_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Note: /compile endpoint only needs 'files' array (no packages or mainFile)
        body: JSON.stringify({
          files: request.files
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Candid compilation failed: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      
      // The /compile endpoint returns artifacts directly (no 'success' wrapper)
      if (!result.candid) {
        throw new Error('Compilation succeeded but no Candid interface was generated');
      }

      return {
        success: true,
        candid: result.candid,
        typescript: result.typescript,
        didJs: result.didJs,
        jsonSchema: result.jsonSchema,
        wasm: result.wasm, // 🚀 NEW: Include WASM base64 for caching
      };
      
    } catch (error) {
      console.error('❌ [CandidGeneration] Compilation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  extractMethodSignatures(candidInterface: string): CandidMethodSignature[] {
    try {
      const methods: CandidMethodSignature[] = [];
      
      const methodRegex = /(\w+)\s*:\s*([^;]+);/g;
      let match;
      
      while ((match = methodRegex.exec(candidInterface)) !== null) {
        methods.push({
          name: match[1],
          signature: match[2].trim(),
        });
      }
      
      return methods;
    } catch (error) {
      console.warn('Failed to extract method signatures from Candid:', error);
      return [];
    }
  }
}

export const CandidGenerationService = new CandidGenerationServiceClass();