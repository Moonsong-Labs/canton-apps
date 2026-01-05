# canton-apps

A monorepo for Canton/Daml applications.

## Getting Started

### 1. Download Dependencies

First, download the Daml Finance dependencies for all apps:

```bash
./get-dependencies.sh
```

### 2. Build

Build all Daml packages:

```bash
daml build --all
```

## Apps

### 🌙 [Lunar Dollar](./lunar-dollar/)

A compliant stablecoin implementation with ERC-3643 style claims-based identity verification.

### 🔐 [Vault](./vault/)

A tokenized vault application built with Daml Finance for deposits, share issuance, and redemptions.
