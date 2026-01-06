import { useAuth } from '@/hooks/useAuth';
import { useContractQuery } from '@/hooks/useLedger';
import { Card, Spinner } from '@/components/ui';
import { PartyBadge } from '@/components/shared';
import {
  TemplateIds,
  Compliance_Registry_ComplianceRegistry,
  Compliance_Validators_Blacklist_BlacklistValidator,
  Compliance_Validators_Claims_ClaimsValidator,
  Compliance_Identity_Identity,
  LunarDollar,
} from '@lunar-dollar/lunar-dollar-api';
import { Link } from 'react-router-dom';

interface RegistryContract {
  contractId: string;
  payload: Compliance_Registry_ComplianceRegistry.Payload;
}

interface BlacklistContract {
  contractId: string;
  payload: Compliance_Validators_Blacklist_BlacklistValidator.Payload;
}

interface ClaimsValidatorContract {
  contractId: string;
  payload: Compliance_Validators_Claims_ClaimsValidator.Payload;
}

interface IdentityContract {
  contractId: string;
  payload: Compliance_Identity_Identity.Payload;
}

interface LunarDollarContract {
  contractId: string;
  payload: LunarDollar.Payload;
}

function shortenParty(party: string): string {
  if (party.includes('::')) {
    const [name] = party.split('::');
    return name;
  }
  return party.length > 20 ? `${party.slice(0, 8)}...${party.slice(-8)}` : party;
}

function extractFromDamlSet(rawSet: unknown): string[] {
  if (!rawSet) return [];
  if (Array.isArray(rawSet)) {
    if (rawSet.length > 0 && Array.isArray(rawSet[0])) {
      return rawSet.map(tuple => String(tuple[0]));
    }
    return rawSet.map(String);
  }
  if (typeof rawSet === 'object') {
    const obj = rawSet as Record<string, unknown>;
    if ('map' in obj && Array.isArray(obj.map)) {
      return (obj.map as Array<[string, unknown]>).map(tuple => String(tuple[0]));
    }
    if ('map' in obj && obj.map && typeof obj.map === 'object') {
      return Object.keys(obj.map as object);
    }
    if ('textMap' in obj && obj.textMap && typeof obj.textMap === 'object') {
      return Object.keys(obj.textMap as object);
    }
  }
  return [];
}

