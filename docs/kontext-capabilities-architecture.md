### Kontext – Internal Developer / Architecture Overview

This document is a high-level architectural summary of the Kontext system, derived from the current codebase.

---

#### 1. High-Level System Layout

- **Frontend**
  - React/TypeScript application in `src/frontend/src`.
  - Core feature interfaces (selected):
    - `DeploymentInterface` – full-stack deployment console.
    - `HostingInterface` – server pair, credits, and canister management.
    - `AgentManagementInterface` – single-agent console.
    - `AgenciesManagementInterface` – agency/workflow manager.
    - `WorkflowCanvas` and related components – visual workflow builder.
    - `DatabaseInterface` (desktop & mobile) – generic data/canister interfaces.
    - `ChatInterface` and related – conversational dev UX.

- **Backends / Canisters**
  - Main Kontext backend canister(s):
    - `kontext_backend` (Motoko) – platform logic.
    - `user` canister – per-user/project data (projects, files, server pairs, etc.).
  - Dedicated **agent** canisters – each agent is its own backend.
  - Dedicated **agency workflow engine** canisters – one per project/workflow engine.
  - Frontend canisters hosting:
    - Deployed user apps.
    - Independent agent UIs.
    - Independent agency workflow UIs.

---

#### 2. Core Services & Modules

##### 2.1 User & Project Management – `UserCanisterService`

- Responsibilities:
  - Manage project lifecycle (create, import, save, export).
  - Store and retrieve:
    - Project files (Motoko, TS/JS/TSX/JSX, configs).
    - Code artifacts and metadata.
    - Messages and project-related data.
  - Provide batched download sessions for large exports.
- Implementation notes:
  - Wraps the `main.did` / `user.did` actors with a proxy that auto-normalizes Candid → JS (BigInt, optionals, etc.).
  - Used throughout the frontend to interact with per-user data.

##### 2.2 Deployment – `DeploymentService` & `DeploymentInterface`

- `DeploymentService` (in `src/frontend/src/services/DeploymentService.tsx`):
  - `executeFullDeployment` pipeline:
    1. **Create deployment snapshot** from:
       - Saved project files.
       - Project-generated files.
       - Ad-hoc generated files.
    2. **Split** into:
       - Motoko backend files (`.mo`).
       - Frontend files (everything else except `.did`).
    3. **Compile backend** Motoko, produce WASM + Candid.
    4. **Deploy backend WASM** to a selected backend canister.
    5. **Bundle frontend** (via external JS bundler service) and deploy to frontend canister.
  - Handles large WASM uploads via chunking and finalize steps.

- `DeploymentInterface` (in `components/DeploymentInterface.tsx`):
  - UI for deployment with:
    - Validation of required files (Motoko, frontend, `package.json`).
    - Consolidated deployment state (status, progress, logs, errors, history).
    - Integration with:
      - `DeploymentErrorHandler` – structured error parsing and fix suggestions.
      - `AutoRetryCoordinator` – centralized auto-retry state across projects.
  - Manages persistent deployment cache per project.

##### 2.3 Hosting & Server Pairs – `HostingInterface` & `ServerPairProjectResolver`

- `HostingInterface`:
  - Comprehensive hosting management interface:
    - **Server pair lifecycle**: Create, configure, assign, and remove server pairs.
    - **Credit management**: Allocate credits to server pairs with automatic optimal configuration calculation.
    - **Real-time monitoring**: Track canister status, cycles balance, and credit usage.
    - **Credit-to-USD conversion**: Display costs in both credits and USD for transparency.
    - **Cycles top-up**: Direct integration with Cycles Minting Canister for cycle management.
    - **Server pair assignment**: Assign server pairs to projects with visual management.
    - **Automatic credit refresh**: Real-time balance updates during operations (every 2 seconds).
  - State management:
    - Tracks all user canisters and server pairs.
    - Manages server pair metadata (names, creation dates, credit allocations).
    - Handles server removal workflows with progress tracking.
  - Integrates with:
    - `CreditsService` and `SubscriptionService` (usage and billing).
    - `IcpPriceService` for real-time ICP price data.
    - Cycles Minting Canister (`createCMCActor`) for cycles operations.
    - `UserCanisterService` for server pair CRUD operations.

- `ServerPairProjectResolver`:
  - Resolves which server pairs belong to which projects.
  - Provides abstractions used by both `HostingInterface` and deployment flows.
  - Manages the mapping between projects and their hosting infrastructure.

##### 2.4 Agents – `AgentManagementInterface` & Inner `AgentServiceClass`

