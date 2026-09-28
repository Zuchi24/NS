import { useEffect, useId, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { LogOut, MailCheck, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/components/ui/utils";
import { requestEmailVerificationCode } from "@/features/auth/authService";
import { landingPath } from "@/features/auth/landing";
import { useAuth } from "@/features/auth/useAuth";
import { ApiError } from "@/services/api";
import { BrandLogo } from "@/components/common/BrandLogo";

const CODE_LENGTH = 6;
const CODE_PATTERN = new RegExp(`^\\d{${CODE_LENGTH}}$`);

/** Used when a 429 arrives without the server saying how long to wait. */
const FALLBACK_WAIT_SECONDS = 60;

const INVALID_CODE = `Enter the ${CODE_LENGTH}-digit code from the email.`;
const SEND_FAILED = "We could not send the email just now. Please try again in a moment.";
const SERVER_TROUBLE = "Something went wrong on our side. Please try again in a moment.";

/**
 * What the page can be told on arrival: where to go once verified, and — when
 * a code has just gone out, as it does on sign-up — the server's timings for it.
 */
interface ArrivalState {
  from?: string;
  codeSent?: { expiresIn: number; resendAvailableIn: number } | null;
  /** Sign-up's first code could not be sent: say so, and offer another. */
  sendFailed?: boolean;
}

type Notice = { tone: "success" | "info" | "error"; text: string };

/**
 * Confirming the signed-in account's email address with an emailed code.
 *
 * Every limit here is the server's: the countdowns only show what it said —
 * how long until another code may be sent, how long the one sent lasts — and
 * a refresh starts them again from its answer, never from anything kept in
 * the browser. The code itself is never stored.
 *
 * An account that is already verified is sent on rather than kept here.
 */
export function VerifyEmailPage() {
  const { user, verifyEmailCode, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const arrival = (location.state as ArrivalState | null) ?? {};

  const codeId = useId();
  const codeErrorId = `${codeId}-error`;
  const codeInput = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(() =>
    arrival.codeSent
      ? { tone: "success", text: sentMessage(arrival.codeSent.expiresIn) }
      : arrival.sendFailed
        ? { tone: "error", text: SEND_FAILED }
        : null,
  );
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(Boolean(arrival.codeSent));

  // Deadlines as clock times, so a slow or throttled tab cannot stretch them.
  // Each is set from the same reading of the clock as `now`, so a fresh
  // sixty-second wait reads 60s rather than rounding a stray millisecond up.
  const [arrivedAt] = useState(() => Date.now());
  const [now, setNow] = useState(arrivedAt);
  const [resendAt, setResendAt] = useState<number | null>(() =>
    arrival.codeSent ? arrivedAt + arrival.codeSent.resendAvailableIn * 1000 : null,
  );
  const [expiresAt, setExpiresAt] = useState<number | null>(() =>
    arrival.codeSent ? arrivedAt + arrival.codeSent.expiresIn * 1000 : null,
  );
  const [verifyAt, setVerifyAt] = useState<number | null>(null);

  const resendWait = secondsUntil(resendAt, now);
  const verifyWait = secondsUntil(verifyAt, now);
  const expired = expiresAt !== null && now >= expiresAt;

  // Ticks only while something is counting down.
  useEffect(() => {
    const deadlines = [resendAt, verifyAt, expiresAt].filter(
      (at): at is number => at !== null && at > Date.now(),
    );
    if (deadlines.length === 0) return;

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [resendAt, verifyAt, expiresAt]);

  if (!user) return null;

  if (user.emailVerified === true) {
    return <Navigate to={landingPath(user, arrival.from)} replace />;
  }

  /** Reads the clock once: `now` and the deadline it is counted against. */
  const startWait = (seconds: number | null): number => {
    const start = Date.now();
    setNow(start);

    return start + (seconds ?? FALLBACK_WAIT_SECONDS) * 1000;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (verifying || verifyWait > 0) return;

    if (!CODE_PATTERN.test(code)) {
      setCodeError(INVALID_CODE);
      codeInput.current?.focus();
      return;
    }

    setVerifying(true);
    setCodeError(null);
    setNotice(null);

    try {
      const verified = await verifyEmailCode(code);
      toast.success("Email verified. Welcome to NetSim!");
      navigate(landingPath(verified, arrival.from), { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setCodeError(error.fieldError("code") ?? INVALID_CODE);
        if (error.body.resend_required === true) {
          setCode("");
          setNotice({ tone: "info", text: "That code can no longer be used. Send a new one to try again." });
        }
      } else if (error instanceof ApiError && error.status === 429) {
        setVerifyAt(startWait(error.retryAfter));
        setNotice({ tone: "error", text: "Too many attempts. Wait a moment before trying again." });
      } else {
        setNotice({ tone: "error", text: safeMessage(error) });
      }
      codeInput.current?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (sending || resendWait > 0) return;

    setSending(true);
    setNotice(null);

    try {
      const response = await requestEmailVerificationCode();

      if ("already_verified" in response) {
        // Nothing to send: take the server's word for the account, and let
        // the verified branch above send it on.
        await refreshUser();
        return;
      }

      const sentAt = startWait(0);
      setCodeSent(true);
      setResendAt(sentAt + response.resend_available_in * 1000);
      setExpiresAt(sentAt + response.expires_in * 1000);
      setCode("");
      setCodeError(null);
      setNotice({ tone: "success", text: sentMessage(response.expires_in) });
      codeInput.current?.focus();
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        // The server's own words — "wait before requesting another", or the
        // hourly limit — and its own count.
        setResendAt(startWait(error.retryAfter));
        setNotice({ tone: "error", text: error.message });
      } else if (error instanceof ApiError && error.status === 503) {
        setNotice({ tone: "error", text: SEND_FAILED });
      } else {
        setNotice({ tone: "error", text: safeMessage(error) });
      }
    } finally {
      setSending(false);
    }
  };

  const signOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  // Once the code has run out, that is what matters — it replaces the "sent,
  // expires in 15 minutes" note rather than leaving it standing. An error
  // still shows until the next action clears it.
  const shown: Notice | null =
    expired && codeSent && notice?.tone !== "error"
      ? { tone: "info", text: "That code has expired. Send a new one." }
      : notice;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(37,99,235,0.14),transparent_45%),radial-gradient(circle_at_85%_80%,rgba(79,70,229,0.12),transparent_45%)]"
        aria-hidden="true"
      />

      <main className="w-full max-w-md relative z-10 bg-white rounded-3xl shadow-2xl shadow-blue-900/10 border border-slate-200/70 p-6 sm:p-10 space-y-8">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center">
            <BrandLogo className="h-9" />
          </div>

          <div className="mx-auto w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
            <MailCheck className="w-7 h-7 text-blue-600" aria-hidden="true" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Verify your email</h1>
          <p className="text-gray-600">
            {codeSent ? "We sent a verification code to" : "We'll send a verification code to"}
            <span className="block font-semibold text-gray-900 break-all">{user.email}</span>
          </p>
          <p className="text-sm text-gray-500">
            Enter the {CODE_LENGTH}-digit code from the email.
            {!codeSent && " Already have one? Enter it below, or send a new one."}
          </p>
        </div>

        <div aria-live="polite" role="status" className="min-h-0">
          {shown && (
            <p
              className={cn(
                "rounded-xl border px-4 py-3 text-sm",
                shown.tone === "success" && "border-green-200 bg-green-50 text-green-800",
                shown.tone === "info" && "border-blue-200 bg-blue-50 text-blue-800",
                shown.tone === "error" && "border-red-200 bg-red-50 text-red-800",
              )}
            >
              {shown.text}
            </p>
          )}
        </div>

        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor={codeId} className="text-gray-700">
              Verification code
            </Label>
            <Input
              ref={codeInput}
              id={codeId}
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="000000"
              value={code}
              onChange={(event) => {
                // Digits only, and never more than a code's worth — so a
                // pasted "123 456" or "123-456" arrives as the code it is.
                setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH));
                setCodeError(null);
              }}
              aria-invalid={codeError ? true : undefined}
              aria-describedby={codeError ? codeErrorId : undefined}
              className="h-12 rounded-xl border-slate-200 bg-slate-50 text-center text-2xl font-semibold tracking-[0.5em] tabular-nums focus:bg-white focus-visible:border-blue-500 focus-visible:ring-blue-500/20"
            />
            {codeError && (
              <p id={codeErrorId} className="text-sm text-red-600">
                {codeError}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={verifying || verifyWait > 0}
            className="w-full h-11 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-md shadow-blue-600/20"
          >
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            {verifying
              ? "Verifying…"
              : verifyWait > 0
                ? `Try again in ${formatWait(verifyWait)}`
                : "Verify email"}
          </Button>
        </form>

        <div className="space-y-3 text-center">
          <p className="text-sm text-gray-600">{codeSent ? "Didn't receive it?" : "Need a code?"}</p>
          <Button
            type="button"
            variant="outline"
            onClick={resend}
            disabled={sending || resendWait > 0}
            className="w-full h-11 rounded-full"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            {sending
              ? "Sending…"
              : resendWait > 0
                ? `Resend in ${formatWait(resendWait)}`
                : codeSent
                  ? "Send a new code"
                  : "Send code"}
          </Button>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-1.5 rounded-md text-sm text-gray-500 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Sign out and use a different account
          </button>
        </div>
      </main>
    </div>
  );
}

function sentMessage(expiresInSeconds: number): string {
  const minutes = Math.max(1, Math.round(expiresInSeconds / 60));

  return `We sent a new code. It expires in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
}

function secondsUntil(at: number | null, now: number): number {
  return at === null ? 0 : Math.max(0, Math.ceil((at - now) / 1000));
}

function formatWait(seconds: number): string {
  if (seconds <= 60) return `${seconds}s`;

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * What to say about a failure that is not one of the expected refusals.
 *
 * The API's own message for a request it refused, which is written for the
 * reader. Never a server error's: with debugging on, that can be an exception
 * message, and it is no business of the person verifying their email.
 */
function safeMessage(error: unknown): string {
  if (!(error instanceof ApiError) || error.status >= 500) return SERVER_TROUBLE;

  return error.message;
}
