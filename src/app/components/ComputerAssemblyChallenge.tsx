import { useState, useRef, useEffect } from "react";
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
  Lock,
  Unlock,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";

type ComponentType =
  | "motherboard"
  | "cpu"
  | "cpu-cooler"
  | "ram1"
  | "psu"
  | "gpu"
  | "ssd"
  | "case-fan";

// Strict installation order - no steps can be skipped
// This constant is used by helper functions outside the component
const INSTALLATION_ORDER: ComponentType[] = [
  "motherboard",
  "cpu",
  "cpu-cooler",
  "ram1",
  "gpu",
  "ssd",
  "case-fan",
  "psu",
];

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
  isNext: boolean;
  isLocked: boolean;
}

function DraggableComponent({ component, onRotate, isNext, isLocked }: DraggableComponentProps) {
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

  // Visual indicator for locked components (not yet available)
  const isDisabled = isLocked && !isNext;

  return (
    <div
      ref={drag}
      className={`p-3 border-2 rounded-lg cursor-move transition-all ${
        isDisabled 
          ? "bg-gray-50 border-gray-200 cursor-not-allowed opacity-60" 
          : isNext
            ? "bg-blue-50 border-blue-400 hover:border-blue-500 hover:shadow-md"
            : "bg-white border-gray-200 hover:border-blue-400 hover:shadow-md"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded flex items-center justify-center ${
          isDisabled ? "bg-gray-200" : "bg-gray-100"
        }`}>
          <ComponentIcon type={component.id} />
        </div>
<div className="flex-1">
          <div className="text-sm font-medium text-gray-900">{component.name}</div>
          {isNext && (
            <div className="text-xs text-blue-600 font-medium flex items-center gap-1">
              <Unlock className="w-3 h-3" />
              Next: Install this
            </div>
          )}
          {isLocked && !isNext && (
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Locked - Complete previous step first
            </div>
          )}
        </div>
        <button
          onClick={() => onRotate(component.id)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Rotate"
          disabled={isDisabled}
        >
          <RotateCw className={`w-4 h-4 ${isDisabled ? "text-gray-300" : "text-gray-600"}`} />
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
        <img
          src="/motherboard.png"
          alt="Motherboard"
          className={iconClass + " object-contain"}
          style={{ background: "#f3f4f6", borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
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
    case "case-fan":
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="8" strokeWidth="2" />
          <path d="M12 4v4M12 16v4M4 12h4M16 12h4" strokeWidth="2" />
        </svg>
      );
    default:
      return <div className="w-8 h-8 bg-gray-400 rounded" />;
  }
}

export function ComputerAssemblyChallenge() {
  const navigate = useNavigate();
  const [showSuccess, setShowSuccess] = useState(false);

  // Use ref to track placed state for dependency checks (avoids async state issues)
  const placedRef = useRef<Record<string, boolean>>({});

  const [components, setComponents] = useState<Component[]>([
    {
      id: "motherboard",
      name: "Motherboard",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 100, y: 80, width: 250, height: 300 },
    },
    {
      id: "cpu",
      name: "CPU",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 190, y: 140, width: 55, height: 90 },
    },
    {
      id: "cpu-cooler",
      name: "CPU Cooler",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 170, y: 130, width: 95, height: 110 },
    },
    {
      id: "ram1",
      name: "RAM Module",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 280, y: 100, width: 45, height: 170 },
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
      slot: { x: 100, y: 280, width: 200, height: 60 },
    },
    {
      id: "ssd",
      name: "SSD",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 450, y: 400, width: 100, height: 130 },
    },
    {
      id: "case-fan",
      name: "Case Fan",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 20, y: 80, width: 20, height: 120 },
    },
  ]);

