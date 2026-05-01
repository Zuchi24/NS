import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { useDrag, useDrop } from "react-dnd";
import {
  Monitor,
  Server,
  Wifi,
  Network,
  Laptop,
  Smartphone,
  Cable,
  Save,
  Trash2,
  ArrowLeft,
  Download,
  Play,
  X,
  Router,
  Unplug,
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
  cableType: "straight" | "crossover" | "console" | "fiber";
}

interface DragWire {
  fromDeviceId: string;
  fromPortId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

const DEVICE_CATEGORIES = [
  {
    name: "End Devices",
    devices: [
      { type: "pc", label: "PC", icon: Monitor },
      { type: "laptop", label: "Laptop", icon: Laptop },
      { type: "server", label: "Server", icon: Server },
      { type: "tablet", label: "Tablet", icon: Smartphone },
    ],
  },
  {
    name: "Network Devices",
    devices: [
      { type: "router", label: "Router", icon: Router },
      { type: "switch", label: "Switch", icon: Network },
      {
        type: "wireless-router",
        label: "Wireless Router",
        icon: Wifi,
      },
      { type: "hub", label: "Hub", icon: Network },
    ],
  },
];

const CABLE_TYPES = [
  {
    type: "straight",
    label: "Straight-Through",
    color: "#000",
  },
  { type: "crossover", label: "Crossover", color: "#ef4444" },
  { type: "console", label: "Console", color: "#3b82f6" },
  { type: "fiber", label: "Fiber Optic", color: "#f59e0b" },
];

// Device icon components
function PCIcon() {
  return (
    <div className="w-20 h-20 flex flex-col items-center justify-center">
      <div className="w-14 h-10 bg-gray-700 rounded-t border-2 border-gray-800 relative">
        <div className="absolute inset-1 bg-blue-400 rounded-sm"></div>
      </div>
      <div className="w-16 h-2 bg-gray-600 rounded-b"></div>
      <div className="text-xs mt-1 text-gray-700 font-medium">
        PC
      </div>
    </div>
  );
}

function LaptopIcon() {
  return (
    <div className="w-20 h-20 flex flex-col items-center justify-center">
      <div className="w-16 h-10 relative">
        <div className="w-12 h-8 bg-gray-700 rounded-t border-2 border-gray-800 mx-auto">
          <div className="absolute inset-1 bg-blue-400 rounded-sm"></div>
        </div>
        <div className="w-16 h-1 bg-gray-600 rounded-b mt-auto"></div>
      </div>
      <div className="text-xs mt-1 text-gray-700 font-medium">
        Laptop
      </div>
    </div>
  );
}

function ServerIcon() {
  return (
    <div className="w-20 h-20 flex flex-col items-center justify-center">
      <div className="w-12 space-y-0.5">
        <div className="w-full h-3 bg-gray-700 border border-gray-800 rounded-sm flex items-center px-1">
          <div className="w-1 h-1 bg-green-400 rounded-full"></div>
        </div>
        <div className="w-full h-3 bg-gray-700 border border-gray-800 rounded-sm flex items-center px-1">
          <div className="w-1 h-1 bg-green-400 rounded-full"></div>
        </div>
        <div className="w-full h-3 bg-gray-700 border border-gray-800 rounded-sm flex items-center px-1">
          <div className="w-1 h-1 bg-green-400 rounded-full"></div>
        </div>
      </div>
      <div className="text-xs mt-1 text-gray-700 font-medium">
        Server
      </div>
    </div>
  );
}

function RouterIcon() {
  return (
    <div className="w-20 h-20 flex flex-col items-center justify-center">
      <div className="w-14 h-8 bg-gray-700 border-2 border-gray-800 rounded relative">
        <div className="absolute -top-1 left-2 w-2 h-2 bg-blue-400 rounded-full"></div>
        <div className="absolute top-2 left-3 right-3 h-1 bg-gray-600 rounded"></div>
        <div className="absolute bottom-1 left-2 right-2 flex justify-between">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
        </div>
      </div>
      <div className="text-xs mt-1 text-gray-700 font-medium">
        Router
      </div>
    </div>
  );
}

function SwitchIcon() {
  return (
    <div className="w-20 h-20 flex flex-col items-center justify-center">
      <div className="w-14 h-6 bg-gray-700 border-2 border-gray-800 rounded relative">
        <div className="absolute bottom-0.5 left-1 right-1 flex justify-between">
          <div className="w-1 h-1 bg-green-400 rounded-full"></div>
          <div className="w-1 h-1 bg-green-400 rounded-full"></div>
          <div className="w-1 h-1 bg-green-400 rounded-full"></div>
          <div className="w-1 h-1 bg-green-400 rounded-full"></div>
          <div className="w-1 h-1 bg-orange-400 rounded-full"></div>
        </div>
      </div>
      <div className="text-xs mt-1 text-gray-700 font-medium">
        Switch
      </div>
    </div>
  );
}

function WirelessRouterIcon() {
  return (
    <div className="w-20 h-20 flex flex-col items-center justify-center">
      <div className="relative">
        <div className="w-12 h-7 bg-gray-700 border-2 border-gray-800 rounded"></div>
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-1 h-3 bg-gray-800"></div>
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Wifi className="w-4 h-4 text-blue-400" />
        </div>
      </div>
      <div className="text-xs mt-1 text-gray-700 font-medium">
        WiFi Router
      </div>
    </div>
  );
}

function TabletIcon() {
  return (
    <div className="w-20 h-20 flex flex-col items-center justify-center">
      <div className="w-10 h-14 bg-gray-700 rounded border-2 border-gray-800 relative">
        <div className="absolute inset-1 bg-blue-400 rounded-sm"></div>
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-gray-600 rounded-full"></div>
      </div>
      <div className="text-xs mt-1 text-gray-700 font-medium">
        Tablet
      </div>
    </div>
  );
}

function HubIcon() {
  return (
    <div className="w-20 h-20 flex flex-col items-center justify-center">
      <div className="w-14 h-6 bg-gray-600 border-2 border-gray-700 rounded relative">
        <div className="absolute bottom-0.5 left-1 right-1 flex justify-between">
          <div className="w-1 h-1 bg-orange-400 rounded-full"></div>
          <div className="w-1 h-1 bg-orange-400 rounded-full"></div>
          <div className="w-1 h-1 bg-orange-400 rounded-full"></div>
          <div className="w-1 h-1 bg-orange-400 rounded-full"></div>
        </div>
      </div>
      <div className="text-xs mt-1 text-gray-700 font-medium">
        Hub
      </div>
    </div>
  );
}

function getDeviceIcon(type: string) {
  switch (type) {
    case "pc":
      return <PCIcon />;
    case "switch":
      return <SwitchIcon />;
    default:
      return <PCIcon />;
  }
}

function DraggableDeviceTemplate({
  deviceType,
  label,
}: {
  deviceType: string;
  label: string;
}) {
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: "device-template",
      item: () => ({
        deviceType,
        label,
        timestamp: Date.now(),
      }),
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [deviceType, label],
  );

