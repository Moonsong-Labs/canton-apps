# Vault TypeScript SDK Documentation

Generated on: 2025-12-12

## Overview

This SDK provides a complete TypeScript API for interacting with the Vault Daml smart contracts on Canton ledger. It includes type-safe wrappers for all templates, choices, and workflows.

## Project Information

- **Project Name**: vault
- **Project Version**: 0.0.6
- **Daml SDK Version**: 2.10.2
- **Total Templates**: 81
  - Workflows: 2
  - Factories: 28
  - Assets: 5
  - State: 46
- **Total Interfaces**: 30

## Directory Structure

```
vault/sdk/
├── core/                   # Core primitives and types
│   ├── primitives.ts      # Basic Daml types (Party, ContractId, etc.)
│   ├── interfaces.ts      # Common interface types
│   └── index.ts
├── ledger/                 # Ledger interaction layer
│   ├── client.ts          # Main ledger client
│   ├── config.ts          # Configuration
│   ├── errors.ts          # Error classes
│   ├── retry.ts           # Retry logic
│   ├── streaming.ts       # Stream utilities
│   ├── resolver.ts        # Contract resolution
│   └── index.ts
├── utils/                  # Utility functions
│   ├── amounts.ts         # Amount/Quantity helpers
│   ├── ids.ts             # ID generators
│   ├── datetime.ts        # Date/time utilities
│   ├── damlMap.ts         # DamlMap helpers
│   └── index.ts
├── react/                  # React integration (optional)
│   ├── context/
│   │   ├── LedgerContext.tsx  # React context provider
│   │   └── useLedger.ts       # Context hook
│   └── hooks/
│       ├── core.ts        # Base query/mutation hooks
│       ├── queries.ts     # Template query hooks
│       ├── mutations.ts   # Create/choice mutation hooks
│       ├── keys.ts        # Query key factories
│       └── index.ts
├── daml-js/               # Generated JavaScript bindings
├── vault-api.ts           # Main API with all templates
├── package.json
├── tsconfig.json
└── README.md
```

## Installation

The SDK is already set up with all dependencies. To use it in your project:

```bash
cd /workspaces/canton-vault/vault/sdk
npm install
```

## Configuration

Create a `.env` file (or copy from `.env.example`):

```env
CANTON_LEDGER_API_HOST=localhost
CANTON_LEDGER_API_PORT=5011
CANTON_PARTY_NAME=Alice
CANTON_APPLICATION_ID=vault-app
```

## Basic Usage

### 1. Connect to the Ledger

```typescript
import { createLedgerClient } from './ledger';

const client = await createLedgerClient({
  host: 'localhost',
  port: 5011,
  applicationId: 'vault-app'
});
```

### 2. Query Contracts

```typescript
import { queryContracts } from './ledger';
import { Vault_State_VaultState } from './vault-api';

// Query all VaultState contracts
const vaultStates = await queryContracts(
  config,
  Vault_State_VaultState.templateId
);

// Access contract data
vaultStates.forEach(contract => {
  console.log('Vault:', contract.payload.vaultInstrument);
  console.log('Total Assets:', contract.payload.totalAssets);
});
```

### 3. Create Contracts

```typescript
import { submitCommand } from './ledger';
import { Vault_Config_VaultConfig } from './vault-api';

// Create a new VaultConfig
const command = Vault_Config_VaultConfig.create({
  operator: 'Alice::122...',
  public: 'Public::123...',
  // ... other required fields
});

const result = await submitCommand(config, command);
console.log('Created contract:', result.contractId);
```

### 4. Exercise Choices

```typescript
import { Vault_Deposit_DepositRequest } from './vault-api';

// Exercise a choice on a contract
const depositCommand = Vault_Deposit_DepositRequest.process(
  contractId,
  {
    depositCid: someContractId
  }
);

const result = await submitCommand(config, depositCommand);
```

## React Integration

The SDK includes React hooks for easy integration with React applications.

### Setup Provider

```typescript
import { LedgerProvider } from './react';

function App() {
  return (
    <LedgerProvider config={{
      host: 'localhost',
      port: 5011,
      applicationId: 'vault-app'
    }}>
      <YourApp />
    </LedgerProvider>
  );
}
```

### Use Query Hooks

