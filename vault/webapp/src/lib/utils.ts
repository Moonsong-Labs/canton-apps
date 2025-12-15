/**
 * Format a party ID for display
 * "Alice::1220abc..." → "Alice"
 */
export function formatPartyId(party: string): string {
  return party.split('::')[0];
}

/**
 * Format a numeric amount for display
 */
export function formatAmount(amount: string | number, decimals = 2): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Truncate a string (useful for contract IDs)
 */
export function truncate(str: string, length = 16): string {
  if (str.length <= length) return str;
  return `${str.slice(0, length)}...`;
}

/**
 * Format a timestamp for display
 */
export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}
