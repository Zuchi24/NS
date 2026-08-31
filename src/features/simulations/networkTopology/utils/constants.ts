/** Snap step for device placement on the topology canvas. */
export const GRID_SIZE = 20;

/**
 * Roughly the footprint of a placed device, in pixels. Used to keep a dropped
 * device inside the canvas, which clips anything outside it.
 */
export const DEVICE_SIZE = 80;

/**
 * How far back from the cursor a dropped device's top-left corner sits, so the
 * device lands centred under the pointer rather than beside it.
 */
export const DEVICE_GRAB_OFFSET = DEVICE_SIZE / 2;
