import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function PublicOnlyRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  }

  if (user) {
    // If they were sent here by ProtectedRoute, send them back where they came from.
    const from = location.state?.from?.pathname ?? '/dashboard';
    return <Navigate to={from} replace />;
  }

  return <Outlet />;
}