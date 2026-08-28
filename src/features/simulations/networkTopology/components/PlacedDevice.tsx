import { useRef } from "react";
import { useDrag } from "react-dnd";
import { DeviceIcon } from "./DeviceIcon";
import { getDevicePorts } from "../utils/devicePorts";
import type { Port } from "../types";

export function PlacedDevice({
  device,
  isSelected,
  isConnecting,
  isDeviceConnected,
  portStatus,
  showPorts,
  onClick,
  onPortClick,
  onDragEnd,
}: any) {
  const dragRef = useRef<HTMLDivElement | null>(null);

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

  drag(dragRef);

  const ports = getDevicePorts(device);

  return (
    <div
      ref={dragRef}
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
            ? "border-blue-500 ring-2 ring-blue-300"
            : isConnecting
            ? "border-orange-500 ring-2 ring-orange-300"
            : "border-gray-300"
        }`}
      >
        <DeviceIcon
          type={device.type}
          model={device.model}
          portStatus={portStatus}
          deviceConnected={isDeviceConnected}
        />

        <div className="text-xs text-center text-gray-900 mt-1 font-medium">
          {device.label}
        </div>
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

          return (
            <div
              key={port.id}
              onClick={(e) => {
                e.stopPropagation();
                onPortClick(port);
              }}
              className={`absolute w-3 h-3 rounded-full cursor-pointer border-2 border-white shadow-lg transition-all hover:scale-125 ${
                isPortConnected
                  ? "bg-emerald-500 hover:bg-emerald-600"
                  : "bg-red-500 hover:bg-red-600"
              }`}
              style={{
                left: port.x - device.x,
                top: port.y - device.y,
              }}
              title={`${port.label} - ${
                isPortConnected ? "Connected" : "Available"
              }`}
            />
          );
        })}
    </div>
  );
}
