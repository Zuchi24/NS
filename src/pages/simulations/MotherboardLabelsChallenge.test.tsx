// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import type { Attempt, Challenge } from "@/features/content/types";

/**
 * The labeling page through its real lifecycle — the real hook, the real
 * results dialog — with only the three calls to the server standing in.
 */

vi.mock("@/features/content/contentService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/content/contentService")>();

  return { ...actual, fetchAttempt: vi.fn(), submitSimulation: vi.fn(), startAttempt: vi.fn() };
});

const content = await import("@/features/content/contentService");
const { MotherboardLabelsChallenge } = await import("./MotherboardLabelsChallenge");
const { WIDE_LAYOUT_QUERY } = await import("@/features/simulations/motherboardLabels/useWideLayout");

const challenge: Challenge = {
  id: 19,
  title: "Label the Motherboard",
  description: "Identify the marked parts of a motherboard.",
  kind: "motherboard_labels",
  difficulty: "beginner",
  config: { board: "atx-basic-v1", labels: [{ id: "m3" }, { id: "m1" }, { id: "m8" }] },
  requiredFamilies: [],
  initialTopology: null,
  order: 0,
} as unknown as Challenge;

function marked(passed: boolean, results: [string, boolean][]): Attempt {
  return {
    id: 5,
    challengeId: 19,
    challengeTitle: null,
    passed,
    results: results.map(([requirement, ok]) => ({ requirement, passed: ok })),
    status: "completed",
    startedAt: null,
    completedAt: null,
  } as Attempt;
}

