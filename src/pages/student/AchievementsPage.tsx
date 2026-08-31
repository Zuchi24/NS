import {
  Cable,
  CheckCircle2,
  Flag,
  Lock,
  Map,
  Sparkles,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import { fetchAchievements } from "@/features/achievements/achievementService";
import type { Achievement } from "@/features/achievements/types";
import { useAsync } from "@/services/useAsync";

/**
 * Every achievement in one place: what the student has unlocked, what is still
 * locked, and exactly what each locked one asks for.
 *
 * There are no points anywhere in the platform — passing challenges is what
 * earns these, so the page leads with the requirement rather than a total.
 */

/** The icon names the seeder uses, mapped to the ones we actually render. */
const ICONS: Record<string, LucideIcon> = {
  flag: Flag,
  zap: Zap,
  cable: Cable,
  star: Star,
  sparkles: Sparkles,
  map: Map,
  trophy: Trophy,
};

function iconFor(achievement: Achievement): LucideIcon {
  return ICONS[achievement.icon ?? ""] ?? Trophy;
}

function formatEarnedAt(earnedAt: string): string {
  const date = new Date(earnedAt);

  return Number.isNaN(date.getTime())
    ? "Unlocked"
    : `Unlocked ${date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })}`;
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const Icon = iconFor(achievement);
  const isEarned = achievement.earnedAt !== null;
  const { current, target } = achievement.progress;
  // Bar width only; the reader gets "3 / 10" underneath it.
  const percent = target === 0 ? 0 : Math.round((current / target) * 100);

  return (
    <Card
      className={
        isEarned
          ? "border border-amber-200 bg-amber-50/40 shadow-sm"
          : "border border-gray-200 shadow-sm"
      }
    >
      <CardContent className="p-5">
        <div className="flex gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isEarned ? "bg-amber-400" : "bg-gray-100"
            }`}
          >
            <Icon
              className={`w-6 h-6 ${isEarned ? "text-white" : "text-gray-400"}`}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <h3
                className={`font-semibold ${
                  isEarned ? "text-gray-900" : "text-gray-700"
                }`}
              >
                {achievement.title}
              </h3>

              {isEarned ? (
                <span className="flex items-center gap-1 flex-shrink-0 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Unlocked
                </span>
              ) : (
                <span className="flex items-center gap-1 flex-shrink-0 bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <Lock className="w-3.5 h-3.5" />
                  Locked
                </span>
              )}
            </div>

            {/* How to unlock it, always — an earned badge should still say what
                it was for. */}
            <p className="text-sm text-gray-600 mt-1">
              {achievement.description ?? achievement.requirement}
            </p>

            <div className="mt-4">
              {isEarned ? (
                <p className="text-xs font-medium text-amber-700">
                  {formatEarnedAt(achievement.earnedAt!)}
                </p>
              ) : target === 0 ? (
                <p className="text-xs text-gray-500">
                  Not available yet — no challenges have been published for it.
                </p>
              ) : (
                <div className="space-y-1.5">
                  <Progress value={percent} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{achievement.requirement}</span>
                    <span className="font-medium text-gray-700 tabular-nums">
                      {current} / {target}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AchievementsPage() {
  const { data, error, loading, reload } = useAsync(fetchAchievements);

  if (loading) return <LoadingState label="Loading achievements…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const earned = data.filter((a) => a.earnedAt !== null);
  const locked = data.filter((a) => a.earnedAt === null);
  // Only ever the width of a bar — the counts are what the page shows.
  const percent =
    data.length === 0 ? 0 : Math.round((earned.length / data.length) * 100);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="w-8 h-8 text-amber-500" />
          <h1 className="text-3xl font-bold text-gray-900">Achievements</h1>
        </div>
        <p className="text-gray-600">
          Milestones you unlock by passing challenges. Every one below says what
          it takes — no points, just the work.
        </p>
      </div>

      {data.length === 0 ? (
        <EmptyState
          title="No achievements yet"
          description="None have been published. Check back once your instructor adds some."
        />
      ) : (
        <>
          <Card className="border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-amber-400 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-9 h-9 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900 mb-1">
                    {earned.length === 0
                      ? "Nothing unlocked yet"
                      : `${earned.length} of ${data.length} unlocked`}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {earned.length === 0
                      ? "Pass your first challenge to unlock one."
                      : "Keep passing challenges to unlock the rest."}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-amber-600 tabular-nums">
                    {earned.length}/{data.length}
                  </div>
                  <div className="text-xs text-gray-600 mb-2">Unlocked</div>
                  <Progress value={percent} className="h-2 w-28" />
                </div>
              </div>
            </CardContent>
          </Card>

          {earned.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Unlocked ({earned.length})
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {earned.map((achievement) => (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                  />
                ))}
              </div>
            </section>
          )}

          {locked.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">
                How to unlock the rest ({locked.length})
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {locked.map((achievement) => (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
