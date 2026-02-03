import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useParties } from '@/hooks/useLedger';
import { Card, Button, Spinner } from '@/components/ui';

export function PartySelector() {
  const navigate = useNavigate();
  const { setParty } = useAuth();
  const { data: parties, isLoading, error } = useParties();
  
  const filteredParties = parties?.filter((party) => {
    const partyName = party.split('::')[0].toLowerCase();
    return partyName !== 'public' && partyName !== 'sandbox';
  });

  const handleSelectParty = (party: string) => {
    setParty(party);
    navigate('/dashboard');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md text-center">
          <p className="text-red-400 mb-4">Failed to connect to ledger</p>
          <p className="text-slate-400 text-sm mb-4">
            Make sure Canton ledger is running. The app expects the JSON API at localhost:7575.
          </p>
          <p className="text-slate-500 text-xs">
            Error: {String(error)}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <h2 className="text-xl font-bold text-slate-100 mb-6 text-center">
          Select Party
        </h2>
        <div className="space-y-2">
          {filteredParties?.map((party) => (
            <Button
              key={party}
              variant="secondary"
              className="w-full justify-start font-mono text-sm"
              onClick={() => handleSelectParty(party)}
            >
              {party.split('::')[0]}
              <span className="text-slate-500 ml-2 text-xs">
                {party.split('::')[1]?.slice(0, 8)}...
              </span>
            </Button>
          ))}
        </div>
        {(!filteredParties || filteredParties.length === 0) && (
          <p className="text-slate-400 text-center">
            No parties found on ledger
          </p>
        )}
      </Card>
    </div>
  );
}
