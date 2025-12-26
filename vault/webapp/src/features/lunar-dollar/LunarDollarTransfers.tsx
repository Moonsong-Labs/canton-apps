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

  const [receiverName, setReceiverName] = useState('');
  const [amount, setAmount] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<{ id: string; message: string } | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const { data: transferRequests, isLoading: loadingRequests } = useContractQuery<TransferRequest.Payload>(
    TemplateIds.TransferRequest
  );

  const { data: holdings, isLoading: loadingHoldings } = useContractQuery<Holding_TransferableFungible.Payload>(
    TemplateIds.Holding_TransferableFungible
  );

  const getInstrumentKeyFromHoldings = (): InstrumentKey | null => {
    const holdingsList = holdings as HoldingContract[] || [];
    const lnrdHolding = holdingsList.find(h => h.payload.instrument?.id?.unpack === 'LNRD');
    if (lnrdHolding) return lnrdHolding.payload.instrument;
    return null;
  };

  const lnrdHoldings = (holdings as HoldingContract[] || []).filter(
    h => h.payload.instrument?.id?.unpack === 'LNRD'
  );

  const incomingRequests = (transferRequests as TransferRequestContract[] || []).filter(
    r => r.payload.currentOwner === party
  );
  const outgoingRequests = (transferRequests as TransferRequestContract[] || []).filter(
    r => r.payload.receiverAccount?.owner === party
  );

  const totalBalance = lnrdHoldings.reduce((sum, h) => {
    const amt = typeof h.payload.amount === 'string' ? parseFloat(h.payload.amount) : h.payload.amount;
    return sum + (amt || 0);
  }, 0);

  const findHoldingForAmount = (requestAmount: number): HoldingContract | null => {
    const exact = lnrdHoldings.find(h => {
      const amt = typeof h.payload.amount === 'string' ? parseFloat(h.payload.amount) : h.payload.amount;
      return amt === requestAmount;
    });
    if (exact) return exact;
    return lnrdHoldings.find(h => {
      const amt = typeof h.payload.amount === 'string' ? parseFloat(h.payload.amount) : h.payload.amount;
      return amt >= requestAmount;
    }) || null;
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !party || !receiverName || !amount) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      let instrumentKey = getInstrumentKeyFromHoldings();
      
      const accounts = await client.query<{ owner: Party; custodian: Party; id: Id }>(TemplateIds.Account, {});
      const accountList = accounts as unknown as { contractId: string; payload: { owner: Party; custodian: Party; id: Id } }[];
      
      const senderAccount = accountList?.find(a => {
        const ownerName = shortenParty(a.payload.owner);
        return ownerName.toLowerCase() === receiverName.toLowerCase();
      });

      if (!senderAccount) {
        throw new Error(`Could not find account for "${receiverName}". Make sure the party exists and has an account.`);
      }

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

      const myAccount = accountList?.find(a => {
        return a.payload.owner === party;
      });

      if (!myAccount) {
        throw new Error('Could not find your account. Make sure you have an account set up.');
      }

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
      
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts(TemplateIds.TransferRequest, party || undefined) });
      
      setReceiverName('');
      setAmount('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create transfer request');
    } finally {
      setIsCreating(false);
    }
  };

  const instrumentKeysMatch = (a: InstrumentKey | undefined, b: InstrumentKey | undefined): boolean => {
    if (!a || !b) return false;
    return a.issuer === b.issuer && 
           a.depository === b.depository && 
           a.id?.unpack === b.id?.unpack &&
           a.version === b.version;
  };

  const parseComplianceError = (errorMsg: string): string => {
    // Try to extract the compliance rejection reason from the error message
    const complianceMatch = errorMsg.match(/Transfer rejected by compliance:\s*\[([^\]]+)\]/i);
    if (complianceMatch) {
      return complianceMatch[1].replace(/"/g, '');
    }
    const blacklistMatch = errorMsg.match(/(Sender|Receiver) is blacklisted/i);
    if (blacklistMatch) {
      return `${blacklistMatch[1]} is blacklisted`;
    }
    return errorMsg;
  };

  const handleAccept = async (request: TransferRequestContract) => {
    if (!client) return;

    // Clear any previous error for this request
    setAcceptError(null);

    const requestAmount = typeof request.payload.amount === 'string' 
      ? parseFloat(request.payload.amount) 
      : request.payload.amount;

    const holding = findHoldingForAmount(requestAmount);
    if (!holding) {
      setAcceptError({
        id: request.contractId,
        message: `Insufficient balance. You need at least ${requestAmount} LNRD.`
      });
      return;
    }

    if (!instrumentKeysMatch(request.payload.instrument, holding.payload.instrument)) {
      setAcceptError({
        id: request.contractId,
        message: `Instrument key mismatch. Please DECLINE this request - the sender needs to create a new transfer request.`
      });
      return;
    }

    const bankParty = request.payload.instrument?.issuer;
    const senderParty = request.payload.currentOwner;
    
    if (!bankParty) {
      setAcceptError({
        id: request.contractId,
        message: 'Cannot determine Bank party from instrument.'
      });
      return;
    }
    if (!senderParty) {
      setAcceptError({
        id: request.contractId,
        message: 'Cannot determine sender party.'
      });
      return;
    }

    setAcceptingId(request.contractId);
    try {
      // Accept requires both currentOwner (sender) AND instrument.issuer (Bank)
      await client.exercise(
        TemplateIds.TransferRequest,
        request.contractId as ContractId<TransferRequest.Payload>,
        'Accept',
        { holdingCid: holding.contractId },
        [senderParty as Party, bankParty as Party]
      );
      
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts(TemplateIds.TransferRequest, party || undefined) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts(TemplateIds.Holding_TransferableFungible, party || undefined) });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to accept transfer';
      const isComplianceError = errorMsg.toLowerCase().includes('compliance') || 
                                errorMsg.toLowerCase().includes('blacklist') ||
                                errorMsg.toLowerCase().includes('rejected');
      
      setAcceptError({
        id: request.contractId,
        message: isComplianceError 
          ? `🚫 Blocked by compliance: ${parseComplianceError(errorMsg)}`
          : errorMsg
      });
    } finally {
      setAcceptingId(null);
    }
  };

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
      alert(err instanceof Error ? err.message : 'Failed to withdraw transfer request');
    } finally {
      setWithdrawingId(null);
    }
  };

  const isLoading = loadingRequests || loadingHoldings;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">LNRD Transfers</h2>
        <p className="text-slate-400">Request and manage Lunar Dollar transfers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <h3 className="text-sm font-medium text-slate-400 mb-2">Current Party</h3>
          {party && <PartyBadge party={party} />}
        </Card>
        <Card className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border-emerald-700/50">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Your Balance</h3>
          <p className="text-2xl font-bold text-white">{totalBalance.toLocaleString()} LNRD</p>
        </Card>
        <Card className="bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border-blue-700/50">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Incoming Requests</h3>
          <p className="text-2xl font-bold text-white">{incomingRequests.length}</p>
        </Card>
        <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-700/50">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Your Requests</h3>
          <p className="text-2xl font-bold text-white">{outgoingRequests.length}</p>
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Request Transfer</h3>
        <p className="text-sm text-slate-400 mb-4">
          Request LNRD from another party. They will need to accept the request.
          <br />
          <span className="text-amber-400">⚠️ All transfers are subject to compliance checks (blacklist, etc.)</span>
        </p>
        
        <form onSubmit={handleCreateRequest} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Request From (party name)"
              placeholder="e.g. Alice, Bob"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              required
            />
            <Input
              label="Amount (LNRD)"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="100.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          
          {createError && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
              {createError}
            </div>
          )}
          
          <Button type="submit" disabled={isCreating || !receiverName || !amount}>
            {isCreating ? (
              <>
                <Spinner className="w-4 h-4 mr-2" />
                Creating...
              </>
            ) : (
              'Create Transfer Request'
            )}
          </Button>
        </form>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-slate-200 mb-4">
          Incoming Transfer Requests
          <span className="ml-2 text-sm font-normal text-slate-400">
            (others are requesting LNRD from you)
          </span>
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
            <span className="ml-3 text-slate-400">Loading...</span>
          </div>
        ) : incomingRequests.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <div className="text-4xl mb-2">📥</div>
            <p>No incoming transfer requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incomingRequests.map((request) => {
              const requestAmount = typeof request.payload.amount === 'string' 
                ? parseFloat(request.payload.amount) 
                : request.payload.amount;
              const hasEnoughBalance = totalBalance >= requestAmount;
              const isAccepting = acceptingId === request.contractId;
              const isDeclining = decliningId === request.contractId;

              return (
                <div 
                  key={request.contractId}
                  className="p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-semibold text-emerald-400">
                          {requestAmount.toLocaleString()} LNRD
                        </span>
                        <span className="text-slate-400">requested by</span>
                        <span className="font-medium text-slate-200">
                          {shortenParty(request.payload.receiverAccount?.owner || '')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono">
                        {request.contractId.slice(0, 24)}...
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDecline(request)}
                        disabled={isDeclining}
                      >
                        {isDeclining ? <Spinner className="w-4 h-4" /> : 'Decline'}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAccept(request)}
                        disabled={isAccepting || !hasEnoughBalance}
                        title={hasEnoughBalance ? 'Accept transfer' : `Insufficient balance (need ${requestAmount} LNRD)`}
                      >
                        {isAccepting ? <Spinner className="w-4 h-4" /> : 'Accept'}
                      </Button>
                    </div>
                  </div>
                  {!hasEnoughBalance && (
                    <p className="mt-2 text-sm text-amber-400">
                      ⚠️ Insufficient balance. You have {totalBalance.toLocaleString()} LNRD but need {requestAmount.toLocaleString()}.
                    </p>
                  )}
                  {acceptError?.id === request.contractId && (
                    <div className="mt-3 p-3 bg-red-900/40 border border-red-600/50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <span className="text-red-400 flex-shrink-0">⛔</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-300">Transfer Rejected</p>
                          <p className="text-sm text-red-400 mt-1">{acceptError.message}</p>
                        </div>
                        <button 
                          onClick={() => setAcceptError(null)}
                          className="text-red-400 hover:text-red-300 text-lg leading-none"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-slate-200 mb-4">
          Your Transfer Requests
          <span className="ml-2 text-sm font-normal text-slate-400">
            (waiting for others to accept)
          </span>
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
            <span className="ml-3 text-slate-400">Loading...</span>
          </div>
        ) : outgoingRequests.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <div className="text-4xl mb-2">📤</div>
            <p>No pending transfer requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {outgoingRequests.map((request) => {
              const requestAmount = typeof request.payload.amount === 'string' 
                ? parseFloat(request.payload.amount) 
                : request.payload.amount;
              const isWithdrawing = withdrawingId === request.contractId;

              return (
                <div 
                  key={request.contractId}
                  className="p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-semibold text-purple-400">
                          {requestAmount.toLocaleString()} LNRD
                        </span>
                        <span className="text-slate-400">from</span>
                        <span className="font-medium text-slate-200">
                          {shortenParty(request.payload.currentOwner || '')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono">
                        {request.contractId.slice(0, 24)}...
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 bg-amber-900/30 text-amber-400 rounded text-sm">
                        Pending
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleWithdraw(request)}
                        disabled={isWithdrawing}
                      >
                        {isWithdrawing ? <Spinner className="w-4 h-4" /> : 'Withdraw'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="bg-slate-800/50 border-slate-600">
        <h3 className="text-lg font-semibold text-slate-300 mb-2">🔒 Compliance</h3>
        <p className="text-sm text-slate-400">
          All LNRD transfers are automatically validated against the compliance registry attached 
          to the LunarDollar instrument. If either the sender or receiver is blacklisted, the 
          transfer will be rejected. There is no way to bypass this check.
        </p>
      </Card>
    </div>
  );
}
