import { describe, expect, it } from "vitest";

import { evaluateDelivery } from "./deliverability";
import { consoleTargets, isConsoleLink } from "./networkValidation";
import { getDevicePorts } from "./devicePorts";
import type { Connection, Device } from "../types";

/**
 * Whether a message can actually be delivered, and why not when it cannot.
 *
 * These are built as real canvases — devices with coordinates, cables joined
 * port to port — because the answer is supposed to come from the topology and
 * the addressing, not from what anything is called. The switches below are
 * deliberately left unconfigured: a switch forwards frames without ever being
 * given an address, and any test that needed to configure one would be
 * describing the wrong network.
 */

function host(
  id: string,
  ip?: string,
  mask = "255.255.255.0",
  gateway?: string,
): Device {
  return {
    id,
    type: "pc",
    family: "pc",
    label: id,
    x: 0,
    y: 0,
    config: ip ? { ipAddress: ip, subnetMask: mask, gateway } : {},
  };
}

function laptop(id: string, ip: string, mask = "255.255.255.0"): Device {
  return {
    id,
    type: "laptop",
    family: "laptop",
    label: id,
    x: 0,
    y: 0,
    config: { ipAddress: ip, subnetMask: mask },
  };
}

/** A switch with nothing configured on it at all — the normal case. */
function unmanagedSwitch(id: string): Device {
  return { id, type: "switch-2960", family: "switch", label: id, x: 200, y: 200 };
}

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

describe("an unconfigured switch still forwards traffic", () => {
  const pc1 = host("PC1", "192.168.1.10");
  const pc2 = host("PC2", "192.168.1.20");
  const sw = unmanagedSwitch("Switch");

  const devices = [pc1, sw, pc2];
  const wires = [
    cable("a", pc1, sw, "copper-straight", 0, 0),
    cable("b", sw, pc2, "copper-straight", 1, 0),
  ];

  it("delivers PC1 to PC2 with no management IP on the switch", () => {
    // The switch has no config object at all. That is a working switch.
    expect(sw.config).toBeUndefined();

    const result = evaluateDelivery(devices, wires, "PC1", "PC2");

    expect(result.ok).toBe(true);
    expect(result.ok && result.path.deviceIds).toEqual([
      "PC1",
      "Switch",
      "PC2",
    ]);
  });

  it("is not affected by giving the switch a management address either", () => {
    const managed = {
      ...sw,
      config: { ipAddress: "192.168.1.2", subnetMask: "255.255.255.0" },
    };

    const result = evaluateDelivery(
      [pc1, managed, pc2],
      wires,
      "PC1",
      "PC2",
    );

    expect(result.ok).toBe(true);
  });

  it("does not ask the switch for an address when deciding", () => {
    // A management address on a *different* network from the hosts must not
    // make the hosts unable to talk to each other.
    const oddlyManaged = {
      ...sw,
      config: { ipAddress: "10.9.9.9", subnetMask: "255.0.0.0" },
    };

    expect(
      evaluateDelivery([pc1, oddlyManaged, pc2], wires, "PC1", "PC2").ok,
    ).toBe(true);
  });
});

describe("two hosts on one cable", () => {
  const pc1 = host("PC1", "192.168.1.10");
  const pc2 = host("PC2", "192.168.1.20");
  const wires = [cable("a", pc1, pc2, "copper-crossover")];

  it("delivers when they share a network", () => {
    expect(evaluateDelivery([pc1, pc2], wires, "PC1", "PC2").ok).toBe(true);
  });
});

describe("more than one switch", () => {
  const pc1 = host("PC1", "192.168.1.10");
  const pc2 = host("PC2", "192.168.1.20");
  const s1 = unmanagedSwitch("Switch1");
  const s2 = { ...unmanagedSwitch("Switch2"), x: 400 };

  const devices = [pc1, s1, s2, pc2];
  const wires = [
    cable("a", pc1, s1, "copper-straight", 0, 0),
    cable("b", s1, s2, "copper-straight", 1, 0),
    cable("c", s2, pc2, "copper-straight", 1, 0),
  ];

  it("delivers across both, neither of them configured", () => {
    const result = evaluateDelivery(devices, wires, "PC1", "PC2");

    expect(result.ok).toBe(true);
    expect(result.ok && result.path.deviceIds).toEqual([
      "PC1",
      "Switch1",
      "Switch2",
      "PC2",
    ]);
  });
});

describe("it works on whatever the devices happen to be", () => {
  it("delivers from a laptop to a PC through a switch", () => {
    const laptopA = laptop("Laptop_A", "10.0.0.5", "255.0.0.0");
    const pcB = host("PC_B", "10.0.0.6", "255.0.0.0");
    const sw = unmanagedSwitch("Switch_A");

    const wires = [
      cable("a", laptopA, sw, "copper-straight", 0, 0),
      cable("b", sw, pcB, "copper-straight", 1, 0),
    ];

    const result = evaluateDelivery(
      [laptopA, sw, pcB],
      wires,
      "Laptop_A",
      "PC_B",
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.path.deviceIds).toEqual([
      "Laptop_A",
      "Switch_A",
      "PC_B",
    ]);
  });
});

