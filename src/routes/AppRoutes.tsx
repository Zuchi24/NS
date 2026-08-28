import { createBrowserRouter } from "react-router";

import { ProtectedRoute } from "./ProtectedRoute";
import { RoleRoute } from "./RoleRoute";

import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { SignUpPage } from "@/pages/auth/SignUpPage";
import { Dashboard } from "@/pages/student/Dashboard";
import { SimulationWorkspace } from "@/pages/simulations/SimulationWorkspace";
import { ChallengePage } from "@/pages/student/ChallengePage";
import { InstructorDashboard } from "@/pages/admin/InstructorDashboard";
import { Workspace } from "@/pages/simulations/Workspace";
import { UserProfile } from "@/pages/student/UserProfile";
import { CableWiringChallenge } from "@/pages/simulations/CableWiringChallenge";
import { ComputerAssemblyChallenge } from "@/pages/simulations/ComputerAssemblyChallenge";
import { RoadmapPage } from "@/pages/student/RoadmapPage";
import { TopicDetailsPage } from "@/pages/student/TopicDetailsPage";

import { AdminLayout } from "@/layouts/AdminLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { StudentLayout } from "@/layouts/StudentLayout";
import { Dashboard as AdminDashboard } from "@/pages/admin/Dashboard";
import { StudentsOverview } from "@/pages/admin/StudentsOverview";
import { YearView } from "@/pages/admin/YearView";
import { SectionView } from "@/pages/admin/SectionView";
import { StudentDetail } from "@/pages/admin/StudentDetail";
import { Analytics } from "@/pages/admin/Analytics";
import { Settings } from "@/pages/admin/Settings";
import { RoadmapAdminPage } from "@/pages/admin/RoadmapAdminPage";

/** Stable module-level identity — an inline arrow here would remount on every render. */
const AdminOnly = () => <RoleRoute allow={["admin"]} />;

export const router = createBrowserRouter([
  // Public
  { path: "/", Component: LandingPage },
  {
    Component: AuthLayout,
    children: [
      { path: "/login", Component: LoginPage },
      { path: "/signup", Component: SignUpPage },
    ],
  },

  // Any signed-in user
  {
    Component: ProtectedRoute,
    children: [
      // Content pages share the student chrome (sidebar + header).
      {
        Component: StudentLayout,
        children: [
          { path: "/dashboard", Component: Dashboard },
          { path: "/progress", Component: Dashboard },
          { path: "/challenges", Component: ChallengePage },
          { path: "/roadmap", Component: RoadmapPage },
          { path: "/profile", Component: UserProfile },
        ],
      },
      // Immersive routes stay full-bleed so their canvases keep the viewport.
      { path: "/simulations", Component: SimulationWorkspace },
      { path: "/activities", Component: SimulationWorkspace },
      { path: "/workspace", Component: Workspace },
      { path: "/challenge/cable-wiring", Component: CableWiringChallenge },
      { path: "/challenge/computer-assembly", Component: ComputerAssemblyChallenge },
      { path: "/topic/:topicId", Component: TopicDetailsPage },
    ],
  },

  // Admins only
  {
    Component: AdminOnly,
    children: [
      { path: "/instructor-review", Component: InstructorDashboard },
      {
        path: "/admin",
        Component: AdminLayout,
        children: [
          { path: "dashboard", Component: AdminDashboard },
          { path: "students", Component: StudentsOverview },
          { path: "students/:year", Component: YearView },
          { path: "students/:year/:sectionId", Component: SectionView },
          { path: "students/:year/:sectionId/:studentId", Component: StudentDetail },
          { path: "analytics", Component: Analytics },
          { path: "roadmap", Component: RoadmapAdminPage },
          { path: "settings", Component: Settings },
        ],
      },
    ],
  },
]);
