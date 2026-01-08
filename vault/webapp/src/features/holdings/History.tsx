import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  useNavigator,
  useHoldingsQuery,
  useTransferRequestsQuery,
  useCreditAccountsQuery,
  Holding,
  TransferRequest,
  CreditAccountRequest,
} from '@/hooks/useNavigator';
import { Card, Spinner, Badge, Button, Input } from '@/components/ui';
import { PartyBadge } from '@/components/shared';

type TabType = 'holdings' | 'transfers' | 'creditAccounts';
type FilterStatus = 'all' | 'active' | 'archived';

export function History() {
  const { party } = useAuth();
  const { session, login, logout, isLoggingIn, loginError } = useNavigator();
  const [activeTab, setActiveTab] = useState<TabType>('holdings');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const hasAttemptedAutoLogin = useRef(false);

  const holdingsQuery = useHoldingsQuery(session.isAuthenticated ? session.party : null);
  const transfersQuery = useTransferRequestsQuery(session.isAuthenticated ? session.party : null);
  const creditAccountsQuery = useCreditAccountsQuery(session.isAuthenticated ? session.party : null);

  useEffect(() => {
    hasAttemptedAutoLogin.current = false;
  }, [party]);

  useEffect(() => {
    if (party && !session.isAuthenticated && !isLoggingIn && !hasAttemptedAutoLogin.current) {
      hasAttemptedAutoLogin.current = true;
      login(party);
    }
  }, [party, session.isAuthenticated, isLoggingIn, login]);

  useEffect(() => {
    if (session.isAuthenticated) {
      holdingsQuery.refetch();
      transfersQuery.refetch();
      creditAccountsQuery.refetch();
    }
  }, [session.isAuthenticated]);

  const handleRefresh = () => {
    if (activeTab === 'holdings') holdingsQuery.refetch();
    else if (activeTab === 'transfers') transfersQuery.refetch();
    else creditAccountsQuery.refetch();
  };

  const shortenContractId = (id: string) => {
    if (id.length <= 16) return id;
    return `${id.slice(0, 8)}...${id.slice(-6)}`;
  };

  const shortenParty = (partyStr: string) => {
    if (partyStr.includes('::')) {
      return partyStr.split('::')[0];
    }
    return partyStr.length > 20 ? `${partyStr.slice(0, 8)}...${partyStr.slice(-8)}` : partyStr;
  };

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return amount;
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getCurrentQuery = () => {
    if (activeTab === 'holdings') return holdingsQuery;
    if (activeTab === 'transfers') return transfersQuery;
    return creditAccountsQuery;
  };

  const currentQuery = getCurrentQuery();

  const tabs: { key: TabType; label: string; icon: string; count: number }[] = [
    { key: 'holdings', label: 'Holdings', icon: '💰', count: holdingsQuery.totalCount },
    { key: 'transfers', label: 'Transfer Requests', icon: '💸', count: transfersQuery.totalCount },
    { key: 'creditAccounts', label: 'Credit Accounts', icon: '💳', count: creditAccountsQuery.totalCount },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">History</h2>
          <p className="text-slate-400">View all contracts including archived</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={currentQuery.isLoading || !session.isAuthenticated}
          variant="secondary"
          size="sm"
        >
          {currentQuery.isLoading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-2">Navigator Session</h3>
            <div className="flex items-center gap-3">
              {session.isAuthenticated ? (
                <>
                  <Badge variant="success">Connected</Badge>
                  {session.party && <PartyBadge party={session.party} />}
                </>
              ) : (
                <Badge variant="warning">
                  {isLoggingIn ? 'Connecting...' : 'Not Connected'}
                </Badge>
              )}
            </div>
          </div>
          {session.isAuthenticated && (
            <Button onClick={logout} variant="secondary" size="sm">
              Disconnect
            </Button>
          )}
        </div>
        {loginError && (
          <div className="mt-3 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
            {loginError}
          </div>
        )}
      </Card>

      {!session.isAuthenticated && !isLoggingIn && (
        <Card>
          <div className="text-center py-8">
            <span className="text-5xl mb-4 block">🔗</span>
            <h3 className="text-xl font-semibold text-slate-200 mb-2">Connect to Navigator</h3>
            <p className="text-slate-400 max-w-md mx-auto mb-4">
              Please ensure Navigator is running at port 7500 and click below to connect.
            </p>
            <Button onClick={() => {
              if (party) {
                hasAttemptedAutoLogin.current = true;
                login(party);
              }
            }} disabled={!party || isLoggingIn}>
              {isLoggingIn ? 'Connecting...' : 'Connect to Navigator'}
            </Button>
          </div>
        </Card>
      )}

      {session.isAuthenticated && (
        <>
          <div className="flex gap-2 border-b border-slate-700 pb-0">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setFilterStatus('all');
                  setSearchTerm('');
                }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                  activeTab === tab.key
                    ? 'text-blue-400 border-blue-400'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.key ? 'bg-blue-900/50 text-blue-300' : 'bg-slate-700 text-slate-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {activeTab === 'holdings' && (
            <HoldingsTab
              holdings={holdingsQuery.holdings}
              isLoading={holdingsQuery.isLoading}
              error={holdingsQuery.error}
              refetch={holdingsQuery.refetch}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              formatAmount={formatAmount}
              shortenContractId={shortenContractId}
              shortenParty={shortenParty}
            />
          )}

          {activeTab === 'transfers' && (
            <TransfersTab
              transfers={transfersQuery.transferRequests}
              isLoading={transfersQuery.isLoading}
              error={transfersQuery.error}
              refetch={transfersQuery.refetch}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              formatAmount={formatAmount}
              shortenContractId={shortenContractId}
              shortenParty={shortenParty}
            />
          )}

          {activeTab === 'creditAccounts' && (
            <CreditAccountsTab
              creditAccounts={creditAccountsQuery.creditAccounts}
              isLoading={creditAccountsQuery.isLoading}
              error={creditAccountsQuery.error}
              refetch={creditAccountsQuery.refetch}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              formatAmount={formatAmount}
              shortenContractId={shortenContractId}
              shortenParty={shortenParty}
            />
          )}
        </>
      )}
    </div>
  );
}

