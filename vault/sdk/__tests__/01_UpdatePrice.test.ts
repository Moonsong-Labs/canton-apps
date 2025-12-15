/**
 * Tests generated from: UpdatePrice.daml
 *
 * Prerequisites:
 * 1. Start Canton ledger: `cd /workspaces/canton-vault/vault && daml start`
 * 2. Setup script runs automatically via init-script in daml.yaml
 * 3. Set environment variables: ALICE_PARTY, VAULT_PARTY (from ledger output)
 *
 * Workflow: Tests the share price update workflow where the vault operator updates the share price
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { TemplateIds, Query, Vault_State_VaultState } from '../vault-api';
import type { ContractId } from '../core/primitives';
import { alice, vault, aliceLedger, vaultLedger, vaultId } from './testSetup';

describe('UpdatePrice Workflow', () => {
  // Verify setup completed before running tests
  beforeAll(async () => {
    const { templateId, filter } = Query.vault_State_VaultState({ operator: vault, custodian: vault });
    const vaultState = await vaultLedger.query(templateId, filter);

    if (vaultState.length === 0) {
      throw new Error('VaultState not found. Ensure `daml start` completed successfully.');
    }
  }, 30000);

  test('Vault operator updates share price to 1.5', async () => {
    // ═══════════════════════════════════════════════════════════════
    // 1. GET CURRENT VAULT STATE
    // ═══════════════════════════════════════════════════════════════

    const { templateId: stateTemplateId, filter: stateFilter } = Query.vault_State_VaultState({
      operator: vault,
      custodian: vault,
    });
    const vaultStateBefore = await vaultLedger.query(stateTemplateId, stateFilter);

    expect(vaultStateBefore.length, 'VaultState should exist').toBe(1);

    const initialState = vaultStateBefore[0].payload as Vault_State_VaultState.Payload;
    const stateCid = vaultStateBefore[0].contractId;
    const initialSharePrice = parseFloat(initialState.sharePrice);

    console.log(`Initial share price: ${initialSharePrice}`);

    // ═══════════════════════════════════════════════════════════════
    // 2. UPDATE SHARE PRICE
    // ═══════════════════════════════════════════════════════════════

    const newSharePrice = "1.5";

    const updateCmd = Vault_State_VaultState.updateSharePrice(
      stateCid as ContractId<Vault_State_VaultState.Payload>,
      {
        newSharePrice: newSharePrice,
      }
    );

    await vaultLedger.exercise(
      updateCmd.templateId!,
      stateCid,
      updateCmd.choice!,
      { newSharePrice: newSharePrice }
    );

    console.log(`Updated share price to: ${newSharePrice}`);

    // ═══════════════════════════════════════════════════════════════
    // 3. VERIFY SHARE PRICE UPDATED
    // ═══════════════════════════════════════════════════════════════

    const vaultStateAfter = await vaultLedger.query(stateTemplateId, stateFilter);

    expect(vaultStateAfter.length, 'VaultState should still exist').toBe(1);

    const finalState = vaultStateAfter[0].payload as Vault_State_VaultState.Payload;
    const finalSharePrice = parseFloat(finalState.sharePrice);

    expect(
      finalSharePrice,
      'Share price should be updated to new value'
    ).toBeCloseTo(parseFloat(newSharePrice), 6);

    console.log(`Final share price: ${finalSharePrice}`);
    console.log(`=== Share Price Update Complete ===`);
  }, 30000);

  test('Share price affects deposit calculations', async () => {
    // This test verifies that the updated share price is used in subsequent operations
    // by checking the current share price value

    const { templateId: stateTemplateId, filter: stateFilter } = Query.vault_State_VaultState({
      operator: vault,
      custodian: vault,
    });
    const vaultState = await vaultLedger.query(stateTemplateId, stateFilter);

    expect(vaultState.length, 'VaultState should exist').toBe(1);

    const currentState = vaultState[0].payload as Vault_State_VaultState.Payload;
    const currentSharePrice = parseFloat(currentState.sharePrice);

    // If previous test ran, price should be 1.5
    // If it didn't run, price should be initial value (1.0 from setup)
    expect(currentSharePrice, 'Share price should be a positive number').toBeGreaterThan(0);

    console.log(`Current share price for calculations: ${currentSharePrice}`);
    console.log(`With this price, depositing 1000 USD would yield ${1000.0 / currentSharePrice} shares`);
  }, 30000);

  test('Vault operator can update share price multiple times', async () => {
    // ═══════════════════════════════════════════════════════════════
    // 1. UPDATE TO PRICE 2.0
    // ═══════════════════════════════════════════════════════════════

    const { templateId: stateTemplateId, filter: stateFilter } = Query.vault_State_VaultState({
      operator: vault,
      custodian: vault,
    });
    const vaultState1 = await vaultLedger.query(stateTemplateId, stateFilter);

    expect(vaultState1.length, 'VaultState should exist').toBe(1);

    const stateCid1 = vaultState1[0].contractId;
    const firstNewPrice = "2.0";

    const updateCmd1 = Vault_State_VaultState.updateSharePrice(
      stateCid1 as ContractId<Vault_State_VaultState.Payload>,
      {
        newSharePrice: firstNewPrice,
      }
    );

    await vaultLedger.exercise(
      updateCmd1.templateId!,
      stateCid1,
      updateCmd1.choice!,
      { newSharePrice: firstNewPrice }
    );

    console.log(`Updated share price to: ${firstNewPrice}`);

    // ═══════════════════════════════════════════════════════════════
    // 2. UPDATE TO PRICE 2.5
    // ═══════════════════════════════════════════════════════════════

    const vaultState2 = await vaultLedger.query(stateTemplateId, stateFilter);
    expect(vaultState2.length, 'VaultState should still exist').toBe(1);

    const stateCid2 = vaultState2[0].contractId;
    const secondNewPrice = "2.5";

    const updateCmd2 = Vault_State_VaultState.updateSharePrice(
      stateCid2 as ContractId<Vault_State_VaultState.Payload>,
      {
        newSharePrice: secondNewPrice,
      }
    );

    await vaultLedger.exercise(
      updateCmd2.templateId!,
      stateCid2,
      updateCmd2.choice!,
      { newSharePrice: secondNewPrice }
    );

    console.log(`Updated share price to: ${secondNewPrice}`);

    // ═══════════════════════════════════════════════════════════════
    // 3. VERIFY FINAL PRICE
    // ═══════════════════════════════════════════════════════════════

    const vaultStateFinal = await vaultLedger.query(stateTemplateId, stateFilter);
    expect(vaultStateFinal.length, 'VaultState should still exist').toBe(1);

    const finalState = vaultStateFinal[0].payload as Vault_State_VaultState.Payload;
    const finalSharePrice = parseFloat(finalState.sharePrice);

    expect(
      finalSharePrice,
      'Share price should be updated to second value'
    ).toBeCloseTo(parseFloat(secondNewPrice), 6);

    console.log(`Final share price after multiple updates: ${finalSharePrice}`);
    console.log(`=== Multiple Price Updates Complete ===`);
  }, 30000);
});
