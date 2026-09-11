import { describe, expect, it } from "vitest";

/**
 * The model stays plain TypeScript (M24).
 *
 * An architectural guard, read off the model's own source — the same approach
 * the drag-and-drop boundary test takes. The rules have to run in Node for
 * these tests, in the browser for the bench, and on nothing else's terms: no
 * UI framework, no renderer, no animation library, no DOM.
 *
 * Checked on the source rather than at runtime because what matters is what a
 * file *imports*, which a runtime check cannot see. Comments are stripped
 * first, so a file may explain what it does not use without tripping this.
 */

const sources = import.meta.glob("./*.ts", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

/** Model source proper; the tests may use vitest. */
const model = Object.entries(sources).filter(([path]) => !path.endsWith(".test.ts"));

function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function importsOf(source: string): string[] {
  return [...code(source).matchAll(/(?:import|export)[^;]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)].map(
    (match) => match[1] ?? match[2],
  );
}

const FORBIDDEN_MODULES = [/^react(\/|$)/, /^react-dom(\/|$)/, /^pixi\.js(\/|$)/, /^@pixi\//, /^gsap(\/|$)/];

/** The one import from outside the model: the app's difficulty type, type-only. */
const ALLOWED_EXTERNAL = new Set(["@/features/content/types"]);

const BROWSER_GLOBALS = [
  "window",
  "document",
  "navigator",
  "localStorage",
  "sessionStorage",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "setTimeout",
  "setInterval",
  "fetch",
  "HTMLElement",
  "HTMLCanvasElement",
  "CanvasRenderingContext2D",
  "OffscreenCanvas",
  "WebGLRenderingContext",
  "structuredClone",
  "performance",
  "Math.random",
  "Date.now",
];

describe("the model's boundary", () => {
  it("finds the model sources", () => {
    const names = model.map(([path]) => path).sort();

    expect(names).toEqual([
      "./apply.ts",
      "./constants.ts",
      "./geometry.ts",
      "./index.ts",
      "./inspection.ts",
      "./link.ts",
      "./record.ts",
      "./scenarios.ts",
      "./types.ts",
      "./wiremap.ts",
    ]);
  });

  it.each(model)("%s imports no UI, renderer or animation library", (_path, source) => {
    for (const specifier of importsOf(source)) {
      expect(FORBIDDEN_MODULES.some((pattern) => pattern.test(specifier)), specifier).toBe(false);
    }
  });

  it.each(model)("%s imports only its siblings, or the app's difficulty type", (_path, source) => {
    for (const specifier of importsOf(source)) {
      expect(specifier.startsWith("./") || ALLOWED_EXTERNAL.has(specifier), specifier).toBe(true);
    }
  });

  it.each(model)("%s imports from outside the model as types only", (_path, source) => {
    const external = code(source)
      .split("\n")
      .filter((line) => /from\s+["']@\//.test(line));

    for (const line of external) {
      expect(line.trimStart().startsWith("import type "), line).toBe(true);
    }
  });

  it.each(model)("%s touches no browser, DOM, canvas, clock or randomness", (_path, source) => {
    const body = code(source).replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');

    for (const name of BROWSER_GLOBALS) {
      const pattern = new RegExp(`(^|[^\\w.$])${name.replace(".", "\\.")}\\b`);

      expect(pattern.test(body), name).toBe(false);
    }
  });

  it("the guard itself would catch an offender", () => {
    const offender = `import { Application } from "pixi.js";\nimport gsap from "gsap";\nwindow.foo = 1;`;

    expect(importsOf(offender)).toEqual(["pixi.js", "gsap"]);
    expect(FORBIDDEN_MODULES.some((pattern) => pattern.test("pixi.js"))).toBe(true);
    expect(/(^|[^\w.$])window\b/.test(code(offender))).toBe(true);
  });
});
