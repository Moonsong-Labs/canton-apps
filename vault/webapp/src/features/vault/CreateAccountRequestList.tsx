import { useState } from 'react';
import {
  useCreateAccountRequests,
  useAcceptAccountRequest,
  useDeclineAccountRequest,
  useWithdrawAccountRequest,
  useCreateAccountRequest
} from '@/hooks/useContracts';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { formatPartyId } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

export function CreateAccountRequestList() {
  const { party } = useAuth();
  const { data: requests, isLoading, error } = useCreateAccountRequests();
  const acceptRequest = useAcceptAccountRequest();
  const declineRequest = useDeclineAccountRequest();
  const withdrawRequest = useWithdrawAccountRequest();
  const createRequest = useCreateAccountRequest();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [custodian, setCustodian] = useState('');

  // Accept form fields
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [accountFactoryCid, setAccountFactoryCid] = useState('');
  const [holdingFactoryProvider, setHoldingFactoryProvider] = useState('');
  const [observersInput, setObserversInput] = useState('');

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
          Error loading account requests: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </Card>
    );
  }

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!party || !custodian) return;

    try {
      await createRequest.mutateAsync({
        custodian: custodian,
        owner: party
      });
      setShowCreateModal(false);
      setCustodian('');
    } catch (err) {
      console.error('Failed to create account request:', err);
    }
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    const observers = observersInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    try {
      await acceptRequest.mutateAsync({
        contractId: selectedRequest,
        args: {
          label,
          description,
          accountFactoryCid,
          holdingFactory: {
            provider: holdingFactoryProvider,
            id: { unpack: 'HoldingFactory' }
          },
          observers
        } as any
      });
      setShowAcceptModal(false);
      resetAcceptForm();
    } catch (err) {
      console.error('Failed to accept account request:', err);
    }
  };

  const handleDecline = async (contractId: string) => {
    try {
      await declineRequest.mutateAsync({
        contractId,
        args: {}
      });
    } catch (err) {
      console.error('Failed to decline account request:', err);
    }
  };

  const handleWithdraw = async (contractId: string) => {
    try {
      await withdrawRequest.mutateAsync({
        contractId,
        args: {}
      });
    } catch (err) {
      console.error('Failed to withdraw account request:', err);
    }
  };

  const openAcceptModal = (contractId: string) => {
    setSelectedRequest(contractId);
    setShowAcceptModal(true);
  };

  const resetAcceptForm = () => {
    setSelectedRequest(null);
    setLabel('');
    setDescription('');
    setAccountFactoryCid('');
    setHoldingFactoryProvider('');
    setObserversInput('');
  };

  if (!requests || requests.length === 0) {
    return (
      <>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Account Creation Requests</h2>
          <Button onClick={() => setShowCreateModal(true)}>
            Create Request
          </Button>
        </div>
        <Card>
          <div className="text-gray-500 text-center py-8">
            No account creation requests found
          </div>
        </Card>
        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Account Request">
          <form onSubmit={handleCreateRequest} className="space-y-4">
            <Input
              label="Custodian Party"
              value={custodian}
              onChange={(e) => setCustodian(e.target.value)}
              placeholder="Enter custodian party ID"
              required
            />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
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
        <h2 className="text-2xl font-bold">Account Creation Requests</h2>
        <div className="flex items-center gap-3">
          <Badge variant="default">{requests.length} requests</Badge>
          <Button onClick={() => setShowCreateModal(true)}>
            Create Request
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {requests.map((contract) => {
          const isOwner = contract.payload.owner === party;
          const isCustodian = contract.payload.custodian === party;

          return (
            <Card key={contract.contractId} className="hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-semibold">Account Creation Request</h3>
                    {isOwner && <Badge variant="info">Requester</Badge>}
                    {isCustodian && <Badge variant="success">Custodian</Badge>}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <span className="text-gray-500 text-sm">Owner</span>
                      <div className="font-mono text-sm">
                        {formatPartyId(contract.payload.owner)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">Custodian</span>
                      <div className="font-mono text-sm">
                        {formatPartyId(contract.payload.custodian)}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {isCustodian && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => openAcceptModal(contract.contractId)}
                          disabled={acceptRequest.isPending}
                        >
                          Accept
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

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Account Request">
        <form onSubmit={handleCreateRequest} className="space-y-4">
          <Input
            label="Custodian Party"
            value={custodian}
            onChange={(e) => setCustodian(e.target.value)}
            placeholder="Enter custodian party ID"
            required
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createRequest.isPending}>
              Create Request
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showAcceptModal} onClose={() => { setShowAcceptModal(false); resetAcceptForm(); }} title="Accept Account Request">
        <form onSubmit={handleAccept} className="space-y-4">
          <Input
            label="Account Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Enter account label"
            required
          />
          <Input
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter description"
            required
          />
          <Input
            label="Account Factory Contract ID"
            value={accountFactoryCid}
            onChange={(e) => setAccountFactoryCid(e.target.value)}
            placeholder="Enter account factory contract ID"
            required
          />
          <Input
            label="Holding Factory Provider"
            value={holdingFactoryProvider}
            onChange={(e) => setHoldingFactoryProvider(e.target.value)}
            placeholder="Enter holding factory provider party"
            required
          />
          <Input
            label="Observers (comma-separated)"
            value={observersInput}
            onChange={(e) => setObserversInput(e.target.value)}
            placeholder="party1, party2, party3"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => { setShowAcceptModal(false); resetAcceptForm(); }}>
              Cancel
            </Button>
            <Button type="submit" loading={acceptRequest.isPending}>
              Accept
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
