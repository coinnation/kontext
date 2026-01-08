import React, { useState, useMemo } from 'react';
import { UserDropdown } from './UserDropdown';

interface FeatureDetail {
  title: string;
  description: string;
  details: string;
}

interface HowToUseStep {
  step: string;
  title: string;
  description: string;
}

interface TipDetail {
  tip: string;
  description: string;
}

interface DocumentationSection {
  id: string;
  title: string;
  icon: string;
  content: {
    overview: string;
    features: string[] | FeatureDetail[];
    howToUse: string[] | HowToUseStep[];
    tips?: string[] | TipDetail[];
  };
}

interface DocumentationInterfaceProps {
  onClose?: () => void;
  onOpenProfile?: () => void;
  onOpenAdmin?: () => void;
  onLogout?: () => void;
  isAdmin?: boolean;
}

export const DocumentationInterface: React.FC<DocumentationInterfaceProps> = ({ 
  onClose, 
  onOpenProfile, 
  onOpenAdmin, 
  onLogout,
  isAdmin = false
}) => {
  const [activeSection, setActiveSection] = useState<string>('getting-started');
  const [searchQuery, setSearchQuery] = useState('');

  const documentationSections: DocumentationSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: '🚀',
      content: {
        overview: 'Welcome to Kontext! This guide will help you get started with building, deploying, and managing your applications on the decentralized cloud.',
        features: [
          'Internet Identity authentication for secure access',
          'Project-based workspace organization',
          'Full-stack development environment',
          'AI-powered code generation and assistance',
          'One-click deployment to decentralized infrastructure'
        ],
        howToUse: [
          'Sign in using Internet Identity authentication',
          'Select or create a subscription plan (Starter, Developer, or Pro)',
          'Create your first project or import an existing one',
          'Start building with the Chat interface or explore other tabs',
          'Deploy your application when ready'
        ],
        tips: [
          'Start with the Chat tab to get familiar with AI assistance',
          'Use the Context tab to provide project-specific information to the AI',
          'Check your credits balance regularly in the Profile tab'
        ]
      }
    },
    {
      id: 'chat-interface',
      title: 'Chat Interface',
      icon: '💬',
      content: {
        overview: 'The Chat interface is your primary interaction point with Kontext\'s AI assistant. Use it to generate code, ask questions, update files, and get help with your projects.',
        features: [
          'Natural language code generation and updates',
          'Streaming responses for real-time feedback',
          'File attachment support (images, documents, code files)',
          'Context-aware responses based on your project',
          'Stop generation at any time',
          'Smart scrolling that respects your navigation',
          'Multi-file code updates with automatic file detection'
        ],
        howToUse: [
          'Type your question or request in the chat input',
          'Attach files (images, PDFs, Word docs, code files) for context',
          'Watch the AI generate code in real-time',
          'Click the stop button (⏹) to cancel generation if needed',
          'Scroll up to review previous messages while AI is responding',
          'Use specific commands like "update the login component" or "add a new API endpoint"'
        ],
        tips: [
          'Be specific in your requests for better results',
          'Use the Context tab to provide project guidelines and rules',
          'Attach screenshots or design files for UI-related requests',
          'The AI understands your project structure and can update multiple files at once'
        ]
      }
    },
    {
      id: 'context-management',
      title: 'Context Management',
      icon: '🧠',
      content: {
        overview: 'The Context Management system is the foundation of intelligent AI assistance in Kontext. It allows you to teach the AI about your project\'s architecture, coding standards, design system, APIs, and documentation. The AI automatically uses this context to generate code that matches your project\'s style, follows your conventions, and integrates seamlessly with your existing codebase. Think of it as creating a "memory" for the AI about your project that persists across all conversations and code generation requests.',
        features: [
          {
            title: 'Reference Items - External Resources & Documentation',
            description: 'Store URLs, files, and text snippets that the AI can reference when generating code or answering questions.',
            details: `**What Reference Items Are For:**
Reference items are your project's external knowledge base. They allow the AI to access documentation, example code, specifications, and any text-based information that should inform code generation.

**How to Use Reference Items:**

1. **Adding URLs:**
   - Select "Website" as the reference type
   - Paste the URL (e.g., https://react.dev/docs/hooks)
   - Give it a descriptive title (e.g., "React Hooks Documentation")
   - The AI will reference this URL when generating React code

2. **Uploading Files:**
   - Click "Upload File" or drag and drop
   - Supported formats: PDF, Word (.docx), Excel (.xlsx, .xls), PowerPoint (.pptx), text files, code files, JSON, YAML, XML
   - The system automatically extracts all text from the file
   - For PDFs: All pages are extracted
   - For Word docs: Text, headings, and structure are preserved
   - For Excel: Cell values are extracted as text
   - For PowerPoint: Slide text is extracted
   - The extracted text is stored and included in AI context

3. **Pasting Text Directly:**
   - Select "File" as the reference type
   - Paste your text into the content field
   - Useful for code snippets, specifications, or notes
   - No file upload needed for quick additions

**When the AI Uses References:**
- The AI automatically includes relevant references when:
  - You ask questions about a technology mentioned in a reference
  - You request code that should follow patterns from examples
  - You need integration with APIs documented in references
  - The reference content is semantically related to your request

**Best Practices:**
- Add API documentation URLs early in your project
- Upload design specifications and requirements documents
- Include example code from libraries you're using
- Keep references organized with clear, descriptive titles
- Update references when documentation changes

**Example Use Cases:**
- Add Stripe API docs URL → AI generates correct Stripe integration code
- Upload a design spec PDF → AI understands your UI requirements
- Add a code example file → AI follows the same patterns
- Paste API endpoint documentation → AI generates correct request/response handling`
          },
          {
            title: 'Coding Rules - Project Standards & Conventions',
            description: 'Define project-specific coding standards, patterns, architectural decisions, and best practices.',
            details: `**What Coding Rules Are For:**
Coding rules ensure every line of AI-generated code matches your project's style, architecture, and conventions. They're like a style guide that the AI follows religiously.

**How to Create Effective Coding Rules:**

1. **Naming Conventions:**
   - Example: "Use camelCase for variables and functions, PascalCase for components"
   - Example: "Prefix custom hooks with 'use' (e.g., useAuth, useData)"
   - Example: "Use descriptive names: getUserById not getUsr"

2. **File Structure:**
   - Example: "Components go in /src/components, hooks in /src/hooks"
   - Example: "Each component has its own folder with index.tsx and styles.css"
   - Example: "Utils go in /src/utils, types in /src/types"

3. **Component Organization:**
   - Example: "Use functional components with hooks, not class components"
   - Example: "Extract complex logic into custom hooks"
   - Example: "Keep components under 200 lines, split if larger"

4. **State Management:**
   - Example: "Use Zustand for global state, useState for local state"
   - Example: "Store structure: { data, loading, error } pattern"
   - Example: "Never mutate state directly, always use immutable updates"

5. **Error Handling:**
   - Example: "Always wrap async operations in try-catch"
   - Example: "Use error boundaries for React components"
   - Example: "Log errors to console.error with context"

6. **Testing Requirements:**
   - Example: "Write unit tests for all utility functions"
   - Example: "Test components with React Testing Library"
   - Example: "Aim for 80% code coverage minimum"

**Rule Categories:**
- **Architecture**: Overall system design decisions
- **Styling**: CSS conventions, class naming, styling approach
- **Patterns**: Design patterns to follow (e.g., Repository, Factory)
- **Naming**: Variable, function, and file naming rules
- **Testing**: Testing requirements and conventions
- **Performance**: Optimization guidelines
- **Security**: Security best practices
- **Accessibility**: A11y requirements
- **General**: Other project-specific rules

**Priority Levels:**
- **Critical**: Must always be followed (e.g., security rules)
- **High**: Very important for consistency
- **Medium**: Recommended but flexible
- **Low**: Nice to have, optional

**How the AI Uses Rules:**
- Rules are ALWAYS included in code generation requests
- The AI checks generated code against your rules
- Rules override default AI suggestions
- Multiple rules work together to create comprehensive guidelines

**Example Rule:**
Title: "React Component Structure"
Category: Architecture
Priority: High
Description: "All React components must follow this structure"
Rule Text: "1. Import statements at top
2. TypeScript interfaces/types
3. Component function
4. Custom hooks
5. Event handlers
6. Render logic
7. Export default"

**Pro Tips:**
- Start with critical rules (naming, architecture)
- Add rules as you discover patterns in your codebase
- Review and update rules as your project evolves
- Use examples in rule descriptions for clarity
- Tag rules for easy filtering (e.g., "react", "typescript", "api")`
          },
          {
            title: 'Styling Context - Design System & Visual Identity',
            description: 'Manage color palettes, design inspirations, typography, and CSS snippets for consistent styling.',
            details: `**What Styling Context Is For:**
The Styling tab teaches the AI your visual design language. Every UI component the AI generates will use your colors, typography, and design patterns.

**1. Color Palettes - Import from Coolors.co:**
   - Go to coolors.co and create or find a palette
   - Copy the palette URL (e.g., https://coolors.co/palette/264653-2a9d8f-e9c46a-f4a261-e76f51)
   - Paste it into the "Import from Coolors.co" field
   - Click "Import Palette"
   - The AI will automatically use these colors when generating UI components
   - Colors are assigned roles: primary, secondary, accent, background, text, success, warning, error
   - You can manually adjust color roles after import

**2. Extract Design from Websites:**
   - Enter any website URL (e.g., https://example.com)
   - Click "Extract Design"
   - The system analyzes the website and extracts:
     * Color palette (dominant colors used)
     * Typography (font families, sizes, weights)
     * Layout patterns (grid systems, spacing)
     * Component styles (buttons, cards, etc.)
   - The extracted design is saved as a "Design Inspiration"
   - The AI uses this when you ask for similar styling

**3. Manual Design Inspirations:**
   - Add design inspirations with notes
   - Example: "Modern minimalist, lots of white space, subtle shadows"
   - Include URLs to reference sites
   - Add notes about design direction
   - The AI reads these notes when generating UI

**4. Color Palette Management:**
   - View all imported palettes
   - Edit color roles (primary, secondary, etc.)
   - Delete unused palettes
   - Palettes are limited to 30 to prevent localStorage overflow
   - Only top 7 colors from extractions are stored

**How the AI Uses Styling Context:**
- When generating UI components, the AI:
  * Uses your color palettes for buttons, backgrounds, text
  * Applies your typography settings
  * Follows design patterns from inspirations
  * Matches spacing and layout from extracted designs
  * Creates components that fit your visual identity

**Best Practices:**
- Import your brand colors early
- Extract design from sites you admire
- Keep design inspirations updated
- Use consistent color roles across palettes
- Add notes explaining design decisions

**Example Workflow:**
1. Extract design from your favorite website
2. Import your brand colors from Coolors
3. Add notes: "Use rounded corners, subtle gradients, modern shadows"
4. Ask AI: "Create a login form" → AI uses your colors and design style`
          },
          {
            title: 'Documentation - API Docs, Guides & Specifications',
            description: 'Store API documentation, guides, tutorials, specifications, and technical documentation.',
            details: `**What Documentation Context Is For:**
The Documentation tab stores comprehensive technical documentation that the AI references when answering questions, generating code, and understanding your system architecture.

**Types of Documentation to Add:**

1. **API Documentation:**
   - Endpoint descriptions
   - Request/response formats
   - Authentication methods
   - Error codes and messages
   - Rate limiting information
   - Example: "POST /api/users - Creates a new user, requires Bearer token, returns user object with id, email, name"

2. **Technical Specifications:**
   - System architecture descriptions
   - Database schemas
   - Data flow diagrams (as text)
   - Integration requirements
   - Performance requirements

3. **User Guides & Tutorials:**
   - How-to guides for features
   - Step-by-step instructions
   - Best practices
   - Common use cases

4. **Architecture Documentation:**
   - System design decisions
   - Component relationships
   - Data flow descriptions
   - Technology choices and rationale

**How to Add Documentation:**

1. **Upload Files:**
   - Upload PDF, Word, or text files
   - System extracts all text automatically
   - Perfect for existing documentation

2. **Add Links:**
   - Paste URLs to documentation sites
   - AI can reference these when needed

3. **Paste Text:**
   - Copy documentation text directly
   - Useful for quick additions
   - No file needed

**Documentation Categories:**
- **Snippet**: Short documentation pieces
- **Link**: URLs to external docs
- **Guide**: Step-by-step tutorials

**How the AI Uses Documentation:**
- When you ask about APIs → AI references your API docs
- When generating integration code → AI follows documented patterns
- When explaining features → AI uses your guides
- When designing architecture → AI considers your specifications

**Best Practices:**
- Add API documentation before building integrations
- Keep documentation up-to-date
- Use clear, descriptive titles
- Organize by category (API, Architecture, Guides)
- Upload existing docs rather than recreating

**Example:**
Title: "Stripe Payment API"
Type: Snippet
Content: "Use Stripe API v3. All payments require:
- Customer ID from Stripe
- Payment method ID
- Amount in cents
- Currency code (USD, EUR, etc.)
Error handling: Check for card_declined, insufficient_funds
Webhook events: payment_intent.succeeded, payment_intent.failed"`

          },
          {
            title: 'GitHub Guidelines - Repository Rules & Team Standards',
            description: 'Define repository rules, coding conventions, contribution guidelines, and project patterns.',
            details: `**What GitHub Guidelines Are For:**
GitHub Guidelines ensure the AI generates code that follows your team's conventions, repository structure, and collaboration standards. This is especially important for team projects.

**What to Document:**

1. **Repository Structure:**
   - Folder organization
   - File naming conventions
   - Where different types of files go
   - Example: "All components in /src/components, organized by feature"

2. **Branch Naming:**
   - Branch naming patterns
   - Example: "feature/user-authentication", "fix/login-bug"
   - Prefix conventions (feature/, fix/, hotfix/)

3. **Commit Messages:**
   - Commit message format
   - Example: "feat: add user authentication"
   - Conventional commits format
   - What information to include

4. **Pull Request Requirements:**
   - PR description format
   - Required checks
   - Review process
   - Testing requirements

5. **Code Review Guidelines:**
   - What reviewers should check
   - Common issues to watch for
   - Approval criteria

6. **Coding Conventions:**
   - Team-specific patterns
   - Preferred libraries
   - Code organization preferences

**Guideline Categories:**
- **Conventions**: Coding and naming conventions
- **Architecture**: System design patterns
- **Patterns**: Design patterns to use
- **Workflow**: Git workflow and processes
- **General**: Other team standards

**How the AI Uses Guidelines:**
- When creating new features → AI follows your structure
- When generating code → AI uses your conventions
- When refactoring → AI maintains your patterns
- When explaining changes → AI uses your commit format

**Best Practices:**
- Document your actual practices, not ideals
- Include examples in guidelines
- Update as team standards evolve
- Make guidelines specific and actionable
- Cover both code and process

**Example:**
Title: "Branch Naming Convention"
Category: Workflow
Content: "All branches must follow this pattern:
- feature/[ticket-number]-[short-description]
- fix/[ticket-number]-[short-description]
- hotfix/[issue-description]
Examples:
- feature/123-add-user-dashboard
- fix/456-login-error
- hotfix/payment-gateway-timeout"`

          },
          {
            title: 'Code Templates - Reusable Patterns & Boilerplate',
            description: 'Store reusable code snippets, boilerplate, component templates, and common patterns.',
            details: `**What Code Templates Are For:**
Code Templates are your project's code library. They provide starting points and patterns that the AI uses to generate consistent, reusable code.

**Types of Templates:**

1. **Component Templates:**
   - React component structure
   - Vue component patterns
   - Angular component boilerplate
   - Example: Standard component with props, state, effects

2. **Hook Templates:**
   - Custom React hooks
   - Data fetching hooks
   - State management hooks
   - Example: useApi hook with loading, error, data states

3. **API Endpoint Templates:**
   - Backend endpoint structure
   - Request/response handling
   - Error handling patterns
   - Example: Express route with validation and error handling

4. **Utility Functions:**
   - Common utility patterns
   - Helper functions
   - Data transformation functions

5. **Configuration Templates:**
   - Config file structures
   - Environment setup
   - Build configurations

**Template Categories:**
- **Component**: UI component templates
- **Hook**: React/Vue hooks
- **Utility**: Helper functions
- **Config**: Configuration files
- **Function**: Standalone functions
- **Class**: Class-based patterns
- **Other**: Miscellaneous templates

**How to Create Templates:**

1. **Write the Template Code:**
   - Include the full code structure
   - Use placeholders like {{componentName}}
   - Add comments explaining customization points
   - Include imports and dependencies

2. **Add Metadata:**
   - Name: Descriptive template name
   - Description: What this template is for
   - Language: TypeScript, JavaScript, Python, etc.
   - Category: Component, Hook, Utility, etc.
   - Tags: For easy searching (e.g., "react", "api", "auth")

3. **Example Template:**
   Name: "React Component with Props"
   Language: TypeScript
   Category: Component
   Code:
   \`\`\`typescript
   interface {{ComponentName}}Props {
     // Add props here
   }
   
   export const {{ComponentName}}: React.FC<{{ComponentName}}Props> = ({ 
     // Destructure props
   }) => {
     // Component logic
     return (
       <div>
         {/* Component JSX */}
       </div>
     );
   };
   \`\`\`

**How the AI Uses Templates:**
- When you ask for a component → AI uses your component template
- When generating similar code → AI follows template structure
- When creating patterns → AI references relevant templates
- Templates ensure consistency across your codebase

**Best Practices:**
- Create templates for frequently used patterns
- Include comments explaining customization
- Use descriptive names and tags
- Keep templates up-to-date with your codebase
- Organize by category for easy finding

**Example Use Case:**
1. Create "API Route Template" with error handling
2. Ask AI: "Create a user registration endpoint"
3. AI generates code using your template structure
4. Result: Consistent API routes across your project`

          },
          {
            title: 'API Endpoints - Structured API Documentation',
            description: 'Document API schemas, request/response formats, authentication methods, and endpoint examples.',
            details: `**What API Endpoints Documentation Is For:**
The API Endpoints tab provides structured documentation of your APIs. The AI uses this to generate correct API calls, handle responses properly, and integrate frontend with backend seamlessly.

**What to Document for Each Endpoint:**

1. **Basic Information:**
   - Name: Descriptive endpoint name (e.g., "Create User")
   - Method: GET, POST, PUT, DELETE, PATCH
   - Path: API path (e.g., "/api/users")

2. **Request Schema:**
   - URL parameters (e.g., /api/users/:id)
   - Query parameters (e.g., ?page=1&limit=10)
   - Request body structure (JSON schema)
   - Required vs optional fields
   - Data types and validation rules

3. **Response Schema:**
   - Success response format
   - Status codes (200, 201, 400, 404, 500, etc.)
   - Response body structure
   - Error response format

4. **Authentication:**
   - Required: Yes/No
   - Type: Bearer token, API key, OAuth, etc.
   - Header format: "Authorization: Bearer {token}"

5. **Example Request:**
   - Complete request example
   - Headers included
   - Body example (if applicable)
   - cURL or fetch example

6. **Example Response:**
   - Success response example
   - Error response examples
   - Different status code scenarios

**How to Add an API Endpoint:**

1. Click "Add API Endpoint"
2. Fill in the form:
   - Name: "Get User by ID"
   - Method: GET
   - Path: "/api/users/:id"
   - Description: "Retrieves user information by ID"
3. Add Request Schema (JSON):
   \`\`\`json
   {
     "params": {
       "id": "string (required)"
     }
   }
   \`\`\`
4. Add Response Schema:
   \`\`\`json
   {
     "status": 200,
     "data": {
       "id": "string",
       "email": "string",
       "name": "string"
     }
   }
   \`\`\`
5. Add Example Request:
   \`\`\`javascript
   fetch('/api/users/123', {
     headers: {
       'Authorization': 'Bearer token123'
     }
   })
   \`\`\`
6. Add Example Response:
   \`\`\`json
   {
     "id": "123",
     "email": "user@example.com",
     "name": "John Doe"
   }
   \`\`\`

**How the AI Uses API Endpoints:**
- When generating API calls → AI uses your endpoint structure
- When handling responses → AI knows the response format
- When error handling → AI knows error codes and messages
- When frontend-backend integration → AI ensures correct request/response handling

**Best Practices:**
- Document all endpoints your project uses
- Include complete examples
- Update when APIs change
- Document error scenarios
- Include authentication requirements
- Add rate limiting information if applicable

**Example Complete Endpoint:**
Name: "Create User"
Method: POST
Path: "/api/users"
Description: "Creates a new user account"
Request Schema: { "email": "string (required)", "password": "string (required, min 8 chars)", "name": "string (optional)" }
Response Schema: { "status": 201, "data": { "id": "string", "email": "string" } }
Auth: Bearer token required
Example Request: fetch('/api/users', { method: 'POST', body: JSON.stringify({email, password, name}) })
Example Response: { "id": "123", "email": "user@example.com" }`

          },
          {
            title: 'File Upload Support',
            description: 'Upload various document types (PDF, Word, Excel, PowerPoint, text, code files) for automatic text extraction.',
            details: 'All context tabs support file uploads. The system automatically extracts text from: PDF documents, Word documents (.docx), Excel spreadsheets (.xlsx, .xls), PowerPoint presentations (.pptx), text files, code files (any programming language), and configuration files (JSON, YAML, XML, etc.). The extracted text is stored with the context item and is included when the AI processes requests. This makes it easy to add existing documentation, specifications, or code examples to your context without manual copying.'
          },
          {
            title: 'Agent Integration - Connecting AI Agents to Your Applications',
            description: 'Integrate standalone AI agents with your applications. Define how agents interact with your app, what capabilities they have, and how they enhance your application functionality.',
            details: `**What Agent Integration Means:**
Agent integration is the process of connecting standalone AI agents to your applications, enabling them to interact with your app's data, APIs, and functionality. Unlike the main AI assistant (which helps you build), integrated agents become part of your application, providing AI-powered features to your end users.

**Understanding the Difference:**
- **Main AI Assistant**: Helps YOU (the developer) build and code
- **Integrated Agents**: Help YOUR USERS by providing AI features within your app
- **Standalone Agents**: Operate independently, can be triggered by events, schedules, or user actions
- **Agent-Enhanced Apps**: Your app uses agents to provide intelligent features

**Types of Agent Integration:**

1. **Direct Integration (Agent as Service):**
   - Your app calls agent APIs directly
   - Agents process requests and return results
   - Example: User asks question → App calls agent → Agent responds → App displays answer
   - Agents act as intelligent backend services

2. **Event-Driven Integration:**
   - Agents respond to app events automatically
   - Triggers: user actions, data changes, scheduled tasks
   - Example: New user signs up → Agent sends welcome email → Agent creates user profile
   - Agents work in background without user interaction

3. **Workflow Integration:**
   - Multiple agents work together in workflows
   - Agents coordinate to accomplish complex tasks
   - Example: User submits form → Agent1 validates → Agent2 processes → Agent3 notifies
   - Agents form a pipeline of intelligence

4. **UI Integration:**
   - Agents provide chat interfaces within your app
   - Users interact with agents directly
   - Example: Customer support chat powered by agent
   - Agents become part of your user experience

**How to Integrate Agents with Your App:**

**Step 1: Define Agent Purpose**
Before integrating, clearly define:
- What problem does the agent solve?
- What capabilities does it need?
- How will users interact with it?
- What data/APIs does it need access to?

Example purposes:
- Customer support agent: Answers user questions, handles tickets
- Data analysis agent: Analyzes user data, generates reports
- Content moderation agent: Reviews user content, flags issues
- Personalization agent: Customizes user experience

**Step 2: Configure Agent in Context Tab**
1. Go to Context tab → Agents sub-tab
2. Click "Add Agent" or "Integrate Existing Agent"
3. Configure integration settings:
   - **Integration Level**: 
     * Minimal: Basic API access
     * Moderate: API + database access
     * Deep: Full app integration with custom endpoints
     * Autonomous: Agent can make decisions and take actions
   
   - **Capabilities**: What the agent can do
     * Read data from your app
     * Write data to your app
     * Call your APIs
     * Access user information
     * Send notifications
     * Process files
     * Execute workflows

   - **Access Permissions**: What the agent can access
     * User data (with privacy controls)
     * Application data
     * API endpoints
     * Database queries
     * File storage

**Step 3: Define Agent-App Communication**
Document how your app and agent communicate:

1. **API Endpoints for Agent:**
   - Create endpoints your agent can call
   - Document request/response formats
   - Set up authentication
   - Example: POST /api/agent/process-user-query

2. **Webhooks from App to Agent:**
   - Configure webhooks that trigger agents
   - Define event types (user.created, order.placed, etc.)
   - Set up webhook security
   - Example: When user signs up → webhook → agent processes

3. **Data Access Patterns:**
   - How agent reads your app's data
   - Database access (read-only or read-write)
   - API access patterns
   - Caching strategies

**Step 4: Configure Agent Behavior**
In the Agents tab, configure:

1. **System Prompt for Integration:**
   - Define agent's role in your app
   - Specify what it knows about your app
   - Set behavior boundaries
   - Example: "You are a customer support agent for [App Name]. You help users with [specific tasks]. You have access to user accounts, order history, and support tickets. Always be helpful and professional."

2. **MCP Servers for App Integration:**
   - Configure MCP servers that connect to your app
   - Database MCP: Query your app's database
   - API MCP: Call your app's APIs
   - Custom MCP: Your app-specific integrations

3. **Agent Triggers:**
   - Scheduled: Agent runs at specific times
   - Event-based: Agent responds to app events
   - Webhook: Agent receives HTTP requests
   - Conditional: Agent runs when conditions are met

**Step 5: Implement Integration Code**
In your application code:

1. **Frontend Integration:**
   \`\`\`typescript
   // Call agent API from your React component
   const handleUserQuery = async (query: string) => {
     const response = await fetch('/api/agent/chat', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ 
         message: query,
         userId: currentUser.id,
         context: { /* app context */ }
       })
     });
     const agentResponse = await response.json();
     // Display agent response to user
   };
   \`\`\`

2. **Backend Integration:**
   \`\`\`typescript
   // Backend endpoint that uses agent
   app.post('/api/agent/process', async (req, res) => {
     const { action, data } = req.body;
     
     // Call agent to process
     const agentResult = await agentService.process({
       action,
       data,
       userContext: req.user
     });
     
     // Use agent result in your app logic
     await updateAppData(agentResult);
     
     res.json(agentResult);
   });
   \`\`\`

3. **Event-Driven Integration:**
   \`\`\`typescript
   // Trigger agent on app events
   eventEmitter.on('user.created', async (user) => {
     await agentService.trigger('welcome-new-user', {
       userId: user.id,
       userEmail: user.email
     });
   });
   \`\`\`

**Step 6: Test Agent Integration**
1. Test agent responses in isolation
2. Test agent-app communication
3. Test error handling
4. Test with real user data (safely)
5. Monitor agent performance

**Integration Patterns:**

**Pattern 1: Agent as Chat Interface**
- User types message in your app
- App sends to agent API
- Agent processes with app context
- Agent responds
- App displays response
- Use case: Customer support, FAQ bot, virtual assistant

**Pattern 2: Agent as Background Processor**
- App event occurs (e.g., new order)
- Webhook triggers agent
- Agent processes in background
- Agent updates app data or sends notifications
- Use case: Order processing, data analysis, content moderation

**Pattern 3: Agent as Decision Engine**
- App needs intelligent decision
- App calls agent with context
- Agent analyzes and decides
- Agent returns decision/action
- App executes based on agent decision
- Use case: Recommendations, personalization, fraud detection

**Pattern 4: Agent as Workflow Orchestrator**
- User action triggers workflow
- Multiple agents coordinate
- Each agent handles part of workflow
- Agents pass data between each other
- Final result returned to app
- Use case: Complex multi-step processes, data pipelines

**Best Practices for Agent Integration:**

1. **Start Simple:**
   - Begin with read-only agent (no data modification)
   - Test thoroughly before allowing writes
   - Gradually increase agent capabilities

2. **Define Clear Boundaries:**
   - What agent CAN do
   - What agent CANNOT do
   - Data access limits
   - Action restrictions

3. **Implement Security:**
   - Authenticate agent requests
   - Validate agent inputs
   - Sanitize agent outputs
   - Rate limit agent calls
   - Monitor for abuse

4. **Handle Errors Gracefully:**
   - Agent failures shouldn't break your app
   - Implement fallbacks
   - Log errors for debugging
   - Notify users appropriately

5. **Monitor Performance:**
   - Track agent response times
   - Monitor agent accuracy
   - Track user satisfaction
   - Optimize based on metrics

6. **Provide Context:**
   - Give agents relevant app context
   - Include user information (privacy-respecting)
   - Share relevant data
   - Update context as app state changes

7. **Test Thoroughly:**
   - Test with various inputs
   - Test error scenarios
   - Test edge cases
   - Test with real users (beta)

**Example Integration Scenarios:**

**Scenario 1: E-Commerce Support Agent**
- User asks: "Where is my order?"
- App sends: User ID, order history to agent
- Agent queries: Order database via MCP
- Agent responds: "Your order #1234 is scheduled for delivery tomorrow"
- App displays: Agent response to user

**Scenario 2: Content Moderation Agent**
- User submits: New post content
- App triggers: Content moderation agent
- Agent analyzes: Content for policy violations
- Agent decides: Approve, flag, or reject
- App acts: Based on agent decision

**Scenario 3: Personalization Agent**
- User browses: Product catalog
- App calls: Personalization agent with user history
- Agent analyzes: User preferences and behavior
- Agent recommends: Personalized product list
- App displays: Recommendations to user

**Common Integration Challenges & Solutions:**

1. **Challenge: Agent doesn't understand app context**
   - Solution: Provide comprehensive context in system prompt
   - Solution: Use MCP servers to give agent app data access
   - Solution: Include app documentation in agent context

2. **Challenge: Agent responses are slow**
   - Solution: Cache common responses
   - Solution: Use streaming for long responses
   - Solution: Optimize agent prompts for speed

3. **Challenge: Agent makes incorrect decisions**
   - Solution: Implement approval workflows for critical actions
   - Solution: Add confidence scores to agent decisions
   - Solution: Provide human override mechanisms

4. **Challenge: Agent costs are high**
   - Solution: Cache agent responses
   - Solution: Batch agent requests
   - Solution: Use simpler models for simple tasks

**Advanced Integration Features:**

1. **Multi-Agent Workflows:**
   - Chain multiple agents together
   - Each agent handles specific task
   - Agents pass data between each other
   - Complex processes become manageable

2. **Agent Learning:**
   - Agents learn from user interactions
   - Improve responses over time
   - Adapt to your app's patterns
   - Become more useful with usage

3. **Custom MCP Servers:**
   - Build MCP servers specific to your app
   - Expose app functionality to agents
   - Enable deep integration
   - Customize agent capabilities

**Monitoring Agent Integration:**
- Track agent usage metrics
- Monitor response quality
- Measure user satisfaction
- Identify improvement opportunities
- Optimize based on data

**Security Considerations:**
- Never expose sensitive credentials to agents
- Validate all agent inputs
- Sanitize all agent outputs
- Implement rate limiting
- Monitor for suspicious activity
- Use least-privilege access principles

**Getting Started:**
1. Define your agent's purpose
2. Configure agent in Context tab
3. Set up basic integration (read-only first)
4. Test thoroughly
5. Gradually add capabilities
6. Monitor and optimize

Remember: Agent integration is about enhancing your app with AI capabilities, not replacing your app logic. Agents should complement your application, not control it.`
          }
        ],
        howToUse: [
          {
            step: '1',
            title: 'Navigate to Context Tab',
            description: 'Open your project and click on the "Context" tab in the main navigation.'
          },
          {
            step: '2',
            title: 'Select a Context Type',
            description: 'Choose the appropriate sub-tab based on what you want to add: References, Rules, Styling, Documentation, GitHub, Templates, or API Endpoints.'
          },
          {
            step: '3',
            title: 'Add Context Items',
            description: 'Use the input forms to add items. For References: paste URLs or text, or upload files. For Rules: define your coding standards. For Styling: import Coolors.co palettes or extract from websites. For others: add structured information using the provided forms.'
          },
          {
            step: '4',
            title: 'Import External Resources',
            description: 'Import color palettes from Coolors.co by pasting the palette URL. Extract design information from websites by entering a URL. Upload documentation files for automatic text extraction.'
          },
          {
            step: '5',
            title: 'Organize and Manage',
            description: 'Edit or delete context items as needed. The AI automatically uses all relevant context when generating responses, so keep your context up-to-date.'
          },
          {
            step: '6',
            title: 'Verify AI Usage',
            description: 'The AI automatically includes relevant context in all responses. You don\'t need to explicitly reference context items - the AI selects what\'s relevant based on your request.'
          }
        ],
        tips: [
          {
            tip: 'Start Early',
            description: 'Add your project\'s coding standards and rules early in development. This ensures all generated code follows your conventions from the start.'
          },
          {
            tip: 'Keep It Updated',
            description: 'Update context items as your project evolves. Outdated context can lead to inconsistent code generation.'
          },
          {
            tip: 'Be Specific',
            description: 'The more specific and detailed your context items are, the better the AI can understand and apply them. Include examples when possible.'
          },
          {
            tip: 'Use File Uploads',
            description: 'Instead of copying and pasting large amounts of text, upload documentation files. The system extracts text automatically and handles formatting.'
          },
          {
            tip: 'Organize by Category',
            description: 'Use descriptive names and organize context items logically. This helps you manage large amounts of context effectively.'
          },
          {
            tip: 'Combine Context Types',
            description: 'Use multiple context types together for best results. For example, combine Coding Rules with Code Templates and API Endpoints for comprehensive code generation.'
          }
        ]
      }
    },
    {
      id: 'database-interface',
      title: 'Database Interface',
      icon: '🗄️',
      content: {
        overview: 'The Database interface provides a visual way to interact with your backend canister data. View, query, and manage your application\'s data without writing code.',
        features: [
          'Visual database browser and query builder',
          'Table view with sorting and filtering',
          'Form-based data entry and editing',
          'Schema discovery from canister methods',
          'Mobile-responsive interface',
          'JSON editor for complex data structures',
          'Connection management for multiple canisters'
        ],
        howToUse: [
          'Navigate to the Database tab',
          'Select your backend canister from the connection panel',
          'Browse available tables and methods',
          'Use the query builder to filter and search data',
          'Edit records using the form interface',
          'Use the JSON editor for advanced data manipulation'
        ],
        tips: [
          'The database interface automatically discovers your canister\'s schema',
          'Use filters to find specific records quickly',
          'Mobile interface is optimized for touch interactions'
        ]
      }
    },
    {
      id: 'hosting-management',
      title: 'Hosting & Server Management',
      icon: '🏗️',
      content: {
        overview: 'The Hosting interface is your infrastructure control center. It manages server pairs (frontend and backend canisters) that host your applications on the Internet Computer. Each server pair consists of two canisters: one for your frontend (serving web assets) and one for your backend (running your Motoko code). You can create multiple server pairs, allocate credits (which convert to cycles), assign them to projects, and monitor their resource usage in real-time.',
        features: [
          {
            title: 'Server Pair Creation & Management',
            description: 'Create and manage frontend/backend canister pairs that host your applications.',
            details: `**What Are Server Pairs:**
A server pair consists of two Internet Computer canisters:
- Frontend Canister: Serves your web application (HTML, CSS, JS, assets)
- Backend Canister: Runs your Motoko backend code and handles business logic

**Creating a Server Pair:**
1. Navigate to the Hosting tab
2. Click "Create Server Pair"
3. Enter a descriptive name (e.g., "Production App", "Staging Environment")
4. The system automatically:
   - Creates two new canisters (frontend + backend)
   - Sets up the canister controllers
   - Allocates initial resources
   - Generates canister IDs
5. The server pair appears in your list with:
   - Frontend canister ID
   - Backend canister ID
   - Credit balance (in cycles)
   - Creation date
   - Current project assignment (if any)

**Server Pair Information Displayed:**
- Pair Name: Your custom name
- Frontend Canister ID: The canister serving your frontend
- Backend Canister ID: The canister running your backend
- Credit Balance: Current cycles available (1 credit = 1 billion cycles)
- Status: Running, Stopped, or Unknown
- Assigned Project: Which project is using this pair
- Created Date: When the pair was created

**Managing Server Pairs:**
- View all pairs in a scrollable list
- See real-time credit balances
- Check which project each pair is assigned to
- Rename pairs for better organization
- Delete unused pairs (frees up resources)`
          },
          {
            title: 'Credit Allocation & Top-Up System',
            description: 'Add credits to server pairs to power your applications. Credits convert to cycles on the Internet Computer.',
            details: `**Understanding Credits and Cycles:**
- 1 Credit = 1 Billion Cycles (1,000,000,000 cycles)
- Cycles power all operations on the Internet Computer
- Credits are used for: deployments, canister operations, storage, compute

**How to Top Up Credits:**
1. Select a server pair from the list
2. Click "Add Resources" button
3. Enter the number of credits to add (e.g., 1000 credits)
4. The system calculates:
   - USD equivalent (1 credit = $0.001 USD)
   - ICP tokens needed (based on current ICP price)
   - Expected cycles (credits × 1 billion)
5. Complete payment through Stripe
6. Credits are converted to cycles and added to the canister
7. Transaction is logged in value flow tracker

**Credit Conversion Process:**
- Direct conversion: Credits → Cycles (1:1 billion ratio)
- No intermediate conversions (prevents loss)
- Exact cycle amount: 1000 credits = exactly 1.0T cycles
- System verifies the exact amount was added

**Credit Usage:**
- Deployments consume cycles
- Canister operations consume cycles
- Storage costs cycles
- Compute operations consume cycles
- Monitor balance to avoid running out

**Best Practices:**
- Top up before large deployments
- Keep a buffer (e.g., 20% extra)
- Monitor credit usage patterns
- Set up alerts for low balances
- Top up in batches to save on transaction fees`
          },
          {
            title: 'Server Pair Assignment to Projects',
            description: 'Assign server pairs to specific projects. Each project can have its own pair or share one.',
            details: `**Assigning Server Pairs:**
1. Navigate to Hosting tab
2. Find the server pair you want to assign
3. Click "Assign to Project" (if not assigned)
4. Select the target project from the dropdown
5. Confirm the assignment
6. The pair is now linked to that project

**Project-Server Pair Relationship:**
- One project can use one server pair at a time
- One server pair can be assigned to one project at a time
- You can reassign pairs between projects
- Unassigned pairs are available for new projects

**Moving Server Pairs Between Projects:**
1. Click "Move to Project" on an assigned pair
2. Select the new target project
3. Confirm the move
4. The pair is reassigned
5. Previous project loses access (must assign a new pair)

**When to Create New Pairs:**
- Each project needs its own environment
- Separating production and staging
- Different resource requirements
- Isolating projects for security

**When to Share Pairs:**
- Development/testing projects
- Similar resource needs
- Cost optimization
- Temporary projects`
          },
          {
            title: 'Real-Time Credit Balance Monitoring',
            description: 'Monitor credit balances and usage in real-time. Track how credits are being consumed.',
            details: `**Credit Balance Display:**
- Real-time updates every few seconds
- Shows current balance in credits
- Displays equivalent cycles
- Shows percentage of initial allocation used
- Color-coded warnings (green/yellow/red)

**Monitoring Features:**
- Live balance updates
- Usage trends over time
- Projected depletion date (if usage is consistent)
- Alerts when balance drops below threshold
- Historical usage graphs

**Understanding Credit Consumption:**
- Deployments: ~100-500 credits per deployment
- Canister operations: Varies by operation
- Storage: Based on data size
- Compute: Based on instruction count
- Network: Based on message size

**Credit Balance Warnings:**
- Green: >50% remaining (healthy)
- Yellow: 20-50% remaining (consider topping up)
- Red: <20% remaining (top up soon)
- Critical: <5% remaining (top up immediately)`
          },
          {
            title: 'Transaction History & Tracking',
            description: 'View complete history of credit top-ups, deployments, and resource usage.',
            details: `**Transaction Types Tracked:**
1. Credit Top-Ups:
   - Amount added
   - Payment method
   - Timestamp
   - USD equivalent
   - ICP conversion rate used

2. Server Creation:
   - Server pair name
   - Canister IDs created
   - Initial credit allocation
   - Creation cost

3. Credit Usage:
   - Deployment costs
   - Operation costs
   - Storage costs
   - Timestamp of each transaction

**Viewing Transaction History:**
- Access from Hosting tab
- Filter by transaction type
- Sort by date, amount, type
- Export to CSV for analysis
- Search by server pair name

**Value Flow Tracker:**
- Tracks all credit movements
- Shows credit flow patterns
- Identifies high-usage periods
- Helps predict future needs
- Provides spending insights`
          },
          {
            title: 'Server Pair Naming & Organization',
            description: 'Organize your infrastructure with descriptive names and clear structure.',
            details: `**Naming Best Practices:**
- Use descriptive names: "Production App", "Staging Environment"
- Include environment: "Prod", "Staging", "Dev"
- Include purpose: "API Server", "Web App", "Admin Panel"
- Use consistent naming: "App-Prod", "App-Staging", "App-Dev"

**Organization Strategies:**
- Group by environment (Production, Staging, Development)
- Group by project (Project1-Prod, Project1-Staging)
- Group by purpose (API-Server, Web-Frontend, Database)
- Use prefixes for easy sorting

**Server Pair Limits:**
- No hard limit on number of pairs
- Each pair consumes resources
- Monitor total credit allocation
- Archive unused pairs to save costs`
          }
        ],
        howToUse: [
          {
            step: '1',
            title: 'Navigate to Hosting Tab',
            description: 'Click the "Hosting" tab in your project navigation. You\'ll see a list of all your server pairs with their current status and credit balances.'
          },
          {
            step: '2',
            title: 'View Server Pairs',
            description: 'Each server pair shows: name, frontend canister ID, backend canister ID, current credit balance, assigned project (if any), and creation date. Credit balances update in real-time.'
          },
          {
            step: '3',
            title: 'Create a New Server Pair',
            description: 'Click "Create Server Pair", enter a descriptive name, and confirm. The system creates two canisters (frontend + backend) and sets up the infrastructure. This may take 30-60 seconds.'
          },
          {
            step: '4',
            title: 'Assign Server Pair to Project',
            description: 'Click "Assign to Project" on an unassigned pair, select your project from the dropdown, and confirm. The pair is now linked to that project and will be used for deployments.'
          },
          {
            step: '5',
            title: 'Top Up Credits',
            description: 'Select a server pair, click "Add Resources", enter the number of credits (e.g., 1000), review the USD cost and expected cycles, complete payment via Stripe, and credits are added immediately (1000 credits = exactly 1.0T cycles).'
          },
          {
            step: '6',
            title: 'Monitor Usage',
            description: 'Watch credit balances in real-time. Check transaction history to see top-ups and usage. Use the value flow tracker to understand spending patterns. Top up before balances get too low.'
          },
          {
            step: '7',
            title: 'Move Server Pairs',
            description: 'To reassign a pair to a different project, click "Move to Project", select the new project, and confirm. The previous project will need a new pair assigned.'
          }
        ],
        tips: [
          {
            tip: 'Plan Your Infrastructure',
            description: 'Decide if each project needs its own pair or if projects can share. Production should have dedicated pairs. Development/staging can share pairs to save costs.'
          },
          {
            tip: 'Monitor Credit Balances',
            description: 'Check balances regularly. Set a minimum threshold (e.g., 500 credits) and top up when you reach it. Running out of credits during deployment causes failures.'
          },
          {
            tip: 'Use Descriptive Names',
            description: 'Name server pairs clearly: "Production App", "Staging API", "Dev Test". This makes management easier, especially with multiple pairs.'
          },
          {
            tip: 'Track Transactions',
            description: 'Review transaction history regularly to understand usage patterns. This helps predict future credit needs and optimize spending.'
          },
          {
            tip: 'Top Up Strategically',
            description: 'Top up in larger amounts to reduce transaction frequency. However, don\'t over-allocate - credits are tied to specific server pairs.'
          },
          {
            tip: 'Archive Unused Pairs',
            description: 'If a server pair is no longer needed, consider archiving or deleting it to free up resources. Unassigned pairs still consume some resources.'
          }
        ]
      }
    },
    {
      id: 'deployment',
      title: 'Deployment',
      icon: '🚀',
      content: {
        overview: 'The Deployment interface is your one-click gateway to the decentralized cloud. It handles the entire deployment pipeline: compiling your Motoko backend, bundling your frontend, uploading assets, installing canisters, and making your application live. The system includes intelligent error handling, automatic retry mechanisms, and comprehensive logging to ensure successful deployments even when issues occur.',
        features: [
          {
            title: 'One-Click Full-Stack Deployment',
            description: 'Deploy both frontend and backend with a single click. The system handles everything automatically.',
            details: `**What Happens During Deployment:**
1. **Pre-Deployment Checks:**
   - Verifies server pair is assigned
   - Checks credit balance is sufficient
   - Validates project files exist
   - Confirms canister IDs are available

2. **Backend Compilation:**
   - Compiles Motoko code to WebAssembly (WASM)
   - Resolves dependencies
   - Optimizes bytecode
   - Generates Candid interface files

3. **Frontend Bundling:**
   - Bundles React/Vue/Angular code
   - Optimizes assets (images, CSS, JS)
   - Minifies code for production
   - Creates asset manifest

4. **Asset Upload:**
   - Uploads frontend assets to frontend canister
   - Chunks large files for efficient upload
   - Parallel uploads for speed
   - Verifies upload completion

5. **Canister Installation:**
   - Installs backend WASM to backend canister
   - Sets up canister controllers
   - Configures canister settings
   - Verifies installation

6. **Finalization:**
   - Generates deployment URL
   - Updates deployment history
   - Logs deployment completion
   - Provides access link`
          },
          {
            title: 'Automatic Backend Compilation (Motoko)',
            description: 'Your Motoko backend code is automatically compiled to WebAssembly for deployment.',
            details: `**Motoko Compilation Process:**
1. **Code Analysis:**
   - Parses all .mo files
   - Resolves imports and dependencies
   - Validates syntax and types
   - Checks for compilation errors

2. **Compilation:**
   - Compiles to WebAssembly (WASM)
   - Optimizes bytecode
   - Generates Candid interface
   - Creates metadata files

3. **Error Handling:**
   - Displays compilation errors clearly
   - Shows line numbers and error types
   - Suggests fixes when possible
   - Prevents deployment on errors

**Common Compilation Errors:**
- Type mismatches
- Missing imports
- Syntax errors
- Undefined variables
- Module not found

**Fixes:**
- System suggests corrections
- Shows exact error location
- Provides context for fixing
- Allows retry after fixes`
          },
          {
            title: 'Frontend Bundling & Optimization',
            description: 'Your frontend is automatically bundled, optimized, and prepared for production deployment.',
            details: `**Frontend Bundling Process:**
1. **Dependency Resolution:**
   - Installs npm/yarn dependencies
   - Resolves import paths
   - Handles module aliases
   - Processes environment variables

2. **Code Bundling:**
   - Bundles JavaScript/TypeScript
   - Processes CSS and preprocessors
   - Handles images and assets
   - Creates optimized bundles

3. **Optimization:**
   - Minifies JavaScript
   - Compresses CSS
   - Optimizes images
   - Tree-shakes unused code
   - Code splitting for performance

4. **Asset Processing:**
   - Copies static assets
   - Generates asset hashes
   - Creates asset manifest
   - Prepares for upload

**Bundle Output:**
- Optimized JavaScript bundles
- Minified CSS
- Compressed images
- Asset manifest file
- Source maps (for debugging)`
          },
          {
            title: 'Real-Time Deployment Progress & Logs',
            description: 'Watch your deployment progress in real-time with detailed logs at every step.',
            details: `**Deployment Progress Stages:**
1. **Analyzing** (0-10%):
   - Scanning project files
   - Validating structure
   - Checking dependencies

2. **Compiling Backend** (10-30%):
   - Compiling Motoko code
   - Generating WASM
   - Creating Candid interface

3. **Deploying Backend** (30-50%):
   - Uploading WASM to canister
   - Installing backend
   - Verifying installation

4. **Bundling Frontend** (50-70%):
   - Bundling assets
   - Optimizing code
   - Preparing upload

5. **Deploying Frontend** (70-90%):
   - Uploading assets
   - Installing frontend
   - Configuring routes

6. **Finalizing** (90-100%):
   - Verifying deployment
   - Generating URL
   - Completing setup

**Logs Display:**
- Real-time log streaming
- Color-coded by log level
- Expandable log sections
- Searchable log content
- Export logs to file

**Progress Indicators:**
- Percentage complete
- Current stage name
- Time elapsed
- Estimated time remaining
- Visual progress bar`
          },
          {
            title: 'Error Detection & Intelligent Suggestions',
            description: 'The system detects errors and provides intelligent suggestions for fixing them.',
            details: `**Error Detection:**
- Compilation errors (Motoko)
- Bundling errors (Frontend)
- Upload failures
- Canister installation errors
- Network errors
- Credit insufficient errors

**Error Classification:**
- **Compilation Errors**: Motoko code issues
- **Bundling Errors**: Frontend build issues
- **Deployment Errors**: Canister/upload issues
- **Network Errors**: Connection problems
- **Resource Errors**: Credit/cycle issues

**Intelligent Suggestions:**
- Specific error messages
- Line numbers and file locations
- Suggested fixes
- Common solutions
- Links to documentation

**Error Handling Flow:**
1. Error detected
2. Error classified
3. User-friendly message shown
4. Suggestions provided
5. Option to retry or fix
6. Auto-retry may trigger (see below)`
          },
          {
            title: 'Automatic Retry System - Deep Dive',
            description: 'When deployments fail, the system automatically retries with intelligent error analysis and fixes.',
            details: `**How Auto-Retry Works:**

**1. Error Detection & Classification:**
When a deployment fails, the system:
- Captures the error message
- Classifies error type (compilation, bundling, deployment, network)
- Analyzes error context
- Determines if retry is appropriate

**2. Auto-Retry Coordinator:**
The AutoRetryCoordinator service manages retry workflows:
- Creates a workflow for the failed deployment
- Tracks retry attempts (max 3 attempts by default)
- Manages retry phases (message injection, AI processing, file application, deployment)
- Coordinates between different system components

**3. Retry Phases:**
Each retry goes through phases:
- **Message Injection**: Injects error context into chat
- **AI Processing**: AI analyzes error and suggests fix
- **File Application**: Applies AI-suggested fixes to files
- **Deployment**: Retries deployment with fixed code

**4. Intelligent Error Analysis:**
The AI analyzes errors and:
- Identifies root cause
- Suggests specific fixes
- Modifies code automatically
- Tests fixes before retry

**5. Retry Execution:**
- Automatically switches to Deploy tab
- Applies fixes to project files
- Retries deployment
- Monitors for success/failure

**6. Sequential Error Handling:**
If the same error occurs multiple times:
- System tracks sequential error count
- May adjust retry strategy
- Provides more detailed analysis
- May suggest manual intervention

**7. Final Attempt:**
On the final retry attempt:
- System provides maximum detail
- Shows all error context
- Suggests manual fixes if needed
- Logs complete error history

**Retry Configuration:**
- Max attempts: 3 (configurable)
- Delay between retries: Automatic (based on error type)
- Error analysis: Automatic
- Code fixes: Automatic (when possible)

**When Auto-Retry Triggers:**
- Compilation errors (if fixable)
- Bundling errors (if fixable)
- Deployment errors (network issues)
- NOT for: insufficient credits, authentication errors

**Monitoring Auto-Retry:**
- Visual indicators show retry status
- Progress shows retry attempt number
- Logs show retry analysis
- Success/failure clearly displayed

**Manual Override:**
- You can stop auto-retry at any time
- Manual fixes take precedence
- System respects user intervention`
          },
          {
            title: 'Deployment History & Caching',
            description: 'View past deployments, track changes, and benefit from intelligent caching.',
            details: `**Deployment History:**
- Complete log of all deployments
- Success/failure status
- Deployment duration
- Timestamp of each deployment
- Server pair used
- Deployment URL (if successful)
- Error messages (if failed)

**History Features:**
- Filter by project
- Sort by date
- Search by keyword
- View detailed logs
- Compare deployments
- Export history

**Deployment Caching:**
- Caches deployment state
- Persists across page refreshes
- Resumes interrupted deployments
- Stores deployment configuration
- Caches server pair information

**Cache Benefits:**
- Faster subsequent deployments
- Resume after browser refresh
- Preserve deployment settings
- Quick access to recent deployments`
          },
          {
            title: 'WASM Download & Export',
            description: 'Download compiled WASM files for manual deployment or backup.',
            details: `**WASM Files:**
- Backend WASM: Compiled Motoko code
- Frontend Assets: Bundled frontend files
- Candid Interface: API interface definition

**Download Options:**
- Download backend WASM
- Download frontend bundle
- Download complete deployment package
- Export deployment configuration

**Use Cases:**
- Manual deployment to other canisters
- Backup of compiled code
- Deployment to different environments
- Sharing with team members
- Version control of compiled artifacts`
          }
        ],
        howToUse: [
          {
            step: '1',
            title: 'Prepare for Deployment',
            description: 'Ensure your project has a server pair assigned (check Hosting tab). Verify you have sufficient credits (at least 500 credits recommended). Review your project files to ensure everything is ready.'
          },
          {
            step: '2',
            title: 'Navigate to Deploy Tab',
            description: 'Click the "Deploy" tab in your project navigation. You\'ll see the deployment interface with your current server pair, project files summary, and deployment button.'
          },
          {
            step: '3',
            title: 'Review Deployment Settings',
            description: 'Check that the correct server pair is selected. Review the project structure summary. Ensure all necessary files are present. The system shows file counts and project structure.'
          },
          {
            step: '4',
            title: 'Start Deployment',
            description: 'Click the "Deploy" button. The deployment process begins automatically. You\'ll see real-time progress, current stage, and detailed logs. The process typically takes 2-5 minutes.'
          },
          {
            step: '5',
            title: 'Monitor Progress',
            description: 'Watch the progress bar and logs. The system shows: current stage (Analyzing, Compiling, Deploying), percentage complete, time elapsed, and detailed logs. Logs are color-coded (info, warning, error).'
          },
          {
            step: '6',
            title: 'Handle Errors (If Any)',
            description: 'If an error occurs, the system will: show a clear error message, classify the error type, provide suggestions, and may automatically retry with fixes. Review the error message and suggestions. You can fix manually or let auto-retry handle it.'
          },
          {
            step: '7',
            title: 'Auto-Retry Process',
            description: 'If auto-retry triggers: the system analyzes the error, the AI suggests fixes, fixes are applied automatically, deployment retries automatically, and you\'ll see retry attempt number in progress. This happens up to 3 times automatically.'
          },
          {
            step: '8',
            title: 'Deployment Success',
            description: 'When deployment succeeds: you\'ll see a success message, get a deployment URL, the URL is added to deployment history, and you can access your live application immediately. Copy the URL or click to open.'
          },
          {
            step: '9',
            title: 'View Deployment History',
            description: 'Access deployment history to see: all past deployments, success/failure status, deployment times, URLs, and logs. Use this to track changes and debug issues.'
          }
        ],
        tips: [
          {
            tip: 'Ensure Sufficient Credits',
            description: 'Always check credit balance before deploying. A typical deployment uses 100-500 credits. Keep at least 500 credits as a buffer. Running out of credits mid-deployment causes failure.'
          },
          {
            tip: 'Monitor Auto-Retry',
            description: 'Watch the auto-retry process. It will show which attempt it\'s on (1/3, 2/3, 3/3). If all retries fail, review the error messages carefully - they contain specific guidance for manual fixes.'
          },
          {
            tip: 'Review Logs Carefully',
            description: 'Deployment logs contain valuable information. Even successful deployments show useful details. Failed deployments show exact error locations and suggestions. Export logs for detailed analysis.'
          },
          {
            tip: 'Use Deployment History',
            description: 'Compare successful vs failed deployments. Look for patterns in failures. Use history to track changes over time. Export history for team sharing or documentation.'
          },
          {
            tip: 'Let Auto-Retry Work',
            description: 'Don\'t interrupt auto-retry unless necessary. The system is intelligent and can fix many errors automatically. Manual intervention during auto-retry can cause conflicts. Wait for the process to complete.'
          },
          {
            tip: 'Download WASM for Backup',
            description: 'After successful deployments, consider downloading WASM files as backup. These can be used for manual deployment to other canisters or as version control artifacts.'
          },
          {
            tip: 'Check Server Pair Status',
            description: 'Before deploying, verify your server pair is active and has sufficient credits. An inactive or low-credit pair will cause deployment failures.'
          },
          {
            tip: 'Understand Error Types',
            description: 'Learn to recognize error types: compilation errors need code fixes, bundling errors need dependency/config fixes, deployment errors may need retry, network errors are usually temporary.'
          }
        ]
      }
    },
    {
      id: 'live-preview',
      title: 'Live Preview',
      icon: '👁️',
      content: {
        overview: 'Preview your application in real-time as you make changes. See how your app looks and behaves before deploying.',
        features: [
          'Real-time preview of your application',
          'Live updates as you edit code',
          'Full application functionality testing',
          'Mobile and desktop viewport options',
          'Direct access to deployed applications'
        ],
        howToUse: [
          'Navigate to the Live Preview tab',
          'Your application will load in the preview pane',
          'Make changes in the Chat or code editor',
          'Preview updates automatically',
          'Test functionality before final deployment'
        ],
        tips: [
          'Use preview to catch issues before deploying',
          'Test on different viewport sizes',
          'Preview works with both local and deployed applications'
        ]
      }
    },
    {
      id: 'agents',
      title: 'AI Agents',
      icon: '🤖',
      content: {
        overview: 'AI Agents are standalone, autonomous AI assistants that operate independently from your main project. Each agent has its own backend canister, frontend interface, configuration, and can be deployed to its own server pair. Agents can perform tasks, respond to triggers, handle approvals, integrate with MCP (Model Context Protocol) servers, and be orchestrated in workflows and agencies. Think of agents as specialized AI workers that can operate 24/7, handle specific tasks, and coordinate with other agents.',
        features: [
          {
            title: 'Agent Creation & Configuration',
            description: 'Create AI agents with custom configurations, models, and capabilities.',
            details: `**Creating an Agent:**

1. **Via AI Assistant (Recommended):**
   - Go to Chat tab
   - Ask: "Create an agent that handles customer support"
   - AI generates agent configuration
   - Review and confirm

2. **Manual Creation:**
   - Navigate to Agents tab
   - Click "Create Agent"
   - Fill in configuration:
     * Name: Descriptive agent name
     * Description: What the agent does
     * Model: AI model to use (Claude, GPT-4, etc.)
     * Max Tokens: Response length limit
     * Temperature: Creativity level (0-1)
     * System Prompt: Agent's instructions and personality

**Agent Configuration Options:**
- **Name**: Unique identifier
- **Description**: Purpose and capabilities
- **Model**: AI model (affects capabilities and cost)
- **Max Tokens**: Maximum response length
- **Temperature**: 0 (deterministic) to 1 (creative)
- **System Prompt**: Defines agent behavior, personality, constraints
- **MCP Servers**: External tools and integrations
- **Capabilities**: What the agent can do

**System Prompt Best Practices:**
- Define agent's role clearly
- Set behavior boundaries
- Specify response format
- Include examples
- Define error handling
- Set interaction style`
          },
          {
            title: 'Agent Deployment & Server Pairs',
            description: 'Deploy agents to their own server pairs for independent operation.',
            details: `**Deployment Process:**

1. **Select Server Pair:**
   - Choose existing server pair
   - Or create new server pair for agent
   - Each agent needs its own pair

2. **Deploy Agent:**
   - Click "Deploy Agent"
   - System creates:
     * Backend canister for agent logic
     * Frontend canister for agent UI
     * Agent configuration storage
   - Deployment takes 2-5 minutes

3. **Agent Goes Live:**
   - Agent is accessible via URL
   - Can receive tasks and triggers
   - Operates independently
   - Monitored and managed

**Server Pair Requirements:**
- Sufficient credits (500+ recommended)
- Active canisters
- Proper configuration
- Network connectivity

**Agent URLs:**
- Frontend: https://[canister-id].icp0.io
- Backend: Accessible via agent management interface
- Each agent has unique URLs`
          },
          {
            title: 'Agent Management Interface',
            description: 'Comprehensive interface for managing agents, viewing metrics, and monitoring activity.',
            details: `**Agent Management Tabs:**

1. **Overview Tab:**
   - Agent status (active, paused, error)
   - Basic metrics (tasks completed, errors)
   - Quick actions (start, stop, restart)
   - Agent configuration summary

2. **Tasks Tab:**
   - View all agent tasks
   - Task status (pending, running, completed, failed)
   - Task history
   - Execute new tasks
   - Task input and output

3. **Triggers Tab:**
   - Scheduled triggers (cron-like)
   - Condition-based triggers
   - Webhook triggers
   - Trigger configuration
   - Enable/disable triggers

4. **MCP Servers Tab:**
   - Configured MCP servers
   - Server status
   - Available tools
   - Server configuration
   - Test connections

5. **Approvals Tab:**
   - Pending approvals
   - Approval history
   - Approve/reject actions
   - Approval workflows

6. **Activity Tab:**
   - Agent activity log
   - Task executions
   - Trigger firings
   - Error events
   - Performance metrics

7. **Errors Tab:**
   - Error log
   - Error details
   - Stack traces
   - Resolution status
   - Error patterns

8. **Control Tab:**
   - Start/stop agent
   - Restart agent
   - Update configuration
   - Clear cache
   - Reset agent state

9. **Debug Tab:**
   - Debug information
   - State inspection
   - Log analysis
   - Performance profiling
   - Troubleshooting tools`
          },
          {
            title: 'MCP (Model Context Protocol) Server Integration',
            description: 'Extend agent capabilities with MCP servers that provide tools and integrations.',
            details: `**What Are MCP Servers:**
MCP servers provide external tools and integrations that agents can use. They extend agent capabilities beyond basic AI responses.

**MCP Server Types:**
- **Database Servers**: Query databases
- **API Servers**: Call external APIs
- **File Servers**: Read/write files
- **Search Servers**: Web search capabilities
- **Custom Servers**: Your own integrations

**Configuring MCP Servers:**
1. Go to Agent Management → MCP Servers tab
2. Click "Add MCP Server"
3. Enter server details:
   - Server name
   - Server URL
   - Authentication (if needed)
   - Available tools
4. Test connection
5. Enable server

**How Agents Use MCP Servers:**
- Agents automatically use available MCP tools
- Tools appear in agent's capabilities
- Agent decides when to use tools
- Tool results inform agent responses

**Example MCP Servers:**
- Database query server
- Email sending server
- Calendar integration
- Payment processing
- File storage
- Analytics tracking`
          },
          {
            title: 'Agent Tasks & Execution',
            description: 'Execute tasks on agents, monitor execution, and view results.',
            details: `**Executing Tasks:**

1. **Manual Task Execution:**
   - Go to Agent Management → Tasks tab
   - Click "Execute Task"
   - Enter task input
   - Add metadata (optional)
   - Submit task
   - Monitor execution

2. **Task Input:**
   - Natural language instructions
   - Structured data (JSON)
   - File attachments
   - Context information

3. **Task Execution:**
   - Agent receives task
   - Processes using AI model
   - Uses MCP tools if needed
   - Generates response
   - Returns result

4. **Task Results:**
   - Success/failure status
   - Response content
   - Execution time
   - Tools used (if any)
   - Error messages (if failed)

**Task Status:**
- **Pending**: Queued for execution
- **Running**: Currently executing
- **Completed**: Successfully finished
- **Failed**: Error occurred
- **Cancelled**: User cancelled

**Monitoring Tasks:**
- Real-time status updates
- Execution logs
- Progress indicators
- Error details
- Performance metrics`
          },
          {
            title: 'Agent Triggers - Automation',
            description: 'Configure triggers to automate agent tasks based on schedules, conditions, or webhooks.',
            details: `**Trigger Types:**

1. **Scheduled Triggers:**
   - Cron-like scheduling
   - Run at specific times
   - Recurring schedules
   - Example: "Every day at 9 AM"

2. **Condition Triggers:**
   - Based on conditions
   - Monitor data/state
   - Fire when condition met
   - Example: "When new user signs up"

3. **Webhook Triggers:**
   - External webhook calls
   - HTTP POST to agent
   - Custom payloads
   - Example: "Stripe payment webhook"

**Creating Triggers:**

1. **Scheduled Trigger:**
   - Name and description
   - Schedule (cron expression)
   - Input template
   - Retry configuration
   - Execution limits

2. **Condition Trigger:**
   - Condition definition
   - Monitoring frequency
   - Input template
   - Retry configuration

3. **Webhook Trigger:**
   - Webhook URL
   - Source verification
   - Signature validation
   - Input mapping
   - Response format

**Trigger Configuration:**
- **Retry Config**: How many retries, delay between retries
- **Execution Limits**: Max executions, timeout
- **Input Template**: Default input for trigger
- **Enabled/Disabled**: Toggle trigger on/off

**Managing Triggers:**
- Enable/disable triggers
- Edit trigger configuration
- View trigger history
- Test triggers manually
- Delete triggers`
          },
          {
            title: 'Agent Approvals & Human-in-the-Loop',
            description: 'Configure approval workflows for agent actions that require human confirmation.',
            details: `**Approval Workflows:**

1. **When Approvals Are Needed:**
   - Critical actions (payments, deletions)
   - High-risk operations
   - Costly operations
   - Sensitive data access

2. **Approval Process:**
   - Agent requests approval
   - Approval appears in Approvals tab
   - Human reviews request
   - Approve or reject
   - Agent continues or stops

3. **Approval Details:**
   - What action is requested
   - Why approval is needed
   - Context and data
   - Risk assessment
   - Suggested decision

**Managing Approvals:**
- View pending approvals
- Review approval details
- Approve or reject
- Add comments
- View approval history

**Approval Configuration:**
- Define which actions need approval
- Set approval timeout
- Configure approval notifications
- Define approval workflow`
          },
          {
            title: 'Agent Workflows & Agencies',
            description: 'Orchestrate multiple agents in workflows and agencies for complex tasks.',
            details: `**What Are Workflows:**
Workflows coordinate multiple agents to accomplish complex tasks. Agents can work sequentially or in parallel.

**Workflow Types:**
- **Sequential**: Agents run one after another
- **Parallel**: Agents run simultaneously
- **Conditional**: Agents run based on conditions
- **Loop**: Agents repeat until condition met

**Creating Workflows:**
1. Go to Agents tab → Agencies section
2. Click "Create Workflow"
3. Use visual canvas to design workflow
4. Add agent nodes
5. Connect agents with edges
6. Configure execution flow
7. Deploy workflow

**Workflow Components:**
- **Agent Nodes**: Individual agents
- **Edges**: Connections between agents
- **Input Nodes**: Workflow input
- **Output Nodes**: Workflow results
- **Condition Nodes**: Decision points

**Workflow Execution:**
- Workflow receives input
- Executes agents in order
- Passes data between agents
- Collects results
- Returns final output

**Agencies:**
Agencies are advanced workflows with:
- Business intelligence
- Advanced coordination
- Performance metrics
- Dashboard visualization
- Goal tracking`
          },
          {
            title: 'Agent Monitoring & Metrics',
            description: 'Monitor agent performance, track metrics, and analyze agent behavior.',
            details: `**Agent Metrics:**

1. **Performance Metrics:**
   - Tasks completed
   - Average execution time
   - Success rate
   - Error rate
   - Response quality

2. **Usage Metrics:**
   - Total tasks executed
   - Tokens consumed
   - API calls made
   - MCP tool usage
   - Cost tracking

3. **Activity Metrics:**
   - Active triggers
   - Pending approvals
   - Recent activity
   - Error frequency
   - Uptime percentage

**Monitoring Dashboard:**
- Real-time metrics
- Historical trends
- Performance graphs
- Alert notifications
- Health status

**Agent Health:**
- **Healthy**: Operating normally
- **Warning**: Minor issues
- **Error**: Needs attention
- **Offline**: Not responding

**Alerts:**
- High error rate
- Slow response times
- Failed triggers
- Approval timeouts
- Resource limits`
          }
        ],
        howToUse: [
          {
            step: '1',
            title: 'Navigate to Agents Tab',
            description: 'Click the "Agents" tab in your project navigation. You\'ll see a list of your agents, available agents to integrate, and options to create new agents.'
          },
          {
            step: '2',
            title: 'Create an Agent',
            description: 'Click "Create Agent" or use the AI Assistant in Chat ("Create an agent that..."). Fill in agent configuration: name, description, model, system prompt, MCP servers. The system prompt defines the agent\'s behavior and capabilities.'
          },
          {
            step: '3',
            title: 'Configure Agent Settings',
            description: 'Set agent parameters: max tokens (response length), temperature (creativity 0-1), system prompt (instructions), MCP servers (tools), and capabilities. The system prompt is critical - it defines what the agent does and how it behaves.'
          },
          {
            step: '4',
            title: 'Deploy Agent',
            description: 'Select or create a server pair for the agent. Click "Deploy Agent". The system creates backend and frontend canisters, installs agent code, and makes the agent live. This takes 2-5 minutes.'
          },
          {
            step: '5',
            title: 'Access Agent Management',
            description: 'Click on an agent to open its management interface. You\'ll see tabs for Overview, Tasks, Triggers, MCP Servers, Approvals, Activity, Errors, Control, and Debug.'
          },
          {
            step: '6',
            title: 'Execute Tasks',
            description: 'Go to Tasks tab, click "Execute Task", enter your task in natural language (e.g., "Analyze this data and provide insights"), add any metadata, and submit. Monitor execution in real-time and view results when complete.'
          },
          {
            step: '7',
            title: 'Configure Triggers',
            description: 'Go to Triggers tab, click "Create Trigger", choose type (Scheduled, Condition, or Webhook), configure schedule/condition/webhook URL, set input template, configure retry settings, and enable the trigger. The agent will now execute automatically based on your trigger.'
          },
          {
            step: '8',
            title: 'Set Up MCP Servers',
            description: 'Go to MCP Servers tab, click "Add MCP Server", enter server details (name, URL, authentication), test connection, and enable. The agent can now use tools provided by the MCP server.'
          },
          {
            step: '9',
            title: 'Monitor Agent Activity',
            description: 'Use Activity tab to see agent actions, Errors tab for issues, Overview tab for metrics. Monitor performance, track usage, and ensure agent is operating correctly.'
          },
          {
            step: '10',
            title: 'Create Workflows/Agencies',
            description: 'Go to Agencies section, click "Create Workflow", use visual canvas to add agent nodes, connect them with edges, configure execution flow (sequential/parallel), and deploy. Multiple agents can now work together on complex tasks.'
          }
        ],
        tips: [
          {
            tip: 'Write Clear System Prompts',
            description: 'The system prompt is the most important part of agent configuration. Be specific about the agent\'s role, behavior, constraints, and response format. Include examples of good responses.'
          },
          {
            tip: 'Start Simple, Then Expand',
            description: 'Create simple agents first to understand the system. Once comfortable, add MCP servers, triggers, and workflows. Complex agents are built incrementally.'
          },
          {
            tip: 'Use MCP Servers for Capabilities',
            description: 'MCP servers extend agent capabilities significantly. Use them for database access, API calls, file operations, and custom integrations. They make agents much more powerful.'
          },
          {
            tip: 'Monitor Agent Performance',
            description: 'Regularly check agent metrics, error rates, and activity logs. This helps identify issues early and optimize agent behavior. Set up alerts for critical metrics.'
          },
          {
            tip: 'Test Triggers Before Production',
            description: 'Test all triggers (scheduled, condition, webhook) before relying on them. Use the test function to verify triggers fire correctly and produce expected results.'
          },
          {
            tip: 'Use Approvals for Critical Actions',
            description: 'Configure approval workflows for actions that have consequences (payments, deletions, data exports). This adds a safety layer and prevents costly mistakes.'
          },
          {
            tip: 'Organize Agents by Purpose',
            description: 'Name agents clearly based on their purpose (e.g., "Customer Support Agent", "Data Analysis Agent"). This makes management easier, especially with many agents.'
          },
          {
            tip: 'Leverage Workflows for Complex Tasks',
            description: 'Use workflows to coordinate multiple agents. This is powerful for complex tasks that require multiple steps, different expertise, or parallel processing.'
          },
          {
            tip: 'Keep Agent Configurations Updated',
            description: 'As your needs change, update agent configurations, system prompts, and MCP servers. Outdated configurations lead to poor performance.'
          },
          {
            tip: 'Monitor Costs',
            description: 'Agents consume tokens and resources. Monitor usage and costs, especially for frequently triggered agents. Optimize prompts and configurations to reduce costs.'
          }
        ]
      }
    },
    {
      id: 'agencies-workflows',
      title: 'Agencies & Workflows',
      icon: '🔄',
      content: {
        overview: 'Create multi-agent workflows (agencies) that coordinate multiple AI agents to accomplish complex tasks. Visual workflow builder included.',
        features: [
          'Visual workflow canvas for designing workflows',
          'Multi-agent coordination',
          'Agent node configuration',
          'Workflow execution monitoring',
          'Template library for common patterns',
          'Edge configuration for agent communication',
          'Execution graph visualization',
          'Business agency dashboard'
        ],
        howToUse: [
          'Navigate to the Agents tab and select "Agencies"',
          'Click "Create Agency" or use the AI Assistant',
          'Use the visual canvas to design your workflow',
          'Add agent nodes and configure their behavior',
          'Connect agents with edges to define flow',
          'Configure execution modes (parallel, sequential)',
          'Deploy and monitor workflow execution'
        ],
        tips: [
          'Start with simple workflows and gradually add complexity',
          'Use the template library for common patterns',
          'Monitor execution graphs to understand workflow behavior',
          'Business agencies provide advanced coordination features'
        ]
      }
    },
    {
      id: 'domains',
      title: 'Domain Management',
      icon: '🌐',
      content: {
        overview: 'Register and manage custom domains for your deployed applications. Point domains to your canisters for professional URLs.',
        features: [
          'Custom domain registration',
          'Domain-to-canister mapping',
          'DNS configuration management',
          'Domain status monitoring',
          'Multiple domain support per project'
        ],
        howToUse: [
          'Navigate to the Domains tab',
          'Click "Register Domain"',
          'Enter your desired domain name',
          'Complete the registration process',
          'Configure DNS settings',
          'Map domain to your canister',
          'Monitor domain status and health'
        ],
        tips: [
          'Custom domains are available on Developer and Pro plans',
          'DNS propagation can take up to 48 hours',
          'Keep your domain registration active to avoid expiration'
        ]
      }
    },
    {
      id: 'projects',
      title: 'Project Management',
      icon: '📁',
      content: {
        overview: 'Organize your work into projects. Each project contains its own files, configuration, and deployment settings.',
        features: [
          'Create, import, and export projects',
          'Project file management',
          'Project switching and organization',
          'Project export as ZIP archives',
          'Project templates',
          'Project overview and statistics'
        ],
        howToUse: [
          'Create a new project from the project selector',
          'Import existing projects from ZIP files',
          'Switch between projects using the project dropdown',
          'Export projects to share or backup',
          'Manage project files in the sidebar',
          'View project statistics in the overview'
        ],
        tips: [
          'Use descriptive project names for easy organization',
          'Export projects regularly for backup',
          'Each project maintains its own context and settings',
          'Projects can share server pairs or have dedicated ones'
        ]
      }
    },
    {
      id: 'profile-settings',
      title: 'Profile & Settings',
      icon: '👤',
      content: {
        overview: 'Manage your account settings, subscription, credits, and billing information. Configure your workspace preferences.',
        features: [
          'Account information management',
          'Subscription plan management',
          'Credit purchase and top-up',
          'Transaction history',
          'Billing and payment methods',
          'Usage analytics',
          'Server pair management',
          'Stripe customer portal integration'
        ],
        howToUse: [
          'Click your profile icon in the top right',
          'Select "Profile & Settings"',
          'Navigate between tabs (Account, Subscription, Credits, Hosting)',
          'Update account information',
          'Manage subscription in Stripe portal',
          'Purchase credits as needed',
          'View transaction history and analytics'
        ],
        tips: [
          'Keep your subscription active to maintain access',
          'Monitor credit usage to avoid running out',
          'Use the Stripe portal for subscription changes',
          'Transaction history helps track spending patterns'
        ]
      }
    },
    {
      id: 'subscriptions',
      title: 'Subscriptions & Plans',
      icon: '💳',
      content: {
        overview: 'Choose a subscription plan that fits your needs. Plans include different credit allocations and feature access.',
        features: [
          'Three subscription tiers: Starter, Developer, Pro',
          'Monthly credit allocations',
          'Feature-based access control',
          'Stripe integration for secure payments',
          'Plan upgrade and downgrade',
          'Automatic renewal'
        ],
        howToUse: [
          'Select a plan during initial setup or from Profile',
          'Complete payment through Stripe',
          'Credits are allocated monthly',
          'Upgrade or downgrade from Profile settings',
          'Manage subscription in Stripe customer portal',
          'Monitor usage against your plan limits'
        ],
        tips: [
          'Starter: 10K credits/month, perfect for learning',
          'Developer: 50K credits/month + custom domains + agents',
          'Pro: 75K credits/month + all features + VIP support',
          'Credits roll over if unused (check plan details)',
          'Upgrade anytime to access more features'
        ]
      }
    },
    {
      id: 'credits-billing',
      title: 'Credits & Billing',
      icon: '💰',
      content: {
        overview: 'Understand how credits work and manage your billing. Credits power all operations in Kontext.',
        features: [
          'Credit-based usage system',
          'Top-up credits anytime',
          'Transaction tracking',
          'Value flow analytics',
          'Credit conversion tracking',
          'Automatic credit allocation',
          'Stripe payment integration'
        ],
        howToUse: [
          'View credit balance in the top navigation',
          'Click "Add Credits" to purchase more',
          'Select credit amount and complete payment',
          'Credits are added immediately after payment',
          'View transaction history in Profile',
          'Monitor credit usage in value flow tracker'
        ],
        tips: [
          '1 credit = 1 billion cycles on the Internet Computer',
          'Credits are used for deployments, agent operations, and server resources',
          'Top up before large deployments to avoid failures',
          'Transaction history shows all credit movements',
          'Value flow tracker helps understand spending patterns'
        ]
      }
    },
    {
      id: 'file-management',
      title: 'File Management',
      icon: '📄',
      content: {
        overview: 'Manage your project files with the integrated file system. Edit, create, and organize files directly in Kontext.',
        features: [
          'File tree navigation',
          'Monaco code editor integration',
          'File creation and deletion',
          'Multi-file editing',
          'File tabs for quick switching',
          'Syntax highlighting',
          'Code completion and IntelliSense',
          'File search and navigation'
        ],
        howToUse: [
          'Use the sidebar to navigate project files',
          'Click files to open in the editor',
          'Use file tabs to switch between open files',
          'Create new files using the "+" button',
          'Delete files with right-click context menu',
          'Search files using Cmd/Ctrl + P',
          'Edit files directly in the Monaco editor'
        ],
        tips: [
          'The editor supports all major programming languages',
          'Use tabs to keep multiple files open',
          'File changes are saved automatically',
          'Use the search feature to find files quickly',
          'Right-click for file operations'
        ]
      }
    },
    {
      id: 'ai-assistant',
      title: 'AI Assistant Features',
      icon: '✨',
      content: {
        overview: 'Leverage Kontext\'s AI capabilities to accelerate development. The AI understands your project context and can help with various tasks.',
        features: [
          'Natural language code generation',
          'Context-aware suggestions',
          'Multi-file code updates',
          'Code explanation and documentation',
          'Bug detection and fixes',
          'Architecture suggestions',
          'Best practice recommendations',
          'Project-specific pattern recognition'
        ],
        howToUse: [
          'Ask questions in natural language',
          'Request code generation for specific features',
          'Ask for code improvements or refactoring',
          'Request explanations of complex code',
          'Ask for help with debugging',
          'Request architecture advice',
          'Use context from the Context tab for better results'
        ],
        tips: [
          'Be specific in your requests for better results',
          'Provide context about your project goals',
          'Use the Context tab to teach the AI your preferences',
          'The AI learns from your project structure and files',
          'Ask follow-up questions to refine results',
          'Use file attachments to provide visual context'
        ]
      }
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: '🔧',
      content: {
        overview: 'Common issues and solutions to help you resolve problems quickly.',
        features: [
          'Deployment failure resolution',
          'Credit balance issues',
          'Authentication problems',
          'File editing issues',
          'Agent deployment problems',
          'Domain configuration issues'
        ],
        howToUse: [
          'Check deployment logs for error messages',
          'Verify credit balance before operations',
          'Ensure Internet Identity is properly connected',
          'Check browser console for frontend errors',
          'Review transaction history for payment issues',
          'Contact support for persistent problems'
        ],
        tips: [
          'Most deployment failures are due to insufficient credits',
          'Clear browser cache if experiencing UI issues',
          'Check server pair status in Hosting tab',
          'Verify subscription is active for feature access',
          'Review error messages carefully - they often contain solutions',
          'Use the Admin interface (if available) for debugging'
        ]
      }
    }
  ];

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return documentationSections;
    
    const query = searchQuery.toLowerCase();
    return documentationSections.filter(section => {
      const titleMatch = section.title.toLowerCase().includes(query);
      const overviewMatch = section.content.overview.toLowerCase().includes(query);
      
      const featuresMatch = section.content.features.some(f => {
        if (typeof f === 'string') return f.toLowerCase().includes(query);
        return f.title.toLowerCase().includes(query) || 
               f.description.toLowerCase().includes(query) ||
               f.details.toLowerCase().includes(query);
      });
      
      const howToUseMatch = section.content.howToUse.some(h => {
        if (typeof h === 'string') return h.toLowerCase().includes(query);
        return h.title.toLowerCase().includes(query) || 
               h.description.toLowerCase().includes(query);
      });
      
      const tipsMatch = section.content.tips?.some(t => {
        if (typeof t === 'string') return t.toLowerCase().includes(query);
        return t.tip.toLowerCase().includes(query) || 
               t.description.toLowerCase().includes(query);
      }) || false;
      
      return titleMatch || overviewMatch || featuresMatch || howToUseMatch || tipsMatch;
    });
  }, [searchQuery, documentationSections]);

  const activeSectionData = documentationSections.find(s => s.id === activeSection);
  const [expandedFeature, setExpandedFeature] = useState<number | null>(null);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);

  const isMobile = window.innerWidth < 768;

  // Helper to check if feature is detailed object
  const isDetailedFeature = (feature: string | FeatureDetail): feature is FeatureDetail => {
    return typeof feature === 'object' && 'title' in feature && 'details' in feature;
  };

  // Helper to check if step is detailed object
  const isDetailedStep = (step: string | HowToUseStep): step is HowToUseStep => {
    return typeof step === 'object' && 'step' in step && 'title' in step;
  };

  // Helper to check if tip is detailed object
  const isDetailedTip = (tip: string | TipDetail): tip is TipDetail => {
    return typeof tip === 'object' && 'tip' in tip && 'description' in tip;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgb(17, 17, 17)',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      margin: 0,
      padding: 0
    }}>
      {/* Dedicated Documentation Header */}
      <div style={{
        background: 'radial-gradient(ellipse at center, rgba(255, 107, 53, 0.15) 0%, transparent 50%), linear-gradient(135deg, rgb(17, 17, 17) 0%, #1a1a1a 50%, rgb(17, 17, 17) 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: isMobile ? '1rem' : '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexShrink: 0,
        minHeight: '70px'
      }}>
        {/* Logo and Title - Far Left */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.75rem',
          flex: '0 0 auto'
        }}>
          <img 
            src="https://pwi5a-sqaaa-aaaaa-qcfgq-cai.raw.icp0.io/projects/project-mfvtjz8x-hc7uz/KCP_LOGO.png" 
            alt="Kontext Logo" 
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px'
            }}
          />
          <h1 style={{
            margin: 0,
            fontSize: isMobile ? '1.25rem' : '1.5rem',
            fontWeight: 700,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>Kontext</span>
            <span style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.6)',
              marginLeft: '0.5rem'
            }}>Documentation</span>
          </h1>
        </div>
        
        {/* Search Bar - Center */}
        <div style={{
          flex: isMobile ? '0 0 100%' : '1 1 auto',
          maxWidth: isMobile ? '100%' : '400px',
          margin: isMobile ? '0.5rem 0 0 0' : '0 auto',
          order: isMobile ? 3 : 2
        }}>
          <input
            type="text"
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: 'rgba(55, 65, 81, 0.5)',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'all 0.3s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#ff6b35';
              e.target.style.background = 'rgba(55, 65, 81, 0.7)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(75, 85, 99, 0.5)';
              e.target.style.background = 'rgba(55, 65, 81, 0.5)';
            }}
          />
        </div>

        {/* Right Side - User Dropdown and Close Button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flex: '0 0 auto',
          order: isMobile ? 2 : 3
        }}>
          {/* User Dropdown */}
          {onOpenProfile && onLogout && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <UserDropdown 
                onOpenProfile={onOpenProfile}
                onOpenAdmin={isAdmin ? onOpenAdmin : undefined}
                onLogout={onLogout}
              />
            </div>
          )}

          {/* Close Button */}
          {onClose && (
            <button
              onClick={onClose}
            style={{
              padding: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#ef4444',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.borderColor = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden'
      }}>
        {/* Sidebar Navigation */}
        <div style={{
          width: isMobile ? '100%' : '280px',
          background: 'rgb(17, 17, 17)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          overflowY: 'auto',
          padding: '1.5rem 0',
          display: isMobile && activeSectionData ? 'none' : 'block'
        }}>
          <div style={{ padding: '0 1rem' }}>
            <h3 style={{
              margin: '0 0 1rem 0',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Sections
            </h3>
            {filteredSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  marginBottom: '0.5rem',
                  background: activeSection === section.id
                    ? 'rgba(255, 107, 53, 0.15)'
                    : 'transparent',
                  border: activeSection === section.id
                    ? '1px solid rgba(255, 107, 53, 0.3)'
                    : '1px solid transparent',
                  borderRadius: '8px',
                  color: activeSection === section.id
                    ? '#ffffff'
                    : 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.9rem',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => {
                  if (activeSection !== section.id) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.color = '#ffffff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSection !== section.id) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                  }
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{section.icon}</span>
                <span>{section.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: isMobile ? '1.5rem 1rem' : '2rem 3rem',
          background: 'rgb(17, 17, 17)',
          position: 'relative',
          zIndex: 1,
          minHeight: '100%'
        }}>
          {activeSectionData ? (
            <div>
              {/* Section Header */}
              <div style={{
                marginBottom: '2rem',
                paddingBottom: '1.5rem',
                borderBottom: '2px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  <span style={{ fontSize: '3rem' }}>{activeSectionData.icon}</span>
                  <h2 style={{
                    margin: 0,
                    fontSize: isMobile ? '1.75rem' : '2.5rem',
                    fontWeight: 700,
                    background: 'var(--kontext-gradient-main)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    {activeSectionData.title}
                  </h2>
                </div>
                <p style={{
                  margin: 0,
                  fontSize: '1.125rem',
                  color: 'rgba(255, 255, 255, 0.8)',
                  lineHeight: 1.6
                }}>
                  {activeSectionData.content.overview}
                </p>
              </div>

              {/* Features */}
              <div style={{
                marginBottom: '2.5rem',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '12px',
                padding: '1.5rem'
              }}>
                <h3 style={{
                  margin: '0 0 1rem 0',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span>✨</span> Key Features
                </h3>
                <ul style={{
                  margin: 0,
                  paddingLeft: 0,
                  listStyle: 'none'
                }}>
                  {activeSectionData.content.features.map((feature, index) => {
                    const isDetailed = isDetailedFeature(feature);
                    const isExpanded = expandedFeature === index;
                    
                    return (
                      <li key={index} style={{
                        marginBottom: '0.5rem',
                        color: 'rgba(255, 255, 255, 0.8)',
                        lineHeight: 1.6,
                        position: 'relative',
                        padding: '0.5rem',
                        background: isExpanded ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                        border: '1px solid',
                        borderColor: isExpanded ? 'rgba(16, 185, 129, 0.4)' : 'transparent',
                        borderRadius: '8px',
                        transition: 'all 0.3s ease',
                        cursor: isDetailed ? 'pointer' : 'default'
                      }}
                      onClick={() => isDetailed && setExpandedFeature(isExpanded ? null : index)}
                      onMouseEnter={(e) => {
                        if (isDetailed) {
                          e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (isDetailed && !isExpanded) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'transparent';
                        }
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.75rem'
                        }}>
                          <span style={{
                            color: '#10b981',
                            fontSize: '1.25rem',
                            flexShrink: 0,
                            marginTop: '0.125rem'
                          }}>•</span>
                          <div style={{ flex: 1 }}>
                            {isDetailed ? (
                              <>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  marginBottom: '0.5rem'
                                }}>
                                  <strong style={{
                                    color: '#10b981',
                                    fontSize: '1rem',
                                    fontWeight: 600
                                  }}>{feature.title}</strong>
                                  <span style={{
                                    fontSize: '0.75rem',
                                    color: 'rgba(255, 255, 255, 0.5)',
                                    cursor: 'pointer',
                                    userSelect: 'none'
                                  }}>
                                    {isExpanded ? '▼' : '▶'} {isExpanded ? 'Hide details' : 'Show details'}
                                  </span>
                                </div>
                                <p style={{
                                  margin: 0,
                                  color: 'rgba(255, 255, 255, 0.7)',
                                  fontSize: '0.9rem',
                                  marginBottom: isExpanded ? '0.75rem' : 0
                                }}>
                                  {feature.description}
                                </p>
                                {isExpanded && (
                                  <div style={{
                                    marginTop: '0.75rem',
                                    padding: '1rem',
                                    background: 'rgba(0, 0, 0, 0.3)',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(16, 185, 129, 0.2)'
                                  }}>
                                    <p style={{
                                      margin: 0,
                                      color: 'rgba(255, 255, 255, 0.9)',
                                      lineHeight: 1.7,
                                      whiteSpace: 'pre-wrap'
                                    }}>
                                      {feature.details}
                                    </p>
                                  </div>
                                )}
                              </>
                            ) : (
                              <span>{feature}</span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* How to Use */}
              <div style={{
                marginBottom: '2.5rem',
                background: 'rgba(255, 107, 53, 0.1)',
                border: '1px solid rgba(255, 107, 53, 0.3)',
                borderRadius: '12px',
                padding: '1.5rem'
              }}>
                <h3 style={{
                  margin: '0 0 1rem 0',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: '#ff6b35',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span>📖</span> How to Use
                </h3>
                <ol style={{
                  margin: 0,
                  paddingLeft: 0,
                  listStyle: 'none',
                  counterReset: 'step-counter'
                }}>
                  {activeSectionData.content.howToUse.map((step, index) => {
                    const isDetailed = isDetailedStep(step);
                    
                    return (
                      <li key={index} style={{
                        marginBottom: '1rem',
                        color: 'rgba(255, 255, 255, 0.8)',
                        lineHeight: 1.6,
                        position: 'relative',
                        paddingLeft: '2.5rem',
                        counterIncrement: 'step-counter'
                      }}>
                        <span style={{
                          position: 'absolute',
                          left: 0,
                          width: '1.75rem',
                          height: '1.75rem',
                          background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#ffffff',
                          boxShadow: '0 2px 8px rgba(255, 107, 53, 0.3)',
                          flexShrink: 0
                        }}>
                          {isDetailed ? step.step : (index + 1)}
                        </span>
                        {isDetailed ? (
                          <div>
                            <strong style={{
                              display: 'block',
                              color: '#ff6b35',
                              fontSize: '1rem',
                              fontWeight: 600,
                              marginBottom: '0.5rem'
                            }}>{step.title}</strong>
                            <p style={{
                              margin: 0,
                              color: 'rgba(255, 255, 255, 0.8)',
                              lineHeight: 1.7
                            }}>{step.description}</p>
                          </div>
                        ) : (
                          <span>{step}</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* Tips */}
              {activeSectionData.content.tips && activeSectionData.content.tips.length > 0 && (
                <div style={{
                  background: 'rgba(139, 92, 246, 0.1)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '12px',
                  padding: '1.5rem'
                }}>
                  <h3 style={{
                    margin: '0 0 1rem 0',
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: '#8b5cf6',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span>💡</span> Pro Tips
                  </h3>
                  <ul style={{
                    margin: 0,
                    paddingLeft: 0,
                    listStyle: 'none'
                  }}>
                    {activeSectionData.content.tips.map((tip, index) => {
                      const isDetailed = isDetailedTip(tip);
                      const isExpanded = expandedTip === index;
                      
                      return (
                        <li key={index} style={{
                          marginBottom: '0.5rem',
                          color: 'rgba(255, 255, 255, 0.8)',
                          lineHeight: 1.6,
                          position: 'relative',
                          padding: '0.5rem',
                          background: isExpanded ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                          border: '1px solid',
                          borderColor: isExpanded ? 'rgba(139, 92, 246, 0.4)' : 'transparent',
                          borderRadius: '8px',
                          transition: 'all 0.3s ease',
                          cursor: isDetailed ? 'pointer' : 'default'
                        }}
                        onClick={() => isDetailed && setExpandedTip(isExpanded ? null : index)}
                        onMouseEnter={(e) => {
                          if (isDetailed) {
                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (isDetailed && !isExpanded) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = 'transparent';
                          }
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.75rem'
                          }}>
                            <span style={{
                              color: '#8b5cf6',
                              fontSize: '1.25rem',
                              flexShrink: 0,
                              marginTop: '0.125rem'
                            }}>💡</span>
                            <div style={{ flex: 1 }}>
                              {isDetailed ? (
                                <>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    marginBottom: '0.5rem'
                                  }}>
                                    <strong style={{
                                      color: '#8b5cf6',
                                      fontSize: '1rem',
                                      fontWeight: 600
                                    }}>{tip.tip}</strong>
                                    <span style={{
                                      fontSize: '0.75rem',
                                      color: 'rgba(255, 255, 255, 0.5)',
                                      cursor: 'pointer',
                                      userSelect: 'none'
                                    }}>
                                      {isExpanded ? '▼' : '▶'} {isExpanded ? 'Hide details' : 'Show details'}
                                    </span>
                                  </div>
                                  {isExpanded && (
                                    <div style={{
                                      marginTop: '0.75rem',
                                      padding: '1rem',
                                      background: 'rgba(0, 0, 0, 0.3)',
                                      borderRadius: '8px',
                                      border: '1px solid rgba(139, 92, 246, 0.2)'
                                    }}>
                                      <p style={{
                                        margin: 0,
                                        color: 'rgba(255, 255, 255, 0.9)',
                                        lineHeight: 1.7,
                                        whiteSpace: 'pre-wrap'
                                      }}>
                                        {tip.description}
                                      </p>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span>{tip}</span>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: 'rgba(255, 255, 255, 0.6)'
            }}>
              <p>No section selected. Choose a section from the sidebar to get started.</p>
            </div>
          )}

          {/* Mobile Back Button */}
          {isMobile && activeSectionData && (
            <button
              onClick={() => setActiveSection('')}
              style={{
                marginTop: '2rem',
                padding: '0.75rem 1.5rem',
                background: 'var(--kontext-gradient-button)',
                border: 'none',
                borderRadius: '10px',
                color: 'var(--kontext-text-primary)',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%'
              }}
            >
              ← Back to Sections
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

