import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { useDrop } from "react-dnd";
import {
  Monitor,
  Network,
  Wifi,
  Save,
  Trash2,
  ArrowLeft,
  Download,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

import type { Device, Connection, Port } from "@/features/simulations/networkTopology/types";
import { GRID_SIZE } from "@/features/simulations/networkTopology/utils/constants";
import { getDevicePorts } from "@/features/simulations/networkTopology/utils/devicePorts";
import { DEVICE_CATEGORIES } from "@/features/simulations/networkTopology/data/deviceCategories";
import { CABLE_TYPES } from "@/features/simulations/networkTopology/data/cableTypes";
import {
  snapToGrid,
  parseOctets,
  isIpConfigured,
  haveDuplicateIpAddresses,
  areDevicesSameSubnet,
  isEndDevice,
  isCableValid,
  getConnectionValidity,
} from "@/features/simulations/networkTopology/utils/networkValidation";
import { DraggableDevice } from "@/features/simulations/networkTopology/components/DraggableDevice";
import { PlacedDevice } from "@/features/simulations/networkTopology/components/PlacedDevice";
import { WireLine } from "@/features/simulations/networkTopology/components/WireLine";

export function Workspace() {
  const navigate = useNavigate();

  const [devices, setDevices] = useState<Device[]>([]);
  const [connections, setConnections] = useState<Connection[]>(
    []
  );

  const [selectedDevice, setSelectedDevice] =
    useState<string | null>(null);

  const [connectingFrom, setConnectingFrom] =
    useState<{
      deviceId: string;
      portId: string;
      port: Port;
    } | null>(null);

  const [selectedCableType, setSelectedCableType] =
    useState<
      | "copper-straight"
      | "copper-crossover"
      | "fiber"
      | "console"
    >("copper-straight");

  const [expandedCategories, setExpandedCategories] =
    useState<{ [key: string]: boolean }>({
      endDevices: true,
      networkDevices: true,
    });

  const [expandedSubcategories, setExpandedSubcategories] =
    useState<{ [key: string]: boolean }>({});

  const [simulateOpen, setSimulateOpen] =
    useState(false);

  const [simFrom, setSimFrom] =
    useState<string | null>(null);

  const [simTo, setSimTo] =
    useState<string | null>(null);

  const [simulationLoading, setSimulationLoading] =
    useState(false);

  const [simulationResult, setSimulationResult] =
    useState<{
      status: "success" | "error";
      message: string;
    } | null>(null);

  const deviceTypeCounts =
    useRef<Record<string, number>>({});

  const [mousePosition, setMousePosition] =
    useState<{
      x: number;
      y: number;
    } | null>(null);

  /* =========================================================
     BASIC HELPERS
     ========================================================= */

  const getDeviceById = (id: string | null) =>
    devices.find((device) => device.id === id) ?? null;

  /* =========================================================
     IP HELPERS
     ========================================================= */

  const getDevicePortStatus = (
    device: Device
  ) => {
    const ports = getDevicePorts(device);

    return ports.reduce(
      (acc, port) => {
        acc[port.id] = connections.some(
          (connection) =>
            getConnectionValidity(connection, devices) &&
            (
              (
                connection.from ===
                  device.id &&
                connection.fromPort ===
                  port.id
              ) ||
              (
                connection.to ===
                  device.id &&
                connection.toPort ===
                  port.id
              )
            )
        );

        return acc;
      },
      {} as Record<string, boolean>
    );
  };

  /* =========================================================
     DEVICE CONNECTION STATUS
     =========================================================
     
     This controls the main device indicator.

     End device:
       connected -> green
       disconnected -> red

     Network device:
       connected to an END DEVICE -> green
       otherwise -> red
     ========================================================= */

  const isDeviceConnectedToEndDevice = (
    device: Device
  ) => {
    return connections.some((connection) => {
      if (
        !getConnectionValidity(connection, devices)
      ) {
        return false;
      }

      let otherDeviceId: string | null =
        null;

      if (connection.from === device.id) {
        otherDeviceId = connection.to;
      } else if (
        connection.to === device.id
      ) {
        otherDeviceId = connection.from;
      }

      if (!otherDeviceId) {
        return false;
      }

      const otherDevice =
        getDeviceById(otherDeviceId);

      if (!otherDevice) {
        return false;
      }

      return isEndDevice(otherDevice);
    });
  };

  /* =========================================================
     VALID CONNECTION PATH
     ========================================================= */

  const hasValidConnectionPath = (
    start: Device,
    end: Device
  ) => {
    const visited = new Set<string>([
      start.id,
    ]);

    const queue = [start.id];

    while (queue.length) {
      const currentId =
        queue.shift()!;

      if (currentId === end.id) {
        return true;
      }

      const currentDevice =
        getDeviceById(currentId);

      if (!currentDevice) {
        continue;
      }

      for (const connection of connections) {
        const nextId =
          connection.from === currentId
            ? connection.to
            : connection.to === currentId
            ? connection.from
            : null;

        if (
          !nextId ||
          visited.has(nextId)
        ) {
          continue;
        }

        const nextDevice =
          getDeviceById(nextId);

        if (!nextDevice) {
          continue;
        }

        if (
          !isCableValid(
            connection,
            currentDevice,
            nextDevice
          )
        ) {
          continue;
        }

        visited.add(nextId);
        queue.push(nextId);
      }
    }

    return false;
  };

  /* =========================================================
     SIMULATION
     ========================================================= */

  const resetSimulationForm = () => {
    setSimFrom(null);
    setSimTo(null);
    setSimulationResult(null);
    setSimulationLoading(false);
  };

  const runSimulation = () => {
    const fromDevice =
      getDeviceById(simFrom);

    const toDevice =
      getDeviceById(simTo);

    if (!fromDevice || !toDevice) {
      setSimulationResult({
        status: "error",
        message:
          "Selected devices could not be found.",
      });

      toast.error(
        "Selected devices could not be found."
      );

      return;
    }

    if (
      fromDevice.id === toDevice.id
    ) {
      setSimulationResult({
        status: "error",
        message:
          "Please select two different devices.",
      });

      toast.error(
        "Please select two different devices."
      );

      return;
    }

    if (
      !isIpConfigured(fromDevice) ||
      !isIpConfigured(toDevice)
    ) {
      setSimulationResult({
        status: "error",
        message:
          "Both devices require IP address and subnet mask.",
      });

      toast.error(
        "Missing IP configuration on one or both devices."
      );

      return;
    }

    if (
      haveDuplicateIpAddresses(
        fromDevice,
        toDevice
      )
    ) {
      setSimulationResult({
        status: "error",
        message:
          "Devices have duplicate IP addresses.",
      });

      toast.error(
        "Duplicate IP addresses are not allowed."
      );

      return;
    }

    if (
      !areDevicesSameSubnet(
        fromDevice,
        toDevice
      )
    ) {
      setSimulationResult({
        status: "error",
        message:
          "Devices are not in the same subnet.",
      });

      toast.error(
        "Devices are not in the same subnet."
      );

      return;
    }

    if (
      !hasValidConnectionPath(
        fromDevice,
        toDevice
      )
    ) {
      setSimulationResult({
        status: "error",
        message:
          "No valid connection path found between selected devices.",
      });

      toast.error(
        "No valid connection path found."
      );

      return;
    }

    setSimulationLoading(true);
    setSimulationResult(null);

    window.setTimeout(() => {
      setSimulationLoading(false);

      const message = `Message successfully sent from ${fromDevice.label} to ${toDevice.label}.`;

      setSimulationResult({
        status: "success",
        message,
      });

      toast.success(message);
    }, 1200);
  };

  /* =========================================================
     DRAG AND DROP
     ========================================================= */

  const dropRef =
    useRef<HTMLDivElement | null>(null);

  const [, drop] = useDrop(() => ({
    accept: ["device-template"],

    drop: (item: any, monitor) => {
      const offset =
        monitor.getClientOffset();

      if (!offset) {
        return;
      }

      const canvasRect =
        document
          .getElementById("canvas")
          ?.getBoundingClientRect();

      if (!canvasRect) {
        return;
      }

      let x =
        offset.x -
        canvasRect.left -
        40;

      let y =
        offset.y -
        canvasRect.top -
        40;

      x = snapToGrid(x);
      y = snapToGrid(y);

      if (item.deviceType) {
        const uniqueId = `${item.deviceType}-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        setDevices((prevDevices) => {
          const nextCount =
            (deviceTypeCounts.current[
              item.deviceType
            ] ?? 0) + 1;

          deviceTypeCounts.current[
            item.deviceType
          ] = nextCount;

          const newDevice: Device = {
            id: uniqueId,
            type: item.deviceType,
            label: `${item.label}${nextCount}`,
            x,
            y,
            model: item.model,
            config: {},
          };

          toast.success(
            `${item.label} added to workspace`
          );

          return [
            ...prevDevices,
            newDevice,
          ];
        });
      }
    },
  }));

  drop(dropRef);

  /* =========================================================
     DEVICE CLICK
     ========================================================= */

  const handleDeviceClick = (
    deviceId: string
  ) => {
    if (
      connectingFrom &&
      connectingFrom.deviceId !== deviceId
    ) {
      setSelectedDevice(deviceId);
    } else {
      setSelectedDevice(deviceId);
      setConnectingFrom(null);
    }
  };

  /* =========================================================
     PORT CLICK / CONNECTION
     ========================================================= */

  const handlePortClick = (
    port: Port
  ) => {
    if (!connectingFrom) {
      setConnectingFrom({
        deviceId: port.deviceId,
        portId: port.id,
        port,
      });

      setSelectedDevice(
        port.deviceId
      );

      setMousePosition({
        x: port.x,
        y: port.y,
      });

      toast.info(
        "Select target port to complete connection"
      );
    } else {
      /*
       * Prevent connecting a device to itself.
       */

      if (
        connectingFrom.deviceId ===
        port.deviceId
      ) {
        toast.error(
          "Cannot connect device to itself"
        );

        setConnectingFrom(null);
        setMousePosition(null);

        return;
      }

      /*
       * Prevent using an already occupied port.
       */

      const portAlreadyUsed =
        connections.some(
          (connection) =>
            (
              connection.fromPort ===
                port.id &&
              connection.from ===
                port.deviceId
            ) ||
            (
              connection.toPort ===
                port.id &&
              connection.to ===
                port.deviceId
            )
        );

      if (portAlreadyUsed) {
        toast.error(
          "This port is already connected."
        );

        setConnectingFrom(null);
        setMousePosition(null);

        return;
      }

      /*
       * Prevent using the source port twice.
       */

      const sourcePortAlreadyUsed =
        connections.some(
          (connection) =>
            (
              connection.from ===
                connectingFrom.deviceId &&
              connection.fromPort ===
                connectingFrom.portId
            ) ||
            (
              connection.to ===
                connectingFrom.deviceId &&
              connection.toPort ===
                connectingFrom.portId
            )
        );

      if (sourcePortAlreadyUsed) {
        toast.error(
          "The selected source port is already connected."
        );

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

      setConnections((prev) => [
        ...prev,
        newConnection,
      ]);

      toast.success(
        "Connection established"
      );

      setConnectingFrom(null);
      setSelectedDevice(null);
      setMousePosition(null);
    }
  };

  /* =========================================================
     DELETE CONNECTION
     ========================================================= */

  const handleDeleteConnection = (
    connId: string
  ) => {
    setConnections((prev) =>
      prev.filter(
        (c) => c.id !== connId
      )
    );

    toast.success(
      "Connection removed"
    );
  };

  /* =========================================================
     CLEAR WORKSPACE
     ========================================================= */

  const handleClearAll = () => {
    setDevices([]);
    setConnections([]);
    setSelectedDevice(null);
    setConnectingFrom(null);

    deviceTypeCounts.current = {};

    setMousePosition(null);

    toast.success(
      "Workspace cleared"
    );
  };

  /* =========================================================
     MOVE DEVICE
     ========================================================= */

  const handleDeviceDragEnd = (
    deviceId: string,
    delta: {
      x: number;
      y: number;
    }
  ) => {
    setDevices((prev) =>
      prev.map((d) => {
        if (d.id === deviceId) {
          return {
            ...d,

            x: snapToGrid(
              d.x + delta.x
            ),

            y: snapToGrid(
              d.y + delta.y
            ),
          };
        }

        return d;
      })
    );
  };

  /* =========================================================
     DEVICE PROPERTIES
     ========================================================= */

  const handleUpdateDeviceProperty = (
    deviceId: string,
    field: string,
    value: string
  ) => {
    setDevices((prev) =>
      prev.map((d) => {
        if (d.id === deviceId) {
          if (field === "label") {
            return {
              ...d,
              label: value,
            };
          }

          return {
            ...d,

            config: {
              ...d.config,
              [field]: value,
            },
          };
        }

        return d;
      })
    );
  };

  const validateIPAddress = (
    ip: string
  ) => {
    if (!ip) {
      return true;
    }

    return parseOctets(ip) !== null;
  };

  /* =========================================================
     CATEGORY TOGGLES
     ========================================================= */

  const toggleCategory = (
    category: string
  ) => {
    setExpandedCategories(
      (prev) => ({
        ...prev,
        [category]:
          !prev[category],
      })
    );
  };

  const toggleSubcategory = (
    subcategory: string
  ) => {
    setExpandedSubcategories(
      (prev) => ({
        ...prev,
        [subcategory]:
          !prev[subcategory],
      })
    );
  };

  const selectedDeviceData =
    devices.find(
      (d) => d.id === selectedDevice
    );

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div
      className="flex h-screen bg-gray-100"
      style={{
        fontFamily:
          "Roboto, sans-serif",
      }}
    >
      {/* =====================================================
          LEFT PANEL
          ===================================================== */}

      <div className="w-64 bg-white border-r border-gray-300 flex flex-col shadow-lg">
        <div className="p-4 border-b border-gray-300 bg-gradient-to-r from-blue-600 to-blue-700">
          <h3 className="font-bold text-white">
            Device Library
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* END DEVICES */}

          <div className="bg-blue-50 rounded-lg shadow-sm border border-blue-200">
            <button
              onClick={() =>
                toggleCategory(
                  "endDevices"
                )
              }
              className="w-full flex items-center justify-between p-3 hover:bg-blue-100 transition-colors rounded-lg"
            >
              <span className="font-semibold text-blue-900 flex items-center gap-2">
                <Monitor className="w-4 h-4" />

                End Devices
              </span>

              {expandedCategories.endDevices ? (
                <ChevronDown className="w-4 h-4 text-blue-700" />
              ) : (
                <ChevronRight className="w-4 h-4 text-blue-700" />
              )}
            </button>

            {expandedCategories.endDevices && (
              <div className="p-2 grid grid-cols-2 gap-2">
                {DEVICE_CATEGORIES.endDevices.items.map(
                  (device) => (
                    <DraggableDevice
                      key={device.type}
                      device={device}
                    />
                  )
                )}
              </div>
            )}
          </div>

          {/* NETWORK DEVICES */}

          <div className="bg-orange-50 rounded-lg shadow-sm border border-orange-200">
            <button
              onClick={() =>
                toggleCategory(
                  "networkDevices"
                )
              }
              className="w-full flex items-center justify-between p-3 hover:bg-orange-100 transition-colors rounded-lg"
            >
              <span className="font-semibold text-orange-900 flex items-center gap-2">
                <Network className="w-4 h-4" />

                Network Devices
              </span>

              {expandedCategories.networkDevices ? (
                <ChevronDown className="w-4 h-4 text-orange-700" />
              ) : (
                <ChevronRight className="w-4 h-4 text-orange-700" />
              )}
            </button>

            {expandedCategories.networkDevices && (
              <div className="p-2 space-y-2">
                {Object.entries(
                  DEVICE_CATEGORIES.networkDevices
                    .subcategories
                ).map(
                  ([
                    key,
                    subcategory,
                  ]) => (
                    <div
                      key={key}
                      className="bg-white rounded border border-orange-200"
                    >
                      <button
                        onClick={() =>
                          toggleSubcategory(
                            key
                          )
                        }
                        className="w-full flex items-center justify-between p-2 hover:bg-orange-50 transition-colors text-sm"
                      >
                        <span className="font-medium text-gray-800">
                          {
                            subcategory.name
                          }
                        </span>

                        {expandedSubcategories[
                          key
                        ] ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </button>

                      {expandedSubcategories[
                        key
                      ] && (
                        <div className="p-2 space-y-2">
                          {subcategory.models.map(
                            (model) => (
                              <DraggableDevice
                                key={
                                  model.type
                                }
                                device={
                                  model
                                }
                              />
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================
          MAIN CANVAS
          ===================================================== */}

      <div className="flex-1 flex flex-col">
        {/* TOOLBAR */}

        <div className="bg-white border-b border-gray-300 p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  navigate("/dashboard")
                }
              >
                <ArrowLeft className="w-4 h-4 mr-2" />

                Back
              </Button>

              <div className="h-6 w-px bg-gray-300" />

              <h2 className="font-bold text-gray-900">
                Network Workspace
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
              >
                <Save className="w-4 h-4 mr-2" />

                Save
              </Button>

              <Button
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />

                Export
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
              >
                <Trash2 className="w-4 h-4 mr-2" />

                Clear
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={() =>
                  setSimulateOpen(true)
                }
              >
                <Wifi className="w-4 h-4 mr-2" />

                Simulate
              </Button>
            </div>
          </div>
        </div>

        {/* ===================================================
            SIMULATION DIALOG
            =================================================== */}

        <Dialog
          open={simulateOpen}
          onOpenChange={(open) => {
            setSimulateOpen(open);

            if (!open) {
              resetSimulationForm();
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Simulate Message Transfer
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {/* FROM */}

              <div>
                <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                  From Device
                </Label>

                <Select
                  value={
                    simFrom ?? ""
                  }
                  onValueChange={(
                    value
                  ) =>
                    setSimFrom(
                      value || null
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source device" />
                  </SelectTrigger>

                  <SelectContent>
                    {devices.map(
                      (device) => (
                        <SelectItem
                          key={
                            device.id
                          }
                          value={
                            device.id
                          }
                        >
                          {
                            device.label
                          }
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* TO */}

              <div>
                <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                  To Device
                </Label>

                <Select
                  value={
                    simTo ?? ""
                  }
                  onValueChange={(
                    value
                  ) =>
                    setSimTo(
                      value || null
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination device" />
                  </SelectTrigger>

                  <SelectContent>
                    {devices
                      .filter(
                        (device) =>
                          device.id !==
                          simFrom
                      )
                      .map(
                        (device) => (
                          <SelectItem
                            key={
                              device.id
                            }
                            value={
                              device.id
                            }
                          >
                            {
                              device.label
                            }
                          </SelectItem>
                        )
                      )}
                  </SelectContent>
                </Select>
              </div>

              <div className="text-sm text-gray-500">
                Only configured devices can
                be simulated. Straight-through
                and crossover cables are
                supported for basic paths.
              </div>

              {simulationResult && (
                <div
                  className={`rounded-xl p-4 text-sm ${
                    simulationResult.status ===
                    "success"
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                      : "bg-red-50 border border-red-200 text-red-900"
                  }`}
                >
                  <p className="font-semibold">
                    {simulationResult.status ===
                    "success"
                      ? "Simulation successful"
                      : "Simulation failed"}
                  </p>

                  <p className="mt-1">
                    {
                      simulationResult.message
                    }
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="mt-6 gap-2">
              <Button
                onClick={
                  runSimulation
                }
                disabled={
                  !simFrom ||
                  !simTo ||
                  simFrom ===
                    simTo ||
                  simulationLoading
                }
                className="flex-1"
              >
                {simulationLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />

                    Simulating...
                  </span>
                ) : (
                  "Start Simulation"
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSimulateOpen(
                    false
                  )
                }
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===================================================
            CANVAS
            =================================================== */}

        <div
          ref={dropRef}
          id="canvas"
          className="flex-1 relative bg-gray-50 overflow-hidden"
          onMouseMove={(e) => {
            if (!connectingFrom) {
              return;
            }

            const rect =
              e.currentTarget.getBoundingClientRect();

            setMousePosition({
              x:
                e.clientX -
                rect.left,

              y:
                e.clientY -
                rect.top,
            });
          }}
          onMouseLeave={() =>
            connectingFrom &&
            setMousePosition(null)
          }
          style={{
            backgroundImage:
              "radial-gradient(circle, #d1d5db 1px, transparent 1px)",

            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
          }}
        >
          {/* =================================================
              SVG CONNECTIONS
              ================================================= */}

          <svg
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 5,
              width: "100%",
              height: "100%",
            }}
          >
            {connections.map(
              (conn) => {
                const fromDevice =
                  devices.find(
                    (d) =>
                      d.id ===
                      conn.from
                  );

                const toDevice =
                  devices.find(
                    (d) =>
                      d.id ===
                      conn.to
                  );

                if (
                  !fromDevice ||
                  !toDevice
                ) {
                  return null;
                }

                const fromPorts =
                  getDevicePorts(
                    fromDevice
                  );

                const toPorts =
                  getDevicePorts(
                    toDevice
                  );

                const fromPort =
                  fromPorts.find(
                    (p) =>
                      p.id ===
                      conn.fromPort
                  );

                const toPort =
                  toPorts.find(
                    (p) =>
                      p.id ===
                      conn.toPort
                  );

                if (
                  !fromPort ||
                  !toPort
                ) {
                  return null;
                }

                return (
                  <WireLine
                    key={
                      conn.id
                    }
                    x1={
                      fromPort.x
                    }
                    y1={
                      fromPort.y
                    }
                    x2={
                      toPort.x
                    }
                    y2={
                      toPort.y
                    }
                    cableType={
                      conn.cableType
                    }
                    onDoubleClick={() =>
                      handleDeleteConnection(
                        conn.id
                      )
                    }
                  />
                );
              }
            )}

            {/* PREVIEW CONNECTION */}

            {connectingFrom &&
              mousePosition && (
                <WireLine
                  x1={
                    connectingFrom
                      .port.x
                  }
                  y1={
                    connectingFrom
                      .port.y
                  }
                  x2={
                    mousePosition.x
                  }
                  y2={
                    mousePosition.y
                  }
                  cableType={
                    selectedCableType
                  }
                  isPreview={
                    true
                  }
                />
              )}
          </svg>

          {/* =================================================
              DEVICES
              ================================================= */}

          {devices.map(
            (device) => {
              const portStatus =
                getDevicePortStatus(
                  device
                );

              const isDeviceConnected =
                isDeviceConnectedToEndDevice(
                  device
                );

              return (
                <PlacedDevice
                  key={
                    device.id
                  }
                  device={
                    device
                  }
                  isSelected={
                    selectedDevice ===
                    device.id
                  }
                  isConnecting={
                    connectingFrom?.deviceId ===
                    device.id
                  }
                  isDeviceConnected={
                    isDeviceConnected
                  }
                  portStatus={
                    portStatus
                  }
                  showPorts={
                    true
                  }
                  onClick={() =>
                    handleDeviceClick(
                      device.id
                    )
                  }
                  onPortClick={
                    handlePortClick
                  }
                  onDragEnd={
                    handleDeviceDragEnd
                  }
                />
              );
            }
          )}

          {/* =================================================
              EMPTY WORKSPACE MESSAGE
              ================================================= */}

          {devices.length ===
            0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-400">
                <p className="text-lg font-medium">
                  Drag devices from
                  the left panel to
                  start
                </p>

                <p className="text-sm">
                  Click a device,
                  then click a port
                  to start a
                  connection
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================
          RIGHT PANEL
          ===================================================== */}

      <div className="w-72 bg-white border-l border-gray-300 flex flex-col shadow-lg">
        {/* CONNECTIONS */}

        <div className="p-4 border-b border-gray-300 bg-gradient-to-r from-green-600 to-green-700">
          <h3 className="font-bold text-white">
            Connections
          </h3>
        </div>

        <div className="p-3 border-b border-gray-300 bg-green-50">
          <Label className="text-xs font-semibold text-gray-700 mb-2 block">
            Cable Type
          </Label>

          <div className="space-y-2">
            {CABLE_TYPES.map(
              (cable) => (
                <button
                  key={
                    cable.type
                  }
                  onClick={() =>
                    setSelectedCableType(
                      cable.type as
                        | "copper-straight"
                        | "copper-crossover"
                        | "fiber"
                        | "console"
                    )
                  }
                  className={`w-full flex items-center gap-2 p-2 rounded border-2 transition-all ${
                    selectedCableType ===
                    cable.type
                      ? "border-green-500 bg-green-100"
                      : "border-gray-200 bg-white hover:border-green-300"
                  }`}
                >
                  <div
                    className="w-8 h-1 rounded"
                    style={{
                      backgroundColor:
                        cable.color,
                    }}
                  />

                  <span className="text-xs font-medium text-gray-800">
                    {
                      cable.label
                    }
                  </span>
                </button>
              )
            )}
          </div>
        </div>

        {/* =================================================
            DEVICE PROPERTIES
            ================================================= */}

        {selectedDeviceData && (
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            <div className="mb-3">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />

                Device Properties
              </h4>

              <Card className="border border-blue-200 shadow-sm bg-white">
                <CardContent className="p-4 space-y-3">
                  {/* DEVICE NAME */}

                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                      Device Name
                    </Label>

                    <Input
                      value={
                        selectedDeviceData.label
                      }
                      onChange={(e) =>
                        handleUpdateDeviceProperty(
                          selectedDeviceData.id,
                          "label",
                          e.target
                            .value
                        )
                      }
                      className="h-9 text-sm border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Enter device name"
                    />
                  </div>

                  {/* TYPE */}

                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                      Type
                    </Label>

                    <Input
                      value={
                        selectedDeviceData.type
                      }
                      className="h-9 text-sm bg-gray-50 border-gray-200"
                      readOnly
                    />
                  </div>

                  {/* MODEL */}

                  {selectedDeviceData.model && (
                    <div>
                      <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                        Model
                      </Label>

                      <Input
                        value={
                          selectedDeviceData.model
                        }
                        className="h-9 text-sm bg-gray-50 border-gray-200"
                        readOnly
                      />
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-3" />

                  {/* IP ADDRESS */}

                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                      IP Address
                    </Label>

                    <Input
                      value={
                        selectedDeviceData
                          .config
                          ?.ipAddress ||
                        ""
                      }
                      onChange={(e) =>
                        handleUpdateDeviceProperty(
                          selectedDeviceData.id,
                          "ipAddress",
                          e.target
                            .value
                        )
                      }
                      className={`h-9 text-sm ${
                        selectedDeviceData
                          .config
                          ?.ipAddress &&
                        !validateIPAddress(
                          selectedDeviceData
                            .config
                            .ipAddress
                        )
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                          : "border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                      }`}
                      placeholder="192.168.1.1"
                    />

                    {selectedDeviceData
                      .config
                      ?.ipAddress &&
                      !validateIPAddress(
                        selectedDeviceData
                          .config
                          .ipAddress
                      ) && (
                        <p className="text-xs text-red-600 mt-1">
                          Invalid IP address
                          format
                        </p>
                      )}
                  </div>

                  {/* SUBNET MASK */}

                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                      Subnet Mask
                    </Label>

                    <Input
                      value={
                        selectedDeviceData
                          .config
                          ?.subnetMask ||
                        ""
                      }
                      onChange={(e) =>
                        handleUpdateDeviceProperty(
                          selectedDeviceData.id,
                          "subnetMask",
                          e.target
                            .value
                        )
                      }
                      className={`h-9 text-sm ${
                        selectedDeviceData
                          .config
                          ?.subnetMask &&
                        !validateIPAddress(
                          selectedDeviceData
                            .config
                            .subnetMask
                        )
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                          : "border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                      }`}
                      placeholder="255.255.255.0"
                    />

                    {selectedDeviceData
                      .config
                      ?.subnetMask &&
                      !validateIPAddress(
                        selectedDeviceData
                          .config
                          .subnetMask
                      ) && (
                        <p className="text-xs text-red-600 mt-1">
                          Invalid subnet
                          mask format
                        </p>
                      )}
                  </div>

                  {/* DEFAULT GATEWAY */}

                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                      Default Gateway
                    </Label>

                    <Input
                      value={
                        selectedDeviceData
                          .config
                          ?.gateway ||
                        ""
                      }
                      onChange={(e) =>
                        handleUpdateDeviceProperty(
                          selectedDeviceData.id,
                          "gateway",
                          e.target
                            .value
                        )
                      }
                      className={`h-9 text-sm ${
                        selectedDeviceData
                          .config
                          ?.gateway &&
                        !validateIPAddress(
                          selectedDeviceData
                            .config
                            .gateway
                        )
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                          : "border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                      }`}
                      placeholder="192.168.1.254"
                    />

                    {selectedDeviceData
                      .config
                      ?.gateway &&
                      !validateIPAddress(
                        selectedDeviceData
                          .config
                          .gateway
                      ) && (
                        <p className="text-xs text-red-600 mt-1">
                          Invalid gateway
                          format
                        </p>
                      )}
                  </div>

                  <div className="border-t border-gray-200 pt-3" />

                  {/* POSITION */}

                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                      Position
                    </Label>

                    <div className="flex gap-2">
                      <Input
                        value={`X: ${selectedDeviceData.x}`}
                        className="h-9 text-xs bg-gray-50 border-gray-200"
                        readOnly
                      />

                      <Input
                        value={`Y: ${selectedDeviceData.y}`}
                        className="h-9 text-xs bg-gray-50 border-gray-200"
                        readOnly
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* =================================================
                CONNECTING MODE
                ================================================= */}

            {connectingFrom &&
              connectingFrom.deviceId ===
                selectedDeviceData.id && (
                <div className="mt-3 p-3 bg-orange-100 border-2 border-orange-400 rounded-lg shadow-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-1.5 animate-pulse" />

                    <div className="flex-1">
                      <p className="text-sm text-orange-900 font-semibold">
                        Connecting Mode
                      </p>

                      <p className="text-xs text-orange-800 mt-1">
                        Port:{" "}
                        {
                          connectingFrom
                            .port
                            .label
                        }
                      </p>

                      <p className="text-xs text-orange-700 mt-1">
                        Click a port on
                        another device to
                        complete the
                        connection
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-3 border-orange-400 text-orange-800 hover:bg-orange-200"
                    onClick={() => {
                      setConnectingFrom(
                        null
                      );

                      setMousePosition(
                        null
                      );
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
            <p className="text-sm">
              Select a device to view
              properties
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
