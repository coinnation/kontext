/**
 * Visual Style Generator - Converts visual property changes to CSS code
 */

interface StyleChange {
  property: string;
  value: string;
  elementSelector: string;
}

interface GeneratedCSS {
  css: string;
  filePath: string;
  selector: string;
  properties: Record<string, string>;
}

class VisualStyleGenerator {
  private static instance: VisualStyleGenerator;

  private constructor() {}

  static getInstance(): VisualStyleGenerator {
    if (!VisualStyleGenerator.instance) {
      VisualStyleGenerator.instance = new VisualStyleGenerator();
    }
    return VisualStyleGenerator.instance;
  }

  /**
   * Find CSS rule location for a selector
   * Called when element is selected to store the location for later updates
   */
  findCSSRuleLocation(
    selector: string,
    existingFiles: Record<string, string>
  ): { cssFilePath: string; existingRule: string | null; ruleIndex: number } | null {
    console.log('[VisualStyleGenerator] 🔍 findCSSRuleLocation called:', {
      selector,
      filesCount: Object.keys(existingFiles).length
    });

    // Find CSS files
    const cssFiles = Object.keys(existingFiles).filter(f => f.endsWith('.css'));
    
    if (cssFiles.length === 0) {
      console.log('[VisualStyleGenerator] ⚠️ No CSS files found, will use default');
      return {
        cssFilePath: 'src/frontend/index.css',
        existingRule: null,
        ruleIndex: -1
      };
    }

    // Escape selector for regex
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const selectorRegex = new RegExp(
      `(${escapedSelector}\\s*\\{[^}]*\\})`,
      'gs'
    );

    // Search each CSS file for the selector
    for (const cssFilePath of cssFiles) {
      const content = existingFiles[cssFilePath];
      const match = content.match(selectorRegex);
      
      if (match && match[0]) {
        const ruleIndex = content.indexOf(match[0]);
        console.log(`[VisualStyleGenerator] ✅ Found CSS rule in ${cssFilePath}:`, {
          existingRule: match[0],
          ruleIndex
        });
        
        return {
          cssFilePath,
          existingRule: match[0],
          ruleIndex
        };
      }
    }

    // Selector not found - use first CSS file
    console.log(`[VisualStyleGenerator] ⚠️ Selector not found in any CSS file, will add to: ${cssFiles[0]}`);
    return {
      cssFilePath: cssFiles[0],
      existingRule: null,
      ruleIndex: -1
    };
  }

  /**
   * Generate CSS from style changes
   * Can use stored location for precise updates
   */
  generateCSS(
    elementSelector: string,
    styleChanges: Record<string, string>,
    existingFiles: Record<string, string>,
    storedLocation?: { cssFilePath: string; existingRule: string | null; ruleIndex: number } | null
  ): GeneratedCSS {
    // Use stored location if provided, otherwise find/create
    let cssFilePath: string;
    let existingRule: string | null = null;
    
    if (storedLocation) {
      cssFilePath = storedLocation.cssFilePath;
      existingRule = storedLocation.existingRule;
      console.log('[VisualStyleGenerator] ✅ Using stored CSS location:', storedLocation);
    } else {
      // Find or create CSS file (fallback)
      cssFilePath = this.findOrCreateCSSFile(existingFiles);
      console.log('[VisualStyleGenerator] ⚠️ No stored location, using fallback:', cssFilePath);
    }
    
    // Build CSS rule
    const properties = this.normalizeProperties(styleChanges);
    const cssRule = this.buildCSSRule(elementSelector, properties);
    
    // Merge with existing CSS using stored location if available
    const existingCSS = existingFiles[cssFilePath] || '';
    const updatedCSS = storedLocation && existingRule
      ? this.mergeCSSRulePrecise(existingCSS, existingRule, cssRule)
      : this.mergeCSSRule(existingCSS, elementSelector, cssRule);
    
    return {
      css: updatedCSS,
      filePath: cssFilePath,
      selector: elementSelector,
      properties
    };
  }

