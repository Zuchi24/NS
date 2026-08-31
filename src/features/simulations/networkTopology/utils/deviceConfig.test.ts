import { describe, expect, it } from "vitest";

import {
  configDraftFor,
  configKind,
  hasConfigErrors,
  isBlank,
  isConfigurable,
  isSubnetMask,
  validateDeviceConfig,
} from "./deviceConfig";
import type { Device } from "../types";

/**
 * What the Configure form will and will not save.
 *
 * The properties panel is read-only now, so this is the only way an address
 * reaches a device — which is the point: a half-typed address can no longer
 * land in the topology on its way to being finished.
 */

const draft = (over: Partial<Record<string, string>> = {}) => ({
  ipAddress: "192.168.1.10",
  subnetMask: "255.255.255.0",
  gateway: "192.168.1.1",
  ...over,
});

function device(over: Partial<Device> = {}): Device {
  return {
    id: "d1",
    type: "pc",
    family: "pc",
    label: "PC1",
    x: 0,
    y: 0,
    ...over,
  };
}

describe("a good configuration", () => {
  it("saves", () => {
    expect(validateDeviceConfig(draft())).toEqual({});
    expect(hasConfigErrors(validateDeviceConfig(draft()))).toBe(false);
  });

  it("saves without a gateway, which a LAN-only device does not need", () => {
    expect(validateDeviceConfig(draft({ gateway: "" }))).toEqual({});
  });

  it("ignores surrounding whitespace", () => {
    expect(validateDeviceConfig(draft({ ipAddress: " 192.168.1.10 " }))).toEqual(
      {},
    );
  });
});

describe("addresses that are not addresses", () => {
  it("rejects a missing IP", () => {
    expect(validateDeviceConfig(draft({ ipAddress: "" })).ipAddress).toBe(
      "Enter an IP address",
    );
  });

  it("rejects an octet over 255", () => {
    expect(
      validateDeviceConfig(draft({ ipAddress: "192.168.1.300" })).ipAddress,
    ).toContain("valid IPv4");
  });

  it("rejects too few octets", () => {
    expect(validateDeviceConfig(draft({ ipAddress: "192.168.1" })).ipAddress)
      .toContain("valid IPv4");
  });

  it("rejects text", () => {
    expect(validateDeviceConfig(draft({ ipAddress: "not an ip" })).ipAddress)
      .toContain("valid IPv4");
  });
});

describe("subnet masks", () => {
  it("accepts the masks a student will actually use", () => {
    expect(isSubnetMask("255.255.255.0")).toBe(true);
    expect(isSubnetMask("255.255.0.0")).toBe(true);
    expect(isSubnetMask("255.255.255.192")).toBe(true);
  });

  it("rejects four valid octets that are not a mask", () => {
    // Parses fine as an address; the ones are not contiguous.
    expect(isSubnetMask("255.0.255.0")).toBe(false);
    expect(isSubnetMask("255.255.255.1")).toBe(false);
  });

  it("rejects the degenerate ones", () => {
    expect(isSubnetMask("0.0.0.0")).toBe(false);
    expect(isSubnetMask("255.255.255.255")).toBe(false);
  });

  it("complains through the form too", () => {
    expect(
      validateDeviceConfig(draft({ subnetMask: "255.0.255.0" })).subnetMask,
    ).toContain("valid subnet mask");

    expect(validateDeviceConfig(draft({ subnetMask: "" })).subnetMask).toBe(
      "Enter a subnet mask",
    );
  });
});

describe("addresses that are not usable hosts", () => {
  it("rejects the network address", () => {
    expect(validateDeviceConfig(draft({ ipAddress: "192.168.1.0" })).ipAddress)
      .toContain("network address");
  });

  it("rejects the broadcast address", () => {
    expect(
      validateDeviceConfig(draft({ ipAddress: "192.168.1.255" })).ipAddress,
    ).toContain("broadcast address");
  });
});

