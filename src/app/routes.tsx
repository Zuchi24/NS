import { createBrowserRouter } from "react-router";
import { LandingPage } from "./components/LandingPage";
import { LoginPage } from "./components/LoginPage";
import { SignUpPage } from "./components/SignUpPage";
import { Dashboard } from "./components/Dashboard";
import { SimulationWorkspace } from "./components/SimulationWorkspace";
import { ChallengePage } from "./components/ChallengePage";
import { InstructorDashboard } from "./components/InstructorDashboard";
import { Workspace } from "./components/Workspace";
import { UserProfile } from "./components/UserProfile";
import { CableWiringChallenge } from "./components/CableWiringChallenge";
import { ComputerAssemblyChallenge } from "./components/ComputerAssemblyChallenge";
import { RoadmapPage } from "./components/RoadmapPage";
import { TopicDetailsPage } from "./components/TopicDetailsPage";
import { AdminLayout } from "./components/admin/AdminLayout";
import { Dashboard as AdminDashboard } from "./components/admin/Dashboard";
import { StudentsOverview } from "./components/admin/StudentsOverview";
import { YearView } from "./components/admin/YearView";
import { SectionView } from "./components/admin/SectionView";
import { StudentDetail } from "./components/admin/StudentDetail";
import { Analytics } from "./components/admin/Analytics";
import { Settings } from "./components/admin/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LandingPage,
  },
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/signup",
    Component: SignUpPage,
  },
  {
    path: "/dashboard",
    Component: Dashboard,
  },
  {
    path: "/simulations",
    Component: SimulationWorkspace,
  },
  {
    path: "/challenges",
    Component: ChallengePage,
  },
  {
    path: "/activities",
    Component: SimulationWorkspace,
  },
  {
    path: "/progress",
    Component: Dashboard,
  },
  {
    path: "/instructor-review",
    Component: InstructorDashboard,
  },
  {
    path: "/workspace",
    Component: Workspace,
  },
  {
    path: "/profile",
    Component: UserProfile,
  },
  {
    path: "/challenge/cable-wiring",
    Component: CableWiringChallenge,
  },
  {
    path: "/challenge/computer-assembly",
    Component: ComputerAssemblyChallenge,
  },
  {
    path: "/roadmap",
    Component: RoadmapPage,
  },
  {
    path: "/topic/:topicId",
    Component: TopicDetailsPage,
  },
  {
    path: "/admin",
    Component: AdminLayout,
    children: [
      {
        path: "dashboard",
        Component: AdminDashboard,
      },
      {
        path: "students",
        Component: StudentsOverview,
      },
      {
        path: "students/:year",
        Component: YearView,
      },
      {
        path: "students/:year/:sectionId",
        Component: SectionView,
      },
      {
        path: "students/:year/:sectionId/:studentId",
        Component: StudentDetail,
      },
      {
        path: "analytics",
        Component: Analytics,
      },
      {
        path: "settings",
        Component: Settings,
      },
    ],
  },
]);
