# Lunar Dollar SDK

TypeScript SDK for interacting with the Lunar Dollar Canton ledger.

## Quick Start

### Installation

```bash
cd sdk
npm install
```

### Environment Configuration

Copy `.env.example` to `.env`:

```bash
LEDGER_HOST=localhost
LEDGER_PORT=7575
LEDGER_TOKEN=  # Optional JWT token for production
```

### Create Ledger Client

```typescript
import { createLedgerClient } from "./ledger";

const ledger = createLedgerClient("alice::1220abc123...", {
  host: "localhost",
  port: 7575,
});
```

### First Contract Creation

```typescript
import { LunarDollar, TemplateIds } from "./lunar-dollar-api";

const cmd = LunarDollar.create({
  instrumentKey: {
    depository: "bank::1220...",
    issuer: "bank::1220...",
    id: { unpack: "USD" },
    version: "1",
    holdingStandard: "TransferableFungible",
  },
});

const contractId = await ledger.create(cmd.templateId, cmd.argument);
```

---

## Templates Reference

### LunarDollar

Template ID: `lunar-dollar:LunarDollar:LunarDollar`

#### Payload

```typescript
interface Payload {
  instrumentKey: InstrumentKey;
}
```

#### create()

```typescript
import { LunarDollar } from "./lunar-dollar-api";

const cmd = LunarDollar.create({
  instrumentKey: {
    depository: "bank::1220...",
    issuer: "bank::1220...",
    id: { unpack: "USD" },
    version: "1",
    holdingStandard: "TransferableFungible",
  },
});
```

#### mint()

Mint new Lunar Dollars to a recipient account.

```typescript
const mintCmd = LunarDollar.mint(lunarDollarCid, {
  amount: "1000.0",
  recipientAccount: {
    custodian: "bank::1220...",
    owner: "alice::1220...",
    id: { unpack: "alice-account" },
  },
});

await ledger.exercise(
  mintCmd.templateId,
  lunarDollarCid,
  mintCmd.choice!,
  mintCmd.argument
);
```

#### merge()

Merge multiple holdings into one.

```typescript
const mergeCmd = LunarDollar.merge(lunarDollarCid, {
  owner: "alice::1220...",
  holdingCids: [holdingCid1, holdingCid2],
});
```

---

### PaymentReceiver

Template ID: `lunar-dollar:PaymentReceiver:PaymentReceiver`

Used for X.402 payment protocol integration.

#### Payload

```typescript
interface Payload {
  receiver: Party;
  receiverAccount: AccountKey;
  instrumentKey: InstrumentKey;
  prices: DamlMap<string, Numeric>; // resource -> price mapping
  publicParty: Party;
}
```

#### create()

```typescript
import { PaymentReceiver } from "./lunar-dollar-api";

const cmd = PaymentReceiver.create({
  receiver: "merchant::1220...",
  receiverAccount: {
    custodian: "bank::1220...",
    owner: "merchant::1220...",
    id: { unpack: "merchant-account" },
  },
  instrumentKey: lunarDollarInstrument,
  prices: [
    ["api/premium", "10.0"],
    ["api/basic", "1.0"],
  ],
  publicParty: "public::1220...",
});
```

#### pay()

Execute a payment for resource access.

```typescript
const payCmd = PaymentReceiver.pay(receiverCid, {
  payer: "alice::1220...",
  sessionId: "session-123",
  resource: "api/premium",
  maxPrice: "10.0",
  holdingCid: aliceHoldingCid,
});
```

---

### PaymentReceiver_AccessGrant

Template ID: `lunar-dollar:PaymentReceiver:AccessGrant`

Created when a payment is processed; grants access to a resource.

#### Payload

```typescript
interface Payload {
  receiver: Party;
  payer: Party;
  resource: string;
  sessionId: string;
  grantedAt: Time;
}
```

#### consumeAccess()

Consume the access grant.

```typescript
const consumeCmd = PaymentReceiver_AccessGrant.consumeAccess(grantCid, {});
```

---

### TransferRequest

Template ID: `lunar-dollar:TransferRequest:TransferRequest`

Request to transfer holdings between accounts.

#### Payload

