import type { Device, Connection } from "../types";
import { DEVICE_SIZE, GRID_SIZE } from "./constants";

/**
 * Pure helpers for the topology editor: grid snapping, IP parsing and subnet
 * comparison, device classification, and cable-compatibility rules. Nothing
 * here reads component state, so each function can be reasoned about (and
 * tested) on its own.
 */

export const snapToGrid = (value: number) =>
  Math.round(value / GRID_SIZE) * GRID_SIZE;

/**
 * Keeps a placed device inside the canvas along one axis.
 *
 * The canvas clips what overflows it, so a device dropped right on an edge —
 * which is where a device dragged in from the palette naturally lands — would
 * otherwise be placed where nobody can see or reach it.
 */
export const clampToCanvas = (value: number, extent: number) =>
  Math.max(0, Math.min(value, Math.max(0, extent - DEVICE_SIZE)));


export const parseOctets = (value: string) => {
  const parts = value.trim().split(".");

  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => {
    const parsed = Number(part.trim());

    return Number.isInteger(parsed) &&
      parsed >= 0 &&
      parsed <= 255
      ? parsed
      : NaN;
  });

  return octets.every(
    (octet) => !Number.isNaN(octet)
  )
    ? octets
    : null;
};

export const isIpConfigured = (
  device: Device | null
) => {
  const ip = parseOctets(
    device?.config?.ipAddress ?? ""
  );

  const mask = parseOctets(
    device?.config?.subnetMask ?? ""
  );

  return Boolean(ip && mask);
};

export const haveDuplicateIpAddresses = (
  a: Device,
  b: Device
) => {
  const ipA = parseOctets(
    a.config?.ipAddress ?? ""
  );

  const ipB = parseOctets(
    b.config?.ipAddress ?? ""
  );

  if (!ipA || !ipB) {
    return false;
  }

  return ipA.every(
    (octet, index) =>
      octet === ipB[index]
  );
};

export const areDevicesSameSubnet = (
  a: Device,
  b: Device
) => {
  const ipA = parseOctets(
    a.config?.ipAddress ?? ""
  );

  const maskA = parseOctets(
    a.config?.subnetMask ?? ""
  );

  const ipB = parseOctets(
    b.config?.ipAddress ?? ""
  );

  const maskB = parseOctets(
    b.config?.subnetMask ?? ""
  );

  if (!ipA || !maskA || !ipB || !maskB) {
    return false;
  }

  if (
    !maskA.every(
      (octet, index) =>
        octet === maskB[index]
    )
  ) {
    return false;
  }

  if (
    ipA.every(
      (octet, index) =>
        octet === ipB[index]
    )
  ) {
    return false;
  }

  return ipA.every(
    (octet, index) =>
      (octet & maskA[index]) ===
      (ipB[index] & maskA[index])
  );
};

/* =========================================================
   DEVICE CATEGORIES
   ========================================================= */

export const getDeviceCategory = (type: string) => {
  /*
   * These are all considered END DEVICES.
   */

  if (
    type.includes("pc") ||
    type.includes("laptop") ||
    type.includes("server") ||
    type.includes("printer") ||
    type.includes("smartphone")
  ) {
    return "end";
  }

  if (type.includes("switch")) {
    return "switch";
  }

  if (type.includes("router")) {
    return "router";
  }

  if (type.includes("hub")) {
    return "hub";
  }

  return "other";
};

export const isEndDevice = (device: Device) => {
  return (
    getDeviceCategory(device.type) === "end"
  );
};

/* =========================================================
   CABLE VALIDATION

   The copper rules are the cable bench's (its written contract):
   auto-MDIX is off, so an end device's port (MDI) meets a switch
   or hub port (MDIX) on a straight-through, and two ports of the
   same kind meet on a cross-over.
   ========================================================= */

/** A switch or a hub: the devices whose ports are MDIX. */
const isSwitchLike = (type: string) =>
  type === "switch" || type === "hub";

/**
 * Whether a packet may cross this cable. The rule the packet route is built
 * from (packetPath), so a router — which does not route yet — is never
 * crossed, even when its link is up (isLinkUp).
 */
