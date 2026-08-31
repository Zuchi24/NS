/**
 * Test setup, applied to every file.
 *
 * jest-dom's matchers only make sense with a DOM, and importing them in a node
 * environment throws — so the import is conditional on there being a document.
 * Files that want a DOM opt in with a `@vitest-environment jsdom` docblock.
 */
export {};

if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
}
