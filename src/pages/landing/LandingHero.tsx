import { Link } from "react-router";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicSummary } from "@/features/content/publicSummary";

/**
 * What every student gets, whatever the catalogue holds: plain facts a visitor
 * would want before signing up, beside the counts, rather than adjectives.
 * Each is true of the app as it is: there is no payment anywhere in it, it is
 * a web app with nothing to download, and every activity is worked by dragging.
 */
const highlights = ["Free to sign up", "Runs in your browser", "Drag-and-drop activities"];

/**
 * The landing page's opening: the BASC IT Laboratory Building behind the
 * pitch, and a strip along its foot with the catalogue's size.
 *
 * The counts are the API's. While they load their cells are held open so the
 * strip does not reflow when they land; if they never do, the strip closes up
 * around the highlights and says nothing about numbers.
 */
export function LandingHero({
  summary,
  loading,
}: {
  summary: PublicSummary | null;
  loading: boolean;
}) {
  const showStats = summary !== null || loading;

  return (
    <section
      id="home"
      className="relative isolate flex min-h-[38.5rem] flex-col overflow-hidden bg-slate-950 pt-14 lg:min-h-[43.5rem]"
    >
      <img
        src="/landing/basc-it-building.jpg"
        alt="The BASC Information Technology Laboratory Building"
        width={1220}
        height={911}
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[72%_center] lg:object-[65%_40%]"
      />
      {/* Darkest behind the text, so it reads over the bright sky, and
          lightest where the building is. Down the page on a phone, where the
          text spans the width; across it on a wide screen. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950/70 via-brand-teal-dark/80 to-slate-950/95 lg:bg-gradient-to-r lg:from-slate-950/90 lg:via-brand-teal-dark/70 lg:to-brand-teal-dark/35"
      />
      {/* Behind the see-through navigation: on a wide screen the right of
          the photo is left light for the building, and Sign In sits over
          bright sky there without this. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-32 bg-gradient-to-b from-slate-950/60 to-transparent"
      />

      <div className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-7xl px-6 py-10 sm:py-14 lg:py-14">
          <div className="max-w-2xl space-y-5 md:space-y-6">
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-white/85 sm:tracking-[0.18em] sm:text-sm">
              <span aria-hidden="true" className="h-0.5 w-8 shrink-0 bg-brand-orange" />
              {/* The full line takes two on a phone; there the headline below
                  already says "Networking", so the eyebrow keeps who it is for. */}
              <span className="sm:hidden">For BASC IT Students</span>
              <span className="hidden sm:inline">Networking Simulation for BASC IT Students</span>
            </p>
            {/* Three lines where there is room for them; on narrower screens
                the heading wraps wherever it falls. */}
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl">
              Learn Networking <br className="hidden lg:inline" />
              by Building <br className="hidden lg:inline" />
              and Doing
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-white/90 sm:text-lg md:text-xl">
              NetSim helps BASC IT students build foundational networking skills
              through interactive lessons, computer hardware activities, cable
              wiring, and hands-on network simulations.
            </p>
            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:gap-4">
              <Button
                asChild
                size="lg"
                className="h-12 w-full px-8 text-base bg-white text-brand-teal-dark shadow-none hover:bg-brand-teal-light focus-visible:ring-white/80 sm:w-auto"
              >
                <Link to="/signup">Get Started</Link>
              </Button>
              {/* Returning students have Sign In in the nav; this one is for
                  visitors still deciding. */}
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 w-full px-8 text-base border-2 border-white bg-transparent text-white shadow-none hover:bg-white/10 hover:text-white focus-visible:border-white focus-visible:ring-white/80 sm:w-auto"
              >
                <a href="#features">See How It Works</a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/15 bg-slate-950/60">
        <div className="mx-auto grid max-w-7xl px-6 lg:grid-cols-5">
          {showStats && (
            <dl
              aria-busy={loading}
              className="grid min-h-[5.25rem] grid-cols-2 lg:min-h-[6.25rem] sm:border-b sm:border-white/15 lg:col-span-2 lg:border-b-0"
            >
              {summary && (
                <>
                  <Stat
                    value={summary.topics}
                    label={summary.topics === 1 ? "Topic" : "Topics"}
                  />
                  <Stat
                    value={summary.challenges}
                    label={
                      summary.challenges === 1
                        ? "Interactive challenge"
                        : "Interactive challenges"
                    }
                    className="border-l border-white/15 pl-4 lg:pl-6"
                  />
                </>
              )}
            </dl>
          )}
          {/* On a phone the counts alone fill the strip: the highlights
              would double its height and are said again further down. */}
          <ul
            className={`grid-cols-2 gap-x-4 gap-y-2 py-4 sm:grid-cols-3 lg:gap-0 lg:py-0 ${
              showStats ? "hidden sm:grid lg:col-span-3" : "grid lg:col-span-5"
            }`}
          >
            {highlights.map((item, index) => (
              <li
                key={item}
                className={`flex items-center gap-2 text-sm font-semibold text-white lg:px-6 lg:py-5 ${
                  showStats || index > 0 ? "lg:border-l lg:border-white/15" : "lg:pl-0"
                }`}
              >
                <CheckCircle
                  className="h-4 w-4 shrink-0 text-brand-teal-light"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Stat({
  value,
  label,
  className = "",
}: {
  value: number;
  label: string;
  className?: string;
}) {
  // The figure is drawn above its name, but read after it: "Topics, 9".
  return (
    <div className={`flex flex-col-reverse gap-1 py-4 pr-4 lg:py-5 lg:pr-6 ${className}`}>
      <dt className="text-xs text-white/80 sm:text-sm">{label}</dt>
      <dd className="text-2xl font-bold text-white sm:text-3xl">{value}</dd>
    </div>
  );
}
