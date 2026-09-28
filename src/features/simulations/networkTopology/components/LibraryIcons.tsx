import type { SVGProps } from "react";

/**
 * The PC and the server as the device library shows them. lucide's Computer
 * and Server are both two stacked boxes, and at the library's size they read
 * as the same thing. These keep lucide's grid and stroke, so they sit with the
 * other library icons, and draw what the canvas draws (DeviceIcon): a monitor
 * with its tower beside it, and a rack of three units.
 */

function LibraryIcon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** A monitor on a stand, and the tower case beside it. */
export function DesktopPcIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LibraryIcon {...props}>
      <rect x="2" y="4" width="12" height="10" rx="1.5" />
      <path d="M8 14v6" />
      <path d="M5 20h6" />
      <rect x="17.5" y="3" width="4.5" height="18" rx="1" />
      <path d="M19.75 17h.01" />
    </LibraryIcon>
  );
}

/** Three rack units, stacked, each with its light. */
export function RackServerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LibraryIcon {...props}>
      <rect x="2" y="2" width="20" height="4" rx="1" />
      <rect x="2" y="10" width="20" height="4" rx="1" />
      <rect x="2" y="18" width="20" height="4" rx="1" />
      <path d="M6 4h.01" />
      <path d="M6 12h.01" />
      <path d="M6 20h.01" />
    </LibraryIcon>
  );
}
