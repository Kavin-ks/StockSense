import { useAuth } from '../context/AuthContext.jsx';
import { ErrorState } from './ui.jsx';

/** Route guard for manager-only screens (the API enforces the same rule). */
export function RequirePermission({ permission, children }) {
  const { can } = useAuth();
  return can(permission) ? children : <ErrorState error={{ message: 'This page is only available to inventory managers.' }} />;
}
