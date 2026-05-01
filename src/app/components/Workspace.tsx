import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { useDrag, useDrop } from "react-dnd";
import {
  Monitor,
  Server,
  Wifi,
  Network,
  Laptop,
  Smartphone,
  Save,
  Trash2,
  ArrowLeft,
  Download,
  Router,
  ChevronDown,
  ChevronRight,
  Printer,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent } from "./ui/card";
import { toast } from "sonner";

interface Device {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  model?: string;
  config?: {
    ipAddress?: string;
    subnetMask?: string;
    gateway?: string;
  };
}

interface Port {
  id: string;
  deviceId: string;
  x: number;
  y: number;
  label: string;
}

interface Connection {
  id: string;
  from: string;
  to: string;
  fromPort: string;
  toPort: string;
  cableType: "copper-straight" | "copper-crossover" | "fiber" | "console";
}

const GRID_SIZE = 20;

const DEVICE_CATEGORIES = {
  endDevices: {
    name: "End Devices",
    color: "blue",
    items: [
      { type: "pc", label: "PC", icon: Monitor },
      { type: "laptop", label: "Laptop", icon: Laptop },
      { type: "server", label: "Server", icon: Server },
      { type: "printer", label: "Printer", icon: Printer },
      { type: "smartphone", label: "Smartphone", icon: Smartphone },
    ],
  },
  networkDevices: {
    name: "Network Devices",
    color: "orange",
    subcategories: {
      switches: {
        name: "Switches",
        models: [
          { type: "switch-2960", label: "2960 Switch", model: "2960" },
          { type: "switch-3560", label: "3560 Switch", model: "3560" },
          { type: "switch-generic", label: "Generic Switch", model: "Generic" },
        ],
      },
      routers: {
        name: "Routers",
        models: [
          { type: "router-1941", label: "1941 Router", model: "1941" },
          { type: "router-2911", label: "2911 Router", model: "2911" },
          { type: "router-generic", label: "Generic Router", model: "Generic" },
        ],
      },
      hubs: {
        name: "Hubs",
        models: [{ type: "hub-generic", label: "Generic Hub", model: "Generic" }],
      },
    },
  },
};

const CABLE_TYPES = [
  { type: "copper-straight", label: "Copper Straight-Through", color: "#000000", style: "solid" },
  { type: "copper-crossover", label: "Copper Cross-Over", color: "#ef4444", style: "dashed" },
  { type: "fiber", label: "Fiber Optic", color: "#f59e0b", style: "glow" },
  { type: "console", label: "Console Cable", color: "#3b82f6", style: "dotted" },
];