export const isCableValid = (
  connection: Connection,
  source: Device,
  target: Device
) => {
  const sourceType = getDeviceCategory(
    source.type
  );

  const targetType = getDeviceCategory(
    target.type
  );

  /*
   * Straight-through: MDI to MDIX
   *
   * End Device <-> Switch
   * End Device <-> Hub
   */

  if (
    connection.cableType ===
    "copper-straight"
  ) {
    return (
      (sourceType === "end" &&
        isSwitchLike(targetType)) ||
      (isSwitchLike(sourceType) &&
        targetType === "end")
    );
  }

  /*
   * Crossover: like to like
   *
   * End Device <-> End Device
   * Switch <-> Switch, Switch <-> Hub, Hub <-> Hub
   */

  if (
    connection.cableType ===
    "copper-crossover"
  ) {
    return (
      (sourceType === "end" &&
        targetType === "end") ||
      (isSwitchLike(sourceType) &&
        isSwitchLike(targetType))
    );
  }

  /*
   * Fiber
   *
   * Switch <-> Switch, and nothing else: the one run the lessons
   * teach, between buildings.
   */

  if (connection.cableType === "fiber") {
    return (
      sourceType === "switch" &&
      targetType === "switch"
    );
  }

  /*
   * Console is management access, never a data link
   * (isConsoleLink).
   */

  return false;
};

/**
 * Whether this cable brings a link up: the ports at both ends light, whether
 * or not a packet may cross it.
 *
 * Every cable a packet may cross is up. So is a router's straight-through
 * uplink to a switch — the gateway the lessons have a student wire — though
 * no packet crosses a router until routing exists (deliverability). No other
 * router link is up: which cable it would take is not decided.
 */
export const isLinkUp = (
  connection: Connection,
  source: Device,
  target: Device
) => {
  if (isCableValid(connection, source, target)) {
    return true;
  }

  const sourceType = getDeviceCategory(source.type);
  const targetType = getDeviceCategory(target.type);

  return (
    connection.cableType === "copper-straight" &&
    ((sourceType === "router" && targetType === "switch") ||
      (sourceType === "switch" && targetType === "router"))
  );
};

/**
 * Whether this cable is a console lead between a host and a switch.
 *
 * A console cable is management access, not a network link: you sit at the PC
 * and configure the switch through it. It carries no Ethernet, which is why
 * `isCableValid` says nothing here — a console lead is deliberately not a valid
 * data connection, and so never enters the packet graph.
 */
export const isConsoleLink = (
  connection: Connection,
  source: Device,
  target: Device
) => {
  if (connection.cableType !== "console") {
    return false;
  }

  const sourceType = getDeviceCategory(source.type);
  const targetType = getDeviceCategory(target.type);

  return (
    (sourceType === "end" && targetType === "switch") ||
    (sourceType === "switch" && targetType === "end")
  );
};

/**
 * The switches this device can configure over a console lead.
 *
 * @return list<Device>
 */
export const consoleTargets = (
  device: Device,
  devices: Device[],
  connections: Connection[]
): Device[] => {
  const byId = new Map(devices.map((d) => [d.id, d]));
  const found: Device[] = [];

  for (const connection of connections) {
    const source = byId.get(connection.from);
    const target = byId.get(connection.to);

    if (!source || !target) {
      continue;
    }

    if (!isConsoleLink(connection, source, target)) {
      continue;
    }

    const other =
      connection.from === device.id
        ? target
        : connection.to === device.id
        ? source
        : null;

    if (
      other &&
      getDeviceCategory(other.type) === "switch" &&
      !found.some((d) => d.id === other.id)
    ) {
      found.push(other);
    }
  }

  return found;
};

export const getConnectionValidity = (
  connection: Connection,
  devices: Device[]
) => {
  const source = devices.find((d) => d.id === connection.from);
  const target = devices.find((d) => d.id === connection.to);

  return Boolean(
    source &&
      target &&
      isCableValid(
        connection,
        source,
        target
      )
  );
};

/** isLinkUp, for a connection looked up among the canvas's devices. */
export const getConnectionLinkUp = (
  connection: Connection,
  devices: Device[]
) => {
  const source = devices.find((d) => d.id === connection.from);
  const target = devices.find((d) => d.id === connection.to);

  return Boolean(
    source &&
      target &&
      isLinkUp(
        connection,
        source,
        target
      )
  );
};

/* =========================================================
   PORT STATUS
   ========================================================= */
