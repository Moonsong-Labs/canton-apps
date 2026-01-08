import { useState, useEffect, useCallback } from 'react';
import { Card, Spinner, Button } from '@/components/ui';
import { EmptyState, ContractCard, PartyBadge } from '@/components/shared';
import { useAuth } from '@/hooks/useAuth';
import {
  HoldingsArchiveIndex,
  createHoldingsArchiveIndex,
  type ArchivedHolding,
} from '@sdk/ledger';

function formatAmount(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function formatDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleString();
  } catch {
    return isoDate;
  }
}

function ArchivedHoldingCard({ holding }: { holding: ArchivedHolding }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="bg-slate-800/50 border-red-900/30">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-red-400 text-lg">📦</span>
          <span className="text-xs font-mono text-slate-500 truncate max-w-[180px]" title={holding.contractId}>
            {holding.contractId.slice(0, 8)}...{holding.contractId.slice(-8)}
          </span>
        </div>
        <span className="px-2 py-0.5 text-xs bg-red-900/50 text-red-300 rounded">
          Archived
        </span>
      </div>

      {holding.payload?.amount && (
        <div className="mb-3">
          <span className="text-2xl font-bold text-slate-100">
            {formatAmount(holding.payload.amount)}
          </span>
          {holding.payload.instrument?.id?.unpack && (
            <span className="ml-2 text-slate-400">
              {holding.payload.instrument.id.unpack}
            </span>
          )}
        </div>
      )}

      <div className="space-y-2 text-sm">
        {holding.payload?.account?.owner && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Owner:</span>
            <PartyBadge party={holding.payload.account.owner} />
          </div>
        )}

        {holding.payload?.account?.custodian && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Custodian:</span>
            <PartyBadge party={holding.payload.account.custodian} />
          </div>
        )}

        <div className="flex items-center gap-2 text-slate-500">
          <span>Archived:</span>
          <span className="text-slate-300">{formatDate(holding.archivedAt)}</span>
        </div>

        {holding.createdAt && (
          <div className="flex items-center gap-2 text-slate-500">
            <span>Created:</span>
            <span className="text-slate-300">{formatDate(holding.createdAt)}</span>
          </div>
        )}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 text-xs text-blue-400 hover:text-blue-300"
      >
        {expanded ? '▼ Hide details' : '▶ Show details'}
      </button>

      {expanded && (
        <div className="mt-3 p-3 bg-slate-900/50 rounded text-xs font-mono overflow-x-auto">
          <pre className="text-slate-400">
            {JSON.stringify(holding, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
}

export function ArchivedHoldings() {
  const { party } = useAuth();
  const [archiveIndex, setArchiveIndex] = useState<HoldingsArchiveIndex | null>(null);
  const [archivedHoldings, setArchivedHoldings] = useState<ArchivedHolding[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOffset, setLastOffset] = useState<string>('');

  const handleIndexChange = useCallback((archived: ArchivedHolding[], active: Map<string, unknown>) => {
    setArchivedHoldings([...archived]);
    setActiveCount(active.size);
  }, []);

  useEffect(() => {
    if (!party) return;

    const index = createHoldingsArchiveIndex(party, {
      ledgerUrl: '',
    });

    index.onIndexChange(handleIndexChange);
    setArchiveIndex(index);

    return () => {
      index.stop();
    };
  }, [party, handleIndexChange]);

  const startStreaming = async () => {
    if (!archiveIndex) return;

    setIsLoading(true);
    setError(null);

    try {
      await archiveIndex.startFromBeginning();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const stopStreaming = () => {
    archiveIndex?.stop();
    setLastOffset(archiveIndex?.getLastOffset() || '');
  };

  const exportData = () => {
    if (!archiveIndex) return;

    const data = archiveIndex.toJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archived-holdings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isRunning = archiveIndex?.isRunning() || false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Archived Holdings</h2>
          <p className="text-slate-400">Historical record of archived holding contracts</p>
        </div>
        <div className="flex gap-2">
          {!isRunning ? (
            <Button onClick={startStreaming} disabled={isLoading}>
              {isLoading ? 'Connecting...' : '▶ Start Streaming'}
            </Button>
          ) : (
            <Button onClick={stopStreaming} variant="secondary">
              ⏹ Stop
            </Button>
          )}
          <Button onClick={exportData} variant="secondary" disabled={archivedHoldings.length === 0}>
            📥 Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <h3 className="text-sm font-medium text-slate-400 mb-1">Status</h3>
          <p className={isRunning ? 'text-green-400' : 'text-slate-500'}>
            {isRunning ? '● Streaming' : '○ Stopped'}
          </p>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-slate-400 mb-1">Archived Holdings</h3>
          <p className="text-2xl font-bold text-red-400">{archivedHoldings.length}</p>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-slate-400 mb-1">Active Holdings (tracked)</h3>
          <p className="text-2xl font-bold text-green-400">{activeCount}</p>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-slate-400 mb-1">Last Offset</h3>
          <p className="text-xs font-mono text-slate-300 truncate" title={lastOffset || archiveIndex?.getLastOffset()}>
            {(lastOffset || archiveIndex?.getLastOffset() || 'N/A').slice(0, 20)}...
          </p>
        </Card>
      </div>

      {error && (
        <Card className="bg-red-900/20 border-red-800">
          <div className="flex items-start gap-3">
            <span className="text-red-400">⚠️</span>
            <div>
              <p className="text-red-400 font-medium">Streaming Error</p>
              <p className="text-red-300 text-sm mt-1">{error}</p>
              <p className="text-slate-400 text-xs mt-2">
                Make sure the Canton ledger is running and accessible. The stream connects via
                Server-Sent Events (SSE) to track contract updates in real-time.
              </p>
            </div>
          </div>
        </Card>
      )}

      {!isRunning && archivedHoldings.length === 0 && !error && (
        <EmptyState
          icon="📦"
          title="No archived holdings yet"
          description="Click 'Start Streaming' to begin indexing archived holdings from the ledger. This will stream transaction history and track all holding archives."
        />
      )}

      {archivedHoldings.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-200">
            Archived Holdings ({archivedHoldings.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {archivedHoldings.map((holding) => (
              <ArchivedHoldingCard key={holding.contractId} holding={holding} />
            ))}
          </div>
        </div>
      )}

      <Card className="bg-slate-800/50">
        <div className="flex items-start gap-3">
          <span className="text-blue-400">💡</span>
          <div className="text-sm">
            <p className="text-slate-300 font-medium">How this works</p>
            <p className="text-slate-400 mt-1">
              This feature streams transaction updates from the ledger starting from offset "000000000000000000"
              (the beginning). It tracks all Holding contract creates and archives, building an index of
              archived holdings with their last known payload data.
            </p>
            <p className="text-slate-500 mt-2 text-xs">
              For full historical data, gRPC access to the Ledger API is required (port 5061).
              The JSON API fallback only tracks new events going forward.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