export function ComplianceDashboard() {
  const { party } = useAuth();

  const { data: registries, isLoading: loadingRegistries } = useContractQuery<Compliance_Registry_ComplianceRegistry.Payload>(
    TemplateIds.Compliance_Registry_ComplianceRegistry
  );

  const { data: blacklistValidators, isLoading: loadingBlacklist } = useContractQuery<Compliance_Validators_Blacklist_BlacklistValidator.Payload>(
    TemplateIds.Compliance_Validators_Blacklist_BlacklistValidator
  );

  const { data: claimsValidators, isLoading: loadingClaims } = useContractQuery<Compliance_Validators_Claims_ClaimsValidator.Payload>(
    TemplateIds.Compliance_Validators_Claims_ClaimsValidator
  );

  const { data: identities, isLoading: loadingIdentities } = useContractQuery<Compliance_Identity_Identity.Payload>(
    TemplateIds.Compliance_Identity_Identity
  );

  const { data: lunarDollars, isLoading: loadingLNRD } = useContractQuery<LunarDollar.Payload>(
    TemplateIds.LunarDollar
  );

  const registryList = (registries as RegistryContract[]) || [];
  const blacklistList = (blacklistValidators as BlacklistContract[]) || [];
  const claimsValidatorList = (claimsValidators as ClaimsValidatorContract[]) || [];
  const identityList = (identities as IdentityContract[]) || [];
  const lunarDollarList = (lunarDollars as LunarDollarContract[]) || [];
  const lunarDollar = lunarDollarList[0];

  const isLoading = loadingRegistries || loadingBlacklist || loadingClaims || loadingIdentities || loadingLNRD;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Compliance Management</h2>
        <p className="text-slate-400">View and manage transfer validators for LNRD</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <h3 className="text-sm font-medium text-slate-400 mb-2">Current Party</h3>
          {party && <PartyBadge party={party} />}
        </Card>
        <Card className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border-indigo-700/50">
          <h3 className="text-sm font-medium text-slate-400 mb-2">LNRD Instrument</h3>
          <p className="text-lg font-bold text-white">{lunarDollar ? '✓ Active' : '⏳ Loading'}</p>
        </Card>
        <Card className="bg-gradient-to-br from-red-900/30 to-orange-900/30 border-red-700/50">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Blacklist Validators</h3>
          <p className="text-2xl font-bold text-white">{blacklistList.length}</p>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border-cyan-700/50">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Claims Validators</h3>
          <p className="text-2xl font-bold text-white">{claimsValidatorList.length}</p>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border-emerald-700/50">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Identities</h3>
          <p className="text-2xl font-bold text-white">{identityList.length}</p>
        </Card>
      </div>

      {isLoading ? (
        <Card>
          <div className="flex items-center justify-center py-8">
            <Spinner />
            <span className="ml-3 text-slate-400">Loading compliance data...</span>
          </div>
        </Card>
      ) : (
        <>
          {lunarDollar && (
            <Card className="border-indigo-700/50">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">
                🌙 LNRD Compliance Configuration
              </h3>
              <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Issuer</p>
                    <p className="font-medium text-slate-200">{shortenParty(lunarDollar.payload.instrumentKey?.issuer || '')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Compliance Registry</p>
                    <p className="font-mono text-xs text-emerald-400 truncate">
                      {lunarDollar.payload.complianceRegistryCid ? '✓ Attached' : '❌ Missing'}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-400">
                  All LNRD transfers are validated against the compliance registry attached to this instrument.
                  The registry cannot be bypassed.
                </p>
              </div>
            </Card>
          )}

          <Card>
            <h3 className="text-lg font-semibold text-slate-200 mb-4">
              Compliance Registries
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Central registries that manage active validators. Created during system setup.
            </p>

            {registryList.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div className="text-4xl mb-2">📋</div>
                <p>No compliance registries found</p>
                <p className="text-sm mt-1">Run the setup script to create the compliance infrastructure</p>
              </div>
            ) : (
              <div className="space-y-3">
                {registryList.map((registry) => (
                  <div
                    key={registry.contractId}
                    className="p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-200">
                          Operator: {shortenParty(registry.payload.operator)}
                        </p>
                        <p className="text-sm text-slate-400">
                          Active Validators: {registry.payload.activeValidators?.length || 0}
                        </p>
                        <p className="text-xs text-slate-500 font-mono mt-1">
                          {registry.contractId.slice(0, 16)}...
                        </p>
                      </div>
                      <div className="px-3 py-1 bg-emerald-900/30 text-emerald-400 rounded text-sm">
                        Active
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-200 mb-4">
              Blacklist Validators
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Block transfers to/from specific parties. Click "Manage" to add or remove blocked parties.
            </p>

            {blacklistList.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div className="text-4xl mb-2">🚫</div>
                <p>No blacklist validators found</p>
                <p className="text-sm mt-1">Run the setup script to create the compliance infrastructure</p>
              </div>
            ) : (
              <div className="space-y-3">
                {blacklistList.map((validator) => (
                  <div
                    key={validator.contractId}
                    className="p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center">
                        <span className="text-2xl">🚫</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-200">
                          Blacklist Validator
                        </p>
                        <p className="text-sm text-slate-400">
                          Operator: {shortenParty(validator.payload.operator)}
                        </p>
                        <p className="text-sm text-red-400">
                          {extractFromDamlSet(validator.payload.blacklistedParties).length} blocked {extractFromDamlSet(validator.payload.blacklistedParties).length === 1 ? 'party' : 'parties'}
                        </p>
                      </div>
                      <Link
                        to={`/compliance/blacklist/${validator.contractId}`}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors font-medium"
                      >
                        Manage →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-200 mb-4">
              Claims Validators
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Require specific claims (KYC, AML, etc.) for transfers. ERC-3643 style compliance.
            </p>

            {claimsValidatorList.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div className="text-4xl mb-2">📜</div>
                <p>No claims validators found</p>
                <p className="text-sm mt-1">Run the setup script to create the compliance infrastructure</p>
              </div>
            ) : (
              <div className="space-y-3">
                {claimsValidatorList.map((validator) => {
                  const senderClaims = extractFromDamlSet(validator.payload.requiredSenderClaims);
                  const receiverClaims = extractFromDamlSet(validator.payload.requiredReceiverClaims);
                  const totalRequired = senderClaims.length + receiverClaims.length;

                  return (
                    <div
                      key={validator.contractId}
                      className="p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-cyan-600/20 flex items-center justify-center">
                          <span className="text-2xl">📜</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-200">
                            Claims Validator
                          </p>
                          <p className="text-sm text-slate-400">
                            Operator: {shortenParty(validator.payload.operator)}
                          </p>
                          <p className="text-sm text-cyan-400">
                            {totalRequired === 0 ? 'No claims required' : `${totalRequired} claim types required`}
                          </p>
                          {senderClaims.length > 0 && (
                            <p className="text-xs text-slate-500">Sender: {senderClaims.join(', ')}</p>
                          )}
                          {receiverClaims.length > 0 && (
                            <p className="text-xs text-slate-500">Receiver: {receiverClaims.join(', ')}</p>
                          )}
                        </div>
                        <Link
                          to={`/compliance/claims/${validator.contractId}`}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors font-medium"
                        >
                          Manage →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-200">
                  Party Identities
                </h3>
                <p className="text-sm text-slate-400">
                  Manage claims attached to party identities. Each party needs an identity to hold claims.
                </p>
              </div>
              <Link
                to="/compliance/identities"
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-white transition-colors font-medium"
              >
                Manage Identities →
              </Link>
            </div>

            {identityList.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div className="text-4xl mb-2">👤</div>
                <p>No identities found</p>
                <p className="text-sm mt-1">Create identities to attach claims to parties</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {identityList.slice(0, 6).map((identity) => {
                  const claims = identity.payload.claims as unknown;
                  let claimCount = 0;
                  if (claims) {
                    if (Array.isArray(claims)) {
                      claimCount = claims.length;
                    } else if (typeof claims === 'object') {
                      const claimsObj = claims as Record<string, unknown>;
                      if ('map' in claimsObj && Array.isArray(claimsObj.map)) {
                        claimCount = (claimsObj.map as unknown[]).length;
                      } else if ('map' in claimsObj && claimsObj.map && typeof claimsObj.map === 'object') {
                        claimCount = Object.keys(claimsObj.map as object).length;
                      } else if ('textMap' in claimsObj && claimsObj.textMap && typeof claimsObj.textMap === 'object') {
                        claimCount = Object.keys(claimsObj.textMap as object).length;
                      }
                    }
                  }

                  return (
                    <div
                      key={identity.contractId}
                      className="p-3 bg-slate-900/50 rounded-lg border border-slate-700"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center">
                          <span className="text-xl">👤</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-200 truncate">
                            {shortenParty(identity.payload.subject)}
                          </p>
                          <p className="text-xs text-emerald-400">
                            {claimCount} {claimCount === 1 ? 'claim' : 'claims'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {identityList.length > 6 && (
                  <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-600 flex items-center justify-center">
                    <p className="text-slate-400">+{identityList.length - 6} more</p>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="bg-slate-800/50 border-slate-600">
            <h3 className="text-lg font-semibold text-slate-300 mb-2">ℹ️ How Compliance Works</h3>
            <div className="text-sm text-slate-400 space-y-2">
              <p>
                <strong className="text-slate-300">1. Setup:</strong> The compliance registry and validators are created
                during system initialization by the Bank (issuer).
              </p>
              <p>
                <strong className="text-slate-300">2. Validators:</strong> Two types of validators:
                <span className="text-red-400"> Blacklist</span> (blocks specific parties) and
                <span className="text-cyan-400"> Claims</span> (requires KYC/AML credentials).
              </p>
              <p>
                <strong className="text-slate-300">3. Identities:</strong> Each party needs an Identity contract
                to hold claims. Claims are issued by the operator (Bank).
              </p>
              <p>
                <strong className="text-slate-300">4. Enforcement:</strong> If any validator rejects the transfer,
                the entire transaction fails. There is no way to bypass compliance.
              </p>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
