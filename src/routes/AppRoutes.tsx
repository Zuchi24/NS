import { Navigate, createBrowserRouter } from "react-router";
import type { RouteObject } from "react-router";

import { ProtectedRoute } from "./ProtectedRoute";
import { RoleRoute } from "./RoleRoute";
import { Loading } from "@/components/common/Loading";
import { StudentLayout } from "@/layouts/StudentLayout";

/**
 * The route table, and the app's only code-splitting boundary.
 *
 * Every page is loaded through React Router's own `lazy`, so a visitor
 * downloads the page they asked for and nothing else. This is the whole of the
 * splitting strategy: there is no manual chunk configuration anywhere, because
 * the honest boundary between "code this visitor needs" and "code they do not"
 * is the route they are on. Rollup works the rest out from these import()s and
 * hoists whatever genuinely turns out to be shared.
 *
 * What that buys, concretely: a student never downloads recharts, which is
 * ~300 KB and is reached only from the admin dashboard's completion chart; nor
 * react-dnd, which only the three simulation routes use; nor any admin page.
 *
 * Deliberately *not* lazy: the two route guards and the student layout. A gate
 * that arrives a moment after the thing it is gating is not a gate, and the
 * layout is on screen for every signed-in page anyway — splitting either would
 * add a request without removing a byte from anyone's first load.
 */

/** Stable module-level identity — an inline arrow here would remount on every render. */
/**
 * A route that only sends the visitor on, replacing itself in history. Lazy
 * like every page, though it imports nothing: the route table keeps every
 * addressable route behind `lazy`, and a redirect is no exception.
 */
const redirectTo = (to: string) => async () => ({
  Component: function Redirect() {
    return <Navigate to={to} replace />;
  },
});

const AdminOnly = () => <RoleRoute allow={["admin"]} />;

/** The same, for the pages only a student has any use for. */
const StudentOnly = () => <RoleRoute allow={["student"]} />;

/**
 * Shown while the first route's chunk is still arriving.
 *
 * Only ever seen on a cold load straight into a page — React Router resolves a
 * lazy route before committing the navigation, so moving *between* pages never
 * shows this and never blanks the screen.
 */
const HydrateFallback = () => <Loading />;

/**
 * The route table itself, exported separately from the router built out of it.
 *
 * `createBrowserRouter` returns a *processed* tree — Component becomes element,
 * HydrateFallback becomes hydrateFallbackElement — so the router is the wrong
 * thing to assert against. This is the definition as written, which is what the
 * tests check: that every page is behind a dynamic import, and that every one
 * of those imports resolves.
 */
