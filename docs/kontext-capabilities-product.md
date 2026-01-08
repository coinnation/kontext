### Kontext – Product Overview (For End Users)

#### What is Kontext?

Kontext is a **one-stop vibe coding platform** to:

- Build and deploy full-stack apps on the decentralized cloud.
- Create and run AI agents as standalone services.
- Design multi-agent workflows ("agencies") that automate complex tasks.
- Manage hosting, billing, and infrastructure from a single interface.

If you want to turn ideas into running, intelligent apps and agents without managing raw servers or DevOps, Kontext is designed for you.

---

#### 1. Build & Deploy Apps

- **Create projects**
  - Start from scratch or from smart templates.
  - Manage your project files (backend, React/Vite frontend, configs) directly in Kontext.

- **Edit backend and frontend together**
  - Keep everything in sync: business logic, API definitions, and UI all live in one place.

- **Deploy to the decentralized cloud**
  - Kontext handles:
    - Compiling your backend code.
    - Bundling your frontend.
    - Deploying both to your own servers.
  - A dedicated **Deployment interface** shows:
    - Progress and logs.
    - Error details and suggestions.
    - Deployment history and status per project.

- **Built-in features out of the box**
  - **Authentication**: Every deployed app comes with Internet Identity authentication built in—users can sign in securely without you writing any auth code.
  - **Database editor**: Your apps include a powerful database editor leveraging decentralized technology, so you can manage your app's data visually without touching backend code.

- **Preview live**
  - Use the live preview features to see how your app behaves before you lock in changes.

---

#### 2. Spin Up & Manage Agents

- **Create agents as independent services**
  - Deploy an agent to its own backend + frontend server pair.
  - Each agent has:
    - Its own configuration (model settings, token limits, MCP servers, etc.).
    - A standalone UI you can open in its own tab.

- **MCP (Model Context Protocol) Server Integration**
  - **Connect agents to powerful tools**: Agents can use MCP servers to access real-world capabilities.
  - **Key integration platforms** (unlock access to thousands of tools):
    - **Zapier**: Connect to 6,000+ apps and services—from CRM systems to marketing tools, payment processors to project management platforms. Zapier MCP integration opens up the entire Zapier ecosystem to your agents.
    - **Rube**: Access a comprehensive library of MCP tools and integrations, expanding your agent's capabilities across multiple service categories.
  - **Direct MCP servers** include:
    - **GitHub**: Manage repositories, create issues, review code, handle pull requests.
    - **Slack/Discord**: Send messages, manage channels, respond to team communications.
    - **Filesystem**: Read/write files, manage directories, manipulate content.
    - **Database**: Query databases, update records, manage schemas.
    - **Web Search**: Search the web, gather real-time information.
    - **Email**: Send and receive emails, manage inboxes.
    - **Calendar**: Create events, manage schedules, coordinate meetings.
    - **APIs**: Connect to any REST or GraphQL API.
    - **Cloud Services**: Integrate with AWS, Google Cloud, Azure.
    - **Productivity Tools**: Notion, Airtable, Trello, Linear, and more.
  - **Discover and configure tools**: Browse available MCP tools by category, search for specific capabilities, and add them to your agents with a few clicks.

- **What you can build with MCP-enabled agents**
  - **Code automation**: Agents that automatically review pull requests, fix bugs, write tests, or refactor code.
  - **Data workflows**: Extract data from one system, transform it, and load it into another—all automatically.
  - **Team assistants**: Monitor Slack channels, answer questions, route messages, or create tickets.
  - **Research agents**: Gather information from multiple sources, synthesize reports, or track topics over time.
  - **Content creation**: Generate blog posts, social media content, documentation, or marketing materials.
  - **Customer support**: Handle support tickets, answer common questions, or escalate complex issues.
  - **DevOps automation**: Monitor infrastructure, deploy updates, manage CI/CD pipelines, or handle alerts.
  - **Business automation**: Connect your tools—when something happens in one system, trigger actions in others.
  - **Enterprise integrations**: Through Zapier and Rube, agents can interact with virtually any business tool—from Salesforce and HubSpot to Shopify and Stripe, from QuickBooks to Mailchimp. The possibilities are nearly limitless.

- **Monitor agent activity**
  - From the main Agent Management view, you can see:
    - Recent tasks the agent has executed.
    - Which MCP tools were used in each task.
    - Configured triggers (schedules, webhooks, events, manual triggers, and more).
    - Pending approvals, if your agent requires human confirmation.
    - Error logs and detailed activity history.

- **Control agent behavior**
  - Execute ad-hoc tasks with custom inputs.
  - Enable/disable triggers or run them manually.
  - Approve or reject actions that need your sign-off.
  - Update configuration as your needs change.
  - Add or remove MCP servers to give your agent new capabilities.

---

#### 3. Design Multi-Agent Workflows (Agencies)

- **Visual workflow builder**
  - Drag and drop your agents onto a canvas.
  - Connect them in **sequence**, **parallel**, or with **conditional** branches.
  - Configure each step with:
    - Which agent to call.
    - What input template to use.
    - Whether approval is required.
    - Retry and timeout behavior.

