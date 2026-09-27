// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PasswordInput } from "./password-input";

/**
 * The show/hide toggle on every password field.
 *
 * What matters is that it is only a view switch: the value, the form's submit
 * and the attributes the field was given all stay exactly as they were.
 */

afterEach(cleanup);

function renderField(props: Partial<React.ComponentProps<typeof PasswordInput>> = {}) {
  return render(
    <label>
      Password
      <PasswordInput id="pw" defaultValue="s3cret-pass" {...props} />
    </label>,
  );
}

describe("PasswordInput", () => {
  it("starts hidden and offers to show", () => {
    renderField();

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  });

  it("shows and hides again, naming the next action each time", async () => {
    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide).toHaveAttribute("title", "Hide password");

    await user.click(hide);

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute(
      "title",
      "Show password",
    );
  });

  it("never changes the value", async () => {
    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveValue("s3cret-pass");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("Password")).toHaveValue("s3cret-pass");
  });

  it("works from the keyboard", async () => {
    const user = userEvent.setup();
    renderField();

    await user.tab();
    expect(screen.getByLabelText("Password")).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: "Show password" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");

    await user.keyboard(" ");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("says which field it controls", () => {
    renderField();

    expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute(
      "aria-controls",
      "pw",
    );
  });

  it("does not submit the form it sits in", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <PasswordInput aria-label="Password" defaultValue="x" />
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("passes the field's own attributes through", () => {
    renderField({ autoComplete: "current-password", placeholder: "Enter it", "aria-invalid": true });

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("autocomplete", "current-password");
    expect(input).toHaveAttribute("placeholder", "Enter it");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("is disabled along with the field", () => {
    renderField({ disabled: true });

    expect(screen.getByLabelText("Password")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Show password" })).toBeDisabled();
  });
});
