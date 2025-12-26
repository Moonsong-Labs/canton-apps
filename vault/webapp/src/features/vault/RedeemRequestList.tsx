import { useState } from 'react';
import { useRedeemRequests, useDeclineRedeem, useCancelRedeem } from '@/hooks/useContracts';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { formatPartyId } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { MakeRedeemForm } from './MakeRedeemForm';
import { useLedgerClient } from '@/hooks/useLedger';
import { TemplateIds } from '@sdk/vault-api';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/constants';

export function RedeemRequestList() {
  const { party } = useAuth();
  const { data: redeemRequests, isLoading, error } = useRedeemRequests();
  const [showMakeRedeemForm, setShowMakeRedeemForm] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const client = useLedgerClient();
  const queryClient = useQueryClient();
  const declineRedeem = useDeclineRedeem();
  const cancelRedeem = useCancelRedeem();

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
          Error loading redeem requests: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </Card>
    );
  }

  if (!redeemRequests || redeemRequests.length === 0) {
    return (
      <>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Redeem Requests</h2>
          <Button onClick={() => setShowMakeRedeemForm(true)}>
            Redeem Shares
          </Button>
        </div>
        <Card>
          <div className="text-gray-500 text-center py-8">
            No redeem requests found
          </div>
        </Card>
        <MakeRedeemForm
          isOpen={showMakeRedeemForm}
          onClose={() => setShowMakeRedeemForm(false)}
        />
      </>
    );
  }

  const handleAccept = async (contractId: string, operator: string, shareCustodian: string) => {
    if (!client) return;
    
    setAcceptingId(contractId);
    try {
      // Accept requires both operator AND shareCustodian to authorize
      await client.exercise(
        TemplateIds.Vault_Redeem_RedeemRequest,
        contractId as any,
        'Accept',
        {},
        [operator, shareCustodian]  // Act as both parties
      );
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts(TemplateIds.Vault_Redeem_RedeemRequest, party || undefined) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts(TemplateIds.Holding_TransferableFungible, party || undefined) });
    } catch (err) {
      console.error('Failed to accept redemption:', err);
      alert(err instanceof Error ? err.message : 'Failed to accept redemption');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDecline = async (contractId: string) => {
    try {
      await declineRedeem.mutateAsync({
        contractId,
        args: {}
      });
    } catch (err) {
      console.error('Failed to decline redemption:', err);
    }
  };

  const handleCancel = async (contractId: string) => {
    try {
      await cancelRedeem.mutateAsync({
        contractId,
        args: {}
      });
    } catch (err) {
      console.error('Failed to cancel redemption:', err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Redeem Requests</h2>
        <div className="flex items-center gap-3">
          <Badge variant="default">{redeemRequests.length} requests</Badge>
          <Button onClick={() => setShowMakeRedeemForm(true)}>
            Redeem Shares
          </Button>
        </div>
      </div>

      <MakeRedeemForm
        isOpen={showMakeRedeemForm}
        onClose={() => setShowMakeRedeemForm(false)}
      />

      <div className="grid gap-4">
        {redeemRequests.map((contract) => {
          const isRedeemer = contract.payload.redeemer === party;
          const isOperator = contract.payload.operator === party;

          return (
            <Card key={contract.contractId} className="hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-semibold">
                      Redeem Request
                    </h3>
                    {isRedeemer && <Badge variant="info">Your Request</Badge>}
                    {isOperator && <Badge variant="success">Operator</Badge>}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <span className="text-gray-500 text-sm">Shares Amount</span>
                      <div className="font-mono text-lg font-semibold text-blue-600">
                        {contract.payload.sharesAmount}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">Vault ID</span>
                      <div className="font-mono text-sm">
                        {contract.payload.vaultId.unpack}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">Redeemer</span>
                      <div className="font-mono text-xs">
                        {formatPartyId(contract.payload.redeemer)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-500">Operator:</span>
                      <div className="font-mono text-xs">{formatPartyId(contract.payload.operator)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Share Custodian:</span>
                      <div className="font-mono text-xs">{formatPartyId((contract.payload as any).shareCustodian || contract.payload.custodian)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Share Account:</span>
                      <div className="font-mono text-xs">{((contract.payload as any).shareAccount?.id?.unpack || (contract.payload as any).redeemerAccount?.id?.unpack)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Share Holding CID:</span>
                      <div className="font-mono text-xs truncate">{contract.payload.shareHoldingCid}</div>
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
                            (contract.payload as any).shareCustodian || contract.payload.custodian
                          )}
                          disabled={acceptingId === contract.contractId}
                        >
                          {acceptingId === contract.contractId ? 'Accepting...' : 'Accept'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDecline(contract.contractId)}
                          disabled={declineRedeem.isPending}
                        >
                          {declineRedeem.isPending ? 'Declining...' : 'Decline'}
                        </Button>
                      </>
                    )}
                    {isRedeemer && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleCancel(contract.contractId)}
                        disabled={cancelRedeem.isPending}
                      >
                        {cancelRedeem.isPending ? 'Canceling...' : 'Cancel'}
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
