import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingState from './LoadingState.jsx';

export default function ProtectedRoute({ roles }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  
  if (isLoading) return <LoadingState label="Checking session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
