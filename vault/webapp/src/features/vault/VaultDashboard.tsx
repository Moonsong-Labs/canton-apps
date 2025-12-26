import { useVaultStates, useDepositRequests, useRedeemRequests, useVaultConfigs, useHoldings } from '@/hooks/useContracts';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatPartyId } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function VaultDashboard() {
  const { party } = useAuth();
  const { data: vaultStates, isLoading: loadingStates } = useVaultStates();
  const { data: depositRequests, isLoading: loadingDeposits } = useDepositRequests();
  const { data: redeemRequests, isLoading: loadingRedeems } = useRedeemRequests();
  const { data: vaultConfigs, isLoading: loadingConfigs } = useVaultConfigs();
  const { data: holdings, isLoading: loadingHoldings } = useHoldings();

  const isLoading = loadingStates || loadingDeposits || loadingRedeems || loadingConfigs || loadingHoldings;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const totalAssets = vaultStates?.reduce((sum, v) => sum + parseFloat(v.payload.totalAssets), 0) || 0;
  const totalShares = vaultStates?.reduce((sum, v) => sum + parseFloat(v.payload.totalShares), 0) || 0;
  const avgSharePrice = vaultStates && vaultStates.length > 0
    ? vaultStates.reduce((sum, v) => sum + parseFloat(v.payload.sharePrice), 0) / vaultStates.length
    : 0;

  const myDepositRequests = depositRequests?.filter(d => d.payload.depositor === party) || [];
  const myRedeemRequests = redeemRequests?.filter(r => r.payload.redeemer === party) || [];
  const pendingDeposits = depositRequests?.filter(d => d.payload.operator === party) || [];
  const pendingRedeems = redeemRequests?.filter(r => r.payload.operator === party) || [];

  // Calculate my holdings (filter by account owner = current party)
  const myHoldings = holdings?.filter(h => h.payload.account?.owner === party) || [];

  // Group holdings by instrument ID
  const holdingsByInstrument = myHoldings.reduce((acc, h) => {
    const instrumentId = h.payload.instrument?.id?.unpack || 'Unknown';
    const amount = parseFloat(h.payload.amount) || 0;
    acc[instrumentId] = (acc[instrumentId] || 0) + amount;
    return acc;
  }, {} as Record<string, number>);

  // Get LNRD (Lunar Dollars) and VAULT-SHARE balances
  const lnrdBalance = holdingsByInstrument['LNRD'] || 0;
  const shareBalance = holdingsByInstrument['VAULT-SHARE'] || 0;

  // Calculate portfolio value (shares * avg share price + LNRD)
  const portfolioValue = (shareBalance * avgSharePrice) + lnrdBalance;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Vault Dashboard</h2>
        <p className="text-gray-600 mt-1">Overview of all vaults and activities</p>
      </div>

      {/* My Balances Section */}
      <Card className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
        <h3 className="text-lg font-semibold mb-4 text-slate-200">My Portfolio</h3>
        <div className="grid gap-6 md:grid-cols-4">
          <div className="text-center p-4 bg-white/10 rounded-lg">
            <p className="text-sm text-slate-300 mb-1">LNRD Balance</p>
            <p className="text-3xl font-bold text-green-400">🌙 {lnrdBalance.toFixed(2)}</p>
            <p className="text-xs text-slate-400 mt-1">Lunar Dollars</p>
          </div>
          <div className="text-center p-4 bg-white/10 rounded-lg">
            <p className="text-sm text-slate-300 mb-1">Vault Shares</p>
            <p className="text-3xl font-bold text-purple-400">{shareBalance.toFixed(2)}</p>
            <p className="text-xs text-slate-400 mt-1">VAULT-SHARE</p>
          </div>
          <div className="text-center p-4 bg-white/10 rounded-lg">
            <p className="text-sm text-slate-300 mb-1">Share Value</p>
            <p className="text-3xl font-bold text-blue-400">🌙 {(shareBalance * avgSharePrice).toFixed(2)}</p>
            <p className="text-xs text-slate-400 mt-1">@ {avgSharePrice.toFixed(4)} LNRD/share</p>
          </div>
          <div className="text-center p-4 bg-white/10 rounded-lg border-2 border-yellow-500/50">
            <p className="text-sm text-slate-300 mb-1">Total Portfolio</p>
            <p className="text-3xl font-bold text-yellow-400">🌙 {portfolioValue.toFixed(2)}</p>
            <p className="text-xs text-slate-400 mt-1">LNRD + Share Value</p>
          </div>
        </div>
        {Object.keys(holdingsByInstrument).length > 2 && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <p className="text-sm text-slate-300 mb-2">Other Holdings:</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(holdingsByInstrument)
                .filter(([id]) => id !== 'LNRD' && id !== 'VAULT-SHARE')
                .map(([id, amount]) => (
                  <Badge key={id} variant="default" className="bg-white/20 text-white">
                    {id}: {amount.toFixed(2)}
                  </Badge>
                ))}
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
          <div>
            <p className="text-sm text-gray-600">Active Vaults</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{vaultStates?.length || 0}</p>
          </div>
          <Link to="/vault/state" className="text-sm text-blue-600 hover:underline mt-4 inline-block">
            View All
          </Link>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <div>
            <p className="text-sm text-gray-600">Total Assets</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{totalAssets.toFixed(2)} <span className="text-lg text-gray-600">LNRD</span></p>
          </div>
          <p className="text-xs text-gray-500 mt-4">Across all vaults</p>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
          <div>
            <p className="text-sm text-gray-600">Total Shares</p>
            <p className="text-3xl font-bold text-purple-600 mt-1">{totalShares.toFixed(2)} <span className="text-lg text-gray-600">shares</span></p>
          </div>
          <p className="text-xs text-gray-500 mt-4">Outstanding shares</p>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100">
          <div>
            <p className="text-sm text-gray-600">Avg Share Price</p>
            <p className="text-3xl font-bold text-indigo-600 mt-1">{avgSharePrice.toFixed(4)} <span className="text-lg text-gray-600">LNRD</span></p>
          </div>
          <p className="text-xs text-gray-500 mt-4">Average across vaults</p>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h3 className="text-lg font-semibold mb-4">My Requests</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">Pending Deposits</span>
              <Badge variant={myDepositRequests.length > 0 ? 'info' : 'default'}>
                {myDepositRequests.length}
              </Badge>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">Pending Redeems</span>
              <Badge variant={myRedeemRequests.length > 0 ? 'info' : 'default'}>
                {myRedeemRequests.length}
              </Badge>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Link to="/vault/deposits" className="text-sm text-blue-600 hover:underline">
              View Deposits
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/vault/redeems" className="text-sm text-blue-600 hover:underline">
              View Redeems
            </Link>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Operator Actions</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">Deposits to Review</span>
              <Badge variant={pendingDeposits.length > 0 ? 'warning' : 'default'}>
                {pendingDeposits.length}
              </Badge>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">Redeems to Review</span>
              <Badge variant={pendingRedeems.length > 0 ? 'warning' : 'default'}>
                {pendingRedeems.length}
              </Badge>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Link to="/vault/deposits" className="text-sm text-blue-600 hover:underline">
              Review Deposits
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/vault/redeems" className="text-sm text-blue-600 hover:underline">
              Review Redeems
            </Link>
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Recent Vault States</h3>
        {vaultStates && vaultStates.length > 0 ? (
          <div className="space-y-3">
            {vaultStates.slice(0, 5).map((vault) => (
              <Link
                key={vault.contractId}
                to={`/vault/state/${vault.contractId}`}
                className="block p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-sm">{vault.payload.vaultId.unpack}</div>
                    <div className="text-xs text-gray-500">
                      Operator: {formatPartyId(vault.payload.operator)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono">Assets: {vault.payload.totalAssets}</div>
                    <div className="text-sm font-mono text-gray-500">
                      Price: {vault.payload.sharePrice}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-center py-4">No vault states found</div>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Vault Configurations</h3>
        {vaultConfigs && vaultConfigs.length > 0 ? (
          <div className="space-y-3">
            {vaultConfigs.slice(0, 5).map((config) => (
              <Link
                key={config.contractId}
                to={`/vault/config/${config.contractId}`}
                className="block p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-sm">{config.payload.name}</div>
                    <div className="text-xs text-gray-500">{config.payload.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Min Deposit: {config.payload.minDepositAmount}</div>
                    <div className="text-xs text-gray-500">Fee: {config.payload.baseFee}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-center py-4">No configurations found</div>
        )}
        {vaultConfigs && vaultConfigs.length > 0 && (
          <Link to="/vault/config" className="text-sm text-blue-600 hover:underline mt-4 inline-block">
            View All Configurations
          </Link>
        )}
      </Card>
    </div>
  );
}
