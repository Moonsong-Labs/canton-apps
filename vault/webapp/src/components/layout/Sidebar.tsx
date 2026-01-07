import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

interface NavGroup {
  label: string;
  icon: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

function shortenParty(party: string): string {
  if (typeof party !== 'string') return String(party);
  if (party.includes('::')) {
    const [name] = party.split('::');
    return name;
  }
  return party.length > 20 ? `${party.slice(0, 8)}...${party.slice(-8)}` : party;
}

function NavGroupComponent({ group }: { group: NavGroup }) {
  const location = useLocation();
  const isGroupActive = group.items.some(item => location.pathname.startsWith(item.to));
  const [isOpen, setIsOpen] = useState(group.defaultOpen || isGroupActive);

  if (group.items.length === 1) {
    const item = group.items[0];
    return (
      <NavLink
        to={item.to}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive
            ? 'bg-blue-600 text-white'
            : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-200'
          }`
        }
      >
        <span>{group.icon}</span>
        <span className="font-medium text-sm">{group.label}</span>
      </NavLink>
    );
  }

  return (
    <div className="mb-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${isGroupActive
          ? 'bg-slate-700/50 text-white'
          : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-200'
          }`}
      >
        <div className="flex items-center gap-3">
          <span>{group.icon}</span>
          <span className="font-medium text-sm">{group.label}</span>
        </div>
        <span className={`transition-transform duration-200 text-xs ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="pl-4 mt-1 space-y-0.5">
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/vault' || item.to === '/lunar-dollar' || item.to === '/compliance'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors text-sm ${isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700'
                }`
              }
            >
              <span className="text-xs">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { party } = useAuth();

  const partyName = party ? shortenParty(party).toLowerCase() : '';
  const isBank = partyName === 'bank';

  const baseGroups: NavGroup[] = [
    {
      label: 'Overview',
      icon: '📊',
      defaultOpen: true,
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
      ],
    },
    {
      label: 'Lunar Dollar',
      icon: '🌙',
      items: [
        { to: '/lunar-dollar', label: 'Balance', icon: '💰' },
        { to: '/lunar-dollar/transfers', label: 'Transfers', icon: '💸' },
      ],
    },
    {
      label: 'Vault',
      icon: '🏦',
      items: [
        { to: '/vault', label: 'Dashboard', icon: '📊' },
        { to: '/vault/state', label: 'States', icon: '📈' },
        { to: '/vault/config', label: 'Configs', icon: '⚙️' },
        { to: '/vault/deposits', label: 'Deposits', icon: '📥' },
        { to: '/vault/redeems', label: 'Redeems', icon: '📤' },
      ],
    },
    {
      label: 'Accounts',
      icon: '👤',
      items: [
        { to: '/vault/accounts/create', label: 'Create Account', icon: '➕' },
        { to: '/vault/accounts/credit', label: 'Credit Account', icon: '💳' },
      ],
    },
  ];

  const complianceGroup: NavGroup = {
    label: isBank ? 'Compliance' : 'My Identity',
    icon: '🛡️',
    items: [
      { to: isBank ? '/compliance' : '/compliance/identities', label: isBank ? 'Compliance Management' : 'My Identity', icon: '🛡️' },
    ],
  };

  const debugGroup: NavGroup = {
    label: 'Debug',
    icon: '🔧',
    items: [
      { to: '/contracts', label: 'All Contracts', icon: '📄' },
    ],
  };

  const navGroups = [...baseGroups, complianceGroup, debugGroup];

  return (
    <aside className="w-56 bg-slate-800 border-r border-slate-700 min-h-[calc(100vh-73px)]">
      <nav className="p-3 space-y-1">
        {navGroups.map((group) => (
          <NavGroupComponent key={group.label} group={group} />
        ))}
      </nav>
    </aside>
  );
}
