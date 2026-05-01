import { useState } from "react";
import { useNavigate } from "react-router";
import { useDrag, useDrop } from "react-dnd";
import {
  Monitor,
  Network,
  Wifi,
  Cable,
  Save,
  Play,
  RotateCcw,
  CheckCircle,
  X,
  Settings2,
  Info,
  ArrowLeft,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent } from "./ui/card";
import { toast } from "sonner";

interface Device {
  id: string;
  type: "pc" | "router" | "switch" | "hub";
  name: string;
  x: number;
  y: number;
  config: {
    ipAddress?: string;
    subnetMask?: string;
    gateway?: string;
  };
}

interface Connection {
  id: string;
  from: string;
  to: string;
  cableType: "straight" | "crossover";
}

const DEVICE_LIBRARY = [
  { type: "pc" as const, label: "PC", icon: Monitor, color: "bg-blue-500" },
  { type: "router" as const, label: "Router", icon: Wifi, color: "bg-orange-500" },
  { type: "switch" as const, label: "Switch", icon: Network, color: "bg-purple-500" },
  { type: "hub" as const, label: "Hub", icon: Network, color: "bg-gray-500" },
];

function DraggableDeviceTemplate({
  type,
  label,
  icon: Icon,
  color,
}: {
  type: string;
  label: string;
  icon: any;
  color: string;
}) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "device-template",
    item: { deviceType: type },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      className={`${color} text-white rounded-xl p-4 cursor-move transition-all hover:scale-105 ${
        isDragging ? "opacity-50" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-2">
        <Icon className="w-8 h-8" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}

function PlacedDevice({
  device,
  onSelect,
  onRemove,
  isSelected,
}: {
  device: Device;
  onSelect: () => void;
  onRemove: () => void;
  isSelected: boolean;
}) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "placed-device",
    item: { id: device.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const Icon = DEVICE_LIBRARY.find((d) => d.type === device.type)?.icon || Monitor;
  const color = DEVICE_LIBRARY.find((d) => d.type === device.type)?.color || "bg-gray-500";

  return (
    <div
      ref={drag}
      className={`absolute cursor-move transition-all ${isDragging ? "opacity-50" : "opacity-100"}`}
      style={{ left: device.x, top: device.y }}
      onClick={onSelect}
    >
      <div
        className={`${color} text-white rounded-xl p-4 min-w-[100px] shadow-lg ${
          isSelected ? "ring-4 ring-blue-400 ring-offset-2" : ""
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-start justify-between w-full">
            <Icon className="w-7 h-7" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="w-5 h-5 bg-white/20 hover:bg-white/30 rounded flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <span className="text-sm font-medium">{device.name}</span>
          {device.config.ipAddress && (
            <span className="text-xs opacity-90">{device.config.ipAddress}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ConnectionLine({ from, to }: { from: Device; to: Device }) {
  const fromCenter = { x: from.x + 50, y: from.y + 50 };
  const toCenter = { x: to.x + 50, y: to.y + 50 };

  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <line
        x1={fromCenter.x}
        y1={fromCenter.y}
        x2={toCenter.x}
        y2={toCenter.y}
        stroke="#3b82f6"
        strokeWidth="3"
      />
      <circle cx={fromCenter.x} cy={fromCenter.y} r="5" fill="#3b82f6" />
      <circle cx={toCenter.x} cy={toCenter.y} r="5" fill="#3b82f6" />
    </svg>
  );
}

export function SimulationWorkspace() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [cableType, setCableType] = useState<"straight" | "crossover">("straight");

  const [, drop] = useDrop(() => ({
    accept: ["device-template", "placed-device"],
    drop: (item: any, monitor) => {
      const offset = monitor.getClientOffset();
      if (!offset) return;

      const canvasRect = document.getElementById("canvas")?.getBoundingClientRect();
      if (!canvasRect) return;

      const x = offset.x - canvasRect.left - 50;
      const y = offset.y - canvasRect.top - 50;

      if (item.deviceType) {
        const newDevice: Device = {
          id: `device-${Date.now()}`,
          type: item.deviceType,
          name: `${item.deviceType.toUpperCase()}-${devices.length + 1}`,
          x,
          y,
          config: {},
        };
        setDevices([...devices, newDevice]);
        toast.success("Device added to workspace");
      } else if (item.id) {
        setDevices((prev) =>
          prev.map((d) => (d.id === item.id ? { ...d, x, y } : d))
        );
      }
    },
  }));

  const selectedDeviceData = devices.find((d) => d.id === selectedDevice);

  const handleConnect = (deviceId: string) => {
    if (!connectingFrom) {
      setConnectingFrom(deviceId);
      toast.info("Select another device to connect");
    } else if (connectingFrom === deviceId) {
      setConnectingFrom(null);
      toast.info("Connection cancelled");
    } else {
      const newConnection: Connection = {
        id: `conn-${Date.now()}`,
        from: connectingFrom,
        to: deviceId,
        cableType,
      };
      setConnections([...connections, newConnection]);
      setConnectingFrom(null);
      toast.success("Devices connected");
    }
  };

  const handleValidate = () => {
    if (devices.length === 0) {
      toast.error("Add devices to workspace first");
      return;
    }
    toast.success("Network topology is valid!");
  };

  const handleReset = () => {
    setDevices([]);
    setConnections([]);
    setSelectedDevice(null);
    setConnectingFrom(null);
    toast.success("Workspace reset");
  };

  const updateDeviceConfig = (field: string, value: string) => {
    if (!selectedDevice) return;
    setDevices((prev) =>
      prev.map((d) =>
        d.id === selectedDevice
          ? { ...d, config: { ...d.config, [field]: value } }
          : d
      )
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Tools Panel */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900 mb-1">Device Library</h2>
          <p className="text-xs text-gray-500">Drag devices to canvas</p>
        </div>

        <div className="p-4 space-y-3">
          {DEVICE_LIBRARY.map((device) => (
            <DraggableDeviceTemplate key={device.type} {...device} />
          ))}
        </div>

        <div className="mt-auto p-4 border-t border-gray-200 space-y-2">
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">Cable Type</Label>
            <select
              value={cableType}
              onChange={(e) => setCableType(e.target.value as "straight" | "crossover")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="straight">Straight Cable</option>
              <option value="crossover">Crossover Cable</option>
            </select>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
            <Info className="w-4 h-4 inline mb-1" /> Click device to select, then click another to connect
          </div>
        </div>
      </aside>

      {/* Center Workspace Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="h-9"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <h1 className="text-lg font-bold text-gray-900">Simulation Workspace</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleConnect.bind(null, selectedDevice || "")}
                disabled={!selectedDevice}
                variant="outline"
                size="sm"
                className="h-9"
              >
                <Cable className="w-4 h-4 mr-2" />
                Connect Devices
              </Button>
              <Button onClick={handleValidate} variant="outline" size="sm" className="h-9">
                <CheckCircle className="w-4 h-4 mr-2" />
                Validate Task
              </Button>
              <Button onClick={handleReset} variant="outline" size="sm" className="h-9">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700 h-9">
                <Play className="w-4 h-4 mr-2" />
                Start Simulation
              </Button>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div
          id="canvas"
          ref={drop}
          className="flex-1 relative bg-gradient-to-br from-gray-50 to-blue-50 overflow-hidden"
        >
          {devices.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <div className="text-center space-y-2">
                <Monitor className="w-16 h-16 mx-auto opacity-50" />
                <div className="text-lg font-medium">Canvas is empty</div>
                <div className="text-sm">Drag devices from the left panel to start building</div>
              </div>
            </div>
          ) : (
            <>
              {connections.map((conn) => {
                const fromDevice = devices.find((d) => d.id === conn.from);
                const toDevice = devices.find((d) => d.id === conn.to);
                if (fromDevice && toDevice) {
                  return <ConnectionLine key={conn.id} from={fromDevice} to={toDevice} />;
                }
                return null;
              })}
              {devices.map((device) => (
                <PlacedDevice
                  key={device.id}
                  device={device}
                  onSelect={() => setSelectedDevice(device.id)}
                  onRemove={() => {
                    setDevices(devices.filter((d) => d.id !== device.id));
                    setConnections(connections.filter((c) => c.from !== device.id && c.to !== device.id));
                    toast.success("Device removed");
                  }}
                  isSelected={selectedDevice === device.id}
                />
              ))}
            </>
          )}
        </div>

        {/* Bottom Stats Bar */}
        <div className="bg-white border-t border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              <span className="text-gray-600">
                Devices: <span className="font-semibold text-gray-900">{devices.length}</span>
              </span>
              <span className="text-gray-600">
                Connections: <span className="font-semibold text-gray-900">{connections.length}</span>
              </span>
              <span className="text-gray-600">
                Cable: <span className="font-semibold text-gray-900">{cableType}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8">
                <Save className="w-4 h-4 mr-2" />
                Save Workspace
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Properties Panel */}
      <aside className="w-80 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900 mb-1">Device Properties</h2>
          <p className="text-xs text-gray-500">Configure selected device</p>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {selectedDeviceData ? (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-gray-600">Device Name</Label>
                <Input
                  value={selectedDeviceData.name}
                  onChange={(e) =>
                    setDevices((prev) =>
                      prev.map((d) =>
                        d.id === selectedDevice ? { ...d, name: e.target.value } : d
                      )
                    )
                  }
                  className="mt-1 h-9"
                />
              </div>

              <div>
                <Label className="text-xs text-gray-600">IP Address</Label>
                <Input
                  value={selectedDeviceData.config.ipAddress || ""}
                  onChange={(e) => updateDeviceConfig("ipAddress", e.target.value)}
                  placeholder="192.168.1.1"
                  className="mt-1 h-9"
                />
              </div>

              <div>
                <Label className="text-xs text-gray-600">Subnet Mask</Label>
                <Input
                  value={selectedDeviceData.config.subnetMask || ""}
                  onChange={(e) => updateDeviceConfig("subnetMask", e.target.value)}
                  placeholder="255.255.255.0"
                  className="mt-1 h-9"
                />
              </div>

              <div>
                <Label className="text-xs text-gray-600">Gateway</Label>
                <Input
                  value={selectedDeviceData.config.gateway || ""}
                  onChange={(e) => updateDeviceConfig("gateway", e.target.value)}
                  placeholder="192.168.1.254"
                  className="mt-1 h-9"
                />
              </div>

              <div className="pt-2">
                <Label className="text-xs text-gray-600 mb-2 block">Connection Status</Label>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Device ready
                </div>
              </div>

              <Button
                onClick={() => handleConnect(selectedDevice!)}
                className="w-full bg-blue-600 hover:bg-blue-700 h-9"
              >
                <Cable className="w-4 h-4 mr-2" />
                {connectingFrom === selectedDevice ? "Cancel Connection" : "Connect to Device"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-center">
              <div>
                <Settings2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a device to view properties</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
