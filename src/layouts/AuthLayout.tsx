import { Link, Outlet, useLocation } from "react-router";
import { Network, Cable, Monitor, Wifi, ArrowRight } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { BrandLogo } from "@/components/common/BrandLogo";

/**
 * Shared shell for /login and /signup: a split card with the brand panel on
 * one side and the page's own form on the other.
 *
 * The panel trades sides between the two pages and each side slides in when
 * the route changes, so moving between signing in and registering reads as
 * one card turning over rather than a page load. The motion is behind
 * `motion-safe`, so anyone who has asked for reduced motion gets a plain swap.
 * Below `md` the panel folds away and the form keeps the whole card.
 */
export function AuthLayout() {
  const { pathname } = useLocation();
  const onSignUp = pathname.startsWith("/signup");

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(37,99,235,0.14),transparent_45%),radial-gradient(circle_at_85%_80%,rgba(79,70,229,0.12),transparent_45%)]"
        aria-hidden="true"
      />

      <div
        className={cn(
          "w-full max-w-4xl relative z-10 bg-white rounded-3xl shadow-2xl shadow-blue-900/10 border border-slate-200/70 overflow-hidden",
          "flex flex-col md:flex-row",
          onSignUp && "md:flex-row-reverse",
        )}
      >
        {/* Brand panel */}
        <aside
          key={`panel-${onSignUp ? "signup" : "login"}`}
          className={cn(
            "hidden md:flex md:w-[42%] shrink-0 relative flex-col justify-between p-10 text-white overflow-hidden",
            "bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700",
            "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500",
            onSignUp
              ? "motion-safe:slide-in-from-right-8"
              : "motion-safe:slide-in-from-left-8",
          )}
        >
          <div className="absolute inset-0 opacity-10" aria-hidden="true">
            <Network className="absolute -top-6 -left-6 w-40 h-40" />
            <Cable className="absolute top-1/2 -right-8 w-32 h-32" />
            <Monitor className="absolute bottom-10 left-8 w-24 h-24" />
            <Wifi className="absolute -bottom-10 right-16 w-36 h-36" />
          </div>

          <div className="relative">
            <BrandLogo variant="dark" className="h-14" />
          </div>

          <div className="relative space-y-4">
            <h1 className="text-3xl font-bold leading-tight">
              {onSignUp ? "Welcome back!" : "Hello, learner!"}
            </h1>
            <p className="text-blue-100 text-sm leading-relaxed">
              {onSignUp
                ? "Already have an account? Sign in to pick up your roadmap, assessments and challenges where you left off."
                : "New to NetSim? Create an account to start the networking roadmap, hands-on simulations and challenges."}
            </p>
            <Link
              to={onSignUp ? "/login" : "/signup"}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border border-white/70 px-6 py-2.5 text-sm font-semibold",
                "transition-colors hover:bg-white hover:text-blue-700",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-700",
              )}
            >
              {onSignUp ? "Sign In" : "Sign Up"}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <p className="relative text-xs text-blue-200">
            Learn networking by building it.
          </p>
        </aside>

        {/* The page's own form */}
        <main
          key={`form-${pathname}`}
          className={cn(
            "flex-1 min-w-0 p-6 sm:p-10",
            "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500",
            onSignUp
              ? "motion-safe:slide-in-from-left-8"
              : "motion-safe:slide-in-from-right-8",
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
