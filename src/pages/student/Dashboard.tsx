import { Link } from "react-router";
import {
  Target,
  CheckCircle2,
  Clock,
  Wrench,
  Map,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import { useAuth } from "@/features/auth/useAuth";
import {
  fetchStudentProgress,
  percentOf,
} from "@/features/content/studentProgress";
import type { ActivityStatus } from "@/features/content/types";
import { timeAgo } from "@/services/time";
import { useAsync } from "@/services/useAsync";


/**
 * How the two standings are coloured. The wording is the server's — this only
 * decides what it looks like — and there are deliberately only two: a student
 * is working on a challenge, or they have finished it. Whether a particular
 * submission passed belongs to that attempt, not to this list.
 */
const STATUS_STYLE: Record<ActivityStatus, string> = {
  complete: "text-green-600",
  in_progress: "text-info",
};

/** The three places a student goes from here, in the order they were shown. */
const QUICK_LINKS = [
  { to: "/workspace", title: "Workspace", blurb: "Practice hands-on", icon: Wrench, iconClass: "bg-primary" },
  { to: "/challenges", title: "Challenges", blurb: "Test your skills", icon: Target, iconClass: "bg-brand-orange" },
  { to: "/roadmap", title: "Roadmap", blurb: "Track your journey", icon: Map, iconClass: "bg-brand-teal-dark" },
];

export function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(fetchStudentProgress);

  /*
   * Laid out to fit a laptop screen rather than to stack.
   *
   * At 1366 × 768 the layout's header and gutter leave about 520px, and the
   * page used to need nearly 800: five full-width bands with 24px between
   * them. Now the summary is one compact row, ending in the learning progress,
   * and below it the activity list shares a row with the shortcuts instead of
   * sitting above them. Below `lg` they stack, shortcuts before the activity list.
   */
  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Welcome back, {user?.name ?? "Student"}!
        </h1>
        <p className="mt-1 text-sm md:text-base text-gray-600">
          Here's your learning progress and upcoming tasks
        </p>
      </div>

      {loading && <LoadingState label="Loading your progress…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <>
          {/* TOP SECTION: Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Challenges passed */}
            <Card className="border-gray-200">
              <CardContent className="p-4 lg:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600">Challenges Passed</p>
                    <p className="text-3xl font-bold text-green-600">
                      {data.challengesPassed}
                    </p>
                  </div>
                  <div className="w-11 h-11 shrink-0 bg-green-100 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Still open */}
            <Card className="border-gray-200">
              <CardContent className="p-4 lg:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600">In Progress</p>
                    <p className="text-3xl font-bold text-info">
                      {data.challengesInProgress}
                    </p>
                  </div>
                  <div className="w-11 h-11 shrink-0 bg-info/10 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-info" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Learning Progress — challenges passed against the whole
                catalogue, not a total assembled from the numbers beside it. */}
            <Card className="border-gray-200">
              <CardContent className="p-4 lg:p-5 h-full flex flex-col justify-center">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-900">Learning Progress</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Challenges Passed</span>
                    <span className="text-lg font-bold text-primary tabular-nums">
                      {data.challengesPassed}/{data.challengesTotal}
                    </span>
                  </div>
                  <Progress
                    value={percentOf(
                      data.challengesPassed,
                      data.challengesTotal,
                    )}
                    className="h-3"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* MAIN SECTION: the activity list beside the shortcuts on a wide
              screen; stacked below that. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            {/* The side column: where to go next. First in the
                markup so a phone, which stacks, reaches the shortcuts before a
                long activity list; placed in the third column on a wide one. */}
            <div className="space-y-4 lg:col-start-3 lg:row-start-1">
              {/* Quick links — a row of three on a tablet, a column beside the
                  activity list on a wide screen. */}
              <nav
                aria-label="Quick links"
                className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-1 gap-3"
              >
                {QUICK_LINKS.map(({ to, title, blurb, icon: Icon, iconClass }) => (
                  <Link
                    key={to}
                    to={to}
                    className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Card className="border-2 border-gray-200 group-hover:border-brand-teal/50 group-hover:shadow-lg transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${iconClass}`}
                          >
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <h2 className="font-semibold text-gray-900">{title}</h2>
                            <p className="text-sm text-gray-500">{blurb}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </nav>
            </div>

            {/* Recent Activities */}
            <Card className="border-gray-200 gap-4 lg:col-span-2 lg:col-start-1 lg:row-start-1">
              <CardHeader>
                <CardTitle className="text-lg">Recent Activities</CardTitle>
              </CardHeader>
              <CardContent>
                {data.activity.length === 0 ? (
                  <EmptyState
                    title="Nothing yet"
                    description="Open a challenge and it will show up here."
                  />
                ) : (
                  // Every challenge the student has touched, in a box about
                  // five rows tall that scrolls, so a long history cannot make
                  // the page itself long. Focusable so it scrolls from the
                  // keyboard too.
                  <div
                    role="region"
                    aria-label="Recent activities list"
                    tabIndex={0}
                    className="max-h-72 overflow-y-auto pr-2 space-y-3 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {data.activity.map((activity) => (
                      <div
                        key={activity.challengeId}
                        className="flex items-start justify-between pb-3 border-b border-gray-100 last:border-0 last:pb-0"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="font-semibold text-gray-900 truncate">
                            {activity.title ?? "Challenge"}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Clock className="w-4 h-4 shrink-0" />
                            {timeAgo(activity.at)}
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-3">
                          <div
                            className={`text-sm font-medium ${STATUS_STYLE[activity.status]}`}
                          >
                            {activity.statusLabel}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
