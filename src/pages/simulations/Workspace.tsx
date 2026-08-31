import { useCallback, useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { DndProvider, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
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
  Send,
  Cable,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/common/AsyncStates";
import { SubmissionResultsDialog } from "@/components/common/SubmissionResultsDialog";
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
import {
  DEVICE_GRAB_OFFSET,
  GRID_SIZE,
} from "@/features/simulations/networkTopology/utils/constants";
import { getDevicePorts } from "@/features/simulations/networkTopology/utils/devicePorts";
import { familyForType } from "@/features/simulations/networkTopology/utils/deviceFamily";
import { DEVICE_CATEGORIES } from "@/features/simulations/networkTopology/data/deviceCategories";
import { paletteEndDevices } from "@/features/simulations/networkTopology/utils/devicePalette";
import {
  configDraftFor,
  configKind,
  hasConfigErrors,
  isConfigurable,
  validateDeviceConfig,
} from "@/features/simulations/networkTopology/utils/deviceConfig";
import type { DeviceConfigDraft } from "@/features/simulations/networkTopology/utils/deviceConfig";
import { evaluateDelivery } from "@/features/simulations/networkTopology/utils/deliverability";
import type { PacketPath } from "@/features/simulations/networkTopology/utils/packetPath";
import { PacketOverlay } from "@/features/simulations/networkTopology/components/PacketOverlay";
import { CABLE_TYPES } from "@/features/simulations/networkTopology/data/cableTypes";
import {
  clampToCanvas,
  snapToGrid,
  isEndDevice,
  isConsoleLink,
  consoleTargets,
  getConnectionValidity,
} from "@/features/simulations/networkTopology/utils/networkValidation";
import { DraggableDevice } from "@/features/simulations/networkTopology/components/DraggableDevice";
import { PlacedDevice } from "@/features/simulations/networkTopology/components/PlacedDevice";
import { WireLine } from "@/features/simulations/networkTopology/components/WireLine";
import {
  fromTopologyDocument,
  toTopologyDocument,
} from "@/features/simulations/networkTopology/topologyDocument";
import {
  fetchAttempt,
  saveTopology,
  startAttempt,
  submitAttempt,
} from "@/features/content/contentService";
import type { ActiveAttempt } from "@/features/content/contentService";
import type { RequirementResult } from "@/features/content/types";

/**
 * The workspace route.
 *
 * Exists to own the DndProvider, which cannot live inside the canvas itself:
 * the canvas calls useDrop, and a component cannot consume a context it is the
 * one providing. Mounted here rather than app-wide so react-dnd is downloaded
 * with this route instead of by every signed-in visitor — the two bespoke
 * simulators each carry their own for the same reason.
 */
export function Workspace() {
  return (
    <DndProvider backend={HTML5Backend}>
      <WorkspaceCanvas />
    </DndProvider>
  );
}

function WorkspaceCanvas() {
  const navigate = useNavigate();

  /**
   * The canvas runs in two modes. With `?attempt=<id>` it is graded work on a
   * challenge, loaded from and saved to the server. Without it, it is a free
   * play sandbox that keeps everything in the browser, exactly as before.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const attemptId = Number(searchParams.get("attempt")) || null;

  const [active, setActive] = useState<ActiveAttempt | null>(null);
  const [attemptError, setAttemptError] = useState<string | null>(null);
  const [loadingAttempt, setLoadingAttempt] = useState(attemptId !== null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);

  /** The graded breakdown of the last submission, shown in a dialog. */
  const [results, setResults] = useState<RequirementResult[] | null>(null);
  const [resultsPassed, setResultsPassed] = useState(false);

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

  /** The route a message is travelling right now, or null when nothing is. */
  const [packetPath, setPacketPath] =
    useState<PacketPath | null>(null);

  /** The device whose settings are open, and the values being edited. */
  const [configuring, setConfiguring] =
    useState<string | null>(null);

  const [configDraft, setConfigDraft] =
    useState<DeviceConfigDraft>({
      ipAddress: "",
      subnetMask: "",
      gateway: "",
    });

  const [configErrors, setConfigErrors] =
    useState<ReturnType<typeof validateDeviceConfig>>({});

  /* =========================================================
     LOAD THE ATTEMPT (GRADED MODE ONLY)
     ========================================================= */

  useEffect(() => {
    if (attemptId === null) return;

    let live = true;
    setLoadingAttempt(true);
    setAttemptError(null);

    fetchAttempt(attemptId)
      .then((loaded) => {
        if (!live) return;

        const saved = fromTopologyDocument(loaded.topology);

        setActive(loaded);
        setDevices(saved.devices);
        setConnections(saved.connections);

        // Seed the per-type counters so a device dropped now is not given the
        // same label as one already on the canvas.
        deviceTypeCounts.current = saved.devices.reduce<Record<string, number>>(
          (counts, device) => {
            counts[device.type] = (counts[device.type] ?? 0) + 1;
            return counts;
          },
          {},
        );
      })
      .catch((error: unknown) => {
        if (!live) return;
        setAttemptError(
          error instanceof Error
            ? error.message
            : "Could not open this attempt.",
        );
      })
      .finally(() => {
        if (live) setLoadingAttempt(false);
      });

    return () => {
      live = false;
    };
  }, [attemptId]);

  /**
   * The end devices on offer.
   *
   * A short default list, plus whatever the open challenge's rules actually
   * ask for — a printer exercise has to offer a printer. In free play there is
   * no challenge, so only the default list is offered.
   */
  const offeredEndDevices = paletteEndDevices(
    active?.challenge.requiredFamilies ?? [],
  );

  const currentTopology = () => toTopologyDocument(devices, connections);

  /**
   * Downloads the canvas as the same JSON document the grader reads.
   *
   * Nothing is sent anywhere and nothing is graded — it is the work already on
   * screen, written to a file, which is all "Export" ever claimed to be.
   */
  const handleExport = () => {
    if (devices.length === 0) {
      toast.error("There is nothing on the canvas to export");
      return;
    }

    const name = active
      ? `netsim-attempt-${active.attempt.id}.json`
      : "netsim-topology.json";

    const url = URL.createObjectURL(
      new Blob([JSON.stringify(currentTopology(), null, 2)], {
        type: "application/json",
      }),
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();

    // Revoking immediately would race the download on some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    toast.success(`Exported ${name}`);
  };

  const handleSaveProgress = async () => {
    if (attemptId === null) return;

    setSaving(true);

    try {
      await saveTopology(attemptId, currentTopology());
      toast.success("Progress saved");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save your progress",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitAttempt = async () => {
    if (attemptId === null) return;

    setSubmitting(true);

    try {
      const marked = await submitAttempt(attemptId, currentTopology());

      // The attempt is closed now, so the local copy has to agree — otherwise
      // Submit stays on screen and a second press is refused by the server.
      setActive((previous) =>
        previous ? { ...previous, attempt: marked } : previous,
      );

      setResultsPassed(marked.passed);
      setResults(marked.results ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not submit your work",
      );
    } finally {
      // Either way the canvas keeps the student's work; nothing is thrown away.
      setSubmitting(false);
    }
  };

  /**
   * Open a fresh attempt at the same challenge without losing the canvas.
   *
   * A submitted attempt cannot be submitted again, so a retry needs a new one.
   * The current topology is saved into it before the workspace reloads, so the
   * student picks up exactly where they left off rather than from scratch.
   */
  const handleTryAgain = async () => {
    if (!active) return;

    setRetrying(true);

    try {
      const next = await startAttempt(active.challenge.id);
      await saveTopology(next.id, currentTopology());

      setResults(null);
      setSearchParams({ attempt: String(next.id) });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not start a new attempt",
      );
    } finally {
      setRetrying(false);
    }
  };

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

  /**
   * Ports with a console lead in them, per device.
   *
   * Kept apart from the connected/free status above, which is about carrying
   * traffic: a console port is in use for management and is neither.
   */
  const getConsolePorts = (
    device: Device
  ) => {
    const used = new Set<string>();

    for (const connection of connections) {
      const source = getDeviceById(connection.from);
      const target = getDeviceById(connection.to);

      if (!source || !target) {
        continue;
      }

      if (!isConsoleLink(connection, source, target)) {
        continue;
      }

      if (connection.from === device.id) {
        used.add(connection.fromPort);
      }

      if (connection.to === device.id) {
        used.add(connection.toPort);
      }
    }

    return used;
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
     SIMULATION
     ========================================================= */

  const resetSimulationForm = () => {
    setSimFrom(null);
    setSimTo(null);
    setSimulationResult(null);
    setSimulationLoading(false);
  };

  const runSimulation = () => {
    if (!simFrom || !simTo) {
      return;
    }

    // One question, asked of the topology and the addressing as they stand:
    // is there a route, and are these two able to use it. The answer carries
    // its own explanation, so every failure the simulator knows about reaches
    // the student in the same way.
    const outcome = evaluateDelivery(
      devices,
      connections,
      simFrom,
      simTo
    );

    if (!outcome.ok) {
      setSimulationResult({
        status: "error",
        message: outcome.message,
      });

      toast.error(outcome.message);

      return;
    }

    setSimulationLoading(true);
    setSimulationResult(null);

    // Out of the way, so the message can be watched crossing the canvas.
    setSimulateOpen(false);
    setPacketPath(outcome.path);
  };

  /**
   * The message has arrived. Named for the hops it actually took, so a student
   * can see the switch in the middle was part of the journey.
   */
  const handlePacketArrived = () => {
    setPacketPath(null);
    setSimulationLoading(false);

    const route = packetRouteLabels();

    if (route.length === 0) {
      return;
    }

    const message = `Message delivered: ${route.join(" -> ")}`;

    setSimulationResult({
      status: "success",
      message,
    });

    toast.success(message);
  };

  const packetRouteLabels = () =>
    (packetPath?.deviceIds ?? []).map(
      (id) =>
        getDeviceById(id)?.label ?? id
    );

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

      const canvasRect =
        dropRef.current?.getBoundingClientRect();

      if (!offset || !canvasRect || !item.deviceType) {
        return;
      }

      // The cursor is the middle of the tile being dragged, so the device box
      // is offset back by half its width to land under the pointer. Clamped to
      // the canvas: it is overflow-hidden, and a device dropped at the very
      // edge used to be placed outside it and never seen again.
      const x = clampToCanvas(
        snapToGrid(offset.x - canvasRect.left - DEVICE_GRAB_OFFSET),
        canvasRect.width,
      );

      const y = clampToCanvas(
        snapToGrid(offset.y - canvasRect.top - DEVICE_GRAB_OFFSET),
        canvasRect.height,
      );

      // Counting and announcing are side effects, so they happen here rather
      // than inside the updater: React may call an updater more than once, and
      // a label numbered from a double-counted ref is wrong.
      const nextCount =
        (deviceTypeCounts.current[item.deviceType] ?? 0) + 1;

      deviceTypeCounts.current[item.deviceType] = nextCount;

      const newDevice: Device = {
        id: `${item.deviceType}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 11)}`,
        type: item.deviceType,
        family: familyForType(item.deviceType),
        label: `${item.label}${nextCount}`,
        x,
        y,
        model: item.model,
        config: {},
      };

      setDevices((prevDevices) => [
        ...prevDevices,
        newDevice,
      ]);

      toast.success(
        `${item.label} added to workspace`
      );
    },
  }));

  /**
   * Hands react-dnd the canvas node itself, and keeps a ref to it for the drop
   * maths.
   *
   * It has to be a callback ref rather than `drop(someRef)` called while
   * rendering. react-dnd reads a ref's `.current` at the moment it is handed
   * over, and during render the node it will point at has not been created yet;
   * the connector then only picks it up on some *later* render. In graded mode
   * the canvas is behind a loading gate, so the render that first mounts it is
   * the one whose node is missed — leaving the canvas accepting nothing until
   * an unrelated re-render happened to reconnect it. Expanding the collapsed
   * "Switches" list was one such re-render, which is why a switch appeared to
   * have to go down before anything else could.
   */
  const attachCanvas = useCallback(
    (node: HTMLDivElement | null) => {
      dropRef.current = node;
      drop(node);
    },
    [drop],
  );

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
    const canvasRect =
      dropRef.current?.getBoundingClientRect();

    setDevices((prev) =>
      prev.map((d) => {
        if (d.id !== deviceId) {
          return d;
        }

        const x = snapToGrid(d.x + delta.x);
        const y = snapToGrid(d.y + delta.y);

        // Dragged off the edge, a device would be clipped out of sight and
        // out of reach, so it stops at the boundary instead.
        return canvasRect
          ? {
              ...d,
              x: clampToCanvas(x, canvasRect.width),
              y: clampToCanvas(y, canvasRect.height),
            }
          : { ...d, x, y };
      })
    );
  };

  /* =========================================================
     DEVICE PROPERTIES
     ========================================================= */

  /* =========================================================
     CONFIGURE AN END DEVICE

     The properties panel shows what a device is set to; this is
     where it gets set. Values are written straight onto the same
     device.config the canvas has always carried, so they save,
     reload and grade through the paths that already exist.
     ========================================================= */

  /**
   * Switches the device being configured can administer over a console lead.
   *
   * This is the point of a console cable: you sit at the PC and configure the
   * switch through it. It carries no network traffic, so it never appears in a
   * packet route — only here.
   */
  const consoleSwitches = configuring
    ? consoleTargets(
        getDeviceById(configuring) ?? {
          id: configuring,
          type: "",
          family: "",
          label: "",
          x: 0,
          y: 0,
        },
        devices,
        connections
      )
    : [];

  const openConfigure = (
    device: Device
  ) => {
    setConfiguring(device.id);
    setConfigDraft(configDraftFor(device));
    setConfigErrors({});
  };

  const closeConfigure = () => {
    setConfiguring(null);
    setConfigErrors({});
  };

  const updateConfigDraft = (
    field: keyof DeviceConfigDraft,
    value: string
  ) => {
    setConfigDraft((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear the complaint about a field as soon as it is being retyped;
    // everything is checked again on save.
    setConfigErrors((prev) => {
      if (!(field in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[field];

      return next;
    });
  };

  const saveConfigure = () => {
    if (!configuring) {
      return;
    }

    const device = getDeviceById(configuring);

    // A switch's management address may be left empty: an unmanaged switch is
    // a working switch, not a half-filled form.
    const errors = validateDeviceConfig(configDraft, {
      optional:
        configKind(device) === "management",
    });

    if (hasConfigErrors(errors)) {
      setConfigErrors(errors);

      return;
    }

    setDevices((prev) =>
      prev.map((d) =>
        d.id === configuring
          ? {
              ...d,
              config: {
                ...d.config,
                ipAddress: configDraft.ipAddress.trim(),
                subnetMask: configDraft.subnetMask.trim(),
                // A blank gateway is a device that never leaves its LAN, which
                // is a real answer rather than a missing one.
                gateway: configDraft.gateway.trim(),
              },
            }
          : d
      )
    );

    // Configuring a device is also a way of picking it, so the panel behind
    // the dialog is showing what was just saved.
    setSelectedDevice(configuring);
    closeConfigure();

    toast.success(
      `${device?.label ?? "Device"} configured`
    );
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

     The two gates below sit after every hook, so the hook order stays the
     same on each render whichever mode the canvas is in.
     ========================================================= */

  if (loadingAttempt) {
    return <LoadingState label="Opening your challenge…" />;
  }

  if (attemptError) {
    return (
      <ErrorState
        message={attemptError}
        onRetry={() => navigate("/challenges")}
        retryLabel="Back to challenges"
      />
    );
  }

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
                {offeredEndDevices.map(
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
                  navigate(active ? "/challenges" : "/dashboard")
                }
              >
                <ArrowLeft className="w-4 h-4 mr-2" />

                Back
              </Button>

              <div className="h-6 w-px bg-gray-300" />

              <div>
                <h2 className="font-bold text-gray-900">
                  {active ? active.challenge.title : "Network Workspace"}
                </h2>
                {active && (
                  <p className="text-xs text-gray-500">
                    Attempt #{active.attempt.id}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Saving needs somewhere to save to, which only a graded
                  attempt has. Free play stays in the browser for now. */}
              {active && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveProgress}
                  disabled={saving || submitting}
                >
                  <Save className="w-4 h-4 mr-2" />

                  {saving ? "Saving…" : "Save"}
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={devices.length === 0}
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
                variant={active ? "outline" : "default"}
                size="sm"
                onClick={() =>
                  setSimulateOpen(true)
                }
              >
                <Wifi className="w-4 h-4 mr-2" />

                Simulate
              </Button>

              {active && active.attempt.status === "in_progress" && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSubmitAttempt}
                  disabled={submitting || saving}
                >
                  <Send className="w-4 h-4 mr-2" />

                  {submitting ? "Submitting…" : "Submit"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ===================================================
            SUBMISSION RESULTS
            =================================================== */}

        <SubmissionResultsDialog
          results={results}
          passed={resultsPassed}
          onClose={() => setResults(null)}
          onTryAgain={handleTryAgain}
          retrying={retrying}
          onBack={() => navigate("/challenges")}
        />

        {/* ===================================================
            CONFIGURE DEVICE

            The one place an end device's addressing is entered.
            Saving writes onto device.config, which is the same
            field the panel reports and the same field the saved
            topology carries — there is no second store.
            =================================================== */}

        <Dialog
          open={configuring !== null}
          onOpenChange={(open) => {
            if (!open) {
              closeConfigure();
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {configKind(
                  getDeviceById(configuring)
                ) === "management"
                  ? `${
                      getDeviceById(configuring)
                        ?.label ?? "Switch"
                    } management`
                  : `Configure ${
                      getDeviceById(configuring)
                        ?.label ?? "Device"
                    }`}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {/* A switch is administered over an address of its own. It never
                  needs one to forward traffic, so the form says so rather than
                  leaving a student wondering what they have failed to fill in. */}

              {configKind(
                getDeviceById(configuring)
              ) === "management" && (
                <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-2">
                  Optional. A management address lets you reach
                  the switch itself; it forwards traffic between
                  its ports either way. Leave blank for an
                  unmanaged switch.
                </p>
              )}

              {/* A console lead is how you reach a switch that has no
                  management address at all. */}

              {consoleSwitches.length > 0 && (
                <div className="rounded border border-blue-200 bg-blue-50 p-2 space-y-2">
                  <p className="text-xs text-blue-900 font-medium flex items-center gap-1">
                    <Cable className="w-3 h-3" />

                    Console access
                  </p>

                  {consoleSwitches.map(
                    (target) => (
                      <Button
                        key={target.id}
                        size="sm"
                        variant="outline"
                        className="w-full h-7 text-xs border-blue-300 text-blue-800 hover:bg-blue-100"
                        onClick={() =>
                          openConfigure(
                            target
                          )
                        }
                      >
                        Configure {target.label}{" "}
                        over the console
                      </Button>
                    )
                  )}
                </div>
              )}
              {(
                [
                  {
                    field: "ipAddress" as const,
                    label: "IP Address",
                    placeholder: "192.168.1.10",
                  },
                  {
                    field: "subnetMask" as const,
                    label: "Subnet Mask",
                    placeholder: "255.255.255.0",
                  },
                  {
                    field: "gateway" as const,
                    label: "Default Gateway",
                    placeholder: "192.168.1.1",
                  },
                ]
              ).map(({ field, label, placeholder }) => (
                <div key={field}>
                  <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                    {label}
                    {field === "gateway" && (
                      <span className="font-normal text-gray-500">
                        {" "}
                        (optional)
                      </span>
                    )}
                  </Label>

                  <Input
                    value={
                      configDraft[field]
                    }
                    onChange={(e) =>
                      updateConfigDraft(
                        field,
                        e.target.value
                      )
                    }
                    className={`h-9 text-sm ${
                      configErrors[field]
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                        : "border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                    }`}
                    placeholder={
                      placeholder
                    }
                  />

                  {configErrors[field] && (
                    <p className="text-xs text-red-600 mt-1">
                      {
                        configErrors[
                          field
                        ]
                      }
                    </p>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter className="mt-4">
              <Button
                size="sm"
                onClick={saveConfigure}
              >
                Save configuration
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={closeConfigure}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
          ref={attachCanvas}
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

            {/* THE MESSAGE IN FLIGHT, on the cables it is crossing */}

            <PacketOverlay
              path={packetPath}
              devices={devices}
              connections={connections}
              onArrived={
                handlePacketArrived
              }
            />
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
                  consolePorts={getConsolePorts(
                    device
                  )}
                  showPorts={
                    true
                  }
                  canConfigure={isConfigurable(
                    device
                  )}
                  onConfigure={
                    openConfigure
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
                      className="h-9 text-sm bg-gray-50 border-gray-200"
                      readOnly
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

                  {/* NETWORK SETTINGS

                      Reported here, set through Configure. Typing into the
                      panel used to write straight to the device, which let a
                      half-finished address reach the topology; now a value
                      only lands once it has been checked. */}

                  <Label className="text-xs font-semibold text-gray-700">
                    Network Settings
                  </Label>

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
                      className="h-9 text-sm bg-gray-50 border-gray-200"
                      placeholder="Not set"
                      readOnly
                    />
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
                      className="h-9 text-sm bg-gray-50 border-gray-200"
                      placeholder="Not set"
                      readOnly
                    />
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
                      className="h-9 text-sm bg-gray-50 border-gray-200"
                      placeholder="Not set"
                      readOnly
                    />
                  </div>

                  {configKind(
                    selectedDeviceData
                  ) === "management" &&
                    !selectedDeviceData.config
                      ?.ipAddress && (
                      <p className="text-xs text-gray-500">
                        No management IP configured. The switch
                        still forwards traffic between its ports
                        without one.
                      </p>
                    )}

                  {configKind(
                    selectedDeviceData
                  ) === null && (
                    <p className="text-xs text-gray-500">
                      A {selectedDeviceData.family} forwards
                      traffic without an address of its own,
                      so there is nothing to set here.
                    </p>
                  )}

                  {isConfigurable(
                    selectedDeviceData
                  ) && (
                    <p className="text-xs text-gray-500">
                      Use the settings icon on the device to
                      change these.
                    </p>
                  )}

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
