import { useAuth } from '@/hooks/useAuth';
import { useContractQuery, useExerciseInterfaceChoice } from '@/hooks/useLedger';
import { Card, Spinner, Button } from '@/components/ui';
import { PartyBadge } from '@/components/shared';
import { TemplateIds, Holding_TransferableFungible } from '@lunar-dollar/lunar-dollar-api';
import { QUERY_KEYS } from '@/lib/constants';

const FUNGIBLE_INTERFACE_ID = 'daml-finance-interface-holding-v4:Daml.Finance.Interface.Holding.V4.Fungible:Fungible';

interface HoldingContract {
  contractId: string;
  payload: Holding_TransferableFungible.Payload;
}

interface BalanceByInstrument {
  instrumentId: string;
  instrumentVersion: string;
  totalAmount: number;
  holdingCount: number;
}

export function LunarDollarBalance() {
  const { party } = useAuth();

  const { data: holdings, isLoading, error } = useContractQuery<Holding_TransferableFungible.Payload>(
    TemplateIds.Holding_TransferableFungible
  );

  const mergeMutation = useExerciseInterfaceChoice<{ fungibleCids: string[] }>(
    TemplateIds.Holding_TransferableFungible,
    FUNGIBLE_INTERFACE_ID,
    'Merge',
    { invalidateKeys: [QUERY_KEYS.contracts(TemplateIds.Holding_TransferableFungible, party || undefined)] }
  );

  const getHoldingsByInstrument = () => {
    if (!holdings) return new Map<string, HoldingContract[]>();
    const grouped = new Map<string, HoldingContract[]>();
    for (const h of holdings as HoldingContract[]) {
      const key = `${h.payload.instrument.id?.unpack || 'Unknown'}-${h.payload.instrument.version || '0'}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(h);
    }
    return grouped;
  };

  const holdingsByInstrument = getHoldingsByInstrument();
  const canMerge = Array.from(holdingsByInstrument.values()).some(group => group.length > 1);

  const handleMergeAll = async () => {
    if (!party) return;

    for (const [, group] of holdingsByInstrument) {
      if (group.length < 2) continue;

      const [firstHolding, ...restHoldings] = group;
      const fungibleCids = restHoldings.map(h => h.contractId);

      await mergeMutation.mutateAsync({
        contractId: firstHolding.contractId,
        args: {
          fungibleCids,
        },
      });
    }
  };

  // Calculate balances grouped by instrument
  const balances: BalanceByInstrument[] = [];

  if (holdings) {
    const holdingsByInstrument = new Map<string, { holdings: HoldingContract[]; instrumentVersion: string }>();

    for (const h of holdings as HoldingContract[]) {
      const instrumentId = h.payload.instrument.id?.unpack || 'Unknown';
      const instrumentVersion = h.payload.instrument.version || '0';
      const key = `${instrumentId}-${instrumentVersion}`;

      if (!holdingsByInstrument.has(key)) {
        holdingsByInstrument.set(key, { holdings: [], instrumentVersion });
      }
      holdingsByInstrument.get(key)!.holdings.push(h);
    }

    for (const [key, { holdings: holds, instrumentVersion }] of holdingsByInstrument) {
      const instrumentId = key.split('-')[0];
      const totalAmount = holds.reduce((sum, h) => {
        const amount = typeof h.payload.amount === 'string'
          ? parseFloat(h.payload.amount)
          : h.payload.amount;
        return sum + (amount || 0);
      }, 0);

      balances.push({
        instrumentId,
        instrumentVersion,
        totalAmount,
        holdingCount: holds.length,
      });
    }
  }

  // Filter to show only LNRD (Lunar Dollars)
  const lnrdBalance = balances.find(b => b.instrumentId === 'LNRD');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Lunar Dollar Balance</h2>
        <p className="text-slate-400">Your LNRD token holdings</p>
      </div>

      {/* Current Party Card */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-2">Current Party</h3>
            {party && <PartyBadge party={party} />}
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500">Viewing balances as</span>
          </div>
        </div>
      </Card>

      {/* Balance Display */}
      {isLoading ? (
        <Card>
          <div className="flex items-center justify-center py-8">
            <Spinner />
            <span className="ml-3 text-slate-400">Loading balances...</span>
          </div>
        </Card>
      ) : error ? (
        <Card>
          <div className="text-center py-8">
            <p className="text-red-400">Error loading balances</p>
            <p className="text-sm text-slate-500 mt-2">{String(error)}</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Main LNRD Balance Card */}
          <Card className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border-indigo-700">
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-600/30 mb-4">
                <span className="text-3xl">🌙</span>
              </div>
              <h3 className="text-lg font-medium text-slate-300 mb-2">Lunar Dollars</h3>
              <p className="text-5xl font-bold text-white mb-2">
                {lnrdBalance ? lnrdBalance.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </p>
              <p className="text-indigo-300 text-lg">LNRD</p>
              {lnrdBalance && lnrdBalance.holdingCount > 1 && (
                <p className="text-sm text-slate-400 mt-2">
                  Across {lnrdBalance.holdingCount} holdings
                </p>
              )}
            </div>
          </Card>

          {/* All Holdings Table */}
          {holdings && (holdings as HoldingContract[]).length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-200">All Holdings</h3>
                <Button
                  onClick={handleMergeAll}
                  disabled={mergeMutation.isPending || !canMerge}
                  variant="secondary"
                  size="sm"
                  title={!canMerge ? 'No holdings to merge' : undefined}
                >
                  {mergeMutation.isPending ? 'Merging...' : 'Merge Holdings'}
                </Button>
              </div>
              {mergeMutation.error && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
                  {String(mergeMutation.error)}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Instrument</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Contract ID</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(holdings as HoldingContract[]).map((holding) => {
                      const instrumentId = holding.payload.instrument.id?.unpack || 'Unknown';
                      const instrumentVersion = holding.payload.instrument.version || '0';
                      const amount = typeof holding.payload.amount === 'string'
                        ? parseFloat(holding.payload.amount)
                        : holding.payload.amount;
                      return (
                        <tr key={holding.contractId} className="border-b border-slate-700/50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{instrumentId === 'LNRD' ? '🌙' : '💰'}</span>
                              <div>
                                <p className="font-medium text-slate-200">{instrumentId}</p>
                                <p className="text-xs text-slate-500">v{instrumentVersion}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-mono text-xs text-slate-400 truncate max-w-[200px]" title={holding.contractId}>
                              {holding.contractId}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <p className="font-mono text-lg text-slate-200">
                              {(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Empty State */}
          {balances.length === 0 && (
            <Card>
              <div className="text-center py-12">
                <span className="text-6xl mb-4 block">🌙</span>
                <h3 className="text-xl font-semibold text-slate-200 mb-2">No Holdings Found</h3>
                <p className="text-slate-400 max-w-md mx-auto">
                  You don't have any Lunar Dollar holdings yet.
                  Holdings will appear here once you receive LNRD tokens.
                </p>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

