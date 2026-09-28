import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "./input";
import { cn } from "./utils";

/**
 * A password field with a show/hide toggle.
 *
 * Everything but `type` goes straight through to the input, so autocomplete,
 * validation attributes and the form's own submit are exactly what they were
 * on the plain `<Input type="password">` this replaces. Visibility is local
 * state only: it never touches the value and is never sent anywhere.
 *
 * The toggle is a real button in the tab order — someone on a keyboard is as
 * likely to want to check what they typed — and names the action it will
 * take, which is what a screen reader user needs to hear on it.
 */
function PasswordInput({
  className,
  id,
  disabled,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = React.useState(false);
  const label = visible ? "Hide password" : "Show password";

  return (
    <div className="relative w-full">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={label}
        aria-controls={id}
        title={label}
        disabled={disabled}
        className={cn(
          "absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex size-7 items-center justify-center rounded-md",
          "text-muted-foreground transition-colors hover:text-foreground hover:bg-muted",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export { PasswordInput };
