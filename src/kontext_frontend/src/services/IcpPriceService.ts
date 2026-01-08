export interface IcpPriceData {
  price: number;
  timestamp: number;
  source: 'cryptocompare';
  cacheAge: number;
}

export interface IcpPriceService {
  getCurrentPrice(): Promise<IcpPriceData>;
  isServiceAvailable(): Promise<boolean>;
  getLastKnownPrice(): IcpPriceData | null;
  clearCache(): void;
}

class IcpPriceServiceImpl implements IcpPriceService {
  private static instance: IcpPriceServiceImpl;
  private cache: { price: number; timestamp: number } | null = null;
  private readonly CACHE_TTL = 180000; // 3 minutes in milliseconds
  private readonly API_TIMEOUT = 5000; // 5 seconds
  private readonly MIN_VALID_PRICE = 1.0; // $1 minimum
  private readonly MAX_VALID_PRICE = 100.0; // $100 maximum
  private readonly MAX_PRICE_CHANGE = 0.5; // 50% max change from last price
  
  private constructor() {}
  
  static getInstance(): IcpPriceServiceImpl {
    if (!IcpPriceServiceImpl.instance) {
      IcpPriceServiceImpl.instance = new IcpPriceServiceImpl();
    }
    return IcpPriceServiceImpl.instance;
  }

  async getCurrentPrice(): Promise<IcpPriceData> {
    console.log('💰 [IcpPriceService] Fetching current ICP price...');
    
    // Check cache first
    if (this.cache && this.isCacheValid()) {
      const cacheAge = Date.now() - this.cache.timestamp;
      console.log(`💾 [IcpPriceService] Using cached price: $${this.cache.price} (${Math.round(cacheAge / 1000)}s old)`);
      
      return {
        price: this.cache.price,
        timestamp: this.cache.timestamp,
        source: 'cryptocompare',
        cacheAge: cacheAge
      };
    }

    // Fetch fresh price from CryptoCompare
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT);

      const response = await fetch(
        'https://min-api.cryptocompare.com/data/price?fsym=ICP&tsyms=USD',
        {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`CryptoCompare API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data || typeof data.USD !== 'number') {
        throw new Error('Invalid response format from CryptoCompare API');
      }

      const price = data.USD;
      
      // Validate price is within reasonable bounds
      if (price < this.MIN_VALID_PRICE || price > this.MAX_VALID_PRICE) {
        throw new Error(`ICP price outside valid range: $${price} (valid: $${this.MIN_VALID_PRICE}-$${this.MAX_VALID_PRICE})`);
      }

      // Check for suspicious price changes
      if (this.cache && Math.abs(price - this.cache.price) / this.cache.price > this.MAX_PRICE_CHANGE) {
        console.warn(`⚠️ [IcpPriceService] Large price change detected: $${this.cache.price} → $${price} (${((price - this.cache.price) / this.cache.price * 100).toFixed(1)}%)`);
      }

      const timestamp = Date.now();
      
      // Cache the new price
      this.cache = { price, timestamp };
      
      console.log(`✅ [IcpPriceService] Fresh ICP price fetched: $${price}`);
      
      return {
        price,
        timestamp,
        source: 'cryptocompare',
        cacheAge: 0
      };

    } catch (error) {
      console.error('❌ [IcpPriceService] Error fetching ICP price:', error);
      
      // If we have cached data, check if it's recent enough for emergency use
      if (this.cache && (Date.now() - this.cache.timestamp) < (this.CACHE_TTL * 2)) {
        console.warn(`⚠️ [IcpPriceService] Using stale cached price due to API error: $${this.cache.price}`);
        return {
          price: this.cache.price,
          timestamp: this.cache.timestamp,
          source: 'cryptocompare',
          cacheAge: Date.now() - this.cache.timestamp
        };
      }
      
      throw new Error(`ICP pricing service unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async isServiceAvailable(): Promise<boolean> {
    try {
      await this.getCurrentPrice();
      return true;
    } catch (error) {
      console.warn('⚠️ [IcpPriceService] Service availability check failed:', error);
      return false;
    }
  }

  getLastKnownPrice(): IcpPriceData | null {
    if (!this.cache) {
      return null;
    }

    return {
      price: this.cache.price,
      timestamp: this.cache.timestamp,
      source: 'cryptocompare',
      cacheAge: Date.now() - this.cache.timestamp
    };
  }

  clearCache(): void {
    console.log('🧹 [IcpPriceService] Cache cleared');
    this.cache = null;
  }

  private isCacheValid(): boolean {
    if (!this.cache) return false;
    return (Date.now() - this.cache.timestamp) < this.CACHE_TTL;
  }
}

// Export singleton instance
export const icpPriceService = IcpPriceServiceImpl.getInstance();