/**
 * Contract List View
 * 
 * A generic contract browser that works with any template.
 * Select a template from the dropdown to view contracts of that type.
 */

import { useState, useMemo } from 'react';
import { Card, Spinner, Select } from '@/components/ui';
import { EmptyState, ContractCard } from '@/components/shared';
import { useAnyContracts, getAvailableTemplates, TemplateIds } from '@/hooks/useContracts';

export function ContractList() {
  // Get all available templates from the SDK
  const templates = useMemo(() => getAvailableTemplates(), []);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(templates[0] || '');

  // Get the actual template ID string
  const templateId = selectedTemplate ? (TemplateIds as Record<string, string>)[selectedTemplate] : '';

  // Query contracts for the selected template
  const { data: contracts, isLoading, error } = useAnyContracts(
    templateId,
    undefined,
    { enabled: !!templateId }
  );

  // Build select options
  const templateOptions = useMemo(() => 
    templates.map(t => ({
      value: t,
      label: t.replace(/_/g, ' / '),
    })),
    [templates]
  );

  if (templates.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-100">Contracts</h2>
        <EmptyState
          icon="📭"
          title="No templates found"
          description="The SDK doesn't have any templates. Make sure the SDK was generated correctly."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100">Contracts</h2>
        <div className="w-64">
          <Select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            options={templateOptions}
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <Card className="bg-red-900/20 border-red-800">
          <p className="text-red-400">Failed to load contracts: {String(error)}</p>
        </Card>
      )}

      {!isLoading && !error && contracts?.length === 0 && (
        <EmptyState
          icon="📄"
          title="No contracts found"
          description={`No ${selectedTemplate.replace(/_/g, ' ')} contracts exist on the ledger.`}
        />
      )}

      {!isLoading && !error && contracts && contracts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contracts.map((contract) => (
            <ContractCard
              key={contract.contractId}
              contractId={contract.contractId}
              templateName={selectedTemplate.split('_').pop() || selectedTemplate}
              payload={contract.payload as Record<string, unknown>}
            />
          ))}
        </div>
      )}

      <Card className="bg-slate-800/50">
        <p className="text-slate-400 text-sm">
          <strong className="text-slate-300">Tip:</strong> Create typed hooks in{' '}
          <code className="text-blue-400">src/hooks/useContracts.ts</code> for better
          type safety and custom filtering.
        </p>
      </Card>
    </div>
  );
}
