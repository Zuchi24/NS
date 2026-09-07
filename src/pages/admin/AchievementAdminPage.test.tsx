// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AchievementAdminPage } from "./AchievementAdminPage";
import { ApiError } from "@/services/api";
import type { AdminAchievement } from "@/features/achievements/adminAchievementService";

/**
 * Authoring the achievement catalogue.
 *
 * The service is stubbed, so these say what the page asks the API for and what
 * it does with the answer. The ones that matter most are the refusals the page
 * must never walk into: a rule cannot be rewritten once a student holds the
 * achievement, and a held achievement cannot be deleted at all. Both are the
 * server's rules; what is checked here is that the page does not offer the
 * button — and that when the server refuses anyway, the author is told why in
 * the server's own words with the catalogue still in front of them.
 */

vi.mock("@/features/achievements/adminAchievementService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/achievements/adminAchievementService")
  >();

  return {
    ...actual,
    fetchAdminAchievements: vi.fn(),
    createAchievement: vi.fn(),
    updateAchievement: vi.fn(),
    activateAchievement: vi.fn(),
    retireAchievement: vi.fn(),
    deleteAchievement: vi.fn(),
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const service = await import("@/features/achievements/adminAchievementService");
const { toast } = await import("sonner");

function achievement(over: Partial<AdminAchievement> = {}): AdminAchievement {
  return {
    id: 1,
    key: "first-steps",
    title: "First Steps",
    description: "Pass your first challenge.",
    icon: "flag",
    type: "challenge_count",
    typeLabel: "Challenges passed",
    criteria: { count: 1 },
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

const draft = achievement({
  id: 2,
  key: "being-written",
  title: "Being Written",
  status: "draft",
  statusLabel: "Draft",
});

const retired = achievement({
  id: 3,
  key: "finished-with",
  title: "Finished With",
  status: "retired",
  statusLabel: "Retired",
});

const held = achievement({
  id: 4,
  key: "earned",
  title: "Earned By Many",
  awardedCount: 12,
  hasBeenAwarded: true,
  rulesAreEditable: false,
  canBeDeleted: false,
});

/** Renders the page and waits for its first load to land. */
async function show(achievements: AdminAchievement[]) {
  vi.mocked(service.fetchAdminAchievements).mockResolvedValue(achievements);

  render(<AchievementAdminPage />);

  if (achievements.length > 0) {
    await screen.findByText(achievements[0].title);
  } else {
    await screen.findByText("No achievements yet");
  }
}

/** The card for one achievement, so a query cannot stray into another's row. */
function row(target: AdminAchievement) {
  return within(screen.getByTestId(`achievement-${target.id}`));
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("showing the catalogue", () => {
  it("lists every achievement whatever its status", async () => {
    await show([achievement(), draft, retired]);

    expect(screen.getByText("First Steps")).toBeInTheDocument();
    expect(screen.getByText("Being Written")).toBeInTheDocument();
    expect(screen.getByText("Finished With")).toBeInTheDocument();
  });

  it("says which of the three each one is", async () => {
    await show([achievement(), draft, retired]);

    expect(row(achievement()).getByText("Active")).toBeInTheDocument();
    expect(row(draft).getByText("Draft")).toBeInTheDocument();
    expect(row(retired).getByText("Retired")).toBeInTheDocument();
  });

  it("shows what each one counts and how much of it", async () => {
    await show([achievement({ typeLabel: "Passed first try", criteria: { count: 5 } })]);

    expect(screen.getByText(/Passed first try/)).toBeInTheDocument();
    expect(screen.getByText(/needs 5/)).toBeInTheDocument();
  });

  it("counts how many students hold each one", async () => {
    const one = achievement({ id: 9, title: "Held By One", awardedCount: 1 });

    await show([achievement(), held, one]);

    expect(row(achievement()).getByText("Earned by nobody yet")).toBeInTheDocument();
    expect(row(held).getByText("Earned by 12 students")).toBeInTheDocument();
    expect(row(one).getByText("Earned by 1 student")).toBeInTheDocument();
  });

  it("offers to write the first one when there are none", async () => {
    await show([]);

    expect(screen.getByText("No achievements yet")).toBeInTheDocument();
  });

  it("shows the server's message when the catalogue will not load", async () => {
    vi.mocked(service.fetchAdminAchievements).mockRejectedValue(
      new ApiError("You do not have permission to do that.", 403),
    );

    render(<AchievementAdminPage />);

    expect(
      await screen.findByText("You do not have permission to do that."),
    ).toBeInTheDocument();
  });
});

describe("writing a new one", () => {
  it("sends what was filled in and reloads the catalogue", async () => {
    const user = userEvent.setup();
    await show([achievement()]);

    vi.mocked(service.createAchievement).mockResolvedValue(draft);

    await user.click(screen.getByRole("button", { name: /new achievement/i }));

    const form = within(screen.getByRole("form", { name: "Add achievement" }));

    await user.type(form.getByLabelText("Key"), "ten-down");
    await user.type(form.getByLabelText("Title"), "Ten Down");
    await user.selectOptions(form.getByLabelText("Awarded for"), "first_try");
    await user.clear(form.getByLabelText("How many are needed"));
    await user.type(form.getByLabelText("How many are needed"), "10");

    await user.click(form.getByRole("button", { name: "Add achievement" }));

    await waitFor(() =>
      expect(service.createAchievement).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "ten-down",
          title: "Ten Down",
          type: "first_try",
          count: "10",
        }),
      ),
    );

    // Reloaded rather than patched in place: the server decides the id and the
    // status, and the list has to show what it actually stored.
    expect(service.fetchAdminAchievements).toHaveBeenCalledTimes(2);
  });

  it("says the new one is a draft before it is written", async () => {
    const user = userEvent.setup();
    await show([achievement()]);

    await user.click(screen.getByRole("button", { name: /new achievement/i }));

    // Scoped to the form: the empty state says much the same thing, and the
    // point here is that the author is told while they are filling it in.
    const form = within(screen.getByRole("form", { name: "Add achievement" }));

    expect(form.getByText(/starts as a draft/i)).toBeInTheDocument();
  });

  it("catches a bad draft before it reaches the server", async () => {
    const user = userEvent.setup();
    await show([]);

    await user.click(screen.getByRole("button", { name: /new achievement/i }));

    const form = within(screen.getByRole("form", { name: "Add achievement" }));
    await user.click(form.getByRole("button", { name: "Add achievement" }));

    expect(await form.findByText("Give the achievement a key.")).toBeInTheDocument();
    expect(form.getByText("Give the achievement a title.")).toBeInTheDocument();
    expect(service.createAchievement).not.toHaveBeenCalled();
  });

  it("shows the server's complaint against the field it was about", async () => {
    const user = userEvent.setup();
    await show([]);

    vi.mocked(service.createAchievement).mockRejectedValue(
      new ApiError("The given data was invalid.", 422, {
        key: ["An achievement with that key already exists."],
      }),
    );

    await user.click(screen.getByRole("button", { name: /new achievement/i }));

    const form = within(screen.getByRole("form", { name: "Add achievement" }));
    await user.type(form.getByLabelText("Key"), "taken");
    await user.type(form.getByLabelText("Title"), "Taken");
    await user.click(form.getByRole("button", { name: "Add achievement" }));

    expect(
      await form.findByText("An achievement with that key already exists."),
    ).toBeInTheDocument();
  });
});

describe("rewriting one", () => {
  it("opens filled in with what is already stored", async () => {
    const user = userEvent.setup();
    await show([achievement({ criteria: { count: 3 } })]);

    await user.click(row(achievement()).getByRole("button", { name: /edit/i }));

    const form = within(screen.getByRole("form", { name: "Edit achievement" }));

    expect(form.getByLabelText("Title")).toHaveValue("First Steps");
    expect(form.getByLabelText("How many are needed")).toHaveValue("3");
    // The key is permanent, so the edit form does not offer it at all.
    expect(form.queryByLabelText("Key")).not.toBeInTheDocument();
  });

  it("saves the rewrite and says the rule may still be changed", async () => {
    const user = userEvent.setup();
    await show([achievement()]);

    vi.mocked(service.updateAchievement).mockResolvedValue(achievement());

    await user.click(row(achievement()).getByRole("button", { name: /edit/i }));

    const form = within(screen.getByRole("form", { name: "Edit achievement" }));
    await user.clear(form.getByLabelText("Title"));
    await user.type(form.getByLabelText("Title"), "Renamed");
    await user.click(form.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(service.updateAchievement).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ title: "Renamed" }),
        // Nobody holds it, so the rule goes with the rewrite.
        true,
      ),
    );
  });
});

