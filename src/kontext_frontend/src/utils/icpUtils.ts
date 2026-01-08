import { Principal } from '@dfinity/principal';
import { Actor, ActorSubclass, HttpAgent } from '@dfinity/agent';
import { createAgent } from '@dfinity/utils';
import { ICManagementCanister } from '@dfinity/ic-management';

// Constants for conversion
const CYCLES_PER_XDR = BigInt(1_000_000_000_000); // 1T cycles per XDR
const E8S_PER_ICP = BigInt(100_000_000); // 100M e8s per ICP

// Hardcoded pricing: $2 for 1000 credits / 1 TB cycles
const USD_PER_1000_CREDITS = 2.00;
const CREDITS_PER_TB = 1000;
const CYCLES_PER_TB = BigInt(1_000_000_000_000); // 1T cycles

// Interface for the Cycles Minting Canister
interface CMCInterface {
    get_icp_xdr_conversion_rate: () => Promise<{
        data: {
            xdr_permyriad_per_icp: bigint;
            timestamp_seconds: bigint;
        };
    }>;
}

// Cache for conversion rate
interface ConversionRateCache {
    xdrPermyriadPerIcp: number;
    timestamp: number;
    cyclesPerIcp: bigint;
}

let conversionRateCache: ConversionRateCache | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Create IDL factory for the CMC
const cmcIdlFactory = ({ IDL }: { IDL: any }) => {
    return IDL.Service({
        'get_icp_xdr_conversion_rate': IDL.Func(
            [],
            [IDL.Record({
                'data': IDL.Record({
                    'xdr_permyriad_per_icp': IDL.Nat64,
                    'timestamp_seconds': IDL.Nat64,
                }),
                'certificate': IDL.Vec(IDL.Nat8),
                'hash_tree': IDL.Vec(IDL.Nat8),
            })],
            ['query'],
        ),
    });
};

/**
 * Gets a canister's cycle balance using the IC Management Canister
 */
export const getCanisterCycleBalance = async (
    canisterId: Principal,
    identity?: any
): Promise<bigint> => {
    try {
        console.log(`🔍 [ICPUtils] [getCanisterCycleBalance] Starting cycle balance fetch for: ${canisterId.toText()}`);
        
        // Get the host based on environment
        const host = "https://icp0.io";
        console.log(`🌐 [ICPUtils] [getCanisterCycleBalance] Using host: ${host}`);

        // Create an agent
        const agent = await createAgent({
            host,
            identity: identity
        });
        
        console.log(`🤖 [ICPUtils] [getCanisterCycleBalance] Agent created successfully`);

        // Create the management canister instance
        const managementCanister = ICManagementCanister.create({
            agent,
        });

        console.log(`📋 [ICPUtils] [getCanisterCycleBalance] Management canister instance created`);

        // Get the canister status
        const status = await managementCanister.canisterStatus(canisterId);

        console.log(`✅ [ICPUtils] [getCanisterCycleBalance] Successfully fetched cycle balance for ${canisterId.toText()}: ${status.cycles.toString()}`);
        console.log(`📊 [ICPUtils] [getCanisterCycleBalance] Additional status info:`, {
            cycles: status.cycles.toString(),
            cyclesInTrillions: (Number(status.cycles) / 1_000_000_000_000).toFixed(3) + 'T',
            status: status.status,
            memory_size: status.memory_size?.toString() || 'unknown'
        });

        return status.cycles;
    } catch (error) {
        console.error(`❌ [ICPUtils] [getCanisterCycleBalance] Error fetching cycle balance for ${canisterId.toText()}:`, error);
        console.error(`🔍 [ICPUtils] [getCanisterCycleBalance] Error details:`, {
            errorType: typeof error,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            errorStack: error instanceof Error ? error.stack : 'No stack trace'
        });
        return BigInt(0);
    }
};

/**
 * Creates an actor for the Cycles Minting Canister
 */
