import { cn } from "@/components/ui/utils";

/**
 * The NetSim logo, from the logo pack in public/NetSim_Logo.
 *
 * The files are drawn once and used as they are — never rebuilt from an icon
 * and the name. Each is sized by height with its width following, so it keeps
 * the proportions it was drawn at; the intrinsic size is given so the page does
 * not shift while it loads.
 *
 * - `wordmark`: the mark and "NetSim", for light surfaces. The lockup with the
 *   tagline is not offered: at any navigation size its tagline is a few pixels
 *   tall and unreadable.
 * - `wordmarkDark`: `wordmark` for dark surfaces, at navigation size. The pack
 *   has no dark lockup without the tagline, so this one is assembled from its
 *   own parts rather than redrawn: the dark lockup's mark, and the `wordmark`
 *   file's lettering in the dark lockup's colours (#F8FAFC "Net", #FB923C "Sim").
 * - `dark`: the pack's dark horizontal lockup, which carries the tagline; use
 *   it large enough to hold it.
 */
const PACK = "/NetSim_Logo/NetSim_Logo/SVG";

const LOGOS = {
  wordmark: { src: `${PACK}/netsim_lockup_horizontal_notag.svg`, width: 952, height: 270 },
  wordmarkDark: { src: `${PACK}/netsim_lockup_horizontal_notag_dark.svg`, width: 952, height: 270 },
  dark: { src: `${PACK}/netsim_lockup_horizontal_dark.svg`, width: 878, height: 270 },
} as const;

export type BrandLogoVariant = keyof typeof LOGOS;

export function BrandLogo({
  variant = "wordmark",
  className,
}: {
  variant?: BrandLogoVariant;
  /** Sets the height (h-*); the width follows. */
  className?: string;
}) {
  const logo = LOGOS[variant];

  return (
    <img
      src={logo.src}
      width={logo.width}
      height={logo.height}
      alt="NetSim"
      draggable={false}
      className={cn("h-8 w-auto select-none", className)}
    />
  );
}