describe("the gateway", () => {
  it("must be on the same network as the device", () => {
    // The quiet mistake: a perfectly valid address that nothing can reach.
    expect(validateDeviceConfig(draft({ gateway: "10.0.0.1" })).gateway).toContain(
      "same network",
    );
  });

  it("must not be the device's own address", () => {
    expect(
      validateDeviceConfig(
        draft({ ipAddress: "192.168.1.10", gateway: "192.168.1.10" }),
      ).gateway,
    ).toContain("own address");
  });

  it("must still parse", () => {
    expect(validateDeviceConfig(draft({ gateway: "192.168.1" })).gateway)
      .toContain("valid IPv4");
  });

  it("is accepted anywhere else on the network", () => {
    expect(validateDeviceConfig(draft({ gateway: "192.168.1.254" }))).toEqual({});
  });
});

describe("which devices can be configured", () => {
  it("treats end devices as hosts, which must be addressed", () => {
    expect(configKind(device({ family: "pc" }))).toBe("host");
    expect(configKind(device({ family: "laptop" }))).toBe("host");
    expect(configKind(device({ family: "printer" }))).toBe("host");
    expect(configKind(device({ family: "server" }))).toBe("host");
  });

  it("treats a router as a host, which is how a gateway gets its address", () => {
    // "Address the gateway" grades config.ipAddress on a router.
    expect(configKind(device({ family: "router" }))).toBe("host");
  });

  it("gives a switch management settings rather than none", () => {
    // A switch has something to open — an optional management address — but it
    // is never required for the switch to do its job.
    expect(configKind(device({ family: "switch" }))).toBe("management");
    expect(isConfigurable(device({ family: "switch" }))).toBe(true);
  });

  it("has nothing to offer for a hub", () => {
    expect(configKind(device({ family: "hub" }))).toBeNull();
    expect(isConfigurable(device({ family: "hub" }))).toBe(false);
    expect(configKind(null)).toBeNull();
  });
});

describe("a switch's management address is optional", () => {
  const blank = { ipAddress: "", subnetMask: "", gateway: "" };

  it("saves a switch with nothing filled in at all", () => {
    // An unmanaged switch is a normal switch, not an unfinished form.
    expect(isBlank(blank)).toBe(true);
    expect(validateDeviceConfig(blank, { optional: true })).toEqual({});
  });

  it("still refuses a host with nothing filled in", () => {
    expect(hasConfigErrors(validateDeviceConfig(blank))).toBe(true);
  });

  it("checks a management address once one is being given", () => {
    // Half-entered is still wrong: an address with no mask means nothing.
    const partial = { ipAddress: "192.168.1.2", subnetMask: "", gateway: "" };

    expect(validateDeviceConfig(partial, { optional: true }).subnetMask).toBe(
      "Enter a subnet mask",
    );
  });

  it("accepts a complete management address", () => {
    expect(
      validateDeviceConfig(
        { ipAddress: "192.168.1.2", subnetMask: "255.255.255.0", gateway: "" },
        { optional: true },
      ),
    ).toEqual({});
  });

  it("applies the same gateway rule to a management address", () => {
    expect(
      validateDeviceConfig(
        {
          ipAddress: "192.168.1.2",
          subnetMask: "255.255.255.0",
          gateway: "10.0.0.1",
        },
        { optional: true },
      ).gateway,
    ).toContain("same network");
  });
});

describe("the form's starting values", () => {
  it("starts from what the device is already set to", () => {
    expect(
      configDraftFor(
        device({
          config: {
            ipAddress: "10.0.0.5",
            subnetMask: "255.0.0.0",
            gateway: "10.0.0.1",
          },
        }),
      ),
    ).toEqual({
      ipAddress: "10.0.0.5",
      subnetMask: "255.0.0.0",
      gateway: "10.0.0.1",
    });
  });

  it("starts empty for a device that has never been configured", () => {
    expect(configDraftFor(device())).toEqual({
      ipAddress: "",
      subnetMask: "",
      gateway: "",
    });
  });
});
