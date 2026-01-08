import { Identity } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import { userCanisterService } from './UserCanisterService';
import { CanisterMethodDiscovery, CanisterMethodInfo } from '../components/database/services/CanisterMethodDiscovery';
import { DynamicCanisterService } from '../components/database/shared/services/DynamicCanisterService';
import { useAppStore } from '../store/appStore';

export interface CanisterMethodDocumentation {
  name: string;
  type: 'query' | 'update';
  description: string;
  parameters: Array<{ 
    name: string; 
    type: string; 
    candidType: string; // Full Candid type string
    required: boolean;
  }>;
  returns: { 
    type: string;
    candidType: string; // Full Candid return type
  };
  candidSignature: string; // Exact Candid signature
  example: string;
}

export interface CandidDiscoveryResult {
  methodInfo: CanisterMethodInfo;
  methodDocs: CanisterMethodDocumentation[];
  candidContent: string;
  rawDidContent?: string; // Raw .did file content for parsing
}

export class AgentContextualAwarenessService {
  /**
   * Discover backend canister methods for a project
   */
  static async discoverProjectCanisterMethods(
    projectId: string,
    backendCanisterId: string,
    identity: Identity
  ): Promise<CandidDiscoveryResult> {
    console.log(`🔍 [AgentContextualAwareness] Discovering canister methods for project: ${projectId}`);
    
    try {
      // Get userCanisterId from app store
      const userCanisterId = useAppStore.getState().userCanisterId;
      
      if (!userCanisterId) {
        throw new Error('User canister ID not found. Please ensure you are logged in.');
      }
      
      // 1. Load project files to find Candid interface
      const result = await userCanisterService.loadCodeArtifacts(
        projectId,
        userCanisterId,
        identity
      );
      
      if (!result.success || !result.artifacts) {
        throw new Error(result.error || 'Failed to load project files');
      }
      
      const projectFiles = result.artifacts;
      console.log(`📁 [AgentContextualAwareness] Found ${projectFiles.length} project files`);
      
      // 2. Find Candid files - PRIORITIZE .did.js files (like Candid UI does)
      // .did.js files contain executable idlFactory functions with REAL IDL types
      let candidFile = projectFiles.find(f => {
        const name = (f.fileName || '').toLowerCase();
        const path = (f.path || '').toLowerCase();
        return (
          name.endsWith('.did.js') &&
          (path.includes('backend') || path.includes('main') || path.includes('candid') || !path.includes('frontend'))
        );
      });
      
      // Fallback to .did.d.ts if .did.js not found
      if (!candidFile) {
        candidFile = projectFiles.find(f => {
          const name = (f.fileName || '').toLowerCase();
          const path = (f.path || '').toLowerCase();
          return (
            name.endsWith('.did.d.ts') &&
            (path.includes('backend') || path.includes('main') || path.includes('candid') || !path.includes('frontend'))
          );
        });
      }
      
      // Last resort: raw .did file
      if (!candidFile) {
        candidFile = projectFiles.find(f => {
          const name = (f.fileName || '').toLowerCase();
          const path = (f.path || '').toLowerCase();
          return (
            (name.endsWith('.did') && !name.endsWith('.did.js') && !name.endsWith('.did.d.ts')) &&
            (path.includes('backend') || path.includes('main') || path.includes('candid') || !path.includes('frontend'))
          );
        });
      }
      
      if (!candidFile) {
        throw new Error('Candid interface not found in project files. Please ensure your backend has been deployed.');
      }
      
      console.log(`✅ [AgentContextualAwareness] Found Candid file: ${candidFile.fileName}`);
      
      const candidContent = candidFile.content || '';
      const isDidJs = candidFile.fileName.endsWith('.did.js');
      
      // 3. Parse methods - EXECUTE idlFactory for .did.js files to get REAL IDL types
      let methodInfo: CanisterMethodInfo;
      let methodDocs: CanisterMethodDocumentation[];
      
      if (isDidJs) {
        console.log('✅ [AgentContextualAwareness] Using .did.js idlFactory execution (like Candid UI)');
        const parsedResult = this.parseDidJsFile(candidContent);
        methodInfo = parsedResult.methodInfo;
        methodDocs = parsedResult.methodDocs;
      } else {
        // Fallback to regex parsing for .did.d.ts or raw .did files
        console.log('⚠️ [AgentContextualAwareness] Using regex parser for .did.d.ts/.did file');
        methodInfo = CanisterMethodDiscovery.parseCanisterMethods(candidContent);
        if (!CanisterMethodDiscovery.validateMethodInfo(methodInfo)) {
          throw new Error('No valid methods found in Candid interface');
        }
        methodDocs = this.generateMethodDocumentation(methodInfo, candidContent);
      }
      
      console.log(`✅ [AgentContextualAwareness] Discovered ${methodDocs.length} methods with full type information`);
      
      return {
        methodInfo,
        methodDocs,
        candidContent,
        rawDidContent: isDidJs ? candidContent : undefined
      };
    } catch (error) {
      console.error('❌ [AgentContextualAwareness] Discovery failed:', error);
      throw error;
    }
  }
  
