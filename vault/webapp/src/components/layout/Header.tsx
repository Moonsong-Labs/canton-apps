import { useAuth } from '@/hooks/useAuth';
import { PartyBadge } from '@/components/shared';
import { Button } from '@/components/ui';

export function Header() {
  const { party, setParty } = useAuth();

  return (
    <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">vault</h1>
        <div className="flex items-center gap-4">
          {party && <PartyBadge party={party} />}
          <Button variant="ghost" size="sm" onClick={() => setParty(null)}>
            Switch Party
          </Button>
        </div>
      </div>
    </header>
  );
}