const createCMCActor = async (identity?: any): Promise<ActorSubclass<CMCInterface>> => {
    console.log(`🏭 [ICPUtils] [createCMCActor] Creating CMC Actor...`);
    
    // Get the host based on environment
    const host = "https://icp0.io";
    console.log(`🌐 [ICPUtils] [createCMCActor] Using host: ${host}`);

    // Create an agent
    const agent = new HttpAgent({
        host,
        identity,
    });
    
    console.log(`🤖 [ICPUtils] [createCMCActor] HttpAgent created with identity:`, {
        hasIdentity: !!identity,
        identityType: typeof identity,
        host
    });

    // The CMC canister ID
    const cmcCanisterId = Principal.fromText("rkp4c-7iaaa-aaaaa-aaaca-cai");
    console.log(`🎯 [ICPUtils] [createCMCActor] CMC Canister ID: ${cmcCanisterId.toText()}`);

    // Create the actor
    const actor = Actor.createActor<CMCInterface>(cmcIdlFactory, {
        agent,
        canisterId: cmcCanisterId,
    });
    
    console.log(`✅ [ICPUtils] [createCMCActor] CMC Actor created successfully`);
    return actor;
};

/**
 * Gets the current ICP to XDR conversion rate
 */
export const getIcpXdrConversionRate = async (identity?: any): Promise<bigint> => {
    console.log(`🔄 [ICPUtils] [getIcpXdrConversionRate] Starting ICP-XDR conversion rate fetch...`);
    
    // Check cache first
    const now = Date.now();
    if (conversionRateCache && now - conversionRateCache.timestamp < CACHE_TTL) {
        console.log(`💾 [ICPUtils] [getIcpXdrConversionRate] Using cached conversion rate:`, {
            cacheAge: Math.round((now - conversionRateCache.timestamp) / 1000) + 's',
            xdrPermyriadPerIcp: conversionRateCache.xdrPermyriadPerIcp,
            cyclesPerIcp: conversionRateCache.cyclesPerIcp.toString(),
            cyclesPerIcpInTrillions: (Number(conversionRateCache.cyclesPerIcp) / 1_000_000_000_000).toFixed(3) + 'T'
        });
        return conversionRateCache.cyclesPerIcp;
    }

    console.log(`🆕 [ICPUtils] [getIcpXdrConversionRate] Cache miss or expired, fetching fresh data...`);
    console.log(`📋 [ICPUtils] [getIcpXdrConversionRate] Cache TTL: ${CACHE_TTL}ms (${CACHE_TTL/1000/60} minutes)`);

    try {
        console.log(`🏗️ [ICPUtils] [getIcpXdrConversionRate] Creating CMC actor...`);
        // Create the CMC actor
        const cmcActor = await createCMCActor(identity);
        
        console.log(`📞 [ICPUtils] [getIcpXdrConversionRate] Calling CMC get_icp_xdr_conversion_rate...`);
        // Call the get_icp_xdr_conversion_rate method
        const result = await cmcActor.get_icp_xdr_conversion_rate();
        
        console.log(`✅ [ICPUtils] [getIcpXdrConversionRate] CMC call succeeded! Raw result:`, {
            resultType: typeof result,
            hasData: !!result.data,
            dataType: typeof result.data,
            rawResult: result
        });
        
        console.log(`🔍 [ICPUtils] [getIcpXdrConversionRate] CMC data breakdown:`, {
            xdr_permyriad_per_icp_raw: result.data.xdr_permyriad_per_icp,
            xdr_permyriad_per_icp_type: typeof result.data.xdr_permyriad_per_icp,
            xdr_permyriad_per_icp_string: result.data.xdr_permyriad_per_icp.toString(),
            timestamp_seconds_raw: result.data.timestamp_seconds,
            timestamp_seconds_string: result.data.timestamp_seconds.toString(),
            timestamp_date: new Date(Number(result.data.timestamp_seconds) * 1000).toISOString()
        });

        // Extract the conversion rate
        const xdrPermyriadPerIcp = Number(result.data.xdr_permyriad_per_icp);
        
        console.log(`🔢 [ICPUtils] [getIcpXdrConversionRate] Conversion from BigInt to Number:`, {
            originalBigInt: result.data.xdr_permyriad_per_icp.toString(),
            convertedNumber: xdrPermyriadPerIcp,
            conversionSuccessful: !isNaN(xdrPermyriadPerIcp),
            isFinite: isFinite(xdrPermyriadPerIcp)
        });

        // Calculate cycles per ICP
        console.log(`🧮 [ICPUtils] [getIcpXdrConversionRate] Starting cycles per ICP calculation...`);
        console.log(`📐 [ICPUtils] [getIcpXdrConversionRate] Calculation inputs:`, {
            xdrPermyriadPerIcp,
            CYCLES_PER_XDR: CYCLES_PER_XDR.toString(),
            CYCLES_PER_XDR_inTrillions: (Number(CYCLES_PER_XDR) / 1_000_000_000_000).toFixed(3) + 'T',
            divisionBy: 10_000,
            formula: '(xdrPermyriad * CYCLES_PER_XDR) / 10_000'
        });

        // Step-by-step calculation with logging
        const step1_xdrPermyriadBigInt = BigInt(xdrPermyriadPerIcp);
        const step2_multiplication = step1_xdrPermyriadBigInt * CYCLES_PER_XDR;
        const step3_division = step2_multiplication / BigInt(10_000);
        const cyclesPerIcp = step3_division;
        
        console.log(`🔍 [ICPUtils] [getIcpXdrConversionRate] Step-by-step calculation:`, {
            step1_xdrPermyriadBigInt: step1_xdrPermyriadBigInt.toString(),
            step2_multiplication: step2_multiplication.toString(),
            step2_multiplicationInTrillions: (Number(step2_multiplication) / 1_000_000_000_000).toFixed(3) + 'T',
            step3_division: step3_division.toString(),
            step3_divisionInTrillions: (Number(step3_division) / 1_000_000_000_000).toFixed(3) + 'T',
            finalCyclesPerIcp: cyclesPerIcp.toString(),
            finalCyclesPerIcpInTrillions: (Number(cyclesPerIcp) / 1_000_000_000_000).toFixed(3) + 'T'
        });

        // Sanity checks
        const cyclesPerIcpInTrillions = Number(cyclesPerIcp) / 1_000_000_000_000;
        const isReasonable = cyclesPerIcpInTrillions >= 1 && cyclesPerIcpInTrillions <= 50;
        
        console.log(`🔍 [ICPUtils] [getIcpXdrConversionRate] Sanity checks:`, {
            cyclesPerIcpInTrillions,
            isReasonable,
            expectedRange: '1T - 50T cycles per ICP',
            withinRange: isReasonable
        });

        if (!isReasonable) {
            console.warn(`⚠️ [ICPUtils] [getIcpXdrConversionRate] WARNING: Calculated cycles per ICP seems unreasonable: ${cyclesPerIcpInTrillions}T`);
            console.warn(`🔍 [ICPUtils] [getIcpXdrConversionRate] This might indicate:`, {
                possibleIssues: [
                    'CMC data format has changed',
                    'Units are different than expected',
                    'Calculation error in formula',
                    'Network returned corrupted data'
                ],
                rawXdrPermyriad: xdrPermyriadPerIcp,
                shouldBeAround: '7000-8000 for normal ICP prices'
            });
        }

        // Calculate what this means in real terms
        const impliedXdrPerIcp = xdrPermyriadPerIcp / 10_000;
        const currentIcpPriceEst = impliedXdrPerIcp * 1.36; // Assuming XDR ≈ $1.36
        
        console.log(`💰 [ICPUtils] [getIcpXdrConversionRate] Implied market rates:`, {
            xdrPerIcp: impliedXdrPerIcp.toFixed(4),
            estimatedIcpPriceUSD: '$' + currentIcpPriceEst.toFixed(2),
            cyclesPerDollar: currentIcpPriceEst > 0 ? (Number(cyclesPerIcp) / currentIcpPriceEst / 1_000_000_000_000).toFixed(2) + 'T' : 'unknown'
        });

        // Update cache
        conversionRateCache = {
            xdrPermyriadPerIcp,
            timestamp: now,
            cyclesPerIcp,
        };
        
        console.log(`💾 [ICPUtils] [getIcpXdrConversionRate] Cache updated:`, {
            cacheTimestamp: new Date(now).toISOString(),
            cacheTTL: CACHE_TTL + 'ms',
            expiresAt: new Date(now + CACHE_TTL).toISOString()
        });

        console.log(`🎉 [ICPUtils] [getIcpXdrConversionRate] Final result:`, {
            cyclesPerIcp: cyclesPerIcp.toString(),
            cyclesPerIcpInTrillions: (Number(cyclesPerIcp) / 1_000_000_000_000).toFixed(3) + 'T',
            xdrPermyriadPerIcp,
            calculationTimestamp: new Date().toISOString()
        });

        return cyclesPerIcp;
    } catch (error) {
        console.error(`❌ [ICPUtils] [getIcpXdrConversionRate] Error fetching conversion rate:`, error);
        console.error(`🔍 [ICPUtils] [getIcpXdrConversionRate] Error analysis:`, {
            errorType: typeof error,
            errorName: error instanceof Error ? error.name : 'Unknown',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            errorStack: error instanceof Error ? error.stack : 'No stack trace',
            isNetworkError: error instanceof Error && error.message.includes('network'),
            isTimeoutError: error instanceof Error && error.message.includes('timeout'),
            isCertificateError: error instanceof Error && error.message.includes('certificate')
        });

        // Fallback to a default rate
        const fallbackRate = BigInt(10_000_000_000_000); // 10T cycles per ICP
        const fallbackCacheAge = conversionRateCache ? Math.round((now - conversionRateCache.timestamp) / 1000) : null;
        
        console.log(`🔄 [ICPUtils] [getIcpXdrConversionRate] Attempting fallback strategies:`, {
            hasCachedData: !!conversionRateCache,
            cachedDataAge: fallbackCacheAge ? fallbackCacheAge + 's' : 'none',
            fallbackRate: fallbackRate.toString(),
            fallbackRateInTrillions: (Number(fallbackRate) / 1_000_000_000_000).toFixed(1) + 'T'
        });

        // Use cached data if available, even if expired
        if (conversionRateCache) {
            console.log(`💾 [ICPUtils] [getIcpXdrConversionRate] Using expired cache as fallback:`, {
                cacheAge: fallbackCacheAge + 's',
                cachedRate: conversionRateCache.cyclesPerIcp.toString(),
                cachedRateInTrillions: (Number(conversionRateCache.cyclesPerIcp) / 1_000_000_000_000).toFixed(3) + 'T'
            });
            return conversionRateCache.cyclesPerIcp;
        }

        console.log(`⚠️ [ICPUtils] [getIcpXdrConversionRate] Using hardcoded fallback rate: ${Number(fallbackRate) / 1_000_000_000_000}T cycles per ICP`);
        return fallbackRate;
    }
};

