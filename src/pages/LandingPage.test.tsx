// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { LandingPage } from "./LandingPage";

vi.mock("@/features/content/publicSummary", () => ({
  fetchPublicSummary: vi.fn(),
}));

const service = await import("@/features/content/publicSummary");

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(service.fetchPublicSummary).mockReset();
});

afterEach(cleanup);

/** The hero's count strip, once the summary has landed. */
async function heroStats(container: HTMLElement) {
  await vi.waitFor(() => expect(container.querySelector("#home dl dd")).toBeTruthy());
  return [...container.querySelectorAll("#home dl > div")].map((stat) => [
    stat.querySelector("dt")!.textContent,
    stat.querySelector("dd")!.textContent,
  ]);
}

it("puts the API's counts in the hero strip, not any fixed in the page", async () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 9, challenges: 31 });

  const { container } = renderPage();

  expect(await heroStats(container)).toEqual([
    ["Topics", "9"],
    ["Interactive challenges", "31"],
  ]);
});

it("names a single topic and challenge in the singular", async () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 1, challenges: 1 });

  const { container } = renderPage();

  expect(await heroStats(container)).toEqual([
    ["Topic", "1"],
    ["Interactive challenge", "1"],
  ]);
});

it("shows no count in the strip while the summary loads", () => {
  vi.mocked(service.fetchPublicSummary).mockReturnValue(new Promise(() => {}));

  const { container } = renderPage();

  const stats = container.querySelector("#home dl")!;
  expect(stats.getAttribute("aria-busy")).toBe("true");
  expect(stats.textContent).toBe("");
});

it("drops the counts from the strip, keeping its highlights, when the API fails", async () => {
  vi.mocked(service.fetchPublicSummary).mockRejectedValue(new Error("down"));

  const { container } = renderPage();
  await vi.waitFor(() => expect(container.querySelector("#home dl")).toBeNull());

  const hero = container.querySelector<HTMLElement>("#home")!;
  expect(hero.textContent).not.toMatch(/\d/);
  for (const highlight of ["Free to sign up", "Runs in your browser", "Drag-and-drop activities"]) {
    expect(within(hero).getByText(highlight)).toBeTruthy();
  }
});

it("shows the BASC IT Laboratory Building, described for screen readers", () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 5, challenges: 22 });

  renderPage();

  const photo = screen.getByRole("img", {
    name: "The BASC Information Technology Laboratory Building",
  });
  expect(photo.getAttribute("src")).toBe("/landing/basc-it-building.jpg");
});

it("has exactly one top-level heading", () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 5, challenges: 22 });

  renderPage();

  const headings = screen.getAllByRole("heading", { level: 1 });
  expect(headings).toHaveLength(1);
  expect(headings[0].textContent).toMatch(/Learn Networking\s*by Building\s*and Doing/);
});

it("keeps the sections the navigation jumps to", () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 5, challenges: 22 });

  const { container } = renderPage();

  for (const id of ["home", "features", "about"]) {
    expect(container.querySelector(`#${id}`)).toBeTruthy();
    expect(container.querySelector(`nav a[href="#${id}"]`)).toBeTruthy();
  }
});

it("still renders, with no invented counts, when the API fails", async () => {
  vi.mocked(service.fetchPublicSummary).mockRejectedValue(new Error("down"));

  const { container } = renderPage();

  expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Learn Networking/);
  await vi.waitFor(() => expect(service.fetchPublicSummary).toHaveBeenCalled());
  expect(container.textContent).not.toMatch(/\d+ topics?/);
  expect(container.textContent).not.toMatch(/\d+ interactive challenges?/);
});

it("keeps the fictional network dashboard and old claims out", async () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 5, challenges: 22 });

  const { container } = renderPage();
  await heroStats(container);

  for (const gone of [
    "Wi-Fi",
    "2.4 GHz",
    "Clients connected",
    "VLAN",
    "Active devices",
    "Live topology",
    "Online",
    "Stable",
    "Server",
    "Master Networking",
  ]) {
    expect(container.textContent).not.toContain(gone);
  }
});

it("shows the network workspace as an example card among the activities", async () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 5, challenges: 22 });

  const { container } = renderPage();
  await heroStats(container);

  const card = within(container.querySelector<HTMLElement>("#features")!)
    .getByRole("heading", { level: 4, name: "Network Simulation" })
    .closest("li")!;
  expect(card.textContent).toContain("Example");
  expect(container.querySelector("#home")!.textContent).not.toContain("Network Simulation");
  expect(container.querySelector("#about")!.textContent).not.toContain("Network Simulation");
});

it("says each activity once, without a second list of them in About", async () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 5, challenges: 22 });

  const { container } = renderPage();
  await heroStats(container);

  const about = container.querySelector("#about")!;
  expect(about.textContent).not.toContain("What you will practice");
  expect(about.querySelector("li")).toBeNull();
});

it("links visitors only to pages they can open without signing in", async () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 5, challenges: 22 });

  const { container } = renderPage();
  await heroStats(container);

  const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
  for (const guarded of ["/roadmap", "/workspace", "/challenges"]) {
    expect(hrefs).not.toContain(guarded);
  }
});