  /**
   * Parse Candid IDL from raw .did file text
   * 
   * Note: The @dfinity/candid package does NOT include IDL.parse() - it only provides
   * constructors (IDL.Service, IDL.Func, etc.) for building IDL definitions programmatically.
   * 
   * The Candid UI repository has its own parser, but that's a separate tool, not part of
   * the npm package. Therefore, we use regex-based parsing for raw .did files.
   * 
   * For .did.js files, we can execute the idlFactory function directly (see DynamicCanisterService).
   */
  /**
   * Parse .did.js file by executing idlFactory to get REAL IDL types
   * This is how Candid UI works - it executes the idlFactory function to get actual IDL objects
   * 
   * Can be used by both agent integration and database interface
   */
  static parseDidJsFile(didJsContent: string): {
    methodInfo: CanisterMethodInfo;
    methodDocs: CanisterMethodDocumentation[];
  } {
    console.log('🔧 [AgentContextualAwareness] Executing idlFactory from .did.js file...');
    
    const methodInfo: CanisterMethodInfo = {
      getters: [],
      setters: [],
      queries: [],
      updates: []
    };
    
    const methodDocs: CanisterMethodDocumentation[] = [];
    
    try {
      // Extract and execute the idlFactory function (like DynamicCanisterService does)
      const factoryMatch = didJsContent.match(/export\s+const\s+idlFactory\s*=\s*(\(\s*\{\s*IDL\s*\}\s*\)\s*=>\s*\{[\s\S]*?\});/);
      
      if (!factoryMatch || !factoryMatch[1]) {
        throw new Error('Could not extract idlFactory from .did.js file');
      }
      
      // Execute the factory function to get the actual IDL service
      const factoryFunction = new Function('IDL', `
        try {
          const factory = ${factoryMatch[1]};
          return factory({ IDL });
        } catch (error) {
          console.error('Error executing factory:', error);
          throw error;
        }
      `);
      
      const idlService = factoryFunction(IDL);
      
      if (!idlService || !idlService._fields) {
        throw new Error('Failed to execute idlFactory or invalid service structure');
      }
      
      console.log(`✅ [AgentContextualAwareness] Successfully executed idlFactory, found ${idlService._fields.length} methods`);
      
      // Extract methods from the executed IDL service
      idlService._fields.forEach((field: any) => {
        const methodName = field[0];
        const funcType = field[1];
        
        // Get annotations to determine if query or update
        const annotations = funcType._annotations || [];
        const isQuery = annotations.includes('query');
        const methodType: 'query' | 'update' = isQuery ? 'query' : 'update';
        
        // Extract REAL IDL types for parameters
        // The property is 'argTypes', not '_argTypes' (based on debug output)
        const argTypes = funcType.argTypes || funcType._argTypes || funcType.args || [];
        const retTypes = funcType.retTypes || funcType._retTypes || funcType.returns || [];
        
        // Build parameter documentation with REAL Candid types
        const parameters = argTypes.map((argType: any, index: number) => {
          const candidTypeStr = this.idlTypeToString(argType);
          const jsType = this.candidToJSType(argType);
          
          return {
            name: `param${index}`,
            type: jsType,
            candidType: candidTypeStr,
            required: true
          };
        });
        
        // Build return type
        const returnType = retTypes.length > 0 ? retTypes[0] : null;
        const returnCandidType = returnType ? this.idlTypeToString(returnType) : 'void';
        const returnJSType = returnType ? this.candidToJSType(returnType) : 'void';
        
        // Build Candid signature
        const paramSignatures = parameters.map(p => p.candidType).join(', ');
        const candidSignature = `${methodName} : (${paramSignatures}) -> (${returnCandidType})`;
        
        // Categorize method
        if (methodName.toLowerCase().startsWith('get') || 
            methodName.toLowerCase().startsWith('list') ||
            methodName.toLowerCase().startsWith('find')) {
          methodInfo.getters.push({ name: methodName, sectionName: this.extractEntityName(methodName) });
        } else if (methodName.toLowerCase().startsWith('set') ||
                   methodName.toLowerCase().startsWith('update') ||
                   methodName.toLowerCase().startsWith('create') ||
                   methodName.toLowerCase().startsWith('add')) {
          methodInfo.setters.push({ name: methodName, sectionName: this.extractEntityName(methodName) });
        }
        
        if (isQuery) {
          methodInfo.queries.push({ name: methodName, sectionName: this.extractEntityName(methodName) });
        } else {
          methodInfo.updates.push({ name: methodName, sectionName: this.extractEntityName(methodName) });
        }
        
        // Generate documentation
        const description = this.generateMethodDescription(methodName, methodType);
        const example = this.generateMethodExample(methodName, parameters, returnJSType);
        
        methodDocs.push({
          name: methodName,
          type: methodType,
          description,
          parameters,
          returns: {
            type: returnJSType,
            candidType: returnCandidType
          },
          candidSignature,
          example
        });
      });
      
      console.log(`✅ [AgentContextualAwareness] Extracted ${methodDocs.length} methods with REAL IDL types`);
      
      return { methodInfo, methodDocs };
    } catch (error) {
      console.error('❌ [AgentContextualAwareness] Failed to parse .did.js file:', error);
      // Fallback to regex parsing
      console.log('⚠️ [AgentContextualAwareness] Falling back to regex parsing');
      return this.parseCandidIDLWithRegex(didJsContent);
    }
  }
  
