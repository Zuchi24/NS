// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./AuthContext";
import { SESSION_KEY } from "./authService";
import { useAuth } from "./useAuth";
import type { AuthContextValue } from "./AuthContext";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { AUTH_TOKEN_KEY, api } from "@/services/api";

/*
 * One NetSim account per browser profile.
 *
 * A browser profile has one shared store and one private store per tab. These
 * say what a tab does when another tab changes the session under it: it adopts
 * the new account or signs out, never keeps showing the old one while sending
 * requests as the new one.
 *
 * The real provider, service and storage run against a fake server. "Another
 * tab" is played by writing to the shared store only — its own private store is
 * out of this tab's reach, which is the point — and by raising the `storage`
 * event a browser raises in the tabs that did not make the change. jsdom never
 * raises that one for a write in its own window, so the tests raise it.
 */

const USER_KEY = "netsim-user";

const ADA = "1|ada-secret";
const SAM = "2|sam-secret";
const OLIVE = "3|olive-secret";
const SAM_AGAIN = "4|sam-second-sign-in";

interface Account {
  id: number;
  name: string;
  role: "admin" | "student";
}

const ACCOUNTS: Record<string, Account> = {
  [ADA]: { id: 1, name: "Ada Admin", role: "admin" },
  [SAM]: { id: 2, name: "Sam Student", role: "student" },
  [OLIVE]: { id: 3, name: "Olive Other", role: "student" },
  [SAM_AGAIN]: { id: 2, name: "Sam Student", role: "student" },
};

const EMAIL_TOKEN: Record<string, string> = {
  "ada@netsim.test": ADA,
  "sam@netsim.test": SAM,
  "olive@netsim.test": OLIVE,
};

function apiUser({ id, name, role }: Account) {
  return {
    id,
    student_id: null,
    first_name: name.split(" ")[0],
    last_name: name.split(" ")[1],
    extended_name: null,
    full_name: name,
    email: `${name.split(" ")[0].toLowerCase()}@netsim.test`,
    email_verified: true,
    role,
    created_at: null,
    section_id: null,
  };
}

/** The user as the app caches it, for seeding a snapshot. */
function cachedUser({ id, name, role }: Account) {
  return {
    id,
    name,
    firstName: name.split(" ")[0],
    lastName: name.split(" ")[1],
    studentId: null,
    email: `${name.split(" ")[0].toLowerCase()}@netsim.test`,
    emailVerified: true,
    role,
    joinedAt: null,
    section: null,
  };
}

interface Call {
  path: string;
  bearer: string | null;
}

const server = {
  calls: [] as Call[],
  down: false,
  /** Holds an answer back until released, to make one arrive after a newer one. */
  gates: new Map<string, Promise<void>>(),
  refuse: new Set<string>(),
};

function respond(status: number, body: unknown) {
  return { ok: status < 300, status, json: async () => body } as Response;
}

async function fakeFetch(url: string, init: RequestInit = {}) {
  const path = url.replace(/^.*\/api/, "");
  const header = (init.headers as Record<string, string> | undefined)?.Authorization;
  const bearer = header ? header.replace("Bearer ", "") : null;

  server.calls.push({ path, bearer });

  if (server.down) throw new TypeError("Failed to fetch");

  if (path === "/login") {
    const { email } = JSON.parse(String(init.body));
    const token = EMAIL_TOKEN[email];
    return respond(200, { user: apiUser(ACCOUNTS[token]), token, verification_required: false });
  }

  await server.gates.get(`${path}|${bearer}`);

  if (path === "/logout") return respond(200, { message: "Logged out." });

  if (server.refuse.has(path)) {
    return respond(server.refuse.has(`${path}:403`) ? 403 : 401, { message: "Refused." });
  }

  const account = bearer ? ACCOUNTS[bearer] : undefined;

  if (!account) return respond(401, { message: "Unauthenticated." });

  return path === "/me" ? respond(200, { data: apiUser(account) }) : respond(200, {});
}

const meCalls = () => server.calls.filter((call) => call.path === "/me").length;

/* ---- the tab under test ---- */

let auth: AuthContextValue;
let mounts = 0;

function Probe() {
  auth = useAuth();

  return (
    <>
      <p data-testid="who">{auth.user?.name ?? "signed out"}</p>
      <p data-testid="loading">{auth.loading ? "loading" : "ready"}</p>
    </>
  );
}

/** A page with state of its own, to see whether an account switch leaves it standing. */
function Page() {
  useEffect(() => {
    mounts += 1;
  }, []);

  return null;
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthProvider>
        <Probe />
        <Page />
      </AuthProvider>
    </MemoryRouter>,
  );
}

const who = () => screen.getByTestId("who");

async function ready() {
  await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("ready"));
}

async function signIn(email: string, remember: boolean) {
  await act(async () => {
    await auth.login({ email, password: "irrelevant", remember });
  });
}

/* ---- another tab ---- */

function fire(key: string | null) {
  window.dispatchEvent(new StorageEvent("storage", { key, storageArea: window.localStorage }));
}

let nonce = 0;

