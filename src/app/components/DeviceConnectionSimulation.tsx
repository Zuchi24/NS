import { useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { Network, Monitor, Router, Server, CheckCircle, XCircle, Lightbulb, RotateCcw, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { toast } from "sonner";

interface Device {
  id: string;
  type: "computer" | "router" | "switch" | "server";
  name: string;
}

interface Connection {
  from: string;
  to: string;
}

interface Exercise {
  id: number;
  title: string;
  description: string;
  devices: Device[];
  correctConnections: Connection[];
  hint: string;
  explanation: string;
}

const exercises: Exercise[] = [
  {
    id: 1,
    title: "Basic Home Network",
    description: "Connect a computer to the internet through a router",
    devices: [
      { id: "computer1", type: "computer", name: "PC" },
      { id: "router1", type: "router", name: "Router" },
      { id: "modem1", type: "server", name: "Modem" },
    ],
    correctConnections: [
      { from: "computer1", to: "router1" },
      { from: "router1", to: "modem1" },
    ],
    hint: "The router acts as the central device connecting your computer to the modem (internet).",
    explanation: "In a basic home network, the computer connects to the router, which then connects to the modem for internet access.",
  },
  {
    id: 2,
    title: "Small Office Network",
    description: "Connect multiple computers through a switch to a router",
    devices: [
      { id: "computer1", type: "computer", name: "PC 1" },
      { id: "computer2", type: "computer", name: "PC 2" },
      { id: "switch1", type: "switch", name: "Switch" },
      { id: "router1", type: "router", name: "Router" },
    ],
    correctConnections: [
      { from: "computer1", to: "switch1" },
      { from: "computer2", to: "switch1" },
      { from: "switch1", to: "router1" },
    ],
    hint: "A switch allows multiple computers to connect to each other and share a single router connection.",
    explanation: "Both computers connect to the switch, which aggregates their connections and links to the router for network services.",
  },
  {
    id: 3,
    title: "Client-Server Network",
    description: "Set up a network with a server accessible to multiple clients",
    devices: [
      { id: "computer1", type: "computer", name: "Client 1" },
      { id: "computer2", type: "computer", name: "Client 2" },
      { id: "switch1", type: "switch", name: "Switch" },
      { id: "server1", type: "server", name: "File Server" },
    ],
    correctConnections: [
      { from: "computer1", to: "switch1" },
      { from: "computer2", to: "switch1" },
      { from: "server1", to: "switch1" },
    ],
    hint: "All devices connect to a central switch to communicate with each other and access the server.",
    explanation: "In a client-server network, all devices connect to a central switch, allowing clients to access the server resources.",
  },
  {
    id: 4,
    title: "Redundant Network Path",
    description: "Create a network with multiple routers for redundancy",
    devices: [
      { id: "computer1", type: "computer", name: "PC" },
      { id: "switch1", type: "switch", name: "Switch" },
      { id: "router1", type: "router", name: "Router 1" },
      { id: "router2", type: "router", name: "Router 2" },
    ],
    correctConnections: [
      { from: "computer1", to: "switch1" },
      { from: "switch1", to: "router1" },
      { from: "switch1", to: "router2" },
    ],
    hint: "Connect the switch to both routers to provide backup connectivity if one router fails.",
    explanation: "Redundant connections ensure network availability - if Router 1 fails, Router 2 can handle the traffic.",
  },
];

const ItemTypes = {
  DEVICE: "device",
};

interface DraggableDeviceProps {
  device: Device;
  isPlaced: boolean;
  onDragStart: () => void;
}

function DraggableDevice({ device, isPlaced, onDragStart }: DraggableDeviceProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.DEVICE,
    item: { id: device.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: !isPlaced,
  }));

  const getIcon = () => {
    switch (device.type) {
      case "computer":
        return <Monitor className="w-8 h-8" />;
      case "router":
        return <Router className="w-8 h-8" />;
      case "switch":
        return <Network className="w-8 h-8" />;
      case "server":
        return <Server className="w-8 h-8" />;
    }
  };

  const getColor = () => {
    switch (device.type) {
      case "computer":
        return "from-blue-500 to-blue-600";
      case "router":
        return "from-purple-500 to-purple-600";
      case "switch":
        return "from-green-500 to-green-600";
      case "server":
        return "from-orange-500 to-orange-600";
    }
  };

  return (
    <div
      ref={drag}
      className={`cursor-move ${isDragging ? "opacity-50" : ""} ${isPlaced ? "opacity-40 cursor-not-allowed" : ""}`}
      onMouseDown={onDragStart}
    >
      <div className={`bg-gradient-to-br ${getColor()} text-white rounded-lg p-4 shadow-lg hover:shadow-xl transition-all`}>
        <div className="flex flex-col items-center gap-2">
          {getIcon()}
          <span className="text-sm font-semibold text-center">{device.name}</span>
        </div>
      </div>
    </div>
  );
}

