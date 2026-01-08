# Kontext 🚀

> Full-stack AI-powered development platform built on the Internet Computer

Kontext is a revolutionary AI-driven development environment that allows you to build, deploy, and manage full-stack applications entirely on the Internet Computer blockchain. With integrated AI assistance, real-time collaboration, and seamless deployment workflows, Kontext transforms how developers create and ship software.

## ✨ Features

### 🤖 **AI-Powered Development**
- Multi-model AI support (GPT-4, Claude, Gemini, Kimi)
- Intelligent code generation and refactoring
- Context-aware suggestions and auto-completion
- Natural language to code transformation

### 🏗️ **Full-Stack Platform**
- **Frontend**: React + TypeScript + Vite
- **Backend**: Motoko smart contracts on Internet Computer
- **Database**: On-chain persistent storage
- **Hosting**: Decentralized hosting on IC canisters

### 🎯 **Core Capabilities**
- **Project Management**: Version control, snapshots, and rollback
- **Real-time Collaboration**: Multiple users, live editing
- **Deploy to IC**: One-click deployment to Internet Computer
- **Server Pair Management**: Manage frontend/backend canister pairs
- **Live Preview**: See changes instantly with hot reload
- **Domain Management**: Custom domain configuration
- **Credits System**: Usage-based billing with Stripe integration

### 🔐 **Authentication & Security**
- Internet Identity integration
- Secure delegation chain management
- Role-based access control
- Encrypted data storage

## 🏛️ Architecture

```
kontext/
├── src/
│   ├── kontext_backend/         # Platform canister (Motoko)
│   ├── kontext_user_canister/   # User data canister (Motoko)
│   └── kontext_frontend/        # React frontend
├── docs/                        # Documentation
├── dfx.json                     # IC configuration
└── mops.toml                    # Motoko package manager
```

### **Canisters**

1. **Platform Canister** (`kontext_backend`)
   - Subscription management
   - Marketplace & forum
   - University/learning platform
   - Analytics & notifications

2. **User Canister** (`kontext_user_canister`)
   - Project storage
   - Version management
   - Code artifacts
   - Server pair assignments

3. **Frontend Assets** (`kontext_frontend`)
   - React SPA
   - Monaco Editor integration
   - AI chat interface
   - Deployment tools

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- DFX (Internet Computer SDK)
- Mops (Motoko package manager)

### Installation

```bash
# Clone the repository
git clone https://github.com/coinnation/kontext.git
cd kontext

# Install dependencies
npm install
cd src/kontext_frontend && npm install && cd ../..

# Install Motoko packages
mops install

# Start local Internet Computer
dfx start --background

# Deploy canisters
dfx deploy

# Start frontend dev server
cd src/kontext_frontend && npm run dev
```

### Build for Production

```bash
# Build frontend
npm run build:frontend

# Deploy to IC mainnet
dfx deploy --network ic
```

## 📚 Key Technologies

- **Frontend**: React 18, TypeScript, Vite, Zustand, Monaco Editor
- **Backend**: Motoko, Internet Computer Protocol
- **AI Integration**: OpenAI, Anthropic Claude, Google Gemini, Kimi
- **Payments**: Stripe API
- **Authentication**: Internet Identity
- **Storage**: On-chain persistent HashMap storage

## 🎨 UI Components

- **Chat Interface**: AI-powered development assistant
- **Code Editor**: Monaco-based editor with Motoko support
- **Project Explorer**: File tree with version management
- **Deploy Dashboard**: One-click deployment interface
- **Version Manager**: Snapshot, restore, and compare versions
- **Server Pair Manager**: Frontend/backend canister orchestration

## 💳 Subscription Tiers

- **Free**: Basic features, limited credits
- **Starter**: $1/month, 10k credits
- **Pro**: $30/month, 100k credits
- **Enterprise**: Custom pricing, unlimited credits

## 🔧 Configuration

### Environment Variables

```bash
# Frontend (.env)
VITE_IC_HOST=https://ic0.app
VITE_CANISTER_ID_KONTEXT_BACKEND=...
VITE_CANISTER_ID_USER_CANISTER=...
```

### DFX Configuration

See `dfx.json` for canister definitions and network settings.

## 📖 Documentation

- [Agency Workflow Guide](docs/agency-workflow-guide.md)
- [AI Workflow Creation](docs/AI_WORKFLOW_CREATION_FLOW.md)
- [Live Editing Capabilities](docs/live-editing-capabilities.md)
- [Session Management](docs/session-management-fixes.md)

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

Copyright © 2026 CoinNation. All rights reserved.

## 🔗 Links

- **Website**: https://kontext.app (coming soon)
- **Documentation**: https://docs.kontext.app (coming soon)
- **Twitter**: @KontextApp (coming soon)

## 🙏 Acknowledgments

Built with ❤️ on the Internet Computer blockchain.

Special thanks to:
- DFINITY Foundation for the Internet Computer
- The Motoko team
- The IC community

---

**Made with 🚀 by CoinNation**

