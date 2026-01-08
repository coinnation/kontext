/**
 * Message Domain Detection Utility
 * 
 * Classifies messages by domain (frontend, backend, deployment, etc.) to enable
 * topic-based context filtering and prevent context pollution.
 */

export type MessageDomain = 'frontend' | 'backend' | 'deployment' | 'general' | 'auto-retry';

/**
 * Extract file references from message content
 * Looks for common file path patterns
 */
const extractFileReferences = (content: string): string[] => {
  const filePatterns = [
    /(\w+\/)*\w+\.(tsx|ts|jsx|js|css|mo|did|toml|json|html)/gi,
    new RegExp('`([^`]+\\.(tsx|ts|jsx|js|css|mo|did|toml|json|html))`', 'gi'),
    /'([^']+\.(tsx|ts|jsx|js|css|mo|did|toml|json|html))'/gi,
    /"([^"]+\.(tsx|ts|jsx|js|css|mo|did|toml|json|html))"/gi
  ];
  
  const files: string[] = [];
  filePatterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      files.push(match[1] || match[0]);
    }
  });
  
  return [...new Set(files)]; // Deduplicate
};

/**
 * 🔥 GAP 7 FIX: Extract feature context from message content
 * Identifies specific features being discussed (e.g., 'bills', 'calendar', 'categories')
 */
const extractFeatureContext = (content: string): string[] => {
  const lowerContent = content.toLowerCase();
  
  // Common UI features and components
  const featureKeywords = [
    'bills', 'bill', 'categories', 'category', 'budgets', 'budget',
    'calendar', 'reports', 'report', 'dashboard', 'settings',
    'login', 'signup', 'auth', 'profile', 'user', 'admin',
    'form', 'table', 'list', 'grid', 'chart', 'graph',
    'modal', 'dialog', 'popup', 'sidebar', 'navbar', 'menu',
    'search', 'filter', 'sort', 'export', 'import',
    'create', 'edit', 'delete', 'update', 'save', 'cancel',
    // 🔥 ADD: Theme and system features
    'theme', 'dark mode', 'light mode', 'dark', 'light', 'styling', 'colors',
    'loading', 'initialization', 'startup', 'flash', 'fouc'
  ];
  
  const detectedFeatures = featureKeywords.filter(keyword => 
    lowerContent.includes(keyword)
  );
  
  // Also extract component names from file references
  const fileReferences = extractFileReferences(content);
  const componentNames = fileReferences
    .map(file => {
      // Extract component name from file path: BillsView.tsx -> 'bills'
      const fileName = file.split('/').pop()?.replace(/\.(tsx|ts|jsx|js)$/, '');
      if (fileName) {
        return fileName.toLowerCase().replace(/view|component|page|interface/, '');
      }
      return null;
    })
    .filter(Boolean) as string[];
  
  return [...new Set([...detectedFeatures, ...componentNames])];
};

export interface MessageDomainContext {
  domain: MessageDomain;
  confidence: number; // 0-1
  keywords: string[];
  resolved?: boolean;
  resolvedAt?: number;
  relatedWorkflowId?: string;
  errorType?: 'compilation' | 'bundling' | 'deployment' | 'network' | 'unknown';
  featureContext?: string[]; // 🔥 GAP 7 FIX: Track specific features (e.g., ['bills', 'form'])
}

export interface ChatInterfaceMessage {
  id: string;
  type: 'user' | 'system';
  content: string;
  timestamp: Date;
  priorityContext?: any;
  domainContext?: MessageDomainContext;
  [key: string]: any;
}

/**
 * Extract workflow ID from auto-retry message content
 */
