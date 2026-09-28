import { describe, expect, it } from "vitest";

import {
  findPacketPath,
  packetPolyline,
  pointAtDistance,
  polylineLength,
} from "./packetPath";
import { getDevicePorts } from "./devicePorts";
import type { Connection, Device } from "../types";

/**
 * The route a message takes, read off the topology rather than assumed.
 *
 * Every fixture below is a real canvas: devices with coordinates, and cables
 * joined port to port the way the workspace joins them. The point of these is
 * that a packet goes *through* what is between two PCs — if a switch is in the
 * middle, the switch is on the route.
 *
 * Cable types are not decorative here. `isCableValid` follows the cable bench:
 * a straight-through joins an end device to a switch or hub, a cross-over joins
 * like to like (two end devices, or switches and hubs), and fibre joins two
 * switches. A router's uplink comes up (isLinkUp) but no packet crosses it:
 * routing is not implemented, and that is the existing limitation.
 */

function pc(id: string, x: number, y: number): Device {
  return { id, type: "pc", family: "pc", label: id, x, y };
}

function sw(id: string, x: number, y: number): Device {
  return { id, type: "switch-2960", family: "switch", label: id, x, y };
}

function hub(id: string, x: number, y: number): Device {
  return { id, type: "hub-generic", family: "hub", label: id, x, y };
}

function router(id: string, x: number, y: number): Device {
  return { id, type: "router-1941", family: "router", label: id, x, y };
}

/**
 * A cable between two devices, on their first free-looking ports — the same
 * port ids the canvas would record.
 */
function cable(
  id: string,
  from: Device,
  to: Device,
  cableType: Connection["cableType"],
  fromPortIndex = 0,
  toPortIndex = 0,
): Connection {
  return {
    id,
    from: from.id,
    to: to.id,
    fromPort: getDevicePorts(from)[fromPortIndex].id,
    toPort: getDevicePorts(to)[toPortIndex].id,
    cableType,
  };
}

describe("PC1 ── PC2, straight across", () => {
  const pc1 = pc("PC1", 0, 0);
  const pc2 = pc("PC2", 400, 0);
  // Two end devices need a cross-over; that is the existing cable rule.
  const link = cable("c1", pc1, pc2, "copper-crossover");

  it("routes directly between them", () => {
    const path = findPacketPath([pc1, pc2], [link], "PC1", "PC2");

    expect(path?.deviceIds).toEqual(["PC1", "PC2"]);
    expect(path?.hops).toHaveLength(1);
    expect(path?.hops[0].connectionId).toBe("c1");
  });

  it("routes the other way round too", () => {
    expect(
      findPacketPath([pc1, pc2], [link], "PC2", "PC1")?.deviceIds,
    ).toEqual(["PC2", "PC1"]);
  });

  it("refuses a cable the canvas already calls invalid", () => {
    // Straight-through between two PCs is wrong, and is drawn as wrong.
    const wrong = cable("c1", pc1, pc2, "copper-straight");

    expect(findPacketPath([pc1, pc2], [wrong], "PC1", "PC2")).toBeNull();
  });
});

describe("PC1 ── Switch ── PC2", () => {
  const pc1 = pc("PC1", 0, 0);
  const s1 = sw("Switch", 300, 0);
  const pc2 = pc("PC2", 600, 0);

  const wires = [
    cable("a", pc1, s1, "copper-straight", 0, 0),
    cable("b", s1, pc2, "copper-straight", 1, 0),
  ];

  it("goes through the switch rather than straight across", () => {
    const path = findPacketPath([pc1, s1, pc2], wires, "PC1", "PC2");

    expect(path?.deviceIds).toEqual(["PC1", "Switch", "PC2"]);
    expect(path?.hops.map((hop) => hop.connectionId)).toEqual(["a", "b"]);
  });

  it("crosses each cable in the direction it is travelling", () => {
    const path = findPacketPath([pc1, s1, pc2], wires, "PC1", "PC2");

    expect(path?.hops).toEqual([
      { connectionId: "a", fromDeviceId: "PC1", toDeviceId: "Switch" },
      { connectionId: "b", fromDeviceId: "Switch", toDeviceId: "PC2" },
    ]);
  });
});

describe("PC1 ── Switch1 ── Switch2 ── PC2", () => {
  const pc1 = pc("PC1", 0, 0);
  const s1 = sw("Switch1", 200, 0);
  const s2 = sw("Switch2", 400, 0);
  const pc2 = pc("PC2", 600, 0);

  const wires = [
    cable("a", pc1, s1, "copper-straight", 0, 0),
    // Switch to switch is like to like: a cross-over.
    cable("b", s1, s2, "copper-crossover", 1, 0),
    cable("c", s2, pc2, "copper-straight", 1, 0),
  ];

  it("follows every hop", () => {
    const path = findPacketPath([pc1, s1, s2, pc2], wires, "PC1", "PC2");

    expect(path?.deviceIds).toEqual(["PC1", "Switch1", "Switch2", "PC2"]);
    expect(path?.hops.map((hop) => hop.connectionId)).toEqual(["a", "b", "c"]);
  });

  it("does not cross a straight-through between the switches", () => {
    const straight = [wires[0], cable("b", s1, s2, "copper-straight", 1, 0), wires[2]];

    expect(findPacketPath([pc1, s1, s2, pc2], straight, "PC1", "PC2")).toBeNull();
  });
});