- `AgentManagementInterface`:
  - Main UI for managing individual agent canisters.
  - Displays:
    - Agent identity and configuration.
    - Metrics (counts, cycles, MCP tools, etc.).
    - Tasks history and results.
    - Triggers list and details.
    - Pending approvals, errors, and activity events.

- Inner `AgentServiceClass` (inside `AgentManagementInterface.tsx`):
  - Maintains a `Map<string, AgentService>` of cached agent actors.
  - `createAgentActor(canisterId, identity)`:
    - Creates an `HttpAgent` (host determined by environment).
    - Optionally fetches root key for local dev.
    - Builds an `AgentService` actor using `agentIdlFactory`.
  - `getAgentData`:
    - Uses `Promise.allSettled` to fetch:
      - `getAgentIdentity()`
      - `getMetrics()`
      - `getAllTasks(limit)`
      - `getTriggers()`
      - `getPendingApprovals()`
      - `getActiveErrors()`
      - `getRecentActivity(limit)`
    - Normalizes all returned values (BigInt → number, principals → string, optionals → JS optionals).
  - Control methods:
    - `executeTask`, `processApproval`, `toggleTrigger`, `executeTrigger`.
    - `updateAgentConfig` (full configuration update).
    - `getTask`, `getTrigger`, `getTriggerHistory`.

##### 2.5 Agencies – `AgencyService`, `AgenciesManagementInterface`, `WorkflowCanvas`

- `AgencyService`:
  - Encapsulates all interactions with the **agency workflow engine canister**.
  - Responsibilities:
    - Resolve the appropriate backend canister for a project from server pairs.
    - CRUD operations for agencies and executions.
    - Agent registration within agencies (ensuring agents are known by the workflow engine).
    - Trigger management at agency level:
      - `createWebhookTrigger`, `getAgencyTriggers`.
      - `registerWebhook`, `unregisterWebhook`.
    - Expose Candid `TriggerType` variants for `manual`, `scheduled`, `api`, `webhook`, `event`, `agent`, `external`, and `condition` triggers.

- `AgenciesManagementInterface`:
  - Orchestrates the **agency workflow engine lifecycle** per project:
    - Checks whether the engine is initialized.
    - Guides initialization against a selected server pair.
    - Supports reset and re-binding to a different server pair.
    - Persists initialization status and workflow UI URL in `localStorage`.
  - Maintains UI and data state:
    - Agencies, executions, triggers, metrics, activity events, approvals, errors.
    - Server pairs and selected pair.
    - Workflow editing forms (steps, execution mode, trigger config, etc.).

- `WorkflowCanvas` and related components (`AgentNode`, `ConnectionEdge`, `NodeConfigPanel`, `WorkflowToolbar`, `WorkflowValidator`, `ExecutionModeSelector`, `TemplateLibrary`):
  - Implement a **ReactFlow-based** workflow editor.
  - Represent agents as nodes and execution dependencies as edges.
  - Apply validation rules to prevent invalid workflows (e.g., using the workflow engine canister as an agent).
  - Integrate with agency forms to update steps and execution modes.

##### 2.6 Dynamic Canisters & Database Layer – `DynamicCanisterService`, `CanisterMethodDiscovery` & Database Components

- `DynamicCanisterService` (database/services and shared/services):
  - Given a canister ID + `.did.js` / `.did.d.ts` content, creates a typed actor on mainnet.
  - Priority order:
    1. Use `.did.js` to create IDL factory.
    2. Fallback to `.did.d.ts`.
    3. As last resort, build a generic IDL.
  - Enables **universal canister connectivity**—any IC canister can be accessed as a data source.

- `CanisterMethodDiscovery`:
  - Introspects canister interfaces to discover available methods.
  - Categorizes methods into:
    - **Getters**: Methods that retrieve data (query methods).
    - **Setters**: Methods that modify data (update methods).
    - **Queries**: Read-only operations.
    - **Updates**: State-changing operations.
  - Builds method metadata for UI generation.

- `DatabaseInterface` (desktop):
  - Main database interface component (`database/components/desktop/DatabaseInterface.tsx`):
    - Connects to canisters via `DynamicCanisterService`.
    - Discovers canister schema using `CanisterMethodDiscovery`.
    - Manages connection state, loading, and error handling.
    - Provides tabbed interface for different views (table, form, query builder).
  - **Schema-based database form** (`SchemaBasedDatabaseForm`):
    - Dynamically generates forms based on canister schema.
    - Supports nested objects, arrays, and complex types.
    - Handles field validation and data transformation.
  - **Database table view** (`DatabaseTableView`):
    - Displays canister data in sortable, filterable tables.
    - Supports pagination and real-time updates.
    - Handles large datasets efficiently.
  - **Query builder** (`DatabaseQueryBuilder`):
    - Visual interface for constructing queries.
    - Supports filtering, sorting, and field selection.
    - Generates method calls based on user selections.

