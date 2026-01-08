export interface CanisterMethodInfo {
    getters: Array<{ name: string; sectionName: string }>;
    setters: Array<{ name: string; sectionName: string }>;
    queries: Array<{ name: string; sectionName: string }>;
    updates: Array<{ name: string; sectionName: string }>;
}

export class CanisterMethodDiscovery {
    private static readonly LOGGING_METHODS = new Set([
        'logs', 'newlogssince', 'loggerconfig', 'logsequence', 'logsbyLevel',
        'logslevel', 'logsconfig', 'logconfig', 'loginfo', 'logwarn',
        'logerror', 'logdebug', 'clearalllogs', 'cleanlogs', 'testlogsequence',
        'updateloggerconfig'
    ]);

    private static formatSectionName(methodName: string): string {
        // Convert method name to section name by removing prefixes and suffixes
        let sectionName = methodName
            .replace(/^(get|set|update|create|delete|list)/, '')
            .replace(/Config$/, '')
            .replace(/s$/, ''); // Remove plural 's'

        // Convert to camelCase
        sectionName = sectionName.charAt(0).toLowerCase() + sectionName.slice(1);
        
        if (sectionName.length === 0) {
            sectionName = methodName.toLowerCase();
        }

        return sectionName;
    }

    private static isLoggingMethod(methodName: string): boolean {
        const lowerName = methodName.toLowerCase();
        return Array.from(CanisterMethodDiscovery.LOGGING_METHODS).some(logMethod => 
            lowerName.includes(logMethod)
        );
    }

    static parseCanisterMethods(candidContent: string): CanisterMethodInfo {
        console.log('🔍 [CanisterMethodDiscovery] Parsing canister methods...');

        const methodInfo: CanisterMethodInfo = {
            getters: [],
            setters: [],
            queries: [],
            updates: []
        };

        try {
            // Parse getter methods - methods that return data
            const getterPatterns = [
                /'(get[A-Za-z]+)'\s*:\s*ActorMethod/g,
                /'(list[A-Za-z]+)'\s*:\s*ActorMethod/g,
                /'(find[A-Za-z]+)'\s*:\s*ActorMethod/g,
                /'(fetch[A-Za-z]+)'\s*:\s*ActorMethod/g
            ];

            getterPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(candidContent)) !== null) {
                    const methodName = match[1];
                    
                    if (CanisterMethodDiscovery.isLoggingMethod(methodName)) {
                        console.log(`🔍 [CanisterMethodDiscovery] Skipping logging getter: ${methodName}`);
                        continue;
                    }

                    const sectionName = CanisterMethodDiscovery.formatSectionName(methodName);
                    
                    console.log(`🔍 [CanisterMethodDiscovery] Found getter: ${methodName} -> ${sectionName}`);
                    methodInfo.getters.push({ name: methodName, sectionName });
                }
            });

            // Parse setter methods - methods that modify data
            const setterPatterns = [
                /'(set[A-Za-z]+)'\s*:\s*ActorMethod/g,
                /'(update[A-Za-z]+)'\s*:\s*ActorMethod/g,
                /'(create[A-Za-z]+)'\s*:\s*ActorMethod/g,
                /'(add[A-Za-z]+)'\s*:\s*ActorMethod/g,
                /'(save[A-Za-z]+)'\s*:\s*ActorMethod/g
            ];

            setterPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(candidContent)) !== null) {
                    const methodName = match[1];
                    
                    if (CanisterMethodDiscovery.isLoggingMethod(methodName)) {
                        console.log(`🔍 [CanisterMethodDiscovery] Skipping logging setter: ${methodName}`);
                        continue;
                    }

                    const sectionName = CanisterMethodDiscovery.formatSectionName(methodName);
                    
                    console.log(`🔍 [CanisterMethodDiscovery] Found setter: ${methodName} -> ${sectionName}`);
                    methodInfo.setters.push({ name: methodName, sectionName });
                }
            });

            // Parse query methods (read-only operations)
            const queryPattern = /'([^']+)'\s*:\s*ActorMethod<[^>]*>,\s*\[.*'query'.*\]/g;
            let match;
            while ((match = queryPattern.exec(candidContent)) !== null) {
                const methodName = match[1];
                
                if (CanisterMethodDiscovery.isLoggingMethod(methodName)) {
                    continue;
                }

                const sectionName = CanisterMethodDiscovery.formatSectionName(methodName);
                
                console.log(`🔍 [CanisterMethodDiscovery] Found query: ${methodName} -> ${sectionName}`);
                methodInfo.queries.push({ name: methodName, sectionName });
            }

            // Parse update methods (state-changing operations)
            const allMethodPattern = /'([^']+)'\s*:\s*ActorMethod/g;
            const allMethods = [];
            while ((match = allMethodPattern.exec(candidContent)) !== null) {
                allMethods.push(match[1]);
            }

            // Updates are methods that are not queries and not getters
            allMethods.forEach(methodName => {
                if (CanisterMethodDiscovery.isLoggingMethod(methodName)) {
                    return;
                }

                const isQuery = methodInfo.queries.some(q => q.name === methodName);
                const isGetter = methodInfo.getters.some(g => g.name === methodName);
                const isSetter = methodInfo.setters.some(s => s.name === methodName);

                if (!isQuery && !isGetter && !isSetter) {
                    const sectionName = CanisterMethodDiscovery.formatSectionName(methodName);
                    console.log(`🔍 [CanisterMethodDiscovery] Found update: ${methodName} -> ${sectionName}`);
                    methodInfo.updates.push({ name: methodName, sectionName });
                }
            });

        } catch (error) {
            console.error('❌ [CanisterMethodDiscovery] Error parsing methods:', error);
        }

        console.log('🔍 [CanisterMethodDiscovery] Method discovery complete:', {
            getters: methodInfo.getters.length,
            setters: methodInfo.setters.length,
            queries: methodInfo.queries.length,
            updates: methodInfo.updates.length
        });

        return methodInfo;
    }

    static getMethodsBySection(methodInfo: CanisterMethodInfo): Record<string, any> {
        const sectionMethods: Record<string, any> = {};

        // Group all methods by section
        [...methodInfo.getters, ...methodInfo.setters, ...methodInfo.queries, ...methodInfo.updates].forEach(method => {
            if (!sectionMethods[method.sectionName]) {
                sectionMethods[method.sectionName] = {
                    getters: [],
                    setters: [],
                    queries: [],
                    updates: []
                };
            }
        });

        methodInfo.getters.forEach(getter => {
            if (sectionMethods[getter.sectionName]) {
                sectionMethods[getter.sectionName].getters.push(getter);
            }
        });

        methodInfo.setters.forEach(setter => {
            if (sectionMethods[setter.sectionName]) {
                sectionMethods[setter.sectionName].setters.push(setter);
            }
        });

        methodInfo.queries.forEach(query => {
            if (sectionMethods[query.sectionName]) {
                sectionMethods[query.sectionName].queries.push(query);
            }
        });

        methodInfo.updates.forEach(update => {
            if (sectionMethods[update.sectionName]) {
                sectionMethods[update.sectionName].updates.push(update);
            }
        });

        return sectionMethods;
    }

    static validateMethodInfo(methodInfo: CanisterMethodInfo): boolean {
        const hasAnyMethods = 
            methodInfo.getters.length > 0 ||
            methodInfo.setters.length > 0 ||
            methodInfo.queries.length > 0 ||
            methodInfo.updates.length > 0;

        if (!hasAnyMethods) {
            console.warn('⚠️ [CanisterMethodDiscovery] No valid methods found in canister interface');
            return false;
        }

        return true;
    }
}