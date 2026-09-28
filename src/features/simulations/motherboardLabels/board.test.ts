import { describe, expect, it } from "vitest";

import svgText from "../../../../public/motherboards/atx-basic-v1.svg?raw";
import {
  ATX_BASIC_V1,
  LABEL_HEIGHT,
  LABEL_WIDTH,
  leaderStart,
  markedBeside,
  toPercent,
  type Box,
} from "./board";

/**
 * The board's geometry: that it matches the drawing, that the labels fit
 * around it without covering it or each other, and that a mark stays on its
 * part whatever size the board is drawn at.
 */

const regions = Object.values(ATX_BASIC_V1.regions);

/** The board itself, inside the drawing (see the drawing's own comment). */
const PCB: Box = { x: 300, y: 160, width: 600, height: 480 };

const labelBox = (id: string): Box => {
  const { labelAt } = ATX_BASIC_V1.regions[id];

  return { x: labelAt.x - LABEL_WIDTH / 2, y: labelAt.y - LABEL_HEIGHT / 2, width: LABEL_WIDTH, height: LABEL_HEIGHT };
};

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const contains = (outer: Box, x: number, y: number) =>
  x >= outer.x && x <= outer.x + outer.width && y >= outer.y && y <= outer.y + outer.height;

describe("the atx-basic-v1 board", () => {
  it("marks all sixteen parts, by opaque ids only", () => {
    expect(Object.keys(ATX_BASIC_V1.regions).sort()).toEqual(
      ["m1", "m10", "m11", "m12", "m13", "m14", "m15", "m16", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9"],
    );

    for (const region of regions) {
      expect(region.id).toMatch(/^m\d+$/);
    }
  });

  it("is the drawing it names: the same viewBox, and a group for every mark", () => {
    expect(svgText).toContain('viewBox="0 0 1200 800"');

    for (const region of regions) {
      expect(svgText).toContain(`<g id="${region.id}">`);
    }
  });

  it("keeps every anchor on its part, and every part in the cropped view", () => {
    for (const region of regions) {
      expect(contains(region.bounds, region.anchor.x, region.anchor.y), region.id).toBe(true);

      const { x, y, width, height } = region.bounds;
      expect(contains(ATX_BASIC_V1.crop, x, y) && contains(ATX_BASIC_V1.crop, x + width, y + height), region.id).toBe(true);
    }
  });

  it("puts every label box inside the drawing but off the board", () => {
    for (const region of regions) {
      const box = labelBox(region.id);

      expect(contains(ATX_BASIC_V1.viewBox, box.x, box.y), region.id).toBe(true);
      expect(contains(ATX_BASIC_V1.viewBox, box.x + box.width, box.y + box.height), region.id).toBe(true);
      expect(overlaps(box, PCB), region.id).toBe(false);
    }
  });

  it("never stacks one label box on another", () => {
    for (let i = 0; i < regions.length; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        expect(overlaps(labelBox(regions[i].id), labelBox(regions[j].id)), `${regions[i].id}/${regions[j].id}`).toBe(false);
      }
    }
  });

  it("staggers the two close marks on the left so their labels stay apart", () => {
    // m8 and m10 are 35 units apart on the board; their boxes are not allowed to be.
    const gap = Math.abs(ATX_BASIC_V1.regions.m10.labelAt.y - ATX_BASIC_V1.regions.m8.labelAt.y);

    expect(gap).toBeGreaterThanOrEqual(LABEL_HEIGHT + 20);
  });

  // The largest a marker is drawn: on the cropped board.
  const MARKER = 16;

  const circleMeetsBox = (c: { x: number; y: number }, r: number, box: Box) => {
    const nx = Math.min(Math.max(c.x, box.x), box.x + box.width);
    const ny = Math.min(Math.max(c.y, box.y), box.y + box.height);

    return Math.hypot(c.x - nx, c.y - ny) < r;
  };

  it("keeps every marker in the cropped view, and a marker set beside its part whole", () => {
    const { x, y, width, height } = ATX_BASIC_V1.crop;

    for (const region of regions) {
      const { x: mx, y: my } = region.marker;
      // m6 sits on the board's very edge, so its marker may be cut by the crop.
      const r = markedBeside(region) ? MARKER : 0;

      expect(mx - r >= x && mx + r <= x + width && my - r >= y && my + r <= y + height, region.id).toBe(true);
    }
  });

  it("sets a small part's marker beside it, where it covers no marked part", () => {
    const beside = regions.filter(markedBeside);

    expect(beside.map((region) => region.id)).toEqual(["m12", "m13", "m14", "m15", "m16"]);

    for (const region of beside) {
      for (const other of regions) {
        expect(circleMeetsBox(region.marker, MARKER, other.bounds), `${region.id} marker on ${other.id}`).toBe(false);
      }
    }
  });

  it.each([
    ["the ten larger parts", ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10"]],
    ["the six smaller parts", ["m11", "m12", "m13", "m14", "m15", "m16"]],
  ])("never stacks one marker on another among %s", (_set, ids) => {
    // The sets a board is marked in. A marker from one set may sit near a
    // part of the other, but the two are never marked at once.
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ATX_BASIC_V1.regions[ids[i]].marker;
        const b = ATX_BASIC_V1.regions[ids[j]].marker;

        expect(Math.hypot(a.x - b.x, a.y - b.y), `${ids[i]}/${ids[j]}`).toBeGreaterThanOrEqual(MARKER * 2);
      }
    }
  });

  it("starts each leader line on the side of its box that faces the board", () => {
    for (const region of regions) {
      const start = leaderStart(region);
      const box = labelBox(region.id);

      expect(contains(box, start.x, start.y), region.id).toBe(true);
    }
  });
});