export const routes: RouteObject[] = [
  // Public
  {
    path: "/",
    lazy: async () => ({ Component: (await import("@/pages/LandingPage")).LandingPage }),
    HydrateFallback,
  },
  {
    lazy: async () => ({ Component: (await import("@/layouts/AuthLayout")).AuthLayout }),
    HydrateFallback,
    children: [
      {
        path: "/login",
        lazy: async () => ({ Component: (await import("@/pages/auth/LoginPage")).LoginPage }),
      },
      {
        path: "/signup",
        lazy: async () => ({ Component: (await import("@/pages/auth/SignUpPage")).SignUpPage }),
      },
    ],
  },

  // Any signed-in user
  {
    Component: ProtectedRoute,
    HydrateFallback,
    children: [
      // Confirming the account's email address. Signed in, but outside the
      // app's own chrome: it is the one page an account that has not
      // confirmed its address can open (see mustVerifyEmail).
      {
        path: "/verify-email",
        lazy: async () => ({ Component: (await import("@/pages/auth/VerifyEmailPage")).VerifyEmailPage }),
      },
      // Content pages share the student chrome (sidebar + header).
      {
        Component: StudentLayout,
        children: [
          {
            path: "/dashboard",
            lazy: async () => ({ Component: (await import("@/pages/student/Dashboard")).Dashboard }),
          },
          {
            path: "/progress",
            lazy: async () => ({ Component: (await import("@/pages/student/Dashboard")).Dashboard }),
          },
          {
            path: "/challenges",
            lazy: async () => ({ Component: (await import("@/pages/student/ChallengePage")).ChallengePage }),
          },
          {
            path: "/roadmap",
            lazy: async () => ({ Component: (await import("@/pages/student/RoadmapPage")).RoadmapPage }),
          },
          {
            path: "/achievements",
            lazy: async () => ({ Component: (await import("@/pages/student/AchievementsPage")).AchievementsPage }),
          },
          {
            path: "/profile",
            lazy: async () => ({ Component: (await import("@/pages/student/UserProfile")).UserProfile }),
          },
        ],
      },
      /*
       * Immersive routes stay full-bleed so their canvases keep the viewport.
       * /simulations and /activities are older names for the canvas; they open
       * the one real workspace rather than a second copy of it — and because
       * all three point at the same module, they share one chunk.
       *
       * These are also where react-dnd lives now. Each of them mounts its own
       * DndProvider, so the library is fetched with the canvas that needs it
       * rather than by everyone on sign-in.
       */
      {
        path: "/simulations",
        lazy: async () => ({ Component: (await import("@/pages/simulations/Workspace")).Workspace }),
      },
      {
        path: "/activities",
        lazy: async () => ({ Component: (await import("@/pages/simulations/Workspace")).Workspace }),
      },
      {
        path: "/workspace",
        lazy: async () => ({ Component: (await import("@/pages/simulations/Workspace")).Workspace }),
      },
      {
        // Two benches behind one address: the physical one for a challenge
        // graded on the `rj45_cable` rule, the legacy one for everything else.
        // CableWiringRoute reads the challenge and chooses.
        path: "/challenge/cable-wiring",
        lazy: async () => ({
          Component: (await import("@/pages/simulations/CableWiringRoute")).CableWiringRoute,
        }),
      },
      {
        path: "/challenge/computer-assembly",
        lazy: async () => ({
          Component: (await import("@/pages/simulations/ComputerAssemblyChallenge"))
            .ComputerAssemblyChallenge,
        }),
      },
      {
        path: "/topic/:topicId",
        lazy: async () => ({
          Component: (await import("@/pages/student/TopicDetailsPage")).TopicDetailsPage,
        }),
      },
      // A section of a topic, opened the same way a topic is. Alongside the
      // topic route rather than nested under it: a section is addressed by its
      // own id, so its URL never has to name the topic holding it, and the page
      // stays reachable if the section is moved to another one.
      {
        path: "/subtopic/:subtopicId",
        lazy: async () => ({
          Component: (await import("@/pages/student/SubtopicDetailsPage")).SubtopicDetailsPage,
        }),
      },
    ],
  },

  // Students only. Taking an assessment is something only a student does — the
  // server refuses a submission from anyone else — so an admin is sent on
  // rather than shown a form that cannot be submitted. Full-bleed like a topic.
  {
    Component: StudentOnly,
    HydrateFallback,
    children: [
      {
        path: "/assessments/:assessmentId",
        lazy: async () => ({
          Component: (await import("@/pages/student/AssessmentPage")).AssessmentPage,
        }),
      },
    ],
  },

  // Admins only. The layout is lazy along with the pages under it: its sidebar
  // and header are admin chrome, and a student has no use for either.
  {
    Component: AdminOnly,
    HydrateFallback,
    children: [
      {
        path: "/instructor-review",
        lazy: async () => ({
          Component: (await import("@/pages/admin/InstructorDashboard")).InstructorDashboard,
        }),
      },
      {
        path: "/admin",
        lazy: async () => ({ Component: (await import("@/layouts/AdminLayout")).AdminLayout }),
        children: [
          {
            path: "dashboard",
            // Reaches CompletionChart, and through it recharts — by far the
            // largest single dependency in the app, and one no student needs.
            lazy: async () => ({ Component: (await import("@/pages/admin/Dashboard")).Dashboard }),
          },
          {
            path: "students",
            lazy: async () => ({
              Component: (await import("@/pages/admin/StudentsOverview")).StudentsOverview,
            }),
          },
          // Year level, section and student are addressed by id: names are
          // display text and two sections in different years share them.
          {
            path: "students/:year",
            lazy: async () => ({ Component: (await import("@/pages/admin/YearView")).YearView }),
          },
          {
            path: "students/:year/:sectionId",
            lazy: async () => ({ Component: (await import("@/pages/admin/SectionView")).SectionView }),
          },
          {
            path: "students/:year/:sectionId/:studentId",
            lazy: async () => ({
              Component: (await import("@/pages/admin/StudentDetail")).StudentDetail,
            }),
          },
          {
            path: "analytics",
            lazy: async () => ({ Component: (await import("@/pages/admin/Analytics")).Analytics }),
          },
          {
            path: "roadmap",
            lazy: async () => ({
              Component: (await import("@/pages/admin/RoadmapAdminPage")).RoadmapAdminPage,
            }),
          },
          // An assessment is built on a page of its own, addressed by its id
          // like a student is, and under roadmap because that is where it is
          // reached from and where its Back link returns to.
          {
            path: "roadmap/assessments/:assessmentId",
            lazy: async () => ({
              Component: (await import("@/pages/admin/AssessmentBuilderPage")).AssessmentBuilderPage,
            }),
          },
          {
            path: "achievements",
            lazy: async () => ({
              Component: (await import("@/pages/admin/AchievementAdminPage")).AchievementAdminPage,
            }),
          },
          // Archived assessment versions, a type at a time. The bare archive
          // and its Test group open onto the pre-tests; an unknown type is the
          // page's own "No such archive", as an unknown assessment id is the
          // builder's.
          { path: "archive", lazy: redirectTo("/admin/archive/tests/pre-test") },
          { path: "archive/tests", lazy: redirectTo("/admin/archive/tests/pre-test") },
          {
            path: "archive/tests/:type",
            lazy: async () => ({
              Component: (await import("@/pages/admin/AssessmentArchivePage")).AssessmentArchivePage,
            }),
          },
          // The academic structure: academic years, the year levels every
          // year shares, and each year's sections. The bare group address
          // opens onto the years, as the archive's opens onto its pre-tests.
          { path: "academic", lazy: redirectTo("/admin/academic/years") },
          {
            path: "academic/years",
            lazy: async () => ({
              Component: (await import("@/pages/admin/AcademicYearsPage")).AcademicYearsPage,
            }),
          },
          // Moving students into a year, addressed by the year they go into.
          {
            path: "academic/years/:id/promotion",
            lazy: async () => ({
              Component: (await import("@/pages/admin/PromotionPage")).PromotionPage,
            }),
          },
          {
            path: "academic/year-levels",
            lazy: async () => ({
              Component: (await import("@/pages/admin/YearLevelsPage")).YearLevelsPage,
            }),
          },
          {
            path: "academic/sections",
            lazy: async () => ({
              Component: (await import("@/pages/admin/SectionsAdminPage")).SectionsAdminPage,
            }),
          },
          {
            path: "profile",
            lazy: async () => ({ Component: (await import("@/pages/admin/AdminProfile")).AdminProfile }),
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
