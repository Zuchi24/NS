import { useState } from "react";
import { useNavigate } from "react-router";
import { useDrag, useDrop } from "react-dnd";
import {
  ArrowLeft,
  Scissors,
  Wrench,
  Cable,
  CheckCircle,
  XCircle,
  RotateCcw,
  Trophy,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { toast } from "sonner";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";

interface Wire {
  id: string;
  color: string;
  label: string;
  position: number | null;
}

const WIRE_COLORS = {
  "white-orange": { bg: "#FFE4CC", border: "#FF8C00", label: "White-Orange" },
  "orange": { bg: "#FF8C00", border: "#CC6600", label: "Orange" },
  "white-green": { bg: "#E0FFE0", border: "#00CC00", label: "White-Green" },
  "blue": { bg: "#0066FF", border: "#003399", label: "Blue" },
  "white-blue": { bg: "#CCE5FF", border: "#0066FF", label: "White-Blue" },
  "green": { bg: "#00CC00", border: "#009900", label: "Green" },
  "white-brown": { bg: "#F5E6D3", border: "#8B4513", label: "White-Brown" },
  "brown": { bg: "#8B4513", border: "#654321", label: "Brown" },
};

const STANDARDS = {
  T568A: ["white-green", "green", "white-orange", "blue", "white-blue", "orange", "white-brown", "brown"],
  T568B: ["white-orange", "orange", "white-green", "blue", "white-blue", "green", "white-brown", "brown"],
};

const CABLE_TYPES = [
  { id: "straight", label: "Straight Through", standards: { end1: "T568B", end2: "T568B" } },
  { id: "crossover", label: "Crossover", standards: { end1: "T568A", end2: "T568B" } },
  { id: "rollover", label: "Rollover", standards: { end1: "T568B", end2: "Reversed" } },
];

function DraggableWire({
  wire,
  onDrop,
  isInSlot,
}: {
  wire: Wire;
  onDrop: (wireId: string, position: number | null) => void;
  isInSlot: boolean;
}) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "wire",
    item: { id: wire.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const colorInfo = WIRE_COLORS[wire.color as keyof typeof WIRE_COLORS];

  return (
    <div
      ref={drag}
      className={`w-16 h-32 rounded-lg cursor-move transition-all ${
        isDragging ? "opacity-50 scale-95" : "opacity-100"
      }`}
      style={{
        background: `linear-gradient(to bottom, ${colorInfo.bg} 0%, ${colorInfo.border} 100%)`,
        border: `3px solid ${colorInfo.border}`,
      }}
      onDoubleClick={() => !isInSlot && onDrop(wire.id, null)}
    >
      <div className="h-full flex items-center justify-center">
        <span className="text-xs font-bold text-center px-1 bg-white/80 rounded py-1 rotate-90 whitespace-nowrap">
          {wire.label}
        </span>
      </div>
    </div>
  );
}

function WireSlot({
  position,
  wire,
  onDrop,
  isCorrect,
  showValidation,
  showGuide,
  guidedColor,
}: {
  position: number;
  wire: Wire | null;
  onDrop: (wireId: string, position: number) => void;
  isCorrect: boolean;
  showValidation: boolean;
  showGuide: boolean;
  guidedColor: string | null;
}) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: "wire",
    drop: (item: { id: string }) => onDrop(item.id, position),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const guideColorInfo = guidedColor ? WIRE_COLORS[guidedColor as keyof typeof WIRE_COLORS] : null;

  return (
    <div
      ref={drop}
      className={`w-20 h-40 border-4 rounded-lg transition-all flex flex-col items-center justify-center ${
        isOver ? "border-blue-500 bg-blue-50 scale-105" : "border-gray-300 bg-gray-50"
      } ${
        showValidation && wire
          ? isCorrect
            ? "border-green-500 bg-green-50"
            : "border-red-500 bg-red-50"
          : ""
      }`}
    >
      <div className="text-xs font-bold text-gray-500 mb-2">{position + 1}</div>
      {wire ? (
        <DraggableWire wire={wire} onDrop={(id) => onDrop(id, null)} isInSlot={true} />
      ) : showGuide && guideColorInfo ? (
        <div className="flex-1 w-full flex items-center justify-center opacity-30">
          <div
            className="w-12 h-24 rounded"
            style={{ backgroundColor: guideColorInfo.bg, border: `2px solid ${guideColorInfo.border}` }}
          />
        </div>
      ) : (
        <div className="text-xs text-gray-400">Drop here</div>
      )}
    </div>
  );
}