describe("PC1 ── Switch1 ══ fibre ══ Switch2 ── PC2", () => {
  const pc1 = pc("PC1", 0, 0);
  const s1 = sw("Switch1", 200, 0);
  const s2 = sw("Switch2", 400, 0);
  const pc2 = pc("PC2", 600, 0);

  const wires = [
    cable("a", pc1, s1, "copper-straight", 0, 0),
    cable("b", s1, s2, "fiber", 1, 0),
    cable("c", s2, pc2, "copper-straight", 1, 0),
  ];

  it("crosses the fibre between the buildings", () => {
    const path = findPacketPath([pc1, s1, s2, pc2], wires, "PC1", "PC2");

    expect(path?.deviceIds).toEqual(["PC1", "Switch1", "Switch2", "PC2"]);
    expect(path?.hops.map((hop) => hop.connectionId)).toEqual(["a", "b", "c"]);
  });

  it("crosses fibre only between switches: not from a PC", () => {
    const pcOnFibre = [cable("a", pc1, s1, "fiber", 0, 0), wires[1], wires[2]];

    expect(findPacketPath([pc1, s1, s2, pc2], pcOnFibre, "PC1", "PC2")).toBeNull();
  });

  it("crosses fibre only between switches: not to a hub", () => {
    const h = hub("Hub", 400, 0);
    const toHub = [wires[0], cable("b", s1, h, "fiber", 1, 0), cable("c", h, pc2, "copper-straight", 1, 0)];

    expect(findPacketPath([pc1, s1, h, pc2], toHub, "PC1", "PC2")).toBeNull();
  });
});

describe("a router, uplinked but not routing", () => {
  const pc1 = pc("PC1", 0, 0);
  const s1 = sw("Switch1", 200, 0);
  const r1 = router("Router", 400, 0);
  const s2 = sw("Switch2", 600, 0);
  const pc2 = pc("PC2", 800, 0);

  it("is not crossed between two switches, though both its uplinks are up", () => {
    const wires = [
      cable("a", pc1, s1, "copper-straight", 0, 0),
      cable("b", s1, r1, "copper-straight", 1, 0),
      cable("c", r1, s2, "copper-straight", 1, 0),
      cable("d", s2, pc2, "copper-straight", 1, 0),
    ];

    expect(findPacketPath([pc1, s1, r1, s2, pc2], wires, "PC1", "PC2")).toBeNull();
  });

  it("is not reached from a switch either", () => {
    const wires = [cable("a", pc1, s1, "copper-straight", 0, 0), cable("b", s1, r1, "copper-straight", 1, 0)];

    expect(findPacketPath([pc1, s1, r1], wires, "PC1", "Router")).toBeNull();
  });
});

describe("PC1 ── Hub ── PC2", () => {
  const pc1 = pc("PC1", 0, 0);
  const h1 = hub("Hub", 300, 0);
  const pc2 = pc("PC2", 600, 0);

  const wires = [
    cable("a", pc1, h1, "copper-straight", 0, 0),
    cable("b", h1, pc2, "copper-straight", 1, 0),
  ];

  it("goes through the hub, as it would a switch", () => {
    const path = findPacketPath([pc1, h1, pc2], wires, "PC1", "PC2");

    expect(path?.deviceIds).toEqual(["PC1", "Hub", "PC2"]);
    expect(path?.hops).toEqual([
      { connectionId: "a", fromDeviceId: "PC1", toDeviceId: "Hub" },
      { connectionId: "b", fromDeviceId: "Hub", toDeviceId: "PC2" },
    ]);
  });

  it("refuses a cross-over into the hub, as it would into a switch", () => {
    const crossed = [wires[0], cable("b", h1, pc2, "copper-crossover", 1, 0)];

    expect(findPacketPath([pc1, h1, pc2], crossed, "PC1", "PC2")).toBeNull();
  });
});

