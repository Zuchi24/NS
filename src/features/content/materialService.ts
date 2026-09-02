import { api } from "@/services/api";
import type { LearningMaterial, MaterialKind, Paginated } from "./types";

/**
 * Reading, and authoring, the material attached to a topic.
 *
 * Access is the server's decision throughout. A material is readable exactly
 * when its topic is, and the API refuses one in a locked topic outright — so
 * nothing here filters, hides or re-decides anything. Writing is refused for
 * anyone who is not staff, again by the API, so the admin screens call the
 * same functions and simply never reach a student.
 */

interface ApiMaterial {
  id: number;
  topic_id: number;
  title: string;
  description: string | null;
  kind: MaterialKind;
  kind_label: string;
  url?: string;
  download_url?: string;
  filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  order: number;
  is_published: boolean;
}

function toMaterial(material: ApiMaterial): LearningMaterial {
  return {
    id: material.id,
    topicId: material.topic_id,
    title: material.title,
    description: material.description,
    kind: material.kind,
    kindLabel: material.kind_label,
    // Only one of these is ever present; the resource omits the other rather
    // than sending it null, so both are normalised to null here.
    url: material.url ?? null,
    downloadUrl: material.download_url ?? null,
    filename: material.filename,
    mimeType: material.mime_type,
    sizeBytes: material.size_bytes,
    order: material.order,
    isPublished: material.is_published,
  };
}

/**
 * The materials of one topic, in the order their author set.
 *
 * Throws ApiError 403 for a topic the caller cannot open — the caller decides
 * whether that is an error or simply a locked topic.
 */
export async function fetchTopicMaterials(
  topicId: number,
): Promise<LearningMaterial[]> {
  const page = await api.get<Paginated<ApiMaterial>>(
    `/topics/${topicId}/materials?per_page=100`,
  );

  return page.data.map(toMaterial);
}

/** What the author is saving. A file or a url, matching the kind. */
export interface MaterialDraft {
  title: string;
  description: string;
  kind: MaterialKind;
  url: string;
  file: File | null;
  isPublished: boolean;
}

/**
 * Packs a draft for the API.
 *
 * Sent as multipart whether or not there is a file, so one code path covers
 * all three kinds. Only the field the kind actually uses is included: sending
 * a url alongside a file would leave the server to guess which was meant.
 */
function toForm(draft: MaterialDraft): FormData {
  const form = new FormData();

  form.append("title", draft.title);
  form.append("description", draft.description);
  form.append("kind", draft.kind);
  // Booleans cross multipart as strings; these are what Laravel reads as such.
  form.append("is_published", draft.isPublished ? "1" : "0");

  if (draft.kind === "file") {
    if (draft.file) form.append("file", draft.file);
  } else {
    form.append("url", draft.url);
  }

  return form;
}

export async function createMaterial(
  topicId: number,
  draft: MaterialDraft,
): Promise<LearningMaterial> {
  const { data } = await api.upload<{ data: ApiMaterial }>(
    `/admin/topics/${topicId}/materials`,
    toForm(draft),
  );

  return toMaterial(data);
}

/**
 * Saves an edit.
 *
 * POST with a spoofed method: Laravel does not parse a multipart body on PUT
 * or PATCH, and an edit may carry a replacement file.
 */
export async function updateMaterial(
  materialId: number,
  draft: MaterialDraft,
): Promise<LearningMaterial> {
  const form = toForm(draft);
  form.append("_method", "PATCH");

  const { data } = await api.upload<{ data: ApiMaterial }>(
    `/admin/materials/${materialId}`,
    form,
  );

  return toMaterial(data);
}

export async function deleteMaterial(materialId: number): Promise<void> {
  await api.delete(`/admin/materials/${materialId}`);
}

/** Stores a new running order. The whole list is sent, not a moved pair. */
export async function reorderMaterials(
  topicId: number,
  materialIds: number[],
): Promise<LearningMaterial[]> {
  const { data } = await api.put<{ data: ApiMaterial[] }>(
    `/admin/topics/${topicId}/materials/order`,
    { material_ids: materialIds },
  );

  return data.map(toMaterial);
}