  /**
   * Find existing CSS file or determine new file path
   */
  private findOrCreateCSSFile(files: Record<string, string>): string {
    // Look for common CSS file names
    const cssFilePatterns = [
      'src/frontend/index.css',
      'src/frontend/App.css',
      'src/frontend/styles.css',
      'src/index.css',
      'src/App.css',
      'src/styles.css',
      'index.css',
      'App.css',
      'styles.css'
    ];

    // Check for existing CSS files
    for (const pattern of cssFilePatterns) {
      if (files[pattern]) {
        return pattern;
      }
    }

    // Check for any .css file
    const cssFiles = Object.keys(files).filter(f => f.endsWith('.css'));
    if (cssFiles.length > 0) {
      return cssFiles[0];
    }

    // Default to index.css
    return 'src/frontend/index.css';
  }

  /**
   * Normalize CSS properties
   */
  private normalizeProperties(styles: Record<string, string>): Record<string, string> {
    const normalized: Record<string, string> = {};

    for (const [key, value] of Object.entries(styles)) {
      // Convert camelCase to kebab-case
      const cssProperty = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      
      // Normalize values
      let normalizedValue = value.trim();
      
      // Handle numeric values (add px if needed)
      if (/^\d+$/.test(normalizedValue) && this.requiresUnit(cssProperty)) {
        normalizedValue = normalizedValue + 'px';
      }
      
      normalized[cssProperty] = normalizedValue;
    }

    return normalized;
  }

  /**
   * Check if property requires a unit
   */
  private requiresUnit(property: string): boolean {
    const unitlessProperties = [
      'opacity',
      'z-index',
      'line-height',
      'font-weight',
      'order',
      'flex-grow',
      'flex-shrink'
    ];
    
    return !unitlessProperties.includes(property);
  }

  /**
   * Build CSS rule string
   */
  private buildCSSRule(selector: string, properties: Record<string, string>): string {
    const props = Object.entries(properties)
      .map(([key, value]) => `  ${key}: ${value};`)
      .join('\n');
    
    return `${selector} {\n${props}\n}`;
  }

  /**
   * Merge CSS rule into existing CSS using precise location
   */
  private mergeCSSRulePrecise(
    existingCSS: string,
    existingRule: string,
    newRule: string
  ): string {
    // Precise replacement using stored exact match
    return existingCSS.replace(existingRule, newRule);
  }

  /**
   * Merge CSS rule into existing CSS (fallback method)
   */
  private mergeCSSRule(
    existingCSS: string,
    selector: string,
    newRule: string
  ): string {
    // Simple approach: append or update rule
    // In production, you'd want a proper CSS parser
    
    // Check if selector already exists
    const selectorRegex = new RegExp(
      `(${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{[^}]*\\})`,
      'gs'
    );
    
    if (selectorRegex.test(existingCSS)) {
      // Replace existing rule
      return existingCSS.replace(selectorRegex, newRule);
    } else {
      // Append new rule
      return existingCSS + '\n\n' + newRule;
    }
  }

  /**
   * Generate inline styles (for React components)
   */
  generateInlineStyles(styleChanges: Record<string, string>): string {
    const properties = this.normalizeProperties(styleChanges);
    
    // Convert kebab-case back to camelCase for React
    const reactStyles: Record<string, string> = {};
    for (const [key, value] of Object.entries(properties)) {
      const camelKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      reactStyles[camelKey] = value;
    }
    
    return JSON.stringify(reactStyles, null, 2);
  }

  /**
   * Determine if changes should be CSS file or inline styles
   */
  shouldUseCSSFile(elementSelector: string, files: Record<string, string>): boolean {
    // Use CSS file if:
    // 1. Element has a class or ID
    // 2. CSS file already exists
    // 3. Selector is specific enough
    
    if (elementSelector.includes('.') || elementSelector.includes('#')) {
      return true;
    }
    
    // Check if CSS files exist
    const hasCSSFile = Object.keys(files).some(f => f.endsWith('.css'));
    if (hasCSSFile) {
      return true;
    }
    
    // Default to inline styles for generic elements
    return false;
  }