/**
 * Simple fallback implementation with fixed rate
 */
export const icpToCyclesSimple = (icpE8s: bigint): bigint => {
    console.log(`🔢 [ICPUtils] [icpToCyclesSimple] Simple conversion called:`, {
        inputIcpE8s: icpE8s.toString(),
        inputIcpAmount: (Number(icpE8s) / Number(E8S_PER_ICP)).toFixed(8) + ' ICP'
    });

    const TRILLION = BigInt(1_000_000_000_000);
    const cyclesPerIcp = BigInt(10) * TRILLION; // 10T cycles per ICP
    const cyclesPerE8s = cyclesPerIcp / E8S_PER_ICP;
    const result = icpE8s * cyclesPerE8s;
    
    console.log(`🧮 [ICPUtils] [icpToCyclesSimple] Simple conversion calculation:`, {
        TRILLION: TRILLION.toString(),
        cyclesPerIcp: cyclesPerIcp.toString(),
        cyclesPerIcpInTrillions: (Number(cyclesPerIcp) / 1_000_000_000_000) + 'T',
        E8S_PER_ICP: E8S_PER_ICP.toString(),
        cyclesPerE8s: cyclesPerE8s.toString(),
        resultCycles: result.toString(),
        resultCyclesInTrillions: (Number(result) / 1_000_000_000_000).toFixed(3) + 'T'
    });

    return result;
};

