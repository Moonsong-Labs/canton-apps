import { useVaultConfigs } from '@/hooks/useContracts';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatPartyId } from '@/lib/utils';
import { Link } from 'react-router-dom';

export function VaultConfigList() {
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
          Error loading vault configurations: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </Card>
    );
  }

  if (!vaultConfigs || vaultConfigs.length === 0) {
    return (
      <Card>
        <div className="text-gray-500 text-center py-8">
          No vault configurations found
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Vault Configurations</h2>
        <Badge variant="default">{vaultConfigs.length} vaults</Badge>
      </div>

      <div className="grid gap-4">
        {vaultConfigs.map((contract) => (
          <Link
            key={contract.contractId}
            to={`/vault/config/${contract.contractId}`}
            className="block hover:opacity-80 transition-opacity"
          >
            <Card className="hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">{contract.payload.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{contract.payload.description}</p>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Vault ID:</span>
                      <div className="font-mono text-xs">{contract.payload.vaultId.unpack}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Operator:</span>
                      <div className="font-mono text-xs">{formatPartyId(contract.payload.operator)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Custodian:</span>
                      <div className="font-mono text-xs">{formatPartyId(contract.payload.custodian)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Min Deposit:</span>
                      <div className="font-mono text-xs">{contract.payload.minDepositAmount}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Base Fee:</span>
                      <div className="font-mono text-xs">{contract.payload.baseFee}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Deposit Instrument:</span>
                      <div className="font-mono text-xs truncate">
                        {contract.payload.depositInstrument.id.unpack}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
