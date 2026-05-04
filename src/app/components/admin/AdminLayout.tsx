import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useLocation, useParams } from 'react-router';

export function AdminLayout() {
  const location = useLocation();
  const params = useParams();

  // Determine the page title based on the current route
  const getPageTitle = () => {
    const path = location.pathname;

    if (path.includes('/admin/settings')) return 'Platform Settings';
    if (path.includes('/admin/roadmap')) return 'Roadmap Materials';
    if (path.includes('/admin/analytics')) return 'Analytics & Insights';
    if (path.includes('/admin/profile')) return 'Admin Profile';
    if (path.includes('/admin/dashboard')) return 'Admin Dashboard';

    // Student routes
    if (params.studentId) return 'Student Details';
    if (params.sectionId) return `${params.year} - ${params.sectionId}`;
    if (params.year) return params.year;
    if (path.includes('/admin/students')) return 'Students';

    return 'Dashboard';
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden ml-64">
        <Header title={getPageTitle()} />
        <main className="flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
