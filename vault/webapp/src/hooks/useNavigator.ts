import { useState, useCallback, useRef, useEffect } from 'react';

const NAVIGATOR_URL = '';

interface NavigatorSession {
  isAuthenticated: boolean;
  party: string | null;
}

interface GraphQLResponse {
  data?: {
    contracts: {
      totalCount: number;
      edges: Array<{ node: ContractNode }>;
    };
  };
  errors?: Array<{ message: string }>;
}

interface ContractNode {
  id: string;
  archiveEvent: { id: string } | null;
  argument: unknown;
  template: {
    id: string;
  };
}

export interface NavigatorContract {
  id: string;
  isArchived: boolean;
  templateId: string;
  argument: unknown;
}

export interface Holding {
  id: string;
  isArchived: boolean;
  owner: string;
  custodian: string;
  amount: string;
  instrument: string;
  issuer: string;
}

export interface TransferRequest {
  id: string;
  isArchived: boolean;
  sender: string;
  receiver: string;
  amount: string;
  instrument: string;
}

export interface CreditAccountRequest {
  id: string;
  isArchived: boolean;
  owner: string;
  custodian: string;
  accountId: string;
  amount: string;
  instrument: string;
}

export function useNavigator() {
  const [session, setSession] = useState<NavigatorSession>({
    isAuthenticated: false,
    party: null,
  });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const login = useCallback(async (party: string): Promise<boolean> => {
    setIsLoggingIn(true);
    setLoginError(null);

    const shortParty = party.includes('::') ? party.split('::')[0] : party;

    try {
      const response = await fetch(`${NAVIGATOR_URL}/navigator-api/session/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'select', userId: shortParty }),
        credentials: 'include',
      });

      const data = await response.json();
      console.log('Navigator session response:', data);

      if (data.error) {
        throw new Error(data.error);
      }

      if (!response.ok) {
        throw new Error(`Login failed: ${response.status} ${response.statusText}`);
      }
      
      const actualParty = data?.user?.id || shortParty;
      
      if (actualParty !== shortParty) {
        setLoginError(`Navigator session mismatch: logged in as ${actualParty}, expected ${shortParty}. Please open Navigator directly and switch users, or clear cookies.`);
        setSession({ isAuthenticated: true, party: actualParty });
        return false;
      }
      
      setSession({ isAuthenticated: true, party: actualParty });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setLoginError(message);
      setSession({ isAuthenticated: false, party: null });
      return false;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const logout = useCallback(() => {
    setSession({ isAuthenticated: false, party: null });
    setLoginError(null);
  }, []);

  return {
    session,
    login,
    logout,
    isLoggingIn,
    loginError,
  };
}

const getField = (fields: unknown[], label: string): unknown => {
  if (!Array.isArray(fields)) return undefined;
  const field = fields.find((f: unknown) => 
    f && typeof f === 'object' && 'label' in f && (f as { label: string }).label === label
  );
  return field ? (field as { value: unknown }).value : undefined;
};

const getValue = (fieldValue: unknown): string => {
  if (!fieldValue || typeof fieldValue !== 'object') return 'Unknown';
  const fv = fieldValue as { type?: string; value?: unknown; fields?: unknown[] };
  if (fv.type === 'party' || fv.type === 'text' || fv.type === 'numeric') {
    return String(fv.value || 'Unknown');
  }
  if (fv.type === 'record' && fv.fields) {
    const unpackField = getField(fv.fields, 'unpack');
    if (unpackField) return getValue(unpackField);
  }
  return 'Unknown';
};

async function fetchContracts(
  templateFilter: string,
  signal: AbortSignal
): Promise<{ contracts: NavigatorContract[]; totalCount: number }> {
  const query = `
    query ContractsQuery($filter: [FilterCriterion!], $includeArchived: Boolean!, $count: Int!) {
      contracts(filter: $filter, search: "", includeArchived: $includeArchived, count: $count, sort: []) {
        totalCount
        edges {
          node {
            id
            archiveEvent { id }
            argument
            template { id }
          }
        }
      }
    }
  `;

  const variables = {
    filter: [{ field: 'template.id', value: templateFilter }],
    includeArchived: true,
    count: 1000,
  };

  const response = await fetch(`${NAVIGATOR_URL}/navigator-api/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ query, variables }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const data: GraphQLResponse = await response.json();

  if (data.errors && data.errors.length > 0) {
    throw new Error(data.errors.map(e => e.message).join(', '));
  }

  if (!data.data?.contracts) {
    throw new Error('Invalid response structure');
  }

  const contracts: NavigatorContract[] = data.data.contracts.edges.map(edge => ({
    id: edge.node.id,
    isArchived: edge.node.archiveEvent !== null,
    templateId: edge.node.template.id,
    argument: edge.node.argument,
  }));

  return { contracts, totalCount: data.data.contracts.totalCount };
}

function parseHolding(contract: NavigatorContract): Holding {
  const arg = contract.argument as { fields?: unknown[] };
  const rootFields = arg?.fields || [];
  
  const accountField = getField(rootFields, 'account') as { fields?: unknown[] } | undefined;
  const accountFields = accountField?.fields || [];
  const owner = getValue(getField(accountFields, 'owner'));
  const custodian = getValue(getField(accountFields, 'custodian'));
  
  const instrumentField = getField(rootFields, 'instrument') as { fields?: unknown[] } | undefined;
  const instrumentFields = instrumentField?.fields || [];
  const instrument = getValue(getField(instrumentFields, 'id'));
  const issuer = getValue(getField(instrumentFields, 'issuer'));
  
  const amount = getValue(getField(rootFields, 'amount'));
  
  return {
    id: contract.id,
    isArchived: contract.isArchived,
    owner,
    custodian,
    amount,
    instrument,
    issuer,
  };
}

function parseTransferRequest(contract: NavigatorContract): TransferRequest {
  const arg = contract.argument as { fields?: unknown[] };
  const rootFields = arg?.fields || [];
  
  const sender = getValue(getField(rootFields, 'currentOwner'));
  
  const receiverAccountField = getField(rootFields, 'receiverAccount') as { fields?: unknown[] } | undefined;
  const receiverAccountFields = receiverAccountField?.fields || [];
  const receiver = getValue(getField(receiverAccountFields, 'owner'));
  
  const instrumentField = getField(rootFields, 'instrument') as { fields?: unknown[] } | undefined;
  const instrumentFields = instrumentField?.fields || [];
  const instrument = getValue(getField(instrumentFields, 'id'));
  
  const amount = getValue(getField(rootFields, 'amount'));
  
  return {
    id: contract.id,
    isArchived: contract.isArchived,
    sender,
    receiver,
    amount,
    instrument,
  };
}

function parseCreditAccountRequest(contract: NavigatorContract): CreditAccountRequest {
  const arg = contract.argument as { fields?: unknown[] };
  const rootFields = arg?.fields || [];
  
  const accountField = getField(rootFields, 'account') as { fields?: unknown[] } | undefined;
  const accountFields = accountField?.fields || [];
  const owner = getValue(getField(accountFields, 'owner'));
  const custodian = getValue(getField(accountFields, 'custodian'));
  const accountId = getValue(getField(accountFields, 'id'));
  
  const instrumentField = getField(rootFields, 'instrument') as { fields?: unknown[] } | undefined;
  const instrumentFields = instrumentField?.fields || [];
  const instrument = getValue(getField(instrumentFields, 'id'));
  
  const amount = getValue(getField(rootFields, 'amount'));
  
  return {
    id: contract.id,
    isArchived: contract.isArchived,
    owner,
    custodian,
    accountId,
    amount,
    instrument,
  };
}

export function useHoldingsQuery(navigatorParty: string | null) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    if (!navigatorParty) {
      setHoldings([]);
      setTotalCount(0);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const { contracts, totalCount } = await fetchContracts('TransferableFungible', abortControllerRef.current.signal);
      setHoldings(contracts.map(parseHolding));
      setTotalCount(totalCount);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error');
      setHoldings([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [navigatorParty]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  return { holdings, totalCount, isLoading, error, refetch };
}

export function useTransferRequestsQuery(navigatorParty: string | null) {
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    if (!navigatorParty) {
      setTransferRequests([]);
      setTotalCount(0);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const { contracts, totalCount } = await fetchContracts('TransferRequest', abortControllerRef.current.signal);
      setTransferRequests(contracts.map(parseTransferRequest));
      setTotalCount(totalCount);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error');
      setTransferRequests([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [navigatorParty]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  return { transferRequests, totalCount, isLoading, error, refetch };
}

export function useCreditAccountsQuery(navigatorParty: string | null) {
  const [creditAccounts, setCreditAccounts] = useState<CreditAccountRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    if (!navigatorParty) {
      setCreditAccounts([]);
      setTotalCount(0);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const { contracts, totalCount } = await fetchContracts('CreditAccount', abortControllerRef.current.signal);
      setCreditAccounts(contracts.map(parseCreditAccountRequest));
      setTotalCount(totalCount);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error');
      setCreditAccounts([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [navigatorParty]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  return { creditAccounts, totalCount, isLoading, error, refetch };
}