/**
 * Convert ICP amount to equivalent cycles
 */
export const icpToCycles = async (
    icpE8s: bigint,
    identity?: any
): Promise<{
    cycles: bigint;
    rate: number;
}> => {
    console.log(`🔄 [ICPUtils] [icpToCycles] Converting ICP to cycles:`, {
        inputIcpE8s: icpE8s.toString(),
        inputIcpAmount: (Number(icpE8s) / Number(E8S_PER_ICP)).toFixed(8) + ' ICP',
        hasIdentity: !!identity
    });

    try {
        // Get the conversion rate (cycles per ICP)
        console.log(`📞 [ICPUtils] [icpToCycles] Fetching conversion rate...`);
        const cyclesPerIcp = await getIcpXdrConversionRate(identity);
        
        console.log(`✅ [ICPUtils] [icpToCycles] Conversion rate received:`, {
            cyclesPerIcp: cyclesPerIcp.toString(),
            cyclesPerIcpInTrillions: (Number(cyclesPerIcp) / 1_000_000_000_000).toFixed(3) + 'T'
        });

        // Calculate the cycles per e8s
        const cyclesPerE8s = cyclesPerIcp / E8S_PER_ICP;
        console.log(`🧮 [ICPUtils] [icpToCycles] Cycles per e8s:`, {
            cyclesPerE8s: cyclesPerE8s.toString(),
            E8S_PER_ICP: E8S_PER_ICP.toString()
        });

        // Calculate the cycles for the given ICP amount
        const cycles = icpE8s * cyclesPerE8s;
        console.log(`💰 [ICPUtils] [icpToCycles] Final calculation:`, {
            inputIcpE8s: icpE8s.toString(),
            cyclesPerE8s: cyclesPerE8s.toString(),
            resultCycles: cycles.toString(),
            resultCyclesInTrillions: (Number(cycles) / 1_000_000_000_000).toFixed(3) + 'T'
        });

        // Calculate the rate in trillion cycles per ICP for display
        const rateInTrillions = Number(cyclesPerIcp) / 1_000_000_000_000;
        
        console.log(`📊 [ICPUtils] [icpToCycles] Conversion summary:`, {
            inputICP: (Number(icpE8s) / Number(E8S_PER_ICP)).toFixed(8),
            outputCycles: cycles.toString(),
            outputCyclesInTrillions: (Number(cycles) / 1_000_000_000_000).toFixed(3) + 'T',
            rateTrillionCyclesPerICP: rateInTrillions.toFixed(3)
        });

        return {
            cycles,
            rate: rateInTrillions,
        };
    } catch (error) {
        console.error(`❌ [ICPUtils] [icpToCycles] Error converting ICP to cycles:`, error);
        console.error(`🔍 [ICPUtils] [icpToCycles] Error details:`, {
            errorType: typeof error,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            inputIcpE8s: icpE8s.toString()
        });

        // Use the simple implementation as fallback
        console.log(`🔄 [ICPUtils] [icpToCycles] Falling back to simple implementation...`);
        const cycles = icpToCyclesSimple(icpE8s);
        const fallbackRate = 10.0; // Default 10T cycles per ICP
        
        console.log(`⚠️ [ICPUtils] [icpToCycles] Fallback result:`, {
            cycles: cycles.toString(),
            cyclesInTrillions: (Number(cycles) / 1_000_000_000_000).toFixed(3) + 'T',
            rate: fallbackRate,
            method: 'simple_fallback'
        });

        return {
            cycles,
            rate: fallbackRate,
        };
    }
};

