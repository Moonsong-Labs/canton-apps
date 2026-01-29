import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useContractQuery, useLedgerClient } from '@/hooks/useLedger';
import { Card, Button, Input, Spinner } from '@/components/ui';
import { PartyBadge } from '@/components/shared';
import { QUERY_KEYS } from '@/lib/constants';
import { 
  TemplateIds, 
  Compliance_Validators_Blacklist_BlacklistValidator,
  Compliance_Registry_ComplianceRegistry,
} from '@lunar-dollar/lunar-dollar-api';
import type { Party, ContractId } from '@lunar-dollar/core/primitives';

interface BlacklistContract {
  contractId: string;
  payload: Compliance_Validators_Blacklist_BlacklistValidator.Payload;
}

interface RegistryContract {
  contractId: string;
  payload: Compliance_Registry_ComplianceRegistry.Payload;
}

function shortenParty(party: string): string {
  if (typeof party !== 'string') return String(party);
  if (party.includes('::')) {
    const [name] = party.split('::');
    return name;
  }
  return party.length > 20 ? `${party.slice(0, 8)}...${party.slice(-8)}` : party;
}

function extractPartiesFromSet(rawBlacklist: unknown): string[] {
  if (!rawBlacklist) return [];
  if (Array.isArray(rawBlacklist)) {
    return rawBlacklist.map(p => typeof p === 'string' ? p : String(p));
  }
  if (typeof rawBlacklist === 'object') {
    const obj = rawBlacklist as Record<string, unknown>;
    
    // Handle Daml Set format: { map: [["party1", {}], ["party2", {}]] }
    // This is an array of tuples where first element is the key
    if ('map' in obj && Array.isArray(obj.map)) {
      return (obj.map as Array<[string, unknown]>).map(tuple => {
        if (Array.isArray(tuple) && tuple.length >= 1) {
          return String(tuple[0]);
        }
        return String(tuple);
      });
    }
    
    // Handle object map format: { map: { "party1": {}, "party2": {} } }
    if ('map' in obj && obj.map && typeof obj.map === 'object' && !Array.isArray(obj.map)) {
      return Object.keys(obj.map as object);
    }
    
    if ('textMap' in obj && obj.textMap && typeof obj.textMap === 'object') {
      return Object.keys(obj.textMap as object);
    }
    
    const keys = Object.keys(obj);
    if (keys.length > 0 && keys.every(k => !isNaN(Number(k)))) {
      return Object.values(obj).map(v => typeof v === 'string' ? v : String(v));
    }
    return keys;
  }
  return [];
}

