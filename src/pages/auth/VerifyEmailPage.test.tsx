// @vitest-environment jsdom

import { useState } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

import { VerifyEmailPage } from "./VerifyEmailPage";
import { AuthContext } from "@/features/auth/AuthContext";
import type { AuthContextValue } from "@/features/auth/AuthContext";
import type { User } from "@/features/auth/types";
import { ApiError } from "@/services/api";

/**
 * Confirming an email address with an emailed code.
 *
 * The API is stubbed; the signed-in user is real state in a real auth
 * context, so verifying — or learning the account already is verified — moves
 * the page on exactly as it would in the app. Every limit is the server's:
 * these check the page shows what it was told and asks nothing of its own.
 */

vi.mock("@/features/auth/authService", () => ({
  requestEmailVerificationCode: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { requestEmailVerificationCode } = await import("@/features/auth/authService");

const student: User = {
  id: 7,
  name: "Ana Reyes",
  firstName: "Ana",
  lastName: "Reyes",
  studentId: "2026-00017",
  email: "ana@example.com",
  emailVerified: false,
  role: "student",
  joinedAt: null,
  section: { id: 3, name: "BSIT 1-A", yearLevel: "1st Year" },
};

const verifyEmailCode = vi.fn<(code: string) => Promise<User>>();
const refreshUser = vi.fn<() => Promise<void>>();
const logout = vi.fn<() => Promise<void>>();

/** Where the app is, so a test can see where the page sent it. */
function Where() {
  const location = useLocation();

  return <output data-testid="where">{location.pathname}</output>;
}

/** A signed-in session whose user can change, as the real provider's does. */
function Session({ initial, children }: { initial: User; children: ReactNode }) {
  const [user, setUser] = useState<User | null>(initial);

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isAdmin: user?.role === "admin",
    loading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: async () => {
      await logout();
      setUser(null);
    },
    refreshUser: async () => {
      await refreshUser();
      setUser((current) => (current ? { ...current, emailVerified: true } : current));
    },
    verifyEmailCode: async (code) => {
      const verified = await verifyEmailCode(code);
      setUser(verified);
      return verified;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function renderPage(options: { user?: User; state?: unknown } = {}) {
  return render(
    <Session initial={options.user ?? student}>
      <MemoryRouter initialEntries={[{ pathname: "/verify-email", state: options.state ?? null }]}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </Session>,
  );
}

const codeField = () => screen.getByLabelText("Verification code");
const verifyButton = () => screen.getByRole("button", { name: /verify email|verifying|try again in/i });
const resendButton = () => screen.getByRole("button", { name: /send code|send a new code|sending|resend in/i });

/** Only the clock and the countdown's interval are faked; everything else runs. */
function fakeClock() {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
}

function tick(seconds: number) {
  act(() => {
    vi.advanceTimersByTime(seconds * 1000);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyEmailCode.mockResolvedValue({ ...student, emailVerified: true });
  refreshUser.mockResolvedValue();
  logout.mockResolvedValue();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/*
|--------------------------------------------------------------------------
| The page
|--------------------------------------------------------------------------
*/

describe("the verification page", () => {
  it("asks for the code sent to the account's own address, and nothing more", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Verify your email" })).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByText(/enter the 6-digit code/i)).toBeInTheDocument();
    expect(codeField()).toHaveAttribute("inputmode", "numeric");
    expect(codeField()).toHaveAttribute("autocomplete", "one-time-code");
    expect(codeField()).toHaveFocus();

    // Nothing about the account beyond the address the code goes to.
    expect(screen.queryByText(/2026-00017/)).not.toBeInTheDocument();
    expect(screen.queryByText(/BSIT 1-A/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ana Reyes/)).not.toBeInTheDocument();
  });

  it("does not claim a code was sent when none has been this visit", () => {
    renderPage();

    expect(screen.getByText(/we'll send a verification code to/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send code" })).toBeEnabled();
  });

  it("sends a verified student on to their dashboard", () => {
    renderPage({ user: { ...student, emailVerified: true } });

    expect(screen.getByTestId("where")).toHaveTextContent("/dashboard");
  });

  it("sends a verified admin on to theirs", () => {
    renderPage({ user: { ...student, role: "admin", emailVerified: true } });

    expect(screen.getByTestId("where")).toHaveTextContent("/admin/dashboard");
  });

  it("keeps an account whose state is not known yet, rather than guessing", () => {
    renderPage({ user: { ...student, emailVerified: undefined } });

    expect(screen.getByRole("heading", { name: "Verify your email" })).toBeInTheDocument();
  });
});

/*
|--------------------------------------------------------------------------
| The code
|--------------------------------------------------------------------------
*/

describe("typing the code", () => {
  it("keeps only digits, and at most six", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(codeField(), "12a3 4-5678");

    expect(codeField()).toHaveValue("123456");
  });

  it("takes a pasted code with a space or dash in it", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(codeField());
    await user.paste("482 915");

    expect(codeField()).toHaveValue("482915");
  });

  it("asks for six digits before sending anything", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(codeField(), "4829");
    await user.click(verifyButton());

    expect(screen.getByText("Enter the 6-digit code from the email.")).toBeInTheDocument();
    expect(codeField()).toHaveAttribute("aria-invalid", "true");
    expect(codeField()).toHaveAccessibleDescription("Enter the 6-digit code from the email.");
    expect(verifyEmailCode).not.toHaveBeenCalled();
  });

  it("never keeps the code in the browser's storage", async () => {
    const user = userEvent.setup();
    verifyEmailCode.mockRejectedValue(
      new ApiError("That code is incorrect or has expired.", 422, {
        code: ["That code is incorrect or has expired."],
      }),
    );
    renderPage();

    await user.type(codeField(), "482915");
    await user.click(verifyButton());
    await screen.findByText("That code is incorrect or has expired.");

    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(stored).not.toContain("482915");
  });
});

/*
|--------------------------------------------------------------------------
| Verifying
|--------------------------------------------------------------------------
*/

describe("verifying", () => {
  it("sends the code and goes on to the dashboard once verified", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(codeField(), "482915");
    await user.click(verifyButton());

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/dashboard"));
    expect(verifyEmailCode).toHaveBeenCalledExactlyOnceWith("482915");
  });

  it("returns to where the account was headed", async () => {
    const user = userEvent.setup();
    renderPage({ state: { from: "/roadmap" } });

    await user.type(codeField(), "482915");
    await user.click(verifyButton());

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/roadmap"));
  });

  it("shows the server's refusal under the field, and keeps the code to correct", async () => {
    const user = userEvent.setup();
    verifyEmailCode.mockRejectedValue(
      new ApiError(
        "That code is incorrect or has expired.",
        422,
        { code: ["That code is incorrect or has expired."] },
        { body: { resend_required: false } },
      ),
    );
    renderPage();

    await user.type(codeField(), "482915");
    await user.click(verifyButton());

    expect(await screen.findByText("That code is incorrect or has expired.")).toBeInTheDocument();
    expect(codeField()).toHaveAttribute("aria-invalid", "true");
    expect(codeField()).toHaveValue("482915");
    // Still on the page: a refused code is not verified.
    expect(screen.queryByTestId("where")).not.toBeInTheDocument();
  });

  it("says a new code is needed when the old one is expired or used up", async () => {
    const user = userEvent.setup();
    verifyEmailCode.mockRejectedValue(
      new ApiError(
        "That code is incorrect or has expired.",
        422,
        { code: ["That code is incorrect or has expired."] },
        { body: { resend_required: true } },
      ),
    );
    renderPage();

    await user.type(codeField(), "482915");
    await user.click(verifyButton());

    expect(await screen.findByText("That code can no longer be used. Send a new one to try again.")).toBeInTheDocument();
    expect(codeField()).toHaveValue("");
  });

  it("waits out a limit on verifying, for as long as the server says", async () => {
    fakeClock();
    const user = userEvent.setup();
    verifyEmailCode.mockRejectedValue(
      new ApiError("Too Many Attempts.", 429, {}, { retryAfter: 30 }),
    );
    renderPage();

    await user.type(codeField(), "482915");
    await user.click(verifyButton());

    expect(await screen.findByRole("button", { name: /try again in 30s/i })).toBeDisabled();
    expect(screen.getByText("Too many attempts. Wait a moment before trying again.")).toBeInTheDocument();

    tick(30);
    expect(screen.getByRole("button", { name: "Verify email" })).toBeEnabled();
    expect(verifyEmailCode).toHaveBeenCalledTimes(1);
  });

  it("does not show a server error's own words", async () => {
    const user = userEvent.setup();
    verifyEmailCode.mockRejectedValue(
      new ApiError("SQLSTATE[HY000]: General error in EmailVerificationService.php", 500),
    );
    renderPage();

    await user.type(codeField(), "482915");
    await user.click(verifyButton());

    expect(await screen.findByText("Something went wrong on our side. Please try again in a moment.")).toBeInTheDocument();
    expect(screen.queryByText(/SQLSTATE/)).not.toBeInTheDocument();
  });

  it("announces what happened to a screen reader", async () => {
    const user = userEvent.setup();
    verifyEmailCode.mockRejectedValue(new ApiError("Nope", 500));
    renderPage();

    await user.type(codeField(), "482915");
    await user.click(verifyButton());

    const status = screen.getByRole("status");
    await waitFor(() => expect(status).toHaveTextContent("Something went wrong on our side."));
    expect(status).toHaveAttribute("aria-live", "polite");
  });
});

/*
|--------------------------------------------------------------------------
| Sending a code
|--------------------------------------------------------------------------
*/

describe("sending a code", () => {
  it("sends one, then counts down the server's minute before another", async () => {
    fakeClock();
    const user = userEvent.setup();
    vi.mocked(requestEmailVerificationCode).mockResolvedValue({
      sent: true,
      expires_in: 900,
      resend_available_in: 60,
    });
    renderPage();

    await user.click(resendButton());

    expect(await screen.findByText("We sent a new code. It expires in 15 minutes.")).toBeInTheDocument();
    expect(screen.getByText(/we sent a verification code to/i)).toBeInTheDocument();
    expect(resendButton()).toHaveTextContent("Resend in 60s");
    expect(resendButton()).toBeDisabled();

    tick(18);
    expect(resendButton()).toHaveTextContent("Resend in 42s");

    tick(42);
    expect(resendButton()).toHaveTextContent("Send a new code");
    expect(resendButton()).toBeEnabled();
    expect(requestEmailVerificationCode).toHaveBeenCalledTimes(1);
  });

  it("sends only once however quickly it is pressed", async () => {
    const user = userEvent.setup();
    let answer!: (value: { sent: true; expires_in: number; resend_available_in: number }) => void;
    vi.mocked(requestEmailVerificationCode).mockReturnValue(new Promise((resolve) => (answer = resolve)));
    renderPage();

    await user.click(resendButton());
    await user.click(resendButton());
    await user.click(resendButton());

    expect(resendButton()).toHaveTextContent("Sending…");
    answer({ sent: true, expires_in: 900, resend_available_in: 60 });
    await screen.findByText(/we sent a new code/i);

    expect(requestEmailVerificationCode).toHaveBeenCalledTimes(1);
  });

  it("waits as long as the server says when a code went out too recently", async () => {
    fakeClock();
    const user = userEvent.setup();
    vi.mocked(requestEmailVerificationCode).mockRejectedValue(
      new ApiError("Please wait before requesting another code.", 429, {}, { retryAfter: 42 }),
    );
    renderPage();

    await user.click(resendButton());

    expect(await screen.findByText("Please wait before requesting another code.")).toBeInTheDocument();
    expect(resendButton()).toHaveTextContent("Resend in 42s");
    expect(resendButton()).toBeDisabled();

    tick(42);
    expect(resendButton()).toBeEnabled();
    // Waiting is not retrying: nothing more was asked of the server.
    expect(requestEmailVerificationCode).toHaveBeenCalledTimes(1);
  });

  it("shows the hourly limit in the server's words, with its wait", async () => {
    fakeClock();
    const user = userEvent.setup();
    vi.mocked(requestEmailVerificationCode).mockRejectedValue(
      new ApiError("Too many codes have been requested. Please try again later.", 429, {}, { retryAfter: 1800 }),
    );
    renderPage();

    await user.click(resendButton());

    expect(await screen.findByText("Too many codes have been requested. Please try again later.")).toBeInTheDocument();
    expect(resendButton()).toHaveTextContent("Resend in 30:00");
  });

  it("still waits when a limit gives no figure", async () => {
    fakeClock();
    const user = userEvent.setup();
    vi.mocked(requestEmailVerificationCode).mockRejectedValue(new ApiError("Too Many Attempts.", 429));
    renderPage();

    await user.click(resendButton());

    expect(await screen.findByRole("button", { name: /resend in 60s/i })).toBeDisabled();
  });

  it("says the email could not be sent, without the mail server's details", async () => {
    const user = userEvent.setup();
    vi.mocked(requestEmailVerificationCode).mockRejectedValue(
      new ApiError('Failed to authenticate on SMTP server with username "smtp-user".', 503),
    );
    renderPage();

    await user.click(resendButton());

    expect(await screen.findByText("We could not send the email just now. Please try again in a moment.")).toBeInTheDocument();
    expect(screen.queryByText(/smtp/i)).not.toBeInTheDocument();
    // Nothing went out, so there is nothing to wait for.
    expect(resendButton()).toBeEnabled();
  });

  it("moves on when the account turns out to be verified already", async () => {
    const user = userEvent.setup();
    vi.mocked(requestEmailVerificationCode).mockResolvedValue({ already_verified: true });
    renderPage();

    await user.click(resendButton());

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/dashboard"));
    expect(refreshUser).toHaveBeenCalledTimes(1);
  });

  it("counts down a code sent just before arriving, as sign-up will", async () => {
    fakeClock();
    renderPage({ state: { codeSent: { expiresIn: 900, resendAvailableIn: 60 } } });

    expect(screen.getByText("We sent a new code. It expires in 15 minutes.")).toBeInTheDocument();
    expect(resendButton()).toHaveTextContent("Resend in 60s");

    tick(60);
    expect(resendButton()).toHaveTextContent("Send a new code");
  });

  it("says when the code sent has expired, instead of when it would", async () => {
    fakeClock();
    renderPage({ state: { codeSent: { expiresIn: 900, resendAvailableIn: 60 } } });

    tick(899);
    expect(screen.getByRole("status")).toHaveTextContent("We sent a new code. It expires in 15 minutes.");

    tick(1);
    expect(screen.getByRole("status")).toHaveTextContent("That code has expired. Send a new one.");
    expect(screen.queryByText(/expires in 15 minutes/)).not.toBeInTheDocument();
  });
});

/*
|--------------------------------------------------------------------------
| Leaving
|--------------------------------------------------------------------------
*/

describe("signing out", () => {
  it("signs out and goes to the login page", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /sign out and use a different account/i }));

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/login"));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});

describe("arriving from sign-up", () => {
  it("says when the first code could not be sent, and offers another at once", () => {
    renderPage({ state: { codeSent: null, sendFailed: true } });

    expect(screen.getByRole("status")).toHaveTextContent(
      "We could not send the email just now. Please try again in a moment.",
    );
    expect(screen.getByRole("button", { name: "Send code" })).toBeEnabled();
  });
});
