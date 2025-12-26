import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/lunar-dollar', label: 'LNRD Balance', icon: '🌙' },
  { to: '/lunar-dollar/transfers', label: 'LNRD Transfers', icon: '💸' },
  { to: '/vault', label: 'Vault Dashboard', icon: '🏦' },
  { to: '/vault/state', label: 'Vault States', icon: '📈' },
  { to: '/vault/config', label: 'Vault Configs', icon: '⚙️' },
  { to: '/vault/deposits', label: 'Deposits', icon: '💰' },
  { to: '/vault/redeems', label: 'Redeems', icon: '💸' },
  { to: '/vault/accounts/create', label: 'Create Accounts', icon: '👤' },
  { to: '/vault/accounts/credit', label: 'Credit Accounts', icon: '💳' },
  { to: '/contracts', label: 'All Contracts', icon: '📄' },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-slate-800 border-r border-slate-700 min-h-[calc(100vh-73px)]">
      <nav className="p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
