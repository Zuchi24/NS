import { useState } from "react";
import { useNavigate } from "react-router";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  ArrowLeft,
  RotateCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trophy,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";

type ComponentType =
  | "motherboard"
  | "cpu"
  | "cpu-cooler"
  | "ram1"
  | "ram2"
  | "psu"
  | "gpu"
  | "ssd"
  | "hdd"
  | "case-fan"
  | "optical-drive"
  | "power-cable"
  | "sata-cable";

interface Component {
  id: ComponentType;
  name: string;
  placed: boolean;
  rotation: number;
  correctRotation: number;
  slot: { x: number; y: number; width: number; height: number };
}

interface DraggableComponentProps {
  component: Component;
  onRotate: (id: ComponentType) => void;
}

function DraggableComponent({ component, onRotate }: DraggableComponentProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "component",
    item: { id: component.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  if (component.placed) {
    return (
      <div className="p-3 bg-gray-100 border border-gray-300 rounded-lg opacity-50">
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 bg-gray-300 rounded flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <span className="text-sm text-gray-500">{component.name}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={drag}
      className={`p-3 bg-white border-2 border-gray-200 rounded-lg cursor-move hover:border-blue-400 hover:shadow-md transition-all ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
          <ComponentIcon type={component.id} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">{component.name}</div>
        </div>
        <button
          onClick={() => onRotate(component.id)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Rotate"
        >
          <RotateCw className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    </div>
  );
}

function ComponentIcon({ type }: { type: ComponentType }) {
  const iconClass = "w-8 h-8 text-gray-700";

  switch (type) {
    case "motherboard":
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <rect x="3" y="3" width="18" height="18" strokeWidth="2" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          <circle cx="16" cy="8" r="1.5" fill="currentColor" />
          <circle cx="8" cy="16" r="1.5" fill="currentColor" />
          <circle cx="16" cy="16" r="1.5" fill="currentColor" />
        </svg>
      );
    case "cpu":
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <rect x="6" y="6" width="12" height="12" strokeWidth="2" />
          <rect x="9" y="9" width="6" height="6" fill="currentColor" />
        </svg>
      );
    case "cpu-cooler":
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="6" strokeWidth="2" />
          <path d="M12 6v12M6 12h12" strokeWidth="1.5" />
        </svg>
      );
    case "ram1":
    case "ram2":
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <rect x="5" y="8" width="14" height="8" strokeWidth="2" />
          <line x1="8" y1="8" x2="8" y2="5" strokeWidth="2" />
          <line x1="12" y1="8" x2="12" y2="5" strokeWidth="2" />
          <line x1="16" y1="8" x2="16" y2="5" strokeWidth="2" />
        </svg>
      );
    case "psu":
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <rect x="4" y="7" width="16" height="10" strokeWidth="2" />
          <circle cx="12" cy="12" r="3" strokeWidth="2" />
        </svg>
      );
    case "gpu":
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <rect x="3" y="9" width="18" height="6" strokeWidth="2" />
          <rect x="6" y="11" width="4" height="2" fill="currentColor" />
          <rect x="14" y="11" width="4" height="2" fill="currentColor" />
        </svg>
      );
    case "ssd":
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <rect x="6" y="6" width="12" height="12" strokeWidth="2" />
          <line x1="9" y1="10" x2="15" y2="10" strokeWidth="1.5" />
          <line x1="9" y1="14" x2="15" y2="14" strokeWidth="1.5" />
        </svg>
      );
    case "hdd":
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <rect x="5" y="7" width="14" height="10" strokeWidth="2" />
          <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
        </svg>
      );
    case "case-fan":
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="8" strokeWidth="2" />
          <path d="M12 4v4M12 16v4M4 12h4M16 12h4" strokeWidth="2" />
        </svg>
      );
    case "optical-drive":
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <rect x="4" y="9" width="16" height="6" strokeWidth="2" />
          <circle cx="17" cy="12" r="1" fill="currentColor" />
        </svg>
      );
    case "power-cable":
    case "sata-cable":
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M4 12h16M8 8l4-4 4 4M8 16l4 4 4-4" strokeWidth="2" />
        </svg>
      );
    default:
      return <div className="w-8 h-8 bg-gray-400 rounded" />;
  }
}

export function ComputerAssemblyChallenge() {
  const navigate = useNavigate();
  const [showSuccess, setShowSuccess] = useState(false);

  const [components, setComponents] = useState<Component[]>([
    {
      id: "motherboard",
      name: "Motherboard",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 120, y: 80, width: 280, height: 320 },
    },
    {
      id: "cpu",
      name: "CPU",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 200, y: 140, width: 60, height: 60 },
    },
    {
      id: "cpu-cooler",
      name: "CPU Cooler",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 190, y: 130, width: 80, height: 80 },
    },
    {
      id: "ram1",
      name: "RAM Module 1",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 300, y: 150, width: 60, height: 20 },
    },
    {
      id: "ram2",
      name: "RAM Module 2",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 300, y: 180, width: 60, height: 20 },
    },
    {
      id: "psu",
      name: "Power Supply Unit",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 80, y: 420, width: 120, height: 80 },
    },
    {
      id: "gpu",
      name: "Graphics Card",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 150, y: 280, width: 200, height: 60 },
    },
    {
      id: "ssd",
      name: "SSD",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 450, y: 200, width: 80, height: 60 },
    },
    {
      id: "hdd",
      name: "HDD",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 450, y: 280, width: 100, height: 80 },
    },
    {
      id: "case-fan",
      name: "Case Fan",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 480, y: 80, width: 80, height: 80 },
    },
    {
      id: "optical-drive",
      name: "Optical Drive",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 450, y: 20, width: 120, height: 40 },
    },
    {
      id: "power-cable",
      name: "Power Cable",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 220, y: 420, width: 100, height: 20 },
    },
    {
      id: "sata-cable",
      name: "SATA Cable",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 400, y: 380, width: 80, height: 20 },
    },
  ]);

  const handleRotate = (id: ComponentType) => {
    setComponents((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, rotation: (c.rotation + 90) % 360 } : c
      )
    );
  };

  const handleDrop = (componentId: ComponentType, dropX: number, dropY: number) => {
    const component = components.find((c) => c.id === componentId);
    if (!component) return;

    const slot = component.slot;
    const isInSlot =
      dropX >= slot.x &&
      dropX <= slot.x + slot.width &&
      dropY >= slot.y &&
      dropY <= slot.y + slot.height;

    const isCorrectRotation = component.rotation === component.correctRotation;

    if (isInSlot && isCorrectRotation) {
      setComponents((prev) =>
        prev.map((c) => (c.id === componentId ? { ...c, placed: true } : c))
      );
    }
  };

  const checkAssembly = () => {
    const allPlaced = components.every((c) => c.placed);
    if (allPlaced) {
      setShowSuccess(true);
    }
  };

  const resetChallenge = () => {
    setComponents((prev) => prev.map((c) => ({ ...c, placed: false, rotation: 0 })));
    setShowSuccess(false);
  };

  const placedCount = components.filter((c) => c.placed).length;
  const totalCount = components.length;
  const progress = Math.round((placedCount / totalCount) * 100);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'Roboto, sans-serif' }}>
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/challenges")}
              className="mb-4 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Challenges
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  Challenge 1: Assemble & Disassemble System Unit
                </h1>
                <p className="text-sm text-gray-600">
                  Drag and drop components to assemble a complete computer system
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Progress</div>
                <div className="text-2xl font-bold text-blue-600">
                  {placedCount}/{totalCount}
                </div>
              </div>
            </div>
          </div>

          {/* Main Layout */}
          <div className="grid grid-cols-12 gap-6">
            {/* Left Panel - Components */}
            <div className="col-span-3">
              <Card className="border border-gray-200 shadow-sm">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">
                    Components ({totalCount})
                  </h3>
                  <div className="space-y-2">
                    {components.map((component) => (
                      <DraggableComponent
                        key={component.id}
                        component={component}
                        onRotate={handleRotate}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Center Panel - Workspace */}
            <div className="col-span-6">
              <Card className="border border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">System Unit Case</h3>
                    <span className="text-xs text-gray-500">Drag components here</span>
                  </div>
                  <WorkspaceArea components={components} onDrop={handleDrop} />
                </CardContent>
              </Card>
            </div>

            {/* Right Panel - Checklist */}
            <div className="col-span-3">
              <Card className="border border-gray-200 shadow-sm mb-4">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">
                    Assembly Checklist
                  </h3>
                  <div className="space-y-2">
                    {components.map((component) => (
                      <div
                        key={component.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        {component.placed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                        )}
                        <span className={component.placed ? "text-gray-900" : "text-gray-500"}>
                          {component.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gray-200 shadow-sm mb-4">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">System Status</h3>
                  <div
                    className={`flex items-center gap-2 p-3 rounded-lg ${
                      placedCount === totalCount
                        ? "bg-green-50 text-green-700"
                        : "bg-orange-50 text-orange-700"
                    }`}
                  >
                    {placedCount === totalCount ? (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-medium text-sm">System Ready</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-medium text-sm">Not Ready</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gray-200 shadow-sm">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Controls Guide</h3>
                  <div className="space-y-2 text-xs text-gray-600">
                    <div>• Drag components to the case</div>
                    <div>• Click rotate button to change orientation</div>
                    <div>• Place in correct slot to lock</div>
                  </div>
                </CardContent>
              </Card>

              <div className="mt-4 space-y-2">
                <Button
                  onClick={checkAssembly}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={placedCount !== totalCount}
                >
                  Check Assembly
                </Button>
                <Button
                  onClick={resetChallenge}
                  variant="outline"
                  className="w-full border-gray-300 text-gray-700"
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Success Modal */}
        {showSuccess && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-96 border-2 border-green-500">
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-12 h-12 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Challenge Complete!
                </h2>
                <p className="text-gray-600 mb-6">
                  You successfully assembled the computer system unit!
                </p>
                <div className="space-y-2">
                  <Button
                    onClick={() => navigate("/challenges")}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Back to Challenges
                  </Button>
                  <Button
                    onClick={resetChallenge}
                    variant="outline"
                    className="w-full"
                  >
                    Try Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DndProvider>
  );
}

interface WorkspaceAreaProps {
  components: Component[];
  onDrop: (componentId: ComponentType, x: number, y: number) => void;
}

function WorkspaceArea({ components, onDrop }: WorkspaceAreaProps) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: "component",
    drop: (item: { id: ComponentType }, monitor) => {
      const offset = monitor.getClientOffset();
      if (offset) {
        const dropAreaRect = document.getElementById("drop-area")?.getBoundingClientRect();
        if (dropAreaRect) {
          const x = offset.x - dropAreaRect.left;
          const y = offset.y - dropAreaRect.top;
          onDrop(item.id, x, y);
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  return (
    <div
      ref={drop}
      id="drop-area"
      className={`relative w-full h-[600px] bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border-4 ${
        isOver ? "border-blue-400" : "border-gray-700"
      } overflow-hidden transition-colors`}
    >
      {/* Case outline and slots */}
      <svg className="absolute inset-0 w-full h-full opacity-30">
        {components.map((component) => {
          if (component.placed) return null;
          return (
            <rect
              key={component.id}
              x={component.slot.x}
              y={component.slot.y}
              width={component.slot.width}
              height={component.slot.height}
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2"
              strokeDasharray="5,5"
              rx="4"
            />
          );
        })}
      </svg>

      {/* Placed components */}
      {components.map((component) => {
        if (!component.placed) return null;
        return (
          <div
            key={component.id}
            className="absolute bg-green-500 bg-opacity-20 border-2 border-green-500 rounded flex items-center justify-center"
            style={{
              left: component.slot.x,
              top: component.slot.y,
              width: component.slot.width,
              height: component.slot.height,
              transform: `rotate(${component.rotation}deg)`,
            }}
          >
            <CheckCircle2 className="w-6 h-6 text-green-400" />
          </div>
        );
      })}

      {/* Helper text */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
        <div className="text-gray-400 text-sm">Drop components here</div>
      </div>
    </div>
  );
}
