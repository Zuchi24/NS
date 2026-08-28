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
   */

  if (device.type.includes("switch")) {
    return [
      {
        id: `${device.id}-fa0/1`,
        deviceId: device.id,
        x: baseX - 20,
        y: baseY - 10,
        label: "Fa0/1",
      },
      {
        id: `${device.id}-fa0/2`,
        deviceId: device.id,
        x: baseX,
        y: baseY - 10,
        label: "Fa0/2",
      },
      {
        id: `${device.id}-fa0/3`,
        deviceId: device.id,
        x: baseX + 20,
        y: baseY - 10,
        label: "Fa0/3",
      },
      {
        id: `${device.id}-fa0/4`,
        deviceId: device.id,
        x: baseX - 20,
        y: baseY + 30,
        label: "Fa0/4",
      },
      {
        id: `${device.id}-fa0/5`,
        deviceId: device.id,
        x: baseX,
        y: baseY + 30,
        label: "Fa0/5",
      },
      {
        id: `${device.id}-fa0/6`,
        deviceId: device.id,
        x: baseX + 20,
        y: baseY + 30,
        label: "Fa0/6",
      },
    ];
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
   */

  if (device.type.includes("hub")) {
    return [
      {
        id: `${device.id}-port1`,
        deviceId: device.id,
        x: baseX - 15,
        y: baseY,
        label: "Port1",
      },
      {
        id: `${device.id}-port2`,
        deviceId: device.id,
        x: baseX,
        y: baseY,
        label: "Port2",
      },
      {
        id: `${device.id}-port3`,
        deviceId: device.id,
        x: baseX + 15,
        y: baseY,
        label: "Port3",
      },
    ];
  }

  return [];
}