interface DropZoneProps {
  position: number;
  device: Device | null;
  onDrop: (deviceId: string, position: number) => void;
  onConnect: (fromPos: number, toPos: number) => void;
  selectedForConnection: number | null;
  connections: { from: number; to: number }[];
}

function DropZone({ position, device, onDrop, onConnect, selectedForConnection, connections }: DropZoneProps) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes.DEVICE,
    drop: (item: { id: string }) => onDrop(item.id, position),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const getIcon = () => {
    if (!device) return null;
    switch (device.type) {
      case "computer":
        return <Monitor className="w-12 h-12" />;
      case "router":
        return <Router className="w-12 h-12" />;
      case "switch":
        return <Network className="w-12 h-12" />;
      case "server":
        return <Server className="w-12 h-12" />;
    }
  };

  const getColor = () => {
    if (!device) return "from-gray-200 to-gray-300";
    switch (device.type) {
      case "computer":
        return "from-blue-500 to-blue-600";
      case "router":
        return "from-purple-500 to-purple-600";
      case "switch":
        return "from-green-500 to-green-600";
      case "server":
        return "from-orange-500 to-orange-600";
    }
  };

  const isConnected = connections.some(c => c.from === position || c.to === position);

  return (
    <div
      ref={drop}
      onClick={() => device && onConnect(selectedForConnection ?? -1, position)}
      className={`relative w-32 h-32 rounded-xl border-4 transition-all cursor-pointer ${
        isOver
          ? "border-blue-500 bg-blue-50"
          : selectedForConnection === position
          ? "border-yellow-500 bg-yellow-50"
          : isConnected
          ? "border-green-500"
          : "border-gray-300"
      } ${!device ? "border-dashed" : ""}`}
    >
      {device ? (
        <div className={`w-full h-full bg-gradient-to-br ${getColor()} rounded-lg flex flex-col items-center justify-center text-white shadow-lg`}>
          {getIcon()}
          <span className="text-xs font-semibold mt-2 text-center px-1">{device.name}</span>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs text-center p-2">
          Drop device here
        </div>
      )}
    </div>
  );
}

