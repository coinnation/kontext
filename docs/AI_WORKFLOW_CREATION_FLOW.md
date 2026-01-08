# AI Workflow Creation Flow - Comprehensive Guide

## Overview

This document explains how the AI-driven workflow creation process works, including agent selection, server pair allocation, and the different scenarios you'll encounter.

## High-Level Flow

```
1. User enters workflow prompt
   ↓
2. AI generates WorkflowSpec (with steps that may need agents)
   ↓
3. Check if steps need agent configuration
   ↓
4. If yes → Show WorkflowAgentSelection UI
   ↓
5. User selects existing agents OR creates new ones
   ↓
6. Check dependencies (server pairs, MCP auth, etc.)
   ↓
7. If missing → Show DependencyResolutionWizard
   ↓
8. Create workflow (creates any remaining agents if needed)
```

---

## Scenario 1: No Agents, No Server Pairs

### What Happens:

1. **Generation Phase** (`AIWorkflowBuilder.handleGenerate`):
   - Context passed to AI: `{ existingAgents: [], availableServerPairs: 0 }`
   - AI generates a `WorkflowSpec` with steps containing `agentSpec` (agents to create)
   - AI does NOT know about existing agents, so it always generates new agent specs

2. **Agent Selection Phase** (`WorkflowAgentSelection`):
   - Loads existing agents from `localStorage.getItem('deployed-agents-${projectId}')`
   - Finds **NO existing agents**
   - For each step:
     - Shows "Create New Agent" button
     - User clicks to create agent
     - **Uses FIRST available server pair** (`pairsResult.ok[0].pairId`)
     - Creates agent using `SpecToEntityConverter.createAgentFromSpec()`
     - Agent is saved to localStorage

3. **Dependency Resolution** (`DependencyResolutionWizard`):
   - Checks if server pairs exist
   - If none exist, offers to create one automatically
   - User can create server pair with credits allocation

4. **Workflow Creation** (`SpecToEntityConverter.createWorkflowFromSpec`):
   - If any steps still have `agentSpec` but no `agentCanisterId`, creates those agents first
   - **All agents use the SAME server pair** (the first one available)
   - Then creates the workflow/agency

### Key Points:
- ✅ **Multiple agents CAN be created** - one per workflow step
- ⚠️ **All agents use the SAME server pair** - they share infrastructure
- ⚠️ **AI doesn't know about existing agents** - always generates new specs

---

## Scenario 2: One Agent Already Deployed

### What Happens:

