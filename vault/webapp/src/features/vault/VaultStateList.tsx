import { useState } from 'react';
import { useVaultStates, useUpdateSharePrice } from '@/hooks/useContracts';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { formatPartyId } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function VaultStateList() {
  const { party } = useAuth();
  const { data: vaultStates, isLoading, error } = useVaultStates();
  const updateSharePrice = useUpdateSharePrice();

  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const [newSharePrice, setNewSharePrice] = useState('');
  const [showUpdateModal, setShowUpdateModal] = useState(false);

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
          Error loading vault states: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </Card>
    );
  }

  if (!vaultStates || vaultStates.length === 0) {
    return (
      <Card>
        <div className="text-gray-500 text-center py-8">
          No vault states found
        </div>
      </Card>
    );
  }

  const handleUpdateSharePrice = async () => {
    if (!selectedVault || !newSharePrice) return;

    try {
      await updateSharePrice.mutateAsync({
        contractId: selectedVault,
        args: { newSharePrice }
      });
      setShowUpdateModal(false);
      setNewSharePrice('');
      setSelectedVault(null);
    } catch (err) {
      console.error('Failed to update share price:', err);
    }
  };

  const openUpdateModal = (contractId: string, currentPrice: string) => {
    setSelectedVault(contractId);
    setNewSharePrice(currentPrice);
    setShowUpdateModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Vault States</h2>
        <Badge variant="default">{vaultStates.length} vaults</Badge>
      </div>

      <div className="grid gap-4">
        {vaultStates.map((contract) => {
          const isOperator = contract.payload.operator === party;

          return (
            <Link
              key={contract.contractId}
              to={`/vault/state/${contract.contractId}`}
              className="block hover:opacity-80 transition-opacity"
            >
              <Card className="hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="text-lg font-semibold">
                        Vault: {contract.payload.vaultId.unpack}
                      </h3>
                      {isOperator && <Badge variant="success">Operator</Badge>}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <span className="text-gray-500 text-sm">Total Assets</span>
                        <div className="font-mono text-lg font-semibold text-green-600">
                          {contract.payload.totalAssets}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 text-sm">Total Shares</span>
                        <div className="font-mono text-lg font-semibold text-blue-600">
                          {contract.payload.totalShares}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 text-sm">Share Price</span>
                        <div className="font-mono text-lg font-semibold text-purple-600">
                          {contract.payload.sharePrice}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 text-sm">NAV</span>
                        <div className="font-mono text-lg font-semibold text-indigo-600">
                          {(parseFloat(contract.payload.totalShares) * parseFloat(contract.payload.sharePrice)).toFixed(4)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Operator:</span>
                        <div className="font-mono text-xs">{formatPartyId(contract.payload.operator)}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Custodian:</span>
                        <div className="font-mono text-xs">{formatPartyId(contract.payload.custodian)}</div>
                      </div>
                    </div>

                    {isOperator && (
                      <div className="mt-4">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            openUpdateModal(contract.contractId, contract.payload.sharePrice);
                          }}
                        >
                          Update Share Price
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <Modal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        title="Update Share Price"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">New Share Price</label>
            <Input
              type="text"
              value={newSharePrice}
              onChange={(e) => setNewSharePrice(e.target.value)}
              placeholder="Enter new share price"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowUpdateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateSharePrice}
              disabled={updateSharePrice.isPending || !newSharePrice}
            >
              {updateSharePrice.isPending ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