export function CableWiringChallenge() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [cableType, setCableType] = useState("straight");
  const [standard, setStandard] = useState<"T568A" | "T568B">("T568B");
  const [showGuide, setShowGuide] = useState(false);
  const [wires, setWires] = useState<Wire[]>([]);
  const [cableStripped, setCableStripped] = useState(false);
  const [rj45Attached, setRj45Attached] = useState(false);
  const [crimped, setCrimped] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  const initializeWires = () => {
    const wireColors = Object.keys(WIRE_COLORS);
    const shuffled = [...wireColors].sort(() => Math.random() - 0.5);
    return shuffled.map((color, index) => ({
      id: `wire-${index}`,
      color,
      label: WIRE_COLORS[color as keyof typeof WIRE_COLORS].label,
      position: null,
    }));
  };

  const handleStripCable = () => {
    if (selectedTool !== "stripper") {
      toast.error("Select the Wire Stripper tool first!");
      return;
    }
    setCableStripped(true);
    setWires(initializeWires());
    setStep(2);
    toast.success("Cable jacket removed! Now arrange the wires.");
  };

  const handleWireDrop = (wireId: string, position: number | null) => {
    setWires((prevWires) =>
      prevWires.map((w) => {
        if (w.id === wireId) {
          return { ...w, position };
        }
        if (w.position === position && position !== null) {
          return { ...w, position: null };
        }
        return w;
      })
    );
  };

  const checkWireOrder = () => {
    const correctOrder = STANDARDS[standard];
    const currentOrder = [...Array(8)].map((_, i) => {
      const wire = wires.find((w) => w.position === i);
      return wire ? wire.color : null;
    });

    return currentOrder.every((color, index) => color === correctOrder[index]);
  };

  const handleValidateArrangement = () => {
    const allWiresPlaced = wires.every((w) => w.position !== null);

    if (!allWiresPlaced) {
      toast.error("Please place all wires in the slots!");
      return;
    }

    setShowValidation(true);
    const isCorrect = checkWireOrder();

    if (isCorrect) {
      toast.success("Correct wire arrangement! Now attach the RJ45 connector.");
      setStep(3);
    } else {
      toast.error("Incorrect wire order. Check the standard and try again!");
    }
  };

  const handleAttachRJ45 = () => {
    if (selectedTool !== "rj45") {
      toast.error("Select the RJ45 Connector first!");
      return;
    }
    setRj45Attached(true);
    setStep(4);
    toast.success("RJ45 connector attached! Now crimp the cable.");
  };

  const handleCrimp = () => {
    if (selectedTool !== "crimper") {
      toast.error("Select the Crimping Tool first!");
      return;
    }
    setCrimped(true);
    toast.success(`✅ Success! ${cableType === "straight" ? "Straight Through" : cableType === "crossover" ? "Crossover" : "Rollover"} cable completed with ${standard} standard!`);
  };

  const handleReset = () => {
    setCableStripped(false);
    setWires([]);
    setRj45Attached(false);
    setCrimped(false);
    setShowValidation(false);
    setStep(1);
    setSelectedTool(null);
    toast.info("Challenge reset");
  };

  const getInstructions = () => {
    switch (step) {
      case 1:
        return "Select the Wire Stripper tool and click the cable to remove the jacket.";
      case 2:
        return `Drag and arrange the wires according to ${standard} color order. You can toggle the guide to see the correct positions.`;
      case 3:
        return "Select the RJ45 Connector and click to attach it to the arranged wires.";
      case 4:
        return "Select the Crimping Tool and click the RJ45 connector to crimp the cable.";
      default:
        return "";
    }
  };

  const progressPercentage = (step / 4) * 100;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/challenges")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Challenges
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Cable Wiring Simulation</h1>
                <p className="text-sm text-gray-600">Learn T568A and T568B Wiring Standards</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2 text-xs">
                <span className={`font-medium ${step >= 1 ? "text-blue-600" : "text-gray-400"}`}>
                  1. Strip
                </span>
                <span className={`font-medium ${step >= 2 ? "text-blue-600" : "text-gray-400"}`}>
                  2. Arrange
                </span>
                <span className={`font-medium ${step >= 3 ? "text-blue-600" : "text-gray-400"}`}>
                  3. Insert RJ45
                </span>
                <span className={`font-medium ${step >= 4 ? "text-blue-600" : "text-gray-400"}`}>
                  4. Crimp
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full p-6">
          <div className="grid grid-cols-12 gap-6 h-full">
            {/* Left Panel - Tools */}
            <div className="col-span-2">
              <Card className="h-full border-gray-200">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    Tools
                  </h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => setSelectedTool("stripper")}
                      disabled={step !== 1}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedTool === "stripper"
                          ? "border-blue-500 bg-blue-50 shadow-md"
                          : "border-gray-300 bg-white hover:border-blue-300"
                      } ${step !== 1 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <Scissors className="w-8 h-8 mx-auto mb-2 text-gray-700" />
                      <div className="text-xs font-medium text-center">Wire Stripper</div>
                    </button>

                    <button
                      onClick={() => setSelectedTool("rj45")}
                      disabled={step !== 3}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedTool === "rj45"
                          ? "border-blue-500 bg-blue-50 shadow-md"
                          : "border-gray-300 bg-white hover:border-blue-300"
                      } ${step !== 3 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <Cable className="w-8 h-8 mx-auto mb-2 text-gray-700" />
                      <div className="text-xs font-medium text-center">RJ45 Connector</div>
                    </button>

                    <button
                      onClick={() => setSelectedTool("crimper")}
                      disabled={step !== 4}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedTool === "crimper"
                          ? "border-blue-500 bg-blue-50 shadow-md"
                          : "border-gray-300 bg-white hover:border-blue-300"
                      } ${step !== 4 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <Wrench className="w-8 h-8 mx-auto mb-2 text-gray-700" />
                      <div className="text-xs font-medium text-center">Crimping Tool</div>
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Center Panel - Work Area */}
            <div className="col-span-7">
              <Card className="h-full border-gray-200">
                <CardContent className="p-6 h-full flex flex-col">
                  <h3 className="font-semibold text-gray-900 mb-4">Work Area</h3>

                  <div className="flex-1 flex flex-col items-center justify-center gap-8">
                    {/* Step 1: Cable Display */}
                    {step === 1 && (
                      <div className="text-center space-y-6">
                        <div className="w-96 h-32 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-white font-bold text-lg">Ethernet Cable</span>
                        </div>
                        <Button
                          onClick={handleStripCable}
                          size="lg"
                          className="bg-blue-600 hover:bg-blue-700"
                          disabled={selectedTool !== "stripper"}
                        >
                          <Scissors className="w-5 h-5 mr-2" />
                          Strip Cable
                        </Button>
                      </div>
                    )}

                    {/* Step 2: Wire Arrangement */}
                    {step >= 2 && !rj45Attached && (
                      <div className="w-full space-y-6">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 text-center">
                            Arrangement Slots ({standard} Standard)
                          </h4>
                          <div className="flex justify-center gap-2 mb-6">
                            {[...Array(8)].map((_, i) => {
                              const wire = wires.find((w) => w.position === i);
                              const correctOrder = STANDARDS[standard];
                              const isCorrect = wire ? wire.color === correctOrder[i] : false;
                              return (
                                <WireSlot
                                  key={i}
                                  position={i}
                                  wire={wire || null}
                                  onDrop={handleWireDrop}
                                  isCorrect={isCorrect}
                                  showValidation={showValidation}
                                  showGuide={showGuide}
                                  guidedColor={showGuide ? correctOrder[i] : null}
                                />
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 text-center">
                            Available Wires
                          </h4>
                          <div className="flex justify-center gap-3 flex-wrap">
                            {wires
                              .filter((w) => w.position === null)
                              .map((wire) => (
                                <DraggableWire
                                  key={wire.id}
                                  wire={wire}
                                  onDrop={handleWireDrop}
                                  isInSlot={false}
                                />
                              ))}
                          </div>
                        </div>

                        {step === 2 && (
                          <div className="flex justify-center">
                            <Button
                              onClick={handleValidateArrangement}
                              size="lg"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="w-5 h-5 mr-2" />
                              Validate Arrangement
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step 3: RJ45 Attachment */}
                    {step === 3 && (
                      <div className="text-center space-y-6">
                        <div className="flex justify-center gap-2">
                          {[...Array(8)].map((_, i) => {
                            const wire = wires.find((w) => w.position === i);
                            const colorInfo = wire ? WIRE_COLORS[wire.color as keyof typeof WIRE_COLORS] : null;
                            return (
                              <div
                                key={i}
                                className="w-12 h-32 rounded"
                                style={{
                                  backgroundColor: colorInfo?.bg || "#ccc",
                                  border: `3px solid ${colorInfo?.border || "#999"}`,
                                }}
                              />
                            );
                          })}
                        </div>
                        <Button
                          onClick={handleAttachRJ45}
                          size="lg"
                          className="bg-orange-600 hover:bg-orange-700"
                          disabled={selectedTool !== "rj45"}
                        >
                          <Cable className="w-5 h-5 mr-2" />
                          Attach RJ45 Connector
                        </Button>
                      </div>
                    )}

                    {/* Step 4: Crimping */}
                    {step === 4 && (
                      <div className="text-center space-y-6">
                        <div className="relative">
                          <div className="flex justify-center gap-2">
                            {[...Array(8)].map((_, i) => {
                              const wire = wires.find((w) => w.position === i);
                              const colorInfo = wire ? WIRE_COLORS[wire.color as keyof typeof WIRE_COLORS] : null;
                              return (
                                <div
                                  key={i}
                                  className="w-12 h-32 rounded"
                                  style={{
                                    backgroundColor: colorInfo?.bg || "#ccc",
                                    border: `3px solid ${colorInfo?.border || "#999"}`,
                                  }}
                                />
                              );
                            })}
                          </div>
                          <div className="mt-4 w-full h-16 bg-gradient-to-b from-gray-300 to-gray-400 rounded-lg border-4 border-gray-500 flex items-center justify-center">
                            <span className="text-sm font-bold text-gray-700">RJ45 Connector</span>
                          </div>
                        </div>

                        {!crimped ? (
                          <Button
                            onClick={handleCrimp}
                            size="lg"
                            className="bg-purple-600 hover:bg-purple-700"
                            disabled={selectedTool !== "crimper"}
                          >
                            <Wrench className="w-5 h-5 mr-2" />
                            Crimp Cable
                          </Button>
                        ) : (
                          <div className="bg-green-100 border-2 border-green-500 rounded-lg p-6">
                            <Trophy className="w-16 h-16 mx-auto text-green-600 mb-4" />
                            <h3 className="text-xl font-bold text-green-800 mb-2">
                              Challenge Complete! 🎉
                            </h3>
                            <p className="text-green-700">
                              {cableType === "straight" ? "Straight Through" : cableType === "crossover" ? "Crossover" : "Rollover"} cable created successfully with {standard} standard
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel - Controls */}
            <div className="col-span-3">
              <div className="space-y-4">
                <Card className="border-gray-200">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-4">Cable Configuration</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-gray-700 mb-2 block">
                          Cable Type
                        </label>
                        <div className="space-y-2">
                          {CABLE_TYPES.map((type) => (
                            <button
                              key={type.id}
                              onClick={() => setCableType(type.id)}
                              className={`w-full p-2 rounded-lg border-2 text-sm transition-all ${
                                cableType === type.id
                                  ? "border-blue-500 bg-blue-50 font-semibold"
                                  : "border-gray-300 hover:border-blue-300"
                              }`}
                            >
                              {type.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-700 mb-2 block">
                          Wiring Standard
                        </label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setStandard("T568A")}
                            className={`flex-1 p-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                              standard === "T568A"
                                ? "border-green-500 bg-green-50"
                                : "border-gray-300 hover:border-green-300"
                            }`}
                          >
                            T568A
                          </button>
                          <button
                            onClick={() => setStandard("T568B")}
                            className={`flex-1 p-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                              standard === "T568B"
                                ? "border-orange-500 bg-orange-50"
                                : "border-gray-300 hover:border-orange-300"
                            }`}
                          >
                            T568B
                          </button>
                        </div>
                      </div>

                      {step >= 2 && step < 4 && (
                        <div>
                          <Button
                            onClick={() => setShowGuide(!showGuide)}
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            {showGuide ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                            {showGuide ? "Hide" : "Show"} Guide
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-blue-900 mb-2 text-sm">
                      Instructions
                    </h3>
                    <p className="text-xs text-blue-800 leading-relaxed">
                      {getInstructions()}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-gray-200">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-3 text-sm">
                      {standard} Color Order
                    </h3>
                    <div className="space-y-1">
                      {STANDARDS[standard].map((color, index) => {
                        const colorInfo = WIRE_COLORS[color as keyof typeof WIRE_COLORS];
                        return (
                          <div key={index} className="flex items-center gap-2 text-xs">
                            <span className="font-medium text-gray-600 w-4">{index + 1}.</span>
                            <div
                              className="w-4 h-4 rounded border-2"
                              style={{
                                backgroundColor: colorInfo.bg,
                                borderColor: colorInfo.border,
                              }}
                            />
                            <span className="text-gray-700">{colorInfo.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
