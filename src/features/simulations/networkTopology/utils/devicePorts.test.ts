import { describe, expect, it } from "vitest";

import { getDevicePorts } from "./devicePorts";
import type { Device } from "../types";

/**
 * Where a switch's ports are drawn. Layout is not measured in jsdom, so this
 * pins the offsets that put them in the card's port strip — below the drawing
 * (10px of border and padding, a 64px icon) and the name under it (to 94px),
 * inside the 32px strip that follows (98 to 130px) — rather than over it.
 */

const at = { x: 200, y: 150 };
const aSwitch = { id: "S1", type: "switch-2960", x: at.x, y: at.y } as Device;

const DOT = 12;
const STRIP_TOP = 98;
const STRIP_BOTTOM = 130;

describe("a switch's ports", () => {
  const ports = getDevicePorts(aSwitch);

  it("are Fa0/1 to Fa0/6, in order", () => {
    expect(ports.map((port) => port.label)).toEqual(["Fa0/1", "Fa0/2", "Fa0/3", "Fa0/4", "Fa0/5", "Fa0/6"]);
    expect(ports.map((port) => port.id)).toEqual(["S1-fa0/1", "S1-fa0/2", "S1-fa0/3", "S1-fa0/4", "S1-fa0/5", "S1-fa0/6"]);
  });

  it("sit in the strip under the switch, never over its drawing", () => {
    for (const port of ports) {
      expect(port.y - at.y).toBeGreaterThanOrEqual(STRIP_TOP);
      expect(port.y - at.y + DOT).toBeLessThanOrEqual(STRIP_BOTTOM);
    }
  });

  it("are two rows of three that do not touch", () => {
    const rows = new Set(ports.map((port) => port.y));
    const columns = new Set(ports.map((port) => port.x));

    expect(rows.size).toBe(2);
    expect(columns.size).toBe(3);

    const xs = [...columns].sort((a, b) => a - b);
    const ys = [...rows].sort((a, b) => a - b);
    expect(xs[1] - xs[0]).toBeGreaterThan(DOT);
    expect(ys[1] - ys[0]).toBeGreaterThan(DOT);
  });

  it("move with the switch", () => {
    const moved = getDevicePorts({ ...aSwitch, x: at.x + 50, y: at.y - 30 });

    moved.forEach((port, i) => {
      expect(port.x - ports[i].x).toBe(50);
      expect(port.y - ports[i].y).toBe(-30);
    });
  });
});
