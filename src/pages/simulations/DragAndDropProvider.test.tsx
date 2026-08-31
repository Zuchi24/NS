// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { useContext } from "react";
import { DndContext, DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import appSource from "@/App.tsx?raw";
import { CableWiringChallenge } from "./CableWiringChallenge";
import { Workspace } from "./Workspace";

/**
 * Where drag-and-drop is provided from.
 *
 * `DndProvider` used to be mounted app-wide, which meant every signed-in
 * visitor downloaded and initialised react-dnd whether or not the page they
 * opened could drag anything — and meant two HTML5 backends were live at once
 * whenever the computer-assembly page was open, since that page has always had
 * a provider of its own.
 *
 * It now sits on the three routes that actually drag. These hold that boundary
 * from both sides: the shell must not provide a context, and each simulator
 * must.
 *
 * The simulator checks call the route component as a plain function and look at
 * the element it returns. That is worth explaining, because the obvious test —
 * render the page and trust it to throw without a provider — does not actually
 * work here: the bench's draggable wires only mount at its fourth step, so a
 * freshly rendered page has no drag consumer in it yet and renders perfectly
 * well with no provider at all. Both wrappers exist solely to hold the
 * provider and call no hooks, so calling them directly is safe and says exactly
 * what is meant.
 */

vi.mock("@/features/content/useChallengeAttempt", () => ({
  useChallengeAttempt: () => ({
    challenge: null,
    loading: false,
    submitting: false,
    retrying: false,
    results: null,
    passed: false,
    submit: vi.fn(),
    retry: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

afterEach(cleanup);

/** Reports whether a react-dnd manager is available where it is rendered. */
function ContextProbe() {
  const manager = useContext(DndContext);

  return (
    <div data-testid="probe">
      {manager?.dragDropManager ? "provided" : "absent"}
    </div>
  );
}

describe("the drag-and-drop boundary", () => {
  it("provides no drag-and-drop context outside the simulators", () => {
    // Where an ordinary student page sits. A manager here would mean react-dnd
    // had been initialised for someone with nothing to drag.
    render(
      <MemoryRouter>
        <ContextProbe />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("probe")).toHaveTextContent("absent");
  });

  it("mounts no provider in the app shell", () => {
    /*
     * An architectural guard, read off the shell's own source.
     *
     * Deliberately a source check rather than a render: the cost being avoided
     * is that App *imports* react-dnd at all, which is what puts it in the
     * entry chunk. A rendered tree could not tell the difference between a
     * provider that is absent and one that simply has no drag consumer under
     * it, and the bundler does not care about either — it cares about the
     * import.
     *
     * Matched against the import lines rather than the whole file, because the
     * shell's own comment explains why react-dnd is not there and would
     * otherwise trip a naive search.
     */
    const imports = appSource
      .split("\n")
      .filter((line) => line.trimStart().startsWith("import "))
      .join("\n");

    expect(imports).not.toContain("react-dnd");
    expect(imports).not.toContain("DndProvider");
  });

  it("wraps the cable-wiring bench in its own provider", () => {
    const element = CableWiringChallenge();

    expect(element.type).toBe(DndProvider);
    expect((element.props as { backend: unknown }).backend).toBe(HTML5Backend);
  });

  it("wraps the workspace canvas in its own provider", () => {
    const element = Workspace();

    expect(element.type).toBe(DndProvider);
    expect((element.props as { backend: unknown }).backend).toBe(HTML5Backend);
  });

  it("carries its own provider on the computer-assembly page too", async () => {
    // The page that always had one. Now that the app-wide provider is gone it
    // is the only one, rather than a second backend fighting the first. Checked
    // in source because its provider sits inside the component that uses hooks,
    // so there is no wrapper to call — and matched on the JSX tag rather than
    // the bare name, which the import line would satisfy on its own.
    const source = (await import("./ComputerAssemblyChallenge?raw")).default;

    expect(source).toContain("<DndProvider backend={HTML5Backend}>");
  });

  it("still renders the cable-wiring bench end to end", () => {
    // Not a provider check — see the note at the top of this file — but the
    // page must still mount, with its provider now above it.
    render(
      <MemoryRouter initialEntries={["/challenge/cable-wiring"]}>
        <CableWiringChallenge />
      </MemoryRouter>,
    );

    expect(screen.getByText("Untwist")).toBeInTheDocument();
    expect(screen.getByText("Arrange")).toBeInTheDocument();
    expect(screen.getByText("Crimp")).toBeInTheDocument();
  });
});
