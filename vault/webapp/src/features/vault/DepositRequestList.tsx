import { useState } from 'react';
import { useDepositRequests, useDeclineDeposit, useCancelDeposit } from '@/hooks/useContracts';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { formatPartyId } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { MakeDepositForm } from './MakeDepositForm';
import { useLedgerClient } from '@/hooks/useLedger';
import { TemplateIds } from '@sdk/vault-api';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/constants';

export function DepositRequestList() {
  const { party } = useAuth();
  const { data: depositRequests, isLoading, error } = useDepositRequests();
  const [showMakeDepositForm, setShowMakeDepositForm] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const client = useLedgerClient();
  const queryClient = useQueryClient();
  const declineDeposit = useDeclineDeposit();
  const cancelDeposit = useCancelDeposit();

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
          Error loading deposit requests: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </Card>
    );
  }

  if (!depositRequests || depositRequests.length === 0) {
    return (
      <>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Deposit Requests</h2>
          <Button onClick={() => setShowMakeDepositForm(true)}>
            💰 Make Deposit
          </Button>
        </div>
        <Card>
          <div className="text-gray-500 text-center py-8">
            No deposit requests found
          </div>
        </Card>
        <MakeDepositForm
          isOpen={showMakeDepositForm}
          onClose={() => setShowMakeDepositForm(false)}
        />
      </>
    );
  }

  const handleAccept = async (contractId: string, operator: string, custodian: string) => {
    if (!client) return;
    
    setAcceptingId(contractId);
    try {
      // Accept requires both operator AND custodian to authorize
      // Use multi-party submission with both parties
      await client.exercise(
        TemplateIds.Vault_Deposit_DepositRequest,
        contractId as any,
        'Accept',
        {},
        [operator, custodian]  // Act as both parties
      );
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts(TemplateIds.Vault_Deposit_DepositRequest, party || undefined) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts(TemplateIds.Holding_TransferableFungible, party || undefined) });
    } catch (err) {
      console.error('Failed to accept deposit:', err);
      alert(err instanceof Error ? err.message : 'Failed to accept deposit');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDecline = async (contractId: string) => {
    try {
      await declineDeposit.mutateAsync({
        contractId,
        args: {}
      });
    } catch (err) {
      console.error('Failed to decline deposit:', err);
    }
  };

  const handleCancel = async (contractId: string) => {
    try {
      await cancelDeposit.mutateAsync({
        contractId,
        args: {}
      });
    } catch (err) {
      console.error('Failed to cancel deposit:', err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Deposit Requests</h2>
        <div className="flex items-center gap-3">
          <Badge variant="default">{depositRequests.length} requests</Badge>
          <Button onClick={() => setShowMakeDepositForm(true)}>
            💰 Make Deposit
          </Button>
        </div>
      </div>

      <MakeDepositForm
        isOpen={showMakeDepositForm}
        onClose={() => setShowMakeDepositForm(false)}
      />

      <div className="grid gap-4">
        {depositRequests.map((contract) => {
          const isDepositor = contract.payload.depositor === party;
          const isOperator = contract.payload.operator === party;

          return (
            <Card key={contract.contractId} className="hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-semibold">
                      Deposit Request
                    </h3>
                    {isDepositor && <Badge variant="info">Your Request</Badge>}
                    {isOperator && <Badge variant="success">Operator</Badge>}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <span className="text-gray-500 text-sm">Amount</span>
                      <div className="font-mono text-lg font-semibold text-green-600">
                        {contract.payload.amount}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">Vault ID</span>
                      <div className="font-mono text-sm">
                        {contract.payload.vaultId.unpack}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">Depositor</span>
                      <div className="font-mono text-xs">
                        {formatPartyId(contract.payload.depositor)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-500">Operator:</span>
                      <div className="font-mono text-xs">{formatPartyId(contract.payload.operator)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Custodian:</span>
                      <div className="font-mono text-xs">{formatPartyId(contract.payload.custodian)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Depositor Account:</span>
                      <div className="font-mono text-xs">{contract.payload.depositorAccount.id.unpack}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Holding CID:</span>
                      <div className="font-mono text-xs truncate">{contract.payload.depositHoldingCid}</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {isOperator && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleAccept(
                            contract.contractId,
                            contract.payload.operator,
                            contract.payload.custodian
                          )}
                          disabled={acceptingId === contract.contractId}
                        >
                          {acceptingId === contract.contractId ? 'Accepting...' : 'Accept'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDecline(contract.contractId)}
                          disabled={declineDeposit.isPending}
                        >
                          {declineDeposit.isPending ? 'Declining...' : 'Decline'}
                        </Button>
                      </>
                    )}
                    {isDepositor && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleCancel(contract.contractId)}
                        disabled={cancelDeposit.isPending}
                      >
                        {cancelDeposit.isPending ? 'Canceling...' : 'Cancel'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