export function DeviceConnectionSimulation() {
  const [currentExercise, setCurrentExercise] = useState(0);
  const [placedDevices, setPlacedDevices] = useState<(Device | null)[]>([null, null, null, null]);
  const [connections, setConnections] = useState<{ from: number; to: number }[]>([]);
  const [selectedForConnection, setSelectedForConnection] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState(0);

  const exercise = exercises[currentExercise];
  const progress = ((currentExercise + 1) / exercises.length) * 100;

  const handleDrop = (deviceId: string, position: number) => {
    const device = exercise.devices.find(d => d.id === deviceId);
    if (device && !placedDevices[position]) {
      const newPlaced = [...placedDevices];
      newPlaced[position] = device;
      setPlacedDevices(newPlaced);
    }
  };

  const handleConnect = (fromPos: number, toPos: number) => {
    if (fromPos === -1) {
      setSelectedForConnection(toPos);
      return;
    }

    if (fromPos === toPos) {
      setSelectedForConnection(null);
      return;
    }

    const connectionExists = connections.some(
      c => (c.from === fromPos && c.to === toPos) || (c.from === toPos && c.to === fromPos)
    );

    if (connectionExists) {
      setConnections(connections.filter(
        c => !((c.from === fromPos && c.to === toPos) || (c.from === toPos && c.to === fromPos))
      ));
    } else {
      setConnections([...connections, { from: fromPos, to: toPos }]);
    }

    setSelectedForConnection(null);
  };

  const checkSolution = () => {
    const deviceMap = new Map<string, number>();
    placedDevices.forEach((device, index) => {
      if (device) deviceMap.set(device.id, index);
    });

    const userConnections = connections.map(c => ({
      from: placedDevices[c.from]?.id || "",
      to: placedDevices[c.to]?.id || "",
    }));

    const isCorrect = exercise.correctConnections.every(correct => 
      userConnections.some(user => 
        (user.from === correct.from && user.to === correct.to) ||
        (user.from === correct.to && user.to === correct.from)
      )
    ) && userConnections.length === exercise.correctConnections.length;

    if (isCorrect) {
      toast.success("Excellent work!", {
        description: exercise.explanation,
      });
      setCompleted(true);
      setScore(prev => prev + 1);
    } else {
      toast.error("Not quite right", {
        description: "Check your connections and try again.",
      });
    }
  };

  const handleNext = () => {
    if (currentExercise < exercises.length - 1) {
      setCurrentExercise(prev => prev + 1);
      resetExercise();
    }
  };

  const resetExercise = () => {
    setPlacedDevices([null, null, null, null]);
    setConnections([]);
    setSelectedForConnection(null);
    setShowHint(false);
    setCompleted(false);
  };

  const handleReset = () => {
    setCurrentExercise(0);
    setScore(0);
    resetExercise();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Network className="w-6 h-6 text-white" />
            </div>
            Network Device Connection
          </h1>
          <p className="text-gray-600 mt-2">Practice connecting network devices in proper topologies</p>
        </div>
        <Button variant="outline" onClick={handleReset} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Progress</span>
              <span className="font-semibold">
                Exercise {currentExercise + 1} of {exercises.length}
              </span>
            </div>
            <Progress value={progress} className="h-3" />
            <div className="text-sm text-gray-600">
              Score: {score}/{exercises.length}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exercise */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Panel - Devices */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Available Devices</CardTitle>
            <CardDescription>Drag devices to the workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {exercise.devices.map(device => (
              <DraggableDevice
                key={device.id}
                device={device}
                isPlaced={placedDevices.some(d => d?.id === device.id)}
                onDragStart={() => {}}
              />
            ))}
          </CardContent>
        </Card>

        {/* Right Panel - Workspace */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">{exercise.title}</CardTitle>
                <CardDescription className="mt-1">{exercise.description}</CardDescription>
              </div>
              <Badge variant="secondary">Exercise {exercise.id}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Workspace Grid */}
            <div className="bg-gray-50 rounded-xl p-8 min-h-[400px]">
              <div className="grid grid-cols-2 gap-8 max-w-md mx-auto">
                {[0, 1, 2, 3].map(pos => (
                  <DropZone
                    key={pos}
                    position={pos}
                    device={placedDevices[pos]}
                    onDrop={handleDrop}
                    onConnect={handleConnect}
                    selectedForConnection={selectedForConnection}
                    connections={connections}
                  />
                ))}
              </div>

              {/* Connection lines visualization */}
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  {connections.length} connection(s) made
                </p>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Instructions:</strong> Drag devices to the workspace, then click two devices to connect them. 
                Click a connection again to remove it.
              </p>
            </div>

            {/* Hint */}
            {!completed && (
              <Button
                variant="outline"
                onClick={() => setShowHint(!showHint)}
                className="w-full gap-2"
              >
                <Lightbulb className="w-4 h-4" />
                {showHint ? "Hide Hint" : "Show Hint"}
              </Button>
            )}

            {showHint && !completed && (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <Lightbulb className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800">{exercise.hint}</p>
                </div>
              </div>
            )}

            {/* Check/Next Buttons */}
            {!completed ? (
              <Button onClick={checkSolution} className="w-full" size="lg" disabled={connections.length === 0}>
                Check Solution
              </Button>
            ) : (
              <>
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-green-900 mb-1">Correct!</p>
                      <p className="text-sm text-green-800">{exercise.explanation}</p>
                    </div>
                  </div>
                </div>

                {currentExercise < exercises.length - 1 ? (
                  <Button onClick={handleNext} className="w-full gap-2" size="lg">
                    Next Exercise
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg p-6 text-center space-y-3">
                    <h3 className="text-2xl font-bold">All Exercises Complete! 🎉</h3>
                    <p className="text-purple-100">
                      You scored {score} out of {exercises.length}
                    </p>
                    <Button onClick={handleReset} variant="secondary" className="gap-2">
                      <RotateCcw className="w-4 h-4" />
                      Start Over
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
