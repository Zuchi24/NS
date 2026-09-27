// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

import { ProtectedRoute } from "./ProtectedRoute";
import type { User } from "@/features/auth/types";

/**
 * The signed-in gate, and the one place an account that must confirm its
 * address is sent to do so — with the real rule, which is on: every signed-in
 * page sends an unverified student to /verify-email, remembering where it was
 * headed, and the verification page itself is not a loop. Verified students
 * and staff are let through as before.
 */

const auth = vi.hoisted(() => ({
  state: { user: null as User | null, loading: false },
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({
    user: auth.state.user,
    isAuthenticated: auth.state.user !== null,
    loading: auth.state.loading,
  }),
}));

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

function VerificationPage() {
  const from = (useLocation().state as { from?: string } | null)?.from;

  return <p>verification page{from ? ` from ${from}` : ""}</p>;
}

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
          <Route path="/verify-email" element={<VerificationPage />} />
          <Route path="/roadmap" element={<p>roadmap page</p>} />
          <Route path="/dashboard" element={<p>dashboard page</p>} />
          <Route path="/admin/dashboard" element={<p>admin dashboard page</p>} />
        </Route>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  auth.state.user = student;
  auth.state.loading = false;
});

afterEach(cleanup);

describe("an unverified student", () => {
  it("is sent to verify from any signed-in page, remembering where it was going", () => {
    visit("/roadmap");

    expect(screen.queryByText("roadmap page")).not.toBeInTheDocument();
    expect(screen.getByText("verification page from /roadmap")).toBeInTheDocument();
  });

  it("is not sent round in a loop from the verification page", () => {
    visit("/verify-email");

    expect(screen.getByText("verification page")).toBeInTheDocument();
  });
});

describe("everyone else", () => {
  it("lets a verified student through", () => {
    auth.state.user = { ...student, emailVerified: true };
    visit("/roadmap");

    expect(screen.getByText("roadmap page")).toBeInTheDocument();
  });

  it("lets staff through, verified or not", () => {
    auth.state.user = { ...student, role: "admin", emailVerified: false };
    visit("/admin/dashboard");

    expect(screen.getByText("admin dashboard page")).toBeInTheDocument();
  });

  it("does not trap an account whose state is not known", () => {
    auth.state.user = { ...student, emailVerified: undefined };
    visit("/dashboard");

    expect(screen.getByText("dashboard page")).toBeInTheDocument();
  });

  it("still sends a signed-out visitor to log in", () => {
    auth.state.user = null;
    visit("/roadmap");

    expect(screen.getByTestId("where")).toHaveTextContent("/login from /roadmap");
  });

  it("waits for the session before deciding anything", () => {
    auth.state.loading = true;
    visit("/roadmap");

    expect(screen.queryByText("roadmap page")).not.toBeInTheDocument();
    expect(screen.queryByText(/verification page/)).not.toBeInTheDocument();
  });
});