1. **Generation Phase**:
   - Context still has `existingAgents: []` (not populated!)
   - AI generates specs for NEW agents (doesn't know about existing one)

2. **Agent Selection Phase**:
   - Loads existing agents from localStorage
   - Finds **ONE existing agent**
   - For each step:
     - Shows dropdown with existing agent: `"My Agent (active)"`
     - User can:
       - **Select existing agent** → Reuses it
       - **Create new agent** → Creates another agent on same server pair

3. **Auto-Selection Logic**:
   - ❌ **NO automatic selection** - user must manually choose
   - User sees both options: "Select Existing Agent" dropdown + "Create New Agent" button

4. **Workflow Creation**:
   - Selected agents are used (existing or newly created)
   - All agents still use the same server pair

### Key Points:
- ✅ **Can reuse existing agent** - manually select from dropdown
- ⚠️ **No auto-selection** - AI doesn't suggest which agent to use
- ⚠️ **All agents still share same server pair**

---

## Scenario 3: Multiple Agents Already Deployed

### What Happens:

1. **Generation Phase**:
   - Context still empty: `existingAgents: []`
   - AI generates new agent specs (doesn't know about existing agents)

2. **Agent Selection Phase**:
   - Loads existing agents from localStorage
   - Finds **MULTIPLE existing agents**
   - For each step:
     - Shows dropdown with all existing agents:
       ```
       -- Choose an agent --
       Email Sender (active)
       Data Analyzer (active)
       Report Generator (active)
       ```
     - User can:
       - **Select any existing agent** → Reuses it
       - **Create new agent** → Creates another agent

3. **Auto-Selection Logic**:
   - ❌ **NO automatic matching** - user must manually select
   - No intelligent matching based on agent name/description
   - User sees all agents in dropdown, must choose manually

4. **Workflow Creation**:
   - Uses selected agents (mix of existing and new)
   - All agents use the same server pair

### Key Points:
- ✅ **Can reuse multiple existing agents**
- ⚠️ **No intelligent matching** - user must manually match agents to steps
- ⚠️ **All agents share same server pair** (even if they were originally on different pairs)

---

## Server Pair Allocation

### Current Behavior:

**ALL agents in a workflow use the SAME server pair** - the first available one:

```typescript
// In WorkflowAgentSelection.handleCreateAgent:
const pairsResult = await userActor.getProjectServerPairs(activeProject);
const serverPairId = pairsResult.ok[0].pairId; // ← Always uses FIRST pair
```

### Implications:

1. **Single Server Pair for All Agents**:
   - If you have 3 workflow steps, all 3 agents deploy to the same server pair
   - They share the same backend canister infrastructure
   - This is efficient for resource usage

2. **No Multi-Server Pair Support**:
   - Currently, there's no option to deploy different agents to different server pairs
   - All agents in a workflow must use the same infrastructure

3. **Server Pair Creation**:
   - If no server pairs exist, `DependencyResolutionWizard` offers to create one
   - Creates with default 10,000 credits
   - Can create hosting configuration automatically

---

## Agent Creation During Workflow Creation

### Two Places Agents Can Be Created:

1. **In WorkflowAgentSelection** (User-initiated):
   - User clicks "Create Agent" button
   - Agent is created immediately
   - User can see it in the dropdown
   - Uses first available server pair

2. **In SpecToEntityConverter.createWorkflowFromSpec** (Automatic):
   - If workflow still has steps with `agentSpec` but no `agentCanisterId`
   - Automatically creates those agents before creating workflow
   - Also uses first available server pair
   - Happens silently during workflow creation

### Code Flow:

```typescript
// In SpecToEntityConverter.createWorkflowFromSpec:
for (const step of spec.steps) {
  if (step.agentSpec && !step.agentCanisterId) {
    // Create agent automatically
    const agentResult = await this.createAgentFromSpec(step.agentSpec, context);
    step.agentCanisterId = agentResult.entityId;
  }
}
```

---

## Current Limitations & Issues

### 1. AI Doesn't Know About Existing Agents

**Problem**: The context passed to AI generation is always empty:
```typescript
const context = {
  projectId,
  userCanisterId,
  availableServerPairs: 0,
  existingAgents: [],  // ← Always empty!
  existingWorkflows: []
};
```

**Impact**: 
- AI always generates new agent specs
- Can't intelligently suggest reusing existing agents
- User must manually select agents in UI

**Fix Needed**: Load existing agents before generation and pass to context.

### 2. No Auto-Selection/Matching

**Problem**: Even if existing agents match workflow steps, user must manually select them.

**Impact**:
- Extra user interaction required
- No intelligent matching by name/description/capabilities

**Fix Needed**: Add intelligent matching logic to suggest best existing agents for each step.

### 3. All Agents Use Same Server Pair

**Problem**: All agents in a workflow use the first available server pair.

**Impact**:
- Can't distribute agents across multiple server pairs
- All agents share same infrastructure (good for efficiency, but limits flexibility)

**Fix Needed**: Allow selecting different server pairs per agent (if multiple pairs exist).

### 4. Server Pair Not Passed in Context

**Problem**: When creating agents during workflow creation, server pair is fetched fresh each time.

**Impact**:
- Could potentially use different server pairs if multiple exist
- No guarantee of consistency

**Fix Needed**: Pass server pair ID through the entire flow.

---

## Recommended Improvements

### 1. Load Existing Agents Before Generation

```typescript
// In AIWorkflowBuilder.handleGenerate:
const existingAgents = await loadExistingAgents(projectId);
const serverPairs = await loadServerPairs(projectId);

const context = {
  projectId,
  userCanisterId,
  availableServerPairs: serverPairs.length,
  existingAgents: existingAgents.map(a => ({
    id: a.backendCanisterId,
    name: a.name,
    description: a.description || '',
    capabilities: a.capabilities || []
  })),
  existingWorkflows: []
};
```

### 2. Add Intelligent Agent Matching

```typescript
// In WorkflowAgentSelection:
const suggestAgentForStep = (step: WorkflowStep, existingAgents: DeployedAgent[]) => {
  // Match by name similarity
  // Match by MCP servers used
  // Match by description/capabilities
  return bestMatch;
};
```

### 3. Auto-Select Matching Agents

```typescript
// Auto-select if exact match found
if (exactMatch) {
  setSelectedAgents(prev => ({
    ...prev,
    [step.stepId]: exactMatch.backendCanisterId
  }));
}
```

### 4. Support Multiple Server Pairs

```typescript
// Allow selecting server pair per agent
interface AgentConfig {
  agentCanisterId?: string;
  serverPairId?: string; // ← New field
}
```

---

## Summary Table

| Scenario | Existing Agents | Server Pairs | AI Behavior | User Action | Result |
|----------|----------------|--------------|-------------|-------------|---------|
| **1. None** | 0 | 0 | Generates new specs | Creates all agents | All agents on 1 new server pair |
| **2. One** | 1 | 1+ | Generates new specs | Selects existing OR creates new | Mix of existing + new on same pair |
| **3. Multiple** | 2+ | 1+ | Generates new specs | Selects existing OR creates new | Mix of existing + new on same pair |

### Key Takeaways:

1. ✅ **Multiple agents CAN be created** - one per workflow step
2. ⚠️ **All agents use SAME server pair** - first available one
3. ⚠️ **AI doesn't know about existing agents** - always generates new specs
4. ⚠️ **No auto-selection** - user must manually choose agents
5. ✅ **Can reuse existing agents** - via dropdown selection

---

## Code Locations

- **Workflow Generation**: `src/frontend/src/components/aiAssistant/AIWorkflowBuilder.tsx`
- **Agent Selection UI**: `src/frontend/src/components/aiAssistant/WorkflowAgentSelection.tsx`
- **Dependency Resolution**: `src/frontend/src/components/aiAssistant/DependencyResolutionWizard.tsx`
- **Spec Conversion**: `src/frontend/src/services/SpecToEntityConverter.ts`
- **AI Generation Service**: `src/frontend/src/services/AIAgentGeneratorService.ts`
- **Dependency Analysis**: `src/frontend/src/services/DependencyAnalyzer.ts`

