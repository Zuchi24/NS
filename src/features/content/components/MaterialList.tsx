import { useEffect, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Link2,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/services/api";
import {
  downloadMaterial,
  openMaterial,
  readableSize,
  videoEmbedUrl,
  viewerFor,
  youtubeId,
} from "@/features/content/materialService";
import type { MaterialViewer } from "@/features/content/materialService";
import type { LearningMaterial, MaterialKind } from "@/features/content/types";

/**
 * A topic's materials, as a student reads them.
 *
 * Each kind is offered the way it is actually used: a video plays in the page,
 * a link opens where it lives, and a file is fetched through the API and
 * handed to the browser to save. There is no case for a file that turns into a
 * plain link — the bytes sit on a private disk and only the API can release
 * them.
 *
 * A picture or a PDF can also be read here rather than saved first, which is
 * what most handouts are for. Every file keeps its download either way: reading
 * one in the page is an extra, not a replacement, and a deck or a spreadsheet
 * still has nowhere to be read but an application that opens it.
 */

const ICON: Record<MaterialKind, typeof FileText> = {
  video: PlayCircle,
  link: Link2,
  file: FileText,
};

const ICON_TONE: Record<MaterialKind, string> = {
  video: "text-red-600 bg-red-50",
  link: "text-blue-600 bg-blue-50",
  file: "text-emerald-700 bg-emerald-50",
};

export function MaterialList({ materials }: { materials: LearningMaterial[] }) {
  return (
    <ul className="space-y-3">
      {materials.map((material) => (
        <li key={material.id}>
          <MaterialRow material={material} />
        </li>
      ))}
    </ul>
  );
}

function MaterialRow({ material }: { material: LearningMaterial }) {
  const Icon = ICON[material.kind];
  // Only for the hosts whose player can be addressed from a share link. A video
  // anywhere else is still a video; it opens where it lives.
  const embed = material.kind === "video" ? videoEmbedUrl(material.url) : null;

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${ICON_TONE[material.kind]}`}
        >
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-gray-900 break-words">
              {material.title}
            </h3>
            <span className="text-xs font-medium text-gray-500 border border-gray-200 rounded px-1.5 py-0.5">
              {material.kindLabel}
            </span>
          </div>

          {material.description && (
            <p className="text-sm text-gray-600 mt-1">{material.description}</p>
          )}

          <MaterialAction material={material} />
        </div>
      </div>

      {/* A video is worth playing in place; the others are a single action. */}
      {embed && (
        <div className="relative w-full pb-[56.25%] bg-gray-900 rounded-lg overflow-hidden mt-4">
          <iframe
            className="absolute top-0 left-0 w-full h-full"
            src={embed}
            title={material.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}

/**
 * A picture or a PDF, shown in the page.
 *
 * Fetched once when it is opened and released when it is closed, so a topic of
 * twenty handouts costs nothing until somebody asks to read one.
 *
 * The frame is sandboxed and the type is checked against the response rather
 * than against the material row. Both guard the same thing: an address made
 * from a blob carries this page's origin, so whatever is put in a frame has to
 * be something the browser displays rather than something it runs. A PDF is;
 * the check makes sure that is what arrived.
 */
function MaterialViewerPanel({
  material,
  viewer,
  onClose,
}: {
  material: LearningMaterial;
  viewer: MaterialViewer;
  onClose: () => void;
}) {
  const [href, setHref] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const revoke = useRef<(() => void) | null>(null);

  useEffect(() => {
    let live = true;

    openMaterial(material)
      .then((opened) => {
        // Closed, or moved on, while the file was in flight.
        if (!live) {
          opened.revoke();

          return;
        }

        if (viewer === "pdf" && opened.type !== "application/pdf") {
          opened.revoke();
          setError(
            "That file did not arrive as a PDF, so it cannot be shown here. " +
              "Download it instead.",
          );

          return;
        }

        revoke.current = opened.revoke;
        setHref(opened.href);
      })
      .catch((e: unknown) => {
        if (!live) return;

        setError(
          e instanceof ApiError ? e.message : "The file could not be opened.",
        );
      });

    return () => {
      live = false;
      revoke.current?.();
      revoke.current = null;
    };
  }, [material, viewer]);

  return (
    <div className="mt-4">
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !href ? (
        <p className="text-sm text-gray-500">Opening {material.title}…</p>
      ) : viewer === "image" ? (
        <img
          src={href}
          alt={material.description ?? material.title}
          className="max-w-full h-auto rounded-lg border border-gray-200"
        />
      ) : (
        <iframe
          src={href}
          title={material.title}
          sandbox=""
          className="w-full h-[70vh] min-h-80 rounded-lg border border-gray-200 bg-gray-50"
        />
      )}

      <Button size="sm" variant="ghost" className="mt-2" onClick={onClose}>
        <EyeOff className="w-4 h-4 mr-2" />
        Hide
      </Button>
    </div>
  );
}

function MaterialAction({ material }: { material: LearningMaterial }) {
  const [downloading, setDownloading] = useState(false);
  const [showing, setShowing] = useState(false);

  if (material.kind === "file") {
    const size = readableSize(material.sizeBytes);
    // Null for a deck, a spreadsheet or an archive: nothing a browser shows.
    const viewer = viewerFor(material);

    const save = async () => {
      setDownloading(true);

      try {
        await downloadMaterial(material);
      } catch (error) {
        // A file whose topic has since locked, or one removed from storage.
        toast.error(
          error instanceof ApiError
            ? error.message
            : "The file could not be downloaded.",
        );
      } finally {
        setDownloading(false);
      }
    };

    return (
      <>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {/* Reading it comes first where reading it is possible; saving it
              stays offered either way, unchanged. */}
          {viewer && !showing && (
            <Button size="sm" variant="outline" onClick={() => setShowing(true)}>
              <Eye className="w-4 h-4 mr-2" />
              View
            </Button>
          )}

          <Button size="sm" variant="outline" onClick={save} disabled={downloading}>
            <Download className="w-4 h-4 mr-2" />
            {downloading ? "Downloading…" : "Download"}
          </Button>

          <span className="text-xs text-gray-500">
            {[material.filename, size].filter(Boolean).join(" · ")}
          </span>
        </div>

        {viewer && showing && (
          <MaterialViewerPanel
            material={material}
            viewer={viewer}
            onClose={() => setShowing(false)}
          />
        )}
      </>
    );
  }

  if (!material.url) return null;

  return (
    <div className="mt-3">
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          window.open(material.url!, "_blank", "noopener,noreferrer")
        }
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        {material.kind === "video"
          ? youtubeId(material.url)
            ? "Watch on YouTube"
            : "Watch video"
          : "Open link"}
      </Button>
    </div>
  );
}