const otherTab = {
  /**
   * What a sign-in in another tab leaves in the shared store: the token and its
   * user only when remembered — an unremembered one goes to that tab's own
   * store, and removes the shared copy — then the marker, last.
   */
  async signIn(token: string, remember: boolean) {
    const account = ACCOUNTS[token];

    if (remember) {
      localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(token));
      localStorage.setItem(
        USER_KEY,
        JSON.stringify({ tokenId: token.split("|")[0], user: cachedUser(account) }),
      );
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(`${account.id}:${(nonce += 1)}`));

    await act(async () => {
      fire(AUTH_TOKEN_KEY);
      fire(USER_KEY);
      fire(SESSION_KEY);
    });
  },

  async signOut() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SESSION_KEY);

    await act(async () => {
      fire(AUTH_TOKEN_KEY);
      fire(USER_KEY);
      fire(SESSION_KEY);
    });
  },
};

const sharedToken = () => {
  const raw = localStorage.getItem(AUTH_TOKEN_KEY);
  return raw === null ? null : (JSON.parse(raw) as string);
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  server.calls = [];
  server.down = false;
  server.gates.clear();
  server.refuse.clear();
  mounts = 0;
  vi.stubGlobal("fetch", fakeFetch);
});

afterEach(() => {
  // Not automatic here: Testing Library only cleans up after itself when the
  // runner has globals, and this project's does not.
  cleanup();
  vi.unstubAllGlobals();
});

describe("another tab signs in", () => {
  it("shows the new account and sends its requests as that account", async () => {
    renderApp();
    await ready();
    await signIn("ada@netsim.test", true);
    expect(who()).toHaveTextContent("Ada Admin");

    await otherTab.signIn(SAM, true);

    await waitFor(() => expect(who()).toHaveTextContent("Sam Student"));
    expect(screen.queryByText("Ada Admin")).toBeNull();

    await act(async () => {
      await api.get("/ping");
    });

    expect(server.calls[server.calls.length - 1]).toEqual({ path: "/ping", bearer: SAM });
  });

  it("keeps the shared token the other tab chose, rather than clearing it on the way", async () => {
    renderApp();
    await ready();
    await signIn("ada@netsim.test", true);

    await otherTab.signIn(SAM, true);
    await waitFor(() => expect(who()).toHaveTextContent("Sam Student"));

    expect(sharedToken()).toBe(SAM);
    // And the account that is now on screen was confirmed by the server, not assumed.
    expect(server.calls.some((call) => call.path === "/me" && call.bearer === SAM)).toBe(true);
  });

  it("makes a tab-private session give way to a shared one", async () => {
    renderApp();
    await ready();
    await signIn("ada@netsim.test", false);

    expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).not.toBeNull();

    await otherTab.signIn(SAM, true);

    await waitFor(() => expect(who()).toHaveTextContent("Sam Student"));
    expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(USER_KEY)).toBeNull();
    expect(sharedToken()).toBe(SAM);
  });

  it("signs out a shared session when the other tab's sign-in is private to it", async () => {
    renderApp();
    await ready();
    await signIn("ada@netsim.test", true);

    // The other tab keeps its token to itself, so there is none here to adopt —
    // and the profile must not keep two accounts, so this one is not kept.
    await otherTab.signIn(SAM, false);

    await waitFor(() => expect(who()).toHaveTextContent("signed out"));
    expect(sharedToken()).toBeNull();

    server.calls = [];
    await act(async () => {
      await api.get("/ping").catch(() => null);
    });

    expect(server.calls.every((call) => call.bearer === null)).toBe(true);
  });

  it("remounts what was on screen when the account changes, and only then", async () => {
    renderApp();
    await ready();
    await signIn("ada@netsim.test", true);
    const afterFirstSignIn = mounts;

    await otherTab.signIn(SAM, true);
    await waitFor(() => expect(who()).toHaveTextContent("Sam Student"));
    expect(mounts).toBe(afterFirstSignIn + 1);

    // The same person signing in again elsewhere is not a different account.
    await otherTab.signIn(SAM_AGAIN, true);
    await waitFor(() => expect(sharedToken()).toBe(SAM_AGAIN));
    await waitFor(() => expect(who()).toHaveTextContent("Sam Student"));
    expect(mounts).toBe(afterFirstSignIn + 1);
  });
});

describe("another tab signs out", () => {
  it("signs out a shared session", async () => {
    renderApp();
    await ready();
    await signIn("ada@netsim.test", true);

    await otherTab.signOut();

    await waitFor(() => expect(who()).toHaveTextContent("signed out"));
    expect(sharedToken()).toBeNull();
  });

  it("signs out a tab-private session too, and does not bring the old account back", async () => {
    renderApp();
    await ready();
    await signIn("ada@netsim.test", false);

    await otherTab.signOut();

    await waitFor(() => expect(who()).toHaveTextContent("signed out"));
    expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(USER_KEY)).toBeNull();

    // A reload restores whatever is stored; nothing is, so nobody comes back.
    server.calls = [];
    renderApp();
    const last = (id: string) => screen.getAllByTestId(id)[screen.getAllByTestId(id).length - 1];
    await waitFor(() => expect(last("loading")).toHaveTextContent("ready"));
    expect(last("who")).toHaveTextContent("signed out");
    expect(meCalls()).toBe(0);
  });

  it("sends a protected page to sign-in", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(SAM));

    render(
      <MemoryRouter initialEntries={["/secret"]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<p>the sign-in page</p>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/secret" element={<p>the protected page</p>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await screen.findByText("the protected page");

    await otherTab.signOut();

    await screen.findByText("the sign-in page");
    expect(screen.queryByText("the protected page")).toBeNull();
  });
});

