import { DEVICE_CATEGORIES } from "../data/deviceCategories";

/**
 * A device's family — "pc", "switch", "router" — is what challenge rules are
 * written against, so an author asks for "a switch" rather than knowing that
 * the canvas calls it `switch-2960`.
 *
 * The map is built from the device library itself, so adding a model to
 * DEVICE_CATEGORIES is all it takes for the grader to understand it.
 */
const FAMILY_BY_TYPE: Record<string, string> = (() => {
  const map: Record<string, string> = {};

  for (const item of DEVICE_CATEGORIES.endDevices.items) {
    map[item.type] = item.family;
  }

  for (const subcategory of Object.values(
    DEVICE_CATEGORIES.networkDevices.subcategories,
  )) {
    for (const model of subcategory.models) {
      map[model.type] = subcategory.family;
    }
  }

  return map;
})();

/**
 * Falls back to the part before the first hyphen for a type the library no
 * longer lists, which is how every current type is named anyway.
 */
export function familyForType(type: string): string {
  return FAMILY_BY_TYPE[type] ?? type.split("-")[0];
}
