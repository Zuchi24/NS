import { describe, expect, it } from "vitest";

/**
 * The integration layer's boundaries, read off its source.
 *
 * P3.4 adds only the public-config adapter: it reads configuration into the
 * model's scenario and nothing else. It may use the model's types, shapes and
 * structural invariants, but none of the functions that judge a cable — the
 * server grades, and the bench's readouts already come from the model. No
 * network, no storage, no React, no routes: those arrive in later phases.
 */

const sources = import.meta.glob(["./*.ts", "!./*.test.ts"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;

function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function imports(source: string): { specifier: string; names: string[] }[] {
  return [...code(source).matchAll(/import\s+(?:type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)].map((match) => ({
    specifier: match[2] ?? match[3],
    names: (match[1] ?? "").replace(/[{}]/g, " ").split(/[\s,]+/).filter((name) => name && name !== "type"),
  }));
}

/** The model's judging functions and rule tables. An adapter that used them would be grading. */
const JUDGING = [
  "wiremap", "wiremapFrom", "testerReadout", "continuity", "standardOf", "pinsAt", "structuralSplitPairs",
  "inspect", "inspectEnd", "linkState", "jacketedLengthMm", "hasContact", "reachesContact", "conductorsAtFront", "jacketClamped",
  "PATTERNS", "PARTNER", "PIN_PAIRS", "T568A", "T568B",
];

const GLOBALS = /\b(window|document|localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|navigator|setTimeout|setInterval|Math\.random|Date\.now)\b/;

describe("the integration layer's boundaries", () => {
  it("holds only the public-config adapter so far", () => {
    expect(Object.keys(sources)).toEqual(["./publicConfig.ts"]);
  });

  it.each(Object.entries(sources))("%s imports only the model, through its public entry", (_path, source) => {
    for (const { specifier } of imports(source)) expect(specifier).toBe("../model");
  });

  it.each(Object.entries(sources))("%s uses none of the model's judging functions or rule tables", (_path, source) => {
    for (const { names } of imports(source)) {
      for (const name of JUDGING) expect(names, name).not.toContain(name);
    }
  });

  it.each(Object.entries(sources))("%s touches no network, storage, browser, clock or randomness", (_path, source) => {
    const body = code(source).replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');

    expect(body.match(GLOBALS)?.[0]).toBeUndefined();
  });

  it("the guard would catch an offender", () => {
    const offender = `import { wiremap } from "../model";\nimport { api } from "@/services/api";\nfetch("/x");`;
    const lines = imports(offender);

    expect(lines.map((line) => line.specifier)).toEqual(["../model", "@/services/api"]);
    expect(lines[0].names).toContain("wiremap");
    expect(GLOBALS.test(code(offender))).toBe(true);
  });
});
