import { Outlet } from "react-router";
import { Network, Cable, Monitor, Wifi } from "lucide-react";

/**
 * Shared shell for /login and /signup: the gradient page, the faint networking
 * motif, and the centered white card. Auth pages render only their own content.
 */
export function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-gray-50 to-orange-50 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5" aria-hidden="true">
        <div className="absolute top-20 left-20">
          <Network className="w-32 h-32 text-blue-600" />
        </div>
        <div className="absolute top-40 right-40">
          <Cable className="w-24 h-24 text-orange-600" />
        </div>
        <div className="absolute bottom-20 left-1/3">
          <Monitor className="w-28 h-28 text-blue-600" />
        </div>
        <div className="absolute bottom-40 right-20">
          <Wifi className="w-36 h-36 text-orange-600" />
        </div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
