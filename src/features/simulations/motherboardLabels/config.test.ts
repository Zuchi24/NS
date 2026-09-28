import { describe, expect, it } from "vitest";

import { parseMotherboardLabelsConfig, practiceSetup } from "./config";

/**
 * Reading what the server sends a labeling challenge. The page draws only a
 * config it can honestly draw: a known board and marks that board has.
 */

describe("a motherboard labeling config", () => {
  it("numbers the marks in the order the challenge lists them", () => {
    const setup = parseMotherboardLabelsConfig({
      board: "atx-basic-v1",
      labels: [{ id: "m3" }, { id: "m1" }, { id: "m8" }],
    });

    // Marker 1 is m3, not m1: the challenge decides, not the ids.
    expect(setup?.board.id).toBe("atx-basic-v1");
    expect(setup?.regions.map((region) => region.id)).toEqual(["m3", "m1", "m8"]);
  });

  it.each([
    ["nothing", null],
    ["text", "atx-basic-v1"],
    ["no board", { labels: [{ id: "m3" }] }],
    ["a board the page does not have", { board: "atx-deluxe-v9", labels: [{ id: "m3" }] }],
    ["no marks", { board: "atx-basic-v1", labels: [] }],
    ["marks that are not a list", { board: "atx-basic-v1", labels: { m3: {} } }],
    ["a mark the board does not have", { board: "atx-basic-v1", labels: [{ id: "m3" }, { id: "m42" }] }],
    ["a mark with no id", { board: "atx-basic-v1", labels: [{ id: "m3" }, {}] }],
    ["the same mark twice", { board: "atx-basic-v1", labels: [{ id: "m3" }, { id: "m3" }] }],
  ])("refuses %s", (_what, config) => {
    expect(parseMotherboardLabelsConfig(config)).toBeNull();
  });

  it("is typed on, with no chips, when the config does not say otherwise", () => {
    const setup = parseMotherboardLabelsConfig({ board: "atx-basic-v1", labels: [{ id: "m3" }] });

    expect(setup?.mode).toBe("type");
    expect(setup?.choices).toEqual([]);
  });

  it("ignores chips sent to a board that is typed on", () => {
    const setup = parseMotherboardLabelsConfig({
      board: "atx-basic-v1",
      mode: "type",
      labels: [{ id: "m3" }],
      choices: ["CPU socket"],
    });

    expect(setup?.choices).toEqual([]);
  });

  it("offers the ten larger parts for practice, typed on", () => {
    const setup = practiceSetup();

    expect(setup.regions.map((region) => region.id)).toEqual(["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10"]);
    expect(setup.mode).toBe("type");
    expect(setup.choices).toEqual([]);
  });
});

describe("a drag board's config", () => {
  const drag = (extra: Record<string, unknown>) => ({
    board: "atx-basic-v1",
    mode: "drag",
    labels: [{ id: "m3" }, { id: "m1" }],
    ...extra,
  });

  it("keeps its chips in the order the server sent them", () => {
    const setup = parseMotherboardLabelsConfig(drag({ choices: ["Chipset", "CPU socket", "RAM slots"] }));

    expect(setup?.mode).toBe("drag");
    expect(setup?.choices).toEqual(["Chipset", "CPU socket", "RAM slots"]);
    expect(setup?.regions.map((region) => region.id)).toEqual(["m3", "m1"]);
  });

  it("marks the smaller parts too", () => {
    const setup = parseMotherboardLabelsConfig({
      board: "atx-basic-v1",
      mode: "drag",
      labels: ["m11", "m12", "m13", "m14", "m15", "m16"].map((id) => ({ id })),
      choices: ["a", "b", "c", "d", "e", "f"],
    });

    expect(setup?.regions).toHaveLength(6);
  });

  it.each([
    ["a mode it does not know", { mode: "pick" }],
    ["no chips", { choices: undefined }],
    ["chips that are not a list", { choices: "CPU socket" }],
    ["fewer chips than marks", { choices: ["CPU socket"] }],
    ["a chip that is not text", { choices: ["CPU socket", 42] }],
    ["a blank chip", { choices: ["CPU socket", "  "] }],
    ["the same chip twice", { choices: ["CPU socket", "CPU socket", "RAM slots"] }],
    ["a chip too long to send", { choices: ["CPU socket", "x".repeat(65)] }],
  ])("refuses %s", (_what, extra) => {
    expect(parseMotherboardLabelsConfig(drag({ choices: ["CPU socket", "RAM slots"], ...extra }))).toBeNull();
  });
});
