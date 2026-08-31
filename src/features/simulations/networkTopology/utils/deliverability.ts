import type { Connection, Device } from "../types";
import { findPacketPath } from "./packetPath";
import type { PacketPath } from "./packetPath";
import {
  areDevicesSameSubnet,
  getDeviceCategory,
  haveDuplicateIpAddresses,
  isConsoleLink,
  isIpConfigured,
} from "./networkValidation";

/**
 * Whether one device can actually get a message to another, and why not when
 * it cannot.
 *
 * Everything the workspace needs to decide before a packet moves, in one place
 * and answered from the topology as it stands: what is wired, with which cable,
 * and how each device is addressed. The canvas used to ask these questions as a
 * chain of ifs with a message hard-coded into each; gathering them here is what
 * makes the answer testable, and gives router support somewhere to go later
 * without touching the packet animation.
 *
 * Two things stay strictly apart, because they are separate in a real network:
 *
 *   forwarding    a switch moves frames between its ports whether or not
 *                 anybody ever gave it a management address
 *   management    an address on the switch itself, for administering it
 *
 * So a switch with no configuration at all still carries traffic. Nothing here
 * looks at a switch's own config, and it must not start to.
 */

export type DeliveryFailure =
  | "same-device"
  | "no-source-config"
  | "no-destination-config"
  | "duplicate-ip"
  | "console-only"
  | "no-path"
  | "different-subnet";

export type DeliveryResult =
  | { ok: true; path: PacketPath }
  | { ok: false; reason: DeliveryFailure; message: string };

/**
 * Whether the topology can move traffic between two different networks.
 *
 * The one place router support would go. It is not implemented: the canvas's
 * own cable rules do not carry a router's links, so no packet has ever crossed
 * one, and pretending otherwise here would animate a delivery that the rest of
 * the simulator cannot back up. Until a router can actually be traversed, two
 * devices on different networks cannot reach each other, and the message below
 * says exactly that rather than blaming the addresses.
 *
 * When routing is implemented, this is the function that changes.
 */
function canRouteBetweenSubnets(): boolean {
  return false;
}

/** Whether a device is one that originates and receives traffic. */
function isHost(device: Device): boolean {
  return getDeviceCategory(device.type) === "end";
}

/**
 * Whether these two are joined by a console lead and nothing else.
 *
 * Worth telling apart from "not wired at all": the student has plugged
 * something in, and the reason it does not work is that a console lead is not a
 * network cable.
 */
function joinedOnlyByConsole(
  devices: Device[],
  connections: Connection[],
  fromId: string,
  toId: string,
): boolean {
  const byId = new Map(devices.map((device) => [device.id, device]));

  return connections.some((connection) => {
    const source = byId.get(connection.from);
    const target = byId.get(connection.to);

    if (!source || !target) return false;

    const joinsThePair =
      (connection.from === fromId && connection.to === toId) ||
      (connection.from === toId && connection.to === fromId);

    return joinsThePair && isConsoleLink(connection, source, target);
  });
}

/**
 * Can this message be sent, and by what route.
 *
 * Checked in the order a student would find useful: whether the devices are
 * addressed at all, then whether there is a wire, then whether the addresses
 * allow them to talk over it. A missing address is reported before a missing
 * cable because it is the thing they are more likely to have forgotten.
 */
export function evaluateDelivery(
  devices: Device[],
  connections: Connection[],
  fromId: string,
  toId: string,
): DeliveryResult {
  const byId = new Map(devices.map((device) => [device.id, device]));
  const source = byId.get(fromId);
  const destination = byId.get(toId);

  if (!source || !destination) {
    return {
      ok: false,
      reason: "no-path",
      message: "Delivery failed: the selected devices are not on the canvas.",
    };
  }

  if (source.id === destination.id) {
    return {
      ok: false,
      reason: "same-device",
      message: "Delivery failed: choose two different devices.",
    };
  }

  // Only hosts are addressed; a switch in the middle is not asked for one.
  if (isHost(source) && !isIpConfigured(source)) {
    return {
      ok: false,
      reason: "no-source-config",
      message: `Delivery failed: ${source.label} has no valid IP configuration.`,
    };
  }

  if (isHost(destination) && !isIpConfigured(destination)) {
    return {
      ok: false,
      reason: "no-destination-config",
      message: `Delivery failed: ${destination.label} has no valid IP configuration.`,
    };
  }

  if (haveDuplicateIpAddresses(source, destination)) {
    return {
      ok: false,
      reason: "duplicate-ip",
      message: `Delivery failed: ${source.label} and ${destination.label} have the same IP address.`,
    };
  }

  // The route, over data cables only. A console lead is not one of them, so it
  // can never appear in this path.
  const path = findPacketPath(devices, connections, fromId, toId);

  if (!path) {
    if (joinedOnlyByConsole(devices, connections, fromId, toId)) {
      return {
        ok: false,
        reason: "console-only",
        message:
          "Delivery failed: a console connection carries management access, not network traffic.",
      };
    }

    return {
      ok: false,
      reason: "no-path",
      message: `Delivery failed: there is no network path from ${source.label} to ${destination.label}.`,
    };
  }

  // Same network: a switch forwards between them, and nothing more is needed.
  if (areDevicesSameSubnet(source, destination)) {
    return { ok: true, path };
  }

  if (canRouteBetweenSubnets()) {
    return { ok: true, path };
  }

  return {
    ok: false,
    reason: "different-subnet",
    message:
      "Delivery failed: destination is on a different subnet and no router is available.",
  };
}
