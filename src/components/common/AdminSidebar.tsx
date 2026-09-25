import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  Users,
  UserCircle,
  LogOut,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Map,
  BarChart3,
  Award,
  Archive,
  ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/components/ui/utils';
import { fetchCohorts } from '@/features/admin/adminService';
import { useAuth } from '@/features/auth/useAuth';
import { useAsync } from '@/services/useAsync';
import { ARCHIVE_ADMIN_PATH, archiveAdminPath } from '@/features/assessments/assessmentPaths';

/**
 * Where the sidebar can send an admin, exported so a test can hold these
 * against the route table.
 *
 * A destination here that no route matches is not a compile error — it is a
 * 404 the first time somebody clicks it, which is exactly how the achievements
 * link would have failed had it been added to only one of the two places. The
 * two buttons rendered outside this list, Students and Profile, are checked
 * alongside it.
 */
export const ADMIN_NAV_ITEMS = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
  { name: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
  { name: 'Roadmap', icon: Map, path: '/admin/roadmap' },
  { name: 'Achievements', icon: Award, path: '/admin/achievements' },
];

/**
 * The Archive group's destinations: archived assessment versions, a type at a
 * time, under Archive › Test. Exported for the same reason as the list above.
 */
export const ADMIN_ARCHIVE_ITEMS = [
  { name: 'Pre-Test', path: archiveAdminPath('pre_test') },
  { name: 'Post-Test', path: archiveAdminPath('post_test') },
];

export function AdminSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  // The real year levels and sections, so the tree the sidebar offers is the
  // one the drilldown can actually open.
  const { data: cohorts } = useAsync(fetchCohorts);

  const [isStudentsExpanded, setIsStudentsExpanded] = useState(true);
  const [expandedYear, setExpandedYear] = useState<number | null>(null);

  const isActive = (path: string) => location.pathname.startsWith(path);

  // Open while anywhere inside it, however the admin got there — a link, the
  // builder's Back, or a typed address — and otherwise as they left it.
  const inArchive = isActive(ARCHIVE_ADMIN_PATH);
  const [isArchiveExpanded, setIsArchiveExpanded] = useState(inArchive);

  useEffect(() => {
    if (inArchive) setIsArchiveExpanded(true);
  }, [inArchive]);

  const handleYearClick = (yearId: number) => {
    setExpandedYear(expandedYear === yearId ? null : yearId);
    navigate(`/admin/students/${yearId}`);
  };

  const handleLogout = async () => {
    // Awaited so the token is revoked and cleared before the login page mounts.
    await logout();
    toast.success('Logged out successfully');
    navigate('/login', { replace: true });
  };

  return (
    <div className="w-64 h-screen bg-white border-r border-gray-200 flex flex-col fixed left-0 top-0 overflow-y-auto z-50">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">N</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">NetSim</h1>
        </div>

        <nav className="space-y-1">
          {ADMIN_NAV_ITEMS.map((item) => (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive(item.path)
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon size={18} />
              {item.name}
            </button>
          ))}

          {/* Archive: archived assessment versions, under Test by type. */}
          <div>
            <button
              onClick={() => {
                setIsArchiveExpanded(!isArchiveExpanded);
                if (!isArchiveExpanded) navigate(ADMIN_ARCHIVE_ITEMS[0].path);
              }}
              aria-expanded={isArchiveExpanded}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                inArchive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <div className="flex items-center gap-3">
                <Archive size={18} />
                <span>Archive</span>
              </div>
              {isArchiveExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {isArchiveExpanded && (
              <div className="mt-1 ml-4 border-l border-gray-100 pl-2 space-y-1">
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-500">
                  <ClipboardList size={14} />
                  Test
                </div>
                <div className="ml-4 border-l border-gray-100 pl-2 space-y-1">
                  {ADMIN_ARCHIVE_ITEMS.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      aria-current={location.pathname === item.path ? 'page' : undefined}
                      className={cn(
                        'w-full flex items-center px-3 py-1.5 rounded-md text-xs transition-colors',
                        location.pathname === item.path
                          ? 'text-blue-600 font-medium bg-blue-50/50'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                      )}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Students hierarchical menu */}
          <div>
            <button
              onClick={() => {
                setIsStudentsExpanded(!isStudentsExpanded);
                if (!isStudentsExpanded) navigate('/admin/students');
              }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive('/admin/students')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <div className="flex items-center gap-3">
                <Users size={18} />
                <span>Students</span>
              </div>
              {isStudentsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {isStudentsExpanded && (
              <div className="mt-1 ml-4 border-l border-gray-100 pl-2 space-y-1">
                {(cohorts ?? []).map((year) => (
                  <div key={year.id}>
                    <button
                      onClick={() => handleYearClick(year.id)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                        location.pathname.startsWith(`/admin/students/${year.id}`)
                          ? 'text-blue-600 bg-blue-50/50'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <GraduationCap size={14} />
                        {year.name}
                      </div>
                      {expandedYear === year.id ? (
                        <ChevronDown size={12} />
                      ) : (
                        <ChevronRight size={12} />
                      )}
                    </button>

                    {expandedYear === year.id && (
                      <div className="overflow-hidden mt-1 ml-4 border-l border-gray-100 pl-2 space-y-1">
                        {year.sections.map((section) => (
                          <button
                            key={section.id}
                            onClick={() =>
                              navigate(`/admin/students/${year.id}/${section.id}`)
                            }
                            className={cn(
                              'w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md text-xs transition-colors',
                              location.pathname.startsWith(
                                `/admin/students/${year.id}/${section.id}`
                              )
                                ? 'text-blue-600 font-medium'
                                : 'text-gray-500 hover:text-gray-800'
                            )}
                          >
                            <span className="truncate">{section.name}</span>
                            <span className="text-gray-400">{section.studentsCount}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/admin/profile')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium mt-4 transition-colors',
              isActive('/admin/profile')
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <UserCircle size={18} />
            Profile
          </button>
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );
}
