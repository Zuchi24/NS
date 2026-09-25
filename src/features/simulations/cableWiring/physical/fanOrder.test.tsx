// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { NATURAL_ORDER, PAIR_IDS, PAIRS, T568A, T568B, rawEnd } from "../model";
import type { Conductor, PairId } from "../model";
import { PhysicalCableChallenge } from "./PhysicalCableChallenge";
import { CY } from "./benchGeometry";
import { startingFanOrder, startingPairOrder } from "./fanOrder";
import { PAIR_HALF, pairOrderOf, pairRowY } from "./pairGeometry";
import { PRACTICE_BENCH } from "./setup";

/**
 * The per-attempt starting arrangement: the four pairs in a random order,
 * drawn once when the bench mounts, from a seeded source here so nothing
 * below depends on luck.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** A small seeded generator, so a "random" draw is the same on every run. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pairOf = (conductor: Conductor): PairId =>
  PAIR_IDS.find((pair) => (PAIRS[pair] as readonly Conductor[]).includes(conductor))!;

describe("startingPairOrder", () => {
  it("A. is always the four pairs, each exactly once", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const order = startingPairOrder(seeded(seed));

      expect(order).toHaveLength(4);
      expect([...order].sort()).toEqual([...PAIR_IDS].sort());
    }
  });

  it("C. can start in an order other than the default", () => {
    // Fisher–Yates with every draw at 0: swap 3↔0, then 2↔0, then 1↔0.
    expect(startingPairOrder(() => 0)).toEqual(["green", "blue", "brown", "orange"]);
    expect(startingPairOrder(() => 0)).not.toEqual([...PAIR_IDS]);
  });

  it("C. reaches every one of the 24 arrangements, each about as often", () => {
    const draw = seeded(2024);
    const counts = new Map<string, number>();

    for (let run = 0; run < 2400; run++) {
      const key = startingPairOrder(draw).join(" ");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    expect(counts.size).toBe(24);
    // An unbiased shuffle gives each ~100 of 2400; a biased one (sort by a
    // random comparator, say) leaves some far off it.
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(60);
      expect(count).toBeLessThan(140);
    }
  });

  it("is the same order for the same source", () => {
    expect(startingPairOrder(seeded(7))).toEqual(startingPairOrder(seeded(7)));
  });
});

describe("startingFanOrder", () => {
  it("B. keeps each pair's two wires together, in the pairs' own order", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const pairs = startingPairOrder(seeded(seed));
      const row = startingFanOrder(seeded(seed));

      expect([...row].sort()).toEqual([...NATURAL_ORDER].sort());
      // Lanes 1–2 are one pair, 3–4 the next, and so on down the order.
      pairs.forEach((pair, index) => {
        expect(pairOf(row[2 * index])).toBe(pair);
        expect(pairOf(row[2 * index + 1])).toBe(pair);
      });
      // And the bench reads the same pair order back out of the row.
      expect(pairOrderOf(row)).toEqual(pairs);
    }
  });

  it("never changes which wires make up a pair", () => {
    expect(PAIRS).toEqual({
      orange: ["white-orange", "orange"],
      green: ["white-green", "green"],
      blue: ["white-blue", "blue"],
      brown: ["white-brown", "brown"],
    });
  });

  it("never starts an attempt already wired to a standard, and leaves T568B as it is", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const row = startingFanOrder(seeded(seed));

      expect(row).not.toEqual([...T568A]);
      expect(row).not.toEqual([...T568B]);
    }

    expect([...T568B]).toEqual([
      "white-orange",
      "orange",
      "white-green",
      "blue",
      "white-blue",
      "green",
      "white-brown",
      "brown",
    ]);
  });
});

/* ============================================================
   ON THE BENCH
   ============================================================ */

/** jsdom has no PointerEvent; the bench mounts handlers that name it. */
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;

  constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

Object.defineProperty(window, "PointerEvent", { writable: true, configurable: true, value: TestPointerEvent });