/**
 * Convert credits to cycles (our platform's core conversion)
 */
export const creditsToTBCycles = (credits: number): number => {
    console.log(`🔄 [ICPUtils] [creditsToTBCycles] Converting credits to TB cycles:`, {
        inputCredits: credits,
        CREDITS_PER_TB,
        formula: 'credits / CREDITS_PER_TB'
    });

    // 1000 credits = 1 TB cycles
    const result = credits / CREDITS_PER_TB;
    
    console.log(`✅ [ICPUtils] [creditsToTBCycles] Conversion result:`, {
        inputCredits: credits,
        outputTBCycles: result,
        formula: `${credits} / ${CREDITS_PER_TB} = ${result}`
    });

    return result;
};

/**
 * Convert TB cycles to credits
 */
export const tbCyclesToCredits = (tbCycles: number): number => {
    console.log(`🔄 [ICPUtils] [tbCyclesToCredits] Converting TB cycles to credits:`, {
        inputTBCycles: tbCycles,
        CREDITS_PER_TB,
        formula: 'tbCycles * CREDITS_PER_TB'
    });

    // 1 TB cycles = 1000 credits
    const result = tbCycles * CREDITS_PER_TB;
    
    console.log(`✅ [ICPUtils] [tbCyclesToCredits] Conversion result:`, {
        inputTBCycles: tbCycles,
        outputCredits: result,
        formula: `${tbCycles} * ${CREDITS_PER_TB} = ${result}`
    });

    return result;
};