export const extractWorkflowId = (content: string): string | undefined => {
  // Try multiple patterns
  const patterns = [
    /workflow[_\s]?id[:\s]+([a-z0-9_-]+)/i,
    /workflow[:\s]+([a-z0-9_-]+)/i,
    /workflowId[:\s]+([a-z0-9_-]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return undefined;
};

/**
 * Detect message domain from content
 */
export const detectMessageDomain = (message: ChatInterfaceMessage): MessageDomainContext => {
  // 🔥 GAP 15 FIX: Return cached domain context with features if available
  // This ensures features are only extracted once and stay consistent
  if (message.domainContext) {
    // If resolved status might have changed, update it while keeping features
    const currentResolved = message.domainContext.resolved;
    if (currentResolved) {
      return message.domainContext; // Already resolved, return as-is
    }
    // Not resolved - could potentially be resolved now, but keep existing detection
    return message.domainContext;
  }
  
  const content = message.content.toLowerCase();
  
  // 🔥 FIX 4: Improved pattern matching for better domain detection
  // Extract file references for more accurate detection
  const fileReferences = extractFileReferences(content);
  const hasFrontendFiles = fileReferences.some(f => 
    f.endsWith('.tsx') || f.endsWith('.jsx') || f.endsWith('.css') || 
    f.includes('component') || f.includes('view')
  );
  const hasBackendFiles = fileReferences.some(f => 
    f.endsWith('.mo') || f.includes('main.mo') || f.includes('canister')
  );
  
  // 🆕 AUTO-RETRY MESSAGE DETECTION
  if (content.includes('auto-retry system activated') || 
      content.includes('🤖 **auto-retry') ||
      content.includes('auto-retry system')) {
    
    // Extract error type from auto-retry message
    const isBackendError = content.includes('motoko') || 
                          content.includes('compilation') ||
                          content.includes('.mo:') ||
                          content.includes('backend') ||
                          content.includes('moc');
    const isFrontendError = content.includes('bundling') ||
                           content.includes('vite') ||
                           content.includes('frontend') ||
                           content.includes('.tsx:') ||
                           content.includes('.ts:') ||
                           content.includes('webpack');
    
    // Determine error classification
    let errorType: 'compilation' | 'bundling' | 'deployment' | 'network' | 'unknown' = 'unknown';
    if (content.includes('compilation')) errorType = 'compilation';
    else if (content.includes('bundling')) errorType = 'bundling';
    else if (content.includes('deployment')) errorType = 'deployment';
    else if (content.includes('network')) errorType = 'network';
    
    return {
      domain: 'auto-retry',
      confidence: 0.95,
      keywords: ['auto-retry', 'deployment', 'error', isBackendError ? 'backend' : 'frontend'],
      resolved: false, // Will be updated when workflow completes
      relatedWorkflowId: extractWorkflowId(message.content),
      errorType
    };
  }
  
  // 🔥 GAP 7 FIX: Extract feature context from message
  const featureContext = extractFeatureContext(content);
  
  // 🔥 FIX 4: File-based detection takes precedence
  if (hasBackendFiles) {
    return {
      domain: 'backend',
      confidence: 0.9, // High confidence from file evidence
      keywords: ['file-reference', ...fileReferences.filter(f => f.endsWith('.mo'))],
      featureContext // 🔥 GAP 7: Include feature context
    };
  }
  
  if (hasFrontendFiles) {
    return {
      domain: 'frontend',
      confidence: 0.9, // High confidence from file evidence
      keywords: ['file-reference', ...fileReferences.filter(f => f.endsWith('.tsx') || f.endsWith('.css'))],
      featureContext // 🔥 GAP 7: Include feature context
    };
  }
  
  // 🆕 BACKEND DOMAIN INDICATORS (keyword-based fallback)
  const backendKeywords = ['motoko', 'backend', '.mo', 'canister', 'actor', 'moc', 'dfx', 'wasm'];
  const backendMatches = backendKeywords.filter(keyword => content.includes(keyword));
  
  // 🔥 GAP 2 FIX: Relax to 1+ keyword for short messages (<50 chars)
  const isShortMessage = content.length < 50;
  const backendThreshold = isShortMessage ? 1 : 2;
  
  if (backendMatches.length >= backendThreshold) {
    return {
      domain: 'backend',
      confidence: Math.min(0.7 + (backendMatches.length * 0.1), 0.95),
      keywords: backendMatches,
      featureContext // 🔥 GAP 7: Include feature context
    };
  }
  
  // 🆕 FRONTEND DOMAIN INDICATORS (enhanced keywords)
  const frontendKeywords = [
    'react', 'component', 'display', 'show up', 'render', 'ui', 'frontend',
    '.tsx', '.ts:', 'jsx', 'vite', 'webpack', 'content', 'page', 'view',
    // 🔥 FIX 4: Add UI element keywords
    'button', 'form', 'input', 'dropdown', 'modal', 'dialog', 'tab',
    'calendar', 'dashboard', 'sidebar', 'navbar', 'menu', 'card', 'list',
    'table', 'chart', 'graph', 'export', 'click', 'hover', 'style', 'css',
    // 🔥 Add action verbs for UI interactions
    "doesn't work", 'not working', 'broken', 'fix', 'update', 'change'
  ];
  const frontendMatches = frontendKeywords.filter(keyword => content.includes(keyword));
  
  // 🔥 GAP 2 FIX: Relax to 1+ keyword for short messages
  const frontendThreshold = isShortMessage ? 1 : 2;
  
  if (frontendMatches.length >= frontendThreshold) {
    return {
      domain: 'frontend',
      confidence: Math.min(0.7 + (frontendMatches.length * 0.1), 0.95),
      keywords: frontendMatches,
      featureContext // 🔥 GAP 7: Include feature context
    };
  }
  
  // 🆕 DEPLOYMENT DOMAIN INDICATORS
  const deploymentKeywords = ['deploy', 'deployment', 'build', 'cicd', 'pipeline'];
  const deploymentMatches = deploymentKeywords.filter(keyword => content.includes(keyword));
  
  if (deploymentMatches.length > 0) {
    return {
      domain: 'deployment',
      confidence: Math.min(0.7 + (deploymentMatches.length * 0.1), 0.95),
      keywords: deploymentMatches
    };
  }
  
  // 🆕 DEFAULT TO GENERAL
  return {
    domain: 'general',
    confidence: 0.5,
    keywords: []
  };
};

/**
 * Calculate topic relevance between two messages
 * Returns a score from 0-1 indicating how relevant candidateMessage is to currentMessage
 */
export const calculateTopicRelevance = (
  currentMessage: ChatInterfaceMessage,
  candidateMessage: ChatInterfaceMessage
): number => {
  const currentDomain = detectMessageDomain(currentMessage);
  const candidateDomain = detectMessageDomain(candidateMessage);
  
  // 🚨 CRITICAL: Resolved auto-retry messages are almost always irrelevant
  if (candidateDomain.domain === 'auto-retry' && candidateDomain.resolved) {
    // Only include if it's very recent (< 2 minutes) and same error type
    if (candidateDomain.resolvedAt) {
      const age = Date.now() - candidateDomain.resolvedAt;
      if (age > 2 * 60 * 1000) { // 2 minutes
        return 0.05; // Almost irrelevant
      }
    } else {
      return 0.1; // Resolved but no timestamp - low relevance
    }
  }
  
  // 🎯 Exact domain match = high relevance
  if (currentDomain.domain === candidateDomain.domain && 
      currentDomain.domain !== 'general') {
    // Boost relevance if keywords overlap
    const keywordOverlap = currentDomain.keywords.filter(k => 
      candidateDomain.keywords.includes(k)
    ).length;
    const baseRelevance = 0.85;
    const keywordBonus = Math.min(keywordOverlap * 0.05, 0.1);
    return Math.min(baseRelevance + keywordBonus, 0.95);
  }
  
  // 🔄 Cross-domain relevance (frontend vs backend)
  if ((currentDomain.domain === 'frontend' && candidateDomain.domain === 'backend') ||
      (currentDomain.domain === 'backend' && candidateDomain.domain === 'frontend')) {
    // Very low relevance unless explicitly related (e.g., deployment connects them)
    return 0.15;
  }
  
  // 🔗 Deployment domain can connect frontend and backend
  if (candidateDomain.domain === 'deployment' && 
      (currentDomain.domain === 'frontend' || currentDomain.domain === 'backend')) {
    return 0.4; // Moderate relevance
  }
  
  // 📊 Keyword overlap analysis
  const currentKeywords = new Set(currentDomain.keywords.map(k => k.toLowerCase()));
  const candidateKeywords = new Set(candidateDomain.keywords.map(k => k.toLowerCase()));
  const overlap = [...currentKeywords].filter(k => candidateKeywords.has(k));
  
  if (overlap.length > 0) {
    const keywordRelevance = overlap.length / Math.max(
      currentKeywords.size, 
      candidateKeywords.size, 
      1
    );
    return Math.max(0.3, keywordRelevance * 0.8); // Cap at 0.8 for keyword-only matches
  }
  
  // 📉 Default low relevance for unrelated messages
  return 0.2;
};

/**
 * Check if message should be excluded from context
 */
export const shouldExcludeMessage = (
  message: ChatInterfaceMessage,
  currentMessageId?: string
): boolean => {
  // Never exclude current instruction
  if (message.id === currentMessageId) {
    return false;
  }
  
  const domain = detectMessageDomain(message);
  
  // 🚨 Exclude resolved auto-retry messages older than expiration time
  if (domain.domain === 'auto-retry' && domain.resolved && domain.resolvedAt) {
    const age = Date.now() - domain.resolvedAt;
    const EXPIRATION_TIME = 10 * 60 * 1000; // 10 minutes
    
    if (age > EXPIRATION_TIME) {
      console.log(`⏰ [CONTEXT FILTER] Excluding expired auto-retry message: ${message.id} (age: ${Math.round(age / 1000)}s)`);
      return true;
    }
  }
  
  // 🔥 FIX 1: Exclude ANY resolved message (not just auto-retry)
  if (domain.resolved) {
    console.log(`✅ [CONTEXT FILTER] Excluding resolved message: ${message.id} (domain: ${domain.domain})`);
    return true;
  }
  
  return false;
};

/**
 * 🔥 FIX 2 (REFINED): Detect user phrases indicating topic closure or moving on
 * Returns true if the message indicates the user is done with the previous topic
 * 🔥 GAP 1 FIX: Context-aware - distinguishes continuation from new topic
 */
export const detectTopicClosure = (
  message: ChatInterfaceMessage, 
  previousMessages?: ChatInterfaceMessage[]
): boolean => {
  const content = message.content.toLowerCase();
  const trimmedContent = content.trim();
  
  // 🔥 STRONG CLOSURE SIGNALS - Always indicate new topic
  const strongClosurePhrases = [
    'moving on',
    'next issue',
    'different issue',
    'separate issue',
    'another thing',
    'something else',
    'new issue',
    'unrelated',
    'different topic'
  ];
  
  for (const phrase of strongClosurePhrases) {
    if (content.includes(phrase)) {
      console.log(`🔚 [TOPIC CLOSURE] Strong closure signal: "${phrase}" in message ${message.id}`);
      return true;
    }
  }
  
  // 🔥 WEAK CLOSURE SIGNALS - Need context to determine if continuation or new topic
  // 🔥 GAP 14 FIX: Check both start AND mid-sentence (after punctuation)
  const weakClosurePatterns = [
    { pattern: 'also ', continuation: ['make it', 'make the', 'add', 'change the', 'update the'] },
    { pattern: 'now ', continuation: ['make', 'change', 'update', 'add'] },
    { pattern: 'okay ', continuation: ['now make', 'make it', 'change'] }
  ];
  
  for (const { pattern, continuation } of weakClosurePatterns) {
    // Check at start of message OR after sentence boundary
    const atStart = trimmedContent.startsWith(pattern);
    const afterPunctuation = new RegExp(`[.!?]\\s+${pattern}`, 'i').test(content);
    
    if (atStart || afterPunctuation) {
      // Check if it's a continuation by looking for continuation keywords
      const isContinuation = continuation.some(cont => trimmedContent.includes(cont));
      
      if (isContinuation) {
        // Check if message refers to previous topic
        const refersToPreviousTopic = checksPreviousTopicReference(content, previousMessages);
        
        if (refersToPreviousTopic) {
          console.log(`🔗 [TOPIC CLOSURE] Weak closure pattern "${pattern}" detected as CONTINUATION (refers to previous topic)`);
          return false; // It's a continuation, not closure
        }
      }
      
      // If no continuation indicators, it's likely a new topic
      console.log(`🔚 [TOPIC CLOSURE] Weak closure pattern "${pattern}" detected as NEW TOPIC ${afterPunctuation ? '(mid-sentence)' : '(start)'}`);
      return true;
    }
  }
  
  // 🔥 AFFIRMATIVE RESPONSES - Only closure if followed by new request
  const affirmativeOnly = ['thanks', 'thank you', 'perfect', 'great', 'looks good', 'that works'];
  for (const phrase of affirmativeOnly) {
    if (trimmedContent === phrase || trimmedContent.startsWith(phrase + '.') || trimmedContent.startsWith(phrase + '!')) {
      // Short affirmative with no follow-up = closure
      console.log(`✅ [TOPIC CLOSURE] Affirmative-only response: "${phrase}"`);
      return true;
    }
  }
  
  return false;
};

/**
 * 🔥 GAP 1 & 8 FIX: Check if message refers to previous topic using pronouns/references
 * 🔥 GAP 8: Excludes "the X" patterns that are specific feature references, not pronouns
 */
const checksPreviousTopicReference = (
  content: string, 
  previousMessages?: ChatInterfaceMessage[]
): boolean => {
  const lowerContent = content.toLowerCase();
  
  // 🔥 GAP 8 FIX: First check if "the" is followed by a specific feature name
  // "the calendar" is NOT a pronoun - it's a specific feature reference
  const specificFeaturePattern = /\bthe\s+(bills?|categories|category|budgets?|calendar|reports?|dashboard|form|button|dropdown|table|modal|menu|sidebar)\b/gi;
  if (specificFeaturePattern.test(lowerContent)) {
    console.log(`🎯 [PRONOUN CHECK] "the X" detected as SPECIFIC FEATURE, not pronoun`);
    return false; // It's a specific feature, not a pronoun reference
  }
  
  // Pronouns that refer to previous context (excluding "the")
  const referencePronouns = [
    'it ', 'its ', 'the same', 'this one', 'that one', 
    'them ', 'those ', 'these '
  ];
  
  // If message uses pronouns, it's likely referring to previous topic
  const hasPronouns = referencePronouns.some(pronoun => lowerContent.includes(pronoun));
  
  if (!hasPronouns) {
    return false; // No pronouns = likely new topic
  }
  
  // If we have previous messages, check if there's topic continuity
  if (previousMessages && previousMessages.length > 0) {
    const lastUserMessage = [...previousMessages].reverse().find(m => m.type === 'user');
    if (lastUserMessage) {
      const prevDomain = detectMessageDomain(lastUserMessage);
      const currentFeatures = extractFeatureContext(content);
      const prevFeatures = prevDomain.featureContext || [];
      
      // 🔥 GAP 7: Check feature overlap, not just domain
      const hasFeatureOverlap = currentFeatures.some(f => prevFeatures.includes(f));
      
      if (hasFeatureOverlap) {
        console.log(`🔗 [PRONOUN CHECK] Feature overlap detected: ${currentFeatures.filter(f => prevFeatures.includes(f)).join(', ')}`);
        return true; // Same feature = continuation
      }
      
      // Fallback: Same domain + pronouns = continuation
      // Create a temporary message object for domain detection
      const tempMsg = { 
        id: 'temp', 
        type: 'user' as const, 
        content, 
        timestamp: new Date() 
      };
      const currentDomain = detectMessageDomain(tempMsg);
      
      if (prevDomain.domain === currentDomain.domain && currentDomain.domain !== 'general') {
        return true;
      }
    }
  }
  
  return hasPronouns; // Has pronouns, assume continuation
};

/**
 * Check if an error message is resolved by looking for subsequent success messages
 */
export const isErrorResolved = (
  errorMessage: ChatInterfaceMessage,
  allMessages: ChatInterfaceMessage[]
): boolean => {
  const errorIndex = allMessages.findIndex(m => m.id === errorMessage.id);
  if (errorIndex === -1) return false;
  
  // Look for success indicators after this error
  const subsequentMessages = allMessages.slice(errorIndex + 1);
  
  // Check for success patterns
  const successIndicators = [
    'success',
    'complete',
    'resolved',
    'fixed',
    'deployed successfully',
    'generation complete',
    'ready to deploy',
    '✅',
    'successfully'
  ];
  
  // If we find a success message within 5 messages, consider it resolved
  for (let i = 0; i < Math.min(5, subsequentMessages.length); i++) {
    const msg = subsequentMessages[i];
    const content = msg.content.toLowerCase();
    
    if (successIndicators.some(indicator => content.includes(indicator))) {
      // Additional check: make sure it's related (same domain)
      const errorDomain = detectMessageDomain(errorMessage);
      const successDomain = detectMessageDomain(msg);
      
      if (errorDomain.domain === successDomain.domain || 
          successDomain.domain === 'deployment' ||
          successDomain.domain === 'general') {
        console.log(`✅ [RESOLUTION] Error ${errorMessage.id} resolved by success message ${msg.id}`);
        return true;
      }
    }
  }
  
  // Check if there's a newer error of the same type (old one is superseded)
  const errorDomain = detectMessageDomain(errorMessage);
  const newerErrors = subsequentMessages.filter(m => {
    const domain = detectMessageDomain(m);
    return domain.domain === errorDomain.domain && 
           (m.content.toLowerCase().includes('error') || 
            m.content.toLowerCase().includes('failed'));
  });
  
  // If there's a newer error of same type, old one is likely resolved/superseded
  if (newerErrors.length > 0) {
    console.log(`🔄 [RESOLUTION] Error ${errorMessage.id} superseded by newer error ${newerErrors[0].id}`);
    return true;
  }
  
  return false;
};

/**
 * Filter messages by relevance to current instruction
 */
export const filterMessagesByRelevance = (
  messages: ChatInterfaceMessage[],
  currentInstruction: ChatInterfaceMessage,
  minRelevance: number = 0.4
): ChatInterfaceMessage[] => {
  return messages
    .filter(msg => {
      // Always include current instruction
      if (msg.id === currentInstruction.id) return true;
      
      // Exclude expired/resolved messages
      if (shouldExcludeMessage(msg, currentInstruction.id)) return false;
      
      // Calculate relevance
      const relevance = calculateTopicRelevance(currentInstruction, msg);
      
      // Include if relevance meets threshold
      if (relevance >= minRelevance) {
        console.log(`✅ [CONTEXT FILTER] Including message ${msg.id} (relevance: ${relevance.toFixed(2)})`);
        return true;
      } else {
        console.log(`❌ [CONTEXT FILTER] Excluding message ${msg.id} (relevance: ${relevance.toFixed(2)} < ${minRelevance})`);
        return false;
      }
    })
    .sort((a, b) => {
      // Sort by relevance (highest first)
      const relevanceA = calculateTopicRelevance(currentInstruction, a);
      const relevanceB = calculateTopicRelevance(currentInstruction, b);
      return relevanceB - relevanceA;
    });
};

/**
 * 🔥 FIX 3 (REFINED): Detect topic changes and create conversation boundaries
 * Returns array of segment boundaries (indices where new topics start)
 * 🔥 GAP 7 FIX: Uses feature context, not just domain
 * 🔥 GAP 9 FIX: Resolution checked dynamically at filter time
 */
export const segmentConversationByTopic = (
  messages: ChatInterfaceMessage[]
): Array<{ 
  startIndex: number; 
  endIndex: number; 
  topic: MessageDomain; 
  features: string[];
  getIsResolved: () => boolean; // 🔥 GAP 9: Dynamic resolution check
}> => {
  const segments: Array<{ 
    startIndex: number; 
    endIndex: number; 
    topic: MessageDomain;
    features: string[];
    getIsResolved: () => boolean;
  }> = [];
  
  let currentSegmentStart = 0;
  let currentTopic: MessageDomain | null = null;
  let currentFeatures: string[] = [];
  
  messages.forEach((msg, index) => {
    const domain = detectMessageDomain(msg);
    const features = domain.featureContext || [];
    
    // 🔥 GAP 7 FIX: Topic changed if domain OR primary features changed
    const domainChanged = currentTopic && domain.domain !== currentTopic && domain.domain !== 'general';
    
    // 🔥 GAP 10 FIX: Check if PRIMARY features differ (most significant feature, not just any overlap)
    // "bills form" vs "categories form" should create new segment even though 'form' overlaps
    const getPrimaryFeature = (feats: string[]) => {
      // Prioritize nouns over verbs/actions
      const nouns = feats.filter(f => !['form', 'create', 'edit', 'delete', 'update', 'save', 'cancel', 'export', 'import'].includes(f));
      return nouns[0] || feats[0]; // Use first noun, or first feature if no nouns
    };
    
    const currentPrimary = currentFeatures.length > 0 ? getPrimaryFeature(currentFeatures) : null;
    const newPrimary = features.length > 0 ? getPrimaryFeature(features) : null;
    
    // 🔥 GAP 22 FIX: If previous had NO features and current HAS features (or vice versa), treat as new topic
    // This handles "update my app" (no features) → "add billing" (has features)
    const featureSpecificityChanged = (currentPrimary === null && newPrimary !== null) || 
                                      (currentPrimary !== null && newPrimary === null);
    
    const featuresChanged = (currentPrimary && newPrimary && currentPrimary !== newPrimary) || featureSpecificityChanged;
    
    const topicChanged = domainChanged || featuresChanged;
    
    // Check for explicit topic closure phrases
    const hasTopicClosure = msg.type === 'user' && detectTopicClosure(msg, messages.slice(0, index));
    
    if (topicChanged || hasTopicClosure) {
      // Close current segment
      if (currentTopic && index > 0) { // 🔥 SAFETY: Guard against index = 0
        const segmentStartIdx = currentSegmentStart;
        const segmentEndIdx = index - 1;
        
        // 🔥 SAFETY: Validate segment has at least one message
        if (segmentEndIdx >= segmentStartIdx) {
          // 🔥 GAP 9 FIX: Create function that checks resolution at call time
          const getIsResolved = () => {
            const segmentMessages = messages.slice(segmentStartIdx, segmentEndIdx + 1);
            // Guard against empty segments
            if (segmentMessages.length === 0) {
              return true; // Empty segment considered resolved
            }
            return segmentMessages.every(m => {
              const msgDomain = detectMessageDomain(m);
              return msgDomain.resolved === true;
            });
          };
          
          segments.push({
            startIndex: currentSegmentStart,
            endIndex: index - 1,
            topic: currentTopic,
            features: currentFeatures,
            getIsResolved
          });
          
          console.log(`📊 [SEGMENTATION] Segment ${segments.length}: ${currentTopic} [${currentSegmentStart}-${index-1}], features: [${currentFeatures.join(', ')}]`);
        } else {
          console.warn(`⚠️ [SEGMENTATION] Invalid segment bounds: start=${segmentStartIdx}, end=${segmentEndIdx}, skipping`);
        }
      }
      
      // Start new segment
      currentSegmentStart = index;
      currentTopic = domain.domain;
      currentFeatures = features;
    } else if (!currentTopic) {
      // Initialize first segment
      currentTopic = domain.domain;
      currentFeatures = features;
    } else {
      // Merge features within same segment
      currentFeatures = [...new Set([...currentFeatures, ...features])];
    }
  });
  
  // Close final segment
  if (currentTopic && messages.length > 0) { // 🔥 SAFETY: Guard against empty messages
    const segmentStartIdx = currentSegmentStart;
    const segmentEndIdx = messages.length - 1;
    
    // 🔥 SAFETY: Validate segment bounds
    if (segmentEndIdx >= segmentStartIdx && segmentEndIdx < messages.length) {
      // 🔥 GAP 9 FIX: Dynamic resolution check
      const getIsResolved = () => {
        const segmentMessages = messages.slice(segmentStartIdx, segmentEndIdx + 1);
        // Guard against empty segments
        if (segmentMessages.length === 0) {
          return true; // Empty segment considered resolved
        }
        return segmentMessages.every(m => {
          const msgDomain = detectMessageDomain(m);
          return msgDomain.resolved === true;
        });
      };
      
      segments.push({
        startIndex: currentSegmentStart,
        endIndex: messages.length - 1,
        topic: currentTopic,
        features: currentFeatures,
        getIsResolved
      });
      
      console.log(`📊 [SEGMENTATION] Final segment: ${currentTopic} [${currentSegmentStart}-${messages.length-1}], features: [${currentFeatures.join(', ')}]`);
    } else {
      console.warn(`⚠️ [SEGMENTATION] Invalid final segment bounds: start=${segmentStartIdx}, end=${segmentEndIdx}, messages.length=${messages.length}`);
    }
  }
  
  return segments;
};
