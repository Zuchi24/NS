// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { DeviceIcon } from "./DeviceIcon";
import { getDevicePorts } from "../utils/devicePorts";
import type { Device, Port } from "../types";

/**
 * A device's port lights. Each is lit by the port it is named for, and sits
 * where that port's dot does — so a cable on the top-middle dot of a switch
 * lights the top-middle light, not whichever light came second in a list.
 */

afterEach(cleanup);

const device = (type: string) => ({ id: "D1", type, family: type, label: type, x: 100, y: 100 }) as Device;

function drawWith(type: string, connected: Port[]) {
  const ports = getDevicePorts(device(type));
  const portStatus = Object.fromEntries(ports.map((port) => [port.id, connected.some((c) => c.id === port.id)]));

  render(<DeviceIcon type={type} ports={ports} portStatus={portStatus} />);

  return screen.getAllByTestId("port-led");
}

const litLeds = (leds: HTMLElement[]) =>
  leds.filter((led) => led.getAttribute("data-lit") === "true").map((led) => led.getAttribute("data-port"));

describe.each(["switch-2960", "router-1941", "server", "hub-generic"])("a %s", (type) => {
  const ports = getDevicePorts(device(type));

  it("has one light for each of its ports", () => {
    const leds = drawWith(type, []);

    expect(leds.map((led) => led.getAttribute("data-port")).sort()).toEqual(ports.map((port) => port.label).sort());
    expect(litLeds(leds)).toEqual([]);
  });

  it.each(ports.map((port) => [port.label, port] as const))("lights only %s's light when only it is connected", (label, port) => {
    expect(litLeds(drawWith(type, [port]))).toEqual([label]);
  });
});

describe("a switch's lights", () => {
  it("are laid out like its dots: two rows of three, in the same order", () => {
    const ports = getDevicePorts(device("switch-2960"));
    const leds = drawWith("switch-2960", []);

    // The dots, read row by row, left to right.
    const byPosition = [...ports].sort((a, b) => a.y - b.y || a.x - b.x).map((port) => port.label);
    // The lights, as drawn: the same reading order.
    const drawn = leds.map((led) => led.getAttribute("data-port"));

    expect(drawn).toEqual(byPosition);
    expect(drawn).toEqual(["Fa0/1", "Fa0/2", "Fa0/3", "Fa0/4", "Fa0/5", "Fa0/6"]);

    const rows = leds.map((led) => led.parentElement);
    expect(new Set(rows).size).toBe(2);
    expect(rows.slice(0, 3).every((row) => row === rows[0])).toBe(true);
  });

  it("lights the top-middle light for the top-middle dot, Fa0/2", () => {
    const fa02 = getDevicePorts(device("switch-2960"))[1];
    const leds = drawWith("switch-2960", [fa02]);

    expect(litLeds(leds)).toEqual(["Fa0/2"]);
    expect(leds.indexOf(leds.find((led) => led.getAttribute("data-lit") === "true")!)).toBe(1);
  });
});

describe("a router's lights", () => {
  it("sit on the side of their dots: GE0/0 left, GE0/1 right, GE0/2 at the bottom", () => {
    const leds = drawWith("router-1941", []);
    const at = (label: string) => leds.find((led) => led.getAttribute("data-port") === label)!.className;

    expect(at("GE0/0")).toContain("left-1");
    expect(at("GE0/1")).toContain("right-1");
    expect(at("GE0/2")).toContain("bottom-0.5");
  });
});

it("lights nothing in the palette, where a device has no ports yet", () => {
  render(<DeviceIcon type="switch-2960" />);

  expect(litLeds(screen.getAllByTestId("port-led"))).toEqual([]);
});
