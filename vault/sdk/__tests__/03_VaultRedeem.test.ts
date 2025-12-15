/**
 * Tests generated from: VaultRedeem.daml
 *
 * Prerequisites:
 * 1. Start Canton ledger: `cd /workspaces/canton-vault/vault && daml start`
 * 2. Setup script runs automatically via init-script in daml.yaml
 * 3. Set environment variables: ALICE_PARTY, VAULT_PARTY (from ledger output)
 * 4. VaultDeposit test should run first to create shares for Alice
 *
 * Workflow: Tests the vault redemption workflow where Alice redeems vault shares for USD
 */

import { describe, test, expect, beforeAll } from 'vitest';
import {
  TemplateIds,
  Query,
  Vault_Redeem_RedeemRequest,
  Vault_State_VaultState,
  Vault_Config_VaultConfig,
} from '../vault-api';
import type { ContractId } from '../core/primitives';
import {
  alice,
  vault,
  aliceLedger,
  vaultLedger,
  aliceAccount,
  shareInstrument,
  shareInstrumentFilter,
  depositInstrument,
  depositInstrumentFilter,
  vaultId,
} from './testSetup';

describe('VaultRedeem Workflow', () => {
  // Verify setup and deposit completed before running redemption tests
  beforeAll(async () => {
    const { templateId, filter } = Query.vault_State_VaultState({ operator: vault, custodian: vault });
    const vaultState = await vaultLedger.query(templateId, filter);

    if (vaultState.length === 0) {
      throw new Error('VaultState not found. Ensure `daml start` completed successfully.');
    }

    // Verify Alice has share holdings (from deposit)
    const { templateId: shareTemplateId, filter: shareFilter } = Query.holding_TransferableFungible({
      account: aliceAccount,
      instrument: shareInstrumentFilter as any,
    });
    const aliceShareHoldings = await aliceLedger.query(shareTemplateId, shareFilter);

    expect(
      aliceShareHoldings.length,
      'Alice should have vault share holdings from deposit. Run VaultDeposit test first.'
    ).toBeGreaterThan(0);
  }, 30000);

  test('Alice redeems half of her vault shares for USD', async () => {
    // ═══════════════════════════════════════════════════════════════
    // 1. GET ALICE'S SHARE HOLDING
    // ═══════════════════════════════════════════════════════════════

    const { templateId: shareTemplateId, filter: shareFilter } = Query.holding_TransferableFungible({
      account: aliceAccount,
      instrument: shareInstrumentFilter as any,
    });
    const aliceShareHoldings = await aliceLedger.query(shareTemplateId, shareFilter);

    expect(aliceShareHoldings.length, 'Alice should have at least one share holding').toBeGreaterThan(0);

    const shareHoldingCid = aliceShareHoldings[0].contractId;
    const shareHoldingAmount = parseFloat((aliceShareHoldings[0].payload as any).amount);

    console.log(`Alice's share balance: ${shareHoldingAmount}`);

    // ═══════════════════════════════════════════════════════════════
    // 2. GET VAULT STATE AND CONFIG
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

    // Get vault config for fee calculation
    const { templateId: configTemplateId, filter: configFilter } = Query.vault_Config_VaultConfig({
      operator: vault,
      custodian: vault,
    });
    const vaultConfigs = await vaultLedger.query(configTemplateId, configFilter);

    expect(vaultConfigs.length, 'VaultConfig should exist').toBe(1);

    const vaultConfig = vaultConfigs[0].payload as Vault_Config_VaultConfig.Payload;
    const baseFee = parseFloat(vaultConfig.baseFee);

    console.log(`Vault fee: ${baseFee * 100}%`);

    // ═══════════════════════════════════════════════════════════════
    // 3. CREATE REDEEM REQUEST (for half of shares)
    // ═══════════════════════════════════════════════════════════════

    const redeemAmount = (shareHoldingAmount / 2.0).toString();

    const redeemRequestCmd = Vault_Redeem_RedeemRequest.create({
      redeemer: alice,
      redeemerAccount: aliceAccount,
      operator: vault,
      custodian: vault,
      vaultId: vaultId,
      sharesAmount: redeemAmount,
      shareHoldingCid: shareHoldingCid as any,
    });

    const redeemRequestCid = await aliceLedger.create(
      redeemRequestCmd.templateId,
      redeemRequestCmd.argument
    );

    console.log(`Created redeem request for ${redeemAmount} shares`);

    // ═══════════════════════════════════════════════════════════════
    // 4. VAULT ACCEPTS REDEMPTION
    // ═══════════════════════════════════════════════════════════════

    // Get Alice's USD balance before redemption
    const { templateId: usdTemplateId, filter: usdFilter } = Query.holding_TransferableFungible({
      account: aliceAccount,
      instrument: depositInstrumentFilter as any,
    });
    const aliceUsdBefore = await aliceLedger.query(usdTemplateId, usdFilter);

    const initialUsdBalance = aliceUsdBefore.reduce((sum: number, h: any) => {
      return sum + parseFloat((h.payload as any).amount);
    }, 0);

    console.log(`Alice's USD balance before redemption: ${initialUsdBalance}`);

    await vaultLedger.exercise(
      TemplateIds.Vault_Redeem_RedeemRequest,
      redeemRequestCid,
      'Accept',
      {}
    );

    console.log('Vault accepted redemption');

    // ═══════════════════════════════════════════════════════════════
    // 5. VERIFY RESULTS
    // ═══════════════════════════════════════════════════════════════

    // Calculate expected redemption amount
    const redemptionAmount = parseFloat(redeemAmount) * sharePrice;
    const feeAmount = redemptionAmount * baseFee;
    const expectedUserAmount = redemptionAmount - feeAmount;

    console.log(`Redemption amount (before fee): ${redemptionAmount} USD`);
    console.log(`Fee (${baseFee * 100}%): ${feeAmount} USD`);
    console.log(`Expected user amount: ${expectedUserAmount} USD`);

    // Verify Alice received USD
    const aliceUsdAfter = await aliceLedger.query(usdTemplateId, usdFilter);

    const finalUsdBalance = aliceUsdAfter.reduce((sum: number, h: any) => {
      return sum + parseFloat((h.payload as any).amount);
    }, 0);

    console.log(`Alice's USD balance after redemption: ${finalUsdBalance}`);

    // Alice should receive redemption amount minus fee
    const usdReceived = finalUsdBalance - initialUsdBalance;
    expect(
      usdReceived,
      'Alice should receive redemption amount minus fee'
    ).toBeCloseTo(expectedUserAmount, 6);

    // Verify vault state updated
    const vaultStateAfter = await vaultLedger.query(stateTemplateId, stateFilter);
    expect(vaultStateAfter.length, 'VaultState should still exist').toBe(1);

    const finalState = vaultStateAfter[0].payload as Vault_State_VaultState.Payload;
    const finalTotalAssets = parseFloat(finalState.totalAssets);
    const finalTotalShares = parseFloat(finalState.totalShares);

    // Total assets should decrease by gross redemption amount (shares * price)
    // Fee is deducted from user's payout, but vault assets decrease by full redemption value
    const grossRedemptionValue = parseFloat(redeemAmount) * sharePrice;
    const expectedAssets = initialTotalAssets - grossRedemptionValue;
    expect(
      finalTotalAssets,
      'Vault total assets should decrease by gross redemption value'
    ).toBeCloseTo(expectedAssets, 6);

    // Total shares should decrease by redeemed amount
    expect(
      finalTotalShares,
      'Vault total shares should decrease by redeemed shares'
    ).toBeCloseTo(initialTotalShares - parseFloat(redeemAmount), 6);

    console.log(`Final vault state - Assets: ${finalTotalAssets}, Shares: ${finalTotalShares}`);
    console.log(`=== Redemption Complete ===`);
    console.log(`Alice redeemed: ${redeemAmount} shares`);
    console.log(`Alice received: ${usdReceived} USD`);
    console.log(`Share Price: ${sharePrice}`);
  }, 30000);
});
