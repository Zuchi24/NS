import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/AsyncStates";
import { ApiError } from "@/services/api";
import { useAsync } from "@/services/useAsync";
import {
  commitPromotion,
  fetchAcademicYears,
  fetchPromotionPreview,
} from "@/features/academic/academicService";
import type {
  AcademicYear,
  PromotionOutcome,
  PromotionPlacement,
  PromotionPreview,
  PromotionRow,
  PromotionSection,
} from "@/features/academic/types";
import { InlineConfirm } from "./academic/InlineConfirm";

/**
 * Moving students into an academic year: choose where they come from, review
 * where each one goes, check it, then commit it.
 *
 * Never "promote everyone". The server proposes a placement for each student —
 * the same section one year level up — and the instructor decides: accept it,
 * choose another section (a repeating or irregular student), or place them
 * nowhere this year (graduating, not continuing). A student the server could
 * not propose a section for must be decided by hand before anything is
 * checked. The commit is offered only once a dry run of exactly the current
 * choices has come back, and it places everyone on the list or no one.
 *
 * Everything shown comes from the server: the proposals, the dry run's answer
 * and the commit's. The page writes nothing but its choices, and it writes
 * those through the promotion API — never a student's section directly.
 */

const selectClass =
  "h-9 rounded-md border border-input bg-white px-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring";

/** "" is undecided, "none" is not placed this year, otherwise a section id. */
type Choice = string;

const UNDECIDED = "";
const NONE = "none";

const REASON_NOTES: Record<PromotionRow["reason"], string> = {
  promoted: "Proposed: the same section one year level up.",
  no_next_year_level: "No higher year level — not placed unless you choose a section.",
  no_matching_section: "No matching section next year — choose one, or not placed.",
  already_placed: "Already placed in this year; left as they are.",
};

function describe(section: PromotionSection): string {
  return `${section.yearLevel.name} · ${section.section.name}`;
}

/** The first thing to start from: a choice per student, from the proposal. */
function initialChoices(preview: PromotionPreview): Record<number, Choice> {
  return Object.fromEntries(
    preview.rows
      .filter((row) => row.reason !== "already_placed")
      .map((row) => [
        row.student.id,
        row.proposed
          ? String(row.proposed.section.id)
          : row.reason === "no_matching_section"
            ? UNDECIDED
            : NONE,
      ]),
  );
}

function placementsOf(choices: Record<number, Choice>): PromotionPlacement[] {
  return Object.entries(choices).map(([studentId, choice]) => ({
    studentId: Number(studentId),
    sectionId: choice === NONE || choice === UNDECIDED ? null : Number(choice),
  }));
}

/** The server's refusal, field by field where it gave one. */
function problemsOf(error: unknown): string[] {
  if (error instanceof ApiError && Object.keys(error.errors).length > 0) {
    return [...new Set(Object.values(error.errors).flat())];
  }

  return [error instanceof Error && error.message ? error.message : "Could not do that."];
}

export function PromotionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: years, error, loading, reload } = useAsync(fetchAcademicYears);

  if (loading && !years) return <LoadingState label="Loading academic years…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const target = (years ?? []).find((year) => String(year.id) === id);

  const back = (
    <Button variant="ghost" size="sm" onClick={() => navigate("/admin/academic/years")}>
      <ArrowLeft className="w-4 h-4 mr-2" />
      Academic years
    </Button>
  );

  if (!target) {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState title="No such academic year" description="Pick one from the academic years." />
      </div>
    );
  }

  if (target.status === "closed") {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState
          title={`${target.name} is closed`}
          description="A closed year is kept as it was, so nobody can be moved into it."
        />
      </div>
    );
  }

  const sources = (years ?? []).filter((year) => year.id !== target.id);

  return (
    <div className="space-y-6">
      {back}
      <Promotion target={target} sources={sources} />
    </div>
  );
}