```typescript
import { useVault_State_VaultStateQuery } from './react';

function VaultDashboard() {
  const { data: vaultStates, isLoading } = useVault_State_VaultStateQuery();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {vaultStates?.map(vault => (
        <div key={vault.contractId}>
          Total Assets: {vault.payload.totalAssets}
        </div>
      ))}
    </div>
  );
}
```

### Use Mutation Hooks

```typescript
import { useVault_Config_VaultConfigCreate } from './react';

function CreateVaultConfig() {
  const createVault = useVault_Config_VaultConfigCreate();

  const handleCreate = () => {
    createVault.mutate({
      operator: 'Alice::122...',
      public: 'Public::123...',
      // ... other fields
    });
  };

  return (
    <button onClick={handleCreate} disabled={createVault.isPending}>
      Create Vault Config
    </button>
  );
}
```

## Key Vault Templates

### Vault.Config.VaultConfig

Configuration template for the vault system.

```typescript
import { Vault_Config_VaultConfig } from './vault-api';

// Create
const config = Vault_Config_VaultConfig.create({
  operator: Party,
  public: Party,
  // ... fields
});

// Choices
Vault_Config_VaultConfig.choiceName(contractId, args);
```

### Vault.State.VaultState

Maintains the current state of the vault.

```typescript
import { Vault_State_VaultState } from './vault-api';

// Query vault state
const states = await queryContracts(config, Vault_State_VaultState.templateId);

// Choices available
Vault_State_VaultState.deposit(contractId, args);
Vault_State_VaultState.redeem(contractId, args);
```

### Vault.Deposit.DepositRequest

Handles deposit requests.

```typescript
import { Vault_Deposit_DepositRequest } from './vault-api';

const request = Vault_Deposit_DepositRequest.create({
  // deposit fields
});
```

### Vault.Redeem.RedeemRequest

Handles redemption requests.

```typescript
import { Vault_Redeem_RedeemRequest } from './vault-api';

const request = Vault_Redeem_RedeemRequest.create({
  // redeem fields
});
```

## Utilities

### Amount Helpers

```typescript
import { parseAmount, formatAmount, addAmounts } from './utils';

const amount = parseAmount('100.50', 2);
const formatted = formatAmount(amount, 2); // "100.50"
const sum = addAmounts(amount1, amount2);
```

### ID Generators

```typescript
import { generateId, generateInstrumentKey } from './utils';

const id = generateId('vault-share');
const instrumentKey = generateInstrumentKey(depository, issuer, id, version);
```

### Date/Time

```typescript
import { toTime, fromTime, formatDate } from './utils';

const time = toTime(new Date());
const date = fromTime(damlTime);
```

### DamlMap Helpers

```typescript
import { createMap, getMapValue } from './utils';

const map = createMap([
  ['key1', 'value1'],
  ['key2', 'value2']
]);
```

## Error Handling

```typescript
import { LedgerError, ContractNotFoundError } from './ledger';

try {
  await submitCommand(config, command);
} catch (error) {
  if (error instanceof ContractNotFoundError) {
    console.error('Contract not found:', error.contractId);
  } else if (error instanceof LedgerError) {
    console.error('Ledger error:', error.message);
  }
}
```

## TypeScript Compilation

The SDK is fully type-safe and compiles with strict TypeScript settings:

```bash
npm run type-check  # or: npx tsc --noEmit
```

All templates include:
- Type-safe Payload interfaces
- Type-safe create() functions
- Type-safe choice functions with proper argument types
- Full IntelliSense support in IDEs

## Testing

To generate integration tests for this SDK, use the `canton-test-generator` skill:

```bash
# This will generate TypeScript tests from Daml test scripts
claude run canton-test-generator
```

## Validation Checklist

- [x] All templates have namespaces with Payload, create(), and choices
- [x] TypeScript compiles with strict mode (no errors)
- [x] React hooks generated for queries and mutations
- [x] Documentation created (this file)
- [x] Core utilities for amounts, IDs, dates, and maps
- [x] Error handling with custom error classes
- [x] Retry logic for transient failures
- [x] Environment configuration support

## Next Steps

1. **Generate Tests**: Run `canton-test-generator` skill to create integration tests
2. **Generate Web App**: Run `canton-webapp-generator` skill to create a React web application
3. **Customize**: Extend the SDK with application-specific business logic
4. **Deploy**: Build and deploy your application

## Support

For issues or questions about the SDK:
- Check the Daml Finance documentation for library templates
- Review the Canton documentation for ledger API details
- Check the generated code comments in vault-api.ts
