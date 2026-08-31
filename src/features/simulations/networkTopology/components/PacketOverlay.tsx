import { useEffect, useRef, useState } from "react";

import type { Connection, Device } from "../types";
import {
  packetPolyline,
  pointAtDistance,
  polylineLength,
} from "../utils/packetPath";
import type { PacketPath, Point } from "../utils/packetPath";

/** Canvas pixels a packet covers per second. Slow enough to follow by eye. */
const SPEED = 260;

/**
 * A message travelling the route worked out from the topology.
 *
 * Drawn into the canvas's own SVG layer, on the cables it is crossing. The
 * geometry is rebuilt from the live devices on every frame rather than measured
 * once at the start, so dragging a device mid-flight bends the route under the
 * packet instead of leaving it in mid-air.
 *
 * Kept in its own component so the frame loop repaints one glyph rather than
 * the whole workspace.
 */
export function PacketOverlay({
  path,
  devices,
  connections,
  onArrived,
}: {
  /** Null when nothing is in flight. */
  path: PacketPath | null;
  devices: Device[];
  connections: Connection[];
  onArrived: () => void;
}) {
  const [position, setPosition] = useState<Point | null>(null);

  // Read inside the frame loop, which outlives any one render.
  const latest = useRef({ devices, connections, onArrived });
  latest.current = { devices, connections, onArrived };

  useEffect(() => {
    if (!path || path.hops.length === 0) {
      setPosition(null);

      return;
    }

    let frame = 0;
    let start: number | null = null;
    let done = false;

    const step = (now: number) => {
      start ??= now;

      const { devices: live, connections: wires } = latest.current;
      const points = packetPolyline(live, wires, path);
      const total = polylineLength(points);

      // The route stopped existing under us — a cable pulled out mid-flight.
      if (points.length === 0 || total === 0) {
        setPosition(null);
        latest.current.onArrived();

        return;
      }

      const travelled = ((now - start) / 1000) * SPEED;

      setPosition(pointAtDistance(points, Math.min(travelled, total)));

      if (travelled >= total) {
        if (!done) {
          done = true;
          // Let the packet be seen landing before it is cleared.
          window.setTimeout(() => {
            setPosition(null);
            latest.current.onArrived();
          }, 220);
        }

        return;
      }

      frame = window.requestAnimationFrame(step);
    };

    frame = window.requestAnimationFrame(step);

    return () => window.cancelAnimationFrame(frame);
  }, [path]);

  if (!position) return null;

  return (
    <g
      style={{ pointerEvents: "none" }}
      transform={`translate(${position.x} ${position.y})`}
    >
      <circle r="13" fill="#2563eb" opacity="0.18" />

      <circle
        r="9"
        fill="#2563eb"
        stroke="#ffffff"
        strokeWidth="2"
      />

      {/* An envelope, small enough to read as a message at this size. */}
      <g transform="translate(-5 -3.5)" stroke="#ffffff" strokeWidth="1.2" fill="none">
        <rect width="10" height="7" rx="1" fill="#2563eb" />
        <path d="M0.6 0.8 L5 4.2 L9.4 0.8" strokeLinecap="round" />
      </g>
    </g>
  );
}
