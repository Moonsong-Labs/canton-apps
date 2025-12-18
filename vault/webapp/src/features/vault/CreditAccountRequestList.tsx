import { useState } from 'react';
import {
  useCreditAccountRequests,
  useAcceptCreditAccountRequest,
  useDeclineCreditAccountRequest,
  useWithdrawCreditAccountRequest,
  useCreateCreditAccountRequest,
  useAccounts
} from '@/hooks/useContracts';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatPartyId } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useMemo } from 'react';

export function CreditAccountRequestList() {
  const { party } = useAuth();
  const { data: requests, isLoading, error } = useCreditAccountRequests();
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const acceptRequest = useAcceptCreditAccountRequest();
  const declineRequest = useDeclineCreditAccountRequest();
  const withdrawRequest = useWithdrawCreditAccountRequest();
  const createRequest = useCreateCreditAccountRequest();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [instrumentDepository, setInstrumentDepository] = useState('');
  const [instrumentIssuer, setInstrumentIssuer] = useState('');
  const [instrumentId, setInstrumentId] = useState('');
  const [instrumentVersion, setInstrumentVersion] = useState('0');
  const [holdingStandard, setHoldingStandard] = useState('TransferableFungible');
  const [amount, setAmount] = useState('');

  // Get unique custodians/issuers from accounts for instrument presets
  const knownParties = useMemo(() => {
    if (!accounts) return { bank: '', vault: '' };
    const parties: { bank: string; vault: string } = { bank: '', vault: '' };
    accounts.forEach((a: any) => {
      const custodianName = a.payload.custodian?.split('::')[0] || '';
      if (custodianName === 'Bank' && !parties.bank) {
        parties.bank = a.payload.custodian;
      } else if (custodianName === 'Vault' && !parties.vault) {
        parties.vault = a.payload.custodian;
      }
    });
    return parties;
  }, [accounts]);

  // Auto-fill instrument details based on preset selection
  const handleInstrumentPreset = (preset: 'LNRD' | 'USD' | 'VAULT-SHARE' | 'custom') => {
    if (preset === 'LNRD' && knownParties.bank) {
      setInstrumentDepository(knownParties.bank);
      setInstrumentIssuer(knownParties.bank);
      setInstrumentId('LNRD');
      setInstrumentVersion('0');
      setHoldingStandard('TransferableFungible');
    } else if (preset === 'USD' && knownParties.vault) {
      setInstrumentDepository(knownParties.vault);
      setInstrumentIssuer(knownParties.vault);
      setInstrumentId('USD');
      setInstrumentVersion('0');
      setHoldingStandard('TransferableFungible');
    } else if (preset === 'VAULT-SHARE' && knownParties.vault) {
      setInstrumentDepository(knownParties.vault);
      setInstrumentIssuer(knownParties.vault);
      setInstrumentId('VAULT-SHARE');
      setInstrumentVersion('0');
      setHoldingStandard('TransferableFungible');
    } else {
      // Custom - clear fields
      setInstrumentDepository('');
      setInstrumentIssuer('');
      setInstrumentId('');
      setInstrumentVersion('0');
      setHoldingStandard('TransferableFungible');
    }
  };

  const userAccounts = useMemo(() => {
    if (!accounts || !party) return [];
    return accounts.filter((a: any) => a.payload.owner === party);
  }, [accounts, party]);

  const accountOptions = useMemo(() => {
    if (!userAccounts) return [{ value: '', label: 'Select an account...' }];
    return [
      { value: '', label: 'Select an account...' },
      ...userAccounts.map((a: any) => ({
        value: a.contractId,
        label: `${a.payload.id?.unpack || 'Unknown'} (${formatPartyId(a.payload.custodian)})`
      }))
    ];
  }, [userAccounts]);

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
          Error loading credit account requests: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </Card>
    );
  }

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) return;

    const account = userAccounts.find((a: any) => a.contractId === selectedAccountId);
    if (!account) return;

    try {
      await createRequest.mutateAsync({
        account: {
          custodian: account.payload.custodian,
          owner: account.payload.owner,
          id: account.payload.id
        },
        instrument: {
          depository: instrumentDepository,
          issuer: instrumentIssuer,
          id: { unpack: instrumentId },
          version: instrumentVersion,
          holdingStandard: holdingStandard as any
        },
        amount: amount
      });
      setShowCreateModal(false);
      resetCreateForm();
    } catch (err) {
      console.error('Failed to create credit account request:', err);
    }
  };

  const handleAccept = async (contractId: string) => {
    try {
      await acceptRequest.mutateAsync({
        contractId,
        args: {}
      });
    } catch (err) {
      console.error('Failed to accept credit account request:', err);
    }
  };

  const handleDecline = async (contractId: string) => {
    try {
      await declineRequest.mutateAsync({
        contractId,
        args: {}
      });
    } catch (err) {
      console.error('Failed to decline credit account request:', err);
    }
  };

  const handleWithdraw = async (contractId: string) => {
    try {
      await withdrawRequest.mutateAsync({
        contractId,
        args: {}
      });
    } catch (err) {
      console.error('Failed to withdraw credit account request:', err);
    }
  };

  const resetCreateForm = () => {
    setSelectedAccountId('');
    setInstrumentDepository('');
    setInstrumentIssuer('');
    setInstrumentId('');
    setInstrumentVersion('0');
    setHoldingStandard('TransferableFungible');
    setAmount('');
  };

  if (!requests || requests.length === 0) {
    return (
      <>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Credit Account Requests</h2>
          <Button onClick={() => setShowCreateModal(true)}>
            Create Request
          </Button>
        </div>
        <Card>
          <div className="text-gray-500 text-center py-8">
            No credit account requests found
          </div>
        </Card>
        <Modal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); resetCreateForm(); }} title="Create Credit Account Request">
          <form onSubmit={handleCreateRequest} className="space-y-4">
            <Select
              label="Select Account"
              options={accountOptions}
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              disabled={loadingAccounts}
            />
            
            {/* Instrument Presets */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Quick Select Instrument</label>
              <div className="flex gap-2 flex-wrap">
                <Button 
                  type="button" 
                  size="sm" 
                  variant={instrumentId === 'LNRD' ? 'primary' : 'secondary'}
                  onClick={() => handleInstrumentPreset('LNRD')}
                  disabled={!knownParties.bank}
                  title={knownParties.bank ? 'Lunar Dollars (Bank)' : 'Bank party not found'}
                >
                  🌙 LNRD
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant={instrumentId === 'USD' ? 'primary' : 'secondary'}
                  onClick={() => handleInstrumentPreset('USD')}
                  disabled={!knownParties.vault}
                  title={knownParties.vault ? 'USD Stablecoin (Vault)' : 'Vault party not found'}
                >
                  💵 USD
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant={instrumentId === 'VAULT-SHARE' ? 'primary' : 'secondary'}
                  onClick={() => handleInstrumentPreset('VAULT-SHARE')}
                  disabled={!knownParties.vault}
                  title={knownParties.vault ? 'Vault Shares (Vault)' : 'Vault party not found'}
                >
                  🏦 VAULT-SHARE
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost"
                  onClick={() => handleInstrumentPreset('custom')}
                >
                  ✏️ Custom
                </Button>
              </div>
            </div>

            <Input
              label="Instrument Depository"
              value={instrumentDepository}
              onChange={(e) => setInstrumentDepository(e.target.value)}
              placeholder="Enter depository party"
              required
            />
            <Input
              label="Instrument Issuer"
              value={instrumentIssuer}
              onChange={(e) => setInstrumentIssuer(e.target.value)}
              placeholder="Enter issuer party"
              required
            />
            <Input
              label="Instrument ID"
              value={instrumentId}
              onChange={(e) => setInstrumentId(e.target.value)}
              placeholder="Enter instrument ID"
              required
            />
            <Input
              label="Instrument Version"
              value={instrumentVersion}
              onChange={(e) => setInstrumentVersion(e.target.value)}
              placeholder="0"
              required
            />
            <Select
              label="Holding Standard"
              options={[
                { value: 'TransferableFungible', label: 'Transferable Fungible' },
                { value: 'Fungible', label: 'Fungible' },
                { value: 'Transferable', label: 'Transferable' },
                { value: 'BaseHolding', label: 'Base Holding' }
              ]}
              value={holdingStandard}
              onChange={(e) => setHoldingStandard(e.target.value)}
            />
            <Input
              label="Amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              required
            />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => { setShowCreateModal(false); resetCreateForm(); }}>
                Cancel
              </Button>
              <Button type="submit" loading={createRequest.isPending}>
                Create Request
              </Button>
            </div>
          </form>
        </Modal>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Credit Account Requests</h2>
        <div className="flex items-center gap-3">
          <Badge variant="default">{requests.length} requests</Badge>
          <Button onClick={() => setShowCreateModal(true)}>
            Create Request
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {requests.map((contract) => {
          const isOwner = contract.payload.account.owner === party;
          const isCustodian = contract.payload.account.custodian === party;

          return (
            <Card key={contract.contractId} className="hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-semibold">Credit Account Request</h3>
                    {isOwner && <Badge variant="info">Requester</Badge>}
                    {isCustodian && <Badge variant="success">Custodian</Badge>}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <span className="text-gray-500 text-sm">Account</span>
                      <div className="font-mono text-sm">
                        {contract.payload.account.id.unpack}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">Amount</span>
                      <div className="font-mono text-lg font-semibold text-green-600">
                        {contract.payload.amount}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">Instrument</span>
                      <div className="font-mono text-xs">
                        {contract.payload.instrument.id.unpack}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">Issuer</span>
                      <div className="font-mono text-xs">
                        {formatPartyId(contract.payload.instrument.issuer)}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {isCustodian && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleAccept(contract.contractId)}
                          disabled={acceptRequest.isPending}
                        >
                          {acceptRequest.isPending ? 'Accepting...' : 'Accept'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDecline(contract.contractId)}
                          disabled={declineRequest.isPending}
                        >
                          {declineRequest.isPending ? 'Declining...' : 'Decline'}
                        </Button>
                      </>
                    )}
                    {isOwner && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleWithdraw(contract.contractId)}
                        disabled={withdrawRequest.isPending}
                      >
                        {withdrawRequest.isPending ? 'Withdrawing...' : 'Withdraw'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); resetCreateForm(); }} title="Create Credit Account Request">
        <form onSubmit={handleCreateRequest} className="space-y-4">
          <Select
            label="Select Account"
            options={accountOptions}
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            disabled={loadingAccounts}
          />
          
          {/* Instrument Presets */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Quick Select Instrument</label>
            <div className="flex gap-2 flex-wrap">
              <Button 
                type="button" 
                size="sm" 
                variant={instrumentId === 'LNRD' ? 'primary' : 'secondary'}
                onClick={() => handleInstrumentPreset('LNRD')}
                disabled={!knownParties.bank}
                title={knownParties.bank ? 'Lunar Dollars (Bank)' : 'Bank party not found'}
              >
                🌙 LNRD
              </Button>
              <Button 
                type="button" 
                size="sm" 
                variant={instrumentId === 'USD' ? 'primary' : 'secondary'}
                onClick={() => handleInstrumentPreset('USD')}
                disabled={!knownParties.vault}
                title={knownParties.vault ? 'USD Stablecoin (Vault)' : 'Vault party not found'}
              >
                💵 USD
              </Button>
              <Button 
                type="button" 
                size="sm" 
                variant={instrumentId === 'VAULT-SHARE' ? 'primary' : 'secondary'}
                onClick={() => handleInstrumentPreset('VAULT-SHARE')}
                disabled={!knownParties.vault}
                title={knownParties.vault ? 'Vault Shares (Vault)' : 'Vault party not found'}
              >
                🏦 VAULT-SHARE
              </Button>
              <Button 
                type="button" 
                size="sm" 
                variant="ghost"
                onClick={() => handleInstrumentPreset('custom')}
              >
                ✏️ Custom
              </Button>
            </div>
          </div>

          <Input
            label="Instrument Depository"
            value={instrumentDepository}
            onChange={(e) => setInstrumentDepository(e.target.value)}
            placeholder="Enter depository party"
            required
          />
          <Input
            label="Instrument Issuer"
            value={instrumentIssuer}
            onChange={(e) => setInstrumentIssuer(e.target.value)}
            placeholder="Enter issuer party"
            required
          />
          <Input
            label="Instrument ID"
            value={instrumentId}
            onChange={(e) => setInstrumentId(e.target.value)}
            placeholder="Enter instrument ID"
            required
          />
          <Input
            label="Instrument Version"
            value={instrumentVersion}
            onChange={(e) => setInstrumentVersion(e.target.value)}
            placeholder="0"
            required
          />
          <Select
            label="Holding Standard"
            options={[
              { value: 'TransferableFungible', label: 'Transferable Fungible' },
              { value: 'Fungible', label: 'Fungible' },
              { value: 'Transferable', label: 'Transferable' },
              { value: 'BaseHolding', label: 'Base Holding' }
            ]}
            value={holdingStandard}
            onChange={(e) => setHoldingStandard(e.target.value)}
          />
          <Input
            label="Amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            required
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => { setShowCreateModal(false); resetCreateForm(); }}>
              Cancel
            </Button>
            <Button type="submit" loading={createRequest.isPending}>
              Create Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