  /**
   * Parse Candid IDL from raw .did file text using regex
   * Fallback method when .did.js execution fails
   */
  private static parseCandidIDL(candidText: string): {
    methodInfo: CanisterMethodInfo;
    methodDocs: CanisterMethodDocumentation[];
  } {
    console.log('🔧 [AgentContextualAwareness] Parsing Candid IDL with regex parser...');
    return this.parseCandidIDLWithRegex(candidText);
  }
  
  /**
   * Parse Candid IDL using regex patterns (fallback method)
   */
  private static parseCandidIDLWithRegex(candidText: string): {
    methodInfo: CanisterMethodInfo;
    methodDocs: CanisterMethodDocumentation[];
  } {
    const methodInfo: CanisterMethodInfo = {
      getters: [],
      setters: [],
      queries: [],
      updates: []
    };
    
    const methodDocs: CanisterMethodDocumentation[] = [];
    
    // Extract method definitions from Candid text
    // Pattern: methodName : (param1: type1, param2: type2) -> (returnType);
    const methodPattern = /(\w+)\s*:\s*\(([^)]*)\)\s*->\s*\(([^)]*)\)/g;
    let match;
    
    while ((match = methodPattern.exec(candidText)) !== null) {
      const methodName = match[1];
      const paramsStr = match[2];
      const returnStr = match[3];
      
      // Parse parameters
      const parameters: Array<{ name: string; type: string; candidType: string; required: boolean }> = [];
      if (paramsStr.trim()) {
        const paramParts = paramsStr.split(',').map(p => p.trim());
        paramParts.forEach((param, index) => {
          const paramMatch = param.match(/(\w+)\s*:\s*(.+)/);
          if (paramMatch) {
            const paramName = paramMatch[1];
            const paramType = paramMatch[2].trim();
            parameters.push({
              name: paramName,
              type: this.candidTypeToJSType(paramType),
              candidType: paramType,
              required: true
            });
          } else {
            // Unnamed parameter
            parameters.push({
              name: `param${index}`,
              type: this.candidTypeToJSType(param),
              candidType: param,
              required: true
            });
          }
        });
      }
      
      // Parse return type
      const returnType = returnStr.trim() || 'void';
      const returnCandidType = returnType;
      const returnJSType = this.candidTypeToJSType(returnType);
      
      // Determine method type (query vs update)
      // Check for query annotation or infer from method name
      const isQuery = candidText.includes(`${methodName} : query`) || 
                      methodName.toLowerCase().startsWith('get') ||
                      methodName.toLowerCase().startsWith('list') ||
                      methodName.toLowerCase().startsWith('find');
      const methodType: 'query' | 'update' = isQuery ? 'query' : 'update';
      
      // Build Candid signature
      const paramSignatures = parameters.map(p => p.candidType).join(', ');
      const candidSignature = `${methodName} : (${paramSignatures}) -> (${returnCandidType})`;
      
      // Categorize method
      if (methodName.toLowerCase().startsWith('get') || 
          methodName.toLowerCase().startsWith('list') ||
          methodName.toLowerCase().startsWith('find')) {
        methodInfo.getters.push({ name: methodName, sectionName: this.extractEntityName(methodName) });
      } else if (methodName.toLowerCase().startsWith('set') ||
                 methodName.toLowerCase().startsWith('update') ||
                 methodName.toLowerCase().startsWith('create') ||
                 methodName.toLowerCase().startsWith('add')) {
        methodInfo.setters.push({ name: methodName, sectionName: this.extractEntityName(methodName) });
      }
      
      if (isQuery) {
        methodInfo.queries.push({ name: methodName, sectionName: this.extractEntityName(methodName) });
      } else {
        methodInfo.updates.push({ name: methodName, sectionName: this.extractEntityName(methodName) });
      }
      
      // Generate documentation
      const description = this.generateMethodDescription(methodName, methodType);
      const example = this.generateMethodExample(methodName, parameters, returnJSType);
      
      methodDocs.push({
        name: methodName,
        type: methodType,
        description,
        parameters,
        returns: {
          type: returnJSType,
          candidType: returnCandidType
        },
        candidSignature,
        example
      });
    }
    
    return { methodInfo, methodDocs };
  }
  
  /**
   * Convert Candid type string to JavaScript type
   */
  private static candidTypeToJSType(candidType: string): string {
    const type = candidType.trim().toLowerCase();
    
    if (type.includes('vec')) {
      return 'Array<any>';
    }
    if (type.includes('opt')) {
      return 'any | null';
    }
    if (type.includes('variant') || type.includes('record')) {
      return 'object';
    }
    
    const typeMap: Record<string, string> = {
      'text': 'string',
      'nat': 'bigint',
      'int': 'bigint',
      'nat64': 'bigint',
      'int64': 'bigint',
      'nat32': 'number',
      'int32': 'number',
      'nat16': 'number',
      'int16': 'number',
      'nat8': 'number',
      'int8': 'number',
      'float64': 'number',
      'float32': 'number',
      'bool': 'boolean',
      'null': 'null',
      'principal': 'string',
      'blob': 'Uint8Array',
      'empty': 'void'
    };
    
    for (const [candid, js] of Object.entries(typeMap)) {
      if (type.includes(candid)) {
        return js;
      }
    }
    
    return 'any';
  }
  
  /**
   * Convert IDL type to string representation
   * Works with both actual IDL type objects (from executed idlFactory) and string types
   */
  private static idlTypeToString(idlType: any): string {
    if (!idlType) {
      return 'unknown';
    }
    
    // If it's already a string, return it
    if (typeof idlType === 'string') {
      return idlType;
    }
    
    // If it's not an object, convert to string
    if (typeof idlType !== 'object') {
      return String(idlType);
    }
    
    // Try to use display() method if available (IDL types have this)
    if (typeof idlType.display === 'function') {
      try {
        return idlType.display();
      } catch (e) {
        // Fall through to other methods
      }
    }
    
    // Handle variant types
    if (idlType._type === 'Variant' || idlType.constructor?.name === 'VariantClass') {
      const fields = idlType._fields || idlType.fields || [];
      if (fields.length > 0) {
        const variants = fields.map((f: any) => {
          const fieldName = Array.isArray(f) ? f[0] : f.name || 'unknown';
          const fieldType = Array.isArray(f) ? f[1] : f.type;
          return `${fieldName} : ${this.idlTypeToString(fieldType)}`;
        }).join('; ');
        return `variant { ${variants} }`;
      }
      return 'variant {}';
    }
    
    // Handle record types
    if (idlType._type === 'Record' || idlType.constructor?.name === 'RecordClass') {
      const fields = idlType._fields || idlType.fields || [];
      if (fields.length > 0) {
        const recordFields = fields.map((f: any) => {
          const fieldName = Array.isArray(f) ? f[0] : f.name || 'unknown';
          const fieldType = Array.isArray(f) ? f[1] : f.type;
          return `${fieldName} : ${this.idlTypeToString(fieldType)}`;
        }).join('; ');
        return `record { ${recordFields} }`;
      }
      return 'record {}';
    }
    
    // Handle vec types
    if (idlType._type === 'Vec' || idlType.constructor?.name === 'VecClass') {
      const innerType = idlType._type || idlType.innerType;
      const innerTypeStr = this.idlTypeToString(innerType);
      return `vec ${innerTypeStr}`;
    }
    
    // Handle opt types
    if (idlType._type === 'Opt' || idlType.constructor?.name === 'OptClass') {
      const innerType = idlType._type || idlType.innerType;
      const innerTypeStr = this.idlTypeToString(innerType);
      return `opt ${innerTypeStr}`;
    }
    
    // Handle tuple types
    if (idlType._type === 'Tuple' || idlType.constructor?.name === 'TupleClass') {
      const fields = idlType._fields || idlType.fields || [];
      const tupleFields = fields.map((f: any) => this.idlTypeToString(f)).join(', ');
      return `(${tupleFields})`;
    }
    
    // Handle primitive types by checking constructor name or _type
    const typeName = idlType.constructor?.name || idlType._type || '';
    const typeMap: Record<string, string> = {
      'TextClass': 'text',
      'NatClass': 'nat',
      'IntClass': 'int',
      'Nat64Class': 'nat64',
      'Int64Class': 'int64',
      'Nat32Class': 'nat32',
      'Int32Class': 'int32',
      'Nat16Class': 'nat16',
      'Int16Class': 'int16',
      'Nat8Class': 'nat8',
      'Int8Class': 'int8',
      'Float64Class': 'float64',
      'Float32Class': 'float32',
      'BoolClass': 'bool',
      'NullClass': 'null',
      'PrincipalClass': 'principal',
      'BlobClass': 'blob',
      'EmptyClass': 'empty',
      'Text': 'text',
      'Nat': 'nat',
      'Int': 'int',
      'Nat64': 'nat64',
      'Int64': 'int64',
      'Nat32': 'nat32',
      'Int32': 'int32',
      'Nat16': 'nat16',
      'Int16': 'int16',
      'Nat8': 'nat8',
      'Int8': 'int8',
      'Float64': 'float64',
      'Float32': 'float32',
      'Bool': 'bool',
      'Null': 'null',
      'Principal': 'principal',
      'Blob': 'blob',
      'Empty': 'empty'
    };
    
    if (typeMap[typeName]) {
      return typeMap[typeName];
    }
    
    // Fallback: try to get a string representation
    if (idlType.toString && typeof idlType.toString === 'function') {
      const str = idlType.toString();
      if (str !== '[object Object]') {
        return str;
      }
    }
    
    return typeName || 'unknown';
  }
  
  /**
   * Convert Candid type to JavaScript type string
   */
  private static candidToJSType(idlType: any): string {
    const candidType = this.idlTypeToString(idlType);
    
    if (candidType.includes('vec')) {
      return 'Array<any>';
    }
    if (candidType.includes('opt')) {
      return `${this.candidToJSType(idlType.innerType)} | null`;
    }
    if (candidType.includes('variant')) {
      return 'object';
    }
    if (candidType.includes('record')) {
      return 'Record<string, any>';
    }
    
    const typeMap: Record<string, string> = {
      'text': 'string',
      'nat': 'bigint',
      'int': 'bigint',
      'nat64': 'bigint',
      'int64': 'bigint',
      'nat32': 'number',
      'int32': 'number',
      'nat16': 'number',
      'int16': 'number',
      'nat8': 'number',
      'int8': 'number',
      'float64': 'number',
      'float32': 'number',
      'bool': 'boolean',
      'null': 'null',
      'principal': 'string',
      'blob': 'Uint8Array',
      'empty': 'void'
    };
    
    return typeMap[candidType] || 'any';
  }
  
  /**
   * Generate human-readable documentation for canister methods
   */
  private static generateMethodDocumentation(
    methodInfo: CanisterMethodInfo,
    candidContent: string
  ): CanisterMethodDocumentation[] {
    const docs: CanisterMethodDocumentation[] = [];
    
    // Parse method signatures from Candid content
    const allMethods = [
      ...methodInfo.getters.map(m => ({ ...m, type: 'query' as const })),
      ...methodInfo.queries.map(m => ({ ...m, type: 'query' as const })),
      ...methodInfo.setters.map(m => ({ ...m, type: 'update' as const })),
      ...methodInfo.updates.map(m => ({ ...m, type: 'update' as const }))
    ];
    
    for (const method of allMethods) {
      // Try to extract method signature from Candid
      const methodPattern = new RegExp(`'${method.name}'\\s*:\\s*ActorMethod<([^>]+)>`, 'g');
      const match = methodPattern.exec(candidContent);
      
      // Infer parameters and return type from method name and type
      const parameters = this.inferParameters(method.name, match?.[1]);
      const returnType = this.inferReturnType(method.name, method.type, match?.[1]);
      
      // Generate description from method name
      const description = this.generateMethodDescription(method.name, method.type);
      
      // Generate example
      const example = this.generateMethodExample(method.name, parameters, returnType);
      
      // Build Candid signature (fallback when we don't have parsed IDL)
      const paramSignatures = parameters.map(p => p.type).join(', ');
      const candidSignature = `${method.name} : (${paramSignatures}) -> (${returnType})`;
      
      docs.push({
        name: method.name,
        type: method.type,
        description,
        parameters: parameters.map(p => ({
          ...p,
          candidType: p.type, // Fallback: use JS type as Candid type
        })),
        returns: { 
          type: returnType,
          candidType: returnType // Fallback: use JS type as Candid type
        },
        candidSignature,
        example
      });
    }
    
    return docs;
  }
  
  /**
   * Infer parameters from method name and signature
   */
  private static inferParameters(methodName: string, signature?: string): Array<{ name: string; type: string; required: boolean }> {
    const params: Array<{ name: string; type: string; required: boolean }> = [];
    
    // Common patterns
    if (methodName.toLowerCase().includes('create') || methodName.toLowerCase().includes('add')) {
      // Usually takes an object/record
      params.push({ name: 'data', type: 'Record<string, any>', required: true });
    } else if (methodName.toLowerCase().includes('update')) {
      params.push({ name: 'id', type: 'string', required: true });
      params.push({ name: 'data', type: 'Record<string, any>', required: true });
    } else if (methodName.toLowerCase().includes('delete') || methodName.toLowerCase().includes('remove')) {
      params.push({ name: 'id', type: 'string', required: true });
    } else if (methodName.toLowerCase().includes('get') || methodName.toLowerCase().includes('find')) {
      params.push({ name: 'id', type: 'string', required: true });
    } else if (methodName.toLowerCase().includes('list') || methodName.toLowerCase().includes('getall')) {
      // Usually no parameters or optional filters
      params.push({ name: 'filters', type: 'Record<string, any>', required: false });
    }
    
    // If signature provided, try to parse it
    if (signature) {
      // Simple parsing - can be enhanced
      const paramMatch = signature.match(/\[([^\]]+)\]/);
      if (paramMatch) {
        // Parse parameter types from signature
        // This is a simplified version - full Candid parsing would be more complex
      }
    }
    
    return params.length > 0 ? params : [{ name: 'input', type: 'any', required: false }];
  }
  
  /**
   * Infer return type from method name and type
   */
  private static inferReturnType(methodName: string, methodType: 'query' | 'update', signature?: string): string {
    if (methodType === 'query') {
      if (methodName.toLowerCase().includes('list') || methodName.toLowerCase().includes('getall')) {
        return 'Array<any>';
      }
      return 'any';
    } else {
      // Updates usually return Result or void
      if (methodName.toLowerCase().includes('create') || 
          methodName.toLowerCase().includes('update') ||
          methodName.toLowerCase().includes('delete')) {
        return 'Result<string, string>';
      }
      return 'void';
    }
  }
  
  /**
   * Generate method description from name
   */
  private static generateMethodDescription(methodName: string, methodType: 'query' | 'update'): string {
    const action = methodName.toLowerCase();
    
    if (action.includes('create') || action.includes('add')) {
      return `Creates a new ${this.extractEntityName(methodName)} in the system`;
    } else if (action.includes('update')) {
      return `Updates an existing ${this.extractEntityName(methodName)}`;
    } else if (action.includes('delete') || action.includes('remove')) {
      return `Deletes a ${this.extractEntityName(methodName)} from the system`;
    } else if (action.includes('get') && !action.includes('getall') && !action.includes('list')) {
      return `Retrieves a ${this.extractEntityName(methodName)} by ID`;
    } else if (action.includes('list') || action.includes('getall')) {
      return `Retrieves all ${this.extractEntityName(methodName)}s`;
    } else if (action.includes('find') || action.includes('search')) {
      return `Searches for ${this.extractEntityName(methodName)}s matching criteria`;
    }
    
    return `${methodType === 'query' ? 'Reads' : 'Modifies'} ${this.extractEntityName(methodName)} data`;
  }
  
  /**
   * Extract entity name from method name
   */
  private static extractEntityName(methodName: string): string {
    // Remove common prefixes
    let name = methodName
      .replace(/^(get|set|create|update|delete|add|remove|list|find|search)/i, '')
      .replace(/s$/, ''); // Remove plural
    
    // Convert camelCase to words
    name = name.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
    
    return name || 'item';
  }
  
  /**
   * Generate example code for method call
   */
  private static generateMethodExample(
    methodName: string,
    parameters: Array<{ name: string; type: string; required: boolean }>,
    returnType: string
  ): string {
    const paramString = parameters
      .filter(p => p.required)
      .map(p => {
        if (p.type.includes('Record')) {
          return `{ ${p.name === 'data' ? '...data' : `${p.name}: value`} }`;
        }
        return `${p.name}: ${p.type === 'string' ? '"value"' : 'value'}`;
      })
      .join(', ');
    
    return `await backendActor.${methodName}(${paramString || ''})`;
  }
  
  /**
   * Create enhanced agent instructions with canister method knowledge
   */
  static generateEnhancedInstructions(
    baseInstructions: string,
    methodDocs: CanisterMethodDocumentation[],
    backendCanisterId: string,
    candidContent?: string // Optional: The .did.js file content to include in instructions
  ): string {
    const methodsSection = methodDocs.map(doc => `
Method: ${doc.name}
Type: ${doc.type} (${doc.type === 'query' ? 'read-only' : 'modifies state'})
Description: ${doc.description}
Candid Signature: ${doc.candidSignature}
Parameters:
${doc.parameters.map(p => `  - ${p.name}: ${p.candidType} (JS: ${p.type})${p.required ? ' [REQUIRED]' : ' [OPTIONAL]'}`).join('\n')}
Returns: ${doc.returns.candidType} (JS: ${doc.returns.type})
Example: ${doc.example}
`).join('\n---\n');
    
    return `${baseInstructions}

=== BACKEND CANISTER INTEGRATION ===
Backend Canister ID: ${backendCanisterId}

You have access to the following backend methods:

${methodsSection}

INSTRUCTIONS FOR USING BACKEND METHODS:
CRITICAL: You MUST use the MCP tool "kontext/call_canister_method" to call backend methods. You cannot call them directly.

1. When users request actions that require backend methods, identify the relevant method(s)
2. Extract parameters from the user's request, ensuring they match the EXACT Candid types shown above
3. Use the MCP tool: "kontext/call_canister_method" with these parameters:
   - canisterId: "${backendCanisterId}"
   - methodName: The name of the backend method (e.g., "getAllUsers", "createPost")
   - parameters: A JSON object with the method parameters (MUST match Candid types exactly - see signatures above)
   - candidInterface: The Candid interface content (see below for the .did.js file content)
   - network: "ic" (for mainnet) or "local" (for local development)

TYPE SAFETY NOTES:
- Parameter types MUST match the Candid signatures exactly
- Use the exact Candid type names shown in the signatures (e.g., "nat" not "number", "text" not "string")
- For records, pass objects with field names matching the Candid definition
- For variants, use the exact variant field names
- For vec types, pass arrays
- For opt types, the value can be null

CANDID INTERFACE CONTENT (.did.js file):
The following is the complete Candid interface file content. ALWAYS pass this as the "candidInterface" parameter to the MCP bridge for 100% accurate type validation. This enables the MCP bridge to execute the idlFactory and validate your parameters with REAL IDL types:

\`\`\`javascript
${candidContent || '// Candid interface not available - use method signatures above for type information'}
\`\`\`

IMPORTANT: When calling backend methods, ALWAYS include the candidInterface parameter with the content above. This ensures the MCP bridge can validate your parameters with 100% accuracy using the same approach as Candid UI.

4. The MCP tool will execute the canister method and return the result
5. Return results in a user-friendly format
6. For update methods, explain what will change before executing
7. Always handle errors gracefully and provide helpful error messages

EXAMPLE USAGE:
User: "Get all users"
You: I'll retrieve all users from the backend.
[Call MCP tool: kontext/call_canister_method with {
  "canisterId": "${backendCanisterId}",
  "methodName": "getAllUsers",
  "parameters": {},
  "network": "ic"
}]

User: "Create a new post with title 'Hello' and content 'World'"
You: I'll create a new post for you.
[Call MCP tool: kontext/call_canister_method with {
  "canisterId": "${backendCanisterId}",
  "methodName": "createPost",
  "parameters": {
    "title": "Hello",
    "content": "World"
  },
  "network": "ic"
}]

IMPORTANT: The "kontext-canister-bridge" MCP server has been automatically added to your configuration. You can now call backend methods using the tool above.
`;
  }
  
  /**
   * Create backend actor for agent to use
   */
  static async createBackendActor(
    backendCanisterId: string,
    candidContent: string,
    identity: Identity
  ): Promise<any> {
    return await DynamicCanisterService.createActor({
      canisterId: backendCanisterId,
      identity,
      candidContent,
      didDtsContent: undefined
    });
  }
}

