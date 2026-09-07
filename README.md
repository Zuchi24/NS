# NetSimKoLang

Network Simulation System — an interactive learning platform for networking
fundamentals, with hands-on simulations for PC assembly, cable making, device
connection, and network configuration.

## Tech stack

React 18 · TypeScript · Vite · Tailwind CSS v4 · shadcn/ui · React Router v7

## Running the code

```bash
pnpm install
pnpm dev
```

The dev server runs at http://localhost:5173, and expects the API at
http://127.0.0.1:8000/api — which is where the backend's `composer dev` starts
it. That address comes from `VITE_API_URL`; copy `.env.example` to `.env` to
change it.

To build for production:

```bash
pnpm build
```

## Deployment

This is a static site. `npm run build` writes `dist/`, which any web server or
static host can serve; there is no Node process to run.

Two things it needs.

**`VITE_API_URL` must be set at build time, not at run time.** Vite substitutes
the value into the bundle while building, so it cannot be changed afterwards by
setting an environment variable on the server — a build made with the default
will go on asking `127.0.0.1:8000` from every student's browser. Set it, then
build (`package-lock.json` is the only lockfile here, so npm is what CI and a
deployment both use):

```bash
VITE_API_URL=https://your-api.example.edu/api npm run build
```

**Unknown paths must serve `index.html`.** Routing happens in the browser, so a
student opening `/challenges` directly, or refreshing on it, asks the server for
a file that does not exist. Without that fallback they get a 404 on a page that
works perfectly from inside the app.

The API must also allow this site's origin — see `CORS_ALLOWED_ORIGINS` in the
backend README.

### Verifying a build

```bash
npm run typecheck
npm test
npm run build
```

## Credits

UI originally scaffolded from a Figma design:
https://www.figma.com/design/ud6dRjilxwEoPPOkCKFCQZ/Network-Simulation-System

See [ATTRIBUTIONS.md](ATTRIBUTIONS.md) for asset attributions.