/**
 * Calculate ICP needed to purchase specific TB of cycles
 */
export const calculateICPForTBCycles = async (
    tbCycles: number,
    identity?: any
): Promise<{
    icpE8s: bigint;
    rate: number;
}> => {
    console.log(`🧮 [ICPUtils] [calculateICPForTBCycles] Calculating ICP needed for TB cycles:`, {
        inputTBCycles: tbCycles,
        hasIdentity: !!identity
    });

    try {
        // Get current conversion rate
        const cyclesPerIcp = await getIcpXdrConversionRate(identity);
        const rateInTrillions = Number(cyclesPerIcp) / 1_000_000_000_000;
        
        console.log(`📊 [ICPUtils] [calculateICPForTBCycles] Rate information:`, {
            cyclesPerIcp: cyclesPerIcp.toString(),
            rateInTrillions,
            rateFormatted: rateInTrillions.toFixed(3) + 'T cycles per ICP'
        });
        
        // Calculate ICP needed
        const icpNeeded = tbCycles / rateInTrillions;
        const icpE8s = BigInt(Math.ceil(icpNeeded * 100_000_000)); // Convert to e8s
        
        console.log(`💰 [ICPUtils] [calculateICPForTBCycles] ICP calculation:`, {
            tbCyclesNeeded: tbCycles,
            rateInTrillions,
            icpNeededFloat: icpNeeded,
            icpNeededCeiled: Math.ceil(icpNeeded * 100_000_000) / 100_000_000,
            icpE8s: icpE8s.toString(),
            formula: `${tbCycles} TB / ${rateInTrillions.toFixed(3)}T per ICP = ${icpNeeded.toFixed(8)} ICP`
        });
        
        return {
            icpE8s,
            rate: rateInTrillions,
        };
    } catch (error) {
        console.error(`❌ [ICPUtils] [calculateICPForTBCycles] Error calculating ICP for TB cycles:`, error);
        console.error(`🔍 [ICPUtils] [calculateICPForTBCycles] Error details:`, {
            errorType: typeof error,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            inputTBCycles: tbCycles
        });
        
        // Fallback calculation
        const defaultRate = 10.0; // 10T cycles per ICP
        const icpNeeded = tbCycles / defaultRate;
        const icpE8s = BigInt(Math.ceil(icpNeeded * 100_000_000));
        
        console.log(`⚠️ [ICPUtils] [calculateICPForTBCycles] Fallback calculation:`, {
            defaultRate,
            icpNeeded,
            icpE8s: icpE8s.toString(),
            method: 'fallback_default_rate'
        });
        
        return {
            icpE8s,
            rate: defaultRate,
        };
    }
};

