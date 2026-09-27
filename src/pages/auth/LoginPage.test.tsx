// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

import { LoginPage } from "./LoginPage";

/**
 * The password toggle on the sign-in form: it is only a view switch, so what
 * gets sent and what is checked before sending are exactly as they were.
 */

const login = vi.fn();

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ login }),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { toast } = await import("sonner");

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <LoginPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  login.mockResolvedValue({ id: 1, name: "Ana", email: "ana@example.com", role: "student" });
});

afterEach(cleanup);

describe("signing in", () => {
  it("hides the password by default", () => {
    renderLogin();

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  });

  it("shows the password on request without changing it", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Password"), "hunter2-pass");
    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Password")).toHaveValue("hunter2-pass");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
    // Toggling is not signing in.
    expect(login).not.toHaveBeenCalled();
  });

  it("sends the same credentials whether the password is shown or not", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter2-pass");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        email: "ana@example.com",
        password: "hunter2-pass",
        remember: false,
      }),
    );
    expect(login).toHaveBeenCalledTimes(1);
  });

  it("still asks for both fields before sending", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Show password" }));
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(toast.error).toHaveBeenCalledWith("Please fill in all fields");
    expect(login).not.toHaveBeenCalled();
  });
});

describe("signing in, now that addresses must be confirmed", () => {
  /** Signs in as the given account, from wherever the app sent them. */
  async function signInAs(account: Record<string, unknown>) {
    const user = userEvent.setup();
    login.mockResolvedValue({ id: 1, name: "Ana", email: "ana@example.com", ...account });
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter2-pass");
    await user.click(screen.getByRole("button", { name: "Login" }));
  }

  it("sends an unverified student to verify, then on to their dashboard", async () => {
    await signInAs({ role: "student", emailVerified: false });

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/verify-email from /dashboard"));
  });

  it("signs a verified student straight in, with no code asked for", async () => {
    await signInAs({ role: "student", emailVerified: true });

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/dashboard"));
    expect(screen.getByTestId("where")).not.toHaveTextContent("verify");
  });

  it("never sends staff to verify", async () => {
    await signInAs({ role: "admin", emailVerified: false });

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/admin/dashboard"));
  });
});

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
