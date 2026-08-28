import { useRef } from "react";
import { useDrag } from "react-dnd";
import { DeviceIcon } from "./DeviceIcon";

export function DraggableDevice({ device }: any) {
  const dragRef = useRef<HTMLDivElement | null>(null);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: "device-template",

    item: () => ({
      deviceType: device.type,
      label: device.label,
      model: device.model,
      timestamp: Date.now(),
    }),

    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  drag(dragRef);

  const Icon = device.icon;

  return (
    <div
      ref={dragRef}
      className={`p-2 bg-white border-2 border-gray-200 rounded-lg cursor-move hover:border-blue-400 hover:shadow-md transition-all ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex flex-col items-center gap-1">
        {Icon ? (
          <Icon className="w-8 h-8 text-gray-700" />
        ) : (
          <DeviceIcon
            type={device.type}
            model={device.model}
          />
        )}

        <span className="text-xs text-gray-900 text-center">
          {device.label}
        </span>
      </div>
    </div>
  );
}
