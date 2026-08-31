import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SubmissionResultsDialog } from "@/components/common/SubmissionResultsDialog";
import { useChallengeAttempt } from "@/features/content/useChallengeAttempt";

/**
 * Terminating an RJ45 plug, the way it is actually done: cut the cable, strip
 * the jacket, untwist the pairs, lay them in order, trim them flush, seat them
 * in the connector, crimp it, and test the result.
 *
 * The work happens on the cable itself. Pick up a tool and the pointer becomes
 * that tool; the part of the cable it applies to is what you click. Nothing is
 * done from a button on the side.
 *
 * The challenge is the source of truth for the title, the instructions and the
 * standard being wired to. The student still picks the standard themselves,
 * because getting that choice right is part of the work.
 */

const WIRE_COLORS = {
  "white-orange": { bg: "#FFE9D2", stripe: "#FF8C00", label: "W/Orange" },
  orange: { bg: "#FF8C00", stripe: "#CC6600", label: "Orange" },
  "white-green": { bg: "#E2FBE2", stripe: "#12A012", label: "W/Green" },
  blue: { bg: "#1E63E9", stripe: "#12439E", label: "Blue" },
  "white-blue": { bg: "#DCE9FF", stripe: "#1E63E9", label: "W/Blue" },
  green: { bg: "#12A012", stripe: "#0B7A0B", label: "Green" },
  "white-brown": { bg: "#F3E7D8", stripe: "#8B5A2B", label: "W/Brown" },
  brown: { bg: "#8B5A2B", stripe: "#63401E", label: "Brown" },
} as const;

type WireColor = keyof typeof WIRE_COLORS;

const STANDARDS: Record<"T568A" | "T568B", WireColor[]> = {
  T568A: ["white-green", "green", "white-orange", "blue", "white-blue", "orange", "white-brown", "brown"],
  T568B: ["white-orange", "orange", "white-green", "blue", "white-blue", "green", "white-brown", "brown"],
};

/** The four twisted pairs, as they come out of the jacket. */
const PAIRS: { name: string; wires: [WireColor, WireColor] }[] = [
  { name: "Orange", wires: ["white-orange", "orange"] },
  { name: "Green", wires: ["white-green", "green"] },
  { name: "Blue", wires: ["blue", "white-blue"] },
  { name: "Brown", wires: ["white-brown", "brown"] },
];

/** The rows the four pairs sit on inside the jacket. */
const PAIR_Y = [102, 116, 130, 144];

type ToolId = "cutter" | "stripper" | "crimper" | "tester";

const STEPS = [
  { id: 1, title: "Cut", tool: "cutter", instruction: "Take the cutters and click the cut line on the cable." },
  { id: 2, title: "Strip", tool: "stripper", instruction: "With the stripper, click the end of the jacket and pull it off." },
  { id: 3, title: "Untwist", tool: null, instruction: "Click each twisted pair on the cable to separate and straighten it." },
  { id: 4, title: "Arrange", tool: null, instruction: "Drag the eight wires into the pin order your standard calls for." },
  { id: 5, title: "Trim", tool: "cutter", instruction: "Click the ragged wire ends with the cutters to trim them flush." },
  { id: 6, title: "Insert", tool: null, instruction: "Click the connector to slide the bundle in, pins facing up." },
  { id: 7, title: "Crimp", tool: "crimper", instruction: "With the crimper, click the connector to press the pins home." },
  { id: 8, title: "Test", tool: "tester", instruction: "Plug it into the tester and click it to run the pins one by one." },
] as const;

/* ============================================================
   TOOL CURSORS

   Small vector tools drawn as the pointer, so the tool in hand is the
   tool you see. The hotspot sits on each one's working edge.
   ============================================================ */

