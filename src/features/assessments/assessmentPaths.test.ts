import { describe, expect, it } from "vitest";

import {
  ARCHIVE_ADMIN_PATH,
  archiveAdminPath,
  archiveTypeOfSlug,
  archivedAssessmentBuilderPath,
  assessmentBuilderPath,
  builderReturnOf,
  readRoadmapContext,
  roadmapAdminPath,
} from "./assessmentPaths";

/**
 * The roadmap context that rides along to the assessment builder and back.
 *
 * Small, but both pages depend on reading exactly what the other wrote — and on
 * a hand-edited or stale address degrading to the plain page rather than to a
 * broken one.
 */

describe("building the addresses", () => {
  it("leaves the query off when there is no context", () => {
    expect(roadmapAdminPath()).toBe("/admin/roadmap");
    expect(assessmentBuilderPath(11)).toBe("/admin/roadmap/assessments/11");
    expect(
      assessmentBuilderPath(11, { roadmapId: null, topicId: null }),
    ).toBe("/admin/roadmap/assessments/11");
  });

  it("carries the roadmap and topic when given", () => {
    expect(roadmapAdminPath({ roadmapId: 3, topicId: 7 })).toBe(
      "/admin/roadmap?roadmap=3&topic=7",
    );
    expect(assessmentBuilderPath(11, { roadmapId: 3, topicId: 7 })).toBe(
      "/admin/roadmap/assessments/11?roadmap=3&topic=7",
    );
  });

  it("carries only the half it has", () => {
    expect(roadmapAdminPath({ roadmapId: 3 })).toBe("/admin/roadmap?roadmap=3");
  });
});

describe("reading the context back", () => {
  it("reads what the builder address carried", () => {
    expect(
      readRoadmapContext(new URLSearchParams("roadmap=3&topic=7")),
    ).toEqual({ roadmapId: 3, topicId: 7 });
  });

  it("round-trips through the address it built", () => {
    const path = assessmentBuilderPath(11, { roadmapId: 3, topicId: 7 });
    const query = path.slice(path.indexOf("?"));

    expect(roadmapAdminPath(readRoadmapContext(new URLSearchParams(query)))).toBe(
      "/admin/roadmap?roadmap=3&topic=7",
    );
  });

  it("ignores anything that is not a positive whole id", () => {
    for (const raw of ["", "abc", "0", "-1", "1.5", "3x", "1e3"]) {
      expect(
        readRoadmapContext(new URLSearchParams({ roadmap: raw, topic: raw })),
      ).toEqual({ roadmapId: null, topicId: null });
    }
  });

  it("has nothing to say about an address with no query", () => {
    expect(readRoadmapContext(new URLSearchParams())).toEqual({
      roadmapId: null,
      topicId: null,
    });
  });
});

describe("the archive addresses", () => {
  it("names the archive of each type, pre-tests by default", () => {
    expect(ARCHIVE_ADMIN_PATH).toBe("/admin/archive");
    expect(archiveAdminPath("pre_test")).toBe("/admin/archive/tests/pre-test");
    expect(archiveAdminPath("post_test")).toBe("/admin/archive/tests/post-test");
    expect(archiveAdminPath()).toBe("/admin/archive/tests/pre-test");
  });

  it("reads a type back out of its slug, and nothing else", () => {
    expect(archiveTypeOfSlug("pre-test")).toBe("pre_test");
    expect(archiveTypeOfSlug("post-test")).toBe("post_test");
    for (const slug of ["pre_test", "quiz", "", null, undefined]) {
      expect(archiveTypeOfSlug(slug)).toBeNull();
    }
  });

  it("opens the builder with the archive it came from", () => {
    expect(archivedAssessmentBuilderPath(13, "pre_test")).toBe(
      "/admin/roadmap/assessments/13?from=archive&type=pre-test",
    );
    expect(archivedAssessmentBuilderPath(14, "post_test")).toBe(
      "/admin/roadmap/assessments/14?from=archive&type=post-test",
    );
  });
});

describe("where the builder goes back to", () => {
  const back = (query: string) => builderReturnOf(new URLSearchParams(query));

  it("returns to the archive of the type it was opened from", () => {
    expect(back("from=archive&type=pre-test")).toEqual({
      path: "/admin/archive/tests/pre-test",
      label: "Back to archive",
    });
    expect(back("from=archive&type=post-test")).toEqual({
      path: "/admin/archive/tests/post-test",
      label: "Back to archive",
    });
  });

  it("round-trips through the address the archive built", () => {
    const address = archivedAssessmentBuilderPath(13, "post_test");

    expect(back(address.split("?")[1]).path).toBe("/admin/archive/tests/post-test");
  });

  it("returns to the roadmap it was opened from, as before", () => {
    expect(back("roadmap=3&topic=7")).toEqual({
      path: "/admin/roadmap?roadmap=3&topic=7",
      label: "Back to roadmap",
    });
    expect(back("")).toEqual({ path: "/admin/roadmap", label: "Back to roadmap" });
  });

  it("falls back to the roadmap on an archive context it cannot use", () => {
    for (const query of ["from=archive", "from=archive&type=quiz", "type=pre-test", "from=elsewhere&type=pre-test"]) {
      expect(back(query)).toEqual({ path: "/admin/roadmap", label: "Back to roadmap" });
    }
  });
});
