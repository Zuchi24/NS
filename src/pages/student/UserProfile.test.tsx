// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { User } from "@/features/auth/types";

/**
 * The student's own profile: their name, their picture, and everything else
 * shown as the server holds it.
 *
 * The API client is stubbed rather than the profile service, so these also say
 * what goes over the wire — exactly the three name fields, and a picture under
 * `avatar` — and that the account on screen is only ever changed by reading it
 * again through refreshUser().
 */

const refreshUser = vi.fn();

const BASE_USER: User = {
  id: 7,
  name: "Juan Dela Cruz Jr.",
  firstName: "Juan",
  lastName: "Dela Cruz",
  extendedName: "Jr.",
  studentId: "2026-0001",
  email: "juan@example.com",
  emailVerified: true,
  role: "student",
  joinedAt: "2026-09-01T00:00:00Z",
  avatarUrl: null,
  section: { id: 3, name: "Section A", yearLevel: "Grade 11" },
};

let currentUser: User = BASE_USER;

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: currentUser, refreshUser }),
}));

// The password card has its own tests; here it is only somewhere on the page.
vi.mock("@/features/auth/ChangePasswordCard", () => ({
  ChangePasswordCard: () => <section aria-label="Change password" />,
}));

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();

  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      upload: vi.fn(),
      download: vi.fn(),
    },
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { api, ApiError } = await import("@/services/api");
const { toast } = await import("sonner");
const { UserProfile } = await import("./UserProfile");