const TOOL_CURSORS: Record<ToolId, { svg: string; hotspot: [number, number] }> = {
  cutter: {
    hotspot: [4, 4],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <path d="M5 4 L20 19" stroke="#334155" stroke-width="3" stroke-linecap="round"/>
      <path d="M5 19 L20 4" stroke="#334155" stroke-width="3" stroke-linecap="round"/>
      <circle cx="23" cy="23" r="5" fill="none" stroke="#EF4444" stroke-width="3"/>
      <circle cx="12" cy="26" r="5" fill="none" stroke="#EF4444" stroke-width="3"/>
    </svg>`,
  },
  stripper: {
    hotspot: [4, 6],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <path d="M4 6 L16 12 L28 8" fill="none" stroke="#334155" stroke-width="3" stroke-linecap="round"/>
      <path d="M4 14 L16 12 L28 20" fill="none" stroke="#334155" stroke-width="3" stroke-linecap="round"/>
      <rect x="16" y="18" width="12" height="8" rx="3" fill="#F59E0B"/>
      <circle cx="10" cy="10" r="2" fill="#94A3B8"/>
    </svg>`,
  },
  crimper: {
    hotspot: [5, 5],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect x="3" y="4" width="16" height="7" rx="2" fill="#334155"/>
      <rect x="3" y="13" width="16" height="7" rx="2" fill="#475569"/>
      <path d="M19 7 L29 14" stroke="#1D4ED8" stroke-width="4" stroke-linecap="round"/>
      <path d="M19 17 L29 24" stroke="#1D4ED8" stroke-width="4" stroke-linecap="round"/>
    </svg>`,
  },
  tester: {
    hotspot: [6, 4],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect x="6" y="3" width="16" height="24" rx="3" fill="#1F2937"/>
      <circle cx="11" cy="9" r="2.2" fill="#22C55E"/>
      <circle cx="17" cy="9" r="2.2" fill="#EF4444"/>
      <rect x="9" y="14" width="10" height="9" rx="2" fill="#4B5563"/>
      <path d="M22 15 L29 15" stroke="#9CA3AF" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
  },
};

const TOOLS: { id: ToolId; label: string }[] = [
  { id: "cutter", label: "Cutters" },
  { id: "stripper", label: "Stripper" },
  { id: "crimper", label: "Crimper" },
  { id: "tester", label: "Tester" },
];

function cursorFor(tool: ToolId | null): string {
  if (!tool) return "default";

  const { svg, hotspot } = TOOL_CURSORS[tool];

  return `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " "))}") ${hotspot[0]} ${hotspot[1]}, crosshair`;
}

interface Wire {
  id: string;
  color: WireColor;
  /** Pin slot 0-7, or null while still loose. */
  position: number | null;
}

/** Per-pin verdict from the tester: nothing yet, continuity, or a fault. */
type PinResult = null | "ok" | "bad";

/* ============================================================
   PIECES
   ============================================================ */

function WireBody({ color, className = "" }: { color: WireColor; className?: string }) {
  const paint = WIRE_COLORS[color];
  const striped = color.startsWith("white-");

  return (
    <div
      className={`rounded-full shadow-sm ${className}`}
      style={{
        background: striped
          ? `repeating-linear-gradient(135deg, ${paint.bg} 0 7px, ${paint.stripe} 7px 12px)`
          : paint.bg,
        border: `2px solid ${paint.stripe}`,
      }}
    />
  );
}

function DraggableWire({ wire }: { wire: Wire }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "wire",
    item: { id: wire.id },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }));

  return (
    <div
      ref={drag}
      title={WIRE_COLORS[wire.color].label}
      className={`cursor-grab active:cursor-grabbing transition-transform ${
        isDragging ? "opacity-40 scale-95" : "hover:-translate-y-0.5"
      }`}
    >
      <WireBody color={wire.color} className="w-9 h-20" />
      <p className="text-[10px] text-center text-gray-600 mt-1 w-9 leading-tight">
        {WIRE_COLORS[wire.color].label}
      </p>
    </div>
  );
}

