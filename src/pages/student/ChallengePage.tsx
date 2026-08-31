import { useState } from "react";
import { useNavigate } from "react-router";
import {
  CheckCircle,
  Clock,
  Lock,
  Play,
  RotateCcw,
  Target,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import {
  challengeRoute,
  fetchChallenges,
  fetchMyAttempts,
  startAttempt,
} from "@/features/content/contentService";
import type { Attempt, Challenge } from "@/features/content/types";
import {
  DIFFICULTY_META,
  DIFFICULTY_ORDER,
} from "@/features/content/difficulty";
import type { Difficulty } from "@/features/content/types";
import { useAsync } from "@/services/useAsync";

/**
 * "attempted" is a challenge the student has submitted without passing it —
 * worth telling apart from one they have never opened.
 */
type Status = "locked" | "available" | "in-progress" | "attempted" | "passed";

const FILTERS = ["All", "Available", "In Progress", "Passed"] as const;
type Filter = (typeof FILTERS)[number];

interface ChallengeRow {
  challenge: Challenge;
  status: Status;
  /** The challenge's own band, straight from the API. */
  difficulty: Difficulty;
  openAttemptId: number | null;
  /** Requirements the last submission missed. Null when there is none. */
  unmet: number | null;
}

/** A signal meter: how many of three bars this band fills. */
function DifficultyBars({
  difficulty,
  className = "",
}: {
  difficulty: Difficulty;
  className?: string;
}) {
  const meta = DIFFICULTY_META[difficulty];

  return (
    <span className={`inline-flex items-end gap-[2px] ${className}`} aria-hidden="true">
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className={`w-[3px] rounded-sm ${
            bar < meta.bars ? meta.fill : "bg-current opacity-25"
          }`}
          style={{ height: 5 + bar * 3 }}
        />
      ))}
    </span>
  );
}

