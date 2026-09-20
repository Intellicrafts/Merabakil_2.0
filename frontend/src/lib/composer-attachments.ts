export type ComposerAttachmentStatus = "uploading" | "reading" | "ready" | "failed";

export interface ComposerAttachment {
  localId: string;
  fileName: string;
  size: number;
  contentType: string;
  previewUrl?: string;
  status: ComposerAttachmentStatus;
  percent: number;
  documentId?: string;
  error?: string;
}

export const ACCEPTED_FILE_TYPES =
  ".pdf,.doc,.docx,.txt,.csv,.md,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

export const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".csv",
  ".md",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
];

export const MAX_COMPOSER_FILES = 5;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export function isImageFile(name: string, contentType = ""): boolean {
  const lower = name.toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].some((ext) => lower.endsWith(ext))) return true;
  return contentType.startsWith("image/");
}

export function composerFileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function buildDefaultAttachmentQuery(
  attachments: Pick<ComposerAttachment, "fileName" | "contentType">[],
): string {
  if (attachments.length === 0) return "";
  const imageCount = attachments.filter((a) => isImageFile(a.fileName, a.contentType)).length;
  if (imageCount === attachments.length) {
    return "Please analyze this image and explain what it shows, including any visible text and legal relevance.";
  }
  if (imageCount === 0) {
    return "Please summarize and explain the key points in this document.";
  }
  return "Please review and explain the attached files.";
}

export function validateComposerFile(file: File): "ok" | "type" | "empty" | "large" {
  const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  if (!ACCEPTED_EXTENSIONS.includes(ext)) return "type";
  if (file.size === 0) return "empty";
  if (file.size > MAX_FILE_BYTES) return "large";
  return "ok";
}
