import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { CantonLedgerClient, getParties, createConfig } from '@sdk/ledger';
import type { ContractId, Contract } from '@sdk/core/primitives';
import { getLedgerUrl, QUERY_KEYS } from '@/lib/constants';

/**
 * Hook to fetch all parties from the ledger.
 * Uses the proxy at /v1 which forwards to the Canton JSON API.
 */
export function useParties() {
  return useQuery({
    queryKey: QUERY_KEYS.parties,
    queryFn: async () => {
      const ledgerUrl = getLedgerUrl();
      const config = createConfig({ ledgerUrl });
      return getParties(config);
    },
    staleTime: 30000,
  });
}

/**
 * Hook to get a ledger client for the current party.
 * Returns null if no party is selected.
 */
export function useLedgerClient() {
  const { party } = useAuth();
  return useMemo(() => {
    if (!party) return null;
    const ledgerUrl = getLedgerUrl();
    return new CantonLedgerClient(party, ledgerUrl);
  }, [party]);
}

/**
 * Generic contract query hook.
 * @param templateId - The template ID to query
 * @param filter - Optional filter for the query
 * @param options - Query options
 */
export function useContractQuery<T>(
  templateId: string,
  filter?: Partial<T>,
  options?: { enabled?: boolean }
) {
  const client = useLedgerClient();
  const { party } = useAuth();

  return useQuery({
    queryKey: QUERY_KEYS.contracts(templateId, party || undefined),
    queryFn: () => client!.query<T>(templateId, filter),
    enabled: !!client && (options?.enabled !== false),
  });
}

/**
 * Generic create contract hook.
 * @param templateId - The template ID to create
 * @param options - Mutation options including cache invalidation keys
 */
export function useCreateContract<T>(
  templateId: string,
  options?: { invalidateKeys?: readonly QueryKey[] }
) {
  const client = useLedgerClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: T) => client!.create<T>(templateId, payload),
    onSuccess: () => {
      options?.invalidateKeys?.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key] });
      });
    },
  });
}

/**
 * Generic exercise choice hook.
 * @param templateId - The template ID
 * @param choice - The choice name to exercise
 * @param options - Mutation options including cache invalidation keys
 */
export function useExerciseChoice<TArgs = Record<string, never>, TResult = unknown>(
  templateId: string,
  choice: string,
  options?: { invalidateKeys?: readonly QueryKey[] }
) {
  const client = useLedgerClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { contractId: string; args?: TArgs }) => {
      return client!.exercise<unknown, TResult>(
        templateId,
        input.contractId as ContractId<unknown>,
        choice,
        input.args ?? {}
      );
    },
    onSuccess: () => {
      options?.invalidateKeys?.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key] });
      });
    },
  });
}

/**
 * Generic exercise choice by key hook.
 * @param templateId - The template ID
 * @param choice - The choice name to exercise
 * @param options - Mutation options including cache invalidation keys
 */
export function useExerciseChoiceByKey<TArgs = Record<string, never>, TResult = unknown>(
  templateId: string,
  choice: string,
  options?: { invalidateKeys?: readonly QueryKey[] }
) {
  const client = useLedgerClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { key: unknown; args?: TArgs }) => {
      return client!.exerciseByKey<TResult>(
        templateId,
        input.key,
        choice,
        input.args ?? {}
      );
    },
    onSuccess: () => {
      options?.invalidateKeys?.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key] });
      });
    },
  });
}

/**
 * Generic exercise interface choice hook.
 * @param templateId - The template ID of the contract
 * @param interfaceId - The interface ID containing the choice
 * @param choice - The choice name to exercise
 * @param options - Mutation options including cache invalidation keys
 */
export function useExerciseInterfaceChoice<TArgs = Record<string, never>, TResult = unknown>(
  templateId: string,
  interfaceId: string,
  choice: string,
  options?: { invalidateKeys?: readonly QueryKey[] }
) {
  const client = useLedgerClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { contractId: string; args?: TArgs }) => {
      return client!.exerciseInterface<unknown, TResult>(
        templateId,
        interfaceId,
        input.contractId as ContractId<unknown>,
        choice,
        input.args ?? {}
      );
    },
    onSuccess: () => {
      options?.invalidateKeys?.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key] });
      });
    },
  });
}

// Re-export Contract type for convenience
export type { Contract };