function Promotion({ target, sources }: { target: AcademicYear; sources: AcademicYear[] }) {
  const defaultSource = sources.find((year) => year.isCurrent) ?? sources[0] ?? null;

  const [sourceId, setSourceId] = useState<string>(defaultSource ? String(defaultSource.id) : "");
  const [preview, setPreview] = useState<PromotionPreview | null>(null);
  const [choices, setChoices] = useState<Record<number, Choice>>({});
  const [checked, setChecked] = useState<{ key: string; outcome: PromotionOutcome } | null>(null);
  const [committed, setCommitted] = useState<PromotionOutcome | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const placements = useMemo(() => placementsOf(choices), [choices]);
  const key = JSON.stringify(placements);
  const undecided = Object.values(choices).filter((choice) => choice === UNDECIDED).length;
  const checkedNow = checked !== null && checked.key === key;

  const names = useMemo(
    () => new Map((preview?.rows ?? []).map((row) => [row.student.id, row.student.fullName])),
    [preview],
  );
  const sectionNames = useMemo(
    () => new Map((preview?.sections ?? []).map((section) => [section.section.id, describe(section)])),
    [preview],
  );

  /** Every write and read on this page goes through here, one at a time. */
  const guarded = async (work: () => Promise<void>) => {
    if (busy) return;

    setBusy(true);
    setProblems([]);

    try {
      await work();
    } catch (e) {
      setProblems(problemsOf(e));
    } finally {
      setBusy(false);
    }
  };

  const loadPreview = () =>
    guarded(async () => {
      const next = await fetchPromotionPreview(target.id, Number(sourceId));
      setPreview(next);
      setChoices(initialChoices(next));
      setChecked(null);
      setConfirming(false);
    });

  const dryRun = () =>
    guarded(async () => {
      const outcome = await commitPromotion(target.id, placements, true);
      setChecked({ key, outcome });
    });

  const commit = () =>
    guarded(async () => {
      const outcome = await commitPromotion(target.id, placements, false);
      setCommitted(outcome);
      setConfirming(false);
      toast.success(
        `${outcome.created.length} student${outcome.created.length === 1 ? "" : "s"} placed in ${target.name}.`,
      );

      // What the server now says, rather than what the page assumed.
      const next = await fetchPromotionPreview(target.id, Number(sourceId));
      setPreview(next);
      setChoices(initialChoices(next));
      setChecked(null);
    });

  const choose = (studentId: number, choice: Choice) => {
    setChoices((current) => ({ ...current, [studentId]: choice }));
    setConfirming(false);
  };

  const counts = {
    total: preview?.rows.length ?? 0,
    alreadyPlaced: (preview?.rows ?? []).filter((row) => row.reason === "already_placed").length,
    toPlace: placements.filter((placement) => placement.sectionId !== null).length,
    notPlaced: Object.values(choices).filter((choice) => choice === NONE).length,
  };

  return (
    <div className="space-y-6">
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Move students into {target.name}</CardTitle>
          <p className="text-sm text-gray-600">
            Each student is proposed the same section one year level up. Review
            each placement, check it, then commit. Their work, progress and
            achievements are not touched, and {sources.find((y) => String(y.id) === sourceId)?.name ?? "the year they leave"}{" "}
            keeps its placements as they are.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="promotion-source">Move students from</Label>
            <select
              id="promotion-source"
              className={selectClass}
              value={sourceId}
              disabled={busy}
              onChange={(event) => {
                setSourceId(event.target.value);
                setPreview(null);
                setChoices({});
                setChecked(null);
                setCommitted(null);
              }}
            >
              {sources.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name} ({year.statusLabel})
                </option>
              ))}
            </select>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400 mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-gray-900 mb-2">{target.name}</p>
          <Button size="sm" disabled={busy || sourceId === ""} onClick={loadPreview}>
            {preview ? "Reload preview" : "Preview"}
          </Button>
        </CardContent>
      </Card>

      {problems.length > 0 && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <ul className="list-disc pl-5 space-y-1">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}

      {committed && (
        <div role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Placed {committed.created.length} in {target.name}; {committed.notPlaced.length} not placed;{" "}
          {committed.skipped.length} already placed and left as they were.
        </div>
      )}

      {preview && preview.rows.length === 0 && (
        <EmptyState
          title={`Nobody is placed in ${preview.from.name}`}
          description="There is nobody to move from that year."
        />
      )}

      {preview && preview.rows.length > 0 && (
        <Card className="border-gray-200">
          <CardContent className="p-4 space-y-4">
            <dl className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm" aria-label="Summary">
              <Summary label="Students" value={counts.total} />
              <Summary label="To place" value={counts.toPlace} />
              <Summary label="Not placed" value={counts.notPlaced} />
              <Summary label="Need a decision" value={undecided} emphasis={undecided > 0} />
              <Summary label="Already placed" value={counts.alreadyPlaced} />
            </dl>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4 font-semibold">Student</th>
                    <th className="py-2 pr-4 font-semibold">In {preview.from.name}</th>
                    <th className="py-2 pr-4 font-semibold">In {preview.to.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => {
                    const choice = choices[row.student.id];
                    const needsDecision = choice === UNDECIDED;

                    return (
                      <tr
                        key={row.student.id}
                        className={`border-b border-gray-100 ${needsDecision ? "bg-amber-50" : ""}`}
                      >
                        <td className="py-2 pr-4">
                          <p className="font-medium text-gray-900">{row.student.fullName}</p>
                          <p className="text-xs text-gray-500">{row.student.studentId ?? "—"}</p>
                        </td>
                        <td className="py-2 pr-4 text-gray-700">{describe(row.from)}</td>
                        <td className="py-2 pr-4 space-y-1">
                          {row.reason === "already_placed" ? (
                            <p className="text-gray-700">{row.proposed ? describe(row.proposed) : "—"}</p>
                          ) : (
                            <select
                              aria-label={`Placement for ${row.student.fullName}`}
                              className={selectClass}
                              value={choice}
                              disabled={busy}
                              onChange={(event) => choose(row.student.id, event.target.value)}
                            >
                              {needsDecision && <option value={UNDECIDED}>Choose…</option>}
                              <option value={NONE}>Not placed this year</option>
                              {preview.sections.map((section) => (
                                <option key={section.section.id} value={section.section.id}>
                                  {describe(section)}
                                  {section.isActive ? "" : " (closed)"}
                                </option>
                              ))}
                            </select>
                          )}
                          <p className="text-xs text-gray-500">{REASON_NOTES[row.reason]}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || undecided > 0 || placements.length === 0}
                  onClick={dryRun}
                >
                  Check (dry run)
                </Button>
                <Button
                  size="sm"
                  disabled={busy || !checkedNow || confirming}
                  onClick={() => setConfirming(true)}
                >
                  Commit
                </Button>
                {undecided > 0 && (
                  <span className="text-xs text-amber-700">
                    {undecided} student{undecided === 1 ? " needs" : "s need"} a decision first.
                  </span>
                )}
                {checked !== null && !checkedNow && (
                  <span className="text-xs text-gray-500">
                    The choices changed since the check. Check again before committing.
                  </span>
                )}
              </div>

              {checkedNow && checked && (
                <div role="status" aria-label="Dry run" className="rounded-md border border-info/25 bg-info/10 p-3 text-sm text-gray-800 space-y-1">
                  <p>
                    The check found nothing wrong. Committing would place{" "}
                    {checked.outcome.created.length}, leave {checked.outcome.notPlaced.length} not placed,
                    and leave {checked.outcome.skipped.length} already placed as they are.
                  </p>
                  <ul className="list-disc pl-5 text-xs text-gray-600">
                    {checked.outcome.created.map((row) => (
                      <li key={row.studentId}>
                        {names.get(row.studentId) ?? `Student ${row.studentId}`} →{" "}
                        {sectionNames.get(row.sectionId) ?? `section ${row.sectionId}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {confirming && checkedNow && checked && (
                <InlineConfirm
                  question={`Place ${checked.outcome.created.length} student${checked.outcome.created.length === 1 ? "" : "s"} in ${target.name}?`}
                  detail="Everyone on the list is placed, or nobody is. Their work and their placements in other years are not touched."
                  verb="Commit"
                  busy={busy}
                  onConfirm={commit}
                  onCancel={() => setConfirming(false)}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Summary({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className={`rounded-md border p-2 ${emphasis ? "border-amber-300 bg-amber-50" : "border-gray-100"}`}>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-lg font-semibold text-gray-900">{value}</dd>
    </div>
  );
}
