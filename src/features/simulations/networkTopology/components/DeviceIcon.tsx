import { Wifi } from "lucide-react";
import type { Port } from "../types";

/**
 * One port's light on a device's drawing. Lit by the port it is named for —
 * never by where that port falls in a list — and placed where that port's dot
 * is on the card (getDevicePorts), so a cable on a dot lights the light in the
 * same spot.
 */
function PortLed({ port, lit, className = "" }: { port: string; lit: boolean; className?: string }) {
  return (
    <div
      data-testid="port-led"
      data-port={port}
      data-lit={lit}
      className={`w-1.5 h-1.5 rounded-full ${lit ? "bg-emerald-500" : "bg-gray-300"} ${className}`}
    />
  );
}

export function DeviceIcon({
  type,
  model,
  ports = [],
  portStatus = {},
  deviceConnected = false,
}: {
  type: string;
  model?: string;
  /** The device's own ports (getDevicePorts). None in the palette, where nothing is lit. */
  ports?: Port[];
  /** Whether each port is connected, by port id. */
  portStatus?: Record<string, boolean>;
  deviceConnected?: boolean;
}) {
  /** Whether the port with this label is connected. */
  const lit = (label: string): boolean => {
    const port = ports.find((candidate) => candidate.label === label);

    return port !== undefined && portStatus[port.id] === true;
  };

  /*
   * END DEVICES
   *
   * Red = not connected
   * Green = connected
   */

  /*
   * A desktop: a monitor on a stand, with the tower case beside it — so it
   * does not read as the laptop below, which is a screen on a flat base.
   */
  if (type.includes("pc")) {
    return (
      <div className="w-16 h-16 flex items-end justify-center gap-1 pb-2">
        <div className="flex flex-col items-center">
          <div className="w-10 h-8 bg-gray-700 rounded-sm border-2 border-gray-800 relative">
            <div
              className={`absolute inset-0.5 rounded-sm transition-colors ${
                deviceConnected ? "bg-emerald-500" : "bg-gray-300"
              }`}
            />
          </div>
          <div className="w-1.5 h-1.5 bg-gray-600" />
          <div className="w-6 h-1 bg-gray-600 rounded-sm" />
        </div>

        <div className="w-3.5 h-10 bg-gray-700 rounded-sm border border-gray-800 flex flex-col items-center gap-0.5 pt-1">
          <div className="w-2 h-0.5 bg-gray-500 rounded-full" />
          <div className="w-2 h-0.5 bg-gray-500 rounded-full" />
          <div
            className={`mt-auto mb-1 w-1 h-1 rounded-full transition-colors ${
              deviceConnected ? "bg-emerald-400" : "bg-gray-400"
            }`}
          />
        </div>
      </div>
    );
  }

  if (type.includes("laptop")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-12 h-8 bg-gray-600 rounded-t border-2 border-gray-700 relative">
          <div
            className={`absolute inset-1 rounded-sm transition-colors ${
                deviceConnected ? "bg-emerald-500" : "bg-gray-300"
              }`}
          />
        </div>

        <div className="w-14 h-1 bg-gray-500" />
      </div>
    );
  }

  /*
   * SERVER
   *
   * Two ports, side by side like their dots: Eth0 on the left, Eth1 on the
   * right, on the middle unit. The other units are drive bays, not ports.
   */

  if (type.includes("server")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center gap-0.5">
        <div className="w-12 h-2.5 bg-gray-700 border border-gray-800 rounded flex items-center px-1">
          <div className="w-4 h-0.5 bg-gray-500 rounded-full" />
        </div>

        <div className="w-12 h-2.5 bg-gray-700 border border-gray-800 rounded flex items-center justify-between px-1">
          <PortLed port="Eth0" lit={lit("Eth0")} />
          <PortLed port="Eth1" lit={lit("Eth1")} />
        </div>

        <div className="w-12 h-2.5 bg-gray-700 border border-gray-800 rounded flex items-center px-1">
          <div className="w-4 h-0.5 bg-gray-500 rounded-full" />
        </div>
      </div>
    );
  }

  /*
   * SWITCH
   *
   * Two rows of three, read like the dots in the port strip: Fa0/1 to Fa0/3
   * across the top, Fa0/4 to Fa0/6 across the bottom.
   */

  if (type.includes("switch")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-14 h-8 bg-gray-800 border-2 border-gray-900 rounded flex flex-col justify-center gap-1 px-2">
          {[
            ["Fa0/1", "Fa0/2", "Fa0/3"],
            ["Fa0/4", "Fa0/5", "Fa0/6"],
          ].map((row) => (
            <div key={row[0]} className="flex items-center justify-between">
              {row.map((label) => (
                <PortLed key={label} port={label} lit={lit(label)} />
              ))}
            </div>
          ))}
        </div>

        {model && (
          <div className="text-[8px] text-gray-600 mt-0.5">
            {model}
          </div>
        )}
      </div>
    );
  }

  /*
   * ROUTER
   */

  if (type.includes("router")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-14 h-8 bg-blue-900 border-2 border-blue-950 rounded-lg relative flex items-center justify-center">
          <Wifi className="w-6 h-6 text-blue-300" />

          {/* Where the router's dots are: GE0/0 on the left, GE0/1 on the
              right, GE0/2 at the bottom in the middle. */}
          <PortLed port="GE0/0" lit={lit("GE0/0")} className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 border border-white" />
          <PortLed port="GE0/1" lit={lit("GE0/1")} className="absolute right-1 top-1/2 -translate-y-1/2 w-2 h-2 border border-white" />
          <PortLed port="GE0/2" lit={lit("GE0/2")} className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-2 h-2 border border-white" />
        </div>

        {model && (
          <div className="text-[8px] text-gray-600 mt-0.5">
            {model}
          </div>
        )}
      </div>
    );
  }

  /*
   * HUB
   *
   * Port1 to Port3, left to right, each straight above its dot
   * (getDevicePorts): the ends of the row and its middle, 15px apart.
   */

  if (type.includes("hub")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-14 h-6 bg-gray-700 border-2 border-gray-800 rounded flex items-center justify-between px-2">
          <PortLed port="Port1" lit={lit("Port1")} />
          <PortLed port="Port2" lit={lit("Port2")} />
          <PortLed port="Port3" lit={lit("Port3")} />
        </div>
      </div>
    );
  }

  /*
   * PRINTER
   */

  if (type.includes("printer")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-12 h-8 bg-gray-500 border-2 border-gray-600 rounded relative">
          <div
            className={`absolute top-1 left-2 right-2 h-1 rounded transition-colors ${
              deviceConnected ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
        </div>
      </div>
    );
  }

  /*
   * SMARTPHONE
   */

  if (type.includes("smartphone")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-6 h-10 bg-gray-800 border-2 border-gray-900 rounded-lg relative">
          <div
            className={`absolute inset-1 rounded transition-colors ${
              deviceConnected ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
        </div>
      </div>
    );
  }

  return <div className="w-16 h-16 bg-gray-400 rounded" />;
}