describe("what an award settles", () => {
  it("locks the rule on an achievement students hold", async () => {
    const user = userEvent.setup();
    await show([held]);

    await user.click(row(held).getByRole("button", { name: /edit/i }));

    const form = within(screen.getByRole("form", { name: "Edit achievement" }));

    // The rule is shown, because the author still needs to see what it is —
    // and it cannot be touched.
    expect(form.getByLabelText("Awarded for")).toBeDisabled();
    expect(form.getByLabelText("How many are needed")).toBeDisabled();

    // The presentation is still theirs to change.
    expect(form.getByLabelText("Title")).toBeEnabled();
    expect(form.getByLabelText("Description (optional)")).toBeEnabled();
  });

  it("says why the rule is locked", async () => {
    const user = userEvent.setup();
    await show([held]);

    await user.click(row(held).getByRole("button", { name: /edit/i }));

    expect(
      screen.getByText(/Students have earned this, so what it is awarded for cannot be changed/i),
    ).toBeInTheDocument();
  });

  it("leaves the rule out of the save when it is locked", async () => {
    const user = userEvent.setup();
    await show([held]);

    vi.mocked(service.updateAchievement).mockResolvedValue(held);

    await user.click(row(held).getByRole("button", { name: /edit/i }));

    const form = within(screen.getByRole("form", { name: "Edit achievement" }));
    await user.clear(form.getByLabelText("Title"));
    await user.type(form.getByLabelText("Title"), "Better Name");
    await user.click(form.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(service.updateAchievement).toHaveBeenCalledWith(
        4,
        expect.objectContaining({ title: "Better Name" }),
        false,
      ),
    );
  });

  it("locks the rule on an achievement counting something no longer offered", async () => {
    const user = userEvent.setup();
    const historical = achievement({
      id: 5,
      key: "roadmap-done",
      title: "Roadmap Complete",
      type: "roadmap_complete",
      typeLabel: "Roadmap completed",
      criteria: { roadmap_id: 3 },
      isAssignable: false,
    });

    await show([historical]);

    await user.click(row(historical).getByRole("button", { name: /edit/i }));

    const form = within(screen.getByRole("form", { name: "Edit achievement" }));

    expect(form.getByLabelText("Awarded for")).toBeDisabled();
    expect(
      screen.getByText(/rule that is no longer offered/i),
    ).toBeInTheDocument();
  });

  it("offers only the rules that may still be written against", async () => {
    const user = userEvent.setup();
    await show([]);

    await user.click(screen.getByRole("button", { name: /new achievement/i }));

    const options = within(
      screen.getByLabelText("Awarded for"),
    ).getAllByRole("option");

    expect(options.map((option) => option.getAttribute("value"))).toEqual([
      "challenge_count",
      "first_try",
    ]);
  });
});

