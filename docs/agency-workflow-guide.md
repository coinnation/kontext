# Agency Workflow Guide

## Understanding Execution Modes and Connections

When building workflows in the Agency Workflow Manager, you can connect agent nodes together. **What these connections mean depends on which execution mode you choose.**

---

## 🎯 Execution Modes Overview

### 1. Sequential Mode ➡️
**"One after another, in order"**

Agents execute one at a time, following the connection path.

**What connections mean:**
- Connections define the **exact execution order**
- Agent A → Agent B → Agent C means: A runs first, then B, then C
- Each agent waits for the previous one to finish

**Example:**
```
[Agent A] → [Agent B] → [Agent C]
```
**Execution:** A runs → B runs → C runs (one at a time)

**When to use:**
- ✅ When agents depend on previous results
- ✅ When you need predictable, step-by-step execution
- ✅ For data pipelines where each step processes the previous step's output

**Data Flow:**
- Agent B can use Agent A's output via `{previous_output}` or `{step_1_output}`
- Agent C can use Agent B's output via `{previous_output}` or `{step_2_output}`

---

### 2. Parallel Mode ⚡
**"Run in waves - same level runs together"**

Agents at the same "level" run simultaneously, but levels run one after another.

**What connections mean:**
- Connections define **execution waves/levels**
- Agents with no incoming connections = **Level 0** (run together)
- Agents connected to Level 0 = **Level 1** (run together after Level 0 finishes)
- And so on...

**Example:**
```
Level 0: [Agent A]  [Agent B]  (run in parallel)
           ↓          ↓
Level 1: [Agent C]  [Agent D]  (run in parallel after A & B complete)
```

**Execution:**
1. A and B run **at the same time** (parallel)
2. After both A and B finish, C and D run **at the same time** (parallel)

**When to use:**
- ✅ When some agents can run independently
- ✅ When you want faster execution by running multiple agents simultaneously
- ✅ For processing multiple independent tasks that later need to be combined

**Data Flow:**
- Agents at Level 1 can reference outputs from Level 0 agents
- Use `{step_1_output}` for Agent A's output, `{step_2_output}` for Agent B's output, etc.

**Important:** This is **staged parallel execution**, not all agents running at once. Connections create dependency levels.

---

### 3. Conditional Mode 🔀
**"Choose a path based on conditions"**

Agents execute based on conditions and results - only one path runs.

**What connections mean:**
- Connections represent **conditional branches**
- Each connection can have a condition (e.g., "if success", "if error", "if value > 100")
- Only one path executes based on the condition result

**Example:**
```
        [Agent A]
         /    \
    (success) (failure)
       /        \
[Agent B]    [Agent C]
```

**Execution:**
- If Agent A succeeds → Agent B runs
- If Agent A fails → Agent C runs
- **Only one path executes**, not both

**When to use:**
- ✅ When execution path depends on data or results
- ✅ For error handling and branching logic
- ✅ When you need different agents based on conditions

**Data Flow:**
- The selected path's agents can use outputs from the condition-checking agent
- Use `{previous_output}` to access the result that determined the path

**Note:** Conditional mode is currently in development and uses parallel layout. Full conditional routing features are coming soon.

---

## 📊 Quick Comparison

| Mode | Connection Meaning | Execution Pattern | Best For |
|------|-------------------|------------------|----------|
| **Sequential** | Execution order | A → B → C (one at a time) | Data pipelines, dependent steps |
| **Parallel** | Execution waves | Level 0: [A,B] together → Level 1: [C,D] together | Independent tasks, faster execution |
| **Conditional** | Conditional branches | A → (if X) B else C (one path) | Error handling, branching logic |

---

## 🔗 How to Connect Nodes

1. **Hover over an agent node** - you'll see connection handles
2. **Click and drag** from one node to another to create a connection
3. **The connection direction matters:**
   - Source node (where you start) = executes first (or at a lower level)
   - Target node (where you end) = executes after (or at a higher level)

---

## 💡 Tips

### Sequential Mode Tips
- Connect nodes in the order you want them to execute
- All nodes should be connected in a chain (A → B → C → D)
- Disconnected nodes will show a warning

### Parallel Mode Tips
- Connect nodes to create dependency levels
- Nodes at the same level (no connections between them) run together
- More connections = more levels = more sequential waiting

### Conditional Mode Tips
- Plan your branching logic before connecting
- Each branch should represent a different condition outcome
- Only one path will execute based on the condition

---

## 🎨 Visual Indicators

- **Animated edges** (flowing animation) = Sequential mode
- **Static edges** = Parallel or Conditional mode
- **Node levels** (vertical grouping) = Parallel mode layout
- **Branching structure** = Conditional mode (coming soon)

---

## ❓ Common Questions

**Q: Can I have disconnected nodes?**
- In Sequential mode: Not recommended - they'll show warnings
- In Parallel mode: Yes - disconnected nodes run at Level 0 (all together)
- In Conditional mode: Depends on your branching logic

**Q: What if I don't connect any nodes?**
- Sequential: All nodes run in the order they appear (not recommended)
- Parallel: All nodes run at Level 0 (all together simultaneously)
- Conditional: Invalid - need connections for branching

**Q: Can I change execution mode after creating connections?**
- Yes! But the meaning of your connections will change:
  - Sequential → Parallel: Your chain becomes levels
  - Parallel → Sequential: Your levels become a chain
  - Always review your workflow after changing modes

---

## 🚀 Getting Started

1. **Choose your execution mode** first (Sequential, Parallel, or Conditional)
2. **Add agent nodes** to your canvas
3. **Connect them** based on what the mode means (see above)
4. **Configure each agent** with input templates that reference previous outputs
5. **Test your workflow** to ensure it executes as expected

---

*For more advanced features like input templates, triggers, and approvals, see the main Agency Workflow documentation.*
