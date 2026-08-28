import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/features/auth/useAuth";
import { Loading } from "@/components/common/Loading";

/**
 * Gate for any route that requires a signed-in user. Sends visitors to /login
 * and remembers where they were headed so login can return them there.
 */
export function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}
