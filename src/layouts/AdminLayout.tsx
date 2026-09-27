import { useEffect, useState } from 'react';
import { Outlet, useLocation, useParams } from 'react-router';
import { AdminSidebar } from '@/components/common/AdminSidebar';
import { AdminHeader } from '@/components/common/AdminHeader';

export function AdminLayout() {
  const location = useLocation();
  const params = useParams();

  // Below `md` the sidebar is a drawer; arriving somewhere new closes it.
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  // Determine the page title based on the current route. The drilldown's
  // segments are ids, so each level names itself generically and the page
  // underneath shows the year, section and student it actually loaded.
  const getPageTitle = () => {
    const path = location.pathname;

    // The archive is named by the type it lists; the bare archive redirects to
    // the pre-tests, so that is its title too.
    if (path.startsWith('/admin/archive/tests/post-test')) return 'Archive · Post-Tests';
    if (path.startsWith('/admin/archive')) return 'Archive · Pre-Tests';
    if (path.startsWith('/admin/academic/years/') && path.endsWith('/promotion')) {
      return 'Academic Structure · Move Students In';
    }
    if (path.startsWith('/admin/academic/year-levels')) return 'Academic Structure · Year Levels';
    if (path.startsWith('/admin/academic/sections')) return 'Academic Structure · Sections';
    if (path.startsWith('/admin/academic')) return 'Academic Structure · Academic Years';
    if (path.includes('/admin/achievements')) return 'Achievements';
    if (path.includes('/admin/roadmap')) return 'Roadmap Content';
    if (path.includes('/admin/analytics')) return 'Analytics & Insights';
    if (path.includes('/admin/profile')) return 'Admin Profile';
    if (path.includes('/admin/dashboard')) return 'Admin Dashboard';

    if (params.studentId) return 'Student Details';
    if (params.sectionId) return 'Section';
    if (params.year) return 'Year Level';
    if (path.includes('/admin/students')) return 'Students';

    return 'Dashboard';
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <AdminSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      {menuOpen && (
        <div
          className="fixed inset-0 z-[45] bg-slate-900/50 md:hidden"
          // The close button and Escape do the same, so it needs no name.
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 md:ml-64">
        <AdminHeader
          title={getPageTitle()}
          menuOpen={menuOpen}
          onOpenMenu={() => setMenuOpen(true)}
        />
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
