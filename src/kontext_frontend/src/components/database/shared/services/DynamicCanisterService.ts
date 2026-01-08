import { Actor, HttpAgent } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import { Identity } from '@dfinity/agent';

export interface CanisterMethodInfo {
    getters: Array<{ name: string; sectionName: string }>;
    setters: Array<{ name: string; sectionName: string }>;
    queries: Array<{ name: string; sectionName: string }>;
    updates: Array<{ name: string; sectionName: string }>;
}

export interface DatabaseSchema {
    sections: Array<{
        id: string;
        title: string;
        fields: Record<string, any>;
        type: 'object' | 'array' | 'primitive';
        editable?: boolean; // Whether this section has a corresponding setter method
    }>;
}

interface CreateActorParams {
    canisterId: string;
    identity: Identity;
    candidContent?: string;
    didDtsContent?: string;
}

export class DynamicCanisterService {
    private static formatFieldLabel(name: string): string {
        return name
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .replace(/^\w/, c => c.toUpperCase())
            .trim();
    }

    private static safeStringify(data: any): string {
        return JSON.stringify(data, (key, value) => {
            if (typeof value === 'bigint') {
                return value.toString();
            }
            return value;
        });
    }

    private static convertCanisterDataToForm(data: any): any {
        if (data === null || data === undefined) {
            return data;
        }

        if (typeof data === 'bigint') {
            if (data <= BigInt(Number.MAX_SAFE_INTEGER) && data >= BigInt(Number.MIN_SAFE_INTEGER)) {
                return Number(data);
            } else {
                return data.toString();
            }
        }

        if (Array.isArray(data)) {
            return data.map(item => DynamicCanisterService.convertCanisterDataToForm(item));
        }

        if (typeof data === 'object') {
            const result: Record<string, any> = {};
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    result[key] = DynamicCanisterService.convertCanisterDataToForm(data[key]);
                }
            }
            return result;
        }

        return data;
    }

    private static convertFormDataToCanister(data: any): any {
        if (data === null || data === undefined) {
            return data;
        }

        if (typeof data === 'string' && !isNaN(Number(data)) && data.trim() !== '') {
            const num = Number(data);
            if (num > Number.MAX_SAFE_INTEGER || num < Number.MIN_SAFE_INTEGER) {
                try {
                    return BigInt(data);
                } catch (e) {
                    return data;
                }
            }
            return num;
        }

        if (Array.isArray(data)) {
            return data.map(item => DynamicCanisterService.convertFormDataToCanister(item));
        }

        if (typeof data === 'object') {
            const result: Record<string, any> = {};
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    result[key] = DynamicCanisterService.convertFormDataToCanister(data[key]);
                }
            }
            return result;
        }

        return data;
    }

    static async createActor(params: CreateActorParams): Promise<any> {
        const { canisterId, identity, candidContent, didDtsContent } = params;

        try {
            console.log('🔗 [DynamicCanisterService] Creating mainnet actor for canister:', canisterId);

            // MAINNET ONLY - Always connect to Internet Computer mainnet
            const agent = new HttpAgent({
                identity,
                host: "https://icp0.io" // Always use mainnet
            });

            // No root key fetching - mainnet doesn't need this
            console.log('🌐 [DynamicCanisterService] Connecting to Internet Computer mainnet');

            let idlFactory: any = null;

            // PRIORITY 1: Try to use .did.js first (most reliable)
            if (candidContent) {
                console.log('🔗 [DynamicCanisterService] Attempting to create IDL factory from .did.js');
                idlFactory = DynamicCanisterService.createIdlFactoryFromDidJs(candidContent);
                if (idlFactory) {
                    console.log('✅ [DynamicCanisterService] Successfully created IDL factory from .did.js');
                } else {
                    console.warn('⚠️ [DynamicCanisterService] Failed to create IDL factory from .did.js');
                }
            }

            // PRIORITY 2: Fallback to .did.d.ts if .did.js failed
            if (!idlFactory && didDtsContent) {
                console.log('🔗 [DynamicCanisterService] Attempting to create IDL factory from .did.d.ts');
                idlFactory = DynamicCanisterService.createIdlFactoryFromDidDts(didDtsContent);
                if (idlFactory) {
                    console.log('✅ [DynamicCanisterService] Successfully created IDL factory from .did.d.ts');
                } else {
                    console.warn('⚠️ [DynamicCanisterService] Failed to create IDL factory from .did.d.ts');
                }
            }

            // PRIORITY 3: Create a generic IDL factory as last resort
            if (!idlFactory) {
                console.warn('⚠️ [DynamicCanisterService] Creating generic IDL factory as fallback');
                idlFactory = DynamicCanisterService.createGenericIdlFactory();
            }

            const actor = Actor.createActor(idlFactory, {
                agent,
                canisterId
            });

            // Test that the actor was created properly by checking if methods exist
            console.log('🔍 [DynamicCanisterService] Testing actor method availability...');
            const availableMethods = Object.getOwnPropertyNames(actor).filter(name => 
                typeof actor[name] === 'function' && !name.startsWith('_')
            );
            console.log('🔍 [DynamicCanisterService] Available methods on actor:', availableMethods);

            if (availableMethods.length === 0) {
                console.warn('⚠️ [DynamicCanisterService] No methods found on created actor');
            }

            console.log('✅ [DynamicCanisterService] Mainnet actor created successfully');
            return actor;

        } catch (error) {
            console.error('❌ [DynamicCanisterService] Mainnet actor creation failed:', error);
            
            // Provide more helpful error messages for mainnet-specific issues
            if (error instanceof Error) {
                if (error.message.includes('Failed to fetch')) {
                    throw new Error(`Cannot connect to Internet Computer mainnet. Please check your internet connection and try again. Canister: ${canisterId}`);
                } else if (error.message.includes('Canister not found')) {
                    throw new Error(`Canister ${canisterId} not found on Internet Computer mainnet. Please verify the canister ID is correct and the canister is deployed.`);
                } else if (error.message.includes('Invalid canister id')) {
                    throw new Error(`Invalid canister ID format: ${canisterId}. Please check that this is a valid Internet Computer canister ID.`);
                }
            }
            
            throw error;
        }
    }

    private static createIdlFactoryFromDidJs(candidContent: string): any {
        try {
            console.log('🔧 [DynamicCanisterService] Parsing .did.js content...');

            // Method 1: Try to extract and execute the idlFactory export
            const factoryMatch = candidContent.match(/export\s+const\s+idlFactory\s*=\s*(\(\s*\{\s*IDL\s*\}\s*\)\s*=>\s*\{[\s\S]*?\});/);
            
            if (factoryMatch && factoryMatch[1]) {
                try {
                    console.log('🔧 [DynamicCanisterService] Found idlFactory export, attempting to execute...');
                    
                    // Create a safe execution environment
                    const factoryFunction = new Function('IDL', `
                        try {
                            const factory = ${factoryMatch[1]};
                            return factory({ IDL });
                        } catch (error) {
                            console.error('Error executing factory:', error);
                            return null;
                        }
                    `);

                    const result = factoryFunction(IDL);
                    if (result) {
                        console.log('✅ [DynamicCanisterService] Successfully executed idlFactory');
                        return ({ IDL }) => result;
                    }
                } catch (error) {
                    console.warn('⚠️ [DynamicCanisterService] Failed to execute extracted factory:', error);
                }
            }

            // Method 2: Try to find IDL.Service definition directly
            const serviceMatch = candidContent.match(/IDL\.Service\s*\(\s*\{([\s\S]*?)\}\s*\)/);
            if (serviceMatch && serviceMatch[1]) {
                console.log('🔧 [DynamicCanisterService] Found IDL.Service definition, parsing methods...');
                
                try {
                    return DynamicCanisterService.parseServiceFromDidJs(serviceMatch[1]);
                } catch (error) {
                    console.warn('⚠️ [DynamicCanisterService] Failed to parse IDL.Service:', error);
                }
            }

            // Method 3: Extract all method definitions and create basic service
            const methodMatches = [...candidContent.matchAll(/'([^']+)'\s*:\s*IDL\.Func\s*\(\s*\[(.*?)\]\s*,\s*\[(.*?)\]\s*(?:,\s*\[(.*?)\])?\s*\)/g)];
            
            if (methodMatches.length > 0) {
                console.log(`🔧 [DynamicCanisterService] Found ${methodMatches.length} method definitions, creating service...`);
                
                return ({ IDL }) => {
                    const service = {};

                    methodMatches.forEach(match => {
                        const methodName = match[1];
                        const argsStr = match[2] || '';
                        const returnStr = match[3] || '';
                        const annotationsStr = match[4] || '';

                        const isQuery = annotationsStr.includes("'query'");

                        // Create basic method signatures
                        const args = argsStr.trim() ? [IDL.Unknown] : [];
                        const returns = returnStr.trim() ? [IDL.Unknown] : [];
                        const annotations = isQuery ? ['query'] : [];

                        service[methodName] = IDL.Func(args, returns, annotations);
                    });

                    console.log('✅ [DynamicCanisterService] Created service with methods:', Object.keys(service));
                    return IDL.Service(service);
                };
            }

            console.warn('⚠️ [DynamicCanisterService] No recognizable patterns found in .did.js');
            return null;

        } catch (error) {
            console.error('❌ [DynamicCanisterService] Error creating IDL factory from .did.js:', error);
            return null;
        }
    }

    private static parseServiceFromDidJs(serviceContent: string): any {
        return ({ IDL }) => {
            const service = {};
            
            // Extract individual method definitions
            const lines = serviceContent.split(',').map(line => line.trim()).filter(line => line.length > 0);
            
            for (const line of lines) {
                try {
                    // Match method definition pattern
                    const methodMatch = line.match(/'([^']+)'\s*:\s*IDL\.Func\s*\(/);
                    if (methodMatch) {
                        const methodName = methodMatch[1];
                        
                        // For simplicity, create basic method signatures
                        // In a production system, you'd want to properly parse the full signature
                        const isQuery = line.includes("'query'");
                        
                        service[methodName] = IDL.Func(
                            [IDL.Unknown], // Args
                            [IDL.Unknown], // Return
                            isQuery ? ['query'] : []
                        );
                    }
                } catch (error) {
                    console.warn(`⚠️ [DynamicCanisterService] Failed to parse method line: ${line}`, error);
                }
            }
            
            return IDL.Service(service);
        };
    }

    private static createIdlFactoryFromDidDts(didDtsContent: string): any {
        try {
            console.log('🔧 [DynamicCanisterService] Parsing .did.d.ts content...');

            // Extract method signatures from the _SERVICE interface
            const serviceMatch = didDtsContent.match(/export interface _SERVICE\s*\{([\s\S]*?)\}/);
            
            if (!serviceMatch || !serviceMatch[1]) {
                console.warn('⚠️ [DynamicCanisterService] No _SERVICE interface found in .did.d.ts');
                return null;
            }

            const serviceContent = serviceMatch[1];
            console.log('🔧 [DynamicCanisterService] Found _SERVICE interface, parsing methods...');

            // Improved method parsing regex that handles complex return types
            const methodMatches = [...serviceContent.matchAll(/'([^']+)'\s*:\s*ActorMethod<\s*\[(.*?)\]\s*,\s*(.*?)\s*>/gs)];
            
            if (methodMatches.length === 0) {
                console.warn('⚠️ [DynamicCanisterService] No ActorMethod definitions found');
                return null;
            }

            console.log(`🔧 [DynamicCanisterService] Found ${methodMatches.length} method definitions`);

            return ({ IDL }) => {
                const service = {};

                methodMatches.forEach(match => {
                    const methodName = match[1];
                    const argsStr = match[2].trim();
                    const returnStr = match[3].trim();

                    // Determine if method is a query (read-only)
                    const isQuery = methodName.startsWith('get') || 
                                   methodName.startsWith('list') || 
                                   methodName.startsWith('find') || 
                                   methodName.startsWith('search') ||
                                   methodName.startsWith('check');

                    // Parse arguments
                    let args: any[] = [];
                    if (argsStr && argsStr !== '') {
                        // For simplicity, use IDL.Unknown for all args
                        // In production, you'd parse the actual TypeScript types
                        const argCount = argsStr.split(',').filter(arg => arg.trim()).length;
                        args = new Array(argCount).fill(IDL.Unknown);
                    }

                    // Parse return type
                    let returns = [IDL.Unknown];
                    
                    // Handle common return patterns
                    if (returnStr.includes('Array<')) {
                        returns = [IDL.Vec(IDL.Unknown)];
                    } else if (returnStr.includes('[] | [')) {
                        // Optional return type like `[] | [User]`
                        returns = [IDL.Opt(IDL.Unknown)];
                    } else if (returnStr.includes('boolean')) {
                        returns = [IDL.Bool];
                    } else if (returnStr.includes('bigint')) {
                        returns = [IDL.Nat];
                    }

                    service[methodName] = IDL.Func(
                        args,
                        returns,
                        isQuery ? ['query'] : []
                    );

                    console.log(`🔧 [DynamicCanisterService] Added method: ${methodName} (${isQuery ? 'query' : 'update'})`);
                });

                console.log('✅ [DynamicCanisterService] Created service with methods:', Object.keys(service));
                return IDL.Service(service);
            };

        } catch (error) {
            console.error('❌ [DynamicCanisterService] Error creating IDL factory from .did.d.ts:', error);
            return null;
        }
    }

    private static createGenericIdlFactory(): any {
        console.log('🔧 [DynamicCanisterService] Creating generic IDL factory as fallback');
        
        return ({ IDL }) => {
            // Create a very basic service that accepts any method call
            return IDL.Service({});
        };
    }

    // UPDATED: Dynamically detect which methods require parameters
    // Now supports both .did.js (with real IDL types) and .did.d.ts (fallback)
    // Made public so query builder can use it
    static async getMethodParameterRequirements(candidContent?: string, isDidJs?: boolean): Promise<Map<string, { hasParameters: boolean; parameterCount: number }>> {
        const methodRequirements = new Map();

        try {
            if (!candidContent) {
                console.warn('⚠️ [DynamicCanisterService] No candidContent provided');
                return methodRequirements;
            }

            // PRIORITY 1: Use .did.js with real IDL types (like AgentContextualAwarenessService)
            if (isDidJs) {
                console.log('🔍 [DynamicCanisterService] Extracting parameter requirements from .did.js (real IDL types)');
                
                try {
                    // Use AgentContextualAwarenessService.parseDidJsFile for consistent parsing
                    // Dynamic import to avoid circular dependencies
                    const { AgentContextualAwarenessService } = await import('../../../../services/AgentContextualAwarenessService');
                    const parsedResult = AgentContextualAwarenessService.parseDidJsFile(candidContent);
                    
                    console.log(`📊 [DynamicCanisterService] Parsed ${parsedResult.methodDocs.length} methods from .did.js`);
                    
                    // Extract parameter requirements from the parsed result
                    parsedResult.methodDocs.forEach((doc: any) => {
                        const parameterCount = doc.parameters?.length || 0;
                        const methodName = doc.name;
                        
                        methodRequirements.set(methodName, {
                            hasParameters: parameterCount > 0,
                            parameterCount
                        });
                        
                        console.log(`🔍 [DynamicCanisterService] Method "${methodName}": hasParameters=${parameterCount > 0}, count=${parameterCount} (from REAL IDL types)`);
                        if (parameterCount > 0) {
                            console.log(`   Parameters:`, doc.parameters.map((p: any) => `${p.name}: ${p.candidType}`).join(', '));
                        }
                    });
                    
                    if (methodRequirements.size > 0) {
                        console.log(`✅ [DynamicCanisterService] Successfully extracted requirements for ${methodRequirements.size} methods from .did.js`);
                        console.log(`📋 [DynamicCanisterService] Methods with requirements:`, Array.from(methodRequirements.keys()));
                        return methodRequirements;
                    } else {
                        console.warn('⚠️ [DynamicCanisterService] No method requirements extracted from .did.js');
                    }
                } catch (error) {
                    console.error('❌ [DynamicCanisterService] Failed to extract from .did.js:', error);
                    console.warn('⚠️ [DynamicCanisterService] Falling back to .did.d.ts parsing');
                    // Fall through to .did.d.ts parsing
                }
            }

            // PRIORITY 2: Fallback to .did.d.ts regex parsing
            console.log('🔍 [DynamicCanisterService] Extracting parameter requirements from .did.d.ts (regex parsing)');

            // Extract from _SERVICE interface
            const serviceMatch = candidContent.match(/export interface _SERVICE\s*\{([\s\S]*?)\}/);
            
            if (serviceMatch && serviceMatch[1]) {
                const serviceContent = serviceMatch[1];
                const methodMatches = [...serviceContent.matchAll(/'([^']+)'\s*:\s*ActorMethod<\s*\[(.*?)\]\s*,\s*(.*?)\s*>/gs)];

                methodMatches.forEach(match => {
                    const methodName = match[1];
                    const argsStr = match[2].trim();
                    
                    // Count parameters - handle empty arrays and void
                    let parameterCount = 0;
                    let hasParameters = false;
                    
                    // Check if argsStr is not empty and not just whitespace
                    if (argsStr && argsStr.trim() !== '' && argsStr.trim() !== '[]') {
                        // Remove brackets and split by comma
                        const cleanArgs = argsStr.replace(/^\[|\]$/g, '').trim();
                        if (cleanArgs) {
                            const params = cleanArgs.split(',').filter(param => param.trim() !== '');
                        parameterCount = params.length;
                        hasParameters = parameterCount > 0;
                        }
                    }

                    methodRequirements.set(methodName, {
                        hasParameters,
                        parameterCount
                    });

                    console.log(`🔍 [DynamicCanisterService] Method ${methodName}: hasParameters=${hasParameters}, count=${parameterCount} (from regex)`);
                });
                
                if (methodRequirements.size > 0) {
                    console.log(`✅ [DynamicCanisterService] Successfully extracted requirements for ${methodRequirements.size} methods from .did.d.ts`);
                } else {
                    console.warn('⚠️ [DynamicCanisterService] No methods found in .did.d.ts');
                }
            } else {
                console.warn('⚠️ [DynamicCanisterService] No _SERVICE interface found in candidContent');
            }
        } catch (error) {
            console.error('❌ [DynamicCanisterService] Error analyzing method parameters:', error);
        }

        return methodRequirements;
    }

    // FIXED: Enhanced schema generation that analyzes actual data structure
    static generateSchemaFromMethods(methodInfo: CanisterMethodInfo, loadedData?: Record<string, any>): DatabaseSchema {
        console.log('📊 [DynamicCanisterService] Generating schema from methods and data:', methodInfo, loadedData);

        const schema: DatabaseSchema = { sections: [] };
        const sectionMap = new Map<string, boolean>();
        
        // Create a map of section names to setter methods for editability check
        const sectionToSetterMap = new Map<string, boolean>();
        methodInfo.setters.forEach(setter => {
            sectionToSetterMap.set(setter.sectionName, true);
        });
        
        // 🔥 FIX: Create mapping from derived section names to actual data keys
        // When using admin access, data keys are the actual Motoko field names (plural)
        const sectionNameToDataKey = new Map<string, string>();
        if (loadedData) {
            const dataKeys = Object.keys(loadedData);
            methodInfo.getters.forEach(getter => {
                // Try exact match first
                if (dataKeys.includes(getter.sectionName)) {
                    sectionNameToDataKey.set(getter.sectionName, getter.sectionName);
                } else {
                    // Try plural form (add 's')
                    const pluralForm = getter.sectionName + 's';
                    if (dataKeys.includes(pluralForm)) {
                        sectionNameToDataKey.set(getter.sectionName, pluralForm);
                        console.log(`🔧 [DynamicCanisterService] Mapped section "${getter.sectionName}" to data key "${pluralForm}"`);
                    }
                    // Try checking if any data key contains the section name
                    else {
                        const matchingKey = dataKeys.find(key => 
                            key.toLowerCase() === getter.sectionName.toLowerCase() ||
                            key.toLowerCase() === pluralForm.toLowerCase()
                        );
                        if (matchingKey) {
                            sectionNameToDataKey.set(getter.sectionName, matchingKey);
                            console.log(`🔧 [DynamicCanisterService] Mapped section "${getter.sectionName}" to data key "${matchingKey}"`);
                        }
                    }
                }
            });
        }

        // Create sections based on getter methods
        methodInfo.getters.forEach(getter => {
            if (!sectionMap.has(getter.sectionName)) {
                sectionMap.set(getter.sectionName, true);
                
                // Check if this section has a corresponding setter (is editable)
                const isEditable = sectionToSetterMap.has(getter.sectionName);

                // 🔥 FIX: Use mapped data key instead of section name
                const dataKey = sectionNameToDataKey.get(getter.sectionName) || getter.sectionName;
                const sectionData = loadedData?.[dataKey];
                let sectionType: 'object' | 'array' | 'primitive' = 'object';
                let fields: Record<string, any> = {};

                if (sectionData !== undefined && sectionData !== null) {
                    if (Array.isArray(sectionData)) {
                        sectionType = 'array';
                        // Analyze the structure of array items
                        if (sectionData.length > 0) {
                            const firstItem = sectionData[0];
                            if (typeof firstItem === 'object' && firstItem !== null) {
                                // Generate field schema from the first item
                                Object.keys(firstItem).forEach(key => {
                                    const value = firstItem[key];
                                    fields[key] = {
                                        type: DynamicCanisterService.inferFieldType(value),
                                        title: DynamicCanisterService.formatFieldLabel(key)
                                    };
                                });
                            }
                        } else {
                            // Empty array - create default fields
                            fields = {
                                id: { type: 'string', title: 'ID' },
                                name: { type: 'string', title: 'Name' },
                                value: { type: 'string', title: 'Value' }
                            };
                        }
                    } else if (typeof sectionData === 'object') {
                        sectionType = 'object';
                        // Generate field schema from object properties
                        Object.keys(sectionData).forEach(key => {
                            const value = sectionData[key];
                            fields[key] = {
                                type: DynamicCanisterService.inferFieldType(value),
                                title: DynamicCanisterService.formatFieldLabel(key)
                            };
                        });
                    } else {
                        // Primitive value
                        sectionType = 'primitive';
                        fields = {
                            value: {
                                type: DynamicCanisterService.inferFieldType(sectionData),
                                title: 'Value'
                            }
                        };
                    }
                } else {
                    // No data available - create basic schema
                    fields = {
                        id: { type: 'string', title: 'ID' },
                        name: { type: 'string', title: 'Name' },
                        description: { type: 'string', title: 'Description', format: 'textarea' }
                    };
                }

                // 🔥 FIX: Use actual data key as section ID so UI can find the data
                const actualDataKey = sectionNameToDataKey.get(getter.sectionName) || getter.sectionName;
                const itemCount = Array.isArray(sectionData) ? sectionData.length : 
                                 (sectionData !== undefined && sectionData !== null ? 1 : 0);
                
                console.log(`📊 [DynamicCanisterService] Creating schema section: "${actualDataKey}" (${itemCount} items, editable: ${isEditable})`);
                
                schema.sections.push({
                    id: actualDataKey,  // Use actual data key, not derived section name
                    title: DynamicCanisterService.formatFieldLabel(actualDataKey),
                    fields,
                    type: sectionType,
                    editable: isEditable
                });
            }
        });

        console.log('📊 [DynamicCanisterService] Generated schema sections:', schema.sections);
        return schema;
    }

    // NEW: Helper function to infer field types from actual values
    private static inferFieldType(value: any): string {
        if (value === null || value === undefined) {
            return 'string'; // Default to string for null/undefined
        }
        
        if (typeof value === 'boolean') {
            return 'boolean';
        }
        
        if (typeof value === 'number' || typeof value === 'bigint') {
            return 'number';
        }
        
        if (typeof value === 'string') {
            // Check for special formats
            if (value.match(/^#[0-9a-fA-F]{6}$/)) {
                return 'string'; // Could be enhanced to 'color' format
            }
            if (value.length > 100) {
                return 'string'; // Could be enhanced to 'textarea' format
            }
            return 'string';
        }
        
        if (Array.isArray(value)) {
            return 'array';
        }
        
        if (typeof value === 'object') {
            return 'object';
        }
        
        return 'string'; // Default fallback
    }

    // UPDATED: Only call methods that require no parameters
    // Now supports both .did.js (with real IDL types) and .did.d.ts (fallback)
    // 🔥 NEW: Supports Kontext owner pattern for admin access to all user data
    static async loadCanisterData(
        actor: any, 
        methodInfo: CanisterMethodInfo, 
        candidContent?: string,
        isDidJs?: boolean,
        isKontextOwner?: boolean // 🔥 NEW: If true, use admin methods to get all data
    ): Promise<Record<string, any>> {
        console.log('📥 [DynamicCanisterService] Loading canister data from mainnet...', {
            isKontextOwner: isKontextOwner || false,
            accessLevel: isKontextOwner ? 'ADMIN (all users)' : 'USER (own data)'
        });

        const combinedData: Record<string, any> = {};
        const successfulGetters: string[] = [];
        const failedGetters: { name: string, error: any }[] = [];
        const skippedGetters: { name: string, reason: string }[] = [];

        // 🔥 NEW: If Kontext owner, try to use admin methods for full data access
        if (isKontextOwner && typeof actor.getAllDataForKontext === 'function') {
            console.log('🔐 [DynamicCanisterService] Using Kontext admin method to fetch ALL user data...');
            try {
                const adminResult = await actor.getAllDataForKontext();
                
                if (adminResult && typeof adminResult === 'object' && 'ok' in adminResult) {
                    const allData = adminResult.ok;
                    console.log('✅ [DynamicCanisterService] Retrieved all data via Kontext admin access:', allData);
                    
                    // Convert the admin data response to our format
                    // 🔥 FIX: Filter out total* counter fields, only include actual data arrays/objects
                    if (allData && typeof allData === 'object') {
                        Object.keys(allData).forEach(key => {
                            // Skip total* counter fields (totalTasks, totalProjects, etc.)
                            if (key.startsWith('total')) {
                                console.log(`⏭️ [DynamicCanisterService] Skipping counter field: ${key} = ${allData[key]}`);
                                return;
                            }
                            
                            // Skip if value is null/undefined
                            if (allData[key] === null || allData[key] === undefined) {
                                console.log(`⏭️ [DynamicCanisterService] Skipping null/undefined field: ${key}`);
                                return;
                            }
                            
                            // Skip if value is a scalar BigInt (these are counters, not data)
                            if (typeof allData[key] === 'bigint') {
                                console.log(`⏭️ [DynamicCanisterService] Skipping BigInt counter: ${key} = ${allData[key]}`);
                                return;
                            }
                            
                            // Only include Arrays and Objects (actual data)
                            if (Array.isArray(allData[key]) || (typeof allData[key] === 'object' && allData[key] !== null)) {
                                combinedData[key] = DynamicCanisterService.convertCanisterDataToForm(allData[key]);
                                console.log(`✅ [DynamicCanisterService] Loaded admin data for ${key}: ${Array.isArray(allData[key]) ? allData[key].length + ' items' : 'object'}`);
                            }
                        });
                    }
                    
                    console.log(`✅ [DynamicCanisterService] Loaded ${Object.keys(combinedData).length} data sections via admin access`);
                    return combinedData;
                } else if (adminResult && 'err' in adminResult) {
                    console.warn('⚠️ [DynamicCanisterService] Admin method returned error:', adminResult.err);
                    // Fall back to regular methods
                }
            } catch (adminError) {
                console.warn('⚠️ [DynamicCanisterService] Admin method failed, falling back to regular methods:', adminError);
                // Fall back to regular getter methods
            }
        }

        // Standard data loading (user-isolated or no admin method available)
        console.log('📥 [DynamicCanisterService] Using standard getter methods...');
        
        // Dynamically analyze which methods require parameters
        // Prioritize .did.js for real IDL types, fallback to .did.d.ts
        const methodRequirements = await DynamicCanisterService.getMethodParameterRequirements(candidContent, isDidJs);

        for (const getter of methodInfo.getters) {
            try {
                console.log(`📥 [DynamicCanisterService] Analyzing method ${getter.name}...`);

                // Check if method exists on actor
                if (typeof actor[getter.name] !== 'function') {
                    console.warn(`📥 [DynamicCanisterService] Method ${getter.name} does not exist on actor`);
                    failedGetters.push({
                        name: getter.name,
                        error: "Method does not exist on canister or is not a function"
                    });
                    continue;
                }

                // Check if method requires parameters
                const requirements = methodRequirements.get(getter.name);
                if (requirements && requirements.hasParameters) {
                    console.log(`📥 [DynamicCanisterService] Skipping ${getter.name} - requires ${requirements.parameterCount} parameter(s)`);
                    skippedGetters.push({
                        name: getter.name,
                        reason: `Requires ${requirements.parameterCount} parameter(s) - use Query Builder to call this method with specific parameters`
                    });
                    continue;
                }

                console.log(`📥 [DynamicCanisterService] Calling parameterless method ${getter.name}...`);

                // Call the method without any parameters
                const result = await actor[getter.name]();
                console.log(`📥 [DynamicCanisterService] Raw result from ${getter.name}:`, result);

                if (result && typeof result === 'object') {
                    if ('ok' in result) {
                        const convertedValue = DynamicCanisterService.convertCanisterDataToForm(result.ok);
                        combinedData[getter.sectionName] = convertedValue;
                        successfulGetters.push(getter.name);
                    } else if ('err' in result) {
                        console.warn(`📥 [DynamicCanisterService] ${getter.name} returned error:`, result.err);
                        failedGetters.push({
                            name: getter.name,
                            error: `Canister returned error: ${result.err}`
                        });
                    } else {
                        combinedData[getter.sectionName] = DynamicCanisterService.convertCanisterDataToForm(result);
                        successfulGetters.push(getter.name);
                    }
                } else {
                    combinedData[getter.sectionName] = DynamicCanisterService.convertCanisterDataToForm(result);
                    successfulGetters.push(getter.name);
                }
            } catch (error) {
                console.warn(`📥 [DynamicCanisterService] Error calling ${getter.name}:`, error);
                
                // Provide more helpful error messages
                let errorMessage = 'Unknown error';
                if (error instanceof Error) {
                    if (error.message.includes('does not exist')) {
                        errorMessage = 'Method not found on canister';
                    } else if (error.message.includes('Caller not authorized')) {
                        errorMessage = 'Not authorized to call this method';
                    } else if (error.message.includes('Canister trapped')) {
                        errorMessage = 'Canister execution failed';
                    } else if (error.message.includes('Wrong number of message arguments')) {
                        errorMessage = 'Method requires parameters - use Query Builder to call with specific parameters';
                        // Also add to skipped list for better UX
                        skippedGetters.push({
                            name: getter.name,
                            reason: 'Detected as requiring parameters during execution'
                        });
                    } else {
                        errorMessage = error.message;
                    }
                }
                
                failedGetters.push({
                    name: getter.name,
                    error: errorMessage
                });
            }
        }

        console.log('📥 [DynamicCanisterService] Mainnet data loading complete:', {
            successful: successfulGetters,
            failed: failedGetters.length,
            skipped: skippedGetters.length,
            sections: Object.keys(combinedData)
        });

        // Log skipped methods for user awareness
        if (skippedGetters.length > 0) {
            console.info('ℹ️ [DynamicCanisterService] Methods skipped (require parameters):', skippedGetters);
        }

        // Log failed methods for debugging
        if (failedGetters.length > 0) {
            console.warn('⚠️ [DynamicCanisterService] Method calls failed:', failedGetters);
        }

        // NEW: Only fail if ALL methods failed AND we had no successful calls AND no skipped methods
        // This means the canister is completely inaccessible
        if (successfulGetters.length === 0 && skippedGetters.length === 0 && failedGetters.length > 0) {
            const errorSummary = failedGetters.map(f => `${f.name}: ${f.error}`).join('; ');
            throw new Error(`All canister method calls failed and no methods were available without parameters. ${errorSummary}`);
        }

        // If we have some data OR some methods that can be called via query builder, that's success
        if (successfulGetters.length > 0) {
            console.log(`✅ [DynamicCanisterService] Successfully loaded data from ${successfulGetters.length} method(s)`);
        }

        if (skippedGetters.length > 0) {
            console.log(`ℹ️ [DynamicCanisterService] ${skippedGetters.length} method(s) available via Query Builder for manual execution`);
        }

        return combinedData;
    }

    static async saveCanisterData(
        actor: any,
        methodInfo: CanisterMethodInfo,
        currentData: Record<string, any>,
        originalData: Record<string, any>
    ): Promise<void> {
        console.log('💾 [DynamicCanisterService] Saving canister data to mainnet...');

        const changedSections = DynamicCanisterService.findChangedSections(currentData, originalData);
        const changedSectionIds = Object.entries(changedSections)
            .filter(([_, isChanged]) => isChanged)
            .map(([sectionId, _]) => sectionId);

        if (changedSectionIds.length === 0) {
            console.log('💾 [DynamicCanisterService] No changes detected');
            return;
        }

        // Create section to setter map
        const sectionToSetterMap = new Map();
        methodInfo.setters.forEach(setter => {
            sectionToSetterMap.set(setter.sectionName, setter.name);
        });

        const savePromises = changedSectionIds.map(async (sectionId) => {
            const setterName = sectionToSetterMap.get(sectionId);

            if (!setterName || typeof actor[setterName] !== 'function') {
                throw new Error(`No setter method found for section "${sectionId}" on mainnet canister`);
            }

            const sectionData = DynamicCanisterService.convertFormDataToCanister(currentData[sectionId]);
            console.log(`💾 [DynamicCanisterService] Calling mainnet setter ${setterName} with:`, sectionData);

            try {
                const result = await actor[setterName](sectionData);

                if (result && typeof result === 'object' && 'err' in result) {
                    throw new Error(`Mainnet canister ${setterName} failed: ${result.err}`);
                }

                console.log(`✅ [DynamicCanisterService] Successfully saved section to mainnet: ${sectionId}`);
            } catch (error) {
                if (error instanceof Error) {
                    if (error.message.includes('Caller not authorized')) {
                        throw new Error(`Not authorized to modify section "${sectionId}" on mainnet canister`);
                    } else if (error.message.includes('Canister trapped')) {
                        throw new Error(`Canister execution failed while saving section "${sectionId}"`);
                    }
                }
                throw error;
            }
        });

        await Promise.all(savePromises);
        console.log('✅ [DynamicCanisterService] All changes saved successfully to mainnet');
    }

    private static findChangedSections(currentData: any, originalData: any): Record<string, boolean> {
        const changedSections: Record<string, boolean> = {};

        if (!currentData || !originalData) {
            return changedSections;
        }

        const isEqual = (obj1: any, obj2: any): boolean => {
            if (obj1 === obj2) return true;
            if (obj1 == null || obj2 == null) return obj1 === obj2;
            if (typeof obj1 !== typeof obj2) return false;

            if (Array.isArray(obj1) && Array.isArray(obj2)) {
                if (obj1.length !== obj2.length) return false;
                for (let i = 0; i < obj1.length; i++) {
                    if (!isEqual(obj1[i], obj2[i])) return false;
                }
                return true;
            }

            if (typeof obj1 === 'object' && typeof obj2 === 'object') {
                const keys1 = Object.keys(obj1);
                const keys2 = Object.keys(obj2);

                if (keys1.length !== keys2.length) return false;
                return keys1.every(key =>
                    obj2.hasOwnProperty(key) && isEqual(obj1[key], obj2[key])
                );
            }

            return false;
        };

        const allSectionIds = new Set([
            ...Object.keys(currentData),
            ...Object.keys(originalData)
        ]);

        allSectionIds.forEach(sectionId => {
            const currentSection = currentData[sectionId];
            const originalSection = originalData[sectionId];

            if (!originalSection && currentSection) {
                changedSections[sectionId] = true;
            } else if (originalSection && !currentSection) {
                changedSections[sectionId] = true;
            } else {
                changedSections[sectionId] = !isEqual(currentSection, originalSection);
            }
        });

        return changedSections;
    }
}