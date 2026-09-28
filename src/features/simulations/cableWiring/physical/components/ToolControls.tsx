import type { ReactNode } from "react";

import type { PhysicalAssist, PhysicalScenario } from "../../integration/publicConfig";
import { JACKET_STOP, MAX_STRIP_PASS, PAIR_IDS, T568A, T568B } from "../../model";
import type { Action, CableEnd, Conductor, EndId, Orientation, StripSlot } from "../../model";
import { PAIR_LABEL, endLabel, endPhrase, endpointLabel, jacketWords, orientationWords } from "../messages";
import { PAIR_PAINT } from "../paint";
import type { ToolId } from "../tools";
import { ConductorStrip } from "./ConductorStrip";

/**
 * The controls for whichever tool is out. Each control only sets up an action
 * and sends it; whether the action is possible is the model's call, and its
 * answer comes back on the feedback line.
 */

export interface Controls {
  /** Cut this far behind the jacket edge. */
  cutMm: number;
  stripMm: number;
  slot: StripSlot;
  /** Leave this much conductor exposed. */
  trimMm: number;
  /** The jacket position inside the plug to push toward; the model stops it where the plug allows. */
  pushMm: number;
  orientation: Orientation;
  plugPicked: boolean;
  selectedConductor: Conductor | null;
}

export const DEFAULT_CONTROLS: Controls = {
  cutMm: 10,
  stripMm: 20,
  slot: "correct",
  trimMm: 20,
  pushMm: 10,
  orientation: "contacts-up",
  plugPicked: false,
  selectedConductor: null,
};

interface Props {
  tool: ToolId;
  endId: EndId;
  end: CableEnd;
  connections: Partial<Record<EndId, string>>;
  scenario: PhysicalScenario;
  /** Beginner help from the challenge's public config; null when it offers none. */
  assist: PhysicalAssist | null;
  beginner: boolean;
  controls: Controls;
  setControls: (patch: Partial<Controls>) => void;
  act: (action: Action) => void;
}