describe("moving one along its life", () => {
  it("offers only the move each one actually has", async () => {
    await show([draft, achievement(), retired]);

    expect(row(draft).getByRole("button", { name: /activate/i })).toBeInTheDocument();
    expect(row(draft).queryByRole("button", { name: /retire/i })).toBeNull();

    expect(row(achievement()).getByRole("button", { name: /retire/i })).toBeInTheDocument();
    expect(row(achievement()).queryByRole("button", { name: /activate/i })).toBeNull();

    // Retired is the end. Neither button is offered, because neither would work.
    expect(row(retired).queryByRole("button", { name: /activate/i })).toBeNull();
    expect(row(retired).queryByRole("button", { name: /retire/i })).toBeNull();
  });

  it("asks before activating, and says what activating starts", async () => {
    const user = userEvent.setup();
    await show([draft]);

    await user.click(row(draft).getByRole("button", { name: /activate/i }));

    expect(
      screen.getByText(/Students start being measured against it straight away/i),
    ).toBeInTheDocument();

    // Nothing has happened yet — asking is not doing.
    expect(service.activateAchievement).not.toHaveBeenCalled();
  });

  it("activates once the author confirms", async () => {
    const user = userEvent.setup();
    await show([draft]);

    vi.mocked(service.activateAchievement).mockResolvedValue(achievement());

    await user.click(row(draft).getByRole("button", { name: /activate/i }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Activate",
      }),
    );

    await waitFor(() => expect(service.activateAchievement).toHaveBeenCalledWith(2));
    expect(service.fetchAdminAchievements).toHaveBeenCalledTimes(2);
  });

  it("does nothing when the author backs out", async () => {
    const user = userEvent.setup();
    await show([draft]);

    await user.click(row(draft).getByRole("button", { name: /activate/i }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }),
    );

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(service.activateAchievement).not.toHaveBeenCalled();
  });

  it("warns that retiring cannot be undone, and that awards are kept", async () => {
    const user = userEvent.setup();
    await show([achievement()]);

    await user.click(row(achievement()).getByRole("button", { name: /retire/i }));

    const dialog = within(screen.getByRole("alertdialog"));

    expect(dialog.getByText(/cannot be undone/i)).toBeInTheDocument();
    expect(dialog.getByText(/already earned is kept/i)).toBeInTheDocument();
  });

  it("retires once the author confirms", async () => {
    const user = userEvent.setup();
    await show([achievement()]);

    vi.mocked(service.retireAchievement).mockResolvedValue(retired);

    await user.click(row(achievement()).getByRole("button", { name: /retire/i }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Retire" }),
    );

    await waitFor(() => expect(service.retireAchievement).toHaveBeenCalledWith(1));
  });

  it("shows the server's refusal in its own words", async () => {
    const user = userEvent.setup();
    await show([achievement()]);

    vi.mocked(service.retireAchievement).mockRejectedValue(
      new ApiError(
        "An achievement cannot go from Retired to Retired. Retiring is permanent; write a new achievement instead.",
        409,
      ),
    );

    await user.click(row(achievement()).getByRole("button", { name: /retire/i }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Retire" }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Retiring is permanent"),
      ),
    );

    // Still on the page, with the achievement still in front of the author.
    expect(screen.getByText("First Steps")).toBeInTheDocument();
  });
});

