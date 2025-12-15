# Vault Architecture: Config vs State Pattern

## 1. DAML Contract Lifecycle

```mermaid
flowchart LR
    subgraph Lifecycle["Contract Lifecycle"]
        A[CREATE] --> B["Contract A<br/>(active)"]
        B --> C[EXERCISE<br/>choice]
        C --> D["Contract A'<br/>(new version)"]
        D --> E[ARCHIVE<br/>original]
    end

    style B fill:#90EE90
    style D fill:#90EE90
    style E fill:#FFB6C1
```

> Contract A is **ARCHIVED**, Contract A' is **CREATED** - they have different ContractIds

---

## 2. Config vs State Separation

```mermaid
flowchart TB
    subgraph Config["VaultConfig (IMMUTABLE)"]
        C1[operator]
        C2[custodian]
        C3[depositInstrument]
        C4[shareInstrument]
        C5[treasuryAccount]
        C6[minDepositAmount]
        C7[baseFee]
    end

    subgraph State["VaultState (MUTABLE)"]
        S1["totalAssets (NAV)"]
        S2[totalShares]
        S3[configCid]
    end

    State -->|references| Config

    style Config fill:#E8F5E9
    style State fill:#FFF3E0
```

| Property | VaultConfig | VaultState |
|----------|-------------|------------|
| Lifecycle | Created once | Archived & recreated on every mutation |
| Changes | Rarely | Frequently |
| Reference | By ContractId | Query for current active |

---

## 3. Contract Relationships

```mermaid
flowchart TB
    subgraph ConfigLayer["Configuration Layer"]
        VC["VaultConfig<br/>(config-001)<br/>───────────<br/>operator: Vault<br/>custodian: Bank<br/>shareInstrument<br/>treasuryAccount"]
    end

    subgraph StateLayer["State Layer"]
        VS["VaultState<br/>(state-042)<br/>───────────<br/>totalAssets: $1M<br/>totalShares: 1M<br/>configCid"]
    end

    subgraph WorkflowLayer["Workflow Layer"]
        DR["DepositRequest<br/>───────────<br/>depositor<br/>amount<br/>operator"]
        RR["RedeemRequest<br/>───────────<br/>redeemer<br/>shares<br/>operator"]
    end

    VS -->|"configCid"| VC
    DR -->|"references"| VC
    RR -->|"references"| VC
    DR -.->|"uses"| VS
    RR -.->|"uses"| VS

    style ConfigLayer fill:#E3F2FD
    style StateLayer fill:#FFF8E1
    style WorkflowLayer fill:#F3E5F5
```

---

## 4. Deposit Flow

```mermaid
sequenceDiagram
    autonumber
    participant Alice as Alice (User)
    participant DR as DepositRequest
    participant Op as Operator
    participant VS as VaultState
    participant VC as VaultConfig
    participant Acc as Account

    Alice->>DR: createCmd DepositRequest<br/>(amount: 1000 USDC)
    Note over DR: req-001 created

    Op->>DR: exerciseCmd Accept<br/>(fetches current state by key)

    rect rgb(240, 248, 255)
        Note over DR,Acc: Inside Accept choice
        DR->>VC: fetch config by key (operator, vaultId)
        DR->>VS: fetch current state by key (operator, vaultId)
        Note over DR: Calculate shares:<br/>sharePrice = totalShares == 0 ? 1 : totalAssets/totalShares<br/>sharesToMint = amount/sharePrice
        DR->>Acc: Transfer USDC to treasury
        DR->>Acc: Credit shares to Alice
        DR->>VS: exercise ProcessDeposit
    end

    VS-->>VS: Archive state-042<br/>Create state-043 (consuming choice)
    Note over VS: totalAssets += 1000<br/>totalShares += sharesToMint

    DR-->>Alice: Return shareHoldingCid
    Note over DR: req-001 archived
```

---

## 5. State Evolution Timeline (current code)

```mermaid
flowchart LR
    subgraph T0["T0: Initial"]
        S1["state-001<br/>───────<br/>assets: $0<br/>shares: 0"]
    end

    subgraph T1["T1: Alice deposits $1000"]
        S2["state-002<br/>───────<br/>assets: $1000<br/>shares: 1000"]
    end

    subgraph T2["T2: Bob deposits $550"]
        S3["state-003<br/>───────<br/>assets: $1550<br/>shares: 1550"]
    end

    subgraph T3["T3: Alice redeems 500 shares"]
        S4["state-004<br/>───────<br/>assets: $1050<br/>shares: 1050"]
    end

    S1 -->|"archive"| S2
    S2 -->|"archive"| S3
    S3 -->|"archive"| S4

    style S1 fill:#FFB6C1
    style S2 fill:#FFB6C1
    style S3 fill:#FFB6C1
    style S4 fill:#90EE90
```

> Only **state-005** is active. Previous states are archived (ledger history).

---

## 6. Race Condition Scenario (Without Proper Handling)

