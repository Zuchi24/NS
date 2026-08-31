import { Outlet, useLocation, useParams } from 'react-router';
import { AdminSidebar } from '@/components/common/AdminSidebar';
import { AdminHeader } from '@/components/common/AdminHeader';

export function AdminLayout() {
  const location = useLocation();
  const params = useParams();

  // Determine the page title based on the current route. The drilldown's
  // segments are ids, so each level names itself generically and the page
  // underneath shows the year, section and student it actually loaded.
  const getPageTitle = () => {
    const path = location.pathname;

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
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden ml-64">
        <AdminHeader title={getPageTitle()} />
        <main className="flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