  return (
    <div
      ref={drag}
      className={`cursor-move hover:bg-blue-50 p-2 rounded-lg transition-all ${
        isDragging ? "opacity-50" : "opacity-100"
      }`}
    >
      {getDeviceIcon(deviceType)}
    </div>
  );
}

function CableIcon({
  type,
  label,
  color,
}: {
  type: string;
  label: string;
  color: string;
}) {
  return (
    <div className="w-full p-2 hover:bg-blue-50 rounded-lg transition-all cursor-pointer border border-gray-200">
      <div className="flex items-center gap-2">
        <Cable className="w-5 h-5" style={{ color }} />
        <div>
          <div className="text-xs font-medium text-gray-900">
            {label}
          </div>
          <div className="text-xs text-gray-500">{type}</div>
        </div>
      </div>
    </div>
  );
}

// Get ports for a device based on its type
function getDevicePorts(device: Device): Port[] {
  const baseX = device.x + 40;
  const baseY = device.y + 50;

  switch (device.type) {
    case "pc":
    case "laptop":
    case "tablet":
      return [
        {
          id: `${device.id}-eth0`,
          deviceId: device.id,
          x: baseX + 30,
          y: baseY + 20,
          label: "Eth0",
        },
      ];
    case "server":
      return [
        {
          id: `${device.id}-eth0`,
          deviceId: device.id,
          x: baseX + 20,
          y: baseY + 30,
          label: "Eth0",
        },
        {
          id: `${device.id}-eth1`,
          deviceId: device.id,
          x: baseX + 40,
          y: baseY + 30,
          label: "Eth1",
        },
      ];
    case "router":
    case "wireless-router":
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
          x: baseX + 60,
          y: baseY,
          label: "GE0/2",
        },
      ];
    case "switch":
    case "hub":
      return [
        {
          id: `${device.id}-fa0/1`,
          deviceId: device.id,
          x: baseX - 30,
          y: baseY + 15,
          label: "Fa0/1",
        },
        {
          id: `${device.id}-fa0/2`,
          deviceId: device.id,
          x: baseX - 10,
          y: baseY + 15,
          label: "Fa0/2",
        },
        {
          id: `${device.id}-fa0/3`,
          deviceId: device.id,
          x: baseX + 10,
          y: baseY + 15,
          label: "Fa0/3",
        },
        {
          id: `${device.id}-fa0/4`,
          deviceId: device.id,
          x: baseX + 30,
          y: baseY + 15,
          label: "Fa0/4",
        },
      ];
    default:
      return [];
  }
}

