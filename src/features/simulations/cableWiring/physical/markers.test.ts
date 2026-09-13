import { describe, expect, it } from "vitest";

import type { EndId } from "../model";
import type { Marker } from "./components/EndDetail";
import { KIND_RANK, SOURCE_RANK, claimRank, panelClaims, resolveMarkers } from "./markers";
import type { MarkerClaim, MarkerSource } from "./markers";

/**
 * One end, one preview line, and an explicit rule for which.
 *
 * R5 put a fourth thing on the bench that wants to draw on an end, so the rule
 * is pinned here: nearest the hand wins, the bigger line breaks a tie, and an
 * equal claim never displaces the one already there. Nothing below is about
 * whether an action would be allowed — that is the model's answer, carried on a
 * marker's `tone`.
 */

const line = (kind: NonNullable<Marker>["kind"], label: string = kind): NonNullable<Marker> => ({
  kind,
  offsetMm: -5,
  label,
});

const claim = (end: EndId, kind: NonNullable<Marker>["kind"], source: MarkerSource, label?: string): MarkerClaim => ({
  end,
  source,
  marker: line(kind, label ?? `${source}-${kind}`),
});

describe("what an end shows", () => {
  it("is nothing when nothing claims it", () => {
    expect(resolveMarkers([])).toEqual({ A: null, B: null });
  });

  it("is the only claim there is", () => {
    const only = claim("B", "cut", "standing");

    expect(resolveMarkers([only])).toEqual({ A: null, B: only.marker });
  });

  it("keeps the two ends apart", () => {
    const a = claim("A", "strip", "in-hand");
    const b = claim("B", "cut", "standing");

    expect(resolveMarkers([a, b])).toEqual({ A: a.marker, B: b.marker });
  });
});

describe("nearest the hand wins", () => {
  it("a tool in hand over one standing on the cable", () => {
    const standing = claim("A", "cut", "standing");
    const inHand = claim("A", "strip", "in-hand");

    expect(resolveMarkers([standing, inHand]).A).toBe(inHand.marker);
    expect(resolveMarkers([inHand, standing]).A).toBe(inHand.marker);
  });

  it("a tool standing on the cable over the tool panel's slider", () => {
    const panel = claim("A", "cut", "tool-panel");
    const standing = claim("A", "trim", "standing");

    expect(resolveMarkers([panel, standing]).A).toBe(standing.marker);
    expect(resolveMarkers([standing, panel]).A).toBe(standing.marker);
  });

  it("whatever the order the claims were made in", () => {
    const claims = [claim("A", "trim", "tool-panel"), claim("A", "cut", "in-hand"), claim("A", "strip", "standing")];
    const winner = claims[1].marker;

    for (const order of [claims, [...claims].reverse(), [claims[2], claims[0], claims[1]]]) {
      expect(resolveMarkers(order).A).toBe(winner);
    }
  });
});

describe("the bigger line breaks a tie", () => {
  it("a cut over a trim standing on the same end", () => {
    // The flush cutters on the conductors and the cable cutters on the jacket,
    // both put down: the cut takes the end the trim would have shaped.
    const trim = claim("A", "trim", "standing");
    const cut = claim("A", "cut", "standing");

    expect(resolveMarkers([trim, cut]).A).toBe(cut.marker);
    expect(resolveMarkers([cut, trim]).A).toBe(cut.marker);
  });

  it("ranks cut over strip over trim", () => {
    expect(KIND_RANK.cut).toBeGreaterThan(KIND_RANK.strip);
    expect(KIND_RANK.strip).toBeGreaterThan(KIND_RANK.trim);
  });

  it("never over a nearer hand: a standing cut loses to a stripper in hand", () => {
    const cut = claim("A", "cut", "standing");
    const strip = claim("A", "strip", "in-hand");

    expect(claimRank(strip)).toBeGreaterThan(claimRank(cut));
    expect(resolveMarkers([cut, strip]).A).toBe(strip.marker);
  });
});

describe("an equal claim never displaces the one already there", () => {
  it("keeps the first of two identical ranks", () => {
    const first = claim("B", "cut", "standing", "first");
    const second = claim("B", "cut", "standing", "second");

    expect(resolveMarkers([first, second]).B).toBe(first.marker);
  });
});

describe("the ranking itself", () => {
  it("separates the sources by more than any kind can bridge", () => {
    const kinds = Object.values(KIND_RANK);
    const sources = Object.values(SOURCE_RANK).sort((a, b) => a - b);

    // Whatever the kinds, a nearer source always outranks a further one.
    for (let index = 1; index < sources.length; index++) {
      expect(sources[index] - sources[index - 1]).toBeGreaterThan(0);
    }
    expect(Math.max(...kinds) - Math.min(...kinds)).toBeLessThan(10);
  });
});

describe("the tool panel's own markers", () => {
  it("become one claim per end that has one", () => {
    const markers: Record<EndId, Marker> = { A: line("cut"), B: null };

    expect(panelClaims(markers)).toEqual([{ end: "A", marker: markers.A, source: "tool-panel" }]);
  });

  it("are no claims at all when the panel is showing none", () => {
    expect(panelClaims({ A: null, B: null })).toEqual([]);
  });
});
