import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EMPTY_ACHIEVEMENT_DRAFT,
  activateAchievement,
  createAchievement,
  deleteAchievement,
  draftOfAchievement,
  fetchAdminAchievements,
  isAssignableType,
  retireAchievement,
  updateAchievement,
  validateAchievementDraft,
} from "./adminAchievementService";
import type {
  AchievementDraft,
  AdminAchievement,
} from "./adminAchievementService";

/**
 * The author's half of the achievement API.
 *
 * The transport is stubbed, so these say what the service asks for and what it
 * makes of the answer. Two of them carry real weight: the rule is left out of
 * an edit when the server has locked it, and no call ever carries a status —
 * writing an achievement down and putting it in front of a class are separate
 * decisions, and the payload is where that stops being a claim.
 */

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();

  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

const { api } = await import("@/services/api");

function apiRow(over: Record<string, unknown> = {}) {
  return {
    id: 7,
    key: "on-a-roll",
    title: "On a Roll",
    description: "Pass five challenges.",
    icon: "zap",
    type: "challenge_count",
    type_label: "Challenges passed",
    criteria: { count: 5 },
    is_assignable: true,
    status: "active",
    status_label: "Active",
    awarded_count: 3,
    has_been_awarded: true,
    rules_are_editable: false,
    can_be_deleted: false,
    created_at: "2026-09-01T00:00:00.000000Z",
    updated_at: "2026-09-01T00:00:00.000000Z",
    ...over,
  };
}

function draft(over: Partial<AchievementDraft> = {}): AchievementDraft {
  return {
    key: "ten-down",
    title: "Ten Down",
    description: "Pass ten challenges.",
    icon: "cable",
    type: "challenge_count",
    count: "10",
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("reading the catalogue", () => {
  it("asks for every achievement, not only the ones being awarded", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [apiRow()] });

    await fetchAdminAchievements();

    expect(api.get).toHaveBeenCalledWith("/admin/achievements");
  });

  it("turns the server's snake_case into what the page reads", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [apiRow()] });

    const [achievement] = await fetchAdminAchievements();

    expect(achievement).toEqual<AdminAchievement>({
      id: 7,
      key: "on-a-roll",
      title: "On a Roll",
      description: "Pass five challenges.",
      icon: "zap",
      type: "challenge_count",
      typeLabel: "Challenges passed",
      criteria: { count: 5 },
      isAssignable: true,
      status: "active",
      statusLabel: "Active",
      awardedCount: 3,
      hasBeenAwarded: true,
      rulesAreEditable: false,
      canBeDeleted: false,
    });
  });

  it("carries every status through", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        apiRow({ id: 1, status: "draft", status_label: "Draft" }),
        apiRow({ id: 2, status: "active", status_label: "Active" }),
        apiRow({ id: 3, status: "retired", status_label: "Retired" }),
      ],
    });

    expect((await fetchAdminAchievements()).map((a) => a.status)).toEqual([
      "draft",
      "active",
      "retired",
    ]);
  });
});

describe("writing one down", () => {
  it("sends the details and the rule, and no status at all", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiRow() });

    await createAchievement(draft());

    expect(api.post).toHaveBeenCalledWith("/admin/achievements", {
      key: "ten-down",
      title: "Ten Down",
      description: "Pass ten challenges.",
      icon: "cable",
      type: "challenge_count",
      criteria: { count: 10 },
    });

    // The one thing that must not be in there. A new achievement is a draft,
    // and activating it is a decision taken separately and later.
    const [, payload] = vi.mocked(api.post).mock.calls[0];
    expect(payload).not.toHaveProperty("status");
  });

  it("sends the count as a number rather than the text that was typed", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiRow() });

    await createAchievement(draft({ count: "4" }));

    const [, payload] = vi.mocked(api.post).mock.calls[0];
    expect((payload as { criteria: { count: unknown } }).criteria.count).toBe(4);
  });

  it("treats an empty optional box as nothing rather than as an empty string", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiRow() });

    await createAchievement(draft({ description: "  ", icon: "" }));

    const [, payload] = vi.mocked(api.post).mock.calls[0];
    expect(payload).toMatchObject({ description: null, icon: null });
  });
});

describe("rewriting one", () => {
  it("sends the rule while it may still be rewritten", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: apiRow() });

    await updateAchievement(7, draft(), true);

    expect(api.put).toHaveBeenCalledWith("/admin/achievements/7", {
      title: "Ten Down",
      description: "Pass ten challenges.",
      icon: "cable",
      type: "challenge_count",
      criteria: { count: 10 },
    });
  });

  it("leaves the rule out once a student holds it", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: apiRow() });

    await updateAchievement(7, draft(), false);

    // Not merely unchanged — absent. The server would refuse a change and
    // accept an identical rule, but a request that says only what the author
    // actually did is the one that cannot be wrong by accident.
    expect(api.put).toHaveBeenCalledWith("/admin/achievements/7", {
      title: "Ten Down",
      description: "Pass ten challenges.",
      icon: "cable",
    });
  });

  it("never sends the key", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: apiRow() });

    await updateAchievement(7, draft({ key: "moved" }), true);

    // The key is what the seeder matches its catalogue on. The API ignores it
    // here; not sending it is what says the form is not offering to move it.
    const [, payload] = vi.mocked(api.put).mock.calls[0];
    expect(payload).not.toHaveProperty("key");
  });

  it("never sends a status", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: apiRow() });

    await updateAchievement(7, draft(), true);

    const [, payload] = vi.mocked(api.put).mock.calls[0];
    expect(payload).not.toHaveProperty("status");
  });
});

