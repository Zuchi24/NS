// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChangePasswordCard } from "./ChangePasswordCard";

/**
 * Changing your own password from the profile.
 *
 * The API client is stubbed rather than the auth service, so these also say
 * what goes over the wire: the three fields, and nothing naming a user. The
 * session ends through the app's own logout on success, because the server
 * revoked every token the account held.
 */

const navigate = vi.fn();
const logout = vi.fn();

vi.mock("react-router", () => ({ useNavigate: () => navigate }));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ logout }),
}));

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();

  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { api, ApiError } = await import("@/services/api");
const { toast } = await import("sonner");

const CURRENT = "old-password-123";
const NEXT = "new-password-456";

async function fill(current: string, password: string, confirmation: string) {
  const user = userEvent.setup();

  if (current) await user.type(screen.getByLabelText("Current password"), current);
  if (password) await user.type(screen.getByLabelText("New password"), password);
  if (confirmation) await user.type(screen.getByLabelText("Confirm new password"), confirmation);
  await user.click(screen.getByRole("button", { name: "Change password" }));

  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  logout.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("changing your own password", () => {
  it("asks for the current password and the new one twice", () => {
    render(<ChangePasswordCard />);

    const form = screen.getByRole("form", { name: "Change password" });

    expect(form).toContainElement(screen.getByLabelText("Current password"));
    expect(screen.getByLabelText("New password")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Confirm new password")).toHaveAttribute("type", "password");
    expect(screen.getByText(/signs you out on every device/)).toBeInTheDocument();
  });

  it("sends the three fields, and nothing that names a user", async () => {
    vi.mocked(api.put).mockResolvedValue({
      message: "Password changed. Sign in again with your new password.",
    });
    render(<ChangePasswordCard />);

    await fill(CURRENT, NEXT, NEXT);

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/password", {
        current_password: CURRENT,
        password: NEXT,
        password_confirmation: NEXT,
      }),
    );
  });

  it("says so, ends the session and goes to sign in", async () => {
    vi.mocked(api.put).mockResolvedValue({
      message: "Password changed. Sign in again with your new password.",
    });
    render(<ChangePasswordCard />);

    await fill(CURRENT, NEXT, NEXT);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/login", { replace: true }));
    expect(toast.success).toHaveBeenCalledWith(
      "Password changed. Sign in again with your new password.",
    );
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["", NEXT, NEXT, "Enter your current password."],
    [CURRENT, "", "", "Enter a new password."],
    [CURRENT, "short", "short", "Use at least 8 characters."],
    [CURRENT, NEXT, "new-password-999", "The two new passwords do not match."],
  ])("refuses %j / %j / %j before asking the server", async (current, password, confirmation, message) => {
    render(<ChangePasswordCard />);

    await fill(current, password, confirmation);

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });

  it("shows a wrong current password against that field, and stays signed in", async () => {
    vi.mocked(api.put).mockRejectedValue(
      new ApiError("Your current password is not correct.", 422, {
        current_password: ["Your current password is not correct."],
      }),
    );
    render(<ChangePasswordCard />);

    await fill("not-my-password", NEXT, NEXT);

    expect(await screen.findByText("Your current password is not correct.")).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toHaveAttribute("aria-invalid", "true");
    expect(logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows the server's rule for the new password against that field", async () => {
    vi.mocked(api.put).mockRejectedValue(
      new ApiError("The given data was invalid.", 422, {
        password: ["The password field must be at least 8 characters."],
      }),
    );
    render(<ChangePasswordCard />);

    await fill(CURRENT, NEXT, NEXT);

    expect(
      await screen.findByText("The password field must be at least 8 characters."),
    ).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });

  it("shows any other failure in the server's words, and stays signed in", async () => {
    vi.mocked(api.put).mockRejectedValue(new ApiError("Too Many Attempts.", 429));
    render(<ChangePasswordCard />);

    await fill(CURRENT, NEXT, NEXT);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Too Many Attempts."));
    expect(logout).not.toHaveBeenCalled();
  });

  it("sends one change however quickly it is clicked", async () => {
    let finish!: (value: { message: string }) => void;
    vi.mocked(api.put).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<ChangePasswordCard />);

    const user = await fill(CURRENT, NEXT, NEXT);

    const pending = screen.getByRole("button", { name: "Changing…" });
    expect(pending).toBeDisabled();
    await user.click(pending);

    expect(api.put).toHaveBeenCalledTimes(1);
    finish({ message: "done" });
    await waitFor(() => expect(navigate).toHaveBeenCalled());
  });
});