describe("a cached user against a token", () => {
  beforeEach(() => {
    server.down = true;
  });

  it("is not shown for a token it was not cached for", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(SAM));
    localStorage.setItem(USER_KEY, JSON.stringify({ tokenId: "1", user: cachedUser(ACCOUNTS[ADA]) }));

    renderApp();
    await ready();

    expect(who()).toHaveTextContent("signed out");
  });

  it("is not shown when it carries no token at all, as an older build left it", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(SAM));
    localStorage.setItem(USER_KEY, JSON.stringify(cachedUser(ACCOUNTS[ADA])));

    renderApp();
    await ready();

    expect(who()).toHaveTextContent("signed out");
  });

  it("is still what keeps someone signed in through a restart, for the token it matches", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(SAM));
    localStorage.setItem(USER_KEY, JSON.stringify({ tokenId: "2", user: cachedUser(ACCOUNTS[SAM]) }));

    renderApp();
    await ready();

    expect(who()).toHaveTextContent("Sam Student");
  });
});

describe("a refused token", () => {
  it("signs the screen out, not just the request", async () => {
    renderApp();
    await ready();
    await signIn("ada@netsim.test", true);
    server.refuse.add("/ping");

    await act(async () => {
      await api.get("/ping").catch(() => null);
    });

    await waitFor(() => expect(who()).toHaveTextContent("signed out"));
    expect(sharedToken()).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
  });

  it("does not sign anyone out for a refusal to do something", async () => {
    renderApp();
    await ready();
    await signIn("ada@netsim.test", true);
    server.refuse.add("/ping");
    server.refuse.add("/ping:403");

    await act(async () => {
      await api.get("/ping").catch(() => null);
    });

    expect(who()).toHaveTextContent("Ada Admin");
    expect(sharedToken()).toBe(ADA);
  });

  it("leaves a newer session alone when the old token's refusal arrives late", async () => {
    renderApp();
    await ready();
    await signIn("ada@netsim.test", true);

    let release!: () => void;
    server.gates.set(`/slow|${ADA}`, new Promise<void>((resolve) => (release = resolve)));
    server.refuse.add("/slow");

    let late!: Promise<unknown>;
    await act(async () => {
      late = api.get("/slow").catch(() => null);
    });

    await otherTab.signIn(SAM, true);
    await waitFor(() => expect(who()).toHaveTextContent("Sam Student"));

    await act(async () => {
      release();
      await late;
    });

    expect(who()).toHaveTextContent("Sam Student");
    expect(sharedToken()).toBe(SAM);
  });
});

describe("a change that is not one", () => {
  it("asks nothing and clears nothing when the event is an echo of this tab's own session", async () => {
    renderApp();
    await ready();
    await signIn("ada@netsim.test", true);

    const before = meCalls();

    await act(async () => {
      for (let round = 0; round < 3; round += 1) {
        fire(SESSION_KEY);
        fire(AUTH_TOKEN_KEY);
        fire(null);
      }
    });

    expect(meCalls()).toBe(before);
    expect(who()).toHaveTextContent("Ada Admin");
    expect(sharedToken()).toBe(ADA);
  });

  it("ignores storage that is not the shared store's", async () => {
    renderApp();
    await ready();
    await signIn("ada@netsim.test", true);
    localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(SAM));

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: AUTH_TOKEN_KEY, storageArea: window.sessionStorage }),
      );
    });

    expect(who()).toHaveTextContent("Ada Admin");
  });
});

describe("two changes close together", () => {
  it("shows the newest, however the answers arrive", async () => {
    renderApp();
    await ready();
    await signIn("ada@netsim.test", true);

    let release!: () => void;
    server.gates.set(`/me|${SAM}`, new Promise<void>((resolve) => (release = resolve)));

    await otherTab.signIn(SAM, true);
    await otherTab.signIn(OLIVE, true);

    await waitFor(() => expect(who()).toHaveTextContent("Olive Other"));

    await act(async () => {
      release();
    });

    expect(who()).toHaveTextContent("Olive Other");
    expect(sharedToken()).toBe(OLIVE);
    // What is cached is the newest account, for the newest token — not the slow
    // answer about the earlier one, filed under the token that replaced it.
    const cached = JSON.parse(localStorage.getItem(USER_KEY) as string);
    expect(cached.tokenId).toBe("3");
    expect(cached.user.name).toBe("Olive Other");
  });
});
