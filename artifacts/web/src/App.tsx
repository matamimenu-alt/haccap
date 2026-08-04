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
// Phase 2 — Operations Core
import { AssetsPage } from '@/pages/operations/AssetsPage';
import { AssetDetailPage } from '@/pages/operations/AssetDetailPage';
import { AssetNewPage } from '@/pages/operations/AssetNewPage';
import { AreasPage } from '@/pages/operations/AreasPage';
import { AssetCategoriesPage } from '@/pages/operations/AssetCategoriesPage';
import { SuppliersPage } from '@/pages/operations/SuppliersPage';
import { MaintenancePage } from '@/pages/operations/MaintenancePage';
import { QrScanPage } from '@/pages/operations/QrScanPage';
// Phase 3 — Task Engine
import { TasksPage } from '@/pages/tasks/TasksPage';
import { TaskDetailPage } from '@/pages/tasks/TaskDetailPage';
import { TaskNewPage } from '@/pages/tasks/TaskNewPage';
import { TaskTemplatesPage } from '@/pages/tasks/TaskTemplatesPage';

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
            {/* Phase 2 — Operations Core */}
            <Route path="/operations/assets" element={<AssetsPage />} />
            <Route path="/operations/assets/new" element={<AssetNewPage />} />
            <Route path="/operations/assets/:id" element={<AssetDetailPage />} />
            <Route path="/operations/areas" element={<AreasPage />} />
            <Route path="/operations/asset-categories" element={<AssetCategoriesPage />} />
            <Route path="/operations/suppliers" element={<SuppliersPage />} />
            <Route path="/operations/maintenance" element={<MaintenancePage />} />
            <Route path="/s/:token" element={<QrScanPage />} />
            {/* Phase 3 — Task Engine */}
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/new" element={<TaskNewPage />} />
            <Route path="/tasks/templates" element={<TaskTemplatesPage />} />
            <Route path="/tasks/:id" element={<TaskDetailPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
