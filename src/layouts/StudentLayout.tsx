import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Target,
  Wrench,
  Map,
  Trophy,
  User,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/components/ui/utils";
import { useAuth } from "@/features/auth/useAuth";
import { ProfileAvatar } from "@/features/profile/ProfileAvatar";
import { BrandLogo } from "@/components/common/BrandLogo";

/**
 * One destination in the student navigation.
 *
 * `covers` names the other paths this entry speaks for. /progress renders the
 * same page as /dashboard under a second address, and without this it was the
 * one screen in the app where the sidebar highlighted nothing at all — a
 * student on it could not tell from the chrome where they were.
 */
interface NavItem {
  name: string;
  icon: typeof LayoutDashboard;
  path: string;
  covers?: string[];
}

/**
 * The gutter every student page sits in.
 *
 * Exported because one page has to undo it: the roadmap's title bar runs to
 * both edges, and the only way for a child to escape an ancestor's padding is
 * a negative margin of the same size. Naming it here means the pair can be
 * held together by a test rather than by whoever remembers, which is what it
 * was resting on before.
 */
export const PAGE_GUTTER = "p-8";

export const STUDENT_NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard", covers: ["/progress"] },
  { name: "Challenges", icon: Target, path: "/challenges" },
  { name: "Workspace", icon: Wrench, path: "/workspace" },
  { name: "Roadmap", icon: Map, path: "/roadmap" },
  { name: "Achievements", icon: Trophy, path: "/achievements" },
];

/**
 * Whether `pathname` is `base` itself or something nested under it.
 *
 * Compared segment by segment rather than as a plain prefix: startsWith made
 * /roadmap light up for any address merely beginning with those letters, which
 * is a bug waiting for the first route named like another one.
 */
function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

function isCurrent(pathname: string, item: Pick<NavItem, "path" | "covers">): boolean {
  return [item.path, ...(item.covers ?? [])].some((base) => isUnder(pathname, base));
}

/** Shared by the desktop rail and the mobile drawer, so the two cannot drift. */
function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {STUDENT_NAV_ITEMS.map((item) => {
        const current = isCurrent(pathname, item);

        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            // Colour alone does not say "you are here" to a screen reader, and
            // it is the only signal this had.
            aria-current={current ? "page" : undefined}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              current
                ? "bg-accent text-accent-foreground font-medium shadow-[inset_3px_0_0_var(--color-brand-teal)]"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {item.name}
          </Link>
        );
      })}
    </>
  );
}

/** The brand, which heads both the rail and the drawer. */
function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      to="/"
      onClick={onNavigate}
      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
    >
      <BrandLogo className="h-8" />
    </Link>
  );
}

/**
 * Shell for the student-facing content pages. Immersive routes (the workspace
 * and the challenge runners) are deliberately left outside this layout so their
 * canvases keep the full viewport width.
 *
 * The navigation exists twice below, from one set of definitions: a rail that
 * is always open from `md` up, and a drawer for narrower screens. It used to be
 * only the rail, at a fixed 256px with no breakpoint on it, which on a phone
 * took two thirds of the width and left the page itself about seventy pixels to
 * render into. The drawer is built from plain state rather than a dialog
 * library on purpose — this layout is one of the few things the router loads
 * eagerly, so anything imported here lands in every student's first download.
 */