// Get the current step in the installation sequence (0-based index)
  // Uses ref for accurate tracking of placed state to avoid stale state issues
  const getCurrentStep = (): number => {
    // Use the ref for dependency checks first
    const placedIds = Object.keys(placedRef.current).filter(id => placedRef.current[id]);
    
    if (placedIds.length === 0) return 0;
    
    // Find the highest order index that is placed
    let maxOrderIndex = -1;
    placedIds.forEach((id) => {
      const componentType = id as ComponentType;
      const orderIndex = INSTALLATION_ORDER.indexOf(componentType);
      if (orderIndex > maxOrderIndex) {
        maxOrderIndex = orderIndex;
      }
    });
    return maxOrderIndex + 1;
  };

  // Check if a component can be placed based on installation order
  // Uses ref for accurate tracking of placed state to avoid stale state issues
  const canPlaceComponent = (componentId: ComponentType): { allowed: boolean; message: string } => {
    const currentStep = getCurrentStep();
    const componentOrder = INSTALLATION_ORDER.indexOf(componentId);
    
    // Component not in order list
    if (componentOrder === -1) {
      return { allowed: true, message: "" };
    }
    
    // Component is already placed (check both ref and state)
    const isAlreadyPlaced = placedRef.current[componentId] || components.find((c) => c.id === componentId)?.placed || false;
    if (isAlreadyPlaced) {
      return { allowed: true, message: "" };
    }
    
    // Component must be placed at current step (no skipping allowed)
    if (componentOrder !== currentStep) {
      const currentComponentName = components.find((c) => c.id === componentId)?.name || componentId;
      const expectedComponentName = currentStep < INSTALLATION_ORDER.length 
        ? components.find((c) => c.id === INSTALLATION_ORDER[currentStep])?.name 
        : "the previous component";
      
      if (currentStep === 0) {
        return { 
          allowed: false, 
          message: `You must start by installing the Motherboard first!` 
        };
      }
      
      return { 
        allowed: false, 
        message: `Please install "${expectedComponentName || "the previous component"}" first before placing ${currentComponentName}.` 
      };
    }
    
    return { allowed: true, message: "" };
  };

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

    // Check installation order - no steps can be skipped
    const { allowed, message } = canPlaceComponent(componentId);
    if (!allowed) {
      alert(message);
      return;
    }

    const slot = component.slot;
    const isInSlot =
      dropX >= slot.x &&
      dropX <= slot.x + slot.width &&
      dropY >= slot.y &&
      dropY <= slot.y + slot.height;

    const isCorrectRotation = component.rotation === component.correctRotation;

    if (isInSlot && isCorrectRotation) {
      // Update both state AND ref immediately to fix synchronization issue
      setComponents((prev) => {
        const updatedComponents = prev.map((c) => 
          c.id === componentId ? { ...c, placed: true } : c
        );
        // Immediately update the ref for correct visual state calculation
        updatedComponents.forEach((c) => {
          placedRef.current[c.id] = c.placed;
        });
        return updatedComponents;
      });
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
    placedRef.current = {};
  };

  // Sync ref with state
  useEffect(() => {
    components.forEach((c) => {
      placedRef.current[c.id] = c.placed;
    });
  }, [components]);

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
                    {components
                      .sort((a, b) => {
                        const orderA = INSTALLATION_ORDER.indexOf(a.id);
                        const orderB = INSTALLATION_ORDER.indexOf(b.id);
                        return orderA - orderB;
                      })
                      .map((component) => {
                        const currentStep = getCurrentStep();
                        const componentOrder = INSTALLATION_ORDER.indexOf(component.id);
                        // Use ref for accurate placed state to show correct visual state
                        const isPlaced = placedRef.current[component.id] || component.placed;
                        const isNext = componentOrder === currentStep && !isPlaced;
                        const isLocked = componentOrder > currentStep;
                        
                        return (
                          <DraggableComponent
                            key={component.id}
                            component={{ ...component, placed: isPlaced }}
                            onRotate={handleRotate}
                            isNext={isNext}
                            isLocked={isLocked}
                          />
                        );
                      })}
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

