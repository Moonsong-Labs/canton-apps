import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui';
import { PartyBadge } from '@/components/shared';
import { getLedgerUrl } from '@/lib/constants';

export function Dashboard() {
  const { party } = useAuth();
  const ledgerUrl = getLedgerUrl() || 'proxy → localhost:7575';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Dashboard</h2>
        <p className="text-slate-400">Welcome to vault</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <h3 className="text-sm font-medium text-slate-400 mb-2">Current Party</h3>
          {party && <PartyBadge party={party} />}
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-slate-400 mb-2">Status</h3>
          <p className="text-green-400 font-medium">Connected</p>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-slate-400 mb-2">Ledger</h3>
          <p className="text-slate-200 text-sm truncate" title={ledgerUrl}>
            {ledgerUrl}
          </p>
        </Card>
      </div>
    </div>
  );
}
