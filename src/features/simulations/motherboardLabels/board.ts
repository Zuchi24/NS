/**
 * The motherboards a labeling challenge can be played on: the drawing, and
 * where each of its marked parts is.
 *
 * Geometry only. A region is known by the board's own opaque mark (m1, m2,
 * ...), never by what it is — the names that answer it are the challenge's
 * answer key and live on the server, not here. What a region carries for a
 * student is a description of how it looks and where, for anyone who cannot
 * see the drawing, and that description is written never to name the part.
 *
 * Every coordinate is in the drawing's own viewBox, so it means the same place
 * at any size the board is drawn.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Which side of the board a region's label sits on, when there is room for labels around it. */
export type LabelSide = "above" | "below" | "left" | "right";

export interface BoardRegion {
  id: string;
  /** A point on the part itself. */
  anchor: Point;
  /**
   * Where the numbered marker sits and a leader line ends. On the part, for a
   * part big enough to show around it; beside it, for one the marker would
   * cover — the page then outlines the part and points the marker at it.
   */
  marker: Point;
  /** The part's extent on the drawing. */
  bounds: Box;
  labelSide: LabelSide;
  /** The centre of the label box around the board. */
  labelAt: Point;
  /** How the part looks and where it is, without naming it. */
  description: string;
}

export interface BoardDefinition {
  id: string;
  /** The drawing, served from public/. */
  src: string;
  /** The whole drawing: the board and the room around it for labels. */
  viewBox: Box;
  /** The board alone, for a layout with no room around it. */
  crop: Box;
  regions: Record<string, BoardRegion>;
}

/** A label box's size, in the drawing's units. */
export const LABEL_WIDTH = 180;
export const LABEL_HEIGHT = 44;

function region(
  id: string,
  anchor: Point,
  bounds: [number, number, number, number],
  labelSide: LabelSide,
  labelAt: Point,
  description: string,
  marker: Point = anchor,
): BoardRegion {
  const [x1, x2, y1, y2] = bounds;

  return { id, anchor, marker, bounds: { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }, labelSide, labelAt, description };
}

/** Whether a region's marker sits beside its part rather than on it. */
export function markedBeside(region: BoardRegion): boolean {
  return region.marker.x !== region.anchor.x || region.marker.y !== region.anchor.y;
}

/**
 * The simplified ATX board drawn for the first challenges
 * (public/motherboards/atx-basic-v1.svg). Anchors and bounds were measured from
 * the drawing as rendered, so they sit on the parts they belong to.
 */