beforeAll(() => {
  // jsdom has no object URLs.
  Object.assign(URL, {
    createObjectURL: vi.fn(() => "blob:avatar"),
    revokeObjectURL: vi.fn(),
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = BASE_USER;
  refreshUser.mockResolvedValue(undefined);
  vi.mocked(api.put).mockResolvedValue({ data: {} });
  vi.mocked(api.upload).mockResolvedValue({ data: {} });
  vi.mocked(api.delete).mockResolvedValue(undefined);
  vi.mocked(api.download).mockResolvedValue(new Blob(["png"], { type: "image/png" }));
});

afterEach(cleanup);

function validationError(errors: Record<string, string[]>) {
  return new ApiError("The given data was invalid.", 422, errors);
}

function file(name: string, type: string, bytes = 10): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

function chooseFile(chosen: File) {
  fireEvent.change(screen.getByTestId("avatar-input"), { target: { files: [chosen] } });
}

async function openEditor() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Edit" }));
  return user;
}

describe("the details", () => {
  it("shows the account as the server holds it", () => {
    render(<UserProfile />);

    for (const text of ["juan@example.com", "2026-0001", "Juan", "Dela Cruz", "Jr.", "Grade 11", "Section A"]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("STUDENT")).toBeTruthy();
    expect(screen.queryByText(/not available yet/i)).toBeNull();
  });

  it("opens the three name fields, filled in, and nothing else as a field", async () => {
    render(<UserProfile />);
    await openEditor();

    expect((screen.getByLabelText("First name") as HTMLInputElement).value).toBe("Juan");
    expect((screen.getByLabelText("Last name") as HTMLInputElement).value).toBe("Dela Cruz");
    expect((screen.getByLabelText(/Name extension/) as HTMLInputElement).value).toBe("Jr.");

    // Email and student id are shown, never offered as inputs.
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
    expect(screen.queryByDisplayValue("juan@example.com")).toBeNull();
    expect(screen.queryByDisplayValue("2026-0001")).toBeNull();
    expect(screen.getByText("juan@example.com")).toBeTruthy();
    expect(screen.getByText("2026-0001")).toBeTruthy();
  });
});

describe("saving the name", () => {
  it("sends exactly the three fields, then reads the account again", async () => {
    render(<UserProfile />);
    const user = await openEditor();

    await user.clear(screen.getByLabelText("First name"));
    await user.type(screen.getByLabelText("First name"), "Maria");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(refreshUser).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledWith("/profile", {
      first_name: "Maria",
      last_name: "Dela Cruz",
      extended_name: "Jr.",
    });
    expect(toast.success).toHaveBeenCalled();
    // Back to the details once it is saved.
    expect(screen.queryByRole("form", { name: "Edit your name" })).toBeNull();
  });

  it("sends an emptied extension as null, which clears it", async () => {
    render(<UserProfile />);
    const user = await openEditor();

    await user.clear(screen.getByLabelText(/Name extension/));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(vi.mocked(api.put).mock.calls[0][1]).toEqual({
      first_name: "Juan",
      last_name: "Dela Cruz",
      extended_name: null,
    });
  });

  it("puts back what was there on Cancel, and sends nothing", async () => {
    render(<UserProfile />);
    const user = await openEditor();

    await user.clear(screen.getByLabelText("First name"));
    await user.type(screen.getByLabelText("First name"), "Changed");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.put).not.toHaveBeenCalled();
    expect(screen.getByText("Juan")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect((screen.getByLabelText("First name") as HTMLInputElement).value).toBe("Juan");
  });

  it("asks for a first and last name before sending anything", async () => {
    render(<UserProfile />);
    const user = await openEditor();

    await user.clear(screen.getByLabelText("First name"));
    await user.clear(screen.getByLabelText("Last name"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Enter your first name.")).toBeTruthy();
    expect(screen.getByText("Enter your last name.")).toBeTruthy();
    expect(api.put).not.toHaveBeenCalled();
  });

  it("shows the server's refusal against the field it is about, and stays open", async () => {
    vi.mocked(api.put).mockRejectedValue(
      validationError({ last_name: ["The last name field must not be greater than 255 characters."] }),
    );
    render(<UserProfile />);
    const user = await openEditor();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/must not be greater than 255/)).toBeTruthy();
    expect(screen.getByLabelText("Last name").getAttribute("aria-invalid")).toBe("true");
    expect(refreshUser).not.toHaveBeenCalled();
    expect(screen.getByRole("form", { name: "Edit your name" })).toBeTruthy();
  });

  it("says any other failure in the server's words", async () => {
    vi.mocked(api.put).mockRejectedValue(new ApiError("Cannot reach the server.", 0));
    render(<UserProfile />);
    const user = await openEditor();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Cannot reach the server."));
    expect(screen.getByRole("form", { name: "Edit your name" })).toBeTruthy();
  });

  it("sends one save however quickly it is pressed, and shows that it is saving", async () => {
    let finish!: () => void;
    vi.mocked(api.put).mockReturnValue(new Promise((resolve) => (finish = () => resolve({ data: {} }))));
    render(<UserProfile />);
    await openEditor();

    const save = screen.getByRole("button", { name: "Save" });
    fireEvent.click(save);
    fireEvent.click(save);
    fireEvent.click(save);

    expect(api.put).toHaveBeenCalledTimes(1);
    const saving = await screen.findByRole("button", { name: "Saving…" });
    expect((saving as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("First name") as HTMLInputElement).disabled).toBe(true);

    finish();
    await waitFor(() => expect(refreshUser).toHaveBeenCalledTimes(1));
  });
});

describe("the picture", () => {
  it("shows initials when there is none, and fetches nothing", () => {
    render(<UserProfile />);

    expect(screen.getByText("JDCJ")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add photo/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Remove photo/ })).toBeNull();
    expect(api.download).not.toHaveBeenCalled();
  });

  it("fetches the picture with the token and shows it", async () => {
    currentUser = { ...BASE_USER, avatarUrl: "http://localhost:8000/api/profile/avatar?v=abc123abc123" };
    render(<UserProfile />);

    const image = await screen.findByRole("img", { name: /profile photo/ });

    expect(image.getAttribute("src")).toBe("blob:avatar");
    expect(api.download).toHaveBeenCalledWith("/profile/avatar?v=abc123abc123");
  });

  it("uploads a chosen picture under `avatar`, then reads the account again", async () => {
    render(<UserProfile />);

    const picture = file("me.png", "image/png");
    chooseFile(picture);

    await waitFor(() => expect(refreshUser).toHaveBeenCalledTimes(1));
    expect(api.upload).toHaveBeenCalledTimes(1);

    const [path, form] = vi.mocked(api.upload).mock.calls[0];
    expect(path).toBe("/profile/avatar");
    expect((form as FormData).get("avatar")).toBe(picture);
    expect(toast.success).toHaveBeenCalledWith("Profile photo added.");
  });

  it("replaces an existing picture the same way, and says it was replaced", async () => {
    currentUser = { ...BASE_USER, avatarUrl: "http://localhost:8000/api/profile/avatar?v=111111111111" };
    render(<UserProfile />);

    expect(screen.getByRole("button", { name: /Change photo/ })).toBeTruthy();
    chooseFile(file("new.jpg", "image/jpeg"));

    await waitFor(() => expect(refreshUser).toHaveBeenCalledTimes(1));
    expect(api.upload).toHaveBeenCalledWith("/profile/avatar", expect.any(FormData));
    expect(toast.success).toHaveBeenCalledWith("Profile photo replaced.");
  });

  it.each([
    ["a GIF", file("me.gif", "image/gif"), /JPEG, PNG or WebP/],
    ["an SVG", file("me.svg", "image/svg+xml"), /JPEG, PNG or WebP/],
    ["a picture over 2 MB", file("big.png", "image/png", 2 * 1024 * 1024 + 1), /larger than 2 MB/],
  ])("refuses %s before sending anything", (_label, chosen, message) => {
    render(<UserProfile />);

    chooseFile(chosen);

    expect(screen.getByRole("alert").textContent).toMatch(message);
    expect(api.upload).not.toHaveBeenCalled();
  });

  it("shows the server's refusal of a picture", async () => {
    vi.mocked(api.upload).mockRejectedValue(validationError({ avatar: ["Use a JPEG, PNG or WebP image."] }));
    render(<UserProfile />);

    chooseFile(file("me.png", "image/png"));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Use a JPEG, PNG or WebP image.");
    expect(refreshUser).not.toHaveBeenCalled();
  });

  it("disables the picture controls while an upload is in flight", async () => {
    let finish!: () => void;
    vi.mocked(api.upload).mockReturnValue(new Promise((resolve) => (finish = () => resolve({ data: {} }))));
    render(<UserProfile />);

    chooseFile(file("me.png", "image/png"));

    const uploading = await screen.findByRole("button", { name: /Uploading…/ });
    expect((uploading as HTMLButtonElement).disabled).toBe(true);

    finish();
    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
  });

  it("removes the picture only once it is confirmed, then reads the account again", async () => {
    currentUser = { ...BASE_USER, avatarUrl: "http://localhost:8000/api/profile/avatar?v=111111111111" };
    const user = userEvent.setup();
    render(<UserProfile />);

    await user.click(screen.getByRole("button", { name: /Remove photo/ }));
    expect(api.delete).not.toHaveBeenCalled();

    const confirm = screen.getByRole("alertdialog", { name: "Remove profile photo?" });
    expect(confirm).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(refreshUser).toHaveBeenCalledTimes(1));
    expect(api.delete).toHaveBeenCalledWith("/profile/avatar");
    expect(toast.success).toHaveBeenCalledWith("Profile photo removed.");
  });

  it("keeps the picture when removing it is called off", async () => {
    currentUser = { ...BASE_USER, avatarUrl: "http://localhost:8000/api/profile/avatar?v=111111111111" };
    const user = userEvent.setup();
    render(<UserProfile />);

    await user.click(screen.getByRole("button", { name: /Remove photo/ }));
    await user.click(screen.getByRole("button", { name: "Keep photo" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(api.delete).not.toHaveBeenCalled();
  });
});