// Build states based on installation progress
// Each state represents a complete F image showing components up to that point
type BuildState = 
  | "empty"           // No components placed
  | "motherboard"     // Motherboard placed
  | "cpu"            // Motherboard + CPU
  | "cpu-cooler"     // Motherboard + CPU + Cooler
  | "ram"            // Motherboard + CPU + Cooler + RAM
  | "gpu"            // Complete build (all components)
  | "ssd"            // (extended state)
  | "case-fan"       // (extended state)
  | "psu";           // Full build complete

// Map installation order to build states
// Each component maps to its corresponding build state
const COMPONENT_TO_STATE_MAP: Record<ComponentType, BuildState> = {
  "motherboard": "motherboard",
  "cpu": "cpu",
  "cpu-cooler": "cpu-cooler",
  "ram1": "ram",
  "gpu": "gpu",
  "ssd": "ssd",
  "case-fan": "case-fan",
  "psu": "psu",
};

// Get the current build state based on highest installed component
// Considers ALL components that affect the build state
const getCurrentBuildState = (placedComponents: Component[]): BuildState => {
  // Find the highest step that has been completed
  let highestOrderIndex = -1;
  let highestState: BuildState = "empty";
  
  placedComponents.forEach((component) => {
    if (component.placed) {
      const orderIndex = INSTALLATION_ORDER.indexOf(component.id);
      const mappedState = COMPONENT_TO_STATE_MAP[component.id];
      
      // Consider all components that map to a non-empty state
      // This includes ssd, case-fan, and psu
      if (mappedState !== "empty" && orderIndex > highestOrderIndex) {
        highestOrderIndex = orderIndex;
        highestState = mappedState;
      }
    }
  });
  
  return highestState;
};

// Configuration for build state images (size and position)
// Customize each image: adjust left/top for position, use scale for zoom
interface BuildStateConfig {
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
}

// Get image configuration based on current build state
const getBuildStateImage = (state: BuildState): BuildStateConfig | null => {
  // Replace these placeholder names with actual image files
  // HOW TO ZOOM: Use scale property - scale(1) = default, scale(1.5) = 150% zoom, scale(2) = 200% zoom
  // HOW TO POSITION: Use left/top for X/Y offset (negative = shift that direction)
  const stateImages: Record<BuildState, BuildStateConfig> = {
    // State 0: Empty case
    "empty": { src: "/pc-case.png", left: -10, top: 110, width: 0, height: 0, scale: 2 },
    // State 1: Motherboard
    "motherboard": { src: "/build-state-0.png", left: -10, top: 110, width: 0, height: 0, scale: 2 },
    // State 2: CPU
    "cpu": { src: "/build-state-1.png", left: -10, top: 110, width: 0, height: 0, scale: 2 },
    // State 3: CPU Cooler
    "cpu-cooler": { src: "/build-state-2.png", left: -10, top: 110, width: 0, height: 0, scale: 2 },
    // State 4: RAM
    "ram": { src: "/build-state-3.png", left: -10, top: 110, width: 0, height: 0, scale: 2 },
    // State 5: GPU
    "gpu": { src: "/build-state-4.png", left: -10, top: 110, width: 0, height: 0, scale: 2 },
    // State 6: SSD
    "ssd": { src: "/build-state-5.png", left: -10, top: 110, width: 0, height: 0, scale: 2 },
    // State 7: Case Fan
    "case-fan": { src: "/build-state-6.png", left: -10, top: 110, width: 0, height: 0, scale: 2 },
    // State 8: PSU (Full Build)
    "psu": { src: "/build-state-7.png", left:  -10, top: 110, width: 0, height: 0, scale: 2 },
  };
  
  return stateImages[state] || null;
};

// Get separate image for components that are handled independently
// These images coexist with the main build state image
const getComponentSeparateImage = (componentId: ComponentType): string => {
  const separateImages: Record<ComponentType, string> = {
    "ssd": "/build-state-5.png",      // SSD image
    "case-fan": "/build-state-6.png", // Case fan image
    "psu": "/build-state-7.png",      // PSU image
    "motherboard": "",
    "cpu": "",
    "cpu-cooler": "",
    "ram1": "",
    "gpu": "",
  };
  
  return separateImages[componentId];
};