  /**
   * Find text in source files and return file path + exact match
   * Called when element is selected to store the location for later updates
   */
  findTextInSourceFiles(
    textToFind: string,
    existingFiles: Record<string, string>,
    elementSelector?: string
  ): { filePath: string; exactMatch: string; matchIndex: number } | null {
    if (!textToFind || !textToFind.trim()) {
      return null;
    }

    console.log('[VisualStyleGenerator] 🔍 findTextInSourceFiles called:', {
      textToFind,
      elementSelector,
      filesCount: Object.keys(existingFiles).length
    });

    // Find React/JSX files
    const jsxFiles = Object.keys(existingFiles).filter(f => 
      f.endsWith('.tsx') || f.endsWith('.jsx') || f.endsWith('.ts') || f.endsWith('.js')
    );

    console.log('[VisualStyleGenerator] 📄 Searching in JSX files:', jsxFiles.map(f => {
      const content = existingFiles[f];
      const hasText = content && content.includes(textToFind);
      return {
        file: f,
        size: content?.length || 0,
        hasText,
        preview: hasText ? content.substring(Math.max(0, content.indexOf(textToFind) - 50), content.indexOf(textToFind) + textToFind.length + 50) : null
      };
    }));

    // 🔥 NEW: If we have a selector, try to find the element first, then look for text nearby
    if (elementSelector) {
      const selectorParts = elementSelector.split('.');
      const classNameParts = selectorParts.filter(p => p && !p.startsWith('#'));
      
      for (const filePath of jsxFiles) {
        const content = existingFiles[filePath];
        
        // Search for the selector classes in the file
        const selectorMatches: number[] = [];
        classNameParts.forEach(className => {
          // Look for className="..." or className={'...'} containing this class
          const classPattern = new RegExp(`className[\\s]*=[\\s]*["']([^"']*${className}[^"']*)["']`, 'gi');
          let match;
          while ((match = classPattern.exec(content)) !== null) {
            selectorMatches.push(match.index);
          }
        });
        
        if (selectorMatches.length > 0) {
          // Found potential matches - look for text content near these locations
          for (const matchIndex of selectorMatches) {
            // Look in a window around the selector (500 chars before and after)
            const searchStart = Math.max(0, matchIndex - 500);
            const searchEnd = Math.min(content.length, matchIndex + 500);
            const searchWindow = content.substring(searchStart, searchEnd);
            
            // Try to find the text in various formats near the selector
            const escapedText = textToFind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const patterns = [
              // Direct text: >$543<
              new RegExp(`>\\s*${escapedText}\\s*<`, 'g'),
              // In JSX expression: {$543} or {"$543"}
              new RegExp(`\\{["']?${escapedText}["']?\\}`, 'g'),
              // Template literal: `$543` or `$${amount}`
              new RegExp('`[^`]*' + escapedText + '[^`]*`', 'g'),
              // Function call that might generate it: formatCurrency(543) or formatMoney(543)
              new RegExp(`format(?:Currency|Money|Price|Amount)\\s*\\([^)]*${escapedText.replace('\\$', '')}[^)]*\\)`, 'gi'),
              // Number without $: 543
              new RegExp(`\\b${escapedText.replace('\\$', '')}\\b`, 'g')
            ];
            
            for (const pattern of patterns) {
              const match = searchWindow.match(pattern);
              if (match && match[0]) {
                const actualIndex = searchStart + searchWindow.indexOf(match[0]);
                console.log(`[VisualStyleGenerator] ✅ Found text near selector in ${filePath}:`, {
                  exactMatch: match[0],
                  matchIndex: actualIndex,
                  selector: elementSelector,
                  pattern: pattern.toString()
                });
                
                return {
                  filePath,
                  exactMatch: match[0],
                  matchIndex: actualIndex
                };
              }
            }
          }
        }
      }
    }

    for (const filePath of jsxFiles) {
      const content = existingFiles[filePath];
      
      // Escape special regex characters
      const escapedText = textToFind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Try various patterns to find the exact match
      const patterns = [
        // JSX text content: >$543< or > $543 <
        new RegExp(`>\\s*${escapedText}\\s*<`, 'g'),
        // String literals: "$543" or '$543'
        new RegExp(`"${escapedText}"`, 'g'),
        new RegExp(`'${escapedText}'`, 'g'),
        // Template literals: `$543`
        new RegExp(`\`${escapedText}\``, 'g'),
        // JSX expressions: {"$543"} or {'$543'} or {$543}
        new RegExp(`\\{["']?${escapedText}["']?\\}`, 'g'),
        new RegExp(`\\{\\s*["']?${escapedText}["']?\\s*\\}`, 'g'),
        // Direct text in JSX (no quotes): >$543<
        new RegExp(`>${escapedText}<`, 'g'),
        // Text with whitespace: > $543 <
        new RegExp(`>\\s+${escapedText}\\s+<`, 'g'),
        // In template strings within JSX: {`$543`}
        new RegExp(`\\{\\s*\`${escapedText}\`\\s*\\}`, 'g'),
        // Plain text without quotes (for direct text nodes)
        new RegExp(`\\b${escapedText}\\b`, 'g')
      ];

      // Try each pattern
      for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        const match = content.match(pattern);
        
        if (match && match[0]) {
          const matchIndex = content.indexOf(match[0]);
          console.log(`[VisualStyleGenerator] ✅ Found text in ${filePath} using pattern ${i}:`, {
            exactMatch: match[0],
            matchIndex,
            pattern: pattern.toString()
          });
          
          return {
            filePath,
            exactMatch: match[0],
            matchIndex
          };
        }
      }
      
      // Fallback: if text exists but no pattern matched, use direct search
      if (content.includes(textToFind)) {
        const matchIndex = content.indexOf(textToFind);
        console.log(`[VisualStyleGenerator] ✅ Found text in ${filePath} (direct match):`, {
          exactMatch: textToFind,
          matchIndex
        });
        
        return {
          filePath,
          exactMatch: textToFind,
          matchIndex
        };
      }
    }

