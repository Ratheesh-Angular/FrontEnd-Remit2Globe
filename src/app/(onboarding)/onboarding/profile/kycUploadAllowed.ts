/** Matches backend KYC upload limits in `upload.middleware.ts` (keep in sync). */

export const KYC_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

/** Non-image/text MIME types we accept explicitly (office, pdf, etc.). */
const SPECIFIC_ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/rtf",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
]);

/** When the browser sends no type or octet-stream, allow these extensions. */
export const KYC_ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".jpe",
  ".jfif",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".tif",
  ".tiff",
  ".heic",
  ".heif",
  ".avif",
  ".svg",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
  ".rtf",
  ".odt",
  ".ods",
]);

export function kycUploadFileExtension(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i >= 0 ? fileName.slice(i).toLowerCase() : "";
}

export function isAllowedKycUpload(file: File): boolean {
  const t = file.type.trim().toLowerCase();
  if (t.startsWith("image/")) return true;
  if (t.startsWith("text/")) return true;
  if (SPECIFIC_ALLOWED_MIMES.has(t)) return true;

  if (!t || t === "application/octet-stream") {
    const ext = kycUploadFileExtension(file.name);
    return ext !== "" && KYC_ALLOWED_EXTENSIONS.has(ext);
  }

  return false;
}

/** Broad picker hint; validation uses `isAllowedKycUpload`. */
export const KYC_FILE_INPUT_ACCEPT = [
  ...Array.from(KYC_ALLOWED_EXTENSIONS),
  "image/*",
  "text/*",
  "application/pdf",
].join(",");

export function kycUploadMaxSizeLabelMb(): number {
  return Math.round(KYC_UPLOAD_MAX_BYTES / (1024 * 1024));
}

export function parseKycUploadErrorMessage(error: unknown): string | undefined {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    (error as { response?: { data?: { message?: unknown } } }).response?.data
  ) {
    const m = (error as { response: { data: { message?: unknown } } }).response
      .data.message;
    if (typeof m === "string") return m;
  }
  return undefined;
}