const press = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name, hidden: true }));
const tool = (name: string) =>
  fireEvent.click(
    within(screen.getByRole("toolbar", { name: "Tools", hidden: true })).getByRole("button", {
      name: new RegExp(`^${name}`),
      hidden: true,
    }),
  );
const fanOf = (end: "A" | "B") => screen.getByTestId(`end-${end}`).getAttribute("data-fan")!.split(" ");
const fanOfA = () => fanOf("A");

/** Pick an end in the precise controls, then a tool. */
function onEnd(end: "A" | "B", name: string) {
  fireEvent.click(screen.getByRole("button", { name: `End ${end}`, hidden: true }));
  tool(name);
}

function strip(end: "A" | "B", amountMm = 30) {
  onEnd(end, "Strip");
  fireEvent.change(screen.getByLabelText("Strip length"), { target: { value: String(amountMm) } });
  press(new RegExp(`^Strip end ${end}$`));
}

function cut(end: "A" | "B", behindMm: number) {
  onEnd(end, "Cut");
  fireEvent.change(screen.getByLabelText("Cut behind the jacket edge"), { target: { value: String(behindMm) } });
  press(new RegExp(`^Cut end ${end}$`));
}

function untwistAll(end: "A" | "B") {
  onEnd(end, "Untwist");
  for (const pair of PAIR_IDS) press(new RegExp(`^Untwist ${pair}`));
}

function stripAndUntwistA() {
  strip("A");
  untwistAll("A");
}

/** Which pair lies in each row on an end, top to bottom, as the bench draws it. */
const rowsOf = (end: "A" | "B") =>
  PAIR_IDS.map((pair) => ({ pair, row: Number(screen.getByTestId(`pair-${end}-${pair}`).getAttribute("data-row")) }))
    .sort((a, b) => a.row - b.row)
    .map(({ pair }) => pair);

/** Both ends raw, so both show twisted pairs once stripped. */
const BOTH_RAW = {
  ...PRACTICE_BENCH,
  scenario: { ...PRACTICE_BENCH.scenario, initialEnds: { A: rawEnd(0), B: rawEnd(0) } },
};

/** The orders a bench draws for end A then end B from one source, as it does on mount and RESET. */
function drawsFrom(seed: number): { A: PairId[]; B: PairId[] } {
  const random = seeded(seed);
  const A = startingPairOrder(random);

  return { A, B: startingPairOrder(random) };
}

/** Run `work` with Math.random drawing from `seed`, and only then. */
function withSeed(seed: number, work: () => void) {
  const spy = vi.spyOn(Math, "random").mockImplementation(seeded(seed));
  work();
  spy.mockRestore();
}

/** Run `work` and say whether anything drew a random number meanwhile. */
function drewDuring(work: () => void): boolean {
  const spy = vi.spyOn(Math, "random");
  work();
  const drew = spy.mock.calls.length > 0;
  spy.mockRestore();

  return drew;
}

/** Mount a bench whose draws come from `seed`. */
function mountWithSeed(seed: number, setup: typeof PRACTICE_BENCH = PRACTICE_BENCH) {
  let view!: ReturnType<typeof render>;
  withSeed(seed, () => {
    view = render(<PhysicalCableChallenge {...setup} />);
  });

  return view;
}

/** A seed whose two ends are drawn differently, and neither in the default order. */
const SPLIT_SEED = Array.from({ length: 200 }, (_, i) => i + 1).find((seed) => {
  const { A, B } = drawsFrom(seed);
  return A.join() !== B.join() && A[0] !== "orange" && B[0] !== "orange" && A[3] !== "brown" && B[3] !== "brown";
})!;

