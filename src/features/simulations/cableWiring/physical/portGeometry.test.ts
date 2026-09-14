import { describe, expect, it } from "vitest";

import { END_IDS, PAIR_IDS, S1_PRACTICE, apply, createInitialState, makeEnd } from "../model";
import type { Action, CableState, EndId, EndpointId, Scenario } from "../model";
import type { PhysicalEndpoint } from "../integration/publicConfig";
import { CY, SHELF_TOP, WIDTH, benchScale } from "./benchGeometry";
import { conductorUnder } from "./conductorGeometry";
import { pairUnder } from "./pairGeometry";
import { fittedPlugUnder, plugFrontXAt } from "./plugGeometry";
import {
  LEAD_GAP,
  PORT_GAP,
  PORT_HEIGHT,
  PORT_REACH,
  PORT_TOP,
  PORT_WIDTH,
  SEATED_HEIGHT,
  SEATED_MARGIN,
  SEATED_WIDTH,
  UNPLUG_PULL,
  leadHandle,
  leadUnder,
  portSlots,
  portUnder,
  seatedPlugBox,
  seatedPlugUnder,
  unplugPulled,
} from "./portGeometry";

/**
 * The ports on the bench, a plug's lead, and a plug seated in a port.
 *
 * Checked against the scenario's endpoints and the model's own connections,
 * and against everything else a hand can take hold of on the cable: nothing
 * here may share a point with those. Nothing here knows whether a plug can go
 * into a port, or which port a challenge wants.
 */

const raw = () => makeEnd({ jacketEdgeMm: 0, tipMm: 0 });
const OPEN: Scenario = { ...S1_PRACTICE, initialEnds: { A: raw(), B: raw() } };

/** S5's four ports, as its public config names them. */
const S5_ENDPOINTS: PhysicalEndpoint[] = [
  { id: "tester-main", kind: "tester-main" },
  { id: "tester-remote", kind: "tester-remote" },
  { id: "pc-1:eth0", kind: "mdi", label: "PC-1" },
  { id: "pc-2:eth0", kind: "mdi", label: "PC-2" },
];

function chain(actions: Action[], scenario: Scenario = OPEN): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, scenario);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, createInitialState(scenario));
}

const stripped = (end: EndId): Action[] => [{ type: "strip", end, amountMm: 30, slot: "correct" }];
const plugged = (end: EndId, pushMm = 10): Action[] => [
  ...stripped(end),
  ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end, pair })),
  { type: "trim", end, leaveMm: 12 },
  { type: "insert", end, orientation: "contacts-up", pushMm },
];

describe("the ports on the bench", () => {
  it("gives every endpoint a port, one for one, in the scenario's own order", () => {
    expect(portSlots(S1_PRACTICE.endpoints).map((slot) => slot.endpoint)).toEqual(["tester-main", "tester-remote"]);
    expect(portSlots(S5_ENDPOINTS).map((slot) => slot.endpoint)).toEqual(S5_ENDPOINTS.map((endpoint) => endpoint.id));
    expect(portSlots([{ id: "only" }])).toHaveLength(1);
    expect(portSlots([])).toEqual([]);
  });

  it("lays them in one row along the top of the mat, centred, each clear of the next", () => {
    for (const endpoints of [S1_PRACTICE.endpoints, S5_ENDPOINTS]) {
      const slots = portSlots(endpoints);

      for (const [index, slot] of slots.entries()) {
        expect(slot.y).toBe(PORT_TOP);
        expect(slot.width).toBe(PORT_WIDTH);
        expect(slot.height).toBe(PORT_HEIGHT);
        expect(slot.x).toBeGreaterThan(0);
        expect(slot.x + slot.width).toBeLessThan(WIDTH);
        expect(slot.mouthX).toBe(slot.x + slot.width / 2);
        expect(slot.mouthY).toBe(slot.y + slot.height);
        if (index > 0) expect(slot.x).toBe(slots[index - 1].x + PORT_WIDTH + PORT_GAP);
      }

      expect((slots[0].x + slots[slots.length - 1].x + PORT_WIDTH) / 2).toBeCloseTo(WIDTH / 2, 9);
    }
  });

  it("keeps the ports and their reach clear of everything a hand can take hold of on the cable", () => {
    // Pairs out of the jacket on both ends, and plugs on both ends with their grips and leads.
    const cables = [chain([...stripped("A"), ...stripped("B")]), chain([...plugged("A", -11), ...plugged("B", 9)])];
    let swept = 0;

    for (const cable of cables) {
      const scale = benchScale(cable).scale;

      for (const slot of portSlots(S5_ENDPOINTS)) {
        for (let x = slot.x; x <= slot.x + slot.width; x += 2) {
          for (let y = slot.y; y <= slot.mouthY + PORT_REACH; y += 1) {
            swept++;
            expect(pairUnder(x, y, cable, scale), `pair at ${x}, ${y}`).toBeNull();
            expect(conductorUnder(x, y, cable, scale), `conductor at ${x}, ${y}`).toBeNull();
            expect(fittedPlugUnder(x, y, cable, scale), `plug grip at ${x}, ${y}`).toBeNull();
            expect(leadUnder(x, y, cable, scale), `lead at ${x}, ${y}`).toBeNull();
          }
        }
      }
    }

    expect(swept).toBeGreaterThan(0);
  });

  it("seats a plug square in its port's mouth, hanging down inside the port's reach", () => {
    for (const slot of portSlots(S5_ENDPOINTS)) {
      const box = seatedPlugBox(slot);

      expect(box.x + box.width / 2).toBe(slot.mouthX);
      expect(box.y).toBe(slot.mouthY);
      expect(box.width).toBe(SEATED_WIDTH);
      expect(box.height).toBe(SEATED_HEIGHT);
      expect(box.y + box.height).toBeLessThanOrEqual(slot.mouthY + PORT_REACH);
    }
  });
});