describe("moving one along its life", () => {
  it("activates on its own route", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiRow() });

    await activateAchievement(7);

    expect(api.post).toHaveBeenCalledWith("/admin/achievements/7/activate");
  });

  it("retires on its own route", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiRow() });

    await retireAchievement(7);

    expect(api.post).toHaveBeenCalledWith("/admin/achievements/7/retire");
  });

  it("deletes by id", async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined);

    await deleteAchievement(7);

    expect(api.delete).toHaveBeenCalledWith("/admin/achievements/7");
  });
});

describe("filling the form from an achievement", () => {
  function achievement(over: Partial<AdminAchievement> = {}): AdminAchievement {
    return {
      id: 7,
      key: "on-a-roll",
      title: "On a Roll",
      description: "Pass five challenges.",
      icon: "zap",
      type: "challenge_count",
      typeLabel: "Challenges passed",
      criteria: { count: 5 },
      isAssignable: true,
      status: "active",
      statusLabel: "Active",
      awardedCount: 0,
      hasBeenAwarded: false,
      rulesAreEditable: true,
      canBeDeleted: true,
      ...over,
    };
  }

  it("reads the count out of the criteria", () => {
    expect(draftOfAchievement(achievement())).toEqual({
      key: "on-a-roll",
      title: "On a Roll",
      description: "Pass five challenges.",
      icon: "zap",
      type: "challenge_count",
      count: "5",
    });
  });

  it("turns a missing detail into an empty box rather than the word null", () => {
    const filled = draftOfAchievement(
      achievement({ description: null, icon: null }),
    );

    expect(filled.description).toBe("");
    expect(filled.icon).toBe("");
  });

  it("falls back to a rule the picker actually offers", () => {
    // roadmap_complete is not in the picker. The form locks the rule for one of
    // these anyway; this is only what the disabled control has to show.
    const filled = draftOfAchievement(
      achievement({
        type: "roadmap_complete",
        criteria: { roadmap_id: 3 },
        isAssignable: false,
      }),
    );

    expect(filled.type).toBe("challenge_count");
    expect(filled.count).toBe("1");
  });

  it("knows which rules may be written against", () => {
    expect(isAssignableType("challenge_count")).toBe(true);
    expect(isAssignableType("first_try")).toBe(true);
    expect(isAssignableType("roadmap_complete")).toBe(false);
  });

  it("starts a new achievement on a rule that is offered", () => {
    expect(isAssignableType(EMPTY_ACHIEVEMENT_DRAFT.type)).toBe(true);
  });
});

describe("checking a draft before it is sent", () => {
  it("accepts a complete one", () => {
    expect(validateAchievementDraft(draft())).toEqual({});
  });

  it("asks for the details it cannot write without", () => {
    const found = validateAchievementDraft(draft({ key: "", title: "  " }));

    expect(found.key).toBeDefined();
    expect(found.title).toBeDefined();
  });

  it("refuses a key that is not a slug", () => {
    for (const key of ["Ten Down", "ten_down", "ten--down", "-ten", "TEN"]) {
      expect(validateAchievementDraft(draft({ key })).key).toBeDefined();
    }
  });

  it("accepts the slugs the server accepts", () => {
    for (const key of ["first-steps", "no-notes", "a", "level-2-done"]) {
      expect(validateAchievementDraft(draft({ key })).key).toBeUndefined();
    }
  });

  it("refuses a count the evaluator could not read", () => {
    for (const count of ["", "0", "-3", "two", "2.5", "1001"]) {
      expect(validateAchievementDraft(draft({ count })).count).toBeDefined();
    }
  });

  it("accepts a count the server would take", () => {
    for (const count of ["1", "5", "1000"]) {
      expect(validateAchievementDraft(draft({ count })).count).toBeUndefined();
    }
  });

  it("skips the key when editing, because it is not being sent", () => {
    const found = validateAchievementDraft(draft({ key: "" }), {
      requireKey: false,
    });

    expect(found.key).toBeUndefined();
  });

  it("skips the rule when it is locked, because it is not being sent", () => {
    const found = validateAchievementDraft(draft({ count: "nonsense" }), {
      requireKey: false,
      requireRule: false,
    });

    expect(found.count).toBeUndefined();
  });

  it("still checks the title when everything else is skipped", () => {
    const found = validateAchievementDraft(draft({ title: "" }), {
      requireKey: false,
      requireRule: false,
    });

    expect(found.title).toBeDefined();
  });
});
