/**
 * Verbose logging utility for development debugging
 * Set VERBOSE_LOGGING=false in localStorage to disable verbose logs during AI code generation
 */

const VERBOSE_LOGGING_KEY = 'VERBOSE_LOGGING';
const DEFAULT_VERBOSE_LOGGING = false; // Disabled by default

/**
 * Check if verbose logging is enabled
 */
export function isVerboseLoggingEnabled(): boolean {
  if (typeof window === 'undefined') return DEFAULT_VERBOSE_LOGGING;
  
  const stored = localStorage.getItem(VERBOSE_LOGGING_KEY);
  if (stored === null) return DEFAULT_VERBOSE_LOGGING;
  
  return stored === 'true';
}

/**
 * Enable or disable verbose logging
 */
export function setVerboseLogging(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VERBOSE_LOGGING_KEY, enabled.toString());
}

/**
 * Conditional log function - only logs if verbose logging is enabled
 */
export function verboseLog(category: string, message: string, ...args: any[]): void {
  if (isVerboseLoggingEnabled()) {
    console.log(`[${category}] ${message}`, ...args);
  }
}

/**
 * Conditional warn function - only logs if verbose logging is enabled
 */
export function verboseWarn(category: string, message: string, ...args: any[]): void {
  if (isVerboseLoggingEnabled()) {
    console.warn(`[${category}] ${message}`, ...args);
  }
}

/**
 * Conditional error function - always logs errors (not controlled by verbose flag)
 */
export function verboseError(category: string, message: string, ...args: any[]): void {
  console.error(`[${category}] ${message}`, ...args);
}
