import type { Device } from "../types";
import { parseOctets } from "./networkValidation";

/**
 * Checking an end device's network settings before they are saved.
 *
 * The same three fields the canvas has always stored on `device.config`, and
 * the same `parseOctets` the rest of the topology code reads addresses with —
 * this only decides whether a student may write them, not what they mean.
 */

export interface DeviceConfigDraft {
  ipAddress: string;
  subnetMask: string;
  gateway: string;
}

/** One message per field that is wrong. An empty object means it will save. */
export type DeviceConfigErrors = Partial<Record<keyof DeviceConfigDraft, string>>;

/**
 * Whether a mask is one run of ones followed by one run of zeroes.
 *
 * 255.255.255.0 is a mask; 255.0.255.0 parses as four fine octets and is not.
 */
export function isSubnetMask(value: string): boolean {
  const octets = parseOctets(value);

  if (!octets) return false;

  const bits = octets.reduce((total, octet) => total * 256 + octet, 0);

  // Ones followed by zeroes: inverting gives a value whose successor is a
  // power of two. 0.0.0.0 and 255.255.255.255 are both degenerate as masks.
  const inverted = ~bits >>> 0;

  return bits !== 0 && inverted !== 0 && ((inverted + 1) & inverted) === 0;
}

/** The network an address sits on, once the mask is applied. */
function networkOf(ip: number[], mask: number[]): number[] {
  return ip.map((octet, index) => octet & mask[index]);
}

function sameNetwork(a: number[], b: number[]): boolean {
  return a.every((octet, index) => octet === b[index]);
}

/**
 * Checks a draft configuration.
 *
 * The gateway is optional — a device on a LAN that never leaves it does not
 * need one — but a gateway that is given has to be reachable, which means on
 * the same network as the device itself. That is the mistake worth catching:
 * a gateway on another network is silently useless.
 */
export function validateDeviceConfig(
  draft: DeviceConfigDraft,
  { optional = false }: { optional?: boolean } = {},
): DeviceConfigErrors {
  const errors: DeviceConfigErrors = {};

  const ip = parseOctets(draft.ipAddress);
  const mask = parseOctets(draft.subnetMask);

  // A switch's management address is genuinely optional: left entirely blank it
  // means "not managed over the network", which is a normal state for a switch
  // and must never be treated as an unfinished form.
  if (optional && isBlank(draft)) {
    return errors;
  }

  if (!draft.ipAddress.trim()) {
    errors.ipAddress = "Enter an IP address";
  } else if (!ip) {
    errors.ipAddress = "Not a valid IPv4 address, e.g. 192.168.1.10";
  }

  if (!draft.subnetMask.trim()) {
    errors.subnetMask = "Enter a subnet mask";
  } else if (!isSubnetMask(draft.subnetMask)) {
    errors.subnetMask = "Not a valid subnet mask, e.g. 255.255.255.0";
  }

  // The host part cannot be all zeroes or all ones: those name the network
  // itself and its broadcast address, not a device on it.
  if (ip && mask && isSubnetMask(draft.subnetMask)) {
    const host = ip.map((octet, index) => octet & ~mask[index] & 255);
    const hostBits = host.reduce((total, octet) => total * 256 + octet, 0);
    const size = mask.reduce((total, octet) => total * 256 + (~octet & 255), 0);

    if (hostBits === 0) {
      errors.ipAddress = "That is the network address, not a usable host";
    } else if (size > 0 && hostBits === size) {
      errors.ipAddress = "That is the broadcast address, not a usable host";
    }
  }

  if (draft.gateway.trim()) {
    const gateway = parseOctets(draft.gateway);

    if (!gateway) {
      errors.gateway = "Not a valid IPv4 address, e.g. 192.168.1.1";
    } else if (ip && mask && isSubnetMask(draft.subnetMask)) {
      if (!sameNetwork(networkOf(ip, mask), networkOf(gateway, mask))) {
        errors.gateway = "The gateway must be on the same network as this device";
      } else if (sameNetwork(ip, gateway)) {
        errors.gateway = "The gateway cannot be this device's own address";
      }
    }
  }

  return errors;
}

export function hasConfigErrors(errors: DeviceConfigErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Nothing filled in at all. */
export function isBlank(draft: DeviceConfigDraft): boolean {
  return (
    !draft.ipAddress.trim() &&
    !draft.subnetMask.trim() &&
    !draft.gateway.trim()
  );
}

/**
 * What kind of settings a device has, if any.
 *
 *   "host"        an address the device needs in order to communicate at all
 *   "management"  an optional address for administering the device itself
 *
 * A switch is "management": it forwards frames between its ports whether or not
 * anyone ever addresses it, so its settings exist but are never required. That
 * distinction is the whole point — an unconfigured switch is a working switch.
 */
export type ConfigKind = "host" | "management";

const HOST_FAMILIES = [
  "pc",
  "laptop",
  "server",
  "printer",
  "smartphone",
  "router",
];

const MANAGED_FAMILIES = ["switch"];

export function configKind(
  device: Device | null | undefined,
): ConfigKind | null {
  if (!device) return null;
  if (HOST_FAMILIES.includes(device.family)) return "host";
  if (MANAGED_FAMILIES.includes(device.family)) return "management";

  return null;
}

/** Whether this device has any settings to open at all. */
export function isConfigurable(device: Device | null | undefined): boolean {
  return configKind(device) !== null;
}

/** The saved values, as the Configure form starts from them. */
export function configDraftFor(device: Device): DeviceConfigDraft {
  return {
    ipAddress: device.config?.ipAddress ?? "",
    subnetMask: device.config?.subnetMask ?? "",
    gateway: device.config?.gateway ?? "",
  };
}
