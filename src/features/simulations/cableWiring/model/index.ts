/**
 * The physical RJ45 cable model.
 *
 * Plain TypeScript and nothing else: no React, no renderer, no DOM. The UI
 * dispatches actions into `apply`, and draws whatever state and events come
 * back. The rules live here and only here.
 */
export * from "./constants";
export * from "./types";
export * from "./geometry";
export { apply, createInitialState } from "./apply";
export * from "./wiremap";
export * from "./inspection";
export * from "./link";
export * from "./record";
export * from "./scenarios";