function PinSlot({
  position,
  wire,
  onDrop,
  onClear,
  guide,
  verdict,
}: {
  position: number;
  wire: Wire | null;
  onDrop: (wireId: string, position: number) => void;
  onClear: (wireId: string) => void;
  guide: WireColor | null;
  verdict: "correct" | "wrong" | null;
}) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: "wire",
    drop: (item: { id: string }) => onDrop(item.id, position),
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  }));

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        ref={drop}
        onDoubleClick={() => wire && onClear(wire.id)}
        className={`w-11 h-24 rounded-lg border-2 border-dashed flex items-center justify-center transition-all ${
          isOver ? "border-blue-500 bg-blue-50 scale-105" : "border-gray-300 bg-gray-50"
        } ${verdict === "correct" ? "border-green-500 border-solid bg-green-50" : ""} ${
          verdict === "wrong" ? "border-red-400 border-solid bg-red-50" : ""
        }`}
      >
        {wire ? (
          <WireBody color={wire.color} className="w-7 h-20" />
        ) : guide ? (
          <WireBody color={guide} className="w-7 h-20 opacity-25" />
        ) : null}
      </div>
      <span className="text-[11px] font-semibold text-gray-500 tabular-nums">
        {position + 1}
      </span>
    </div>
  );
}

/* ============================================================
   THE BENCH

   One SVG that reads the run of state, so each step visibly builds on
   the last. Every action is a click on the part of the cable it applies
   to; `hint` pulses whatever the current step wants next.
   ============================================================ */