/**
 * Fetches an uploaded material and hands it to the browser to save.
 *
 * The file sits on a private disk behind an authenticated route, so it cannot
 * be linked to directly — the token travels in a header and a plain link would
 * not send it. Fetching it here keeps the private storage private: the object
 * URL below points at bytes already in this tab, and is revoked immediately so
 * it cannot outlive the click.
 */
export async function downloadMaterial(
  material: LearningMaterial,
): Promise<void> {
  if (!material.downloadUrl) return;

  const blob = await api.download(pathOf(material.downloadUrl));
  const href = URL.createObjectURL(blob);

  try {
    const link = document.createElement("a");

    link.href = href;
    link.download = material.filename ?? material.title;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(href);
  }
}

/**
 * The API path out of the absolute URL the server built.
 *
 * The resource returns a full URL because it is generated server-side, and the
 * api client prefixes its own base — so the origin and `/api` prefix are
 * trimmed rather than sent twice.
 */
function pathOf(downloadUrl: string): string {
  const path = downloadUrl.replace(/^https?:\/\/[^/]+/, "");

  return path.replace(/^\/api/, "");
}

/** A file size a person can read. */
export function readableSize(bytes: number | null): string | null {
  if (bytes === null) return null;

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }

  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}

/**
 * The YouTube video id out of whatever shape the link was saved in.
 *
 * Lives here rather than in a page because both the student view and the
 * authoring form need it, and two copies would drift.
 *
 * Null for anything that is not YouTube — including a perfectly good video
 * hosted somewhere else. That is a question about which player to build, not
 * about whether the address is allowed; validateDraft below does not consult
 * this.
 */
export function youtubeId(url: string | null): string | null {
  if (!url) return null;

  const patterns = [
    /[?&]v=([\w-]{6,})/, // watch?v=ID
    /youtu\.be\/([\w-]{6,})/, // youtu.be/ID
    /\/embed\/([\w-]{6,})/, // /embed/ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  // A bare id, which is how an instructor is most likely to paste it wrong.
  return /^[\w-]{6,}$/.test(url.trim()) ? url.trim() : null;
}

/** A Google Drive file id out of a share link, or null. */
function driveFileId(url: string): string | null {
  const match = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);

  return match ? match[1] : null;
}

/**
 * An address that plays this video inside the page, or null to just link out.
 *
 * Only the two hosts whose embed URL can be derived from a share link are
 * recognised. Everything else is still a perfectly valid video material — it
 * opens where it lives instead, which is what an embed nobody can build would
 * have to fall back to anyway.
 */
export function videoEmbedUrl(url: string | null): string | null {
  if (!url) return null;

  const youtube = youtubeId(url);

  if (youtube) return `https://www.youtube.com/embed/${youtube}`;

  const drive = driveFileId(url);

  return drive ? `https://drive.google.com/file/d/${drive}/preview` : null;
}

/**
 * What is wrong with this draft, per field, or nothing.
 *
 * The server validates all of this again and is the authority; this exists so
 * an author is told before a round trip, and so the message names the field
 * they need to fix. Which is also why it asks exactly what the server asks and
 * no more: a rule enforced only here is a rule that rejects work the API would
 * have taken, and the author has no way to appeal it.
 *
 * A video is any address a browser can open — YouTube, a Google Drive share
 * link, a university's own recording. The platform hosts documents (PDF and
 * slide decks, through the file kind) and points at video rather than storing
 * it, so refusing everything but YouTube refused most of the material staff
 * actually have.
 */
export function validateDraft(
  draft: MaterialDraft,
  { isNew }: { isNew: boolean },
): Partial<Record<"title" | "url" | "file", string>> {
  const errors: Partial<Record<"title" | "url" | "file", string>> = {};

  if (draft.title.trim() === "") {
    errors.title = "Give the material a title.";
  }

  if (draft.kind === "file") {
    // An edit keeps the file it already has unless a new one is chosen.
    if (isNew && !draft.file) {
      errors.file = "Choose a file to upload.";
    }
  } else if (draft.url.trim() === "") {
    errors.url = "Add the web address.";
  } else if (!/^https?:\/\/\S+$/i.test(draft.url.trim())) {
    errors.url = "The address must start with http:// or https://.";
  }

  return errors;
}
