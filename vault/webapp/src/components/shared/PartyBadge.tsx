import { Badge } from '@/components/ui';
import { formatPartyId } from '@/lib/utils';

interface PartyBadgeProps {
  party: string;
  showFull?: boolean;
}

export function PartyBadge({ party, showFull = false }: PartyBadgeProps) {
  return (
    <Badge variant="info">
      {showFull ? party : formatPartyId(party)}
    </Badge>
  );
}
