interface BigIntSafeObject {
  [key: string]: any;
}

class ICPDataConverter {
  private readonly DEBUG = true; // Enable for debugging

  private log(message: string, data?: any) {
    if (this.DEBUG) {
      // console.log(`🔄 [ICPData] ${message}`, data);
    }
  }

  private logError(message: string, error?: any) {
    if (this.DEBUG) {
      // console.error(`❌ [ICPData] ${message}`, error);
    }
  }

  /**
   * Convert data FROM canister (handle BigInt -> number conversion)
   */
  fromCanister(data: any): any {
    this.log('Converting FROM canister, input:', data);
    this.log('Input type:', typeof data);
    this.log('Input constructor:', data?.constructor?.name);

    if (data === null || data === undefined) {
      this.log('Null/undefined input, returning as-is');
      return data;
    }

    try {
      const result = this.convertBigIntToNumber(data);
      this.log('Conversion result:', result);
      this.log('Result type:', typeof result);
      return result;
    } catch (error) {
      this.logError('Error in fromCanister conversion:', error);
      this.log('Returning original data due to conversion error');
      return data;
    }
  }

  /**
   * Convert data TO canister (handle number -> BigInt conversion where needed)
   */
  toCanister(data: any): any {
    this.log('Converting TO canister, input:', data);
    this.log('Input type:', typeof data);

    if (data === null || data === undefined) {
      this.log('Null/undefined input, returning as-is');
      return data;
    }

    try {
      const result = this.convertNumberToBigInt(data);
      this.log('Conversion result:', result);
      return result;
    } catch (error) {
      this.logError('Error in toCanister conversion:', error);
      this.log('Returning original data due to conversion error');
      return data;
    }
  }



  private convertBigIntToNumber(obj: any): any {
    this.log('Converting BigInt to number for:', obj);

    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle Principal objects - preserve them unchanged
    if (obj && typeof obj === 'object' && (
      obj._isPrincipal || 
      (obj.constructor && obj.constructor.name === 'Principal') ||
      (typeof obj.toText === 'function' && typeof obj.toString === 'function' && obj._arr)
    )) {
      this.log('Found Principal object, preserving as-is:', obj);
      return obj;
    }

    // Handle BigInt
    if (typeof obj === 'bigint') {
      this.log('Found BigInt:', obj.toString());
      if (obj <= Number.MAX_SAFE_INTEGER && obj >= Number.MIN_SAFE_INTEGER) {
        const converted = Number(obj);
        this.log('Converted BigInt to number:', converted);
        return converted;
      } else {
        this.log('BigInt too large for safe conversion, converting to string:', obj.toString());
        return obj.toString();
      }
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      this.log('Converting array of length:', obj.length);
      return obj.map((item, index) => {
        this.log(`Converting array item ${index}:`, item);
        return this.convertBigIntToNumber(item);
      });
    }

    // Handle objects (including Result types, Variants, etc.)
    if (typeof obj === 'object' && obj !== null) {
      this.log('Converting object with keys:', Object.keys(obj));
      
      const result: BigIntSafeObject = {};
      
      for (const [key, value] of Object.entries(obj)) {
        this.log(`Converting object property '${key}':`, value);
        result[key] = this.convertBigIntToNumber(value);
        this.log(`Converted property '${key}' result:`, result[key]);
      }
      
      this.log('Final converted object:', result);
      return result;
    }

    // Handle primitives (string, number, boolean)
    this.log('Returning primitive value as-is:', obj);
    return obj;
  }

  private convertNumberToBigInt(obj: any): any {
    this.log('Converting number to BigInt for:', obj);

    if (obj === null || obj === undefined) {
      return obj;
    }

    // CRITICAL FIX: Handle BigInt values that are already BigInts - preserve them unchanged
    // This prevents BigInt values from being incorrectly processed or stringified
    if (typeof obj === 'bigint') {
      this.log('Found BigInt, preserving as-is:', obj.toString());
      return obj;
    }

    // Handle Principal objects - preserve them unchanged
    if (obj && typeof obj === 'object' && (
      obj._isPrincipal || 
      (obj.constructor && obj.constructor.name === 'Principal') ||
      (typeof obj.toText === 'function' && typeof obj.toString === 'function' && obj._arr)
    )) {
      this.log('Found Principal object, preserving as-is:', obj);
      return obj;
    }

    // Convert large numbers to BigInt for canister calls
    if (typeof obj === 'number' && obj > Number.MAX_SAFE_INTEGER) {
      this.log('Converting large number to BigInt:', obj);
      return BigInt(obj);
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      this.log('Converting array of length:', obj.length);
      return obj.map((item, index) => {
        this.log(`Converting array item ${index}:`, item);
        return this.convertNumberToBigInt(item);
      });
    }

    // Handle objects
    if (typeof obj === 'object' && obj !== null) {
      this.log('Converting object with keys:', Object.keys(obj));
      
      const result: BigIntSafeObject = {};
      
      for (const [key, value] of Object.entries(obj)) {
        this.log(`Converting object property '${key}':`, value);
        result[key] = this.convertNumberToBigInt(value);
      }
      
      return result;
    }

    // Return primitives as-is
    this.log('Returning primitive value as-is:', obj);
    return obj;
  }


  /**
   * Safely convert Principal to text
   */
  principalToText(principal: any): string {
    this.log('Converting Principal to text:', principal);
    
    if (!principal) {
      this.log('No principal provided');
      return '';
    }

    try {
      if (typeof principal === 'string') {
        this.log('Principal is already string:', principal);
        return principal;
      }

      if (principal.toText && typeof principal.toText === 'function') {
        const result = principal.toText();
        this.log('Used toText() method, result:', result);
        return result;
      }

      if (principal.toString && typeof principal.toString === 'function') {
        const result = principal.toString();
        this.log('Used toString() method, result:', result);
        return result;
      }

      this.log('Fallback to String() conversion');
      return String(principal);
    } catch (error) {
      this.logError('Error converting Principal to text:', error);
      return String(principal);
    }
  }

  /**
   * Check if value looks like a canister ID
   */
  isCanisterId(value: any): boolean {
    const result = typeof value === 'string' && 
                  value.length > 5 && 
                  value.includes('-') && 
                  !value.includes(' ');
    
    this.log(`Checking if '${value}' is canister ID:`, result);
    return result;
  }

  /**
   * Safe JSON stringify that handles BigInt
   */
  stringify(obj: any): string {
    this.log('Stringifying object:', obj);
    
    try {
      const result = JSON.stringify(obj, (key, value) => {
        if (typeof value === 'bigint') {
          this.log(`Stringifying BigInt property '${key}':`, value.toString());
          return value.toString() + 'n';
        }
        return value;
      }, 2);
      
      this.log('Stringify result:', result);
      return result;
    } catch (error) {
      this.logError('Error in stringify:', error);
      return String(obj);
    }
  }
}

// Export singleton instance
export const icpData = new ICPDataConverter();

// Default export for convenience
export default icpData;