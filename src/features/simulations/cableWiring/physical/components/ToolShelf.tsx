import { HEIGHT, SHELF_TOP, WIDTH } from "../benchGeometry";

/**
 * The shelf along the bottom of the bench, and its caption. What lies on it —
 * the crimper and the plug tray — is drawn by those tools themselves.
 */
export function ToolShelf() {
  return (
    <g data-testid="tool-shelf">
      <rect x={0} y={SHELF_TOP} width={WIDTH} height={HEIGHT - SHELF_TOP} fill="#12281F" />
      <line x1={0} x2={WIDTH} y1={SHELF_TOP} y2={SHELF_TOP} stroke="#2C5B49" strokeWidth={2} />
      <text x={18} y={SHELF_TOP + 22} fontSize={10} fill="#7FA893" letterSpacing="0.08em">
        TOOLS
      </text>
      <text x={18} y={SHELF_TOP + 38} fontSize={9} fill="#5F8874">
        drag one onto
      </text>
      <text x={18} y={SHELF_TOP + 49} fontSize={9} fill="#5F8874">
        the cable
      </text>
    </g>
  );
}
