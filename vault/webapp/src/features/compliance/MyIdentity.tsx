import { useAuth } from '@/hooks/useAuth';
import { useContractQuery } from '@/hooks/useLedger';
import { Card, Spinner } from '@/components/ui';
import { PartyBadge } from '@/components/shared';
import {
  TemplateIds,
  Compliance_Identity_Identity,
  Compliance_Claims,
} from '@lunar-dollar/lunar-dollar-api';

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

export function MyIdentity() {
  const { party } = useAuth();

  const { data: identities, isLoading } = useContractQuery<Compliance_Identity_Identity.Payload>(
    TemplateIds.Compliance_Identity_Identity
  );

  const identityList = (identities as IdentityContract[]) || [];
  const myIdentity = identityList.find(i => i.payload.subject === party);
  const myClaims = myIdentity ? extractClaimsFromMap(myIdentity.payload.claims) : [];

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-8">
          <Spinner />
          <span className="ml-3 text-slate-400">Loading identity...</span>
        </div>
      </Card>
    );
  }

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

