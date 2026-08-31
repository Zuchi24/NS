import { describe, expect, it } from "vitest";

import { isPlaceable, paletteEndDevices } from "./devicePalette";
import { DEVICE_CATEGORIES } from "../data/deviceCategories";

/**
 * What a student may add to a workspace.
 *
 * Three end devices came off the palette. Two of them are still asked for by
 * challenges in the catalogue, so they come back for those and only those —
 * taking them away everywhere would leave "Share a printer on the LAN" and
 * "Put a server on the network" impossible to solve.
 */

const families = (requiredFamilies: string[] = []) =>
  paletteEndDevices(requiredFamilies).map((device) => device.family);

describe("the default palette", () => {
  it("does not offer a server", () => {
    expect(families()).not.toContain("server");
    expect(isPlaceable("server")).toBe(false);
  });

  it("does not offer a printer", () => {
    expect(families()).not.toContain("printer");
    expect(isPlaceable("printer")).toBe(false);
  });

  it("does not offer a smartphone", () => {
    expect(families()).not.toContain("smartphone");
    expect(isPlaceable("smartphone")).toBe(false);
  });

  it("still offers the end devices that were kept", () => {
    expect(families()).toEqual(["pc", "laptop"]);
    expect(isPlaceable("pc")).toBe(true);
    expect(isPlaceable("laptop")).toBe(true);
  });

  it("still offers every network device", () => {
    expect(isPlaceable("switch-2960")).toBe(true);
    expect(isPlaceable("switch-generic")).toBe(true);
    expect(isPlaceable("router-1941")).toBe(true);
    expect(isPlaceable("hub-generic")).toBe(true);
  });
});

describe("a challenge that needs a withdrawn device", () => {
  it("gets the printer back, and nothing else back with it", () => {
    // "Share a printer on the LAN": required_families is pc, printer, switch.
    expect(families(["pc", "printer", "switch"])).toEqual([
      "pc",
      "laptop",
      "printer",
    ]);

    expect(isPlaceable("printer", ["pc", "printer", "switch"])).toBe(true);
    expect(isPlaceable("server", ["pc", "printer", "switch"])).toBe(false);
  });

  it("gets the server back for the challenge that asks for one", () => {
    // "Put a server on the network": pc, router, server, switch.
    const needed = ["pc", "router", "server", "switch"];

    expect(families(needed)).toEqual(["pc", "laptop", "server"]);
    expect(isPlaceable("server", needed)).toBe(true);
    expect(isPlaceable("printer", needed)).toBe(false);
  });

  it("never brings the smartphone back, whatever is asked for", () => {
    // Nothing in the catalogue asks for one, so there is no way to request it.
    expect(families(["smartphone"])).not.toContain("smartphone");
    expect(isPlaceable("smartphone", ["smartphone"])).toBe(false);
  });
});

describe("the device library itself", () => {
  it("keeps every definition, so saved topologies still draw and grade", () => {
    // The palette decides what may be *added*. A printer a student placed
    // before still needs its icon, its label and its family.
    expect(DEVICE_CATEGORIES.endDevices.items.map((item) => item.family)).toEqual(
      ["pc", "laptop", "server", "printer", "smartphone"],
    );
  });
});
