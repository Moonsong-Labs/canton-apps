import { useState, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { useVaultConfigs, useHoldings, useAccounts, useCreateDepositRequest } from '@/hooks/useContracts';
import { formatPartyId } from '@/lib/utils';

interface MakeDepositFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MakeDepositForm({ isOpen, onClose }: MakeDepositFormProps) {
  const { party } = useAuth();
  const { data: vaultConfigs, isLoading: loadingVaults } = useVaultConfigs();
  const { data: holdings, isLoading: loadingHoldings } = useHoldings();
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const createDepositRequest = useCreateDepositRequest();

  const [selectedVaultId, setSelectedVaultId] = useState<string>('');
  const [selectedHoldingId, setSelectedHoldingId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Filter holdings owned by the current party
  const userHoldings = useMemo(() => {
    if (!holdings || !party) return [];
    return holdings.filter((h: any) => h.payload.account?.owner === party);
  }, [holdings, party]);

  // Get user accounts for the deposit
  const userAccounts = useMemo(() => {
    if (!accounts || !party) return [];
    return accounts.filter((a: any) => a.payload.owner === party);
  }, [accounts, party]);

  // Get the selected vault config
  const selectedVault = useMemo(() => {
    if (!vaultConfigs || !selectedVaultId) return null;
    return vaultConfigs.find((v) => v.contractId === selectedVaultId);
  }, [vaultConfigs, selectedVaultId]);

  // Get the selected holding
  const selectedHolding = useMemo(() => {
    if (!userHoldings || !selectedHoldingId) return null;
    return userHoldings.find((h: any) => h.contractId === selectedHoldingId);
  }, [userHoldings, selectedHoldingId]);

  // Vault options for dropdown
  const vaultOptions = useMemo(() => {
    if (!vaultConfigs) return [{ value: '', label: 'Select a vault...' }];
    return [
      { value: '', label: 'Select a vault...' },
      ...vaultConfigs.map((v) => ({
        value: v.contractId,
        label: `${v.payload.vaultId.unpack} (Min: ${v.payload.minDepositAmount})`
      }))
    ];
  }, [vaultConfigs]);

  // Holding options for dropdown
  const holdingOptions = useMemo(() => {
    if (!userHoldings) return [{ value: '', label: 'Select a holding...' }];
    return [
      { value: '', label: 'Select a holding...' },
      ...userHoldings.map((h: any) => ({
        value: h.contractId,
        label: `${h.payload.instrument?.id?.unpack || 'Unknown'} - ${h.payload.amount}`
      }))
    ];
  }, [userHoldings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!party) {
      setError('No party selected');
      return;
    }

    if (!selectedVault) {
      setError('Please select a vault');
      return;
    }

    if (!selectedHolding) {
      setError('Please select a holding to deposit');
      return;
    }

    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      setError('Please enter a valid deposit amount');
      return;
    }

    const minDeposit = parseFloat(selectedVault.payload.minDepositAmount);
    if (depositAmount < minDeposit) {
      setError(`Minimum deposit amount is ${minDeposit}`);
      return;
    }

    const holdingAmount = parseFloat(selectedHolding.payload.amount);
    if (depositAmount > holdingAmount) {
      setError(`Insufficient balance. Maximum available: ${holdingAmount}`);
      return;
    }

    // Find the user's account for this holding's custodian
    const holdingCustodian = selectedHolding.payload.account?.custodian;
    const userAccount = userAccounts.find((a: any) => 
      a.payload.custodian === holdingCustodian && a.payload.owner === party
    );

    if (!userAccount) {
      setError('No matching account found for this holding');
      return;
    }

    try {
      // Use the holding's custodian (Bank for LNRD), not the vault's custodian
      // This is required for the Transferable.Transfer to work
      const holdingCustodian = selectedHolding.payload.account?.custodian;
      
      await createDepositRequest.mutateAsync({
        depositor: party,
        depositorAccount: {
          custodian: userAccount.payload.custodian,
          owner: party,
          id: userAccount.payload.id
        },
        operator: selectedVault.payload.operator,
        custodian: holdingCustodian,  // Must match holding's custodian
        vaultId: selectedVault.payload.vaultId,
        amount: amount,
        depositHoldingCid: selectedHolding.contractId
      });

      // Reset form and close
      setSelectedVaultId('');
      setSelectedHoldingId('');
      setAmount('');
      onClose();
    } catch (err) {
      console.error('Failed to create deposit request:', err);
      setError(err instanceof Error ? err.message : 'Failed to create deposit request');
    }
  };

  const isLoading = loadingVaults || loadingHoldings || loadingAccounts;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Make Deposit">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        <Select
          label="Select Vault"
          options={vaultOptions}
          value={selectedVaultId}
          onChange={(e) => setSelectedVaultId(e.target.value)}
          disabled={isLoading}
        />

        {selectedVault && (
          <Card className="p-3 bg-slate-900/50">
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Operator:</span>
                <span className="font-mono">{formatPartyId(selectedVault.payload.operator)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Min Deposit:</span>
                <span className="text-green-400">{selectedVault.payload.minDepositAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Base Fee:</span>
                <span>{selectedVault.payload.baseFee}</span>
              </div>
            </div>
          </Card>
        )}

        <Select
          label="Select Holding to Deposit"
          options={holdingOptions}
          value={selectedHoldingId}
          onChange={(e) => setSelectedHoldingId(e.target.value)}
          disabled={isLoading || !selectedVaultId}
        />

        {selectedHolding && (
          <Card className="p-3 bg-slate-900/50">
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Instrument:</span>
                <span className="font-mono">{selectedHolding.payload.instrument?.id?.unpack || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Available Balance:</span>
                <span className="text-green-400 font-semibold">{selectedHolding.payload.amount}</span>
              </div>
            </div>
          </Card>
        )}

        <Input
          label="Deposit Amount"
          type="number"
          step="0.01"
          min="0"
          placeholder="Enter amount to deposit"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isLoading || !selectedHoldingId}
        />

        {selectedHolding && amount && (
          <div className="text-sm text-slate-400">
            Remaining after deposit: {(parseFloat(selectedHolding.payload.amount) - parseFloat(amount || '0')).toFixed(2)}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1"
            loading={createDepositRequest.isPending}
            disabled={isLoading || !selectedVaultId || !selectedHoldingId || !amount}
          >
            Create Deposit Request
          </Button>
        </div>
      </form>
    </Modal>
  );
}