describe("which port a plug is offered to", () => {
  it("is the port it is held over, or held just below the mouth of", () => {
    for (const slot of portSlots(S5_ENDPOINTS)) {
      expect(portUnder(slot.mouthX, slot.y + slot.height / 2, S5_ENDPOINTS)?.endpoint).toBe(slot.endpoint);
      expect(portUnder(slot.mouthX, slot.mouthY + PORT_REACH / 2, S5_ENDPOINTS)?.endpoint).toBe(slot.endpoint);
    }
  });

  it("includes the reach's own edges, and nothing past them", () => {
    const [slot] = portSlots(S5_ENDPOINTS);

    expect(portUnder(slot.x, slot.mouthY + PORT_REACH, S5_ENDPOINTS)?.endpoint).toBe(slot.endpoint);
    expect(portUnder(slot.x + slot.width, PORT_TOP, S5_ENDPOINTS)?.endpoint).toBe(slot.endpoint);
    expect(portUnder(slot.mouthX, slot.mouthY + PORT_REACH + 0.5, S5_ENDPOINTS)).toBeNull();
    expect(portUnder(slot.x - 0.5, slot.mouthY, S5_ENDPOINTS)).toBeNull();
  });

  it("is no port in the gap between two ports, over the cable, or on the shelf", () => {
    const [first, second] = portSlots(S5_ENDPOINTS);

    expect(portUnder((first.x + first.width + second.x) / 2, first.mouthY, S5_ENDPOINTS)).toBeNull();
    expect(portUnder(WIDTH / 2, CY, S5_ENDPOINTS)).toBeNull();
    expect(portUnder(first.mouthX, SHELF_TOP + 20, S5_ENDPOINTS)).toBeNull();
  });

  it("is read from the endpoints alone: no cable, no selected end, no rule", () => {
    // The whole of what it is given is a point and the scenario's endpoints.
    expect(portUnder.length).toBe(3);
  });
});

describe("which plug is sitting in a port", () => {
  const S5: Scenario = { ...OPEN, endpoints: S5_ENDPOINTS };

  it("is nothing while no end is plugged in", () => {
    for (const slot of portSlots(S5_ENDPOINTS)) {
      const box = seatedPlugBox(slot);

      expect(seatedPlugUnder(box.x + box.width / 2, box.y + box.height / 2, {}, S5_ENDPOINTS)).toBeNull();
    }
  });

  it("is the end the model has in that port, at either end and in any port", () => {
    const cable = chain(
      [...plugged("A"), ...plugged("B"), { type: "connect", end: "A", endpoint: "tester-remote" }, { type: "connect", end: "B", endpoint: "pc-2:eth0" }],
      S5,
    );
    const slots = portSlots(S5_ENDPOINTS);
    const at = (endpoint: EndpointId) => {
      const box = seatedPlugBox(slots.find((slot) => slot.endpoint === endpoint)!);

      return [box.x + box.width / 2, box.y + box.height / 2] as const;
    };

    expect(seatedPlugUnder(...at("tester-remote"), cable.connections, S5_ENDPOINTS)).toEqual({ end: "A", endpoint: "tester-remote" });
    expect(seatedPlugUnder(...at("pc-2:eth0"), cable.connections, S5_ENDPOINTS)).toEqual({ end: "B", endpoint: "pc-2:eth0" });
    expect(seatedPlugUnder(...at("tester-main"), cable.connections, S5_ENDPOINTS)).toBeNull();
    expect(seatedPlugUnder(...at("pc-1:eth0"), cable.connections, S5_ENDPOINTS)).toBeNull();
  });

  it("follows the model's connections and nothing else: swap them and the answer swaps", () => {
    const [main, remote] = portSlots(S1_PRACTICE.endpoints).map(seatedPlugBox);
    const x = main.x + main.width / 2;
    const y = main.y + main.height / 2;

    expect(seatedPlugUnder(x, y, { A: "tester-main", B: "tester-remote" }, S1_PRACTICE.endpoints)?.end).toBe("A");
    expect(seatedPlugUnder(x, y, { A: "tester-remote", B: "tester-main" }, S1_PRACTICE.endpoints)?.end).toBe("B");
    expect(seatedPlugUnder(remote.x + remote.width / 2, y, { B: "tester-remote" }, S1_PRACTICE.endpoints)?.end).toBe("B");
  });

  it("takes the seated plug with a little slack round it, and no more", () => {
    const box = seatedPlugBox(portSlots(S1_PRACTICE.endpoints)[0]);
    const connections = { A: "tester-main" };

    expect(seatedPlugUnder(box.x - SEATED_MARGIN, box.y + 2, connections, S1_PRACTICE.endpoints)?.end).toBe("A");
    expect(seatedPlugUnder(box.x + box.width + SEATED_MARGIN, box.y + box.height + SEATED_MARGIN, connections, S1_PRACTICE.endpoints)?.end).toBe("A");
    expect(seatedPlugUnder(box.x - SEATED_MARGIN - 0.5, box.y + 2, connections, S1_PRACTICE.endpoints)).toBeNull();
  });

  it("is nothing for a connection to a port the bench does not have", () => {
    const box = seatedPlugBox(portSlots(S1_PRACTICE.endpoints)[0]);

    expect(seatedPlugUnder(box.x + 5, box.y + 5, { A: "somewhere-else" }, S1_PRACTICE.endpoints)).toBeNull();
  });
});

