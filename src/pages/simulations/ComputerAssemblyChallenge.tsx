import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  ArrowLeft,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Trophy,
  Lock,
  Unlock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmissionResultsDialog } from "@/components/common/SubmissionResultsDialog";
import { useChallengeAttempt } from "@/features/content/useChallengeAttempt";

type ComponentType =
  | "motherboard"
  | "cpu"
  | "cpu-cooler"
  | "ram1"
  | "psu"
  | "gpu"
  | "ssd"
  | "case-fan";

// The build order this page falls back to in free practice. A challenge
// opened from the catalogue brings its own, and the server checks the
// submitted sequence against its own copy either way.
const DEFAULT_INSTALLATION_ORDER: ComponentType[] = [
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
      // Drawn rather than loaded: /motherboard.png was never in public/, so
      // this was a broken image in the parts list.
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
          <rect x="7" y="7" width="6" height="6" strokeWidth="1.5" />
          <line x1="16" y1="6" x2="16" y2="12" strokeWidth="1.5" />
          <line x1="18.5" y1="6" x2="18.5" y2="12" strokeWidth="1.5" />
          <line x1="6" y1="17" x2="15" y2="17" strokeWidth="1.5" />
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

  /**
   * Graded when opened from the catalogue with `?attempt=`, free practice
   * otherwise. The order parts went in is what the server grades.
   */
  const [installed, setInstalled] = useState<string[]>([]);
  const attempt = useChallengeAttempt();

  // The challenge decides what goes in and in what order; the page only knows
  // how to draw the parts. Free practice falls back to the standard build.
  const installationOrder = (attempt.challenge?.config?.components?.length
    ? attempt.challenge.config.components
    : DEFAULT_INSTALLATION_ORDER) as ComponentType[];

  // Use ref to track placed state for dependency checks (avoids async state issues)
  const placedRef = useRef<Record<string, boolean>>({});

  const [components, setComponents] = useState<Component[]>([
    {
      id: "motherboard",
      name: "Motherboard",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 55, y: 94, width: 343, height: 360 },
    },
    {
      id: "cpu",
      name: "CPU",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 219, y: 143, width: 65, height: 98 },
    },
    {
      id: "cpu-cooler",
      name: "CPU Cooler",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 170, y: 126, width: 147, height: 147 },
    },
    {
      id: "ram1",
      name: "RAM Module",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 301, y: 110, width: 82, height: 180 },
    },
    {
      id: "psu",
      name: "Power Supply Unit",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 40, y: 486, width: 280, height: 110 },
    },
    {
      id: "gpu",
      name: "Graphics Card",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 55, y: 306, width: 393, height: 115 },
    },
    {
      id: "ssd",
      name: "SSD",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 465, y: 486, width: 131, height: 98 },
    },
    {
      id: "case-fan",
      name: "Case Fan",
      placed: false,
      rotation: 0,
      correctRotation: 0,
      slot: { x: 23, y: 77, width: 82, height: 164 },
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
      const orderIndex = installationOrder.indexOf(componentType);
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
    const componentOrder = installationOrder.indexOf(componentId);
    
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
      const expectedComponentName = currentStep < installationOrder.length 
        ? components.find((c) => c.id === installationOrder[currentStep])?.name 
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
      // The sequence is what gets graded, so it is recorded as it happens
      // rather than assumed from the enforced order.
      setInstalled((previous) =>
        previous.includes(componentId) ? previous : [...previous, componentId],
      );

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
    if (!allPlaced) {
      return;
    }

    // Practice runs stop at the success banner; a run opened from the
    // catalogue is submitted and graded.
    if (attempt.isGraded) {
      void attempt.submit({ installed });
      return;
    }

    setShowSuccess(true);
  };

  const resetChallenge = () => {
    setComponents((prev) => prev.map((c) => ({ ...c, placed: false, rotation: 0 })));
    setShowSuccess(false);
    setInstalled([]);
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
  // Drives the width of the progress bar; never shown as a number.
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
                  {attempt.challenge?.title ?? "Assemble a System Unit"}
                </h1>
                <p className="text-sm text-gray-600">
                  {attempt.challenge?.description ??
                    "Drag and drop components to assemble a complete computer system"}
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Progress</div>
                <div className="text-2xl font-bold text-blue-600">
                  {placedCount}/{totalCount}
                </div>
                <div className="mt-1 h-1.5 w-32 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
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
                        const orderA = installationOrder.indexOf(a.id);
                        const orderB = installationOrder.indexOf(b.id);
                        return orderA - orderB;
                      })
                      .map((component) => {
                        const currentStep = getCurrentStep();
                        const componentOrder = installationOrder.indexOf(component.id);
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
                  <WorkspaceArea
                    components={components}
                    onDrop={handleDrop}
                    order={installationOrder}
                  />
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
        <SubmissionResultsDialog
          results={attempt.results}
          passed={attempt.passed}
          onClose={attempt.dismissResults}
          onBack={() => navigate("/challenges")}
        />

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
const getCurrentBuildState = (
  placedComponents: Component[],
  order: ComponentType[],
): BuildState => {
  // Find the highest step that has been completed
  let highestOrderIndex = -1;
  let highestState: BuildState = "empty";
  
  placedComponents.forEach((component) => {
    if (component.placed) {
      const orderIndex = order.indexOf(component.id);
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
    "empty": { src: "/pc-case.webp", left: -10, top: 110, width: 0, height: 0, scale: 2 },
    // State 1: Motherboard
    "motherboard": { src: "/build-state-0.webp", left: -10, top: 110, width: 0, height: 0, scale: 2 },
    // State 2: CPU
    "cpu": { src: "/build-state-1.webp", left: -10, top: 110, width: 0, height: 0, scale: 2 },
    // State 3: CPU Cooler
    "cpu-cooler": { src: "/build-state-2.webp", left: -10, top: 110, width: 0, height: 0, scale: 2 },
    // State 4: RAM
    "ram": { src: "/build-state-3.webp", left: -10, top: 110, width: 0, height: 0, scale: 2 },
    // State 5: GPU
    "gpu": { src: "/build-state-4.webp", left: -10, top: 110, width: 0, height: 0, scale: 2 },
    // State 6: SSD
    "ssd": { src: "/build-state-5.webp", left: -10, top: 110, width: 0, height: 0, scale: 2 },
    // State 7: Case Fan
    "case-fan": { src: "/build-state-6.webp", left: -10, top: 110, width: 0, height: 0, scale: 2 },
    // State 8: PSU (Full Build)
    "psu": { src: "/build-state-7.webp", left:  -10, top: 110, width: 0, height: 0, scale: 2 },
  };
  
  return stateImages[state] || null;
};

// Get separate image for components that are handled independently
// These images coexist with the main build state image
const getComponentSeparateImage = (componentId: ComponentType): string => {
  const separateImages: Record<ComponentType, string> = {
    "ssd": "/build-state-5.webp",      // SSD image
    "case-fan": "/build-state-6.webp", // Case fan image
    "psu": "/build-state-7.webp",      // PSU image
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

/**
 * The workspace is authored against a fixed canvas and scaled to whatever room
 * it is given.
 *
 * Slot positions, the case artwork and the drop hit-test were all in raw CSS
 * pixels inside a container whose width follows the viewport, so the red guide
 * boxes drifted away from the case on any screen that was not the one they were
 * drawn on. Everything now lives in this one space and scales together, which
 * is what keeps them aligned from a 14" laptop to a 27" monitor.
 */
const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 600;

/**
 * Where the case art sits on that canvas.
 *
 * These are the numbers the old CSS produced once the browser had capped the
 * image to the container and then doubled it, measured off the running page —
 * so the slots keep the alignment they were drawn against.
 */
const CASE_ART = { x: -370, y: -86.4, width: 1440, height: 785.4 };

interface WorkspaceAreaProps {
  components: Component[];
  onDrop: (componentId: ComponentType, x: number, y: number) => void;
  /** The build order in play, which decides how far along the artwork is. */
  order: ComponentType[];
}

function WorkspaceArea({ components, onDrop, order }: WorkspaceAreaProps) {
  const canvas = useRef<SVGSVGElement | null>(null);

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: "component",
      drop: (item: { id: ComponentType }, monitor) => {
        const offset = monitor.getClientOffset();
        const box = canvas.current?.getBoundingClientRect();

        if (!offset || !box) return;

        // Measured at the moment of the drop, so the hit-test is right at any
        // size without anything having to watch for resizes.
        const scale = box.width / DESIGN_WIDTH;

        onDrop(item.id, (offset.x - box.left) / scale, (offset.y - box.top) / scale);
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    }),
    [onDrop],
  );

  const currentBuildState = getCurrentBuildState(components, order);
  const currentImageConfig = getBuildStateImage(currentBuildState);
  const hasAnyComponentPlaced = currentBuildState !== "empty";

  // Overlays that sit on top of the main build state.
  const separatePlacedComponents = components.filter(
    (c) => c.placed && (c.id === "ssd" || c.id === "case-fan" || c.id === "psu"),
  );

  return (
    <div
      ref={drop}
      id="drop-area"
      className={`relative w-full rounded-xl border-4 ${
        isOver ? "border-blue-400" : "border-gray-700"
      } overflow-hidden transition-colors`}
      style={{ aspectRatio: `${DESIGN_WIDTH} / ${DESIGN_HEIGHT}` }}
    >
      {/* The case, the overlays and the slot guides share one viewBox, so they
          scale together and stay lined up whatever the screen. */}
      <svg
        ref={canvas}
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${DESIGN_WIDTH} ${DESIGN_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {currentImageConfig?.src && (
          <image
            href={currentImageConfig.src}
            x={CASE_ART.x}
            y={CASE_ART.y}
            width={CASE_ART.width}
            height={CASE_ART.height}
          />
        )}

        {separatePlacedComponents.map((component) => {
          const src = getComponentSeparateImage(component.id);
          const config = getSeparateImageConfig(component.id);

          if (!src) return null;

          return (
            <image
              key={component.id}
              href={src}
              x={config.left}
              y={config.top}
              width={config.width}
              height={config.height}
            />
          );
        })}

        {/* Slot guides, in the same units the drop is measured in. */}
        <g opacity="0.3">
          {components.map((component) =>
            component.placed ? null : (
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
            ),
          )}
        </g>
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