export const ATX_BASIC_V1: BoardDefinition = {
  id: "atx-basic-v1",
  src: "/motherboards/atx-basic-v1.svg",
  viewBox: { x: 0, y: 0, width: 1200, height: 800 },
  crop: { x: 276, y: 150, width: 634, height: 500 },
  regions: Object.fromEntries(
    [
      region("m1", { x: 670, y: 186 }, [618, 722, 186, 442], "above", { x: 720, y: 90 },
        "Four tall parallel strips with clips at both ends, right of centre"),
      region("m2", { x: 892, y: 526 }, [858, 892, 470, 582], "right", { x: 1060, y: 526 },
        "Four small white L-shaped housings stacked on the right edge, lower down"),
      region("m3", { x: 500, y: 312 }, [438, 579, 250, 374], "above", { x: 500, y: 90 },
        "A square gold grid in a silver frame with a lever arm down its right side, upper centre"),
      region("m4", { x: 738, y: 570 }, [690, 786, 486, 570], "below", { x: 780, y: 712 },
        "A flat square grey plate with a raised face, lower right"),
      region("m5", { x: 888, y: 316 }, [850, 888, 222, 410], "right", { x: 1060, y: 316 },
        "A tall white block with two columns of square holes, on the right edge"),
      region("m6", { x: 286, y: 337 }, [286, 350, 232, 442], "left", { x: 140, y: 300 },
        "A dark strip on the left edge with rectangular openings and three round teal openings"),
      region("m7", { x: 560, y: 576 }, [532, 588, 530, 576], "below", { x: 540, y: 712 },
        "A small round silver disc in a black holder, lower centre"),
      region("m8", { x: 330, y: 457 }, [330, 644, 445, 469], "left", { x: 140, y: 420 },
        "The long dark strip with a silver rim and a white clip, first below the square gold grid"),
      region("m9", { x: 366, y: 170 }, [332, 400, 170, 208], "above", { x: 250, y: 90 },
        "A small white block with two rows of square holes, top-left corner"),
      region("m10", { x: 360, y: 492 }, [360, 596, 480, 504], "left", { x: 140, y: 520 },
        "A small black block with a dashed outline and a round post beside it, just below the long silver-rimmed strip"),
      // The smaller parts. Their boxes use the room the first ten leave free —
      // a second row above the board and one below, and the ends of the rows
      // and columns —
      // so no two boxes on this board ever overlap, whichever parts are marked.
      // All but the first are smaller than a marker, so theirs sits beside them.
      region("m11", { x: 495, y: 212 }, [410, 580, 196, 228], "above", { x: 495, y: 30 },
        "A long dark grooved block along the top of the square gold grid, with a row of small dark squares under it"),
      region("m12", { x: 474, y: 540 }, [458, 490, 528, 552], "below", { x: 474, y: 770 },
        "A small black rectangle with short silver legs along its two long sides, left of the round silver disc",
        { x: 474, y: 570 }),
      region("m13", { x: 317, y: 569 }, [302, 332, 554, 584], "left", { x: 140, y: 700 },
        "A small black square with silver legs on every side, in the bottom-left corner",
        { x: 350, y: 570 }),
      // Right behind the largest opening in the strip on the left edge, where
      // the chip it names sits on a real board. Its leader crosses that strip
      // through the gap under the largest opening, not through an opening.
      region("m14", { x: 374, y: 292 }, [358, 390, 276, 308], "left", { x: 140, y: 348 },
        "A black square with silver legs on every side, just inside the strip of openings on the left edge, level with its largest opening",
        { x: 374, y: 332 }),
      region("m15", { x: 727, y: 618 }, [700, 754, 610, 626], "below", { x: 980, y: 712 },
        "A black block with two rows of gold dots on the bottom edge, the left one of a pair",
        { x: 727, y: 594 }),
      region("m16", { x: 757, y: 173 }, [742, 772, 167, 179], "above", { x: 910, y: 90 },
        "A thin black strip with four gold dots in a row on the top edge, right of the four tall strips",
        { x: 792, y: 172 }),
    ].map((r) => [r.id, r]),
  ),
};

export const BOARDS: Record<string, BoardDefinition> = {
  [ATX_BASIC_V1.id]: ATX_BASIC_V1,
};

/** A viewBox attribute for a box. */
export function viewBoxOf(box: Box): string {
  return `${box.x} ${box.y} ${box.width} ${box.height}`;
}

/**
 * Where a point in the drawing falls within a frame of it, as percentages —
 * the same place whatever size the frame is drawn at.
 */
export function toPercent(point: Point, frame: Box): { left: number; top: number } {
  return {
    left: ((point.x - frame.x) / frame.width) * 100,
    top: ((point.y - frame.y) / frame.height) * 100,
  };
}

/** Where a region's leader line leaves its label box: the edge facing the board. */
export function leaderStart(region: BoardRegion): Point {
  const { x, y } = region.labelAt;

  switch (region.labelSide) {
    case "above":
      return { x, y: y + LABEL_HEIGHT / 2 };
    case "below":
      return { x, y: y - LABEL_HEIGHT / 2 };
    case "left":
      return { x: x + LABEL_WIDTH / 2, y };
    case "right":
      return { x: x - LABEL_WIDTH / 2, y };
  }
}
