import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useContractQuery, useLedgerClient } from '@/hooks/useLedger';
import { Card, Button, Input, Spinner } from '@/components/ui';
import { PartyBadge } from '@/components/shared';
import { QUERY_KEYS } from '@/lib/constants';
import {
  TemplateIds,
  Compliance_Identity_Identity,
  Compliance_Claims,
} from '@lunar-dollar/lunar-dollar-api';
import type { Party, ContractId } from '@lunar-dollar/core/primitives';

interface IdentityContract {
  contractId: string;
  payload: Compliance_Identity_Identity.Payload;
}

const ALL_CLAIM_TOPICS: Compliance_Claims.ClaimTopic[] = [
  'KYC',
  'AML',
  'ACCREDITED_INVESTOR',
  'QUALIFIED_PURCHASER',
  'INSTITUTIONAL'
];

const CLAIM_LABELS: Record<Compliance_Claims.ClaimTopic, { label: string; description: string; icon: string }> = {
  'KYC': { label: 'KYC', description: 'Know Your Customer', icon: '🪪' },
  'AML': { label: 'AML', description: 'Anti-Money Laundering', icon: '🔍' },
  'ACCREDITED_INVESTOR': { label: 'Accredited Investor', description: 'Accredited investor status', icon: '💎' },
  'QUALIFIED_PURCHASER': { label: 'Qualified Purchaser', description: 'Qualified purchaser', icon: '🏆' },
  'INSTITUTIONAL': { label: 'Institutional', description: 'Institutional investor', icon: '🏛️' },
};

function shortenParty(party: string): string {
  if (typeof party !== 'string') return String(party);
  if (party.includes('::')) {
    const [name] = party.split('::');
    return name;
  }
  return party.length > 20 ? `${party.slice(0, 8)}...${party.slice(-8)}` : party;
}

function extractClaimsFromMap(claims: unknown): { topic: Compliance_Claims.ClaimTopic; claim: Compliance_Claims.Claim }[] {
  if (!claims) return [];

  const result: { topic: Compliance_Claims.ClaimTopic; claim: Compliance_Claims.Claim }[] = [];

  if (Array.isArray(claims)) {
    for (const tuple of claims as Array<[string, Compliance_Claims.Claim]>) {
      if (Array.isArray(tuple) && tuple.length >= 2) {
        result.push({ topic: tuple[0] as Compliance_Claims.ClaimTopic, claim: tuple[1] });
      }
    }
    return result;
  }

  if (typeof claims !== 'object') return [];

  const obj = claims as Record<string, unknown>;

  if ('map' in obj && Array.isArray(obj.map)) {
    for (const tuple of obj.map as Array<[string, Compliance_Claims.Claim]>) {
      if (Array.isArray(tuple) && tuple.length >= 2) {
        result.push({ topic: tuple[0] as Compliance_Claims.ClaimTopic, claim: tuple[1] });
      }
    }
  } else if ('map' in obj && obj.map && typeof obj.map === 'object') {
    for (const [topic, claim] of Object.entries(obj.map as object)) {
      result.push({ topic: topic as Compliance_Claims.ClaimTopic, claim: claim as Compliance_Claims.Claim });
    }
  } else if ('textMap' in obj && obj.textMap && typeof obj.textMap === 'object') {
    for (const [topic, claim] of Object.entries(obj.textMap as object)) {
      result.push({ topic: topic as Compliance_Claims.ClaimTopic, claim: claim as Compliance_Claims.Claim });
    }
  }

  return result;
}

