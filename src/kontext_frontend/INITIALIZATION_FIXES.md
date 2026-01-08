# 🔧 Initialization Issues - Fixed & Prevention System

## What Was Wrong

You were experiencing `Cannot access 'At' before initialization` errors, which are caused by circular dependencies and module initialization order issues in JavaScript/TypeScript.

## Root Causes

1. **Circular Dependencies**: When Module A imports Module B, and Module B imports Module A
2. **Static Class Properties**: Using `static readonly PROPERTY = SomeModule.method()` causes initialization at module load time
3. **Destructured Imports**: `import { lazy } from 'react'` can fail if React isn't fully initialized
4. **Type References in Variable Declarations**: `let x: React.LazyExoticComponent<any>` can fail during module parsing

## ✅ What We Fixed

### 1. Vite-Level Detection (Automatic)

Added a custom Vite plugin that scans **every build** for:
- Circular dependencies
- Static properties with module references
- Top-level destructuring issues
- Enum references in static initializers
- React type references that can cause initialization errors

**Location**: `vite.config.ts` (lines 7-99)

### 2. Pre-Build Scanning (Manual)

Created a standalone script to scan your codebase for problematic patterns:

```bash
# Run manually anytime
npm run check:init

# Runs automatically before every build
npm run build
```

**Location**: `scripts/detect-init-issues.js`

### 3. Vite Build Optimizations

Enhanced esbuild configuration to:
- Keep class names for better error messages
- Use proper ESM format
- Handle Stripe modules correctly
- Prevent hoisting issues

### 4. Specific Fixes Applied

#### TopUpCreditsDialog.tsx
**Before:**
```typescript
let _StripeElementsWrapper: React.LazyExoticComponent<any> | null = null;
```

**After:**
```typescript
let _StripeElementsWrapper: any = null;
```

**Why**: The type reference `React.LazyExoticComponent` was evaluated during module initialization, before React was fully loaded.

#### ProfileInterface.tsx
**Before:**
```typescript
import React, { useState, useEffect, Suspense, lazy } from 'react';
const StripeElementsWrapper = lazy(() => ...);
```

**After:**
```typescript
import React, { useState, useEffect, Suspense } from 'react';
const StripeElementsWrapper = React.lazy(() => ...);
```

**Why**: Destructuring `lazy` from React can fail if there's any circular dependency in the module graph. Using `React.lazy` is safer.

## 🛡️ Prevention System

### Automatic Checks (Every Build)

The Vite plugin now runs on **every build** and will:
- ⚠️  Warn about potential issues
- 🛑  Prevent builds with critical errors
- 📊  Report circular dependencies

### Manual Checks (Anytime)

Run this before committing:
```bash
npm run check:init
```

This will scan all `.ts` and `.tsx` files for:
- ❌ **Errors** (will fail the build)
  - Static class properties with module references
  - React type references in variable declarations
  - Top-level enum destructuring

- ⚠️  **Warnings** (build continues, but you should fix)
  - Top-level destructuring from module properties
  - Destructured React imports
  - Enum references in static initializers

## 📋 Common Patterns to Avoid

### ❌ Bad
```typescript
// Static property with module reference
class MyService {
  private static readonly CMC_ID = Principal.fromText('...');
}

// Destructured React imports
import { lazy } from 'react';

// React type in variable declaration
let wrapper: React.LazyExoticComponent<any> = null;

// Top-level enum destructuring
const { FREE, PRO } = SubscriptionTier;
```

### ✅ Good
```typescript
// Use a getter for static properties
class MyService {
  private static get CMC_ID() {
    return Principal.fromText('...');
  }
}

// Use React.lazy instead
import React from 'react';
const Component = React.lazy(() => ...);

// Use 'any' type
let wrapper: any = null;

// Access enums directly
const tier = SubscriptionTier.FREE;
```

## 🧪 Testing Your Changes

1. **Run the detection script**:
   ```bash
   npm run check:init
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```
   The detection runs automatically before build.

3. **Check console output**:
   - ✅ Green = No issues
   - ⚠️  Yellow = Warnings (fix when possible)
   - ❌ Red = Errors (must fix)

## 📊 Current Status

✅ All initialization issues detected and fixed!
✅ Automatic detection enabled for all future builds
✅ Manual scanning script available

## 🔍 How to Debug New Issues

If you get a new "Cannot access before initialization" error:

1. **Note the error location**: Check the file and line number
2. **Run the detection script**: `npm run check:init`
3. **Look for**:
   - Circular imports (A imports B, B imports A)
   - Static properties being set at module load time
   - Destructured imports from other modules
4. **Apply fixes**:
   - Convert static properties to getters
   - Move initialization into functions
   - Use direct property access instead of destructuring

## 📚 Resources

- **Detection Script**: `scripts/detect-init-issues.js`
- **Vite Plugin**: `vite.config.ts` (circularDependencyPlugin)
- **Build Config**: `vite.config.ts` (esbuild section)

## 🎯 Benefits

- 🚀 **Faster debugging**: Issues caught at build time, not runtime
- 📊 **Better visibility**: Clear reports of what's wrong and how to fix
- 🛡️ **Prevention**: Stops bad patterns from entering the codebase
- 📖 **Educational**: Teaches best practices through fix suggestions

