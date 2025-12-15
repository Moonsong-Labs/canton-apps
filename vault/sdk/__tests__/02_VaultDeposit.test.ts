/**
 * Tests generated from: VaultDeposit.daml
 *
 * Prerequisites:
 * 1. Start Canton ledger: `cd /workspaces/canton-vault/vault && daml start`
 * 2. Setup script runs automatically via init-script in daml.yaml
 * 3. Set environment variables: ALICE_PARTY, VAULT_PARTY (from ledger output)
 *
 * Workflow: Tests the vault deposit workflow where Alice deposits USD and receives vault shares
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { TemplateIds, Query, Vault_Deposit_DepositRequest, Vault_State_VaultState } from '../vault-api';
import type { ContractId } from '../core/primitives';
import {
  alice,
  vault,
  aliceLedger,
  vaultLedger,
  aliceAccount,
  depositInstrument,
  depositInstrumentFilter,
  vaultId,
} from './testSetup';

describe('VaultDeposit Workflow', () => {
  // Verify setup completed before running tests
  beforeAll(async () => {
    const { templateId, filter } = Query.vault_State_VaultState({ operator: vault, custodian: vault });
    const vaultState = await vaultLedger.query(templateId, filter);

    if (vaultState.length === 0) {
      throw new Error('VaultState not found. Ensure `daml start` completed successfully.');
    }

    // Verify Alice has USD holdings
    const { templateId: holdingTemplateId, filter: holdingFilter } = Query.holding_TransferableFungible({
      account: aliceAccount,
      instrument: depositInstrumentFilter as any,
    });
    const aliceHoldings = await aliceLedger.query(holdingTemplateId, holdingFilter);

    expect(
      aliceHoldings.length,
      'Alice should have USD holdings from setup script'
    ).toBeGreaterThan(0);
  }, 30000);

  test('Alice deposits 500 USD and receives vault shares', async () => {
    // ═══════════════════════════════════════════════════════════════
    // 1. GET ALICE'S USD HOLDING
    // ═══════════════════════════════════════════════════════════════

    const { templateId: holdingTemplateId, filter: holdingFilter } = Query.holding_TransferableFungible({
      account: aliceAccount,
      instrument: depositInstrumentFilter as any,
    });
    const aliceHoldings = await aliceLedger.query(holdingTemplateId, holdingFilter);

    expect(aliceHoldings.length, 'Alice should have at least one USD holding').toBeGreaterThan(0);

    const holdingCid = aliceHoldings[0].contractId;
    const initialHoldingAmount = parseFloat((aliceHoldings[0].payload as any).amount);

    console.log(`Alice's initial USD balance: ${initialHoldingAmount}`);

    // ═══════════════════════════════════════════════════════════════
    // 2. GET INITIAL VAULT STATE
    // ═══════════════════════════════════════════════════════════════

    const { templateId: stateTemplateId, filter: stateFilter } = Query.vault_State_VaultState({
      operator: vault,
      custodian: vault,
    });
    const vaultStateBefore = await vaultLedger.query(stateTemplateId, stateFilter);

    expect(vaultStateBefore.length, 'VaultState should exist').toBe(1);

    const initialState = vaultStateBefore[0].payload as Vault_State_VaultState.Payload;
    const initialTotalAssets = parseFloat(initialState.totalAssets);
    const initialTotalShares = parseFloat(initialState.totalShares);
    const sharePrice = parseFloat(initialState.sharePrice);

    console.log(`Initial vault state - Assets: ${initialTotalAssets}, Shares: ${initialTotalShares}, Price: ${sharePrice}`);

    // ═══════════════════════════════════════════════════════════════
    // 3. CREATE DEPOSIT REQUEST
    // ═══════════════════════════════════════════════════════════════

    const depositAmount = "500.0";

    const depositRequestCmd = Vault_Deposit_DepositRequest.create({
      depositor: alice,
      depositorAccount: aliceAccount,
      operator: vault,
      custodian: vault,
      vaultId: vaultId,
      amount: depositAmount,
      depositHoldingCid: holdingCid as any,
    });

    const depositRequestCid = await aliceLedger.create(
      depositRequestCmd.templateId,
      depositRequestCmd.argument
    );

    console.log(`Created deposit request for ${depositAmount} USD`);

    // ═══════════════════════════════════════════════════════════════
    // 4. VAULT ACCEPTS DEPOSIT
    // ═══════════════════════════════════════════════════════════════

    await vaultLedger.exercise(
      TemplateIds.Vault_Deposit_DepositRequest,
      depositRequestCid,
      'Accept',
      {}
    );

    console.log('Vault accepted deposit');

    // ═══════════════════════════════════════════════════════════════
    // 5. VERIFY RESULTS
    // ═══════════════════════════════════════════════════════════════

    // Calculate expected shares: depositAmount / sharePrice
    const expectedShares = parseFloat(depositAmount) / sharePrice;

    // Verify Alice received vault shares
    const { templateId: shareTemplateId, filter: shareFilter } = Query.holding_TransferableFungible({
      account: aliceAccount,
    });
    const aliceShareHoldings = await aliceLedger.query(shareTemplateId, shareFilter);

    const shareHoldings = aliceShareHoldings.filter((h: any) => {
      const payload = h.payload as any;
      return payload.instrument.id.unpack === "VAULT-SHARE";
    });

    expect(shareHoldings.length, 'Alice should have vault share holdings').toBeGreaterThan(0);

    const totalShares = shareHoldings.reduce((sum: number, h: any) => {
      return sum + parseFloat((h.payload as any).amount);
    }, 0);

    expect(totalShares, 'Alice should receive correct amount of shares').toBeCloseTo(expectedShares, 6);

    console.log(`Alice received ${totalShares} vault shares (expected ${expectedShares})`);

    // Verify vault state updated
    const vaultStateAfter = await vaultLedger.query(stateTemplateId, stateFilter);
    expect(vaultStateAfter.length, 'VaultState should still exist').toBe(1);

    const finalState = vaultStateAfter[0].payload as Vault_State_VaultState.Payload;
    const finalTotalAssets = parseFloat(finalState.totalAssets);
    const finalTotalShares = parseFloat(finalState.totalShares);

    // Total assets should increase by deposit amount
    expect(
      finalTotalAssets,
      'Vault total assets should increase by deposit amount'
    ).toBeCloseTo(initialTotalAssets + parseFloat(depositAmount), 6);

    // Total shares should increase by expected shares
    expect(
      finalTotalShares,
      'Vault total shares should increase by shares issued'
    ).toBeCloseTo(initialTotalShares + expectedShares, 6);

    console.log(`Final vault state - Assets: ${finalTotalAssets}, Shares: ${finalTotalShares}`);
    console.log('=== Deposit Complete ===');
  }, 30000);
});