/**
 * Format cycles to a human-readable string
 */
export const formatCycles = (cycles: bigint): string => {
    const trillion = BigInt(1_000_000_000_000);
    const billion = BigInt(1_000_000_000);
    const million = BigInt(1_000_000);

    let result: string;
    if (cycles >= trillion) {
        result = `${(Number(cycles) / Number(trillion)).toFixed(2)}T`;
    } else if (cycles >= billion) {
        result = `${(Number(cycles) / Number(billion)).toFixed(2)}B`;
    } else if (cycles >= million) {
        result = `${(Number(cycles) / Number(million)).toFixed(2)}M`;
    } else {
        result = cycles.toString();
    }
    
    console.log(`📝 [ICPUtils] [formatCycles] Formatting cycles:`, {
        inputCycles: cycles.toString(),
        formattedResult: result
    });

    return result;
};

/**
 * Format ICP balance to a human-readable string
 */
export const formatIcpBalance = (balance: bigint): string => {
    const balanceNum = Number(balance) / Number(E8S_PER_ICP);
    const result = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8
    }).format(balanceNum);
    
    console.log(`📝 [ICPUtils] [formatIcpBalance] Formatting ICP balance:`, {
        inputBalance: balance.toString(),
        balanceNum,
        formattedResult: result
    });

    return result;
};

/**
 * Convert USD amount to credits
 */
export const usdToCredits = (usdAmount: number): number => {
    console.log(`💵 [ICPUtils] [usdToCredits] Converting USD to credits:`, {
        inputUSD: usdAmount,
        USD_PER_1000_CREDITS,
        CREDITS_PER_TB,
        formula: '(usdAmount / USD_PER_1000_CREDITS) * CREDITS_PER_TB'
    });

    const result = Math.floor((usdAmount / USD_PER_1000_CREDITS) * CREDITS_PER_TB);
    
    console.log(`✅ [ICPUtils] [usdToCredits] Conversion result:`, {
        inputUSD: usdAmount,
        outputCredits: result,
        calculation: `Math.floor((${usdAmount} / ${USD_PER_1000_CREDITS}) * ${CREDITS_PER_TB}) = ${result}`
    });

    return result;
};

/**
 * Convert credits to USD amount
 */
export const creditsToUsd = (credits: number): number => {
    console.log(`💰 [ICPUtils] [creditsToUsd] Converting credits to USD:`, {
        inputCredits: credits,
        CREDITS_PER_TB,
        USD_PER_1000_CREDITS,
        formula: '(credits / CREDITS_PER_TB) * USD_PER_1000_CREDITS'
    });

    const result = (credits / CREDITS_PER_TB) * USD_PER_1000_CREDITS;
    
    console.log(`✅ [ICPUtils] [creditsToUsd] Conversion result:`, {
        inputCredits: credits,
        outputUSD: result,
        calculation: `(${credits} / ${CREDITS_PER_TB}) * ${USD_PER_1000_CREDITS} = ${result}`
    });

    return result;
};

/**
 * Convert USD to cycles (for top-up calculations) - PROPER IMPLEMENTATION
 */
export const usdToCycles = (usdAmount: number): bigint => {
    console.log(`💵 [ICPUtils] [usdToCycles] Converting USD to cycles:`, {
        inputUSD: usdAmount,
        step1: 'USD → Credits',
        step2: 'Credits → TB',
        step3: 'TB → Cycles'
    });

    const credits = usdToCredits(usdAmount);
    const tbCount = credits / CREDITS_PER_TB;
    const result = BigInt(Math.floor(tbCount)) * CYCLES_PER_TB;
    
    console.log(`🧮 [ICPUtils] [usdToCycles] Step-by-step conversion:`, {
        step1_usdToCredits: `$${usdAmount} → ${credits} credits`,
        step2_creditsToTB: `${credits} credits → ${tbCount} TB`,
        step3_tbToCycles: `${Math.floor(tbCount)} TB → ${result.toString()} cycles`,
        finalResult: result.toString(),
        finalResultInTrillions: (Number(result) / 1_000_000_000_000).toFixed(3) + 'T'
    });

    return result;
};

