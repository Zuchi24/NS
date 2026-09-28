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
  CalendarRange,
  ClipboardList,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/components/ui/utils';
import { fetchCohorts } from '@/features/admin/adminService';
import { useAuth } from '@/features/auth/useAuth';
import { useAsync } from '@/services/useAsync';
import { ARCHIVE_ADMIN_PATH, archiveAdminPath } from '@/features/assessments/assessmentPaths';
import { BrandLogo } from '@/components/common/BrandLogo';

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

/**
 * The Academic Structure group's destinations. Exported for the same reason
 * as the lists above.
 */
export const ACADEMIC_ADMIN_PATH = '/admin/academic';

export const ADMIN_ACADEMIC_ITEMS = [
  { name: 'Academic Years', path: `${ACADEMIC_ADMIN_PATH}/years` },
  { name: 'Year Levels', path: `${ACADEMIC_ADMIN_PATH}/year-levels` },
  { name: 'Sections', path: `${ACADEMIC_ADMIN_PATH}/sections` },
];

/**
 * From `md` up the sidebar is always open; below it the same panel is a drawer
 * the layout opens and closes. Closed, it is also `invisible` there, so what
 * is offscreen is out of the tab order and the accessibility tree too.
 */
export function AdminSidebar({
  open = false,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
} = {}) {
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

  // The same for the academic structure group.
  const inAcademic = isActive(ACADEMIC_ADMIN_PATH);
  const [isAcademicExpanded, setIsAcademicExpanded] = useState(inAcademic);

  useEffect(() => {
    if (inAcademic) setIsAcademicExpanded(true);
  }, [inAcademic]);

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
    <div
      className={cn(
        'w-64 h-screen bg-white border-r border-slate-200 flex flex-col fixed left-0 top-0 overflow-y-auto z-50',
        'transition-[transform,visibility] duration-200 md:translate-x-0 md:visible',
        open ? 'translate-x-0 shadow-xl' : 'max-md:-translate-x-full max-md:invisible'
      )}
    >
      <div className="p-5">
        <div className="flex items-center justify-between gap-2 mb-8 px-1">
          <div className="flex items-center gap-2.5">
            <div>
              <BrandLogo className="h-8" />
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">Admin</p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="md:hidden p-2 -mr-2 rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="space-y-1">
          {ADMIN_NAV_ITEMS.map((item) => (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                isActive(item.path)
                  ? 'bg-blue-50 text-blue-600 shadow-[inset_3px_0_0_var(--color-blue-600)]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
                'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                inArchive
                  ? 'bg-blue-50 text-blue-600 shadow-[inset_3px_0_0_var(--color-blue-600)]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <div className="flex items-center gap-3">
                <Archive size={18} />
                <span>Archive</span>
              </div>
              {isArchiveExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {isArchiveExpanded && (
              <div className="mt-1 ml-4 border-l border-slate-200 pl-2 space-y-1">
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-500">
                  <ClipboardList size={14} />
                  Test
                </div>
                <div className="ml-4 border-l border-slate-200 pl-2 space-y-1">
                  {ADMIN_ARCHIVE_ITEMS.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      aria-current={location.pathname === item.path ? 'page' : undefined}
                      className={cn(
                        'w-full flex items-center px-3 py-1.5 rounded-md text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                        location.pathname === item.path
                          ? 'text-blue-600 font-medium bg-blue-50/50'
                          : 'text-gray-500 hover:bg-slate-100 hover:text-slate-800'
                      )}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Academic structure: years, year levels, each year's sections. */}
          <div>
            <button
              onClick={() => {
                setIsAcademicExpanded(!isAcademicExpanded);
                if (!isAcademicExpanded) navigate(ADMIN_ACADEMIC_ITEMS[0].path);
              }}
              aria-expanded={isAcademicExpanded}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                inAcademic
                  ? 'bg-blue-50 text-blue-600 shadow-[inset_3px_0_0_var(--color-blue-600)]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <div className="flex items-center gap-3">
                <CalendarRange size={18} />
                <span>Academic Structure</span>
              </div>
              {isAcademicExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {isAcademicExpanded && (
              <div className="mt-1 ml-4 border-l border-slate-200 pl-2 space-y-1">
                {ADMIN_ACADEMIC_ITEMS.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    aria-current={isActive(item.path) ? 'page' : undefined}
                    className={cn(
                      'w-full flex items-center px-3 py-1.5 rounded-md text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                      isActive(item.path)
                        ? 'text-blue-600 font-medium bg-blue-50/50'
                        : 'text-gray-500 hover:bg-slate-100 hover:text-slate-800'
                    )}
                  >
                    {item.name}
                  </button>
                ))}
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
                'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                isActive('/admin/students')
                  ? 'bg-blue-50 text-blue-600 shadow-[inset_3px_0_0_var(--color-blue-600)]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <div className="flex items-center gap-3">
                <Users size={18} />
                <span>Students</span>
              </div>
              {isStudentsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {isStudentsExpanded && (
              <div className="mt-1 ml-4 border-l border-slate-200 pl-2 space-y-1">
                {(cohorts ?? []).map((year) => (
                  <div key={year.id}>
                    <button
                      onClick={() => handleYearClick(year.id)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                        location.pathname.startsWith(`/admin/students/${year.id}`)
                          ? 'text-blue-600 bg-blue-50/50'
                          : 'text-gray-500 hover:bg-slate-100 hover:text-slate-800'
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
                      <div className="overflow-hidden mt-1 ml-4 border-l border-slate-200 pl-2 space-y-1">
                        {year.sections.map((section) => (
                          <button
                            key={section.id}
                            onClick={() =>
                              navigate(`/admin/students/${year.id}/${section.id}`)
                            }
                            className={cn(
                              'w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
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
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium mt-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              isActive('/admin/profile')
                ? 'bg-blue-50 text-blue-600 shadow-[inset_3px_0_0_var(--color-blue-600)]'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )}
          >
            <UserCircle size={18} />
            Profile
          </button>
        </nav>
      </div>

      <div className="mt-auto p-5 border-t border-slate-200">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );
}