interface HoldingsTabProps {
  holdings: Holding[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  filterStatus: FilterStatus;
  setFilterStatus: (status: FilterStatus) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  formatAmount: (amount: string) => string;
  shortenContractId: (id: string) => string;
  shortenParty: (party: string) => string;
}

function HoldingsTab({
  holdings,
  isLoading,
  error,
  refetch,
  filterStatus,
  setFilterStatus,
  searchTerm,
  setSearchTerm,
  formatAmount,
  shortenContractId,
  shortenParty,
}: HoldingsTabProps) {
  const filtered = holdings.filter(h => {
    if (filterStatus === 'active' && h.isArchived) return false;
    if (filterStatus === 'archived' && !h.isArchived) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        h.owner.toLowerCase().includes(search) ||
        h.instrument.toLowerCase().includes(search) ||
        h.id.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const activeCount = holdings.filter(h => !h.isArchived).length;
  const archivedCount = holdings.filter(h => h.isArchived).length;

  return (
    <Card>
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-4">
        <div className="flex gap-2">
          <Button variant={filterStatus === 'all' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilterStatus('all')}>
            All ({holdings.length})
          </Button>
          <Button variant={filterStatus === 'active' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilterStatus('active')}>
            Active ({activeCount})
          </Button>
          <Button variant={filterStatus === 'archived' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilterStatus('archived')}>
            Archived ({archivedCount})
          </Button>
        </div>
        <div className="w-full md:w-64">
          <Input placeholder="Search holdings..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
          <span className="ml-3 text-slate-400">Loading holdings...</span>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <span className="text-5xl mb-4 block">⚠️</span>
          <p className="text-red-400 font-medium">Error loading holdings</p>
          <p className="text-sm text-slate-500 mt-2">{error}</p>
          <Button onClick={refetch} className="mt-4" variant="secondary">Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-5xl mb-4 block">📭</span>
          <h3 className="text-xl font-semibold text-slate-200 mb-2">No Holdings Found</h3>
          <p className="text-slate-400">
            {searchTerm ? 'No holdings match your search.' : 'No holdings exist for this party.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Owner</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Instrument</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Contract ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(h => (
                <tr key={h.id} className={`border-b border-slate-700/50 hover:bg-slate-700/20 ${h.isArchived ? 'opacity-60' : ''}`}>
                  <td className="py-3 px-4">
                    {h.isArchived ? (
                      <Badge variant="default" className="bg-slate-600/50 text-slate-400">📦 Archived</Badge>
                    ) : (
                      <Badge variant="success">✓ Active</Badge>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className={h.isArchived ? 'line-through decoration-slate-500' : ''}>
                      <PartyBadge party={h.owner} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1" title={h.custodian}>Custodian: {shortenParty(h.custodian)}</p>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <p className={`font-mono text-lg ${h.isArchived ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                      {formatAmount(h.amount)}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{h.instrument === 'LNRD' ? '🌙' : '💰'}</span>
                      <div>
                        <p className={`font-medium ${h.isArchived ? 'text-slate-500' : 'text-slate-200'}`}>{h.instrument}</p>
                        <p className="text-xs text-slate-500" title={h.issuer}>Issuer: {shortenParty(h.issuer)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-mono text-xs text-slate-400" title={h.id}>{shortenContractId(h.id)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

interface TransfersTabProps {
  transfers: TransferRequest[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  filterStatus: FilterStatus;
  setFilterStatus: (status: FilterStatus) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  formatAmount: (amount: string) => string;
  shortenContractId: (id: string) => string;
  shortenParty: (party: string) => string;
}

function TransfersTab({
  transfers,
  isLoading,
  error,
  refetch,
  filterStatus,
  setFilterStatus,
  searchTerm,
  setSearchTerm,
  formatAmount,
  shortenContractId,
  shortenParty,
}: TransfersTabProps) {
  const filtered = transfers.filter(t => {
    if (filterStatus === 'active' && t.isArchived) return false;
    if (filterStatus === 'archived' && !t.isArchived) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        t.sender.toLowerCase().includes(search) ||
        t.receiver.toLowerCase().includes(search) ||
        t.instrument.toLowerCase().includes(search) ||
        t.id.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const activeCount = transfers.filter(t => !t.isArchived).length;
  const archivedCount = transfers.filter(t => t.isArchived).length;

  return (
    <Card>
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-4">
        <div className="flex gap-2">
          <Button variant={filterStatus === 'all' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilterStatus('all')}>
            All ({transfers.length})
          </Button>
          <Button variant={filterStatus === 'active' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilterStatus('active')}>
            Active ({activeCount})
          </Button>
          <Button variant={filterStatus === 'archived' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilterStatus('archived')}>
            Archived ({archivedCount})
          </Button>
        </div>
        <div className="w-full md:w-64">
          <Input placeholder="Search transfers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
          <span className="ml-3 text-slate-400">Loading transfer requests...</span>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <span className="text-5xl mb-4 block">⚠️</span>
          <p className="text-red-400 font-medium">Error loading transfers</p>
          <p className="text-sm text-slate-500 mt-2">{error}</p>
          <Button onClick={refetch} className="mt-4" variant="secondary">Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-5xl mb-4 block">💸</span>
          <h3 className="text-xl font-semibold text-slate-200 mb-2">No Transfer Requests</h3>
          <p className="text-slate-400">
            {searchTerm ? 'No transfers match your search.' : 'No transfer requests exist for this party.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Sender</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Receiver</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Instrument</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Contract ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className={`border-b border-slate-700/50 hover:bg-slate-700/20 ${t.isArchived ? 'opacity-60' : ''}`}>
                  <td className="py-3 px-4">
                    {t.isArchived ? (
                      <Badge variant="default" className="bg-slate-600/50 text-slate-400">📦 Archived</Badge>
                    ) : (
                      <Badge variant="warning">⏳ Pending</Badge>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <p className={`text-sm ${t.isArchived ? 'text-slate-500 line-through' : 'text-slate-200'}`} title={t.sender}>
                      {shortenParty(t.sender)}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <p className={`text-sm ${t.isArchived ? 'text-slate-500 line-through' : 'text-slate-200'}`} title={t.receiver}>
                      {shortenParty(t.receiver)}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <p className={`font-mono text-lg ${t.isArchived ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                      {formatAmount(t.amount)}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`font-medium ${t.isArchived ? 'text-slate-500' : 'text-slate-200'}`}>
                      {t.instrument === 'LNRD' ? '🌙 ' : ''}{t.instrument}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-mono text-xs text-slate-400" title={t.id}>{shortenContractId(t.id)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

interface CreditAccountsTabProps {
  creditAccounts: CreditAccountRequest[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  filterStatus: FilterStatus;
  setFilterStatus: (status: FilterStatus) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  formatAmount: (amount: string) => string;
  shortenContractId: (id: string) => string;
  shortenParty: (party: string) => string;
}

function CreditAccountsTab({
  creditAccounts,
  isLoading,
  error,
  refetch,
  filterStatus,
  setFilterStatus,
  searchTerm,
  setSearchTerm,
  formatAmount,
  shortenContractId,
  shortenParty,
}: CreditAccountsTabProps) {
  const filtered = creditAccounts.filter(c => {
    if (filterStatus === 'active' && c.isArchived) return false;
    if (filterStatus === 'archived' && !c.isArchived) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        c.owner.toLowerCase().includes(search) ||
        c.custodian.toLowerCase().includes(search) ||
        c.accountId.toLowerCase().includes(search) ||
        c.instrument.toLowerCase().includes(search) ||
        c.id.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const activeCount = creditAccounts.filter(c => !c.isArchived).length;
  const archivedCount = creditAccounts.filter(c => c.isArchived).length;

  return (
    <Card>
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-4">
        <div className="flex gap-2">
          <Button variant={filterStatus === 'all' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilterStatus('all')}>
            All ({creditAccounts.length})
          </Button>
          <Button variant={filterStatus === 'active' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilterStatus('active')}>
            Active ({activeCount})
          </Button>
          <Button variant={filterStatus === 'archived' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilterStatus('archived')}>
            Archived ({archivedCount})
          </Button>
        </div>
        <div className="w-full md:w-64">
          <Input placeholder="Search credit accounts..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
          <span className="ml-3 text-slate-400">Loading credit account requests...</span>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <span className="text-5xl mb-4 block">⚠️</span>
          <p className="text-red-400 font-medium">Error loading credit accounts</p>
          <p className="text-sm text-slate-500 mt-2">{error}</p>
          <Button onClick={refetch} className="mt-4" variant="secondary">Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-5xl mb-4 block">💳</span>
          <h3 className="text-xl font-semibold text-slate-200 mb-2">No Credit Account Requests</h3>
          <p className="text-slate-400">
            {searchTerm ? 'No credit accounts match your search.' : 'No credit account requests exist for this party.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Owner</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Account</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Instrument</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Contract ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className={`border-b border-slate-700/50 hover:bg-slate-700/20 ${c.isArchived ? 'opacity-60' : ''}`}>
                  <td className="py-3 px-4">
                    {c.isArchived ? (
                      <Badge variant="default" className="bg-slate-600/50 text-slate-400">📦 Archived</Badge>
                    ) : (
                      <Badge variant="warning">⏳ Pending</Badge>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <p className={`text-sm ${c.isArchived ? 'text-slate-500 line-through' : 'text-slate-200'}`} title={c.owner}>
                      {shortenParty(c.owner)}
                    </p>
                    <p className="text-xs text-slate-500" title={c.custodian}>Custodian: {shortenParty(c.custodian)}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className={`text-sm ${c.isArchived ? 'text-slate-500' : 'text-slate-200'}`}>
                      {c.accountId}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <p className={`font-mono text-lg ${c.isArchived ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                      {formatAmount(c.amount)}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`font-medium ${c.isArchived ? 'text-slate-500' : 'text-slate-200'}`}>
                      {c.instrument === 'LNRD' ? '🌙 ' : ''}{c.instrument}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-mono text-xs text-slate-400" title={c.id}>{shortenContractId(c.id)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

