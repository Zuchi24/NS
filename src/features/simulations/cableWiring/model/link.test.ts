import { describe, expect, it } from "vitest";

import { NATURAL_ORDER, T568A, T568B } from "./constants";
import { makeEnd } from "./geometry";
import { linkState } from "./link";
import type { CableEnd, CableState, Conductor, Crimp, Scenario } from "./types";

/**
 * Link state between device ports, auto-MDIX off (model fixture M22, and
 * F27/F28 at the link level).
 */

function G(fan: readonly Conductor[], crimp: Crimp = "full"): CableEnd {
  return makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan, plug: { orientation: "contacts-up", jacketInMm: 9, crimp } });
}

const GIGABIT_B: Conductor[] = [
  "white-green", "green", "white-orange", "white-brown", "brown", "orange", "blue", "white-blue",
];

/** S5's endpoints, plus a switch port to exercise MDI ↔ MDIX. Test data only. */
const DEVICES: Scenario = {
  id: "devices",
  startLengthMm: 2000,
  plugs: 3,
  initialEnds: { A: makeEnd({ jacketEdgeMm: 0 }), B: makeEnd({ jacketEdgeMm: 0 }) },
  endpoints: [
    { id: "tester-main", kind: "tester-main" },
    { id: "tester-remote", kind: "tester-remote" },
    { id: "pc-1:eth0", kind: "mdi" },
    { id: "pc-2:eth0", kind: "mdi" },
    { id: "switch-1:fa0/1", kind: "mdix" },
    { id: "switch-2:fa0/1", kind: "mdix" },
  ],
};

function cable(A: CableEnd, B: CableEnd, connections: CableState["connections"]): CableState {
  return { ends: { A, B }, tray: { plugs: 0 }, connections };
}

const PCS = { A: "pc-1:eth0", B: "pc-2:eth0" };

describe("M22: linkState", () => {
  it("F27: a T568A↔T568B crossover brings PC to PC up", () => {
    expect(linkState(cable(G(T568B), G(T568A), PCS), DEVICES)).toEqual({
      connected: true,
      endpoints: ["pc-1:eth0", "pc-2:eth0"],
      up: true,
    });
  });

  it("F28: a straight-through leaves PC to PC down", () => {
    expect(linkState(cable(G(T568B), G(T568B), PCS), DEVICES)).toEqual({
      connected: true,
      endpoints: ["pc-1:eth0", "pc-2:eth0"],
      up: false,
    });
  });

  it("a gigabit crossover brings PC to PC up — link is physics, the objective is separate", () => {
    expect(linkState(cable(G(T568B), G(GIGABIT_B), PCS), DEVICES)).toEqual({
      connected: true,
      endpoints: ["pc-1:eth0", "pc-2:eth0"],
      up: true,
    });
  });

  it("a split pair brings nothing up, even over a straight map", () => {
    const toSwitch = { A: "pc-1:eth0", B: "switch-1:fa0/1" };

    expect(linkState(cable(G(NATURAL_ORDER), G(NATURAL_ORDER), toSwitch), DEVICES)).toMatchObject({ up: false });
  });

  it("MDI ↔ MDIX needs a straight-through", () => {
    const toSwitch = { A: "pc-1:eth0", B: "switch-1:fa0/1" };

    expect(linkState(cable(G(T568B), G(T568B), toSwitch), DEVICES)).toMatchObject({ up: true });
    expect(linkState(cable(G(T568B), G(T568A), toSwitch), DEVICES)).toMatchObject({ up: false });
  });

  it("MDIX ↔ MDIX needs a crossover", () => {
    const switches = { A: "switch-1:fa0/1", B: "switch-2:fa0/1" };

    expect(linkState(cable(G(T568B), G(T568A), switches), DEVICES)).toMatchObject({ up: true });
    expect(linkState(cable(G(T568B), G(T568B), switches), DEVICES)).toMatchObject({ up: false });
  });

  it("an open or an uncrimped end leaves the link down", () => {
    expect(linkState(cable(G(T568B), G(T568A, "partial"), PCS), DEVICES)).toMatchObject({ up: false });
    expect(linkState(cable(G(T568B), G(T568A, "none"), PCS), DEVICES)).toMatchObject({ up: false });
  });

  it("is not a link unless both ends are on device ports", () => {
    expect(linkState(cable(G(T568B), G(T568A), {}), DEVICES)).toEqual({ connected: false });
    expect(linkState(cable(G(T568B), G(T568A), { A: "pc-1:eth0" }), DEVICES)).toEqual({ connected: false });
    expect(
      linkState(cable(G(T568B), G(T568A), { A: "tester-main", B: "tester-remote" }), DEVICES),
    ).toEqual({ connected: false });
    expect(
      linkState(cable(G(T568B), G(T568A), { A: "pc-1:eth0", B: "tester-remote" }), DEVICES),
    ).toEqual({ connected: false });
  });

  it("reports the endpoints in A, B order", () => {
    expect(linkState(cable(G(T568B), G(T568A), { A: "pc-2:eth0", B: "pc-1:eth0" }), DEVICES)).toMatchObject({
      endpoints: ["pc-2:eth0", "pc-1:eth0"],
      up: true,
    });
  });
});
