import type { Connection, Device } from "./types";
import { familyForType } from "./utils/deviceFamily";

/**
 * The JSON document stored in `simulations.data` and graded by the backend.
 *
 * The canvas calls a wire a "connection"; the grader calls it a "link". That
 * name is the only difference between the two shapes — every field is carried
 * across untouched, so a topology survives a save and reload with its
 * coordinates, cable types and IP configuration intact.
 *
 * The backend reads `devices[].id`, `devices[].type`, `devices[].config` and
 * `links[].from` / `links[].to`; the extra keys are ignored by the grader and
 * kept for the canvas.
 */
export interface TopologyDocument {
  devices: Device[];
  links: Connection[];
}

export function toTopologyDocument(
  devices: Device[],
  connections: Connection[],
): TopologyDocument {
  return { devices, links: connections };
}

/**
 * Reads a stored document back into canvas state. Anything missing or of the
 * wrong shape comes back empty rather than throwing — a topology saved by an
 * older build must not break the workspace.
 */
export function fromTopologyDocument(data: unknown): {
  devices: Device[];
  connections: Connection[];
} {
  const document = (data ?? {}) as Partial<TopologyDocument>;
  const devices = Array.isArray(document.devices) ? document.devices : [];

  return {
    // A topology saved before families existed, or one an author hand-wrote,
    // gets its family filled in on the way back so the rest of the app can
    // rely on it being there.
    devices: devices.map((device) => ({
      ...device,
      family: device.family ?? familyForType(device.type),
    })),
    connections: Array.isArray(document.links) ? document.links : [],
  };
}