describe("pulling a plug out of its port", () => {
  it("is not far enough short of UNPLUG_PULL, and far enough from there on", () => {
    expect(unplugPulled(0)).toBe(false);
    expect(unplugPulled(UNPLUG_PULL - 1)).toBe(false);
    expect(unplugPulled(-UNPLUG_PULL * 3)).toBe(false);
    expect(unplugPulled(UNPLUG_PULL)).toBe(true);
    expect(unplugPulled(UNPLUG_PULL + 40)).toBe(true);
    expect(unplugPulled(5, 5)).toBe(true);
  });
});

describe("a plug's lead", () => {
  it("is there only where there is a plug, crimped or not", () => {
    const start = createInitialState(S1_PRACTICE);
    const scale = benchScale(start).scale;

    expect(leadHandle("A", start.ends.A, scale)).toBeNull();
    expect(start.ends.B.plug!.crimp).toBe("full");
    expect(leadHandle("B", start.ends.B, scale)).not.toBeNull();
  });

  it("starts LEAD_GAP past the plug's front face, the way the conductors point, at both ends", () => {
    const cable = chain([...plugged("A", -5), ...plugged("B", 9)]);
    const scale = benchScale(cable).scale;
    const frontA = plugFrontXAt(cable.ends.A.plug!.jacketInMm, "A", scale);
    const frontB = plugFrontXAt(cable.ends.B.plug!.jacketInMm, "B", scale);
    const a = leadHandle("A", cable.ends.A, scale)!;
    const b = leadHandle("B", cable.ends.B, scale)!;

    // End A points left, end B right.
    expect(a.x + a.width).toBeCloseTo(frontA - LEAD_GAP, 9);
    expect(b.x).toBeCloseTo(frontB + LEAD_GAP, 9);
    expect(a.cy).toBe(CY);
    expect(b.cx).toBeCloseTo(b.x + b.width / 2, 9);
  });

  it("stays on the bench however far on or off a plug sits", () => {
    for (const pushMm of [-11, 0, 9]) {
      const cable = chain([...plugged("A", pushMm), ...plugged("B", pushMm)]);
      const scale = benchScale(cable).scale;

      for (const id of END_IDS) {
        const handle = leadHandle(id, cable.ends[id], scale)!;

        expect(handle.x).toBeGreaterThanOrEqual(0);
        expect(handle.x + handle.width).toBeLessThanOrEqual(WIDTH);
      }
    }
  });

  it("never shares a point with the conductors, the plug's grip, or the other end", () => {
    let leads = 0;
    const both: string[] = [];

    for (const pushMm of [-11, 9]) {
      const cable = chain([...plugged("A", pushMm), ...plugged("B", pushMm)]);
      const scale = benchScale(cable).scale;

      for (const id of END_IDS) {
        const handle = leadHandle(id, cable.ends[id], scale)!;

        for (let x = handle.x - 8; x <= handle.x + handle.width + 8; x += 1) {
          for (let y = handle.y - 8; y <= handle.y + handle.height + 8; y += 1) {
            const lead = leadUnder(x, y, cable, scale);
            if (lead === null) continue;

            leads++;
            if (lead.end !== id) both.push(`${id} lead at ${x}, ${y} read as ${lead.end}`);
            if (conductorUnder(x, y, cable, scale)) both.push(`conductor at ${x}, ${y}`);
            if (fittedPlugUnder(x, y, cable, scale)) both.push(`grip at ${x}, ${y}`);
          }
        }
      }
    }

    expect(both).toEqual([]);
    expect(leads).toBeGreaterThan(0);
  });

  it("is under the hand at end A's lead and end B's, and nowhere in the middle", () => {
    const cable = chain([...plugged("A"), ...plugged("B")]);
    const scale = benchScale(cable).scale;

    for (const id of END_IDS) {
      const handle = leadHandle(id, cable.ends[id], scale)!;

      expect(leadUnder(handle.cx, handle.cy, cable, scale)).toEqual({ end: id });
    }

    expect(leadUnder(WIDTH / 2, CY, cable, scale)).toBeNull();
  });
});
