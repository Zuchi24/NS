import { describe, expect, it } from "vitest";

/**
 * The physical bench's boundaries, read off its source.
 *
 * The bench is a view over the P1 model: it may use the model, React and the
 * app's shared UI, and nothing that would make it a second source of truth or
 * tie it to the rest of the app before its integration phase. The model, in
 * turn, must never reach back into the bench.
 */

const bench = import.meta.glob(["./**/*.ts", "./**/*.tsx", "!./**/*.test.ts", "!./**/*.test.tsx"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const model = import.meta.glob(["../model/*.ts", "!../model/*.test.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

interface ImportLine {
  specifier: string;
  names: string[];
}

function importsOf(source: string): ImportLine[] {
  return [...code(source).matchAll(/import\s+(?:type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g)].map(
    (match) => ({
      specifier: match[2] ?? match[3],
      names: (match[1] ?? "")
        .replace(/[{}]/g, " ")
        .split(/[\s,]+/)
        .map((name) => name.replace(/^type$/, ""))
        .filter(Boolean),
    }),
  );
}

const FORBIDDEN_SPECIFIERS: [RegExp, string][] = [
  [/^react-dnd/, "React DnD"],
  [/^@\/routes/, "route-level code"],
  [/^@\/pages/, "page-level code"],
  [/CableWiringChallenge/, "the legacy challenge"],
  [/useChallengeAttempt|contentService|@\/services\/api/, "attempt/API code"],
  [/backend|\.php$/, "backend code"],
];

/** Rule tables the model uses to decide things. A view that imported them would be deciding too. */
const RULE_TABLES = ["PATTERNS", "PARTNER", "PIN_PAIRS", "UNEVEN_OFFSETS"];

const STORAGE = /\b(localStorage|sessionStorage|indexedDB)\b|document\.cookie/;

describe("the physical bench's boundaries", () => {
  it("finds the bench sources", () => {
    expect(Object.keys(bench)).toEqual(
      expect.arrayContaining(["./PhysicalCableChallenge.tsx", "./useCableBench.ts", "./components/BenchView.tsx"]),
    );
  });

  it.each(Object.entries(bench))("%s imports no DnD, routes, pages, legacy challenge, API or backend", (_path, source) => {
    for (const { specifier } of importsOf(source)) {
      for (const [pattern, what] of FORBIDDEN_SPECIFIERS) {
        expect(pattern.test(specifier), `${specifier} is ${what}`).toBe(false);
      }
    }
  });

  it.each(Object.entries(bench))("%s imports none of the model's rule tables", (_path, source) => {
    for (const { specifier, names } of importsOf(source)) {
      if (!/\/model$/.test(specifier)) continue;

      for (const table of RULE_TABLES) {
        expect(names, `${table} imported from ${specifier}`).not.toContain(table);
      }
    }
  });

  it.each(Object.entries(bench))("%s keeps no state in browser storage and calls no network", (_path, source) => {
    expect(STORAGE.test(code(source))).toBe(false);
    expect(/\bfetch\s*\(/.test(code(source))).toBe(false);
  });

  it("reaches the model only through its public entry", () => {
    for (const source of Object.values(bench)) {
      for (const { specifier } of importsOf(source)) {
        if (!specifier.includes("model")) continue;

        expect(specifier).toMatch(/^(\.\.\/)+model$/);
      }
    }
  });

  it("the model never imports the bench", () => {
    for (const [path, source] of Object.entries(model)) {
      for (const { specifier } of importsOf(source)) {
        expect(specifier.includes("physical"), `${path} imports ${specifier}`).toBe(false);
      }
    }
  });

  it("holds the physical state only as the model's CableState", () => {
    const hook = bench["./useCableBench.ts"];

    // One reducer, whose physical field is the model's state and changes only through apply().
    expect(hook).toMatch(/cable: CableState/);
    expect(code(hook).match(/cable: result\.state/g)).toHaveLength(1);
    expect(code(hook)).not.toMatch(/\bcable\s*:\s*\{/);
  });

  /*
   * P3.4b: the bench runs on a challenge's public side only. Nothing in its
   * source may name the private grading rule — `require` and its parts, the
   * practice scenario type that carries one, the requirement list, the answer
   * key — whether as a type, a property or an import. Checked on code with
   * comments and strings removed, so an explanation may still mention them.
   */
  const PRIVATE = /\brequire\b|\bPracticeScenario\b|\bScenarioRequire\b|\bvalidation_rules\b|\brequirements?\b|\bexpected\b|\bdescribeObjective\b/;
  const codeOnly = (source: string) => code(source).replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');

  it.each(Object.entries(bench))("%s never names the private grading rule", (_path, source) => {
    expect(codeOnly(source).match(PRIVATE)?.[0]).toBeUndefined();
  });

  it("takes S1's practice setup field by field, never the practice scenario whole", () => {
    const setup = codeOnly(bench["./setup.ts"]);
    const reads = [...setup.matchAll(/S1_PRACTICE\.(\w+)/g)].map((match) => match[1]).sort();

    expect(reads).toEqual(["difficulty", "endpoints", "id", "initialEnds", "plugs", "startLengthMm", "title"]);
    // Outside its import, every use is a single field read: no spread, no passing it whole.
    expect(setup.replace(/^import .*$/gm, "").match(/\bS1_PRACTICE\b(?!\.)/)?.[0]).toBeUndefined();

    for (const [path, source] of Object.entries(bench)) {
      if (path !== "./setup.ts") expect(codeOnly(source), path).not.toMatch(/\bS1_PRACTICE\b/);
    }
  });

  it("takes only types from the integration layer — the parsed public config's shape", () => {
    for (const [path, source] of Object.entries(bench)) {
      for (const line of code(source).split("\n").filter((text) => /from\s+["'][^"']*integration/.test(text))) {
        expect(line.trimStart().startsWith("import type "), `${path}: ${line}`).toBe(true);
      }
    }
  });

  it("the private-rule guard would catch an offender", () => {
    expect(codeOnly("const ends = scenario.require.ends;")).toMatch(PRIVATE);
    expect(codeOnly("function f(s: PracticeScenario) {}")).toMatch(PRIVATE);
    expect(codeOnly('// scenario.require is private\nconst label = "require";')).not.toMatch(PRIVATE);
  });

  it("the guard would catch an offender", () => {
    const offender = `import { useDrag } from "react-dnd";\nimport { PATTERNS } from "../model";\nlocalStorage.setItem("x", "y");`;
    const lines = importsOf(offender);

    expect(lines.map((line) => line.specifier)).toEqual(["react-dnd", "../model"]);
    expect(lines[1].names).toContain("PATTERNS");
    expect(STORAGE.test(offender)).toBe(true);
  });
});