describe("a point on the drawing, at any size", () => {
  it("lands on the same part whatever width the board is drawn", () => {
    for (const frame of [ATX_BASIC_V1.viewBox, ATX_BASIC_V1.crop]) {
      for (const region of regions) {
        const at = toPercent(region.anchor, frame);

        for (const width of [1200, 900, 700, 500]) {
          const height = (width * frame.height) / frame.width;
          const px = { x: (at.left / 100) * width, y: (at.top / 100) * height };

          // Back into the drawing's units: the anchor it started as.
          expect(frame.x + (px.x / width) * frame.width).toBeCloseTo(region.anchor.x, 6);
          expect(frame.y + (px.y / height) * frame.height).toBeCloseTo(region.anchor.y, 6);
        }
      }
    }
  });

  it("is a percentage of its frame, not a pixel", () => {
    expect(toPercent({ x: 600, y: 400 }, ATX_BASIC_V1.viewBox)).toEqual({ left: 50, top: 50 });
    expect(toPercent({ x: 276, y: 150 }, ATX_BASIC_V1.crop)).toEqual({ left: 0, top: 0 });
  });
});

describe("what a student can read about a part", () => {
  // Every word that names, or all but names, one of the board's parts. A
  // description may say how a part looks and where; it may not say what it is.
  const NAMES = [
    "socket", "slot", "port", "battery", "connector", "power", "heatsink", "heat sink", "chipset",
    "cpu", "processor", "ram", "dimm", "memory", "pcie", "pci", "express", "sata", "cmos", "bios",
    "rtc", "cr2032", "coin", "cell", "m.2", "nvme", "ssd", "i/o", "io ", "rear", "back panel", "panel",
    "atx", "24", "8-pin", "pin", "lga", "usb", "ethernet", "audio", "graphics",
    // The smaller parts.
    "vrm", "regulator", "voltage", "uefi", "firmware", "flash", "rom", "chip", "codec", "sound",
    "lan", "network", "nic", "controller", "header", "fan", "front", "cooler",
  ];

  // Whole words only: "frame" is not "ram".
  const named = (text: string, name: string) =>
    new RegExp(`(^|[^a-z0-9])${name.trim().replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}s?($|[^a-z0-9])`).test(text);

  it.each(regions.map((region) => [region.id, region.description]))("never names %s", (_id, description) => {
    const text = description.toLowerCase();

    for (const name of NAMES) {
      expect(named(text, name), `"${name}" in: ${description}`).toBe(false);
    }
  });

  it("would catch a description that did name its part", () => {
    expect(named("a square cpu socket", "socket")).toBe(true);
    expect(named("four ram slots", "slot")).toBe(true);
    expect(named("the rear i/o shroud", "i/o")).toBe(true);
    expect(named("a silver frame", "ram")).toBe(false);
  });
});
