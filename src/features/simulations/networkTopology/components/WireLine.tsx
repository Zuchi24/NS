import { CABLE_TYPES } from "../data/cableTypes";

export function WireLine({
  x1,
  y1,
  x2,
  y2,
  cableType,
  isPreview,
  onDoubleClick,
}: any) {
  const cable = CABLE_TYPES.find(
    (c) => c.type === cableType
  );

  const color = cable?.color || "#000";
  const style = cable?.style || "solid";

  let strokeDasharray = "0";
  let filter = "";

  if (style === "dashed") {
    strokeDasharray = "8,4";
  }

  if (style === "dotted") {
    strokeDasharray = "3,3";
  }

  if (style === "glow") {
    filter = "url(#glow)";
  }

  return (
    <g
      onDoubleClick={onDoubleClick}
      className={
        onDoubleClick ? "cursor-pointer" : ""
      }
      style={{
        pointerEvents: onDoubleClick ? "all" : "none",
      }}
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur
            stdDeviation="2"
            result="coloredBlur"
          />

          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {onDoubleClick && (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="transparent"
          strokeWidth="12"
          style={{
            cursor: "pointer",
            pointerEvents: "all",
          }}
        />
      )}

      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={isPreview ? "2.5" : "3"}
        strokeDasharray={strokeDasharray}
        opacity={isPreview ? 0.7 : 1}
        strokeLinecap="round"
        filter={filter}
      />

      {!isPreview && (
        <>
          <circle
            cx={x1}
            cy={y1}
            r="5"
            fill={color}
            stroke="#fff"
            strokeWidth="1.5"
          />

          <circle
            cx={x2}
            cy={y2}
            r="5"
            fill={color}
            stroke="#fff"
            strokeWidth="1.5"
          />
        </>
      )}
    </g>
  );
}