/**
 * Convert cycles to USD equivalent
 */
export const cyclesToUsd = (cycles: bigint): number => {
    console.log(`🔄 [ICPUtils] [cyclesToUsd] Converting cycles to USD:`, {
        inputCycles: cycles.toString(),
        inputCyclesInTrillions: (Number(cycles) / 1_000_000_000_000).toFixed(3) + 'T'
    });

    const tbCount = Number(cycles) / Number(CYCLES_PER_TB);
    const result = tbCount * USD_PER_1000_CREDITS;
    
    console.log(`💰 [ICPUtils] [cyclesToUsd] Conversion calculation:`, {
        inputCycles: cycles.toString(),
        CYCLES_PER_TB: CYCLES_PER_TB.toString(),
        tbCount,
        USD_PER_1000_CREDITS,
        resultUSD: result,
        calculation: `(${Number(cycles)} / ${Number(CYCLES_PER_TB)}) * ${USD_PER_1000_CREDITS} = $${result}`
    });

    return result;
};

/**
 * Get pricing information for display
 */
export const getPricingInfo = () => {
    const info = {
        usdPer1000Credits: USD_PER_1000_CREDITS,
        creditsPer1TB: CREDITS_PER_TB,
        cyclesPer1TB: CYCLES_PER_TB,
        formattedRate: `$${USD_PER_1000_CREDITS.toFixed(2)} for ${CREDITS_PER_TB} credits (1 TB cycles)`
    };
    
    console.log(`📋 [ICPUtils] [getPricingInfo] Pricing information:`, info);
    
    return info;
};

/**
 * Install WASM code to a canister using the IC Management canister
 * This is especially useful for system canisters that can't update themselves
 */
export const installWasmViaIcManagement = async (
    canisterId: Principal,
    wasmModule: Uint8Array,
    identity: any
): Promise<boolean> => {
    console.log(`🚀 [ICPUtils] [installWasmViaIcManagement] Starting WASM installation:`, {
        canisterId: canisterId.toText(),
        wasmSize: wasmModule.length,
        wasmSizeMB: (wasmModule.length / 1024 / 1024).toFixed(2) + 'MB',
        hasIdentity: !!identity
    });

    try {
        const host = "https://icp0.io";
        console.log(`🌐 [ICPUtils] [installWasmViaIcManagement] Using host: ${host}`);

        const agent = new HttpAgent({
            host,
            identity: identity
        });
        
        console.log(`🤖 [ICPUtils] [installWasmViaIcManagement] HttpAgent created`);

        const managementCanister = ICManagementCanister.create({
            agent,
        });
        
        console.log(`📋 [ICPUtils] [installWasmViaIcManagement] Management canister created`);
        console.log(`📦 [ICPUtils] [installWasmViaIcManagement] Installing code with upgrade mode...`);

        await managementCanister.installCode({
            canisterId,
            wasmModule,
            mode: {
                upgrade: null
            },
            arg: new Uint8Array([])
        });

        console.log(`✅ [ICPUtils] [installWasmViaIcManagement] Successfully upgraded WASM in canister ${canisterId.toText()}`);
        return true;
    } catch (error) {
        console.error(`❌ [ICPUtils] [installWasmViaIcManagement] Error upgrading WASM in canister ${canisterId.toText()}:`, error);
        console.error(`🔍 [ICPUtils] [installWasmViaIcManagement] Error analysis:`, {
            errorType: typeof error,
            errorName: error instanceof Error ? error.name : 'Unknown',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            canisterId: canisterId.toText(),
            wasmSize: wasmModule.length
        });
        throw error;
    }
};