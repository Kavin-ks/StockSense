import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { GuestRoute, ProtectedRoute } from './components/ProtectedRoute.jsx';
import { Spinner } from './components/ui.jsx';
import { RequirePermission } from './components/RequirePermission.jsx';

// Route-level code splitting keeps the first load small.
const LoginPage = lazy(() => import('./pages/auth/LoginPage.jsx'));
const SignupPage = lazy(() => import('./pages/auth/SignupPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const OperationListPage = lazy(() => import('./pages/operations/OperationListPage.jsx'));
const OperationFormPage = lazy(() => import('./pages/operations/OperationFormPage.jsx'));
const AdjustmentPage = lazy(() => import('./pages/operations/AdjustmentPage.jsx'));
const ProductListPage = lazy(() => import('./pages/products/ProductListPage.jsx'));
const ProductFormPage = lazy(() => import('./pages/products/ProductFormPage.jsx'));
const CategoriesPage = lazy(() => import('./pages/products/CategoriesPage.jsx'));
const MoveHistoryPage = lazy(() => import('./pages/MoveHistoryPage.jsx'));
const WarehousesPage = lazy(() => import('./pages/settings/WarehousesPage.jsx'));
const LocationsPage = lazy(() => import('./pages/settings/LocationsPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const UsersPage = lazy(() => import('./pages/settings/UsersPage.jsx'));

const OPERATION_ROUTES = [
  { path: 'receipts', type: 'receipt' },
  { path: 'deliveries', type: 'delivery' },
  { path: 'transfers', type: 'internal' },
];

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/signup" element={<GuestRoute><SignupPage /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />

        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          {OPERATION_ROUTES.map(({ path, type }) => [
            <Route key={path} path={`operations/${path}`} element={<OperationListPage key={type} type={type} />} />,
            <Route key={`${path}-id`} path={`operations/${path}/:id`} element={<OperationFormPage key={type} type={type} />} />,
          ])}
          <Route path="operations/adjustments" element={<OperationListPage key="adjustment" type="adjustment" />} />
          <Route path="operations/adjustments/:id" element={<AdjustmentPage />} />
          <Route path="products" element={<ProductListPage key="catalog" />} />
          <Route path="products/categories" element={<CategoriesPage />} />
          <Route path="products/:id" element={<ProductFormPage />} />
          <Route path="stock" element={<ProductListPage key="stock" mode="stock" />} />
          <Route path="moves" element={<MoveHistoryPage />} />
          <Route path="settings/warehouses" element={<WarehousesPage />} />
          <Route path="settings/locations" element={<LocationsPage />} />
          <Route path="settings/users" element={<RequirePermission permission="users.manage"><UsersPage /></RequirePermission>} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
