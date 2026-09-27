// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

import { SignUpPage } from "./SignUpPage";

/**
 * The sign-up form's two password fields, each with its own show/hide
 * toggle, and what signing up does: the same details go to the server, and
 * the new account is taken to confirm its email address, told whether the
 * first code went out.
 */

const signup = vi.fn();

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ signup }),
}));

vi.mock("@/features/auth/authService", () => ({
  fetchSections: vi.fn(async () => [
    { id: 1, code: "1ST", name: "1st Year", sections: [{ id: 11, name: "BSIT 1-A" }] },
  ]),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { toast } = await import("sonner");

/** Where sign-up sent the new account, and what it told the page it sent it to. */
function Where() {
  const location = useLocation();

  return (
    <>
      <output data-testid="where">{location.pathname}</output>
      <output data-testid="state">{JSON.stringify(location.state)}</output>
    </>
  );
}

function renderSignUp() {
  return render(
    <MemoryRouter initialEntries={["/signup"]}>
      <Routes>
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

const password = () => screen.getByLabelText("Password");
const confirmation = () => screen.getByLabelText("Confirm Password");
/** The toggle beside one field — each names the field it controls. */
const toggleFor = (field: HTMLElement) =>
  screen.getAllByRole("button", { name: /show password|hide password/i })
    .find((button) => button.getAttribute("aria-controls") === field.id) as HTMLElement;

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("First Name"), "Ana");
  await user.type(screen.getByPlaceholderText("Last Name"), "Reyes");
  await user.selectOptions(await screen.findByLabelText(/section/i), "11");
  await user.type(screen.getByLabelText("Email"), "Ana@Example.com");
  await user.type(password(), "hunter2-pass");
  await user.type(confirmation(), "hunter2-pass");
}

beforeEach(() => {
  vi.clearAllMocks();
  signup.mockResolvedValue({
    user: { id: 9, name: "Ana Reyes", email: "ana@example.com", emailVerified: false, role: "student" },
    codeSent: { expiresIn: 900, resendAvailableIn: 60 },
    sendFailed: false,
  });
});

afterEach(cleanup);

describe("the password fields", () => {
  it("hides both by default, each with its own toggle", () => {
    renderSignUp();

    expect(password()).toHaveAttribute("type", "password");
    expect(confirmation()).toHaveAttribute("type", "password");
    expect(toggleFor(password())).toHaveAccessibleName("Show password");
    expect(toggleFor(confirmation())).toHaveAccessibleName("Show password");
    expect(toggleFor(password())).not.toBe(toggleFor(confirmation()));
  });

  it("shows and hides the password without touching the confirmation", async () => {
    const user = userEvent.setup();
    renderSignUp();

    await user.type(password(), "hunter2-pass");
    await user.click(toggleFor(password()));

    expect(password()).toHaveAttribute("type", "text");
    expect(password()).toHaveValue("hunter2-pass");
    expect(toggleFor(password())).toHaveAccessibleName("Hide password");
    expect(confirmation()).toHaveAttribute("type", "password");

    await user.click(toggleFor(password()));
    expect(password()).toHaveAttribute("type", "password");
    expect(password()).toHaveValue("hunter2-pass");
  });

  it("shows and hides the confirmation without touching the password", async () => {
    const user = userEvent.setup();
    renderSignUp();

    await user.type(confirmation(), "hunter2-pass");
    await user.click(toggleFor(confirmation()));

    expect(confirmation()).toHaveAttribute("type", "text");
    expect(confirmation()).toHaveValue("hunter2-pass");
    expect(password()).toHaveAttribute("type", "password");

    await user.click(toggleFor(confirmation()));
    expect(confirmation()).toHaveAttribute("type", "password");
  });

  it("is reachable from the keyboard, and toggling is not signing up", async () => {
    const user = userEvent.setup();
    renderSignUp();

    await user.click(password());
    await user.tab();
    expect(toggleFor(password())).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(password()).toHaveAttribute("type", "text");
    expect(signup).not.toHaveBeenCalled();
  });
});

describe("signing up", () => {
  it("sends the same details whether the passwords are shown or not", async () => {
    const user = userEvent.setup();
    renderSignUp();

    await fillForm(user);
    await user.click(toggleFor(password()));
    await user.click(toggleFor(confirmation()));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(signup).toHaveBeenCalledTimes(1));
    expect(signup).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Ana",
        lastName: "Reyes",
        email: "Ana@Example.com",
        password: "hunter2-pass",
        passwordConfirmation: "hunter2-pass",
        sectionId: 11,
      }),
    );
  });

  it("takes a new account to confirm its address, with the code the server sent", async () => {
    const user = userEvent.setup();
    renderSignUp();

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/verify-email"));
    expect(JSON.parse(screen.getByTestId("state").textContent ?? "null")).toEqual({
      from: "/dashboard",
      codeSent: { expiresIn: 900, resendAvailableIn: 60 },
      sendFailed: false,
    });
    expect(toast.success).toHaveBeenCalledWith("Account created successfully!");
  });

  it("still takes it there when the first code could not be sent", async () => {
    const user = userEvent.setup();
    signup.mockResolvedValue({
      user: { id: 9, name: "Ana Reyes", email: "ana@example.com", emailVerified: false, role: "student" },
      codeSent: null,
      sendFailed: true,
    });
    renderSignUp();

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/verify-email"));
    expect(JSON.parse(screen.getByTestId("state").textContent ?? "null")).toMatchObject({
      codeSent: null,
      sendFailed: true,
    });
  });

  it("still refuses passwords that do not match, shown or not", async () => {
    const user = userEvent.setup();
    renderSignUp();

    await fillForm(user);
    await user.clear(confirmation());
    await user.type(confirmation(), "something-else");
    await user.click(toggleFor(confirmation()));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(toast.error).toHaveBeenCalledWith("Passwords do not match");
    expect(signup).not.toHaveBeenCalled();
  });
});
