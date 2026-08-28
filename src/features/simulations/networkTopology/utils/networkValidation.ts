import type { Device, Connection } from "../types";
import { GRID_SIZE } from "./constants";

/**
 * Pure helpers for the topology editor: grid snapping, IP parsing and subnet
 * comparison, device classification, and cable-compatibility rules. Nothing
 * here reads component state, so each function can be reasoned about (and
 * tested) on its own.
 */

export const snapToGrid = (value: number) =>
  Math.round(value / GRID_SIZE) * GRID_SIZE;


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
   ========================================================= */

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
   * Straight-through
   *
   * End Device <-> Switch
   * Switch <-> Switch
   */

  if (
    connection.cableType ===
    "copper-straight"
  ) {
    return (
      (sourceType === "end" &&
        targetType === "switch") ||
      (sourceType === "switch" &&
        targetType === "end") ||
      (sourceType === "switch" &&
        targetType === "switch")
    );
  }

  /*
   * Crossover
   *
   * End Device <-> End Device
   */

  if (
    connection.cableType ===
    "copper-crossover"
  ) {
    return (
      sourceType === "end" &&
      targetType === "end"
    );
  }

  /*
   * Fiber and console are currently
   * not considered valid for simulation.
   */

  return false;
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

/* =========================================================
   PORT STATUS
   ========================================================= */
