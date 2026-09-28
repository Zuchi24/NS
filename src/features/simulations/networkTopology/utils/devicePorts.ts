import type { Device, Port } from "../types";

export function getDevicePorts(device: Device): Port[] {
  const baseX = device.x + 40;
  const baseY = device.y + 40;

  /*
   * PC / LAPTOP / PRINTER / SMARTPHONE
   */

  if (
    device.type.includes("pc") ||
    device.type.includes("laptop") ||
    device.type.includes("printer") ||
    device.type.includes("smartphone")
  ) {
    return [
      {
        id: `${device.id}-eth0`,
        deviceId: device.id,
        x: baseX + 20,
        y: baseY + 20,
        label: "Eth0",
      },
    ];
  }

  /*
   * SERVER
   */

  if (device.type.includes("server")) {
    return [
      {
        id: `${device.id}-eth0`,
        deviceId: device.id,
        x: baseX - 10,
        y: baseY,
        label: "Eth0",
      },
      {
        id: `${device.id}-eth1`,
        deviceId: device.id,
        x: baseX + 30,
        y: baseY,
        label: "Eth1",
      },
    ];
  }

  /*
   * SWITCH
   *
   * In the port strip under the switch's name (PlacedDevice), two rows of
   * three, rather than over the drawing — where they hid the switch itself.
   * Offsets from the card's top-left: columns at 18, 36 and 54 across its 84px
   * width, rows at 100 and 116 inside the strip.
   */

  if (device.type.includes("switch")) {
    const columns = [device.x + 18, device.x + 36, device.x + 54];
    const rows = [device.y + 100, device.y + 116];

    return [1, 2, 3, 4, 5, 6].map((n) => ({
      id: `${device.id}-fa0/${n}`,
      deviceId: device.id,
      x: columns[(n - 1) % 3],
      y: rows[Math.floor((n - 1) / 3)],
      label: `Fa0/${n}`,
    }));
  }

  /*
   * ROUTER
   */

  if (device.type.includes("router")) {
    return [
      {
        id: `${device.id}-ge0/0`,
        deviceId: device.id,
        x: baseX - 20,
        y: baseY,
        label: "GE0/0",
      },
      {
        id: `${device.id}-ge0/1`,
        deviceId: device.id,
        x: baseX + 20,
        y: baseY,
        label: "GE0/1",
      },
      {
        id: `${device.id}-ge0/2`,
        deviceId: device.id,
        x: baseX,
        y: baseY + 25,
        label: "GE0/2",
      },
    ];
  }

  /*
   * HUB
   *
   * One under each of the hub's lights (DeviceIcon), in the gap between its
   * body and its name, rather than on top of them — where they hid the lights.
   * Offsets from the card's top-left: the lights' centres are at 27, 42 and 57
   * across, so the 12px dots start 6px before each; the body ends at 54 down,
   * the dots run from 58 to 70, and the name starts at 78.
   */

  if (device.type.includes("hub")) {
    const columns = [device.x + 21, device.x + 36, device.x + 51];

    return [1, 2, 3].map((n) => ({
      id: `${device.id}-port${n}`,
      deviceId: device.id,
      x: columns[n - 1],
      y: device.y + 58,
      label: `Port${n}`,
    }));
  }

  return [];
}
