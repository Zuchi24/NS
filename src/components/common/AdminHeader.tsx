import { Link } from 'react-router';
import { Menu } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';

interface HeaderProps {
  title: string;
  /** Whether the narrow-screen navigation drawer is open. */
  menuOpen?: boolean;
  /** Opens the navigation drawer; the button only shows below `md`. */
  onOpenMenu?: () => void;
}

/** Up to two initials from a display name, for the avatar. */
function initials(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'A';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function AdminHeader({ title, menuOpen = false, onOpenMenu }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {onOpenMenu && (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            className="md:hidden p-2 -ml-2 rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h2 className="text-lg font-semibold text-slate-900 tracking-tight truncate">{title}</h2>
      </div>

      {user && (
        <Link
          to="/admin/profile"
          className="flex items-center gap-3 rounded-lg px-1.5 py-1 hover:bg-slate-100 transition-colors min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <span className="sr-only sm:hidden">Profile</span>
          <div className="text-right hidden sm:block min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">{user.name}</div>
            <div className="text-xs text-slate-500 capitalize">{user.role}</div>
          </div>
          <div
            className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-sm font-semibold flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            {initials(user.name)}
          </div>
        </Link>
      )}
    </header>
  );
}