```mermaid
sequenceDiagram
    autonumber
    participant Alice
    participant Bob
    participant Op as Operator
    participant DR as DepositRequest
    participant VS as VaultState

    Note over VS: state-042 (active)

    Alice->>Op: DepositRequest (req-A)
    Bob->>Op: DepositRequest (req-B)

    rect rgb(144, 238, 144)
        Note over Op,VS: Process Alice's Deposit
        Op->>VS: fetch state-042
        Op->>VS: exercise ProcessDeposit
        VS-->>VS: Archive state-042<br/>Create state-043
        Note over Op: ✓ SUCCESS
    end

    rect rgb(255, 182, 193)
        Note over Op,VS: Process Bob's Deposit (WRONG WAY)
        Op->>VS: fetch state-042
        Note over VS: state-042 ARCHIVED!
        VS--xOp: ERROR: ContractNotFound
        Note over Op: ✗ FAILED
    end
```

---

## 7. Concurrent Deposits (Correct Handling)

```mermaid
sequenceDiagram
    autonumber
    participant Alice
    participant Bob
    participant Op as Operator
    participant DR as DepositRequest
    participant VS as VaultState

    Note over VS: state-042 (active)

    Alice->>Op: DepositRequest (req-A)
    Bob->>Op: DepositRequest (req-B)

    rect rgb(144, 238, 144)
        Note over Op,VS: Process Alice's Deposit
        Op->>DR: exercise Accept<br/>(fetch current state by key)
        DR->>VS: fetch current state (operator, vaultId)
        DR->>VS: exercise ProcessDeposit
        VS-->>VS: Archive state-042<br/>Create state-043
        Note over Op: ✓ Alice SUCCESS
    end

    rect rgb(144, 238, 144)
        Note over Op,VS: Process Bob's Deposit (CORRECT)
        Op->>DR: exercise Accept<br/>(fetch current state by key)
        DR->>VS: fetch current state (operator, vaultId)
        Note over Op: Found: state-043 (NEW!)
        DR->>VS: exercise ProcessDeposit
        VS-->>VS: Archive state-043<br/>Create state-044
        Note over Op: ✓ Bob SUCCESS<br/>(correct price!)
    end
```

> **Key**: Always query for CURRENT state inside the choice, never cache stale ContractIds.

---

## 8. Complete Vault Architecture

```mermaid
flowchart TB
    subgraph ConfigLayer["CONFIGURATION LAYER (Created Once)"]
        VC["VaultConfig<br/>─────────────<br/>• operator<br/>• custodian<br/>• depositInstrument<br/>• shareInstrument<br/>• treasuryAccount<br/>• minDepositAmount<br/>• baseFee"]

        USDC["USDC Token<br/>(deposit asset)"]
        SHARE["VAULT-SHARE<br/>(share token)"]

        VC -->|depositInstr| USDC
        VC -->|shareInstr| SHARE
    end

    subgraph StateLayer["STATE LAYER (Archives on Change)"]
        VS["VaultState<br/>─────────────<br/>• totalAssets (NAV)<br/>• totalShares<br/>• configCid"]

        PD["ProcessDeposit"]
        PR["ProcessRedemption"]

        VS --- PD
        VS --- PR
    end

    subgraph WorkflowLayer["WORKFLOW LAYER (User Requests)"]
        DEP["DepositRequest<br/>─────────────<br/>• Accept<br/>• Decline<br/>• Cancel"]

        RED["RedeemRequest<br/>─────────────<br/>• Accept<br/>• Decline<br/>• Cancel"]
    end

    subgraph HoldingLayer["HOLDING LAYER (Asset Ownership)"]
        TREAS["Treasury Account<br/>(Vault@Bank)<br/>─────────────<br/>Holdings:<br/>• $1,000,000 USDC"]

        ALICE["Alice@Bank<br/>─────────────<br/>Holdings:<br/>• 1000 USDC<br/>• 500 VAULT-SHARE"]

        BOB["Bob@Bank<br/>─────────────<br/>Holdings:<br/>• 300 VAULT-SHARE"]
    end

    VS -->|configCid| VC
    DEP -->|references| VC
    RED -->|references| VC
    DEP -.->|calls| PD
    RED -.->|calls| PR

    style ConfigLayer fill:#E3F2FD
    style StateLayer fill:#FFF8E1
    style WorkflowLayer fill:#F3E5F5
    style HoldingLayer fill:#E8F5E9
```

---

## 9. Summary Table

| Aspect | VaultConfig | VaultState |
|--------|-------------|------------|
| **Changes** | Rarely (upgrade scenarios) | Every deposit/redeem |
| **ContractId** | Stable, can be stored | Changes constantly |
| **Signatories** | operator, custodian | operator, custodian |
| **Purpose** | "What is this vault?" | "What is the vault's current position?" |
| **Referenced By** | VaultState, all Requests | Current operations only |
| **Archive Frequency** | Almost never | Very frequently |
| **Query Pattern** | By key or stored ContractId | Always query for CURRENT active |

---

## Key Insight

> **Config is the vault's identity. State is the vault's balance sheet.**
>
> You wouldn't change a fund's legal structure (config) every time someone deposits.
> But you do update the vault's state as deposits and redemptions occur.