export function BlacklistManager() {
  const { id: contractId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { party } = useAuth();
  const client = useLedgerClient();
  const queryClient = useQueryClient();

  const [partyToAdd, setPartyToAdd] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [removingParty, setRemovingParty] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentContractId, setCurrentContractId] = useState<string | undefined>(contractId);

  useEffect(() => {
    setCurrentContractId(contractId);
  }, [contractId]);

  const { data: validators, isLoading, refetch } = useContractQuery<Compliance_Validators_Blacklist_BlacklistValidator.Payload>(
    TemplateIds.Compliance_Validators_Blacklist_BlacklistValidator
  );

  const { data: registries, refetch: refetchRegistries } = useContractQuery<Compliance_Registry_ComplianceRegistry.Payload>(
    TemplateIds.Compliance_Registry_ComplianceRegistry
  );

  const validatorList = (validators as BlacklistContract[]) || [];
  const registryList = (registries as RegistryContract[]) || [];
  
  let validator = validatorList.find(v => v.contractId === currentContractId);
  
  if (!validator && validatorList.length > 0) {
    validator = validatorList[0];
    if (validator && validator.contractId !== currentContractId) {
      setCurrentContractId(validator.contractId);
    }
  }
  
  const blacklistedParties = extractPartiesFromSet(validator?.payload?.blacklistedParties);

  // Update the registry when the blacklist validator changes
  const updateRegistryWithNewValidator = async (oldCid: string, newCid: string) => {
    if (!client || registryList.length === 0) return;
    
    const registry = registryList[0];
    
    try {
      await client.exercise(
        TemplateIds.Compliance_Registry_ComplianceRegistry,
        registry.contractId as ContractId<Compliance_Registry_ComplianceRegistry.Payload>,
        'UpdateValidator',
        { 
          oldValidatorCid: oldCid,
          newValidatorCid: newCid
        }
      );
      
      await queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.contracts(TemplateIds.Compliance_Registry_ComplianceRegistry, party || undefined) 
      });
      await refetchRegistries();
    } catch (err) {
      console.error('Failed to update registry with new validator CID:', err);
      // Don't throw - the blacklist was updated successfully, registry sync can be retried
    }
  };

  const resolvePartyId = async (partyName: string): Promise<string | null> => {
    if (!client) return null;
    
    if (partyName.includes('::')) {
      return partyName;
    }

    try {
      const accounts = await client.query<{ owner: Party }>(TemplateIds.Account, {});
      const accountList = accounts as unknown as { contractId: string; payload: { owner: Party } }[];
      
      const match = accountList.find(a => {
        const ownerName = shortenParty(a.payload.owner);
        return ownerName.toLowerCase() === partyName.toLowerCase();
      });
      
      if (match) {
        return match.payload.owner;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleAddToBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !currentContractId || !partyToAdd) return;

    setIsAdding(true);
    setError(null);

    try {
      const resolvedParty = await resolvePartyId(partyToAdd);
      
      if (!resolvedParty) {
        throw new Error(`Could not find party "${partyToAdd}". Make sure the party exists.`);
      }

      const result = await client.exercise(
        TemplateIds.Compliance_Validators_Blacklist_BlacklistValidator,
        currentContractId as ContractId<Compliance_Validators_Blacklist_BlacklistValidator.Payload>,
        'AddToBlacklist',
        { party: resolvedParty }
      );

      const newContractId = result?.exerciseResult as string | undefined;
      
      // Update the registry with the new validator CID
      if (newContractId && typeof newContractId === 'string') {
        await updateRegistryWithNewValidator(currentContractId, newContractId);
        setCurrentContractId(newContractId);
        navigate(`/compliance/blacklist/${newContractId}`, { replace: true });
      }

      await queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.contracts(TemplateIds.Compliance_Validators_Blacklist_BlacklistValidator, party || undefined) 
      });
      
      await refetch();
      setPartyToAdd('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add party to blacklist');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveFromBlacklist = async (partyToRemove: string) => {
    if (!client || !currentContractId) return;

    setRemovingParty(partyToRemove);
    try {
      const result = await client.exercise(
        TemplateIds.Compliance_Validators_Blacklist_BlacklistValidator,
        currentContractId as ContractId<Compliance_Validators_Blacklist_BlacklistValidator.Payload>,
        'RemoveFromBlacklist',
        { party: partyToRemove }
      );

      const newContractId = result?.exerciseResult as string | undefined;
      
      // Update the registry with the new validator CID
      if (newContractId && typeof newContractId === 'string') {
        await updateRegistryWithNewValidator(currentContractId, newContractId);
        setCurrentContractId(newContractId);
        navigate(`/compliance/blacklist/${newContractId}`, { replace: true });
      }

      await queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.contracts(TemplateIds.Compliance_Validators_Blacklist_BlacklistValidator, party || undefined) 
      });
      
      await refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove party from blacklist');
    } finally {
      setRemovingParty(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-8">
          <Spinner />
          <span className="ml-3 text-slate-400">Loading blacklist...</span>
        </div>
      </Card>
    );
  }

  if (!validator) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="text-4xl mb-2">❌</div>
          <p className="text-slate-400">Blacklist validator not found</p>
          <p className="text-sm text-slate-500 mt-2">The contract may have been updated. Redirecting...</p>
          <Button className="mt-4" onClick={() => navigate('/compliance')}>
            Back to Compliance
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/compliance')}>
          ← Back
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Blacklist Manager</h2>
          <p className="text-slate-400">Add or remove parties from the blacklist</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-medium text-slate-400 mb-2">Operator</h3>
          <PartyBadge party={validator.payload.operator} />
        </Card>
        <Card className="bg-gradient-to-br from-red-900/30 to-orange-900/30 border-red-700/50">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Blocked Parties</h3>
          <p className="text-2xl font-bold text-white">{blacklistedParties.length}</p>
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Add Party to Blacklist</h3>
        <form onSubmit={handleAddToBlacklist} className="space-y-4">
          <div className="flex gap-4">
            <Input
              placeholder="Enter party name (e.g., Alice) or full party ID"
              value={partyToAdd}
              onChange={(e) => setPartyToAdd(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" loading={isAdding} disabled={!partyToAdd}>
              Add to Blacklist
            </Button>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-slate-200 mb-4">
          Blocked Parties
          {blacklistedParties.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-red-600 rounded-full">
              {blacklistedParties.length}
            </span>
          )}
        </h3>

        {blacklistedParties.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <div className="text-4xl mb-2">✅</div>
            <p>No parties are currently blacklisted</p>
            <p className="text-sm mt-1">All transfers are allowed</p>
          </div>
        ) : (
          <div className="space-y-2">
            {blacklistedParties.map((blockedParty, index) => (
              <div 
                key={blockedParty || index}
                className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-red-900/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center">
                    <span>🚫</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-200">{shortenParty(blockedParty)}</p>
                    <p className="text-xs text-slate-500 font-mono">{blockedParty}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleRemoveFromBlacklist(blockedParty)}
                  loading={removingParty === blockedParty}
                  disabled={!!removingParty}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
