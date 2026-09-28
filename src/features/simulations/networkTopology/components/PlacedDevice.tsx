import { useCallback } from "react";
import { useDrag } from "react-dnd";
import { Settings2 } from "lucide-react";
import { DeviceIcon } from "./DeviceIcon";
import { getDevicePorts } from "../utils/devicePorts";
import type { Port } from "../types";

export function PlacedDevice({
  device,
  isSelected,
  isConnecting,
  isDeviceConnected,
  portStatus,
  consolePorts,
  showPorts,
  canConfigure,
  onClick,
  onConfigure,
  onPortClick,
  onDragEnd,
}: any) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "placed-device",

    item: {
      id: device.id,
      initialX: device.x,
      initialY: device.y,
    },

    end: (_item, monitor) => {
      const delta = monitor.getDifferenceFromInitialOffset();

      if (delta && onDragEnd) {
        onDragEnd(device.id, delta);
      }
    },

    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  /** Connected in the commit phase — see the note in DraggableDevice. */
  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      drag(node);
    },
    [drag],
  );

  const ports = getDevicePorts(device);

  return (
    <div
      ref={attach}
      style={{
        position: "absolute",
        left: device.x,
        top: device.y,
        zIndex: isSelected ? 20 : 10,
      }}
      className={`cursor-move ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div
        onClick={onClick}
        className={`relative bg-white rounded-lg p-2 shadow-lg border-2 transition-all ${
          isSelected
            ? "border-primary ring-2 ring-brand-teal/40"
            : isConnecting
            ? "border-brand-orange ring-2 ring-brand-orange/40"
            : "border-gray-300"
        }`}
      >
        <DeviceIcon
          type={device.type}
          model={device.model}
          ports={ports}
          portStatus={portStatus}
          deviceConnected={isDeviceConnected}
        />

        <div className="text-xs text-center text-gray-900 mt-1 font-medium">
          {device.label}
        </div>

        {/* A switch's ports have a strip of their own under its name, so
            they never cover the drawing. Always there, ports shown or not,
            so the card and its cable ends do not move. Where each port sits
            in it is getDevicePorts'. */}
        {device.type.includes("switch") && (
          <div
            data-testid="port-strip"
            className="mt-1 h-8 rounded-md border border-dashed border-gray-200 bg-gray-50"
          />
        )}

        {/* =================================================
            SETTINGS

            Where a device is configured. On the device rather
            than in the side panel, so it is obvious which one
            is about to be changed.
            ================================================= */}

        {canConfigure && (
          <button
            type="button"
            title={`Configure ${device.label}`}
            aria-label={`Configure ${device.label}`}
            onClick={(e) => {
              e.stopPropagation();
              onConfigure?.(device);
            }}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-gray-300 shadow-sm flex items-center justify-center text-gray-600 hover:text-primary hover:border-brand-teal/50 hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* =====================================================
          PORTS
          Red = unused
          Green = connected
          ===================================================== */}

      {showPorts &&
        ports.map((port: Port) => {
          const isPortConnected =
            portStatus?.[port.id] ?? false;

          // A console lead carries no traffic, so the port is not "connected"
          // in the network sense — but it is in use, and showing it as free
          // would make a plugged-in console cable look like a mistake.
          const isConsolePort =
            consolePorts?.has?.(port.id) ?? false;

          const tone = isPortConnected
            ? "bg-emerald-500 hover:bg-emerald-600"
            : isConsolePort
            ? "bg-blue-500 hover:bg-blue-600"
            : "bg-red-500 hover:bg-red-600";

          return (
            <div
              key={port.id}
              onClick={(e) => {
                e.stopPropagation();
                onPortClick(port);
              }}
              className={`absolute w-3 h-3 rounded-full cursor-pointer border-2 border-white shadow-lg transition-all hover:scale-125 ${tone}`}
              style={{
                left: port.x - device.x,
                top: port.y - device.y,
              }}
              title={`${port.label} - ${
                isPortConnected
                  ? "Connected"
                  : isConsolePort
                  ? "Console"
                  : "Available"
              }`}
            />
          );
        })}
    </div>
  );
}
