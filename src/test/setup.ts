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

  /*
   * jsdom has no ResizeObserver, and several Radix primitives construct one on
   * mount. Nothing here measures anything — layout has no meaning without a
   * renderer — so this exists only so those components can mount. Without it a
   * test that merely renders a page containing one fails on an uncaught
   * ReferenceError thrown from a layout effect, which says nothing about what
   * the test was checking.
   */
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}
