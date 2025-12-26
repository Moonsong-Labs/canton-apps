import { useAuth } from '@/hooks/useAuth';
import { useContractQuery } from '@/hooks/useLedger';
import { Card, Spinner } from '@/components/ui';
import { PartyBadge } from '@/components/shared';
import { 
  TemplateIds, 
  Compliance_Registry_ComplianceRegistry,
  Compliance_Validators_Blacklist_BlacklistValidator,
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

export function ComplianceDashboard() {
  const { party } = useAuth();

  const { data: registries, isLoading: loadingRegistries } = useContractQuery<Compliance_Registry_ComplianceRegistry.Payload>(
    TemplateIds.Compliance_Registry_ComplianceRegistry
  );

  const { data: validators, isLoading: loadingValidators } = useContractQuery<Compliance_Validators_Blacklist_BlacklistValidator.Payload>(
    TemplateIds.Compliance_Validators_Blacklist_BlacklistValidator
  );

  const { data: lunarDollars, isLoading: loadingLNRD } = useContractQuery<LunarDollar.Payload>(
    TemplateIds.LunarDollar
  );

  const registryList = (registries as RegistryContract[]) || [];
  const validatorList = (validators as BlacklistContract[]) || [];
  const lunarDollarList = (lunarDollars as LunarDollarContract[]) || [];
  const lunarDollar = lunarDollarList[0];

  const isLoading = loadingRegistries || loadingValidators || loadingLNRD;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Compliance Management</h2>
        <p className="text-slate-400">View and manage transfer validators for LNRD</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <h3 className="text-sm font-medium text-slate-400 mb-2">Current Party</h3>
          {party && <PartyBadge party={party} />}
        </Card>
        <Card className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border-indigo-700/50">
          <h3 className="text-sm font-medium text-slate-400 mb-2">LNRD Instrument</h3>
          <p className="text-lg font-bold text-white">{lunarDollar ? '✓ Active' : '⏳ Loading'}</p>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border-emerald-700/50">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Active Registries</h3>
          <p className="text-2xl font-bold text-white">{registryList.length}</p>
        </Card>
        <Card className="bg-gradient-to-br from-red-900/30 to-orange-900/30 border-red-700/50">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Blacklist Validators</h3>
          <p className="text-2xl font-bold text-white">{validatorList.length}</p>
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

            {validatorList.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div className="text-4xl mb-2">🚫</div>
                <p>No blacklist validators found</p>
                <p className="text-sm mt-1">Run the setup script to create the compliance infrastructure</p>
              </div>
            ) : (
              <div className="space-y-3">
                {validatorList.map((validator) => (
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
                          {validator.payload.blacklistedParties?.length || 0} blocked {validator.payload.blacklistedParties?.length === 1 ? 'party' : 'parties'}
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

          <Card className="bg-slate-800/50 border-slate-600">
            <h3 className="text-lg font-semibold text-slate-300 mb-2">ℹ️ How Compliance Works</h3>
            <div className="text-sm text-slate-400 space-y-2">
              <p>
                <strong className="text-slate-300">1. Setup:</strong> The compliance registry and validators are created 
                during system initialization by the Bank (issuer).
              </p>
              <p>
                <strong className="text-slate-300">2. Attachment:</strong> The compliance registry is attached directly 
                to the LunarDollar instrument contract. This cannot be changed by users.
              </p>
              <p>
                <strong className="text-slate-300">3. Validation:</strong> When any transfer is accepted, the system 
                automatically looks up the compliance registry from the LunarDollar contract and runs all validators.
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