    console.warn('[VisualStyleGenerator] ❌ Could not find text in any source files:', textToFind);
    return null;
  }

  /**
   * Update text content in source file using stored file path and exact match
   * This is a simplified approach - finds the element by selector and updates its text
   */
  updateTextContent(
    elementSelector: string,
    oldText: string,
    newText: string,
    existingFiles: Record<string, string>
  ): { filePath: string; content: string } | null {
    console.log('[VisualStyleGenerator] 🔍 updateTextContent called:', {
      elementSelector,
      oldText,
      newText,
      filesCount: Object.keys(existingFiles).length
    });

    // Find React/JSX files
    const jsxFiles = Object.keys(existingFiles).filter(f => 
      f.endsWith('.tsx') || f.endsWith('.jsx') || f.endsWith('.ts') || f.endsWith('.js')
    );

    console.log('[VisualStyleGenerator] 📄 Searching in JSX files:', jsxFiles);

    for (const filePath of jsxFiles) {
      const content = existingFiles[filePath];
      
      // Try to find the text in the file
      // Look for patterns like: >oldText< or "oldText" or 'oldText' or {oldText} or {`oldText`}
      // Escape special regex characters
      const escapedOldText = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // More comprehensive patterns to match text in various JSX/JS contexts
      const patterns = [
        // JSX text content: >$543< or > $543 <
        new RegExp(`>\\s*${escapedOldText}\\s*<`, 'g'),
        // String literals: "$543" or '$543'
        new RegExp(`"${escapedOldText}"`, 'g'),
        new RegExp(`'${escapedOldText}'`, 'g'),
        // Template literals: `$543`
        new RegExp(`\`${escapedOldText}\``, 'g'),
        // JSX expressions: {"$543"} or {'$543'} or {$543}
        new RegExp(`\\{["']?${escapedOldText}["']?\\}`, 'g'),
        new RegExp(`\\{\\s*["']?${escapedOldText}["']?\\s*\\}`, 'g'),
        // Direct text in JSX (no quotes): >$543<
        new RegExp(`>${escapedOldText}<`, 'g'),
        // Text with whitespace: > $543 <
        new RegExp(`>\\s+${escapedOldText}\\s+<`, 'g'),
        // In template strings within JSX: {`$543`}
        new RegExp(`\\{\\s*\`${escapedOldText}\`\\s*\\}`, 'g'),
        // Plain text without quotes (for direct text nodes)
        new RegExp(`\\b${escapedOldText}\\b`, 'g')
      ];

      console.log(`[VisualStyleGenerator] 🔍 Checking file: ${filePath} (${content.length} chars)`);
      
      // First, check if the text exists at all in the file (case-insensitive for debugging)
      const textExists = content.includes(oldText);
      console.log(`[VisualStyleGenerator] 📝 Text "${oldText}" exists in file: ${textExists}`);
      
      if (!textExists) {
        // Try case-insensitive search
        const caseInsensitiveMatch = content.match(new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
        if (caseInsensitiveMatch) {
          console.log(`[VisualStyleGenerator] ⚠️ Found case-insensitive match: "${caseInsensitiveMatch[0]}"`);
        }
        continue;
      }

      // Try each pattern
      for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        const matches = content.match(pattern);
        
        if (matches) {
          console.log(`[VisualStyleGenerator] ✅ Pattern ${i} matched! Found ${matches.length} occurrence(s)`);
          console.log(`[VisualStyleGenerator] 📋 Sample match: "${matches[0]}"`);
          
          const updatedContent = content.replace(pattern, (match) => {
            // Replace the text while preserving the surrounding quotes/brackets
            if (match.includes('>') && match.includes('<')) {
              // JSX text node: >$543< -> >$555<
              return match.replace(escapedOldText, newText);
            } else if (match.startsWith('"') && match.endsWith('"')) {
              // Double-quoted string: "$543" -> "$555"
              return `"${newText}"`;
            } else if (match.startsWith("'") && match.endsWith("'")) {
              // Single-quoted string: '$543' -> '$555'
              return `'${newText}'`;
            } else if (match.startsWith('`') && match.endsWith('`')) {
              // Template literal: `$543` -> `$555`
              return `\`${newText}\``;
            } else if (match.startsWith('{') && match.endsWith('}')) {
              // JSX expression: {$543} or {"$543"} -> {$555} or {"$555"}
              return match.replace(escapedOldText, newText);
            } else {
              // Plain text match - replace directly
              return match.replace(escapedOldText, newText);
            }
          });

          console.log(`[VisualStyleGenerator] ✅ Successfully updated text in ${filePath}`);
          console.log(`[VisualStyleGenerator] 📝 Old: "${oldText}" -> New: "${newText}"`);

          return {
            filePath,
            content: updatedContent
          };
        }
      }
      
      // If no pattern matched but text exists, try a simple direct replacement
      if (textExists) {
        console.log(`[VisualStyleGenerator] ⚠️ Text found but no pattern matched, trying direct replacement`);
        const directReplacement = content.replace(new RegExp(escapedOldText, 'g'), newText);
        
        if (directReplacement !== content) {
          console.log(`[VisualStyleGenerator] ✅ Direct replacement succeeded`);
          return {
            filePath,
            content: directReplacement
          };
        }
      }
    }

    console.warn('[VisualStyleGenerator] ❌ Could not find text in any JSX files:', {
      oldText,
      searchedFiles: jsxFiles.length
    });
    return null;
  }
}

export const visualStyleGenerator = VisualStyleGenerator.getInstance();

