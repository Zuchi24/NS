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

/** How many of the student's most recently touched challenges the card lists. */
const RECENT_LIMIT = 5;

/**
 * How the two standings are coloured. The wording is the server's — this only
 * decides what it looks like — and there are deliberately only two: a student
 * is working on a challenge, or they have finished it. Whether a particular
 * submission passed belongs to that attempt, not to this list.
 */
const STATUS_STYLE: Record<ActivityStatus, string> = {
  complete: "text-green-600",
  in_progress: "text-orange-600",
};

export function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(fetchStudentProgress);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.name ?? "Student"}!
        </h1>
        <p className="text-gray-600">
          Here's your learning progress and upcoming tasks
        </p>
      </div>

      {loading && <LoadingState label="Loading your progress…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <>
          {/* TOP SECTION: Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Challenges passed */}
            <Card className="border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">Challenges Passed</p>
                    <p className="text-3xl font-bold text-green-600">
                      {data.challengesPassed}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Still open */}
            <Card className="border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">In Progress</p>
                    <p className="text-3xl font-bold text-orange-600">
                      {data.challengesInProgress}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Overall Progress — against the whole catalogue, not a total
                assembled from the numbers beside it. */}
            <Card className="border-gray-200">
              <CardContent className="p-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Overall Progress</p>
                    <p className="text-2xl font-bold text-purple-600 tabular-nums">
                      {data.challengesPassed}/{data.challengesTotal}
                    </p>
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

          {/* MIDDLE SECTION: Main Features - 3 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Workspace */}
            <Link to="/workspace">
              <Card className="border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                      <Wrench className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Workspace</h3>
                      <p className="text-sm text-gray-500">Practice hands-on</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Challenges */}
            <Link to="/challenges">
              <Card className="border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                      <Target className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Challenges
                      </h3>
                      <p className="text-sm text-gray-500">Test your skills</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Roadmap */}
            <Link to="/roadmap">
              <Card className="border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <Map className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Roadmap</h3>
                      <p className="text-sm text-gray-500">
                        Track your journey
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* BOTTOM SECTION: Recent Activities & Learning Progress */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activities */}
            <Card className="border-gray-200">
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
                  <div className="space-y-4">
                    {data.activity.slice(0, RECENT_LIMIT).map((activity) => (
                      <div
                        key={activity.challengeId}
                        className="flex items-start justify-between pb-4 border-b border-gray-100 last:border-0 last:pb-0"
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

            {/* Learning Progress */}
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg">Learning Progress</CardTitle>
              </CardHeader>

              <CardContent>
                <div className="space-y-6">
                  {/* Challenges Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">
                        Challenges Passed
                      </span>
                      <span className="text-gray-900 font-semibold">
                        {data.challengesPassed}/{data.challengesTotal}
                      </span>
                    </div>
                    <Progress
                      value={percentOf(
                        data.challengesPassed,
                        data.challengesTotal,
                      )}
                      className="h-2"
                    />
                  </div>

                  {/* Roadmap Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">
                        Roadmap Progress
                      </span>
                      <span className="text-gray-900 font-semibold">
                        {data.topicsCompleted}/{data.topicsTotal}
                      </span>
                    </div>
                    <Progress
                      value={percentOf(data.topicsCompleted, data.topicsTotal)}
                      className="h-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
