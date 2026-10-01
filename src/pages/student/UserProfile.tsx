import { useRef, useState } from "react";
import { Camera, IdCard, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChangePasswordCard } from "@/features/auth/ChangePasswordCard";
import { useAuth } from "@/features/auth/useAuth";
import type { User } from "@/features/auth/types";
import { ProfileAvatar } from "@/features/profile/ProfileAvatar";
import {
  avatarProblem,
  deleteAvatar,
  updateProfile,
  uploadAvatar,
} from "@/features/profile/profileService";
import type { ProfileNames } from "@/features/profile/profileService";
import { ApiError } from "@/services/api";
import { shortDate } from "@/services/time";

/**
 * The student's own account.
 *
 * Their name and their picture are theirs to change here. Everything else is
 * shown as the server holds it and is not editable: the email address is how
 * they sign in, the student ID is how staff know them, and their section is set
 * by their instructor. The page holds no birth date, age or gender, and would
 * rather be brief than fill itself in.
 *
 * Every change is sent, then the account is read again through refreshUser(),
 * so what the page — and the header — show is always the server's answer.
 */
export function UserProfile() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <IdentityCard user={user} />

      <div className="flex justify-center">
        <PersonalInformationCard user={user} />
      </div>

      <div className="flex justify-center">
        <div className="w-full max-w-2xl">
          <ChangePasswordCard />
        </div>
      </div>
    </div>
  );
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/** The picture, the name and the placement, with the controls for the picture. */
function IdentityCard({ user }: { user: User }) {
  const { refreshUser } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "delete" | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The disabled buttons are what a person sees; this stops a second request
  // going out before the next render.
  const inFlight = useRef(false);

  const hasAvatar = Boolean(user.avatarUrl);

  const run = async (kind: "upload" | "delete", action: () => Promise<void>, done: string, failed: string) => {
    if (inFlight.current) return;

    inFlight.current = true;
    setBusy(kind);
    setError(null);

    try {
      await action();
      await refreshUser();
      setConfirmingRemove(false);
      toast.success(done);
    } catch (e) {
      const message =
        e instanceof ApiError ? (e.fieldError("avatar") ?? e.message) : e instanceof Error ? e.message : failed;

      setError(message);
      toast.error(message);
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const choose = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    // Cleared at once, so choosing the same file again still counts as a choice.
    event.target.value = "";

    if (!file) return;

    const problem = avatarProblem(file);

    if (problem) {
      setError(problem);
      return;
    }

    void run(
      "upload",
      () => uploadAvatar(file),
      hasAvatar ? "Profile photo replaced." : "Profile photo added.",
      "Could not upload the photo.",
    );
  };

  return (
    <Card className="border border-border bg-white shadow-sm overflow-hidden mx-auto max-w-2xl">
      <CardHeader className="relative pb-4 pt-8">
        <div className="flex flex-col items-center space-y-6">
          <ProfileAvatar
            avatarUrl={user.avatarUrl}
            alt={`${user.name}'s profile photo`}
            className="w-36 h-36 border-4 border-white shadow-md bg-accent ring-4 ring-brand-teal/20"
            fallbackClassName="text-5xl font-black text-primary bg-accent"
            fallback={initialsOf(user.name)}
          />

          <div className="flex flex-col items-center gap-2">
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-label="Profile photo file"
              data-testid="avatar-input"
              onChange={choose}
            />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => {
                  setConfirmingRemove(false);
                  input.current?.click();
                }}
              >
                <Camera className="w-4 h-4 mr-2" />
                {busy === "upload" ? "Uploading…" : hasAvatar ? "Change photo" : "Add photo"}
              </Button>
              {hasAvatar && !confirmingRemove && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => {
                    setError(null);
                    setConfirmingRemove(true);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2 text-red-600" />
                  Remove photo
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">JPEG, PNG or WebP, up to 2 MB.</p>

            {confirmingRemove && (
              <div
                role="alertdialog"
                aria-label="Remove profile photo?"
                className="rounded-md border border-red-200 bg-red-50/60 p-3 space-y-2 text-center"
              >
                <p className="text-xs text-gray-700">Remove your profile photo? Your initials will show instead.</p>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy !== null}
                    onClick={() =>
                      void run("delete", deleteAvatar, "Profile photo removed.", "Could not remove the photo.")
                    }
                  >
                    {busy === "delete" ? "Removing…" : "Remove"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => setConfirmingRemove(false)}
                  >
                    Keep photo
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
          </div>

          <div className="text-center space-y-3">
            <CardTitle className="text-3xl lg:text-4xl font-black text-foreground break-words">
              {user.name}
            </CardTitle>
            {user.section && (
              <div className="flex flex-wrap gap-3 items-center justify-center">
                <div className="px-4 py-2 bg-accent text-accent-foreground rounded-2xl text-sm font-semibold ring-1 ring-brand-teal/25">
                  {user.section.yearLevel} &middot; {user.section.name}
                </div>
              </div>
            )}
            <Badge className="text-base px-6 py-2.5 bg-brand-orange-light text-brand-orange-dark border border-brand-orange/30 shadow-sm font-semibold tracking-wide">
              {user.role.toUpperCase()}
            </Badge>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

type NameField = keyof ProfileNames;
type NameErrors = Partial<Record<NameField, string>>;

const NAME_MAX_LENGTH = 255;

function namesOf(user: User): ProfileNames {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    extendedName: user.extendedName ?? "",
  };
}

/** Checked here so the student is told which box to fix at once; the server checks again. */
function validateNames(names: ProfileNames): NameErrors {
  const errors: NameErrors = {};

  if (!names.firstName.trim()) errors.firstName = "Enter your first name.";
  if (!names.lastName.trim()) errors.lastName = "Enter your last name.";

  for (const field of ["firstName", "lastName", "extendedName"] as const) {
    if (!errors[field] && names[field].length > NAME_MAX_LENGTH) {
      errors[field] = `Keep this to ${NAME_MAX_LENGTH} characters or fewer.`;
    }
  }

  return errors;
}

/** The account's details: the name editable, the rest as the server holds it. */
function PersonalInformationCard({ user }: { user: User }) {
  const { refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [names, setNames] = useState<ProfileNames>(() => namesOf(user));
  const [errors, setErrors] = useState<NameErrors>({});
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  const readOnly = [
    { label: "Email", value: user.email },
    { label: "Student ID", value: user.studentId ?? "Not set" },
    { label: "Year Level", value: user.section?.yearLevel ?? "Not assigned" },
    { label: "Section", value: user.section?.name ?? "Not assigned" },
    { label: "Joined", value: shortDate(user.joinedAt) },
  ];

  const startEditing = () => {
    setNames(namesOf(user));
    setErrors({});
    setEditing(true);
  };

  const cancel = () => {
    setNames(namesOf(user));
    setErrors({});
    setEditing(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;

    const found = validateNames(names);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    inFlight.current = true;
    setSaving(true);

    try {
      await updateProfile(names);
      await refreshUser();
      toast.success("Your details have been saved.");
      setEditing(false);
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.errors).length > 0) {
        setErrors({
          firstName: e.fieldError("first_name"),
          lastName: e.fieldError("last_name"),
          extendedName: e.fieldError("extended_name"),
        });

        const other = Object.keys(e.errors).filter(
          (key) => !["first_name", "last_name", "extended_name"].includes(key),
        );
        if (other.length > 0) toast.error(e.message);
      } else {
        toast.error(e instanceof Error ? e.message : "Could not save your details.");
      }
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  const nameInput = (field: NameField, label: string, autoComplete: string, required: boolean) => {
    const id = `profile-${field}`;
    const error = errors[field];

    return (
      <div className="space-y-1">
        <Label htmlFor={id}>
          {label}
          {!required && <span className="font-normal text-muted-foreground"> (optional)</span>}
        </Label>
        <Input
          id={id}
          value={names[field]}
          autoComplete={autoComplete}
          maxLength={NAME_MAX_LENGTH}
          disabled={saving}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => setNames((current) => ({ ...current, [field]: e.target.value }))}
        />
        {error && (
          <p id={`${id}-error`} className="text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <Card className="border-0 bg-white shadow-md w-full max-w-2xl">
      <CardHeader className="pb-4 flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-3 text-2xl font-semibold text-gray-900">
          <IdCard className="h-6 w-6 text-primary" />
          Personal Information
        </CardTitle>
        {!editing && (
          <Button type="button" size="sm" variant="outline" onClick={startEditing}>
            <Pencil className="w-4 h-4 mr-2" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {editing ? (
          <form aria-label="Edit your name" className="space-y-4" onSubmit={submit} noValidate>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {nameInput("firstName", "First name", "given-name", true)}
              {nameInput("lastName", "Last name", "family-name", true)}
              {nameInput("extendedName", "Name extension", "honorific-suffix", false)}
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={cancel}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Detail label="First Name" value={user.firstName} />
            <Detail label="Last Name" value={user.lastName} />
            <Detail label="Name Extension" value={user.extendedName || "None"} />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
          {readOnly.map((field) => (
            <Detail key={field.label} label={field.label} value={field.value} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Your email address, student ID and section are set on your account. Ask your instructor to
          correct anything that is wrong.
        </p>
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-1 break-words">{value}</p>
    </div>
  );
}
