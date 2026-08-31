import { describe, expect, it } from "vitest";

import { clampToCanvas, snapToGrid } from "./networkValidation";
import { DEVICE_GRAB_OFFSET, DEVICE_SIZE, GRID_SIZE } from "./constants";

/**
 * Where a dropped device lands.
 *
 * The canvas clips whatever falls outside it, so a device placed at a negative
 * coordinate — which is what dropping on the very edge used to produce, the
 * cursor offset pulling it back past the boundary — was added to the topology
 * but never seen. These are the two pure steps that decide the position.
 */

/** The drop handler's own maths, so the test exercises what ships. */
function placeAt(cursor: number, canvasEdge: number, canvasExtent: number) {
  return clampToCanvas(
    snapToGrid(cursor - canvasEdge - DEVICE_GRAB_OFFSET),
    canvasExtent,
  );
}

describe("snapToGrid", () => {
  it("rounds to the nearest grid step", () => {
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(GRID_SIZE - 1)).toBe(GRID_SIZE);
    expect(snapToGrid(GRID_SIZE / 2 - 1)).toBe(0);
  });
});

describe("clampToCanvas", () => {
  it("keeps a device inside the canvas", () => {
    expect(clampToCanvas(-40, 1000)).toBe(0);
    expect(clampToCanvas(500, 1000)).toBe(500);
    expect(clampToCanvas(9999, 1000)).toBe(1000 - DEVICE_SIZE);
  });

  it("does not go negative on a canvas smaller than a device", () => {
    expect(clampToCanvas(30, DEVICE_SIZE / 2)).toBe(0);
  });
});

describe("dropping a device", () => {
  it("places it under the cursor", () => {
    // Canvas starts at x=256; cursor at 656 is 400px in.
    expect(placeAt(656, 256, 1000)).toBe(400 - DEVICE_GRAB_OFFSET);
  });

  it("keeps a device dropped on the near edge on the canvas", () => {
    expect(placeAt(258, 256, 1000)).toBe(0);
  });

  it("keeps a device dropped on the far edge on the canvas", () => {
    expect(placeAt(256 + 1000, 256, 1000)).toBe(1000 - DEVICE_SIZE);
  });
});
