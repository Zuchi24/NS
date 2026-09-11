import { memo } from "react";

import { CONTACT_LINE, FRONT_STOP, NATURAL_ORDER, RELIEF_CLAMP, jacketedLengthMm, maxExposed, minExposed, tipInPlug } from "../../model";
import type { CableEnd, CableState, Scenario } from "../../model";

/**
 * The numbers behind the picture, straight from the model. Every value is in
 * millimetres and is a model value — none is measured off the drawing.
 *
 * Worded for a student rather than in the model's terms: "jacket removed from
 * this end" is the jacket-edge position, "bare conductor" the exposed length,
 * and depths inside the plug are counted from its back, with the plug's own
 * landmarks spelled out underneath.
 *
 * Memoised: re-renders only when the cable or scenario change.
 */
export const MeasurementsPanel = memo(function MeasurementsPanel({ cable, scenario }: { cable: CableState; scenario: Scenario }) {
  const rows: { id: string; label: string; value: (end: CableEnd) => string }[] = [
    { id: "jacket", label: "Jacket removed from this end", value: (end) => `${end.jacketEdgeMm} mm` },
    { id: "exposed", label: "Bare conductor beyond the jacket", value: exposedText },
    { id: "plug", label: "Plug", value: plugText },
    { id: "seat", label: "Jacket inside the plug", value: seatText },
    { id: "depth", label: "Conductor tips inside the plug", value: depthText },
  ];

  return (
    <section aria-labelledby="measurements-heading" className="rounded-lg border border-slate-200 bg-white p-3">
      <h2 id="measurements-heading" className="mb-1.5 text-sm font-semibold text-slate-800">
        Measurements
      </h2>
      <p className="mb-1.5 text-xs text-slate-700">
        Cable, jacket to jacket:{" "}
        <strong className="font-mono tabular-nums" data-testid="cable-length">
          {jacketedLengthMm(cable, scenario)} mm
        </strong>{" "}
        <span className="text-slate-500">of {scenario.startLengthMm} mm</span>
      </p>
      <table className="w-full table-fixed text-[11px]">
        <colgroup>
          <col className="w-[44%]" />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr className="text-slate-500">
            <th className="text-left font-medium" />
            <th className="font-medium">End A</th>
            <th className="font-medium">End B</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ id, label, value }) => (
            <tr key={id} className="border-t border-slate-100 align-top">
              <th scope="row" className="py-1 pr-2 text-left font-normal text-slate-700">
                {label}
              </th>
              {(["A", "B"] as const).map((end) => (
                <td key={end} className="px-1 py-1 text-center tabular-nums text-slate-900" data-testid={`measure-${end}-${id}`}>
                  {value(cable.ends[end])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
        Depths inside the plug are counted from its back: the strain relief grips the jacket from {RELIEF_CLAMP} mm, the
        blades sit at {CONTACT_LINE} mm and the front face is at {FRONT_STOP} mm.
      </p>
    </section>
  );
});

function exposedText(end: CableEnd): string {
  const most = maxExposed(end);
  const least = minExposed(end);

  if (most === 0) return "none";

  return most === least ? `${most} mm` : `${least}–${most} mm`;
}

function plugText(end: CableEnd): string {
  if (!end.plug) return "none";

  const face = end.plug.orientation === "contacts-up" ? "contacts up" : "contacts down";
  const crimp = { none: "not crimped", partial: "half crimped", full: "crimped" }[end.plug.crimp];

  return `${face}, ${crimp}`;
}

function seatText(end: CableEnd): string {
  if (!end.plug) return "—";

  const { jacketInMm } = end.plug;
  if (jacketInMm > 0) return `${jacketInMm} mm`;
  if (jacketInMm === 0) return "level with the back";

  return `${-jacketInMm} mm short of the plug`;
}

function depthText(end: CableEnd): string {
  if (!end.plug) return "—";

  const depths = NATURAL_ORDER.map((conductor) => tipInPlug(end, conductor)!);
  const most = Math.max(...depths);
  const least = Math.min(...depths);

  return most === least ? `${most} mm` : `${least}–${most} mm`;
}
