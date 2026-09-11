import { memo } from "react";

import { MAX_UNTWIST, inspect } from "../../model";
import type { CableState, EndInspection } from "../../model";

/**
 * What a close look at each termination shows — the model's inspect(), laid
 * out. A continuity test cannot see any of this. An end with no plug fails
 * every check because the model says so: there is nothing to inspect.
 *
 * The explanations say why a failed check matters and what usually fixes it.
 * They explain the model's result; they never produce one.
 */

const CHECKS: { key: keyof EndInspection; label: string; why: string }[] = [
  {
    key: "jacketClamped",
    label: "Jacket gripped by the strain relief",
    why: "the jacket stops short, so the strain relief clamps bare conductors and a tug can pull them loose. Shorter conductors let the jacket go further in.",
  },
  {
    key: "untwistOk",
    label: `No more than ${MAX_UNTWIST} mm untwisted`,
    why: `more than ${MAX_UNTWIST} mm of conductor is untwisted, which lets the pairs pick up interference. Trim the conductors shorter.`,
  },
  {
    key: "conductorsAtFront",
    label: "Every conductor reaches the front",
    why: "some tips stop short of the front of the plug. Trim flush on a flat fan and push the plug fully home.",
  },
  {
    key: "insulationIntact",
    label: "No nicks in the insulation",
    why: "the insulation was scored when stripping. Cut past the damage and make the end again.",
  },
];

/** Memoised: re-renders only when the cable changes. */
export const InspectionPanel = memo(function InspectionPanel({ cable }: { cable: CableState }) {
  const result = inspect(cable);
  const failures = (["A", "B"] as const).flatMap((end) =>
    cable.ends[end].plug === null ? [] : CHECKS.filter(({ key }) => !result[end][key]).map((check) => ({ end, check })),
  );

  return (
    <section aria-labelledby="inspection-heading" className="rounded-lg border border-slate-200 bg-white p-3">
      <h2 id="inspection-heading" className="mb-1.5 text-sm font-semibold text-slate-800">
        Inspection
      </h2>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-500">
            <th className="text-left font-medium">Check</th>
            <th className="w-12 font-medium">End A</th>
            <th className="w-12 font-medium">End B</th>
          </tr>
        </thead>
        <tbody>
          {CHECKS.map(({ key, label }) => (
            <tr key={key} className="border-t border-slate-100">
              <th scope="row" className="py-1 text-left font-normal text-slate-700">
                {label}
              </th>
              {(["A", "B"] as const).map((end) => (
                <td key={end} className="text-center" data-testid={`inspect-${end}-${key}`}>
                  <Mark pass={result[end][key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {failures.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-rose-800" data-testid="inspection-why">
          {failures.map(({ end, check }) => (
            <li key={`${end}-${check.key}`}>
              <span className="font-semibold">End {end}:</span> {check.why}
            </li>
          ))}
        </ul>
      )}
      {(["A", "B"] as const)
        .filter((end) => cable.ends[end].plug === null)
        .map((end) => (
          <p key={end} className="mt-1 text-[11px] text-slate-500">
            End {end} has no plug yet, so there is nothing to inspect.
          </p>
        ))}
    </section>
  );
});

function Mark({ pass }: { pass: boolean }) {
  return pass ? (
    <span className="font-bold text-emerald-600" aria-label="pass">
      ✓
    </span>
  ) : (
    <span className="font-bold text-rose-600" aria-label="fail">
      ✗
    </span>
  );
}
