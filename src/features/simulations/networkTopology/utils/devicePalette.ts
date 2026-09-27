import { DEVICE_CATEGORIES } from "../data/deviceCategories";

/**
 * What the device library offers a student to add.
 *
 * Every end device in DEVICE_CATEGORIES — PC, laptop, server, printer and
 * smartphone — in free play and in every challenge alike, and every network
 * device. DEVICE_CATEGORIES is also what `familyForType` builds its map from
 * and what draws a device in a topology a student saved earlier, so it stays
 * the one list: nothing is offered that it does not define.
 */

export type PaletteDevice =
  (typeof DEVICE_CATEGORIES)["endDevices"]["items"][number];

/** The end devices a student may place. */
export function paletteEndDevices(): PaletteDevice[] {
  return DEVICE_CATEGORIES.endDevices.items;
}

/** Whether a student may add this device type at all. */
export function isPlaceable(type: string): boolean {
  if (paletteEndDevices().some((item) => item.type === type)) {
    return true;
  }

  return Object.values(DEVICE_CATEGORIES.networkDevices.subcategories).some(
    (subcategory) => subcategory.models.some((model) => model.type === type),
  );
}
