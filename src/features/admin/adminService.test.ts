import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  activateSection,
  deactivateSection,
  fetchCohorts,
  moveStudentToSection,
} from "./adminService";

/**
 * The instructor side's two writes, and the listing they act on.
 *
 * The transport is stubbed, so these say what the service asks for and what it
 * makes of the answer. What they are really pinning down is the shape of a
 * move: only a section id goes up. Nothing else about a student is an
 * instructor's to change, and the payload is where that stops being a claim in
 * a comment and becomes something a test would catch.
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

const sectionPayload = {
  data: { id: 7, name: "Section B", capacity: 40, is_active: false },
};

const studentPayload = {
  data: {
    student: {
      id: 3,
      student_id: "2024-0003",
      first_name: "Ana",
      last_name: "Reyes",
      full_name: "Ana Reyes",
      email: "ana@example.test",
      section: {
        id: 7,
        name: "Section B",
        year_level: { id: 2, name: "Grade 12" },
      },
      summary: {
        challenges_passed: 2,
        challenges_total: 5,
        submissions: 4,
        completion_percent: 40,
        last_active_at: "2026-09-01T00:00:00Z",
        standing: "progressing" as const,
        standing_label: "Progressing",
      },
    },
    challenges: [
      {
        id: 11,
        title: "Connect a PC to a switch",
        description: null,
        kind: "topology",
        attempts: 2,
        submissions: 1,
        passed: true,
        passed_at: "2026-09-01T00:00:00Z",
        last_attempt_at: "2026-09-01T00:00:00Z",
      },
    ],
  },
};

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.put).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("opening and closing a section", () => {
  it("closes a section through its own route", async () => {
    vi.mocked(api.post).mockResolvedValue(sectionPayload);

    const section = await deactivateSection(7);

    expect(api.post).toHaveBeenCalledWith("/admin/sections/7/deactivate", {});
    expect(section).toEqual({
      id: 7,
      name: "Section B",
      capacity: 40,
      isActive: false,
    });
  });

  it("reopens a section through its own route", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { ...sectionPayload.data, is_active: true },
    });

    const section = await activateSection(7);

    expect(api.post).toHaveBeenCalledWith("/admin/sections/7/activate", {});
    expect(section.isActive).toBe(true);
  });
});

describe("the cohort listing", () => {
  it("carries whether each section is open", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        {
          id: 2,
          code: "G12",
          name: "Grade 12",
          students_count: 3,
          sections: [
            {
              id: 7,
              name: "Section B",
              capacity: 40,
              students_count: 3,
              is_active: false,
            },
          ],
        },
      ],
    });

    const cohorts = await fetchCohorts();

    // A closed section is still listed — its roster is still someone's to read,
    // and it is the only place the decision can be taken back.
    expect(cohorts[0].sections[0]).toEqual({
      id: 7,
      name: "Section B",
      capacity: 40,
      studentsCount: 3,
      isActive: false,
    });
  });
});

describe("moving a student", () => {
  it("sends the section and nothing else", async () => {
    vi.mocked(api.put).mockResolvedValue(studentPayload);

    await moveStudentToSection(3, 7);

    expect(api.put).toHaveBeenCalledWith("/admin/students/3", {
      section_id: 7,
    });

    // The whole payload, not just its section: an instructor moving a student
    // must not be able to rewrite their name, email or student number by
    // accident.
    const [, body] = vi.mocked(api.put).mock.calls[0];
    expect(Object.keys(body as object)).toEqual(["section_id"]);
  });

  it("gives back the student as the server left them", async () => {
    vi.mocked(api.put).mockResolvedValue(studentPayload);

    const detail = await moveStudentToSection(3, 7);

    expect(detail.student.section).toEqual({
      id: 7,
      name: "Section B",
      yearLevel: "Grade 12",
    });
    // Their work comes back with them, so the page redraws from the answer
    // rather than assuming the move changed nothing else.
    expect(detail.challenges).toHaveLength(1);
    expect(detail.challenges[0].passed).toBe(true);
  });

  it("lets the server's refusal through", async () => {
    vi.mocked(api.put).mockRejectedValue(
      new Error("That section is not open for enrolment."),
    );

    await expect(moveStudentToSection(3, 7)).rejects.toThrow(
      "That section is not open for enrolment.",
    );
  });
});
