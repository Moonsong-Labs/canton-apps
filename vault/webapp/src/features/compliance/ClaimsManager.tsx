import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useContractQuery, useLedgerClient } from '@/hooks/useLedger';
import { Card, Button, Spinner } from '@/components/ui';
import { PartyBadge } from '@/components/shared';
import { QUERY_KEYS } from '@/lib/constants';
import { 
  TemplateIds, 
  Compliance_Validators_Claims_ClaimsValidator,
  Compliance_Registry_ComplianceRegistry,
  Compliance_Claims,
} from '@lunar-dollar/lunar-dollar-api';
import type { ContractId } from '@lunar-dollar/core/primitives';

interface ClaimsValidatorContract {
  contractId: string;
  payload: Compliance_Validators_Claims_ClaimsValidator.Payload;
}

interface RegistryContract {
  contractId: string;
  payload: Compliance_Registry_ComplianceRegistry.Payload;
}

const ALL_CLAIM_TOPICS: Compliance_Claims.ClaimTopic[] = [
  'KYC',
  'AML', 
  'ACCREDITED_INVESTOR',
  'QUALIFIED_PURCHASER',
  'INSTITUTIONAL'
];

const CLAIM_LABELS: Record<Compliance_Claims.ClaimTopic, { label: string; description: string; icon: string }> = {
  'KYC': { label: 'KYC', description: 'Know Your Customer verification', icon: '🪪' },
  'AML': { label: 'AML', description: 'Anti-Money Laundering check', icon: '🔍' },
  'ACCREDITED_INVESTOR': { label: 'Accredited Investor', description: 'Accredited investor status', icon: '💎' },
  'QUALIFIED_PURCHASER': { label: 'Qualified Purchaser', description: 'Qualified purchaser status', icon: '🏆' },
  'INSTITUTIONAL': { label: 'Institutional', description: 'Institutional investor status', icon: '🏛️' },
};

function extractClaimsFromSet(rawClaims: unknown): Compliance_Claims.ClaimTopic[] {
  if (!rawClaims) return [];
  if (Array.isArray(rawClaims)) return rawClaims as Compliance_Claims.ClaimTopic[];
  if (typeof rawClaims === 'object') {
    const obj = rawClaims as Record<string, unknown>;
    if ('map' in obj && Array.isArray(obj.map)) {
      return (obj.map as Array<[string, unknown]>).map(tuple => tuple[0] as Compliance_Claims.ClaimTopic);
    }
    if ('map' in obj && obj.map && typeof obj.map === 'object') {
      return Object.keys(obj.map as object) as Compliance_Claims.ClaimTopic[];
    }
  }
  return [];
}