- **Run and observe workflows**
  - Start an agency with a single input.
  - Watch it progress through each step:
    - See step results, timing, and any errors.
    - Understand which triggers and agents were involved.

- **Trigger workflows automatically**
  - Agencies support:
    - **Manual triggers** (you click "run").
    - **Scheduled triggers** (run every N minutes, cron-like schedules, etc.).
    - **Webhook triggers** (run when an external system hits a URL).
    - **Event/agent-based triggers** (run when another agent or system signals an event).

- **Independent workflow UI**
  - Each agency workflow engine has its own dedicated UI (hosted on its frontend server) that you can open directly for deeper control and monitoring.

---

#### 4. Manage Hosting & Infrastructure

- **Server pairs (frontend + backend)**
  - Kontext uses **server pairs** (one frontend server + one backend server) to host your:
    - Full-stack apps.
    - Agents.
    - Agency workflow engines.

- **Comprehensive hosting management**
  - From the Hosting tab, you can:
    - **Create new server pairs** with custom names and credit allocations.
    - **Allocate credits** to server pairs with automatic optimal configuration calculation.
    - **Assign server pairs** to projects, agents, or agencies.
    - **Monitor real-time status** of all your servers and server pairs.
    - **View credit-to-USD conversion** for transparent cost tracking.
    - **Top up resources** directly through the cloud infrastructure integration.
    - **Remove or reassign** server pairs as your needs change.

- **Credit management**
  - Real-time credit balance tracking with automatic refresh during operations.
  - See exactly how credits are allocated across your infrastructure.
  - Understand resource usage and costs at a glance.

---

#### 5. Built-in Database Editor & External Database Access

- **Database editor in every app**
  - **Built right into your deployed apps**: Every app you deploy comes with a powerful database editor leveraging decentralized technology.
  - **No backend code needed**: Manage your app's data directly through a visual interface.
  - **Automatic schema detection**: Kontext reads your server's interface and builds a schema automatically.
  - **Visual query builder**: Construct queries visually without writing code.
  - **Schema-based forms**: Create and edit records using forms that adapt to your data structure.
  - **Table views**: Browse your data in clean, sortable, filterable tables.
  - **Specialized fields**: Support for images, colors, and complex nested objects.
  - **Real-time data access**: Query, create, update, and delete records directly through the UI with changes reflected immediately.

- **Connect to external databases (Database Tab)**
  - The Database tab also lets you connect to **any server on the decentralized cloud** as a data source.
  - No need to write custom code—Kontext automatically discovers the server's structure and methods.
  - Access data from other apps, services, or any server on the decentralized cloud.

- **Desktop and mobile interfaces**
  - Full-featured desktop interface for power users.
  - Mobile-optimized views for on-the-go data access.
  - Responsive design that works on any device.

#### 6. Professional Chat Experience

- **Enterprise-grade development interface**
  - Kontext's chat interface is designed to feel like a **professional development tool**, not a toy:
    - Polished, responsive UI with smooth animations.
    - Sophisticated message coordination and state management.
    - Context-aware conversations that remember your project state.
    - Real-time streaming responses with elegant loading states.

- **Intelligent automation**
  - Chat commands can trigger deployments automatically.
  - Auto-retry for failed operations with clear progress indicators.
  - Project creation workflows that guide you step-by-step.
  - Error recovery suggestions that help you fix issues quickly.

- **Project-scoped conversations**
  - Each project maintains its own conversation history.
  - Switch between projects seamlessly with full context preservation.
  - Messages are tied to your project files and deployment state.

- **Professional polish**
  - Unlike typical "vibe coder" tools, Kontext feels like a tool built for serious developers.
  - Attention to detail in animations, loading states, and error handling.
  - Reliable, predictable behavior that you can count on for production work.

#### 7. Credits, Billing & Accounts

- **Credits-based model**
  - Many operations (hosting, deployments, etc.) consume credits.
  - Kontext shows your current balance and recent changes.

- **Subscriptions and payments**
  - Choose a subscription tier that fits your usage.
  - Top up credits and manage payments via integrated Stripe flows.

- **Account & profile management**
  - Manage your profile, account settings, and subscription from within the app.

---

#### 8. Reliability, Recovery & Insights

- **Safe initialization and recovery**
  - Guided flows help you initialize projects and workflow engines.
  - Recovery tools help you bounce back quickly if something goes wrong during deployment.

- **Detailed error views**
  - If deployments or builds fail, Kontext:
    - Parses the errors.
    - Surfaces them with human-friendly explanations.
    - Suggests next steps or automatic fixes where possible.

- **Clear dashboards**
  - Agents and agencies expose clear dashboards for:
    - Task history.
    - Triggers.
    - Errors.
    - Approvals and activities.

In short, Kontext gives you **all the building blocks**—apps, agents, workflows, hosting, and billing—in one integrated, decentralized cloud-native environment.
