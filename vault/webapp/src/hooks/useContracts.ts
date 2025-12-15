/**
 * Domain-specific contract hooks
 * 
 * This file provides typed hooks for querying and mutating contracts.
 * Customize these hooks based on your Daml model's templates.
 * 
 * Pattern:
 * 1. Import TemplateIds and type namespaces from the SDK
 * 2. Create query hooks with useContractQuery<TemplateNamespace.Payload>
 * 3. Create mutation hooks with useCreateContract/useExerciseChoice
 * 4. Export all hooks for use in components
 */

import { TemplateIds } from '@sdk/vault-api';
import type * as API from '@sdk/vault-api';
import { useContractQuery, useCreateContract, useExerciseChoice, type Contract } from './useLedger';
import { QUERY_KEYS } from '@/lib/constants';

// ═══════════════════════════════════════════════════════════════
// GENERIC ALL-CONTRACTS HOOK
// ═══════════════════════════════════════════════════════════════

/**
 * Get all template IDs available in the SDK.
 * Use this for dynamic template discovery.
 */
export function getAvailableTemplates(): string[] {
  return Object.keys(TemplateIds);
}

/**
 * Generic hook to query any template by its ID.
 * Use for dynamic/generic contract views.
 */
export function useAnyContracts<T = unknown>(
  templateId: string,
  filter?: Partial<T>,
  options?: { enabled?: boolean }
) {
  return useContractQuery<T>(templateId, filter, options);
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE-SPECIFIC HOOKS
// ═══════════════════════════════════════════════════════════════

// ─── VaultConfig ───────────────────────────────────────────────

export function useVaultConfigs(filter?: Partial<API.Vault_Config_VaultConfig.Payload>) {
  return useContractQuery<API.Vault_Config_VaultConfig.Payload>(
    TemplateIds.Vault_Config_VaultConfig,
    filter
  );
}

export function useCreateVaultConfig() {
  return useCreateContract<API.Vault_Config_VaultConfig.Payload>(
    TemplateIds.Vault_Config_VaultConfig,
    { invalidateKeys: [QUERY_KEYS.allContracts(TemplateIds.Vault_Config_VaultConfig)] }
  );
}

// ─── VaultState ───────────────────────────────────────────────

export function useVaultStates(filter?: Partial<API.Vault_State_VaultState.Payload>) {
  return useContractQuery<API.Vault_State_VaultState.Payload>(
    TemplateIds.Vault_State_VaultState,
    filter
  );
}

export function useProcessDeposit() {
  return useExerciseChoice(
    TemplateIds.Vault_State_VaultState,
    'ProcessDeposit',
    { invalidateKeys: [QUERY_KEYS.allContracts(TemplateIds.Vault_State_VaultState)] }
  );
}

export function useProcessRedemption() {
  return useExerciseChoice(
    TemplateIds.Vault_State_VaultState,
    'ProcessRedemption',
    { invalidateKeys: [QUERY_KEYS.allContracts(TemplateIds.Vault_State_VaultState)] }
  );
}

export function useUpdateSharePrice() {
  return useExerciseChoice<{ newSharePrice: string }>(
    TemplateIds.Vault_State_VaultState,
    'UpdateSharePrice',
    { invalidateKeys: [QUERY_KEYS.allContracts(TemplateIds.Vault_State_VaultState)] }
  );
}

// ─── DepositRequest ───────────────────────────────────────────

export function useDepositRequests(filter?: Partial<API.Vault_Deposit_DepositRequest.Payload>) {
  return useContractQuery<API.Vault_Deposit_DepositRequest.Payload>(
    TemplateIds.Vault_Deposit_DepositRequest,
    filter
  );
}

export function useCreateDepositRequest() {
  return useCreateContract<API.Vault_Deposit_DepositRequest.Payload>(
    TemplateIds.Vault_Deposit_DepositRequest,
    { invalidateKeys: [QUERY_KEYS.allContracts(TemplateIds.Vault_Deposit_DepositRequest)] }
  );
}

export function useAcceptDeposit() {
  return useExerciseChoice(
    TemplateIds.Vault_Deposit_DepositRequest,
    'Accept',
    { invalidateKeys: [
      QUERY_KEYS.allContracts(TemplateIds.Vault_Deposit_DepositRequest),
      QUERY_KEYS.allContracts(TemplateIds.Vault_State_VaultState)
    ]}
  );
}

export function useDeclineDeposit() {
  return useExerciseChoice(
    TemplateIds.Vault_Deposit_DepositRequest,
    'Decline',
    { invalidateKeys: [QUERY_KEYS.allContracts(TemplateIds.Vault_Deposit_DepositRequest)] }
  );
}

export function useCancelDeposit() {
  return useExerciseChoice(
    TemplateIds.Vault_Deposit_DepositRequest,
    'Cancel',
    { invalidateKeys: [QUERY_KEYS.allContracts(TemplateIds.Vault_Deposit_DepositRequest)] }
  );
}

// ─── RedeemRequest ───────────────────────────────────────────

export function useRedeemRequests(filter?: Partial<API.Vault_Redeem_RedeemRequest.Payload>) {
  return useContractQuery<API.Vault_Redeem_RedeemRequest.Payload>(
    TemplateIds.Vault_Redeem_RedeemRequest,
    filter
  );
}

export function useCreateRedeemRequest() {
  return useCreateContract<API.Vault_Redeem_RedeemRequest.Payload>(
    TemplateIds.Vault_Redeem_RedeemRequest,
    { invalidateKeys: [QUERY_KEYS.allContracts(TemplateIds.Vault_Redeem_RedeemRequest)] }
  );
}

export function useAcceptRedeem() {
  return useExerciseChoice(
    TemplateIds.Vault_Redeem_RedeemRequest,
    'Accept',
    { invalidateKeys: [
      QUERY_KEYS.allContracts(TemplateIds.Vault_Redeem_RedeemRequest),
      QUERY_KEYS.allContracts(TemplateIds.Vault_State_VaultState)
    ]}
  );
}

export function useDeclineRedeem() {
  return useExerciseChoice(
    TemplateIds.Vault_Redeem_RedeemRequest,
    'Decline',
    { invalidateKeys: [QUERY_KEYS.allContracts(TemplateIds.Vault_Redeem_RedeemRequest)] }
  );
}

export function useCancelRedeem() {
  return useExerciseChoice(
    TemplateIds.Vault_Redeem_RedeemRequest,
    'Cancel',
    { invalidateKeys: [QUERY_KEYS.allContracts(TemplateIds.Vault_Redeem_RedeemRequest)] }
  );
}

// ─── Account Workflows ───────────────────────────────────────

export function useCreateAccountRequests(filter?: Partial<API.Workflow_CreateAccount_Request.Payload>) {
  return useContractQuery<API.Workflow_CreateAccount_Request.Payload>(
    TemplateIds.Workflow_CreateAccount_Request,
    filter
  );
}

export function useCreateAccountRequest() {
  return useCreateContract<API.Workflow_CreateAccount_Request.Payload>(
    TemplateIds.Workflow_CreateAccount_Request,
    { invalidateKeys: [QUERY_KEYS.allContracts(TemplateIds.Workflow_CreateAccount_Request)] }
  );
}

export function useAcceptAccountRequest() {
  return useExerciseChoice(
    TemplateIds.Workflow_CreateAccount_Request,
    'Accept',
    { invalidateKeys: [QUERY_KEYS.allContracts(TemplateIds.Workflow_CreateAccount_Request)] }
  );
}

export function useDeclineAccountRequest() {
  return useExerciseChoice(
    TemplateIds.Workflow_CreateAccount_Request,
    'Decline',
    { invalidateKeys: [QUERY_KEYS.allContracts(TemplateIds.Workflow_CreateAccount_Request)] }
  );
}

export function useWithdrawAccountRequest() {
  return useExerciseChoice(
    TemplateIds.Workflow_CreateAccount_Request,
    'Withdraw',
    { invalidateKeys: [QUERY_KEYS.allContracts(TemplateIds.Workflow_CreateAccount_Request)] }
  );
}

// ─── CreditAccount Workflows ───────────────────────────────────────────

export function useCreditAccountRequests(filter?: Partial<API.Workflow_CreditAccount_Request.Payload>) {
  return useContractQuery<API.Workflow_CreditAccount_Request.Payload>(
    TemplateIds.Workflow_CreditAccount_Request,
    filter
  );
}

export function useCreateCreditAccountRequest() {
  return useCreateContract<API.Workflow_CreditAccount_Request.Payload>(
    TemplateIds.Workflow_CreditAccount_Request,
    { invalidateKeys: [QUERY_KEYS.allContracts(TemplateIds.Workflow_CreditAccount_Request)] }
  );
}

export function useAcceptCreditAccountRequest() {
  return useExerciseChoice(
    TemplateIds.Workflow_CreditAccount_Request,
    'Accept',
    { invalidateKeys: [QUERY_KEYS.allContracts(TemplateIds.Workflow_CreditAccount_Request)] }
  );
}

export function useDeclineCreditAccountRequest() {
  return useExerciseChoice(
    TemplateIds.Workflow_CreditAccount_Request,
    'Decline',
    { invalidateKeys: [QUERY_KEYS.allContracts(TemplateIds.Workflow_CreditAccount_Request)] }
  );
}

export function useWithdrawCreditAccountRequest() {
  return useExerciseChoice(
    TemplateIds.Workflow_CreditAccount_Request,
    'Withdraw',
    { invalidateKeys: [QUERY_KEYS.allContracts(TemplateIds.Workflow_CreditAccount_Request)] }
  );
}

// ─── Holdings ───────────────────────────────────────────────

export function useHoldings(filter?: Partial<any>) {
  return useContractQuery<any>(
    TemplateIds.Holding_TransferableFungible,
    filter
  );
}

export function useAccounts(filter?: Partial<any>) {
  return useContractQuery<any>(
    TemplateIds.Account,
    filter
  );
}

// Re-export types for convenience
export { TemplateIds };
export type { Contract };
