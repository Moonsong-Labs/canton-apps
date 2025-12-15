# Vault SDK

Generated TypeScript SDK for vault Canton ledger.

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure ledger connection:

```bash
LEDGER_HOST=localhost
LEDGER_PORT=7575
LEDGER_TOKEN=  # Optional JWT token
```

## Quick Start

### Creating Contracts

Every template has a namespace with `create()` and choice functions:

```typescript
import { Data_Reference_HolidayCalendar, TemplateIds } from './vault-api';
import { createLedgerClient } from './ledger';

const ledger = createLedgerClient('alice::1220...', { host: 'localhost', port: 7575 });

// Create a contract
const cmd = Data_Reference_HolidayCalendar.create({
  // ... payload fields
});
const contractId = await ledger.create(cmd.templateId, cmd.argument);
```

### Exercising Choices

```typescript
// Exercise a choice
const choiceCmd = Data_Reference_HolidayCalendar.getCalendar(contractId);
await ledger.exercise(
  choiceCmd.templateId,
  contractId,
  choiceCmd.choice!,
  choiceCmd.argument
);
```

### Querying Contracts

```typescript
import { Query } from './vault-api';

// Query with type-safe filters
const spec = Query.data_Reference_HolidayCalendar({ /* filter */ });
const contracts = await ledger.query(spec.templateId, spec.filter);
```

## React Hooks (Optional)

```typescript
import { CantonProvider } from './vault-api/react';

function App() {
  return (
    <CantonProvider config={{ ledgerUrl: 'http://localhost:7575' }} party="alice::1220...">
      <YourComponent />
    </CantonProvider>
  );
}
```

## Utilities

```typescript
import { normalizeAmount, formatAmount, addAmounts } from './utils';
import { createAccountKey, createInstrumentKey } from './utils';
import { toCantonTime, nowAsCantonTime } from './utils';
```

## Error Handling

```typescript
import { LedgerError, isLedgerError, withRetry } from './ledger';

try {
  await ledger.create(templateId, payload);
} catch (error) {
  if (isLedgerError(error)) {
    console.error(`Ledger error [${error.code}]: ${error.message}`);
  }
}
```
