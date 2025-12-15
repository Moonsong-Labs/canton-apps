/**
 * Get the ledger URL for API calls.
 * In development with Vite proxy, use empty string (relative /v1 paths).
 * In production or with explicit env var, use the full URL.
 */
export function getLedgerUrl(): string {
  // If VITE_LEDGER_URL is set, use it (for production builds or direct connections)
  const envUrl = import.meta.env.VITE_LEDGER_URL;
  if (envUrl) {
    return envUrl;
  }
  // In development, use empty string to leverage Vite's proxy
  // The proxy forwards /v1/* to http://localhost:7575/v1/*
  return '';
}

/** @deprecated Use getLedgerUrl() instead */
export const LEDGER_URL = '';

/**
 * Query key factories for TanStack Query cache management.
 * Use these to invalidate specific queries after mutations.
 */
export const QUERY_KEYS = {
  /** Key for parties query */
  parties: ['parties'] as const,
  
  /** Key factory for contract queries by template and party */
  contracts: (templateId: string, party?: string) =>
    ['contracts', templateId, party] as const,
    
  /** Key factory for all contracts of a template */
  allContracts: (templateId: string) =>
    ['contracts', templateId] as const,
} as const;
