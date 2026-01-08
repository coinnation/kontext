# Kontext IC Development - ZSH Aliases

Quick reference for all custom zsh aliases added for Kontext development.

## 🚀 Deploy Commands

| Alias | Command | Description |
|-------|---------|-------------|
| `deploy-backend` | `dfx deploy kontext_backend --network ic` | Deploy backend canister to IC mainnet |
| `deploy-frontend` | `dfx deploy kontext_frontend --network ic` | Deploy frontend canister to IC mainnet |
| `deploy-user` | `dfx deploy user_canister --network ic` | Deploy user canister template to IC mainnet |
| `deploy-all` | `dfx deploy --network ic` | Deploy all canisters to IC mainnet |

## 🔨 Build Commands

| Alias | Command | Description |
|-------|---------|-------------|
| `build-backend` | `dfx build kontext_backend` | Build backend canister |
| `build-frontend` | `cd src/kontext_frontend && npm run build && cd ../..` | Build frontend (runs npm build) |
| `build-user` | `dfx build user_canister` | Build user canister |

## ℹ️ Canister Info

| Alias | Command | Description |
|-------|---------|-------------|
| `info-backend` | `dfx canister --network ic info kontext_backend` | Get backend canister info (controllers, module hash) |
| `info-frontend` | `dfx canister --network ic info kontext_frontend` | Get frontend canister info |
| `info-user` | `dfx canister --network ic info user_canister` | Get user canister info |

## ⚡ Quick Workflows

| Alias | Command | Description |
|-------|---------|-------------|
| `deploy-quick` | `build-frontend && deploy-frontend` | Build and deploy frontend in one command |
| `deploy-be` | `dfx build kontext_backend && deploy-backend` | Build and deploy backend in one command |

## 📊 Logs & Status

| Alias | Command | Description |
|-------|---------|-------------|
| `logs-backend` | `dfx canister --network ic logs kontext_backend` | View backend canister logs |
| `status-ic` | `dfx canister --network ic status kontext_backend` | Check canister status on IC |

---

## 🔧 Setup

These aliases are added to your `~/.zshrc` file. To activate them:

```bash
source ~/.zshrc
```

Or open a new terminal tab.

## 📦 Canister IDs

For reference, your deployed canister IDs:

```
kontext_backend:  pkmhr-fqaaa-aaaaa-qcfeq-cai
user_canister:    pnnbf-iiaaa-aaaaa-qcfea-cai
kontext_frontend: pdpmn-tyaaa-aaaaa-qcffa-cai
```

## 💡 Usage Examples

```bash
# Deploy user canister with latest code
deploy-user

# Check backend canister info
info-backend

# Quick frontend update
deploy-quick

# View recent backend logs
logs-backend
```

## 🛠️ Adding More Aliases

To add more aliases, edit `~/.zshrc`:

```bash
nano ~/.zshrc
```

Then reload:

```bash
source ~/.zshrc
```

---

**Last Updated:** January 8, 2026

