import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/features/auth/useAuth";
import { Loading } from "@/components/common/Loading";
import type { Role } from "@/features/auth/types";

/**
 * Gate for routes restricted to particular roles. Signed-out visitors go to
 * /login; signed-in users without the role are bounced to their own dashboard
 * rather than shown a dead end.
 */
export function RoleRoute({ allow }: { allow: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!allow.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
