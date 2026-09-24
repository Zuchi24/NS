import { describe, expect, it } from "vitest";

import { formatCountdown } from "./useQuestionCountdown";

describe("formatCountdown", () => {
  it("shows whole seconds as m:ss, rounding a part-second up", () => {
    expect(formatCountdown(30_000)).toBe("0:30");
    expect(formatCountdown(18_001)).toBe("0:19");
    expect(formatCountdown(5_000)).toBe("0:05");
    expect(formatCountdown(120_000)).toBe("2:00");
    expect(formatCountdown(90_000)).toBe("1:30");
  });

  it("never shows less than nothing", () => {
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(-500)).toBe("0:00");
  });
});
