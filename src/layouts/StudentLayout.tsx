import { Link, Outlet, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Target,
  Wrench,
  Map,
  Trophy,
  User,
  LogOut,
  Network,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/components/ui/utils";
import { useAuth } from "@/features/auth/useAuth";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { name: "Challenges", icon: Target, path: "/challenges" },
  { name: "Workspace", icon: Wrench, path: "/workspace" },
  { name: "Roadmap", icon: Map, path: "/roadmap" },
  { name: "Achievements", icon: Trophy, path: "/achievements" },
];

/**
 * Shell for the student-facing content pages. Immersive routes (the workspace
 * and the challenge runners) are deliberately left outside this layout so their
 * canvases keep the full viewport width.
 */
export function StudentLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    // Awaited so the token is revoked and cleared before the login page mounts.
    await logout();
    toast.success("Logged out successfully");
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Network className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">NetSim</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                location.pathname.startsWith(item.path)
                  ? "bg-blue-50 text-blue-600 font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 space-y-1">
          <Link
            to="/profile"
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
              location.pathname.startsWith("/profile")
                ? "bg-blue-50 text-blue-600 font-medium"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <User className="w-5 h-5" />
            Profile
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          {/* Search and notifications used to sit here. Neither exists: there
              is no search endpoint and no notifications feature, and a box that
              never finds anything beside a bell that is permanently unread are
              worse than the space they took. */}
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-4">
              <Link
                to="/profile"
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <div className="text-right">
                  <div className="font-semibold text-gray-900 text-sm">
                    {user?.name ?? "Student"}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {user?.role ?? "student"}
                  </div>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
