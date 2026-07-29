import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RequireAuth } from '@/components/shared/require-auth';
import { AppShell } from '@/components/layout/app-shell';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { CompanyPage } from '@/pages/organization/CompanyPage';
import { BrandsPage } from '@/pages/organization/BrandsPage';
import { BranchesPage } from '@/pages/organization/BranchesPage';
import { UsersPage } from '@/pages/organization/UsersPage';
import { RolesPage } from '@/pages/organization/RolesPage';
import { DepartmentsPage } from '@/pages/organization/DepartmentsPage';
import { OrgLevelsPage } from '@/pages/organization/OrgLevelsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="/organization/company" element={<CompanyPage />} />
            <Route path="/organization/brands" element={<BrandsPage />} />
            <Route path="/organization/branches" element={<BranchesPage />} />
            <Route path="/organization/users" element={<UsersPage />} />
            <Route path="/organization/roles" element={<RolesPage />} />
            <Route path="/organization/departments" element={<DepartmentsPage />} />
            <Route path="/organization/org-levels" element={<OrgLevelsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