it("calls signing in the same thing everywhere", async () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 5, challenges: 22 });

  const { container } = renderPage();
  await heroStats(container);

  const toLogin = screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("href") === "/login");
  expect(toLogin.length).toBeGreaterThan(0);
  for (const link of toLogin) {
    expect(link.textContent).toBe("Sign In");
  }
});

it("shows each activity with the artwork the activity itself uses", async () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 5, challenges: 22 });

  const { container } = renderPage();
  await heroStats(container);

  const features = within(container.querySelector<HTMLElement>("#features")!);
  for (const title of ["PC Assembly", "Motherboard Identification", "RJ45 Cable Wiring", "Network Simulation"]) {
    expect(features.getByRole("heading", { level: 4, name: title })).toBeTruthy();
  }

  const sources = [...container.querySelectorAll("#features img")].map((img) => img.getAttribute("src"));
  expect(sources).toContain("/build-state-7.webp");
  expect(sources).toContain("/motherboards/atx-basic-v1.svg");
  expect(sources).toContain("/landing/cable-bench.svg");
  // The pictures are decoration: each card's heading and text say what it shows.
  for (const img of container.querySelectorAll("#features img")) {
    expect(img.getAttribute("alt")).toBe("");
  }
});

it("lays the navigation over the hero photo, turning it solid once the page scrolls", async () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 5, challenges: 22 });

  const { container } = renderPage();
  await heroStats(container);
  const nav = screen.getByRole("navigation", { name: "Primary" });

  // At the top, over the photo: only the light-on-dark logo is announced.
  expect(nav.getAttribute("data-solid")).toBe("false");
  expect(within(nav).getAllByRole("img", { name: "NetSim" })).toHaveLength(1);

  try {
    Object.defineProperty(window, "scrollY", { value: 400, configurable: true });
    fireEvent.scroll(window);
    expect(nav.getAttribute("data-solid")).toBe("true");
    expect(within(nav).getAllByRole("img", { name: "NetSim" })).toHaveLength(1);

    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    fireEvent.scroll(window);
    expect(nav.getAttribute("data-solid")).toBe("false");
  } finally {
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  }
});

it("says who NetSim is for: BASC's IT students, with the college named in full", async () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 5, challenges: 22 });

  const { container } = renderPage();
  await heroStats(container);

  const hero = container.querySelector("#home")!.textContent;
  expect(hero).toContain("Networking Simulation for BASC IT Students");
  expect(hero).toContain("NetSim helps BASC IT students");
  expect(container.querySelector("#about")!.textContent).toContain(
    "Bulacan Agricultural State College (BASC)",
  );
  expect(container.querySelector("footer")!.textContent).toContain(
    "Networking simulation platform for BASC IT students",
  );
});

it("keeps the learning path a list of its five steps, with its line beside it", async () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 5, challenges: 22 });

  const { container } = renderPage();
  await heroStats(container);

  const path = container.querySelector("#features ol")!;
  expect([...path.children].map((child) => child.tagName)).toEqual(["LI", "LI", "LI", "LI", "LI"]);
  expect(within(path as HTMLElement).getAllByRole("listitem")).toHaveLength(5);
});

it("heads the activity cards one level below the section that holds them", async () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 5, challenges: 22 });

  const { container } = renderPage();
  await heroStats(container);

  const levels = [...container.querySelectorAll("#features :is(h2, h3, h4)")].map((heading) => [
    heading.tagName,
    heading.textContent,
  ]);
  expect(levels).toEqual([
    ["H2", "Learn the Basics by Doing Them"],
    ["H3", "See It in Action"],
    ["H4", "PC Assembly"],
    ["H4", "Motherboard Identification"],
    ["H4", "RJ45 Cable Wiring"],
    ["H4", "Network Simulation"],
  ]);
});

it("tells a screen reader, once, that the network picture is an example", async () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 5, challenges: 22 });

  const { container } = renderPage();
  await heroStats(container);

  const card = within(container.querySelector<HTMLElement>("#features")!)
    .getByRole("heading", { level: 4, name: "Network Simulation" })
    .closest("li")!;
  const hidden = (element: Element) => element.closest('[aria-hidden="true"]') !== null;
  const mentions = [...card.querySelectorAll("*")].filter(
    (element) => element.children.length === 0 && /example/i.test(element.textContent ?? ""),
  );

  // The badge is part of the picture, hidden with it; the note is the one a
  // screen reader hears.
  expect(mentions.filter(hidden).map((element) => element.textContent)).toEqual(["Example"]);
  expect(mentions.filter((element) => !hidden(element)).map((element) => element.textContent)).toEqual([
    "The picture is an example network layout, not a screenshot of the workspace.",
  ]);
});

it("gives each PC-assembly stage name the thumbnail's full width, its number on the picture", async () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 5, challenges: 22 });

  const { container } = renderPage();
  await heroStats(container);

  // On a 320-360px phone "2. Motherboard" did not fit under its thumbnail;
  // the number now sits on the thumbnail, so the label is the name alone.
  expect(screen.getAllByTestId("stage-label").map((label) => label.textContent)).toEqual([
    "Case",
    "Motherboard",
    "Memory",
    "Complete",
  ]);
  expect(screen.getAllByTestId("stage-number").map((number) => number.textContent)).toEqual([
    "1",
    "2",
    "3",
    "4",
  ]);
});
