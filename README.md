# canton-apps

A monorepo for Canton/Daml applications.

## Apps

### 🌙 [Lunar Dollar](./lunar-dollar/)

A compliant stablecoin implementation with ERC-3643 style claims-based identity verification.

### 🔐 [Vault](./vault/)

A tokenized vault application built with Daml Finance for deposits, share issuance, and redemptions.

## Getting Started

### Prerequisites

This project uses a **Dev Container** with Daml SDK and Bun pre-installed.

#### VS Code / Cursor

1. Install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
2. Open the repository folder
3. Click "Reopen in Container" when prompted, and select the **stable** configuration (or run `Dev Containers: Reopen in Container` from the command palette)

### 1. Setup

Run the setup command to download dependencies, build all Daml packages, and install webapp dependencies:

```bash
make setup
```

This will:
- Download Daml Finance dependencies for all apps
- Build all Daml packages with `daml build --all`
- Install webapp dependencies with `bun i`

### 2. Start the Vault Sandbox

```bash
cd vault
daml start
```

### 3. Start the Webapp

```bash
cd vault/webapp
bun run dev
```