/** The band, as it appears on a challenge card. */
function DifficultyChip({ difficulty }: { difficulty: Difficulty }) {
  const meta = DIFFICULTY_META[difficulty];

  return (
    <span
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 bg-white text-xs font-semibold ${meta.text}`}
    >
      <DifficultyBars difficulty={difficulty} />
      {meta.label}
    </span>
  );
}

function loadChallengeView() {
  return Promise.all([fetchChallenges(), fetchMyAttempts()]);
}

/** Folds a student's attempts at one challenge into a single display state. */
function toRow(challenge: Challenge, attempts: Attempt[]): ChallengeRow {
  const mine = attempts.filter((a) => a.challengeId === challenge.id);
  const submitted = mine.filter((a) => a.status === "completed");
  const open = mine.find((a) => a.status === "in_progress");

  // Work already done outranks the lock: a challenge whose topic closed behind
  // a content change should still show what the student achieved in it.
  const status: Status = submitted.some((a) => a.passed)
    ? "passed"
    : open
      ? "in-progress"
      : submitted.length > 0
        ? "attempted"
        : challenge.locked
          ? "locked"
          : "available";

  // The most recent submission is the one whose feedback still stands.
  const latest = submitted.reduce<Attempt | null>(
    (newest, attempt) => (newest === null || attempt.id > newest.id ? attempt : newest),
    null,
  );

  const unmet =
    status === "attempted" && latest?.results
      ? latest.results.filter((result) => !result.passed).length
      : null;

  return {
    challenge,
    // The server's, authored on the challenge itself.
    difficulty: challenge.difficulty,
    status,
    openAttemptId: open?.id ?? null,
    unmet,
  };
}

export function ChallengePage() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<Filter>("All");
  const [activeLevel, setActiveLevel] = useState<Difficulty | "all">("all");
  const [starting, setStarting] = useState<number | null>(null);

  const { data, error, loading, reload } = useAsync(loadChallengeView);

  if (loading) return <LoadingState label="Loading challenges…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const [challenges, attempts] = data;
  const rows = challenges.map((challenge) => toRow(challenge, attempts));

  const passedCount = rows.filter((r) => r.status === "passed").length;
  const inProgressCount = rows.filter((r) => r.status === "in-progress").length;
  const attemptedCount = rows.filter((r) => r.status === "attempted").length;

  const stats = [
    {
      label: "Challenges",
      value: rows.length,
      icon: Target,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Passed",
      value: passedCount,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      label: "In Progress",
      value: inProgressCount,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      label: "Keep Trying",
      value: attemptedCount,
      icon: RotateCcw,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  const matchesStatus = (row: ChallengeRow) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Available")
      return (
        row.status === "available" ||
        row.status === "attempted" ||
        row.status === "locked"
      );
    if (activeFilter === "In Progress") return row.status === "in-progress";
    return row.status === "passed";
  };

  const visible = rows.filter(
    (row) =>
      matchesStatus(row) && (activeLevel === "all" || row.difficulty === activeLevel),
  );

  /**
   * The list, grouped under its difficulty headings. Showing one band on its
   * own still keeps its heading, so the page reads the same either way.
   */
  const groups = DIFFICULTY_ORDER.map((level) => ({
    level,
    rows: visible.filter((row) => row.difficulty === level),
  })).filter((group) => group.rows.length > 0);

  /** Tab counts stay on the whole catalogue, so they don't shift underfoot. */
  const levelTotals = DIFFICULTY_ORDER.map((level) => ({
    level,
    total: rows.filter((row) => row.difficulty === level).length,
  }));

  const open = async (row: ChallengeRow) => {
    setStarting(row.challenge.id);

    try {
      // The server hands back the attempt already in progress rather than
      // opening a second one, so this is safe to press twice.
      const attempt = await startAttempt(row.challenge.id);
      navigate(challengeRoute(row.challenge, attempt.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the challenge");
      setStarting(null);
    }
  };

  // Bar width only; the card shows how many of the challenges are passed.
  const completionPercentage =
    rows.length === 0 ? 0 : Math.round((passedCount / rows.length) * 100);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Target className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">
            Challenge-Based Learning
          </h1>
        </div>
        <p className="text-gray-600">
          Test your skills with real-world scenarios and challenges
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border border-gray-200 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">
                      {stat.value}
                    </p>
                  </div>
                  <div
                    className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}
                  >
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Difficulty is the primary way through the catalogue, so it leads and
          takes the heavier control; the status tabs below narrow within it. */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveLevel("all")}
            aria-pressed={activeLevel === "all"}
            className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
              activeLevel === "all"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
            }`}
          >
            All Challenges
            <span className="ml-2 tabular-nums opacity-70">{rows.length}</span>
          </button>

          {levelTotals.map(({ level, total }) => {
            const meta = DIFFICULTY_META[level];
            const isActive = activeLevel === level;

            return (
              <button
                key={level}
                onClick={() => setActiveLevel(level)}
                aria-pressed={isActive}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
                  isActive
                    ? meta.active
                    : `bg-white border-gray-200 hover:border-gray-300 ${meta.text}`
                }`}
              >
                <DifficultyBars difficulty={level} />
                {meta.label}
                <span className="tabular-nums opacity-70">{total}</span>
              </button>
            );
          })}
        </div>

        {activeLevel !== "all" && (
          <p className="text-sm text-gray-600">
            {DIFFICULTY_META[activeLevel].blurb}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200 pb-1">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              activeFilter === filter
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description={
            rows.length === 0
              ? "No challenges have been published yet."
              : "No challenges match this filter."
          }
        />
      ) : (
        <div className="space-y-10">
          {groups.map((group) => {
            const meta = DIFFICULTY_META[group.level];
            const passedInGroup = group.rows.filter(
              (row) => row.status === "passed",
            ).length;

            return (
              <section key={group.level} className="space-y-4">
                <div className="flex items-baseline justify-between gap-4 border-b border-gray-200 pb-2">
                  <div className="flex items-center gap-2.5">
                    <DifficultyBars
                      difficulty={group.level}
                      className={meta.text}
                    />
                    <h2 className="text-lg font-bold text-gray-900">
                      {meta.label}
                    </h2>
                    <span className="text-sm text-gray-500 tabular-nums">
                      {group.rows.length}{" "}
                      {group.rows.length === 1 ? "challenge" : "challenges"}
                      {passedInGroup > 0 && ` · ${passedInGroup} passed`}
                    </span>
                  </div>
                  <p className="hidden md:block text-sm text-gray-500 text-right max-w-md">
                    {meta.blurb}
                  </p>
                </div>

                <div className="space-y-4">
          {group.rows.map((row) => {
            const isPassed = row.status === "passed";
            const isInProgress = row.status === "in-progress";
            const isAttempted = row.status === "attempted";
            const isLocked = row.status === "locked";
            const isStarting = starting === row.challenge.id;

            return (
              <Card
                key={row.challenge.id}
                className="border border-gray-200 shadow-sm transition-all hover:shadow-md hover:border-blue-200"
              >
                <CardContent className="p-6">
                  <div className="flex gap-6">
                    <div className="w-16 h-16 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Target className="w-8 h-8 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">
                          {row.challenge.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Outlined, so it reads as a property of the
                              challenge rather than another status pill. */}
                          <DifficultyChip difficulty={row.difficulty} />
                          {isPassed && (
                            <div className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                              <CheckCircle className="w-3.5 h-3.5" />
                              Passed
                            </div>
                          )}
                          {isInProgress && (
                            <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-semibold">
                              In Progress
                            </span>
                          )}
                          {isAttempted && (
                            <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-semibold">
                              {row.unmet === null
                                ? "Not passed yet"
                                : `${row.unmet} requirement${row.unmet === 1 ? "" : "s"} to go`}
                            </span>
                          )}
                          {isLocked && (
                            <span className="flex items-center gap-1 bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-semibold">
                              <Lock className="w-3.5 h-3.5" />
                              Locked
                            </span>
                          )}
                        </div>
                      </div>

                      {row.challenge.description && (
                        <p className="text-sm text-gray-600 mb-4">
                          {row.challenge.description}
                        </p>
                      )}

                      <div className="flex">
                        <Button
                          onClick={() => open(row)}
                          disabled={isStarting || isLocked}
                          variant={isPassed || isLocked ? "outline" : "default"}
                          className={
                            isPassed
                              ? "h-10 px-6 border-blue-600 text-blue-600 hover:bg-blue-50"
                              : isLocked
                                ? "h-10 px-6"
                                : "h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white"
                          }
                        >
                          {isLocked ? (
                            <Lock className="w-4 h-4 mr-2" />
                          ) : (
                            <Play className="w-4 h-4 mr-2" />
                          )}
                          {isStarting
                            ? "Opening…"
                            : isLocked
                              ? "Locked"
                              : isPassed
                                ? "Try Again"
                                : isInProgress
                                  ? "Continue Challenge"
                                  : isAttempted
                                    ? "Retry Challenge"
                                    : "Start Challenge"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-white shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Trophy className="w-9 h-9 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                Keep up the great work!
              </h3>
              <p className="text-sm text-gray-600">
                Pass every challenge to unlock every achievement
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600 tabular-nums">
                {passedCount}/{rows.length}
              </div>
              <div className="text-xs text-gray-600 mb-2">Passed</div>
              <Progress value={completionPercentage} className="h-2 w-28" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
