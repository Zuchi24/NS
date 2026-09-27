import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/services/api";
import { changePassword } from "@/features/auth/authService";
import { useAuth } from "@/features/auth/useAuth";

/**
 * Changing your own password, from your profile.
 *
 * The same card for a student and for staff: the server works out whose
 * password it is from the token, so there is nothing here that names a user.
 *
 * A successful change revokes every token the account holds, this one
 * included, so the page does not pretend the session goes on: it signs out
 * locally, through the same logout the header uses, and sends the user to sign
 * in with the new password.
 *
 * The client checks only what the sign-up form checks — everything filled in,
 * at least 8 characters, the two new ones matching — so a typo is caught
 * without a round trip. The server checks all of it again, and is the only one
 * that knows whether the current password is right.
 */

/** The same minimum registration holds a password to (Password::defaults()). */
export const PASSWORD_MIN_LENGTH = 8;

type Field = "currentPassword" | "password" | "passwordConfirmation";
type Errors = Partial<Record<Field, string>>;

const EMPTY = { currentPassword: "", password: "", passwordConfirmation: "" };

function validate(values: typeof EMPTY): Errors {
  const errors: Errors = {};

  if (!values.currentPassword) errors.currentPassword = "Enter your current password.";

  if (!values.password) {
    errors.password = "Enter a new password.";
  } else if (values.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  if (values.passwordConfirmation !== values.password) {
    errors.passwordConfirmation = "The two new passwords do not match.";
  }

  return errors;
}

export function ChangePasswordCard() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  // The disabled button is what a person sees; this stops a second request
  // going out before the next render.
  const inFlight = useRef(false);

  const set = (field: Field) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;

    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    inFlight.current = true;
    setSaving(true);

    try {
      const message = await changePassword(values);

      toast.success(message);
      // Every token was revoked with the change; end the session here too.
      await logout();
      navigate("/login", { replace: true });
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.errors).length > 0) {
        setErrors({
          currentPassword: e.fieldError("current_password"),
          password: e.fieldError("password"),
        });
      } else {
        toast.error(e instanceof Error ? e.message : "Could not change your password.");
      }
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  const field = (name: Field, label: string, autoComplete: string) => {
    const id = `change-password-${name}`;
    const error = errors[name];

    return (
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <PasswordInput
          id={id}
          autoComplete={autoComplete}
          value={values[name]}
          onChange={set(name)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          disabled={saving}
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
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-blue-600" aria-hidden="true" />
          Change password
        </CardTitle>
        <p className="text-sm text-gray-600">
          Changing your password signs you out on every device. Sign in again
          with the new one.
        </p>
      </CardHeader>
      <CardContent>
        <form aria-label="Change password" className="space-y-4 max-w-md" onSubmit={submit} noValidate>
          {field("currentPassword", "Current password", "current-password")}
          {field("password", "New password", "new-password")}
          {field("passwordConfirmation", "Confirm new password", "new-password")}

          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Changing…" : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