export function ToolControls({ tool, endId, end, connections, scenario, assist, beginner, controls, setControls, act }: Props) {
  const name = endLabel(endId);
  const phrase = endPhrase(endId);

  switch (tool) {
    case "cut":
      return (
        <Row>
          <Slider
            id="cut-mm"
            label="Cut behind the jacket edge"
            min={0}
            max={120}
            value={controls.cutMm}
            onChange={(cutMm) => setControls({ cutMm })}
          />
          <ActionButton onClick={() => act({ type: "cut", end: endId, atMm: end.jacketEdgeMm + controls.cutMm })}>
            Cut {phrase}
          </ActionButton>
          <Help>
            Measured back from the jacket edge — on a clean cut end, that is the end of the cable. The shaded part on the bench is what goes, a plug included.
          </Help>
        </Row>
      );

    case "strip":
      return (
        <Row>
          <fieldset className="flex items-center gap-3 text-sm">
            <legend className="sr-only">Stripper slot</legend>
            {(
              [
                ["correct", "UTP slot (Cat5e/6)"],
                ["too-deep", "Small round slot"],
              ] as const
            ).map(([slot, label]) => (
              <label key={slot} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="strip-slot"
                  checked={controls.slot === slot}
                  onChange={() => setControls({ slot })}
                  className="accent-primary"
                />
                {label}
              </label>
            ))}
          </fieldset>
          <Slider
            id="strip-mm"
            label="Strip length"
            min={1}
            max={MAX_STRIP_PASS}
            value={controls.stripMm}
            onChange={(stripMm) => setControls({ stripMm })}
          />
          <ActionButton onClick={() => act({ type: "strip", end: endId, amountMm: controls.stripMm, slot: controls.slot })}>
            Strip {phrase}
          </ActionButton>
          <Help>How much jacket to pull off, measured back from the jacket edge. The shaded jacket comes off; the conductors stay.</Help>
        </Row>
      );

    case "untwist":
      return (
        <Row>
          <div className="flex flex-wrap gap-2" role="group" aria-label={`Pairs on ${phrase}`}>
            {PAIR_IDS.map((pair) => (
              <button
                key={pair}
                type="button"
                aria-pressed={end.untwisted[pair]}
                onClick={() => act({ type: "untwist", end: endId, pair })}
                className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-slate-500 aria-pressed:border-emerald-400 aria-pressed:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="h-3 w-3 rounded-full" style={{ background: PAIR_PAINT[pair] }} aria-hidden="true" />
                Untwist {PAIR_LABEL[pair]}
                <span className="text-[11px] text-slate-500">{end.untwisted[pair] ? "· untwisted" : "· twisted"}</span>
              </button>
            ))}
          </div>
          <Help>You can also click a twisted pair on the bench.</Help>
        </Row>
      );

    case "arrange":
      return (
        <ConductorStrip
          end={end}
          selected={controls.selectedConductor}
          onSelect={(selectedConductor) => setControls({ selectedConductor })}
          onMove={(conductor, toIndex) => act({ type: "moveConductor", end: endId, conductor, toIndex })}
          reference={beginner ? referenceFor(assist, endId) : null}
        />
      );

    case "trim":
      return (
        <Row>
          <Slider
            id="trim-mm"
            label="Leave exposed"
            min={1}
            max={60}
            value={controls.trimMm}
            onChange={(trimMm) => setControls({ trimMm })}
          />
          <ActionButton onClick={() => act({ type: "trim", end: endId, leaveMm: controls.trimMm })}>
            Trim {phrase}
          </ActionButton>
          <Help>
            How much bare conductor stays beyond the jacket; the shaded ends are cut away. Trimming doesn't shorten the cable. Trim a flat fan — bunched
            pairs cut uneven.
          </Help>
        </Row>
      );

    case "insert":
      return (
        <Row>
          <fieldset className="flex items-center gap-3 text-sm">
            <legend className="sr-only">Plug orientation</legend>
            {(["contacts-up", "contacts-down"] as const).map((orientation) => (
              <label key={orientation} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="plug-orientation"
                  checked={controls.orientation === orientation}
                  onChange={() => setControls({ orientation })}
                  className="accent-primary"
                />
                {orientation === "contacts-up" ? "Contacts up" : "Contacts down"}
              </label>
            ))}
          </fieldset>
          <Slider
            id="push-mm"
            label="Push the jacket into the plug"
            min={-20}
            max={JACKET_STOP}
            value={controls.pushMm}
            onChange={(pushMm) => setControls({ pushMm })}
            display={pushWords(controls.pushMm)}
          />
          <ActionButton
            disabled={!controls.plugPicked}
            onClick={() =>
              act({ type: "insert", end: endId, orientation: controls.orientation, pushMm: controls.pushMm })
            }
          >
            Insert {phrase}
          </ActionButton>
          <ActionButton variant="secondary" onClick={() => act({ type: "push", end: endId, pushMm: controls.pushMm })}>
            Push further
          </ActionButton>
          <Help>
            {end.plug
              ? `Plug on, ${orientationWords(end.plug.orientation)}; ${jacketWords(end.plug.jacketInMm)}.`
              : controls.plugPicked
                ? "However far you push, the plug stops where the longest conductor meets its front."
                : "Pick up a plug from the tray first →"}
          </Help>
        </Row>
      );

    case "withdraw":
      return (
        <Row>
          <ActionButton onClick={() => act({ type: "withdraw", end: endId })}>Pull plug off {phrase}</ActionButton>
          <Help>An uncrimped plug comes off undamaged and goes back in the tray.</Help>
        </Row>
      );

    case "crimp":
      return (
        <Row>
          <span className="text-sm text-slate-700" data-testid="crimp-state">
            Crimp: <strong>{end.plug ? CRIMP_WORDS[end.plug.crimp] : "no plug"}</strong>
          </span>
          <ActionButton onClick={() => act({ type: "crimp", end: endId, squeeze: "full" })}>Squeeze fully</ActionButton>
          <ActionButton variant="secondary" onClick={() => act({ type: "crimp", end: endId, squeeze: "partial" })}>
            Half squeeze
          </ActionButton>
          <Help>A full squeeze drives the blades into the conductors. Once crimped at all, the plug is locked on.</Help>
        </Row>
      );

    case "connect": {
      const here = connections[endId];

      return (
        <Row>
          {scenario.endpoints.map((endpoint) => {
            const occupant = (["A", "B"] as const).find((id) => connections[id] === endpoint.id);

            return (
              <ActionButton
                key={endpoint.id}
                variant={occupant === endId ? "active" : "secondary"}
                onClick={() => act({ type: "connect", end: endId, endpoint: endpoint.id })}
              >
                Plug {phrase} into {endpointLabel(scenario, endpoint.id)}
                {occupant && (
                  <span className="text-[11px] opacity-70">
                    {" "}
                    ({occupant === endId ? "plugged in here" : `in use by ${endPhrase(occupant)}`})
                  </span>
                )}
              </ActionButton>
            );
          })}
          <ActionButton variant="secondary" onClick={() => act({ type: "disconnect", end: endId })}>
            Unplug {phrase}
          </ActionButton>
          <Help>{here ? `${name} is in ${endpointLabel(scenario, here)}.` : `${name} is not plugged in.`}</Help>
        </Row>
      );
    }
  }
}

const CRIMP_WORDS = { none: "not crimped", partial: "partial", full: "full" } as const;

/** The push target in words. The model clamps it to where the plug can actually go. */
function pushWords(pushMm: number): string {
  if (pushMm >= JACKET_STOP) return "all the way";
  if (pushMm > 0) return `${pushMm} mm inside`;
  if (pushMm === 0) return "to the plug's back";

  return `${-pushMm} mm short of the plug`;
}

/** The reference card for this end: the colour order the challenge's beginner help names, if any. */
function referenceFor(assist: PhysicalAssist | null, end: EndId) {
  const standard = assist?.reference[end];
  if (standard === undefined) return null;

  return { name: standard, order: standard === "T568A" ? T568A : T568B };
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{children}</div>;
}

function Help({ children }: { children: ReactNode }) {
  return <p className="text-xs text-slate-500">{children}</p>;
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = "primary",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "active";
}) {
  const look = {
    primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
    secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
    active: "border border-emerald-500 bg-emerald-50 text-emerald-900",
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${look}`}
    >
      {children}
    </button>
  );
}

function Slider({
  id,
  label,
  min,
  max,
  value,
  onChange,
  display,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  /** How the value reads, when "N mm" alone would not say what it means. */
  display?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor={id} className="text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-36 accent-primary"
      />
      <output htmlFor={id} className={`${display ? "min-w-14" : "w-14"} text-right font-mono text-sm tabular-nums text-slate-900`}>
        {display ?? `${value} mm`}
      </output>
    </div>
  );
}
