// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
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

it("shows the counts the API reports, not any fixed in the page", async () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 9, challenges: 31 });

  renderPage();

  expect(await screen.findByText(/9 topics and 31 interactive challenges/)).toBeTruthy();
});

it("follows the catalogue when it changes", async () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 1, challenges: 1 });

  renderPage();

  expect(await screen.findByText(/1 topic and 1 interactive challenge to/)).toBeTruthy();
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
  await screen.findByText(/5 topics/);

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

it("labels the network illustration as an example", async () => {
  vi.mocked(service.fetchPublicSummary).mockResolvedValue({ topics: 5, challenges: 22 });

  const { container } = renderPage();
  await screen.findByText(/5 topics/);

  expect(container.textContent).toContain("Interactive Network Simulation");
  expect(container.textContent).toContain("Example");
});
