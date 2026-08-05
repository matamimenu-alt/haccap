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
// Phase 4 — Inspection Engine
import { InspectionsPage } from '@/pages/inspections/InspectionsPage';
import { InspectionNewPage } from '@/pages/inspections/InspectionNewPage';
import { InspectionDetailPage } from '@/pages/inspections/InspectionDetailPage';
import { InspectionTemplatesPage } from '@/pages/inspections/InspectionTemplatesPage';
import { FindingsPage } from '@/pages/inspections/FindingsPage';
// Phase 5 — Knowledge Engine
import { KnowledgePage } from '@/pages/knowledge/KnowledgePage';
import { KnowledgeDetailPage } from '@/pages/knowledge/KnowledgeDetailPage';
import { KnowledgeNewPage } from '@/pages/knowledge/KnowledgeNewPage';
// Phase 6 — HACCP + Food Safety
import { HaccpPlansPage } from '@/pages/haccp/HaccpPlansPage';
import { HaccpPlanDetailPage } from '@/pages/haccp/HaccpPlanDetailPage';
import { CcpsPage } from '@/pages/haccp/CcpsPage';
import { CcpMonitorPage } from '@/pages/haccp/CcpMonitorPage';
import { TemperaturePage } from '@/pages/food-safety/TemperaturePage';
import { ReceivingPage } from '@/pages/food-safety/ReceivingPage';
import { CleaningPage } from '@/pages/food-safety/CleaningPage';
import { PestControlPage } from '@/pages/food-safety/PestControlPage';
import { CalibrationPage } from '@/pages/food-safety/CalibrationPage';
import { CertificationsPage } from '@/pages/food-safety/CertificationsPage';
import { BatchesPage } from '@/pages/food-safety/BatchesPage';

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
            {/* Phase 4 — Inspection Engine */}
            <Route path="/inspections" element={<InspectionsPage />} />
            <Route path="/inspections/new" element={<InspectionNewPage />} />
            <Route path="/inspections/:id" element={<InspectionDetailPage />} />
            <Route path="/inspection-templates" element={<InspectionTemplatesPage />} />
            <Route path="/findings" element={<FindingsPage />} />
            {/* Phase 5 — Knowledge Engine */}
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/knowledge/new" element={<KnowledgeNewPage />} />
            <Route path="/knowledge/:id" element={<KnowledgeDetailPage />} />
            {/* Phase 6 — HACCP + Food Safety */}
            <Route path="/haccp/plans" element={<HaccpPlansPage />} />
            <Route path="/haccp/plans/:id" element={<HaccpPlanDetailPage />} />
            <Route path="/haccp/ccps" element={<CcpsPage />} />
            <Route path="/haccp/ccps/:id" element={<CcpMonitorPage />} />
            <Route path="/food-safety/temperature" element={<TemperaturePage />} />
            <Route path="/food-safety/receiving" element={<ReceivingPage />} />
            <Route path="/food-safety/cleaning" element={<CleaningPage />} />
            <Route path="/food-safety/pest-control" element={<PestControlPage />} />
            <Route path="/food-safety/calibration" element={<CalibrationPage />} />
            <Route path="/food-safety/certifications" element={<CertificationsPage />} />
            <Route path="/food-safety/batches" element={<BatchesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
