import { api } from "@/services/api";
import type { AchievementType } from "./types";

/**
 * Authoring the achievement catalogue.
 *
 * Writes and the author's read of the catalogue — deliberately separate from
 * achievementService, which is the student's. The two answer different
 * questions about the same rows: a student is told what they have earned and
 * how close they are to the rest, and is shown only what is being awarded. An
 * author is shown everything, including the drafts nobody has seen and the
 * retired ones nobody can earn any more, plus what an award has already settled
 * about each.
 *
 * Access is the server's decision. The API refuses anyone without
 * canManageContent(), so nothing here re-decides it and these screens simply
 * never reach a student.
 *
 * Two rules run through all of it, and both are the server's, restated here
 * only so an author is not offered a button that would be refused:
 *
 * - An achievement is written as a draft and activated afterwards. There is no
 *   status on the create or the edit; activating is its own call.
 * - Once a student holds one, its rule is fixed and the row cannot be deleted.
 *   Retiring is what that achievement gets instead, and it costs the student
 *   nothing.
 */

export type AchievementStatus = "draft" | "active" | "retired";

/** The rules an author may still write against. roadmap_complete is not one. */
export type AssignableAchievementType = "challenge_count" | "first_try";

export const ASSIGNABLE_TYPES: readonly AssignableAchievementType[] = [
  "challenge_count",
  "first_try",
];

/**
 * One achievement as its author sees it.
 *
 * Every flag here is the server's answer rather than something worked out from
 * the others, so the page cannot offer an action the API is going to refuse.
 */
export interface AdminAchievement {
  id: number;
  key: string;
  title: string;
  description: string | null;
  icon: string | null;
  type: AchievementType;
  typeLabel: string;
  criteria: Record<string, unknown> | null;
  /** False for roadmap_complete: readable history, not something to write. */
  isAssignable: boolean;
  status: AchievementStatus;
  statusLabel: string;
  awardedCount: number;
  hasBeenAwarded: boolean;
  rulesAreEditable: boolean;
  canBeDeleted: boolean;
}

interface ApiAdminAchievement {
  id: number;
  key: string;
  title: string;
  description: string | null;
  icon: string | null;
  type: AchievementType;
  type_label: string;
  criteria: Record<string, unknown> | null;
  is_assignable: boolean;
  status: AchievementStatus;
  status_label: string;
  awarded_count: number;
  has_been_awarded: boolean;
  rules_are_editable: boolean;
  can_be_deleted: boolean;
}

function toAdminAchievement(row: ApiAdminAchievement): AdminAchievement {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    description: row.description,
    icon: row.icon,
    type: row.type,
    typeLabel: row.type_label,
    criteria: row.criteria,
    isAssignable: row.is_assignable,
    status: row.status,
    statusLabel: row.status_label,
    awardedCount: row.awarded_count,
    hasBeenAwarded: row.has_been_awarded,
    rulesAreEditable: row.rules_are_editable,
    canBeDeleted: row.can_be_deleted,
  };
}

/**
 * What the author is filling in.
 *
 * `count` is held as a string because it comes from a text box, and an
 * half-typed number is a string rather than NaN. It becomes an integer on the
 * way out, and validateAchievementDraft is what stands between the two.
 */
export interface AchievementDraft {
  key: string;
  title: string;
  description: string;
  icon: string;
  type: AssignableAchievementType;
  count: string;
}

export const EMPTY_ACHIEVEMENT_DRAFT: AchievementDraft = {
  key: "",
  title: "",
  description: "",
  icon: "",
  type: "challenge_count",
  count: "1",
};

export function draftOfAchievement(
  achievement: AdminAchievement,
): AchievementDraft {
  const count = achievement.criteria?.count;

  return {
    key: achievement.key,
    title: achievement.title,
    description: achievement.description ?? "",
    icon: achievement.icon ?? "",
    // A roadmap_complete achievement has no type an author may pick, and its
    // rule is locked in the form for exactly that reason — this is only what
    // the disabled control shows.
    type: isAssignableType(achievement.type) ? achievement.type : "challenge_count",
    count: typeof count === "number" ? String(count) : "1",
  };
}

export function isAssignableType(
  type: AchievementType,
): type is AssignableAchievementType {
  return type === "challenge_count" || type === "first_try";
}

/** What each rule counts, in the wording the form uses. */
export const TYPE_DESCRIPTIONS: Record<AssignableAchievementType, string> = {
  challenge_count: "Awarded for passing a number of distinct challenges.",
  first_try: "Awarded for passing challenges on the first submission.",
};

/** The rule half of the payload — sent only when it may still be rewritten. */
function rulePayload(draft: AchievementDraft): Record<string, unknown> {
  return {
    type: draft.type,
    // The server narrows this to what the rule reads; sending the whole block
    // keeps type and criteria together, which is how the API wants them.
    criteria: { count: Number(draft.count) },
  };
}

