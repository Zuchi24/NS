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
   * How long a findBy/waitFor may keep looking.
   *
   * Testing Library's own default is one second, which is sized for waiting on
   * a state update. Several tests here wait on something much larger: mounting
   * a whole lazy route — the admin layout, its sidebar and the page inside it —
   * which is real rendering work rather than idling. Measured under the full
   * suite, the slowest of those reaches a findByRole at about 920ms, so the
   * default left it passing or failing on eighty milliseconds of noise.
   *
   * This is not a longer leash for a hung test. It is a budget inside vitest's
   * own five seconds a test, which is unchanged and is still what fails a test
   * that never settles — all this decides is whether such a failure is reported
   * as "could not find the element" or as the test timing out. What it removes
   * is the cliff in between, where a page that did render, in a perfectly
   * ordinary time, was called missing.
   */
  const { configure } = await import("@testing-library/dom");

  configure({ asyncUtilTimeout: 3000 });

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