// Configuration for separate component images (size and position)
/* 
  To customize SSD, case-fan, PSU images:
  - Adjust 'left' and 'top' for X/Y position
  - Adjust 'width' and 'height' for size
  - Default position: left: -60, top: -65, width: 720, height: 600
*/
const SEPARATE_IMAGE_CONFIG: Record<ComponentType, { left: number; top: number; width: number; height: number }> = {
  "ssd": { left: 0, top: 0, width: 0, height: 0 },
  "case-fan": { left: 0, top: 0, width: 220, height: 0 },
  "psu": { left: 0, top: 0, width: 0, height: 0 },
  "motherboard": { left: 0, top: 0, width: 0, height: 0 },
  "cpu": { left: 0, top: 0, width: 0, height: 0 },
  "cpu-cooler": { left: 0, top: 0, width: 0, height: 0 },
  "ram1": { left: 0, top: 0, width: 0, height: 0 },
  "gpu": { left: 0, top: 0, width: 0, height: 0 },
};

// Get the configuration for a separate component image
const getSeparateImageConfig = (componentId: ComponentType) => {
  return SEPARATE_IMAGE_CONFIG[componentId];
};

interface WorkspaceAreaProps {
  components: Component[];
  onDrop: (componentId: ComponentType, x: number, y: number) => void;
}

// Customizable background image for PC case - change this URL to use your own image
const PC_CASE_BACKGROUND = "/pc-case.png";

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

// Calculate current build state
  const currentBuildState = getCurrentBuildState(components);
  const currentImageConfig = getBuildStateImage(currentBuildState);
  const hasAnyComponentPlaced = currentBuildState !== "empty";

  // Get separate images for components that should coexist with main build state
  // These are rendered as overlay images that stack together
  const separatePlacedComponents = components.filter(
    (c) => c.placed && (c.id === "ssd" || c.id === "case-fan" || c.id === "psu")
  );

return (
    <div
      ref={drop}
      id="drop-area"
      className={`relative w-full h-[600px] rounded-xl border-4 ${
        isOver ? "border-blue-400" : "border-gray-700"
      } overflow-hidden transition-colors`}
    >
{/* Dynamic build state image - shows any state with customizable position/size */}
      {currentImageConfig && currentImageConfig.src && (
        <img
          src={currentImageConfig.src}
          alt={`Build state: ${currentBuildState}`}
          className="absolute object-contain"
          style={{
            left: currentImageConfig.left,
            top: currentImageConfig.top,
            transform: `scale(${currentImageConfig.scale})`,
            transformOrigin: 'center center',
          }}
        />
      )}

      {/* Separate images for SSD, case-fan, and PSU - shown as overlay on top of build state */}
      {separatePlacedComponents.map((component) => {
        const separateImageSrc = getComponentSeparateImage(component.id);
        const config = getSeparateImageConfig(component.id);
        if (!separateImageSrc) return null;
        return (
          <img
            key={component.id}
            src={separateImageSrc}
            alt={`${component.name} installed`}
            className="absolute object-contain"
            style={{
              left: config.left,
              top: config.top,
              width: config.width,
              height: config.height,
            }}
          />
        );
      })}

{/* Case outline and slots - always visible for visual guide */}
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
              stroke="#ff0000"
              strokeWidth="3"
              rx="4"
            />
          );
        })}
      </svg>

{/* Helper text - always visible */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
        <div className="text-gray-400 text-sm">Drop components here</div>
      </div>

      {/* Progress indicator */}
      {hasAnyComponentPlaced && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 px-3 py-2 rounded-lg">
          <div className="text-green-400 text-sm font-medium">
            Build State: {currentBuildState.charAt(0).toUpperCase() + currentBuildState.slice(1)}
          </div>
        </div>
      )}
    </div>
  );
}
