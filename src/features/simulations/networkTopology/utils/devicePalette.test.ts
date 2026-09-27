import { describe, expect, it } from "vitest";

import { isPlaceable, paletteEndDevices } from "./devicePalette";
import { DEVICE_CATEGORIES } from "../data/deviceCategories";

/**
 * What a student may add to a workspace: every end device and every network
 * device, whether or not a challenge is open.
 */

const families = () => paletteEndDevices().map((device) => device.family);

describe("the palette", () => {
  it("offers every end device, in the library's order", () => {
    expect(families()).toEqual(["pc", "laptop", "server", "printer", "smartphone"]);
  });

  it.each(["pc", "laptop", "server", "printer", "smartphone"])("lets a student place a %s", (type) => {
    expect(isPlaceable(type)).toBe(true);
  });

  it("offers every network device", () => {
    expect(isPlaceable("switch-2960")).toBe(true);
    expect(isPlaceable("switch-generic")).toBe(true);
    expect(isPlaceable("router-1941")).toBe(true);
    expect(isPlaceable("hub-generic")).toBe(true);
  });

  it("offers nothing the library does not define", () => {
    expect(isPlaceable("tablet")).toBe(false);
    expect(isPlaceable("")).toBe(false);
  });
});

describe("the device library itself", () => {
  it("keeps every definition, so saved topologies still draw and grade", () => {
    expect(DEVICE_CATEGORIES.endDevices.items.map((item) => item.family)).toEqual(
      ["pc", "laptop", "server", "printer", "smartphone"],
    );
  });
});
