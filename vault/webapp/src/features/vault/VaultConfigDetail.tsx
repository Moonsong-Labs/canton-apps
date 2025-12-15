import { useParams, useNavigate } from 'react-router-dom';
import { useVaultConfigs } from '@/hooks/useContracts';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { formatPartyId } from '@/lib/utils';

export function VaultConfigDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: vaultConfigs, isLoading, error } = useVaultConfigs();

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
          Error loading vault configuration: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </Card>
    );
  }

  const contract = vaultConfigs?.find(c => c.contractId === id);

  if (!contract) {
    return (
      <Card>
        <div className="text-gray-500">Vault configuration not found</div>
        <Button onClick={() => navigate('/vault/config')} className="mt-4">
          Back to List
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{contract.payload.name}</h2>
          <p className="text-gray-600 mt-1">{contract.payload.description}</p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/vault/config')}>
          Back to List
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
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
              <label className="text-sm text-gray-500">Name</label>
              <div className="mt-1">{contract.payload.name}</div>
            </div>
            <div>
              <label className="text-sm text-gray-500">Description</label>
              <div className="mt-1">{contract.payload.description}</div>
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
          <h3 className="text-lg font-semibold mb-4">Financial Settings</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-500">Minimum Deposit Amount</label>
              <div className="font-mono text-lg font-semibold mt-1">{contract.payload.minDepositAmount}</div>
            </div>
            <div>
              <label className="text-sm text-gray-500">Base Fee</label>
              <div className="font-mono text-lg font-semibold mt-1">{contract.payload.baseFee}</div>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Instruments & Accounts</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-500">Deposit Instrument</label>
              <div className="mt-1">
                <div className="text-xs text-gray-500">Depository: {formatPartyId(contract.payload.depositInstrument.depository)}</div>
                <div className="text-xs text-gray-500">Issuer: {formatPartyId(contract.payload.depositInstrument.issuer)}</div>
                <div className="font-mono text-xs mt-1">{contract.payload.depositInstrument.id.unpack}</div>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-500">Share Instrument</label>
              <div className="mt-1">
                <div className="text-xs text-gray-500">Depository: {formatPartyId(contract.payload.shareInstrument.depository)}</div>
                <div className="text-xs text-gray-500">Issuer: {formatPartyId(contract.payload.shareInstrument.issuer)}</div>
                <div className="font-mono text-xs mt-1">{contract.payload.shareInstrument.id.unpack}</div>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-500">Treasury Account</label>
              <div className="mt-1">
                <div className="text-xs text-gray-500">Custodian: {formatPartyId(contract.payload.treasuryAccount.custodian)}</div>
                <div className="text-xs text-gray-500">Owner: {formatPartyId(contract.payload.treasuryAccount.owner)}</div>
                <div className="font-mono text-xs mt-1">{contract.payload.treasuryAccount.id.unpack}</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
