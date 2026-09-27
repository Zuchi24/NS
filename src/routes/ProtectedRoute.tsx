import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/features/auth/useAuth";
import { VERIFY_EMAIL_PATH, mustVerifyEmail } from "@/features/auth/verification";
import { Loading } from "@/components/common/Loading";

/**
 * Gate for any route that requires a signed-in user. Sends visitors to /login
 * and remembers where they were headed so login can return them there.
 *
 * Also the one place an account that must confirm its email address is sent
 * to do so (see mustVerifyEmail), from whichever signed-in page it tried to
 * open — except the verification page itself.
 */
export function ProtectedRoute() {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (mustVerifyEmail(user) && location.pathname !== VERIFY_EMAIL_PATH) {
    return <Navigate to={VERIFY_EMAIL_PATH} state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}