function Bench({
  cut,
  stripped,
  untwisted,
  seated,
  trimmed,
  inserted,
  crimped,
  pinResults,
  probing,
  step,
  onCut,
  onStrip,
  onUntwist,
  onTrim,
  onInsert,
  onCrimp,
  onTest,
}: {
  cut: boolean;
  stripped: boolean;
  untwisted: number;
  seated: WireColor[];
  trimmed: boolean;
  inserted: boolean;
  crimped: boolean;
  pinResults: PinResult[];
  probing: number;
  step: number;
  onCut: () => void;
  onStrip: () => void;
  onUntwist: (index: number) => void;
  onTrim: () => void;
  onInsert: () => void;
  onCrimp: () => void;
  onTest: () => void;
}) {
  const jacketEnd = stripped ? 150 : cut ? 250 : 300;

  /** Where each colour sits as it leaves the jacket, by pair. */
  const homeY = (color: WireColor): number => {
    const pairIndex = PAIRS.findIndex((pair) => pair.wires.includes(color));
    const wireIndex = PAIRS[pairIndex].wires.indexOf(color);

    return PAIR_Y[pairIndex] + (wireIndex ? 6 : -6);
  };

  /** The lane a wire runs in once it is laid in pin order. */
  const laneY = (index: number): number => 94 + index * 8;

  return (
    <svg viewBox="0 0 620 250" className="w-full select-none">
      <style>{`
        @keyframes hintPulse {
          0%, 100% { opacity: .18; }
          50% { opacity: .5; }
        }
        .hint { animation: hintPulse 1.4s ease-in-out infinite; }
        @keyframes jaws {
          0%, 100% { transform: translateY(0); }
          45% { transform: translateY(9px); }
        }
        .crimping { animation: jaws .45s ease-in-out 2; }
      `}</style>

      {/* ---- The four pairs, drawn first so the jacket mouth caps them
              and they read as coming out of the cable ----------------- */}
      {stripped &&
        PAIRS.map((pair, index) => {
          const done = index < untwisted;
          const y = PAIR_Y[index];
          const isNext = index === untwisted && step === 3;
          // Tucked back under the jacket so there is no gap at the mouth.
          const from = jacketEnd - 16;

          return (
            <g
              key={pair.name}
              onClick={() => !done && onUntwist(index)}
              style={{ cursor: done ? "default" : "pointer" }}
            >
              {/* Behind the wires: a highlight painted over them would
                  wash the colours out, and the colours are the lesson. */}
              {isNext && (
                <rect
                  x={from}
                  y={y - 16}
                  width="180"
                  height="32"
                  rx="12"
                  fill="#2563EB"
                  className="hint"
                  opacity="0.2"
                />
              )}

              {pair.wires.map((color, wireIndex) => {
                const offset = wireIndex ? 6 : -6;

                return (
                  <path
                    key={color}
                    d={
                      done
                        ? `M ${from} ${y + offset} L 320 ${y + offset}`
                        : `M ${from} ${y} q 17 ${wireIndex ? 11 : -11} 34 0 q 17 ${
                            wireIndex ? -11 : 11
                          } 34 0 q 17 ${wireIndex ? 11 : -11} 34 0 q 17 ${
                            wireIndex ? -11 : 11
                          } 34 0 q 17 ${wireIndex ? 11 : -11} 34 0`
                    }
                    stroke={WIRE_COLORS[color].bg}
                    strokeWidth="8"
                    strokeLinecap="round"
                    fill="none"
                    style={{ transition: "d 550ms ease" }}
                  />
                );
              })}

            </g>
          );
        })}

      {/* ---- Wires laid in pin order --------------------------------
              Each runs from where it leaves the jacket, fans across to
              its lane, and ends at the plug: one continuous run. */}
      {seated.length > 0 && (
        <g
          onClick={step === 5 ? onTrim : undefined}
          style={{ cursor: step === 5 ? "inherit" : "default" }}
        >
          {seated.map((color, index) => {
            const y0 = homeY(color);
            const y1 = laneY(index);
            const endX = inserted ? 492 : trimmed ? 462 : 430 + (index % 4) * 14;

            return (
              <path
                key={index}
                d={`M ${jacketEnd - 16} ${y0} C ${jacketEnd + 70} ${y0}, 320 ${y1}, 384 ${y1} L ${endX} ${y1}`}
                stroke={WIRE_COLORS[color].bg}
                strokeWidth="8"
                strokeLinecap="round"
                fill="none"
                style={{ transition: "d 450ms ease" }}
              />
            );
          })}

          {step === 5 && !trimmed && (
            <>
              <rect x="424" y="80" width="60" height="90" rx="10" fill="#EF4444" className="hint" opacity="0.18" />
              <text x="454" y="72" textAnchor="middle" fontSize="11" fill="#B91C1C" fontWeight="600">
                trim flush
              </text>
            </>
          )}
        </g>
      )}

      {/* ---- The cable jacket, over the wire roots ------------------- */}
      <rect
        x="0"
        y="84"
        width={jacketEnd}
        height="72"
        rx="36"
        fill="#9AA3AE"
        style={{ transition: "width 600ms ease" }}
      />
      {/* A lighter band along the top reads as the sheen on grey PVC. */}
      <rect
        x="14"
        y="100"
        width={Math.max(jacketEnd - 28, 0)}
        height="14"
        rx="7"
        fill="#C4CBD4"
        style={{ transition: "width 600ms ease" }}
      />

      {/* The mouth the wires emerge from, once the jacket is stripped. */}
      {stripped && (
        <rect x={jacketEnd - 16} y="82" width="18" height="76" rx="9" fill="#79838F" />
      )}

      {/* Step 1: the cut line, clicked with the cutters. */}
      {!cut && (
        <g onClick={onCut} style={{ cursor: "inherit" }}>
          <line x1="252" y1="68" x2="252" y2="172" stroke="#EF4444" strokeWidth="2" strokeDasharray="6 5" />
          <rect x="232" y="68" width="40" height="104" fill="#EF4444" className={step === 1 ? "hint" : ""} opacity="0.18" />
          <text x="252" y="60" textAnchor="middle" fontSize="11" fill="#B91C1C" fontWeight="600">
            cut here
          </text>
        </g>
      )}

      {/* Step 2: the jacket end, peeled back with the stripper. */}
      {cut && !stripped && (
        <g onClick={onStrip} style={{ cursor: "inherit" }}>
          <rect x="150" y="78" width="104" height="84" rx="14" fill="#38BDF8" className={step === 2 ? "hint" : ""} opacity="0.2" />
          <text x="202" y="70" textAnchor="middle" fontSize="11" fill="#0369A1" fontWeight="600">
            strip this end
          </text>
        </g>
      )}

      {/* ---- The connector, lying flat with its tip to the right ----- */}
      {trimmed && (
        <g
          onClick={step === 6 ? onInsert : step === 7 ? onCrimp : undefined}
          style={{
            transform: `translateX(${inserted ? 0 : 76}px)`,
            transition: "transform 750ms cubic-bezier(.2,.8,.2,1)",
            cursor: step === 6 || step === 7 ? "inherit" : "default",
          }}
        >
          {(step === 6 || step === 7) && (
            <rect x="386" y="60" width="146" height="120" rx="14" fill="#2563EB" className="hint" opacity="0.18" />
          )}

          {/* The latch, standing off the back of the plug. */}
          <path
            d="M 410 84 L 420 70 L 452 70 L 458 84 Z"
            fill="#C3DDF0"
            fillOpacity="0.7"
            stroke="#7FA8CC"
            strokeWidth="3"
            strokeLinejoin="round"
          />

          {/* Body, then the nose the socket receives. */}
          <rect
            x="392"
            y="84"
            width="118"
            height="78"
            rx="9"
            fill="#D7E9F7"
            fillOpacity="0.45"
            stroke="#7FA8CC"
            strokeWidth="3"
          />
          <rect
            x="508"
            y="100"
            width="16"
            height="46"
            rx="5"
            fill="#C3DDF0"
            fillOpacity="0.6"
            stroke="#7FA8CC"
            strokeWidth="3"
          />

          {/* Eight gold contacts at the tip end, one per lane. Pressed in
              by the crimp, then lit by the tester. */}
          {Array.from({ length: 8 }).map((_, index) => (
            <rect
              key={index}
              x={crimped ? 480 : 484}
              y={laneY(index) - 3}
              width={crimped ? 18 : 12}
              height="6"
              rx="2"
              fill={
                pinResults[index] === "ok"
                  ? "#22C55E"
                  : pinResults[index] === "bad"
                    ? "#EF4444"
                    : "#E0B23C"
              }
              style={{ transition: "x 220ms ease, width 220ms ease, fill 160ms ease" }}
            />
          ))}

          {/* The crimper closing over the plug. */}
          {crimped && (
            <g className="crimping">
              <rect x="386" y="58" width="130" height="16" rx="7" fill="#475569" />
            </g>
          )}
        </g>
      )}

      {/* ---- The tester -------------------------------------------- */}
      {crimped && (
        <g onClick={step === 8 ? onTest : undefined} style={{ cursor: step === 8 ? "inherit" : "default" }}>
          {step === 8 && probing === 0 && !pinResults.some(Boolean) && (
            <rect x="30" y="172" width="230" height="72" rx="12" fill="#22C55E" className="hint" opacity="0.18" />
          )}

          <rect x="36" y="176" width="218" height="66" rx="10" fill="#1F2937" />
          <text x="48" y="195" fontSize="11" fill="#9CA3AF" fontWeight="600">
            CONTINUITY
          </text>

          {Array.from({ length: 8 }).map((_, index) => (
            <g key={index}>
              <circle
                cx={56 + index * 25}
                cy="214"
                r="8"
                fill={
                  pinResults[index] === "ok"
                    ? "#22C55E"
                    : pinResults[index] === "bad"
                      ? "#EF4444"
                      : "#374151"
                }
                stroke={probing === index + 1 ? "#F8FAFC" : "none"}
                strokeWidth="2"
                style={{ transition: "fill 160ms ease" }}
              />
              <text x={56 + index * 25} y="236" textAnchor="middle" fontSize="9" fill="#9CA3AF">
                {index + 1}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

/* ============================================================
   THE PAGE
   ============================================================ */

/**
 * The cable-wiring route.
 *
 * Owns the DndProvider its bench and pin slots need. Mounted here rather than
 * app-wide so react-dnd travels with this route's chunk — a student who never
 * opens a simulator never downloads it.
 */
export function CableWiringChallenge() {
  return (
    <DndProvider backend={HTML5Backend}>
      <CableWiringBench />
    </DndProvider>
  );
}

function CableWiringBench() {
  const navigate = useNavigate();
  const attempt = useChallengeAttempt();

  const [step, setStep] = useState(1);
  const [cut, setCut] = useState(false);
  const [stripped, setStripped] = useState(false);
  const [untwisted, setUntwisted] = useState(0);
  const [wires, setWires] = useState<Wire[]>(
    PAIRS.flatMap((pair) => pair.wires).map((color) => ({ id: color, color, position: null })),
  );
  const [trimmed, setTrimmed] = useState(false);
  const [inserted, setInserted] = useState(false);
  const [crimped, setCrimped] = useState(false);

  const [pinResults, setPinResults] = useState<PinResult[]>(Array(8).fill(null));
  const [probing, setProbing] = useState(0);
  /** Shown when the tester finds all eight pins good. */
  const [passedTest, setPassedTest] = useState(false);

  const [tool, setTool] = useState<ToolId | null>(null);
  const [standard, setStandard] = useState<"T568A" | "T568B">("T568B");
  const [showGuide, setShowGuide] = useState(false);
  const [checked, setChecked] = useState(false);

  const target = STANDARDS[standard];
  const cableKind = attempt.challenge?.config?.cable ?? "straight";

  const laid = Array.from({ length: 8 }, (_, position) =>
    wires.find((wire) => wire.position === position),
  );
  const allLaid = laid.every(Boolean);
  const orderCorrect = laid.every((wire, index) => wire?.color === target[index]);
  const seated = laid.filter(Boolean).map((wire) => wire!.color);
  const loose = wires.filter((wire) => wire.position === null);

  const current = STEPS[step - 1];

  /** The step's tool has to be in hand before its part of the cable responds. */
  const withTool = (needed: ToolId, action: () => void) => {
    if (tool !== needed) {
      toast.error(`Pick up the ${TOOLS.find((t) => t.id === needed)?.label} first`);
      return;
    }

    action();
  };

  const advance = () => setStep((previous) => Math.min(previous + 1, STEPS.length));

  const handleCut = () =>
    withTool("cutter", () => {
      setCut(true);
      toast.success("Cable cut cleanly.");
      advance();
    });

  const handleStrip = () =>
    withTool("stripper", () => {
      setStripped(true);
      toast.success("Jacket off — four twisted pairs inside.");
      advance();
    });

  const handleUntwist = (index: number) => {
    if (step !== 3) return;

    if (index !== untwisted) {
      toast.error("Work through the pairs in order.");
      return;
    }

    const next = untwisted + 1;
    setUntwisted(next);

    if (next === PAIRS.length) {
      toast.success("All four pairs separated and straightened.");
      advance();
    }
  };

  const handleTrim = () =>
    withTool("cutter", () => {
      setTrimmed(true);
      toast.success("Ends trimmed flush and even.");
      advance();
    });

  const handleInsert = () => {
    setInserted(true);
    toast.success("Bundle seated — every wire is against the front of the plug.");
    advance();
  };

  const handleCrimp = () =>
    withTool("crimper", () => {
      setCrimped(true);
      toast.success("Crimped. The pins have bitten through to the copper.");
      advance();
    });

  /**
   * The tester walks the pins one at a time, lighting green for continuity and
   * red for a wire that is not where it should be — which is exactly what the
   * student then has to go and fix.
   */
  const handleTest = () =>
    withTool("tester", () => {
      if (probing > 0) return;

      setPinResults(Array(8).fill(null));

      for (let pin = 0; pin < 8; pin++) {
        setTimeout(() => {
          setProbing(pin + 1);
          setPinResults((previous) => {
            const next = [...previous];
            next[pin] = laid[pin]?.color === target[pin] ? "ok" : "bad";

            return next;
          });
        }, pin * 260);
      }

      setTimeout(() => {
        setProbing(0);

        if (attempt.isGraded) {
          void attempt.submit({
            standard,
            cable_type: cableKind,
            order: laid.map((wire) => wire?.color ?? null),
          });

          return;
        }

        if (orderCorrect) {
          setPassedTest(true);
        } else {
          toast.error("The tester found wires out of order — see the red pins.");
        }
      }, 8 * 260 + 400);
    });

  const placeWire = (wireId: string, position: number) => {
    setChecked(false);
    setWires((previous) =>
      previous.map((wire) => {
        if (wire.position === position) return { ...wire, position: null };
        if (wire.id === wireId) return { ...wire, position };

        return wire;
      }),
    );
  };

  const clearWire = (wireId: string) => {
    setChecked(false);
    setWires((previous) =>
      previous.map((wire) => (wire.id === wireId ? { ...wire, position: null } : wire)),
    );
  };

  /**
     * Checking is a self-check, not a gate.
     *
     * A wrongly ordered cable still crimps in real life — you find out when you
     * test it. Blocking here would make the tester decorative and hide the one
     * lesson worth learning: a fault costs you the whole plug.
     */
  const handleCheckOrder = () => {
    setChecked(true);

    if (!allLaid) {
      toast.error("Every pin needs a wire.");
      return;
    }

    if (orderCorrect) {
      toast.success(`That is ${standard}. Now trim the ends.`);
    } else {
      toast.warning(
        `Those are not in ${standard} order — you can carry on, but the tester will find it.`,
      );
    }

    advance();
  };

  const reset = useCallback(() => {
    setStep(1);
    setCut(false);
    setStripped(false);
    setUntwisted(0);
    setWires((previous) => previous.map((wire) => ({ ...wire, position: null })));
    setTrimmed(false);
    setInserted(false);
    setCrimped(false);
    setPinResults(Array(8).fill(null));
    setProbing(0);
    setPassedTest(false);
    setTool(null);
    setChecked(false);
  }, []);

  // A retry opens a fresh attempt, so the bench has to be fresh too — nobody
  // should be able to re-test a cable they crimped for the previous one.
  useEffect(() => {
    reset();
  }, [attempt.attemptId, reset]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <SubmissionResultsDialog
        results={attempt.results}
        passed={attempt.passed}
        onClose={attempt.dismissResults}
        onTryAgain={attempt.tryAgain}
        retrying={attempt.retrying}
        onBack={() => navigate("/challenges")}
      />

      {/* A clean tester run deserves saying so. In a graded run the marked
          result follows straight after, so this only stands on its own in
          practice. */}
      <Dialog open={passedTest} onOpenChange={(open) => !open && setPassedTest(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              All eight pins pass
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-gray-600">
            Every pin has continuity and the wires are in {standard} order — this
            is a good {cableKind === "straight" ? "straight-through" : cableKind}{" "}
            cable, ready to use.
          </p>

          <div className="flex gap-1.5 justify-center py-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex flex-col items-center gap-1">
                <span className="w-5 h-5 rounded-full bg-green-500" />
                <span className="text-[10px] text-gray-500 tabular-nums">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPassedTest(false);
                reset();
              }}
            >
              Make another
            </Button>
            <Button onClick={() => navigate("/challenges")}>
              Back to Challenges
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/challenges")}
          className="mb-3 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Challenges
        </Button>

        <div className="flex items-start justify-between gap-6 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {attempt.challenge?.title ?? "Terminate an RJ45 cable"}
            </h1>
            <p className="text-sm text-gray-600 max-w-2xl mt-1">
              {attempt.challenge?.description ??
                "Make a patch lead from bare cable: cut, strip, sort, crimp and test."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Start over
          </Button>
        </div>

        <Progress value={(step / STEPS.length) * 100} className="h-2 mb-3" />
        <div className="flex flex-wrap gap-2 mb-4">
          {STEPS.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                entry.id === step
                  ? "bg-blue-600 text-white border-blue-600"
                  : entry.id < step
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-white text-gray-400 border-gray-200"
              }`}
            >
              {entry.id < step ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <span className="tabular-nums">{entry.id}</span>
              )}
              {entry.title}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-4 gap-4">
          <Card className="lg:col-span-3 border-gray-200">
            <CardContent className="p-6">
              <div className="mb-3">
                <h2 className="font-bold text-gray-900">
                  Step {step}: {current.title}
                </h2>
                <p className="text-sm text-gray-600">{current.instruction}</p>
              </div>

              {/* The bench. The pointer is whatever tool is in hand. */}
              <div
                className="bg-white rounded-xl border border-gray-200 p-3"
                style={{ cursor: cursorFor(tool) }}
              >
                <Bench
                  cut={cut}
                  stripped={stripped}
                  untwisted={untwisted}
                  seated={seated}
                  trimmed={trimmed}
                  inserted={inserted}
                  crimped={crimped}
                  pinResults={pinResults}
                  probing={probing}
                  step={step}
                  onCut={handleCut}
                  onStrip={handleStrip}
                  onUntwist={handleUntwist}
                  onTrim={handleTrim}
                  onInsert={handleInsert}
                  onCrimp={handleCrimp}
                  onTest={handleTest}
                />
              </div>

              {/* Step 4 is the one bit of bench work that is not on the cable:
                  the wires get laid into numbered pins. */}
              {step === 4 && (
                <div className="space-y-4 mt-4">
                  <div className="flex items-end justify-between gap-3 flex-wrap">
                    <div className="flex gap-2">
                      {(["T568A", "T568B"] as const).map((option) => (
                        <button
                          key={option}
                          onClick={() => {
                            setStandard(option);
                            setChecked(false);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                            standard === option
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowGuide((previous) => !previous)}
                    >
                      {showGuide ? (
                        <EyeOff className="w-4 h-4 mr-2" />
                      ) : (
                        <Eye className="w-4 h-4 mr-2" />
                      )}
                      {showGuide ? "Hide" : "Show"} guide
                    </Button>
                  </div>

                  <div className="flex gap-2 justify-center flex-wrap">
                    {Array.from({ length: 8 }).map((_, position) => (
                      <PinSlot
                        key={position}
                        position={position}
                        wire={laid[position] ?? null}
                        onDrop={placeWire}
                        onClear={clearWire}
                        guide={showGuide ? target[position] : null}
                        verdict={
                          checked && laid[position]
                            ? laid[position]!.color === target[position]
                              ? "correct"
                              : "wrong"
                            : null
                        }
                      />
                    ))}
                  </div>

                  {loose.length > 0 && (
                    <div className="border-t border-gray-200 pt-3">
                      <p className="text-xs font-semibold text-gray-500 mb-2">
                        Loose wires — drag them into the pins
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {loose.map((wire) => (
                          <DraggableWire key={wire.id} wire={wire} />
                        ))}
                      </div>
                    </div>
                  )}

                  <Button onClick={handleCheckOrder} className="w-full">
                    {checked && !orderCorrect
                      ? "Carry on anyway"
                      : "Check the order"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Toolbox */}
          <div className="space-y-4">
            <Card className="border-gray-200">
              <CardContent className="p-4">
                <h3 className="font-bold text-gray-900 mb-1 text-sm">Toolbox</h3>
                <p className="text-[11px] text-gray-500 mb-3">
                  Pick one up, then use it on the cable.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {TOOLS.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => setTool(tool === entry.id ? null : entry.id)}
                      className={`rounded-lg border-2 p-3 flex flex-col items-center gap-1.5 transition-all ${
                        tool === entry.id
                          ? "border-blue-500 bg-blue-50 scale-105"
                          : "border-gray-200 bg-white hover:border-blue-300"
                      } ${current.tool === entry.id ? "ring-2 ring-blue-200" : ""}`}
                      style={{ cursor: cursorFor(entry.id) }}
                    >
                      <span
                        className="w-8 h-8 bg-center bg-no-repeat bg-contain"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
                            TOOL_CURSORS[entry.id].svg.replace(/\s+/g, " "),
                          )}")`,
                        }}
                      />
                      <span className="text-[11px] font-semibold text-gray-700">
                        {entry.label}
                      </span>
                    </button>
                  ))}
                </div>

                {current.tool ? (
                  <p className="text-[11px] text-gray-500 mt-3">
                    This step needs the{" "}
                    <span className="font-semibold">
                      {TOOLS.find((t) => t.id === current.tool)?.label}
                    </span>
                    .
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-500 mt-3">
                    No tool for this step — use your hands.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* The tester's own readout, once there is one. */}
            {pinResults.some(Boolean) && (
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <h3 className="font-bold text-gray-900 mb-2 text-sm">Tester</h3>
                  <ul className="space-y-1">
                    {pinResults.map((result, index) => (
                      <li
                        key={index}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-gray-500 tabular-nums">
                          Pin {index + 1}
                        </span>
                        <span
                          className={
                            result === "ok"
                              ? "text-green-600 font-semibold"
                              : result === "bad"
                                ? "text-red-600 font-semibold"
                                : "text-gray-300"
                          }
                        >
                          {result === "ok" ? "pass" : result === "bad" ? "fault" : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {!attempt.isGraded && (
              <p className="text-[11px] text-gray-400 px-1">
                Practice mode — open this from Challenges to have it marked.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