```typescript
interface Payload {
  receiverAccount: AccountKey;
  instrument: InstrumentKey;
  amount: Numeric;
  currentOwner: Party;
}
```

#### create()

```typescript
import { TransferRequest } from "./lunar-dollar-api";

const cmd = TransferRequest.create({
  receiverAccount: {
    custodian: "bank::1220...",
    owner: "bob::1220...",
    id: { unpack: "bob-account" },
  },
  instrument: lunarDollarInstrument,
  amount: "100.0",
  currentOwner: "alice::1220...",
});
```

#### accept()

Accept the transfer request.

```typescript
const acceptCmd = TransferRequest.accept(requestCid, {
  holdingCid: aliceHoldingCid,
});
```

#### decline()

Decline the transfer request.

```typescript
const declineCmd = TransferRequest.decline(requestCid, {});
```

#### withdraw()

Withdraw (cancel) the transfer request.

```typescript
const withdrawCmd = TransferRequest.withdraw(requestCid, {});
```

---

### Workflow_CreateAccount_Request

Template ID: `lunar-dollar:Workflow.CreateAccount:Request`

Request workflow for creating new accounts.

#### Payload

```typescript
interface Payload {
  custodian: Party;
  owner: Party;
}
```

#### create()

```typescript
import { Workflow_CreateAccount_Request } from "./lunar-dollar-api";

const cmd = Workflow_CreateAccount_Request.create({
  custodian: "bank::1220...",
  owner: "alice::1220...",
});
```

#### accept()

Accept and create the account.

```typescript
const acceptCmd = Workflow_CreateAccount_Request.accept(requestCid, {
  label: "alice-main",
  description: "Alice main account",
  accountFactoryCid: factoryCid,
  holdingFactory: {
    provider: "bank::1220...",
    id: { unpack: "holding-factory" },
  },
  observers: ["public::1220..."],
});
```

---

### Workflow_CreditAccount_Request

Template ID: `lunar-dollar:Workflow.CreditAccount:Request`

Request workflow for crediting accounts.

#### Payload

```typescript
interface Payload {
  account: AccountKey;
  instrument: InstrumentKey;
  amount: Numeric;
}
```

#### create()

```typescript
import { Workflow_CreditAccount_Request } from "./lunar-dollar-api";

const cmd = Workflow_CreditAccount_Request.create({
  account: {
    custodian: "bank::1220...",
    owner: "alice::1220...",
    id: { unpack: "alice-account" },
  },
  instrument: lunarDollarInstrument,
  amount: "500.0",
});
```

---

## Queries

Use the `Query` namespace for type-safe contract queries.

```typescript
import { Query } from "./lunar-dollar-api";

// Query all LunarDollar contracts
const spec = Query.lunarDollar();
const contracts = await ledger.query(spec.templateId, spec.filter);

// Query with filters
const filteredSpec = Query.paymentReceiver({
  receiver: "merchant::1220...",
});
const merchantReceivers = await ledger.query(
  filteredSpec.templateId,
  filteredSpec.filter
);

// Query transfer requests for a specific owner
const transferSpec = Query.transferRequest({
  currentOwner: "alice::1220...",
});
```

---

## Error Handling

### LedgerError Types

```typescript
import { LedgerError, isLedgerError, withRetry } from "./ledger";

try {
  await ledger.create(templateId, payload);
} catch (error) {
  if (isLedgerError(error)) {
    console.error(`[${error.code}] ${error.message}`);
    // error.code: 'NOT_FOUND' | 'INVALID_ARGUMENT' | 'ALREADY_EXISTS' | etc.
  }
}
```

### Retry Helper

```typescript
import { withRetry, createRetryClient } from "./ledger";

// Retry individual operations
const result = await withRetry(() => ledger.create(templateId, payload), {
  maxRetries: 3,
  delayMs: 1000,
});

// Or create a retry-enabled client
const retryLedger = createRetryClient(ledger, { maxRetries: 3 });
```

---

## React Integration

### Provider Setup

```tsx
import { CantonProvider } from "./react";

function App() {
  return (
    <CantonProvider
      config={{ ledgerUrl: "http://localhost:7575" }}
      party="alice::1220..."
    >
      <YourApp />
    </CantonProvider>
  );
}
```

