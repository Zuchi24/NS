import type { PointerEvent as ReactPointerEvent } from "react";

import { END_IDS } from "../../model";
import type { CableState, EndId, EndpointId, Scenario } from "../../model";
import type { LeadHold } from "../gestures/useConnectGesture";
import type { UnplugDrag } from "../gestures/useDisconnectGesture";
import { endpointLabel } from "../messages";
import { PORT_REACH, SEATED_HEIGHT, SEATED_WIDTH, UNPLUG_PULL, leadHandle, portSlots, seatedPlugBox } from "../portGeometry";

/**
 * The ports along the top of the mat, the leads of the plugs, and a plug on
 * its way into a port or out of one.
 *
 * Every position comes from portGeometry, the same functions the gestures
 * hit-test with. Which end is in which port is the model's `connections`,
 * drawn and never kept here. A port is named by the scenario's own label for
 * it; nothing here says which port a plug ought to go in, and nothing here
 * says whether a connection is right. What the model says about a waiting
 * plug is shown as the model's answer — accepted or refused — and nothing more.
 */

interface Props {
  cable: CableState;
  scenario: Scenario;
  /** User units per millimetre, from benchScale(). */
  scale: number;
  /** Whether the bench offers carrying a plug's lead to a port: draws the lead handles. */
  leads: boolean;
  /** A lead in hand, or waiting at a port. */
  lead: LeadHold | null;
  /** The model's answer about plugging the waiting lead into its port. Colour only. */
  leadRefused: boolean;
  /** The port the model says the lead would plug into, read off its own event; null when it would not. */
  leadConnects: EndpointId | null;
  onPressLead: (event: ReactPointerEvent) => void;
  /** A plug being pulled out of a port. */
  unplugging: UnplugDrag | null;
  /** The model's answer about pulling it out. Colour only. */
  unplugRefused: boolean;
}

