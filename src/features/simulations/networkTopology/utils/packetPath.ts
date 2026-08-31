import type { Connection, Device } from "../types";
import { getDevicePorts } from "./devicePorts";
import { isCableValid } from "./networkValidation";

/**
 * Working out where a packet actually goes, and where to draw it.
 *
 * The route is read from the topology on the canvas — the same devices and the
 * same connections the student wired — so a message from one PC to another
 * travels through whatever is between them and through nothing else. Nothing
 * here knows what a device is called or assumes any particular shape of
 * network.
 *
 * Which cables count as traversable is not decided here either: `isCableValid`
 * already says which pairs a cable may join, and the connection status dots on
 * the canvas are drawn from the same rule. A packet cannot cross a cable the
 * canvas is already showing as wrong.
 */

export interface Point {
  x: number;
  y: number;
}

/** One leg of the journey: a cable, and which way round it is being crossed. */
export interface PacketHop {
  connectionId: string;
  fromDeviceId: string;
  toDeviceId: string;
}

export interface PacketPath {
  /** Every device the packet passes through, source and destination included. */
  deviceIds: string[];
  /** The cables between them, in order. */
  hops: PacketHop[];
}

/**
 * Which devices a connection joins, or null if either end is missing.
 */
function endpoints(
  connection: Connection,
  byId: Map<string, Device>,
): [Device, Device] | null {
  const from = byId.get(connection.from);
  const to = byId.get(connection.to);

  return from && to ? [from, to] : null;
}

/**
 * The topology as an adjacency list, holding only cables that are actually
 * capable of carrying traffic between the two devices they join.
 */
function buildGraph(
  devices: Device[],
  connections: Connection[],
): Map<string, PacketHop[]> {
  const byId = new Map(devices.map((device) => [device.id, device]));
  const graph = new Map<string, PacketHop[]>();

  for (const device of devices) {
    graph.set(device.id, []);
  }

  for (const connection of connections) {
    const pair = endpoints(connection, byId);

    if (!pair) continue;

    const [from, to] = pair;

    if (!isCableValid(connection, from, to)) continue;

    // Cables are undirected: a packet may cross either way.
    graph.get(from.id)?.push({
      connectionId: connection.id,
      fromDeviceId: from.id,
      toDeviceId: to.id,
    });

    graph.get(to.id)?.push({
      connectionId: connection.id,
      fromDeviceId: to.id,
      toDeviceId: from.id,
    });
  }

  return graph;
}

/**
 * The route a packet takes from one device to another, or null when there is
 * none.
 *
 * Breadth-first, so the route found is the one with fewest hops — which is what
 * a student expects to see when two paths exist. A null result means there is
 * no path: the caller must not animate anything.
 */
export function findPacketPath(
  devices: Device[],
  connections: Connection[],
  fromDeviceId: string,
  toDeviceId: string,
): PacketPath | null {
  if (fromDeviceId === toDeviceId) return null;

  const graph = buildGraph(devices, connections);

  if (!graph.has(fromDeviceId) || !graph.has(toDeviceId)) return null;

  // How each device was first reached, so the route can be walked back.
  const arrivedBy = new Map<string, PacketHop>();
  const seen = new Set<string>([fromDeviceId]);
  const queue: string[] = [fromDeviceId];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current === toDeviceId) {
      return walkBack(arrivedBy, fromDeviceId, toDeviceId);
    }

    for (const hop of graph.get(current) ?? []) {
      if (seen.has(hop.toDeviceId)) continue;

      seen.add(hop.toDeviceId);
      arrivedBy.set(hop.toDeviceId, hop);
      queue.push(hop.toDeviceId);
    }
  }

  return null;
}

function walkBack(
  arrivedBy: Map<string, PacketHop>,
  fromDeviceId: string,
  toDeviceId: string,
): PacketPath {
  const hops: PacketHop[] = [];

  let cursor = toDeviceId;

  while (cursor !== fromDeviceId) {
    const hop = arrivedBy.get(cursor);

    if (!hop) break;

    hops.unshift(hop);
    cursor = hop.fromDeviceId;
  }

  return {
    deviceIds: [fromDeviceId, ...hops.map((hop) => hop.toDeviceId)],
    hops,
  };
}

/**
 * Where one end of a cable is drawn, in canvas coordinates.
 *
 * Read from `getDevicePorts`, which is what the cable itself is drawn from, so
 * the packet sits on the wire rather than near it — and follows the device when
 * a student drags it.
 */
function portPoint(device: Device, portId: string): Point | null {
  const port = getDevicePorts(device).find((candidate) => candidate.id === portId);

  return port ? { x: port.x, y: port.y } : null;
}

/**
 * The route as a run of points to travel along.
 *
 * Each hop contributes the two ports its cable joins. Consecutive hops meet at
 * the device between them, at two different ports on it, so the short segment
 * across that gap is the packet visibly entering a switch and leaving by
 * another port.
 */
export function packetPolyline(
  devices: Device[],
  connections: Connection[],
  path: PacketPath,
): Point[] {
  const devicesById = new Map(devices.map((device) => [device.id, device]));
  const connectionsById = new Map(
    connections.map((connection) => [connection.id, connection]),
  );

  const points: Point[] = [];

  for (const hop of path.hops) {
    const connection = connectionsById.get(hop.connectionId);
    const from = devicesById.get(hop.fromDeviceId);
    const to = devicesById.get(hop.toDeviceId);

    if (!connection || !from || !to) return [];

    // The cable records its own two ends; which is the entry depends on which
    // way this hop crosses it.
    const leaving =
      connection.from === hop.fromDeviceId
        ? connection.fromPort
        : connection.toPort;

    const arriving =
      connection.from === hop.fromDeviceId
        ? connection.toPort
        : connection.fromPort;

    const start = portPoint(from, leaving);
    const end = portPoint(to, arriving);

    if (!start || !end) return [];

    points.push(start, end);
  }

  return points;
}

/** Total length of a run of points. */
export function polylineLength(points: Point[]): number {
  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y,
    );
  }

  return total;
}

/**
 * The point a given distance along the run, for placing the packet.
 *
 * Distance rather than "fraction of each segment" so the packet moves at one
 * steady speed whether a cable is long or short.
 */
export function pointAtDistance(points: Point[], distance: number): Point | null {
  if (points.length === 0) return null;
  if (points.length === 1) return points[0];

  if (distance <= 0) return points[0];

  // Landing exactly on the port rather than a rounding error short of it:
  // summing segment lengths and comparing against the total drifts by the last
  // bit or two, which would leave the packet a hair off the wire as it arrives.
  if (distance >= polylineLength(points)) return points[points.length - 1];

  let travelled = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const segment = Math.hypot(current.x - previous.x, current.y - previous.y);

    if (segment === 0) continue;

    if (travelled + segment >= distance) {
      const into = (distance - travelled) / segment;

      return {
        x: previous.x + (current.x - previous.x) * into,
        y: previous.y + (current.y - previous.y) * into,
      };
    }

    travelled += segment;
  }

  return points[points.length - 1];
}