### Query Hooks

```tsx
import {
  useLunarDollars,
  usePaymentReceivers,
  useTransferRequests,
} from "./react";

function Dashboard() {
  const { data: lunarDollars, isLoading } = useLunarDollars();
  const { data: receivers } = usePaymentReceivers({ receiver: party });
  const { data: requests } = useTransferRequests({ currentOwner: party });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <h2>Lunar Dollar Contracts: {lunarDollars?.length}</h2>
      <h2>Payment Receivers: {receivers?.length}</h2>
      <h2>Transfer Requests: {requests?.length}</h2>
    </div>
  );
}
```

### Mutation Hooks

```tsx
import {
  useCreateLunarDollar,
  useMintLunarDollar,
  usePayPaymentReceiver,
  useCreateTransferRequest,
  useAcceptTransferRequest,
} from "./react";

function MintForm() {
  const mintMutation = useMintLunarDollar();

  const handleMint = async () => {
    await mintMutation.mutateAsync({
      contractId: lunarDollarCid,
      args: {
        amount: "1000.0",
        recipientAccount: accountKey,
      },
    });
  };

  return (
    <button onClick={handleMint} disabled={mintMutation.isPending}>
      {mintMutation.isPending ? "Minting..." : "Mint"}
    </button>
  );
}
```

### Grouped Actions

```tsx
import { useLunarDollarActions, useTransferRequestActions } from './react';

function ContractActions({ contractId }) {
  const { mint, merge } = useLunarDollarActions();
  const { accept, decline, withdraw } = useTransferRequestActions();

  return (
    <div>
      <button onClick={() => mint.mutate({ contractId, args: { ... } })}>Mint</button>
      <button onClick={() => merge.mutate({ contractId, args: { ... } })}>Merge</button>
    </div>
  );
}
```

---

## Utilities

### Amount Utilities

```typescript
import {
  normalizeAmount,
  formatAmount,
  addAmounts,
  subtractAmounts,
} from "./utils";

const normalized = normalizeAmount("100.5"); // '100.5'
const formatted = formatAmount("1000.00", 2); // '1,000.00'
const sum = addAmounts("100.0", "50.5"); // '150.5'
```

### ID/Key Factories

```typescript
import {
  createAccountKey,
  createInstrumentKey,
  createHoldingFactoryKey,
} from "./utils";

const accountKey = createAccountKey(
  "bank::1220...",
  "alice::1220...",
  "alice-main"
);
const instrumentKey = createInstrumentKey(
  "bank::1220...",
  "bank::1220...",
  "USD",
  "1"
);
```

### Date/Time Helpers

```typescript
import { toCantonTime, nowAsCantonTime, fromCantonTime } from "./utils";

const cantonTime = toCantonTime(new Date());
const now = nowAsCantonTime();
const jsDate = fromCantonTime(cantonTime);
```

### Daml Map Helpers

```typescript
import {
  damlMapToRecord,
  recordToDamlMap,
  damlMapGet,
  damlMapSet,
} from "./utils";

const record = damlMapToRecord(damlMap); // { key1: value1, key2: value2 }
const map = recordToDamlMap({ key: "value" }); // [['key', 'value']]
const value = damlMapGet(damlMap, "key");
```

---

## Mock Factories (Testing)

```typescript
import { MockFactories } from "./lunar-dollar-api";

const party = MockFactories.party("alice"); // 'alice::1220abc123'
const id = MockFactories.id("account"); // { unpack: 'account-1234567890' }
const accountKey = MockFactories.accountKey(custodian, owner, "acc-1");
const instrumentKey = MockFactories.instrumentKey(
  depository,
  issuer,
  "USD",
  "1"
);
const quantity = MockFactories.quantity(instrumentKey, "1000.0");
```

---

## Type Guards

```typescript
import { TypeGuards } from "./lunar-dollar-api";

if (TypeGuards.isLunarDollar(contract)) {
  // contract is typed as Contract<LunarDollar.Payload>
}

if (TypeGuards.isTransferRequest(contract)) {
  // contract is typed as Contract<TransferRequest.Payload>
}
```
