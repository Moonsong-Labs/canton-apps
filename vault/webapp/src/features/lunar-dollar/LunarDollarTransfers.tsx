import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useContractQuery, useLedgerClient } from '@/hooks/useLedger';
import { Card, Button, Input, Spinner } from '@/components/ui';
import { PartyBadge } from '@/components/shared';
import { QUERY_KEYS } from '@/lib/constants';
import { 
  TemplateIds, 
  TransferRequest, 
  Holding_TransferableFungible,
} from '@lunar-dollar/lunar-dollar-api';
import type { Id, InstrumentKey } from '@lunar-dollar/core/interfaces';
import type { Party, ContractId } from '@lunar-dollar/core/primitives';

interface TransferRequestContract {
  contractId: string;
  payload: TransferRequest.Payload;
}

interface HoldingContract {
  contractId: string;
  payload: Holding_TransferableFungible.Payload;
}

// Helper to shorten party IDs for display
function shortenParty(party: string): string {
  if (party.includes('::')) {
    const [name] = party.split('::');
    return name;
  }
  return party.length > 20 ? `${party.slice(0, 8)}...${party.slice(-8)}` : party;
}

export function LunarDollarTransfers() {
  const { party } = useAuth();
  const client = useLedgerClient();
  const queryClient = useQueryClient();

  // Form state
  const [receiverName, setReceiverName] = useState('');
  const [amount, setAmount] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  // Query transfer requests
  const { data: transferRequests, isLoading: loadingRequests } = useContractQuery<TransferRequest.Payload>(
    TemplateIds.TransferRequest
  );

  // Query holdings for accepting transfers
  const { data: holdings, isLoading: loadingHoldings } = useContractQuery<Holding_TransferableFungible.Payload>(
    TemplateIds.Holding_TransferableFungible
  );

  // Get instrument key from holdings only
  // (LunarDollar contract is only visible to Bank, not to regular users)
  // We only trust holdings because they have the correct full party IDs
  const getInstrumentKeyFromHoldings = (): InstrumentKey | null => {
    const holdingsList = holdings as HoldingContract[] || [];
    const lnrdHolding = holdingsList.find(h => h.payload.instrument?.id?.unpack === 'LNRD');
    if (lnrdHolding) return lnrdHolding.payload.instrument;
    return null;
  };

  // Get only LNRD holdings
  const lnrdHoldings = (holdings as HoldingContract[] || []).filter(
    h => h.payload.instrument?.id?.unpack === 'LNRD'
  );

  // Separate incoming (I need to accept) and outgoing (I created) requests
  const incomingRequests = (transferRequests as TransferRequestContract[] || []).filter(
    r => r.payload.currentOwner === party
  );
  const outgoingRequests = (transferRequests as TransferRequestContract[] || []).filter(
    r => r.payload.receiverAccount?.owner === party
  );

  // Calculate total LNRD balance
  const totalBalance = lnrdHoldings.reduce((sum, h) => {
    const amt = typeof h.payload.amount === 'string' ? parseFloat(h.payload.amount) : h.payload.amount;
    return sum + (amt || 0);
  }, 0);

  // Find a suitable LNRD holding to use for transfer
  const findHoldingForAmount = (requestAmount: number): HoldingContract | null => {
    // First try to find an exact match
    const exact = lnrdHoldings.find(h => {
      const amt = typeof h.payload.amount === 'string' ? parseFloat(h.payload.amount) : h.payload.amount;
      return amt === requestAmount;
    });
    if (exact) return exact;
    // Otherwise find one with enough balance
    return lnrdHoldings.find(h => {
      const amt = typeof h.payload.amount === 'string' ? parseFloat(h.payload.amount) : h.payload.amount;
      return amt >= requestAmount;
    }) || null;
  };

  // Create a new transfer request
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !party || !receiverName || !amount) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      // Get the LNRD instrument key from holdings (they have correct full party IDs)
      let instrumentKey = getInstrumentKeyFromHoldings();
      
      // Query accounts to find the sender's account and get bank info
      const accounts = await client.query<{ owner: Party; custodian: Party; id: Id }>(TemplateIds.Account, {});
      const accountList = accounts as unknown as { contractId: string; payload: { owner: Party; custodian: Party; id: Id } }[];
      
      // Find the sender's account (the party we're requesting FROM)
      const senderAccount = accountList?.find(a => {
        const ownerName = shortenParty(a.payload.owner);
        return ownerName.toLowerCase() === receiverName.toLowerCase();
      });

      if (!senderAccount) {
        throw new Error(`Could not find account for "${receiverName}". Make sure the party exists and has an account.`);
      }

      // If we don't have an instrument key yet, construct a default LNRD key
      // using the Bank as issuer/depository (custodian from accounts)
      if (!instrumentKey) {
        const bankParty = senderAccount.payload.custodian;
        instrumentKey = {
          issuer: bankParty,
          depository: bankParty,
          id: { unpack: 'LNRD' },
          version: '0',
          holdingStandard: 'TransferableFungible',
        } as InstrumentKey;
      }

      // Find our own account
      const myAccount = accountList?.find(a => {
        return a.payload.owner === party;
      });

      if (!myAccount) {
        throw new Error('Could not find your account. Make sure you have an account set up.');
      }

      // Create the transfer request (as the receiver requesting funds)
      // Note: In this flow, the current user is requesting TO RECEIVE funds
      const payload: TransferRequest.Payload = {
        receiverAccount: {
          custodian: myAccount.payload.custodian,
          owner: party as Party,
          id: myAccount.payload.id,
        },
        instrument: instrumentKey,
        amount: amount,
        currentOwner: senderAccount.payload.owner,
      };

      await client.create(TemplateIds.TransferRequest, payload);
      
      // Refresh queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts(TemplateIds.TransferRequest, party || undefined) });
      
      // Reset form
      setReceiverName('');
      setAmount('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create transfer request');
    } finally {
      setIsCreating(false);
    }
  };

  // Check if two instrument keys match (comparing issuer/depository)
  const instrumentKeysMatch = (a: InstrumentKey | undefined, b: InstrumentKey | undefined): boolean => {
    if (!a || !b) return false;
    return a.issuer === b.issuer && 
           a.depository === b.depository && 
           a.id?.unpack === b.id?.unpack &&
           a.version === b.version;
  };

  // Accept an incoming transfer request
  const handleAccept = async (request: TransferRequestContract) => {
    if (!client) return;

    const requestAmount = typeof request.payload.amount === 'string' 
      ? parseFloat(request.payload.amount) 
      : request.payload.amount;

    const holding = findHoldingForAmount(requestAmount);
    if (!holding) {
      alert(`Insufficient balance to accept this transfer. You need at least ${requestAmount} LNRD.`);
      return;
    }

    // Check if instrument keys match - they must match exactly for the transfer to work
    if (!instrumentKeysMatch(request.payload.instrument, holding.payload.instrument)) {
      alert(
        `⚠️ Instrument key mismatch!\n\n` +
        `This transfer request was created with incorrect party IDs and cannot be accepted.\n\n` +
        `Request issuer: ${request.payload.instrument?.issuer}\n` +
        `Holding issuer: ${holding.payload.instrument?.issuer}\n\n` +
        `Please DECLINE this request. The sender needs to create a new transfer request.`
      );
      return;
    }

    setAcceptingId(request.contractId);
    try {
      await client.exercise(
        TemplateIds.TransferRequest,
        request.contractId as ContractId<TransferRequest.Payload>,
        'Accept',
        { holdingCid: holding.contractId }
      );
      
      // Refresh queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts(TemplateIds.TransferRequest, party || undefined) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts(TemplateIds.Holding_TransferableFungible, party || undefined) });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to accept transfer');
    } finally {
      setAcceptingId(null);
    }
  };

  // Decline an incoming transfer request
  const handleDecline = async (request: TransferRequestContract) => {
    if (!client) return;

    setDecliningId(request.contractId);
    try {
      await client.exercise(
        TemplateIds.TransferRequest,
        request.contractId as ContractId<TransferRequest.Payload>,
        'Decline',
        {}
      );
      
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts(TemplateIds.TransferRequest, party || undefined) });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to decline transfer');
    } finally {
      setDecliningId(null);
    }
  };

  // Withdraw an outgoing transfer request
  const handleWithdraw = async (request: TransferRequestContract) => {
    if (!client) return;

    setWithdrawingId(request.contractId);
    try {
      await client.exercise(
        TemplateIds.TransferRequest,
        request.contractId as ContractId<TransferRequest.Payload>,
        'Withdraw',
        {}
      );
      
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts(TemplateIds.TransferRequest, party || undefined) });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to withdraw transfer');
    } finally {
      setWithdrawingId(null);
    }
  };

  const isLoading = loadingRequests || loadingHoldings;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">LNRD Transfers</h2>
        <p className="text-slate-400">Send and receive Lunar Dollars</p>
      </div>

      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <h3 className="text-sm font-medium text-slate-400 mb-2">Current Party</h3>
          {party && <PartyBadge party={party} />}
        </Card>
        <Card className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border-indigo-700/50">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Available Balance</h3>
          <p className="text-2xl font-bold text-white">
            {totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-lg text-indigo-300 ml-2">LNRD</span>
          </p>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-slate-400 mb-2">Pending Requests</h3>
          <p className="text-2xl font-bold text-amber-400">
            {incomingRequests.length + outgoingRequests.length}
          </p>
        </Card>
      </div>

      {/* Request Transfer Form */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Request Transfer</h3>
        <p className="text-sm text-slate-400 mb-4">
          Request LNRD from another party. They will need to accept the request.
        </p>
        <form onSubmit={handleCreateRequest} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="From (Party Name)"
              placeholder="e.g., Alice"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              required
            />
            <Input
              label="Amount (LNRD)"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g., 100.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          {createError && (
            <p className="text-sm text-red-400">{createError}</p>
          )}
          <Button type="submit" loading={isCreating} disabled={!receiverName || !amount}>
            Request Transfer
          </Button>
        </form>
      </Card>

      {isLoading ? (
        <Card>
          <div className="flex items-center justify-center py-8">
            <Spinner />
            <span className="ml-3 text-slate-400">Loading transfers...</span>
          </div>
        </Card>
      ) : (
        <>
          {/* Incoming Requests */}
          <Card>
            <h3 className="text-lg font-semibold text-slate-200 mb-4">
              Incoming Requests
              {incomingRequests.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-amber-600 rounded-full">
                  {incomingRequests.length}
                </span>
              )}
            </h3>
            {incomingRequests.length === 0 ? (
              <p className="text-slate-400 text-center py-6">No incoming transfer requests</p>
            ) : (
              <div className="space-y-3">
                {incomingRequests.map((request) => {
                  const requestAmount = typeof request.payload.amount === 'string' 
                    ? parseFloat(request.payload.amount) 
                    : request.payload.amount;
                  const canAccept = totalBalance >= requestAmount;
                  
                  return (
                    <div 
                      key={request.contractId}
                      className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-600/20 flex items-center justify-center">
                          <span className="text-xl">📥</span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-200">
                            {shortenParty(request.payload.receiverAccount?.owner || '')} is requesting
                          </p>
                          <p className="text-sm text-slate-400">
                            {requestAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} LNRD
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleAccept(request)}
                          loading={acceptingId === request.contractId}
                          disabled={!canAccept || !!acceptingId}
                          title={canAccept ? 'Accept transfer' : 'Insufficient balance'}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDecline(request)}
                          loading={decliningId === request.contractId}
                          disabled={!!decliningId}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Outgoing Requests */}
          <Card>
            <h3 className="text-lg font-semibold text-slate-200 mb-4">
              Outgoing Requests
              {outgoingRequests.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-blue-600 rounded-full">
                  {outgoingRequests.length}
                </span>
              )}
            </h3>
            {outgoingRequests.length === 0 ? (
              <p className="text-slate-400 text-center py-6">No outgoing transfer requests</p>
            ) : (
              <div className="space-y-3">
                {outgoingRequests.map((request) => {
                  const requestAmount = typeof request.payload.amount === 'string' 
                    ? parseFloat(request.payload.amount) 
                    : request.payload.amount;
                  
                  return (
                    <div 
                      key={request.contractId}
                      className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
                          <span className="text-xl">📤</span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-200">
                            Requesting from {shortenParty(request.payload.currentOwner)}
                          </p>
                          <p className="text-sm text-slate-400">
                            {requestAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} LNRD
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-300">
                          Pending
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleWithdraw(request)}
                          loading={withdrawingId === request.contractId}
                          disabled={!!withdrawingId}
                        >
                          Withdraw
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

