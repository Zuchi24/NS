import { DEVICE_CATEGORIES } from "../data/deviceCategories";

/**
 * What the device library offers, which is deliberately less than what the
 * canvas can draw.
 *
 * DEVICE_CATEGORIES stays the full library and is not trimmed: it is what
 * `familyForType` builds its map from, and what draws a device in a topology a
 * student saved earlier. Taking an entry out of it would change how existing
 * work is graded and rendered. This decides only what a student may *add*.
 */

/**
 * Withdrawn from the workspace outright. Nothing in the catalogue asks for a
 * smartphone and no saved topology contains one, so it is offered nowhere.
 */
const WITHDRAWN = ["smartphone"];

/**
 * Not offered by default, but put back for a challenge whose rules ask for
 * them — "Share a printer on the LAN" and "Put a server on the network" cannot
 * be solved without one, and retiring them from those exercises would be
 * breaking content rather than tidying a palette.
 */
const ON_REQUEST = ["server", "printer"];

export type PaletteDevice =
  (typeof DEVICE_CATEGORIES)["endDevices"]["items"][number];

/**
 * The end devices a student may place.
 *
 * @param requiredFamilies The families the open challenge's rules involve.
 *                         Empty in free play, where only the default set is
 *                         offered.
 */
export function paletteEndDevices(
  requiredFamilies: string[] = [],
): PaletteDevice[] {
  const needed = new Set(requiredFamilies);

  return DEVICE_CATEGORIES.endDevices.items.filter((item) => {
    if (WITHDRAWN.includes(item.family)) return false;
    if (ON_REQUEST.includes(item.family)) return needed.has(item.family);

    return true;
  });
}

/** Whether a student may add this device type at all. */
export function isPlaceable(
  type: string,
  requiredFamilies: string[] = [],
): boolean {
  if (paletteEndDevices(requiredFamilies).some((item) => item.type === type)) {
    return true;
  }

  return Object.values(DEVICE_CATEGORIES.networkDevices.subcategories).some(
    (subcategory) => subcategory.models.some((model) => model.type === type),
  );
}