export function PortLayer({
  cable,
  scenario,
  scale,
  leads,
  lead,
  leadRefused,
  leadConnects,
  onPressLead,
  unplugging,
  unplugRefused,
}: Props) {
  const slots = portSlots(scenario.endpoints);
  const slotOf = (endpoint: EndpointId) => slots.find((slot) => slot.endpoint === endpoint);
  const handleOf = (id: EndId) => leadHandle(id, cable.ends[id], scale);

  const waitingSlot = lead !== null && lead.endpoint !== null ? slotOf(lead.endpoint) : undefined;
  const leadHandleOf = lead === null ? null : handleOf(lead.end);
  // Where the plug on the lead is drawn: waiting in front of its port's mouth, or in the hand.
  const leadPlug =
    lead === null
      ? null
      : waitingSlot
        ? { x: waitingSlot.mouthX - SEATED_WIDTH / 2, y: waitingSlot.mouthY + 4 }
        : { x: lead.at.x - SEATED_WIDTH / 2, y: lead.at.y - SEATED_HEIGHT / 2 };

  const pulledSlot = unplugging !== null && unplugging.active ? slotOf(unplugging.endpoint) : undefined;

  return (
    <g data-testid="ports">
      {/* ---- The ports, each with its mouth facing the cable ---- */}
      {slots.map((slot) => {
        const occupant = END_IDS.find((id) => cable.connections[id] === slot.endpoint);
        const label = endpointLabel(scenario, slot.endpoint);
        const lifted = pulledSlot !== undefined && pulledSlot.endpoint === slot.endpoint;

        return (
          <g
            key={slot.endpoint}
            data-testid={`port-${slot.endpoint}`}
            data-endpoint={slot.endpoint}
            data-occupied-by={occupant ?? ""}
            data-x={slot.x}
            data-y={slot.y}
            data-width={slot.width}
            data-height={slot.height}
          >
            <title>{label}</title>
            <rect x={slot.x} y={slot.y} width={slot.width} height={slot.height} rx={4} fill="#0F172A" stroke="#475569" strokeWidth={1.5} />
            <text x={slot.mouthX} y={slot.y + 12} textAnchor="middle" fontSize={8} fontWeight={600} fill="#CBD5E1" pointerEvents="none">
              {label}
            </text>
            <rect
              x={slot.mouthX - SEATED_WIDTH / 2 - 2}
              y={slot.mouthY - 12}
              width={SEATED_WIDTH + 4}
              height={12}
              rx={1.5}
              fill="#020617"
              stroke="#64748B"
              pointerEvents="none"
            />
            {occupant && (
              <g data-testid={`seated-plug-${occupant}`} opacity={lifted ? 0.35 : 1} style={{ cursor: "grab" }}>
                <title>{`Pull end ${occupant}'s plug down, out of the port, to unplug it.`}</title>
                <rect {...seatedPlugBox(slot)} rx={3} fill="#D7E9F7" fillOpacity={0.55} stroke="#9CC3E6" strokeWidth={1.5} />
                <text x={slot.mouthX} y={slot.mouthY + 14} textAnchor="middle" fontSize={9} fontWeight={700} fill="#0F172A" pointerEvents="none">
                  {occupant}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* ---- The lead of every plugged-in end, from its plug to its port ---- */}
      {END_IDS.map((id) => {
        const endpoint = cable.connections[id];
        const slot = endpoint === undefined ? undefined : slotOf(endpoint);
        const handle = handleOf(id);
        if (slot === undefined || handle === null) return null;

        return (
          <line
            key={id}
            data-testid={`lead-${id}`}
            data-endpoint={endpoint}
            x1={handle.cx}
            y1={handle.cy}
            x2={slot.mouthX}
            y2={slot.mouthY + SEATED_HEIGHT}
            stroke="#9CC3E6"
            strokeOpacity={0.7}
            strokeWidth={4}
            pointerEvents="none"
          />
        );
      })}

      {/* ---- Where a hand takes up a plug's lead ---- */}
      {leads &&
        END_IDS.map((id) => {
          const handle = handleOf(id);
          if (handle === null) return null;
          const pluggedIn = cable.connections[id] !== undefined;

          return (
            <g key={id} data-testid={`plug-lead-${id}`} data-x={handle.x} data-width={handle.width} data-plugged-in={pluggedIn} style={{ cursor: "grab" }}>
              <title>Carry the plug's lead to a port to plug it in.</title>
              <rect
                x={handle.x}
                y={handle.y}
                width={handle.width}
                height={handle.height}
                rx={handle.height / 2}
                fill={pluggedIn ? "#38BDF8" : "#9CC3E6"}
                fillOpacity={pluggedIn ? 0.45 : 0.2}
                stroke="#9CC3E6"
                strokeWidth={1.2}
              />
              <text x={handle.cx} y={handle.cy + 3} textAnchor="middle" fontSize={9} fill="#E0F2FE" pointerEvents="none">
                ⇡
              </text>
            </g>
          );
        })}

      {/* ---- A lead in hand, or waiting at a port to be pressed in ---- */}
      {lead !== null && leadPlug !== null && (
        <g
          data-testid="plug-at-port"
          data-end={lead.end}
          data-endpoint={lead.endpoint ?? ""}
          data-held={lead.held}
          data-refused={leadRefused}
          data-connects={leadConnects ?? ""}
          // A press here is a hand on the waiting lead. Lifted without
          // travelling it is pressing it in, which the gesture reads off the
          // pointer: the click that follows goes to the captured drawing.
          style={{ cursor: lead.held ? "grabbing" : "pointer" }}
          onPointerDown={onPressLead}
        >
          {waitingSlot !== undefined && <title>Press the plug to plug it in here</title>}
          {leadHandleOf !== null && (
            <line
              x1={leadHandleOf.cx}
              y1={leadHandleOf.cy}
              x2={leadPlug.x + SEATED_WIDTH / 2}
              y2={leadPlug.y + SEATED_HEIGHT}
              stroke={leadRefused ? "#F43F5E" : "#38BDF8"}
              strokeWidth={2}
              strokeDasharray="5 4"
              pointerEvents="none"
            />
          )}
          <rect
            x={leadPlug.x}
            y={leadPlug.y}
            width={SEATED_WIDTH}
            height={SEATED_HEIGHT}
            rx={3}
            fill={leadRefused ? "#4C1520" : "#D7E9F7"}
            fillOpacity={0.5}
            stroke={leadRefused ? "#F43F5E" : "#38BDF8"}
            strokeWidth={1.5}
            strokeDasharray={waitingSlot ? "4 3" : undefined}
          />
          {waitingSlot !== undefined && (
            <g transform={`translate(${waitingSlot.mouthX} ${waitingSlot.mouthY + PORT_REACH + 14})`} pointerEvents="none">
              <rect
                x={-52}
                y={-11}
                width={104}
                height={22}
                rx={5}
                fill={leadRefused ? "#4C1520" : "#0B211A"}
                stroke={leadRefused ? "#F43F5E" : "#38BDF8"}
                strokeWidth={1.5}
              />
              <text textAnchor="middle" y={-1} fontSize={10} fontWeight={700} fill={leadRefused ? "#FDA4AF" : "#E0F2FE"}>
                {leadRefused ? `✗ plug end ${lead.end} in` : `plug end ${lead.end} in`}
              </text>
              {!leadRefused && (
                <text textAnchor="middle" y={8} fontSize={7} fill="#94A3B8">
                  {lead.held ? "let go to hold it here" : "press to plug it in"}
                </text>
              )}
            </g>
          )}
        </g>
      )}

      {/* ---- A plug being pulled out of its port ---- */}
      {unplugging !== null && pulledSlot !== undefined && (
        <g
          data-testid="connected-plug-in-hand"
          data-end={unplugging.end}
          data-endpoint={unplugging.endpoint}
          data-pulled={unplugging.pulled}
          data-refused={unplugRefused}
          pointerEvents="none"
        >
          <rect
            {...seatedPlugBox(pulledSlot)}
            y={seatedPlugBox(pulledSlot).y + Math.max(0, Math.min(unplugging.at.y - unplugging.origin.y, UNPLUG_PULL + 16))}
            rx={3}
            fill={unplugRefused ? "#4C1520" : "#D7E9F7"}
            fillOpacity={0.5}
            stroke={unplugRefused ? "#F43F5E" : "#38BDF8"}
            strokeWidth={1.5}
          />
          <g transform={`translate(${pulledSlot.mouthX} ${pulledSlot.mouthY + PORT_REACH + 14})`}>
            <rect
              x={-52}
              y={-11}
              width={104}
              height={22}
              rx={5}
              fill={unplugRefused ? "#4C1520" : "#0B211A"}
              stroke={unplugRefused ? "#F43F5E" : "#38BDF8"}
              strokeWidth={1.5}
            />
            <text textAnchor="middle" y={-1} fontSize={10} fontWeight={700} fill={unplugRefused ? "#FDA4AF" : "#E0F2FE"}>
              {unplugRefused ? `✗ unplug end ${unplugging.end}` : `unplug end ${unplugging.end}`}
            </text>
            {!unplugRefused && (
              <text textAnchor="middle" y={8} fontSize={7} fill="#94A3B8">
                {unplugging.pulled ? "let go to unplug it" : "pull it down, out of the port"}
              </text>
            )}
          </g>
        </g>
      )}
    </g>
  );
}