- Database mobile components:
  - `DatabaseInterface.mobile`: Mobile-optimized main interface.
  - `MobileQueryInterface`: Touch-friendly query builder.
  - `MobileTableInterface`: Mobile table view with swipe gestures.
  - `MobileFormInterface`: Mobile-optimized form interface.

- Specialized field components:
  - `ColorField`: Color picker for color data types.
  - `ImageField`: Image upload and preview for image data.
  - Extensible architecture for adding more specialized field types.

- **Key capability**: The Database tab transforms any Internet Computer canister into an accessible, queryable database without requiring custom backend code. This dramatically expands Kontext's utility beyond just user-created apps to include any IC-based data source.

---

#### 3. Cross-Cutting Concerns

##### 3.1 Initialization & Recovery

- Components: `InitializationOverlay`, `InitializationRecoveryDialog`.
- Services: `InitializationRecoveryService`, `InitializationCache`, `OptimizedInitialization`.
- Purpose:
  - Track platform and project initialization state.
  - Provide guided recovery when deployments or initialization steps partially fail.

##### 3.2 Error Handling & Auto-Retry

- `DeploymentErrorHandler`:
  - Parses raw compiler/bundler logs into structured diagnostics.
  - Offers user-friendly summaries and fix suggestions.

- `AutoRetryCoordinator`:
  - Maintains a set of **deployment workflows** with:
    - `workflowId`, `phase`, `executionCount`, `maxExecutions`.
    - Error states and retry readiness.
  - `DeploymentInterface` subscribes to this coordinator to know when to clear state and re-run deployments.

##### 3.3 Environment Configuration & Vite Integration

- `AgentDeploymentService.generateViteConfig(backendCanisterId)`:
  - Emits a `vite.config.ts` that defines:
    - `import.meta.env.VITE_BACKEND_CANISTER_ID` = the backend canister ID.
  - Used for:
    - Independent agent UIs.
    - Agency workflow UIs.
    - Ensuring deployed frontends can locate their backend canister without Kontext context.

- `DeploymentService` and `AgentDeploymentService` ensure the generated `vite.config.ts` is included in frontend bundles sent to the JS bundler.

---

#### 4. UX & Supporting Interfaces

- **Chat UX – Professional Development Tool Experience**:
  - `ChatInterface`: Main chat interface component with sophisticated state management.
    - **Message coordination**: `MessageCoordinator` handles complex multi-step interactions.
    - **Auto-retry integration**: Seamless integration with `AutoRetryCoordinator` for failed operations.
    - **Deployment automation bridges**: Connects chat commands to deployment workflows.
    - **Project creation coordination**: Multi-step project creation workflows via `ProjectCreationCoordinator`.
    - **Tab management**: Intelligent tab switching with context preservation.
    - **Real-time streaming**: Polished streaming responses with elegant loading animations.
    - **Project-scoped conversations**: Each project maintains its own conversation history.
    - **Server pair coordination**: Automatic server pair selection and assignment during workflows.
  - `ChatInput`: Advanced input component with:
    - Auto-completion and suggestions.
    - Command recognition and routing.
    - Integration with deployment and project creation flows.
  - `MessageList`: Sophisticated message rendering with:
    - Streaming message display.
    - Code syntax highlighting.
    - File attachment handling.
    - Message threading and context.
  - `ChatHeader`: Project-aware header with:
    - Project switching.
    - Status indicators.
    - Quick actions.
  - `ChatPreloadService`: Preloads context and project data for faster interactions.
  - **Design philosophy**: Unlike typical "vibe coder" tools, Kontext's chat interface is designed to feel like a **professional development tool** with:
    - Polished animations and transitions.
    - Reliable, predictable behavior.
    - Enterprise-grade error handling and recovery.
    - Attention to detail in loading states and feedback.
    - Context-aware intelligence that understands project state.

- **Navigation & Layout**: `Sidebar`, `SidePane`, `TabBar`, `IndependentSidebarToggle`, `ProjectTabs`, `ProjectOverview`.
- **Profile & Billing**: `ProfileInterface`, `ProfileSettingsDialog`, `UserDropdown`, `UserCreditsDropdown`, `SubscriptionSelectionInterface`, `TopUpCreditsDialog`, `RenewalWarningBanner`, `TransactionTrackingModal`.
- **Loading & Status**: `KontextLoadingScreen`, `UpdatePreviewOverlay`, numerous per-interface spinners and progress bars.

This architecture makes Kontext a **composable platform**: projects, agents, agencies, and generic canisters all sit on the same rails (deployment, hosting, billing, observability), which can be extended with new canister types and UI surfaces over time.