export function StudentLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Arriving somewhere new is the end of choosing where to go.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const handleLogout = async () => {
    // Awaited so the token is revoked and cleared before the login page mounts.
    await logout();
    toast.success("Logged out successfully");
    navigate("/login", { replace: true });
  };

  const profileLink = (onNavigate?: () => void) => (
    <Link
      to="/profile"
      onClick={onNavigate}
      aria-current={isUnder(location.pathname, "/profile") ? "page" : undefined}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        isUnder(location.pathname, "/profile")
          ? "bg-accent text-accent-foreground font-medium shadow-[inset_3px_0_0_var(--color-brand-teal)]"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      <User className="w-5 h-5 shrink-0" />
      Profile
    </Link>
  );

  const logoutButton = (
    <button
      onClick={handleLogout}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-red-600 transition-colors",
        "hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1",
      )}
    >
      <LogOut className="w-5 h-5 shrink-0" />
      Logout
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50">
      {/* The rail: the same sidebar as before, from the medium breakpoint up. */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0">
        <div className="h-16 px-5 flex items-center border-b border-slate-200">
          <Brand />
        </div>

        <nav aria-label="Main" className="flex-1 p-4 space-y-1">
          <NavLinks pathname={location.pathname} />
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-1">
          {profileLink()}
          {logoutButton}
        </div>
      </aside>

      {/* The drawer, for everything narrower. Mounted only while it is open. */}
      {menuOpen && (
        <div className="md:hidden">
          {/*
            Above anything a page can stack. A page header that pins itself
            while scrolling sits at z-40 — the roadmap's does — and at the same
            level as the backdrop it stayed lit while the rest of the screen
            dimmed behind the drawer, which reads as a bar floating loose over a
            dimmed page rather than as part of it.
          */}
          <div
            className="fixed inset-0 z-50 bg-slate-900/50"
            // The backdrop repeats what the close button and Escape already do,
            // so it is not the only way out and needs no name of its own.
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed inset-y-0 left-0 z-[60] w-72 max-w-[85vw] bg-white border-r border-slate-200 flex flex-col shadow-xl"
          >
            <div className="p-6 border-b border-slate-200 flex items-center justify-between gap-2">
              <Brand onNavigate={() => setMenuOpen(false)} />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation"
                className="p-2 -mr-2 rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav aria-label="Main" className="flex-1 p-4 space-y-1 overflow-y-auto">
              <NavLinks
                pathname={location.pathname}
                onNavigate={() => setMenuOpen(false)}
              />
            </nav>

            <div className="p-4 border-t border-slate-200 space-y-1">
              {profileLink(() => setMenuOpen(false))}
              {logoutButton}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 shrink-0 flex items-center bg-white/90 backdrop-blur border-b border-slate-200 px-4 sm:px-6 lg:px-8">
          {/* Search and notifications used to sit here. Neither exists: there
              is no search endpoint and no notifications feature, and a box that
              never finds anything beside a bell that is permanently unread are
              worse than the space they took. */}
          <div className="w-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open navigation"
                aria-expanded={menuOpen}
                className="md:hidden p-2 -ml-2 rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Menu className="w-6 h-6" />
              </button>
              {/* The brand is in the rail on desktop; on a phone the rail is
                  away, so it belongs here instead. */}
              <BrandLogo className="md:hidden h-6" />
            </div>

            <Link
              to="/profile"
              className="flex items-center gap-3 rounded-lg px-1.5 py-1 hover:bg-slate-100 transition-colors min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {/* The name is the first thing to go when the row is tight. */}
              <div className="text-right hidden sm:block min-w-0">
                <div className="font-semibold text-foreground text-sm truncate">
                  {user?.name ?? "Student"}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {user?.role ?? "student"}
                </div>
              </div>
              {/* The student's picture, or the plain person icon without one. */}
              <ProfileAvatar
                avatarUrl={user?.avatarUrl}
                alt="Your profile photo"
                className="w-9 h-9"
                fallbackClassName="bg-brand-teal-dark"
                fallback={<User className="w-5 h-5 text-white" />}
              />
            </Link>
          </div>
        </header>

        {/*
          The scroller carries no padding of its own, and the gutter sits on the
          band inside it instead. That split is not cosmetic. `position: sticky`
          measures `top` from the scrolling element's *padding* box, so while
          the padding lived out here every sticky page header was pinned 32px
          down from the top of the viewport — a white bar with a shadow under
          it, hanging over a strip of page background, detached from the header
          it should have sat flush against. The roadmap's own title bar is
          exactly that, and it is why it read as something floating on top of
          the page rather than part of it.

          PAGE_GUTTER is what a page bleeds back out of to reach the edge; see
          the note on RoadmapPage's wrapper, which is the only page that does.
        */}
        <main className="flex-1 overflow-auto">
          <div className={PAGE_GUTTER}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
