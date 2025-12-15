/**
 * Test Setup - Replicates Scripts/Setup.daml logic for TypeScript tests
 *
 * This setup file creates the initial ledger state required for vault tests:
 * - Parties: Alice (user), Vault (operator/custodian)
 * - Factories: Account, Holding, Token
 * - Instruments: USD (deposit token), VAULT-SHARE (share token)
 * - Accounts: Alice's account, Treasury account
 * - Initial balances: Alice has 1,000 USD, Treasury has 10,000 USD
 * - Vault config and state
 */

import { beforeAll } from 'vitest';
import {
  TemplateIds,
  Query,
  Account_Account_Factory,
  Holding_Factory,
  Holding_Factory_Reference,
  Token_Factory,
  Token_Instrument,
  Workflow_CreateAccount_Request,
  Workflow_CreditAccount_Request,
  Vault_Config_VaultConfig,
  Vault_State_VaultState,
} from '../vault-api';
import type { Party, ContractId, Numeric, DamlMap } from '../core/primitives';
import type { AccountKey, InstrumentKey, HoldingFactoryKey, Id } from '../core/interfaces';
import { createLedgerClient, type CantonLedgerClient } from '../ledger';

// ═══════════════════════════════════════════════════════════════
// PARTY CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export const alice = process.env.ALICE_PARTY as Party;
export const vault = process.env.VAULT_PARTY as Party;

if (!alice || !vault) {
  throw new Error('ALICE_PARTY and VAULT_PARTY environment variables are required');
}

// ═══════════════════════════════════════════════════════════════
// LEDGER CLIENTS
// ═══════════════════════════════════════════════════════════════

export const aliceLedger = createLedgerClient(alice);
export const vaultLedger = createLedgerClient(vault);

// ═══════════════════════════════════════════════════════════════
// CONSTANTS FROM SETUP.DAML
// ═══════════════════════════════════════════════════════════════

// Vault configuration (must match Setup.daml exactly)
export const vaultId: Id = { unpack: "vault-101" };
export const minDepositAmount: Numeric = "100.0";
export const baseFee: Numeric = "0.01";
export const aliceInitialBalance: Numeric = "1000.0";
export const treasuryInitialFunding: Numeric = "10000.0";

// Keys and contract IDs (populated during setup)
export let aliceAccount: AccountKey;
export let treasuryAccount: AccountKey;
export let depositInstrument: InstrumentKey;
export let shareInstrument: InstrumentKey;
export let vaultConfigCid: ContractId<Vault_Config_VaultConfig.Payload>;

// Query-safe instrument filters (without holdingStandard - JSON API can't filter by variant types)
export let depositInstrumentFilter: Omit<InstrumentKey, 'holdingStandard'>;
export let shareInstrumentFilter: Omit<InstrumentKey, 'holdingStandard'>;

// ═══════════════════════════════════════════════════════════════
// SETUP LOGIC
// ═══════════════════════════════════════════════════════════════