describe("deleting one", () => {
  it("offers delete only for an achievement nobody holds", async () => {
    await show([achievement(), held]);

    expect(row(achievement()).getByRole("button", { name: /delete/i })).toBeInTheDocument();

    // Hidden rather than disabled: there is no state in which it comes back.
    expect(row(held).queryByRole("button", { name: /delete/i })).toBeNull();
  });

  it("says why a held achievement cannot be deleted", async () => {
    await show([held]);

    expect(
      row(held).getByText(/its rule is fixed and it cannot be deleted/i),
    ).toBeInTheDocument();
    expect(row(held).getByText(/Retire it instead/i)).toBeInTheDocument();
  });

  it("asks before deleting", async () => {
    const user = userEvent.setup();
    await show([achievement()]);

    await user.click(row(achievement()).getByRole("button", { name: /delete/i }));

    expect(screen.getByText(/removed for good/i)).toBeInTheDocument();
    expect(service.deleteAchievement).not.toHaveBeenCalled();
  });

  it("deletes once the author confirms", async () => {
    const user = userEvent.setup();
    await show([achievement()]);

    vi.mocked(service.deleteAchievement).mockResolvedValue(undefined);

    await user.click(row(achievement()).getByRole("button", { name: /delete/i }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );

    await waitFor(() => expect(service.deleteAchievement).toHaveBeenCalledWith(1));
    expect(service.fetchAdminAchievements).toHaveBeenCalledTimes(2);
  });

  it("shows the server's refusal when a delete is beaten to it", async () => {
    const user = userEvent.setup();
    await show([achievement()]);

    // The page hides the button once it knows, but the catalogue in front of the
    // author can be a moment out of date — an award landing between the load and
    // the click is exactly the case the server's 409 is for.
    vi.mocked(service.deleteAchievement).mockRejectedValue(
      new ApiError(
        '"First Steps" cannot be deleted: students have earned it. Retire it instead, and they keep what they earned.',
        409,
      ),
    );

    await user.click(row(achievement()).getByRole("button", { name: /delete/i }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Retire it instead"),
      ),
    );

    expect(screen.getByText("First Steps")).toBeInTheDocument();
  });
});
