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

  it("offers the whole board for practice", () => {
    expect(practiceSetup().regions).toHaveLength(10);
  });
});