function PlacedDevice({
  device,
  onClick,
  onRemove,
  isSelected,
  isConnecting,
  wireMode,
  onPortMouseDown,
  hoveredPort,
}: {
  device: Device;
  onClick: () => void;
  onRemove: () => void;
  isSelected: boolean;
  isConnecting: boolean;
  wireMode: boolean;
  onPortMouseDown: (
    portId: string,
    deviceId: string,
    x: number,
    y: number,
  ) => void;
  hoveredPort: string | null;
}) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "placed-device",
    item: { id: device.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const [showPorts, setShowPorts] = useState(false);
  const ports = getDevicePorts(device);

  return (
    <div
      ref={drag}
      className={`absolute ${isDragging ? "opacity-50" : "opacity-100"}`}
      style={{ left: device.x, top: device.y }}
      onClick={onClick}
      onMouseEnter={() => wireMode && setShowPorts(true)}
      onMouseLeave={() => !wireMode && setShowPorts(false)}
    >
      <div
        className={`bg-white rounded-lg shadow-md p-2 ${
          isSelected ? "ring-2 ring-blue-500" : ""
        } ${
          isConnecting
            ? "ring-4 ring-orange-500 ring-offset-2 animate-pulse"
            : ""
        }`}
      >
        {getDeviceIcon(device.type)}
        <div className="text-xs text-center mt-1 font-medium text-gray-900">
          {device.label}
        </div>
        {device.config?.ipAddress && (
          <div className="text-xs text-center text-gray-600">
            {device.config.ipAddress}
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Port Overlay - Only visible in wire mode or on hover */}
      {(wireMode || showPorts) &&
        ports.map((port) => (
          <div
            key={port.id}
            className={`absolute w-3 h-3 rounded-full border-2 transition-all cursor-crosshair ${
              hoveredPort === port.id
                ? "bg-green-500 border-green-700 scale-150"
                : "bg-blue-400 border-blue-600 hover:scale-125"
            }`}
            style={{
              left: port.x - device.x - 6,
              top: port.y - device.y - 6,
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              if (wireMode) {
                onPortMouseDown(
                  port.id,
                  device.id,
                  port.x,
                  port.y,
                );
              }
            }}
            title={port.label}
          >
            {/* Port label */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs font-medium text-gray-700 whitespace-nowrap pointer-events-none">
              {port.label}
            </div>
          </div>
        ))}
    </div>
  );
}

function WireLine({
  x1,
  y1,
  x2,
  y2,
  cableType,
  isPreview = false,
  onDoubleClick,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cableType: string;
  isPreview?: boolean;
  onDoubleClick?: () => void;
}) {
  const getCableColor = (type: string) => {
    const cable = CABLE_TYPES.find((c) => c.type === type);
    return cable?.color || "#000";
  };

  const isDashed = cableType === "crossover";
  const color = getCableColor(cableType);

  return (
    <g
      onDoubleClick={onDoubleClick}
      className={onDoubleClick ? "cursor-pointer" : ""}
      style={{ pointerEvents: onDoubleClick ? "all" : "none" }}
    >
      {/* Invisible wider line for easier clicking */}
      {onDoubleClick && (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="transparent"
          strokeWidth="12"
          style={{ cursor: "pointer", pointerEvents: "all" }}
        />
      )}

      {/* Visible cable line */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={isPreview ? "2.5" : "3"}
        strokeDasharray={isDashed ? "8,4" : "0"}
        opacity={isPreview ? 0.7 : 1}
        strokeLinecap="round"
      />

      {/* Connection end points */}
      {!isPreview && (
        <>
          <circle
            cx={x1}
            cy={y1}
            r="5"
            fill={color}
            stroke="#fff"
            strokeWidth="1.5"
          />
          <circle
            cx={x2}
            cy={y2}
            r="5"
            fill={color}
            stroke="#fff"
            strokeWidth="1.5"
          />
        </>
      )}
    </g>
  );
}

export function Workspace() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [connections, setConnections] = useState<Connection[]>(
    [],
  );
  const [selectedDevice, setSelectedDevice] = useState<
    string | null
  >(null);
  const [connectingFrom, setConnectingFrom] = useState<
    string | null
  >(null);
  const [selectedCableType, setSelectedCableType] = useState<
    "straight" | "crossover" | "console" | "fiber"
  >("straight");
  const [wireMode, setWireMode] = useState(false);
  const [dragWire, setDragWire] = useState<DragWire | null>(
    null,
  );
  const [hoveredPort, setHoveredPort] = useState<string | null>(
    null,
  );
  const canvasRef = useRef<HTMLDivElement>(null);

  const [, drop] = useDrop(
    () => ({
      accept: ["device-template", "placed-device"],
      drop: (item: any, monitor) => {
        const offset = monitor.getClientOffset();
        if (!offset) return;

        const canvasRect = document
          .getElementById("canvas")
          ?.getBoundingClientRect();
        if (!canvasRect) return;

        const x = offset.x - canvasRect.left - 40;
        const y = offset.y - canvasRect.top - 50;

        if (item.deviceType) {
          const uniqueId = `${item.deviceType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const deviceCount =
            devices.filter((d) => d.type === item.deviceType)
              .length + 1;

          const newDevice: Device = {
            id: uniqueId,
            type: item.deviceType,
            label: `${item.label}${deviceCount}`,
            x,
            y,
            config: {},
          };

          setDevices((prevDevices) => [
            ...prevDevices,
            newDevice,
          ]);
          toast.success(`${item.label} added to workspace`);
        } else if (item.id) {
          setDevices((prev) =>
            prev.map((d) =>
              d.id === item.id ? { ...d, x, y } : d,
            ),
          );
        }
      },
    }),
    [devices],
  );

  const selectedDeviceData = devices.find(
    (d) => d.id === selectedDevice,
  );

  const handleDeviceClick = (deviceId: string) => {
    // If we're in connecting mode
    if (connectingFrom) {
      // Don't connect to itself
      if (connectingFrom === deviceId) {
        setConnectingFrom(null);
        toast.info("Connection cancelled");
        return;
      }

      // Check if connection already exists
      const existingConnection = connections.find(
        (c) =>
          (c.from === connectingFrom && c.to === deviceId) ||
          (c.from === deviceId && c.to === connectingFrom),
      );

      if (existingConnection) {
        toast.error(
          "Connection already exists between these devices",
        );
        setConnectingFrom(null);
        return;
      }

      // Create the connection
      const newConnection: Connection = {
        id: `conn-${Date.now()}`,
        from: connectingFrom,
        to: deviceId,
        cableType: selectedCableType,
      };
      setConnections([...connections, newConnection]);
      setConnectingFrom(null);

      const cableLabel =
        CABLE_TYPES.find((c) => c.type === selectedCableType)
          ?.label || selectedCableType;
      toast.success(`Connected with ${cableLabel} cable`);
    } else {
      // Start connecting mode
      setConnectingFrom(deviceId);
      setSelectedDevice(deviceId);

      const device = devices.find((d) => d.id === deviceId);
      const cableLabel =
        CABLE_TYPES.find((c) => c.type === selectedCableType)
          ?.label || selectedCableType;
      toast.info(
        `${device?.label} selected. Click another device to connect with ${cableLabel}`,
      );
    }
  };

  const handleConnect = () => {
    if (!selectedDevice) {
      toast.error("Please select a device first");
      return;
    }

    if (!connectingFrom) {
      setConnectingFrom(selectedDevice);
      const device = devices.find(
        (d) => d.id === selectedDevice,
      );
      const cableLabel =
        CABLE_TYPES.find((c) => c.type === selectedCableType)
          ?.label || selectedCableType;
      toast.info(
        `${device?.label} selected. Click another device to connect with ${cableLabel}`,
      );
    } else {
      const newConnection: Connection = {
        id: `conn-${Date.now()}`,
        from: connectingFrom,
        to: selectedDevice,
        cableType: selectedCableType,
      };
      setConnections([...connections, newConnection]);
      setConnectingFrom(null);

      const cableLabel =
        CABLE_TYPES.find((c) => c.type === selectedCableType)
          ?.label || selectedCableType;
      toast.success(
        `Devices connected with ${cableLabel} cable`,
      );
    }
  };

  const saveWorkspace = () => {
    const workspace = { devices, connections };
    localStorage.setItem(
      "netsim-workspace",
      JSON.stringify(workspace),
    );
    toast.success("Workspace saved successfully");
  };

  const loadWorkspace = () => {
    const saved = localStorage.getItem("netsim-workspace");
    if (saved) {
      const workspace = JSON.parse(saved);
      setDevices(workspace.devices || []);
      setConnections(workspace.connections || []);
      toast.success("Workspace loaded successfully");
    } else {
      toast.error("No saved workspace found");
    }
  };

  const clearWorkspace = () => {
    setDevices([]);
    setConnections([]);
    setSelectedDevice(null);
    setConnectingFrom(null);
    setWireMode(false);
    setDragWire(null);
    toast.success("Workspace cleared");
  };

  const handlePortMouseDown = (
    portId: string,
    deviceId: string,
    x: number,
    y: number,
  ) => {
    if (!wireMode) return;

    setDragWire({
      fromDeviceId: deviceId,
      fromPortId: portId,
      fromX: x,
      fromY: y,
      toX: x,
      toY: y,
    });
  };

  const handleMouseMove = (
    e: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (!dragWire || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDragWire({
      ...dragWire,
      toX: x,
      toY: y,
    });
  };

  const handleMouseUp = () => {
    if (!dragWire) return;

    // Check if we're over a valid port
    if (hoveredPort && hoveredPort !== dragWire.fromPortId) {
      // Check if connection already exists
      const existingConnection = connections.find(
        (c) =>
          (c.fromPort === dragWire.fromPortId &&
            c.toPort === hoveredPort) ||
          (c.fromPort === hoveredPort &&
            c.toPort === dragWire.fromPortId),
      );

      if (existingConnection) {
        toast.error(
          "Connection already exists between these ports",
        );
      } else {
        // Find the target device
        const targetDevice = devices.find((d) =>
          getDevicePorts(d).some((p) => p.id === hoveredPort),
        );

        if (targetDevice) {
          const targetPort = getDevicePorts(targetDevice).find(
            (p) => p.id === hoveredPort,
          );

          if (targetPort) {
            const newConnection: Connection = {
              id: `conn-${Date.now()}`,
              from: dragWire.fromDeviceId,
              to: targetDevice.id,
              fromPort: dragWire.fromPortId,
              toPort: hoveredPort,
              cableType: selectedCableType,
            };

            setConnections([...connections, newConnection]);
            const cableLabel =
              CABLE_TYPES.find(
                (c) => c.type === selectedCableType,
              )?.label || selectedCableType;
            toast.success(`Connected with ${cableLabel} cable`);
          }
        }
      }
    }

    setDragWire(null);
    setHoveredPort(null);
  };

  const removeConnection = (connectionId: string) => {
    setConnections(
      connections.filter((c) => c.id !== connectionId),
    );
    toast.info("Connection removed");
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Top Toolbar */}
      <div className="bg-white border-b border-gray-300 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <span className="text-lg font-semibold text-gray-900">
              NetSim Workspace
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={wireMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setWireMode(!wireMode);
                setDragWire(null);
                setConnectingFrom(null);
                toast.info(
                  wireMode
                    ? "Wire mode disabled"
                    : "Wire mode enabled - Drag from port to port",
                );
              }}
              className={
                wireMode
                  ? "bg-orange-600 hover:bg-orange-700"
                  : ""
              }
            >
              <Cable className="w-4 h-4 mr-2" />
              {wireMode ? "Wire Mode ON" : "Wire Mode"}
            </Button>
            <div className="w-px h-6 bg-gray-300"></div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadWorkspace}
            >
              <Download className="w-4 h-4 mr-2" />
              Load
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={saveWorkspace}
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearWorkspace}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="w-4 h-4 mr-2" />
              Simulate
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Device Panel */}
        <div className="w-64 bg-white border-r border-gray-300 overflow-y-auto">
          <div className="p-4 space-y-6">
            {DEVICE_CATEGORIES.map((category, idx) => (
              <div key={idx}>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 bg-orange-500"></div>
                  {category.name}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {category.devices.map((device) => (
                    <DraggableDeviceTemplate
                      key={device.type}
                      deviceType={device.type}
                      label={device.label}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Cables Section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <div className="w-1 h-4 bg-orange-500"></div>
                Connections
              </h3>
              <div className="space-y-2">
                {CABLE_TYPES.map((cable) => (
                  <div
                    key={cable.type}
                    onClick={() =>
                      setSelectedCableType(cable.type as any)
                    }
                    className={`${
                      selectedCableType === cable.type
                        ? "ring-2 ring-blue-500 bg-blue-50"
                        : ""
                    }`}
                  >
                    <CableIcon
                      type={cable.type}
                      label={cable.label}
                      color={cable.color}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 p-2 bg-blue-50 rounded-lg text-xs text-blue-700">
                Selected:{" "}
                <span className="font-semibold">
                  {
                    CABLE_TYPES.find(
                      (c) => c.type === selectedCableType,
                    )?.label
                  }
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Canvas */}
        <div className="flex-1 relative">
          <div
            id="canvas"
            ref={(el) => {
              drop(el);
              if (el) canvasRef.current = el;
            }}
            className="w-full h-full bg-white"
            style={{
              backgroundImage: `
                linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)
              `,
              backgroundSize: "20px 20px",
              cursor: wireMode ? "crosshair" : "default",
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {devices.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Network className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">
                    Drag devices from the left panel
                  </p>
                  <p className="text-sm">
                    Build your network topology
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Wire Overlay Layer - Full Canvas Coverage */}
                <svg
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    zIndex: 10,
                    width: "100%",
                    height: "100%",
                    position: "absolute",
                    top: 0,
                    left: 0,
                  }}
                  preserveAspectRatio="none"
                >
                  {/* Existing Connections */}
                  {connections.map((conn) => {
                    const fromDevice = devices.find(
                      (d) => d.id === conn.from,
                    );
                    const toDevice = devices.find(
                      (d) => d.id === conn.to,
                    );

                    if (!fromDevice || !toDevice) return null;

                    const fromPorts =
                      getDevicePorts(fromDevice);
                    const toPorts = getDevicePorts(toDevice);
                    const fromPort = fromPorts.find(
                      (p) => p.id === conn.fromPort,
                    );
                    const toPort = toPorts.find(
                      (p) => p.id === conn.toPort,
                    );

                    if (!fromPort || !toPort) return null;

                    return (
                      <WireLine
                        key={conn.id}
                        x1={fromPort.x}
                        y1={fromPort.y}
                        x2={toPort.x}
                        y2={toPort.y}
                        cableType={conn.cableType}
                        onDoubleClick={() =>
                          removeConnection(conn.id)
                        }
                      />
                    );
                  })}

                  {/* Preview Wire (while dragging) */}
                  {dragWire && (
                    <WireLine
                      x1={dragWire.fromX}
                      y1={dragWire.fromY}
                      x2={dragWire.toX}
                      y2={dragWire.toY}
                      cableType={selectedCableType}
                      isPreview={true}
                    />
                  )}
                </svg>

                {/* Devices Layer */}
                {devices.map((device) => {
                  const ports = getDevicePorts(device);
                  return (
                    <div key={device.id}>
                      <PlacedDevice
                        device={device}
                        onClick={() =>
                          !wireMode &&
                          handleDeviceClick(device.id)
                        }
                        onRemove={() => {
                          setDevices(
                            devices.filter(
                              (d) => d.id !== device.id,
                            ),
                          );
                          setConnections(
                            connections.filter(
                              (c) =>
                                c.from !== device.id &&
                                c.to !== device.id,
                            ),
                          );
                          if (selectedDevice === device.id)
                            setSelectedDevice(null);
                          if (connectingFrom === device.id)
                            setConnectingFrom(null);
                        }}
                        isSelected={
                          selectedDevice === device.id
                        }
                        isConnecting={
                          connectingFrom === device.id
                        }
                        wireMode={wireMode}
                        onPortMouseDown={handlePortMouseDown}
                        hoveredPort={hoveredPort}
                      />
                      {/* Port hover detection overlay */}
                      {wireMode &&
                        dragWire &&
                        ports.map((port) => (
                          <div
                            key={`hover-${port.id}`}
                            className="absolute w-8 h-8"
                            style={{
                              left: port.x - 16,
                              top: port.y - 16,
                              zIndex: 20,
                            }}
                            onMouseEnter={() =>
                              setHoveredPort(port.id)
                            }
                            onMouseLeave={() =>
                              setHoveredPort(null)
                            }
                          />
                        ))}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Right Properties Panel */}
        <div className="w-80 bg-white border-l border-gray-300 overflow-y-auto">
          <div className="p-4">
            <h3 className="font-semibold text-gray-900 mb-4">
              Device Properties
            </h3>
            {selectedDeviceData ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs">Device Name</Label>
                  <Input
                    value={selectedDeviceData.label}
                    onChange={(e) =>
                      setDevices((prev) =>
                        prev.map((d) =>
                          d.id === selectedDevice
                            ? { ...d, label: e.target.value }
                            : d,
                        ),
                      )
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <div className="mt-1 px-3 py-2 bg-gray-100 rounded text-sm">
                    {selectedDeviceData.type}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">IP Address</Label>
                  <Input
                    value={
                      selectedDeviceData.config?.ipAddress || ""
                    }
                    onChange={(e) =>
                      setDevices((prev) =>
                        prev.map((d) =>
                          d.id === selectedDevice
                            ? {
                                ...d,
                                config: {
                                  ...d.config,
                                  ipAddress: e.target.value,
                                },
                              }
                            : d,
                        ),
                      )
                    }
                    placeholder="192.168.1.1"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Subnet Mask</Label>
                  <Input
                    value={
                      selectedDeviceData.config?.subnetMask ||
                      ""
                    }
                    onChange={(e) =>
                      setDevices((prev) =>
                        prev.map((d) =>
                          d.id === selectedDevice
                            ? {
                                ...d,
                                config: {
                                  ...d.config,
                                  subnetMask: e.target.value,
                                },
                              }
                            : d,
                        ),
                      )
                    }
                    placeholder="255.255.255.0"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Gateway</Label>
                  <Input
                    value={
                      selectedDeviceData.config?.gateway || ""
                    }
                    onChange={(e) =>
                      setDevices((prev) =>
                        prev.map((d) =>
                          d.id === selectedDevice
                            ? {
                                ...d,
                                config: {
                                  ...d.config,
                                  gateway: e.target.value,
                                },
                              }
                            : d,
                        ),
                      )
                    }
                    placeholder="192.168.1.254"
                    className="mt-1"
                  />
                </div>
                <Button
                  onClick={handleConnect}
                  className="w-full"
                >
                  <Cable className="w-4 h-4 mr-2" />
                  {connectingFrom
                    ? "Complete Connection"
                    : "Connect Device"}
                </Button>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-8">
                <p className="text-sm">
                  Select a device to view properties
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="bg-gray-200 border-t border-gray-300 px-4 py-2">
        <div className="flex items-center justify-between text-xs text-gray-700">
          <span>
            Devices: {devices.length} | Connections:{" "}
            {connections.length}
          </span>
          <span className="flex items-center gap-2">
            {wireMode ? (
              <>
                {dragWire ? (
                  <>
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                    <span className="font-semibold">
                      Dragging wire - Release on a port to
                      connect
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                    <span className="font-semibold">
                      Wire Mode Active - Drag from port to port
                      | Double-click wire to remove
                    </span>
                  </>
                )}
              </>
            ) : connectingFrom ? (
              <>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                  <span className="font-semibold">
                    Connecting from{" "}
                    {
                      devices.find(
                        (d) => d.id === connectingFrom,
                      )?.label
                    }{" "}
                    - Click another device
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs"
                  onClick={() => {
                    setConnectingFrom(null);
                    toast.info("Connection cancelled");
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Ready - Click device to configure or enable Wire
                Mode to connect
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}