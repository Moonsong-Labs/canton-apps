import { useParams, useNavigate } from 'react-router-dom';
import { useVaultStates } from '@/hooks/useContracts';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { formatPartyId } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

export function VaultStateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { party } = useAuth();
  const { data: vaultStates, isLoading, error } = useVaultStates();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="text-red-600">
          Error loading vault state: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </Card>
    );
  }

  const contract = vaultStates?.find(c => c.contractId === id);

  if (!contract) {
    return (
      <Card>
        <div className="text-gray-500">Vault state not found</div>
        <Button onClick={() => navigate('/vault/state')} className="mt-4">
          Back to List
        </Button>
      </Card>
    );
  }

  const isOperator = contract.payload.operator === party;
  const nav = (parseFloat(contract.payload.totalShares) * parseFloat(contract.payload.sharePrice));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Vault State: {contract.payload.vaultId.unpack}</h2>
          {isOperator && <Badge variant="success">Operator</Badge>}
        </div>
        <Button variant="secondary" onClick={() => navigate('/vault/state')}>
          Back to List
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h3 className="text-lg font-semibold mb-4">Financial Metrics</h3>
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <label className="text-sm text-gray-600">Total Assets</label>
              <div className="font-mono text-2xl font-bold text-green-600 mt-1">
                {contract.payload.totalAssets}
              </div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <label className="text-sm text-gray-600">Total Shares</label>
              <div className="font-mono text-2xl font-bold text-blue-600 mt-1">
                {contract.payload.totalShares}
              </div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <label className="text-sm text-gray-600">Share Price</label>
              <div className="font-mono text-2xl font-bold text-purple-600 mt-1">
                {contract.payload.sharePrice}
              </div>
            </div>
            <div className="p-4 bg-indigo-50 rounded-lg">
              <label className="text-sm text-gray-600">Net Asset Value (NAV)</label>
              <div className="font-mono text-2xl font-bold text-indigo-600 mt-1">
                {nav.toFixed(4)}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-500">Vault ID</label>
              <div className="font-mono text-sm mt-1">{contract.payload.vaultId.unpack}</div>
            </div>
            <div>
              <label className="text-sm text-gray-500">Contract ID</label>
              <div className="font-mono text-xs mt-1 break-all">{contract.contractId}</div>
            </div>
            <div>
              <label className="text-sm text-gray-500">Config Contract ID</label>
              <div className="font-mono text-xs mt-1 break-all">{contract.payload.configCid}</div>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Parties</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-500">Operator</label>
              <div className="font-mono text-sm mt-1">{formatPartyId(contract.payload.operator)}</div>
            </div>
            <div>
              <label className="text-sm text-gray-500">Custodian</label>
              <div className="font-mono text-sm mt-1">{formatPartyId(contract.payload.custodian)}</div>
            </div>
            <div>
              <label className="text-sm text-gray-500">Observers</label>
              <div className="mt-1 space-y-1">
                {contract.payload.observers.length > 0 ? (
                  contract.payload.observers.map((observer, idx) => (
                    <div key={idx} className="font-mono text-sm">
                      {formatPartyId(observer)}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400 text-sm">None</div>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-500">Assets per Share</label>
              <div className="font-mono text-lg font-semibold mt-1">
                {parseFloat(contract.payload.totalShares) > 0
                  ? (parseFloat(contract.payload.totalAssets) / parseFloat(contract.payload.totalShares)).toFixed(6)
                  : 'N/A'}
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-500">Share Utilization</label>
              <div className="font-mono text-lg font-semibold mt-1">
                {parseFloat(contract.payload.totalShares) > 0 ? '100%' : '0%'}
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-500">Price to NAV Ratio</label>
              <div className="font-mono text-lg font-semibold mt-1">
                {nav > 0
                  ? (parseFloat(contract.payload.sharePrice) / (nav / parseFloat(contract.payload.totalShares))).toFixed(4)
                  : 'N/A'}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