describe("a switch with several PCs hanging off it", () => {
  const pc1 = pc("PC1", 0, 200);
  const s1 = sw("Switch", 300, 200);
  const pc2 = pc("PC2", 600, 0);
  const pc3 = pc("PC3", 600, 200);
  const pc4 = pc("PC4", 600, 400);

  const devices = [pc1, s1, pc2, pc3, pc4];
  const wires = [
    cable("a", pc1, s1, "copper-straight", 0, 0),
    cable("b", s1, pc2, "copper-straight", 1, 0),
    cable("c", s1, pc3, "copper-straight", 2, 0),
    cable("d", s1, pc4, "copper-straight", 3, 0),
  ];

  it("reaches PC3 without visiting PC2 or PC4", () => {
    const path = findPacketPath(devices, wires, "PC1", "PC3");

    expect(path?.deviceIds).toEqual(["PC1", "Switch", "PC3"]);
    expect(path?.deviceIds).not.toContain("PC2");
    expect(path?.deviceIds).not.toContain("PC4");
  });

  it("reaches PC4 by its own cable", () => {
    const path = findPacketPath(devices, wires, "PC1", "PC4");

    expect(path?.deviceIds).toEqual(["PC1", "Switch", "PC4"]);
    expect(path?.hops.map((hop) => hop.connectionId)).toEqual(["a", "d"]);
  });

  it("takes the fewest hops when there is more than one way round", () => {
    const extra = [...wires, cable("e", pc3, pc4, "copper-crossover", 0, 0)];

    expect(findPacketPath(devices, extra, "PC1", "PC4")?.deviceIds).toEqual([
      "PC1",
      "Switch",
      "PC4",
    ]);
  });
});

describe("no route", () => {
  it("returns nothing for two PCs with no cable between them", () => {
    const pc1 = pc("PC1", 0, 0);
    const pc2 = pc("PC2", 400, 0);

    expect(findPacketPath([pc1, pc2], [], "PC1", "PC2")).toBeNull();
  });

  it("returns nothing across two halves of a split network", () => {
    const pc1 = pc("PC1", 0, 0);
    const s1 = sw("Switch1", 200, 0);
    const s2 = sw("Switch2", 400, 0);
    const pc2 = pc("PC2", 600, 0);

    // Both switches wired to their own PC, but never to each other.
    const wires = [
      cable("a", pc1, s1, "copper-straight", 0, 0),
      cable("c", s2, pc2, "copper-straight", 1, 0),
    ];

    expect(findPacketPath([pc1, s1, s2, pc2], wires, "PC1", "PC2")).toBeNull();
  });

  it("returns nothing for a device sending to itself", () => {
    const pc1 = pc("PC1", 0, 0);

    expect(findPacketPath([pc1], [], "PC1", "PC1")).toBeNull();
  });

  it("returns nothing for a device that is not on the canvas", () => {
    const pc1 = pc("PC1", 0, 0);

    expect(findPacketPath([pc1], [], "PC1", "ghost")).toBeNull();
  });
});

describe("where the packet is drawn", () => {
  const pc1 = pc("PC1", 0, 0);
  const s1 = sw("Switch", 300, 0);
  const pc2 = pc("PC2", 600, 0);

  const devices = [pc1, s1, pc2];
  const wires = [
    cable("a", pc1, s1, "copper-straight", 0, 0),
    cable("b", s1, pc2, "copper-straight", 1, 0),
  ];

  const path = findPacketPath(devices, wires, "PC1", "PC2")!;

  it("sits on the ports the cables are drawn between", () => {
    const points = packetPolyline(devices, wires, path);

    // Two hops, two ends each.
    expect(points).toHaveLength(4);

    const leaving = getDevicePorts(pc1)[0];
    const arriving = getDevicePorts(pc2)[0];

    expect(points[0]).toEqual({ x: leaving.x, y: leaving.y });
    expect(points[3]).toEqual({ x: arriving.x, y: arriving.y });
  });

  it("starts at the source and ends at the destination", () => {
    const points = packetPolyline(devices, wires, path);
    const total = polylineLength(points);

    expect(pointAtDistance(points, 0)).toEqual(points[0]);
    expect(pointAtDistance(points, total)).toEqual(points[points.length - 1]);
  });

  it("passes through the switch on the way", () => {
    const points = packetPolyline(devices, wires, path);
    const total = polylineLength(points);

    // Half way along the route is inside the switch, not out past it.
    const middle = pointAtDistance(points, total / 2)!;
    const switchPorts = getDevicePorts(s1);
    const near = Math.min(
      ...switchPorts.map((port) =>
        Math.hypot(port.x - middle.x, port.y - middle.y),
      ),
    );

    expect(near).toBeLessThan(40);
  });

  it("moves with the device when it is dragged", () => {
    const moved = devices.map((device) =>
      device.id === "Switch" ? { ...device, x: 300, y: 260 } : device,
    );

    const before = packetPolyline(devices, wires, path);
    const after = packetPolyline(moved, wires, path);

    // Same route, different geometry: the polyline is rebuilt from where the
    // devices are now, so nothing is left animating in mid-air.
    expect(after).not.toEqual(before);
    expect(after).toHaveLength(before.length);
    expect(polylineLength(after)).not.toBe(polylineLength(before));
  });

  it("gives nothing to draw when a cable has gone", () => {
    expect(packetPolyline(devices, [], path)).toEqual([]);
    expect(polylineLength([])).toBe(0);
    expect(pointAtDistance([], 10)).toBeNull();
  });
});