function detailPayload(draft: AchievementDraft): Record<string, unknown> {
  return {
    title: draft.title.trim(),
    // An empty box means "no description" rather than "an empty description".
    description: draft.description.trim() || null,
    icon: draft.icon.trim() || null,
  };
}

/** Every achievement, whatever its status. */
export async function fetchAdminAchievements(): Promise<AdminAchievement[]> {
  const { data } = await api.get<{ data: ApiAdminAchievement[] }>(
    "/admin/achievements",
  );

  return data.map(toAdminAchievement);
}

/**
 * Writes a new achievement down.
 *
 * It arrives as a draft: nothing is put in front of a class by the act of
 * writing it, and the author starts the awarding with activateAchievement()
 * when the rule is right. The payload carries no status at all — the server
 * would ignore one, and not sending it is what says so.
 */
export async function createAchievement(
  draft: AchievementDraft,
): Promise<AdminAchievement> {
  const { data } = await api.post<{ data: ApiAdminAchievement }>(
    "/admin/achievements",
    {
      key: draft.key.trim(),
      ...detailPayload(draft),
      ...rulePayload(draft),
    },
  );

  return toAdminAchievement(data);
}

/**
 * Rewrites an achievement.
 *
 * The rule goes only when it may still be rewritten. Once a student holds the
 * achievement the server refuses a change to it — sending it back unchanged
 * would be accepted, but not sending it is what makes the request say what the
 * author actually did, and it is the safer thing to get wrong.
 *
 * The key is never sent. It is what the seeder matches its catalogue on, the
 * API ignores it here, and an author who could move it could make a re-seed
 * write a second copy of an achievement students already hold.
 */
export async function updateAchievement(
  achievementId: number,
  draft: AchievementDraft,
  rulesAreEditable: boolean,
): Promise<AdminAchievement> {
  const { data } = await api.put<{ data: ApiAdminAchievement }>(
    `/admin/achievements/${achievementId}`,
    {
      ...detailPayload(draft),
      ...(rulesAreEditable ? rulePayload(draft) : {}),
    },
  );

  return toAdminAchievement(data);
}

/** Puts a draft in front of students: it is evaluated and awarded from now on. */
export async function activateAchievement(
  achievementId: number,
): Promise<AdminAchievement> {
  const { data } = await api.post<{ data: ApiAdminAchievement }>(
    `/admin/achievements/${achievementId}/activate`,
  );

  return toAdminAchievement(data);
}

/**
 * Stops it being awarded, for good.
 *
 * Nothing a student earned is touched. Refused with 409 for anything that is
 * not currently active, including one already retired — the server carries the
 * explanation, so callers show that rather than inventing one.
 */
export async function retireAchievement(
  achievementId: number,
): Promise<AdminAchievement> {
  const { data } = await api.post<{ data: ApiAdminAchievement }>(
    `/admin/achievements/${achievementId}/retire`,
  );

  return toAdminAchievement(data);
}

/**
 * Destroys an achievement nobody ever earned.
 *
 * Refused with 409 the moment one student holds it, because the award would go
 * with it. That achievement is retired instead.
 */
export async function deleteAchievement(achievementId: number): Promise<void> {
  await api.delete(`/admin/achievements/${achievementId}`);
}

export type AchievementDraftField = keyof AchievementDraft;

/**
 * What is wrong with this draft, per field, or nothing.
 *
 * The server validates all of it again and has the final say. This exists so an
 * author is told which box to fix without a round trip, and the rules match the
 * ones the API enforces rather than being a looser guess at them.
 */
export function validateAchievementDraft(
  draft: AchievementDraft,
  { requireKey = true, requireRule = true }: {
    requireKey?: boolean;
    requireRule?: boolean;
  } = {},
): Partial<Record<AchievementDraftField, string>> {
  const errors: Partial<Record<AchievementDraftField, string>> = {};

  if (requireKey) {
    const key = draft.key.trim();

    if (key === "") {
      errors.key = "Give the achievement a key.";
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) {
      errors.key =
        "Use lower-case letters, numbers and single hyphens, like “first-steps”.";
    } else if (key.length > 255) {
      errors.key = "Keep the key under 255 characters.";
    }
  }

  if (draft.title.trim() === "") {
    errors.title = "Give the achievement a title.";
  } else if (draft.title.trim().length > 255) {
    errors.title = "Keep the title under 255 characters.";
  }

  if (draft.description.trim().length > 5000) {
    errors.description = "Keep the description under 5000 characters.";
  }

  if (draft.icon.trim().length > 255) {
    errors.icon = "Keep the icon name under 255 characters.";
  }

  if (requireRule) {
    const count = draft.count.trim();

    if (count === "") {
      errors.count = "Say how many are needed.";
    } else if (!/^\d+$/.test(count)) {
      errors.count = "How many are needed has to be a whole number.";
    } else if (Number(count) < 1) {
      // The evaluator floors this at one, so a zero would quietly become a one.
      errors.count = "An achievement has to ask for at least one.";
    } else if (Number(count) > 1000) {
      errors.count = "That is more than an achievement can ask for.";
    }
  }

  return errors;
}
