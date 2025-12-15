import { createContext, useContext, useState, useMemo, ReactNode } from 'react';

type Party = string;

interface AuthContextType {
  party: Party | null;
  setParty: (party: Party | null) => void;
  roles: string[];
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [party, setParty] = useState<Party | null>(null);
  const [roles] = useState<string[]>(['user']);

  const value = useMemo(
    () => ({
      party,
      setParty,
      roles,
      isAuthenticated: !!party,
    }),
    [party, roles]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