export function IdentityManager() {
  const navigate = useNavigate();
  const { party } = useAuth();
  const client = useLedgerClient();
  const queryClient = useQueryClient();

  const [newSubject, setNewSubject] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedIdentity, setSelectedIdentity] = useState<string | null>(null);
  const [addingClaim, setAddingClaim] = useState<{ identityId: string; topic: Compliance_Claims.ClaimTopic } | null>(null);
  const [revokingClaim, setRevokingClaim] = useState<{ identityId: string; topic: Compliance_Claims.ClaimTopic } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: identities, isLoading, refetch } = useContractQuery<Compliance_Identity_Identity.Payload>(
    TemplateIds.Compliance_Identity_Identity
  );

  const identityList = (identities as IdentityContract[]) || [];

  const partyName = party ? shortenParty(party).toLowerCase() : '';
  const isBank = partyName === 'bank';
  const isOperator = party && identityList.some(i => i.payload.operator === party);
  const isAdmin = isBank || isOperator;
  const myIdentity = identityList.find(i => i.payload.subject === party);

  const managedIdentities = isBank
    ? identityList.filter(i => i.payload.subject !== party)
    : identityList;

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

  const handleCreateIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !newSubject || !party) return;

    setIsCreating(true);
    setError(null);

    try {
      const resolvedSubject = await resolvePartyId(newSubject);

      if (!resolvedSubject) {
        throw new Error(`Could not find party "${newSubject}". Make sure the party exists.`);
      }

      await client.create(
        TemplateIds.Compliance_Identity_Identity,
        {
          operator: party,
          subject: resolvedSubject,
          claims: []
        }
      );

      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.contracts(TemplateIds.Compliance_Identity_Identity, party || undefined)
      });

      await refetch();
      setNewSubject('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create identity');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddClaim = async (identityContractId: string, topic: Compliance_Claims.ClaimTopic) => {
    if (!client || !party) return;

    setAddingClaim({ identityId: identityContractId, topic });
    setError(null);

    try {
      const identity = identityList.find(i => i.contractId === identityContractId);
      if (!identity) throw new Error('Identity not found');

      await client.exercise(
        TemplateIds.Compliance_Identity_Identity,
        identityContractId as ContractId<Compliance_Identity_Identity.Payload>,
        'AddClaim',
        {
          claim: {
            topic,
            issuer: party,
            subject: identity.payload.subject,
            data_: 'verified',
            issuedAt: new Date().toISOString()
          }
        }
      );

      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.contracts(TemplateIds.Compliance_Identity_Identity, party || undefined)
      });

      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add claim');
    } finally {
      setAddingClaim(null);
    }
  };

  const handleRevokeClaim = async (identityContractId: string, topic: Compliance_Claims.ClaimTopic) => {
    if (!client) return;

    setRevokingClaim({ identityId: identityContractId, topic });
    setError(null);

    try {
      await client.exercise(
        TemplateIds.Compliance_Identity_Identity,
        identityContractId as ContractId<Compliance_Identity_Identity.Payload>,
        'RevokeClaim',
        { topic }
      );

      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.contracts(TemplateIds.Compliance_Identity_Identity, party || undefined)
      });

      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke claim');
    } finally {
      setRevokingClaim(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-8">
          <Spinner />
          <span className="ml-3 text-slate-400">Loading identities...</span>
        </div>
      </Card>
    );
  }

  if (!isAdmin) {
    const myClaims = myIdentity ? extractClaimsFromMap(myIdentity.payload.claims) : [];

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">My Identity</h2>
          <p className="text-slate-400">View your on-chain identity and claims</p>
        </div>

        <Card>
          <h3 className="text-sm font-medium text-slate-400 mb-2">Current Party</h3>
          {party && <PartyBadge party={party} />}
        </Card>

        {myIdentity ? (
          <>
            <Card className="border-emerald-700/50">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-emerald-600/20 flex items-center justify-center">
                  <span className="text-3xl">✓</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-200">Identity Verified</h3>
                  <p className="text-slate-400">
                    Your on-chain identity is active and managed by {shortenParty(myIdentity.payload.operator)}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-slate-200 mb-4">My Claims</h3>
              {myClaims.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <div className="text-4xl mb-2">📜</div>
                  <p>No claims issued yet</p>
                  <p className="text-sm mt-1">Contact the issuer to request claims for transfers</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myClaims.map(({ topic, claim }) => {
                    const info = CLAIM_LABELS[topic];
                    return (
                      <div
                        key={topic}
                        className="p-4 rounded-lg border bg-cyan-900/30 border-cyan-700"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{info.icon}</span>
                          <div>
                            <p className="font-medium text-cyan-300">{info.label}</p>
                            <p className="text-xs text-slate-400">{info.description}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              Issued by: {shortenParty(claim.issuer)}
                            </p>
                          </div>
                          <div className="ml-auto">
                            <span className="px-2 py-1 text-xs bg-emerald-900/50 text-emerald-400 rounded">
                              Active
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Available Claim Types</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {ALL_CLAIM_TOPICS.map(topic => {
                  const info = CLAIM_LABELS[topic];
                  const hasClaim = myClaims.some(c => c.topic === topic);
                  return (
                    <div
                      key={topic}
                      className={`p-3 rounded-lg border ${hasClaim
                        ? 'bg-emerald-900/20 border-emerald-700/50'
                        : 'bg-slate-900/30 border-slate-700'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{info.icon}</span>
                        <span className={hasClaim ? 'text-emerald-400' : 'text-slate-400'}>{info.label}</span>
                        <span className="ml-auto">{hasClaim ? '✓' : '✗'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        ) : (
          <Card className="border-amber-700/50">
            <div className="text-center py-8">
              <div className="text-4xl mb-4">👤</div>
              <h3 className="text-xl font-semibold text-amber-400 mb-2">No Identity Found</h3>
              <p className="text-slate-400">You don't have an on-chain identity yet.</p>
              <p className="text-sm text-slate-500 mt-2">
                Contact the LNRD issuer to create your identity and receive claims.
              </p>
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/compliance')}>
          ← Back
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Identity Manager</h2>
          <p className="text-slate-400">Manage party identities and their claims</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <h3 className="text-sm font-medium text-slate-400 mb-2">Current Operator</h3>
          {party && <PartyBadge party={party} />}
        </Card>
        <Card className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border-emerald-700/50">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Managed Identities</h3>
          <p className="text-2xl font-bold text-white">{managedIdentities.length}</p>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border-cyan-700/50">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Total Claims Issued</h3>
          <p className="text-2xl font-bold text-white">
            {managedIdentities.reduce((total, identity) => {
              const claims = extractClaimsFromMap(identity.payload.claims);
              return total + claims.length;
            }, 0)}
          </p>
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Create New Identity</h3>
        <form onSubmit={handleCreateIdentity} className="space-y-4">
          <div className="flex gap-4">
            <Input
              placeholder="Enter party name (e.g., Alice) or full party ID"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" loading={isCreating} disabled={!newSubject}>
              Create Identity
            </Button>
          </div>
          <p className="text-sm text-slate-500">
            Create an identity contract for a party to hold claims. Each party should have one identity.
          </p>
        </form>
      </Card>

      {error && (
        <Card className="border-red-700/50 bg-red-900/20">
          <p className="text-red-400">{error}</p>
        </Card>
      )}

      <Card>
        <h3 className="text-lg font-semibold text-slate-200 mb-4">
          Identities
          {managedIdentities.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-emerald-600 rounded-full">
              {managedIdentities.length}
            </span>
          )}
        </h3>

        {managedIdentities.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <div className="text-4xl mb-2">👤</div>
            <p>No identities created yet</p>
            <p className="text-sm mt-1">Create an identity above to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {managedIdentities.map((identity) => {
              const claims = extractClaimsFromMap(identity.payload.claims);
              const claimTopics = new Set(claims.map(c => c.topic));
              const isExpanded = selectedIdentity === identity.contractId;

              return (
                <div
                  key={identity.contractId}
                  className="border border-slate-700 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setSelectedIdentity(isExpanded ? null : identity.contractId)}
                    className="w-full p-4 bg-slate-900/50 hover:bg-slate-900/80 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-emerald-600/20 flex items-center justify-center">
                        <span className="text-2xl">👤</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-200">
                          {shortenParty(identity.payload.subject)}
                        </p>
                        <p className="text-sm text-slate-400">
                          Operator: {shortenParty(identity.payload.operator)}
                        </p>
                        <div className="flex gap-1 mt-1">
                          {claims.length === 0 ? (
                            <span className="text-xs text-slate-500">No claims</span>
                          ) : (
                            claims.map(({ topic }) => (
                              <span
                                key={topic}
                                className="px-2 py-0.5 text-xs bg-cyan-900/50 text-cyan-300 rounded"
                              >
                                {CLAIM_LABELS[topic].icon} {CLAIM_LABELS[topic].label}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                      <span className="text-slate-400">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-4 border-t border-slate-700 bg-slate-800/50">
                      <h4 className="text-sm font-medium text-slate-300 mb-3">Manage Claims</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {ALL_CLAIM_TOPICS.map(topic => {
                          const info = CLAIM_LABELS[topic];
                          const hasClaim = claimTopics.has(topic);
                          const isAdding = addingClaim?.identityId === identity.contractId && addingClaim?.topic === topic;
                          const isRevoking = revokingClaim?.identityId === identity.contractId && revokingClaim?.topic === topic;

                          return (
                            <div
                              key={topic}
                              className={`p-3 rounded-lg border ${hasClaim
                                ? 'bg-cyan-900/30 border-cyan-700'
                                : 'bg-slate-900/30 border-slate-700'
                                }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span>{info.icon}</span>
                                  <span className={`text-sm ${hasClaim ? 'text-cyan-300' : 'text-slate-400'}`}>
                                    {info.label}
                                  </span>
                                </div>
                                {hasClaim ? (
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => handleRevokeClaim(identity.contractId, topic)}
                                    loading={isRevoking}
                                    disabled={!!revokingClaim || !!addingClaim}
                                  >
                                    Revoke
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => handleAddClaim(identity.contractId, topic)}
                                    loading={isAdding}
                                    disabled={!!revokingClaim || !!addingClaim}
                                  >
                                    Issue
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

