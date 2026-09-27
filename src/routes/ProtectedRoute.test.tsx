// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

import { ProtectedRoute } from "./ProtectedRoute";
import type { User } from "@/features/auth/types";

/**
 * The signed-in gate, and the one place an account that must confirm its
 * address is sent to do so.
 *
 * With the real switch — still off — nothing changes for anyone. With the
 * rule switched on (stubbed here), every signed-in page sends an unverified
 * account to /verify-email, remembering where it was headed, and the
 * verification page itself is not a loop.
 */

const auth = vi.hoisted(() => ({
  state: { user: null as User | null, loading: false },
  enforced: { value: false },
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({
    user: auth.state.user,
    isAuthenticated: auth.state.user !== null,
    loading: auth.state.loading,
  }),
}));

vi.mock("@/features/auth/verification", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth/verification")>();

  return {
    ...actual,
    mustVerifyEmail: (user: User | null) =>
      auth.enforced.value ? user !== null && user.emailVerified === false : actual.mustVerifyEmail(user),
  };
});

const student: User = {
  id: 7,
  name: "Ana Reyes",
  firstName: "Ana",
  lastName: "Reyes",
  studentId: null,
  email: "ana@example.com",
  emailVerified: false,
  role: "student",
  joinedAt: null,
  section: null,
};

function Where() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  return (
    <output data-testid="where">
      {location.pathname}
      {from ? ` from ${from}` : ""}
    </output>
  );
}

function visit(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/verify-email" element={<p>verification page</p>} />
          <Route path="/roadmap" element={<p>roadmap page</p>} />
          <Route path="/dashboard" element={<p>dashboard page</p>} />
        </Route>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  auth.state.user = student;
  auth.state.loading = false;
  auth.enforced.value = false;
});

afterEach(cleanup);

describe("while verification is not enforced", () => {
  it("lets an unverified account open any signed-in page", () => {
    visit("/roadmap");

    expect(screen.getByText("roadmap page")).toBeInTheDocument();
  });

  it("still lets it open the verification page", () => {
    visit("/verify-email");

    expect(screen.getByText("verification page")).toBeInTheDocument();
  });

  it("still sends a signed-out visitor to log in", () => {
    auth.state.user = null;
    visit("/roadmap");

    expect(screen.getByTestId("where")).toHaveTextContent("/login from /roadmap");
  });
});

describe("once verification is enforced", () => {
  beforeEach(() => {
    auth.enforced.value = true;
  });

  it("sends an unverified account to verify, remembering where it was going", () => {
    visit("/roadmap");

    expect(screen.queryByText("roadmap page")).not.toBeInTheDocument();
    expect(screen.getByText("verification page")).toBeInTheDocument();
  });

  it("does not send it round in a loop from the verification page", () => {
    visit("/verify-email");

    expect(screen.getByText("verification page")).toBeInTheDocument();
  });

  it("lets a verified account through", () => {
    auth.state.user = { ...student, emailVerified: true };
    visit("/roadmap");

    expect(screen.getByText("roadmap page")).toBeInTheDocument();
  });

  it("does not trap an account whose state is not known", () => {
    auth.state.user = { ...student, emailVerified: undefined };
    visit("/dashboard");

    expect(screen.getByText("dashboard page")).toBeInTheDocument();
  });

  it("waits for the session before deciding anything", () => {
    auth.state.loading = true;
    visit("/roadmap");

    expect(screen.queryByText("roadmap page")).not.toBeInTheDocument();
    expect(screen.queryByText("verification page")).not.toBeInTheDocument();
  });
});