// Device icon components
function DeviceIcon({ type, model }: { type: string; model?: string }) {
  if (type.includes("pc")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-12 h-8 bg-gray-700 rounded-t border-2 border-gray-800 relative">
          <div className="absolute inset-1 bg-blue-400 rounded-sm"></div>
        </div>
        <div className="w-14 h-1.5 bg-gray-600 rounded-b"></div>
      </div>
    );
  }

  if (type.includes("laptop")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-12 h-8 bg-gray-600 rounded-t border-2 border-gray-700 relative">
          <div className="absolute inset-1 bg-gray-800 rounded-sm"></div>
        </div>
        <div className="w-14 h-1 bg-gray-500"></div>
      </div>
    );
  }

  if (type.includes("server")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center gap-0.5">
        <div className="w-12 h-2.5 bg-gray-700 border border-gray-800 rounded flex items-center px-1">
          <div className="w-1 h-1 bg-green-500 rounded-full"></div>
        </div>
        <div className="w-12 h-2.5 bg-gray-700 border border-gray-800 rounded flex items-center px-1">
          <div className="w-1 h-1 bg-green-500 rounded-full"></div>
        </div>
        <div className="w-12 h-2.5 bg-gray-700 border border-gray-800 rounded flex items-center px-1">
          <div className="w-1 h-1 bg-orange-500 rounded-full"></div>
        </div>
      </div>
    );
  }

  if (type.includes("switch")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-14 h-8 bg-gray-800 border-2 border-gray-900 rounded flex items-center justify-around px-1">
          <div className="flex flex-col gap-0.5">
            <div className="w-1 h-1 bg-green-500 rounded-full"></div>
            <div className="w-1 h-1 bg-green-500 rounded-full"></div>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="w-1 h-1 bg-green-500 rounded-full"></div>
            <div className="w-1 h-1 bg-green-500 rounded-full"></div>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="w-1 h-1 bg-green-500 rounded-full"></div>
            <div className="w-1 h-1 bg-green-500 rounded-full"></div>
          </div>
        </div>
        {model && <div className="text-[8px] text-gray-600 mt-0.5">{model}</div>}
      </div>
    );
  }

  if (type.includes("router")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-14 h-8 bg-blue-900 border-2 border-blue-950 rounded-lg relative flex items-center justify-center">
          <Wifi className="w-6 h-6 text-blue-300" />
        </div>
        {model && <div className="text-[8px] text-gray-600 mt-0.5">{model}</div>}
      </div>
    );
  }

  if (type.includes("hub")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-14 h-6 bg-gray-700 border-2 border-gray-800 rounded flex items-center justify-around px-1">
          <div className="w-1 h-1 bg-yellow-500 rounded-full"></div>
          <div className="w-1 h-1 bg-yellow-500 rounded-full"></div>
          <div className="w-1 h-1 bg-yellow-500 rounded-full"></div>
        </div>
      </div>
    );
  }

  if (type.includes("printer")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-12 h-8 bg-gray-500 border-2 border-gray-600 rounded relative">
          <div className="absolute top-1 left-2 right-2 h-1 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (type.includes("smartphone")) {
    return (
      <div className="w-16 h-16 flex flex-col items-center justify-center">
        <div className="w-6 h-10 bg-gray-800 border-2 border-gray-900 rounded-lg relative">
          <div className="absolute inset-1 bg-blue-300 rounded"></div>
        </div>
      </div>
    );
  }

  return <div className="w-16 h-16 bg-gray-400 rounded"></div>;
}

