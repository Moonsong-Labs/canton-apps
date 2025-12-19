# Lunar-dollar SDK

Generated TypeScript SDK for lunar-dollar Canton ledger.

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

## JSON API Auth (curl)

The Canton JSON API requires an OAuth2 Bearer token (JWT).
This SDK auto-generates an **unsigned dev token** for sandbox if you don't provide `LEDGER_TOKEN`.

If you want to test the JSON API manually with curl:

```bash
export PARTY="Alice::1220..."  # use a real party id from /v1/parties

TOKEN="$(node -e '
  const party = process.env.PARTY;
  if (!party) throw new Error("PARTY env var required");
  const header = { alg: "none", typ: "JWT" };
  const payload = {
    "https://daml.com/ledger-api": {
      ledgerId: "sandbox",
      actAs: [party],
      readAs: [party],
      applicationId: "lunar-dollar-sdk",
    },
    exp: Math.floor(Date.now() / 1000) + 86400,
    iat: Math.floor(Date.now() / 1000),
  };
  const b64 = (obj) =>
    Buffer.from(JSON.stringify(obj), "utf8")
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  process.stdout.write(b64(header) + "." + b64(payload) + ".");
')"

# IMPORTANT:
# - keep the trailing dot (unsigned JWT)
# - keep the header in double quotes (avoid shell mangling)
curl -s -H "Authorization: Bearer ${TOKEN}" http://localhost:7575/v1/packages
```

## Quick Start

### Creating Contracts

Every template has a namespace with `create()` and choice functions:

```typescript
import { Data_Reference_HolidayCalendar, TemplateIds } from './lunar-dollar-api';
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
import { Query } from './lunar-dollar-api';

// Query with type-safe filters
const spec = Query.data_Reference_HolidayCalendar({ /* filter */ });
const contracts = await ledger.query(spec.templateId, spec.filter);
```

## React Hooks (Optional)

```typescript
import { CantonProvider } from './lunar-dollar-api/react';

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
