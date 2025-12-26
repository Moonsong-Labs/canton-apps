import { useState, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { useVaultConfigs, useHoldings, useAccounts, useCreateRedeemRequest } from '@/hooks/useContracts';
import { formatPartyId } from '@/lib/utils';

interface MakeRedeemFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MakeRedeemForm({ isOpen, onClose }: MakeRedeemFormProps) {
  const { party } = useAuth();
  const { data: vaultConfigs, isLoading: loadingVaults } = useVaultConfigs();
  const { data: holdings, isLoading: loadingHoldings } = useHoldings();
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const createRedeemRequest = useCreateRedeemRequest();

  const [selectedVaultId, setSelectedVaultId] = useState<string>('');
  const [selectedHoldingId, setSelectedHoldingId] = useState<string>('');
  const [sharesAmount, setSharesAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Filter holdings owned by the current party that are vault shares
  const userShareHoldings = useMemo(() => {
    if (!holdings || !party || !vaultConfigs) return [];

    // Get all share instrument IDs from vaults
    const shareInstrumentIds = vaultConfigs.map(v => v.payload.shareInstrument.id.unpack);

    return holdings.filter((h: any) =>
      h.payload.account?.owner === party &&
      shareInstrumentIds.includes(h.payload.instrument?.id?.unpack)
    );
  }, [holdings, party, vaultConfigs]);

  // Get user accounts
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
    if (!userShareHoldings || !selectedHoldingId) return null;
    return userShareHoldings.find((h: any) => h.contractId === selectedHoldingId);
  }, [userShareHoldings, selectedHoldingId]);

  // Vault options for dropdown
  const vaultOptions = useMemo(() => {
    if (!vaultConfigs) return [{ value: '', label: 'Select a vault...' }];
    return [
      { value: '', label: 'Select a vault...' },
      ...vaultConfigs.map((v) => ({
        value: v.contractId,
        label: `${v.payload.vaultId.unpack} - ${v.payload.name}`
      }))
    ];
  }, [vaultConfigs]);

  // Share holding options for dropdown (filtered by selected vault)
  const shareHoldingOptions = useMemo(() => {
    if (!userShareHoldings) return [{ value: '', label: 'Select shares to redeem...' }];

    let filteredHoldings = userShareHoldings;

    // Filter by selected vault's share instrument if a vault is selected
    if (selectedVault) {
      const shareInstrumentId = selectedVault.payload.shareInstrument.id.unpack;
      filteredHoldings = userShareHoldings.filter((h: any) =>
        h.payload.instrument?.id?.unpack === shareInstrumentId
      );
    }

    return [
      { value: '', label: 'Select shares to redeem...' },
      ...filteredHoldings.map((h: any) => ({
        value: h.contractId,
        label: `${h.payload.instrument?.id?.unpack || 'Unknown'} - ${h.payload.amount} shares`
      }))
    ];
  }, [userShareHoldings, selectedVault]);

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
      setError('Please select shares to redeem');
      return;
    }

    const redeemAmount = parseFloat(sharesAmount);
    if (isNaN(redeemAmount) || redeemAmount <= 0) {
      setError('Please enter a valid shares amount');
      return;
    }

    const holdingAmount = parseFloat(selectedHolding.payload.amount);
    if (redeemAmount > holdingAmount) {
      setError(`Insufficient shares. Maximum available: ${holdingAmount}`);
      return;
    }

    // Find the share account (at Vault - where VAULT-SHARE is held)
    const shareCustodian = selectedHolding.payload.account?.custodian;
    const shareAccount = userAccounts.find((a: any) =>
      a.payload.custodian === shareCustodian && a.payload.owner === party
    );

    if (!shareAccount) {
      setError('No share account found for this holding');
      return;
    }

    // Find the LNRD account (at Bank - where LNRD will be credited)
    // The LNRD custodian is the depositInstrument's issuer (Bank)
    const lnrdCustodian = selectedVault.payload.depositInstrument?.issuer;
    const lnrdAccount = userAccounts.find((a: any) =>
      a.payload.custodian === lnrdCustodian && a.payload.owner === party
    );

    if (!lnrdAccount) {
      setError('No LNRD (Bank) account found. You need an account at Bank to receive LNRD.');
      return;
    }

    try {
      await createRedeemRequest.mutateAsync({
        redeemer: party,
        shareAccount: {
          custodian: shareAccount.payload.custodian,
          owner: party,
          id: shareAccount.payload.id
        },
        lnrdAccount: {
          custodian: lnrdAccount.payload.custodian,
          owner: party,
          id: lnrdAccount.payload.id
        },
        operator: selectedVault.payload.operator,
        shareCustodian: shareCustodian,
        lnrdCustodian: lnrdCustodian,
        vaultId: selectedVault.payload.vaultId,
        sharesAmount: sharesAmount,
        shareHoldingCid: selectedHolding.contractId
      } as any);

      // Reset form and close
      setSelectedVaultId('');
      setSelectedHoldingId('');
      setSharesAmount('');
      onClose();
    } catch (err) {
      console.error('Failed to create redeem request:', err);
      setError(err instanceof Error ? err.message : 'Failed to create redeem request');
    }
  };

  const isLoading = loadingVaults || loadingHoldings || loadingAccounts;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Redeem Shares">
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
                <span className="text-slate-400">Base Fee:</span>
                <span>{selectedVault.payload.baseFee}</span>
              </div>
            </div>
          </Card>
        )}

        <Select
          label="Select Shares to Redeem"
          options={shareHoldingOptions}
          value={selectedHoldingId}
          onChange={(e) => setSelectedHoldingId(e.target.value)}
          disabled={isLoading || !selectedVaultId}
        />

        {selectedHolding && (
          <Card className="p-3 bg-slate-900/50">
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Share Instrument:</span>
                <span className="font-mono">{selectedHolding.payload.instrument?.id?.unpack || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Available Shares:</span>
                <span className="text-blue-400 font-semibold">{selectedHolding.payload.amount}</span>
              </div>
            </div>
          </Card>
        )}

        <Input
          label="Shares Amount"
          type="number"
          step="0.01"
          min="0"
          placeholder="Enter shares to redeem"
          value={sharesAmount}
          onChange={(e) => setSharesAmount(e.target.value)}
          disabled={isLoading || !selectedHoldingId}
        />

        {selectedHolding && sharesAmount && (
          <div className="text-sm text-slate-400">
            Remaining after redemption: {(parseFloat(selectedHolding.payload.amount) - parseFloat(sharesAmount || '0')).toFixed(2)}
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
            loading={createRedeemRequest.isPending}
            disabled={isLoading || !selectedVaultId || !selectedHoldingId || !sharesAmount}
          >
            Create Redeem Request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
