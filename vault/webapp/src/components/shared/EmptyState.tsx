interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-4xl mb-4">{icon}</span>
      <h3 className="text-lg font-medium text-slate-200 mb-1">{title}</h3>
      {description && (
        <p className="text-slate-400 mb-4 max-w-sm">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="text-blue-500 hover:text-blue-400 font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