describe("different networks", () => {
  const pc1 = host("PC1", "192.168.1.10");
  const pc2 = host("PC2", "192.168.2.20");
  const sw = unmanagedSwitch("Switch");

  const wires = [
    cable("a", pc1, sw, "copper-straight", 0, 0),
    cable("b", sw, pc2, "copper-straight", 1, 0),
  ];

  it("fails, because a switch cannot route between them", () => {
    const result = evaluateDelivery([pc1, sw, pc2], wires, "PC1", "PC2");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe("different-subnet");
    expect(!result.ok && result.message).toContain("no router is available");
  });

  it("still fails when the hosts name a gateway, since there is no router", () => {
    // A gateway is a instruction about where to send off-network traffic. It
    // does not conjure the router that would have to act on it.
    const withGateway1 = host("PC1", "192.168.1.10", "255.255.255.0", "192.168.1.1");
    const withGateway2 = host("PC2", "192.168.2.20", "255.255.255.0", "192.168.2.1");

    const result = evaluateDelivery(
      [withGateway1, sw, withGateway2],
      wires,
      "PC1",
      "PC2",
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe("different-subnet");
  });
});

describe("a console lead", () => {
  const pc1 = host("PC1", "192.168.1.10");
  const sw = unmanagedSwitch("Switch");
  const pc2 = host("PC2", "192.168.1.20");

  const consoleOnly = [cable("c", pc1, sw, "console")];

  it("is recognised between a host and a switch", () => {
    expect(isConsoleLink(consoleOnly[0], pc1, sw)).toBe(true);
  });

  it("is not a console link between two hosts", () => {
    const wrong = cable("c", pc1, pc2, "console");

    expect(isConsoleLink(wrong, pc1, pc2)).toBe(false);
  });

  it("names the switches a PC can configure through it", () => {
    expect(
      consoleTargets(pc1, [pc1, sw], consoleOnly).map((d) => d.id),
    ).toEqual(["Switch"]);
  });

  it("gives a PC with no console lead nothing to configure", () => {
    const ethernet = [cable("a", pc1, sw, "copper-straight")];

    expect(consoleTargets(pc1, [pc1, sw], ethernet)).toEqual([]);
  });

  it("cannot carry a packet to the switch it is plugged into", () => {
    const result = evaluateDelivery([pc1, sw], consoleOnly, "PC1", "Switch");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe("console-only");
    expect(!result.ok && result.message).toContain("not network traffic");
  });

  it("does not join two PCs that are otherwise unconnected", () => {
    // PC1 consoles into the switch; PC2 is wired to it properly. The console
    // lead must not complete the circuit.
    const mixed = [
      cable("c", pc1, sw, "console"),
      cable("b", sw, pc2, "copper-straight", 1, 0),
    ];

    const result = evaluateDelivery([pc1, sw, pc2], mixed, "PC1", "PC2");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe("no-path");
  });

  it("is not in the route even when an Ethernet run exists beside it", () => {
    const both = [
      cable("c", pc1, sw, "console", 0, 5),
      cable("a", pc1, sw, "copper-straight", 0, 0),
      cable("b", sw, pc2, "copper-straight", 1, 0),
    ];

    const result = evaluateDelivery([pc1, sw, pc2], both, "PC1", "PC2");

    expect(result.ok).toBe(true);
    expect(result.ok && result.path.hops.map((hop) => hop.connectionId)).toEqual(
      ["a", "b"],
    );
  });
});

describe("addressing that is missing or clashing", () => {
  const sw = unmanagedSwitch("Switch");

  const wired = (a: Device, b: Device) => [
    cable("a", a, sw, "copper-straight", 0, 0),
    cable("b", sw, b, "copper-straight", 1, 0),
  ];

  it("refuses to send from a host with no address", () => {
    const blank = host("PC1");
    const pc2 = host("PC2", "192.168.1.20");

    const result = evaluateDelivery([blank, sw, pc2], wired(blank, pc2), "PC1", "PC2");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe("no-source-config");
    expect(!result.ok && result.message).toContain("PC1");
  });

  it("refuses to send to a host with no address", () => {
    const pc1 = host("PC1", "192.168.1.10");
    const blank = host("PC2");

    const result = evaluateDelivery([pc1, sw, blank], wired(pc1, blank), "PC1", "PC2");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe("no-destination-config");
    expect(!result.ok && result.message).toContain("PC2");
  });

  it("refuses a host with an address but no mask", () => {
    const halfDone: Device = {
      ...host("PC1"),
      config: { ipAddress: "192.168.1.10" },
    };
    const pc2 = host("PC2", "192.168.1.20");

    expect(
      evaluateDelivery([halfDone, sw, pc2], wired(halfDone, pc2), "PC1", "PC2").ok,
    ).toBe(false);
  });

  it("refuses two hosts claiming the same address", () => {
    const pc1 = host("PC1", "192.168.1.10");
    const clash = host("PC2", "192.168.1.10");

    const result = evaluateDelivery([pc1, sw, clash], wired(pc1, clash), "PC1", "PC2");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe("duplicate-ip");
  });
});

describe("nothing wired at all", () => {
  it("fails with no path", () => {
    const pc1 = host("PC1", "192.168.1.10");
    const pc2 = host("PC2", "192.168.1.20");

    const result = evaluateDelivery([pc1, pc2], [], "PC1", "PC2");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe("no-path");
  });

  it("reports a missing address before a missing cable", () => {
    // The likelier oversight, and the one the student can act on.
    const blank = host("PC1");
    const pc2 = host("PC2", "192.168.1.20");

    const result = evaluateDelivery([blank, pc2], [], "PC1", "PC2");

    expect(!result.ok && result.reason).toBe("no-source-config");
  });

  it("refuses a device sending to itself", () => {
    const pc1 = host("PC1", "192.168.1.10");

    expect(
      !evaluateDelivery([pc1], [], "PC1", "PC1").ok &&
        evaluateDelivery([pc1], [], "PC1", "PC1"),
    ).toMatchObject({ reason: "same-device" });
  });
});
