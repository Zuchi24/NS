import { useState } from "react";
import { Download, ExternalLink, FileText, Link2, PlayCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/services/api";
import {
  downloadMaterial,
  readableSize,
  videoEmbedUrl,
  youtubeId,
} from "@/features/content/materialService";
import type { LearningMaterial, MaterialKind } from "@/features/content/types";

/**
 * A topic's materials, as a student reads them.
 *
 * Each kind is offered the way it is actually used: a video plays in the page,
 * a link opens where it lives, and a file is fetched through the API and
 * handed to the browser to save. There is no case for a file that turns into a
 * plain link — the bytes sit on a private disk and only the API can release
 * them.
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

function MaterialAction({ material }: { material: LearningMaterial }) {
  const [downloading, setDownloading] = useState(false);

  if (material.kind === "file") {
    const size = readableSize(material.sizeBytes);

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
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={save} disabled={downloading}>
          <Download className="w-4 h-4 mr-2" />
          {downloading ? "Downloading…" : "Download"}
        </Button>

        <span className="text-xs text-gray-500">
          {[material.filename, size].filter(Boolean).join(" · ")}
        </span>
      </div>
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
