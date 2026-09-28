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

/**
 * Where a hub's ports are drawn: one under each of its three lights, in the
 * gap between its body and its name. The hub's body is a 56 x 24 box centred
 * in the 64px icon (14 to 70 across, 30 to 54 down); its lights, 6px wide,
 * are centred at 27, 42 and 57 across, 39 to 45 down; its name starts at 78.
 */

const aHub = { id: "H1", type: "hub-generic", x: at.x, y: at.y } as Device;

const HUB_BODY_BOTTOM = 54;
const HUB_NAME_TOP = 78;
const HUB_LIGHT_CENTRES = [27, 42, 57];
const CARD_WIDTH = 84;

describe("a hub's ports", () => {
  const ports = getDevicePorts(aHub);

  it("are Port1 to Port3, in order", () => {
    expect(ports.map((port) => port.label)).toEqual(["Port1", "Port2", "Port3"]);
    expect(ports.map((port) => port.id)).toEqual(["H1-port1", "H1-port2", "H1-port3"]);
  });

  it("sit under the hub's body, never over its lights, and above its name", () => {
    for (const port of ports) {
      expect(port.y - at.y).toBeGreaterThan(HUB_BODY_BOTTOM);
      expect(port.y - at.y + DOT).toBeLessThan(HUB_NAME_TOP);
    }
  });

  it("each sit straight under their own light, left to right", () => {
    expect(ports.map((port) => port.x - at.x + DOT / 2)).toEqual(HUB_LIGHT_CENTRES);
  });

  it("are one row that does not touch, inside the card", () => {
    expect(new Set(ports.map((port) => port.y)).size).toBe(1);

    for (let i = 1; i < ports.length; i++) {
      expect(ports[i].x - ports[i - 1].x).toBeGreaterThan(DOT);
    }

    for (const port of ports) {
      expect(port.x - at.x).toBeGreaterThanOrEqual(0);
      expect(port.x - at.x + DOT).toBeLessThanOrEqual(CARD_WIDTH);
    }
  });

  it("move with the hub", () => {
    const moved = getDevicePorts({ ...aHub, x: at.x + 50, y: at.y - 30 });

    moved.forEach((port, i) => {
      expect(port.x - ports[i].x).toBe(50);
      expect(port.y - ports[i].y).toBe(-30);
    });
  });
});