export function ClaimsManager() {
  const { id: contractId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { party } = useAuth();
  const client = useLedgerClient();
  const queryClient = useQueryClient();

  const [selectedSenderClaims, setSelectedSenderClaims] = useState<Set<Compliance_Claims.ClaimTopic>>(new Set());
  const [selectedReceiverClaims, setSelectedReceiverClaims] = useState<Set<Compliance_Claims.ClaimTopic>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentContractId, setCurrentContractId] = useState<string | undefined>(contractId);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setCurrentContractId(contractId);
  }, [contractId]);

  const { data: validators, isLoading, refetch } = useContractQuery<Compliance_Validators_Claims_ClaimsValidator.Payload>(
    TemplateIds.Compliance_Validators_Claims_ClaimsValidator
  );

  const { data: registries, refetch: refetchRegistries } = useContractQuery<Compliance_Registry_ComplianceRegistry.Payload>(
    TemplateIds.Compliance_Registry_ComplianceRegistry
  );

  const validatorList = (validators as ClaimsValidatorContract[]) || [];
  const registryList = (registries as RegistryContract[]) || [];
  
  let validator = validatorList.find(v => v.contractId === currentContractId);
  
  if (!validator && validatorList.length > 0) {
    validator = validatorList[0];
    if (validator && validator.contractId !== currentContractId) {
      setCurrentContractId(validator.contractId);
    }
  }

  useEffect(() => {
    if (validator) {
      const senderClaims = extractClaimsFromSet(validator.payload.requiredSenderClaims);
      const receiverClaims = extractClaimsFromSet(validator.payload.requiredReceiverClaims);
      setSelectedSenderClaims(new Set(senderClaims));
      setSelectedReceiverClaims(new Set(receiverClaims));
      setHasChanges(false);
    }
  }, [validator?.contractId]);

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
    }
  };

  const toggleSenderClaim = (topic: Compliance_Claims.ClaimTopic) => {
    setSelectedSenderClaims(prev => {
      const next = new Set(prev);
      if (next.has(topic)) {
        next.delete(topic);
      } else {
        next.add(topic);
      }
      return next;
    });
    setHasChanges(true);
  };

  const toggleReceiverClaim = (topic: Compliance_Claims.ClaimTopic) => {
    setSelectedReceiverClaims(prev => {
      const next = new Set(prev);
      if (next.has(topic)) {
        next.delete(topic);
      } else {
        next.add(topic);
      }
      return next;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!client || !currentContractId) return;

    setIsSaving(true);
    setError(null);

    try {
      const toSetFormat = (claims: Set<Compliance_Claims.ClaimTopic>) => ({
        map: Array.from(claims).map(topic => [topic, {}])
      });
      
      const result = await client.exercise(
        TemplateIds.Compliance_Validators_Claims_ClaimsValidator,
        currentContractId as ContractId<Compliance_Validators_Claims_ClaimsValidator.Payload>,
        'UpdateRequiredClaims',
        { 
          newSenderClaims: toSetFormat(selectedSenderClaims),
          newReceiverClaims: toSetFormat(selectedReceiverClaims)
        }
      );

      const newContractId = result?.exerciseResult as string | undefined;
      
      if (newContractId && typeof newContractId === 'string') {
        await updateRegistryWithNewValidator(currentContractId, newContractId);
        setCurrentContractId(newContractId);
        navigate(`/compliance/claims/${newContractId}`, { replace: true });
      }

      await queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.contracts(TemplateIds.Compliance_Validators_Claims_ClaimsValidator, party || undefined) 
      });
      
      await refetch();
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update required claims');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-8">
          <Spinner />
          <span className="ml-3 text-slate-400">Loading claims validator...</span>
        </div>
      </Card>
    );
  }

  if (!validator) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="text-4xl mb-2">❌</div>
          <p className="text-slate-400">Claims validator not found</p>
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
          <h2 className="text-2xl font-bold text-slate-100">Claims Validator</h2>
          <p className="text-slate-400">Configure required claims for transfers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-medium text-slate-400 mb-2">Operator</h3>
          <PartyBadge party={validator.payload.operator} />
        </Card>
        <Card className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border-cyan-700/50">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Total Required Claims</h3>
          <p className="text-2xl font-bold text-white">
            {selectedSenderClaims.size + selectedReceiverClaims.size}
          </p>
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Required Sender Claims</h3>
        <p className="text-sm text-slate-400 mb-4">
          The sender must have ALL selected claims to initiate a transfer.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ALL_CLAIM_TOPICS.map(topic => {
            const info = CLAIM_LABELS[topic];
            const isSelected = selectedSenderClaims.has(topic);
            return (
              <button
                key={topic}
                onClick={() => toggleSenderClaim(topic)}
                className={`p-4 rounded-lg border text-left transition-all ${
                  isSelected 
                    ? 'bg-cyan-900/40 border-cyan-500 ring-1 ring-cyan-500/50' 
                    : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{info.icon}</span>
                  <div className="flex-1">
                    <p className={`font-medium ${isSelected ? 'text-cyan-300' : 'text-slate-300'}`}>
                      {info.label}
                    </p>
                    <p className="text-xs text-slate-500">{info.description}</p>
                  </div>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    isSelected ? 'bg-cyan-500 border-cyan-500' : 'border-slate-600'
                  }`}>
                    {isSelected && <span className="text-white text-sm">✓</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Required Receiver Claims</h3>
        <p className="text-sm text-slate-400 mb-4">
          The receiver must have ALL selected claims to receive a transfer.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ALL_CLAIM_TOPICS.map(topic => {
            const info = CLAIM_LABELS[topic];
            const isSelected = selectedReceiverClaims.has(topic);
            return (
              <button
                key={topic}
                onClick={() => toggleReceiverClaim(topic)}
                className={`p-4 rounded-lg border text-left transition-all ${
                  isSelected 
                    ? 'bg-emerald-900/40 border-emerald-500 ring-1 ring-emerald-500/50' 
                    : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{info.icon}</span>
                  <div className="flex-1">
                    <p className={`font-medium ${isSelected ? 'text-emerald-300' : 'text-slate-300'}`}>
                      {info.label}
                    </p>
                    <p className="text-xs text-slate-500">{info.description}</p>
                  </div>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                  }`}>
                    {isSelected && <span className="text-white text-sm">✓</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {error && (
        <Card className="border-red-700/50 bg-red-900/20">
          <p className="text-red-400">{error}</p>
        </Card>
      )}

      <div className="flex justify-end gap-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/compliance')}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave}
          loading={isSaving}
          disabled={!hasChanges}
          className={hasChanges ? 'bg-cyan-600 hover:bg-cyan-500' : ''}
        >
          {hasChanges ? 'Save Changes' : 'No Changes'}
        </Button>
      </div>
    </div>
  );
}

