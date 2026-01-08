#!/usr/bin/env node

/**
 * 🔍 Initialization Issues Detector
 * 
 * Scans the codebase for patterns that can cause "Cannot access before initialization" errors.
 * Run this before building to catch potential issues early.
 * 
 * Usage: node scripts/detect-init-issues.js
 */

const fs = require('fs');
const path = require('path');

// Patterns that can cause initialization issues
const PROBLEMATIC_PATTERNS = [
  {
    name: 'Static class property with module reference',
    regex: /class\s+\w+\s*{[^}]*static\s+(readonly\s+)?\w+\s*=\s*[^;]*\.fromText\(/s,
    severity: 'error',
    fix: 'Convert static property to a static getter: static get PROPERTY() { return ... }'
  },
  {
    name: 'Top-level destructuring from module property',
    regex: /^const\s*{[^}]+}\s*=\s*[A-Z]\w+\.[A-Z]/m,
    severity: 'warning',
    fix: 'Move destructuring inside functions or use direct property access'
  },
  {
    name: 'React.LazyExoticComponent type in variable declaration',
    regex: /:\s*React\.LazyExoticComponent/,
    severity: 'error',
    fix: 'Use "any" type instead: let variable: any = null'
  },
  {
    name: 'Enum reference in static initializer',
    regex: /static\s+(readonly\s+)?\w+\s*=\s*\[.*?(?:FREE|BASIC|PRO|ENTERPRISE)/,
    severity: 'warning',
    fix: 'Move static initialization to a getter or function'
  },
  {
    name: 'Destructured import of React items',
    regex: /import\s+React,\s*{\s*[^}]*\blazy\b[^}]*}\s+from\s+['"]react['"]/,
    severity: 'warning',
    fix: 'Use React.lazy instead of destructured lazy import'
  },
  {
    name: 'Top-level constant array with enum values',
    regex: /^const\s+\w+\s*[:=]\s*(?:readonly\s*)?\[[\s\S]*?tier:\s*SubscriptionTier\./m,
    severity: 'error',
    fix: 'Convert to a getter function: static getPlans() { return [...] }'
  },
  {
    name: 'Principal.fromText() at module level',
    regex: /^(export\s+)?const\s+\w+\s*=\s*Principal\.fromText\(/m,
    severity: 'error',
    fix: 'Use a getter function: const getCanisterId = () => Principal.fromText(...)'
  }
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];

  for (const pattern of PROBLEMATIC_PATTERNS) {
    if (pattern.regex.test(content)) {
      issues.push({
        file: filePath,
        pattern: pattern.name,
        severity: pattern.severity,
        fix: pattern.fix
      });
    }
  }

  return issues;
}

function scanDirectory(dir, extensions = ['.ts', '.tsx']) {
  const allIssues = [];
  
  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      // Skip node_modules, dist, build directories
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', 'build', '.git'].includes(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          const issues = scanFile(fullPath);
          allIssues.push(...issues);
        }
      }
    }
  }
  
  walk(dir);
  return allIssues;
}

function printReport(issues) {
  console.log(`\n${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║         🔍 INITIALIZATION ISSUES DETECTION REPORT            ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  if (issues.length === 0) {
    console.log(`${colors.green}✅ No initialization issues detected! Your code looks good.${colors.reset}\n`);
    return;
  }

  // Group by severity
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  if (errors.length > 0) {
    console.log(`${colors.red}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.red}❌ ERRORS (${errors.length})${colors.reset}\n`);
    
    errors.forEach((issue, idx) => {
      console.log(`${colors.red}${idx + 1}. ${issue.pattern}${colors.reset}`);
      console.log(`   ${colors.gray}File: ${issue.file.replace(process.cwd(), '.')}${colors.reset}`);
      console.log(`   ${colors.cyan}Fix: ${issue.fix}${colors.reset}\n`);
    });
  }

  if (warnings.length > 0) {
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.yellow}⚠️  WARNINGS (${warnings.length})${colors.reset}\n`);
    
    warnings.forEach((issue, idx) => {
      console.log(`${colors.yellow}${idx + 1}. ${issue.pattern}${colors.reset}`);
      console.log(`   ${colors.gray}File: ${issue.file.replace(process.cwd(), '.')}${colors.reset}`);
      console.log(`   ${colors.cyan}Fix: ${issue.fix}${colors.reset}\n`);
    });
  }

  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.cyan}Summary: ${colors.red}${errors.length} error(s)${colors.reset}, ${colors.yellow}${warnings.length} warning(s)${colors.reset}\n`);

  if (errors.length > 0) {
    console.log(`${colors.red}⚠️  Please fix the errors above to prevent "Cannot access before initialization" errors.${colors.reset}\n`);
    process.exit(1);
  }
}

// Main execution
const srcDir = path.join(__dirname, '../src');
console.log(`${colors.cyan}Scanning ${srcDir} for initialization issues...${colors.reset}`);

const issues = scanDirectory(srcDir);
printReport(issues);