describe("each end's starting arrangement", () => {
  it("1. draws an order for end A and for end B when the bench mounts, each the four pairs once", () => {
    mountWithSeed(SPLIT_SEED, BOTH_RAW);
    strip("A");
    strip("B");

    const { A, B } = drawsFrom(SPLIT_SEED);
    expect(rowsOf("A")).toEqual(A);
    expect(rowsOf("B")).toEqual(B);
    for (const order of [rowsOf("A"), rowsOf("B")]) expect([...order].sort()).toEqual([...PAIR_IDS].sort());
  });

  it("3. gives the two ends independent orders, and each end fans into its own", () => {
    mountWithSeed(SPLIT_SEED, BOTH_RAW);
    strip("A");
    strip("B");
    untwistAll("A");
    untwistAll("B");

    const random = seeded(SPLIT_SEED);
    const A = startingFanOrder(random);
    const B = startingFanOrder(random);

    expect(A).not.toEqual(B);
    expect(fanOf("A")).toEqual(A);
    expect(fanOf("B")).toEqual(B);
  });

  it("does not move when the bench re-renders, even while randomness would now give another order", () => {
    const view = mountWithSeed(11);
    stripAndUntwistA();
    const before = fanOfA();

    withSeed(99, () => {
      view.rerender(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
      view.rerender(<PhysicalCableChallenge {...PRACTICE_BENCH} title="Same attempt, new props" />);
    });

    expect(fanOfA()).toEqual(before);
  });

  it("draws again for a new attempt: a remount can start another order", () => {
    mountWithSeed(11);
    stripAndUntwistA();
    const first = fanOfA();
    cleanup();

    mountWithSeed(12);
    stripAndUntwistA();

    expect(fanOfA()).not.toEqual(first);
    expect([...fanOfA()].sort()).toEqual([...first].sort());
  });
});

describe("a fresh section of cable", () => {
  for (const [cutEnd, other] of [["A", "B"], ["B", "A"]] as const) {
    it(`4. an accepted cut on end ${cutEnd} gives that end a new order, and leaves end ${other}'s pairs where they lie`, () => {
      mountWithSeed(SPLIT_SEED, BOTH_RAW);
      strip("A");
      strip("B");
      const otherBefore = rowsOf(other);

      // Back into the jacket: the whole exposed section goes with the offcut.
      withSeed(777, () => cut(cutEnd, 10));

      // End `other` never stopped showing its pairs, and none of them moved.
      expect(rowsOf(other)).toEqual(otherBefore);

      strip(cutEnd);
      expect(rowsOf(cutEnd)).toEqual(startingPairOrder(seeded(777)));
      expect(rowsOf(other)).toEqual(otherBefore);
    });
  }

  it("5. a refused cut draws nothing and moves nothing", () => {
    mountWithSeed(SPLIT_SEED);
    strip("A");
    const before = rowsOf("A");

    // End B arrives with a factory plug; 5 mm behind its jacket edge is inside it.
    expect(drewDuring(() => cut("B", 5))).toBe(false);
    expect(screen.getByTestId("feedback").getAttribute("data-tone")).toBe("refused");
    expect(rowsOf("A")).toEqual(before);
  });

  it("5. a cut with nothing to take off a flush end draws nothing", () => {
    mountWithSeed(SPLIT_SEED, BOTH_RAW);

    expect(drewDuring(() => cut("A", 0))).toBe(false);
    expect(screen.getByTestId("feedback").getAttribute("data-tone")).toBe("refused");

    strip("A");
    expect(rowsOf("A")).toEqual(drawsFrom(SPLIT_SEED).A);
  });

  it("6–7. strip, untwist, arrange, trim, insert and crimp never draw a new order", () => {
    mountWithSeed(SPLIT_SEED, BOTH_RAW);

    expect(drewDuring(() => strip("A"))).toBe(false);
    expect(rowsOf("A")).toEqual(drawsFrom(SPLIT_SEED).A);
    expect(drewDuring(() => strip("A", 5))).toBe(false);
    expect(rowsOf("A")).toEqual(drawsFrom(SPLIT_SEED).A);

    const drew = drewDuring(() => {
      untwistAll("A");
      onEnd("A", "Arrange");
      onEnd("A", "Trim");
      fireEvent.change(screen.getByLabelText("Leave exposed"), { target: { value: "12" } });
      press(/^Trim end A$/);
      onEnd("A", "Insert");
      press(/^Pick up a plug$/);
      press(/^Insert end A$/);
      onEnd("A", "Crimp");
      press(/^Squeeze fully$/);
    });

    expect(drew).toBe(false);
    // And the work really happened: the end is plugged and crimped.
    expect(screen.getByTestId("end-A").getAttribute("data-crimp")).toBe("full");
    // The row it fanned into is still the one drawn at mount.
    expect(fanOf("A")).toEqual(startingFanOrder(seeded(SPLIT_SEED)));
  });

  it("8. RESET draws a fresh order for both ends", () => {
    mountWithSeed(SPLIT_SEED, BOTH_RAW);
    strip("A");
    strip("B");

    press(/^Reset bench$/);
    withSeed(4242, () => press(/^Yes, reset$/));
    strip("A");
    strip("B");

    // Fresh from the source at the moment of the reset — which may, by chance,
    // match what was there before; that is allowed, and not what is checked.
    expect(rowsOf("A")).toEqual(drawsFrom(4242).A);
    expect(rowsOf("B")).toEqual(drawsFrom(4242).B);
  });
});

/* ============================================================
   THE PAIRS IN THEIR ROWS
   ============================================================ */

describe("9–10. each end's pairs in the bench's existing rows", () => {
  for (const end of ["A", "B"] as const) {
    it(`lays end ${end}'s pairs in its own order, at the rows' existing heights`, () => {
      mountWithSeed(SPLIT_SEED, BOTH_RAW);
      strip(end);

      const order = drawsFrom(SPLIT_SEED)[end];
      expect(order).not.toEqual([...PAIR_IDS]);

      order.forEach((pair, row) => {
        expect(screen.getByTestId(`pair-${end}-${pair}`).getAttribute("data-row")).toBe(String(row));
        // The grab band the hand closes on is that row's own band.
        expect(Number(screen.getByTestId(`pair-grab-${end}-${pair}`).getAttribute("data-y"))).toBeCloseTo(
          pairRowY(row, CY) - PAIR_HALF,
        );
      });
    });

    it(`untwists the pair drawn in end ${end}'s top row when a hand pulls it — whatever pair it is`, () => {
      mountWithSeed(SPLIT_SEED, BOTH_RAW);
      const svg = screen.getByRole("img", { name: /Workbench/ });
      vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
        left: 0, top: 0, width: 1000, height: 285, right: 1000, bottom: 285, x: 0, y: 0, toJSON: () => ({}),
      } as DOMRect);
      strip("A");
      strip("B");

      const top = drawsFrom(SPLIT_SEED)[end][0];
      expect(top).not.toBe("orange");
      const band = screen.getByTestId(`pair-grab-${end}-${top}`).querySelector("rect")!;
      const from = {
        clientX: Number(band.getAttribute("x")) + Number(band.getAttribute("width")) / 2,
        clientY: Number(band.getAttribute("y")) + Number(band.getAttribute("height")) / 2,
      };

      fireEvent.pointerDown(svg, { pointerId: 1, ...from });
      fireEvent.pointerMove(svg, { pointerId: 1, clientX: from.clientX, clientY: from.clientY - 24 });
      fireEvent.pointerUp(svg, { pointerId: 1, clientX: from.clientX, clientY: from.clientY - 24 });

      for (const id of ["A", "B"] as const) {
        for (const pair of PAIR_IDS) {
          const expected = id === end && pair === top ? "true" : "false";
          expect(screen.getByTestId(`pair-${id}-${pair}`).getAttribute("data-untwisted"), `${id} ${pair}`).toBe(expected);
        }
      }
    });
  }
});