function DraggableDevice({ device, onDrag }: any) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "device-template",
    item: () => ({ deviceType: device.type, label: device.label, model: device.model, timestamp: Date.now() }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const Icon = device.icon;

  return (
    <div
      ref={drag}
      className={`p-2 bg-white border-2 border-gray-200 rounded-lg cursor-move hover:border-blue-400 hover:shadow-md transition-all ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex flex-col items-center gap-1">
        {Icon ? <Icon className="w-8 h-8 text-gray-700" /> : <DeviceIcon type={device.type} model={device.model} />}
        <span className="text-xs text-gray-900 text-center">{device.label}</span>
      </div>
    </div>
  );
}

function PlacedDevice({ device, isSelected, isConnecting, showPorts, onClick, onPortClick, onDragEnd }: any) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "placed-device",
    item: { id: device.id, initialX: device.x, initialY: device.y },
    end: (item, monitor) => {
      const delta = monitor.getDifferenceFromInitialOffset();
      if (delta && onDragEnd) {
        onDragEnd(device.id, delta);
      }
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const ports = getDevicePorts(device);

  return (
    <div
      ref={drag}
      style={{
        position: "absolute",
        left: device.x,
        top: device.y,
        zIndex: isSelected ? 20 : 10,
      }}
      className={`cursor-move ${isDragging ? "opacity-50" : ""}`}
    >
      <div
        onClick={onClick}
        className={`relative bg-white rounded-lg p-2 shadow-lg border-2 transition-all ${
          isSelected ? "border-blue-500 ring-2 ring-blue-300" : isConnecting ? "border-orange-500 ring-2 ring-orange-300" : "border-gray-300"
        }`}
      >
        <DeviceIcon type={device.type} model={device.model} />
        <div className="text-xs text-center text-gray-900 mt-1 font-medium">{device.label}</div>
      </div>

      {/* Ports overlay when ready to connect */}
      {showPorts &&
        ports.map((port) => (
          <div
            key={port.id}
            onClick={(e) => {
              e.stopPropagation();
              onPortClick(port);
            }}
            className="absolute w-3 h-3 bg-green-500 border-2 border-white rounded-full cursor-pointer hover:bg-green-600 hover:scale-125 transition-all shadow-lg"
            style={{
              left: port.x - device.x,
              top: port.y - device.y,
            }}
            title={port.label}
          />
        ))}
    </div>
  );
}

function getDevicePorts(device: Device): Port[] {
  const baseX = device.x + 40;
  const baseY = device.y + 40;

  if (device.type.includes("pc") || device.type.includes("laptop") || device.type.includes("printer") || device.type.includes("smartphone")) {
    return [{ id: `${device.id}-eth0`, deviceId: device.id, x: baseX + 20, y: baseY + 20, label: "Eth0" }];
  }

  if (device.type.includes("server")) {
    return [
      { id: `${device.id}-eth0`, deviceId: device.id, x: baseX - 10, y: baseY, label: "Eth0" },
      { id: `${device.id}-eth1`, deviceId: device.id, x: baseX + 30, y: baseY, label: "Eth1" },
    ];
  }

  if (device.type.includes("switch")) {
    return [
      { id: `${device.id}-fa0/1`, deviceId: device.id, x: baseX - 20, y: baseY - 10, label: "Fa0/1" },
      { id: `${device.id}-fa0/2`, deviceId: device.id, x: baseX, y: baseY - 10, label: "Fa0/2" },
      { id: `${device.id}-fa0/3`, deviceId: device.id, x: baseX + 20, y: baseY - 10, label: "Fa0/3" },
      { id: `${device.id}-fa0/4`, deviceId: device.id, x: baseX - 20, y: baseY + 30, label: "Fa0/4" },
      { id: `${device.id}-fa0/5`, deviceId: device.id, x: baseX, y: baseY + 30, label: "Fa0/5" },
      { id: `${device.id}-fa0/6`, deviceId: device.id, x: baseX + 20, y: baseY + 30, label: "Fa0/6" },
    ];
  }

  if (device.type.includes("router")) {
    return [
      { id: `${device.id}-ge0/0`, deviceId: device.id, x: baseX - 20, y: baseY, label: "GE0/0" },
      { id: `${device.id}-ge0/1`, deviceId: device.id, x: baseX + 20, y: baseY, label: "GE0/1" },
      { id: `${device.id}-ge0/2`, deviceId: device.id, x: baseX, y: baseY + 25, label: "GE0/2" },
    ];
  }

  if (device.type.includes("hub")) {
    return [
      { id: `${device.id}-port1`, deviceId: device.id, x: baseX - 15, y: baseY, label: "Port1" },
      { id: `${device.id}-port2`, deviceId: device.id, x: baseX, y: baseY, label: "Port2" },
      { id: `${device.id}-port3`, deviceId: device.id, x: baseX + 15, y: baseY, label: "Port3" },
    ];
  }

  return [];
}

function WireLine({ x1, y1, x2, y2, cableType, isPreview, onDoubleClick }: any) {
  const cable = CABLE_TYPES.find((c) => c.type === cableType);
  const color = cable?.color || "#000";
  const style = cable?.style || "solid";

  let strokeDasharray = "0";
  let filter = "";

  if (style === "dashed") strokeDasharray = "8,4";
  if (style === "dotted") strokeDasharray = "3,3";
  if (style === "glow") filter = "url(#glow)";

  return (
    <g onDoubleClick={onDoubleClick} className={onDoubleClick ? "cursor-pointer" : ""} style={{ pointerEvents: onDoubleClick ? "all" : "none" }}>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {onDoubleClick && <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth="12" style={{ cursor: "pointer", pointerEvents: "all" }} />}

      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={isPreview ? "2.5" : "3"}
        strokeDasharray={strokeDasharray}
        opacity={isPreview ? 0.7 : 1}
        strokeLinecap="round"
        filter={filter}
      />

      {!isPreview && (
        <>
          <circle cx={x1} cy={y1} r="5" fill={color} stroke="#fff" strokeWidth="1.5" />
          <circle cx={x2} cy={y2} r="5" fill={color} stroke="#fff" strokeWidth="1.5" />
        </>
      )}
    </g>
  );
}

export function Workspace() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{ deviceId: string; portId: string; port: Port } | null>(null);
  const [selectedCableType, setSelectedCableType] = useState<"copper-straight" | "copper-crossover" | "fiber" | "console">("copper-straight");
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({ endDevices: true, networkDevices: true });
  const [expandedSubcategories, setExpandedSubcategories] = useState<{ [key: string]: boolean }>({});

  const canvasRef = useRef<HTMLDivElement>(null);
  const deviceTypeCounts = useRef<Record<string, number>>({});
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);

  const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

  const [, drop] = useDrop(() => ({
    accept: ["device-template"],
    drop: (item: any, monitor) => {
      const offset = monitor.getClientOffset();
      if (!offset) return;

      const canvasRect = document.getElementById("canvas")?.getBoundingClientRect();
      if (!canvasRect) return;

      let x = offset.x - canvasRect.left - 40;
      let y = offset.y - canvasRect.top - 40;

      x = snapToGrid(x);
      y = snapToGrid(y);

      if (item.deviceType) {
        const uniqueId = `${item.deviceType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        setDevices((prevDevices) => {
          const nextCount = (deviceTypeCounts.current[item.deviceType] ?? 0) + 1;
          deviceTypeCounts.current[item.deviceType] = nextCount;

          const newDevice: Device = {
            id: uniqueId,
            type: item.deviceType,
            label: `${item.label}${nextCount}`,
            x,
            y,
            model: item.model,
            config: {},
          };

          toast.success(`${item.label} added to workspace`);
          return [...prevDevices, newDevice];
        });
      }
    },
  }));

  const handleDeviceClick = (deviceId: string) => {
    if (connectingFrom && connectingFrom.deviceId !== deviceId) {
      // User is connecting, show ports on target device
      setSelectedDevice(deviceId);
    } else {
      // Just selecting a device
      setSelectedDevice(deviceId);
      setConnectingFrom(null);
    }
  };

  const handlePortClick = (port: Port) => {
    if (!connectingFrom) {
      // Start connection
      setConnectingFrom({ deviceId: port.deviceId, portId: port.id, port });
      setSelectedDevice(port.deviceId);
      setMousePosition({ x: port.x, y: port.y });
      toast.info("Select target port to complete connection");
    } else {
      // Complete connection
      if (connectingFrom.deviceId === port.deviceId) {
        toast.error("Cannot connect device to itself");
        setConnectingFrom(null);
        setMousePosition(null);
        return;
      }

      const newConnection: Connection = {
        id: `conn-${Date.now()}`,
        from: connectingFrom.deviceId,
        to: port.deviceId,
        fromPort: connectingFrom.portId,
        toPort: port.id,
        cableType: selectedCableType,
      };

      setConnections((prev) => [...prev, newConnection]);
      toast.success("Connection established");
      setConnectingFrom(null);
      setSelectedDevice(null);
      setMousePosition(null);
    }
  };

  const handleDeleteConnection = (connId: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== connId));
    toast.success("Connection removed");
  };

  const handleClearAll = () => {
    setDevices([]);
    setConnections([]);
    setSelectedDevice(null);
    setConnectingFrom(null);
    deviceTypeCounts.current = {};
    setMousePosition(null);
    toast.success("Workspace cleared");
  };

  const handleDeviceDragEnd = (deviceId: string, delta: { x: number; y: number }) => {
    setDevices((prev) =>
      prev.map((d) => {
        if (d.id === deviceId) {
          return {
            ...d,
            x: snapToGrid(d.x + delta.x),
            y: snapToGrid(d.y + delta.y),
          };
        }
        return d;
      })
    );
  };

  const handleUpdateDeviceProperty = (deviceId: string, field: string, value: string) => {
    setDevices((prev) =>
      prev.map((d) => {
        if (d.id === deviceId) {
          if (field === "label") {
            return { ...d, label: value };
          } else {
            return {
              ...d,
              config: {
                ...d.config,
                [field]: value,
              },
            };
          }
        }
        return d;
      })
    );
  };

  const validateIPAddress = (ip: string) => {
    if (!ip) return true;
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(ip)) return false;
    const parts = ip.split(".");
    return parts.every((part) => parseInt(part) >= 0 && parseInt(part) <= 255);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const toggleSubcategory = (subcategory: string) => {
    setExpandedSubcategories((prev) => ({ ...prev, [subcategory]: !prev[subcategory] }));
  };

  const selectedDeviceData = devices.find((d) => d.id === selectedDevice);

  return (
    <div className="flex h-screen bg-gray-100" style={{ fontFamily: "Roboto, sans-serif" }}>
      {/* Left Panel - Device Library */}
      <div className="w-64 bg-white border-r border-gray-300 flex flex-col shadow-lg">
        <div className="p-4 border-b border-gray-300 bg-gradient-to-r from-blue-600 to-blue-700">
          <h3 className="font-bold text-white">Device Library</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* End Devices */}
          <div className="bg-blue-50 rounded-lg shadow-sm border border-blue-200">
            <button onClick={() => toggleCategory("endDevices")} className="w-full flex items-center justify-between p-3 hover:bg-blue-100 transition-colors rounded-lg">
              <span className="font-semibold text-blue-900 flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                End Devices
              </span>
              {expandedCategories.endDevices ? <ChevronDown className="w-4 h-4 text-blue-700" /> : <ChevronRight className="w-4 h-4 text-blue-700" />}
            </button>
            {expandedCategories.endDevices && (
              <div className="p-2 grid grid-cols-2 gap-2">
                {DEVICE_CATEGORIES.endDevices.items.map((device) => (
                  <DraggableDevice key={device.type} device={device} />
                ))}
              </div>
            )}
          </div>

          {/* Network Devices */}
          <div className="bg-orange-50 rounded-lg shadow-sm border border-orange-200">
            <button onClick={() => toggleCategory("networkDevices")} className="w-full flex items-center justify-between p-3 hover:bg-orange-100 transition-colors rounded-lg">
              <span className="font-semibold text-orange-900 flex items-center gap-2">
                <Network className="w-4 h-4" />
                Network Devices
              </span>
              {expandedCategories.networkDevices ? <ChevronDown className="w-4 h-4 text-orange-700" /> : <ChevronRight className="w-4 h-4 text-orange-700" />}
            </button>
            {expandedCategories.networkDevices && (
              <div className="p-2 space-y-2">
                {Object.entries(DEVICE_CATEGORIES.networkDevices.subcategories).map(([key, subcategory]) => (
                  <div key={key} className="bg-white rounded border border-orange-200">
                    <button onClick={() => toggleSubcategory(key)} className="w-full flex items-center justify-between p-2 hover:bg-orange-50 transition-colors text-sm">
                      <span className="font-medium text-gray-800">{subcategory.name}</span>
                      {expandedSubcategories[key] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                    {expandedSubcategories[key] && (
                      <div className="p-2 space-y-2">
                        {subcategory.models.map((model) => (
                          <DraggableDevice key={model.type} device={model} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="bg-white border-b border-gray-300 p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="h-6 w-px bg-gray-300"></div>
              <h2 className="font-bold text-gray-900">Network Workspace</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearAll}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div
          ref={drop}
          id="canvas"
          className="flex-1 relative bg-gray-50 overflow-hidden"
          onMouseMove={(e) => {
            if (!connectingFrom) return;
            const rect = e.currentTarget.getBoundingClientRect();
            setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          onMouseLeave={() => connectingFrom && setMousePosition(null)}
          style={{ backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)", backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px` }}
        >
          {/* SVG for connections */}
          <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 5, width: "100%", height: "100%" }}>
            {connections.map((conn) => {
              const fromDevice = devices.find((d) => d.id === conn.from);
              const toDevice = devices.find((d) => d.id === conn.to);
              if (!fromDevice || !toDevice) return null;

              const fromPorts = getDevicePorts(fromDevice);
              const toPorts = getDevicePorts(toDevice);
              const fromPort = fromPorts.find((p) => p.id === conn.fromPort);
              const toPort = toPorts.find((p) => p.id === conn.toPort);

              if (!fromPort || !toPort) return null;

              return <WireLine key={conn.id} x1={fromPort.x} y1={fromPort.y} x2={toPort.x} y2={toPort.y} cableType={conn.cableType} onDoubleClick={() => handleDeleteConnection(conn.id)} />;
            })}

            {/* Preview line when connecting */}
            {connectingFrom && mousePosition && (
              <WireLine
                x1={connectingFrom.port.x}
                y1={connectingFrom.port.y}
                x2={mousePosition.x}
                y2={mousePosition.y}
                cableType={selectedCableType}
                isPreview={true}
              />
            )}
          </svg>

          {/* Devices */}
          {devices.map((device) => (
            <PlacedDevice
              key={device.id}
              device={device}
              isSelected={selectedDevice === device.id}
              isConnecting={connectingFrom?.deviceId === device.id}
              showPorts={true}
              onClick={() => handleDeviceClick(device.id)}
              onPortClick={handlePortClick}
              onDragEnd={handleDeviceDragEnd}
            />
          ))}

          {/* Instructions overlay */}
          {devices.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-400">
                <p className="text-lg font-medium">Drag devices from the left panel to start</p>
                <p className="text-sm">Click a device, then click a port to start a connection</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Connections & Properties */}
      <div className="w-72 bg-white border-l border-gray-300 flex flex-col shadow-lg">
        {/* Connections Section */}
        <div className="p-4 border-b border-gray-300 bg-gradient-to-r from-green-600 to-green-700">
          <h3 className="font-bold text-white">Connections</h3>
        </div>

        <div className="p-3 border-b border-gray-300 bg-green-50">
          <Label className="text-xs font-semibold text-gray-700 mb-2 block">Cable Type</Label>
          <div className="space-y-2">
            {CABLE_TYPES.map((cable) => (
              <button
                key={cable.type}
                onClick={() => setSelectedCableType(cable.type as any)}
                className={`w-full flex items-center gap-2 p-2 rounded border-2 transition-all ${
                  selectedCableType === cable.type ? "border-green-500 bg-green-100" : "border-gray-200 bg-white hover:border-green-300"
                }`}
              >
                <div className="w-8 h-1 rounded" style={{ backgroundColor: cable.color }}></div>
                <span className="text-xs font-medium text-gray-800">{cable.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Device Properties */}
        {selectedDeviceData && (
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            <div className="mb-3">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Device Properties
              </h4>
              <Card className="border border-blue-200 shadow-sm bg-white">
                <CardContent className="p-4 space-y-3">
                  {/* Device Name - Editable */}
                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">Device Name</Label>
                    <Input
                      value={selectedDeviceData.label}
                      onChange={(e) => handleUpdateDeviceProperty(selectedDeviceData.id, "label", e.target.value)}
                      className="h-9 text-sm border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Enter device name"
                    />
                  </div>

                  {/* Device Type - Read Only */}
                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">Type</Label>
                    <Input value={selectedDeviceData.type} className="h-9 text-sm bg-gray-50 border-gray-200" readOnly />
                  </div>

                  {/* Model - Read Only */}
                  {selectedDeviceData.model && (
                    <div>
                      <Label className="text-xs font-semibold text-gray-700 mb-1 block">Model</Label>
                      <Input value={selectedDeviceData.model} className="h-9 text-sm bg-gray-50 border-gray-200" readOnly />
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-3"></div>

                  {/* IP Address - Editable */}
                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">IP Address</Label>
                    <Input
                      value={selectedDeviceData.config?.ipAddress || ""}
                      onChange={(e) => handleUpdateDeviceProperty(selectedDeviceData.id, "ipAddress", e.target.value)}
                      className={`h-9 text-sm ${
                        selectedDeviceData.config?.ipAddress && !validateIPAddress(selectedDeviceData.config.ipAddress)
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                          : "border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                      }`}
                      placeholder="192.168.1.1"
                    />
                    {selectedDeviceData.config?.ipAddress && !validateIPAddress(selectedDeviceData.config.ipAddress) && (
                      <p className="text-xs text-red-600 mt-1">Invalid IP address format</p>
                    )}
                  </div>

                  {/* Subnet Mask - Editable */}
                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">Subnet Mask</Label>
                    <Input
                      value={selectedDeviceData.config?.subnetMask || ""}
                      onChange={(e) => handleUpdateDeviceProperty(selectedDeviceData.id, "subnetMask", e.target.value)}
                      className={`h-9 text-sm ${
                        selectedDeviceData.config?.subnetMask && !validateIPAddress(selectedDeviceData.config.subnetMask)
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                          : "border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                      }`}
                      placeholder="255.255.255.0"
                    />
                    {selectedDeviceData.config?.subnetMask && !validateIPAddress(selectedDeviceData.config.subnetMask) && (
                      <p className="text-xs text-red-600 mt-1">Invalid subnet mask format</p>
                    )}
                  </div>

                  {/* Default Gateway - Editable */}
                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">Default Gateway</Label>
                    <Input
                      value={selectedDeviceData.config?.gateway || ""}
                      onChange={(e) => handleUpdateDeviceProperty(selectedDeviceData.id, "gateway", e.target.value)}
                      className={`h-9 text-sm ${
                        selectedDeviceData.config?.gateway && !validateIPAddress(selectedDeviceData.config.gateway)
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                          : "border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                      }`}
                      placeholder="192.168.1.254"
                    />
                    {selectedDeviceData.config?.gateway && !validateIPAddress(selectedDeviceData.config.gateway) && (
                      <p className="text-xs text-red-600 mt-1">Invalid gateway format</p>
                    )}
                  </div>

                  <div className="border-t border-gray-200 pt-3"></div>

                  {/* Position - Read Only */}
                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">Position</Label>
                    <div className="flex gap-2">
                      <Input value={`X: ${selectedDeviceData.x}`} className="h-9 text-xs bg-gray-50 border-gray-200" readOnly />
                      <Input value={`Y: ${selectedDeviceData.y}`} className="h-9 text-xs bg-gray-50 border-gray-200" readOnly />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {connectingFrom && connectingFrom.deviceId === selectedDeviceData.id && (
              <div className="mt-3 p-3 bg-orange-100 border-2 border-orange-400 rounded-lg shadow-sm">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-1.5 animate-pulse"></div>
                  <div className="flex-1">
                    <p className="text-sm text-orange-900 font-semibold">Connecting Mode</p>
                    <p className="text-xs text-orange-800 mt-1">Port: {connectingFrom.port.label}</p>
                    <p className="text-xs text-orange-700 mt-1">Click a port on another device to complete the connection</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-3 border-orange-400 text-orange-800 hover:bg-orange-200"
                  onClick={() => {
                    setConnectingFrom(null);
                    setMousePosition(null);
                  }}
                >
                  <X className="w-3 h-3 mr-1" />
                  Cancel Connection
                </Button>
              </div>
            )}
          </div>
        )}

        {!selectedDeviceData && (
          <div className="flex-1 flex items-center justify-center p-4 text-center text-gray-400">
            <p className="text-sm">Select a device to view properties</p>
          </div>
        )}
      </div>
    </div>
  );
}