/** Pretends the window is wide, or not. */
function windowIsWide(wide: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === WIDE_LAYOUT_QUERY ? wide : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function open(path = "/challenge/motherboard-labels?attempt=5") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/challenge/motherboard-labels" element={<MotherboardLabelsChallenge />} />
        <Route path="/challenges" element={<p>Catalogue</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const inputs = () => screen.getAllByRole("textbox");

/** The drawing, as opposed to the page's icons. */
const BOARD = 'svg[aria-label="Motherboard with numbered marks"]';

beforeEach(() => {
  vi.mocked(content.fetchAttempt).mockResolvedValue({
    attempt: marked(false, []),
    challenge,
    topology: null,
  });
  windowIsWide(false);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the labeling page", () => {
  it("gives every marked part one box, numbered in the challenge's order", async () => {
    open();

    await waitFor(() => expect(inputs()).toHaveLength(3));

    expect(inputs().map((input) => input.getAttribute("aria-label"))).toEqual(["Component 1", "Component 2", "Component 3"]);
    expect(inputs().map((input) => input.getAttribute("data-mark"))).toEqual(["m3", "m1", "m8"]);
    expect(document.querySelectorAll("[data-marker]")).toHaveLength(3);
  });

  it("describes where each part is without saying what it is", async () => {
    open();
    await waitFor(() => expect(inputs()).toHaveLength(3));

    for (const input of inputs()) {
      const description = document.getElementById(input.getAttribute("aria-describedby")!)!.textContent!.toLowerCase();

      expect(description.length).toBeGreaterThan(10);

      for (const answer of ["socket", "cpu", "processor", "slot", "dimm", "memory", "pcie", "express"]) {
        expect(description).not.toMatch(new RegExp(`\\b${answer}`));
      }
    }
  });

  it("puts no answer anywhere in the page", async () => {
    const { container } = open();
    await waitFor(() => expect(inputs()).toHaveLength(3));

    const page = container.innerHTML.toLowerCase();

    for (const answer of ["cpu socket", "ram slot", "dimm", "pcie", "sata", "cmos", "accept"]) {
      expect(page).not.toContain(answer);
    }
  });

  it("sends what was typed against each mark, blank boxes included", async () => {
    vi.mocked(content.submitSimulation).mockResolvedValue(marked(false, [["Component 1", true], ["Component 2", false], ["Component 3", false]]));
    open();
    await waitFor(() => expect(inputs()).toHaveLength(3));

    fireEvent.change(inputs()[0], { target: { value: "CPU socket" } });
    fireEvent.change(inputs()[2], { target: { value: "PCIe slot" } });
    fireEvent.click(screen.getByRole("button", { name: /check labels/i }));

    await waitFor(() => expect(content.submitSimulation).toHaveBeenCalledTimes(1));
    expect(content.submitSimulation).toHaveBeenCalledWith(5, {
      labels: { m3: "CPU socket", m1: "", m8: "PCIe slot" },
    });
  });

  it("shows which parts were right and wrong, and nothing of the answers", async () => {
    vi.mocked(content.submitSimulation).mockResolvedValue(marked(false, [["Component 1", true], ["Component 2", false], ["Component 3", true]]));
    open();
    await waitFor(() => expect(inputs()).toHaveLength(3));

    fireEvent.click(screen.getByRole("button", { name: /check labels/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Not quite yet")).toBeTruthy();
    expect(within(dialog).getByText("Component 2")).toBeTruthy();
    expect(dialog.textContent!.toLowerCase()).not.toContain("socket");
  });

  it("starts another attempt to try again, with the boxes emptied", async () => {
    vi.mocked(content.submitSimulation).mockResolvedValue(marked(false, [["Component 1", false], ["Component 2", false], ["Component 3", false]]));
    vi.mocked(content.startAttempt).mockResolvedValue({ ...marked(false, []), id: 6, status: "in_progress" } as Attempt);
    open();
    await waitFor(() => expect(inputs()).toHaveLength(3));

    fireEvent.change(inputs()[0], { target: { value: "a guess" } });
    fireEvent.click(screen.getByRole("button", { name: /check labels/i }));
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));

    await waitFor(() => expect(content.startAttempt).toHaveBeenCalledWith(19));
    await waitFor(() => expect(content.fetchAttempt).toHaveBeenLastCalledWith(6));
    await waitFor(() => expect((inputs()[0] as HTMLInputElement).value).toBe(""));
  });

  it("refuses to draw a challenge whose config it cannot trust", async () => {
    vi.mocked(content.fetchAttempt).mockResolvedValue({
      attempt: marked(false, []),
      challenge: { ...challenge, config: { board: "atx-basic-v1", labels: [{ id: "m99" }] } } as unknown as Challenge,
      topology: null,
    });
    open();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("is free practice on the whole board without an attempt, with nothing to submit", async () => {
    open("/challenge/motherboard-labels");

    await waitFor(() => expect(inputs()).toHaveLength(10));
    expect((screen.getByRole("button", { name: /check labels/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(content.fetchAttempt).not.toHaveBeenCalled();
  });
});

describe("the labeling page's two layouts", () => {
  it("puts the labels around the whole board, with a leader line to each mark, when the window is wide", async () => {
    windowIsWide(true);
    const { container } = open();
    await waitFor(() => expect(inputs()).toHaveLength(3));

    expect(container.querySelector('[data-layout="wide"]')).toBeTruthy();
    expect(container.querySelector(BOARD)!.getAttribute("viewBox")).toBe("0 0 1200 800");
    expect(container.querySelectorAll("[data-leader]")).toHaveLength(3);
    expect(container.querySelector("ol")).toBeNull();

    // Placed as a share of the board, so it moves with it.
    const box = container.querySelector('[data-label-box="m3"]') as HTMLElement;
    expect(box.style.left).toMatch(/%$/);
    expect(box.style.top).toMatch(/%$/);
  });

  it("crops to the board and lists the boxes beneath it when the window is narrow", async () => {
    const { container } = open();
    await waitFor(() => expect(inputs()).toHaveLength(3));

    expect(container.querySelector('[data-layout="narrow"]')).toBeTruthy();
    expect(container.querySelector(BOARD)!.getAttribute("viewBox")).toBe("276 150 634 500");
    expect(container.querySelectorAll("[data-leader]")).toHaveLength(0);
    expect(container.querySelectorAll("ol > li")).toHaveLength(3);
  });

  it("uses the drawing from its file rather than redrawing it", async () => {
    const { container } = open();
    await waitFor(() => expect(inputs()).toHaveLength(3));

    expect(container.querySelector("image")!.getAttribute("href")).toBe("/motherboards/atx-basic-v1.svg");
  });
});

const dragChallenge = {
  ...challenge,
  config: {
    board: "atx-basic-v1",
    mode: "drag",
    labels: [{ id: "m3" }, { id: "m1" }, { id: "m8" }],
    choices: ["Chipset", "CPU socket", "PCIe x16 slot", "RAM slots"],
  },
} as unknown as Challenge;

function openDragBoard() {
  vi.mocked(content.fetchAttempt).mockResolvedValue({ attempt: marked(false, []), challenge: dragChallenge, topology: null });

  return open();
}

const bank = () => screen.getByRole("group", { name: "Names to place" });
const chip = (name: string) => within(bank()).getByRole("button", { name });
const chipsInBank = () => within(bank()).queryAllByRole("button").map((button) => button.textContent);
const slot = (n: number) => screen.getByRole("button", { name: new RegExp(`^Component ${n}(,|:)`) });

describe("a drag board", () => {
  it("offers its names as chips and a slot for every mark, and no boxes to type in", async () => {
    openDragBoard();
    await screen.findByRole("group", { name: "Names to place" });

    expect(chipsInBank()).toEqual(["Chipset", "CPU socket", "PCIe x16 slot", "RAM slots"]);
    expect([1, 2, 3].map((n) => slot(n).getAttribute("aria-label"))).toEqual([
      "Component 1, empty",
      "Component 2, empty",
      "Component 3, empty",
    ]);
    expect([1, 2, 3].map((n) => slot(n).getAttribute("data-mark"))).toEqual(["m3", "m1", "m8"]);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("describes each slot's part without naming it", async () => {
    openDragBoard();
    await screen.findByRole("group", { name: "Names to place" });

    for (const n of [1, 2, 3]) {
      const description = document.getElementById(slot(n).getAttribute("aria-describedby")!)!.textContent!;

      expect(description.length).toBeGreaterThan(10);
      expect(description.toLowerCase()).not.toMatch(/socket|slot|cpu|\bram\b|pcie/);
    }
  });

  it("puts a picked-up chip down on the slot chosen next", async () => {
    openDragBoard();
    await screen.findByRole("group", { name: "Names to place" });

    fireEvent.click(chip("CPU socket"));
    expect(chip("CPU socket").getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(slot(1));

    expect(slot(1).getAttribute("aria-label")).toBe("Component 1: CPU socket");
    expect(chipsInBank()).toEqual(["Chipset", "PCIe x16 slot", "RAM slots"]);
    expect(screen.getByRole("status").textContent).toBe("CPU socket placed on Component 1.");
  });

  it("swaps two placed chips, and sends a covered chip back to the names", async () => {
    openDragBoard();
    await screen.findByRole("group", { name: "Names to place" });

    fireEvent.click(chip("RAM slots"));
    fireEvent.click(slot(1));
    fireEvent.click(chip("CPU socket"));
    fireEvent.click(slot(2));

    // Picked up off slot 2 and put on slot 1: the two trade places.
    fireEvent.click(slot(2));
    fireEvent.click(slot(1));

    expect(slot(1).getAttribute("aria-label")).toBe("Component 1: CPU socket");
    expect(slot(2).getAttribute("aria-label")).toBe("Component 2: RAM slots");

    // A chip from the names put on a full slot sends the one there back.
    fireEvent.click(chip("Chipset"));
    fireEvent.click(slot(2));

    expect(slot(2).getAttribute("aria-label")).toBe("Component 2: Chipset");
    expect(chipsInBank()).toEqual(["PCIe x16 slot", "RAM slots"]);
  });

  it("takes a chip off its slot, back to the names", async () => {
    openDragBoard();
    await screen.findByRole("group", { name: "Names to place" });

    fireEvent.click(chip("Chipset"));
    fireEvent.click(slot(3));
    fireEvent.click(screen.getByRole("button", { name: "Take Chipset off Component 3" }));

    expect(slot(3).getAttribute("aria-label")).toBe("Component 3, empty");
    expect(chipsInBank()).toEqual(["Chipset", "CPU socket", "PCIe x16 slot", "RAM slots"]);
  });

  it("lets Escape put a picked-up chip back down", async () => {
    openDragBoard();
    await screen.findByRole("group", { name: "Names to place" });

    fireEvent.click(chip("Chipset"));
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(chip("Chipset").getAttribute("aria-pressed")).toBe("false"));
    fireEvent.click(slot(1));
    expect(slot(1).getAttribute("aria-label")).toBe("Component 1, empty");
  });

  it("moves a chip with a real drag and drop", async () => {
    openDragBoard();
    await screen.findByRole("group", { name: "Names to place" });

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(),
      setDragImage: vi.fn(),
      dropEffect: "move",
      effectAllowed: "all",
      types: [] as string[],
      files: [],
      items: [],
    };

    fireEvent.dragStart(chip("PCIe x16 slot"), { dataTransfer });
    fireEvent.dragEnter(slot(3), { dataTransfer });
    fireEvent.dragOver(slot(3), { dataTransfer });
    fireEvent.drop(slot(3), { dataTransfer });

    await waitFor(() => expect(slot(3).getAttribute("aria-label")).toBe("Component 3: PCIe x16 slot"));
    expect(chipsInBank()).toEqual(["Chipset", "CPU socket", "RAM slots"]);
  });

  it("sends the chip on each mark, an empty slot as blank", async () => {
    vi.mocked(content.submitSimulation).mockResolvedValue(marked(false, [["Component 1", true], ["Component 2", false], ["Component 3", true]]));
    openDragBoard();
    await screen.findByRole("group", { name: "Names to place" });

    fireEvent.click(chip("CPU socket"));
    fireEvent.click(slot(1));
    fireEvent.click(chip("PCIe x16 slot"));
    fireEvent.click(slot(3));
    fireEvent.click(screen.getByRole("button", { name: /check labels/i }));

    await waitFor(() => expect(content.submitSimulation).toHaveBeenCalledTimes(1));
    expect(content.submitSimulation).toHaveBeenCalledWith(5, {
      labels: { m3: "CPU socket", m1: "", m8: "PCIe x16 slot" },
    });

    // The result says which, never what.
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Component 2")).toBeTruthy();
    expect(dialog.textContent!.toLowerCase()).not.toContain("ram slots");
  });

  it("starts another attempt to try again, with every chip back among the names", async () => {
    vi.mocked(content.submitSimulation).mockResolvedValue(marked(false, [["Component 1", false], ["Component 2", false], ["Component 3", false]]));
    vi.mocked(content.startAttempt).mockResolvedValue({ ...marked(false, []), id: 6, status: "in_progress" } as Attempt);
    openDragBoard();
    await screen.findByRole("group", { name: "Names to place" });

    fireEvent.click(chip("Chipset"));
    fireEvent.click(slot(1));
    fireEvent.click(screen.getByRole("button", { name: /check labels/i }));
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));

    await waitFor(() => expect(content.fetchAttempt).toHaveBeenLastCalledWith(6));
    await waitFor(() => expect(slot(1).getAttribute("aria-label")).toBe("Component 1, empty"));
    expect(chipsInBank()).toEqual(["Chipset", "CPU socket", "PCIe x16 slot", "RAM slots"]);
  });

  it("puts its slots around the board with leader lines when the window is wide", async () => {
    windowIsWide(true);
    const { container } = openDragBoard();
    await screen.findByRole("group", { name: "Names to place" });

    expect(container.querySelector('[data-layout="wide"]')).toBeTruthy();
    expect(container.querySelectorAll("[data-leader]")).toHaveLength(3);
    expect(container.querySelectorAll("[data-label-box] [data-drop-slot]")).toHaveLength(3);
  });

  it("refuses to draw a drag board with no chip for every mark", async () => {
    vi.mocked(content.fetchAttempt).mockResolvedValue({
      attempt: marked(false, []),
      challenge: { ...dragChallenge, config: { ...(dragChallenge.config as object), choices: ["Chipset"] } } as unknown as Challenge,
      topology: null,
    });
    open();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Names to place" })).toBeNull();
  });
});

describe("the route to the labeling page", () => {
  it("is where the catalogue sends a motherboard_labels challenge", async () => {
    const { challengeRoute } = await import("@/features/content/contentService");

    expect(challengeRoute(challenge, 5)).toBe("/challenge/motherboard-labels?attempt=5");
  });
});