beforeAll(async () => {
  // Check if setup already ran by querying for VaultState
  const vaultStateSpec = Query.vault_State_VaultState({ operator: vault, custodian: vault });
  const existingState = await vaultLedger.query(vaultStateSpec.templateId, vaultStateSpec.filter);

  if (existingState.length > 0) {
    console.log('Setup already completed, reusing existing contracts');

    // Populate exported values from existing contracts
    const vaultState = existingState[0].payload as Vault_State_VaultState.Payload;
    vaultConfigCid = vaultState.configCid;

    // Query for accounts
    const aliceAccountSpec = Query.account({
      custodian: vault,
      owner: alice
    });
    const aliceAccounts = await aliceLedger.query(aliceAccountSpec.templateId, aliceAccountSpec.filter);
    if (aliceAccounts.length > 0) {
      const aliceAccountContract = aliceAccounts[0].payload as any;
      aliceAccount = {
        custodian: aliceAccountContract.custodian,
        owner: aliceAccountContract.owner,
        id: aliceAccountContract.id
      };
    }

    const treasuryAccountSpec = Query.account({
      custodian: vault,
      owner: vault
    });
    const treasuryAccounts = await vaultLedger.query(treasuryAccountSpec.templateId, treasuryAccountSpec.filter);
    if (treasuryAccounts.length > 0) {
      const treasuryAccountContract = treasuryAccounts[0].payload as any;
      treasuryAccount = {
        custodian: treasuryAccountContract.custodian,
        owner: treasuryAccountContract.owner,
        id: treasuryAccountContract.id
      };
    }

    // Set up instrument keys (holdingStandard is an enum - use string format for JSON API)
    depositInstrument = {
      issuer: vault,
      depository: vault,
      id: { unpack: "USD" },
      version: "0",
      holdingStandard: "TransferableFungible" as any
    };

    shareInstrument = {
      issuer: vault,
      depository: vault,
      id: { unpack: "VAULT-SHARE" },
      version: "0",
      holdingStandard: "TransferableFungible" as any
    };

    // Query-safe versions (without holdingStandard for JSON API compatibility)
    depositInstrumentFilter = {
      issuer: vault,
      depository: vault,
      id: { unpack: "USD" },
      version: "0"
    };

    shareInstrumentFilter = {
      issuer: vault,
      depository: vault,
      id: { unpack: "VAULT-SHARE" },
      version: "0"
    };

    // Check if Alice needs to be re-funded
    // Note: Can't filter by holdingStandard (variant type) so use partial instrument filter
    const aliceHoldingsSpec = Query.holding_TransferableFungible({
      account: aliceAccount,
      instrument: {
        issuer: vault,
        depository: vault,
        id: { unpack: "USD" },
        version: "0"
      } as any
    });
    const aliceHoldings = await aliceLedger.query(aliceHoldingsSpec.templateId, aliceHoldingsSpec.filter);

    if (aliceHoldings.length === 0 || parseFloat((aliceHoldings[0].payload as any).amount) < 100.0) {
      console.log('Re-funding Alice account...');

      // Credit Alice with initial balance again
      const creditCmd = Workflow_CreditAccount_Request.create({
        account: aliceAccount,
        instrument: depositInstrument,
        amount: aliceInitialBalance
      });
      const creditRequestCid = await aliceLedger.create(creditCmd.templateId, creditCmd.argument);

      await vaultLedger.exercise(
        TemplateIds.Workflow_CreditAccount_Request,
        creditRequestCid,
        'Accept',
        {}
      );
    }

    return;
  }

  console.log('Running ledger setup...');

  // ═══════════════════════════════════════════════════════════════
  // 1. CREATE FACTORIES
  // ═══════════════════════════════════════════════════════════════

  // Create Account Factory
  const accountFactoryCmd = Account_Account_Factory.create({
    provider: vault,
    observers: [] as DamlMap<string, Party[]>
  });
  const accountFactoryCid = await vaultLedger.create(
    accountFactoryCmd.templateId,
    accountFactoryCmd.argument
  );

  // Create Holding Factory
  const holdingFactoryCmd = Holding_Factory.create({
    provider: vault,
    id: { unpack: "Holding Factory" },
    observers: [] as DamlMap<string, Party[]>
  });
  const holdingFactoryCid = await vaultLedger.create(
    holdingFactoryCmd.templateId,
    holdingFactoryCmd.argument
  );

  // Create Holding Factory Reference (required for account creation)
  const holdingFactoryKey: HoldingFactoryKey = {
    provider: vault,
    id: { unpack: "Holding Factory" }
  };

  const holdingFactoryRefCmd = Holding_Factory_Reference.create({
    factoryView: holdingFactoryKey as any,
    cid: holdingFactoryCid as any,
    observers: [] as DamlMap<string, Party[]>
  });
  await vaultLedger.create(
    holdingFactoryRefCmd.templateId,
    holdingFactoryRefCmd.argument
  );

  // Create Token Factory
  const tokenFactoryCmd = Token_Factory.create({
    provider: vault,
    observers: [] as DamlMap<string, Party[]>
  });
  const tokenFactoryCid = await vaultLedger.create(
    tokenFactoryCmd.templateId,
    tokenFactoryCmd.argument
  );

  // ═══════════════════════════════════════════════════════════════
  // 2. CREATE INSTRUMENTS
  // ═══════════════════════════════════════════════════════════════

  // USD Stablecoin (deposit instrument) - holdingStandard is an enum, use string format
  depositInstrument = {
    issuer: vault,
    depository: vault,
    id: { unpack: "USD" },
    version: "0",
    holdingStandard: "TransferableFungible" as any
  };

  depositInstrumentFilter = {
    issuer: vault,
    depository: vault,
    id: { unpack: "USD" },
    version: "0"
  };

  const usdTokenCmd = Token_Instrument.create({
    depository: vault,
    issuer: vault,
    id: { unpack: "USD" },
    version: "0",
    holdingStandard: "TransferableFungible" as any,
    description: "USD Stablecoin",
    validAsOf: new Date().toISOString(),
    observers: [] as DamlMap<string, Party[]>
  });
  await vaultLedger.create(usdTokenCmd.templateId, usdTokenCmd.argument);

  // Vault Share Token - holdingStandard is an enum, use string format
  shareInstrument = {
    issuer: vault,
    depository: vault,
    id: { unpack: "VAULT-SHARE" },
    version: "0",
    holdingStandard: "TransferableFungible" as any
  };

  shareInstrumentFilter = {
    issuer: vault,
    depository: vault,
    id: { unpack: "VAULT-SHARE" },
    version: "0"
  };

  const shareTokenCmd = Token_Instrument.create({
    depository: vault,
    issuer: vault,
    id: { unpack: "VAULT-SHARE" },
    version: "0",
    holdingStandard: "TransferableFungible" as any,
    description: "Vault Share Token",
    validAsOf: new Date().toISOString(),
    observers: [] as DamlMap<string, Party[]>
  });
  await vaultLedger.create(shareTokenCmd.templateId, shareTokenCmd.argument);

  // ═══════════════════════════════════════════════════════════════
  // 3. CREATE ACCOUNTS
  // ═══════════════════════════════════════════════════════════════

  // Alice's account
  const aliceRequestCmd = Workflow_CreateAccount_Request.create({
    owner: alice,
    custodian: vault
  });
  const aliceRequestCid = await aliceLedger.create(
    aliceRequestCmd.templateId,
    aliceRequestCmd.argument
  );

  const aliceAcceptCmd = Workflow_CreateAccount_Request.accept(
    aliceRequestCid as ContractId<Workflow_CreateAccount_Request.Payload>,
    {
      label: "Alice@Vault",
      description: "Alice's account at Vault",
      accountFactoryCid: accountFactoryCid,
      holdingFactory: holdingFactoryKey,
      observers: []
    }
  );

  const aliceAccountResult = await vaultLedger.exercise(
    aliceAcceptCmd.templateId!,
    aliceRequestCid,
    aliceAcceptCmd.choice!,
    {
      label: "Alice@Vault",
      description: "Alice's account at Vault",
      accountFactoryCid: accountFactoryCid,
      holdingFactory: holdingFactoryKey,
      observers: []
    }
  );

  aliceAccount = aliceAccountResult.exerciseResult as AccountKey;

  // Treasury account
  const treasuryRequestCmd = Workflow_CreateAccount_Request.create({
    owner: vault,
    custodian: vault
  });
  const treasuryRequestCid = await vaultLedger.create(
    treasuryRequestCmd.templateId,
    treasuryRequestCmd.argument
  );

  const treasuryAcceptCmd = Workflow_CreateAccount_Request.accept(
    treasuryRequestCid as ContractId<Workflow_CreateAccount_Request.Payload>,
    {
      label: "Treasury@Vault",
      description: "Vault Treasury Account",
      accountFactoryCid: accountFactoryCid,
      holdingFactory: holdingFactoryKey,
      observers: [alice]
    }
  );

  const treasuryAccountResult = await vaultLedger.exercise(
    treasuryAcceptCmd.templateId!,
    treasuryRequestCid,
    treasuryAcceptCmd.choice!,
    {
      label: "Treasury@Vault",
      description: "Vault Treasury Account",
      accountFactoryCid: accountFactoryCid,
      holdingFactory: holdingFactoryKey,
      observers: [alice]
    }
  );

  treasuryAccount = treasuryAccountResult.exerciseResult as AccountKey;

  // ═══════════════════════════════════════════════════════════════
  // 4. FUND ACCOUNTS
  // ═══════════════════════════════════════════════════════════════

  // Credit Alice with 1,000 USD
  const aliceCreditCmd = Workflow_CreditAccount_Request.create({
    account: aliceAccount,
    instrument: depositInstrument,
    amount: aliceInitialBalance
  });
  const aliceCreditCid = await aliceLedger.create(
    aliceCreditCmd.templateId,
    aliceCreditCmd.argument
  );

  await vaultLedger.exercise(
    TemplateIds.Workflow_CreditAccount_Request,
    aliceCreditCid,
    'Accept',
    {}
  );

  // Fund treasury with 10,000 USD
  const treasuryCreditCmd = Workflow_CreditAccount_Request.create({
    account: treasuryAccount,
    instrument: depositInstrument,
    amount: treasuryInitialFunding
  });
  const treasuryCreditCid = await vaultLedger.create(
    treasuryCreditCmd.templateId,
    treasuryCreditCmd.argument
  );

  await vaultLedger.exercise(
    TemplateIds.Workflow_CreditAccount_Request,
    treasuryCreditCid,
    'Accept',
    {}
  );

  // ═══════════════════════════════════════════════════════════════
  // 5. CREATE VAULT CONFIG AND STATE
  // ═══════════════════════════════════════════════════════════════

  const vaultConfigCmd = Vault_Config_VaultConfig.create({
    operator: vault,
    custodian: vault,
    vaultId: vaultId,
    name: "Test Vault",
    description: "A test vault for stablecoin deposits",
    depositInstrument: depositInstrument,
    shareInstrument: shareInstrument,
    treasuryAccount: treasuryAccount,
    minDepositAmount: minDepositAmount,
    baseFee: baseFee,
    observers: [alice]
  });
  vaultConfigCid = await vaultLedger.create(
    vaultConfigCmd.templateId,
    vaultConfigCmd.argument
  );

  const vaultStateCmd = Vault_State_VaultState.create({
    operator: vault,
    custodian: vault,
    vaultId: vaultId,
    configCid: vaultConfigCid,
    totalAssets: treasuryInitialFunding,
    totalShares: "0.0",
    sharePrice: "1.0",
    observers: [alice]
  });
  await vaultLedger.create(vaultStateCmd.templateId, vaultStateCmd.argument);

  console.log('Setup complete!');
}, 60000); // 60 second timeout for setup
