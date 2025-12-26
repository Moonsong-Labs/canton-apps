import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MainLayout } from '@/components/layout';
import { PartySelector } from '@/features/auth';
import { Dashboard } from '@/features/dashboard';
import { ContractList } from '@/features/contracts';
import { VaultDashboard } from '@/features/vault/VaultDashboard';
import { VaultConfigList } from '@/features/vault/VaultConfigList';
import { VaultConfigDetail } from '@/features/vault/VaultConfigDetail';
import { VaultStateList } from '@/features/vault/VaultStateList';
import { VaultStateDetail } from '@/features/vault/VaultStateDetail';
import { DepositRequestList } from '@/features/vault/DepositRequestList';
import { RedeemRequestList } from '@/features/vault/RedeemRequestList';
import { CreateAccountRequestList } from '@/features/vault/CreateAccountRequestList';
import { CreditAccountRequestList } from '@/features/vault/CreditAccountRequestList';
import { LunarDollarBalance, LunarDollarTransfers } from '@/features/lunar-dollar';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PartySelector />} />
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/lunar-dollar" element={<LunarDollarBalance />} />
          <Route path="/lunar-dollar/transfers" element={<LunarDollarTransfers />} />
          <Route path="/contracts" element={<ContractList />} />

          {/* Vault Routes */}
          <Route path="/vault" element={<VaultDashboard />} />
          <Route path="/vault/config" element={<VaultConfigList />} />
          <Route path="/vault/config/:id" element={<VaultConfigDetail />} />
          <Route path="/vault/state" element={<VaultStateList />} />
          <Route path="/vault/state/:id" element={<VaultStateDetail />} />
          <Route path="/vault/deposits" element={<DepositRequestList />} />
          <Route path="/vault/redeems" element={<RedeemRequestList />} />
          <Route path="/vault/accounts/create" element={<CreateAccountRequestList />} />
          <Route path="/vault/accounts/credit" element={<CreditAccountRequestList />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
