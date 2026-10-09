import type { ReactNode } from "react";
import { Monitor, Network, type LucideIcon } from "lucide-react";

/**
 * The hands-on activities, each with a picture of what the student works with.
 *
 * Three use the activity's own artwork: the PC-assembly stage renders, the
 * motherboard-labelling board, and the cable as the wiring bench draws it
 * (public/landing/cable-bench.svg, saved from the bench). The network
 * workspace has no artwork to borrow, so its card draws an example layout
 * instead, and says so with an "Example" badge.
 *
 * Two columns on a tablet, four across from xl; between, each picture has
 * room to spare, so only the xl row needs the tighter sizes below.
 */

/** Stages of the PC-assembly activity, from empty case to finished build. */
const buildStages = [
  { src: "/pc-case.webp", label: "Case" },
  { src: "/build-state-0.webp", label: "Motherboard" },
  { src: "/build-state-3.webp", label: "Memory" },
  { src: "/build-state-7.webp", label: "Complete" },
];

function ShowcaseCard({
  step,
  title,
  description,
  visualNote,
  visualClassName,
  children,
}: {
  step: string;
  title: string;
  description: string;
  /**
   * What a screen reader should know about the picture, which is hidden from
   * it as decoration: said once, in words, rather than through the picture's
   * own badge.
   */
  visualNote?: string;
  visualClassName: string;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm shadow-slate-900/5">
      <div aria-hidden="true" className={`relative aspect-[4/3] min-h-0 overflow-hidden ${visualClassName}`}>
        {children}
      </div>
      <div className="flex flex-1 flex-col gap-2 border-t border-border p-6">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-orange-dark">
          {step}
        </span>
        {/* h4: these sit under the section's "See It in Action" h3. */}
        <h4 className="text-xl font-bold text-foreground">{title}</h4>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
        {visualNote && <p className="sr-only">{visualNote}</p>}
      </div>
    </li>
  );
}

const nodeVariants = {
  primary: "bg-primary text-primary-foreground",
  teal: "bg-brand-teal-light text-brand-teal-dark",
  muted: "bg-muted text-foreground/80",
} as const;

/** One device in the example layout, sized to fit four across at xl. */
function TopologyNode({
  icon: Icon,
  variant,
  name,
  meta,
}: {
  icon: LucideIcon;
  variant: keyof typeof nodeVariants;
  name: string;
  meta: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-2 py-1.5 shadow-sm">
      <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${nodeVariants[variant]}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-xs font-semibold text-foreground">{name}</div>
        <div className="truncate text-[10px] text-muted-foreground">{meta}</div>
      </div>
    </div>
  );
}

export function ActivityShowcase() {
  return (
    <ul className="grid gap-6 md:grid-cols-2 lg:gap-8 xl:grid-cols-4">
      <ShowcaseCard
        step="Build"
        title="PC Assembly"
        description="Put a computer together part by part, from an empty case to a complete build."
        visualClassName="flex flex-col bg-slate-50"
      >
        <img
          src="/build-state-7.webp"
          alt=""
          width={1408}
          height={768}
          loading="lazy"
          className="min-h-0 w-full flex-1 object-cover"
        />
        {/* Each stage's number sits on its thumbnail, so the name below has
            the thumbnail's whole width: "2. Motherboard" was cut on a
            320-360px phone, and a little less spacing below sm gives the name
            alone room there. The numbers and names go in the four-across row,
            where they were cut to "2. Moth…"; the thumbnails alone still read
            as a progression there. */}
        <div className="grid grid-cols-4 gap-1 border-t border-border bg-white p-1.5 sm:gap-1.5 sm:p-2">
          {buildStages.map((stage, index) => (
            <div key={stage.src} className="min-w-0">
              <div className="relative">
                <img
                  src={stage.src}
                  alt=""
                  width={1408}
                  height={768}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-md bg-slate-50 object-cover ring-1 ring-border"
                />
                <span
                  data-testid="stage-number"
                  className="absolute top-0.5 left-0.5 grid h-4 min-w-4 place-items-center rounded bg-white/90 px-0.5 text-[9px] font-semibold leading-none text-primary ring-1 ring-border xl:hidden"
                >
                  {index + 1}
                </span>
              </div>
              <div
                data-testid="stage-label"
                className="mt-1 truncate text-[10px] leading-tight text-muted-foreground xl:hidden"
              >
                {stage.label}
              </div>
            </div>
          ))}
        </div>
      </ShowcaseCard>

      <ShowcaseCard
        step="Explore Components"
        title="Motherboard Identification"
        description="Find and label the parts of a motherboard: CPU socket, RAM slots, chipset and more."
        visualClassName="grid place-items-center bg-slate-900 p-5"
      >
        <img
          src="/motherboards/atx-basic-v1.svg"
          alt=""
          width={1200}
          height={800}
          loading="lazy"
          className="max-h-full w-full scale-[1.3] object-contain drop-shadow-xl"
        />
      </ShowcaseCard>

      <ShowcaseCard
        step="Connect"
        title="RJ45 Cable Wiring"
        description="Strip, arrange and crimp a network cable to the T568B standard, then test it."
        visualClassName="bg-[#1D4436]"
      >
        {/* The bench's own mat colour behind it, so a card wider than the
            drawing's 4:3 runs on into the same green. */}
        <img
          src="/landing/cable-bench.svg"
          alt=""
          width={268}
          height={201}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </ShowcaseCard>

      <ShowcaseCard
        step="Connect"
        title="Network Simulation"
        description="Drag devices onto a workspace, connect them with cables, and set their IP addresses and subnet masks."
        visualNote="The picture is an example network layout, not a screenshot of the workspace."
        visualClassName="bg-muted/60 p-4 pt-10"
      >
        {/* Seen, not read: the card's visualNote says it to a screen reader. */}
        <span className="absolute top-3 right-3 rounded-full bg-brand-orange-light px-2.5 py-0.5 text-[11px] font-semibold text-brand-orange-dark">
          Example
        </span>
        {/* An example layout, not live state: no status lights, counters or
            features (VLANs, servers) the workspace does not have. Devices are
            the ones its palette offers. */}
        <div className="relative h-full">
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full text-brand-teal/50"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <path
              d="M50 25 L25 75 M50 25 L75 75"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="relative grid h-full grid-cols-2 grid-rows-2 items-center gap-x-3">
            <div className="col-span-2 flex justify-center">
              <TopologyNode icon={Network} variant="primary" name="SW1" meta="24 ports" />
            </div>
            <div className="flex justify-center">
              <TopologyNode icon={Monitor} variant="muted" name="PC1" meta="192.168.1.10" />
            </div>
            <div className="flex justify-center">
              <TopologyNode icon={Monitor} variant="muted" name="PC2" meta="192.168.1.11" />
            </div>
          </div>
        </div>
      </ShowcaseCard>
    </ul>
  );
}
