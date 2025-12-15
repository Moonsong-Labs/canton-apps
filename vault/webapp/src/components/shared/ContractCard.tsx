import { Card, Badge, Button } from '@/components/ui';

interface ContractCardProps {
  contractId: string;
  templateName: string;
  payload: Record<string, unknown>;
  onView?: () => void;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
    loading?: boolean;
  }>;
}

export function ContractCard({
  contractId,
  templateName,
  payload,
  onView,
  actions = [],
}: ContractCardProps) {
  return (
    <Card className="hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <Badge variant="default">{templateName}</Badge>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            {contractId.slice(0, 16)}...
          </p>
        </div>
        {onView && (
          <Button variant="ghost" size="sm" onClick={onView}>
            View
          </Button>
        )}
      </div>
      
      <div className="space-y-2 text-sm">
        {Object.entries(payload).slice(0, 3).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className="text-slate-400">{key}:</span>
            <span className="text-slate-200 truncate max-w-[200px]">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>

      {actions.length > 0 && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700">
          {actions.map((action, i) => (
            <Button
              key={i}
              variant={action.variant || 'secondary'}
              size="sm"
              onClick={action.onClick}
              loading={action.loading}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}
